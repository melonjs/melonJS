import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUTextureStore from "../src/video/webgpu/texture/store.js";

/**
 * Mesh-texture mipmaps on the WebGPU backend: a mip-wanting consumer (the
 * mesh path) gets a full generated chain and a trilinear sampler, while
 * every 2D consumer of the same image stays lod-clamped to level 0 — the
 * conventional split, where minification quality is a 3D concern and sprite
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
		mipgen = { submits: 0, passes: [], draws: 0, copies: 0 };
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
				copyExternalImageToTexture() {
					// counted: a texture that is not re-CREATED can still be
					// re-UPLOADED every frame through the adoption path, which
					// is the same pathology one layer down
					mipgen.copies++;
				},
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

	it("a 1×1 source is uploaded ONCE, not re-created every frame", () => {
		// A full chain for 1×1 is one level, so a record holding one level is
		// already complete. Testing "has it got mips?" as `mipLevelCount === 1`
		// can never come true here: the texture was rebuilt with one level, the
		// next frame asked again, and the answer never changed. Every mesh
		// without an alpha map binds a 1×1 filler through this path, so this
		// churned ~4 GPU textures per frame for the life of the scene.
		const source = makeSource(1, 1);
		for (let frame = 0; frame < 5; frame++) {
			renderer.frameId = frame + 1;
			store.getBinding(makeAtlas(source), { mipmaps: true });
		}
		expect(createdTextures).toHaveLength(1);
		expect(createdTextures[0].destroyed).toBe(false);
		expect(mipgen.submits).toBe(0);
		// Uploaded once, too. Without this the outer guard can be reverted on
		// its own and every test still passes: the record stops being
		// re-created but starts being re-adopted, one image copy per frame.
		expect(mipgen.copies).toBe(1);
	});

	it("a mipped record is not re-created every frame either", () => {
		// the same guard, read the other way: once a record holds the full
		// chain its size allows, nothing further is owed
		const source = makeSource(32, 32);
		renderer.frameId = 1;
		store.getBinding(makeAtlas(source), { mipmaps: true });
		expect(createdTextures).toHaveLength(1);
		expect(createdTextures[0].mipLevelCount).toBe(6);

		for (let frame = 2; frame <= 5; frame++) {
			renderer.frameId = frame;
			store.getBinding(makeAtlas(source), { mipmaps: true });
		}
		expect(createdTextures).toHaveLength(1);
		// and the chain was generated once, not once per frame
		expect(mipgen.submits).toBe(1);
	});

	it("upgrades a flat record to a chain across frames, then settles", () => {
		// The in-place upgrade test above runs both binds in ONE frame, where
		// `record.frameId === renderer.frameId` decides the rebuild before the
		// mip clause is even evaluated. Crossing a frame boundary is what makes
		// the mip comparison itself the deciding term.
		const source = makeSource(32, 32);
		renderer.frameId = 1;
		store.getBinding(makeAtlas(source));
		expect(createdTextures).toHaveLength(1);
		expect(createdTextures[0].mipLevelCount).toBe(1);

		renderer.frameId = 2;
		store.getBinding(makeAtlas(source), { mipmaps: true });
		expect(createdTextures).toHaveLength(2);
		expect(createdTextures[1].mipLevelCount).toBe(6);

		// and then stops: the chain is as long as the size allows
		for (let frame = 3; frame <= 6; frame++) {
			renderer.frameId = frame;
			store.getBinding(makeAtlas(source), { mipmaps: true });
		}
		expect(createdTextures).toHaveLength(2);
		expect(mipgen.submits).toBe(1);
	});

	it("a non-power-of-two source settles after one upload", () => {
		// the chain length is floor(log2(max)) + 1, so 100×100 gets 7 levels —
		// the guard has to compare against THAT, not against a power-of-two
		// assumption, or the record never looks complete
		const source = makeSource(100, 100);
		renderer.frameId = 1;
		store.getBinding(makeAtlas(source), { mipmaps: true });
		expect(createdTextures).toHaveLength(1);
		expect(createdTextures[0].mipLevelCount).toBe(7);

		for (let frame = 2; frame <= 5; frame++) {
			renderer.frameId = frame;
			store.getBinding(makeAtlas(source), { mipmaps: true });
		}
		expect(createdTextures).toHaveLength(1);
		expect(mipgen.submits).toBe(1);
	});

	it("plain 2D uploads are unchanged (no chain, no submits — regression pin)", () => {
		store.getBinding(makeAtlas(makeSource(128, 128)));
		expect(createdTextures[0].mipLevelCount).toBe(1);
		expect(mipgen.submits).toBe(0);
	});
});
