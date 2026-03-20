import { beforeAll, describe, expect, it } from "vitest";
import { boot, CanvasRenderer, game, video } from "../src/index.js";

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

describe("setAntiAlias", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("should default to false (NEAREST filtering)", () => {
		expect(video.renderer.settings.antiAlias).toBe(false);
	});

	it("should update settings.antiAlias when changed", () => {
		video.renderer.setAntiAlias(true);
		expect(video.renderer.settings.antiAlias).toBe(true);

		video.renderer.setAntiAlias(false);
		expect(video.renderer.settings.antiAlias).toBe(false);
	});

	it("should not trigger updates when value is unchanged", () => {
		video.renderer.setAntiAlias(false);

		let called = false;
		const renderTarget = video.renderer.renderTarget;
		const original = renderTarget.setAntiAlias.bind(renderTarget);
		renderTarget.setAntiAlias = (enable) => {
			called = true;
			original(enable);
		};

		// calling with the same value should not trigger renderTarget update
		video.renderer.setAntiAlias(false);
		expect(called).toBe(false);

		// calling with a different value should trigger it
		video.renderer.setAntiAlias(true);
		expect(called).toBe(true);

		// restore original and reset
		renderTarget.setAntiAlias = original;
		video.renderer.setAntiAlias(false);
	});
});
