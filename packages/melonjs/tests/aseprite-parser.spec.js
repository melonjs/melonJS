/**
 * Unit tests for the .aseprite binary parser.
 *
 * These tests synthesize minimal Aseprite files in-memory (header + chunks)
 * so the parser is exercised without binary fixtures. Runs under vitest's
 * Chromium browser harness — DecompressionStream / OffscreenCanvas / ImageData
 * are all available.
 *
 * Spec reference: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
 */

import { describe, expect, it } from "vitest";
import { parseAseprite } from "../src/loader/parsers/aseprite.js";

// --- byte-stream writer used to assemble synthetic .aseprite buffers ---
class Writer {
	constructor() {
		this.parts = [];
		this.length = 0;
	}
	push(arr) {
		this.parts.push(arr);
		this.length += arr.length;
	}
	u8(v) {
		this.push(new Uint8Array([v & 0xff]));
	}
	u16(v) {
		const b = new Uint8Array(2);
		new DataView(b.buffer).setUint16(0, v, true);
		this.push(b);
	}
	i16(v) {
		const b = new Uint8Array(2);
		new DataView(b.buffer).setInt16(0, v, true);
		this.push(b);
	}
	u32(v) {
		const b = new Uint8Array(4);
		new DataView(b.buffer).setUint32(0, v, true);
		this.push(b);
	}
	bytes(arr) {
		this.push(arr);
	}
	zeros(n) {
		this.push(new Uint8Array(n));
	}
	str(s) {
		const enc = new TextEncoder().encode(s);
		this.u16(enc.length);
		this.bytes(enc);
	}
	toBuffer() {
		const out = new Uint8Array(this.length);
		let off = 0;
		for (const p of this.parts) {
			out.set(p, off);
			off += p.length;
		}
		return out.buffer;
	}
}

// patch a u32 length field after the fact (chunk/frame size is known once
// the contents are written)
function patchU32(buffer, offset, value) {
	const view = new DataView(buffer);
	view.setUint32(offset, value, true);
}

// build a minimal valid aseprite file header (128 bytes total)
// named fields occupy the first 34 bytes; pad the rest to 128
function writeHeader(w, { frames, width, height, depth = 32 }) {
	const start = w.length;
	w.u32(0); // file size — patched later
	w.u16(0xa5e0); // magic
	w.u16(frames); // frame count
	w.u16(width);
	w.u16(height);
	w.u16(depth);
	w.u32(1); // flags
	w.u16(100); // speed (deprecated)
	w.u32(0);
	w.u32(0);
	w.u8(0); // transparent palette index
	w.zeros(3);
	w.u16(0); // num colors
	w.zeros(128 - (w.length - start));
}

// write a layer chunk (visible) — produces a 6-byte chunk header + body
function writeLayerChunk(w, name) {
	const sizeOffset = w.length;
	w.u32(0); // chunk size — patched
	w.u16(0x2004); // chunk type: layer
	w.u16(1); // flags: visible
	w.u16(0); // type: normal
	w.u16(0); // child level
	w.u16(0); // default width
	w.u16(0); // default height
	w.u16(0); // blend mode (normal)
	w.u8(255); // opacity
	w.zeros(3);
	w.str(name);
	const end = w.length;
	patchU32WriterPart(w, sizeOffset, end - sizeOffset);
}

// write a raw-image cel chunk at (x,y) on `layer`, with RGBA pixels
function writeRawCelChunk(w, { layer, x, y, width, height, rgbaPixels }) {
	const sizeOffset = w.length;
	w.u32(0); // chunk size — patched
	w.u16(0x2005); // chunk type: cel
	w.u16(layer);
	w.i16(x);
	w.i16(y);
	w.u8(255); // opacity
	w.u16(0); // cel type 0 = raw image
	w.zeros(7);
	w.u16(width);
	w.u16(height);
	w.bytes(rgbaPixels);
	const end = w.length;
	patchU32WriterPart(w, sizeOffset, end - sizeOffset);
}

// write a linked cel referring to a previous frame's same-layer cel
function writeLinkedCelChunk(w, { layer, x, y, linkFrame }) {
	const sizeOffset = w.length;
	w.u32(0);
	w.u16(0x2005);
	w.u16(layer);
	w.i16(x);
	w.i16(y);
	w.u8(255);
	w.u16(1); // cel type 1 = linked
	w.zeros(7);
	w.u16(linkFrame);
	const end = w.length;
	patchU32WriterPart(w, sizeOffset, end - sizeOffset);
}

