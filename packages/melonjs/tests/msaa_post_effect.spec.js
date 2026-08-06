import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import RenderTargetPool from "../src/video/rendertarget/render_target_pool.js";
import WebGLRenderTarget from "../src/video/rendertarget/webglrendertarget.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * MSAA post-effect capture targets (#1556) — the parts a mock can't prove:
 * a REAL multisampled FBO pair must be framebuffer-complete on the actual
 * driver, the blitFramebuffer resolve must actually move pixels, and the
 * pool must hand the multisample option only to CAPTURE slots (scene
 * rasterization) — ping-pong intermediates draw screen-aligned quads with
 * no geometric edges to antialias.
 */
describe("RenderTargetPool capture/ping-pong parity", () => {
	it("even slots are created as capture targets, odd slots as intermediates", () => {
		const factory = vi.fn((w, h, isCapture) => {
			return {
				width: w,
				height: h,
				isCapture,
				resize() {},
				destroy() {},
			};
		});
		const pool = new RenderTargetPool(factory);
		// camera bracket (base 0) with a chain → capture + ping-pong
		pool.begin(true, 2, 100, 100);
		pool.getPingPongTarget(100, 100);
		// sprite bracket (base 2) nested inside
		pool.begin(false, 2, 64, 64);
		pool.getPingPongTarget(64, 64);

		expect(factory.mock.calls.length).toBeGreaterThanOrEqual(4);
		for (const [, , isCapture] of factory.mock.calls) {
			expect(typeof isCapture).toBe("boolean");
		}
		const flags = factory.mock.results.map((r) => {
			return r.value.isCapture;
		});
		// order of creation: capture(0), ping-pong(1), capture(2), ping-pong(3)
		expect(flags).toEqual([true, false, true, false]);
	});
});

describe("WebGLRenderTarget MSAA on a real context", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
		gl = renderer?.gl;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	// build a real multisampled target, restoring enough GL state that the
	// shared renderer keeps working for later spec files
	const withTarget = (samples, fn) => {
		const scissor = gl.isEnabled(gl.SCISSOR_TEST);
		gl.disable(gl.SCISSOR_TEST);
		const target = new WebGLRenderTarget(gl, 64, 64, { samples });
		try {
			fn(target);
		} finally {
			target.destroy();
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.clearColor(0, 0, 0, 0);
			if (scissor) {
				gl.enable(gl.SCISSOR_TEST);
			}
		}
	};

	it("the multisampled pair is FRAMEBUFFER_COMPLETE on this driver", (ctx) => {
		requireWebGL(ctx, renderer);
		const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
		expect(samples).toBeGreaterThan(0); // WebGL2 guarantees MAX_SAMPLES ≥ 4
		withTarget(samples, (target) => {
			expect(target._hasStencil).toBe(true); // masks must keep working
			target.bind();
			expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(
				gl.FRAMEBUFFER_COMPLETE,
			);
			// the resolve half too
			gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
			expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(
				gl.FRAMEBUFFER_COMPLETE,
			);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});

	it("pixels rendered into the msaa half come back through resolve + readback", (ctx) => {
		requireWebGL(ctx, renderer);
		const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
		withTarget(samples, (target) => {
			target.bind();
			gl.clearColor(1, 0, 0, 1);
			gl.clear(
				gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT,
			);
			target.unbind(); // auto-resolve
			const img = target.getImageData(0, 0, 2, 2);
			expect(Array.from(img.data.slice(0, 4))).toEqual([255, 0, 0, 255]);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});

	it("a second render pass after resolve re-arms and lands NEW pixels", (ctx) => {
		requireWebGL(ctx, renderer);
		const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
		withTarget(samples, (target) => {
			target.bind();
			gl.clearColor(1, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			target.unbind();

			// second frame: green — a stale _needsResolve latch would keep red
			target.bind();
			gl.clearColor(0, 1, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			target.unbind();
			const img = target.getImageData(0, 0, 1, 1);
			expect(Array.from(img.data.slice(0, 4))).toEqual([0, 255, 0, 255]);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});

	it("resize keeps the pair complete and renderable at the new size", (ctx) => {
		requireWebGL(ctx, renderer);
		const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
		withTarget(samples, (target) => {
			target.resize(96, 48);
			target.bind();
			expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(
				gl.FRAMEBUFFER_COMPLETE,
			);
			gl.clearColor(0, 0, 1, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			target.unbind();
			const img = target.getImageData(90, 40, 1, 1); // inside the NEW extent
			expect(Array.from(img.data.slice(0, 4))).toEqual([0, 0, 255, 255]);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});
});
