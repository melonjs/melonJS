import { beforeAll, describe, expect, it } from "vitest";
import { game as gameFromModule } from "../src/application/application.ts";
import { Application, boot, game, video } from "../src/index.js";
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
				renderer: video.AUTO,
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
});
