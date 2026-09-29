import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, video, WebGPURenderer } from "../src/index.js";

/**
 * The experimental WebGPU backend — what exists is the asynchronous
 * bootstrap (adapter/device negotiation in `renderer.init()`, awaited by
 * `Application.init()`), with every drawing method still the base-class
 * no-op. These tests pin the wiring: requesting the backend never throws
 * synchronously, `init()` genuinely suspends, and it settles into either a
 * live WebGPU renderer or a clear rejection — never a silent substitute.
 *
 * Both settle paths are covered because both occur in the wild: headless
 * chromium with GPU access resolves; a runner without WebGPU rejects.
 */
describe("WebGPURenderer (experimental bootstrap)", () => {
	let app;
	let webgpuReady = false;
	let initError;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.WEBGPU,
			consoleHeader: false,
		});
		try {
			await app.init();
			webgpuReady = true;
		} catch (err) {
			initError = err;
		}
	});

	afterAll(() => {
		// exercises WebGPURenderer.destroy (device release + unconfigure)
		// on the resolve path; a no-op-ish teardown on the reject path
		app?.destroy();
	});

	it("is exported from the package index", () => {
		expect(WebGPURenderer).toBeDefined();
		expect(typeof WebGPURenderer).toBe("function");
	});

	it("requesting WEBGPU never throws synchronously from the constructor", () => {
		// the Application constructor is the renderer-independent half of
		// startup — reaching this assertion proves construction survived
		expect(app).toBeInstanceOf(Application);
		expect(app.settings.renderer).toBe(video.WEBGPU);
	});

	it("init() settles into a live WebGPU renderer, or rejects mentioning WebGPU", () => {
		if (webgpuReady) {
			expect(app.renderer).toBeInstanceOf(WebGPURenderer);
			expect(app.isInitialized).toBe(true);
		} else {
			expect(app.isInitialized).toBe(false);
			expect(String(initError)).toMatch(/WebGPU/);
		}
	});

	it("reports its capabilities honestly (type, shader language, no-op flags)", (ctx) => {
		if (!webgpuReady) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		expect(app.renderer.type).toBe("WebGPU");
		// WGSL is what this backend will accept — the GLSL consumers
		// (ShaderEffect, {vertex, fragment} shader assets) key off this
		// to refuse handing it GLSL source
		expect(app.renderer.shaderLanguage).toBe("wgsl");
		// these flags describe what works TODAY: the shader tile path, the
		// depth-tested mesh tier and retained mesh geometry all exist
		expect(app.renderer.supportsDepthBuffer).toBe(true);
		expect(app.renderer.supportsShaderTileLayers).toBe(true);
		expect(app.renderer.supportsRetainedMesh).toBe(true);
	});

	it("holds a configured device, context and preferred format after init()", (ctx) => {
		if (!webgpuReady) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		expect(app.renderer.device).toBeDefined();
		expect(app.renderer.adapter).toBeDefined();
		expect(typeof app.renderer.preferredFormat).toBe("string");
		expect(app.renderer.getContext()).toBe(app.renderer.context);
		expect(app.renderer.isContextValid).toBe(true);
		// the canvas went through the normal parent-append path
		expect(app.renderer.getCanvas().parentElement).not.toBeNull();
	});

	it("after a WEBGPU rejection, retrying init() as Canvas works (no stale context type)", async (ctx) => {
		if (webgpuReady) {
			ctx.skip("WebGPU available — the rejection/retry path does not apply");
			return;
		}
		// the documented recovery: WEBGPU never falls back by itself, so the
		// caller catches the rejection and retries with another backend. The
		// failed attempt must not leave `context: "webgpu"` stamped in the
		// shared settings (each backend stamps its own on construction)
		const retry = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGPU,
			consoleHeader: false,
		});
		await expect(retry.init()).rejects.toThrow();
		retry.settings.renderer = video.CANVAS;
		await retry.init();
		expect(retry.renderer.type).toBe("CANVAS");
		expect(retry.isInitialized).toBe(true);
		retry.destroy();
	});

	it("init() genuinely suspends — the async path the split exists for", async () => {
		// on BOTH settle paths there is at least one microtask boundary
		// before the application flips to initialized, so observing the
		// flag right after the call must see the pre-init state
		const second = new Application(32, 32, {
			parent: "screen",
			renderer: video.WEBGPU,
			consoleHeader: false,
		});
		const pending = second.init();
		expect(second.isInitialized).toBe(false);
		await pending.catch(() => {
			// the reject path suspends too — that is all this test asserts
		});
		second.destroy();
	});
});