// write a compressed cel chunk — RGBA pixels are zlib-compressed at test time
async function writeCompressedCelChunk(
	w,
	{ layer, x, y, width, height, rgbaPixels },
) {
	const compressed = await deflateZlib(rgbaPixels);
	const sizeOffset = w.length;
	w.u32(0);
	w.u16(0x2005);
	w.u16(layer);
	w.i16(x);
	w.i16(y);
	w.u8(255);
	w.u16(2); // cel type 2 = compressed image
	w.zeros(7);
	w.u16(width);
	w.u16(height);
	w.bytes(compressed);
	const end = w.length;
	patchU32WriterPart(w, sizeOffset, end - sizeOffset);
}

// write a tags chunk
function writeTagsChunk(w, tags) {
	const sizeOffset = w.length;
	w.u32(0);
	w.u16(0x2018); // chunk type: tags
	w.u16(tags.length);
	w.zeros(8);
	for (const tag of tags) {
		w.u16(tag.from);
		w.u16(tag.to);
		w.u8(tag.direction ?? 0); // 0 = forward
		w.zeros(8);
		w.zeros(3); // deprecated RGB
		w.zeros(1);
		w.str(tag.name);
	}
	const end = w.length;
	patchU32WriterPart(w, sizeOffset, end - sizeOffset);
}

// write a frame header with the given chunk-emitting body fn
// bodyFn may be async (e.g. when emitting compressed cels via zlib)
async function writeFrame(w, { duration }, bodyFn) {
	const frameStart = w.length;
	w.u32(0); // frame size — patched
	w.u16(0xf1fa); // frame magic
	w.u16(0xffff); // old chunks count: 0xFFFF means "use the 32-bit field below"
	w.u16(duration);
	w.zeros(2);
	const chunkCountOffset = w.length;
	w.u32(0); // new chunks count — patched

	let chunkCount = 0;
	await bodyFn({
		layer: (name) => {
			writeLayerChunk(w, name);
			chunkCount++;
		},
		rawCel: (opts) => {
			writeRawCelChunk(w, opts);
			chunkCount++;
		},
		linkedCel: (opts) => {
			writeLinkedCelChunk(w, opts);
			chunkCount++;
		},
		compressedCel: async (opts) => {
			await writeCompressedCelChunk(w, opts);
			chunkCount++;
		},
		tags: (tags) => {
			writeTagsChunk(w, tags);
			chunkCount++;
		},
	});

	const end = w.length;
	patchU32WriterPart(w, frameStart, end - frameStart);
	patchU32WriterPart(w, chunkCountOffset, chunkCount);
}

// the writer holds Uint8Array parts before we concat to a buffer, so an
// in-place patch must walk the parts list and mutate the right one. We could
// alternately concat-then-patch, but patching the parts keeps construction
// order simple.
function patchU32WriterPart(w, byteOffset, value) {
	let off = 0;
	for (const part of w.parts) {
		if (byteOffset >= off && byteOffset < off + part.length) {
			new DataView(part.buffer, part.byteOffset, part.byteLength).setUint32(
				byteOffset - off,
				value,
				true,
			);
			return;
		}
		off += part.length;
	}
	throw new Error("patchU32: offset out of range");
}

