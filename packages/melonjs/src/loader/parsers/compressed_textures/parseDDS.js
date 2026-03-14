// DDS magic number
const DDS_MAGIC = 0x20534444;

// DDS header size in bytes (excluding magic)
const DDS_HEADER_SIZE = 124;

// DDS_PIXELFORMAT fourCC values
const FOURCC_DXT1 = 0x31545844; // "DXT1"
const FOURCC_DXT3 = 0x33545844; // "DXT3"
const FOURCC_DXT5 = 0x35545844; // "DXT5"
const FOURCC_DX10 = 0x30315844; // "DX10"

// DXGI format for BC7
const DXGI_FORMAT_BC7_UNORM = 98;
const DXGI_FORMAT_BC7_UNORM_SRGB = 99;

// WebGL compressed texture format constants
const COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83f0;
const COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83f2;
const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83f3;
const COMPRESSED_RGBA_BPTC_UNORM_EXT = 0x8e8c;

const FOURCC_TO_WEBGL = {
	[FOURCC_DXT1]: COMPRESSED_RGB_S3TC_DXT1_EXT,
	[FOURCC_DXT3]: COMPRESSED_RGBA_S3TC_DXT3_EXT,
	[FOURCC_DXT5]: COMPRESSED_RGBA_S3TC_DXT5_EXT,
};

const DXGI_TO_WEBGL = {
	[DXGI_FORMAT_BC7_UNORM]: COMPRESSED_RGBA_BPTC_UNORM_EXT,
	[DXGI_FORMAT_BC7_UNORM_SRGB]: COMPRESSED_RGBA_BPTC_UNORM_EXT,
};

// Block size in bytes per 4×4 block
function blockSize(format) {
	return format === COMPRESSED_RGB_S3TC_DXT1_EXT ? 8 : 16;
}

/**
 * Parse a DDS compressed texture file.
 * @param {ArrayBuffer} data - the DDS file data
 * @returns {CompressedImage} a compressed texture object with mipmaps, width, height, format
 * @ignore
 */
export function parseDDS(data) {
	// validate magic number
	const magicView = new DataView(data, 0, 4);
	if (magicView.getUint32(0, true) !== DDS_MAGIC) {
		throw new Error("Invalid DDS file: bad magic number");
	}

	// read header (124 bytes starting at offset 4)
	const header = new DataView(data, 4, DDS_HEADER_SIZE);
	const height = header.getUint32(8, true);
	const width = header.getUint32(12, true);
	const mipmapCount = Math.max(1, header.getUint32(24, true));
	const fourCC = header.getUint32(80, true);

	let format;
	let dataOffset = 4 + DDS_HEADER_SIZE; // 128

	if (fourCC === FOURCC_DX10) {
		// DX10 extended header (20 bytes at offset 128)
		const dx10Header = new DataView(data, 128, 20);
		const dxgiFormat = dx10Header.getUint32(0, true);

		format = DXGI_TO_WEBGL[dxgiFormat];
		if (typeof format === "undefined") {
			throw new Error("Unrecognized DDS DXGI format: " + dxgiFormat);
		}
		dataOffset = 148; // 128 + 20
	} else {
		format = FOURCC_TO_WEBGL[fourCC];
		if (typeof format === "undefined") {
			throw new Error("Unrecognized DDS fourCC: 0x" + fourCC.toString(16));
		}
	}

	const bs = blockSize(format);
	const mipmaps = new Array(mipmapCount);
	let levelWidth = width;
	let levelHeight = height;
	let offset = dataOffset;

	for (let i = 0; i < mipmapCount; i++) {
		const levelSize =
			Math.max(1, (levelWidth + 3) >> 2) *
			Math.max(1, (levelHeight + 3) >> 2) *
			bs;

		mipmaps[i] = {
			data: new Uint8Array(data, offset, levelSize),
			width: levelWidth,
			height: levelHeight,
		};

		offset += levelSize;
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
