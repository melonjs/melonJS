import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Color, Ellipse, Rect, video } from "../src/index.js";

describe("CanvasRenderer.setMask — invert mode", () => {
	let renderer;

	beforeAll(() => {
		boot();
		video.init(100, 100, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		renderer = video.renderer;
	});

	afterAll(() => {
		// reset to a clean state
		const ctx = renderer.getContext();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(
			0,
			0,
			renderer.getCanvas().width,
			renderer.getCanvas().height,
		);
	});

	function paintWithMasks(masks) {
		const ctx = renderer.getContext();
		const canvas = renderer.getCanvas();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		renderer.save();
		for (const m of masks) {
			renderer.setMask(m, true);
		}
		renderer.setColor(new Color(255, 0, 0, 1));
		renderer.fillRect(0, 0, canvas.width, canvas.height);
		renderer.clearMask();
		renderer.restore();

		return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	}

	function alphaAt(pixels, x, y, width = 100) {
		return pixels[(y * width + x) * 4 + 3];
	}

	it("a single inverted ellipse mask cuts a hole — baseline", () => {
		const e = new Ellipse(25, 25, 30, 30);
		const px = paintWithMasks([e]);
		// inside the ellipse (center): hole → alpha 0
		expect(alphaAt(px, 25, 25)).toBe(0);
		// outside the ellipse: filled → alpha 255
		expect(alphaAt(px, 90, 90)).toBe(255);
	});

	it("two inverted ellipse masks cut two independent holes", () => {
		// two non-overlapping circles in a 100x100 canvas
		const a = new Ellipse(25, 25, 30, 30);
		const b = new Ellipse(75, 75, 30, 30);

		const px = paintWithMasks([a, b]);

		// inside circle A: hole
		expect(alphaAt(px, 25, 25)).toBe(0);
		// inside circle B: hole
		expect(alphaAt(px, 75, 75)).toBe(0);
		// outside both circles (corner): filled
		expect(alphaAt(px, 90, 10)).toBe(255);
		// in the gap between circles (~middle): filled
		expect(alphaAt(px, 50, 50)).toBe(255);
	});

	it("a Rect mask is clipped at its actual position (not swapped axes)", () => {
		// Use a non-square rect at an off-origin position so the bug is
		// observable: a square or origin-positioned rect would mask the swap.
		const r = new Rect(60, 10, 30, 20);
		const px = paintWithMasks([r]);

		// inside the rect (x=70, y=20): hole
		expect(alphaAt(px, 70, 20)).toBe(0);
		// at the WRONG (swapped) location (x=10, y=60): filled, not hole
		expect(alphaAt(px, 10, 60)).toBe(255);
	});

	it("three inverted masks accumulate cutouts correctly", () => {
		const a = new Ellipse(20, 20, 20, 20);
		const b = new Ellipse(50, 50, 20, 20);
		const c = new Ellipse(80, 80, 20, 20);

		const px = paintWithMasks([a, b, c]);

		expect(alphaAt(px, 20, 20)).toBe(0);
		expect(alphaAt(px, 50, 50)).toBe(0);
		expect(alphaAt(px, 80, 80)).toBe(0);
		// region outside all three
		expect(alphaAt(px, 90, 10)).toBe(255);
	});
});
