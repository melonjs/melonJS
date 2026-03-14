// KTX v2 file identifier (12 bytes): «KTX 20»\r\n\x1A\n
const KTX2_IDENTIFIER = [
	0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
];

// VkFormat → WebGL compressed texture format mapping
const VKFORMAT_TO_WEBGL = {
	// BC1 (S3TC DXT1)
	131: 0x83f0, // VK_FORMAT_BC1_RGB_UNORM_BLOCK
	132: 0x83f0, // VK_FORMAT_BC1_RGB_SRGB_BLOCK
	133: 0x83f0, // VK_FORMAT_BC1_RGBA_UNORM_BLOCK
	134: 0x83f0, // VK_FORMAT_BC1_RGBA_SRGB_BLOCK

	// BC2 (S3TC DXT3)
	135: 0x83f2, // VK_FORMAT_BC2_UNORM_BLOCK
	136: 0x83f2, // VK_FORMAT_BC2_SRGB_BLOCK

	// BC3 (S3TC DXT5)
	137: 0x83f3, // VK_FORMAT_BC3_UNORM_BLOCK
	138: 0x83f3, // VK_FORMAT_BC3_SRGB_BLOCK

	// BC7 (BPTC)
	145: 0x8e8c, // VK_FORMAT_BC7_UNORM_BLOCK
	146: 0x8e8c, // VK_FORMAT_BC7_SRGB_BLOCK

	// ETC2
	147: 0x9274, // VK_FORMAT_ETC2_R8G8B8_UNORM_BLOCK → COMPRESSED_RGB8_ETC2
	148: 0x9274, // VK_FORMAT_ETC2_R8G8B8_SRGB_BLOCK
	149: 0x9276, // VK_FORMAT_ETC2_R8G8B8A1_UNORM_BLOCK → COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2
	150: 0x9276, // VK_FORMAT_ETC2_R8G8B8A1_SRGB_BLOCK
	151: 0x9278, // VK_FORMAT_ETC2_R8G8B8A8_UNORM_BLOCK → COMPRESSED_RGBA8_ETC2_EAC
	152: 0x9278, // VK_FORMAT_ETC2_R8G8B8A8_SRGB_BLOCK

	// EAC
	153: 0x9270, // VK_FORMAT_EAC_R11_UNORM_BLOCK → COMPRESSED_R11_EAC
	154: 0x9271, // VK_FORMAT_EAC_R11_SNORM_BLOCK → COMPRESSED_SIGNED_R11_EAC
	155: 0x9272, // VK_FORMAT_EAC_R11G11_UNORM_BLOCK → COMPRESSED_RG11_EAC
	156: 0x9273, // VK_FORMAT_EAC_R11G11_SNORM_BLOCK → COMPRESSED_SIGNED_RG11_EAC

	// ASTC
	157: 0x93b0, // VK_FORMAT_ASTC_4x4_UNORM_BLOCK
	158: 0x93b0, // VK_FORMAT_ASTC_4x4_SRGB_BLOCK
	159: 0x93b1, // VK_FORMAT_ASTC_5x4_UNORM_BLOCK
	160: 0x93b1, // VK_FORMAT_ASTC_5x4_SRGB_BLOCK
	161: 0x93b2, // VK_FORMAT_ASTC_5x5_UNORM_BLOCK
	162: 0x93b2, // VK_FORMAT_ASTC_5x5_SRGB_BLOCK
	163: 0x93b3, // VK_FORMAT_ASTC_6x5_UNORM_BLOCK
	164: 0x93b3, // VK_FORMAT_ASTC_6x5_SRGB_BLOCK
	165: 0x93b4, // VK_FORMAT_ASTC_6x6_UNORM_BLOCK
	166: 0x93b4, // VK_FORMAT_ASTC_6x6_SRGB_BLOCK
	167: 0x93b5, // VK_FORMAT_ASTC_8x5_UNORM_BLOCK
	168: 0x93b5, // VK_FORMAT_ASTC_8x5_SRGB_BLOCK
	169: 0x93b6, // VK_FORMAT_ASTC_8x6_UNORM_BLOCK
	170: 0x93b6, // VK_FORMAT_ASTC_8x6_SRGB_BLOCK
	171: 0x93b7, // VK_FORMAT_ASTC_8x8_UNORM_BLOCK
	172: 0x93b7, // VK_FORMAT_ASTC_8x8_SRGB_BLOCK
	173: 0x93b8, // VK_FORMAT_ASTC_10x5_UNORM_BLOCK
	174: 0x93b8, // VK_FORMAT_ASTC_10x5_SRGB_BLOCK
	175: 0x93b9, // VK_FORMAT_ASTC_10x6_UNORM_BLOCK
	176: 0x93b9, // VK_FORMAT_ASTC_10x6_SRGB_BLOCK
	177: 0x93ba, // VK_FORMAT_ASTC_10x8_UNORM_BLOCK
	178: 0x93ba, // VK_FORMAT_ASTC_10x8_SRGB_BLOCK
	179: 0x93bb, // VK_FORMAT_ASTC_10x10_UNORM_BLOCK
	180: 0x93bb, // VK_FORMAT_ASTC_10x10_SRGB_BLOCK
	181: 0x93bc, // VK_FORMAT_ASTC_12x10_UNORM_BLOCK
	182: 0x93bc, // VK_FORMAT_ASTC_12x10_SRGB_BLOCK
	183: 0x93bd, // VK_FORMAT_ASTC_12x12_UNORM_BLOCK
	184: 0x93bd, // VK_FORMAT_ASTC_12x12_SRGB_BLOCK
};

