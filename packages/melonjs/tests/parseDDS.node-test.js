/**
 * DDS compressed texture parser unit tests.
 *
 * Tests the parseDDS function directly with synthetic DDS binary data.
 * Run with: node --test tests/parseDDS.node-test.js
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parseDDS } from "../src/loader/parsers/compressed_textures/parseDDS.js";

// DDS constants
const DDS_MAGIC = 0x20534444;
const FOURCC_DXT1 = 0x31545844;
const FOURCC_DXT3 = 0x33545844;
const FOURCC_DXT5 = 0x35545844;
const FOURCC_DX10 = 0x30315844;

// WebGL format constants
const COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83f0;
const COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83f2;
const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83f3;
const COMPRESSED_RGBA_BPTC_UNORM_EXT = 0x8e8c;

// DXGI format for BC7
const DXGI_FORMAT_BC7_UNORM = 98;

/**
 * Build a minimal DDS binary file in memory.
 */
function buildDDSBuffer({
	fourCC = FOURCC_DXT5,
	width = 8,
	height = 8,
	mipmapCount = 1,
	dx10DxgiFormat = null,
} = {}) {
	const isDX10 = fourCC === FOURCC_DX10;
	const headerOffset = 4 + 124; // magic + header = 128
	const dx10Size = isDX10 ? 20 : 0;
	const dataStart = headerOffset + dx10Size;

	// determine block size based on format
	let bs;
	if (isDX10) {
		bs = 16; // BC7
	} else if (fourCC === FOURCC_DXT1) {
		bs = 8;
	} else {
		bs = 16; // DXT3, DXT5
	}

	// calculate total pixel data size
	let totalPixelSize = 0;
	let lw = width;
	let lh = height;
	for (let i = 0; i < mipmapCount; i++) {
		totalPixelSize +=
			Math.max(1, (lw + 3) >> 2) * Math.max(1, (lh + 3) >> 2) * bs;
		lw = Math.max(1, lw >> 1);
		lh = Math.max(1, lh >> 1);
	}

	const totalSize = dataStart + totalPixelSize;
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	// magic
	view.setUint32(0, DDS_MAGIC, true);

	// header (124 bytes at offset 4)
	view.setUint32(4, 124, true); // dwSize
	view.setUint32(8, 0x000a1007, true); // dwFlags (CAPS|HEIGHT|WIDTH|PIXELFORMAT|MIPMAPCOUNT|LINEARSIZE)
	view.setUint32(12, height, true); // dwHeight
	view.setUint32(16, width, true); // dwWidth
	view.setUint32(28, mipmapCount, true); // dwMipMapCount
	// ddspf at offset 76 from file start (offset 72 from header start)
	view.setUint32(80, 32, true); // ddspf.dwSize
	view.setUint32(84, fourCC, true); // ddspf.dwFourCC

	// DX10 extended header
	if (isDX10 && dx10DxgiFormat !== null) {
		view.setUint32(128, dx10DxgiFormat, true); // dxgiFormat
	}

	// fill pixel data with non-zero values
	const pixelData = new Uint8Array(buffer, dataStart);
	for (let i = 0; i < pixelData.length; i++) {
		pixelData[i] = (i + 1) & 0xff;
	}

	return buffer;
}

describe("parseDDS", () => {
	it("should parse a valid DXT1 file with a single mip level", () => {
		const buffer = buildDDSBuffer({
			fourCC: FOURCC_DXT1,
			width: 8,
			height: 8,
			mipmapCount: 1,
		});
		const result = parseDDS(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.format, COMPRESSED_RGB_S3TC_DXT1_EXT);
		assert.strictEqual(result.compressed, true);
		assert.strictEqual(result.generateMipmap, false);
		assert.strictEqual(result.mipmaps.length, 1);
		assert.strictEqual(result.mipmaps[0].width, 8);
		assert.strictEqual(result.mipmaps[0].height, 8);
		assert.ok(result.mipmaps[0].data instanceof Uint8Array);
		// DXT1: 2×2 blocks × 8 bytes = 32
		assert.strictEqual(result.mipmaps[0].data.length, 32);
	});

	it("should parse a DXT3 file", () => {
		const buffer = buildDDSBuffer({
			fourCC: FOURCC_DXT3,
			width: 8,
			height: 8,
		});
		const result = parseDDS(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGBA_S3TC_DXT3_EXT);
		// DXT3: 2×2 blocks × 16 bytes = 64
		assert.strictEqual(result.mipmaps[0].data.length, 64);
	});

	it("should parse a DXT5 file", () => {
		const buffer = buildDDSBuffer({
			fourCC: FOURCC_DXT5,
			width: 8,
			height: 8,
		});
		const result = parseDDS(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGBA_S3TC_DXT5_EXT);
		assert.strictEqual(result.mipmaps[0].data.length, 64);
	});

	it("should parse multiple mip levels", () => {
		const buffer = buildDDSBuffer({
			fourCC: FOURCC_DXT5,
			width: 16,
			height: 16,
			mipmapCount: 3,
		});
		const result = parseDDS(buffer);

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

	it("should parse BC7 via DX10 extended header", () => {
		const buffer = buildDDSBuffer({
			fourCC: FOURCC_DX10,
			dx10DxgiFormat: DXGI_FORMAT_BC7_UNORM,
			width: 8,
			height: 8,
		});
		const result = parseDDS(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGBA_BPTC_UNORM_EXT);
		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.mipmaps.length, 1);
		// BC7: 2×2 blocks × 16 bytes = 64
		assert.strictEqual(result.mipmaps[0].data.length, 64);
	});

	it("should throw on invalid magic number", () => {
		const buffer = buildDDSBuffer();
		const view = new DataView(buffer, 0, 4);
		view.setUint32(0, 0xdeadbeef, true);

		assert.throws(() => {
			parseDDS(buffer);
		}, /Invalid DDS file/);
	});

	it("should throw on unsupported fourCC", () => {
		const buffer = buildDDSBuffer({ fourCC: 0x41544301 }); // arbitrary
		// need to also set the fourCC in the header
		const view = new DataView(buffer);
		view.setUint32(84, 0x41544301, true);

		assert.throws(() => {
			parseDDS(buffer);
		}, /Unrecognized DDS fourCC/);
	});

	it("should throw on unsupported DXGI format", () => {
		const buffer = buildDDSBuffer({
			fourCC: FOURCC_DX10,
			dx10DxgiFormat: 999,
		});

		assert.throws(() => {
			parseDDS(buffer);
		}, /Unrecognized DDS DXGI format/);
	});

	it("should map all known fourCC formats correctly", () => {
		const formatMappings = [
			{ fourCC: FOURCC_DXT1, gl: COMPRESSED_RGB_S3TC_DXT1_EXT },
			{ fourCC: FOURCC_DXT3, gl: COMPRESSED_RGBA_S3TC_DXT3_EXT },
			{ fourCC: FOURCC_DXT5, gl: COMPRESSED_RGBA_S3TC_DXT5_EXT },
		];

		for (const { fourCC, gl } of formatMappings) {
			const buffer = buildDDSBuffer({ fourCC, width: 8, height: 8 });
			const result = parseDDS(buffer);
			assert.strictEqual(
				result.format,
				gl,
				`fourCC 0x${fourCC.toString(16)} should map to WebGL 0x${gl.toString(16)}`,
			);
		}
	});
});
