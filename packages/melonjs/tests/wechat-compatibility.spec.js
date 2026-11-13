import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { isHTMLAudioElement } from "../src/audio/backend/types.ts";
import { Application, boot, loader, video } from "../src/index.js";

/**
 * WeChat Mini Games compatibility.
 *
 * A mini-game runs with WeChat's adapter (weapp-adapter), which gives it a
 * `document`, an `Image` (`wx.createImage()`), an `Audio`
 * (`wx.createInnerAudioContext()`) and a `localStorage` (WeChat's storage),
 * but not every global a browser has. melonJS used three that WeChat lacks:
 *
 * - `createImageBitmap`, to decode every PNG and JPEG: images now load
 *   through the runtime's `Image` when it is missing.
 * - `WebGL2RenderingContext`, required by the WebGL check before it asked
 *   for a context: WeChat gives a WebGL 2 context but not the global, so
 *   `video.AUTO` fell back to Canvas and `video.WEBGL` threw.
 * - `HTMLAudioElement`, in `instanceof` checks that threw on every pause and
 *   mute once a sound had loaded, as WeChat's sounds are HTML5 ones.
 *
 * The adapter's on-screen canvas is the global `canvas`, which the renderer
 * uses when it is given none. It used it even when given one, and in a
 * browser a page's `<canvas id="canvas">` is a global `canvas` as well.
 *
 * Each case hides the global, as WeChat does, and checks the engine without
 * it.
 */

/** hide a global for the current test, as WeChat lacks it */
const hide = (name) => {
	vi.stubGlobal(name, undefined);
};

/** a blob: URL of a small PNG: loading it goes through `fetch` unless the loader avoids it */
const pngURL = async (width, height) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	context.fillStyle = "#d1655b";
	context.fillRect(0, 0, width, height);
	const blob = await new Promise((resolve) => {
		canvas.toBlob(resolve, "image/png");
	});
	return URL.createObjectURL(blob);
};

describe("WeChat Mini Games compatibility", () => {
	beforeAll(async () => {
		await boot();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe("images, without createImageBitmap", () => {
		afterEach(() => {
			loader.unload({ name: "wechat-image", type: "image" });
		});

		it("load through Image, which reads the file itself", async () => {
			const src = await pngURL(3, 2);
			hide("createImageBitmap");
			const fetchSpy = vi.spyOn(globalThis, "fetch");
			await loader.load({ name: "wechat-image", type: "image", src });
			const image = loader.getImage("wechat-image");
			expect(image).toBeInstanceOf(HTMLImageElement);
			expect([image.width, image.height]).toEqual([3, 2]);
			expect(fetchSpy).not.toHaveBeenCalled();
			URL.revokeObjectURL(src);
		});

		it("fail with the file's name when it is missing", async () => {
			hide("createImageBitmap");
			await expect(
				loader.load({
					name: "wechat-image",
					type: "image",
					src: "data/img/wechat-missing.png",
				}),
			).rejects.toThrow(/wechat-missing\.png/);
			expect(loader.getImage("wechat-image")).toBeNull();
		});

		it("still decode to an ImageBitmap where createImageBitmap exists", async () => {
			const src = await pngURL(3, 2);
			await loader.load({ name: "wechat-image", type: "image", src });
			expect(loader.getImage("wechat-image")).toBeInstanceOf(ImageBitmap);
			URL.revokeObjectURL(src);
		});
	});

	describe("WebGL, without the WebGL2RenderingContext global", () => {
		it("is found by asking for a context", async (ctx) => {
			const probe = document.createElement("canvas").getContext("webgl2");
			if (probe === null) {
				ctx.skip();
			}
			probe.getExtension("WEBGL_lose_context")?.loseContext();
			hide("WebGL2RenderingContext");
			// a fresh copy of the module: the check caches its answer
			const device = await import("../src/system/device.ts?no-webgl2-global");
			expect(device.isWebGLSupported()).toBe(true);
		});
	});

	describe("the global canvas", () => {
		/** the canvas an Application drew to, torn down after */
		const canvasOf = async (settings) => {
			const app = new Application(32, 32, {
				renderer: video.CANVAS,
				...settings,
			});
			await app.init();
			const canvas = app.renderer.getCanvas();
			app.destroy();
			return canvas;
		};

		afterEach(() => {
			document.getElementById("canvas")?.remove();
		});

		it("is used when no canvas is given, as WeChat's adapter has its on-screen canvas there", async () => {
			const onScreen = document.createElement("canvas");
			vi.stubGlobal("canvas", onScreen);
			expect(await canvasOf({})).toBe(onScreen);
		});

		it("does not replace a canvas given to the application", async () => {
			// a page's <canvas id="canvas"> is a global `canvas` too
			const pageCanvas = document.createElement("canvas");
			pageCanvas.id = "canvas";
			document.body.appendChild(pageCanvas);
			const given = document.createElement("canvas");
			expect(await canvasOf({ canvas: given })).toBe(given);
		});
	});

	describe("HTML5 sounds, without the HTMLAudioElement global", () => {
		it("are recognized by their members", () => {
			const sound = new Audio();
			const video = document.createElement("video");
			const context = new AudioContext();
			const gain = context.createGain();
			hide("HTMLAudioElement");
			expect(isHTMLAudioElement(sound)).toBe(true);
			expect(isHTMLAudioElement(video)).toBe(false);
			expect(isHTMLAudioElement(gain)).toBe(false);
			expect(isHTMLAudioElement(null)).toBe(false);
			void context.close();
		});
	});
});
