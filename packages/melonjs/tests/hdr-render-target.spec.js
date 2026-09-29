/**
 * The `hdr` application setting, its capability flags, and the format they
 * settle on.
 *
 * Driven through a REAL `WebGLRenderer`, with only `gl.getExtension` swapped
 * underneath it, so the code under test is the shipped code rather than a
 * transcription of it. That matters here more than usual: the interesting
 * cases are drivers this machine does not have, and the temptation is to
 * re-implement the three-line derivation in the spec and prove nothing.
 *
 * What is pinned:
 *
 * 1. **The default.** `hdr` is off, so the format stays 8 bits per channel.
 *    Turning it on doubles render-target memory and changes the pipeline per
 *    driver, so the default drifting would be a silent cost to every game.
 * 2. **The gate is renderability only, from either extension.** Filtering a
 *    half-float texture is CORE in WebGL2, so there is no filtering probe;
 *    the original gate gets this wrong and is pinned against regressing by
 *    the first test below, which refuses to stub the driver.
 * 3. **Restore re-derives everything.** The flags and the format are values
 *    captured at a moment in time. A restored context is a NEW context that
 *    need not offer what the old one did, and nothing else recomputes them.
 * 4. **The advanced-blend target stays 8-bit even under HDR**, because its
 *    blend formulas rely on the premultiplied invariant `rgb <= a`, and
 *    half-float storage is exactly what makes `rgb > a` reachable.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	BloomEffect,
	boot,
	ToneMappingEffect,
	video,
} from "../src/index.js";
import WebGLRenderTarget from "../src/video/rendertarget/webglrendertarget.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const COLOR_BUFFER_HALF_FLOAT = "EXT_color_buffer_half_float";
const COLOR_BUFFER_FLOAT = "EXT_color_buffer_float";

/**
 * Re-run the renderer's own capability + format derivation with the driver
 * pretending to offer exactly `available`. Restores the real `getExtension`
 * before returning, so one test cannot leak a fake driver into the next.
 * @param {object} renderer - a real WebGLRenderer
 * @param {Set<string>} available - extension names the driver should report
 * @param {object} [settings] - `settings.hdr` override for this run
 * @returns {{format: number, supportsHDR: boolean, supportsFloatTargets: boolean, warnings: string[]}}
 */
function withDriver(renderer, available, settings = {}) {
	const gl = renderer.gl;
	const realGetExtension = gl.getExtension.bind(gl);
	const realHdr = renderer.settings.hdr;
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

	gl.getExtension = (name) => {
		return available.has(name) ? { name } : null;
	};
	if ("hdr" in settings) {
		renderer.settings.hdr = settings.hdr;
	}
	renderer._extensions.clear();
	// a fresh driver has not refused anything yet
	renderer._hdrRefusalWarned = false;
	renderer._deriveCapabilities();
	renderer._resolveColorFormat();

	const result = {
		format: renderer._colorFormat,
		supportsHDR: renderer.supportsHDR,
		supportsFloatTargets: renderer.supportsFloatTargets,
		warnings: warn.mock.calls.map((c) => {
			return String(c[0]);
		}),
	};

	warn.mockRestore();
	gl.getExtension = realGetExtension;
	renderer.settings.hdr = realHdr;
	// leave the renderer describing its actual driver again
	renderer._extensions.clear();
	renderer._deriveCapabilities();
	renderer._resolveColorFormat();
	return result;
}

