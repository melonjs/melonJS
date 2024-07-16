import { beforeEach, describe, expect, it } from "vitest";
import { Rect, RoundRect, Vector2d, pool } from "../src/index.js";

describe("Shape : RoundRect", () => {
	let rrect: RoundRect;
	beforeEach(() => {
		pool.register("Vector2d", Vector2d, true);
		rrect = new RoundRect(50, 50, 100, 100, 40);
	});

	it("rrect has finite coordinates", () => {
		expect(rrect.pos.x).toEqual(50);
		expect(rrect.pos.y).toEqual(50);
		expect(rrect.centerX).toEqual(100);
		expect(rrect.centerY).toEqual(100);
		expect(rrect.width).toEqual(100);
		expect(rrect.height).toEqual(100);
		expect(rrect.radius).toEqual(40);
	});

	describe("contains", () => {
		let rect: Rect;
		beforeEach(() => {
			pool.register("Vector2d", Vector2d, true);
			rect = new Rect(50, 50, 100, 100);
		});

		it("a rect of the same dimension does contain 51, 51", () => {
			expect(rect.contains(51, 51)).toEqual(true);
		});
		it("a rect of the same dimension does contain 51, 149", () => {
			expect(rect.contains(51, 149)).toEqual(true);
		});
		it("a rect of the same dimension does contain 149, 51", () => {
			expect(rect.contains(149, 51)).toEqual(true);
		});
		it("a rect of the same dimension does contain 149, 149", () => {
			expect(rect.contains(149, 149)).toEqual(true);
		});

		it("rrect does not contain 51, 51", () => {
			expect(rrect.contains(51, 51)).toEqual(false);
		});
		it("rrect does not contain 51, 149", () => {
			expect(rrect.contains(51, 149)).toEqual(false);
		});
		it("rrect does not contain 149, 51", () => {
			expect(rrect.contains(149, 51)).toEqual(false);
		});
		it("rrect does not contain 149, 149", () => {
			expect(rrect.contains(149, 149)).toEqual(false);
		});

		it("should contain another Rect fully within", () => {
			const innerRRect = new RoundRect(100, 100, 10, 10, 10);
			expect(rrect.containsRectangle(innerRRect)).toEqual(true);
		});

		it("should not contain another Rect partially outside", () => {
			const innerRRect = new RoundRect(75, 75, 175, 25, 10);
			expect(rrect.containsRectangle(innerRRect)).toEqual(false);
		});
	});

	describe("copy, clone & equality", () => {
		let _rect: RoundRect;
		beforeEach(() => {
			pool.register("Vector2d", Vector2d, true);
			_rect = new RoundRect(1, 1, 1, 1);
			_rect.copy(rrect);
		});

		it("copy rrect size, position radius", () => {
			expect(_rect.equals(rrect)).toEqual(true);
		});
		it("clone rect and test radius", () => {
			const cloneRect = _rect.clone();
			expect(cloneRect.radius).toEqual(40);
		});
	});
});
