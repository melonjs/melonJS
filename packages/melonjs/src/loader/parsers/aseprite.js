import { imgList, jsonList } from "../cache.js";
import { fetchData } from "./fetchdata.js";

// Aseprite file format spec: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
const ASE_MAGIC_FILE = 0xa5e0;
const ASE_MAGIC_FRAME = 0xf1fa;

// chunk types we handle (others are skipped)
const CHUNK_OLD_PALETTE_04 = 0x0004;
const CHUNK_OLD_PALETTE_11 = 0x0011;
const CHUNK_LAYER = 0x2004;
const CHUNK_CEL = 0x2005;
const CHUNK_PALETTE = 0x2019;
const CHUNK_TAGS = 0x2018;
// Aseprite's own tilemap feature — authored inside Aseprite as a tilemap layer.
// The tileset chunk carries the per-tile bitmap, and tilemap cels (type 3)
// carry tile indices instead of pixels. We deliberately reject these files
// rather than produce a silent empty composite.
const CHUNK_TILESET = 0x2023;

// cel types
const CEL_RAW_IMAGE = 0;
const CEL_LINKED = 1;
const CEL_COMPRESSED_IMAGE = 2;
const CEL_COMPRESSED_TILEMAP = 3;

const ERR_TILEMAP_MODE =
	"aseprite: this file uses Aseprite's tilemap mode (tileset chunk or " +
	"tilemap-cel), which is not supported. Export the sprite to a regular PNG " +
	"(File → Export Sprite Sheet) or flatten the tilemap layer to pixel layers.";

// color depths
const DEPTH_RGBA = 32;
const DEPTH_GRAYSCALE = 16;
const DEPTH_INDEXED = 8;

// layer flags
const LAYER_FLAG_VISIBLE = 1;

const TAG_DIRECTIONS = ["forward", "reverse", "pingpong", "pingpong_reverse"];

/**
 * lightweight little-endian binary reader over an ArrayBuffer.
 */
class Reader {
	constructor(buffer, offset = 0) {
		this.view = new DataView(buffer);
		this.bytes = new Uint8Array(buffer);
		this.offset = offset;
	}
	u8() {
		return this.view.getUint8(this.offset++);
	}
	u16() {
		const v = this.view.getUint16(this.offset, true);
		this.offset += 2;
		return v;
	}
	i16() {
		const v = this.view.getInt16(this.offset, true);
		this.offset += 2;
		return v;
	}
	u32() {
		const v = this.view.getUint32(this.offset, true);
		this.offset += 4;
		return v;
	}
	i32() {
		const v = this.view.getInt32(this.offset, true);
		this.offset += 4;
		return v;
	}
	str() {
		const len = this.u16();
		const slice = this.bytes.subarray(this.offset, this.offset + len);
		this.offset += len;
		return new TextDecoder("utf-8").decode(slice);
	}
	skip(n) {
		this.offset += n;
	}
	slice(n) {
		const out = this.bytes.subarray(this.offset, this.offset + n);
		this.offset += n;
		return out;
	}
}

/**
 * Decompress a zlib-compressed Uint8Array via the DecompressionStream API
 * (zlib format = "deflate" stream type per the WHATWG Compression Streams spec).
 * @ignore
 */
async function inflate(bytes) {
	const stream = new Response(bytes).body.pipeThrough(
		new DecompressionStream("deflate"),
	);
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decode a cel's pixel buffer (per the file's color depth) into a flat
 * RGBA Uint8ClampedArray sized for ImageData.
 * @ignore
 */
function decodeCelPixels(raw, w, h, depth, palette, transparentIndex) {
	const out = new Uint8ClampedArray(w * h * 4);
	switch (depth) {
		case DEPTH_RGBA:
			// already RGBA; copy through
			out.set(raw);
			break;
		case DEPTH_GRAYSCALE:
			for (let i = 0, j = 0; i < w * h; i++, j += 4) {
				const v = raw[i * 2];
				const a = raw[i * 2 + 1];
				out[j] = v;
				out[j + 1] = v;
				out[j + 2] = v;
				out[j + 3] = a;
			}
			break;
		case DEPTH_INDEXED:
			for (let i = 0, j = 0; i < w * h; i++, j += 4) {
				const idx = raw[i];
				if (idx === transparentIndex) {
					out[j] = 0;
					out[j + 1] = 0;
					out[j + 2] = 0;
					out[j + 3] = 0;
				} else {
					const p = palette[idx];
					if (p) {
						out[j] = p[0];
						out[j + 1] = p[1];
						out[j + 2] = p[2];
						out[j + 3] = p[3];
					}
				}
			}
			break;
		default:
			throw new Error("aseprite: unsupported color depth " + depth);
	}
	return out;
}