describe("hdr", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(32, 32);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	it("is off by default, and the format stays 8 bits", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// not merely "the setting is falsy" — what matters is the format the
		// render targets are actually built with
		expect(renderer.settings.hdr).not.toBe(true);
		expect(renderer._colorFormat).toBe(renderer.gl.RGBA8);

		// And on a driver that COULD do it. The assertion above only proves
		// the default on hardware that cannot honour HDR anyway, which is
		// the headless driver these tests usually run on — it would pass
		// just as happily if the setting defaulted to on.
		const capable = withDriver(
			renderer,
			new Set([COLOR_BUFFER_FLOAT, COLOR_BUFFER_HALF_FLOAT]),
			{ hdr: undefined },
		);
		expect(capable.format).toBe(renderer.gl.RGBA8);
		// and the flag says so. `supportsHDR` is what was GRANTED, not what
		// the driver could have granted: this driver can do half-float and
		// the setting is off, so the answer is no.
		//
		// It read the capability once, and the cost was immediate — the
		// first game to branch a grade on it took the headroom path against
		// 8-bit targets, which tone maps an already-clamped frame and turns
		// the whole picture dark.
		expect(capable.supportsFloatTargets).toBe(true);
		expect(capable.supportsHDR).toBe(false);
	});

	it("follows the setting, not just the driver", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// one driver, both answers: the flag has to track the setting or it
		// is a capability probe wearing the wrong name
		const both = new Set([COLOR_BUFFER_FLOAT, COLOR_BUFFER_HALF_FLOAT]);
		const on = withDriver(renderer, both, { hdr: true });
		const off = withDriver(renderer, both, { hdr: false });

		expect(on.supportsHDR).toBe(true);
		expect(on.format).toBe(renderer.gl.RGBA16F);
		expect(off.supportsHDR).toBe(false);
		expect(off.format).toBe(renderer.gl.RGBA8);
		// the capability underneath never moved
		expect(on.supportsFloatTargets).toBe(true);
		expect(off.supportsFloatTargets).toBe(true);
	});

	it("gates on extension names a WebGL2 driver can actually return", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// The bug this exists for: the original gate probed
		// `OES_texture_half_float_linear`, which the Khronos registry marks
		// "no longer available as of the WebGL API 2.0 specification" —
		// linear filtering of half-float is CORE in WebGL2. So `supportsHDR`
		// could never be true, the setting was unreachable, and every other
		// test in this file passed anyway because they stub `getExtension`
		// to answer yes to any name asked of it.
		//
		// This one refuses to stub. It asserts against the driver's own list
		// of what it can offer.
		const supported = renderer.gl.getSupportedExtensions();
		expect(supported).not.toContain("OES_texture_half_float_linear");
		expect(
			supported.includes("EXT_color_buffer_float") ||
				supported.includes("EXT_color_buffer_half_float"),
		).toBe(true);

		// and the flag derived from them agrees with the driver
		expect(renderer.supportsFloatTargets).toBe(true);

		// then the whole grant path on the REAL driver, still unstubbed:
		// turn the setting on and the chain must actually take half-float.
		// `supportsHDR` is false above only because the setting is off.
		const realHdr = renderer.settings.hdr;
		try {
			renderer.settings.hdr = true;
			renderer._extensions.clear();
			renderer._deriveCapabilities();
			renderer._resolveColorFormat();
			expect(renderer.supportsHDR).toBe(true);
			expect(renderer._colorFormat).toBe(renderer.gl.RGBA16F);
		} finally {
			renderer.settings.hdr = realHdr;
			renderer._extensions.clear();
			renderer._deriveCapabilities();
			renderer._resolveColorFormat();
		}
		expect(renderer.supportsHDR).toBe(false);
		expect(renderer._colorFormat).toBe(renderer.gl.RGBA8);
	});

	it("reports flags that agree with each other", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// whatever this machine's driver offers, HDR can never be true while
		// renderability is false — that combination is incoherent
		expect(typeof renderer.supportsHDR).toBe("boolean");
		expect(typeof renderer.supportsFloatTargets).toBe("boolean");
		if (renderer.supportsHDR === true) {
			expect(renderer.supportsFloatTargets).toBe(true);
		}
	});

	it("takes half-float when asked and the driver has both halves", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const r = withDriver(
			renderer,
			new Set([COLOR_BUFFER_FLOAT, COLOR_BUFFER_HALF_FLOAT]),
			{ hdr: true },
		);
		expect(r.supportsHDR).toBe(true);
		expect(r.format).toBe(renderer.gl.RGBA16F);
		expect(r.warnings).toHaveLength(0);
	});

	it("accepts a driver shipping only EXT_color_buffer_float", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the WebGL2-era name, and the only one some drivers expose
		const r = withDriver(renderer, new Set([COLOR_BUFFER_FLOAT]), {
			hdr: true,
		});
		expect(r.supportsHDR).toBe(true);
		expect(r.format).toBe(renderer.gl.RGBA16F);
		expect(r.warnings).toHaveLength(0);
	});

	it("accepts a driver shipping only EXT_color_buffer_half_float", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the WebGL1-era name, which most WebGL2 drivers still carry
		const r = withDriver(renderer, new Set([COLOR_BUFFER_HALF_FLOAT]), {
			hdr: true,
		});
		expect(r.supportsHDR).toBe(true);
		expect(r.format).toBe(renderer.gl.RGBA16F);
	});

	it("refuses when the driver cannot render half-float at all, and says so", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const r = withDriver(renderer, new Set(), { hdr: true });
		expect(r.supportsFloatTargets).toBe(false);
		expect(r.supportsHDR).toBe(false);
		expect(r.format).toBe(renderer.gl.RGBA8);
		expect(r.warnings[0]).toContain(COLOR_BUFFER_FLOAT);
	});

	it("says nothing when HDR was never asked for", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// an unsupported driver must not nag a game that never wanted it
		const r = withDriver(renderer, new Set(), { hdr: false });
		expect(r.warnings).toHaveLength(0);
		expect(r.format).toBe(renderer.gl.RGBA8);
	});

	it("memoizes each probe, including a missing one", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const gl = renderer.gl;
		const real = gl.getExtension.bind(gl);
		const calls = new Map();
		gl.getExtension = (name) => {
			calls.set(name, (calls.get(name) ?? 0) + 1);
			return null; // the ABSENT case is the one a hot path repeats
		};
		renderer._extensions.clear();
		for (let i = 0; i < 5; i++) {
			renderer.extension(COLOR_BUFFER_HALF_FLOAT);
			renderer.extension("WEBGL_debug_renderer_info");
		}
		expect(calls.get(COLOR_BUFFER_HALF_FLOAT)).toBe(1);
		expect(calls.get("WEBGL_debug_renderer_info")).toBe(1);

		gl.getExtension = real;
		renderer._extensions.clear();
		renderer._deriveCapabilities();
		renderer._resolveColorFormat();
	});

	it("re-derives flags AND format when the context is restored", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// come back on a driver that can do it...
		const good = withDriver(
			renderer,
			new Set([COLOR_BUFFER_FLOAT, COLOR_BUFFER_HALF_FLOAT]),
			{ hdr: true },
		);
		expect(good.format).toBe(renderer.gl.RGBA16F);

		// ...and then on one that cannot. Clearing the memo alone would leave
		// both the flag and the format describing the context that died, and
		// every target would ask for a format the driver can no longer give.
		const bad = withDriver(renderer, new Set(), { hdr: true });
		expect(bad.supportsHDR).toBe(false);
		expect(bad.format).toBe(renderer.gl.RGBA8);
	});
});

