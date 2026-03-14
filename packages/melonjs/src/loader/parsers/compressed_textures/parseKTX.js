// KTX v1 file identifier (12 bytes): «KTX 11»\r\n\x1A\n
const KTX_IDENTIFIER = [
	0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
];

const KTX_ENDIANNESS = 0x04030201;
const KTX_ENDIANNESS_SWAP = 0x01020304;

// Header field offsets (in Uint32Array indices, after the 12-byte identifier)
// Byte offsets: identifier(12) + endianness(4) + 12 × uint32(48) = 64 bytes total
const KTX_HEADER_SIZE = 64;

/**
 * Parse a KTX v1 compressed texture file.
 * @param {ArrayBuffer} data - the KTX file data
 * @returns {CompressedImage} a compressed texture object with mipmaps, width, height, format
 * @ignore
 */
export function parseKTX(data) {
	const idView = new Uint8Array(data, 0, 12);

	// validate file identifier
	for (let i = 0; i < 12; i++) {
		if (idView[i] !== KTX_IDENTIFIER[i]) {
			throw new Error("Invalid KTX file: bad identifier");
		}
	}

	// read header uint32 values (starting at byte 12)
	const headerView = new DataView(data, 12, KTX_HEADER_SIZE - 12);
	const endianness = headerView.getUint32(0, true);

	let littleEndian;
	if (endianness === KTX_ENDIANNESS) {
		littleEndian = true;
	} else if (endianness === KTX_ENDIANNESS_SWAP) {
		littleEndian = false;
	} else {
		throw new Error("Invalid KTX file: bad endianness indicator");
	}

	const glType = headerView.getUint32(4, littleEndian);
	const glFormat = headerView.getUint32(12, littleEndian);
	const glInternalFormat = headerView.getUint32(16, littleEndian);
	const width = headerView.getUint32(24, littleEndian);
	const height = headerView.getUint32(28, littleEndian);
	const numberOfMipmapLevels = Math.max(
		1,
		headerView.getUint32(44, littleEndian),
	);
	const bytesOfKeyValueData = headerView.getUint32(48, littleEndian);

	// verify this is a compressed texture (glType and glFormat must be 0)
	if (glType !== 0 || glFormat !== 0) {
		throw new Error(
			"KTX file contains uncompressed texture data, only compressed formats are supported",
		);
	}

	// pixel data starts after header + key/value data
	let dataOffset = KTX_HEADER_SIZE + bytesOfKeyValueData;

	const mipmaps = new Array(numberOfMipmapLevels);
	let levelWidth = width;
	let levelHeight = height;

	for (let i = 0; i < numberOfMipmapLevels; i++) {
		// read imageSize (uint32, endianness-aware)
		const imageSizeView = new DataView(data, dataOffset, 4);
		const imageSize = imageSizeView.getUint32(0, littleEndian);
		dataOffset += 4;

		mipmaps[i] = {
			data: new Uint8Array(data, dataOffset, imageSize),
			width: levelWidth,
			height: levelHeight,
		};

		// advance past image data + padding to 4-byte alignment
		dataOffset += imageSize;
		dataOffset = (dataOffset + 3) & ~3;

		levelWidth = Math.max(1, levelWidth >> 1);
		levelHeight = Math.max(1, levelHeight >> 1);
	}

	return {
		mipmaps: mipmaps,
		width: width,
		height: height,
		format: glInternalFormat,
		compressed: true,
		generateMipmap: false,
	};
}
