import { beforeEach, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";

import RenderTargetPool from "../src/video/rendertarget/render_target_pool.js";
import WebGLRenderTarget from "../src/video/rendertarget/webglrendertarget.js";

describe("RenderTargetPool", () => {
	let pool;

	// simple mock factory for unit tests (no GL context needed)
	const mockFactory = (w, h) => {
		return {
			width: w,
			height: h,
			resize(nw, nh) {
				this.width = nw;
				this.height = nh;
			},
			destroy() {},
		};
	};

	beforeEach(() => {
		pool = new RenderTargetPool(mockFactory);
	});

	describe("constructor", () => {
		it("should start with an empty pool", () => {
			expect(pool._pool).toHaveLength(0);
		});

		it("should default activeBase to -1", () => {
			expect(pool._activeBase).toEqual(-1);
		});
	});

	describe("begin()", () => {
		it("should set activeBase to 0 for camera", () => {
			pool.begin(true, 1, 100, 100);
			expect(pool._activeBase).toEqual(0);
		});

		it("should set activeBase to 2 for sprites", () => {
			pool.begin(false, 1, 100, 100);
			expect(pool._activeBase).toEqual(2);
		});

		it("should create render target via factory", () => {
			const rt = pool.begin(true, 1, 200, 150);
			expect(rt).toBeDefined();
			expect(rt.width).toEqual(200);
			expect(rt.height).toEqual(150);
		});

		it("should create ping-pong target when effectCount > 1", () => {
			pool.begin(true, 2, 100, 100);
			expect(pool.getCaptureTarget()).toBeDefined();
			expect(pool.getPingPongTarget()).toBeDefined();
			expect(pool.getPingPongTarget()).not.toBe(pool.getCaptureTarget());
		});

		it("should not create ping-pong target for single effect", () => {
			pool.begin(true, 1, 100, 100);
			expect(pool.getCaptureTarget()).toBeDefined();
			expect(pool.getPingPongTarget()).toBeUndefined();
		});
	});

	describe("getCaptureTarget / getPingPongTarget", () => {
		it("should return undefined when no active pass", () => {
			expect(pool.getCaptureTarget()).toBeUndefined();
			expect(pool.getPingPongTarget()).toBeUndefined();
		});

		it("should return the correct pool index for camera", () => {
			pool._activeBase = 0;
			pool._pool[0] = { id: "capture-cam" };
			pool._pool[1] = { id: "pingpong-cam" };

			expect(pool.getCaptureTarget()).toEqual({ id: "capture-cam" });
			expect(pool.getPingPongTarget()).toEqual({ id: "pingpong-cam" });
		});

		it("should return the correct pool index for sprite", () => {
			pool._activeBase = 2;
			pool._pool[2] = { id: "capture-sprite" };
			pool._pool[3] = { id: "pingpong-sprite" };

			expect(pool.getCaptureTarget()).toEqual({ id: "capture-sprite" });
			expect(pool.getPingPongTarget()).toEqual({ id: "pingpong-sprite" });
		});

		it("camera and sprite targets should be independent", () => {
			pool._pool[0] = { id: "cam0" };
			pool._pool[1] = { id: "cam1" };
			pool._pool[2] = { id: "spr0" };
			pool._pool[3] = { id: "spr1" };

			pool._activeBase = 0;
			expect(pool.getCaptureTarget().id).toEqual("cam0");

			pool._activeBase = 2;
			expect(pool.getCaptureTarget().id).toEqual("spr0");

			// camera targets still intact
			pool._activeBase = 0;
			expect(pool.getCaptureTarget().id).toEqual("cam0");
		});
	});

	describe("end()", () => {
		it("should restore previous activeBase", () => {
			pool.begin(true, 1, 100, 100);
			pool.begin(false, 1, 100, 100);
			expect(pool._activeBase).toEqual(2);

			const parent = pool.end();
			expect(pool._activeBase).toEqual(0);
			expect(parent).toBe(pool._pool[0]);
		});

		it("should return null when no parent", () => {
			pool.begin(true, 1, 100, 100);
			const parent = pool.end();
			expect(parent).toBeNull();
		});
	});

	describe("destroy()", () => {
		it("should call destroy on all targets", () => {
			let destroyCount = 0;
			pool._pool = [
				{
					destroy() {
						destroyCount++;
					},
				},
				{
					destroy() {
						destroyCount++;
					},
				},
				null,
				{
					destroy() {
						destroyCount++;
					},
				},
			];

			pool.destroy();
			expect(destroyCount).toEqual(3);
			expect(pool._pool).toHaveLength(0);
		});

		it("should handle empty pool", () => {
			pool.destroy();
			expect(pool._pool).toHaveLength(0);
		});
	});

	describe("with WebGL context", () => {
		it("should work with WebGLRenderTarget factory", () => {
			boot();
			video.init(100, 100, {
				parent: "screen",
				scale: "auto",
				renderer: video.WEBGL,
			});

			if (!video.renderer.gl) {
				return;
			}

			const gl = video.renderer.gl;
			const glPool = new RenderTargetPool((w, h) => {
				return new WebGLRenderTarget(gl, w, h);
			});

			const capture = glPool.begin(true, 2, 100, 100);
			expect(capture).toBeDefined();
			expect(capture.width).toEqual(100);
			expect(capture.framebuffer).toBeDefined();
			expect(glPool.getCaptureTarget()).toBe(capture);
			expect(glPool.getPingPongTarget()).toBeDefined();
			expect(glPool.getPingPongTarget()).not.toBe(capture);

			glPool.destroy();
		});

		it("should reuse target on subsequent get at same index", () => {
			boot();
			video.init(100, 100, {
				parent: "screen",
				scale: "auto",
				renderer: video.WEBGL,
			});

			if (!video.renderer.gl) {
				return;
			}

			const gl = video.renderer.gl;
			const glPool = new RenderTargetPool((w, h) => {
				return new WebGLRenderTarget(gl, w, h);
			});

			const rt1 = glPool.get(0, 100, 100);
			const rt2 = glPool.get(0, 100, 100);
			expect(rt2).toBe(rt1);

			glPool.destroy();
		});

		it("should resize target when dimensions change", () => {
			boot();
			video.init(100, 100, {
				parent: "screen",
				scale: "auto",
				renderer: video.WEBGL,
			});

			if (!video.renderer.gl) {
				return;
			}

			const gl = video.renderer.gl;
			const glPool = new RenderTargetPool((w, h) => {
				return new WebGLRenderTarget(gl, w, h);
			});

			const rt = glPool.get(0, 100, 100);
			expect(rt.width).toEqual(100);

			glPool.get(0, 200, 200);
			expect(rt.width).toEqual(200);
			expect(rt.height).toEqual(200);

			glPool.destroy();
		});
	});
});
