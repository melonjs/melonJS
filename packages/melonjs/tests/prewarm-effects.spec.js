import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Mesh, ShaderEffect } from "../src/index.js";
import { shaderList } from "../src/loader/cache.js";
import state from "../src/state/state.ts";
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

	describe("a second preload's effects", () => {
		let renderer;

		beforeAll(async () => {
			renderer = await getWebGLRenderer(256, 256);
		});

		afterAll(() => {
			for (const name of ["firstLevel", "secondLevel"]) {
				shaderList[name]?.destroy?.();
				delete shaderList[name];
			}
			releaseWebGLRenderer(renderer);
		});

		it("are warmed by that preload, not only the first one's", async (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			// what the loader leaves behind for two `{type: "shader"}` assets,
			// one per level
			shaderList.firstLevel = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color * 0.4; }",
			);
			await renderer.prewarm();
			shaderList.secondLevel = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color * 0.6; }",
			);
			await renderer.prewarm();
			// the regression: the whole call was memoized, so the second
			// level's effect went back to being built on its first draw
			const id = shaderList.secondLevel._effectId;
			expect(batcher.shaderVariants.has(`effect|${id}|0`)).toBe(true);
			expect(batcher.shaderVariants.has(`effect|${id}|1`)).toBe(true);
		});

		it("does not rebuild the batchers' own variants on every preload", async (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			await renderer.prewarm();
			const fog = batcher.shaderVariants.get("mesh|fog");
			// a later preload with nothing new reuses the warm-up it already did
			const again = renderer.prewarm();
			await again;
			expect(batcher.shaderVariants.get("mesh|fog")).toBe(fog);
			expect(renderer.prewarm()).toBe(again);
		});
	});

	describe("warming at attach time", () => {
		let renderer;

		beforeAll(async () => {
			renderer = await getWebGLRenderer(256, 256);
		});

		afterAll(() => {
			releaseWebGLRenderer(renderer);
		});

		const quadMesh = () => {
			return new Mesh(0, 0, {
				vertices: new Float32Array([
					-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
				]),
				uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
				width: 32,
				height: 32,
			});
		};

		/** let the warm-up's microtask and its link slices run */
		const settle = async () => {
			for (let i = 0; i < 5; i++) {
				await new Promise((resolve) => {
					setTimeout(resolve, 0);
				});
			}
		};

		it("links a mesh host's spliced program before it first draws", async (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			const mesh = quadMesh();
			const effect = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color * 0.3; }",
			);
			mesh.addPostEffect(effect);
			const key = `effect|${effect._effectId}|0`;
			// not inside the caller's code: it may still be configuring the mesh
			expect(batcher.shaderVariants.has(key)).toBe(false);
			await settle();
			expect(batcher.shaderVariants.has(key)).toBe(true);
			mesh.destroy();
		});

		it("links the variant for the fog the stage's camera will draw with", async (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			// Between frames the renderer still holds the fog of the camera
			// that drew LAST, which after a state change is the previous
			// screen's: none. The new stage's camera has fog, and installs it
			// only once it starts drawing.
			const held = renderer._fog3d;
			renderer._fog3d = null;
			const current = vi.spyOn(state, "current").mockReturnValue({
				cameras: new Map([
					[
						"default",
						{
							_fog3dState() {
								return { mode: 1 };
							},
						},
					],
				]),
			});
			let mesh;
			let effect;
			try {
				mesh = quadMesh();
				effect = new ShaderEffect(
					renderer,
					"vec4 apply(vec4 color, vec2 uv) { return color * 0.6; }",
				);
				mesh.addPostEffect(effect);
				// flushed here, while the stage is the mocked one: the fog is
				// read when the links are queued, and a frame drawn under the
				// mock would hand the game loop a stage it cannot update
				renderer._flushWarm();
			} finally {
				current.mockRestore();
				renderer._fog3d = held;
			}
			await settle();
			// the fogged splice, which is the one the draw will ask for
			expect(batcher.shaderVariants.has(`effect|${effect._effectId}|1`)).toBe(
				true,
			);
			expect(batcher.shaderVariants.has(`effect|${effect._effectId}|0`)).toBe(
				false,
			);
			mesh.destroy();
		});

		it("is what a state change waits on before it draws", async (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			const meshes = [quadMesh(), quadMesh()];
			const effects = meshes.map((mesh, i) => {
				const effect = new ShaderEffect(
					renderer,
					`vec4 apply(vec4 color, vec2 uv) { return color * 0.${i + 1}5; }`,
				);
				mesh.addPostEffect(effect);
				return effect;
			});
			const keys = effects.map((effect) => {
				return `effect|${effect._effectId}|0`;
			});
			// a clock that runs out after every link (the slice checks its 4ms
			// budget before each one), so the two are linked in separate tasks
			// and the wait has to outlast both
			let clock = 0;
			const now = vi
				.spyOn(globalThis.performance, "now")
				.mockImplementation(() => {
					clock += 3;
					return clock;
				});
			try {
				const ready = renderer._whenWarmed();
				expect(ready).toBeInstanceOf(Promise);
				// queued, not linked inside the switch
				expect(
					keys.some((key) => {
						return batcher.shaderVariants.has(key);
					}),
				).toBe(false);
				await ready;
			} finally {
				now.mockRestore();
			}
			for (const key of keys) {
				expect(batcher.shaderVariants.has(key)).toBe(true);
			}
			// and with all of them linked, nothing is left to wait on
			expect(renderer._whenWarmed()).toBeUndefined();
			for (const mesh of meshes) {
				mesh.destroy();
			}
		});

		it("puts back the program it found bound", (ctx) => {
			// linking leaves the new program bound, and a batcher trusts what it
			// last bound: left alone, the next draw would use a stranger's.
			// Driven by hand rather than by waiting, so no frame of the running
			// application can rebind in between and hide the difference.
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			const mesh = quadMesh();
			const effect = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color * 0.7; }",
			);
			mesh.postEffects.push(effect);
			renderer.setBatcher("quad");
			const bound = renderer.currentProgram;
			renderer._warmPostEffects(mesh);
			renderer._linkQueuedMeshEffects();
			expect(batcher.shaderVariants.has(`effect|${effect._effectId}|0`)).toBe(
				true,
			);
			expect(renderer.currentProgram).toBe(bound);
			expect(renderer.gl.getParameter(renderer.gl.CURRENT_PROGRAM)).toBe(bound);
			mesh.destroy();
		});

		it("makes a chain's render targets ahead of its first pass", async (ctx) => {
			requireWebGL(ctx, renderer);
			renderer._renderTargetPool.destroy();
			const camera = {
				postEffects: [{ enabled: true }, { enabled: false }],
				_postEffectManaged: true,
			};
			renderer._warmPostEffects(camera);
			// the capture target and, for the disabled second effect, the
			// ping-pong it will need the moment it is switched on
			expect(renderer._renderTargetPool._pool[0]).toBeDefined();
			expect(renderer._renderTargetPool._pool[1]).toBeDefined();
		});

		it("builds the advanced blend shader and target ahead of their first draw", async (ctx) => {
			requireWebGL(ctx, renderer);
			renderer.setBatcher("quad");
			const bound = renderer.currentProgram;
			renderer._warmAdvancedBlend();
			expect(renderer._advancedBlendEffect).toBeDefined();
			expect(renderer._advancedBlendTarget).toBeDefined();
			expect(renderer.currentProgram).toBe(bound);
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
