import { beforeEach, describe, expect, it } from "vitest";
import { Matrix2d, Polygon, Vector2d } from "../src/index.js";

describe("Shape : Polygon", () => {
	describe("Constructor", () => {
		it("creates from XYPoint array", () => {
			const poly = new Polygon(10, 20, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 50 },
				{ x: 0, y: 50 },
			]);
			expect(poly.pos.x).toEqual(10);
			expect(poly.pos.y).toEqual(20);
			expect(poly.points.length).toEqual(4);
		});

		it("creates from Vector2d array", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			expect(poly.points.length).toEqual(4);
			expect(poly.points[1].x).toEqual(100);
		});

		it("creates from flat number array", () => {
			const poly = new Polygon(0, 0, [0, 0, 100, 0, 100, 100, 0, 100]);
			expect(poly.points.length).toEqual(4);
			expect(poly.points[2].x).toEqual(100);
			expect(poly.points[2].y).toEqual(100);
		});

		it("requires at least 3 points", () => {
			expect(() => {
				return new Polygon(0, 0, [
					{ x: 0, y: 0 },
					{ x: 28, y: 60 },
				]);
			}).toThrow();
		});

		it("type is 'Polygon'", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 25, y: 50 },
			]);
			expect(poly.type).toEqual("Polygon");
		});
	});

	describe("Bounding box", () => {
		it("has correct initial bounds", () => {
			const poly = new Polygon(10, 20, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 50 },
				{ x: 0, y: 50 },
			]);
			const bounds = poly.getBounds();
			expect(bounds.x).toEqual(10);
			expect(bounds.y).toEqual(20);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(50);
		});

		it("handles negative point coordinates", () => {
			const poly = new Polygon(0, 0, [
				{ x: -50, y: -50 },
				{ x: 50, y: -50 },
				{ x: 50, y: 50 },
				{ x: -50, y: 50 },
			]);
			const bounds = poly.getBounds();
			expect(bounds.x).toEqual(-50);
			expect(bounds.y).toEqual(-50);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
		});

		it("star shape bounds", () => {
			const stars = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 28, y: 60 },
				{ x: 94, y: 70 },
				{ x: 46, y: 114 },
				{ x: 88, y: 180 },
				{ x: 0, y: 125 },
				{ x: -88, y: 180 },
				{ x: -46, y: 114 },
				{ x: -94, y: 70 },
				{ x: -28, y: 60 },
			]);
			const bounds = stars.getBounds();
			expect(bounds.x).toEqual(-94);
			expect(bounds.y).toEqual(0);
			expect(bounds.width).toEqual(188);
			expect(bounds.height).toEqual(180);
		});
	});

	describe("setShape", () => {
		it("updates position and vertices", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
				{ x: 0, y: 10 },
			]);
			poly.setShape(50, 50, [
				{ x: 0, y: 0 },
				{ x: 200, y: 0 },
				{ x: 200, y: 100 },
				{ x: 0, y: 100 },
			]);
			expect(poly.pos.x).toEqual(50);
			expect(poly.pos.y).toEqual(50);
			expect(poly.points.length).toEqual(4);
			const bounds = poly.getBounds();
			expect(bounds.x).toEqual(50);
			expect(bounds.y).toEqual(50);
			expect(bounds.width).toEqual(200);
			expect(bounds.height).toEqual(100);
		});

		it("recalculates edges and normals", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
				{ x: 0, y: 10 },
			]);
			const edgeCount = poly.edges.length;
			poly.setShape(0, 0, [
				{ x: 0, y: 0 },
				{ x: 20, y: 0 },
				{ x: 10, y: 20 },
			]);
			expect(poly.edges.length).toEqual(3);
			expect(poly.normals.length).toEqual(3);
			expect(poly.edges.length).not.toEqual(edgeCount);
		});
	});

	describe("translate", () => {
		it("translates by x, y", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 50 },
				{ x: 0, y: 50 },
			]);
			poly.translate(10, 20);
			expect(poly.pos.x).toEqual(10);
			expect(poly.pos.y).toEqual(20);
		});

		it("translates by Vector2d", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 50 },
				{ x: 0, y: 50 },
			]);
			poly.translate(new Vector2d(30, 40));
			expect(poly.pos.x).toEqual(30);
			expect(poly.pos.y).toEqual(40);
		});

		it("updates bounds after translate", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 50 },
				{ x: 0, y: 50 },
			]);
			poly.translate(100, 200);
			const bounds = poly.getBounds();
			expect(bounds.x).toEqual(100);
			expect(bounds.y).toEqual(200);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(50);
		});

		it("returns this for chaining", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 25, y: 50 },
			]);
			expect(poly.translate(1, 1)).toBe(poly);
		});
	});

	describe("shift", () => {
		it("sets position absolutely", () => {
			const poly = new Polygon(100, 100, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 50 },
				{ x: 0, y: 50 },
			]);
			poly.shift(10, 20);
			expect(poly.pos.x).toEqual(10);
			expect(poly.pos.y).toEqual(20);
		});

		it("shifts by Vector2d", () => {
			const poly = new Polygon(100, 100, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 50 },
				{ x: 0, y: 50 },
			]);
			poly.shift(new Vector2d(30, 40));
			expect(poly.pos.x).toEqual(30);
			expect(poly.pos.y).toEqual(40);
		});

		it("updates bounds after shift", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 50 },
				{ x: 0, y: 50 },
			]);
			poly.shift(50, 50);
			const bounds = poly.getBounds();
			expect(bounds.x).toEqual(50);
			expect(bounds.y).toEqual(50);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(50);
		});
	});

	describe("rotate", () => {
		it("rotates points", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			poly.rotate(Math.PI / 2);
			// (100, 0) rotated 90° → (0, 100)
			expect(poly.points[1].x).toBeCloseTo(0);
			expect(poly.points[1].y).toBeCloseTo(100);
		});

		it("does nothing for angle 0", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			const x1 = poly.points[1].x;
			poly.rotate(0);
			expect(poly.points[1].x).toEqual(x1);
		});

		it("updates bounds after rotate", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			poly.rotate(Math.PI / 2);
			const bounds = poly.getBounds();
			expect(bounds.width).toBeCloseTo(50);
			expect(bounds.height).toBeCloseTo(100);
		});

		it("recalculates edges and normals after rotate", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			const edgeBefore = { x: poly.edges[0].x, y: poly.edges[0].y };
			poly.rotate(Math.PI / 2);
			expect(poly.edges[0].x).not.toBeCloseTo(edgeBefore.x);
		});

		it("invalidates indices after rotate", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			poly.getIndices();
			expect(poly.indices.length).toBeGreaterThan(0);
			poly.rotate(Math.PI / 4);
			expect(poly.indices.length).toEqual(0);
		});

		it("rotates around external point", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(100, 0),
				new Vector2d(200, 0),
				new Vector2d(200, 50),
				new Vector2d(100, 50),
			]);
			poly.rotate(Math.PI / 2, { x: 0, y: 0 });
			// (100, 0) rotated 90° around origin → (0, 100)
			expect(poly.points[0].x).toBeCloseTo(0);
			expect(poly.points[0].y).toBeCloseTo(100);
		});

		it("returns this for chaining", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 25, y: 50 },
			]);
			expect(poly.rotate(0.1)).toBe(poly);
		});
	});

	describe("scale", () => {
		it("scales uniformly", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.scale(2);
			expect(poly.points[1].x).toEqual(100);
			expect(poly.points[2].y).toEqual(100);
		});

		it("scales non-uniformly", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.scale(2, 3);
			expect(poly.points[1].x).toEqual(100);
			expect(poly.points[2].y).toEqual(150);
		});

		it("scaleV with vector", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.scaleV(new Vector2d(3, 2));
			expect(poly.points[1].x).toEqual(150);
			expect(poly.points[2].y).toEqual(100);
		});

		it("updates bounds after scale", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.scale(3);
			const bounds = poly.getBounds();
			expect(bounds.width).toEqual(150);
			expect(bounds.height).toEqual(150);
		});

		it("recalculates edges after scale", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.scale(2);
			// edge 0: from (0,0) to (100,0) → direction (100, 0)
			expect(poly.edges[0].x).toEqual(100);
			expect(poly.edges[0].y).toEqual(0);
		});

		it("invalidates indices after scale", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.getIndices();
			expect(poly.indices.length).toBeGreaterThan(0);
			poly.scale(2);
			expect(poly.indices.length).toEqual(0);
		});

		it("returns this for chaining", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 25, y: 50 },
			]);
			expect(poly.scale(2)).toBe(poly);
		});
	});

	describe("transform", () => {
		it("applies translation from matrix", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			const m = new Matrix2d();
			m.translate(100, 200);
			poly.transform(m);
			expect(poly.points[0].x).toBeCloseTo(100);
			expect(poly.points[0].y).toBeCloseTo(200);
		});

		it("applies scale from matrix", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			const m = new Matrix2d();
			m.scale(2, 3);
			poly.transform(m);
			expect(poly.points[1].x).toBeCloseTo(100);
			expect(poly.points[2].y).toBeCloseTo(150);
		});

		it("applies rotation from matrix", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			const m = new Matrix2d();
			m.rotate(Math.PI / 2);
			poly.transform(m);
			// (100, 0) rotated 90° → (0, 100)
			expect(poly.points[1].x).toBeCloseTo(0);
			expect(poly.points[1].y).toBeCloseTo(100);
		});

		it("updates bounds after transform", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			const m = new Matrix2d();
			m.scale(2, 2);
			poly.transform(m);
			const bounds = poly.getBounds();
			expect(bounds.width).toBeCloseTo(100);
			expect(bounds.height).toBeCloseTo(100);
		});

		it("recalculates edges and normals after transform", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			const m = new Matrix2d();
			m.scale(3, 3);
			poly.transform(m);
			// edge 0: from (0,0) to (150,0)
			expect(poly.edges[0].x).toBeCloseTo(150);
			expect(poly.edges[0].y).toBeCloseTo(0);
		});

		it("invalidates indices after transform", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.getIndices();
			expect(poly.indices.length).toBeGreaterThan(0);
			const m = new Matrix2d();
			m.scale(2, 2);
			poly.transform(m);
			expect(poly.indices.length).toEqual(0);
		});

		it("returns this for chaining", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 25, y: 50 },
			]);
			expect(poly.transform(new Matrix2d())).toBe(poly);
		});
	});

	describe("contains", () => {
		let square;

		beforeEach(() => {
			square = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
		});

		it("contains point inside", () => {
			expect(square.contains(50, 50)).toEqual(true);
		});

		it("does not contain point outside", () => {
			expect(square.contains(150, 50)).toEqual(false);
		});

		it("contains with Vector2d argument", () => {
			expect(square.contains(new Vector2d(50, 50))).toEqual(true);
			expect(square.contains(new Vector2d(150, 150))).toEqual(false);
		});

		it("contains point in translated polygon", () => {
			square.translate(100, 100);
			expect(square.contains(150, 150)).toEqual(true);
			expect(square.contains(50, 50)).toEqual(false);
		});

		it("contains point in scaled polygon", () => {
			square.scale(2);
			expect(square.contains(150, 150)).toEqual(true);
			expect(square.contains(250, 50)).toEqual(false);
		});

		it("contains point in rotated polygon", () => {
			// rotate 45° — the square becomes a diamond
			square.rotate(Math.PI / 4);
			// center of original square was (50, 50), rotated it's roughly still the center area
			expect(square.contains(50, 50)).toEqual(true);
		});

		it("star contains center", () => {
			const stars = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 28, y: 60 },
				{ x: 94, y: 70 },
				{ x: 46, y: 114 },
				{ x: 88, y: 180 },
				{ x: 0, y: 125 },
				{ x: -88, y: 180 },
				{ x: -46, y: 114 },
				{ x: -94, y: 70 },
				{ x: -28, y: 60 },
			]);
			expect(stars.contains(0, 90)).toEqual(true);
			expect(stars.contains(200, 200)).toEqual(false);
		});
	});

	describe("getIndices", () => {
		it("returns triangle indices for a square", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			const indices = poly.getIndices();
			// 4 vertices → 2 triangles → 6 indices
			expect(indices.length).toEqual(6);
		});

		it("returns triangle indices for a triangle", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(50, 100),
			]);
			const indices = poly.getIndices();
			// 3 vertices → 1 triangle → 3 indices
			expect(indices.length).toEqual(3);
		});

		it("caches indices", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			const indices1 = poly.getIndices();
			const indices2 = poly.getIndices();
			expect(indices1).toBe(indices2);
		});

		it("indices are invalidated by recalc", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			poly.getIndices();
			expect(poly.indices.length).toEqual(6);
			poly.recalc();
			expect(poly.indices.length).toEqual(0);
			// re-fetch should recompute
			const indices = poly.getIndices();
			expect(indices.length).toEqual(6);
		});

		it("returns correct indices for complex polygon", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 120, y: 50 },
				{ x: 100, y: 100 },
				{ x: 0, y: 100 },
			]);
			const indices = poly.getIndices();
			// 5 vertices → 3 triangles → 9 indices
			expect(indices.length).toEqual(9);
			// all indices should be valid vertex references
			for (const idx of indices) {
				expect(idx).toBeGreaterThanOrEqual(0);
				expect(idx).toBeLessThan(5);
			}
		});
	});

	describe("edges and normals", () => {
		it("has correct number of edges and normals", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			expect(poly.edges.length).toEqual(4);
			expect(poly.normals.length).toEqual(4);
		});

		it("edges represent direction between consecutive points", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			// edge 0: (100,0) - (0,0) = (100, 0)
			expect(poly.edges[0].x).toEqual(100);
			expect(poly.edges[0].y).toEqual(0);
			// edge 1: (100,50) - (100,0) = (0, 50)
			expect(poly.edges[1].x).toEqual(0);
			expect(poly.edges[1].y).toEqual(50);
		});

		it("normals are perpendicular to edges", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			for (let i = 0; i < poly.edges.length; i++) {
				const dot =
					poly.edges[i].x * poly.normals[i].x +
					poly.edges[i].y * poly.normals[i].y;
				expect(dot).toBeCloseTo(0);
			}
		});

		it("normals are unit length", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			for (const normal of poly.normals) {
				const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
				expect(len).toBeCloseTo(1.0);
			}
		});

		it("edges shrink when polygon gets fewer vertices", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			expect(poly.edges.length).toEqual(4);
			poly.setVertices([
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(25, 50),
			]);
			expect(poly.edges.length).toEqual(3);
			expect(poly.normals.length).toEqual(3);
		});
	});

	describe("isConvex", () => {
		it("square is convex", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			expect(poly.isConvex()).toEqual(true);
		});

		it("concave polygon is not convex", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(50, 50),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			expect(poly.isConvex()).toEqual(false);
		});

		it("triangle is convex", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(50, 100),
			]);
			expect(poly.isConvex()).toEqual(true);
		});
	});

	describe("clone", () => {
		it("creates an independent copy", () => {
			const poly = new Polygon(10, 20, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			const cloned = poly.clone();
			expect(cloned.pos.x).toEqual(10);
			expect(cloned.pos.y).toEqual(20);
			expect(cloned.points.length).toEqual(4);
			// modifying original doesn't affect clone
			poly.translate(100, 100);
			expect(cloned.pos.x).toEqual(10);
		});

		it("cloned points are independent", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			const cloned = poly.clone();
			poly.points[0].x = 999;
			expect(cloned.points[0].x).toEqual(0);
		});

		it("cloned polygon has correct bounds", () => {
			const poly = new Polygon(10, 20, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
				new Vector2d(0, 50),
			]);
			const cloned = poly.clone();
			const bounds = cloned.getBounds();
			expect(bounds.x).toEqual(10);
			expect(bounds.y).toEqual(20);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(50);
		});
	});

	describe("Isometric transformation", () => {
		it("toIso and to2d are inverse operations", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(32, 0),
				new Vector2d(32, 32),
				new Vector2d(0, 32),
			]);
			poly.toIso();
			expect(poly.points[1].y).toBeCloseTo(16, 3);
			expect(poly.points[3].x).toBeCloseTo(-32, 3);
			expect(poly.points[3].y).toBeCloseTo(16, 3);
			poly.to2d();
			expect(poly.points[1].x).toBeCloseTo(32, 3);
			expect(poly.points[1].y).toBeCloseTo(0, 3);
			expect(poly.points[3].x).toBeCloseTo(0, 3);
			expect(poly.points[3].y).toBeCloseTo(32, 3);
		});
	});

	describe("combined transformations", () => {
		it("bounds correct after scale + rotate", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(32, 0),
				new Vector2d(32, 32),
				new Vector2d(0, 32),
			]);
			poly.scale(2.0).rotate(Math.PI / 4);
			expect(Math.floor(poly.getBounds().width)).toEqual(90);
			expect(Math.floor(poly.getBounds().height)).toEqual(90);
		});

		it("bounds correct after translate + scale", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(50, 0),
				new Vector2d(50, 50),
				new Vector2d(0, 50),
			]);
			poly.translate(100, 100);
			poly.scale(2);
			const bounds = poly.getBounds();
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
			expect(bounds.x).toEqual(100);
			expect(bounds.y).toEqual(100);
		});

		it("indices recalculated correctly after transform chain", () => {
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 100),
				new Vector2d(0, 100),
			]);
			poly.getIndices();
			expect(poly.indices.length).toEqual(6);
			poly.scale(2).rotate(Math.PI / 4);
			// indices cleared by both scale and rotate
			expect(poly.indices.length).toEqual(0);
			// re-fetch recomputes
			const indices = poly.getIndices();
			expect(indices.length).toEqual(6);
			for (const idx of indices) {
				expect(idx).toBeGreaterThanOrEqual(0);
				expect(idx).toBeLessThan(4);
			}
		});
	});
});
