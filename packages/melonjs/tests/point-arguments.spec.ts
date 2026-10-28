import { describe, expect, it } from "vitest";
import {
	Ellipse,
	Line,
	Matrix2d,
	Matrix3d,
	ObservablePoint,
	ObservableVector2d,
	ObservableVector3d,
	Point,
	Polygon,
	Rect,
	Renderable,
	RoundRect,
	Vector2d,
	Vector3d,
} from "../src/index.js";

/**
 * Methods that take "a point or two numbers" used to tell them apart with
 * `instanceof Vector2d`. None of the other point types extends Vector2d, a
 * renderable's `pos` (an ObservableVector3d) included, so given one they took
 * the number branch: x became the object, y `undefined`, and the result NaN.
 * Every one of them must take any object with `x` and `y`.
 */
describe("point arguments: any {x, y} object", () => {
	// every point type at (10, 20); the 3D ones carry a z of 5
	const points = () => [
		new Vector2d(10, 20),
		new Vector3d(10, 20, 5),
		new Point(10, 20),
		new ObservableVector2d(10, 20, () => {}),
		new ObservableVector3d(10, 20, 5, () => {}),
		new ObservablePoint(10, 20, () => {}),
		{ x: 10, y: 20 },
	];
	// a renderable's pos, the case that found the bug
	const renderable = new Renderable(10, 20, 32, 48);

	it("Polygon translate, shift and contains", () => {
		for (const p of [...points(), renderable.pos]) {
			const square = () =>
				new Polygon(0, 0, [
					{ x: 0, y: 0 },
					{ x: 30, y: 0 },
					{ x: 30, y: 30 },
					{ x: 0, y: 30 },
				]);
			const t = square().translate(p);
			expect([t.pos.x, t.pos.y]).toEqual([10, 20]);
			expect(t.getBounds().left).toEqual(10);

			const s = square();
			s.translate(3, 3);
			s.shift(p);
			expect([s.pos.x, s.pos.y]).toEqual([10, 20]);

			expect(square().contains(p)).toEqual(true);
			expect(square().translate(50, 50).contains(p)).toEqual(false);
		}
	});

	it("Rect contains, and the translate and shift it inherits", () => {
		for (const p of [...points(), renderable.pos]) {
			expect(new Rect(0, 0, 30, 30).contains(p)).toEqual(true);
			expect(new Rect(50, 50, 30, 30).contains(p)).toEqual(false);

			const r = new Rect(0, 0, 30, 30);
			r.shift(p);
			expect([r.left, r.top]).toEqual([10, 20]);
			r.translate(p);
			expect([r.left, r.top]).toEqual([20, 40]);
		}
	});

	it("RoundRect contains", () => {
		for (const p of [...points(), renderable.pos]) {
			expect(new RoundRect(0, 0, 40, 40, 4).contains(p)).toEqual(true);
			expect(new RoundRect(50, 50, 40, 40, 4).contains(p)).toEqual(false);
		}
	});

	it("Ellipse translate and contains", () => {
		for (const p of [...points(), renderable.pos]) {
			const e = new Ellipse(0, 0, 10, 10).translate(p);
			expect([e.pos.x, e.pos.y]).toEqual([10, 20]);

			expect(new Ellipse(10, 20, 8, 8).contains(p)).toEqual(true);
			expect(new Ellipse(60, 60, 8, 8).contains(p)).toEqual(false);
		}
	});

	it("Line contains", () => {
		for (const p of [...points(), renderable.pos]) {
			// from the origin through (10, 20)
			const through = new Line(0, 0, [
				{ x: 0, y: 0 },
				{ x: 20, y: 40 },
			]);
			expect(through.contains(p)).toEqual(true);
			const beside = new Line(0, 0, [
				{ x: 0, y: 0 },
				{ x: 40, y: 20 },
			]);
			expect(beside.contains(p)).toEqual(false);
		}
	});

	it("Matrix2d translate", () => {
		for (const p of [...points(), renderable.pos]) {
			const m = new Matrix2d().translate(p);
			expect([m.tx, m.ty]).toEqual([10, 20]);
		}
	});

	it("Matrix3d translate, with z from a 3D point and 0 from a 2D one", () => {
		for (const p of points()) {
			const m = new Matrix3d().translate(p);
			const z = "z" in p ? 5 : 0;
			expect([m.val[12], m.val[13], m.val[14]]).toEqual([10, 20, z]);
		}
		// a renderable's pos carries its own z
		const sprite = new Renderable(10, 20, 32, 48);
		sprite.pos.z = 7;
		const m = new Matrix3d().translate(sprite.pos);
		expect([m.val[12], m.val[13], m.val[14]]).toEqual([10, 20, 7]);
	});

	it("two numbers still work everywhere", () => {
		expect(new Rect(0, 0, 30, 30).contains(10, 20)).toEqual(true);
		expect(new Ellipse(10, 20, 8, 8).contains(10, 20)).toEqual(true);
		expect(new RoundRect(0, 0, 40, 40, 4).contains(10, 20)).toEqual(true);
		const m2 = new Matrix2d().translate(10, 20);
		expect([m2.tx, m2.ty]).toEqual([10, 20]);
		const m3 = new Matrix3d().translate(10, 20, 5);
		expect([m3.val[12], m3.val[13], m3.val[14]]).toEqual([10, 20, 5]);
		const m3flat = new Matrix3d().translate(10, 20);
		expect(m3flat.val[14]).toEqual(0);
	});
});