describe("hdr — the application setting reaches the targets", () => {
	/**
	 * End to end, through the front door: an `Application` built with
	 * `hdr: true` must come up with half-float targets, with nobody calling
	 * `setHDR` afterwards.
	 *
	 * Everything else in this file drives `_deriveCapabilities` and
	 * `_resolveColorFormat` by hand, which proves the resolver is right but
	 * says nothing about whether the CONSTRUCTOR ever reaches it. Deleting
	 * that one line left all of them passing, so this is the test that holds
	 * the startup path down: the setting is what a game actually writes, and
	 * a `hdr: true` that quietly did nothing would look exactly like a
	 * driver refusing it.
	 */
	const build = async (hdr) => {
		await boot();
		const app = new Application(64, 64, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
			hdr,
		});
		await app.init();
		return app;
	};

	it("comes up half-float when the setting asks for it", async (ctx) => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const app = await build(true);
		try {
			if (app.renderer.supportsFloatTargets !== true) {
				// a driver that cannot do it is not what this test is about
				ctx.skip();
				return;
			}
			expect(app.renderer.supportsHDR).toBe(true);
			expect(app.renderer._colorFormat).toBe(app.renderer.gl.RGBA16F);
		} finally {
			app.destroy();
			warn.mockRestore();
		}
	});

	it("comes up 8-bit when it does not", async () => {
		const app = await build(false);
		try {
			expect(app.renderer.supportsHDR).toBe(false);
			expect(app.renderer._colorFormat).toBe(app.renderer.gl.RGBA8);
		} finally {
			app.destroy();
		}
	});
});

