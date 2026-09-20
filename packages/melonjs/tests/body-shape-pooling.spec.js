import { beforeAll, describe, expect, it } from "vitest";
import { polygonPool } from "../src/geometries/polygon.ts";
import { roundedRectanglePool } from "../src/geometries/roundrect.ts";
import {
	Body,
	boot,
	Ellipse,
	Line,
	Polygon,
	Rect,
	Renderable,
	RoundRect,
	Vector2d,
} from "../src/index.js";

/**
 * Where a body's shapes go when it is destroyed.
 *
 * `Line`, `Rect` and `RoundRect` all extend `Polygon`, so the release chain in
 * `Body#destroy` is order-sensitive: whichever `instanceof` runs first wins,
 * and a subclass caught by the `Polygon` branch is handed to the WRONG pool.
 * That is silent — the pool hands the wrong class to its next caller, which
 * fails somewhere unrelated — so it is pinned here rather than left to the
 * branch ordering being read correctly by whoever edits it next.
 */
describe("Body#destroy returns each shape to its own pool", () => {
	beforeAll(() => {
		boot();
	});

	/**
	 * @param {object} shape - the collision shape to give the body
	 * @returns {Body} a body holding it, ready to destroy
	 */
	const bodyWith = (shape) => {
		return new Body(new Renderable(0, 0, 32, 32), [shape]);
	};

	it("gives a RoundRect back to the RoundRect pool, not the Polygon pool", () => {
		// it extends Polygon and `addShape` keeps it as-is, so without its own
		// branch it lands in `polygonPool` and the next caller asking for a
		// Polygon receives a RoundRect
		const before = polygonPool.size();
		bodyWith(new RoundRect(0, 0, 20, 10, 4)).destroy();

		expect(polygonPool.size()).toBe(before);
		const recycled = roundedRectanglePool.get(0, 0, 8, 8, 2);
		expect(recycled).toBeInstanceOf(RoundRect);
		roundedRectanglePool.release(recycled);
	});

	it("never leaves a non-Polygon in the Polygon pool", () => {
		// the whole point of the ordered chain: every shape a body can hold
		// comes back as the class its own pool promises
		for (const shape of [
			new RoundRect(0, 0, 20, 10, 4),
			new Line(0, 0, [new Vector2d(0, 0), new Vector2d(8, 0)]),
			new Ellipse(0, 0, 10, 10),
			new Rect(0, 0, 10, 10),
			new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(8, 0),
				new Vector2d(8, 8),
			]),
		]) {
			bodyWith(shape).destroy();
		}

		// drain the polygon pool and check nothing in it is a subclass
		const drained = [];
		while (polygonPool.size() > 0) {
			const p = polygonPool.get(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(4, 0),
				new Vector2d(4, 4),
			]);
			drained.push(p);
			expect(p instanceof RoundRect, "RoundRect leaked into polygonPool").toBe(
				false,
			);
			expect(p instanceof Line, "Line leaked into polygonPool").toBe(false);
		}
		for (const p of drained) {
			polygonPool.release(p);
		}
	});
});
