import { beforeEach, describe, expect, it, vi } from "vitest";
import WebGLRenderTarget from "../src/video/rendertarget/webglrendertarget.js";

// Numeric WebGL constants used by the tests (values from the WebGL spec).
const RENDERBUFFER = 0x8d41;
const FRAMEBUFFER = 0x8d40;
const FRAMEBUFFER_COMPLETE = 0x8cd5;
const FRAMEBUFFER_UNSUPPORTED = 0x8cdd;
const DEPTH_STENCIL = 0x84f9;
const DEPTH_STENCIL_ATTACHMENT = 0x821a;
const DEPTH_ATTACHMENT = 0x8d00;
const DEPTH_COMPONENT16 = 0x81a5;
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

// Build a minimal mock gl context, WebGL2-shaped: the packed depth-stencil
// constants are always present on a real WebGL 2 context (the WebGL 1
// missing-constant fallback was removed with WebGL 1 support in 20.0).
function makeMockGL(extras = {}) {
	const calls = {
		renderbufferStorage: [],
		renderbufferStorageMultisample: [],
		framebufferRenderbuffer: [],
		texImage2D: [],
		texStorage2D: [],
		blitFramebuffer: [],
	};
	const base = {
		// constants — always present on a WebGL 2 context
		DEPTH_STENCIL,
		DEPTH_STENCIL_ATTACHMENT,
		RENDERBUFFER,
		FRAMEBUFFER,
		FRAMEBUFFER_COMPLETE,
		DEPTH_ATTACHMENT,
		DEPTH_COMPONENT16,
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
		RGBA8: 0x8058,
		DEPTH24_STENCIL8: 0x88f0,
		READ_FRAMEBUFFER: 0x8ca8,
		DRAW_FRAMEBUFFER: 0x8ca9,
		COLOR_BUFFER_BIT: 0x4000,
		NEAREST: 0x2600,
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
		texStorage2D: vi.fn((...args) => {
			calls.texStorage2D.push(args);
		}),
		renderbufferStorageMultisample: vi.fn((...args) => {
			calls.renderbufferStorageMultisample.push(args);
		}),
		blitFramebuffer: vi.fn((...args) => {
			calls.blitFramebuffer.push(args);
		}),
		deleteTexture: vi.fn(),
		deleteFramebuffer: vi.fn(),
		deleteRenderbuffer: vi.fn(),
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
		readPixels: vi.fn(),
	};
	const gl = { ...base, ...extras };
	gl.__calls = calls;
	return gl;
}

