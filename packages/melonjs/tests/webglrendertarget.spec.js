import { beforeEach, describe, expect, it, vi } from "vitest";
import WebGLRenderTarget from "../src/video/rendertarget/webglrendertarget.js";

// Numeric WebGL constants used by the tests (values from the WebGL spec).
const RENDERBUFFER = 0x8d41;
const FRAMEBUFFER = 0x8d40;
const FRAMEBUFFER_COMPLETE = 0x8cd5;
const FRAMEBUFFER_UNSUPPORTED = 0x8cdd;
const DEPTH_STENCIL = 0x84f9;
const DEPTH_STENCIL_ATTACHMENT = 0x821a;
const COLOR_ATTACHMENT0 = 0x8ce0;
const TEXTURE_2D = 0x0de1;
const RGBA = 0x1908;
const UNSIGNED_BYTE = 0x1401;
const TEXTURE_MIN_FILTER = 0x2801;
const TEXTURE_MAG_FILTER = 0x2800;
const TEXTURE_WRAP_S = 0x2802;
const TEXTURE_WRAP_T = 0x2803;
const LINEAR = 0x2601;
const CLAMP_TO_EDGE = 0x812f;
const ACTIVE_TEXTURE = 0x84e0;
const TEXTURE0 = 0x84c0;

// Build a minimal mock gl context. `extras` overrides any default field —
// the `webGL1` helper omits the WebGL1-undefined `DEPTH_STENCIL_ATTACHMENT`.
function makeMockGL(extras = {}) {
	const calls = {
		renderbufferStorage: [],
		framebufferRenderbuffer: [],
		texImage2D: [],
	};
	const base = {
		// constants — the bug's blast radius depends on which are present
		RENDERBUFFER,
		FRAMEBUFFER,
		FRAMEBUFFER_COMPLETE,
		COLOR_ATTACHMENT0,
		TEXTURE_2D,
		RGBA,
		UNSIGNED_BYTE,
		TEXTURE_MIN_FILTER,
		TEXTURE_MAG_FILTER,
		TEXTURE_WRAP_S,
		TEXTURE_WRAP_T,
		LINEAR,
		CLAMP_TO_EDGE,
		ACTIVE_TEXTURE,
		// state queries
		getParameter: vi.fn(() => {
			return TEXTURE0;
		}),
		// resource creation
		createFramebuffer: vi.fn(() => {
			return {};
		}),
		createTexture: vi.fn(() => {
			return {};
		}),
		createRenderbuffer: vi.fn(() => {
			return {};
		}),
		// binding
		activeTexture: vi.fn(),
		bindTexture: vi.fn(),
		bindFramebuffer: vi.fn(),
		bindRenderbuffer: vi.fn(),
		// configuration
		texImage2D: vi.fn((...args) => {
			calls.texImage2D.push(args);
		}),
		texParameteri: vi.fn(),
		renderbufferStorage: vi.fn((...args) => {
			calls.renderbufferStorage.push(args);
		}),
		framebufferTexture2D: vi.fn(),
		framebufferRenderbuffer: vi.fn((...args) => {
			calls.framebufferRenderbuffer.push(args);
		}),
		checkFramebufferStatus: vi.fn(() => {
			return FRAMEBUFFER_COMPLETE;
		}),
	};
	const gl = { ...base, ...extras };
	gl.__calls = calls;
	return gl;
}

describe("WebGLRenderTarget", () => {
	describe("WebGL1 stencil constant fallbacks", () => {
		let gl;
		beforeEach(() => {
			// WebGL1 worst case: gl context exposes neither DEPTH_STENCIL nor
			// DEPTH_STENCIL_ATTACHMENT (both `undefined`).
			gl = makeMockGL();
		});

		it("falls back to numeric DEPTH_STENCIL (0x84F9) for renderbufferStorage", () => {
			const target = new WebGLRenderTarget(gl, 256, 128);
			expect(target).toBeDefined();

			const call = gl.__calls.renderbufferStorage[0];
			expect(call).toBeDefined();
			expect(call[0]).toBe(RENDERBUFFER);
			expect(call[1]).toBe(DEPTH_STENCIL);
			expect(call[2]).toBe(256);
			expect(call[3]).toBe(128);
		});

		it("falls back to numeric DEPTH_STENCIL_ATTACHMENT (0x821A) for framebufferRenderbuffer", () => {
			const target = new WebGLRenderTarget(gl, 256, 128);
			expect(target).toBeDefined();

			const call = gl.__calls.framebufferRenderbuffer[0];
			expect(call).toBeDefined();
			expect(call[0]).toBe(FRAMEBUFFER);
			expect(call[1]).toBe(DEPTH_STENCIL_ATTACHMENT);
			expect(call[2]).toBe(RENDERBUFFER);
		});

		it("uses gl context constants when they are exposed (WebGL2 path)", () => {
			// WebGL2-style: constants present on the gl object.
			const webgl2 = makeMockGL({
				DEPTH_STENCIL: 0x99aa,
				DEPTH_STENCIL_ATTACHMENT: 0x99bb,
			});
			const target = new WebGLRenderTarget(webgl2, 64, 64);
			expect(target).toBeDefined();

			expect(webgl2.__calls.renderbufferStorage[0][1]).toBe(0x99aa);
			expect(webgl2.__calls.framebufferRenderbuffer[0][1]).toBe(0x99bb);
		});

		it("resize() reuses the same fallback constant", () => {
			const target = new WebGLRenderTarget(gl, 256, 128);
			gl.__calls.renderbufferStorage.length = 0;

			target.resize(512, 256);

			const call = gl.__calls.renderbufferStorage[0];
			expect(call).toBeDefined();
			expect(call[1]).toBe(DEPTH_STENCIL);
			expect(call[2]).toBe(512);
			expect(call[3]).toBe(256);
		});
	});

	describe("framebuffer completeness validation", () => {
		it("sets _hasStencil=true on FRAMEBUFFER_COMPLETE", () => {
			const gl = makeMockGL();
			const target = new WebGLRenderTarget(gl, 64, 64);
			expect(target._hasStencil).toBe(true);
		});

		it("sets _hasStencil=false and warns on incomplete framebuffer (no throw)", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
				/* swallow */
			});
			const gl = makeMockGL({
				checkFramebufferStatus: vi.fn(() => {
					return FRAMEBUFFER_UNSUPPORTED;
				}),
			});

			// must not throw even when attachment fails
			let target;
			expect(() => {
				target = new WebGLRenderTarget(gl, 64, 64);
			}).not.toThrow();

			expect(target._hasStencil).toBe(false);
			expect(warnSpy).toHaveBeenCalledOnce();
			expect(warnSpy.mock.calls[0][0]).toMatch(/incomplete/i);

			warnSpy.mockRestore();
		});
	});
});
