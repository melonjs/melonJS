import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Text } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * The two halves of a `Text`'s position, and the rule that keeps them apart.
 *
 * A label is a canvas blitted at `metrics.x/y` with its glyphs baked at
 * `pos - metrics` INSIDE that canvas. `metrics` is floored, so the canvas
 * always lands on a whole pixel — a texture blitted at a fractional coordinate
 * resamples and goes soft — and the fraction the floor drops is handed to the
 * bake instead, where the font rasterizer antialiases it properly. The two must
 * always sum back to `pos`.
 *
 * `metrics.x/y` reads `pos`, but nothing else in `measureText` does, so it used
 * to be refreshed only when the STRING changed. A label that moved kept the
 * origin it was born with: the bake offset grew by the whole distance travelled
 * while the canvas stayed its original size, so the glyphs slid off their own
 * canvas and were clipped. `TextMetrics#updateOrigin` is the split-out part the
 * draw path now refreshes every frame.
 */
describe("Text — pixel snapping and a label that moves", () => {
	// borrow the session's shared renderer: every test here needs Text to be
	// constructible, and the draw-path test needs something to draw into
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer();
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeText = (x, y, settings = {}) => {
		return new Text(x, y, {
			font: "Arial",
			size: 16,
			fillStyle: "#ffffff",
			text: "Hello",
			...settings,
		});
	};

	/** where the glyphs sit inside their canvas */
	const bakeOffset = (t) => {
		return { x: t.pos.x - t.metrics.x, y: t.pos.y - t.metrics.y };
	};

	it("lands the canvas on a whole pixel, whatever the position", (ctx) => {
		requireWebGL(ctx, renderer);
		for (const [x, y] of [
			[0, 0],
			[10.5, 20.25],
			[0.999, 0.001],
			[-3.75, -8.5],
		]) {
			const t = makeText(x, y);
			t.metrics.updateOrigin();
			expect(Number.isInteger(t.metrics.x), `x at ${x}`).toBe(true);
			expect(Number.isInteger(t.metrics.y), `y at ${y}`).toBe(true);
		}
	});

	it("hands the dropped sub-pixel to the bake, not to the blit", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText(10.25, 20.75);
		t.metrics.updateOrigin();

		// default align/baseline is left/top, so the glyph origin is the box
		// origin and the whole remainder is the fraction the floor dropped
		const offset = bakeOffset(t);
		expect(offset.x).toBeCloseTo(0.25, 10);
		expect(offset.y).toBeCloseTo(0.75, 10);

		// and the two halves still sum back to where the caller put the label
		expect(t.metrics.x + offset.x).toBeCloseTo(10.25, 10);
		expect(t.metrics.y + offset.y).toBeCloseTo(20.75, 10);
	});

	it("keeps the glyph phase identical across a whole-pixel move", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText(10.25, 20.75);
		t.metrics.updateOrigin();
		const before = bakeOffset(t);
		const originX = t.metrics.x;

		t.pos.x += 40;
		t.pos.y += 7;
		t.metrics.updateOrigin();

		// the canvas moved by exactly the distance travelled...
		expect(t.metrics.x).toBe(originX + 40);
		// ...and the glyphs did not move inside it at all, so the rasterized
		// pixels are reusable rather than merely close
		const after = bakeOffset(t);
		expect(after.x).toBeCloseTo(before.x, 10);
		expect(after.y).toBeCloseTo(before.y, 10);
	});

	it("absorbs a sub-pixel move into the phase, not the canvas", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText(10, 20);
		t.metrics.updateOrigin();
		const originX = t.metrics.x;

		t.pos.x += 0.4;
		t.metrics.updateOrigin();

		// the canvas stays put — a 0.4px blit would resample the whole texture
		expect(t.metrics.x).toBe(originX);
		// the shift is carried by the bake instead
		expect(bakeOffset(t).x).toBeCloseTo(0.4, 10);
	});

	it("follows a moved label instead of keeping its birth origin", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText(10, 10);
		const born = t.metrics.x;

		// move it a long way WITHOUT re-setting the text — the case that used
		// to slide the glyphs off their own canvas
		t.pos.x = 400;
		t.metrics.updateOrigin();

		expect(t.metrics.x).toBe(born + 390);
		// the bake offset must stay sub-pixel: it is what used to grow by the
		// whole 390px and push the glyphs past the canvas edge
		expect(Math.abs(bakeOffset(t).x)).toBeLessThan(1);
	});

	it("refreshes the origin from the DRAW path, not only from setText", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText(10, 10);
		const born = t.metrics.x;

		// move it and draw, without touching the text. Every other test here
		// calls `updateOrigin` itself, so this is the one that fails if the
		// draw path stops asking for it — which is the whole fix.
		t.pos.x = 120;
		t.draw(renderer);

		expect(t.metrics.x).toBe(born + 110);
		expect(Math.abs(t.pos.x - t.metrics.x)).toBeLessThan(1);
	});

	it("snaps under every textAlign", (ctx) => {
		requireWebGL(ctx, renderer);
		for (const textAlign of ["left", "center", "right"]) {
			const t = makeText(30.5, 10, { textAlign });
			t.metrics.updateOrigin();

			expect(Number.isInteger(t.metrics.x), textAlign).toBe(true);

			// the glyph origin differs per alignment, but the canvas is always
			// within a pixel below the point the alignment asks for
			const anchored =
				textAlign === "right"
					? 30.5 - t.metrics.width
					: textAlign === "center"
						? 30.5 - t.metrics.width / 2
						: 30.5;
			expect(t.metrics.x, textAlign).toBe(Math.floor(anchored));
		}
	});

	it("snaps under every textBaseline", (ctx) => {
		requireWebGL(ctx, renderer);
		for (const textBaseline of [
			"top",
			"hanging",
			"middle",
			"alphabetic",
			"ideographic",
			"bottom",
		]) {
			const t = makeText(10, 30.5, { textBaseline });
			t.metrics.updateOrigin();

			expect(Number.isInteger(t.metrics.y), textBaseline).toBe(true);

			const line = t.metrics.lineHeight();
			const anchored =
				textBaseline === "top" || textBaseline === "hanging"
					? 30.5
					: textBaseline === "middle"
						? 30.5 - line / 2
						: 30.5 - line;
			expect(t.metrics.y, textBaseline).toBe(Math.floor(anchored));
		}
	});
});
