/**
 * A clip inside a clip is the overlap of the two, on every renderer (#1816).
 *
 * Canvas's `context.clip()` intersects with the clip already set. The GPU
 * renderers used to replace it with the new rectangle, so a clipping
 * container nested in another drew past the outer one wherever it stuck
 * out of it: a scrolling `UIPanel` in a clipping parent showed its rows
 * outside the parent.
 *
 * The scene: an outer clipping container over the left half of the screen,
 * holding an inner clipping container that starts at its middle and runs
 * past its right edge, filled white over black. White should show only
 * where both clips cover, from x = 16 to x = 32.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	Bounds,
	boot,
	Container,
	Matrix2d,
	Renderable,
	video,
} from "../src/index.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";
import { readPixel } from "./helpers/pixels.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 64;

/** a white square over the whole screen, from its parent's corner */
class Fill extends Renderable {
	constructor() {
		super(0, 0, SIZE, SIZE);
		this.anchorPoint.set(0, 0);
		this.inViewport = true;
	}
	draw(renderer) {
		renderer.setColor("#ffffff");
		renderer.fillRect(0, 0, SIZE, SIZE);
	}
}

/** the outer clip (0..32) holding the inner one (16..48) holding the fill */
const nested = () => {
	const outer = new Container(0, 0, SIZE / 2, SIZE);
	outer.clipping = true;
	const inner = new Container(SIZE / 4, 0, SIZE / 2, SIZE);
	inner.clipping = true;
	inner.inViewport = true;
	inner.addChild(new Fill());
	outer.addChild(inner);
	return outer;
};

/** draw a renderable over black, as the world draws its children */
const drawOverBlack = (renderer, renderable) => {
	renderer.backgroundColor.parseCSS("#000000");
	renderer.clear();
	renderer.save();
	renderer.resetTransform();
	renderable.preDraw(renderer);
	renderable.draw(renderer);
	renderable.postDraw(renderer);
	renderer.restore();
	renderer.flush();
};

/** the red channel across the middle row: outer only, both, inner only, neither */
const across = async (renderer) => {
	const out = [];
	for (const x of [8, 24, 40, 56]) {
		out.push((await readPixel(renderer, x, SIZE / 2))[0]);
	}
	return out;
};

describe("nested clipping containers draw inside both clips", () => {
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

		it("white only where both clips cover", async () => {
			drawOverBlack(app.renderer, nested());
			expect(await across(app.renderer)).toEqual([0, 255, 0, 0]);
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

		it("white only where both clips cover", async (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
				return;
			}
			drawOverBlack(renderer, nested());
			expect(await across(renderer)).toEqual([0, 255, 0, 0]);
		});

		it("the scissor is the overlap, and restore() brings the outer clip back", (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
				return;
			}
			renderer.save();
			renderer.resetTransform();
			renderer.clipRect(0, 0, 32, 64);
			renderer.save();
			renderer.clipRect(16, 8, 32, 32);
			expect(Array.from(renderer.currentScissor)).toEqual([16, 8, 16, 32]);
			// clips that do not overlap leave nothing to draw in
			renderer.save();
			renderer.clipRect(40, 0, 8, 8);
			expect(renderer._scissorActive).toBe(true);
			expect(renderer.currentScissor[2] * renderer.currentScissor[3]).toBe(0);
			renderer.restore();
			renderer.restore();
			expect(Array.from(renderer.currentScissor)).toEqual([0, 0, 32, 64]);
			renderer.restore();
			expect(renderer._scissorActive).toBe(false);
		});

		it("a clip under a non-finite transform keeps the clip already set", (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
				return;
			}
			renderer.save();
			renderer.resetTransform();
			renderer.clipRect(0, 0, 32, 64);
			renderer.save();
			// as a ColorLayer's infinite size and centred anchor leave it
			renderer.translate(-Infinity, -Infinity);
			renderer.clipRect(0, 0, 10, 10);
			expect(renderer._scissorActive).toBe(true);
			expect(Array.from(renderer.currentScissor)).toEqual([0, 0, 32, 64]);
			renderer.restore();
			renderer.restore();
		});
	});

	describe("WebGPU (clipRect, without a device)", () => {
		/**
		 * The renderer's own `clipRect` and `setScissorRect`, on a stand-in
		 * holding only what they read: WebGPU is missing from most test
		 * environments, and the scissor math is all this fix touches.
		 */
		const host = () => {
			return {
				getCanvas: () => {
					return { width: SIZE, height: SIZE };
				},
				currentTransform: new Matrix2d(),
				clipAABB: new Bounds(),
				currentScissor: new Int32Array(4),
				scissorActive: false,
				currentBatcher: { flush() {} },
				applyScissor() {},
				_snapsToPixels: () => {
					return true;
				},
				setScissorRect: WebGPURenderer.prototype.setScissorRect,
			};
		};
		const clip = (h, x, y, w, hh) => {
			WebGPURenderer.prototype.clipRect.call(h, x, y, w, hh);
		};

		it("a clip inside a clip is the overlap", () => {
			const h = host();
			clip(h, 0, 0, 32, 64);
			expect(Array.from(h.currentScissor)).toEqual([0, 0, 32, 64]);
			clip(h, 16, 8, 32, 32);
			expect(h.scissorActive).toBe(true);
			expect(Array.from(h.currentScissor)).toEqual([16, 8, 16, 32]);
		});

		it("clips that do not overlap leave an empty scissor", () => {
			const h = host();
			clip(h, 0, 0, 16, 16);
			clip(h, 32, 32, 16, 16);
			expect(h.scissorActive).toBe(true);
			expect(h.currentScissor[2] * h.currentScissor[3]).toBe(0);
		});

		it("a full-canvas clip inside a clip keeps the clip", () => {
			const h = host();
			clip(h, 8, 8, 16, 16);
			clip(h, 0, 0, SIZE, SIZE);
			expect(h.scissorActive).toBe(true);
			expect(Array.from(h.currentScissor)).toEqual([8, 8, 16, 16]);
		});

		it("a clip under a non-finite transform keeps the clip already set", () => {
			const h = host();
			clip(h, 0, 0, 32, 64);
			h.currentTransform.translate(-Infinity, -Infinity);
			clip(h, 0, 0, 10, 10);
			expect(h.scissorActive).toBe(true);
			expect(Array.from(h.currentScissor)).toEqual([0, 0, 32, 64]);
		});
	});
});
