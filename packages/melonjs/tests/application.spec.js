import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { game as gameFromModule } from "../src/application/application.ts";
import {
	Application,
	boot,
	Container,
	game,
	Renderable,
	state,
	video,
} from "../src/index.js";
import { initialized } from "../src/system/bootstrap.ts";

describe("Application", () => {
	describe("class existence", () => {
		it("Application class should be exported", () => {
			expect(Application).toBeDefined();
			expect(typeof Application).toBe("function");
		});
	});

	describe("default game instance", () => {
		beforeAll(() => {
			boot();
			video.init(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
		});

		it("game is an instance of Application", () => {
			expect(game).toBeInstanceOf(Application);
		});

		it("isInitialized should be true after boot and video.init", () => {
			expect(game.isInitialized).toBe(true);
		});

		it("renderer should be created after init", () => {
			expect(game.renderer).toBeDefined();
		});

		it("world should be created after init", () => {
			expect(game.world).toBeDefined();
		});

		it("parentElement should be set after init", () => {
			expect(game.parentElement).toBeDefined();
			expect(game.parentElement).toBeInstanceOf(globalThis.HTMLElement);
		});
	});

	describe("default property values", () => {
		it("mergeGroup should default to true", () => {
			expect(game.mergeGroup).toBe(true);
		});

		it("pauseOnBlur should default to true", () => {
			expect(game.pauseOnBlur).toBe(true);
		});

		it("resumeOnFocus should default to true", () => {
			expect(game.resumeOnFocus).toBe(true);
		});

		it("stopOnBlur should default to false", () => {
			expect(game.stopOnBlur).toBe(false);
		});

		it("isDirty should default to true", () => {
			expect(game.isDirty).toBe(true);
		});
	});

	describe("settings", () => {
		it("settings.width should match the value passed to video.init", () => {
			expect(game.settings.width).toBe(800);
		});

		it("settings.height should match the value passed to video.init", () => {
			expect(game.settings.height).toBe(600);
		});
	});

	describe("standalone Application instance", () => {
		it("should be constructable with width, height, and options", () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			expect(app).toBeInstanceOf(Application);
			expect(app.isInitialized).toBe(true);
			expect(app.settings.width).toBe(320);
			expect(app.settings.height).toBe(240);
			expect(app.renderer).toBeDefined();
			expect(app.world).toBeDefined();
		});
	});

	describe("repaint / sortOn", () => {
		it("repaint() should set isDirty to true", () => {
			game.isDirty = false;
			game.repaint();
			expect(game.isDirty).toBe(true);
		});

		it("sortOn getter/setter should delegate to world.sortOn", () => {
			game.sortOn = "z";
			expect(game.sortOn).toBe("z");
			expect(game.world.sortOn).toBe("z");
		});
	});

	describe("auto-bootstrap", () => {
		it("initialized flag should be true after boot()", () => {
			expect(initialized).toBe(true);
		});

		it("new Application() should initialize when boot() already called", () => {
			const app = new Application(160, 120, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
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

		it("game should be an Application instance with legacy mode", () => {
			expect(game).toBeInstanceOf(Application);
		});

		it("game should be initialized after boot + video.init", () => {
			// game was created with { legacy: true }, so init is deferred
			// after boot() + video.init(), it should be initialized
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
		it("should have independent settings, worlds, and renderers", () => {
			const app1 = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			const app2 = new Application(640, 480, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});

			expect(app1).not.toBe(app2);
			expect(app1.settings.width).toBe(320);
			expect(app2.settings.width).toBe(640);
			expect(app1.world).not.toBe(app2.world);
			expect(app1.renderer).not.toBe(app2.renderer);
		});
	});

	describe("canvas getter", () => {
		it("should return the renderer canvas element", () => {
			expect(game.canvas).toBeDefined();
			expect(game.canvas).toBeInstanceOf(globalThis.HTMLCanvasElement);
			expect(game.canvas).toBe(game.renderer.getCanvas());
		});
	});

	describe("resize()", () => {
		it("should not throw when called", () => {
			expect(() => {
				game.resize();
			}).not.toThrow();
		});
	});

	describe("destroy()", () => {
		it("should destroy a standalone Application instance", () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});

			expect(app.isInitialized).toBe(true);
			expect(app.canvas).toBeDefined();

			app.destroy();

			expect(app.isInitialized).toBe(false);
		});

		it("should remove the canvas from the DOM when removeCanvas is true", () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});

			const canvas = app.canvas;
			expect(canvas.parentElement).toBeDefined();

			app.destroy(true);

			expect(canvas.parentElement).toBeNull();
		});

		it("should keep the canvas in the DOM when removeCanvas is false", () => {
			const app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});

			const canvas = app.canvas;
			app.destroy(false);

			expect(canvas.parentElement).not.toBeNull();
			// clean up manually
			canvas.parentElement.removeChild(canvas);
		});
	});

	describe("pause / resume / freeze", () => {
		beforeAll(() => {
			boot();
			video.init(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
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
			game.pause();
			expect(state.isPaused()).toBe(true);
			game.resume();
			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should pause immediately and resume after the duration", async () => {
			vi.useFakeTimers();
			expect(state.isPaused()).toBe(false);

			const done = game.freeze(100);
			expect(state.isPaused()).toBe(true);

			await vi.advanceTimersByTimeAsync(100);
			await done;

			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should return a Promise that resolves on unfreeze", async () => {
			vi.useFakeTimers();
			let resolved = false;
			const done = game.freeze(50).then(() => {
				resolved = true;
			});

			expect(resolved).toBe(false);
			await vi.advanceTimersByTimeAsync(50);
			await done;
			expect(resolved).toBe(true);
		});

		it("freeze() should extend (not stack) when called again with a later end-time", async () => {
			vi.useFakeTimers();
			const first = game.freeze(100);

			// at t=50, request another 100ms freeze (ends at t=150, later than t=100)
			await vi.advanceTimersByTimeAsync(50);
			const second = game.freeze(100);

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

			await game.freeze(Number.NaN);
			expect(state.isPaused()).toBe(false);

			await game.freeze(Number.POSITIVE_INFINITY);
			expect(state.isPaused()).toBe(false);

			await game.freeze(-100);
			expect(state.isPaused()).toBe(false);
		});

		it("freeze() should NOT shorten when called with an earlier end-time", async () => {
			vi.useFakeTimers();
			const long = game.freeze(200);

			// at t=10, request a shorter freeze — should be ignored
			await vi.advanceTimersByTimeAsync(10);
			const short = game.freeze(50);

			// at t=80, short would have ended but long is still active
			await vi.advanceTimersByTimeAsync(70);
			expect(state.isPaused()).toBe(true);

			// at t=200, long ends — both promises should resolve
			await vi.advanceTimersByTimeAsync(120);
			await Promise.all([long, short]);
			expect(state.isPaused()).toBe(false);
		});
	});

	describe("parentApp", () => {
		beforeAll(() => {
			boot();
			video.init(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
		});

		it("should return the Application for renderables added to world", () => {
			const obj = new Renderable(0, 0, 32, 32);
			game.world.addChild(obj);

			expect(obj.parentApp).toBeDefined();
			expect(obj.parentApp).toBeInstanceOf(Application);
			expect(obj.parentApp.renderer).toBe(game.renderer);

			game.world.removeChild(obj);
		});

		it("should return the Application for nested renderables", () => {
			const container = new Container(0, 0, 100, 100);
			const child = new Renderable(0, 0, 16, 16);
			container.addChild(child);
			game.world.addChild(container);

			expect(child.parentApp).toBeDefined();
			expect(child.parentApp).toBeInstanceOf(Application);
			expect(child.parentApp.renderer).toBe(game.renderer);

			game.world.removeChild(container);
		});

		it("should give access to the renderer via parentApp", () => {
			const obj = new Renderable(0, 0, 32, 32);
			game.world.addChild(obj);

			// parentApp.renderer should be the same as game.renderer
			expect(obj.parentApp.renderer).toBe(game.renderer);
			expect(obj.parentApp.renderer.getCanvas()).toBeInstanceOf(
				globalThis.HTMLCanvasElement,
			);

			game.world.removeChild(obj);
		});

		it("should be undefined before being added to a container", () => {
			const obj = new Renderable(0, 0, 32, 32);
			expect(obj.parentApp).toBeUndefined();
		});

		it("should give access to the texture cache via parentApp", () => {
			const obj = new Renderable(0, 0, 32, 32);
			game.world.addChild(obj);

			expect(obj.parentApp.renderer.cache).toBeDefined();

			game.world.removeChild(obj);
		});
	});
});
