import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	CanvasRenderer,
	video,
	WebGLRenderer,
	WebGPURenderer,
} from "../src/index.js";

/**
 * The `video.AUTO` ladder: WebGPU first (proven by a full adapter/device
 * negotiation), WebGL 2 next, Canvas as the terminal fallback — and AUTO
 * must always RESOLVE, never reject, whatever the environment offers.
 * Which rung this environment lands on is probed with a bare adapter
 * request (the same negotiation init performs), so the assertion adapts
 * to the runner without spinning up a second Application.
 */
describe("video.AUTO renderer ladder", () => {
	let webgpuAvailable = false;
	let app;

	beforeAll(async () => {
		try {
			const adapter = await globalThis.navigator?.gpu?.requestAdapter();
			webgpuAvailable = adapter != null;
		} catch {
			webgpuAvailable = false;
		}
		app = new Application(64, 64, {
			renderer: video.AUTO,
			consoleHeader: false,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	it("always resolves, landing on WebGPU exactly when the environment negotiates it", () => {
		expect(app.isInitialized).toBe(true);
		if (webgpuAvailable) {
			expect(app.renderer).toBeInstanceOf(WebGPURenderer);
		} else {
			// no WebGPU in this environment — the synchronous tail picks
			// WebGL 2 (or Canvas where even that is unavailable)
			expect(
				app.renderer instanceof WebGLRenderer ||
					app.renderer instanceof CanvasRenderer,
			).toBe(true);
		}
		// whoever won, it carries its owning application
		expect(app.renderer.parentApplication).toBe(app);
	});

	it("a second init() on a live WebGPU renderer is a no-op, not a renegotiation", async (ctx) => {
		if (!webgpuAvailable) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		const device = app.renderer.device;
		// AUTO already awaited init() once during negotiation and once on
		// the common path — a third call must keep the same device
		await app.renderer.init();
		expect(app.renderer.device).toBe(device);
	});
});
