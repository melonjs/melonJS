/**
 * A colour's own alpha is not the renderer's global alpha.
 *
 * On Canvas the alpha of setColor() belongs to fillStyle and globalAlpha is
 * a separate multiplier: a fill is drawn at the two multiplied, an image at
 * the global alpha alone, and getGlobalAlpha() never moves with setColor().
 * The WebGL and WebGPU renderers kept both in `currentColor.alpha`:
 * setColor() multiplied the new colour's alpha into whatever was there and
 * setGlobalAlpha() overwrote it. So after setColor("rgba(…, 0.5)") a later
 * opaque colour, an image, a gradient and every renderable drawn next (whose
 * opacity cascades from getGlobalAlpha()) came out at half alpha, while a
 * setGlobalAlpha() after a translucent colour threw the colour's alpha away.
 *
 * Every case runs on Canvas (the reference) and WebGL over black, and reads
 * the red channel back: 255 times the alpha it was drawn at.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Renderable, video } from "../src/index.js";
import { PanelPainter } from "../src/renderable/ui/panelpaint.ts";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import { readPixel } from "./helpers/pixels.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 32;
const MID = SIZE / 2;
// a step or two of rounding between backends
const TOLERANCE = 3;

const white = (() => {
	const c = document.createElement("canvas");
	c.width = 8;
	c.height = 8;
	const ctx = c.getContext("2d");
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, 8, 8);
	return c;
})();

const scene = (renderer, body) => {
	renderer.backgroundColor.parseCSS("#000000");
	renderer.clear();
	renderer.save();
	renderer.resetTransform();
	renderer.setGlobalAlpha(1);
	renderer.setColor("#000000");
	body(renderer);
	renderer.restore();
	renderer.flush();
};

/** draws its left half filled with its colour, its right half an image */
class Swatch extends Renderable {
	constructor(color) {
		super(0, 0, SIZE, SIZE);
		this.anchorPoint.set(0, 0);
		this.color = color;
	}
	draw(renderer) {
		renderer.setColor(this.color);
		renderer.fillRect(0, 0, SIZE / 2, SIZE);
		renderer.drawImage(white, SIZE / 2, 0, SIZE / 2, SIZE);
	}
}

const draw = (renderer, renderable) => {
	renderable.preDraw(renderer);
	renderable.draw(renderer);
	renderable.postDraw(renderer);
};

