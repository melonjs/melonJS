import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Color, Text, video } from "../src/index.js";

/**
 * A `Text` fills its glyphs with a `Gradient` wherever a colour goes.
 *
 * The engine already has the type — `Renderer#createLinearGradient` builds one,
 * `addColorStop` fills it, and `Renderer#setColor` takes one as a fill style.
 * `Text` was the one fill style that would not, so the only way to ramp a label
 * was a post-effect shader that had to GUESS which pixels were the outline
 * (thresholding on luminance) and could only darken.
 *
 * Doing it at bake time is exact instead of heuristic: `_drawFont` issues
 * `fillText` and `strokeText` as separate calls, so a gradient assigned to the
 * context's fill style colours the fill and nothing else, by construction. It
 * also works on Canvas2D, where a post effect does not.
 *
 * The backward-compatibility half matters as much as the feature: `fillStyle`
 * is a POOLED `Color` that is copied into rather than assigned, and its `alpha`
 * gates whether the fill is drawn at all. Widening what the setting ACCEPTS
 * must not widen what the property HOLDS.
 */
describe("Text — gradient fill", () => {
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

	/** a two-stop white-to-gold ramp down a 24px box */
	const ramp = () => {
		const g = app.renderer.createLinearGradient(0, 0, 0, 24);
		g.addColorStop(0, "#ffffff");
		g.addColorStop(1, "#f0a020");
		return g;
	};

	const label = (fillStyle) => {
		return new Text(0, 0, {
			font: "sans-serif",
			size: 24,
			fillStyle,
			text: "Ag",
		});
	};

	/** the distinct colours the bake actually painted */
	const inkColors = (text) => {
		const canvas = text.canvasTexture.canvas;
		const data = text.canvasTexture.context.getImageData(
			0,
			0,
			canvas.width,
			canvas.height,
		).data;
		const seen = new Set();
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] > 200) {
				seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
			}
		}
		return seen;
	};

	it("ramps the glyphs instead of painting them flat", () => {
		const flat = label("#ffffff");
		const ramped = label(ramp());

		// a flat fill paints one colour; a ramp paints many down the box
		expect(inkColors(flat).size).toBe(1);
		expect(inkColors(ramped).size).toBeGreaterThan(4);
	});

	it("keeps `fillStyle` a pooled Color, whatever it was given", () => {
		const text = label(ramp());

		// the property still HOLDS a Color — `.alpha` still gates the fill,
		// `colorPool.release` in destroy() is still valid, and user code
		// calling `.setColor()` still works
		expect(text.fillStyle).toBeInstanceOf(Color);
		expect(text.fillGradient).toBeDefined();
	});

	it("still lets alpha gate the fill", () => {
		const text = label(ramp());
		text.fillStyle.alpha = 0;
		text.setText("Ag");

		// a gradient does not bypass the visibility guard
		expect(inkColors(text).size).toBe(0);
	});

	it("leaves a colour-filled label byte-identical", () => {
		const a = label("#ff8800");
		const b = label(new Color(255, 136, 0));

		expect(a.fillGradient).toBeUndefined();
		expect(b.fillGradient).toBeUndefined();
		expect([...inkColors(a)]).toEqual([...inkColors(b)]);
	});

	it("does not change the layout box", () => {
		// a gradient is a paint, not a layout: same string, same metrics
		const flat = label("#ffffff");
		const ramped = label(ramp());

		expect(ramped.metrics.width).toBe(flat.metrics.width);
		expect(ramped.metrics.height).toBe(flat.metrics.height);
		const a = flat.getBounds();
		const b = ramped.getBounds();
		expect([b.x, b.y, b.width, b.height]).toEqual([
			a.x,
			a.y,
			a.width,
			a.height,
		]);
	});

	it("leaves the stroke out of the ramp", () => {
		// `_drawFont` strokes separately, so the outline keeps its own colour —
		// no luminance heuristic needed to tell fill from stroke
		const text = new Text(0, 0, {
			font: "sans-serif",
			size: 24,
			fillStyle: ramp(),
			strokeStyle: "#0000ff",
			lineWidth: 3,
			text: "Ag",
		});

		const colors = inkColors(text);
		expect(colors.has("0,0,255")).toBe(true);
	});
});
