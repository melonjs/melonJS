import { beforeAll, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";
import TMXObject from "../src/level/tiled/TMXObject.js";

// minimal mock map to satisfy TMXObject constructor
function mockMap(orientation = "orthogonal") {
	return {
		orientation,
		isEditor: true, // skip adjustPosition
		tilesets: {
			getTilesetByGid: () => {
				return null;
			},
		},
	};
}

describe("TMXObject", () => {
	beforeAll(() => {
		boot();
		video.init(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	describe("shape detection", () => {
		it("should detect rectangle (default, no shape marker)", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "rect", x: 0, y: 0, width: 64, height: 32 },
				0,
			);
			expect(obj.isEllipse).toEqual(false);
			expect(obj.isCapsule).toEqual(false);
			expect(obj.isPoint).toEqual(false);
			expect(obj.isPolygon).toEqual(false);
			expect(obj.isPolyLine).toEqual(false);
		});

		it("should detect ellipse", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "ell", x: 0, y: 0, width: 64, height: 32, ellipse: true },
				0,
			);
			expect(obj.isEllipse).toEqual(true);
			expect(obj.isCapsule).toEqual(false);
		});

		it("should detect capsule", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "cap", x: 0, y: 0, width: 64, height: 32, capsule: true },
				0,
			);
			expect(obj.isCapsule).toEqual(true);
			expect(obj.isEllipse).toEqual(false);
			expect(obj.isPolygon).toEqual(false);
		});

		it("should detect capsule from XML-parsed empty object", () => {
			// XML parser sets capsule to {} (empty parsed element)
			const obj = new TMXObject(
				mockMap(),
				{ name: "cap", x: 0, y: 0, width: 64, height: 32, capsule: {} },
				0,
			);
			expect(obj.isCapsule).toEqual(true);
		});

		it("should detect point", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "pt", x: 10, y: 20, point: true },
				0,
			);
			expect(obj.isPoint).toEqual(true);
		});

		it("should detect polygon", () => {
			const obj = new TMXObject(
				mockMap(),
				{
					name: "poly",
					x: 0,
					y: 0,
					polygon: [
						{ x: 0, y: 0 },
						{ x: 64, y: 0 },
						{ x: 64, y: 32 },
					],
				},
				0,
			);
			expect(obj.isPolygon).toEqual(true);
		});

		it("should detect polyline", () => {
			const obj = new TMXObject(
				mockMap(),
				{
					name: "line",
					x: 0,
					y: 0,
					polyline: [
						{ x: 0, y: 0 },
						{ x: 100, y: 0 },
					],
				},
				0,
			);
			expect(obj.isPolyLine).toEqual(true);
		});
	});

	describe("parseTMXShapes", () => {
		it("should create a polygon for rectangle", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 64, height: 32 },
				0,
			);
			expect(obj.shapes).toBeDefined();
			expect(obj.shapes.length).toEqual(1);
			expect(obj.shapes[0].type).toEqual("Polygon");
			expect(obj.shapes[0].points.length).toEqual(4);
		});

		it("should create an ellipse shape", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 64, height: 32, ellipse: true },
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			expect(obj.shapes[0].type).toEqual("Ellipse");
		});

		it("should create a RoundRect for capsule", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 100, height: 40, capsule: true },
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			expect(obj.shapes[0].type).toEqual("RoundRect");
			expect(obj.shapes[0].radius).toEqual(20); // min(100, 40) / 2
		});

		it("should create a horizontal capsule (width > height)", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 120, height: 40, capsule: true },
				0,
			);
			expect(obj.shapes[0].radius).toEqual(20); // 40 / 2
			expect(obj.shapes[0].width).toEqual(120);
			expect(obj.shapes[0].height).toEqual(40);
		});

		it("should create a vertical capsule (height > width)", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 30, height: 80, capsule: true },
				0,
			);
			expect(obj.shapes[0].radius).toEqual(15); // 30 / 2
		});

		it("should create a square capsule (circle-like)", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 50, height: 50, capsule: true },
				0,
			);
			expect(obj.shapes[0].radius).toEqual(25); // 50 / 2
		});

		it("capsule shape should be convex", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 100, height: 40, capsule: true },
				0,
			);
			expect(obj.shapes[0].isConvex()).toEqual(true);
		});

		it("capsule shape should have more than 4 vertices", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 100, height: 40, capsule: true },
				0,
			);
			expect(obj.shapes[0].points.length).toBeGreaterThan(4);
		});

		it("should create a polygon for convex polygon object", () => {
			const obj = new TMXObject(
				mockMap(),
				{
					name: "",
					x: 0,
					y: 0,
					polygon: [
						{ x: 0, y: 0 },
						{ x: 64, y: 0 },
						{ x: 64, y: 32 },
						{ x: 0, y: 32 },
					],
				},
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			expect(obj.shapes[0].type).toEqual("Polygon");
		});

		it("should create line segments for polyline", () => {
			const obj = new TMXObject(
				mockMap(),
				{
					name: "",
					x: 0,
					y: 0,
					polyline: [
						{ x: 0, y: 0 },
						{ x: 50, y: 0 },
						{ x: 100, y: 50 },
					],
				},
				0,
			);
			// 3 points = 2 segments
			expect(obj.shapes.length).toEqual(2);
			// Line extends Polygon, type is "Polygon"
			expect(obj.shapes[0].type).toEqual("Polygon");
		});

		it("should create a point shape", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 10, y: 20, point: true },
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			expect(obj.shapes[0].type).toEqual("Point");
		});

		it("should decompose concave polygon into convex triangles", () => {
			// L-shaped concave polygon
			const obj = new TMXObject(
				mockMap(),
				{
					name: "",
					x: 0,
					y: 0,
					polygon: [
						{ x: 0, y: 0 },
						{ x: 100, y: 0 },
						{ x: 100, y: 50 },
						{ x: 50, y: 50 },
						{ x: 50, y: 100 },
						{ x: 0, y: 100 },
					],
				},
				0,
			);
			// should produce multiple triangles
			expect(obj.shapes.length).toBeGreaterThan(1);
			for (const shape of obj.shapes) {
				expect(shape.type).toEqual("Polygon");
				expect(shape.points.length).toEqual(3); // triangle
			}
		});

		it("should apply rotation to rectangle shape", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 100, height: 50, rotation: 45 },
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			// rotated polygon — vertices should not be axis-aligned
			const pts = obj.shapes[0].points;
			// point[1] should not be at (100, 0) after 45° rotation
			expect(pts[1].y).not.toEqual(0);
		});

		it("should apply rotation to capsule shape", () => {
			const obj = new TMXObject(
				mockMap(),
				{
					name: "",
					x: 0,
					y: 0,
					width: 100,
					height: 40,
					rotation: 90,
					capsule: true,
				},
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			expect(obj.shapes[0].type).toEqual("RoundRect");
		});

		it("should apply rotation to ellipse shape", () => {
			const obj = new TMXObject(
				mockMap(),
				{
					name: "",
					x: 0,
					y: 0,
					width: 80,
					height: 40,
					rotation: 30,
					ellipse: true,
				},
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			expect(obj.shapes[0].type).toEqual("Ellipse");
		});

		it("should apply rotation to polyline segments", () => {
			const obj = new TMXObject(
				mockMap(),
				{
					name: "",
					x: 0,
					y: 0,
					rotation: 90,
					polyline: [
						{ x: 0, y: 0 },
						{ x: 100, y: 0 },
					],
				},
				0,
			);
			expect(obj.shapes.length).toEqual(1);
			// after 90° rotation, point at (100, 0) should be near (0, 100)
			const pts = obj.shapes[0].points;
			expect(pts[1].x).toBeCloseTo(0, 0);
			expect(pts[1].y).toBeCloseTo(100, 0);
		});
	});

	describe("basic properties", () => {
		it("should set position and dimensions", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "test", x: 10, y: 20, width: 100, height: 50 },
				5,
			);
			expect(obj.x).toEqual(10);
			expect(obj.y).toEqual(20);
			expect(obj.width).toEqual(100);
			expect(obj.height).toEqual(50);
			expect(obj.z).toEqual(5);
			expect(obj.name).toEqual("test");
		});

		it("should set rotation in radians", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 10, height: 10, rotation: 90 },
				0,
			);
			expect(obj.rotation).toBeCloseTo(Math.PI / 2);
		});

		it("should default rotation to 0", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, width: 10, height: 10 },
				0,
			);
			expect(obj.rotation).toEqual(0);
		});

		it("should set class from class attribute", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, class: "enemy" },
				0,
			);
			expect(obj.class).toEqual("enemy");
		});

		it("should fall back class to type (Tiled 1.10+)", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, type: "platform" },
				0,
			);
			expect(obj.class).toEqual("platform");
		});

		it("should set opacity (Tiled 1.12+)", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, opacity: 0.5 },
				0,
			);
			expect(obj.opacity).toEqual(0.5);
		});

		it("should default opacity to 1", () => {
			const obj = new TMXObject(mockMap(), { name: "", x: 0, y: 0 }, 0);
			expect(obj.opacity).toEqual(1);
		});

		it("should set visible flag", () => {
			const obj = new TMXObject(
				mockMap(),
				{ name: "", x: 0, y: 0, visible: 0 },
				0,
			);
			expect(obj.visible).toEqual(false);
		});
	});
});
