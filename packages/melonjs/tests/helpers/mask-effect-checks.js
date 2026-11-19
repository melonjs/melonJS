/**
 * What the `MaskEffect` drawing tests share, so that each renderer can run
 * them in a spec file of its own: an application with a GPU device takes the
 * place of the one before it, and the checks below only need a renderer.
 */
import { expect, it, vi } from "vitest";
import { Camera2d, Ellipse, MaskEffect, Polygon } from "../../src/index.js";
import { grabFrame } from "./pixels.js";

export const SIZE = 64;

/** a 32 px disc, radius 14, with a hole of radius 4 at its centre */
export const discWithHole = () => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 32;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#3a7";
	ctx.beginPath();
	ctx.arc(16, 16, 14, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalCompositeOperation = "destination-out";
	ctx.beginPath();
	ctx.arc(16, 16, 4, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
};

/** an image whose left half only is opaque */
export const leftHalf = (w = 20, h = 30) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#f00";
	ctx.fillRect(0, 0, w / 2, h);
	return canvas;
};

/** a 32 px U: its middle is open to the outside, so not part of it */
export const uShape = () => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 32;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#000";
	ctx.fillRect(2, 2, 8, 28);
	ctx.fillRect(22, 2, 8, 28);
	ctx.fillRect(2, 22, 28, 8);
	return canvas;
};

/** an image whose top left quarter only is opaque */
export const topLeftQuarter = (w = 20, h = 30) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#0f0";
	ctx.fillRect(0, 0, w / 2, h / 2);
	return canvas;
};

/** a unit square that does not surround its origin */
export const offOrigin = () => {
	return new Polygon(0, 0, [
		{ x: 0.2, y: 0.2 },
		{ x: 1, y: 0.2 },
		{ x: 1, y: 1 },
		{ x: 0.2, y: 1 },
	]);
};

/** an effect at a given progress (1 = all visible, 0 = all covered) */
export const at = (camera, progress, options) => {
	const effect = new MaskEffect(camera, {
		color: "#000",
		duration: 1000,
		direction: "hide",
		...options,
	});
	effect.tween.stop();
	effect.progress.value = progress;
	return effect;
};

/**
 * Draw an effect over a white screen, and return the frame. The frame is
 * taken at once, in one piece: an application's own loop draws its next
 * frame while a test awaits, over the one a pixel would be read from.
 */
export const drawOverWhite = (renderer, effect) => {
	// a frame of its own: a GPU renderer draws nothing outside one
	renderer.clear();
	renderer.save();
	renderer.resetTransform();
	renderer.setColor("#ffffff");
	renderer.fillRect(0, 0, SIZE, SIZE);
	renderer.restore();
	effect.draw(renderer, SIZE, SIZE);
	return grabFrame(renderer);
};

/** 1 where a pixel of a frame is covered (dark), 0 where it is visible (light) */
export const covered = (frame, x, y) => {
	return frame.data[(y * frame.width + x) * 4] < 128 ? 1 : 0;
};

export const CORNERS = [
	[1, 1],
	[SIZE - 2, 1],
	[1, SIZE - 2],
	[SIZE - 2, SIZE - 2],
];

