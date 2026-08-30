/**
 * Regression coverage for TMX shape factory (`createShapeObject`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";
import { createShapeObject } from "../src/level/tiled/factories/shape.js";
import { getDefaultShape } from "../src/level/tiled/TMXObjectFactory.js";

describe("createShapeObject — TMX shape factory", () => {
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
		// release the WebGL context this describe owns — browsers cap
		// live contexts, and a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	// Regression: when `getDefaultShape` returns null/undefined (degenerate
	// TMX object), the factory used to assign `bodyDef.shapes = [undefined]`
	// and crash downstream with a cryptic "cannot read .pos" error. Now it
	// throws an informative error naming the offending object.
	// `getDefaultShape` returns `settings.shapes` verbatim when defined, so
	// passing `shapes: null` exercises the null-return branch.
	it("throws a descriptive error when settings.shapes is null", () => {
		expect(() => {
			createShapeObject({
				id: 42,
				name: "broken-object",
				type: "slope",
				x: 0,
				y: 0,
				width: 70,
				height: 70,
				shapes: null,
			});
		}).toThrow(/id=42.*broken-object.*slope/);
	});

	it("throws when settings.shapes is an empty array", () => {
		expect(() => {
			createShapeObject({
				id: 1,
				name: "",
				type: "",
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				shapes: [],
			});
		}).toThrow(/no usable collision shape/);
	});
	describe("getDefaultShape — the fallback rectangle", () => {
		// A Tiled object with no explicit geometry is a rectangle. The
		// fallback built one from three vertices — (0,0), (w,0), (w,h) —
		// which is the upper-right triangle, so the lower-left half of every
		// such object was not solid.
		it("returns a four-vertex rectangle covering the whole object", () => {
			const shape = getDefaultShape({ width: 32, height: 32 });

			expect(shape.points).toHaveLength(4);
			expect(
				shape.points.map((p) => {
					return [p.x, p.y];
				}),
			).toEqual([
				[0, 0],
				[32, 0],
				[32, 32],
				[0, 32],
			]);
		});

		it("contains a point in the lower-left half", () => {
			const shape = getDefaultShape({ width: 32, height: 32 });
			// inside the rectangle, outside the old triangle (y > x)
			expect(shape.contains(4, 28)).toBe(true);
		});

		it("gives an unnamed TMX rect a body covering its full extent", () => {
			const obj = createShapeObject({
				id: 7,
				name: "",
				type: "",
				x: 0,
				y: 0,
				width: 32,
				height: 32,
			});

			expect(obj.bodyDef.shapes[0].contains(4, 28)).toBe(true);
		});
	});
});
