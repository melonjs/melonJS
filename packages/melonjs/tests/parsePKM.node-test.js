/**
 * PKM compressed texture parser unit tests.
 *
 * Tests the parsePKM function directly with synthetic PKM binary data.
 * Run with: node --test tests/parsePKM.node-test.js
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parsePKM } from "../src/loader/parsers/compressed_textures/parsePKM.js";

const PKM_MAGIC = 0x504b4d20; // "PKM "
const PKM_HEADER_SIZE = 16;

// WebGL constants
const COMPRESSED_RGB_ETC1_WEBGL = 0x8d64;
const COMPRESSED_RGB8_ETC2 = 0x9274;
const COMPRESSED_RGBA8_ETC2_EAC = 0x9278;
const COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9276;
const COMPRESSED_R11_EAC = 0x9270;
const COMPRESSED_RG11_EAC = 0x9272;
const COMPRESSED_SIGNED_R11_EAC = 0x9271;
const COMPRESSED_SIGNED_RG11_EAC = 0x9273;

/**
 * Build a minimal PKM binary file in memory.
 * Header: 16 bytes (big-endian), followed by pixel data.
 */
function buildPKMBuffer({
	formatType = 0,
	width = 8,
	height = 8,
	version = "20",
} = {}) {
	// encoded dimensions: padded to 4-pixel boundary
	const encodedWidth = (width + 3) & ~3;
	const encodedHeight = (height + 3) & ~3;

	// block size depends on format type
	const blockSize =
		formatType === 0 || formatType === 1 || formatType === 4 ? 8 : 16;

	const dataSize =
		((encodedWidth + 3) >> 2) * ((encodedHeight + 3) >> 2) * blockSize;

	const totalSize = PKM_HEADER_SIZE + dataSize;
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	// magic "PKM " (big-endian)
	view.setUint32(0, PKM_MAGIC, false);

	// version "10" or "20" as two ASCII bytes
	view.setUint8(4, version.charCodeAt(0));
	view.setUint8(5, version.charCodeAt(1));

	// format type (big-endian uint16)
	view.setUint16(6, formatType, false);

	// encoded dimensions (big-endian uint16)
	view.setUint16(8, encodedWidth, false);
	view.setUint16(10, encodedHeight, false);

	// original dimensions (big-endian uint16)
	view.setUint16(12, width, false);
	view.setUint16(14, height, false);

	// fill pixel data with non-zero values
	const pixelData = new Uint8Array(buffer, PKM_HEADER_SIZE);
	for (let i = 0; i < pixelData.length; i++) {
		pixelData[i] = (i + 1) & 0xff;
	}

	return buffer;
}

describe("parsePKM", () => {
	it("should parse a valid ETC1 file (format type 0)", () => {
		const buffer = buildPKMBuffer({
			formatType: 0,
			width: 8,
			height: 8,
			version: "10",
		});
		const result = parsePKM(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.format, COMPRESSED_RGB_ETC1_WEBGL);
		assert.strictEqual(result.compressed, true);
		assert.strictEqual(result.generateMipmap, false);
		assert.strictEqual(result.mipmaps.length, 1);
		assert.strictEqual(result.mipmaps[0].width, 8);
		assert.strictEqual(result.mipmaps[0].height, 8);
		assert.ok(result.mipmaps[0].data instanceof Uint8Array);
		assert.ok(result.mipmaps[0].data.length > 0);
	});

	it("should parse an ETC2 RGB file (format type 1)", () => {
		const buffer = buildPKMBuffer({ formatType: 1, width: 16, height: 16 });
		const result = parsePKM(buffer);

		assert.strictEqual(result.width, 16);
		assert.strictEqual(result.height, 16);
		assert.strictEqual(result.format, COMPRESSED_RGB8_ETC2);
	});

	it("should parse an ETC2 RGBA8 file (format type 3)", () => {
		const buffer = buildPKMBuffer({ formatType: 3, width: 8, height: 8 });
		const result = parsePKM(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGBA8_ETC2_EAC);
		// RGBA8 uses 16 bytes per block
		assert.ok(result.mipmaps[0].data.length > 0);
	});

	it("should handle non-power-of-two dimensions", () => {
		const buffer = buildPKMBuffer({ formatType: 0, width: 13, height: 7 });
		const result = parsePKM(buffer);

		assert.strictEqual(result.width, 13);
		assert.strictEqual(result.height, 7);
		assert.strictEqual(result.mipmaps[0].width, 13);
		assert.strictEqual(result.mipmaps[0].height, 7);
		assert.ok(result.mipmaps[0].data.length > 0);
	});

	it("should only have a single mip level (PKM has no mipmap support)", () => {
		const buffer = buildPKMBuffer({ formatType: 0, width: 32, height: 32 });
		const result = parsePKM(buffer);

		assert.strictEqual(result.mipmaps.length, 1);
	});

	it("should throw on invalid magic number", () => {
		const buffer = buildPKMBuffer();
		const view = new DataView(buffer);
		view.setUint32(0, 0xdeadbeef, false);

		assert.throws(() => {
			parsePKM(buffer);
		}, /Invalid PKM file/);
	});

	it("should throw on unrecognized format type", () => {
		const buffer = buildPKMBuffer({ formatType: 99 });

		assert.throws(() => {
			parsePKM(buffer);
		}, /Unrecognized PKM format type/);
	});

	it("should map all known PKM format types to WebGL constants", () => {
		const formatMappings = [
			{ pkm: 0, gl: COMPRESSED_RGB_ETC1_WEBGL },
			{ pkm: 1, gl: COMPRESSED_RGB8_ETC2 },
			{ pkm: 3, gl: COMPRESSED_RGBA8_ETC2_EAC },
			{ pkm: 4, gl: COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 },
			{ pkm: 5, gl: COMPRESSED_R11_EAC },
			{ pkm: 6, gl: COMPRESSED_RG11_EAC },
			{ pkm: 7, gl: COMPRESSED_SIGNED_R11_EAC },
			{ pkm: 8, gl: COMPRESSED_SIGNED_RG11_EAC },
		];

		for (const { pkm, gl } of formatMappings) {
			const buffer = buildPKMBuffer({
				formatType: pkm,
				width: 8,
				height: 8,
			});
			const result = parsePKM(buffer);
			assert.strictEqual(
				result.format,
				gl,
				`PKM format type ${pkm} should map to WebGL 0x${gl.toString(16)}`,
			);
		}
	});
});
