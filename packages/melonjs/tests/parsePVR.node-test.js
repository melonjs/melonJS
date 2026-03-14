/**
 * PVR compressed texture parser unit tests.
 *
 * Tests the parsePVR function directly with synthetic PVR v3 binary data.
 * Run with: node --test tests/parsePVR.node-test.js
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parsePVR } from "../src/loader/parsers/compressed_textures/parsePVR.js";

// PVR v3 constants
const PVR_MAGIC = 0x03525650;
const PVR_FORMAT_4BPP_RGBA = 3;
const COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8c02;

/**
 * Build a minimal PVR v3 binary file in memory.
 * Header: 13 × uint32 = 52 bytes, followed by metadata (if any), then pixel data.
 */
function buildPVRBuffer({
	format = PVR_FORMAT_4BPP_RGBA,
	width = 8,
	height = 8,
	mipmapCount = 1,
	metadataSize = 0,
} = {}) {
	// Calculate level buffer size based on format (mirrors parsePVR.js logic)
	function levelSize(w, h) {
		switch (format) {
			case 7: // DXT1
			case 6: // ETC1
				return ((w + 3) >> 2) * ((h + 3) >> 2) * 8;
			case 5: // DXT5
			case 9: // DXT3
				return ((w + 3) >> 2) * ((h + 3) >> 2) * 16;
			case 2: // 4BPP_RGB
			case 3: // 4BPP_RGBA
				return Math.floor((Math.max(w, 8) * Math.max(h, 8) * 4 + 7) / 8);
			case 0: // 2BPP_RGB
			case 1: // 2BPP_RGBA
				return Math.floor((Math.max(w, 16) * Math.max(h, 8) * 2 + 7) / 8);
			default:
				return 32; // fallback
		}
	}

	// calculate total pixel data size across all mip levels
	let totalPixelSize = 0;
	let lw = width;
	let lh = height;
	for (let i = 0; i < mipmapCount; i++) {
		totalPixelSize += levelSize(lw, lh);
		lw = Math.max(1, lw >> 1);
		lh = Math.max(1, lh >> 1);
	}

	const headerSize = 52; // 13 × 4 bytes
	const totalSize = headerSize + metadataSize + totalPixelSize;
	const buffer = new ArrayBuffer(totalSize);
	const header = new Uint32Array(buffer, 0, 13);

	header[0] = PVR_MAGIC; // version / magic
	header[1] = 0; // flags
	header[2] = format; // pixel format (low 32 bits)
	header[3] = 0; // pixel format (high 32 bits)
	header[4] = 0; // colour space (linear)
	header[5] = 0; // channel type
	header[6] = height;
	header[7] = width;
	header[8] = 1; // depth
	header[9] = 1; // num surfaces
	header[10] = 1; // num faces
	header[11] = mipmapCount;
	header[12] = metadataSize;

	// fill pixel data with non-zero values so we can verify it's extracted
	const pixelData = new Uint8Array(buffer, headerSize + metadataSize);
	for (let i = 0; i < pixelData.length; i++) {
		pixelData[i] = (i + 1) & 0xff;
	}

	return buffer;
}

describe("parsePVR", () => {
	it("should parse a valid PVR v3 file with a single mip level", () => {
		const buffer = buildPVRBuffer({ width: 8, height: 8, mipmapCount: 1 });
		const result = parsePVR(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.format, COMPRESSED_RGBA_PVRTC_4BPPV1_IMG);
		assert.strictEqual(result.compressed, true);
		assert.strictEqual(result.generateMipmap, false);
		assert.strictEqual(result.mipmaps.length, 1);
		assert.strictEqual(result.mipmaps[0].width, 8);
		assert.strictEqual(result.mipmaps[0].height, 8);
		assert.ok(result.mipmaps[0].data instanceof Uint8Array);
		assert.ok(result.mipmaps[0].data.length > 0);
	});

	it("should parse multiple mip levels", () => {
		const buffer = buildPVRBuffer({
			width: 16,
			height: 16,
			mipmapCount: 3,
		});
		const result = parsePVR(buffer);

		assert.strictEqual(result.mipmaps.length, 3);
		assert.strictEqual(result.mipmaps[0].width, 16);
		assert.strictEqual(result.mipmaps[0].height, 16);
		assert.strictEqual(result.mipmaps[1].width, 8);
		assert.strictEqual(result.mipmaps[1].height, 8);
		assert.strictEqual(result.mipmaps[2].width, 4);
		assert.strictEqual(result.mipmaps[2].height, 4);

		// each mip level should have its own data
		for (const mip of result.mipmaps) {
			assert.ok(mip.data instanceof Uint8Array);
			assert.ok(mip.data.length > 0);
		}
	});

	it("should handle metadata offset correctly", () => {
		const metadataSize = 64;
		const buffer = buildPVRBuffer({
			width: 8,
			height: 8,
			mipmapCount: 1,
			metadataSize,
		});
		const result = parsePVR(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.mipmaps.length, 1);
		// verify pixel data starts after metadata (non-zero fill pattern)
		assert.ok(result.mipmaps[0].data[0] > 0);
	});

	it("should throw on invalid magic number", () => {
		const buffer = buildPVRBuffer();
		const header = new Uint32Array(buffer, 0, 1);
		header[0] = 0xdeadbeef; // corrupt magic

		assert.throws(() => {
			parsePVR(buffer);
		}, /Invalid PVR file/);
	});

	it("should throw on unsupported pixel format", () => {
		const buffer = buildPVRBuffer({ format: 999 });

		assert.throws(() => {
			parsePVR(buffer);
		}, /Unrecognized PVR pixel format/);
	});

	it("should map all known PVR formats to WebGL constants", () => {
		const formatMappings = [
			{ pvr: 0, gl: 0x8c01 }, // 2BPP_RGB  → COMPRESSED_RGB_PVRTC_2BPPV1_IMG
			{ pvr: 1, gl: 0x8c03 }, // 2BPP_RGBA → COMPRESSED_RGBA_PVRTC_2BPPV1_IMG
			{ pvr: 2, gl: 0x8c00 }, // 4BPP_RGB  → COMPRESSED_RGB_PVRTC_4BPPV1_IMG
			{ pvr: 3, gl: 0x8c02 }, // 4BPP_RGBA → COMPRESSED_RGBA_PVRTC_4BPPV1_IMG
			{ pvr: 6, gl: 0x8d64 }, // ETC1      → COMPRESSED_RGB_ETC1_WEBGL
			{ pvr: 7, gl: 0x83f0 }, // DXT1      → COMPRESSED_RGB_S3TC_DXT1_EXT
			{ pvr: 5, gl: 0x83f3 }, // DXT5      → COMPRESSED_RGBA_S3TC_DXT5_EXT
			{ pvr: 9, gl: 0x83f2 }, // DXT3      → COMPRESSED_RGBA_S3TC_DXT3_EXT
		];

		for (const { pvr, gl } of formatMappings) {
			const buffer = buildPVRBuffer({ format: pvr, width: 8, height: 8 });
			const result = parsePVR(buffer);
			assert.strictEqual(
				result.format,
				gl,
				`PVR format ${pvr} should map to WebGL 0x${gl.toString(16)}`,
			);
		}
	});
});
