/**
 * Regression coverage for TMX shape factory (`createShapeObject`).
 */

import { beforeAll, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";
import { createShapeObject } from "../src/level/tiled/factories/shape.js";

describe("createShapeObject — TMX shape factory", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
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
});
