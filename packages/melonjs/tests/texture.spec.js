import { describe, expect, it } from "vitest";
import { CanvasTexture, boot, video } from "../src/index.js";

describe("Texture", () => {
	it("convertToBlob() should return a Blob when using a regular canvas", async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});

		const canvasTexture = new CanvasTexture(100, 100);
		const offscreenCanvas = new CanvasTexture(100, 100, {
			offscreenCanvas: true,
		});

		expect(await canvasTexture.toBlob()).toBeInstanceOf(window.Blob);
		expect(await offscreenCanvas.toBlob()).toBeInstanceOf(window.Blob);
	});
});
