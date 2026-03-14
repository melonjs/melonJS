/**
 * PKM file format parser (ETC1/ETC2 container).
 *
 * Header layout (16 bytes, big-endian):
 *   [0-3]   magic      "PKM " (0x504B4D20)
 *   [4-5]   version    "10" (ETC1) or "20" (ETC2)
 *   [6-7]   format     texture format type
 *   [8-9]   encodedWidth   padded width (multiple of 4)
 *   [10-11] encodedHeight  padded height (multiple of 4)
 *   [12-13] width      original width
 *   [14-15] height     original height
 *
 * Data immediately follows the 16-byte header.
 */

const PKM_HEADER_SIZE = 16;
const PKM_MAGIC = 0x504b4d20; // "PKM "

// ETC1 (via WEBGL_compressed_texture_etc1)
const COMPRESSED_RGB_ETC1_WEBGL = 0x8d64;

// ETC2 (via WEBGL_compressed_texture_etc)
const COMPRESSED_RGB8_ETC2 = 0x9274;
const COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9276;
const COMPRESSED_RGBA8_ETC2_EAC = 0x9278;
const COMPRESSED_R11_EAC = 0x9270;
const COMPRESSED_SIGNED_R11_EAC = 0x9271;
const COMPRESSED_RG11_EAC = 0x9272;
const COMPRESSED_SIGNED_RG11_EAC = 0x9273;

// PKM format type → WebGL constant
const PKM_FORMAT_TO_WEBGL = {
	0: COMPRESSED_RGB_ETC1_WEBGL, // ETC1_RGB_NO_MIPMAPS
	1: COMPRESSED_RGB8_ETC2, // ETC2_RGB_NO_MIPMAPS
	3: COMPRESSED_RGBA8_ETC2_EAC, // ETC2_RGBA_NO_MIPMAPS
	4: COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2, // ETC2_RGB_A1_NO_MIPMAPS
	5: COMPRESSED_R11_EAC, // ETC2_R_NO_MIPMAPS
	6: COMPRESSED_RG11_EAC, // ETC2_RG_NO_MIPMAPS
	7: COMPRESSED_SIGNED_R11_EAC, // ETC2_SIGNED_R_NO_MIPMAPS
	8: COMPRESSED_SIGNED_RG11_EAC, // ETC2_SIGNED_RG_NO_MIPMAPS
};

/**
 * Parse a PKM compressed texture file.
 * @param {ArrayBuffer} data - the raw PKM file data
 * @returns {CompressedImage} a compressed texture object
 * @ignore
 */
export function parsePKM(data) {
	const header = new DataView(data, 0, PKM_HEADER_SIZE);

	// validate magic
	const magic = header.getUint32(0, false); // big-endian
	if (magic !== PKM_MAGIC) {
		throw new Error("Invalid PKM file: bad magic 0x" + magic.toString(16));
	}

	// read format type (big-endian uint16 at offset 6)
	const formatType = header.getUint16(6, false);

	const format = PKM_FORMAT_TO_WEBGL[formatType];
	if (typeof format === "undefined") {
		throw new Error("Unrecognized PKM format type: " + formatType);
	}

	// original dimensions (big-endian uint16)
	const width = header.getUint16(12, false);
	const height = header.getUint16(14, false);

	// encoded (padded) dimensions for calculating data size
	const encodedWidth = header.getUint16(8, false);
	const encodedHeight = header.getUint16(10, false);

	// block size: 8 bytes for ETC1/ETC2 RGB, 16 bytes for RGBA/R11/RG11
	const blockSize =
		formatType === 0 || formatType === 1 || formatType === 4 ? 8 : 16;

	const dataSize =
		((encodedWidth + 3) >> 2) * ((encodedHeight + 3) >> 2) * blockSize;

	return {
		mipmaps: [
			{
				data: new Uint8Array(data, PKM_HEADER_SIZE, dataSize),
				width: width,
				height: height,
			},
		],
		width: width,
		height: height,
		format: format,
		compressed: true,
		generateMipmap: false,
	};
}
