/**
 * The `MaskEffect` drawing checks (#1399) on WebGPU, in a spec file of its
 * own: an application with a GPU device takes the place of the one before
 * it, which the Canvas and WebGL checks of `mask-effect-image.spec.js` use.
 *
 * Skipped, visibly, where the browser has no WebGPU adapter.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Camera2d, video } from "../src/index.js";
import {
	at,
	discWithHole,
	drawingChecks,
	drawOverWhite,
	SIZE,
} from "./helpers/mask-effect-checks.js";
import { drawOffscreen } from "./helpers/pixels.js";

describe("MaskEffect: image and sprite shapes, on WebGPU", () => {
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

	drawingChecks(getRenderer);

	it("destroy frees the copy of the image uploaded to the GPU", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = at(new Camera2d(0, 0, SIZE, SIZE), 0.5, {
			shape: discWithHole(),
		});
		await drawOverWhite(renderer, effect);
		const canvas = effect._cover.canvas;
		expect(renderer.cache.has(canvas)).toBe(true);
		effect.destroy();
		expect(renderer.cache.has(canvas)).toBe(false);
	});
});
