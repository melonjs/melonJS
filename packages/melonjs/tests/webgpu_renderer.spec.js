import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
