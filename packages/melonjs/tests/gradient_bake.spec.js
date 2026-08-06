import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Gradient } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Adversarial coverage of the fixed-resolution gradient bake (#1554):
 * gradients rasterize into a FIXED 256×256 shared target regardless of
 * on-screen size and are stretched by the destination quad — so the
 * shared canvas is allocated once and never resized, every re-bake is a
 * same-size texture update, and memory is capped. The returned
 * `{canvas, width, height}` is the drawImage SOURCE rect contract.
 */
describe("Gradient.toCanvas — fixed-resolution bake", () => {
	// borrow the session's single shared renderer — specs must never boot
	// their own Application into the shared page (context-budget hazard,
	// see helpers/webgl-context.js)
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(200, 150);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const px = (canvas, x, y) => {
		return canvas
			.getContext("2d")
			.getImageData(Math.round(x), Math.round(y), 1, 1).data;
	};

	it("caps the bake: a huge rect returns a source rect ≤ 256 on a 256×256 canvas", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 4000, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 4000, 3000);
		expect(baked.canvas.width).toBe(256);
		expect(baked.canvas.height).toBe(256);
		expect(baked.width).toBeLessThanOrEqual(256);
		expect(baked.height).toBeLessThanOrEqual(256);
		expect(baked.width).toBeGreaterThan(0);
		expect(baked.height).toBeGreaterThan(0);
	});

	it("small rects bake 1:1 (exact source rect) — but the canvas never shrinks", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 100, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 100, 50);
		expect(baked.width).toBe(100);
		expect(baked.height).toBe(50);
		expect(baked.canvas.width).toBe(256);
		expect(baked.canvas.height).toBe(256);
	});

	it("the shared canvas element identity is STABLE across differently-sized bakes", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 10, 0]);
		g.addColorStop(0, "#ffffff");
		g.addColorStop(1, "#000000");
		const a = g.toCanvas(renderer, 0, 0, 10, 10).canvas;
		const b = g.toCanvas(renderer, 0, 0, 5000, 5000).canvas;
		const c = g.toCanvas(renderer, 0, 0, 33.7, 12.2).canvas;
		expect(b).toBe(a);
		expect(c).toBe(a);
	});

	it("1:1 pixel correctness: a red→blue ramp is red at the start, blue at the end, mixed mid-way", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 100, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 100, 20);
		const start = px(baked.canvas, 1, 10);
		const mid = px(baked.canvas, 50, 10);
		const end = px(baked.canvas, 98, 10);
		expect(start[0]).toBeGreaterThan(230); // red dominates
		expect(start[2]).toBeLessThan(30);
		expect(end[2]).toBeGreaterThan(230); // blue dominates
		expect(end[0]).toBeLessThan(30);
		expect(mid[0]).toBeGreaterThan(60); // genuinely mixed
		expect(mid[2]).toBeGreaterThan(60);
	});

	it("scaled-down bake keeps the ramp: endpoints correct, monotonic in between (no banding reversal)", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 1024, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 1024, 64);
		expect(baked.width).toBe(256);
		const y = Math.floor(baked.height / 2);
		const startPx = px(baked.canvas, 0, y);
		const endPx = px(baked.canvas, 255, y);
		expect(startPx[0]).toBeGreaterThan(230);
		expect(endPx[2]).toBeGreaterThan(230);
		// blue must never DECREASE along the ramp (a reversal would be a
		// real banding/ordering artifact, not a rounding wobble)
		const row = baked.canvas.getContext("2d").getImageData(0, y, 256, 1).data;
		let prevBlue = row[2];
		for (let i = 1; i < 256; i++) {
			const blue = row[i * 4 + 2];
			expect(blue).toBeGreaterThanOrEqual(prevBlue - 2); // 2 = quantization slack
			prevBlue = Math.max(prevBlue, blue);
		}
	});

	it("draw-rect offset is honored: gradient coordinates are absolute, the bake is rect-relative", (ctx) => {
		requireWebGL(ctx, renderer);
		// ramp lives at x = 500..600 in world space; baking the rect at
		// x = 500 must put the ramp START at canvas x = 0
		const g = new Gradient("linear", [500, 0, 600, 0]);
		g.addColorStop(0, "#00ff00");
		g.addColorStop(1, "#000000");
		const baked = g.toCanvas(renderer, 500, 0, 100, 10);
		expect(px(baked.canvas, 1, 5)[1]).toBeGreaterThan(230);
		expect(px(baked.canvas, 98, 5)[1]).toBeLessThan(30);
	});

	it("radial: the center texel carries the inner stop, even under non-uniform downscale", (ctx) => {
		requireWebGL(ctx, renderer);
		// a circle centered in a wide rect: x is downscaled (1000 → 256),
		// y is 1:1 — the bake is elliptical, the destination stretch
		// restores it; the CENTER color must survive the transform
		const g = new Gradient("radial", [500, 50, 0, 500, 50, 40]);
		g.addColorStop(0, "#ffff00");
		g.addColorStop(1, "#000000");
		const baked = g.toCanvas(renderer, 0, 0, 1000, 100);
		const cx = (500 / 1000) * baked.width;
		const cy = (50 / 100) * baked.height;
		const center = px(baked.canvas, cx, cy);
		expect(center[0]).toBeGreaterThan(230);
		expect(center[1]).toBeGreaterThan(230);
		// well outside the (scaled) radius → outer stop
		const outside = px(baked.canvas, 5, cy);
		expect(outside[0]).toBeLessThan(30);
	});

	it("re-baking the same rect skips the repaint (scribble survives)", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 64, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 64, 64);
		// vandalize a pixel, then ask for the exact same bake again
		baked.canvas.getContext("2d").fillStyle = "#00ff00";
		baked.canvas.getContext("2d").fillRect(10, 10, 1, 1);
		const again = g.toCanvas(renderer, 0, 0, 64, 64);
		expect(px(again.canvas, 10, 10)[1]).toBeGreaterThan(230); // survived → no repaint
	});

	it("a color-stop change dirties the gradient and forces a repaint", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 64, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 64, 64);
		baked.canvas.getContext("2d").fillStyle = "#00ff00";
		baked.canvas.getContext("2d").fillRect(10, 10, 1, 1);
		g.addColorStop(0.5, "#ff00ff"); // marks dirty
		const again = g.toCanvas(renderer, 0, 0, 64, 64);
		expect(px(again.canvas, 10, 10)[1]).toBeLessThan(200); // repainted over
	});

	it("the SAME gradient at a different rect SIZE repaints (fixed canvas can't alias sizes)", (ctx) => {
		requireWebGL(ctx, renderer);
		// adversarial: the old reuse check compared canvas dimensions, which
		// are now constant — reusing here would serve a 64-wide bake for a
		// 128-wide request. The rect itself must be the identity.
		const g = new Gradient("linear", [0, 0, 128, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		g.toCanvas(renderer, 0, 0, 64, 64);
		const wide = g.toCanvas(renderer, 0, 0, 128, 64);
		// at x=100 the 128-wide ramp is mostly blue; a stale 64-wide bake
		// would have padding-extended full blue at 100 too — so probe x=60:
		// 128-ramp at 60/128 is mixed, stale 64-ramp at 60/64 is near-blue
		const probe = px(wide.canvas, 60, 32);
		expect(probe[0]).toBeGreaterThan(80); // red still present → fresh bake
	});

	it("alternating two gradients over the shared target repaints each time", (ctx) => {
		requireWebGL(ctx, renderer);
		const red = new Gradient("linear", [0, 0, 64, 0]);
		red.addColorStop(0, "#ff0000");
		red.addColorStop(1, "#ff0000");
		const blue = new Gradient("linear", [0, 0, 64, 0]);
		blue.addColorStop(0, "#0000ff");
		blue.addColorStop(1, "#0000ff");
		for (let i = 0; i < 3; i++) {
			expect(
				px(red.toCanvas(renderer, 0, 0, 64, 64).canvas, 32, 32)[0],
			).toBeGreaterThan(230);
			expect(
				px(blue.toCanvas(renderer, 0, 0, 64, 64).canvas, 32, 32)[2],
			).toBeGreaterThan(230);
		}
	});

	it("degenerate rects never crash and clamp to a ≥1×≥1 source", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 10, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		for (const [w, h] of [
			[0, 0],
			[0.4, 0.4],
			[-5, 10],
			[1, 0],
		]) {
			const baked = g.toCanvas(renderer, 0, 0, w, h);
			expect(baked.width).toBeGreaterThanOrEqual(1);
			expect(baked.height).toBeGreaterThanOrEqual(1);
			expect(baked.canvas.width).toBe(256);
		}
	});

	it("fractional rects keep the exact fractional source size on the 1:1 path", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 100, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 100.7, 33.3);
		expect(baked.width).toBeCloseTo(100.7, 5);
		expect(baked.height).toBeCloseTo(33.3, 5);
	});

	it("the padding beyond the source rect carries the EXTENDED gradient, not transparency (edge-filter parity)", (ctx) => {
		requireWebGL(ctx, renderer);
		const g = new Gradient("linear", [0, 0, 64, 0]);
		g.addColorStop(0, "#ff0000");
		g.addColorStop(1, "#0000ff");
		const baked = g.toCanvas(renderer, 0, 0, 64, 64);
		// one texel past the used region on both axes must be opaque
		// (the clamped end color), or linear filtering at the source-rect
		// edge would bleed transparency into a stretched draw
		expect(px(baked.canvas, 70, 10)[3]).toBe(255);
		expect(px(baked.canvas, 10, 70)[3]).toBe(255);
		expect(px(baked.canvas, 70, 10)[2]).toBeGreaterThan(230); // extended = end stop
	});
});
