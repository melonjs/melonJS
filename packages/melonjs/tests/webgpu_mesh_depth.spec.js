import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import { WebGPURenderer } from "../src/index.js";
import { resolveDepthOps } from "../src/video/webgpu/webgpu_renderer.js";

/**
 * The depth half of the shared depth-stencil attachment — the WebGPU
 * realization of the GL mesh path's single-depth-clear-per-target-per-frame
 * policy (#1480). The load/store resolution is a pure function, and the
 * arming sites run as real prototype methods over recording stubs, so the
 * whole policy is pinned without a GPU device.
 */
describe("WebGPU mesh depth policy", () => {
	describe("resolveDepthOps (pure)", () => {
		it("before any mesh ever draws, every pass keeps the original clear/discard pair", () => {
			// pure-2D applications must see byte-identical passes whether or
			// not a mesh path exists in the build — including when a clear
			// got armed by machinery shared with the mesh path
			expect(resolveDepthOps(false, false)).toEqual({
				depthLoadOp: "clear",
				depthStoreOp: "discard",
			});
			expect(resolveDepthOps(false, true)).toEqual({
				depthLoadOp: "clear",
				depthStoreOp: "discard",
			});
		});

		it("once the mesh path is active, an armed clear clears and stores", () => {
			expect(resolveDepthOps(true, true)).toEqual({
				depthLoadOp: "clear",
				depthStoreOp: "store",
			});
		});

		it("once the mesh path is active, an unarmed restart preserves depth", () => {
			// pass restarts that keep the target (captures, mask stencil
			// clears, ensurePass reopens) must not lose occlusion state —
			// the GL parity where the depth buffer survives mid-frame
			expect(resolveDepthOps(true, false)).toEqual({
				depthLoadOp: "load",
				depthStoreOp: "store",
			});
		});
	});

	describe("arming sites (real prototypes over stubs)", () => {
		it("setRenderTarget arms the depth clear in both directions", () => {
			const stub = {
				currentBatcher: { flush() {} },
				renderPass: null,
				currentRenderTarget: null,
				pendingColorClear: false,
				pendingClearValue: null,
				pendingStencilClear: false,
				pendingDepthClear: false,
			};
			const target = { colorView: {}, pendingClear: false };

			WebGPURenderer.prototype.setRenderTarget.call(stub, target);
			expect(stub.pendingDepthClear).toBe(true);

			// the return trip to the canvas re-arms too: the shared
			// attachment holds the offscreen target's depth, which is stale
			// data from the canvas's point of view
			stub.pendingDepthClear = false;
			WebGPURenderer.prototype.setRenderTarget.call(stub, null);
			expect(stub.pendingDepthClear).toBe(true);
		});

		it("depth-attachment recreation arms the clear; a same-size reuse does not", () => {
			const stub = {
				getCanvas() {
					return { width: 64, height: 48 };
				},
				depthTexture: null,
				pendingDepthClear: false,
				retired: [],
				retireTexture(texture) {
					this.retired.push(texture);
				},
				device: {
					createTexture({ size }) {
						return { width: size[0], height: size[1] };
					},
				},
			};

			// first creation: a fresh attachment read with "load" is zeros
			WebGPURenderer.prototype.createDepthTexture.call(stub, 64, 48);
			expect(stub.pendingDepthClear).toBe(true);

			// same size: early return, no re-arm
			stub.pendingDepthClear = false;
			WebGPURenderer.prototype.createDepthTexture.call(stub, 64, 48);
			expect(stub.pendingDepthClear).toBe(false);
			expect(stub.retired).toHaveLength(0);

			// size change: old attachment retires (recorded passes may
			// reference it) and the fresh one arms a clear
			const old = stub.depthTexture;
			WebGPURenderer.prototype.createDepthTexture.call(stub, 128, 48);
			expect(stub.pendingDepthClear).toBe(true);
			expect(stub.retired).toEqual([old]);
		});

		it("abandonFrame resets the armed clear with the rest of the pending state", () => {
			const stub = {
				renderPass: null,
				commandEncoder: null,
				frameTextureView: null,
				frameTexture: null,
				currentRenderTarget: null,
				pendingColorClear: true,
				pendingDepthClear: true,
				currentPipeline: null,
				destroyRetiredTextures() {},
			};
			WebGPURenderer.prototype.abandonFrame.call(stub);
			expect(stub.pendingDepthClear).toBe(false);
			expect(stub.pendingColorClear).toBe(false);
		});

		it("beginPass realizes the policy table end to end (real prototype)", () => {
			const passes = [];
			const stub = {
				commandEncoder: null,
				renderPass: null,
				currentRenderTarget: null,
				frameTextureView: null,
				frameTexture: null,
				pendingColorClear: false,
				pendingClearValue: null,
				pendingStencilClear: false,
				pendingDepthClear: false,
				meshDepthActive: false,
				depthTexture: null,
				currentPipeline: {},
				maskVisibleRef: 0,
				viewportRect: null,
				scissorActive: false,
				canvasSampleCount: 1,
				pipelineCache: {},
				retireTexture() {},
				applyScissor() {},
				applyViewport() {},
				getTargetSize() {
					return [64, 48];
				},
				getCanvas() {
					return { width: 64, height: 48 };
				},
				createDepthTexture: WebGPURenderer.prototype.createDepthTexture,
				beginPass: WebGPURenderer.prototype.beginPass,
				context: {
					getCurrentTexture() {
						return {
							createView() {
								return { canvas: true };
							},
						};
					},
				},
				device: {
					createCommandEncoder() {
						return {
							beginRenderPass(descriptor) {
								passes.push(descriptor);
								return {
									end() {},
									setViewport() {},
									setStencilReference() {},
								};
							},
						};
					},
					createTexture({ size }) {
						return {
							width: size[0],
							height: size[1],
							createView() {
								return { depth: true };
							},
						};
					},
				},
			};
			const depthOf = (i) => {
				return [
					passes[i].depthStencilAttachment.depthLoadOp,
					passes[i].depthStencilAttachment.depthStoreOp,
				];
			};

			// pre-mesh frames: byte-identical to the original ops, even
			// though the fresh depth texture armed a clear
			stub.beginPass();
			expect(depthOf(0)).toEqual(["clear", "discard"]);

			// the mesh path activates: an unarmed restart preserves depth
			stub.renderPass = null;
			stub.meshDepthActive = true;
			stub.pendingDepthClear = false;
			stub.beginPass();
			expect(depthOf(1)).toEqual(["load", "store"]);

			// an armed clear (frame start / target change) clears once…
			stub.renderPass = null;
			stub.pendingDepthClear = true;
			stub.beginPass();
			expect(depthOf(2)).toEqual(["clear", "store"]);
			// …and is consumed: the next restart loads again
			stub.renderPass = null;
			stub.beginPass();
			expect(depthOf(3)).toEqual(["load", "store"]);

			// a mask's stencil clear leaves depth loading (independent ops)
			stub.renderPass = null;
			stub.beginPass({ stencilLoadOp: "clear" });
			expect(passes[4].depthStencilAttachment.stencilLoadOp).toBe("clear");
			expect(depthOf(4)).toEqual(["load", "store"]);
		});

		it("retireBuffer parks on the retired list while a frame records, destroys otherwise", () => {
			const parked = [];
			const recording = {
				commandEncoder: {},
				retiredTextures: parked,
				retireTexture: WebGPURenderer.prototype.retireTexture,
			};
			const buffer = {
				destroyed: false,
				destroy() {
					this.destroyed = true;
				},
			};
			WebGPURenderer.prototype.retireBuffer.call(recording, buffer);
			expect(parked).toEqual([buffer]);
			expect(buffer.destroyed).toBe(false);

			const idle = {
				commandEncoder: null,
				retiredTextures: [],
				retireTexture: WebGPURenderer.prototype.retireTexture,
			};
			WebGPURenderer.prototype.retireBuffer.call(idle, buffer);
			expect(buffer.destroyed).toBe(true);
		});
	});

	describe("split-screen viewport (real prototypes over stubs)", () => {
		function makeViewportStub() {
			const applied = [];
			return {
				applied,
				flushed: 0,
				currentBatcher: {
					flush() {},
				},
				viewportRect: null,
				currentRenderTarget: null,
				renderPass: {
					setViewport(...args) {
						applied.push(args);
					},
				},
				getCanvas() {
					return { width: 640, height: 480 };
				},
				getTargetSize() {
					return [640, 480];
				},
				setViewport: WebGPURenderer.prototype.setViewport,
				applyViewport: WebGPURenderer.prototype.applyViewport,
			};
		}

		it("un-flips the GL bottom-left rect the cameras bake in", () => {
			const stub = makeViewportStub();
			// camera3d passes (x, canvasHeight - screenY - h, w, h) for a
			// camera at screen (10, 20) sized 320×240
			stub.setViewport(10, 480 - 20 - 240, 320, 240);
			expect(stub.viewportRect).toEqual({
				x: 10,
				y: 20,
				width: 320,
				height: 240,
			});
			expect(stub.applied).toEqual([[10, 20, 320, 240, 0, 1]]);
		});

		it("offscreen targets always render full size; the canvas rect returns after", () => {
			const stub = makeViewportStub();
			stub.setViewport(0, 240, 320, 240);
			stub.applied.length = 0;

			stub.currentRenderTarget = { colorView: {} };
			stub.applyViewport();
			expect(stub.applied).toEqual([[0, 0, 640, 480, 0, 1]]);

			stub.currentRenderTarget = null;
			stub.applyViewport();
			expect(stub.applied).toEqual([
				[0, 0, 640, 480, 0, 1],
				[0, 0, 320, 240, 0, 1],
			]);
		});

		it("clamps a stale rect after a canvas shrink (validation, not GL silent clip)", () => {
			const stub = makeViewportStub();
			stub.setViewport(500, 0, 320, 480);
			// the canvas "shrank": the stored rect now overflows the target
			stub.getTargetSize = () => {
				return [512, 480];
			};
			stub.applied.length = 0;
			stub.applyViewport();
			const [x, , width] = stub.applied[0];
			expect(x + width).toBeLessThanOrEqual(512);
		});
	});
});
