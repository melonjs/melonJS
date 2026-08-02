import { beforeAll, describe, expect, it } from "vitest";
import { Application, boot, CanvasRenderer, video } from "../src/index.js";

describe("Custom Renderer", () => {
	it("should create a custom renderer", async () => {
		class CustomRenderer extends CanvasRenderer {
			constructor(options) {
				super(options);
				this.type = "Custom";
			}
		}

		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: CustomRenderer,
		});
		await app.init();

		expect(app.renderer).instanceOf(CustomRenderer);
	});
});

describe("setAntiAlias", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	it("should default to false (NEAREST filtering)", () => {
		expect(app.renderer.settings.antiAlias).toBe(false);
	});

	it("should update settings.antiAlias when changed", () => {
		app.renderer.setAntiAlias(true);
		expect(app.renderer.settings.antiAlias).toBe(true);

		app.renderer.setAntiAlias(false);
		expect(app.renderer.settings.antiAlias).toBe(false);
	});

	it("should not trigger updates when value is unchanged", () => {
		app.renderer.setAntiAlias(false);

		let called = false;
		const renderTarget = app.renderer.renderTarget;
		const original = renderTarget.setAntiAlias.bind(renderTarget);
		renderTarget.setAntiAlias = (enable) => {
			called = true;
			original(enable);
		};

		// calling with the same value should not trigger renderTarget update
		app.renderer.setAntiAlias(false);
		expect(called).toBe(false);

		// calling with a different value should trigger it
		app.renderer.setAntiAlias(true);
		expect(called).toBe(true);

		// restore original and reset
		renderTarget.setAntiAlias = original;
		app.renderer.setAntiAlias(false);
	});
});
