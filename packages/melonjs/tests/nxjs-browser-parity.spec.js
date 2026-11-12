import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	audio,
	boot,
	device,
	input,
	loader,
	Renderer,
	video,
} from "../src/index.js";

/**
 * NX.js compatibility, browser side: everything the no-DOM work touched
 * still behaves in a page exactly as it did before it.
 *
 * nxjs-compatibility.spec.js runs melonJS where there is no DOM. The
 * changes that made that work are gated on `document` being missing, or
 * on an API being missing, so a page should never reach them. These
 * tests hold the page to that: each capability is compared with the
 * formula it was computed with before (written out here, not imported),
 * and each helper with what it returned before.
 */

describe("NX.js compatibility: browsers are unchanged", () => {
	describe("capability detection, against the formulas used before", () => {
		it("touchEvent is `ontouchstart` alone", () => {
			// the no-DOM fallback (a global `TouchEvent`) must not apply in a
			// page: desktop Chromium defines `TouchEvent` with no touchscreen,
			// and counting it would turn on touch input for every desktop
			expect(device.touchEvent).toBe("ontouchstart" in globalThis);
		});

		it("pointerEvent, touch and maxTouchPoints", () => {
			const pointerEvent = !!globalThis.PointerEvent;
			const touch =
				device.touchEvent ||
				(pointerEvent && globalThis.navigator.maxTouchPoints > 0);
			expect(device.pointerEvent).toBe(pointerEvent);
			expect(device.touch).toBe(touch);
			expect(device.maxTouchPoints).toBe(
				touch
					? pointerEvent
						? globalThis.navigator.maxTouchPoints || 1
						: 10
					: 1,
			);
		});

		it("screenOrientation", () => {
			expect(device.screenOrientation).toBe(
				typeof screen !== "undefined" &&
					typeof screen.orientation !== "undefined",
			);
		});

		it("offscreenCanvas, probed at 1x1 where it was 0x0", () => {
			let before;
			try {
				before =
					typeof globalThis.OffscreenCanvas !== "undefined" &&
					new globalThis.OffscreenCanvas(0, 0).getContext("2d") !== null;
			} catch {
				before = false;
			}
			expect(device.offscreenCanvas).toBe(before);
		});

		it("isWebGLSupported still probes a scratch <canvas>", () => {
			const spy = vi.spyOn(document, "createElement");
			const supported = device.isWebGLSupported();
			// the answer came from probing a <canvas>, not from the no-DOM
			// shortcut (whether `WebGL2RenderingContext` exists)
			const probedACanvas = spy.mock.calls.some(([tag]) => {
				return tag === "canvas";
			});
			spy.mockRestore();
			expect(probedACanvas).toBe(true);
			const probe = document.createElement("canvas");
			const before = !!(
				globalThis.WebGL2RenderingContext &&
				probe.getContext("webgl2", { stencil: true })
			);
			expect(supported).toBe(before);
		});

		it("audio formats still come from canPlayType", () => {
			if (!audio.hasAudio()) {
				// no audio output on this machine: nothing to compare
				return;
			}
			const test = new Audio();
			const can = (type) => {
				return test.canPlayType(type).replace(/^no$/, "") !== "";
			};
			expect(audio.hasFormat("mp3")).toBe(
				can("audio/mpeg;") || can("audio/mp3;"),
			);
			expect(audio.hasFormat("ogg")).toBe(can('audio/ogg; codecs="vorbis"'));
			expect(audio.hasFormat("opus")).toBe(can('audio/ogg; codecs="opus"'));
			expect(audio.hasFormat("flac")).toBe(
				can("audio/x-flac;") || can("audio/flac;"),
			);
		});
	});

	describe("DOM helpers return what they did", () => {
		let host;
		let child;
		beforeAll(() => {
			host = document.createElement("div");
			host.id = "nxjs-parity-host";
			child = document.createElement("div");
			host.appendChild(child);
			document.body.appendChild(host);
		});
		afterAll(() => {
			host.remove();
		});

		it("getElement: an id, an element, and document.body otherwise", () => {
			expect(device.getElement("nxjs-parity-host")).toBe(host);
			expect(device.getElement(child)).toBe(child);
			expect(device.getElement("no-such-element")).toBe(document.body);
			expect(device.getElement(undefined)).toBe(document.body);
			expect(device.getElement({})).toBe(document.body);
		});

		it("getParentElement: the element's parent node", () => {
			expect(device.getParentElement(child)).toBe(host);
			expect(device.getParentElement("nxjs-parity-host")).toBe(document.body);
		});

		it("getElementBounds: the element's client rect, the window for body", () => {
			const rect = host.getBoundingClientRect();
			expect(device.getElementBounds(host)).toEqual(rect);
			const win = device.getElementBounds(document.body);
			expect(win.left).toBe(0);
			expect(win.top).toBe(0);
			expect(win.width).toBe(globalThis.innerWidth);
			expect(win.height).toBe(globalThis.innerHeight);
		});

		it("enableSwipe still listens on the document", () => {
			const add = vi.spyOn(document, "addEventListener");
			const remove = vi.spyOn(document, "removeEventListener");
			device.enableSwipe(false);
			device.enableSwipe(true);
			const moveEvent = device.pointerEvent
				? "pointermove"
				: device.touchEvent
					? "touchmove"
					: "mousemove";
			expect(add).toHaveBeenCalledWith(moveEvent, expect.any(Function), {
				passive: false,
			});
			expect(remove).toHaveBeenCalledWith(moveEvent, expect.any(Function));
			add.mockRestore();
			remove.mockRestore();
		});

		it("createCanvas: a <canvas> unless an OffscreenCanvas is asked for", () => {
			expect(Renderer.createCanvas(4, 4)).toBeInstanceOf(HTMLCanvasElement);
			if (device.offscreenCanvas) {
				expect(Renderer.createCanvas(4, 4, true)).toBeInstanceOf(
					OffscreenCanvas,
				);
			}
		});
	});

	describe("an Application mounts in the page as before", () => {
		let app;
		let host;
		beforeAll(async () => {
			boot();
			host = document.createElement("div");
			host.id = "nxjs-parity-app";
			host.style.cssText =
				"position: absolute; left: 37px; top: 23px; width: 320px; height: 240px;";
			document.body.appendChild(host);
			app = new Application(320, 240, {
				parent: "nxjs-parity-app",
				scale: 1,
				renderer: video.CANVAS,
				consoleHeader: false,
			});
			await app.init();
		});
		afterAll(() => {
			app.destroy();
			host.remove();
		});

		it("has its parent element, and its canvas is in it", () => {
			expect(app.getParentElement()).toBe(host);
			expect(app.renderer.getCanvas().parentElement).toBe(host);
		});

		it("styles the canvas: display block, CSS size, no touch gestures", () => {
			const canvas = app.renderer.getCanvas();
			expect(canvas.style.display).toBe("block");
			expect(canvas.style.width).toBe("320px");
			expect(canvas.style.height).toBe("240px");
			// set when pointer events are enabled
			input.registerPointerEvent("pointerdown", app.viewport, () => {});
			expect(canvas.style.touchAction).toBe("none");
			input.releasePointerEvent("pointerdown", app.viewport);
		});

		it("maps page coordinates through the canvas's client rect", () => {
			const rect = app.renderer.getCanvas().getBoundingClientRect();
			const pos = input.globalToLocal(rect.left + 10, rect.top + 5);
			expect(pos.x).toBeCloseTo(10 * device.devicePixelRatio, 5);
			expect(pos.y).toBeCloseTo(5 * device.devicePixelRatio, 5);
		});

		it("still parses XML Tiled maps", async () => {
			await loader.preload([
				{ name: "parity-xml", type: "tmx", src: "/data/nxjs/map.tmx" },
			]);
			expect(loader.getTMX("parity-xml")).toBeDefined();
		});
	});
});
