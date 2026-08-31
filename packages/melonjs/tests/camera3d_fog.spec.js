import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	Color,
	video,
} from "../src/index.js";

/**
 * `Camera3d.setFog` — the API and the live defaults (#1622).
 *
 * Fog is owned by the camera rather than the world because its distances have
 * to agree with the camera's own clip planes. That is only true if the
 * defaults are resolved per frame: a snapshot taken at `setFog` time goes out
 * of step the moment `setClipPlanes` is called, and the symptom — geometry
 * clipping before it has finished fading — reads as a fog bug rather than a
 * stale-copy bug. Most of this file guards that.
 *
 * Canvas renderer throughout: this exercises the resolver, not rasterization.
 */
describe("Camera3d distance fog", () => {
	let app;
	let camera;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			cameraClass: Camera3d,
		});
		await app.init();
		camera = app.viewport;
	});

	afterAll(() => {
		app?.destroy();
	});

	const resolve = () => {
		return camera._fog3dState(app.renderer);
	};

	describe("off by default", () => {
		it("starts with no fog at all", () => {
			expect(camera.fog).toBe(null);
			expect(resolve()).toBe(null);
		});

		it("goes back to none with setFog(null)", () => {
			camera.setFog({ near: 10, far: 100 });
			expect(resolve()).not.toBe(null);
			camera.setFog(null);
			expect(camera.fog).toBe(null);
			expect(resolve()).toBe(null);
		});

		it("is chainable", () => {
			expect(camera.setFog({ far: 100 })).toBe(camera);
			expect(camera.setFog(null)).toBe(camera);
		});
	});

	describe("the defaults track, rather than snapshot", () => {
		it("takes its distances from the clip planes, and follows them", () => {
			camera.setClipPlanes(1, 1000);
			camera.setFog({});
			const first = resolve();
			expect(first.mode).toBe(1);
			expect(first.near).toBe(1);
			expect(first.invRange).toBeCloseTo(1 / 999, 10);
			// the whole reason fog lives on the camera: move the clip planes
			// and the fog must move with them
			camera.setClipPlanes(5, 500);
			const second = resolve();
			expect(second.near).toBe(5);
			expect(second.invRange).toBeCloseTo(1 / 495, 10);
			camera.setFog(null);
		});

		it("takes its colour from the background, and follows that too", () => {
			app.renderer.backgroundColor.parseCSS("#204060");
			camera.setFog({ far: 100 });
			const first = resolve();
			expect(first.color[0]).toBeCloseTo(0x20 / 255, 5);
			expect(first.color[2]).toBeCloseTo(0x60 / 255, 5);
			// a day/night fade must not leave a band at the horizon
			app.renderer.backgroundColor.parseCSS("#803010");
			const second = resolve();
			expect(second.color[0]).toBeCloseTo(0x80 / 255, 5);
			expect(second.color[2]).toBeCloseTo(0x10 / 255, 5);
			camera.setFog(null);
		});

		it("defaults exp2 density from the far plane, so world scale does not matter", () => {
			camera.setClipPlanes(1, 4000);
			camera.setFog({ mode: "exp2" });
			expect(resolve().density).toBeCloseTo(2 / 4000, 10);
			camera.setClipPlanes(1, 1000);
			expect(resolve().density).toBeCloseTo(2 / 1000, 10);
			camera.setFog(null);
		});
	});

	describe("an explicit colour", () => {
		it("is held by reference when a Color, so mutating it animates the fog", () => {
			const colour = new Color(255, 0, 0);
			camera.setFog({ far: 100, color: colour });
			expect(resolve().color[0]).toBeCloseTo(1, 5);
			colour.setColor(0, 0, 255);
			expect(resolve().color[0]).toBeCloseTo(0, 5);
			expect(resolve().color[2]).toBeCloseTo(1, 5);
			camera.setFog(null);
		});

		it("is parsed and owned when a CSS string", () => {
			camera.setFog({ far: 100, color: "#00ff00" });
			const state = resolve();
			expect(state.color[1]).toBeCloseTo(1, 5);
			camera.setFog(null);
		});

		it("accepts [r, g, b] in 0..1, the glTF convention", () => {
			camera.setFog({ far: 100, color: [0, 0, 1] });
			expect(resolve().color[2]).toBeCloseTo(1, 5);
			camera.setFog(null);
		});

		it("wins over the background colour, and does not follow it", () => {
			app.renderer.backgroundColor.parseCSS("#ffffff");
			camera.setFog({ far: 100, color: "#000000" });
			app.renderer.backgroundColor.parseCSS("#123456");
			const state = resolve();
			expect(state.color[0]).toBe(0);
			expect(state.color[1]).toBe(0);
			expect(state.color[2]).toBe(0);
			camera.setFog(null);
		});
	});

	describe("bad input is refused at the call, not at the draw", () => {
		it("rejects an unknown mode", () => {
			expect(() => {
				return camera.setFog({ mode: "exp" });
			}).toThrow(/unknown mode/);
		});

		it("rejects far at or below near", () => {
			expect(() => {
				return camera.setFog({ near: 100, far: 100 });
			}).toThrow(/far must be greater/);
			expect(() => {
				return camera.setFog({ near: 100, far: 50 });
			}).toThrow(/far must be greater/);
		});

		it("rejects a density at or below zero", () => {
			expect(() => {
				return camera.setFog({ density: 0 });
			}).toThrow(/density/);
			expect(() => {
				return camera.setFog({ density: -1 });
			}).toThrow(/density/);
		});

		it("rejects non-finite distances and a negative near", () => {
			expect(() => {
				return camera.setFog({ far: Number.NaN });
			}).toThrow(/finite/);
			expect(() => {
				return camera.setFog({ near: Number.POSITIVE_INFINITY });
			}).toThrow(/finite/);
			expect(() => {
				return camera.setFog({ near: -1 });
			}).toThrow(/negative/);
		});

		it("does not leave fog enabled after a rejected call", () => {
			camera.setFog(null);
			expect(() => {
				return camera.setFog({ mode: "nope" });
			}).toThrow();
			expect(camera.fog).toBe(null);
		});
	});

	describe("a default that goes degenerate later", () => {
		it("drops fog for that frame instead of dividing by zero", () => {
			// legal at the time it was set; the clip planes collapse afterwards,
			// which cannot throw retroactively from inside a draw
			camera.setFog({});
			camera.setClipPlanes(5, 5.000001);
			camera.near = 5;
			camera.far = 5;
			expect(resolve()).toBe(null);
			camera.setClipPlanes(1, 1000);
			expect(resolve()).not.toBe(null);
			camera.setFog(null);
		});
	});

	describe("fog is per camera", () => {
		it("resolves to nothing on a 2D camera", () => {
			const flat = new Camera2d(0, 0, 320, 240);
			expect(flat._fog3dState(app.renderer)).toBe(null);
		});

		it("is independent between two 3D cameras", () => {
			const other = new Camera3d(0, 0, 320, 240);
			camera.setFog({ near: 1, far: 100 });
			expect(other.fog).toBe(null);
			expect(other._fog3dState(app.renderer)).toBe(null);
			camera.setFog(null);
		});
	});

	describe("no per-frame allocation", () => {
		it("rewrites one state object rather than making a new one", () => {
			camera.setFog({ near: 1, far: 100 });
			const a = resolve();
			const b = resolve();
			expect(a).toBe(b);
			expect(a.color).toBe(b.color);
			camera.setFog(null);
		});
	});
});
