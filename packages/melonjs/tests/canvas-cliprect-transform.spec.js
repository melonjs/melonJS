import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, CanvasRenderer, video } from "../src/index.js";

/**
 * Reproductions for the Canvas clipRect skip-logic findings (2026-07-08
 * video/GL-core audit), written failing-first.
 *
 * CanvasRenderer.clipRect makes both of its skip decisions on the RAW local
 * rect values, ignoring the active transform:
 * (a) a canvas-sized rect is treated as "full viewport → no-op" even when a
 *     translate has moved it, so a canvas-sized clipped container positioned
 *     off-origin gets no clip at all;
 * (b) the currentScissor cache is only reset by restore(), not save(), so a
 *     clipped container nested inside another clipped container with the
 *     same dimensions matches the stale cache and skips its own clip().
 * The WebGL renderer transforms the rect before deciding (the #1349 fix) —
 * these are Canvas-only divergences on identical public API.
 */
describe("CanvasRenderer clipRect vs transforms", () => {
	let renderer;
	let ctx2d;

	beforeAll(async () => {
		await boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
		renderer = video.renderer;
		ctx2d = renderer.getContext();
		expect(renderer).toBeInstanceOf(CanvasRenderer);
	});

	afterAll(() => {
		try {
			video.init(64, 64, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore
		}
	});

	const pixel = (x, y) => {
		return Array.from(ctx2d.getImageData(x, y, 1, 1).data);
	};

	const paintBackground = () => {
		ctx2d.save();
		ctx2d.setTransform(1, 0, 0, 1, 0, 0);
		ctx2d.fillStyle = "#000000";
		ctx2d.fillRect(0, 0, 64, 64);
		ctx2d.restore();
	};

	it("a canvas-sized clip under a translate still clips (not a full-viewport no-op)", () => {
		paintBackground();
		renderer.save();
		renderer.translate(32, 0);
		// local rect = full canvas size, but the translate makes it x ∈ [32, 96]
		renderer.clipRect(0, 0, 64, 64);
		renderer.setColor("#ff0000");
		renderer.fillRect(-32, 0, 128, 64); // covers the whole canvas locally
		renderer.restore();

		// left of the translated clip region must stay black
		expect(pixel(5, 5)[0]).toBeLessThan(50);
		// inside the clip region the fill landed
		expect(pixel(40, 5)[0]).toBeGreaterThan(200);
	});

	it("a nested same-size clip is not skipped via the stale scissor cache", () => {
		paintBackground();
		renderer.save();
		renderer.clipRect(0, 0, 32, 32); // outer clip [0,32]²
		renderer.save();
		renderer.translate(16, 16);
		renderer.clipRect(0, 0, 32, 32); // inner clip → [16,48]² ∩ outer = [16,32]²
		renderer.setColor("#ff0000");
		renderer.fillRect(-16, -16, 64, 64); // covers the whole canvas locally
		renderer.restore();
		renderer.restore();

		// inside outer but OUTSIDE inner: must stay black (inner clip applies)
		expect(pixel(8, 8)[0]).toBeLessThan(50);
		// inside both clips: painted
		expect(pixel(20, 20)[0]).toBeGreaterThan(200);
	});
});
