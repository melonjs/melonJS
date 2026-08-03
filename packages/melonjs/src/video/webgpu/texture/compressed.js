/**
 * WebGL compressed-format constant → WebGPU texture format + block
 * metrics. The loader parsers (dds/pvr/pkm/ktx/ktx2) are backend-neutral
 * and emit WebGL enum constants; this table is the WebGPU side of that
 * contract. Families gate on the device features requested at init:
 * "texture-compression-bc", "texture-compression-etc2",
 * "texture-compression-astc" (PVRTC has no WebGPU equivalent).
 * @ignore
 */
export const COMPRESSED_FORMATS = new Map([
	// S3TC / BC (texture-compression-bc)
	[0x83f0, { format: "bc1-rgba-unorm", blockW: 4, blockH: 4, bytes: 8 }],
	[0x83f2, { format: "bc2-rgba-unorm", blockW: 4, blockH: 4, bytes: 16 }],
	[0x83f3, { format: "bc3-rgba-unorm", blockW: 4, blockH: 4, bytes: 16 }],
	[0x8c4c, { format: "bc1-rgba-unorm-srgb", blockW: 4, blockH: 4, bytes: 8 }],
	[0x8c4d, { format: "bc1-rgba-unorm-srgb", blockW: 4, blockH: 4, bytes: 8 }],
	[0x8c4e, { format: "bc2-rgba-unorm-srgb", blockW: 4, blockH: 4, bytes: 16 }],
	[0x8c4f, { format: "bc3-rgba-unorm-srgb", blockW: 4, blockH: 4, bytes: 16 }],
	[0x8e8c, { format: "bc7-rgba-unorm", blockW: 4, blockH: 4, bytes: 16 }],
	// ETC1 payload is valid ETC2 rgb8 (superset)
	[0x8d64, { format: "etc2-rgb8unorm", blockW: 4, blockH: 4, bytes: 8 }],
	// ETC2 / EAC (texture-compression-etc2)
	[0x9274, { format: "etc2-rgb8unorm", blockW: 4, blockH: 4, bytes: 8 }],
	[0x9275, { format: "etc2-rgb8unorm-srgb", blockW: 4, blockH: 4, bytes: 8 }],
	[0x9276, { format: "etc2-rgb8a1unorm", blockW: 4, blockH: 4, bytes: 8 }],
	[0x9277, { format: "etc2-rgb8a1unorm-srgb", blockW: 4, blockH: 4, bytes: 8 }],
	[0x9278, { format: "etc2-rgba8unorm", blockW: 4, blockH: 4, bytes: 16 }],
	[0x9279, { format: "etc2-rgba8unorm-srgb", blockW: 4, blockH: 4, bytes: 16 }],
	[0x9270, { format: "eac-r11unorm", blockW: 4, blockH: 4, bytes: 8 }],
	[0x9271, { format: "eac-r11snorm", blockW: 4, blockH: 4, bytes: 8 }],
	[0x9272, { format: "eac-rg11unorm", blockW: 4, blockH: 4, bytes: 16 }],
	[0x9273, { format: "eac-rg11snorm", blockW: 4, blockH: 4, bytes: 16 }],
	// ASTC (texture-compression-astc) — all 16 bytes per block
	[0x93b0, { format: "astc-4x4-unorm", blockW: 4, blockH: 4, bytes: 16 }],
	[0x93b1, { format: "astc-5x4-unorm", blockW: 5, blockH: 4, bytes: 16 }],
	[0x93b2, { format: "astc-5x5-unorm", blockW: 5, blockH: 5, bytes: 16 }],
	[0x93b3, { format: "astc-6x5-unorm", blockW: 6, blockH: 5, bytes: 16 }],
	[0x93b4, { format: "astc-6x6-unorm", blockW: 6, blockH: 6, bytes: 16 }],
	[0x93b5, { format: "astc-8x5-unorm", blockW: 8, blockH: 5, bytes: 16 }],
	[0x93b6, { format: "astc-8x6-unorm", blockW: 8, blockH: 6, bytes: 16 }],
	[0x93b7, { format: "astc-8x8-unorm", blockW: 8, blockH: 8, bytes: 16 }],
	// ASTC sRGB (KTX1 files carry the raw GL internal formats)
	[0x93d0, { format: "astc-4x4-unorm-srgb", blockW: 4, blockH: 4, bytes: 16 }],
	[0x93d1, { format: "astc-5x4-unorm-srgb", blockW: 5, blockH: 4, bytes: 16 }],
	[0x93d2, { format: "astc-5x5-unorm-srgb", blockW: 5, blockH: 5, bytes: 16 }],
	[0x93d3, { format: "astc-6x5-unorm-srgb", blockW: 6, blockH: 5, bytes: 16 }],
	[0x93d4, { format: "astc-6x6-unorm-srgb", blockW: 6, blockH: 6, bytes: 16 }],
	[0x93d5, { format: "astc-8x5-unorm-srgb", blockW: 8, blockH: 5, bytes: 16 }],
	[0x93d6, { format: "astc-8x6-unorm-srgb", blockW: 8, blockH: 6, bytes: 16 }],
	[0x93d7, { format: "astc-8x8-unorm-srgb", blockW: 8, blockH: 8, bytes: 16 }],
]);

/**
 * the optional device features the renderer requests when the adapter
 * offers them
 * @ignore
 */
export const COMPRESSION_FEATURES = [
	"texture-compression-bc",
	"texture-compression-etc2",
	"texture-compression-astc",
];

/**
 * Upload every mip level of a parsed CompressedImage into a GPUTexture
 * via queue.writeTexture (block-aligned rows, largest mip first — the
 * parser contract).
 * @param {GPUDevice} device - the device
 * @param {GPUTexture} texture - destination created with the mapped format
 * @param {object} image - the parsed CompressedImage ({mipmaps, format})
 * @param {object} metrics - the COMPRESSED_FORMATS entry for image.format
 * @ignore
 */
export function uploadCompressedTexture(device, texture, image, metrics) {
	const mipmaps = image.mipmaps;
	for (let level = 0; level < mipmaps.length; level++) {
		const mip = mipmaps[level];
		const blocksPerRow = Math.ceil(mip.width / metrics.blockW);
		const rows = Math.ceil(mip.height / metrics.blockH);
		device.queue.writeTexture(
			{ texture, mipLevel: level },
			mip.data,
			{
				offset: 0,
				bytesPerRow: blocksPerRow * metrics.bytes,
				rowsPerImage: rows,
			},
			[mip.width, mip.height],
		);
	}
}