/**
 * `hdr` on the WebGPU backend.
 *
 * `rgba16float` is renderable, blendable and filterable in core WebGPU: no
 * optional feature to request and nothing to probe, unlike WebGL2 where it
 * takes an extension some drivers do not ship. So this backend grants the
 * setting unconditionally, and the machinery it needs was mostly already
 * there — the pipeline cache has always keyed on colour format, which is
 * what lets the camera's half-float passes and the 8-bit canvas pass coexist
 * compiled in one frame.
 */
describe("WebGPURenderer — hdr is honoured", () => {
	let app;
	let ready = false;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.WEBGPU,
			consoleHeader: false,
			hdr: true,
		});
		try {
			await app.init();
			ready = true;
		} catch {
			ready = false;
		}
	});

	afterAll(() => {
		app?.destroy();
	});

	it("grants the setting and takes half-float camera targets", (ctx) => {
		if (!ready) {
			ctx.skip();
			return;
		}
		expect(app.renderer).toBeInstanceOf(WebGPURenderer);
		expect(app.renderer.supportsFloatTargets).toBe(true);
		expect(app.renderer.supportsHDR).toBe(true);
		expect(app.renderer._colorFormat).toBe("rgba16float");
	});
});

/**
 * The same contract, without a device.
 *
 * The suite above skips wherever WebGPU is unavailable, which is most CI
 * runners and this one — so on its own it would prove nothing anywhere it
 * actually runs. This drives the shipped resolver directly against the
 * prototype, so the behaviour is covered on every machine.
 */
describe("WebGPURenderer.setHDR (no device required)", () => {
	const bare = () => {
		const renderer = Object.create(WebGPURenderer.prototype);
		renderer.settings = { hdr: false };
		// what the constructor sets, and what `init()` learns from the
		// surface once it is negotiated
		renderer.supportsFloatTargets = true;
		renderer.preferredFormat = "bgra8unorm";
		return renderer;
	};

	it("moves the camera format with the setting", () => {
		const renderer = bare();

		renderer.setHDR(true);
		expect(renderer.settings.hdr).toBe(true);
		expect(renderer.supportsHDR).toBe(true);
		expect(renderer._colorFormat).toBe("rgba16float");

		renderer.setHDR(false);
		expect(renderer.supportsHDR).toBe(false);
		// back to the surface format, not to some 8-bit constant: the
		// surface may be bgra and a hardcoded rgba would silently swap the
		// red and blue channels of every composited frame
		expect(renderer._colorFormat).toBe("bgra8unorm");
	});

	it("empties the pool when the format changes, and not when it does not", () => {
		const renderer = bare();
		renderer.setHDR(false);
		const destroy = vi.fn();
		renderer._renderTargetPool = { destroy };

		renderer.setHDR(false);
		expect(destroy).not.toHaveBeenCalled();

		// a pooled target is reused by INDEX and `resize()` early-returns on
		// unchanged dimensions, so nothing else would ever replace one minted
		// in the old format
		renderer.setHDR(true);
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(renderer._renderTargetPool).toBeUndefined();
	});

	it("says nothing at all, either way", () => {
		// the WebGL backend warns when a driver refuses. There is nothing to
		// refuse here, so a game that turns this on must not be told
		// anything about it.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const renderer = bare();
			renderer.setHDR(true);
			renderer.setHDR(false);
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});
});
