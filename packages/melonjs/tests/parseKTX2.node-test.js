/**
 * KTX v2 compressed texture parser unit tests.
 *
 * Tests the parseKTX2 function directly with synthetic KTX2 binary data.
 * Run with: node --test tests/parseKTX2.node-test.js
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parseKTX2 } from "../src/loader/parsers/compressed_textures/parseKTX2.js";

// KTX2 identifier
const KTX2_IDENTIFIER = [
	0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
];

// VkFormat values
const VK_FORMAT_BC1_RGB_UNORM_BLOCK = 131;
const VK_FORMAT_BC3_UNORM_BLOCK = 137;
const VK_FORMAT_ETC2_R8G8B8_UNORM_BLOCK = 147;
const VK_FORMAT_ASTC_4x4_UNORM_BLOCK = 157;

// WebGL format constants
const COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83f0;
const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83f3;
const COMPRESSED_RGB8_ETC2 = 0x9274;
const COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93b0;

/**
 * Build a minimal KTX2 binary file in memory.
 */
function buildKTX2Buffer({
	vkFormat = VK_FORMAT_BC1_RGB_UNORM_BLOCK,
	width = 8,
	height = 8,
	levelCount = 1,
	supercompressionScheme = 0,
	blockBytes = 8,
} = {}) {
	// Layout:
	// [0..11]   identifier (12 bytes)
	// [12..79]  header (68 bytes) — we use a 68-byte header area
	// [80..]    level index (levelCount × 24 bytes)
	// then pixel data

	const levelIndexOffset = 80;
	const levelIndexSize = levelCount * 24;
	const pixelDataStart = levelIndexOffset + levelIndexSize;

	// calculate level sizes and total pixel data
	const levelSizes = [];
	let lw = width;
	let lh = height;
	for (let i = 0; i < levelCount; i++) {
		const size =
			Math.max(1, (lw + 3) >> 2) * Math.max(1, (lh + 3) >> 2) * blockBytes;
		levelSizes.push(size);
		lw = Math.max(1, lw >> 1);
		lh = Math.max(1, lh >> 1);
	}

	// In KTX2, level 0 in the index is the largest mip
	// Levels are stored in the file smallest-first, but byte offsets handle this
	let totalPixelSize = 0;
	for (const s of levelSizes) {
		totalPixelSize += s;
	}

	const totalSize = pixelDataStart + totalPixelSize;
	const buffer = new ArrayBuffer(totalSize);

	// write identifier
	const idView = new Uint8Array(buffer, 0, 12);
	for (let i = 0; i < 12; i++) {
		idView[i] = KTX2_IDENTIFIER[i];
	}

	// write header at offset 12 (68 bytes)
	const header = new DataView(buffer, 12, 68);
	header.setUint32(0, vkFormat, true); // vkFormat
	// typeSize at +4
	header.setUint32(4, 1, true);
	header.setUint32(8, width, true); // pixelWidth
	header.setUint32(12, height, true); // pixelHeight
	header.setUint32(16, 0, true); // pixelDepth
	header.setUint32(20, 0, true); // layerCount
	header.setUint32(24, 1, true); // faceCount
	header.setUint32(28, levelCount, true); // levelCount
	header.setUint32(32, supercompressionScheme, true);

	// write level index at offset 80
	const levelIndex = new DataView(buffer, levelIndexOffset, levelIndexSize);

	// Store levels: level 0 = largest mip, placed at the end of pixel data
	// Build offsets from the end backwards (smallest first in file)
	const offsets = new Array(levelCount);
	let currentOffset = pixelDataStart;
	for (let i = 0; i < levelCount; i++) {
		offsets[i] = currentOffset;
		currentOffset += levelSizes[i];
	}

	for (let i = 0; i < levelCount; i++) {
		const entryOffset = i * 24;
		// byteOffset as uint64 (write low 32 bits, high 32 bits = 0)
		levelIndex.setUint32(entryOffset, offsets[i], true);
		levelIndex.setUint32(entryOffset + 4, 0, true);
		// byteLength as uint64
		levelIndex.setUint32(entryOffset + 8, levelSizes[i], true);
		levelIndex.setUint32(entryOffset + 12, 0, true);
		// uncompressedByteLength as uint64
		levelIndex.setUint32(entryOffset + 16, levelSizes[i], true);
		levelIndex.setUint32(entryOffset + 20, 0, true);
	}

	// fill pixel data with non-zero values
	const pixelData = new Uint8Array(buffer, pixelDataStart);
	for (let i = 0; i < pixelData.length; i++) {
		pixelData[i] = (i + 1) & 0xff;
	}

	return buffer;
}

