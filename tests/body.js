import { describe, expect, it } from "vitest";
import { Body, Rect, Renderable } from "../src/index.js";

describe("Physics : Body", () => {
	var shape = new Rect(10, 10, 32, 64);
	var parent = new Renderable(0, 0, 32, 64);
	var body = new Body(parent, shape);

	describe("bound coordinates", () => {
		it("body has correct bounds", () => {
			var bounds = body.getBounds();
			expect(bounds.left).toEqual(10);
			expect(bounds.top).toEqual(10);
			expect(bounds.width).toEqual(32);
			expect(bounds.height).toEqual(64);
		});
	});
});
