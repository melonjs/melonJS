import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Text, video } from "../src/index.js";

/**
 * A `Text` must bake its whole glyph, not just the part that fits.
 *
 * `TextMetrics.measureText` sizes the offscreen canvas from the nominal line
 * box — `fontSize × lineHeight` per line — and `_drawFont` starts the first
 * line at the top of it. Neither figure knows anything about where the ink
 * actually lands:
 *
 * - a display face can carry glyphs that rise ABOVE the em box, so
 *   `actualBoundingBoxAscent` exceeds `fontBoundingBoxAscent` (measured on the
 *   face one example uses: 15.59 against a declared 14, at 15px); and
 * - a STROKE is centred on the glyph outline, so half of `lineWidth` sits
 *   outside it in every direction — and no metric reports that at all.
 *
 * Either way the top of the glyph falls above row 0 of the canvas and is
 * simply cut off. The only workaround from user code is to pad the string
 * with a leading newline and spend a whole blank line buying headroom.
 *
 * A stroke is what these tests use to force the overshoot, because it is
 * font-independent: it happens on whatever face the test browser resolves.
 */

/**
 * The first and last canvas rows holding any ink, plus the row count.
 * @param text - a Text whose offscreen canvas has been baked
 * @returns `{ top, bottom, height }`, with `top` -1 when nothing was drawn
 */
function inkRows(text) {
	const canvas = text.canvasTexture.canvas;
	const { width, height } = canvas;
	const data = text.canvasTexture.context.getImageData(
		0,
		0,
		width,
		height,
	).data;
	let top = -1;
	let bottom = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (data[(y * width + x) * 4 + 3] !== 0) {
				if (top === -1) {
					top = y;
				}
				bottom = y;
				break;
			}
		}
	}
	return { top, bottom, height };
}

describe("Text — the glyph is baked whole, not clipped", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	/** a heavily stroked label — the stroke is what overshoots the metrics */
	const stroked = (extra = {}) => {
		return new Text(0, 0, {
			font: "sans-serif",
			size: 40,
			fillStyle: "#ffffff",
			strokeStyle: "#ff0000",
			lineWidth: 12,
			text: "Ag",
			...extra,
		});
	};

	/**
	 * What the glyph SHOULD occupy, straight from the canvas API: the ink box
	 * the browser reports, widened by the stroke it does not report.
	 * @param text - the Text to measure
	 * @returns the expected ink height in pixels
	 */
	const expectedInk = (text) => {
		const context = text.canvasTexture.context;
		context.save();
		context.font = text.font;
		context.textBaseline = text.textBaseline;
		const m = context.measureText(text._text[0]);
		context.restore();
		const stroke =
			text.lineWidth > 0 && text.strokeStyle.alpha > 0 ? text.lineWidth : 0;
		// ascent is positive UPWARD from the alignment point, so the ink box is
		// ascent + descent — and the stroke adds half its width at each end
		return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + stroke;
	};

	it("bakes the whole glyph, stroke included", () => {
		// The oracle is the ink box the browser reports plus the stroke, which
		// no metric covers. Anything less means the bake cut the glyph off.
		const text = stroked();

		const { top, bottom } = inkRows(text);

		expect(bottom - top + 1).toBeGreaterThanOrEqual(
			Math.floor(expectedInk(text)),
		);
	});

	it("keeps the ink inside the canvas at the bottom too", () => {
		const text = stroked();

		const { bottom, height } = inkRows(text);

		expect(bottom).toBeLessThan(height - 1);
	});

	it("bakes an unstroked display glyph whole", () => {
		// the other half of the bug: a face whose glyphs rise above the em box
		// overshoots with no stroke involved at all
		const text = stroked({ lineWidth: 0, size: 64 });

		const { top, bottom } = inkRows(text);

		expect(bottom - top + 1).toBeGreaterThanOrEqual(
			Math.floor(expectedInk(text)),
		);
	});

	describe("the reported layout box is unchanged", () => {
		// The fix pads the offscreen CANVAS and cancels the pad in the blit, so
		// the glyphs land in the same screen pixels and `metrics` — which is
		// what `updateBounds` reads — is untouched. These pin that: a label's
		// reported position and size must not move because its bake grew.

		it("keeps metrics.height at the nominal line box", () => {
			const text = new Text(0, 0, {
				font: "sans-serif",
				size: 40,
				lineHeight: 1,
				text: "Ag",
			});

			// two lines of nothing but the nominal box, stroke or no stroke
			expect(text.metrics.height).toBe(40);
		});

		it("reports the same bounds stroked and unstroked", () => {
			const plain = new Text(10, 20, {
				font: "sans-serif",
				size: 40,
				lineHeight: 1,
				text: "Ag",
			});
			const stroked = new Text(10, 20, {
				font: "sans-serif",
				size: 40,
				lineHeight: 1,
				strokeStyle: "#ff0000",
				lineWidth: 12,
				text: "Ag",
			});

			const a = plain.getBounds();
			const b = stroked.getBounds();

			// a stroke changes what is PAINTED, never where the label sits
			expect([b.x, b.y, b.width, b.height]).toEqual([
				a.x,
				a.y,
				a.width,
				a.height,
			]);
		});

		it("keeps multi-line height a whole number of lines", () => {
			const text = new Text(0, 0, {
				font: "sans-serif",
				size: 20,
				lineHeight: 1.5,
				strokeStyle: "#000000",
				lineWidth: 8,
				text: "Ag\nAg\nAg",
			});

			expect(text.metrics.height).toBe(Math.ceil(20 * 1.5 * 3));
		});
	});
});