describe("hdr — setHDR at runtime", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	/** run `fn` with the renderer's real hdr setting restored afterwards */
	function borrow(fn) {
		// the renderer is SHARED across specs — leaving HDR on here would
		// hand every later suite a different pipeline than it asked for
		const realHdr = renderer.settings.hdr;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			return fn();
		} finally {
			warn.mockRestore();
			renderer.setHDR(realHdr === true);
		}
	}

	it("moves the color format, on a driver that can", (ctx) => {
		if (typeof renderer === "undefined" || !renderer.supportsFloatTargets) {
			ctx.skip();
			return;
		}
		borrow(() => {
			renderer.setHDR(true);
			expect(renderer.settings.hdr).toBe(true);
			expect(renderer.supportsHDR).toBe(true);
			expect(renderer._colorFormat).toBe(renderer.gl.RGBA16F);

			renderer.setHDR(false);
			expect(renderer.supportsHDR).toBe(false);
			expect(renderer._colorFormat).toBe(renderer.gl.RGBA8);
		});
	});

	it("empties the pool when the format changes, and not when it does not", (ctx) => {
		if (typeof renderer === "undefined" || !renderer.supportsFloatTargets) {
			ctx.skip();
			return;
		}
		borrow(() => {
			renderer.setHDR(false);
			// a pooled target minted in the old format is reused by INDEX and
			// `resize()` early-returns on unchanged dimensions, so nothing
			// else would ever replace it: the chain would blit between halves
			// whose formats disagree
			const destroy = vi.spyOn(renderer._renderTargetPool, "destroy");

			renderer.setHDR(false);
			expect(destroy).not.toHaveBeenCalled();

			renderer.setHDR(true);
			expect(destroy).toHaveBeenCalledTimes(1);
			destroy.mockRestore();
		});
	});

	it("throws away a capture allocated in the old format", (ctx) => {
		if (typeof renderer === "undefined" || !renderer.supportsFloatTargets) {
			ctx.skip();
			return;
		}
		borrow(() => {
			renderer.setHDR(false);
			renderer.toFrameTexture();
			const frame = renderer.getSharedFrameTexture();
			expect(frame.format).toBe(renderer.gl.RGB);
			const stale = frame.glTexture;

			// `copyTexImage2D` bakes the format and `copyTexSubImage2D`
			// cannot change it, so refreshing this one in place would keep
			// capturing 8-bit forever — the steady-state path is reached on
			// every frame after the first, which is what makes it easy to
			// miss
			renderer.setHDR(true);
			renderer.toFrameTexture();
			const after = renderer.getSharedFrameTexture();
			expect(after.format).toBe(renderer.gl.RGBA16F);
			expect(after.glTexture).not.toBe(stale);
		});
	});

	it("says the refusal once, not on every toggle", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// `setHDR` is meant to be driven from a settings toggle. A refusal
		// repeated on every press is the kind of console noise that teaches
		// people to scroll past it, including past the next message.
		const gl = renderer.gl;
		const realGetExtension = gl.getExtension.bind(gl);
		const realHdr = renderer.settings.hdr;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			gl.getExtension = () => {
				return null;
			};
			renderer._extensions.clear();
			renderer._hdrRefusalWarned = false;
			renderer._deriveCapabilities();

			renderer.setHDR(true);
			renderer.setHDR(false);
			renderer.setHDR(true);

			expect(renderer.supportsHDR).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0][0])).toContain(COLOR_BUFFER_FLOAT);
		} finally {
			warn.mockRestore();
			gl.getExtension = realGetExtension;
			renderer._extensions.clear();
			renderer._hdrRefusalWarned = false;
			renderer._deriveCapabilities();
			renderer.setHDR(realHdr === true);
		}
	});

	it("is a no-op that still records the request where it cannot be honoured", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		borrow(() => {
			// asking is not getting, and the two have to stay distinguishable:
			// `settings.hdr` is the request, `supportsHDR` the grant
			const r = withDriver(renderer, new Set(), { hdr: true });
			expect(r.supportsHDR).toBe(false);
			expect(r.format).toBe(renderer.gl.RGBA8);
		});
	});
});