/**
 * Parse a KTX v2 compressed texture file.
 * @param {ArrayBuffer} data - the KTX2 file data
 * @returns {CompressedImage} a compressed texture object with mipmaps, width, height, format
 * @ignore
 */
export function parseKTX2(data) {
	const idView = new Uint8Array(data, 0, 12);

	// validate file identifier
	for (let i = 0; i < 12; i++) {
		if (idView[i] !== KTX2_IDENTIFIER[i]) {
			throw new Error("Invalid KTX2 file: bad identifier");
		}
	}

	// KTX2 is always little-endian
	const header = new DataView(data, 12, 56);
	const vkFormat = header.getUint32(0, true);
	const width = header.getUint32(8, true);
	const height = header.getUint32(12, true);
	const levelCount = Math.max(1, header.getUint32(28, true));
	const supercompressionScheme = header.getUint32(32, true);

	// reject Basis Universal (vkFormat = 0) and supercompressed data
	if (vkFormat === 0) {
		throw new Error("KTX2 Basis Universal transcoding is not supported");
	}

	if (supercompressionScheme !== 0) {
		throw new Error(
			"KTX2 supercompression scheme " +
				supercompressionScheme +
				" is not supported",
		);
	}

	const format = VKFORMAT_TO_WEBGL[vkFormat];
	if (typeof format === "undefined") {
		throw new Error("Unrecognized KTX2 vkFormat: " + vkFormat);
	}

	// Level index starts at offset 80 from file start (12 byte identifier + 68 byte header)
	// Each level entry: byteOffset(uint64) + byteLength(uint64) + uncompressedByteLength(uint64) = 24 bytes
	const levelIndexOffset = 80;
	const levelIndex = new DataView(data, levelIndexOffset, levelCount * 24);

	const mipmaps = new Array(levelCount);
	let levelWidth = width;
	let levelHeight = height;

	for (let i = 0; i < levelCount; i++) {
		// KTX2 stores levels smallest-first in the level index, but we want largest-first
		// Level 0 in the index = largest mip level
		const entryOffset = i * 24;
		// read low 32 bits of uint64 byteOffset and byteLength
		const byteOffset = levelIndex.getUint32(entryOffset, true);
		const byteLength = levelIndex.getUint32(entryOffset + 8, true);

		mipmaps[i] = {
			data: new Uint8Array(data, byteOffset, byteLength),
			width: levelWidth,
			height: levelHeight,
		};

		levelWidth = Math.max(1, levelWidth >> 1);
		levelHeight = Math.max(1, levelHeight >> 1);
	}

	return {
		mipmaps: mipmaps,
		width: width,
		height: height,
		format: format,
		compressed: true,
		generateMipmap: false,
	};
}
