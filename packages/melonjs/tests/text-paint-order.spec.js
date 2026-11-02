import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, getPool, Text, video } from "../src/index.js";

/**
 * A Text's outline is drawn behind its glyphs by default (`paintOrder`).
 *
 * The outline is centred on the glyph's edge, so half of it lies inside the
 * glyph. It used to be painted over the fill, as `fillText` then `strokeText`
 * does on a plain canvas: its inner half covered the glyph, so a thick
 * outline, or a thin face, left the letters solid outline colour. It is now
 * painted first, as text outlines usually are in games; `paintOrder: "fill"`
 * keeps the outline over the glyphs.
 */

const GREEN = "#00ff00";
const BLUE = "#0000ff";

/** a single-stem glyph, its outline wider than the stem */
const stem = (extra = {}) => {
	return new Text(0, 0, {
		font: "sans-serif",
		size: 96,
		fillStyle: GREEN,
		strokeStyle: BLUE,
		lineWidth: 16,
		text: "I",
		...extra,
	});
};

/** the bake's pixels, and its ink extent across the middle row of ink */
const read = (text) => {
	const { canvas, context } = text.canvasTexture;
	const { width, height } = canvas;
	const data = context.getImageData(0, 0, width, height).data;
	const alpha = (x, y) => {
		return data[(y * width + x) * 4 + 3];
	};
	let top = -1;
	let bottom = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (alpha(x, y) !== 0) {
				if (top === -1) {
					top = y;
				}
				bottom = y;
				break;
			}
		}
	}
	const row = Math.round((top + bottom) / 2);
	let left = -1;
	let right = -1;
	for (let x = 0; x < width; x++) {
		if (alpha(x, row) !== 0) {
			if (left === -1) {
				left = x;
			}
			right = x;
		}
	}
	const pixel = (x, y) => {
		const i = (y * width + x) * 4;
		return [data[i], data[i + 1], data[i + 2], data[i + 3]];
	};
	return { top, bottom, left, right, row, pixel };
};

/** the colour at the middle of the stem, and just inside the outline's outer edge */
const colours = (text) => {
	const ink = read(text);
	return {
		middle: ink.pixel(Math.round((ink.left + ink.right) / 2), ink.row),
		edge: ink.pixel(ink.left + 3, ink.row),
	};
};

const isGreen = ([r, g, b, a]) => {
	return a === 255 && g > 200 && r < 60 && b < 60;
};
const isBlue = ([r, g, b, a]) => {
	return a === 255 && b > 200 && r < 60 && g < 60;
};

