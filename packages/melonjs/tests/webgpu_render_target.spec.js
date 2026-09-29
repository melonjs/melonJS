import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import RenderTargetPool from "../src/video/rendertarget/render_target_pool.js";
import WebGPURenderTarget from "../src/video/rendertarget/webgpurendertarget.js";
import { WebGPUFrameTexture } from "../src/video/webgpu/texture/frametexture.js";

/**
 * WebGPURenderTarget + the shared frame capture against a mock device:
 * texture lifecycle under the recording model (retire-not-destroy while a
 * frame records), generation-keyed bind-group invalidation, and the pool
 * wiring the post-effect chain relies on.
 */
describe("WebGPURenderTarget (mock device)", () => {
	let renderer;
	let created;

	beforeEach(() => {
		created = [];
		renderer = {
			preferredFormat: "bgra8unorm",
			retiredTextures: [],
			commandEncoder: null,
			device: {
				createTexture(descriptor) {
					const texture = {
						label: descriptor.label,
						size: descriptor.size,
						format: descriptor.format,
						sampleCount: descriptor.sampleCount ?? 1,
						destroyed: false,
						destroy() {
							this.destroyed = true;
						},
						createView() {
							return { texture: this };
						},
					};
					created.push(texture);
					return texture;
				},
				createBindGroup(descriptor) {
					return { entries: descriptor.entries };
				},
			},
			pipelineCache: { materialLayout: {} },
			textureStore: {
				getSampler(filter, repeat) {
					return { filter, repeat };
				},
			},
			retireTexture(texture) {
				if (this.commandEncoder !== null) {
					this.retiredTextures.push(texture);
				} else {
					texture.destroy();
				}
			},
			setRenderTarget(target) {
				this.currentRenderTarget = target;
			},
			currentRenderTarget: null,
		};
	});

	it("creates a renderable+sampleable color texture in the canvas format", () => {
		const rt = new WebGPURenderTarget(renderer, 320, 200);
		expect(rt.width).toBe(320);
		expect(created[0].size).toEqual([320, 200]);
		expect(rt.colorView).toBeDefined();
	});

	it("resize is a no-op at the same size, reallocates + bumps generation otherwise", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		const generation = rt.generation;
		rt.resize(64, 64);
		expect(created).toHaveLength(1);
		expect(rt.generation).toBe(generation);

		rt.resize(128, 64);
		expect(created).toHaveLength(2);
		expect(rt.generation).toBe(generation + 1);
		// no frame recording → the old texture is destroyed immediately
		expect(created[0].destroyed).toBe(true);
	});

	it("mid-frame resize/destroy RETIRE the texture instead of destroying it", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		renderer.commandEncoder = {};
		rt.resize(128, 128);
		expect(created[0].destroyed).toBe(false);
		expect(renderer.retiredTextures).toContain(created[0]);

		rt.destroy();
		expect(created[1].destroyed).toBe(false);
		expect(renderer.retiredTextures).toContain(created[1]);
		expect(rt.texture).toBeNull();
	});

	it("the material bind group is cached per generation", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		const first = rt.getMaterialBindGroup();
		expect(rt.getMaterialBindGroup()).toBe(first);
		// the blit source samples linearly, clamped
		expect(first.entries[1].resource).toEqual({
			filter: "linear",
			repeat: "no-repeat",
		});

		rt.resize(32, 32);
		expect(rt.getMaterialBindGroup()).not.toBe(first);
	});

	it("clear() defers to the next retarget (pendingClear flag)", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		rt.clear();
		expect(rt.pendingClear).toBe(true);
	});

	it("bind()/unbind() delegate to the renderer's retarget primitive", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		rt.bind();
		expect(renderer.currentRenderTarget).toBe(rt);
		rt.unbind();
		expect(renderer.currentRenderTarget).toBeNull();
	});

	it("getImageData throws with async guidance (WebGPU readback is async)", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		expect(() => {
			return rt.getImageData();
		}).toThrow(/readPixels/);
	});

	it("the render-target pool composes with the WebGPU factory (camera 0/1, sprite 2/3)", () => {
		const pool = new RenderTargetPool((w, h) => {
			return new WebGPURenderTarget(renderer, w, h);
		});
		const camera = pool.begin(true, 2, 100, 50);
		expect(camera).toBeInstanceOf(WebGPURenderTarget);
		expect(camera).toBe(pool.getCaptureTarget());
		expect(pool.getPingPongTarget()).not.toBe(camera);

		const sprite = pool.begin(false, 1, 100, 50);
		expect(sprite).not.toBe(camera);
		expect(pool.end()).toBe(camera);
		expect(pool.end()).toBeNull();
		pool.destroy();
	});

	it("takes the half-float format on both halves, or the resolve has nothing to resolve between", () => {
		// `hdr` moves the camera chain to rgba16float. The MSAA half has to
		// move with it: a resolve between attachments of different formats
		// is invalid, and the two are created in separate calls, which is
		// exactly the kind of pair that drifts.
		const rt = new WebGPURenderTarget(renderer, 64, 64, {
			format: "rgba16float",
			sampleCount: 4,
		});
		expect(rt.format).toBe("rgba16float");
		const halves = created.filter((t) => {
			return t.label.includes("render target");
		});
		expect(halves).toHaveLength(2);
		for (const half of halves) {
			expect(half.format).toBe("rgba16float");
		}
		// and the multisampled one is the multisampled one
		expect(
			halves.some((t) => {
				return t.sampleCount === 4;
			}),
		).toBe(true);
	});

	it("defaults to the surface format, which may be bgra", () => {
		const rt = new WebGPURenderTarget(renderer, 64, 64);
		// NOT a hardcoded rgba8unorm: on a bgra surface that would swap red
		// and blue in every composited frame
		expect(rt.format).toBe("bgra8unorm");
		expect(created[0].format).toBe("bgra8unorm");
	});

	it("the pool gives the camera pair the color format and sprite chains the surface one", () => {
		// the renderer's own factory, transcribed: only indices 0/1 take the
		// half-float format. A sprite chain's final blit composites with
		// ONE_MINUS_SRC_ALPHA, and additive blending accumulates alpha past
		// 1 in a float target, which would turn that factor negative and
		// subtract the backdrop.
		const colorFormat = "rgba16float";
		const pool = new RenderTargetPool((w, h, isCapture, index) => {
			return new WebGPURenderTarget(renderer, w, h, {
				format: index < 2 ? colorFormat : renderer.preferredFormat,
			});
		});
		pool.begin(true, 2, 64, 64);
		expect(pool.getCaptureTarget().format).toBe("rgba16float");
		expect(pool.getPingPongTarget().format).toBe("rgba16float");

		const sprite = pool.begin(false, 2, 64, 64);
		expect(sprite.format).toBe("bgra8unorm");
		pool.destroy();
	});

	it("a capture follows the format of what it captures FROM", () => {
		// `copyTextureToTexture` requires both sides to agree, so a capture
		// taken from a half-float camera target and one taken from the
		// canvas are not interchangeable
		const capture = new WebGPUFrameTexture(renderer, 64, 64, "rgba16float");
		expect(capture.format).toBe("rgba16float");
		expect(created[0].format).toBe("rgba16float");

		const first = capture.gpuTexture;
		capture.realloc(64, 64, "bgra8unorm");
		expect(capture.format).toBe("bgra8unorm");
		// reallocated, not refilled: the old storage cannot change format
		expect(capture.gpuTexture).not.toBe(first);
		expect(created[created.length - 1].format).toBe("bgra8unorm");
	});

	it("the shared frame capture reallocates by size and retires safely", () => {
		const capture = new WebGPUFrameTexture(renderer, 64, 64);
		expect(capture.isGPUResident).toBe(true);
		expect(capture.getTexture()).toBe(capture);
		expect(created[0].label).toContain("capture");

		renderer.commandEncoder = {};
		capture.destroy();
		expect(renderer.retiredTextures).toContain(created[0]);
		// idempotent
		expect(() => {
			return capture.destroy();
		}).not.toThrow();
	});
});
