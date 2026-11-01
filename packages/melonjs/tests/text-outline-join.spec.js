import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, Text, video } from "../src/index.js";

/**
 * A Text's outline is drawn whole, whatever its corners.
 *
 * A canvas strokes text with pointed ("miter") corners by default, and lets a
 * point reach up to `miterLimit` (10) half line widths past its corner: on a
 * sharp glyph such as an "A" or an "M", several times the half width the bake
 * left room for, so the tips were cut flat. The bake left no room at all on
 * the sides, so the outline of a leading "A" lost its left edge, whatever the
 * corners.
 *
 * Outlines now have round corners by default, as in most game engines, and
 * `lineJoin` / `miterLimit` choose others; the bake leaves room for whichever
 * is set, on all four sides.
 */

/**
 * The first and last rows and columns of a Text's bake that hold any ink.
 * @param {Text} text - a baked Text
 * @returns {{top: number, bottom: number, left: number, right: number, width: number, height: number}}
 */
const inkBox = (text) => {
	const { canvas, context } = text.canvasTexture;
	const { width, height } = canvas;
	const data = context.getImageData(0, 0, width, height).data;
	let top = -1;
	let bottom = -1;
	let left = width;
	let right = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (data[(y * width + x) * 4 + 3] !== 0) {
				if (top === -1) {
					top = y;
				}
				bottom = y;
				left = Math.min(left, x);
				right = Math.max(right, x);
			}
		}
	}
	return { top, bottom, left, right, width, height };
};

/** a thickly outlined label of sharp glyphs */
const outlined = (extra = {}) => {
	return new Text(0, 0, {
		font: "sans-serif",
		size: 72,
		fillStyle: "#ffffff",
		strokeStyle: "#000000",
		lineWidth: 8,
		text: "AVWM",
		...extra,
	});
};

/** no ink on any edge of the bake, where a cut would leave it */
const expectUncut = (text) => {
	const ink = inkBox(text);
	expect(ink.top).toBeGreaterThan(0);
	expect(ink.left).toBeGreaterThan(0);
	expect(ink.bottom).toBeLessThan(ink.height - 1);
	expect(ink.right).toBeLessThan(ink.width - 1);
};

describe("Text outline corners: lineJoin and miterLimit", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	describe("settings", () => {
		it("default to round corners, and the canvas's miter limit", () => {
			const text = outlined();
			expect(text.lineJoin).toBe("round");
			expect(text.miterLimit).toBe(10);
		});

		it("take lineJoin and miterLimit from the settings", () => {
			const text = outlined({ lineJoin: "miter", miterLimit: 3 });
			expect(text.lineJoin).toBe("miter");
			expect(text.miterLimit).toBe(3);
		});

		it("stroke the glyphs with them", () => {
			const seen = [];
			const spy = vi
				.spyOn(CanvasRenderingContext2D.prototype, "strokeText")
				.mockImplementation(function () {
					seen.push([this.lineJoin, this.miterLimit]);
				});
			try {
				outlined();
				outlined({ lineJoin: "bevel" });
				outlined({ lineJoin: "miter", miterLimit: 3 });
			} finally {
				spy.mockRestore();
			}
			expect(seen).toEqual([
				["round", 10],
				["bevel", 10],
				["miter", 3],
			]);
		});

		it("a miter limit the canvas would refuse strokes with the default", () => {
			const seen = [];
			const spy = vi
				.spyOn(CanvasRenderingContext2D.prototype, "strokeText")
				.mockImplementation(function () {
					seen.push(this.miterLimit);
				});
			try {
				for (const miterLimit of [0, -2, Number.NaN, Infinity]) {
					outlined({ lineJoin: "miter", miterLimit });
				}
			} finally {
				spy.mockRestore();
			}
			expect(seen).toEqual([10, 10, 10, 10]);
		});
	});

	describe("the outline is baked whole", () => {
		it.each([
			["round (the default)", {}],
			["bevel", { lineJoin: "bevel" }],
			["miter, at the canvas's limit of 10", { lineJoin: "miter" }],
			["miter, limited to 3", { lineJoin: "miter", miterLimit: 3 }],
			[
				"miter, with a limit the canvas refuses",
				{ lineJoin: "miter", miterLimit: 0 },
			],
		])("with %s corners", (_name, extra) => {
			expectUncut(outlined(extra));
		});

		it.each([
			["left", 0],
			["center", 160],
			["right", 320],
		])("on every line of a %s aligned block", (textAlign, x) => {
			const text = new Text(x, 0, {
				font: "sans-serif",
				size: 48,
				fillStyle: "#ffffff",
				strokeStyle: "#000000",
				lineWidth: 8,
				lineJoin: "miter",
				textAlign,
				text: "AVA\nWIDE MAW\nM",
			});
			expectUncut(text);
		});

		it("with no outline, the glyphs themselves", () => {
			expectUncut(outlined({ lineWidth: 0 }));
		});
	});

	describe("the label's layout is unchanged", () => {
		it("reports the same bounds whatever the corners", () => {
			const round = outlined();
			const miter = outlined({ lineJoin: "miter" });
			const plain = outlined({ lineWidth: 0 });
			for (const text of [miter, plain]) {
				expect(text.metrics.x).toBe(round.metrics.x);
				expect(text.metrics.y).toBe(round.metrics.y);
				expect(text.metrics.width).toBe(round.metrics.width);
				expect(text.metrics.height).toBe(round.metrics.height);
			}
		});

		it.each([
			["round", {}],
			["miter", { lineJoin: "miter" }],
		])(
			"draws the %s outline on the screen pixels a plain canvas does",
			(_name, extra) => {
				// what a canvas draws for the same text, straight at the label's
				// position: the bake's room must not move a pixel of it
				const settings = {
					font: "sans-serif",
					size: 40,
					fillStyle: "#ffffff",
					strokeStyle: "#ff0000",
					lineWidth: 6,
					text: "AV",
					...extra,
				};
				const at = { x: 60, y: 50 };
				const text = new Text(at.x, at.y, settings);

				const renderer = app.renderer;
				const screen = renderer.getContext();
				const canvas = renderer.getCanvas();
				renderer.clearColor("#00000000", true);
				renderer.save();
				renderer.resetTransform();
				text.draw(renderer);
				renderer.restore();
				const drawn = screen.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				).data;

				const reference = document.createElement("canvas");
				reference.width = canvas.width;
				reference.height = canvas.height;
				const ctx = reference.getContext("2d");
				ctx.font = text.font;
				ctx.textBaseline = "top";
				ctx.lineWidth = settings.lineWidth;
				ctx.lineJoin = settings.lineJoin ?? "round";
				ctx.fillStyle = settings.fillStyle;
				ctx.strokeStyle = settings.strokeStyle;
				ctx.fillText(settings.text, at.x, at.y);
				ctx.strokeText(settings.text, at.x, at.y);
				const expected = ctx.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				).data;

				// the same pixels inked, give or take antialiasing on the edges
				let differ = 0;
				let inked = 0;
				for (let i = 3; i < drawn.length; i += 4) {
					if (expected[i] > 128) {
						inked++;
					}
					if (drawn[i] > 128 !== expected[i] > 128) {
						differ++;
					}
				}
				expect(inked).toBeGreaterThan(100);
				expect(differ).toBe(0);
			},
		);
	});
});
