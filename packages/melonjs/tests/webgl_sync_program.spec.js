import { describe, expect, it, vi } from "vitest";
import WebGLBatcher from "../src/video/webgl/batchers/batcher.js";

/**
 * `WebGLBatcher.syncProgram` — the raw program rebind that heals
 * renderer/batcher program drift after an emitted ONCONTEXT_RESTORED
 * (every GLShader recompiles and binds itself to replay uniforms, leaving
 * a FOREIGN program bound while the renderer's `currentProgram` cache is
 * stale). Pure pointer-compare logic — pinned over a stub, no context.
 */
describe("WebGLBatcher.syncProgram", () => {
	const makeStub = (shaderProgram, rendererProgram) => {
		const shader = {
			program: shaderProgram,
			bind: vi.fn(),
		};
		return {
			stub: {
				currentShader: shader,
				renderer: { currentProgram: rendererProgram },
			},
			shader,
		};
	};

	it("rebinds when the renderer's program cache drifted (raw bind, no flush)", () => {
		const program = { id: "mine" };
		const { stub, shader } = makeStub(program, { id: "foreign" });
		WebGLBatcher.prototype.syncProgram.call(stub);
		expect(shader.bind).toHaveBeenCalledTimes(1);
		expect(stub.renderer.currentProgram).toBe(program);
	});

	it("also rebinds when the cache was invalidated (undefined)", () => {
		const program = { id: "mine" };
		const { stub, shader } = makeStub(program, undefined);
		WebGLBatcher.prototype.syncProgram.call(stub);
		expect(shader.bind).toHaveBeenCalledTimes(1);
		expect(stub.renderer.currentProgram).toBe(program);
	});

	it("no-ops in the steady state (pointer match) and with no shader", () => {
		const program = { id: "mine" };
		const { stub, shader } = makeStub(program, program);
		WebGLBatcher.prototype.syncProgram.call(stub);
		expect(shader.bind).not.toHaveBeenCalled();

		const bare = { currentShader: undefined, renderer: {} };
		expect(() => {
			WebGLBatcher.prototype.syncProgram.call(bare);
		}).not.toThrow();
	});
});
