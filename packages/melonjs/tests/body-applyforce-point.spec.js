/**
 * `Body.applyForce(x, y, pointX, pointY)` takes the application point in
 * WORLD coordinates — its TSDoc says so, its own example passes
 * `crate.pos.x + crate.width / 2`, and the matter and planck adapters read
 * the point that way. The lever arm was computed as
 * `point - body.bounds.center`, but `body.bounds` is renderable-local, so
 * the arm was off by the renderable's position: any body away from the
 * origin got the wrong torque, often of the wrong sign, and a force aimed
 * straight through the centroid spun the body.
 *
 * The centroid is now placed in the world the way SAT and raycast place a
 * body's shapes: the renderable's `pos`, less its anchor offset, plus its
 * parent's absolute position, plus the local bounds centre.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	BuiltinAdapter,
	boot,
	Container,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

describe("Physics : Body.applyForce application point is a world point", () => {
	let app;
	/** @type {BuiltinAdapter} */
	let adapter;
	/** @type {World} */
	let world;

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
		adapter = new BuiltinAdapter();
		world = new World(0, 0, 800, 600, adapter);
	});

	/**
	 * A 40x40 dynamic body covering its renderable, added to `parent`.
	 * @param {number} x - renderable x
	 * @param {number} y - renderable y
	 * @param {number[]} anchor - renderable anchorPoint
	 * @param {Container} [parent] - container to add it to (the world by default)
	 * @returns {{r: Renderable, body: object}}
	 */
	const makeCrate = (x, y, anchor, parent = world) => {
		const r = new Renderable(x, y, 40, 40);
		r.anchorPoint.set(anchor[0], anchor[1]);
		parent.addChild(r);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 40, 40)],
		});
		// the renderable's own world box: the drawn frame, which the shape
		// covers exactly, so its centre is the body's world centroid
		r.updateBounds();
		return { r, body };
	};

	describe("corner-anchored body away from the origin", () => {
		it("a force through the world centroid makes no torque", () => {
			const { r, body } = makeCrate(100, 50, [0, 0]);
			const b = r.getBounds();
			expect([b.centerX, b.centerY]).toEqual([120, 70]);
			body.applyForce(5, 0, b.centerX, b.centerY);
			expect(body.angularVelocity).toBe(0);
			expect(body.force.x).toBe(5);
		});

		it("the TSDoc example tips the crate clockwise (+), as at the origin", () => {
			const { r: crate, body } = makeCrate(100, 50, [0, 0]);
			const topX = crate.pos.x + crate.width / 2;
			const topY = crate.pos.y;
			body.applyForce(1.5, 0, topX, topY);
			// r = (0, -20), F = (1.5, 0): τ = -(-20 · 1.5) = +30
			expect(body.angularVelocity).toBeCloseTo(30 / body.pseudoInertia, 10);
		});

		it("the same push relative to the body gives the same spin wherever the body is", () => {
			const { body: atOrigin } = makeCrate(0, 0, [0, 0]);
			const { body: farAway } = makeCrate(500, 320, [0, 0]);
			// push down on the right edge, 20px right of and 5px below the centre
			atOrigin.applyForce(0, 2, 20 + 20, 20 + 5);
			farAway.applyForce(0, 2, 500 + 20 + 20, 320 + 20 + 5);
			expect(atOrigin.angularVelocity).toBeGreaterThan(0);
			expect(farAway.angularVelocity).toBeCloseTo(atOrigin.angularVelocity, 10);
		});

		it("a push below the centroid tips the body counter-clockwise (-)", () => {
			const { body } = makeCrate(300, 200, [0, 0]);
			// bottom centre (320, 240): r = (0, +20) → τ = -(20 · 1) = -20
			body.applyForce(1, 0, 320, 240);
			expect(body.angularVelocity).toBeCloseTo(-20 / body.pseudoInertia, 10);
		});

		it("the adapter's applyForce(renderable, force, point) reads the point the same way", () => {
			const { r, body } = makeCrate(100, 50, [0, 0]);
			adapter.applyForce(r, new Vector2d(5, 0), new Vector2d(120, 70));
			expect(body.angularVelocity).toBe(0);
			adapter.applyForce(r, new Vector2d(1.5, 0), new Vector2d(120, 50));
			expect(body.angularVelocity).toBeCloseTo(30 / body.pseudoInertia, 10);
		});
	});

	describe("centre-anchored body (the Renderable default)", () => {
		it("the centroid is at pos, where the shape is drawn and collides", () => {
			// anchor (0.5, 0.5): the 40x40 frame is drawn, and SAT collides
			// it, at pos - 20 .. pos + 20, so the centroid is `pos` itself
			const { r, body } = makeCrate(100, 50, [0.5, 0.5]);
			const b = r.getBounds();
			expect([b.centerX, b.centerY]).toEqual([100, 50]);
			body.applyForce(5, 0, 100, 50);
			expect(body.angularVelocity).toBe(0);
		});

		it("a push at the top centre tips it clockwise (+)", () => {
			const { r, body } = makeCrate(100, 50, [0.5, 0.5]);
			body.applyForce(1.5, 0, r.getBounds().centerX, r.getBounds().top);
			expect(body.angularVelocity).toBeCloseTo(30 / body.pseudoInertia, 10);
		});
	});

	describe("body inside an offset container", () => {
		it("the container's position is part of the world point", () => {
			const box = new Container(200, 100, 400, 300);
			world.addChild(box);
			const { r, body } = makeCrate(10, 20, [0, 0], box);
			const b = r.getBounds();
			// 200 + 10 + 20, 100 + 20 + 20
			expect([b.centerX, b.centerY]).toEqual([230, 140]);
			body.applyForce(5, 0, 230, 140);
			expect(body.angularVelocity).toBe(0);
			body.applyForce(1.5, 0, 230, 120);
			expect(body.angularVelocity).toBeCloseTo(30 / body.pseudoInertia, 10);
		});

		it("two levels deep, centre-anchored", () => {
			const outer = new Container(50, 40, 700, 500);
			const inner = new Container(30, 60, 600, 400);
			world.addChild(outer);
			outer.addChild(inner);
			const { r, body } = makeCrate(10, 20, [0.5, 0.5], inner);
			const b = r.getBounds();
			// 50 + 30 + 10 - 20 + 20, 40 + 60 + 20 - 20 + 20
			expect([b.centerX, b.centerY]).toEqual([90, 120]);
			body.applyForce(0, 3, b.centerX, b.centerY);
			expect(body.angularVelocity).toBe(0);
			// push down on the left edge: r = (-20, 0), F = (0, 1) → τ = -20
			body.applyForce(0, 1, b.left, b.centerY);
			expect(body.angularVelocity).toBeCloseTo(-20 / body.pseudoInertia, 10);
		});
	});

	describe("unchanged behaviour", () => {
		it("the 2-arg form stays linear only, wherever the body is", () => {
			const { body } = makeCrate(400, 300, [0, 0]);
			body.applyForce(3, -2);
			expect(body.force.x).toBe(3);
			expect(body.force.y).toBe(-2);
			expect(body.angularVelocity).toBe(0);
		});

		it("a body not added to any container measures from its own pos", () => {
			const r = new Renderable(100, 50, 40, 40);
			r.anchorPoint.set(0, 0);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 40, 40)],
			});
			body.applyForce(5, 0, 120, 70);
			expect(body.angularVelocity).toBe(0);
		});

		it("a rotated body still has no torque through its centroid", () => {
			// rotation pivots on the centroid, so it does not move it
			const { body } = makeCrate(100, 50, [0, 0]);
			body.setAngle(Math.PI / 3);
			body.applyForce(4, -1, 120, 70);
			expect(body.angularVelocity).toBe(0);
		});
	});
});
