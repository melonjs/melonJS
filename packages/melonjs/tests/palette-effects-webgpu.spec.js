/**
 * The `GradientMapEffect` and `DitherEffect` drawing checks on WebGPU, in a
 * spec file of its own: an application with a GPU device takes the place of
 * the shared WebGL renderer `palette-effects.spec.js` draws with.
 *
 * Skipped, visibly, where the browser has no WebGPU adapter.
 */
import { afterAll, beforeAll, describe } from "vitest";
import { Application, boot, video } from "../src/index.js";
import {
	ditherChecks,
	gradientMapChecks,
	SIZE,
} from "./helpers/palette-effect-checks.js";
import { drawOffscreen } from "./helpers/pixels.js";

describe("palette effects, on WebGPU", () => {
	let app;
	let available = false;
	beforeAll(async () => {
		boot();
		try {
			app = new Application(SIZE, SIZE, {
				parent: "screen",
				renderer: video.WEBGPU,
				consoleHeader: false,
			});
			await app.init();
			available = app.renderer.type === "WebGPU";
			if (available) {
				const renderer = drawOffscreen(app.renderer);
				// the checks draw without a camera, which is what sets the
				// projection in a game
				renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
				renderer.setProjection(renderer.projectionMatrix);
			}
		} catch {
			available = false;
		}
	});
	afterAll(() => {
		app?.destroy();
	});

	const getRenderer = (ctx) => {
		if (!available) {
			ctx.skip("WebGPU not available in this environment");
		}
		return app.renderer;
	};

	describe("GradientMapEffect", () => {
		gradientMapChecks(getRenderer);
	});

	describe("DitherEffect", () => {
		ditherChecks(getRenderer);
	});
});
