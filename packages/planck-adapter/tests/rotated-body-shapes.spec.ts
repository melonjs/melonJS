/**
 * `getBodyShapes()` under rotation.
 *
 * The adapter contract says the returned shapes are the body's collision
 * shapes "in renderable-local coordinates", and names debug drawing and
 * hit-region queries as the consumers. Planck keeps rotation in the body's
 * transform rather than in the shape definitions it was given, so returning
 * `def.shapes` hands back the pose the body had at creation — for a rotated
 * body that is a shape which no longer matches where it collides.
 *
 * The visible symptom is the debug overlay: a spinning body draws an
 * axis-aligned hitbox. The real one is quieter — anything asking the adapter
 * where a rotated body's shapes are gets the wrong answer.
 */

import { Application, boot, Rect, Renderable, video, World } from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

describe("PlanckAdapter — getBodyShapes() follows the body's rotation", () => {
	let world: World;
	let adapter: PlanckAdapter;

	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new PlanckAdapter({ gravity: { x: 0, y: 0 } });
		world = new World(0, 0, 800, 600, adapter);
	});

	/**
	 * A square body, optionally rotated.
	 * @param angle - radians to rotate the body to
	 * @returns the renderable carrying the body
	 */
	const square = (angle: number) => {
		const r = new Renderable(100, 100, 40, 40);
		world.addChild(r);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 40, 40)],
		});
		if (angle !== 0) {
			adapter.setAngle(r, angle);
		}
		return r;
	};

	/**
	 * The axis-aligned extent of everything `getBodyShapes` returns, which is
	 * what a debug overlay ends up drawing.
	 * @param r - the renderable to measure
	 * @returns width and height of the union of the returned shapes
	 */
	const shapeExtent = (r: Renderable) => {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const shape of adapter.getBodyShapes(r)) {
			const b = shape.getBounds();
			minX = Math.min(minX, b.left);
			minY = Math.min(minY, b.top);
			maxX = Math.max(maxX, b.right);
			maxY = Math.max(maxY, b.bottom);
		}
		return { width: maxX - minX, height: maxY - minY };
	};

	it("returns the authored shapes while the body is unrotated", () => {
		// the baseline the rotated cases are measured against
		const r = square(0);
		const shapes = adapter.getBodyShapes(r);
		expect(shapes.length).toBeGreaterThan(0);
		const extent = shapeExtent(r);
		expect(extent.width).toBeCloseTo(40, 0);
		expect(extent.height).toBeCloseTo(40, 0);
	});

	it("widens a 40x40 square to ~57 across when turned 45°", () => {
		// a square rotated an eighth-turn spans its diagonal, 40 * sqrt(2).
		// Returning the authored def instead keeps reporting 40x40 — which is
		// the bug: the drawn hitbox stays axis-aligned while the body spins
		const r = square(Math.PI / 4);
		const extent = shapeExtent(r);
		expect(extent.width).toBeCloseTo(40 * Math.SQRT2, 0);
		expect(extent.height).toBeCloseTo(40 * Math.SQRT2, 0);
	});

	it("puts a non-square body's long axis where the rotation leaves it", () => {
		// 80x20 turned a quarter-turn is 20 wide and 80 tall. A square would
		// pass this test even unrotated, so the oblong is what makes it bite
		const r = new Renderable(100, 100, 80, 20);
		world.addChild(r);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 80, 20)],
		});
		adapter.setAngle(r, Math.PI / 2);
		const extent = shapeExtent(r);
		expect(extent.width).toBeCloseTo(20, 0);
		expect(extent.height).toBeCloseTo(80, 0);
	});

	it("tracks a body that keeps turning, not just its first pose", () => {
		// caching the rotated shapes is the obvious implementation, and a
		// cache that never invalidates passes every test above
		const r = square(0);
		expect(shapeExtent(r).width).toBeCloseTo(40, 0);
		adapter.setAngle(r, Math.PI / 4);
		expect(shapeExtent(r).width).toBeCloseTo(40 * Math.SQRT2, 0);
		adapter.setAngle(r, 0);
		expect(shapeExtent(r).width).toBeCloseTo(40, 0);
	});

	it("agrees with the angle the adapter reports", () => {
		const r = square(Math.PI / 4);
		expect(adapter.getAngle(r)).toBeCloseTo(Math.PI / 4, 5);
		expect(shapeExtent(r).width).toBeCloseTo(40 * Math.SQRT2, 0);
	});

	it("still returns nothing for a renderable with no body", () => {
		const r = new Renderable(0, 0, 10, 10);
		expect(adapter.getBodyShapes(r)).toEqual([]);
	});
});
