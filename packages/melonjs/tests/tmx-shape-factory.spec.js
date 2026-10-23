/**
 * Regression coverage for TMX shape factory (`createShapeObject`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Point,
	Polygon,
	Rect,
	Vector2d,
	video,
} from "../src/index.js";
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

	// The broadphase files an object by getBounds(), which starts at pos.
	// A shape reaching left of or above the object's origin (every
	// rectangle on an isometric map, once projected) was left out of it, so
	// the object was filed where it is not, and walked through.
	describe("bounds cover the shapes", () => {
		// a 20 x 256 wall from an isometric collision layer, after toIso()
		function isoWall() {
			return new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(20, 10),
				new Vector2d(-236, 138),
				new Vector2d(-256, 128),
			]);
		}
		function wallObject(x = 300, y = 100) {
			return createShapeObject({
				id: 9,
				name: "",
				type: "",
				x,
				y,
				width: 20,
				height: 256,
				shapes: [isoWall()],
			});
		}
		// where each vertex is in the world
		function vertices(obj) {
			const shape = obj.bodyDef.shapes[0];
			return shape.points.map((p) => {
				return [obj.pos.x + shape.pos.x + p.x, obj.pos.y + shape.pos.y + p.y];
			});
		}

		it("covers a shape that reaches left of the origin", () => {
			const b = wallObject().getBounds();
			expect([b.left, b.top, b.right, b.bottom]).toEqual([44, 100, 320, 238]);
		});

		it("leaves the shape where it was in the world", () => {
			expect(vertices(wallObject())).toEqual([
				[300, 100],
				[320, 110],
				[64, 238],
				[44, 228],
			]);
		});

		it("is found by queryAABB where the shape is", () => {
			const wall = wallObject();
			app.world.addChild(wall);
			try {
				app.world.update(16);
				// on the wall's lower end, far left of its origin
				const found = app.world.adapter.queryAABB(new Rect(55, 225, 10, 10));
				expect(found).toContain(wall);
			} finally {
				app.world.removeChildNow(wall);
			}
		});

		it("is hit by a raycast where the shape is", () => {
			const wall = wallObject();
			app.world.addChild(wall);
			try {
				app.world.update(16);
				// a vertical ray across the wall's lower end
				const hit = app.world.adapter.raycast(
					new Vector2d(60, 150),
					new Vector2d(60, 300),
				);
				expect(hit?.renderable).toBe(wall);
			} finally {
				app.world.removeChildNow(wall);
			}
		});

		it("keeps the position of a shape that starts at the origin", () => {
			const obj = createShapeObject({
				id: 10,
				name: "",
				type: "",
				x: 32,
				y: 64,
				width: 16,
				height: 8,
			});
			expect([obj.pos.x, obj.pos.y]).toEqual([32, 64]);
			const b = obj.getBounds();
			expect([b.left, b.top, b.right, b.bottom]).toEqual([32, 64, 48, 72]);
		});

		it("keeps the position of a point object", () => {
			const obj = createShapeObject({
				id: 11,
				name: "spawn",
				type: "",
				x: 40,
				y: 50,
				width: 0,
				height: 0,
				shapes: [new Point(40, 50)],
			});
			expect([obj.pos.x, obj.pos.y]).toEqual([40, 50]);
		});
	});
});