/**
 * Parse an Aseprite binary file into an intermediate structure:
 * { width, height, depth, frames: [{ duration, cels: [...] }], layers, tags, palette }.
 * Cel image data is already decompressed at this stage but still per-cel —
 * compositing happens in a second pass so linked cels can resolve.
 * @ignore
 */
async function parseAsepriteFile(buffer) {
	const r = new Reader(buffer);

	// --- file header (128 bytes total — see Aseprite format spec) ---
	r.u32(); // file size (we trust the buffer length)
	const magic = r.u16();
	if (magic !== ASE_MAGIC_FILE) {
		throw new Error(
			"aseprite: invalid file magic 0x" +
				magic.toString(16) +
				" (expected 0xA5E0)",
		);
	}
	const frameCount = r.u16();
	const width = r.u16();
	const height = r.u16();
	const depth = r.u16();
	r.u32(); // flags
	r.u16(); // deprecated speed
	r.u32();
	r.u32();
	const transparentIndex = r.u8();
	r.skip(3);
	r.u16(); // number of colors (unused)
	// the remaining 92 bytes of the header (pixel ratio, grid x/y/w/h, 84 reserved)
	// aren't used here; seek to the absolute end of the 128-byte header so the
	// first frame starts at the correct offset
	r.offset = 128;

	const palette = []; // index → [r,g,b,a]
	const layers = []; // [{ flags, name, visible, ... }]
	const tags = []; // [{ name, from, to, direction }]
	const frames = []; // [{ duration, cels: [{ layer, x, y, opacity, w, h, pixels|linkFrame }] }]
	// stack of effective (ancestor-chain) visibility keyed by Aseprite's
	// "child level" field. Layer chunks arrive in tree order — children
	// follow their group — so we can resolve "am I inside a hidden group?"
	// by reading the most-recent stack slot at the level above.
	const ancestorVisible = [];

	for (let f = 0; f < frameCount; f++) {
		const frameStart = r.offset;
		const frameSize = r.u32();
		const fmagic = r.u16();
		if (fmagic !== ASE_MAGIC_FRAME) {
			throw new Error(
				"aseprite: invalid frame magic at frame " +
					f +
					" (got 0x" +
					fmagic.toString(16) +
					")",
			);
		}
		let chunkCount = r.u16();
		const duration = r.u16();
		r.skip(2);
		const newChunks = r.u32();
		// per spec: the 32-bit chunk count is only authoritative when the
		// 16-bit field is saturated (0xFFFF). Older Aseprite versions wrote
		// zero into the new field, so a non-zero new field doesn't imply the
		// old one is invalid.
		if (chunkCount === 0xffff) {
			chunkCount = newChunks;
		}

		const cels = [];

		for (let c = 0; c < chunkCount; c++) {
			const chunkStart = r.offset;
			const chunkSize = r.u32();
			const chunkType = r.u16();
			const chunkEnd = chunkStart + chunkSize;

			switch (chunkType) {
				case CHUNK_LAYER: {
					const flags = r.u16();
					r.u16(); // layer type (0=normal, 1=group, 2=tilemap)
					const childLevel = r.u16();
					r.u16(); // default width (unused)
					r.u16(); // default height (unused)
					r.u16(); // blend mode (TODO: honor non-normal modes)
					r.u8(); // opacity
					r.skip(3);
					const name = r.str();
					const selfVisible = (flags & LAYER_FLAG_VISIBLE) !== 0;
					const parentVisible =
						childLevel === 0 ? true : ancestorVisible[childLevel - 1] !== false;
					const visible = selfVisible && parentVisible;
					ancestorVisible[childLevel] = visible;
					// truncate the stack past this level so a future sibling at the
					// same level doesn't inherit a stale deeper-nested visibility
					ancestorVisible.length = childLevel + 1;
					layers.push({ flags, name, visible });
					break;
				}
				case CHUNK_CEL: {
					const layer = r.u16();
					const x = r.i16();
					const y = r.i16();
					const opacity = r.u8();
					const celType = r.u16();
					r.skip(7);
					if (celType === CEL_RAW_IMAGE) {
						const cw = r.u16();
						const ch = r.u16();
						const pixelBytes = cw * ch * (depth / 8);
						const raw = r.slice(pixelBytes);
						cels.push({ layer, x, y, opacity, w: cw, h: ch, raw });
					} else if (celType === CEL_LINKED) {
						const linkFrame = r.u16();
						cels.push({ layer, x, y, opacity, linkFrame });
					} else if (celType === CEL_COMPRESSED_IMAGE) {
						const cw = r.u16();
						const ch = r.u16();
						const compressed = r.slice(chunkEnd - r.offset);
						// decompress; pixel decode happens after we know depth+palette
						// for the final composite pass
						const inflated = await inflate(compressed);
						cels.push({
							layer,
							x,
							y,
							opacity,
							w: cw,
							h: ch,
							raw: inflated,
						});
					} else if (celType === CEL_COMPRESSED_TILEMAP) {
						throw new Error(ERR_TILEMAP_MODE);
					}
					// unknown cel types are skipped via chunkEnd
					break;
				}
				case CHUNK_PALETTE: {
					const size = r.u32();
					const first = r.u32();
					const last = r.u32();
					r.skip(8);
					for (let i = first; i <= last; i++) {
						const flags = r.u16();
						const cr = r.u8();
						const cg = r.u8();
						const cb = r.u8();
						const ca = r.u8();
						if (flags & 1) {
							r.str();
						} // skip color name
						palette[i] = [cr, cg, cb, ca];
					}
					// keep size for sanity; chunkEnd will realign
					void size;
					break;
				}
				case CHUNK_OLD_PALETTE_04:
				case CHUNK_OLD_PALETTE_11: {
					// only use the old palette chunk if no new palette has been read.
					// 0x0004 stores RGB as full bytes (0-255); 0x0011 uses 6-bit values
					// (0-63) — scale them up so both decode to the same color space.
					const isLegacy6Bit = chunkType === CHUNK_OLD_PALETTE_11;
					if (palette.length === 0) {
						const packets = r.u16();
						let idx = 0;
						for (let p = 0; p < packets; p++) {
							idx += r.u8(); // skip entries
							let entries = r.u8();
							if (entries === 0) {
								entries = 256;
							}
							for (let e = 0; e < entries; e++) {
								let cr = r.u8();
								let cg = r.u8();
								let cb = r.u8();
								if (isLegacy6Bit) {
									// expand 6-bit (0-63) to 8-bit (0-255)
									cr = (cr << 2) | (cr >> 4);
									cg = (cg << 2) | (cg >> 4);
									cb = (cb << 2) | (cb >> 4);
								}
								palette[idx++] = [cr, cg, cb, 255];
							}
						}
					}
					break;
				}
				case CHUNK_TAGS: {
					const count = r.u16();
					r.skip(8);
					for (let t = 0; t < count; t++) {
						const from = r.u16();
						const to = r.u16();
						const dir = r.u8();
						// per spec: WORD repeat count (0 = play forever), then
						// 6 bytes reserved. Older files predate the repeat field
						// and write zero here, which naturally maps to "infinite".
						const repeat = r.u16();
						r.skip(6);
						r.skip(3); // RGB (deprecated)
						r.skip(1);
						const name = r.str();
						tags.push({
							name,
							from,
							to,
							direction: TAG_DIRECTIONS[dir] || "forward",
							repeat,
						});
					}
					break;
				}
				case CHUNK_TILESET:
					throw new Error(ERR_TILEMAP_MODE);
				default:
					// unknown / unhandled chunk — skip via chunkEnd
					break;
			}

			// jump to end of chunk regardless of how much we consumed
			r.offset = chunkEnd;
		}

		frames.push({ duration, cels });
		// jump to end of frame to handle trailing data / padding
		r.offset = frameStart + frameSize;
	}

	return {
		width,
		height,
		depth,
		transparentIndex,
		palette,
		layers,
		tags,
		frames,
	};
}

