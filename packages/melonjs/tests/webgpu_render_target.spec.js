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
