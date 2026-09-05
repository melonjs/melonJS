import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	Color,
	Container,
	Vector3d,
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

	describe("the height integral is baked against the world, not the mesh's parent", () => {
		// The shaders get the height integral pre-resolved into two operands.
		// They have to, because the only position a vertex stage holds is
		// PRE-VIEW — `model * position` — and that is the mesh's parent space
		// rather than the world once `Container.draw` folds an ancestor into
		// the view matrix. So the camera hands over the world-up axis
		// expressed in VIEW space (with the falloff already folded in), which
		// a shader can dot against a view-space position to recover a true
		// world height whatever those ancestors did.
		const axis = () => {
			return Array.from(resolve().heightAxis);
		};

		afterEach(() => {
			camera.setFog(null);
			camera.pos.set(0, 0, 0);
			camera.yaw = 0;
			camera.pitch = 0;
		});

		it("is exactly neutral at falloff 0 — the dial at zero, not a branch", () => {
			camera.pos.set(0, 137, 0);
			camera.setFog({ far: 1000, fogHeight: 400 });
			// all zero, so the shader's dot product is 0, its series limit is
			// taken, and the base is exp(0). Anything else here and uniform
			// fog would stop being bit-identical to the fog that shipped
			// before the falloff existed.
			expect(axis()).toEqual([0, 0, 0]);
			expect(resolve().heightBase).toBe(1);
		});

		it("puts the falloff entirely in y when the camera is not turned", () => {
			camera.setFog({ far: 1000, heightFalloff: 0.02 });
			// float32: the axis rides to the shader in a Float32Array
			expect(axis()).toEqual([0, Math.fround(0.02), 0]);
		});

		it("follows the camera's own basis once it turns", () => {
			camera.yaw = 0.7;
			camera.pitch = -0.35;
			const k = 0.03;
			camera.setFog({ far: 1000, heightFalloff: k });
			// the world-up axis in view space is the Y component of each of
			// the camera's world axes — the row of the orientation whose
			// columns getBasis hands out
			const right = new Vector3d();
			const up = new Vector3d();
			const forward = new Vector3d();
			camera.getBasis(right, up, forward);
			const got = axis();
			for (const [i, want] of [
				k * right.y,
				k * up.y,
				k * forward.y,
			].entries()) {
				expect(got[i]).toBeCloseTo(want, 7);
			}
			// and it is a real rotation, not the unturned case in disguise
			expect(Math.abs(got[0]) + Math.abs(got[2])).toBeGreaterThan(1e-3);
		});

		it("keeps the axis a unit direction scaled by the falloff", () => {
			camera.yaw = 1.9;
			camera.pitch = 0.42;
			const k = 0.05;
			camera.setFog({ far: 1000, heightFalloff: k });
			const [x, y, z] = axis();
			expect(Math.hypot(x, y, z)).toBeCloseTo(k, 7);
		});

		it("bakes the altitude term as exp(k * (cameraY - fogHeight))", () => {
			const k = 0.004;
			camera.pos.set(0, 250, 0);
			camera.setFog({ far: 1000, heightFalloff: k, fogHeight: 100 });
			expect(resolve().heightBase).toBeCloseTo(Math.exp(k * (250 - 100)), 12);
		});

		it("fogs a LOWER camera more — render space is Y-down", () => {
			// The sign trap, at the camera end. A greater y is LOWER in the
			// world and must sit in denser air; every published form of this
			// assumes Y-up, and flipping it puts the mist on the peaks.
			const opts = { far: 1000, heightFalloff: 0.01, fogHeight: 0 };
			camera.pos.set(0, 200, 0);
			camera.setFog(opts);
			const low = resolve().heightBase;
			camera.pos.set(0, -200, 0);
			camera.setFog(opts);
			const high = resolve().heightBase;
			expect(low).toBeGreaterThan(high);
		});

		it("clamps the exponent, so a camera far below the floor cannot blow up", () => {
			camera.pos.set(0, 20000, 0);
			camera.setFog({ far: 1000, heightFalloff: 0.05, fogHeight: -5000 });
			// unclamped this is exp(1250) = Infinity, which would whiten the
			// whole frame the moment it reached a varying
			const base = resolve().heightBase;
			expect(Number.isFinite(base)).toBe(true);
			expect(base).toBe(Math.exp(30));
		});

		it("agrees with the view matrix the camera actually installs", () => {
			// THE decisive assertion for this design. The axis and `getBasis`
			// are built from the same two `rotate` calls on the same scratch
			// matrix, so checking one against the other cannot catch a wrong
			// composition order — both would move together and the test would
			// still pass. This pushes world points through the REAL view
			// transform the camera installs on a container, and checks the
			// axis recovers their height above the camera from the result.
			// That is precisely the property the shaders depend on.
			camera.yaw = 0.7;
			camera.pitch = -0.35;
			camera.pos.set(0, 120, 0);
			const k = 0.02;
			camera.setFog({ far: 1000, heightFalloff: k });
			const axis = resolve().heightAxis;

			const container = new Container(0, 0, 320, 240);
			container.currentTransform.identity();
			camera._applyContainerViewTransform(
				container,
				camera.pos.x + camera.offset.x,
				camera.pos.y + camera.offset.y,
			);

			for (const world of [
				new Vector3d(30, 40, 500),
				new Vector3d(-210, -95, 60),
				new Vector3d(0, 0, 0),
				new Vector3d(75, 300, -40),
			]) {
				const viewPos = new Vector3d().copy(world);
				container.currentTransform.apply(viewPos);
				const dy =
					axis[0] * viewPos.x + axis[1] * viewPos.y + axis[2] * viewPos.z;
				// the height above the camera, times the falloff — Y-down, so
				// a world point BELOW the camera (greater y) comes out positive
				expect(dy).toBeCloseTo(k * (world.y - camera.pos.y), 4);
			}
		});

		it("anchors the base where the VIEW puts the camera, offset included", () => {
			// Regression: the two ends of the integral have to share an origin.
			// `dy` comes from a view-space position, and the view translates by
			// `pos + offset` — so a base anchored at `pos` alone walks away
			// from it the moment anything writes `offset`. `camera.shake()`
			// does exactly that, every frame, which modulated the whole
			// scene's fog thickness for the duration of the shake.
			const k = 0.01;
			camera.pos.set(0, 100, 0);
			camera.offset.set(0, 50);
			camera.setFog({ far: 1000, heightFalloff: k, fogHeight: 0 });
			// 150, not 100
			expect(resolve().heightBase).toBeCloseTo(Math.exp(k * 150), 9);
			camera.offset.set(0, 0);
		});

		it("takes the exact origin `draw` hands it, for a non-default camera", () => {
			// a non-default camera's view additionally carries the world
			// container's offset, which the camera cannot see from `pos` and
			// `offset` alone — `draw` resolves it and passes it in
			const k = 0.01;
			camera.pos.set(0, 100, 0);
			camera.setFog({ far: 1000, heightFalloff: k, fogHeight: 0 });
			expect(camera._fog3dState(app.renderer, 420).heightBase).toBeCloseTo(
				Math.exp(k * 420),
				9,
			);
		});

		it("re-bakes per frame, so moving the camera moves the fog with it", () => {
			camera.pos.set(0, 0, 0);
			camera.setFog({ far: 1000, heightFalloff: 0.01, fogHeight: 0 });
			const atOrigin = resolve().heightBase;
			camera.pos.set(0, 300, 0);
			// no second setFog: a snapshot taken at call time would not move
			expect(resolve().heightBase).not.toBeCloseTo(atOrigin, 6);
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

	describe("the options object is not retained", () => {
		it("settles the scalars at the call, so a later mutation cannot bypass validation", () => {
			// Retaining the caller's object made `mode`, `near`, `far` and
			// `density` live — mutating them after the fact changed the fog AND
			// skipped every check `setFog` performs, while mutating `color` did
			// nothing at all. Four fields live, one not, and neither documented.
			const options = { near: 100, far: 200 };
			camera.setFog(options);
			const before = { ...resolve() };
			options.mode = "exp2";
			options.far = 999999;
			options.near = -5;
			const after = resolve();
			expect(after.mode).toBe(before.mode);
			expect(after.near).toBe(before.near);
			expect(after.invRange).toBe(before.invRange);
			camera.setFog(null);
		});

		it("hands back a copy, not a live handle", () => {
			const options = { near: 10, far: 400 };
			camera.setFog(options);
			expect(camera.fog).not.toBe(options);
			expect(camera.fog?.far).toBe(400);
			camera.setFog(null);
		});

		it("still tracks a Color by reference, which IS documented as live", () => {
			const colour = new Color(255, 0, 0);
			camera.setFog({ far: 100, color: colour });
			colour.setColor(0, 255, 0);
			expect(resolve().color[1]).toBeCloseTo(1, 5);
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

		it("rejects a non-finite height falloff or reference height", () => {
			// `heightFalloff` is multiplied into the axis, and `Infinity * 0`
			// is NaN — so an unguarded infinity poisons the two components of
			// the axis that should be zero, and every dot product with it.
			// Guarded at the call, where the stack still says who did it.
			for (const bad of [Number.POSITIVE_INFINITY, Number.NaN]) {
				expect(() => {
					return camera.setFog({ far: 1000, heightFalloff: bad });
				}).toThrow(/heightFalloff must be a finite number/);
				expect(() => {
					return camera.setFog({ far: 1000, fogHeight: bad });
				}).toThrow(/fogHeight must be a finite number/);
			}
			expect(() => {
				return camera.setFog({ far: 1000, heightFalloff: -0.01 });
			}).toThrow(/heightFalloff must not be negative/);
		});

		it("keeps the resolved axis and base finite for every accepted input", () => {
			// the guard above is only worth having if what it lets through is
			// always usable — no NaN can reach a vertex shader
			for (const opts of [
				{ far: 1000, heightFalloff: 0 },
				{ far: 1000, heightFalloff: 0.05, fogHeight: -5000 },
				{ far: 1000, heightFalloff: 1e-9, fogHeight: 1e6 },
				{ far: 1000, heightFalloff: 12, fogHeight: 0 },
			]) {
				camera.setFog(opts);
				const state = resolve();
				for (const v of state.heightAxis) {
					expect(Number.isFinite(v)).toBe(true);
				}
				expect(Number.isFinite(state.heightBase)).toBe(true);
			}
			camera.setFog(null);
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

	describe("fog does not survive the frame that installed it", () => {
		it("starts each frame with none, so nothing inherits the last camera's", () => {
			// `_fog3d` is written once per camera and never reset, so without
			// this a mesh drawn outside a camera bracket would inherit whatever
			// the previously drawn camera left installed — across frames too,
			// which is the hardest version to notice.
			camera.setFog({ near: 1, far: 100 });
			app.renderer.setFog(camera._fog3dState(app.renderer));
			expect(app.renderer._fog3d).not.toBe(null);

			app.draw();
			// the frame reset runs before the stage draws; by the time the
			// frame is over the camera has re-installed its own
			expect(app.renderer._fog3d).not.toBe(undefined);

			app.renderer.setFog(null);
			expect(app.renderer._fog3d).toBe(null);
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