describe("parseKTX2", () => {
	it("should parse a valid BC1 file with a single mip level", () => {
		const buffer = buildKTX2Buffer({
			vkFormat: VK_FORMAT_BC1_RGB_UNORM_BLOCK,
			width: 8,
			height: 8,
			levelCount: 1,
			blockBytes: 8,
		});
		const result = parseKTX2(buffer);

		assert.strictEqual(result.width, 8);
		assert.strictEqual(result.height, 8);
		assert.strictEqual(result.format, COMPRESSED_RGB_S3TC_DXT1_EXT);
		assert.strictEqual(result.compressed, true);
		assert.strictEqual(result.generateMipmap, false);
		assert.strictEqual(result.mipmaps.length, 1);
		assert.strictEqual(result.mipmaps[0].width, 8);
		assert.strictEqual(result.mipmaps[0].height, 8);
		assert.ok(result.mipmaps[0].data instanceof Uint8Array);
		// BC1: 2×2 blocks × 8 bytes = 32
		assert.strictEqual(result.mipmaps[0].data.length, 32);
	});

	it("should parse multiple mip levels", () => {
		const buffer = buildKTX2Buffer({
			vkFormat: VK_FORMAT_BC1_RGB_UNORM_BLOCK,
			width: 16,
			height: 16,
			levelCount: 3,
			blockBytes: 8,
		});
		const result = parseKTX2(buffer);

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

	it("should parse BC3 format", () => {
		const buffer = buildKTX2Buffer({
			vkFormat: VK_FORMAT_BC3_UNORM_BLOCK,
			width: 8,
			height: 8,
			blockBytes: 16,
		});
		const result = parseKTX2(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGBA_S3TC_DXT5_EXT);
		// BC3: 2×2 blocks × 16 bytes = 64
		assert.strictEqual(result.mipmaps[0].data.length, 64);
	});

	it("should parse ASTC 4x4 format", () => {
		const buffer = buildKTX2Buffer({
			vkFormat: VK_FORMAT_ASTC_4x4_UNORM_BLOCK,
			width: 8,
			height: 8,
			blockBytes: 16,
		});
		const result = parseKTX2(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGBA_ASTC_4x4_KHR);
	});

	it("should parse ETC2 format", () => {
		const buffer = buildKTX2Buffer({
			vkFormat: VK_FORMAT_ETC2_R8G8B8_UNORM_BLOCK,
			width: 8,
			height: 8,
			blockBytes: 8,
		});
		const result = parseKTX2(buffer);

		assert.strictEqual(result.format, COMPRESSED_RGB8_ETC2);
	});

	it("should throw on invalid identifier", () => {
		const buffer = buildKTX2Buffer();
		const idView = new Uint8Array(buffer, 0, 12);
		idView[0] = 0x00; // corrupt identifier

		assert.throws(() => {
			parseKTX2(buffer);
		}, /Invalid KTX2 file/);
	});

	it("should throw on unsupported vkFormat", () => {
		const buffer = buildKTX2Buffer({ vkFormat: 999 });

		assert.throws(() => {
			parseKTX2(buffer);
		}, /Unrecognized KTX2 vkFormat/);
	});

	it("should reject BasisLZ supercompression (scheme=1)", () => {
		const buffer = buildKTX2Buffer({ supercompressionScheme: 1 });

		assert.throws(() => {
			parseKTX2(buffer);
		}, /supercompression/);
	});

	it("should reject Zstd supercompression (scheme=2)", () => {
		const buffer = buildKTX2Buffer({ supercompressionScheme: 2 });

		assert.throws(() => {
			parseKTX2(buffer);
		}, /supercompression/);
	});

	it("should reject vkFormat=0 (Basis Universal)", () => {
		const buffer = buildKTX2Buffer({ vkFormat: 0 });

		assert.throws(() => {
			parseKTX2(buffer);
		}, /Basis Universal/);
	});

	it("should map all known vkFormat values correctly", () => {
		const formatMappings = [
			{ vk: 131, gl: 0x83f0, bs: 8 }, // BC1 RGB
			{ vk: 132, gl: 0x83f0, bs: 8 }, // BC1 RGB sRGB
			{ vk: 135, gl: 0x83f2, bs: 16 }, // BC2
			{ vk: 137, gl: 0x83f3, bs: 16 }, // BC3
			{ vk: 145, gl: 0x8e8c, bs: 16 }, // BC7
			{ vk: 147, gl: 0x9274, bs: 8 }, // ETC2 RGB
			{ vk: 157, gl: 0x93b0, bs: 16 }, // ASTC 4x4
		];

		for (const { vk, gl, bs } of formatMappings) {
			const buffer = buildKTX2Buffer({
				vkFormat: vk,
				width: 8,
				height: 8,
				blockBytes: bs,
			});
			const result = parseKTX2(buffer);
			assert.strictEqual(
				result.format,
				gl,
				`vkFormat ${vk} should map to WebGL 0x${gl.toString(16)}`,
			);
		}
	});
});
