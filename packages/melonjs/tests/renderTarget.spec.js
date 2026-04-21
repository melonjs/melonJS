import { beforeEach, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";
import CanvasRenderTarget from "../src/video/rendertarget/canvasrendertarget.js";
import RenderTarget from "../src/video/rendertarget/rendertarget.ts";
import WebGLRenderTarget from "../src/video/rendertarget/webglrendertarget.js";

describe("RenderTarget", () => {
	describe("CanvasRenderTarget", () => {
		it("should extend RenderTarget", () => {
			const rt = new CanvasRenderTarget(100, 100);
			expect(rt).toBeInstanceOf(RenderTarget);
			expect(rt).toBeInstanceOf(CanvasRenderTarget);
		});

		it("should have correct width and height", () => {
			const rt = new CanvasRenderTarget(200, 150);
			expect(rt.width).toEqual(200);
			expect(rt.height).toEqual(150);
		});

		it("should resize", () => {
			const rt = new CanvasRenderTarget(100, 100);
			rt.resize(300, 200);
			expect(rt.width).toEqual(300);
			expect(rt.height).toEqual(200);
		});

		it("should clear without error", () => {
			const rt = new CanvasRenderTarget(100, 100);
			expect(() => {
				rt.clear();
			}).not.toThrow();
		});

		it("bind and unbind should be no-ops", () => {
			const rt = new CanvasRenderTarget(100, 100);
			expect(() => {
				rt.bind();
				rt.unbind();
			}).not.toThrow();
		});

		it("should return valid ImageData from getImageData", () => {
			const rt = new CanvasRenderTarget(50, 50);
			const data = rt.getImageData(0, 0, 50, 50);
			expect(data).toBeInstanceOf(ImageData);
			expect(data.width).toEqual(50);
			expect(data.height).toEqual(50);
		});

		it("should destroy without error", () => {
			const rt = new CanvasRenderTarget(100, 100);
			expect(() => {
				rt.destroy();
			}).not.toThrow();
			expect(rt.canvas).toBeUndefined();
			expect(rt.context).toBeUndefined();
		});
	});

	describe("WebGLRenderTarget", () => {
		let gl;

		beforeEach(() => {
			boot();
			video.init(100, 100, {
				parent: "screen",
				scale: "auto",
				renderer: video.WEBGL,
			});
			gl = video.renderer.gl;
		});

		it("should extend RenderTarget", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 100, 100);
			expect(rt).toBeInstanceOf(RenderTarget);
			expect(rt).toBeInstanceOf(WebGLRenderTarget);
			rt.destroy();
		});

		it("should have correct width and height", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 200, 150);
			expect(rt.width).toEqual(200);
			expect(rt.height).toEqual(150);
			rt.destroy();
		});

		it("should create valid framebuffer and texture", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 100, 100);
			expect(rt.framebuffer).toBeDefined();
			expect(rt.texture).toBeDefined();
			expect(rt.depthStencilBuffer).toBeDefined();
			rt.destroy();
		});

		it("should bind and unbind", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 100, 100);
			rt.bind();
			expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(rt.framebuffer);
			rt.unbind();
			expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBeNull();
			rt.destroy();
		});

		it("should resize", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 100, 100);
			rt.resize(200, 200);
			expect(rt.width).toEqual(200);
			expect(rt.height).toEqual(200);
			rt.destroy();
		});

		it("should skip resize when dimensions unchanged", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 100, 100);
			const texture = rt.texture;
			rt.resize(100, 100);
			// texture should be the same object (no reallocation)
			expect(rt.texture).toBe(texture);
			rt.destroy();
		});

		it("should clear without error", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 100, 100);
			expect(() => {
				rt.clear();
			}).not.toThrow();
			rt.destroy();
		});

		it("should return valid ImageData from getImageData", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 50, 50);
			const data = rt.getImageData(0, 0, 50, 50);
			expect(data).toBeInstanceOf(ImageData);
			expect(data.width).toEqual(50);
			expect(data.height).toEqual(50);
			rt.destroy();
		});

		it("should destroy and null out resources", () => {
			if (!gl) {
				return;
			}
			const rt = new WebGLRenderTarget(gl, 100, 100);
			rt.destroy();
			expect(rt.framebuffer).toBeNull();
			expect(rt.texture).toBeNull();
			expect(rt.depthStencilBuffer).toBeNull();
		});
	});
});
