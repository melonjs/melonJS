/**
 * glTF images must decode to an `ImageBitmap`, like every other texture the
 * loader produces (`parsers/image.js` already does this).
 *
 * The loader used to resolve an `HTMLImageElement` instead. That is fine for
 * an RGBA source, but WebKit's `copyExternalImageToTexture` uploads an
 * `HTMLImageElement` decoded from an INDEXED PNG (`colorType` 3) as its raw
 * palette INDICES, so the texture arrives greyscale (r == g == b) with the
 * geometry untouched. Chrome's Dawn expands the palette, so it only ever
 * showed up in Safari; WebGL2's `texImage2D` is unaffected, so it looked like
 * a WebGPU regression.
 *
 * Nothing in the WebGPU API can correct this at upload time — `flipY`,
 * `premultipliedAlpha` and `colorSpace` are the only knobs, and expanding a
 * palette belongs to the decoder. So the fix belongs at decode, and this pins
 * it there.
 */
import { describe, expect, it } from "vitest";
import { parseGLTF } from "../src/loader/parsers/gltf.js";

/** CRC32 over `bytes`, as PNG chunks require. */
function crc32(bytes) {
	let c = ~0;
	for (let i = 0; i < bytes.length; i++) {
		c ^= bytes[i];
		for (let k = 0; k < 8; k++) {
			c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
		}
	}
	return ~c >>> 0;
}

function chunk(type, data) {
	const name = new TextEncoder().encode(type);
	const body = new Uint8Array(name.length + data.length);
	body.set(name, 0);
	body.set(data, name.length);
	const out = new Uint8Array(8 + data.length + 4);
	new DataView(out.buffer).setUint32(0, data.length);
	out.set(body, 4);
	new DataView(out.buffer).setUint32(out.length - 4, crc32(body));
	return out;
}

/**
 * A 2x2 PALETTE (colorType 3) PNG — the encoding that broke. Two entries:
 * pure red and pure blue, so a correct decode can never come back greyscale.
 */
function indexedPNG() {
	const ihdr = new Uint8Array(13);
	const dv = new DataView(ihdr.buffer);
	dv.setUint32(0, 2); // width
	dv.setUint32(4, 2); // height
	ihdr[8] = 8; // bit depth
	ihdr[9] = 3; // colorType 3 = PALETTE
	// raw scanlines: filter byte + one index per pixel
	const raw = new Uint8Array([0, 0, 1, 0, 1, 0]);
	// stored (uncompressed) zlib stream, so no deflate implementation is needed
	const len = raw.length;
	const idat = new Uint8Array(2 + 5 + len + 4);
	idat[0] = 0x78;
	idat[1] = 0x01;
	idat[2] = 0x01;
	idat[3] = len & 0xff;
	idat[4] = (len >> 8) & 0xff;
	idat[5] = ~len & 0xff;
	idat[6] = (~len >> 8) & 0xff;
	idat.set(raw, 7);
	let a = 1;
	let b = 0;
	for (const byte of raw) {
		a = (a + byte) % 65521;
		b = (b + a) % 65521;
	}
	new DataView(idat.buffer).setUint32(idat.length - 4, ((b << 16) | a) >>> 0);

	const parts = [
		new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", ihdr),
		chunk("PLTE", new Uint8Array([255, 0, 0, 0, 0, 255])),
		chunk("IDAT", idat),
		chunk("IEND", new Uint8Array(0)),
	];
	const total = parts.reduce((n, p) => {
		return n + p.length;
	}, 0);
	const png = new Uint8Array(total);
	let o = 0;
	for (const p of parts) {
		png.set(p, o);
		o += p.length;
	}
	return png;
}

/** a minimal GLB whose single texture is that indexed PNG, embedded */
function buildTexturedGLB() {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
	const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
	const indices = new Uint16Array([0, 1, 2]);
	const png = indexedPNG();

	const pad = (n) => {
		return (4 - (n % 4)) % 4;
	};
	const parts = [positions, uvs, indices, png];
	let offset = 0;
	const offsets = parts.map((p) => {
		const at = offset;
		offset += p.byteLength + pad(p.byteLength);
		return at;
	});
	const bin = new Uint8Array(offset);
	parts.forEach((p, i) => {
		bin.set(
			new Uint8Array(p.buffer ?? p, p.byteOffset ?? 0, p.byteLength),
			offsets[i],
		);
	});

	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0 }],
		meshes: [
			{
				primitives: [
					{
						attributes: { POSITION: 0, TEXCOORD_0: 1 },
						indices: 2,
						material: 0,
					},
				],
			},
		],
		materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
		textures: [{ source: 0 }],
		images: [{ bufferView: 3, mimeType: "image/png" }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			{ bufferView: 1, componentType: 5126, count: 3, type: "VEC2" },
			{ bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
		],
		bufferViews: parts.map((p, i) => {
			return {
				buffer: 0,
				byteOffset: offsets[i],
				byteLength: p.byteLength,
			};
		}),
		buffers: [{ byteLength: bin.byteLength }],
	};

	const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
	const jsonPad = new Uint8Array(jsonBytes.length + pad(jsonBytes.length)).fill(
		0x20,
	);
	jsonPad.set(jsonBytes);

	const total = 12 + 8 + jsonPad.length + 8 + bin.length;
	const glb = new Uint8Array(total);
	const dv = new DataView(glb.buffer);
	dv.setUint32(0, 0x46546c67, true);
	dv.setUint32(4, 2, true);
	dv.setUint32(8, total, true);
	dv.setUint32(12, jsonPad.length, true);
	dv.setUint32(16, 0x4e4f534a, true);
	glb.set(jsonPad, 20);
	dv.setUint32(20 + jsonPad.length, bin.length, true);
	dv.setUint32(24 + jsonPad.length, 0x004e4942, true);
	glb.set(bin, 28 + jsonPad.length);
	return glb.buffer;
}

describe("glTF image decode", () => {
	it("decodes an embedded texture to an ImageBitmap, not an HTMLImageElement", async () => {
		const scene = await parseGLTF(buildTexturedGLB());
		const image = scene.nodes.find((n) => {
			return n.image !== undefined;
		})?.image;

		expect(image).toBeDefined();
		// the assertion that fails if the loader goes back to `new Image()`
		expect(image).toBeInstanceOf(ImageBitmap);
		expect(image).not.toBeInstanceOf(HTMLImageElement);
	});

	it("expands an INDEXED (palette) PNG to real colour", async () => {
		// the actual defect: a palette source must not survive as luminance.
		// Drawing the decoded bitmap and reading it back proves the palette
		// was applied — red and blue, never r == g == b.
		const scene = await parseGLTF(buildTexturedGLB());
		const image = scene.nodes.find((n) => {
			return n.image !== undefined;
		})?.image;

		const canvas = document.createElement("canvas");
		canvas.width = 2;
		canvas.height = 2;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(image, 0, 0);
		const px = ctx.getImageData(0, 0, 2, 2).data;

		const first = [px[0], px[1], px[2]];
		const second = [px[4], px[5], px[6]];
		// palette entry 0 is red, entry 1 is blue — greyscale would collapse
		// both to r == g == b
		expect(first[0]).toBeGreaterThan(first[2]);
		expect(second[2]).toBeGreaterThan(second[0]);
	});
});
