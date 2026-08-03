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
