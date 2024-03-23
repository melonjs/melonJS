/*
const COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 0x8C00;
const COMPRESSED_RGB_PVRTC_2BPPV1_IMG = 0x8C01;
const COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8C02;
const COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 0x8C03;

const COMPRESSED_RGB_ETC1_WEBGL = 0x8D64;

const PVR_HEADER_LENGTH = 13; // The header length in 32 bit ints.
//const PVR_MAGIC = 0x03525650; //0x50565203;

// Offsets into the header array.
//const PVR_HEADER_MAGIC = 0;
const PVR_HEADER_FORMAT = 2;
const PVR_HEADER_HEIGHT = 6;
const PVR_HEADER_WIDTH = 7;
const PVR_HEADER_MIPMAPCOUNT = 11;
const PVR_HEADER_METADATA = 12;

const PVR_FORMAT_2BPP_RGB = 0;
const PVR_FORMAT_2BPP_RGBA = 1;
const PVR_FORMAT_4BPP_RGB = 2;
const PVR_FORMAT_4BPP_RGBA = 3;
//const PVR_COLOR_SPACE = 4;
const PVR_FORMAT_ETC1 = 6;
const PVR_FORMAT_DXT1 = 7;
const PVR_FORMAT_DXT3 = 9;
const PVR_FORMAT_DXT5 = 5;

const COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;
//const COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
const COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;

const PVR_TO_WEBGL_FORMAT = {
    [PVR_FORMAT_2BPP_RGB] : COMPRESSED_RGB_PVRTC_2BPPV1_IMG,
    [PVR_FORMAT_2BPP_RGBA] : COMPRESSED_RGBA_PVRTC_2BPPV1_IMG,
    [PVR_FORMAT_4BPP_RGB] : COMPRESSED_RGB_PVRTC_4BPPV1_IMG,
    [PVR_FORMAT_4BPP_RGBA] : COMPRESSED_RGBA_PVRTC_4BPPV1_IMG,
    [PVR_FORMAT_ETC1] : COMPRESSED_RGB_ETC1_WEBGL,
    [PVR_FORMAT_DXT1] : COMPRESSED_RGB_S3TC_DXT1_EXT,
    [PVR_FORMAT_DXT3] : COMPRESSED_RGBA_S3TC_DXT3_EXT,
    [PVR_FORMAT_DXT5] : COMPRESSED_RGBA_S3TC_DXT5_EXT
};

function levelBufferSize(format, width, height) {
    switch (format) {
        case COMPRESSED_RGB_S3TC_DXT1_EXT:
        case COMPRESSED_RGB_ETC1_WEBGL:
            return ((width + 3) >> 2) * ((height + 3) >> 2) * 8;

        case COMPRESSED_RGBA_S3TC_DXT3_EXT:
        case COMPRESSED_RGBA_S3TC_DXT5_EXT:
            return ((width + 3) >> 2) * ((height + 3) >> 2) * 16;

        case COMPRESSED_RGB_PVRTC_4BPPV1_IMG:
        case COMPRESSED_RGBA_PVRTC_4BPPV1_IMG:
            return Math.floor((Math.max(width, 8) * Math.max(height, 8) * 4 + 7) / 8);

        case COMPRESSED_RGB_PVRTC_2BPPV1_IMG:
        case COMPRESSED_RGBA_PVRTC_2BPPV1_IMG:
            return Math.floor((Math.max(width, 16) * Math.max(height, 8) * 2 + 7) / 8);

        default:
            return 0;
    }
}
*/

// parse and return the compressed texture
export function parsePVR() {

    throw new Error("unsupported format");

    /*

    // Create a new DataView from the data
    let header = new Uint32Array(data, 0, PVR_HEADER_LENGTH);

    //console.log(header);

    // VERSION
    //const version = header[PVR_HEADER_FORMAT];
    //const versionMatch = version === PVR_MAGIC;

    //  PIXEL_FORMAT_INDEX
    const pvrFormat = PVR_TO_WEBGL_FORMAT[header[PVR_HEADER_FORMAT]] || -1;
    const width = header[PVR_HEADER_WIDTH];
    const height = header[PVR_HEADER_HEIGHT];
    const dataOffset = header[PVR_HEADER_METADATA] + 52;
    //const colorSpace = header[PVR_COLOR_SPACE];
    const mipmapCount = header[PVR_HEADER_MIPMAPCOUNT];

    var image = new Uint8Array(data, dataOffset);
    var mipmaps = new Array(mipmapCount);

    var offset = 0;
    var levelWidth = width;
    var levelHeight = height;

    for (var i = 0; i < mipmapCount; i++)
    {
        var levelSize = levelBufferSize(pvrFormat, levelWidth, levelHeight);

        mipmaps[i] = {
            data: new Uint8Array(image.buffer, image.byteOffset + offset, levelSize),
            width: levelWidth,
            height: levelHeight
        };

        levelWidth = Math.max(1, levelWidth >> 1);
        levelHeight = Math.max(1, levelHeight >> 1);

        offset += levelSize;
    }

    return {
        mipmaps: mipmaps,
        width: width,
        height: height,
        format: pvrFormat,
        compressed: true,
        generateMipmap: false
    };

    */
}