describe("WebGLRenderTarget", () => {
	describe("packed depth-stencil attachment", () => {
		let gl;
		beforeEach(() => {
			gl = makeMockGL();
		});

		it("uses the context's DEPTH_STENCIL for renderbufferStorage", () => {
			const target = new WebGLRenderTarget(gl, 256, 128);
			expect(target).toBeDefined();

			const call = gl.__calls.renderbufferStorage[0];
			expect(call).toBeDefined();
			expect(call[0]).toBe(RENDERBUFFER);
			expect(call[1]).toBe(DEPTH_STENCIL);
			expect(call[2]).toBe(256);
			expect(call[3]).toBe(128);
		});

		it("uses the context's DEPTH_STENCIL_ATTACHMENT for framebufferRenderbuffer", () => {
			const target = new WebGLRenderTarget(gl, 256, 128);
			expect(target).toBeDefined();

			const call = gl.__calls.framebufferRenderbuffer[0];
			expect(call).toBeDefined();
			expect(call[0]).toBe(FRAMEBUFFER);
			expect(call[1]).toBe(DEPTH_STENCIL_ATTACHMENT);
			expect(call[2]).toBe(RENDERBUFFER);
		});

		it("honors whatever constant values the context exposes", () => {
			// paranoia: values must be read off the context, never hardcoded
			const webgl2 = makeMockGL({
				DEPTH_STENCIL: 0x99aa,
				DEPTH_STENCIL_ATTACHMENT: 0x99bb,
			});
			const target = new WebGLRenderTarget(webgl2, 64, 64);
			expect(target).toBeDefined();

			expect(webgl2.__calls.renderbufferStorage[0][1]).toBe(0x99aa);
			expect(webgl2.__calls.framebufferRenderbuffer[0][1]).toBe(0x99bb);
		});

		it("resize() reuses the context constant", () => {
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

		it("falls back to depth-only when packed depth+stencil is incomplete", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
				/* swallow */
			});
			// First check (after depth+stencil attach) fails; second (after
			// depth-only fallback) succeeds.
			let callCount = 0;
			const gl = makeMockGL({
				checkFramebufferStatus: vi.fn(() => {
					callCount++;
					return callCount === 1
						? FRAMEBUFFER_UNSUPPORTED
						: FRAMEBUFFER_COMPLETE;
				}),
			});

			let target;
			expect(() => {
				target = new WebGLRenderTarget(gl, 64, 64);
			}).not.toThrow();

			expect(target._hasStencil).toBe(false);
			// fallback path called framebufferRenderbuffer with DEPTH_ATTACHMENT
			const depthOnlyAttach = gl.__calls.framebufferRenderbuffer.find(
				(call) => {
					return call[1] === DEPTH_ATTACHMENT;
				},
			);
			expect(depthOnlyAttach).toBeDefined();
			// fallback called renderbufferStorage with DEPTH_COMPONENT16
			const depthOnlyStorage = gl.__calls.renderbufferStorage.find((call) => {
				return call[1] === DEPTH_COMPONENT16;
			});
			expect(depthOnlyStorage).toBeDefined();
			// warned about depth-only fallback (not "incomplete after fallback")
			expect(warnSpy).toHaveBeenCalledOnce();
			expect(warnSpy.mock.calls[0][0]).toMatch(/depth-only/i);

			warnSpy.mockRestore();
		});

		it("warns and continues when even depth-only is incomplete", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
				/* swallow */
			});
			const gl = makeMockGL({
				checkFramebufferStatus: vi.fn(() => {
					return FRAMEBUFFER_UNSUPPORTED;
				}),
			});

			let target;
			expect(() => {
				target = new WebGLRenderTarget(gl, 64, 64);
			}).not.toThrow();

			expect(target._hasStencil).toBe(false);
			expect(warnSpy).toHaveBeenCalledOnce();
			expect(warnSpy.mock.calls[0][0]).toMatch(
				/incomplete after depth-only fallback/i,
			);

			warnSpy.mockRestore();
		});

		it("resize() re-validates completeness and updates _hasStencil", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
				/* swallow */
			});
			// Construction succeeds. Resize then fails depth+stencil but succeeds
			// depth-only — _hasStencil should flip from true → false.
			let callCount = 0;
			const gl = makeMockGL({
				checkFramebufferStatus: vi.fn(() => {
					callCount++;
					// 1st: ctor depth+stencil → COMPLETE
					// 2nd: resize depth+stencil → UNSUPPORTED
					// 3rd: resize depth-only → COMPLETE
					if (callCount === 2) {
						return FRAMEBUFFER_UNSUPPORTED;
					}
					return FRAMEBUFFER_COMPLETE;
				}),
			});
			const target = new WebGLRenderTarget(gl, 64, 64);
			expect(target._hasStencil).toBe(true);

			target.resize(128, 64);
			expect(target._hasStencil).toBe(false);

			warnSpy.mockRestore();
		});
	});

	describe("MSAA render half (samples > 0)", () => {
		const RGBA8 = 0x8058;
		const DEPTH24_STENCIL8 = 0x88f0;
		const READ_FRAMEBUFFER = 0x8ca8;
		const DRAW_FRAMEBUFFER = 0x8ca9;
		let gl;
		beforeEach(() => {
			gl = makeMockGL();
		});

		it("allocates the multisampled pair with SIZED formats only", () => {
			const target = new WebGLRenderTarget(gl, 256, 128, { samples: 4 });
			expect(target.renderFramebuffer).not.toBe(null);
			expect(target.colorRenderbuffer).not.toBe(null);

			const msaa = gl.__calls.renderbufferStorageMultisample;
			// color: RGBA8 at the requested sample count
			const color = msaa.find((call) => {
				return call[2] === RGBA8;
			});
			expect(color).toEqual([RENDERBUFFER, 4, RGBA8, 256, 128]);
			// depth-stencil: the SIZED packed format (the unsized token is
			// invalid for multisampled storage)
			const depth = msaa.find((call) => {
				return call[2] === DEPTH24_STENCIL8;
			});
			expect(depth).toEqual([RENDERBUFFER, 4, DEPTH24_STENCIL8, 256, 128]);
			// nothing took the single-sampled path
			expect(gl.__calls.renderbufferStorage).toHaveLength(0);
		});

		it("bind() targets the render half and arms the resolve", () => {
			const target = new WebGLRenderTarget(gl, 64, 64, { samples: 4 });
			gl.bindFramebuffer.mockClear();
			target.bind();
			expect(gl.bindFramebuffer).toHaveBeenCalledWith(
				FRAMEBUFFER,
				target.renderFramebuffer,
			);
			expect(target._needsResolve).toBe(true);
		});

		it("resolve() blits render → resolve exactly ONCE until the next bind", () => {
			const target = new WebGLRenderTarget(gl, 64, 32, { samples: 4 });
			target.bind();
			gl.bindFramebuffer.mockClear();
			target.resolve();

			expect(gl.__calls.blitFramebuffer).toHaveLength(1);
			expect(gl.__calls.blitFramebuffer[0]).toEqual([
				0, 0, 64, 32, 0, 0, 64, 32, 0x4000 /* COLOR_BUFFER_BIT */,
				0x2600 /* NEAREST */,
			]);
			// READ = multisampled half, DRAW = sampleable half
			expect(gl.bindFramebuffer).toHaveBeenCalledWith(
				READ_FRAMEBUFFER,
				target.renderFramebuffer,
			);
			expect(gl.bindFramebuffer).toHaveBeenCalledWith(
				DRAW_FRAMEBUFFER,
				target.framebuffer,
			);
			// leaves nothing bound — callers rebind what they need
			expect(gl.bindFramebuffer).toHaveBeenLastCalledWith(FRAMEBUFFER, null);

			// second resolve without new draws: no extra blit
			target.resolve();
			expect(gl.__calls.blitFramebuffer).toHaveLength(1);

			// a re-bind re-arms it (new draws → new resolve)
			target.bind();
			target.resolve();
			expect(gl.__calls.blitFramebuffer).toHaveLength(2);
		});

		it("unbind() auto-resolves so the texture always holds final pixels", () => {
			const target = new WebGLRenderTarget(gl, 64, 64, { samples: 4 });
			target.bind();
			target.unbind();
			expect(gl.__calls.blitFramebuffer).toHaveLength(1);
			expect(target._needsResolve).toBe(false);
		});

		it("getImageData() resolves BEFORE reading (readPixels from a multisampled framebuffer is a GL error)", () => {
			const target = new WebGLRenderTarget(gl, 64, 64, { samples: 4 });
			target.bind();
			target.getImageData(0, 0, 4, 4);
			expect(gl.__calls.blitFramebuffer).toHaveLength(1);
			expect(gl.readPixels).toHaveBeenCalledTimes(1);
			// the blit landed before the read
			expect(gl.blitFramebuffer.mock.invocationCallOrder[0]).toBeLessThan(
				gl.readPixels.mock.invocationCallOrder[0],
			);
		});

		it("resize() respecifies the renderbuffers IN PLACE and recreates only the color texture", () => {
			const target = new WebGLRenderTarget(gl, 64, 64, { samples: 4 });
			const framebuffers = gl.createFramebuffer.mock.calls.length;
			const renderbuffers = gl.createRenderbuffer.mock.calls.length;
			gl.__calls.renderbufferStorageMultisample.length = 0;
			gl.__calls.texStorage2D.length = 0;

			target.bind();
			target.resize(128, 32);

			// renderbuffers and framebuffers are respecified, never recreated
			expect(gl.createFramebuffer.mock.calls.length).toBe(framebuffers);
			expect(gl.createRenderbuffer.mock.calls.length).toBe(renderbuffers);
			// but immutable color storage cannot be — the texture is replaced
			expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
			expect(gl.__calls.texStorage2D).toEqual([
				[TEXTURE_2D, 1, RGBA8, 128, 32],
			]);
			// both msaa halves re-allocated at the new size
			const msaa = gl.__calls.renderbufferStorageMultisample;
			expect(msaa).toContainEqual([RENDERBUFFER, 4, RGBA8, 128, 32]);
			expect(msaa).toContainEqual([RENDERBUFFER, 4, DEPTH24_STENCIL8, 128, 32]);
			// stale samples from before the resize must never resolve
			expect(target._needsResolve).toBe(false);
		});

		it("destroy() releases the full multisampled set", () => {
			const target = new WebGLRenderTarget(gl, 64, 64, { samples: 4 });
			target.destroy();
			// resolve + render framebuffers
			expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(2);
			// depth-stencil + msaa color renderbuffers
			expect(gl.deleteRenderbuffer).toHaveBeenCalledTimes(2);
			expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
			expect(target.renderFramebuffer).toBe(null);
			expect(target.colorRenderbuffer).toBe(null);
		});

		it("samples: 0 keeps the exact single-sampled shape (regression pin)", () => {
			const target = new WebGLRenderTarget(gl, 64, 64, { samples: 0 });
			expect(target.renderFramebuffer).toBe(null);
			expect(target.colorRenderbuffer).toBe(null);
			expect(gl.__calls.renderbufferStorageMultisample).toHaveLength(0);

			gl.bindFramebuffer.mockClear();
			target.bind();
			expect(gl.bindFramebuffer).toHaveBeenCalledWith(
				FRAMEBUFFER,
				target.framebuffer,
			);
			// resolve is a no-op — nothing to blit
			target.resolve();
			target.unbind();
			expect(gl.__calls.blitFramebuffer).toHaveLength(0);
		});
	});
});
