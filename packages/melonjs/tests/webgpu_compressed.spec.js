import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import { Renderer, WebGPURenderer } from "../src/index.js";
import {
	COMPRESSED_FORMATS,
	uploadCompressedTexture,
} from "../src/video/webgpu/texture/compressed.js";
import WebGPUTextureStore from "../src/video/webgpu/texture/store.js";

/**
 * Compressed-texture support on the WebGPU backend: the WebGL-enum →
 * GPUTextureFormat map, block-aligned per-mip writeTexture uploads, the
 * device-feature → format-family shape (shared with the loader's
 * capability gate), and the texture store's compressed branch.
 */
describe("WebGPU compressed textures", () => {
	it("every mapped format carries coherent block metrics", () => {
		for (const [enumValue, metrics] of COMPRESSED_FORMATS) {
			expect(enumValue).toBeGreaterThan(0x8000);
			expect(metrics.format).toMatch(/^(bc|etc2|eac|astc)/);
			expect(metrics.blockW).toBeGreaterThanOrEqual(4);
			expect(metrics.blockH).toBeGreaterThanOrEqual(4);
			expect([8, 16]).toContain(metrics.bytes);
		}
	});

	it("uploads each mip with block-aligned bytesPerRow", () => {
		const writes = [];
		const device = {
			queue: {
				writeTexture(dst, data, layout, size) {
					writes.push({ dst, byteLength: data.byteLength, layout, size });
				},
			},
		};
		const image = {
			format: 0x83f0, // DXT1 → bc1 (4×4 blocks, 8 bytes)
			mipmaps: [
				{ data: new Uint8Array(32), width: 8, height: 8 },
				{ data: new Uint8Array(8), width: 4, height: 4 },
				{ data: new Uint8Array(8), width: 2, height: 2 },
			],
		};
		const texture = { label: "t" };
		uploadCompressedTexture(
			device,
			texture,
			image,
			COMPRESSED_FORMATS.get(0x83f0),
		);

		expect(writes).toHaveLength(3);
		// 8px = 2 blocks per row × 8 bytes
		expect(writes[0].layout.bytesPerRow).toBe(16);
		expect(writes[0].layout.rowsPerImage).toBe(2);
		expect(writes[0].size).toEqual([8, 8]);
		expect(writes[0].dst.mipLevel).toBe(0);
		// 4px and the 2px tail mip round up to one block
		expect(writes[1].layout.bytesPerRow).toBe(8);
		expect(writes[2].layout.bytesPerRow).toBe(8);
		expect(writes[2].dst.mipLevel).toBe(2);
	});

	it("format families mirror the device features in the GL shape", () => {
		const stub = {
			device: { features: new Set(["texture-compression-bc"]) },
			getSupportedCompressedTextureFormats:
				WebGPURenderer.prototype.getSupportedCompressedTextureFormats,
			hasSupportedCompressedFormats:
				Renderer.prototype.hasSupportedCompressedFormats,
		};
		const formats = stub.getSupportedCompressedTextureFormats();
		expect(formats.s3tc).not.toBeNull();
		expect(formats.bptc).not.toBeNull();
		expect(formats.etc2).toBeNull();
		expect(formats.astc).toBeNull();
		expect(formats.pvrtc).toBeNull();
		// the base hasSupportedCompressedFormats consumes this shape as-is
		expect(stub.hasSupportedCompressedFormats(0x83f0)).toBe(true);
		expect(stub.hasSupportedCompressedFormats(0x9274)).toBe(false);
		// PVRTC never maps to a WebGPU format
		expect(stub.hasSupportedCompressedFormats(0x8c00)).toBe(false);
	});

	it("etc2 support synthesizes the etc1 family (superset payload)", () => {
		const stub = {
			device: { features: new Set(["texture-compression-etc2"]) },
			getSupportedCompressedTextureFormats:
				WebGPURenderer.prototype.getSupportedCompressedTextureFormats,
		};
		const formats = stub.getSupportedCompressedTextureFormats();
		expect(formats.etc1).toEqual({ COMPRESSED_RGB_ETC1_WEBGL: 0x8d64 });
		expect(formats.s3tc).toBeNull();
	});

	it("the store uploads compressed sources through writeTexture with mip storage", () => {
		const created = [];
		const writes = [];
		const renderer = {
			device: {
				createTexture(descriptor) {
					const texture = {
						descriptor,
						destroy() {},
						createView() {
							return { texture: this };
						},
					};
					created.push(texture);
					return texture;
				},
				createSampler(descriptor) {
					return { descriptor };
				},
				createBindGroup(descriptor) {
					return { descriptor };
				},
				queue: {
					writeTexture(dst, data, layout, size) {
						writes.push({ dst, layout, size });
					},
					copyExternalImageToTexture() {
						throw new Error("compressed sources must not use the image path");
					},
				},
			},
			frameId: 1,
			retireTexture() {},
			cache: {
				getUnit() {
					return 0;
				},
				peekAllUnits() {
					return [0];
				},
			},
			pipelineCache: { materialLayout: {} },
			getDefaultTextureFilter() {
				return "linear";
			},
		};
		const store = new WebGPUTextureStore(renderer);
		const source = {
			compressed: true,
			format: 0x83f3, // DXT5 → bc3, 16 bytes per block
			width: 8,
			height: 8,
			mipmaps: [
				{ data: new Uint8Array(64), width: 8, height: 8 },
				{ data: new Uint8Array(16), width: 4, height: 4 },
			],
		};
		const atlas = {
			getTexture() {
				return source;
			},
			repeat: "no-repeat",
		};

		const bindGroup = store.getBinding(atlas);
		expect(bindGroup).toBeDefined();
		expect(created).toHaveLength(1);
		expect(created[0].descriptor.format).toBe("bc3-rgba-unorm");
		expect(created[0].descriptor.mipLevelCount).toBe(2);
		// compressed formats cannot be render attachments
		expect(
			created[0].descriptor.usage & GPUTextureUsage.RENDER_ATTACHMENT,
		).toBe(0);
		expect(writes).toHaveLength(2);
		expect(writes[0].layout.bytesPerRow).toBe(32);

		// a second bind is fully resident — no re-upload
		store.getBinding(atlas);
		expect(writes).toHaveLength(2);

		// a recycled unit must NOT adopt a same-size image source into the
		// compressed-format texture (non-renderable format — the copy would
		// fail validation while the stale pixels kept serving): it recreates
		const imageAtlas = {
			getTexture() {
				return { width: 8, height: 8 };
			},
			repeat: "no-repeat",
		};
		// the recreated rgba8unorm texture legitimately uploads via the
		// image path again
		renderer.device.queue.copyExternalImageToTexture = () => {};
		store.getBinding(imageAtlas);
		expect(created).toHaveLength(2);
		expect(created[1].descriptor.format).toBe("rgba8unorm");
		store.destroy();
	});
});
