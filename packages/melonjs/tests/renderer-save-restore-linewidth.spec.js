/**
 * save()/restore() covers lineWidth and lineJoin on every renderer.
 *
 * On Canvas both are part of the 2D context's drawing state, so a renderable
 * that thickens its lines inside its draw() (between the preDraw save() and
 * the postDraw restore()) leaves the next one alone. The WebGL and WebGPU
 * renderers kept them as plain fields outside their RenderState stack, so a
 * thick line width leaked to everything drawn after it in the frame.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import { readPixel } from "./helpers/pixels.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 32;

const suite = (getRenderer) => {
	const need = (ctx) => {
		const renderer = getRenderer();
		if (renderer === undefined) {
			ctx.skip("renderer not available");
		}
		return renderer;
	};

	it("restore() puts lineWidth back", (ctx) => {
		const renderer = need(ctx);
		renderer.lineWidth = 1;
		renderer.save();
		renderer.lineWidth = 8;
		renderer.restore();
		expect(renderer.lineWidth).toBe(1);
	});

	it("nested save()/restore() unwinds lineWidth level by level", (ctx) => {
		const renderer = need(ctx);
		renderer.lineWidth = 1;
		renderer.save();
		renderer.lineWidth = 4;
		renderer.save();
		renderer.lineWidth = 8;
		renderer.restore();
		const inner = renderer.lineWidth;
		renderer.restore();
		expect([inner, renderer.lineWidth]).toEqual([4, 1]);
	});

	it("a fractional lineWidth survives the stack", (ctx) => {
		const renderer = need(ctx);
		renderer.lineWidth = 1.3;
		renderer.save();
		renderer.lineWidth = 5;
		renderer.restore();
		// (a 2D context keeps it as a 32-bit float)
		expect(renderer.lineWidth).toBeCloseTo(1.3, 5);
		renderer.lineWidth = 1;
	});

	it("restore() puts lineJoin back", (ctx) => {
		const renderer = need(ctx);
		const before = renderer.lineJoin;
		renderer.save();
		renderer.lineJoin = before === "bevel" ? "miter" : "bevel";
		renderer.restore();
		expect(renderer.lineJoin).toBe(before);
	});

	it("a restore() with nothing saved leaves lineWidth alone", (ctx) => {
		const renderer = need(ctx);
		renderer.lineWidth = 3;
		renderer.restore();
		expect(renderer.lineWidth).toBe(3);
		renderer.lineWidth = 1;
	});

	it("lineWidth unwinds past the preallocated stack depth", (ctx) => {
		const renderer = need(ctx);
		const DEPTH = 40;
		for (let i = 0; i < DEPTH; i++) {
			renderer.lineWidth = i + 1;
			renderer.save();
		}
		renderer.lineWidth = 99;
		const seen = [];
		for (let i = DEPTH; i > 0; i--) {
			renderer.restore();
			seen.push(renderer.lineWidth);
		}
		expect(seen).toEqual(
			Array.from({ length: DEPTH }, (_, i) => {
				return DEPTH - i;
			}),
		);
		renderer.lineWidth = 1;
	});

	it("a stroke after restore() is drawn at the restored width", async (ctx) => {
		const renderer = need(ctx);
		renderer.backgroundColor.parseCSS("#000000");
		renderer.clear();
		renderer.lineWidth = 1;
		renderer.save();
		renderer.resetTransform();
		renderer.setGlobalAlpha(1);
		// a renderable thickening its own lines
		renderer.save();
		renderer.lineWidth = 8;
		renderer.restore();
		// the next one, expecting the width from before
		renderer.setColor("#ffffff");
		renderer.strokeRect(8, 8, 16, 16);
		renderer.restore();
		renderer.flush();
		// on the top edge: drawn
		expect((await readPixel(renderer, 16, 8))[0]).toBeGreaterThan(100);
		// 3 px inside the top edge: only a thick line reaches it
		expect((await readPixel(renderer, 16, 11))[0]).toBe(0);
	});
};

describe("lineWidth and lineJoin across save/restore", () => {
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
			if (renderer) {
				renderer.lineWidth = 1;
			}
			releaseWebGLRenderer();
		});
		suite(() => {
			return renderer;
		});
	});
});
