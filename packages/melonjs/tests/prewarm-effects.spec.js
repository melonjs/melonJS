import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShaderEffect } from "../src/index.js";
import {
	deletable,
	markContextLost,
} from "../src/video/webgl/buffer/deletable.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Two first-use costs that a preload looked like it covered and did not.
 *
 * Both were found by profiling INSIDE the frames that stuttered on a 3D
 * example, where they were the two largest entries: the teardown probes
 * ahead of shader compilation.
 */
describe("first-use costs a preload should have paid", () => {
	describe("a mesh-hosted effect's spliced variant", () => {
		let renderer;

		beforeAll(async () => {
			renderer = await getWebGLRenderer(256, 256);
		});

		afterAll(() => {
			releaseWebGLRenderer(renderer);
		});

		it("is built by prewarm, not on the frame the effect first draws", async (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			const effect = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color * 0.5; }",
			);

			batcher.shaderVariants.clear();
			await batcher.prewarm([effect]);

			// A ShaderEffect hosted on a mesh does not draw with the program
			// its asset compiled to — the body is spliced into the MESH
			// shader, which is a different program again. Both fog states,
			// because the splice inherits the fog define.
			const keys = [...batcher.shaderVariants.keys()];
			expect(keys).toContain(`effect|${effect._effectId}|0`);
			expect(keys).toContain(`effect|${effect._effectId}|1`);
			effect.destroy?.();
		});

		it("still builds on demand when prewarm never runs", async (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			const effect = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color * 0.25; }",
			);

			// prewarm is strictly ADDITIVE: a game that never preloads must
			// still get its program, merely later
			batcher.shaderVariants.clear();
			const shader = batcher.effectShaderFor(effect);
			expect(shader).not.toBeNull();
			effect.destroy?.();
		});
	});

	describe("deleting a GL object", () => {
		it("skips the synchronous is* probe until a context has been lost", () => {
			// `is*` queries block until the driver answers, and teardown runs
			// once per object, so a scene dropping a batch of retained meshes
			// paid a round trip for every buffer in it
			const gl = {
				isContextLost: () => {
					return false;
				},
			};
			let probed = 0;
			const probe = () => {
				probed++;
				return true;
			};

			expect(deletable(gl, probe, {})).toBe(true);
			expect(probed).toBe(0);

			// once a context has dropped something, a handle really may be
			// dead and deleting it would raise INVALID_OPERATION
			markContextLost(gl);
			expect(deletable(gl, probe, {})).toBe(true);
			expect(probed).toBe(1);
		});

		it("refuses while the context is lost, without probing", () => {
			const gl = {
				isContextLost: () => {
					return true;
				},
			};
			let probed = 0;
			expect(
				deletable(
					gl,
					() => {
						probed++;
						return true;
					},
					{},
				),
			).toBe(false);
			expect(probed).toBe(0);
		});

		it("honours the probe's answer for a handle that died with a context", () => {
			const gl = {
				isContextLost: () => {
					return false;
				},
			};
			markContextLost(gl);
			// the restored context is live, but this handle belonged to the
			// one that died — exactly what the probe exists to catch
			expect(
				deletable(
					gl,
					() => {
						return false;
					},
					{},
				),
			).toBe(false);
		});
	});
});