/** the same drawing checks, on one renderer */
export const drawingChecks = (getRenderer) => {
	const camera = new Camera2d(0, 0, SIZE, SIZE);

	it("an image: the scene shows through its silhouette, hole filled in", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const effect = at(camera, 0.3, { shape: discWithHole() });
		frame = await drawOverWhite(renderer, effect);
		// the centre is the image's hole: part of the silhouette, so visible
		expect(covered(frame, 32, 32)).toBe(0);
		expect(covered(frame, 32, 26)).toBe(0);
		for (const [x, y] of CORNERS) {
			expect(covered(frame, x, y)).toBe(1);
		}
		effect.destroy();
	});

	it("an image: covers everything once closed", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const effect = at(camera, 0, { shape: discWithHole() });
		frame = await drawOverWhite(renderer, effect);
		expect(covered(frame, 32, 32)).toBe(1);
		expect(covered(frame, 1, 1)).toBe(1);
		effect.destroy();
	});

	it("an image: just before the end, the whole screen is already uncovered", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const effect = at(camera, 0.995, { shape: discWithHole() });
		frame = await drawOverWhite(renderer, effect);
		for (const [x, y] of CORNERS) {
			expect(covered(frame, x, y)).toBe(0);
		}
		effect.destroy();
	});

	it("a polygon: just before the end, the whole screen is already uncovered", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const diamond = new Polygon(0, 0, [
			{ x: 0, y: -1 },
			{ x: 1, y: 0 },
			{ x: 0, y: 1 },
			{ x: -1, y: 0 },
		]);
		const effect = at(camera, 0.995, { shape: diamond });
		frame = await drawOverWhite(renderer, effect);
		for (const [x, y] of CORNERS) {
			expect(covered(frame, x, y)).toBe(0);
		}
		effect.destroy();
	});

	it("inverted: the silhouette is the cover, the scene shows round it", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const effect = at(camera, 0.7, { shape: discWithHole(), invert: true });
		frame = await drawOverWhite(renderer, effect);
		expect(covered(frame, 32, 32)).toBe(1);
		for (const [x, y] of CORNERS) {
			expect(covered(frame, x, y)).toBe(0);
		}
		effect.destroy();
	});

	it("inverted: covers everything once closed, nothing at the start", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const closed = at(camera, 0, { shape: discWithHole(), invert: true });
		frame = await drawOverWhite(renderer, closed);
		expect(covered(frame, 1, 1)).toBe(1);
		expect(covered(frame, 32, 32)).toBe(1);
		closed.destroy();
		const open = at(camera, 1, { shape: discWithHole(), invert: true });
		frame = await drawOverWhite(renderer, open);
		expect(covered(frame, 32, 32)).toBe(0);
		open.destroy();
	});

	it("inverted geometry: an iris filled, growing out of the centre", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const effect = at(camera, 0.7, {
			shape: new Ellipse(0, 0, 1, 1),
			invert: true,
		});
		frame = await drawOverWhite(renderer, effect);
		expect(covered(frame, 32, 32)).toBe(1);
		expect(covered(frame, 1, 1)).toBe(0);
		effect.destroy();
	});

	it("an image open in its middle (a U): grows about its thickest part, and still uncovers everything", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		// just after the hide starts, the middle of the screen is still seen
		const start = at(camera, 0.99, { shape: uShape() });
		frame = await drawOverWhite(renderer, start);
		expect(covered(frame, 32, 32)).toBe(0);
		start.destroy();
		// and just before a reveal ends, nothing is covered
		const end = at(camera, 0.995, { shape: uShape() });
		frame = await drawOverWhite(renderer, end);
		for (const [x, y] of [...CORNERS, [32, 32], [32, 3]]) {
			expect(covered(frame, x, y)).toBe(0);
		}
		end.destroy();
	});

	it("a polygon off its origin: still uncovers everything, and inverted still covers it", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const open = at(camera, 0.995, { shape: offOrigin() });
		frame = await drawOverWhite(renderer, open);
		for (const [x, y] of CORNERS) {
			expect(covered(frame, x, y)).toBe(0);
		}
		open.destroy();
		// the cover nearly grown: the screen is covered by the polygon itself
		const cover = at(camera, 0.005, { shape: offOrigin(), invert: true });
		frame = await drawOverWhite(renderer, cover);
		for (const [x, y] of [...CORNERS, [32, 32]]) {
			expect(covered(frame, x, y)).toBe(1);
		}
		cover.destroy();
	});

	it("nearly closed, the image is still drawn, a sliver of the scene in the middle", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const effect = at(camera, 0.05, { shape: discWithHole() });
		const drawImage = vi.spyOn(renderer, "drawImage");
		frame = await drawOverWhite(renderer, effect);
		expect(drawImage).toHaveBeenCalled();
		drawImage.mockRestore();
		expect(covered(frame, 32, 32)).toBe(0);
		for (const [x, y] of [...CORNERS, [32, 20], [44, 32]]) {
			expect(covered(frame, x, y)).toBe(1);
		}
		effect.destroy();
	});

	it("center: closes on that point, not on the centre of the screen", async (ctx) => {
		const renderer = getRenderer(ctx);
		let frame;
		const effect = at(camera, 0.2, {
			shape: discWithHole(),
			center: { x: 12, y: 12 },
		});
		frame = await drawOverWhite(renderer, effect);
		expect(covered(frame, 12, 12)).toBe(0);
		expect(covered(frame, 52, 52)).toBe(1);
		effect.destroy();
	});
};
