/**
 * KTX v1 compressed texture parser unit tests.
 *
 * Tests the parseKTX function directly with synthetic KTX v1 binary data.
 * Run with: node --test tests/parseKTX.node-test.js
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parseKTX } from "../src/loader/parsers/compressed_textures/parseKTX.js";

// KTX constants
const KTX_IDENTIFIER = [
	0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
];
const KTX_ENDIANNESS = 0x04030201;

// Compressed format constants
const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83f3;
const COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93b0;
const GL_RGBA = 0x1908;

/**
 * Build a minimal KTX v1 binary file in memory (little-endian).
 */
function buildKTXBuffer({
	glInternalFormat = COMPRESSED_RGBA_S3TC_DXT5_EXT,
	glBaseInternalFormat = GL_RGBA,
	width = 8,
	height = 8,
	mipmapCount = 1,
	keyValueDataSize = 0,
	littleEndian = true,
} = {}) {
	// For S3TC DXT5: blockSize = 16, blocks = ceil(w/4) * ceil(h/4)
	function levelSize(w, h) {
		return ((w + 3) >> 2) * ((h + 3) >> 2) * 16;
	}

	// calculate total pixel data size
	let totalPixelSize = 0;
	let lw = width;
	let lh = height;
	for (let i = 0; i < mipmapCount; i++) {
		totalPixelSize += 4; // imageSize uint32
		const ls = levelSize(lw, lh);
		totalPixelSize += ls;
		// pad to 4-byte alignment
		totalPixelSize = (totalPixelSize + 3) & ~3;
		lw = Math.max(1, lw >> 1);
		lh = Math.max(1, lh >> 1);
	}

	const headerSize = 64;
	const totalSize = headerSize + keyValueDataSize + totalPixelSize;
	const buffer = new ArrayBuffer(totalSize);

	// write identifier
	const idView = new Uint8Array(buffer, 0, 12);
	for (let i = 0; i < 12; i++) {
		idView[i] = KTX_IDENTIFIER[i];
	}

	// write header fields using DataView for endianness control
	const headerView = new DataView(buffer, 12, headerSize - 12);
	headerView.setUint32(0, KTX_ENDIANNESS, littleEndian); // endianness
	headerView.setUint32(4, 0, littleEndian); // glType (0 = compressed)
	headerView.setUint32(8, 1, littleEndian); // glTypeSize
	headerView.setUint32(12, 0, littleEndian); // glFormat (0 = compressed)
	headerView.setUint32(16, glInternalFormat, littleEndian); // glInternalFormat
	headerView.setUint32(20, glBaseInternalFormat, littleEndian); // glBaseInternalFormat
	headerView.setUint32(24, width, littleEndian); // pixelWidth
	headerView.setUint32(28, height, littleEndian); // pixelHeight
	headerView.setUint32(32, 0, littleEndian); // pixelDepth
	headerView.setUint32(36, 0, littleEndian); // numberOfArrayElements
	headerView.setUint32(40, 1, littleEndian); // numberOfFaces
	headerView.setUint32(44, mipmapCount, littleEndian); // numberOfMipmapLevels
	headerView.setUint32(48, keyValueDataSize, littleEndian); // bytesOfKeyValueData

	// write mip level data
	let offset = headerSize + keyValueDataSize;
	lw = width;
	lh = height;
	for (let i = 0; i < mipmapCount; i++) {
		const ls = levelSize(lw, lh);
		const sizeView = new DataView(buffer, offset, 4);
		sizeView.setUint32(0, ls, littleEndian);
		offset += 4;

		// fill pixel data with non-zero pattern
		const pixelData = new Uint8Array(buffer, offset, ls);
		for (let j = 0; j < ls; j++) {
			pixelData[j] = ((i + 1) * (j + 1)) & 0xff;
		}
		offset += ls;
		offset = (offset + 3) & ~3;

		lw = Math.max(1, lw >> 1);
		lh = Math.max(1, lh >> 1);
	}

	return buffer;
}

describe("parseKTX", () => {
	it("should parse a valid KTX file with a single mip level", () => {
		const buffer = buildKTXBuffer({ width: 8, height: 8, mipmapCount: 1 });
		const result = parseKTX(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.format, COMPRESSED_RGBA_S3TC_DXT5_EXT);
		assert.strictEqual(result.compressed, true);
		assert.strictEqual(result.generateMipmap, false);
		assert.strictEqual(result.mipmaps.length, 1);
		assert.strictEqual(result.mipmaps[0].width, 8);
		assert.strictEqual(result.mipmaps[0].height, 8);
		assert.ok(result.mipmaps[0].data instanceof Uint8Array);
		assert.ok(result.mipmaps[0].data.length > 0);
	});

	it("should parse multiple mip levels", () => {
		const buffer = buildKTXBuffer({
			width: 16,
			height: 16,
			mipmapCount: 3,
		});
		const result = parseKTX(buffer);

		assert.strictEqual(result.mipmaps.length, 3);
		assert.strictEqual(result.mipmaps[0].width, 16);
		assert.strictEqual(result.mipmaps[0].height, 16);
		assert.strictEqual(result.mipmaps[1].width, 8);
		assert.strictEqual(result.mipmaps[1].height, 8);
		assert.strictEqual(result.mipmaps[2].width, 4);
		assert.strictEqual(result.mipmaps[2].height, 4);

		for (const mip of result.mipmaps) {
			assert.ok(mip.data instanceof Uint8Array);
			assert.ok(mip.data.length > 0);
		}
	});

	it("should handle key/value data offset correctly", () => {
		const keyValueSize = 48;
		const buffer = buildKTXBuffer({
			width: 8,
			height: 8,
			mipmapCount: 1,
			keyValueDataSize: keyValueSize,
		});
		const result = parseKTX(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.mipmaps.length, 1);
		assert.ok(result.mipmaps[0].data[0] > 0);
	});

	it("should preserve the glInternalFormat as the output format", () => {
		const buffer = buildKTXBuffer({
			glInternalFormat: COMPRESSED_RGBA_ASTC_4x4_KHR,
		});
		const result = parseKTX(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGBA_ASTC_4x4_KHR);
	});

	it("should throw on invalid identifier", () => {
		const buffer = buildKTXBuffer();
		const idView = new Uint8Array(buffer, 0, 12);
		idView[0] = 0x00; // corrupt identifier

		assert.throws(() => {
			parseKTX(buffer);
		}, /Invalid KTX file/);
	});

	it("should throw on bad endianness indicator", () => {
		const buffer = buildKTXBuffer();
		const headerView = new DataView(buffer, 12, 4);
		headerView.setUint32(0, 0xdeadbeef, true);

		assert.throws(() => {
			parseKTX(buffer);
		}, /bad endianness/);
	});

	it("should throw on uncompressed texture data", () => {
		const buffer = buildKTXBuffer();
		const headerView = new DataView(buffer, 12, 52);
		// set glType to non-zero (GL_UNSIGNED_BYTE = 0x1401)
		headerView.setUint32(4, 0x1401, true);
		// set glFormat to non-zero (GL_RGBA)
		headerView.setUint32(12, GL_RGBA, true);

		assert.throws(() => {
			parseKTX(buffer);
		}, /uncompressed/);
	});

	it("should handle big-endian KTX files", () => {
		const buffer = buildKTXBuffer({
			width: 8,
			height: 8,
			mipmapCount: 1,
			littleEndian: false,
		});
		const result = parseKTX(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.format, COMPRESSED_RGBA_S3TC_DXT5_EXT);
		assert.strictEqual(result.mipmaps.length, 1);
	});
});
