/**
 * The 3D additions to the adapter interface, on the built-in adapter:
 * `setVelocity` / `applyForce` / `applyImpulse` / `setPosition` / `gravity`
 * taking a Vector3d, the optional `getVelocity3d`, `getRotation`,
 * `setRotation`, `getAngularVelocity3d`, and the body handle's `z` arguments.
 *
 * The invariant that matters most: a call with a Vector2d, as every game
 * written before these existed makes, behaves exactly as it did.
 */

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	Box3d,
	BuiltinAdapter,
	boot,
	Capsule3d,
	ConvexHull3d,
	Quaternion,
	Rect,
	Renderable,
	Sphere,
	TriangleMesh3d,
	Vector2d,
	Vector3d,
	video,
	World,
} from "../src/index.js";
import { resetWarnOnce } from "../src/lang/console.js";

describe("Physics : BuiltinAdapter 3D interface", () => {
	/** @type {BuiltinAdapter} */
	let adapter;
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		adapter = new BuiltinAdapter({ gravity: new Vector2d(0, 0) });
		// eslint-disable-next-line no-new
		new World(0, 0, 800, 600, adapter);
	});

	const make = (shape = new Rect(0, 0, 32, 32)) => {
		const r = new Renderable(100, 100, 32, 32);
		r.alwaysUpdate = true;
		const body = adapter.addBody(r, { type: "dynamic", shapes: [shape] });
		return { r, body };
	};

	it("advertises bodies3d", () => {
		expect(adapter.capabilities.bodies3d).toBe(true);
	});

	describe("velocity", () => {
		it("a Vector2d sets x/y and leaves velZ as it was", () => {
			const { r, body } = make();
			body.velZ = 3;
			adapter.setVelocity(r, new Vector2d(1, 2));
			expect(body.vel.x).toBe(1);
			expect(body.vel.y).toBe(2);
			expect(body.velZ).toBe(3);
		});

		it("a Vector3d sets velZ too", () => {
			const { r, body } = make();
			adapter.setVelocity(r, new Vector3d(1, 2, -4));
			expect(body.velZ).toBe(-4);
			const v = adapter.getVelocity3d(r);
			expect([v.x, v.y, v.z]).toEqual([1, 2, -4]);
		});

		it("a Vector3d with z 0 stops the depth motion", () => {
			const { r, body } = make();
			body.velZ = 5;
			adapter.setVelocity(r, new Vector3d(0, 0, 0));
			expect(body.velZ).toBe(0);
		});

		it("getVelocity3d writes into out and returns it", () => {
			const { r } = make();
			adapter.setVelocity(r, new Vector3d(7, 8, 9));
			const out = new Vector3d(-1, -1, -1);
			expect(adapter.getVelocity3d(r, out)).toBe(out);
			expect([out.x, out.y, out.z]).toEqual([7, 8, 9]);
		});

		it("getVelocity3d reads zero for a removed body, as getVelocity does", () => {
			const { r } = make();
			adapter.setVelocity(r, new Vector3d(7, 8, 9));
			adapter.removeBody(r);
			const v = adapter.getVelocity3d(r);
			expect([v.x, v.y, v.z]).toEqual([0, 0, 0]);
		});

		it("getVelocity3d on a renderable that never had a body reads zero", () => {
			const v = adapter.getVelocity3d(new Renderable(0, 0, 1, 1));
			expect([v.x, v.y, v.z]).toEqual([0, 0, 0]);
		});

		it("the body handle takes an optional z", () => {
			const { body } = make();
			body.velZ = 2;
			body.setVelocity(1, 1);
			expect(body.velZ).toBe(2);
			body.setVelocity(1, 1, -6);
			expect(body.velZ).toBe(-6);
			const v = body.getVelocity3d(new Vector3d());
			expect([v.x, v.y, v.z]).toEqual([1, 1, -6]);
		});

		it("velZ moves the renderable in depth on a step", () => {
			const { r } = make(new Box3d(0, 0, 0, 32, 32, 32));
			r.depth = 10;
			adapter.setVelocity(r, new Vector3d(0, 0, 5));
			adapter.step(16);
			expect(r.depth).toBeCloseTo(15, 5);
		});
	});

	describe("force and impulse", () => {
		it("applyForce with a Vector2d leaves forceZ at zero", () => {
			const { r, body } = make();
			adapter.applyForce(r, new Vector2d(1, 2));
			expect(body.force.x).toBe(1);
			expect(body.force.y).toBe(2);
			expect(body.forceZ).toBe(0);
		});

		it("applyForce with a Vector3d accumulates forceZ", () => {
			const { r, body } = make();
			adapter.applyForce(r, new Vector3d(0, 0, 2));
			adapter.applyForce(r, new Vector3d(0, 0, 3));
			expect(body.forceZ).toBe(5);
		});

		it("a Vector3d force at a point still turns the body from x/y", () => {
			const { r, body } = make();
			// push the top edge sideways, with a depth part that must not
			// change the turn
			const flat = make();
			adapter.applyForce(flat.r, new Vector2d(1, 0), new Vector2d(100, 84));
			adapter.applyForce(r, new Vector3d(1, 0, 9), new Vector3d(100, 84, 0));
			expect(body.angularVelocity).toBeCloseTo(flat.body.angularVelocity, 10);
			expect(body.angularVelocity).not.toBe(0);
		});

		it("applyImpulse with a Vector3d divides z by mass", () => {
			const { r, body } = make();
			body.mass = 4;
			adapter.applyImpulse(r, new Vector3d(4, 8, 12));
			expect(body.vel.x).toBe(1);
			expect(body.vel.y).toBe(2);
			expect(body.velZ).toBe(3);
		});

		it("applyImpulse with a Vector2d leaves velZ alone", () => {
			const { r, body } = make();
			body.velZ = 1;
			adapter.applyImpulse(r, new Vector2d(1, 1));
			expect(body.velZ).toBe(1);
		});

		it("a body of mass 0 ignores a 3D impulse", () => {
			const { r, body } = make();
			body.mass = 0;
			adapter.applyImpulse(r, new Vector3d(5, 5, 5));
			expect([body.vel.x, body.vel.y, body.velZ]).toEqual([0, 0, 0]);
		});

		it("the body handle's applyImpulse takes an optional z", () => {
			const { body } = make();
			body.mass = 2;
			body.applyImpulse(2, 0);
			expect(body.velZ).toBe(0);
			body.applyImpulse(0, 0, 6);
			expect(body.velZ).toBe(3);
		});
	});

	describe("position", () => {
		it("a Vector2d keeps the depth", () => {
			const { r } = make();
			r.depth = 42;
			adapter.setPosition(r, new Vector2d(5, 6));
			expect(r.pos.x).toBe(5);
			expect(r.pos.y).toBe(6);
			expect(r.depth).toBe(42);
		});

		it("a Vector3d sets the depth of a body that lives in 3D", () => {
			const { r } = make(new Box3d(0, 0, 0, 32, 32, 32));
			adapter.setPosition(r, new Vector3d(5, 6, -7));
			expect(r.depth).toBe(-7);
			expect(r.pos.z).toBe(-7);
		});

		it("a flat body keeps its depth (its draw order) whatever it is given", () => {
			const { r } = make();
			r.depth = 3;
			// a renderable's `pos` is declared a Vector2d, but is a 3D vector
			// at run time: moving one body onto another must not copy its
			// draw order across
			const other = new Renderable(40, 50, 8, 8);
			other.depth = 12;
			adapter.setPosition(r, other.pos);
			expect([r.pos.x, r.pos.y, r.depth]).toEqual([40, 50, 3]);
			adapter.setPosition(r, new Vector3d(1, 2, 99));
			expect([r.pos.x, r.pos.y, r.depth]).toEqual([1, 2, 3]);
		});
	});

	describe("gravity", () => {
		it("a Vector2d gravity never touches forceZ", () => {
			adapter.gravity = new Vector2d(0, 1);
			const { r, body } = make();
			adapter.step(16);
			expect(body.velZ).toBe(0);
			expect(r.pos.z).toBe(0);
		});

		it("a Vector3d gravity pulls along Z, scaled by gravityScale", () => {
			const a = new BuiltinAdapter({ gravity: new Vector3d(0, 0, 1) });
			// eslint-disable-next-line no-new
			new World(0, 0, 800, 600, a);
			const r = new Renderable(0, 0, 32, 32);
			r.alwaysUpdate = true;
			const body = a.addBody(r, {
				type: "dynamic",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			});
			body.gravityScale = 2;
			a.applyGravity(body);
			expect(body.forceZ).toBe(2 * body.mass);
		});

		it("gravityScale 0 keeps a body out of Z gravity too", () => {
			adapter.gravity = new Vector3d(0, 0, 1);
			const { body } = make();
			body.gravityScale = 0;
			adapter.applyGravity(body);
			expect(body.forceZ).toBe(0);
		});

		it("a Vector3d gravity with z 0 adds nothing", () => {
			adapter.gravity = new Vector3d(0, 1, 0);
			const { body } = make();
			adapter.applyGravity(body);
			expect(body.forceZ).toBe(0);
		});
	});

	describe("rotation", () => {
		it("getRotation is the body angle as a turn about Z", () => {
			const { r, body } = make();
			body.setAngle(Math.PI / 3);
			const q = adapter.getRotation(r);
			const expected = new Quaternion().rotate(
				Math.PI / 3,
				new Vector3d(0, 0, 1),
			);
			expect(q.equals(expected, 1e-6)).toBe(true);
		});

		it("getRotation writes into out", () => {
			const { r } = make();
			const out = new Quaternion(1, 2, 3, 4);
			expect(adapter.getRotation(r, out)).toBe(out);
			expect(out.isIdentity()).toBe(true);
		});

		it("setRotation about Z sets the body angle", () => {
			const { r, body } = make();
			adapter.setRotation(
				r,
				new Quaternion().rotate(-1.2, new Vector3d(0, 0, 1)),
			);
			expect(body.angle).toBeCloseTo(-1.2, 6);
		});

		it("a round trip through getRotation / setRotation keeps the angle", () => {
			const { r, body } = make();
			for (const a of [0.1, 2.5, -3, Math.PI - 0.01]) {
				body.setAngle(a);
				const q = adapter.getRotation(r);
				body.setAngle(0);
				adapter.setRotation(r, q);
				expect(body.angle).toBeCloseTo(a, 5);
			}
		});

		it("setRotation keeps only the part about Z of a tilted turn", () => {
			const { r, body } = make();
			// a turn about X takes +X to itself: no part about Z
			adapter.setRotation(r, new Quaternion().rotate(1, new Vector3d(1, 0, 0)));
			expect(body.angle).toBeCloseTo(0, 6);
			// about Z then about X: +X lands on the Z-turned direction, seen
			// down Z
			const q = new Quaternion()
				.rotate(0.7, new Vector3d(1, 0, 0))
				.multiply(new Quaternion().rotate(0.5, new Vector3d(0, 0, 1)));
			adapter.setRotation(r, q);
			const seen = new Vector3d(1, 0, 0);
			q.apply(seen);
			expect(body.angle).toBeCloseTo(Math.atan2(seen.y, seen.x), 6);
		});

		it("setRotation that points +X straight along Z leaves the angle", () => {
			const { r, body } = make();
			body.setAngle(0.4);
			adapter.setRotation(
				r,
				new Quaternion().rotate(Math.PI / 2, new Vector3d(0, 1, 0)),
			);
			// +X goes to -Z, give or take float noise, which must not be
			// read as a turn about Z
			expect(body.angle).toBeCloseTo(0.4, 10);
		});

		it("getAngularVelocity3d is (0, 0, ω)", () => {
			const { r } = make();
			adapter.setAngularVelocity(r, 0.25);
			const w = adapter.getAngularVelocity3d(r);
			expect([w.x, w.y, w.z]).toEqual([0, 0, 0.25]);
		});

		it("setAngularVelocity takes a Vector3d's z", () => {
			const { r, body } = make();
			adapter.setAngularVelocity(r, new Vector3d(9, 9, -0.5));
			expect(body.angularVelocity).toBe(-0.5);
			expect(adapter.getAngularVelocity(r)).toBe(-0.5);
		});
	});

	describe("a warning when real 3D is asked of it, and only then", () => {
		let warn;
		beforeEach(() => {
			resetWarnOnce();
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		});
		afterEach(() => {
			warn.mockRestore();
		});
		const warnings = () => {
			return warn.mock.calls.map((c) => {
				return String(c[0]);
			});
		};

		it("stays quiet for a 2D or 2.5D game: Box3d, Sphere, Vector3d motion, turns about Z", () => {
			const box = make(new Box3d(0, 0, 0, 32, 32, 32));
			const ball = make(new Sphere(0, 0, 0, 16));
			const flat = make();
			for (const { r } of [box, ball, flat]) {
				adapter.setVelocity(r, new Vector3d(1, 2, 3));
				adapter.applyForce(r, new Vector3d(1, 2, 3));
				adapter.applyImpulse(r, new Vector3d(1, 2, 3));
				adapter.setPosition(r, new Vector3d(1, 2, 3));
				adapter.setAngularVelocity(r, 0.5);
				adapter.setAngularVelocity(r, new Vector3d(0, 0, 0.5));
				adapter.setRotation(
					r,
					new Quaternion().rotate(1, new Vector3d(0, 0, 1)),
				);
				adapter.getRotation(r);
				adapter.getVelocity3d(r);
			}
			adapter.gravity = new Vector3d(0, 1, 1);
			adapter.step(16);
			expect(warnings()).toEqual([]);
		});

		it("names the 3D adapter for a shape it can only approximate, once per shape type", () => {
			make(new Capsule3d(0, 0, 0, 8, 40));
			make(new Capsule3d(0, 0, 0, 8, 40));
			make(new ConvexHull3d([0, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0, 9]));
			make(new TriangleMesh3d([0, 0, 0, 9, 0, 0, 0, 0, 9], [0, 1, 2]));
			const said = warnings();
			expect(said).toHaveLength(3);
			for (const [i, type] of [
				"Capsule3d",
				"ConvexHull3d",
				"TriangleMesh3d",
			].entries()) {
				expect(said[i]).toContain(type);
				expect(said[i]).toContain("@melonjs/rapier3d-adapter");
			}
		});

		it("names the 3D adapter for a turn about X or Y, once", () => {
			const { r, body } = make();
			const tilt = new Quaternion().rotate(0.5, new Vector3d(1, 0, 0));
			adapter.setRotation(r, tilt);
			adapter.setRotation(r, tilt);
			const said = warnings();
			expect(said).toHaveLength(1);
			expect(said[0]).toContain("setRotation");
			expect(said[0]).toContain("@melonjs/rapier3d-adapter");
			// and it still does what it says: the part about Z, none here
			expect(body.angle).toBeCloseTo(0, 6);
		});

		it("names the 3D adapter for a spin about X or Y, once, and keeps the spin about Z", () => {
			const { r, body } = make();
			adapter.setAngularVelocity(r, new Vector3d(2, 0, 0.25));
			adapter.setAngularVelocity(r, new Vector3d(0, 3, 0.25));
			const said = warnings();
			expect(said).toHaveLength(1);
			expect(said[0]).toContain("setAngularVelocity");
			expect(body.angularVelocity).toBe(0.25);
		});

		it("says nothing for a spin about X or Y that is not a number", () => {
			const { r } = make();
			adapter.setAngularVelocity(r, new Vector3d(Number.NaN, 0, 1));
			expect(warnings()).toEqual([]);
		});
	});
});
