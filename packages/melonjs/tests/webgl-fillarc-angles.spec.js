/**
 * fillArc() reads its angles the way CanvasRenderingContext2D.arc does.
 *
 * The WebGL and WebGPU renderers used to fill `|end - start|` radians from
 * `start` (or, anticlockwise, `2π - |end - start|` from `end`), never wrapping
 * the angles. So an arc whose end comes before its start filled the wrong
 * part of the circle (clockwise PI/2 -> 0 filled one quarter instead of
 * three), an anticlockwise full circle (0 -> 2π) filled nothing, and a span
 * over 2π was either filled twice over (doubling a translucent colour) or,
 * from a start over 2π, filled whole. Canvas, and the engine's own
 * Path2D.arc used by strokeArc, wrap `end += 2π` when it comes before the
 * start, and cap a span at the whole circle.
 *
 * Every case draws on Canvas (the reference) and WebGL, and samples the
 * middle of each of the eight octants, near the rim. Canvas fills the arc
 * closed by its chord and the GPU renderers a pie slice, so the samples sit
 * where both shapes agree.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import { readPixel } from "./helpers/pixels.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 64;
const C = 32;
const R = 26;
const PI = Math.PI;
const TAU = PI * 2;

const drawArc = (renderer, start, end, anti, color = "#ffffff") => {
	renderer.backgroundColor.parseCSS("#000000");
	renderer.clear();
	renderer.save();
	renderer.resetTransform();
	renderer.setGlobalAlpha(1);
	renderer.setColor(color);
	renderer.fillArc(C, C, R, start, end, anti);
	renderer.restore();
	renderer.flush();
};

// octant k is centred on (k + 0.5) * 45 degrees, clockwise on screen from +x
const octantPoint = (k) => {
	const a = (k + 0.5) * (PI / 4);
	return [C + Math.cos(a) * R * 0.85, C + Math.sin(a) * R * 0.85];
};

// the octants a renderer filled, as a sorted list of indices
const filledOctants = async (renderer) => {
	const out = [];
	for (let k = 0; k < 8; k++) {
		const [x, y] = octantPoint(k);
		if ((await readPixel(renderer, x, y))[0] > 128) {
			out.push(k);
		}
	}
	return out;
};

const ALL = [0, 1, 2, 3, 4, 5, 6, 7];

// [name, start, end, antiClockwise, octants filled]
const CASES = [
	// the control cases, which were right before
	["clockwise 0 -> PI/2", 0, PI / 2, false, [0, 1]],
	["anticlockwise 0 -> PI/2", 0, PI / 2, true, [2, 3, 4, 5, 6, 7]],
	["clockwise -PI/2 -> PI/2", -PI / 2, PI / 2, false, [0, 1, 6, 7]],
	["anticlockwise -PI/2 -> PI/2", -PI / 2, PI / 2, true, [2, 3, 4, 5]],
	["clockwise 0 -> 2PI", 0, TAU, false, ALL],
	["clockwise 2PI -> 0", TAU, 0, false, ALL],
	["clockwise from past 2PI", 4 * PI + PI / 2, 5 * PI, false, [2, 3]],
	// an end before the start wraps round
	["clockwise PI/2 -> 0", PI / 2, 0, false, [2, 3, 4, 5, 6, 7]],
	["anticlockwise PI/2 -> 0", PI / 2, 0, true, [0, 1]],
	["clockwise 3PI/2 -> PI/2", (3 * PI) / 2, PI / 2, false, [0, 1, 6, 7]],
	["anticlockwise PI/2 -> -PI/2", PI / 2, -PI / 2, true, [0, 1, 6, 7]],
	["clockwise PI/2 -> -PI/2", PI / 2, -PI / 2, false, [2, 3, 4, 5]],
	// a full circle in either direction
	["anticlockwise 0 -> 2PI", 0, TAU, true, ALL],
	["anticlockwise 2PI -> 0", TAU, 0, true, ALL],
	// a span past 2PI in the arc's own direction is the whole circle...
	["clockwise 0 -> 3PI", 0, 3 * PI, false, ALL],
	["anticlockwise 3PI -> 0", 3 * PI, 0, true, ALL],
	// ...and against it, wraps like any other
	["clockwise 3PI -> 0", 3 * PI, 0, false, [4, 5, 6, 7]],
	["anticlockwise 0 -> 3PI", 0, 3 * PI, true, [4, 5, 6, 7]],
	// no span, nothing drawn
	["clockwise PI -> PI", PI, PI, false, []],
	["anticlockwise PI -> PI", PI, PI, true, []],
];

const suite = (getRenderer) => {
	it.for(CASES)("%s", async ([, start, end, anti, expected], ctx) => {
		const renderer = getRenderer();
		if (renderer === undefined) {
			ctx.skip("renderer not available");
			return;
		}
		drawArc(renderer, start, end, anti);
		expect(await filledOctants(renderer)).toEqual(expected);
	});

	it("a span over 2PI is filled once, not twice over", async (ctx) => {
		const renderer = getRenderer();
		if (renderer === undefined) {
			ctx.skip("renderer not available");
			return;
		}
		drawArc(renderer, 0, 4 * PI, false, "rgba(255, 255, 255, 0.5)");
		const [r] = await readPixel(renderer, ...octantPoint(3));
		// one 50% white layer over black
		expect(Math.abs(r - 128)).toBeLessThanOrEqual(3);
	});
};

describe("fillArc angles", () => {
	describe("Canvas", () => {
		let app;
		beforeAll(async () => {
			boot();
			app = new Application(SIZE, SIZE, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
		});
		afterAll(() => {
			app?.destroy();
		});
		suite(() => {
			return app.renderer;
		});
	});

	describe("WebGL", () => {
		let renderer;
		beforeAll(async () => {
			boot();
			renderer = await getWebGLRenderer(SIZE, SIZE);
			if (renderer instanceof WebGLRenderer) {
				renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
				renderer.currentBatcher.setProjection(renderer.projectionMatrix);
			} else {
				renderer = undefined;
			}
		});
		afterAll(() => {
			releaseWebGLRenderer();
		});
		suite(() => {
			return renderer;
		});
	});
});
