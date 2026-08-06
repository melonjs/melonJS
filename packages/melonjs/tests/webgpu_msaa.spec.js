import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import { WebGPURenderer } from "../src/index.js";
import WebGPURenderTarget from "../src/video/rendertarget/webgpurendertarget.js";
import WebGPUPipelineCache from "../src/video/webgpu/pipeline/cache.js";

/**
 * MSAA on the WebGPU backend (`antiAlias: true` → 4× passes):
 * canvas passes render into the shared multisampled color texture and
 * resolve into the canvas view; post-effect CAPTURE targets carry their
 * own per-target multisampled half (resolving into their sampleable
 * texture — so MSAA survives the offscreen detour, #1556); ping-pong
 * intermediates stay 1× (screen-aligned quads have no geometric edges);
 * the pipeline sample count is per-pass state owned by `beginPass`.
 */
function createMockDevice() {
	const pipelines = [];
	return {
		pipelines,
		createBindGroupLayout(d) {
			return { label: d.label };
		},
		createBindGroup(d) {
			return { label: d.label };
		},
		createShaderModule(d) {
			return { label: d.label };
		},
		createPipelineLayout() {
			return {};
		},
		createRenderPipeline(descriptor) {
			const pipeline = { descriptor };
			pipelines.push(pipeline);
			return pipeline;
		},
	};
}

function makePassStub({ canvasSampleCount = 4, target = null } = {}) {
	const passes = [];
	const created = [];
	return {
		passes,
		created,
		commandEncoder: null,
		renderPass: null,
		currentRenderTarget: target,
		frameTextureView: null,
		frameTexture: null,
		pendingColorClear: false,
		pendingClearValue: null,
		pendingStencilClear: false,
		pendingDepthClear: false,
		meshDepthActive: false,
		depthTexture: null,
		msaaColorTexture: null,
		msaaColorView: null,
		msaaDepthTexture: null,
		preferredFormat: "bgra8unorm",
		currentPipeline: {},
		maskVisibleRef: 0,
		viewportRect: null,
		scissorActive: false,
		canvasSampleCount,
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
		createMsaaColorTexture: WebGPURenderer.prototype.createMsaaColorTexture,
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
			createTexture(descriptor) {
				const texture = {
					width: descriptor.size[0],
					height: descriptor.size[1],
					sampleCount: descriptor.sampleCount ?? 1,
					label: descriptor.label,
					createView() {
						return { texture };
					},
				};
				created.push(texture);
				return texture;
			},
		},
	};
}