describe("hdr — the render target itself", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(32, 32);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** what the attachment actually is, asked of the driver */
	function attachment(target) {
		const gl = renderer.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
		const type = gl.getFramebufferAttachmentParameter(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE,
		);
		const red = gl.getFramebufferAttachmentParameter(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.FRAMEBUFFER_ATTACHMENT_RED_SIZE,
		);
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return { type, red, complete: status === gl.FRAMEBUFFER_COMPLETE };
	}

	it("builds an 8-bit attachment by default", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const t = new WebGLRenderTarget(renderer.gl, 16, 16, {});
		const a = attachment(t);
		expect(a.complete).toBe(true);
		expect(a.type).toBe(renderer.gl.UNSIGNED_NORMALIZED);
		expect(a.red).toBe(8);
		t.destroy();
	});

	it("builds a half-float attachment when given the format", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the `texStorage2D` site — asked of the driver rather than assumed
		// from the argument we passed in
		const t = new WebGLRenderTarget(renderer.gl, 16, 16, {
			format: renderer.gl.RGBA16F,
		});
		const a = attachment(t);
		expect(a.complete).toBe(true);
		expect(a.type).toBe(renderer.gl.FLOAT);
		expect(a.red).toBe(16);
		t.destroy();
	});

	it("keeps the format across a resize", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// immutable storage cannot be respecified, so `resize` REPLACES the
		// texture — the easiest of the three sites to forget
		const t = new WebGLRenderTarget(renderer.gl, 16, 16, {
			format: renderer.gl.RGBA16F,
		});
		t.resize(24, 24);
		const a = attachment(t);
		expect(a.complete).toBe(true);
		expect(a.type).toBe(renderer.gl.FLOAT);
		expect(t.format).toBe(renderer.gl.RGBA16F);
		t.destroy();
	});

	it("resolves a multisampled half-float target", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// both halves take the same format or `blitFramebuffer` has nothing
		// to resolve between, and MSAA plus half-float is the combination
		// most likely to be refused by a driver
		const gl = renderer.gl;
		const t = new WebGLRenderTarget(gl, 16, 16, {
			format: gl.RGBA16F,
			samples: 4,
		});
		expect(t.renderFramebuffer).toBeTruthy();
		gl.bindFramebuffer(gl.FRAMEBUFFER, t.renderFramebuffer);
		expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(
			gl.FRAMEBUFFER_COMPLETE,
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}
		t._needsResolve = true;
		t.resolve();
		expect(gl.getError()).toBe(gl.NO_ERROR);
		t.destroy();
	});

	it("gives pooled targets the renderer's own format", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// The `format: this._colorFormat` wiring, and that BOTH halves of a
		// chain agree: a capture target (even index) and a ping-pong
		// intermediate (odd) must match or the blit between them fails.
		//
		// Forced to half-float first. With `hdr` off both sides are RGBA8
		// anyway, so the assertion would hold just as well against a factory
		// that passed no format at all — the same trap the default test
		// above fell into.
		const gl = renderer.gl;
		const before = renderer._colorFormat;
		renderer._renderTargetPool.destroy();
		renderer._colorFormat = gl.RGBA16F;

		const capture = renderer._renderTargetPool.get(0, 16, 16);
		const pingpong = renderer._renderTargetPool.get(1, 16, 16);
		expect(capture.format).toBe(gl.RGBA16F);
		expect(pingpong.format).toBe(gl.RGBA16F);

		renderer._colorFormat = before;
		renderer._renderTargetPool.destroy();
	});

	it("keeps the advanced-blend target 8-bit whatever the chain uses", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// Its W3C blend formulas recover straight colour from premultiplied
		// and rely on `rgb <= a`; half-float storage is exactly what makes
		// `rgb > a` reachable, so this one target keeps the clamp that keeps
		// its own maths defined.
		const gl = renderer.gl;
		const before = renderer._colorFormat;
		renderer._colorFormat = gl.RGBA16F;
		renderer._advancedBlendTarget = undefined;
		renderer._openAdvancedBlend("multiply");
		expect(renderer._advancedBlendTarget.format).toBe(gl.RGBA8);
		renderer._closeAdvancedBlend();
		renderer._colorFormat = before;
	});
});

