import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Color, WebGPURenderer } from "../src/index.js";
import { BLOCK_BYTES } from "../src/video/webgl/lighting/std140.ts";
import WebGPULitQuadBatcher from "../src/video/webgpu/batchers/lit_quad_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The WebGPU 2D lighting port on the mock renderer: the lit quad
 * batcher's std140 snapshot-per-camera semantics, the combined
 * color+normal material composition, version-stamped normal-map
 * re-uploads, and drawLight's tint-packed fast-path draw.
 */
describe("WebGPU 2D lighting", () => {
	describe("WebGPULitQuadBatcher (mock)", () => {
		let renderer;
		let lit;

		const packed = (count = 1) => {
			return {
				count,
				positions: new Float32Array([100, 50, 120, 0.7, 0, 0, 0, 0]),
				colors: new Float32Array([1, 0.5, 0.25, 0, 0, 0]),
				heights: new Float32Array([9, 0]),
				ambient: [0.1, 0.2, 0.3],
			};
		};

		beforeEach(() => {
			renderer = createMockWebGPURenderer();
			lit = new WebGPULitQuadBatcher(renderer);
		});

		it("registers the lit family against the frozen quad layout", () => {
			expect(lit.shaderKey).toMatch(/^effect:/);
			// a second instance (device-loss re-init) reuses the module text
			const again = new WebGPULitQuadBatcher(renderer);
			expect(again.shaderKey).toBe(lit.shaderKey);
		});

		it("every setLightUniforms call owns its snapshot bytes (distinct dynamic offsets)", () => {
			lit.setLightUniforms(packed());
			const first = lit.lightBinding;
			lit.setLightUniforms(packed(0));
			const second = lit.lightBinding;

			// queue-write law: each camera's block gets a fresh arena region
			expect(second.dynamicOffset).not.toBe(first.dynamicOffset);
			// both writes upload the full std140 block
			const writes = renderer.calls.writes;
			expect(writes).toHaveLength(2);
			expect(writes[0].size).toBe(BLOCK_BYTES);
			// header float 0 = count, floats 4..6 = ambient; first light
			// starts at float 8
			expect(writes[0].floats[0]).toBe(1);
			expect(writes[0].floats[4]).toBeCloseTo(0.1);
			expect(writes[0].floats[8]).toBe(100);
			expect(writes[0].floats[15]).toBe(9);
			expect(writes[1].floats[0]).toBe(0);
		});

		it("draws lit segments with the combined material and the light block", () => {
			const uploads = [];
			renderer.device.queue.copyExternalImageToTexture = (src, dst, size) => {
				uploads.push({ source: src.source, size });
			};
			const atlas = { name: "colors" };
			const normalMap = { width: 64, height: 64 };

			lit.setLightUniforms(packed());
			lit.addQuad(
				atlas,
				0,
				0,
				32,
				32,
				0,
				0,
				1,
				1,
				0xffffffff,
				false,
				normalMap,
			);
			lit.flush();

			// one indexed quad through group 1 (combined) + group 2 (lights)
			expect(renderer.calls.drawIndexed).toEqual([6]);
			const byIndex = new Map(
				renderer.calls.bindGroups.map((bind) => {
					return [bind.index, bind];
				}),
			);
			expect(byIndex.get(1).group.entries).toHaveLength(4);
			expect(byIndex.get(2).dynamicOffsets).toEqual([
				lit.lightBinding.dynamicOffset,
			]);
			// the normal map uploaded without premultiplication
			expect(uploads).toHaveLength(1);
		});

		it("normal maps re-upload only when their version stamp advances", () => {
			const uploads = [];
			renderer.device.queue.copyExternalImageToTexture = (src) => {
				uploads.push(src.source);
			};
			const source = { width: 8, height: 8, version: 1 };

			lit.residentNormalMap(source);
			lit.residentNormalMap(source);
			expect(uploads).toHaveLength(1);

			source.version = 2;
			lit.residentNormalMap(source);
			expect(uploads).toHaveLength(2);
		});

		it("stamps the light binding with the frame it was snapshotted in", () => {
			expect(lit.hasCurrentLightBinding(renderer.frameId)).toBe(false);
			lit.setLightUniforms(packed());
			expect(lit.hasCurrentLightBinding(renderer.frameId)).toBe(true);
			// the binding points into the per-frame arena — it must read as
			// absent once the frame advances past it
			expect(lit.hasCurrentLightBinding(renderer.frameId + 1)).toBe(false);
		});

		it("a version bump on a map already sampled this frame gets a fresh texture", () => {
			const retired = [];
			renderer.retireTexture = (texture) => {
				retired.push(texture);
			};
			const source = { width: 8, height: 8, version: 1 };

			const first = lit.residentNormalMap(source);
			source.version = 2;
			// same frame: an in-place re-upload would retroactively repaint
			// draws already recorded against the old pixels
			const second = lit.residentNormalMap(source);
			expect(second.texture).not.toBe(first.texture);
			expect(retired).toEqual([first.texture]);

			// across a frame boundary the resident texture re-uploads in place
			renderer.frameId++;
			source.version = 3;
			const third = lit.residentNormalMap(source);
			expect(third.texture).toBe(second.texture);
			expect(retired).toHaveLength(1);
		});

		it("reset() retires the resident normal maps and drops every lit cache", () => {
			const retired = [];
			renderer.retireTexture = (texture) => {
				retired.push(texture);
			};
			lit.setLightUniforms(packed());
			lit.addQuad(
				{ name: "colors" },
				0,
				0,
				32,
				32,
				0,
				0,
				1,
				1,
				0xffffffff,
				false,
				{
					width: 8,
					height: 8,
				},
			);
			lit.flush();
			const resident = [...lit.normalTextures.values()][0].texture;

			lit.reset();

			expect(retired).toContain(resident);
			expect(lit.normalTextures.size).toBe(0);
			expect(lit.litMaterials.size).toBe(0);
			expect(lit.lightBindGroups.size).toBe(0);
			expect(lit.lightBinding).toBeNull();
			expect(lit.hasCurrentLightBinding(renderer.frameId)).toBe(false);
		});

		it("clearMaterialCache drops the combined bind groups but keeps the resident maps", () => {
			lit.setLightUniforms(packed());
			lit.addQuad(
				{ name: "colors" },
				0,
				0,
				32,
				32,
				0,
				0,
				1,
				1,
				0xffffffff,
				false,
				{
					width: 8,
					height: 8,
				},
			);
			lit.flush();
			expect(lit.litMaterials.size).toBe(1);

			lit.clearMaterialCache();

			expect(lit.litMaterials.size).toBe(0);
			// textures stay resident — only the sampler pairing is rebuilt
			expect(lit.normalTextures.size).toBe(1);
		});

		it("a normal-map change flushes the pending segment", () => {
			lit.setLightUniforms(packed());
			const atlas = { name: "colors" };
			lit.addQuad(atlas, 0, 0, 32, 32, 0, 0, 1, 1, 0xffffffff, false, {
				width: 8,
				height: 8,
			});
			lit.addQuad(atlas, 32, 0, 32, 32, 0, 0, 1, 1, 0xffffffff, false, {
				width: 8,
				height: 8,
			});
			lit.flush();
			// two different normal-map sources → two segments of one quad each
			expect(renderer.calls.drawIndexed).toEqual([6, 6]);
		});
	});

	describe("WebGPURenderer.drawImage (lit-gate dispatch)", () => {
		const createStub = (overrides = {}) => {
			const added = [];
			const batcherNames = [];
			const litBatcher = {
				// a current-frame binding by default; tests stale it explicitly
				binding: { frameId: 1 },
				hasCurrentLightBinding(frameId) {
					return this.binding !== null && this.binding.frameId === frameId;
				},
			};
			return {
				added,
				batcherNames,
				litBatcher,
				settings: { subPixel: false },
				batchers: new Map([["litQuad", litBatcher]]),
				customShader: undefined,
				activeLightCount: 1,
				currentNormalMap: { width: 8, height: 8 },
				frameId: 1,
				setBatcher(name) {
					batcherNames.push(name);
					this.currentBatcher = {
						addQuad(...args) {
							added.push(args);
						},
					};
					return this.currentBatcher;
				},
				cache: {
					get() {
						return {
							getUVs() {
								return [0, 0, 1, 1];
							},
						};
					},
				},
				currentTint: new Color(255, 255, 255, 1),
				getGlobalAlpha() {
					return 1;
				},
				...overrides,
			};
		};
		const drawImage = WebGPURenderer.prototype.drawImage;
		const image = { width: 32, height: 32 };

		it("routes a normal-mapped sprite in a lit frame to the lit batcher", () => {
			const stub = createStub();
			drawImage.call(stub, image, 0, 0);
			expect(stub.batcherNames).toEqual(["litQuad"]);
			// the paired normal map rides along as the last addQuad argument
			expect(stub.added[0][11]).toBe(stub.currentNormalMap);
		});

		it("an active customShader wins over the lit gate (fast path, never silently dropped)", () => {
			const stub = createStub({ customShader: { id: "effect" } });
			drawImage.call(stub, image, 0, 0);
			expect(stub.batcherNames).toEqual(["quad"]);
			expect(stub.added[0][11]).toBeUndefined();
		});

		it("a stale (previous-frame) light binding disqualifies the lit path", () => {
			const stub = createStub();
			stub.litBatcher.binding.frameId = 0;
			drawImage.call(stub, image, 0, 0);
			expect(stub.batcherNames).toEqual(["quad"]);
		});

		it("stays on the quad batcher without lights, a normal map, or a lit tier", () => {
			const unlit = createStub({ activeLightCount: 0 });
			drawImage.call(unlit, image, 0, 0);
			expect(unlit.batcherNames).toEqual(["quad"]);

			const unmapped = createStub({ currentNormalMap: null });
			drawImage.call(unmapped, image, 0, 0);
			expect(unmapped.batcherNames).toEqual(["quad"]);

			const bare = createStub({ batchers: new Map() });
			drawImage.call(bare, image, 0, 0);
			expect(bare.batcherNames).toEqual(["quad"]);
		});
	});

	describe("WebGPURenderer.drawLight (state machine)", () => {
		it("adopts the radial effect for the quad, packing color+intensity into the tint, and restores the previous shader", () => {
			const added = [];
			const stub = {
				customShader: { id: "sprite-effect" },
				shaderLanguage: "wgsl",
				getLightAtlas: WebGPURenderer.prototype.getLightAtlas,
				setBatcher() {
					return {
						addQuad(...args) {
							added.push({ shader: stub.customShader, args });
						},
					};
				},
			};
			const light = {
				pos: { x: 10, y: 20 },
				width: 100,
				height: 80,
				color: new Color(255, 128, 0),
			};

			// RadialGradientEffect construction inside drawLight needs a
			// renderer with a shader language — the stub reports wgsl but has
			// no device, so the effect stays inert; the state machine is what
			// this pins
			WebGPURenderer.prototype.drawLight.call(stub, light);

			expect(added).toHaveLength(1);
			// the quad drew under the adopted light shader…
			expect(added[0].shader).toBe(stub.lightShader);
			// …and the previous customShader came back
			expect(stub.customShader).toEqual({ id: "sprite-effect" });
			// tint packs the light's color and intensity
			expect(added[0].args[9]).toBe(light.color.toUint32(1));
			// the shared 1×1 white atlas is reused across calls
			WebGPURenderer.prototype.drawLight.call(stub, light);
			expect(added[1].args[0]).toBe(added[0].args[0]);
		});
	});
});
