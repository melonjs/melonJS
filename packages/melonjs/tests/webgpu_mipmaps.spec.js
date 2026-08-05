import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUTextureStore from "../src/video/webgpu/texture/store.js";

/**
 * Mesh-texture mipmaps on the WebGPU backend: a mip-wanting consumer (the
 * mesh path) gets a full generated chain and a trilinear sampler, while
 * every 2D consumer of the same image stays lod-clamped to level 0 — the
 * Godot-style split where minification quality is a 3D concern and sprite
 * output never changes.
 */
describe("WebGPUTextureStore mipmaps", () => {
	let renderer;
	let store;
	let createdTextures;
	let samplers;
	let mipgen;

	function makeSource(width, height) {
		return { width, height };
	}

	function makeAtlas(source, options = {}) {
		return {
			getTexture() {
				return source;
			},
			repeat: options.repeat ?? "no-repeat",
			filter: options.filter,
			__unit: options.unit ?? 0,
		};
	}

	beforeEach(() => {
		createdTextures = [];
		samplers = [];
		mipgen = { submits: 0, passes: [], draws: 0 };
		const device = {
			createTexture(descriptor) {
				const texture = {
					label: descriptor.label,
					size: descriptor.size,
					mipLevelCount: descriptor.mipLevelCount ?? 1,
					destroyed: false,
					destroy() {
						this.destroyed = true;
					},
					createView(viewDescriptor) {
						return { texture: this, viewDescriptor };
					},
				};
				createdTextures.push(texture);
				return texture;
			},
			createSampler(descriptor) {
				samplers.push(descriptor);
				return { descriptor };
			},
			createBindGroup(descriptor) {
				return { descriptor };
			},
			createShaderModule(descriptor) {
				return { label: descriptor.label };
			},
			createBindGroupLayout(descriptor) {
				return { label: descriptor.label };
			},
			createPipelineLayout() {
				return {};
			},
			createRenderPipeline(descriptor) {
				return { descriptor };
			},
			createCommandEncoder() {
				return {
					beginRenderPass(descriptor) {
						mipgen.passes.push(descriptor);
						return {
							setPipeline() {},
							setBindGroup() {},
							draw() {
								mipgen.draws++;
							},
							end() {},
						};
					},
					finish() {
						return {};
					},
				};
			},
			queue: {
				copyExternalImageToTexture() {},
				submit() {
					mipgen.submits++;
				},
			},
		};
		renderer = {
			device,
			frameId: 1,
			commandEncoder: null,
			retiredTextures: [],
			retireTexture(texture) {
				texture.destroy();
			},
			cache: {
				getUnit(texture) {
					return texture.__unit;
				},
				peekAllUnits(texture) {
					return [texture.__unit];
				},
			},
			pipelineCache: { materialLayout: {} },
			getDefaultTextureFilter() {
				return "linear";
			},
		};
		store = new WebGPUTextureStore(renderer);
	});

	it("a mip-wanting consumer gets a full chain with one blit pass per level", () => {
		store.getBinding(makeAtlas(makeSource(64, 32)), { mipmaps: true });
		// floor(log2(64)) + 1 = 7 levels
		expect(createdTextures[0].mipLevelCount).toBe(7);
		// 6 downsample passes, one draw each, submitted immediately
		expect(mipgen.passes).toHaveLength(6);
		expect(mipgen.draws).toBe(6);
		expect(mipgen.submits).toBe(1);
		// each pass renders INTO one level, sampling the one above it
		const first = mipgen.passes[0].colorAttachments[0];
		expect(first.view.viewDescriptor.baseMipLevel).toBe(1);
	});

	it("2D consumers stay lod-clamped to level 0; the mesh path samples the chain", () => {
		const source = makeSource(64, 64);
		// sprite first (flat), then the mesh path (mips) on the same unit
		const spriteBinding = store.getBinding(makeAtlas(source));
		const meshBinding = store.getBinding(makeAtlas(source), {
			mipmaps: true,
		});
		expect(meshBinding).not.toBe(spriteBinding);

		const flat = samplers.find((s) => {
			return s.lodMaxClamp === 0;
		});
		expect(flat).toBeDefined();
		expect(flat.mipmapFilter).toBeUndefined();
		const mip = samplers.find((s) => {
			return s.mipmapFilter === "linear";
		});
		expect(mip).toBeDefined();
		expect(mip.lodMaxClamp).toBeUndefined();
		// the mesh sampler is 4× anisotropic (valid: fully linear); flat
		// samplers never are
		expect(mip.maxAnisotropy).toBe(4);
		expect(flat.maxAnisotropy).toBeUndefined();
	});

	it("the mesh path upgrades a resident flat record in place (retire + regenerate)", () => {
		const source = makeSource(32, 32);
		store.getBinding(makeAtlas(source));
		expect(createdTextures[0].mipLevelCount).toBe(1);
		expect(mipgen.submits).toBe(0);

		store.getBinding(makeAtlas(source), { mipmaps: true });
		expect(createdTextures).toHaveLength(2);
		expect(createdTextures[0].destroyed).toBe(true);
		expect(createdTextures[1].mipLevelCount).toBe(6);
		expect(mipgen.submits).toBe(1);

		// and never downgrades: a later flat consumer keeps the chain
		store.getBinding(makeAtlas(source));
		expect(createdTextures).toHaveLength(2);
	});

	it("a nearest-filtered mesh texture keeps hard level-0 sampling (opt-out)", () => {
		store.getBinding(makeAtlas(makeSource(32, 32), { filter: "nearest" }), {
			mipmaps: true,
		});
		// the MATERIAL sampler is flat nearest, lod-clamped to level 0 (the
		// only linear sampler in sight is the mip blit's internal one, which
		// carries no mipmapFilter of its own)
		expect(
			samplers.some((s) => {
				return s.mipmapFilter === "linear";
			}),
		).toBe(false);
		const material = samplers.find((s) => {
			return s.magFilter === "nearest";
		});
		expect(material).toBeDefined();
		expect(material.lodMaxClamp).toBe(0);
	});

	it("a 1×1 source (the white-pixel fallback) never generates", () => {
		store.getBinding(makeAtlas(makeSource(1, 1)), { mipmaps: true });
		expect(createdTextures[0].mipLevelCount).toBe(1);
		expect(mipgen.submits).toBe(0);
	});

	it("plain 2D uploads are unchanged (no chain, no submits — regression pin)", () => {
		store.getBinding(makeAtlas(makeSource(128, 128)));
		expect(createdTextures[0].mipLevelCount).toBe(1);
		expect(mipgen.submits).toBe(0);
	});
});