describe("hdr — the paths that read a target back", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(32, 32);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** empty the GL error queue so a later check means what it says */
	function drain(gl) {
		while (gl.getError() !== gl.NO_ERROR) {
			/* discard */
		}
	}

	it("reads a half-float target back instead of returning black", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// `readPixels` with UNSIGNED_BYTE against a float attachment is
		// INVALID_OPERATION and fills the buffer with zeros, so every
		// screenshot of a target came back a silent black rectangle — no
		// throw, just a GL log line. `toBlob` / `toDataURL` / `toImageBitmap`
		// all route through here.
		const gl = renderer.gl;
		const t = new WebGLRenderTarget(gl, 8, 8, { format: gl.RGBA16F });
		gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
		// 0.5 and 0.25 land exactly in 8 bits; 2.5 is over-bright and has to
		// clamp rather than wrap
		gl.clearColor(2.5, 0.5, 0.25, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		drain(gl);

		const data = t.getImageData(0, 0, 2, 2);
		expect(gl.getError()).toBe(gl.NO_ERROR);
		expect(data.data[0]).toBe(255); // 2.5 clamped, NOT wrapped to 127
		expect(data.data[1]).toBe(128); // 0.5
		expect(data.data[2]).toBe(64); // 0.25
		expect(data.data[3]).toBe(255);
		t.destroy();
	});

	it("still reads an 8-bit target the cheap way", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the float path must not become the only path: the common case
		// still reads bytes directly with no conversion
		const gl = renderer.gl;
		const t = new WebGLRenderTarget(gl, 8, 8, {});
		gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
		gl.clearColor(1, 0.5, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		drain(gl);

		const data = t.getImageData(0, 0, 2, 2);
		expect(gl.getError()).toBe(gl.NO_ERROR);
		expect(data.data[0]).toBe(255);
		expect(data.data[1]).toBeGreaterThanOrEqual(127);
		expect(data.data[2]).toBe(0);
		t.destroy();
	});

	it("captures the frame without a GL error under a half-float format", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// `copyTexImage2D` into `gl.RGB` from a float read buffer is
		// INVALID_OPERATION, and the capture silently keeps whatever it held
		// — which would break every `screen_texture` effect and the
		// advanced-blend backdrop at once. The destination format has to
		// follow the target's.
		const gl = renderer.gl;
		const before = renderer._colorFormat;
		const target = new WebGLRenderTarget(gl, 32, 32, {
			format: gl.RGBA16F,
		});
		renderer._colorFormat = gl.RGBA16F;
		target.bind();
		drain(gl);

		renderer.toFrameTexture();
		expect(gl.getError()).toBe(gl.NO_ERROR);

		target.unbind();
		renderer._colorFormat = before;
		target.destroy();
	});
});

