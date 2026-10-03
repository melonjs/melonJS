import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	DesaturateEffect,
	ProgressBar,
	Renderable,
	Trail,
} from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * ONE post effect is normally applied by drawing the renderable with the
 * effect's own program instead of capturing it offscreen, which costs no
 * render target. That is equivalent only when everything the renderable draws
 * is a textured quad: `fillRect` and the shape dispatch go to the primitive
 * batcher, and NO batcher reads `customShader`, so the effect silently did
 * nothing on a renderable that draws with primitives.
 *
 * Measured before this existed, pure red through a `DesaturateEffect`:
 * one effect read back `[255, 0, 0]` (untouched) while two read `[76, 76, 76]`.
 * Two already captured, so the bug was the single-effect case alone.
 */
describe("post-effect fast path", () => {
	describe("the predicate", () => {
		// a bare renderer: the predicate is pure, and reaching it through a
		// real GPU context would say nothing extra about it
		const renderer = Object.create(Renderer.prototype);
		const fx = () => {
			return { enabled: true };
		};

		it("takes the fast path for a single effect on a plain renderable", () => {
			const r = new Renderable(0, 0, 10, 10);
			expect(renderer._usesPostEffectFastPath(r, [fx()])).toBe(true);
		});

		it("does not, once the renderable asks to be captured", () => {
			const r = new Renderable(0, 0, 10, 10);
			r.postEffectNeedsCapture = true;
			expect(renderer._usesPostEffectFastPath(r, [fx()])).toBe(false);
		});

		it("does not for a camera, which manages its own target", () => {
			const r = new Renderable(0, 0, 10, 10);
			r._postEffectManaged = true;
			expect(renderer._usesPostEffectFastPath(r, [fx()])).toBe(false);
		});

		it("does not for a chain, which always captures", () => {
			const r = new Renderable(0, 0, 10, 10);
			expect(renderer._usesPostEffectFastPath(r, [fx(), fx()])).toBe(false);
		});

		it("does not for an empty chain", () => {
			const r = new Renderable(0, 0, 10, 10);
			expect(renderer._usesPostEffectFastPath(r, [])).toBe(false);
		});
	});

	describe("who asks to be captured", () => {
		it("a plain renderable does not", () => {
			expect(new Renderable(0, 0, 10, 10).postEffectNeedsCapture).toBe(false);
		});

		it("ProgressBar does, since it draws with primitives", () => {
			const bar = new ProgressBar(0, 0, { width: 10, height: 10 });
			expect(bar.postEffectNeedsCapture).toBe(true);
			bar.destroy();
		});

		it("Trail does, for the same reason", () => {
			const trail = new Trail();
			expect(trail.postEffectNeedsCapture).toBe(true);
			trail.destroy();
		});
	});

	describe("on WebGL, measured in pixels", () => {
		const SIZE = 128;
		let renderer;
		let gl;
		let isWebGL;

		beforeAll(async () => {
			boot();
			renderer = await getWebGLRenderer(SIZE, SIZE);
			isWebGL = renderer instanceof WebGLRenderer;
			if (isWebGL) {
				gl = renderer.gl;
			}
		});

		afterAll(() => {
			releaseWebGLRenderer();
		});

		const skipIfNoWebGL = (ctx) => {
			if (!isWebGL) {
				ctx.skip("WebGL renderer not available in this environment");
				return true;
			}
			return false;
		};

		/** one pixel, converted from the GL bottom-left origin */
		const readPixel = (x, y) => {
			const px = new Uint8Array(4);
			gl.finish();
			gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return [px[0], px[1], px[2]];
		};

		const paint = (renderable) => {
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			renderer.save();
			renderer.resetTransform();
			renderable.preDraw(renderer);
			renderable.draw(renderer);
			renderable.postDraw(renderer);
			renderer.restore();
			renderer.flush();
		};

		/** a bar filling the frame with pure red, nothing but the fill */
		const makeBar = () => {
			return new ProgressBar(0, 0, {
				width: SIZE,
				height: 40,
				value: 1,
				trackColor: null,
				borderColor: null,
				fillColor: "#ff0000",
			});
		};

		it("draws its fill untouched with no effect", (ctx) => {
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			const bar = makeBar();
			try {
				paint(bar);
				expect(readPixel(SIZE / 2, 20)).toEqual([255, 0, 0]);
			} finally {
				bar.destroy();
			}
		});

		it("a SINGLE effect reaches the primitives it draws", (ctx) => {
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			// this is the case that silently did nothing
			const bar = makeBar();
			try {
				bar.addPostEffect(new DesaturateEffect(renderer));
				paint(bar);
				const [r, g, b] = readPixel(SIZE / 2, 20);
				expect(r).toBe(g);
				expect(g).toBe(b);
				expect(r).toBeGreaterThan(0);
				expect(r).toBeLessThan(255);
			} finally {
				bar.destroy();
			}
		});

		it("a chain still works, as it already did", (ctx) => {
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			const bar = makeBar();
			try {
				bar.addPostEffect(new DesaturateEffect(renderer));
				bar.addPostEffect(new DesaturateEffect(renderer));
				paint(bar);
				const [r, g, b] = readPixel(SIZE / 2, 20);
				expect(r).toBe(g);
				expect(g).toBe(b);
			} finally {
				bar.destroy();
			}
		});

		it("a disabled effect leaves it alone", (ctx) => {
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			const bar = makeBar();
			try {
				const effect = new DesaturateEffect(renderer);
				effect.enabled = false;
				bar.addPostEffect(effect);
				paint(bar);
				expect(readPixel(SIZE / 2, 20)).toEqual([255, 0, 0]);
			} finally {
				bar.destroy();
			}
		});

		it("a renderable that has NOT opted in keeps the fast path", (ctx) => {
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			// the guard on the change: a sprite must be unaffected, so a bar
			// with the flag cleared has to behave exactly as it did before
			const bar = makeBar();
			try {
				bar.postEffectNeedsCapture = false;
				bar.addPostEffect(new DesaturateEffect(renderer));
				paint(bar);
				expect(readPixel(SIZE / 2, 20)).toEqual([255, 0, 0]);
			} finally {
				bar.destroy();
			}
		});
	});
});
