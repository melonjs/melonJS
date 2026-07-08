import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	boot,
	Matrix3d,
	Rect,
	ShaderEffect,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Reproductions for the video/GL-core audit findings (2026-07-08), written
 * failing-first: every test below demonstrates its bug on the unfixed code.
 *
 * 1. getSupportedCompressedTextureFormats references the never-assigned
 *    `this._gl` in its WEBKIT fallbacks — throws on any device missing at
 *    least one compression family (i.e. everything except ANGLE/Metal Macs).
 * 2. WebGL clearRect "erases" with OPAQUE black (its JSDoc promises
 *    transparent black; the Canvas renderer genuinely erases).
 * 3. disableScissor() doesn't flush, so quads batched inside the scissor
 *    render unclipped after it's turned off.
 * 4. #gradientMask mis-gates its stencil phases under an INVERTED mask and
 *    restores a parity test that inverts/leaks subsequent draws.
 * 5. Nested multi-effect post-effect passes corrupt the RenderTargetPool:
 *    the parent's endPostEffect dereferences undefined and throws.
 */
describe("video/GL core audit reproductions", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		await boot();
		try {
			video.init(64, 64, {
				parent: "screen",
				renderer: video.WEBGL,
				// alpha readback for the clearRect test needs a transparent
				// backbuffer; SwiftShader needs the caveat opt-out
				transparent: true,
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// no WebGL at all — tests skip below
		}
		if (video.renderer instanceof WebGLRenderer) {
			renderer = video.renderer;
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		try {
			video.init(64, 64, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	const setupProjection = () => {
		const proj = new Matrix3d();
		proj.ortho(0, 64, 64, 0, -1000, 1000);
		renderer.setProjection(proj);
	};

	// canvas-space pixel read (readPixels is y-up)
	const readPixel = (x, y) => {
		const px = new Uint8Array(4);
		gl.finish();
		gl.readPixels(x, 64 - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	};

	const whiteTex = () => {
		const c = document.createElement("canvas");
		c.width = 4;
		c.height = 4;
		const ctx2d = c.getContext("2d");
		ctx2d.fillStyle = "#ffffff";
		ctx2d.fillRect(0, 0, 4, 4);
		return c;
	};

	it("getSupportedCompressedTextureFormats survives a missing extension family (the this._gl fallbacks)", (ctx) => {
		requireWebGL(ctx);
		// force at least one family's primary lookup to miss, so the WEBKIT
		// fallback path actually evaluates — on the unfixed code that path
		// dereferences the never-assigned `this._gl` and throws
		const orig = gl.getExtension.bind(gl);
		const spy = vi.spyOn(gl, "getExtension").mockImplementation((name) => {
			if (name === "WEBGL_compressed_texture_astc") {
				return null;
			}
			return orig(name);
		});
		try {
			let formats;
			expect(() => {
				formats = renderer.getSupportedCompressedTextureFormats();
			}).not.toThrow();
			expect(typeof formats).toBe("object");
		} finally {
			spy.mockRestore();
		}
	});

	it("clearRect erases to TRANSPARENT black, per its own JSDoc (parity with Canvas)", (ctx) => {
		requireWebGL(ctx);
		setupProjection();
		renderer.setColor("#ff0000");
		renderer.fillRect(10, 10, 20, 20);
		renderer.flush();

		renderer.clearRect(12, 12, 4, 4);

		// inside the cleared area: must be fully transparent, not opaque black
		const cleared = readPixel(13, 13);
		expect(cleared[3]).toBe(0);
		// outside the cleared area: the red fill is untouched
		const kept = readPixel(25, 25);
		expect(kept[0]).toBeGreaterThan(200);
		expect(kept[3]).toBe(255);
	});

	it("disableScissor flushes pending quads so they can't escape the scissor", (ctx) => {
		requireWebGL(ctx);
		setupProjection();
		// black background
		renderer.setColor("#000000");
		renderer.fillRect(0, 0, 64, 64);
		renderer.flush();

		// draw a sprite fully OUTSIDE the scissor box, then disable the
		// scissor while the quad is still batched — it must NOT render
		renderer.enableScissor(0, 0, 8, 8);
		renderer.drawImage(whiteTex(), 40, 40);
		renderer.disableScissor();
		renderer.flush();

		const px = readPixel(42, 42);
		expect(px[0]).toBeLessThan(50); // stays black — the quad was clipped
	});

	it("gradient shape fills respect an INVERTED mask, and later draws keep the mask test", (ctx) => {
		requireWebGL(ctx);
		setupProjection();
		// black background
		renderer.setColor("#000000");
		renderer.fillRect(0, 0, 64, 64);
		renderer.flush();

		// inverted mask: visible OUTSIDE the center box
		renderer.setMask(new Rect(16, 16, 32, 32), true);

		// a solid-red gradient (color constant → assertions are exact).
		// NOTE: fillEllipse, not fillRect — the rect fill renders gradients
		// as a plain textured quad (no #gradientMask stencil pass); the
		// shape fills (ellipse/polygon/arc/roundRect) are the stencil path.
		const grad = renderer.createLinearGradient(0, 0, 64, 0);
		grad.addColorStop(0, "#ff0000").addColorStop(1, "#ff0000");
		renderer.setColor(grad);
		renderer.fillEllipse(32, 32, 30, 30);
		renderer.flush();

		// the gradient ellipse must land in the VISIBLE (outside) region only
		const outside = readPixel(6, 32); // inside ellipse, outside mask box
		const inside = readPixel(32, 32); // inside ellipse AND mask box
		expect(outside[0]).toBeGreaterThan(200); // red outside the cutout
		expect(inside[0]).toBeLessThan(50); // cutout interior untouched

		// draws AFTER the gradient must still obey the inverted mask
		renderer.setColor("#00ff00");
		renderer.fillRect(0, 0, 64, 64);
		renderer.flush();
		const outside2 = readPixel(4, 4);
		const inside2 = readPixel(32, 32);
		expect(outside2[1]).toBeGreaterThan(200); // green outside
		expect(inside2[1]).toBeLessThan(50); // interior still masked

		renderer.clearMask();
	});

	// LAST on purpose: on the unfixed code this corrupts renderer/pool state
	it("nested multi-effect post-effect passes don't corrupt the render-target pool", (ctx) => {
		requireWebGL(ctx);
		const fx = () => {
			const effect = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color; }",
			);
			return effect;
		};
		// duck-typed renderables — beginPostEffect/endPostEffect read exactly
		// these two fields (same shape Renderable.preDraw/postDraw provide)
		const parent = {
			postEffects: [fx(), fx()],
			_postEffectManaged: false,
		};
		const child = {
			postEffects: [fx(), fx()],
			_postEffectManaged: false,
		};

		// the exact call order Container.draw produces for a 2-effect
		// container holding a 2-effect child
		renderer.beginPostEffect(parent);
		renderer.beginPostEffect(child);
		renderer.endPostEffect(child);
		expect(() => {
			renderer.endPostEffect(parent);
		}).not.toThrow();

		for (const r of [parent, child]) {
			for (const effect of r.postEffects) {
				effect.destroy();
			}
		}
	});

	it("mask nesting depth is clamped below the gradient marker bit", (ctx) => {
		requireWebGL(ctx);
		// #gradientMask reserves stencil bit 0x80 as its temporary marker —
		// mask levels must stay in the low 7 bits or the marker can collide
		// (an 8-bit stencil couldn't represent deeper nesting anyway)
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			for (let i = 0; i < 130; i++) {
				renderer.setMask(new Rect(0, 0, 4, 4));
			}
			expect(renderer.maskLevel).toBeLessThan(0x80);
		} finally {
			renderer.clearMask();
			warnSpy.mockRestore();
		}
	});

	it("reset() clears the effect-projection stack (mid-pass exception recovery)", (ctx) => {
		requireWebGL(ctx);
		// simulate a draw throwing between begin and end: the pass never
		// ends, leaving a stale entry — reset() (GAME_RESET / context
		// restore) must clear it or every later pass leaks a matrix and
		// the pool's nesting depth inflates forever
		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		const orphan = {
			postEffects: [effect, effect],
			_postEffectManaged: false,
		};
		renderer.beginPostEffect(orphan);
		expect(renderer._effectPassDepth).toBe(1);
		renderer.reset();
		expect(renderer._effectPassDepth).toBe(0);
		effect.destroy();
	});
});