describe("hdr — the chain ends in a tone map", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(32, 32);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** a stand-in for a camera (managed) or a sprite (not) */
	function host(managed, effects) {
		return { postEffects: effects, _postEffectManaged: managed };
	}

	/** run `fn` with the renderer pretending its targets are half-float */
	function asHDR(fn) {
		const before = renderer._colorFormat;
		renderer._colorFormat = renderer.gl.RGBA16F;
		try {
			return fn();
		} finally {
			renderer._colorFormat = before;
		}
	}

	it("appends NOTHING to a camera chain under hdr", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// An earlier version appended a `ToneMappingEffect` here, reasoning
		// that the blit to the 8-bit canvas would otherwise clamp the
		// headroom away. It cost a shipped demo its look: a 2D scene is
		// usually authored ON that clamp, with clipped white specular and
		// saturated colour, and every curve maps 1 to less than 1 — so
		// turning `hdr` on quietly turned bright surfaces matte. Measured at
		// the time: the frame mean went UP while the near-white pixel count
		// went DOWN, which is what "lost its highlights" looks like.
		//
		// `hdr` is additive now. Same frame, plus additive content that no
		// longer saturates per write and a bloom threshold that means
		// something. A curve is the game's decision.
		const bloom = new BloomEffect(renderer);
		const chain = asHDR(() => {
			return renderer._effectChainFor(host(true, [bloom]));
		});
		expect(chain).toHaveLength(1);
		expect(chain[0]).toBe(bloom);
		expect(
			chain.some((fx) => {
				return fx instanceof ToneMappingEffect;
			}),
		).toBe(false);
		bloom.destroy();
	});

	it("keeps the game's own tone map, in the position it was added", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const mine = new ToneMappingEffect(renderer, { exposure: 2 });
		const chain = asHDR(() => {
			return renderer._effectChainFor(host(true, [mine]));
		});
		expect(chain).toHaveLength(1);
		expect(chain[0]).toBe(mine);
		mine.destroy();
	});

	it("leaves an empty chain empty", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// a camera with no effects needs no render target at all, so adding
		// a tone map would force an FBO round trip for nothing
		const chain = asHDR(() => {
			return renderer._effectChainFor(host(true, []));
		});
		expect(chain).toHaveLength(0);
	});

	it("leaves a SPRITE chain alone", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// sprite chains keep 8-bit targets (see the pool factory), so there
		// is no headroom to map and nothing to append
		const bloom = new BloomEffect(renderer);
		const chain = asHDR(() => {
			return renderer._effectChainFor(host(false, [bloom]));
		});
		expect(chain).toHaveLength(1);
		bloom.destroy();
	});

	it("appends nothing at all when HDR is off", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the 8-bit path must be exactly what it was before this feature
		const bloom = new BloomEffect(renderer);
		const chain = renderer._effectChainFor(host(true, [bloom]));
		expect(chain).toHaveLength(1);
		bloom.destroy();
	});

	it("gives sprite chains an 8-bit target while the camera gets half-float", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// The alpha reason, not thrift: `blendFunc(ONE, ONE)` accumulates
		// ALPHA past 1 in a float target, and a sprite chain's final blit
		// composites with `ONE_MINUS_SRC_ALPHA` — which goes negative and
		// subtracts the backdrop.
		const gl = renderer.gl;
		asHDR(() => {
			renderer._renderTargetPool.destroy();
			expect(renderer._renderTargetPool.get(0, 16, 16).format).toBe(gl.RGBA16F);
			expect(renderer._renderTargetPool.get(2, 16, 16).format).toBe(gl.RGBA8);
			renderer._renderTargetPool.destroy();
		});
	});
});

describe("hdr — the headroom is real", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(32, 32);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** write a colour into `target` with no clamping on the way in */
	function clearTo(target, r, g, b) {
		const gl = renderer.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
		gl.clearColor(r, g, b, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}
	}

	it("retains a value above 1 that an 8-bit target destroys", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// The claim the whole feature rests on, and the one thing every
		// other test here stops short of: a format is applied, a flag is
		// true, a tone map is appended — but does a value over 1 SURVIVE?
		//
		// Nothing in the engine clamps it on the way: `toEmissive` keeps raw
		// floats and the light packing multiplies colour by intensity
		// unbounded. The 8-bit target was the only thing destroying the
		// range, which is why this step needed no new code, only proof.
		const gl = renderer.gl;
		const hdrTarget = new WebGLRenderTarget(gl, 8, 8, {
			format: gl.RGBA16F,
		});
		clearTo(hdrTarget, 2.5, 1.75, 0.25);

		const px = new Float32Array(4);
		gl.bindFramebuffer(gl.FRAMEBUFFER, hdrTarget.framebuffer);
		gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		expect(gl.getError()).toBe(gl.NO_ERROR);
		expect(px[0]).toBeCloseTo(2.5, 2);
		expect(px[1]).toBeCloseTo(1.75, 2);
		// and the sub-1 channel is unharmed by the wider format
		expect(px[2]).toBeCloseTo(0.25, 2);
		hdrTarget.destroy();
	});

	it("saturates that same value at 8 bits, which is the whole point", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the control: 2.5 and 1.75 are indistinguishable once clamped, so a
		// bloom threshold has nothing to discriminate and a tone curve has
		// no range to compress
		const gl = renderer.gl;
		const ldrTarget = new WebGLRenderTarget(gl, 8, 8, {});
		clearTo(ldrTarget, 2.5, 1.75, 0.25);
		const px = ldrTarget.getImageData(0, 0, 1, 1);
		expect(px.data[0]).toBe(255);
		expect(px.data[1]).toBe(255); // was 1.75, now identical to 2.5
		expect(px.data[2]).toBe(64);
		ldrTarget.destroy();
	});
});

