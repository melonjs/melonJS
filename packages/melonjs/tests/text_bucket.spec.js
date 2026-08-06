import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Text } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Adversarial coverage of the 32-pixel text-canvas buckets (#1554):
 * small metric changes must land on the SAME canvas dimensions (so the
 * re-bake stays a same-size texture update on every backend), growth
 * only happens across bucket boundaries, and the canvas never shrinks
 * (the pre-existing grow-only rule). Replaces the power-of-two rounding,
 * whose waste was multiplicative instead of ≤31px per axis.
 */
describe("Text — 32px canvas buckets", () => {
	// borrow the session's single shared renderer — specs must never boot
	// their own Application into the shared page (context-budget hazard,
	// see helpers/webgl-context.js)
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(320, 240);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeText = (str, size = 16) => {
		return new Text(0, 0, {
			font: "Arial",
			size,
			text: str,
			fillStyle: "#ffffff",
		});
	};

	const bucket = (n) => {
		return Math.ceil(n / 32) * 32;
	};

	it("the canvas lands exactly on the metric's 32px bucket (no power-of-two jumps)", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText("Hello World");
		const c = t.canvasTexture;
		expect(c.width % 32).toBe(0);
		expect(c.height % 32).toBe(0);
		expect(c.width).toBe(bucket(t.metrics.width));
		expect(c.height).toBe(bucket(t.metrics.height));
		// waste is bounded additively — the whole point of the change
		expect(c.width - t.metrics.width).toBeLessThan(32);
		expect(c.height - t.metrics.height).toBeLessThan(32);
	});

	it("property sweep: every string's canvas is bucket-exact and minimal", (ctx) => {
		requireWebGL(ctx, renderer);
		const strings = [
			"a",
			"ab",
			"counter: 0",
			"counter: 10",
			"counter: 100",
			"WWWWWWWW",
			"iiiiiiii",
			".",
			"— em dash —",
			"0123456789".repeat(3),
			"multi\nline\ntext",
			"tall\ntext\nwith\nfour",
			"  leading and trailing  ",
		];
		for (const str of strings) {
			const t = makeText(str);
			const c = t.canvasTexture;
			expect(c.width % 32, str).toBe(0);
			expect(c.height % 32, str).toBe(0);
			expect(c.width, str).toBeGreaterThanOrEqual(Math.ceil(t.metrics.width));
			expect(c.width - t.metrics.width, str).toBeLessThan(32);
			expect(c.height - t.metrics.height, str).toBeLessThan(32);
		}
	});

	it("a ticking counter stays in the SAME bucket: same dimensions, same canvas element", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText("Score: 10");
		const c = t.canvasTexture;
		const canvasEl = c.canvas;
		const w = c.width;
		const h = c.height;
		// digits are near-uniform width — every tick must be a same-size
		// re-bake into the SAME canvas (texture-cache identity stable)
		for (const s of ["Score: 11", "Score: 12", "Score: 19", "Score: 18"]) {
			t.setText(s);
			expect(t.canvasTexture.canvas, s).toBe(canvasEl);
			expect(t.canvasTexture.width, s).toBe(w);
			expect(t.canvasTexture.height, s).toBe(h);
		}
	});

	it("crossing a bucket boundary grows to the NEXT bucket, not a power of two", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText("x");
		const first = t.canvasTexture.width;
		// grow the string until the canvas is forced past 128px — under
		// POT rounding the next stop after 128 was 256; buckets must land
		// on a 32 multiple strictly closer than doubling
		let s = "x";
		while (t.metrics.width <= 128) {
			s += "x";
			t.setText(s);
		}
		const grown = t.canvasTexture.width;
		expect(grown).toBeGreaterThan(first);
		expect(grown % 32).toBe(0);
		expect(grown).toBe(bucket(t.metrics.width));
		expect(grown - t.metrics.width).toBeLessThan(32);
	});

	it("the canvas NEVER shrinks (grow-only hysteresis preserved)", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText("a much much longer string of text here");
		const grownW = t.canvasTexture.width;
		const grownH = t.canvasTexture.height;
		t.setText(".");
		expect(t.canvasTexture.width).toBe(grownW);
		expect(t.canvasTexture.height).toBe(grownH);
		// and the bake is still marked for re-upload
		expect(t.isDirty).toBe(true);
	});

	it("empty text never crashes and never resizes to zero", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText("something");
		const w = t.canvasTexture.width;
		t.setText("");
		expect(t.canvasTexture.width).toBe(w);
		expect(t.canvasTexture.width).toBeGreaterThan(0);
		t.setText("back");
		expect(t.canvasTexture.width).toBeGreaterThan(0);
	});

	it("multiline growth buckets the HEIGHT independently of the width", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText("line");
		const w = t.canvasTexture.width;
		const h = t.canvasTexture.height;
		t.setText("line\nline\nline\nline\nline");
		expect(t.canvasTexture.width).toBe(w); // width metrics unchanged
		expect(t.canvasTexture.height).toBeGreaterThan(h);
		expect(t.canvasTexture.height % 32).toBe(0);
		expect(t.canvasTexture.height - t.metrics.height).toBeLessThan(32);
	});

	it("a huge font size still buckets tightly (no multiplicative blow-up)", (ctx) => {
		requireWebGL(ctx, renderer);
		const t = makeText("BIG", 180);
		const c = t.canvasTexture;
		expect(c.width % 32).toBe(0);
		expect(c.width - t.metrics.width).toBeLessThan(32);
		expect(c.height - t.metrics.height).toBeLessThan(32);
		// sanity: POT would have padded up to nearly 2× in the worst case;
		// the bucket keeps total waste under one row/column of 32
		const waste = (c.width * c.height) / (t.metrics.width * t.metrics.height);
		expect(waste).toBeLessThan(1.8);
	});
});