/**
 * Composite all frames into a single horizontal sprite-strip canvas, drawing
 * each visible cel onto its frame at (cel.x, cel.y). Returns the composited
 * canvas (HTMLCanvasElement or OffscreenCanvas).
 * @ignore
 */
function composite(parsed) {
	const { width, height, depth, frames, layers, palette, transparentIndex } =
		parsed;
	const stripWidth = width * frames.length;
	const stripHeight = height;

	const canvas =
		typeof OffscreenCanvas !== "undefined"
			? new OffscreenCanvas(stripWidth, stripHeight)
			: Object.assign(document.createElement("canvas"), {
					width: stripWidth,
					height: stripHeight,
				});
	const ctx = canvas.getContext("2d");
	ctx.imageSmoothingEnabled = false;

	for (let f = 0; f < frames.length; f++) {
		const frame = frames[f];
		const fx = f * width;

		// sort cels by layer index to draw bottom-up
		const ordered = frame.cels.slice().sort((a, b) => {
			return a.layer - b.layer;
		});
		for (const cel of ordered) {
			const layer = layers[cel.layer];
			// `visible` is the effective visibility (own flag AND every ancestor
			// group's flag); a child layer inside a hidden group still has its
			// own VISIBLE bit set but its `visible` resolves to false
			if (layer && layer.visible === false) {
				continue;
			}

			// resolve linked cels by copying the source frame's cel for this layer
			let source = cel;
			if (cel.linkFrame !== undefined) {
				source = frames[cel.linkFrame]?.cels.find((c) => {
					return c.layer === cel.layer;
				});
				if (!source || !source.raw) {
					continue;
				}
			}

			const rgba = decodeCelPixels(
				source.raw,
				source.w,
				source.h,
				depth,
				palette,
				transparentIndex,
			);
			const img = new ImageData(rgba, source.w, source.h);

			// Always go through an intermediate canvas + drawImage. putImageData
			// replaces destination pixels wholesale (including any transparent
			// holes in the source), which would erase lower layers wherever an
			// upper layer is transparent — we need source-over compositing.
			const tmp =
				typeof OffscreenCanvas !== "undefined"
					? new OffscreenCanvas(source.w, source.h)
					: Object.assign(document.createElement("canvas"), {
							width: source.w,
							height: source.h,
						});
			tmp.getContext("2d").putImageData(img, 0, 0);
			if (cel.opacity !== 255) {
				ctx.globalAlpha = cel.opacity / 255;
			}
			ctx.drawImage(tmp, fx + cel.x, cel.y);
			if (cel.opacity !== 255) {
				ctx.globalAlpha = 1;
			}
		}
	}

	return canvas;
}