describe("Text paintOrder: the outline behind or over the glyphs", () => {
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
		it("default to the outline behind the glyphs", () => {
			expect(stem().paintOrder).toBe("stroke");
		});

		it("take paintOrder from the settings", () => {
			expect(stem({ paintOrder: "fill" }).paintOrder).toBe("fill");
		});

		it("a recycled label does not keep the order of the one before", () => {
			const pool = getPool("text");
			const first = pool.get(0, 0, {
				font: "sans-serif",
				size: 24,
				lineWidth: 4,
				paintOrder: "fill",
				text: "I",
			});
			pool.release(first);
			const second = pool.get(0, 0, {
				font: "sans-serif",
				size: 24,
				lineWidth: 4,
				text: "I",
			});
			try {
				expect(second).toBe(first);
				expect(second.paintOrder).toBe("stroke");
			} finally {
				pool.release(second);
			}
		});
	});

	describe("the glyph under a thick outline", () => {
		it('stays whole with "stroke" (the default), the outline around it', () => {
			const { middle, edge } = colours(stem());
			expect(isGreen(middle), `middle ${middle}`).toBe(true);
			expect(isBlue(edge), `edge ${edge}`).toBe(true);
		});

		it('is covered with "fill", as a plain canvas strokes over a fill', () => {
			const { middle, edge } = colours(stem({ paintOrder: "fill" }));
			expect(isBlue(middle), `middle ${middle}`).toBe(true);
			expect(isBlue(edge), `edge ${edge}`).toBe(true);
		});

		it("stays whole with a gradient fill too", () => {
			const ramp = app.renderer.createLinearGradient(0, 0, 0, 96);
			ramp.addColorStop(0, GREEN);
			ramp.addColorStop(1, GREEN);
			const { middle, edge } = colours(stem({ fillStyle: ramp }));
			expect(isGreen(middle), `middle ${middle}`).toBe(true);
			// the outline keeps its own colour: not re-coloured by the ramp
			expect(isBlue(edge), `edge ${edge}`).toBe(true);
		});

		it("with no outline, the order changes nothing", () => {
			const behind = colours(stem({ lineWidth: 0 }));
			const over = colours(stem({ lineWidth: 0, paintOrder: "fill" }));
			expect(isGreen(behind.middle)).toBe(true);
			expect(over).toEqual(behind);
		});
	});

	describe("the label's size is unchanged", () => {
		it("the outline reaches as far out in either order", () => {
			const behind = read(stem());
			const over = read(stem({ paintOrder: "fill" }));
			expect([behind.top, behind.bottom, behind.left, behind.right]).toEqual([
				over.top,
				over.bottom,
				over.left,
				over.right,
			]);
		});

		it("and its bounds are the same", () => {
			const behind = stem();
			const over = stem({ paintOrder: "fill" });
			expect(behind.metrics.width).toBe(over.metrics.width);
			expect(behind.metrics.height).toBe(over.metrics.height);
			expect(behind.canvasTexture.width).toBe(over.canvasTexture.width);
			expect(behind.canvasTexture.height).toBe(over.canvasTexture.height);
		});
	});

	describe("on screen", () => {
		it.each([
			["stroke", ["strokeText", "fillText"]],
			["fill", ["fillText", "strokeText"]],
		])(
			'paintOrder "%s" draws what a plain canvas drawing %j does',
			(paintOrder, order) => {
				const settings = {
					font: "sans-serif",
					size: 40,
					fillStyle: "#ffd23f",
					strokeStyle: "#1b1b1b",
					lineWidth: 6,
					text: "Score",
					paintOrder,
				};
				const at = { x: 40, y: 60 };
				const text = new Text(at.x, at.y, settings);

				const renderer = app.renderer;
				const canvas = renderer.getCanvas();
				renderer.clearColor("#00000000", true);
				renderer.save();
				renderer.resetTransform();
				text.draw(renderer);
				renderer.restore();
				const drawn = renderer
					.getContext()
					.getImageData(0, 0, canvas.width, canvas.height).data;

				const reference = document.createElement("canvas");
				reference.width = canvas.width;
				reference.height = canvas.height;
				const ctx = reference.getContext("2d");
				ctx.font = text.font;
				ctx.textBaseline = "top";
				ctx.lineWidth = settings.lineWidth;
				ctx.lineJoin = "round";
				ctx.fillStyle = settings.fillStyle;
				ctx.strokeStyle = settings.strokeStyle;
				for (const call of order) {
					ctx[call](settings.text, at.x, at.y);
				}
				const expected = ctx.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				).data;

				// the same colours, weighted by their opacity (a pixel 1/255 opaque
				// can hold any colour and show none of it), give or take a level
				// of rounding where the two are blended
				let inked = 0;
				let differ = 0;
				for (let i = 0; i < drawn.length; i += 4) {
					if (expected[i + 3] === 0 && drawn[i + 3] === 0) {
						continue;
					}
					inked++;
					for (let c = 0; c < 4; c++) {
						const shown = (data, at) => {
							return c === 3
								? data[at + 3]
								: (data[at + c] * data[at + 3]) / 255;
						};
						if (Math.abs(shown(drawn, i) - shown(expected, i)) > 3) {
							differ++;
							break;
						}
					}
				}
				expect(inked).toBeGreaterThan(100);
				expect(differ).toBe(0);
			},
		);
	});
});
