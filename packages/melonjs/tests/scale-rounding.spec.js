import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { integerDeviceScale, onresize } from "../src/application/resize.ts";
import { Application, boot, video } from "../src/index.js";
import * as device from "../src/system/device.ts";

/**
 * `scaleRounding: "integer"` — a whole number of device pixels per source
 * pixel, for pixel art.
 *
 * Under the default `"fractional"` a 480 wide design in a 1280 wide container
 * is scaled by 2.667, so some source pixels cover three device pixels and
 * some cover two. Browsers resolve that unevenness differently, which is what
 * makes the same pixel-art scene look crisp in one and soft in another.
 *
 * The rounding is applied in DEVICE pixels, which is the part worth testing:
 * flooring the CSS factor alone lets `devicePixelRatio` put the fraction
 * straight back.
 */
describe("scaleRounding", () => {
	let outer;

	beforeAll(() => {
		boot();
	});

	afterEach(() => {
		if (outer?.parentNode) {
			outer.parentNode.removeChild(outer);
		}
		outer = undefined;
	});

	/**
	 * A design-resolution canvas inside a container of a known size.
	 * @param {object} settings - extra Application settings
	 * @param {number} [w] - container width
	 * @param {number} [h] - container height
	 * @returns {Promise<Application>} the initialised application
	 */
	async function makeApp(settings, w = 1280, h = 720) {
		outer = document.createElement("div");
		outer.style.width = `${w}px`;
		outer.style.height = `${h}px`;
		const inner = document.createElement("div");
		inner.style.width = "100%";
		inner.style.height = "100%";
		outer.appendChild(inner);
		document.body.appendChild(outer);

		const app = new Application(480, 270, {
			parent: inner,
			renderer: video.CANVAS,
			scale: "auto",
			scaleMethod: "fit",
			consoleHeader: false,
			...settings,
		});
		await app.init();
		onresize(app);
		return app;
	}

	/** the factor actually applied, in device pixels per source pixel */
	const deviceScale = (app) => {
		return app.renderer.scaleRatio.x;
	};

	it("defaults to fractional, so nothing existing changes", async () => {
		const app = await makeApp({});
		expect(app.settings.scaleRounding).toBe("fractional");
	});

	it("fractional keeps the exact fit factor, fraction and all", async () => {
		const app = await makeApp({ scaleRounding: "fractional" });
		const expected = (1280 / 480) * device.devicePixelRatio;
		expect(deviceScale(app)).toBeCloseTo(expected, 3);
		// and it is genuinely fractional at this container size
		expect(Number.isInteger(deviceScale(app))).toBe(false);
	});

	it("integer gives a whole number of DEVICE pixels per source pixel", async () => {
		const app = await makeApp({ scaleRounding: "integer" });
		const applied = deviceScale(app);
		expect(Number.isInteger(applied)).toBe(true);
		// rounded DOWN, never up: it must still fit
		const raw = (1280 / 480) * device.devicePixelRatio;
		expect(applied).toBeLessThanOrEqual(raw);
		expect(applied).toBe(Math.floor(raw));
	});

	it("integer never scales below one device pixel", async () => {
		// a container SMALLER than the design resolution has no whole factor
		// to give; a scale of zero would simply not draw
		const app = await makeApp({ scaleRounding: "integer" }, 200, 120);
		expect(deviceScale(app)).toBeGreaterThanOrEqual(1);
	});

	it("integer still fits inside the container", async () => {
		const app = await makeApp({ scaleRounding: "integer" });
		const canvas = app.renderer.getCanvas();
		expect(parseFloat(canvas.style.width)).toBeLessThanOrEqual(1280);
		expect(parseFloat(canvas.style.height)).toBeLessThanOrEqual(720);
	});

	/**
	 * The arithmetic on its own, which is the only way to cover it.
	 *
	 * Everything above runs where `devicePixelRatio` is 1, and there CSS
	 * pixels and device pixels are the same number, so those tests cannot
	 * tell this implementation from one that floors the CSS factor. Checked
	 * by mutation: that change passes the whole suite above. Calling the
	 * function directly is what pins it.
	 */
	it("floors in DEVICE pixels, which CSS-space flooring does not", () => {
		// ratio 2, raw 2.667 CSS = 5.333 device -> 5 device = 2.5 CSS.
		// flooring the CSS factor would give 2 CSS, which is 4 device: also
		// whole, and a whole device pixel smaller than it needed to be.
		expect(integerDeviceScale(1280 / 480, 2)).toBeCloseTo(2.5, 6);
		expect(integerDeviceScale(1280 / 480, 2)).not.toBeCloseTo(2, 6);

		// ratio 1.25, factor 2 -> 2.5 device, which is NOT whole: floors to 2
		// device, so 1.6 CSS. CSS-space flooring would leave 2 and keep the
		// half pixel.
		expect(integerDeviceScale(2, 1.25)).toBeCloseTo(1.6, 6);

		// every result is a whole number of device pixels
		for (const ratio of [1, 1.25, 1.5, 2, 3]) {
			for (const raw of [0.4, 1, 1.333, 2.667, 4.9]) {
				const out = integerDeviceScale(raw, ratio);
				expect(Number.isInteger(Math.round(out * ratio * 1e6) / 1e6)).toBe(
					true,
				);
				expect(out).toBeLessThanOrEqual(Math.max(raw, 1 / ratio));
			}
		}
	});

	it("never returns less than one device pixel per source pixel", () => {
		expect(integerDeviceScale(0.1, 1)).toBe(1);
		expect(integerDeviceScale(0.1, 2)).toBe(0.5); // 0.5 CSS = 1 device
	});

	it("leaves the methods that resize the renderer alone", async () => {
		// `flex` resizes the renderer to the container rather than scaling a
		// fixed design resolution, so there is no factor to round and asking
		// for one must not shrink the canvas
		const app = await makeApp({
			scaleRounding: "integer",
			scaleMethod: "flex",
		});
		const canvas = app.renderer.getCanvas();
		expect(parseFloat(canvas.style.width)).toBeCloseTo(1280, 0);
	});
});