// [name, draw, x, expected red channel]
const PIXEL_CASES = [
	[
		"an opaque setColor() after a translucent one fills opaque",
		(r) => {
			r.setColor("rgba(255, 255, 255, 0.5)");
			r.setColor("#ffffff");
			r.fillRect(0, 0, SIZE, SIZE);
		},
		MID,
		255,
	],
	[
		"an image after a translucent setColor() draws opaque",
		(r) => {
			r.setColor("rgba(255, 0, 0, 0.5)");
			r.drawImage(white, 0, 0, SIZE, SIZE);
		},
		MID,
		255,
	],
	[
		"a gradient after a translucent setColor() fills opaque",
		(r) => {
			r.setColor("rgba(255, 255, 255, 0.5)");
			const g = r.createLinearGradient(0, 0, SIZE, 0);
			g.addColorStop(0, "#ffffff");
			g.addColorStop(1, "#ffffff");
			r.setColor(g);
			r.fillRect(0, 0, SIZE, SIZE);
		},
		MID,
		255,
	],
	[
		"setGlobalAlpha() after a translucent colour multiplies it",
		(r) => {
			r.setColor("rgba(255, 255, 255, 0.5)");
			r.setGlobalAlpha(0.5);
			r.fillRect(0, 0, SIZE, SIZE);
		},
		MID,
		64,
	],
	[
		"a translucent colour after setGlobalAlpha() multiplies it",
		(r) => {
			r.setGlobalAlpha(0.5);
			r.setColor("rgba(255, 255, 255, 0.5)");
			r.fillRect(0, 0, SIZE, SIZE);
		},
		MID,
		64,
	],
	[
		"a stroke is drawn at the colour's alpha times the global alpha",
		(r) => {
			r.setColor("rgba(255, 255, 255, 0.5)");
			r.setGlobalAlpha(0.5);
			r.lineWidth = 6;
			r.strokeLine(0, MID, SIZE, MID);
			r.lineWidth = 1;
		},
		MID,
		64,
	],
	[
		"restore() brings back the global alpha and the colour apart",
		(r) => {
			r.setGlobalAlpha(0.5);
			r.setColor("rgba(255, 255, 255, 0.5)");
			r.save();
			r.setGlobalAlpha(1);
			r.setColor("#ffffff");
			r.restore();
			// 0.5 * 0.5
			r.fillRect(0, 0, SIZE, SIZE);
		},
		MID,
		64,
	],
	[
		"renderable opacity times the colour's alpha, on a fill",
		(r) => {
			const s = new Swatch("rgba(255, 255, 255, 0.5)");
			s.alpha = 0.5;
			draw(r, s);
		},
		SIZE / 4,
		64,
	],
	[
		"renderable opacity alone, on an image drawn after a translucent fill",
		(r) => {
			const s = new Swatch("rgba(255, 255, 255, 0.5)");
			s.alpha = 0.5;
			draw(r, s);
		},
		(SIZE * 3) / 4,
		128,
	],
	[
		"a tinted renderable's image ignores the colour's alpha",
		(r) => {
			const s = new Swatch("rgba(0, 0, 255, 0.25)");
			s.alpha = 0.5;
			s.tint.parseCSS("#ff0000");
			draw(r, s);
		},
		(SIZE * 3) / 4,
		128,
	],
	[
		"a renderable after one that left a translucent colour set draws whole",
		(r) => {
			// a container drawing its own translucent background, then a child
			r.setColor("rgba(255, 255, 255, 0.25)");
			const s = new Swatch("#ffffff");
			draw(r, s);
		},
		(SIZE * 3) / 4,
		255,
	],
	[
		"a widget's translucent colour counts once",
		(r) => {
			const painter = new PanelPainter();
			painter.paint(r, "#ffffff80", 1);
			r.fillRect(0, 0, SIZE, SIZE);
			painter.dispose();
		},
		MID,
		128,
	],
	[
		"a widget's translucent colour counts once under a cascade",
		(r) => {
			const painter = new PanelPainter();
			painter.paint(r, "#ffffff80", 0.5);
			r.fillRect(0, 0, SIZE, SIZE);
			painter.dispose();
		},
		MID,
		64,
	],
];

const suite = (getRenderer) => {
	const need = (ctx) => {
		const renderer = getRenderer();
		if (renderer === undefined) {
			ctx.skip("renderer not available");
		}
		return renderer;
	};

	it.for(PIXEL_CASES)("%s", async ([, body, x, expected], ctx) => {
		const renderer = need(ctx);
		scene(renderer, body);
		const [r] = await readPixel(renderer, x, MID);
		expect(Math.abs(r - expected)).toBeLessThanOrEqual(TOLERANCE);
	});

	it("getGlobalAlpha() and globalAlpha() do not move with setColor()", (ctx) => {
		const renderer = need(ctx);
		renderer.save();
		renderer.setGlobalAlpha(0.75);
		renderer.setColor("rgba(255, 0, 0, 0.5)");
		const after = [renderer.getGlobalAlpha(), renderer.globalAlpha()];
		renderer.setColor("#ffffff");
		const opaque = [renderer.getGlobalAlpha(), renderer.globalAlpha()];
		renderer.restore();
		expect(after).toEqual([0.75, 0.75]);
		expect(opaque).toEqual([0.75, 0.75]);
	});

	it("setGlobalAlpha() and restore() leave the colour's own alpha alone", (ctx) => {
		const renderer = need(ctx);
		renderer.save();
		renderer.setColor("rgba(255, 0, 0, 0.5)");
		renderer.setGlobalAlpha(0.25);
		const set = renderer.getColor().alpha;
		renderer.save();
		renderer.setGlobalAlpha(0.75);
		renderer.restore();
		const restored = renderer.getColor().alpha;
		renderer.restore();
		expect([set, restored]).toEqual([0.5, 0.5]);
	});

	it("nested save()/restore() unwinds the global alpha", (ctx) => {
		const renderer = need(ctx);
		renderer.save();
		renderer.setGlobalAlpha(0.5);
		renderer.save();
		renderer.setColor("rgba(0, 0, 0, 0.1)");
		renderer.setGlobalAlpha(renderer.globalAlpha() * 0.5);
		const inner = renderer.getGlobalAlpha();
		renderer.restore();
		const outer = renderer.getGlobalAlpha();
		renderer.restore();
		expect([inner, outer]).toEqual([0.25, 0.5]);
	});
};

describe("colour alpha vs global alpha", () => {
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
