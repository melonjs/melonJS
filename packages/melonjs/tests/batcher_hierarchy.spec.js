import { describe, expect, it } from "vitest";
import {
	Batcher,
	PrimitiveBatcher,
	QuadBatcher,
	WebGLBatcher,
	WebGPUBatcher,
	WebGPUPrimitiveBatcher,
	WebGPUQuadBatcher,
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
});
