import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultApplicationSettings } from "../src/application/defaultApplicationSettings.ts";
import { Application, boot, loader, video } from "../src/index.js";
import WebGLBatcher from "../src/video/webgl/batchers/batcher.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * `renderer.prewarm()` — building the backend's shader programs while a
 * loading screen is up, rather than on the frame a scene first draws.
 *
 * The contract that matters most here is the one that is easy to break
 * silently: prewarm is strictly ADDITIVE. Every lazy path must still build on
 * demand when it never runs, or a game that does not preload stops working
 * rather than merely starting slower.
 */
describe("renderer.prewarm()", () => {
	describe("the default", () => {
		it("is on", () => {
			// the cost is paid where nothing waits on a frame: a purely 2D
			// game links the eleven mesh-tier programs it never binds, about
			// 60ms on a fast desktop GPU, inside a preload already showing a
			// progress bar. The flag stays as an escape hatch for targets
			// where linking is slow enough that the preload itself suffers
			expect(defaultApplicationSettings.prewarm).toBe(true);
		});
	});

	describe("on a backend with nothing to compile", () => {
		let app;

		beforeAll(async () => {
			boot();
			app = new Application(200, 200, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
			await app.init();
		});

		afterAll(() => {
			app?.destroy();
		});

		it("resolves, rather than throwing or returning undefined", async () => {
			// the base class no-op: a Canvas game must be able to switch
			// `prewarm` on without the preload failing
			const result = app.renderer.prewarm();
			expect(result).toBeInstanceOf(Promise);
			await expect(result).resolves.toBeUndefined();
		});

		it("is safe to call repeatedly", async () => {
			await app.renderer.prewarm();
			await expect(app.renderer.prewarm()).resolves.toBeUndefined();
		});
	});

	describe("on WebGL", () => {
		let renderer;

		beforeAll(async () => {
			renderer = await getWebGLRenderer(256, 256);
		});

		afterAll(() => {
			releaseWebGLRenderer();
		});

		/**
		 * @returns {object} the mesh batcher, which owns the lazy variants
		 */
		const meshBatcher = () => {
			return renderer.batchers.get("mesh");
		};

		it("builds every variant the mesh batcher can reach", async (ctx) => {
			if (renderer === null || renderer === undefined) {
				ctx.skip();
			}
			const batcher = meshBatcher();
			batcher.shaderVariants.clear();
			await batcher.prewarm();

			// fog × {plain, 4 instance-record shapes, ground shadow}; the
			// unfogged plain mesh program is `defaultShader`, built in the
			// constructor, so it is not in this map
			const keys = [...batcher.shaderVariants.keys()].sort();
			expect(keys).toEqual(
				[
					"mesh|fog",
					"instanced|0",
					"instanced|1",
					"instanced|2",
					"instanced|3",
					"instanced|4",
					"instanced|5",
					"instanced|6",
					"instanced|7",
					"shadow",
					"shadow|fog",
				].sort(),
			);
		});

		it("forgets it warmed once the context is restored", async (ctx) => {
			if (renderer === null || renderer === undefined) {
				ctx.skip();
			}
			// the programs died with the old context. Leaving the memo set
			// would have `prewarm()` report the work done for the rest of the
			// session, silently putting every variant back on the first-draw
			// path — no error, just the feature quietly off
			const first = renderer.prewarm();
			await first;
			renderer.onContextRestoredInvalidate(renderer);
			expect(renderer._prewarmed).toBeUndefined();
			const second = renderer.prewarm();
			expect(second).not.toBe(first);
			await second;
		});

		it("warms the keys the DRAW path actually asks for", async (ctx) => {
			if (renderer === null || renderer === undefined) {
				ctx.skip();
			}
			// `prewarm()` enumerates its variant keys and #defines by hand,
			// duplicating what `meshShader()`, `instancedShaderFor()` and
			// `instancedShadowShader()` build for real. If those drift apart it
			// fails silently: prewarm fills keys nothing will ever ask for, the
			// draw path compiles its own on first use, and the stall is back
			// with every test still green.
			//
			// So assert through the REAL entry points rather than by writing
			// the keys out a third time: after a prewarm, nothing the draw path
			// asks for may add to the map.
			const batcher = meshBatcher();
			const fog = renderer._fog3d;
			try {
				batcher.shaderVariants.clear();
				await batcher.prewarm();
				const warmed = batcher.shaderVariants.size;

				for (const fogState of [null, {}]) {
					renderer._fog3d = fogState;
					batcher.meshShader();
					batcher.instancedShadowShader();
					for (const hasColor of [false, true]) {
						for (const hasData of [false, true]) {
							batcher.instancedShaderFor({ hasColor, hasData });
						}
					}
				}
				expect(batcher.shaderVariants.size).toBe(warmed);
			} finally {
				renderer._fog3d = fog;
			}
		});

		it("returns the same promise rather than compiling twice", async (ctx) => {
			if (renderer === null || renderer === undefined) {
				ctx.skip();
			}
			const first = renderer.prewarm();
			const second = renderer.prewarm();
			expect(second).toBe(first);
			await first;
		});

		it("leaves the lazy path intact — a variant still builds on demand", async (ctx) => {
			if (renderer === null || renderer === undefined) {
				ctx.skip();
			}
			// the regression that would matter: prewarm must POPULATE the
			// cache the draw path reads, never replace or gate it. A game
			// that does not preload has to keep working
			const batcher = meshBatcher();
			batcher.shaderVariants.clear();
			expect(batcher.shaderVariants.has("mesh|fog")).toBe(false);
			const built = batcher.shaderVariant(
				"mesh|fog",
				batcher._shaderSources(),
				"#define FOG\n",
				"#define FOG\n",
			);
			expect(built).toBeDefined();
			expect(batcher.shaderVariants.get("mesh|fog")).toBe(built);
		});

		it("hands a warmed variant back to the draw path", async (ctx) => {
			if (renderer === null || renderer === undefined) {
				ctx.skip();
			}
			const batcher = meshBatcher();
			batcher.shaderVariants.clear();
			await batcher.prewarm();
			const warmed = batcher.shaderVariants.get("instanced|0");
			// the same object the lazy lookup would return — a prewarm that
			// built a DIFFERENT program would leave the stall in place and
			// waste the one it built
			expect(
				batcher.shaderVariant(
					"instanced|0",
					batcher._instancedShaderSources(),
					"",
					"",
				),
			).toBe(warmed);
		});
	});

	describe("a batcher with no lazy variants", () => {
		it("resolves without doing anything", async () => {
			// every batcher but the mesh one builds its single program in its
			// constructor, so the renderer can call this on all of them
			const noop = WebGLBatcher.prototype.prewarm.call({});
			expect(noop).toBeInstanceOf(Promise);
			await expect(noop).resolves.toBeUndefined();
		});
	});

	describe("the preloader hook", () => {
		let app;

		beforeAll(async () => {
			boot();
			app = new Application(200, 200, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
			await app.init();
		});

		afterAll(() => {
			app?.destroy();
			app.settings.prewarm = false;
		});

		it("does not warm when the setting is turned off", async () => {
			app.settings.prewarm = false;
			let called = 0;
			const real = app.renderer.prewarm.bind(app.renderer);
			app.renderer.prewarm = () => {
				called++;
				return real();
			};
			try {
				await loader.preload([], undefined, false);
			} finally {
				app.renderer.prewarm = real;
			}
			expect(called).toBe(0);
		});

		it("warms before completion is announced, when the setting is on", async () => {
			// ordering is the point: LOADER_COMPLETE is what the loading
			// screen and the game react to, so warming after it would be
			// warming with nothing left on screen
			app.settings.prewarm = true;
			const order = [];
			const real = app.renderer.prewarm.bind(app.renderer);
			app.renderer.prewarm = () => {
				order.push("prewarm");
				return real();
			};
			try {
				await loader.preload(
					[],
					() => {
						order.push("complete");
					},
					false,
				);
			} finally {
				app.renderer.prewarm = real;
				app.settings.prewarm = false;
			}
			expect(order).toEqual(["prewarm", "complete"]);
		});

		it("never fails a preload because the warm-up failed", async () => {
			// the frame it would have saved is not worth a game that cannot
			// start, so a throwing prewarm is swallowed
			app.settings.prewarm = true;
			const real = app.renderer.prewarm.bind(app.renderer);
			app.renderer.prewarm = () => {
				return Promise.reject(new Error("driver said no"));
			};
			try {
				await expect(
					loader.preload([], undefined, false),
				).resolves.toBeUndefined();
			} finally {
				app.renderer.prewarm = real;
				app.settings.prewarm = false;
			}
		});
	});
});