describe("hdr — off is byte-for-byte the old behaviour", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(32, 32);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/**
	 * Every one of these held in 20.7 and must still hold with `hdr` absent
	 * or false. The feature is opt-in, so a game that never asks for it must
	 * get the pipeline it had: same attachment format, same MSAA storage,
	 * same readback, same effect chain, and no console noise.
	 */
	it("gives every pool target an 8-bit attachment", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const gl = renderer.gl;
		expect(renderer.settings.hdr).not.toBe(true);
		expect(renderer._colorFormat).toBe(gl.RGBA8);

		renderer._renderTargetPool.destroy();
		for (const index of [0, 1, 2, 3]) {
			const t = renderer._renderTargetPool.get(index, 16, 16);
			expect(t.format, `pool index ${index}`).toBe(gl.RGBA8);
			gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
			expect(
				gl.getFramebufferAttachmentParameter(
					gl.FRAMEBUFFER,
					gl.COLOR_ATTACHMENT0,
					gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE,
				),
				`pool index ${index}`,
			).toBe(gl.UNSIGNED_NORMALIZED);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		}
		renderer._renderTargetPool.destroy();
	});

	it("defaults a hand-built target to 8-bit, as the old constructor did", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the `options.format` parameter is additive: omitting it has to
		// reproduce the old hardcoded `gl.RGBA8` exactly, MSAA half included
		const gl = renderer.gl;
		const plain = new WebGLRenderTarget(gl, 16, 16, {});
		expect(plain.format).toBe(gl.RGBA8);
		const msaa = new WebGLRenderTarget(gl, 16, 16, { samples: 4 });
		expect(msaa.format).toBe(gl.RGBA8);
		gl.bindFramebuffer(gl.FRAMEBUFFER, msaa.renderFramebuffer);
		expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(
			gl.FRAMEBUFFER_COMPLETE,
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		plain.destroy();
		msaa.destroy();
	});

	it("reads back through the byte path, not the float one", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// `getImageData` gained a branch; the 8-bit side must be the same
		// single `readPixels` it always was, with no conversion pass
		const gl = renderer.gl;
		const t = new WebGLRenderTarget(gl, 8, 8, {});
		gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
		gl.clearColor(1, 0.5, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}
		const data = t.getImageData(0, 0, 2, 2);
		expect(gl.getError()).toBe(gl.NO_ERROR);
		expect(data.data[0]).toBe(255);
		expect(data.data[2]).toBe(0);
		t.destroy();
	});

	it("leaves the effect chain exactly as the game wrote it", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// no tone map is appended, so the pass count, the FBO round trips
		// and the single-effect fast path are all unchanged
		const bloom = new BloomEffect(renderer);
		const camera = { postEffects: [bloom], _postEffectManaged: true };
		const sprite = { postEffects: [bloom], _postEffectManaged: false };
		expect(renderer._effectChainFor(camera)).toHaveLength(1);
		expect(renderer._effectChainFor(sprite)).toHaveLength(1);
		expect(renderer._hdrToneMap).toBeUndefined();
		bloom.destroy();
	});

	it("says nothing on the console", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// a driver that cannot do HDR must not nag a game that never asked
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		renderer._deriveCapabilities();
		renderer._resolveColorFormat();
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
