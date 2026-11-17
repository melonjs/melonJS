/**
 * `Camera3d#orbit(target, yaw, pitch, distance)` places the camera on a
 * sphere around a point, looking at it, and leaves it with those `yaw` and
 * `pitch`: the inverse of `lookAt`, which keeps the position and finds the
 * angles.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	Renderable,
	Vector3d,
	video,
} from "../src/index.js";

describe("Camera3d#orbit", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	const make = () => {
		const cam = new Camera3d(0, 0, 320, 240);
		cam.setClipPlanes(1, 100000);
		return cam;
	};

	/** where the camera is, in world space */
	const eye = (cam) => {
		return new Vector3d(cam.pos.x, cam.pos.y, cam.depth);
	};

	/** the camera's forward, through the public API */
	const forwardOf = (cam) => {
		const f = new Vector3d();
		cam.getBasis(new Vector3d(), new Vector3d(), f);
		return f;
	};

	const views = [
		[0, 0, 500],
		[0.6, -0.4, 800],
		[-2.5, 0.9, 350],
		[Math.PI, -Math.PI / 2 + 0.01, 1200],
		[7.3, 1.2, 50],
		[-11, -0.05, 20000],
	];

	describe("looks at the point from where the angles say", () => {
		for (const [yaw, pitch, distance] of views) {
			it(`yaw ${yaw}, pitch ${pitch}, distance ${distance}`, () => {
				const cam = make();
				const target = new Vector3d(120, -340, 75);
				cam.orbit(target, yaw, pitch, distance);
				// the angles are the camera's own
				expect(cam.yaw).toBe(yaw);
				expect(cam.pitch).toBe(pitch);
				// the target is `distance` away, straight ahead
				const to = target.clone().sub(eye(cam));
				expect(to.length()).toBeCloseTo(distance, 6);
				const f = forwardOf(cam);
				const dir = to.normalize();
				expect(f.x).toBeCloseTo(dir.x, 5);
				expect(f.y).toBeCloseTo(dir.y, 5);
				expect(f.z).toBeCloseTo(dir.z, 5);
			});
		}

		it("puts the point in the middle of the screen", () => {
			const cam = make();
			const target = new Vector3d(-60, 40, 900);
			cam.orbit(target, 0.8, -0.3, 700);
			const s = cam.worldToScreen(target);
			expect(s.x).toBeCloseTo(160, 3);
			expect(s.y).toBeCloseTo(120, 3);
		});

		it("an orthographic camera too", () => {
			const cam = make();
			cam.projection = "orthographic";
			const target = new Vector3d(10, 20, 30);
			cam.orbit(target, -0.7, -0.6, 900);
			const s = cam.worldToScreen(target);
			expect(s.x).toBeCloseTo(160, 3);
			expect(s.y).toBeCloseTo(120, 3);
		});
	});

	describe("follows the camera's conventions", () => {
		it("a yaw and pitch of 0 put the camera in front of the point, looking down +Z", () => {
			const cam = make();
			cam.orbit(new Vector3d(5, 6, 7), 0, 0, 100);
			expect([cam.pos.x, cam.pos.y, cam.depth]).toEqual([5, 6, -93]);
			expect(forwardOf(cam).z).toBeCloseTo(1, 6);
		});

		it("a negative pitch looks down, from above the point (Y down)", () => {
			const cam = make();
			cam.orbit(new Vector3d(0, 0, 0), 0, -0.5, 100);
			expect(cam.pos.y).toBeLessThan(0);
			expect(forwardOf(cam).y).toBeGreaterThan(0);
		});

		it("is lookAt the other way round: looking back at the point keeps the angles", () => {
			const cam = make();
			const target = new Vector3d(300, -50, 20);
			cam.orbit(target, 1.1, -0.45, 640);
			cam.lookAt(target);
			expect(cam.yaw).toBeCloseTo(1.1, 9);
			expect(cam.pitch).toBeCloseTo(-0.45, 9);
		});

		it("keeps the roll", () => {
			const cam = make();
			cam.roll = 0.3;
			cam.orbit(new Vector3d(0, 0, 0), 0.5, -0.2, 300);
			expect(cam.roll).toBe(0.3);
		});

		it("a distance of 0 puts the camera on the point", () => {
			const cam = make();
			cam.orbit(new Vector3d(4, 5, 6), 0.4, 0.2, 0);
			expect([cam.pos.x, cam.pos.y, cam.depth]).toEqual([4, 5, 6]);
			expect(cam.yaw).toBe(0.4);
		});

		it("takes a renderable's pos, and a point with no z as depth 0", () => {
			const cam = make();
			const r = new Renderable(50, 60, 10, 10);
			r.depth = 70;
			cam.orbit(r.pos, 0, 0, 10);
			expect([cam.pos.x, cam.pos.y, cam.depth]).toEqual([50, 60, 60]);
			cam.orbit({ x: 1, y: 2 }, 0, 0, 10);
			expect([cam.pos.x, cam.pos.y, cam.depth]).toEqual([1, 2, -10]);
		});

		it("returns the camera, to chain", () => {
			const cam = make();
			expect(cam.orbit(new Vector3d(), 0, 0, 1)).toBe(cam);
		});
	});

	describe("a value that is not a number leaves the camera as it is", () => {
		const bad = [
			["a NaN yaw", [new Vector3d(), Number.NaN, 0, 100]],
			["an infinite pitch", [new Vector3d(), 0, Infinity, 100]],
			["a NaN distance", [new Vector3d(), 0, 0, Number.NaN]],
			["an infinite distance", [new Vector3d(), 0, 0, Infinity]],
			["a negative distance", [new Vector3d(), 0, 0, -5]],
			["a NaN target", [new Vector3d(Number.NaN, 0, 0), 0, 0, 100]],
			[
				"a target with an infinite z",
				[{ x: 0, y: 0, z: -Infinity }, 0, 0, 100],
			],
		];
		for (const [name, args] of bad) {
			it(name, () => {
				const cam = make();
				cam.orbit(new Vector3d(10, 20, 30), 0.3, -0.2, 400);
				const before = [cam.pos.x, cam.pos.y, cam.depth, cam.yaw, cam.pitch];
				expect(cam.orbit(...args)).toBe(cam);
				expect([cam.pos.x, cam.pos.y, cam.depth, cam.yaw, cam.pitch]).toEqual(
					before,
				);
			});
		}
	});
});