async function deflateZlib(bytes) {
	const stream = new Response(bytes).body.pipeThrough(
		new CompressionStream("deflate"),
	);
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

// read a single RGBA pixel from an ImageBitmap or canvas at (x,y)
function readPixel(bitmap, x, y) {
	const canvas =
		typeof OffscreenCanvas !== "undefined"
			? new OffscreenCanvas(bitmap.width, bitmap.height)
			: Object.assign(document.createElement("canvas"), {
					width: bitmap.width,
					height: bitmap.height,
				});
	const ctx = canvas.getContext("2d");
	ctx.drawImage(bitmap, 0, 0);
	return Array.from(ctx.getImageData(x, y, 1, 1).data);
}

// 2×2 RGBA test pattern: TL=red, TR=green, BL=blue, BR=white
const PATTERN_2X2 = new Uint8Array([
	255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
]);

describe("aseprite binary parser", () => {
	it("parses a minimal single-frame RGBA file", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 1, width: 2, height: 2 });
		await writeFrame(w, { duration: 100 }, ({ layer, rawCel }) => {
			layer("layer0");
			rawCel({
				layer: 0,
				x: 0,
				y: 0,
				width: 2,
				height: 2,
				rgbaPixels: PATTERN_2X2,
			});
		});
		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength); // file size

		const { bitmap, json } = await parseAseprite(buffer, "test");

		expect(bitmap.width).toBe(2);
		expect(bitmap.height).toBe(2);

		expect(json.meta.app).toBe("http://www.aseprite.org/");
		expect(json.meta.size).toEqual({ w: 2, h: 2 });
		expect(json.meta.image).toBe("test");
		expect(json.frames["0"].frame).toEqual({ x: 0, y: 0, w: 2, h: 2 });
		expect(json.frames["0"].duration).toBe(100);
	});

	it("decodes RGBA pixels at the expected positions", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 1, width: 2, height: 2 });
		await writeFrame(w, { duration: 100 }, ({ layer, rawCel }) => {
			layer("layer0");
			rawCel({
				layer: 0,
				x: 0,
				y: 0,
				width: 2,
				height: 2,
				rgbaPixels: PATTERN_2X2,
			});
		});
		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		const { bitmap } = await parseAseprite(buffer, "test");

		expect(readPixel(bitmap, 0, 0)).toEqual([255, 0, 0, 255]); // TL red
		expect(readPixel(bitmap, 1, 0)).toEqual([0, 255, 0, 255]); // TR green
		expect(readPixel(bitmap, 0, 1)).toEqual([0, 0, 255, 255]); // BL blue
		expect(readPixel(bitmap, 1, 1)).toEqual([255, 255, 255, 255]); // BR white
	});

	it("lays multi-frame sprites out as a horizontal strip", async () => {
		const frame2 = new Uint8Array([
			0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
		]); // all black

		const w = new Writer();
		writeHeader(w, { frames: 2, width: 2, height: 2 });
		await writeFrame(w, { duration: 50 }, ({ layer, rawCel }) => {
			layer("layer0");
			rawCel({
				layer: 0,
				x: 0,
				y: 0,
				width: 2,
				height: 2,
				rgbaPixels: PATTERN_2X2,
			});
		});
		await writeFrame(w, { duration: 75 }, ({ rawCel }) => {
			// layer chunk only needs to appear in frame 0; cel.layer 0 still
			// resolves through the already-registered layer
			rawCel({ layer: 0, x: 0, y: 0, width: 2, height: 2, rgbaPixels: frame2 });
		});
		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		const { bitmap, json } = await parseAseprite(buffer, "strip");

		expect(bitmap.width).toBe(4);
		expect(bitmap.height).toBe(2);
		expect(json.meta.size).toEqual({ w: 4, h: 2 });
		expect(json.frames["0"].frame).toEqual({ x: 0, y: 0, w: 2, h: 2 });
		expect(json.frames["1"].frame).toEqual({ x: 2, y: 0, w: 2, h: 2 });
		expect(json.frames["0"].duration).toBe(50);
		expect(json.frames["1"].duration).toBe(75);

		// frame 0 still red TL, frame 1 black TL (sampled at strip x=2)
		expect(readPixel(bitmap, 0, 0)).toEqual([255, 0, 0, 255]);
		expect(readPixel(bitmap, 2, 0)).toEqual([0, 0, 0, 255]);
	});

	it("inflates zlib-compressed cel pixel data", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 1, width: 2, height: 2 });
		await writeFrame(w, { duration: 100 }, async ({ layer, compressedCel }) => {
			layer("layer0");
			await compressedCel({
				layer: 0,
				x: 0,
				y: 0,
				width: 2,
				height: 2,
				rgbaPixels: PATTERN_2X2,
			});
		});
		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		const { bitmap } = await parseAseprite(buffer, "compressed");
		expect(readPixel(bitmap, 0, 0)).toEqual([255, 0, 0, 255]);
		expect(readPixel(bitmap, 1, 1)).toEqual([255, 255, 255, 255]);
	});

	it("resolves linked cels by copying the source frame", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 2, width: 2, height: 2 });
		await writeFrame(w, { duration: 100 }, ({ layer, rawCel }) => {
			layer("layer0");
			rawCel({
				layer: 0,
				x: 0,
				y: 0,
				width: 2,
				height: 2,
				rgbaPixels: PATTERN_2X2,
			});
		});
		await writeFrame(w, { duration: 100 }, ({ linkedCel }) => {
			linkedCel({ layer: 0, x: 0, y: 0, linkFrame: 0 });
		});
		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		const { bitmap } = await parseAseprite(buffer, "linked");
		// frame 1 (x=2..3) should match frame 0's TL pixel
		expect(readPixel(bitmap, 2, 0)).toEqual([255, 0, 0, 255]);
		expect(readPixel(bitmap, 3, 1)).toEqual([255, 255, 255, 255]);
	});

	it("emits frameTags into meta", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 2, width: 2, height: 2 });
		await writeFrame(w, { duration: 100 }, ({ layer, rawCel, tags }) => {
			layer("layer0");
			rawCel({
				layer: 0,
				x: 0,
				y: 0,
				width: 2,
				height: 2,
				rgbaPixels: PATTERN_2X2,
			});
			tags([
				{ name: "idle", from: 0, to: 1, direction: 0 },
				{ name: "wave", from: 1, to: 1, direction: 1 },
			]);
		});
		await writeFrame(w, { duration: 100 }, ({ rawCel }) => {
			rawCel({
				layer: 0,
				x: 0,
				y: 0,
				width: 2,
				height: 2,
				rgbaPixels: PATTERN_2X2,
			});
		});
		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		const { json } = await parseAseprite(buffer, "tagged");

		expect(json.meta.frameTags).toEqual([
			{ name: "idle", from: 0, to: 1, direction: "forward", repeat: 0 },
			{ name: "wave", from: 1, to: 1, direction: "reverse", repeat: 0 },
		]);
	});

	it("rejects files with an invalid magic number", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 1, width: 2, height: 2 });
		const buffer = w.toBuffer();
		// stomp on the magic word
		new DataView(buffer).setUint16(4, 0xdead, true);

		await expect(parseAseprite(buffer, "bad")).rejects.toThrow(
			/invalid file magic/,
		);
	});

	it("rejects files containing an Aseprite tileset chunk (0x2023)", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 1, width: 2, height: 2 });

		// hand-roll a frame containing a single tileset chunk — `writeFrame`'s
		// body callback only knows about supported chunk types and won't bump
		// its chunkCount for arbitrary inline chunks
		const frameStart = w.length;
		w.u32(0);
		w.u16(0xf1fa);
		w.u16(0xffff);
		w.u16(100);
		w.zeros(2);
		w.u32(1); // 1 chunk: the tileset chunk

		const chunkStart = w.length;
		w.u32(0); // chunk size — patched
		w.u16(0x2023); // chunk type: tileset
		w.zeros(40); // arbitrary tileset chunk body
		patchU32WriterPart(w, chunkStart, w.length - chunkStart);

		patchU32WriterPart(w, frameStart, w.length - frameStart);

		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		await expect(parseAseprite(buffer, "tilemap-mode")).rejects.toThrow(
			/tilemap mode/,
		);
	});

	it("rejects files containing a compressed-tilemap cel (cel type 3)", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 1, width: 2, height: 2 });

		const frameStart = w.length;
		w.u32(0);
		w.u16(0xf1fa);
		w.u16(0xffff);
		w.u16(100);
		w.zeros(2);
		w.u32(1); // 1 chunk: the tilemap-cel chunk

		const chunkStart = w.length;
		w.u32(0);
		w.u16(0x2005); // chunk type: cel
		w.u16(0); // layer
		w.i16(0); // x
		w.i16(0); // y
		w.u8(255); // opacity
		w.u16(3); // cel type 3 = compressed tilemap
		w.zeros(7); // reserved (incl. z-index)
		w.zeros(20); // arbitrary tilemap body
		patchU32WriterPart(w, chunkStart, w.length - chunkStart);

		patchU32WriterPart(w, frameStart, w.length - frameStart);

		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		await expect(parseAseprite(buffer, "tilemap-cel")).rejects.toThrow(
			/tilemap mode/,
		);
	});

	it("skips invisible layers when compositing", async () => {
		const w = new Writer();
		writeHeader(w, { frames: 1, width: 2, height: 2 });

		// custom frame: write a layer chunk with visibility=0 then a raw cel
		const frameStart = w.length;
		w.u32(0);
		w.u16(0xf1fa);
		w.u16(0xffff); // signal: use 32-bit chunk count below
		w.u16(100);
		w.zeros(2);
		const chunkCountOffset = w.length;
		w.u32(2);

		// layer chunk — flags=0 (invisible)
		const layerStart = w.length;
		w.u32(0);
		w.u16(0x2004);
		w.u16(0); // flags: NOT visible
		w.u16(0);
		w.u16(0);
		w.u16(0);
		w.u16(0);
		w.u16(0);
		w.u8(255);
		w.zeros(3);
		w.str("hidden");
		patchU32WriterPart(w, layerStart, w.length - layerStart);

		writeRawCelChunk(w, {
			layer: 0,
			x: 0,
			y: 0,
			width: 2,
			height: 2,
			rgbaPixels: PATTERN_2X2,
		});

		patchU32WriterPart(w, frameStart, w.length - frameStart);
		patchU32WriterPart(w, chunkCountOffset, 2);

		const buffer = w.toBuffer();
		patchU32(buffer, 0, buffer.byteLength);

		const { bitmap } = await parseAseprite(buffer, "hidden");
		// the cel was skipped — composite should be the canvas default (transparent black)
		expect(readPixel(bitmap, 0, 0)).toEqual([0, 0, 0, 0]);
	});
});