/**
 * Build the JSON sidecar in the shape expected by parseAseprite()
 * in src/video/texture/parser/aseprite.js — meta.app must include
 * "aseprite" so identifyFormat() picks the right route.
 * @ignore
 */
function buildAtlasJSON(parsed, imageName) {
	const { width, height, frames, tags } = parsed;
	const out = {};
	for (let i = 0; i < frames.length; i++) {
		out[String(i)] = {
			frame: { x: i * width, y: 0, w: width, h: height },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w: width, h: height },
			sourceSize: { w: width, h: height },
			duration: frames[i].duration,
		};
	}
	return {
		frames: out,
		meta: {
			app: "http://www.aseprite.org/",
			version: "binary",
			image: imageName,
			format: "RGBA8888",
			size: { w: width * frames.length, h: height },
			scale: "1",
			frameTags: tags,
		},
	};
}

/**
 * Convert a canvas to an ImageBitmap when possible (matches the regular image
 * parser's cache shape so the renderer's texture cache treats it identically).
 * @ignore
 */
async function canvasToBitmap(canvas) {
	if (
		typeof canvas.transferToImageBitmap === "function" &&
		typeof createImageBitmap === "function"
	) {
		return canvas.transferToImageBitmap();
	}
	if (typeof createImageBitmap === "function") {
		return await createImageBitmap(canvas);
	}
	return canvas;
}

/**
 * Parse a raw .aseprite ArrayBuffer into a composited bitmap and an atlas-style
 * JSON sidecar. Exported for advanced use cases (e.g. runtime-generated sprites)
 * — the preload path below is the usual entry point.
 */
export async function parseAseprite(buffer, imageName = "default") {
	const parsed = await parseAsepriteFile(buffer);
	const canvas = composite(parsed);
	const bitmap = await canvasToBitmap(canvas);
	const json = buildAtlasJSON(parsed, imageName);
	return { bitmap, json };
}

/**
 * preload an .aseprite binary file: fetches the file, parses + composites it,
 * then stores the resulting bitmap in `imgList` and the JSON sidecar in
 * `jsonList` under the same asset name — so TextureAtlas, TMXTileset, etc.
 * can resolve it via the usual getImage() / getJSON() lookups.
 * @param {loader.Asset} data - asset descriptor
 * @param {Function} [onload]
 * @param {Function} [onerror]
 * @param {Object} [settings]
 * @returns {number}
 * @ignore
 */
export function preloadAseprite(data, onload, onerror, settings) {
	fetchData(data.src, "arrayBuffer", settings)
		.then(async (buffer) => {
			const { bitmap, json } = await parseAseprite(buffer, data.name);
			imgList[data.name] = bitmap;
			jsonList[data.name] = json;
			if (typeof onload === "function") {
				onload();
			}
		})
		.catch((error) => {
			// surface the real error — the loader's generic onerror only knows
			// "this asset failed", which makes binary-format issues impossible
			// to debug from the outside
			console.error(`Failed to parse aseprite asset "${data.name}":`, error);
			if (typeof onerror === "function") {
				onerror(error);
			}
		});

	return 1;
}
