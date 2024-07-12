import { describe, expect, it } from "vitest";
import { CanvasRenderer, boot, game, video } from "../src/index.js";

describe("Custom Renderer", async () => {
	it("should create a custom renderer", async () => {
		class CustomRenderer extends CanvasRenderer {
			constructor(options) {
				super(options);
				this.type = "Custom";
			}
		}

		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: CustomRenderer,
		});

		expect(game.renderer).instanceOf(CustomRenderer);
	});
});
