import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { game as gameFromModule } from "../src/application/application.ts";
import {
	Application,
	BuiltinAdapter,
	boot,
	CanvasRenderer,
	Container,
	game,
	Renderable,
	state,
	Vector2d,
	video,
} from "../src/index.js";
import { initialized } from "../src/system/bootstrap.ts";

describe("Application", () => {
	let app;
	describe("class existence", () => {
		it("Application class should be exported", () => {
			expect(Application).toBeDefined();
			expect(typeof Application).toBe("function");
		});
	});

	describe("default game instance", () => {
		beforeAll(async () => {
			boot();
			app = new Application(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
			await app.init();
		});

		it("game is an instance of Application", () => {
			expect(game).toBeInstanceOf(Application);
		});

		it("isInitialized should be true after boot and video.init", () => {
			expect(app.isInitialized).toBe(true);
		});

		it("renderer should be created after init", () => {
			expect(app.renderer).toBeDefined();
		});

		it("world should be created after init", () => {
			expect(app.world).toBeDefined();
		});

		it("parentElement should be set after init", () => {
			expect(app.parentElement).toBeDefined();
			expect(app.parentElement).toBeInstanceOf(globalThis.HTMLElement);
		});
	});

	describe("default property values", () => {
		it("mergeGroup should default to true", () => {
			expect(app.mergeGroup).toBe(true);
		});

		it("pauseOnBlur should default to true", () => {
			expect(app.pauseOnBlur).toBe(true);
		});

		it("resumeOnFocus should default to true", () => {
			expect(app.resumeOnFocus).toBe(true);
		});

		it("stopOnBlur should default to false", () => {
			expect(app.stopOnBlur).toBe(false);
		});

		it("isDirty should default to true", () => {
			expect(app.isDirty).toBe(true);
		});
	});

	describe("settings", () => {
		it("settings.width should match the value passed to video.init", () => {
			expect(app.settings.width).toBe(800);
		});

		it("settings.height should match the value passed to video.init", () => {
			expect(app.settings.height).toBe(600);
		});
	});

	describe("standalone Application instance", () => {
		it("should be constructable with width, height, and options", async () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
			expect(app).toBeInstanceOf(Application);
			expect(app.isInitialized).toBe(true);
			expect(app.settings.width).toBe(320);
			expect(app.settings.height).toBe(240);
			expect(app.renderer).toBeDefined();
			expect(app.world).toBeDefined();
		});
	});

	describe("the frame boundary resets the screen-space bracket", () => {
		it("clears it every draw, so an unbalanced overlay cannot wedge the transparent pass", async () => {
			// `Container.draw` opens the screen-space bracket around a floating
			// child with no `finally`, so a child that throws leaves it open —
			// and while it is open every drain of the transparent queue is
			// skipped. Without this the pass stays dead until the next STAGE
			// CHANGE (the only thing that calls `renderer.reset()`), silently,
			// with the queue growing every frame.
			boot();
			const app = new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
			try {
				app.renderer.beginScreenSpace(); // ...and never closed
				expect(app.renderer._screenSpaceDepth).toBe(1);
				app.isDirty = true;
				app.draw();
				expect(app.renderer._screenSpaceDepth).toBe(0);
			} finally {
				app.destroy();
			}
		});
	});

	describe("physics startup banner", () => {
		it("reports the built-in adapter via its stable physicLabel, not a class name", async () => {
			boot();
			const spy = vi.spyOn(console, "log").mockImplementation(() => {});
			try {
				// consoleHeader defaults to true, so the banner is emitted
				const app = new Application(64, 64, {
					parent: "screen",
					renderer: video.CANVAS,
				});
				await app.init();
				expect(app).toBeInstanceOf(Application);
				const lines = spy.mock.calls.map((args) => {
					return args.join(" ");
				});
				// must use the physicLabel ("builtin"), never constructor.name —
				// which is mangled (e.g. "ry") in minified builds
				expect(lines).toContain("physics: builtin");
			} finally {
				spy.mockRestore();
			}
		});
	});

	describe("repaint / sortOn", () => {
		it("repaint() should set isDirty to true", () => {
			app.isDirty = false;
			app.repaint();
			expect(app.isDirty).toBe(true);
		});

		it("sortOn getter/setter should delegate to world.sortOn", () => {
			app.sortOn = "z";
			expect(app.sortOn).toBe("z");
			expect(app.world.sortOn).toBe("z");
		});
	});

	describe("auto-bootstrap", async () => {
		it("initialized flag should be true after boot()", () => {
			expect(initialized).toBe(true);
		});

		it("new Application() + await app.init() should initialize when boot() already called", async () => {
			const app = new Application(160, 120, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
			expect(app).toBeInstanceOf(Application);
			expect(app.isInitialized).toBe(true);
			expect(app.renderer).toBeDefined();
			expect(app.world).toBeDefined();
			expect(initialized).toBe(true);
		});
	});

	describe("game singleton", () => {
		it("game exported from index should be the same as from application module", () => {
			expect(game).toBe(gameFromModule);
		});

		it("game should be an Application instance", () => {
			expect(game).toBeInstanceOf(Application);
		});

		it("game resolves to the most recently initialized Application", async () => {
			const app = new Application(96, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			// `setDefaultGame` runs at the END of init(), so a
			// constructed-but-not-initialized app is never published
			expect(game).not.toBe(app);
			await app.init();
			expect(game).toBe(app);
			expect(game.isInitialized).toBe(true);
		});

		it("game.world should be accessible", () => {
			expect(game.world).toBeDefined();
		});

		it("game.renderer should be accessible", () => {
			expect(game.renderer).toBeDefined();
		});
	});

	describe("multiple Application instances", () => {
		it("should have independent settings, worlds, and renderers", async () => {
			const app1 = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app1.init();
			const app2 = new Application(640, 480, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app2.init();

			expect(app1).not.toBe(app2);
			expect(app1.settings.width).toBe(320);
			expect(app2.settings.width).toBe(640);
			expect(app1.world).not.toBe(app2.world);
			expect(app1.renderer).not.toBe(app2.renderer);
		});
	});

	describe("physic setting resolves to an adapter", () => {
		it("default (no setting) → BuiltinAdapter, world.physic === 'builtin'", async () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
			expect(app.world.adapter).toBeInstanceOf(BuiltinAdapter);
			expect(app.world.physic).toBe("builtin");
		});

		it("'builtin' string → BuiltinAdapter, world.physic === 'builtin'", async () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
				physic: "builtin",
			});
			await app.init();
			expect(app.world.adapter).toBeInstanceOf(BuiltinAdapter);
			expect(app.world.physic).toBe("builtin");
		});

		it("'none' string → BuiltinAdapter still attached, world.physic === 'none'", async () => {
			// "none" disables stepping but keeps an adapter so any code
			// touching world.adapter doesn't crash
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
				physic: "none",
			});
			await app.init();
			expect(app.world.adapter).toBeInstanceOf(BuiltinAdapter);
			expect(app.world.physic).toBe("none");
		});

		it("PhysicsAdapter instance → used directly", async () => {
			const custom = new BuiltinAdapter({ gravity: new Vector2d(0, 0.3) });
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
				physic: custom,
			});
			await app.init();
			expect(app.world.adapter).toBe(custom);
			expect(app.world.gravity.y).toEqual(0.3);
			expect(app.world.physic).toBe("builtin");
		});

		it("{ adapter } object → forwarded to the world", async () => {
			const custom = new BuiltinAdapter({ gravity: new Vector2d(0, 0.7) });
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
				physic: { adapter: custom },
			});
			await app.init();
			expect(app.world.adapter).toBe(custom);
			expect(app.world.gravity.y).toEqual(0.7);
			expect(app.world.physic).toBe("builtin");
		});

		it("custom adapter's `physicLabel` propagates to world.physic", async () => {
			// A third-party adapter declares its own identifier. We don't
			// have a full custom-adapter implementation here, just an
			// object that satisfies the minimum the wiring touches.
			const customAdapter = Object.assign(
				new BuiltinAdapter({ gravity: new Vector2d(0, 0.5) }),
				{ physicLabel: "stub" },
			);
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
				physic: customAdapter,
			});
			await app.init();
			expect(app.world.adapter).toBe(customAdapter);
			expect(app.world.physic).toBe("stub");
		});

		it("adapter without `physicLabel` falls back to 'builtin'", async () => {
			// Legacy / third-party adapters that predate the field. We strip
			// `physicLabel` from a BuiltinAdapter instance to simulate.
			const legacyAdapter = new BuiltinAdapter();
			delete legacyAdapter.physicLabel;
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
				physic: legacyAdapter,
			});
			await app.init();
			expect(app.world.adapter).toBe(legacyAdapter);
			expect(app.world.physic).toBe("builtin");
		});

		it("each Application instance gets its own adapter (no sharing)", async () => {
			const app1 = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app1.init();
			const app2 = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app2.init();
			expect(app1.world.adapter).not.toBe(app2.world.adapter);
		});
	});

	describe("canvas getter", () => {
		it("should return the renderer canvas element", () => {
			expect(app.canvas).toBeDefined();
			expect(app.canvas).toBeInstanceOf(globalThis.HTMLCanvasElement);
			expect(app.canvas).toBe(app.renderer.getCanvas());
		});
	});

	describe("resize()", () => {
		it("should not throw when called", () => {
			expect(() => {
				app.resize();
			}).not.toThrow();
		});
	});

	describe("destroy()", () => {
		it("should destroy a standalone Application instance", async () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();

			expect(app.isInitialized).toBe(true);
			expect(app.canvas).toBeDefined();

			app.destroy();

			expect(app.isInitialized).toBe(false);
		});

		it("should remove the canvas from the DOM when removeCanvas is true", async () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();

			const canvas = app.canvas;
			expect(canvas.parentElement).toBeDefined();

			app.destroy(true);

			expect(canvas.parentElement).toBeNull();
		});

		it("should keep the canvas in the DOM when removeCanvas is false", async () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();

			const canvas = app.canvas;
			app.destroy(false);

			expect(canvas.parentElement).not.toBeNull();
			// clean up manually
			canvas.parentElement.removeChild(canvas);
		});
	});

	describe("init() lifecycle guards", () => {
		it("init() after destroy() rejects — a destroyed app is terminal", async () => {
			const app = new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
			app.destroy();
			await expect(app.init()).rejects.toThrow(/destroyed/);
			expect(app.isInitialized).toBe(false);
		});

		it("a second init() is a warned no-op (same renderer, no second canvas)", async () => {
			const app = new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
			const renderer = app.renderer;
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				await app.init();
				expect(app.renderer).toBe(renderer);
				expect(
					warnSpy.mock.calls.some((args) => {
						return /init\(\) called twice/.test(String(args[0]));
					}),
				).toBe(true);
			} finally {
				warnSpy.mockRestore();
				app.destroy();
			}
		});

		it("destroy() during a pending init() aborts instead of resurrecting the app", async () => {
			// a custom renderer whose init() we hold open — the window the
			// WebGPU adapter/device negotiation opens for real
			let release;
			class SlowRenderer extends CanvasRenderer {
				init() {
					return new Promise((resolve) => {
						release = resolve;
					});
				}
			}
			const app = new Application(64, 64, {
				parent: "screen",
				renderer: SlowRenderer,
				consoleHeader: false,
			});
			const pending = app.init();
			app.destroy();
			release();
			await expect(pending).rejects.toThrow(/destroyed/);
			// nothing of the aborted bootstrap survives: not initialized,
			// no canvas appended, no engine listeners re-registered
			expect(app.isInitialized).toBe(false);
			expect(app.renderer.getCanvas().parentElement).toBeNull();
		});
	});

	describe("pause / resume / freeze", () => {
		beforeAll(async () => {
			boot();
			app = new Application(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
			await app.init();
		});

		afterEach(() => {
			// always end with the game running for subsequent tests
			if (state.isPaused()) {
				state.resume();
			}
			vi.useRealTimers();
		});

		it("pause() should pause the underlying state", () => {
			expect(state.isPaused()).toBe(false);
			app.pause();
			expect(state.isPaused()).toBe(true);
			app.resume();
			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should pause immediately and resume after the duration", async () => {
			vi.useFakeTimers();
			expect(state.isPaused()).toBe(false);

			const done = app.freeze(100);
			expect(state.isPaused()).toBe(true);

			await vi.advanceTimersByTimeAsync(100);
			await done;

			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should return a Promise that resolves on unfreeze", async () => {
			vi.useFakeTimers();
			let resolved = false;
			const done = app.freeze(50).then(() => {
				resolved = true;
			});

			expect(resolved).toBe(false);
			await vi.advanceTimersByTimeAsync(50);
			await done;
			expect(resolved).toBe(true);
		});

		it("freeze() should extend (not stack) when called again with a later end-time", async () => {
			vi.useFakeTimers();
			const first = app.freeze(100);

			// at t=50, request another 100ms freeze (ends at t=150, later than t=100)
			await vi.advanceTimersByTimeAsync(50);
			const second = app.freeze(100);

			// at t=120, the first freeze would have ended — but we extended, so still paused
			await vi.advanceTimersByTimeAsync(70);
			expect(state.isPaused()).toBe(true);

			// at t=150, the extended freeze should end
			await vi.advanceTimersByTimeAsync(30);
			await Promise.all([first, second]);
			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should silently no-op for invalid durations (NaN/Infinity/negative)", async () => {
			expect(state.isPaused()).toBe(false);

			await app.freeze(Number.NaN);
			expect(state.isPaused()).toBe(false);

			await app.freeze(Number.POSITIVE_INFINITY);
			expect(state.isPaused()).toBe(false);

			await app.freeze(-100);
			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should NOT shorten when called with an earlier end-time", async () => {
			vi.useFakeTimers();
			const long = app.freeze(200);

			// at t=10, request a shorter freeze — should be ignored
			await vi.advanceTimersByTimeAsync(10);
			const short = app.freeze(50);

			// at t=80, short would have ended but long is still active
			await vi.advanceTimersByTimeAsync(70);
			expect(state.isPaused()).toBe(true);

			// at t=200, long ends — both promises should resolve
			await vi.advanceTimersByTimeAsync(120);
			await Promise.all([long, short]);
			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should leave game paused on timeout if it was already paused", async () => {
			vi.useFakeTimers();
			state.pause();
			expect(state.isPaused()).toBe(true);

			const done = app.freeze(100);
			expect(state.isPaused()).toBe(true);

			await vi.advanceTimersByTimeAsync(100);
			await done;

			// freeze didn't own the pause — game must remain paused
			expect(state.isPaused()).toBe(true);
		});

		it("manual state.resume() during freeze should cancel timer and resolve waiters", async () => {
			vi.useFakeTimers();
			let resolved = false;
			const done = app.freeze(500).then(() => {
				resolved = true;
			});
			expect(state.isPaused()).toBe(true);

			// user resumes manually before the freeze timer fires
			state.resume();
			expect(state.isPaused()).toBe(false);

			// freeze promise should resolve immediately (cancelled)
			await done;
			expect(resolved).toBe(true);

			// no zombie timer — advancing time should not affect anything
			await vi.advanceTimersByTimeAsync(1000);
			expect(state.isPaused()).toBe(false);
		});

		it("freeze() called after a manual resume should re-pause properly", async () => {
			vi.useFakeTimers();
			app.freeze(500);
			expect(state.isPaused()).toBe(true);

			state.resume();
			expect(state.isPaused()).toBe(false);

			// a new freeze must actually re-pause the game (not hit the
			// "already frozen" extend branch because of a stale timer)
			const done = app.freeze(100);
			expect(state.isPaused()).toBe(true);

			await vi.advanceTimersByTimeAsync(100);
			await done;
			expect(state.isPaused()).toBe(false);
		});

		it("window blur should cancel an in-flight freeze and resolve waiters", async () => {
			vi.useFakeTimers();
			let resolved = false;
			const done = app.freeze(500).then(() => {
				resolved = true;
			});
			expect(state.isPaused()).toBe(true);

			// emit BLUR the same way device.js does on visibility loss —
			// state.ts's listener cancels the freeze + resolves the promise
			const { emit, BLUR } = await import("../src/system/event.ts");
			emit(BLUR);

			// freeze promise resolves immediately — no waiting for the 500ms
			await done;
			expect(resolved).toBe(true);

			// state stays paused (Application._onBlur's regular pauseOnBlur path
			// keeps it that way until focus returns) — but the freeze timer is
			// gone, so a manual resume unpauses normally with no zombie timer.
			state.resume();
			expect(state.isPaused()).toBe(false);

			// and a fresh freeze still works
			const next = app.freeze(50);
			expect(state.isPaused()).toBe(true);
			await vi.advanceTimersByTimeAsync(50);
			await next;
			expect(state.isPaused()).toBe(false);
		});
	});

	describe("parentApp", () => {
		beforeAll(async () => {
			boot();
			app = new Application(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
			await app.init();
		});

		it("should return the Application for renderables added to world", () => {
			const obj = new Renderable(0, 0, 32, 32);
			app.world.addChild(obj);

			expect(obj.parentApp).toBeDefined();
			expect(obj.parentApp).toBeInstanceOf(Application);
			expect(obj.parentApp.renderer).toBe(app.renderer);

			app.world.removeChild(obj);
		});

		it("should return the Application for nested renderables", () => {
			const container = new Container(0, 0, 100, 100);
			const child = new Renderable(0, 0, 16, 16);
			container.addChild(child);
			app.world.addChild(container);

			expect(child.parentApp).toBeDefined();
			expect(child.parentApp).toBeInstanceOf(Application);
			expect(child.parentApp.renderer).toBe(app.renderer);

			app.world.removeChild(container);
		});

		it("should give access to the renderer via parentApp", () => {
			const obj = new Renderable(0, 0, 32, 32);
			app.world.addChild(obj);

			// parentApp.renderer should be the same as app.renderer
			expect(obj.parentApp.renderer).toBe(app.renderer);
			expect(obj.parentApp.renderer.getCanvas()).toBeInstanceOf(
				globalThis.HTMLCanvasElement,
			);

			app.world.removeChild(obj);
		});

		it("should be undefined before being added to a container", () => {
			const obj = new Renderable(0, 0, 32, 32);
			expect(obj.parentApp).toBeUndefined();
		});

		it("should give access to the texture cache via parentApp", () => {
			const obj = new Renderable(0, 0, 32, 32);
			app.world.addChild(obj);

			expect(obj.parentApp.renderer.cache).toBeDefined();

			app.world.removeChild(obj);
		});
	});

	describe("lastUpdateDelta (renamed from updateAverageDelta in 20.0.0)", () => {
		/**
		 * A bare Application is enough here: the field is written by the
		 * fixed-timestep loop in `update()`, which needs no renderer.
		 */
		const makeApp = async () => {
			const app = new Application(64, 64, { physics: { adapter: "builtin" } });
			await app.init();
			return app;
		};

		it("starts at zero", async () => {
			const app = await makeApp();
			expect(app.lastUpdateDelta).toBe(0);
			app.destroy();
		});

		it("records the measured cost of a logic step, not the simulated delta", async () => {
			const app = await makeApp();
			try {
				// force a step. `accumulatorMax` is 0 until the app is sized, and
				// `update()` clamps the accumulator to it — leave it at 0 and the
				// accumulator is zeroed before the loop is ever tested
				app.accumulatorMax = app.stepSize * 10;
				app.accumulator = app.accumulatorUpdateDelta = app.stepSize;
				app.frameCounter = app.frameRate - 1;
				app.update(performance.now());

				// prove the step actually ran, or the assertions below hold
				// vacuously on a `lastUpdateDelta` that never left 0
				expect(app.lastUpdateStart).not.toBeNull();

				// a real elapsed duration — never negative, which is exactly what
				// differencing the GAME_BEFORE_UPDATE / GAME_AFTER_UPDATE payloads
				// used to produce
				expect(app.lastUpdateDelta).toBeGreaterThanOrEqual(0);
				// and distinct in kind from `updateDelta`, which is simulated time
				// fixed at the step size
				expect(app.updateDelta).toBeCloseTo(app.stepSize, 5);
				expect(app.lastUpdateDelta).toBeLessThan(app.stepSize);
			} finally {
				app.destroy();
			}
		});

		it("measures real elapsed time, tracking work done in the update", async () => {
			const app = await makeApp();
			try {
				// a child that deliberately burns ~3ms inside the update phase, so
				// the recorded value has to be a genuine measurement — a hardcoded
				// zero or a simulated delta would both fail this
				const BURN_MS = 3;
				const hog = new Renderable(0, 0, 8, 8);
				hog.update = () => {
					const t0 = performance.now();
					while (performance.now() - t0 < BURN_MS) {
						// spin
					}
					return true;
				};
				app.world.addChild(hog);

				app.accumulatorMax = app.stepSize * 10;
				app.accumulator = app.accumulatorUpdateDelta = app.stepSize;
				app.frameCounter = app.frameRate - 1;
				app.update(performance.now());

				// generous lower bound so clock granularity and scheduling can't
				// make this flaky, but far above anything a trivial world costs
				expect(app.lastUpdateDelta).toBeGreaterThan(BURN_MS * 0.5);
			} finally {
				app.destroy();
			}
		});

		it("is what the accumulator drains by when it exceeds the step size", async () => {
			const app = await makeApp();
			try {
				// the spiral-of-death guard: a logic step costing more real time
				// than it simulates must drain the accumulator by the real cost,
				// or the accumulator refills faster than it can empty
				app.lastUpdateDelta = app.stepSize * 3;
				app.accumulatorMax = app.stepSize * 10;
				app.accumulator = app.stepSize;
				app.frameCounter = app.frameRate - 1;
				app.update(performance.now());
				expect(app.accumulatorUpdateDelta).toBeCloseTo(app.stepSize * 3, 5);
			} finally {
				app.destroy();
			}
		});

		describe("deprecated updateAverageDelta alias", () => {
			it("reads through to lastUpdateDelta", async () => {
				const app = await makeApp();
				app.lastUpdateDelta = 4.25;
				expect(app.updateAverageDelta).toBe(4.25);
				app.destroy();
			});

			it("writes through to lastUpdateDelta", async () => {
				const app = await makeApp();
				app.updateAverageDelta = 7.5;
				expect(app.lastUpdateDelta).toBe(7.5);
				app.destroy();
			});

			it("is present on the default game instance", () => {
				// the debug plugin resolves the new name first and falls back to
				// this one on melonJS 19.x, so both must stay reachable here
				expect(typeof app.lastUpdateDelta).toBe("number");
				expect(typeof app.updateAverageDelta).toBe("number");
			});
		});
	});
});