describe("WebGPU MSAA (antiAlias)", () => {
	it("sampleCount is a pipeline-key axis with the count in the descriptor", () => {
		const device = createMockDevice();
		const cache = new WebGPUPipelineCache(device, "bgra8unorm");
		cache.registerVertexLayout("quad", 28, [
			{ format: "float32x3", offset: 0 },
			{ format: "float32x2", offset: 12 },
			{ format: "unorm8x4", offset: 20 },
			{ format: "float32", offset: 24 },
		]);
		const single = cache.get("quad", "triangle-list", "normal", true);
		cache.sampleCount = 4;
		const multi = cache.get("quad", "triangle-list", "normal", true);
		expect(multi).not.toBe(single);
		expect(multi.descriptor.multisample.count).toBe(4);
		expect(single.descriptor.multisample.count).toBe(1);
	});

	it("a 4× canvas pass renders into the msaa texture and resolves into the canvas view", () => {
		const stub = makePassStub({ canvasSampleCount: 4 });
		stub.beginPass();

		const [descriptor] = stub.passes;
		const color = descriptor.colorAttachments[0];
		// the msaa texture is the attachment, the canvas view the resolve
		expect(color.view.texture).toBe(stub.msaaColorTexture);
		expect(color.resolveTarget).toEqual({ canvas: true });
		// samples persist across mid-frame restarts
		expect(color.storeOp).toBe("store");
		// the depth twin matches the color sample count
		expect(descriptor.depthStencilAttachment.view.texture).toBe(
			stub.msaaDepthTexture,
		);
		expect(stub.msaaDepthTexture.sampleCount).toBe(4);
		// pipeline lookups recorded into this pass must declare 4×
		expect(stub.pipelineCache.sampleCount).toBe(4);
	});

	it("1× target passes (ping-pong intermediates) stay single-sampled", () => {
		const stub = makePassStub({
			canvasSampleCount: 4,
			target: { colorView: { offscreen: true }, sampleCount: 1 },
		});
		stub.beginPass();

		const [descriptor] = stub.passes;
		const color = descriptor.colorAttachments[0];
		expect(color.view).toEqual({ offscreen: true });
		expect("resolveTarget" in color).toBe(false);
		expect(descriptor.depthStencilAttachment.view.texture).toBe(
			stub.depthTexture,
		);
		expect(stub.pipelineCache.sampleCount).toBe(1);
		expect(stub.msaaColorTexture).toBe(null);
	});

	it("a multisampled CAPTURE target renders into ITS OWN msaa half, resolving into its sampleable texture", () => {
		const colorView = { offscreen: true };
		const msaaView = { offscreenMsaa: true };
		const stub = makePassStub({
			canvasSampleCount: 4,
			target: { colorView, sampleCount: 4, msaaView },
		});
		stub.beginPass();

		const [descriptor] = stub.passes;
		const color = descriptor.colorAttachments[0];
		// the target's own multisampled half — NOT the shared canvas one
		// (nested effect brackets interleave passes on different targets; a
		// shared half would hand another target's stored samples to a
		// mid-frame load-back)
		expect(color.view).toBe(msaaView);
		expect(color.resolveTarget).toBe(colorView);
		expect(color.storeOp).toBe("store");
		expect(stub.msaaColorTexture).toBe(null);
		// the msaa depth twin serves this pass, and pipelines declare 4×
		expect(descriptor.depthStencilAttachment.view.texture).toBe(
			stub.msaaDepthTexture,
		);
		expect(stub.pipelineCache.sampleCount).toBe(4);
	});

	it("antiAlias off keeps the exact single-sample pass shape (regression pin)", () => {
		const stub = makePassStub({ canvasSampleCount: 1 });
		stub.beginPass();

		const [descriptor] = stub.passes;
		const color = descriptor.colorAttachments[0];
		expect(color.view).toEqual({ canvas: true });
		expect("resolveTarget" in color).toBe(false);
		expect(stub.msaaColorTexture).toBe(null);
		expect(stub.pipelineCache.sampleCount).toBe(1);
	});

	it("the msaa attachments track size changes with retirement, arming the depth clear", () => {
		const stub = makePassStub({ canvasSampleCount: 4 });
		const retired = [];
		stub.retireTexture = (texture) => {
			retired.push(texture);
		};
		stub.beginPass();
		const firstColor = stub.msaaColorTexture;
		const firstDepth = stub.msaaDepthTexture;

		// same size: both re-used
		stub.renderPass = null;
		stub.beginPass();
		expect(stub.msaaColorTexture).toBe(firstColor);
		expect(stub.msaaDepthTexture).toBe(firstDepth);

		// canvas grew: both recreate, old pair retires, depth clear armed
		stub.getTargetSize = () => {
			return [128, 48];
		};
		stub.renderPass = null;
		stub.pendingDepthClear = false;
		stub.beginPass();
		expect(stub.msaaColorTexture).not.toBe(firstColor);
		expect(retired).toContain(firstColor);
		expect(retired).toContain(firstDepth);
		// consumed by the very pass that armed it
		expect(stub.passes[2].depthStencilAttachment.depthLoadOp).toBe("clear");
	});
});

describe("WebGPURenderTarget with a sample count (mock device)", () => {
	let renderer;
	let created;

	beforeEach(() => {
		created = [];
		renderer = {
			preferredFormat: "bgra8unorm",
			retired: [],
			device: {
				createTexture(descriptor) {
					const texture = {
						descriptor,
						createView() {
							return { texture };
						},
					};
					created.push(texture);
					return texture;
				},
			},
			retireTexture(texture) {
				this.retired.push(texture);
			},
		};
	});

	it("sampleCount > 1 allocates the per-target msaa half as a pure render attachment", () => {
		const rt = new WebGPURenderTarget(renderer, 320, 200, { sampleCount: 4 });
		expect(rt.sampleCount).toBe(4);
		expect(created).toHaveLength(2);
		const [color, msaa] = created.map((t) => {
			return t.descriptor;
		});
		// the sampleable half is unchanged by MSAA
		expect(color.sampleCount).toBeUndefined();
		// the msaa half: same size/format, never sampled or copied — samples
		// only ever leave it through the pass resolve
		expect(msaa.sampleCount).toBe(4);
		expect(msaa.size).toEqual([320, 200]);
		expect(msaa.format).toBe("bgra8unorm");
		expect(msaa.usage).toBe(GPUTextureUsage.RENDER_ATTACHMENT);
		expect(rt.msaaView.texture).toBe(created[1]);
	});

	it("resize retires BOTH halves and recreates them at the new size", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64, { sampleCount: 4 });
		const [oldColor, oldMsaa] = created;
		rt.resize(128, 32);
		expect(renderer.retired).toContain(oldColor);
		expect(renderer.retired).toContain(oldMsaa);
		expect(created).toHaveLength(4);
		expect(created[3].descriptor.size).toEqual([128, 32]);
		expect(created[3].descriptor.sampleCount).toBe(4);
	});

	it("destroy retires the msaa half too (recorded draws may still reference it)", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64, { sampleCount: 4 });
		rt.destroy();
		expect(renderer.retired).toHaveLength(2);
		expect(rt.msaaTexture).toBe(null);
		expect(rt.msaaView).toBe(null);
	});

	it("the default sample count is 1 with no msaa half at all (regression pin)", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		expect(rt.sampleCount).toBe(1);
		expect(rt.msaaTexture).toBe(null);
		expect(created).toHaveLength(1);
	});
});
