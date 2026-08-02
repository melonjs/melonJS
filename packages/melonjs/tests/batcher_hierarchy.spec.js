import { describe, expect, it } from "vitest";
import {
	Batcher,
	PrimitiveBatcher,
	QuadBatcher,
	WebGLBatcher,
	WebGLRenderer,
	WebGPUBatcher,
	WebGPUPrimitiveBatcher,
	WebGPUQuadBatcher,
	WebGPURenderer,
} from "../src/index.js";

/**
 * The backend-neutral Batcher base class: both backends' batcher families
 * derive from it, so `renderer.addBatcher()` can accept a custom batcher
 * from either backend while guaranteeing the shared lifecycle interface.
 */
describe("Batcher hierarchy", () => {
	it("WebGL batchers derive from the neutral Batcher base", () => {
		expect(WebGLBatcher.prototype).toBeInstanceOf(Batcher);
		expect(QuadBatcher.prototype).toBeInstanceOf(WebGLBatcher);
		expect(PrimitiveBatcher.prototype).toBeInstanceOf(WebGLBatcher);
	});

	it("WebGPU batchers derive from the neutral Batcher base", () => {
		expect(WebGPUBatcher.prototype).toBeInstanceOf(Batcher);
		expect(WebGPUQuadBatcher.prototype).toBeInstanceOf(WebGPUBatcher);
		expect(WebGPUPrimitiveBatcher.prototype).toBeInstanceOf(WebGPUBatcher);
	});

	it("the base class defines the full lifecycle contract", () => {
		for (const hook of [
			"init",
			"bind",
			"unbind",
			"flush",
			"reset",
			"destroy",
		]) {
			expect(Batcher.prototype[hook]).toBeTypeOf("function");
		}
	});

	describe("addBatcher gates on the backend base class", () => {
		// a bare prototype-chain instance carries the instanceof identity
		// without needing a GPU/GL context to construct
		function bareRenderer(RendererClass) {
			const renderer = Object.create(RendererClass.prototype);
			renderer.batchers = new Map();
			return renderer;
		}

		it("the WebGL renderer rejects non-WebGL batchers up front", () => {
			const renderer = bareRenderer(WebGLRenderer);
			expect(() => {
				renderer.addBatcher({ flush() {} }, "custom");
			}).toThrow(/WebGLBatcher/);
			// a WebGPU batcher is a Batcher, but not one THIS backend can host
			expect(() => {
				renderer.addBatcher(Object.create(WebGPUBatcher.prototype), "custom");
			}).toThrow(/WebGLBatcher/);
		});

		it("the WebGPU renderer rejects non-WebGPU batchers up front", () => {
			const renderer = bareRenderer(WebGPURenderer);
			expect(() => {
				renderer.addBatcher({ flush() {} }, "custom");
			}).toThrow(/WebGPUBatcher/);
			expect(() => {
				renderer.addBatcher(Object.create(WebGLBatcher.prototype), "custom");
			}).toThrow(/WebGPUBatcher/);
		});

		it("matching batchers register, duplicate names throw", () => {
			const renderer = bareRenderer(WebGPURenderer);
			const batcher = Object.create(WebGPUQuadBatcher.prototype);
			renderer.addBatcher(batcher, "custom");
			expect(renderer.batchers.get("custom")).toBe(batcher);
			expect(() => {
				renderer.addBatcher(batcher, "custom");
			}).toThrow(/Invalid Batcher name/);
		});
	});
});
