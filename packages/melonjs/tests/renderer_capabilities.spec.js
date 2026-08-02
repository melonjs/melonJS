import { beforeAll, describe, expect, it } from "vitest";
import { WEBGPU } from "../src/const.ts";
import { Application, boot, video } from "../src/index.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";
import { autoDetectRenderer } from "../src/video/utils/autodetect.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";

/**
 * Backend capability advertising, and the WebGPU opt-in gate.
 *
 * Two things are pinned here.
 *
 * **Capabilities are advertised, not inferred.** Code used to ask "is there a
 * `renderer.gl`?" or "is this `instanceof WebGLRenderer`?" to decide whether a
 * feature was available. Both answer *no* for any future backend that is
 * perfectly capable — a WebGPU renderer would have silently disabled every
 * `ShaderEffect` with a message saying it "requires WebGL". Consumers now read
 * a flag the backend sets about itself.
 *
 * **WebGPU is opt-in.** `AUTO` is what existing games pass, so listing WebGPU
 * as a candidate would migrate them onto a partial backend the day their
 * browser gained support — silently, and without anyone asking for it.
 */
describe("renderer capability flags", () => {
	beforeAll(async () => {
		await boot();
	});

	it("the base contract is a language name, not a boolean", () => {
		// `ShaderEffect` and the loader's `{vertex, fragment}` assets hand
		// GLSL text straight to the driver. A plain "has shaders" boolean
		// would read true on a WGSL backend and let them try anyway.
		const canvas = new CanvasRenderer({ width: 8, height: 8 });
		expect(canvas.shaderLanguage).toBeNull();
		expect(canvas.supportsDepthBuffer).toBe(false);
		canvas.destroy?.();
	});

	it("the WebGL backend advertises GLSL and a depth buffer", (ctx) => {
		let renderer;
		try {
			renderer = new WebGLRenderer({
				width: 8,
				height: 8,
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			ctx.skip("WebGL unavailable in this environment");
			return;
		}
		expect(renderer.shaderLanguage).toBe("glsl");
		expect(renderer.supportsDepthBuffer).toBe(true);
		renderer.destroy?.();
	});
});

describe("WebGPU is opt-in only", () => {
	beforeAll(async () => {
		await boot();
	});

	it("exposes a WEBGPU constant distinct from the others", () => {
		expect(typeof video.WEBGPU).toBe("number");
		expect(video.WEBGPU).not.toBe(video.AUTO);
		expect(video.WEBGPU).not.toBe(video.WEBGL);
		expect(video.WEBGPU).not.toBe(video.CANVAS);
	});

	it("never quietly substitutes another backend", async () => {
		// someone asking for WebGPU is testing WebGPU — handing back a WebGL
		// or Canvas renderer would make the test meaningless. Since the
		// experimental backend landed, `init()` either resolves with a live
		// WebGPU renderer or rejects (environment without WebGPU support) —
		// there is no fallback path
		const app = new Application(64, 64, {
			parent: "screen",
			renderer: WEBGPU,
			consoleHeader: false,
		});
		try {
			await app.init();
			expect(app.renderer.type).toBe("WebGPU");
			expect(app.renderer.shaderLanguage).toBe("wgsl");
		} catch (err) {
			expect(String(err)).toMatch(/WebGPU/);
		} finally {
			// release the device / window listeners on either settle path
			app.destroy();
		}
	});

	it("AUTO never selects it", () => {
		// the load-bearing property: AUTO is what existing games pass, so it
		// must keep resolving to WebGL-or-Canvas whatever the browser gains.
		// Exercised through the negotiation itself rather than a second
		// Application, which would fight the shared global renderer.
		const picked = autoDetectRenderer({
			width: 8,
			height: 8,
			failIfMajorPerformanceCaveat: false,
		});
		try {
			expect(
				picked instanceof WebGLRenderer || picked instanceof CanvasRenderer,
			).toBe(true);
			// whichever it chose advertises a language that exists today —
			// never a backend that has not been written yet
			expect([null, "glsl"]).toContain(picked.shaderLanguage);
		} finally {
			picked.destroy?.();
		}
	});
});
