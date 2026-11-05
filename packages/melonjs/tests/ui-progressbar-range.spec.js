import { beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, ProgressBar, video } from "../src/index.js";

// A ProgressBar's range changed after the value was set.
//
// `min` and `max` were plain fields and only the `value` setter clamped, so
// lowering `max` below the value (a debuff on the most health a player can
// have, say) left the value outside the range: the ratio came out at 2 and
// the fill was drawn twice the track's width, past its end. `min` and `max`
// now clamp the value into the new range, as UISlider's do, and the ratio
// stays within 0..1 even when the range is empty.

/** a 0..100 health bar, full */
const health = (settings = {}) => {
	return new ProgressBar(0, 0, {
		width: 200,
		height: 20,
		min: 0,
		max: 100,
		value: 100,
		...settings,
	});
};

/** the rectangles the bar's fill is drawn as, for a recording renderer */
const fillWidth = (bar) => {
	const rects = [];
	const painter = bar._painter;
	const rect = vi.spyOn(painter, "rect").mockImplementation((_r, x, y, w) => {
		rects.push({ x, w });
	});
	vi.spyOn(painter, "paint").mockImplementation(() => {});
	const renderer = {
		globalAlpha: () => {
			return 1;
		},
		setGlobalAlpha: () => {},
	};
	bar.draw(renderer);
	rect.mockRestore();
	// the track is drawn first only when it has a colour; the fill is last
	return rects.at(-1)?.w ?? 0;
};

describe("ProgressBar: changing min and max", () => {
	beforeAll(async () => {
		boot();
		// the label is a Text, which measures itself with the renderer
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	it("lowering max below the value clamps the value, and the ratio stays at 1", () => {
		const hp = health();
		hp.max = 50;
		expect(hp.max).toBe(50);
		expect(hp.value).toBe(50);
		expect(hp.ratio).toBe(1);
	});

	it("the fill is never drawn past the track", () => {
		const hp = health();
		hp.max = 50;
		expect(fillWidth(hp)).toBe(200);
	});

	it("raising min above the value clamps the value up, and the ratio stays at 0", () => {
		const hp = health({ value: 10 });
		hp.min = 20;
		expect(hp.min).toBe(20);
		expect(hp.value).toBe(20);
		expect(hp.ratio).toBe(0);
	});

	it("a max below min lowers min to it, as UISlider does", () => {
		const hp = health({ value: 30 });
		hp.min = 20;
		hp.max = 10;
		expect(hp.min).toBe(10);
		expect(hp.max).toBe(10);
		expect(hp.value).toBe(10);
	});

	it("a min above max raises max to it, as UISlider does", () => {
		const hp = health();
		hp.min = 150;
		expect(hp.min).toBe(150);
		expect(hp.max).toBe(150);
		expect(hp.value).toBe(150);
	});

	it("an empty range (min === max) has a ratio of 0, not NaN or Infinity", () => {
		const hp = health();
		hp.max = 0;
		expect(hp.min).toBe(0);
		expect(hp.value).toBe(0);
		expect(hp.ratio).toBe(0);
		expect(fillWidth(hp)).toBe(0);
	});

	it("a range given upside down is swapped, as UISlider's is", () => {
		const bar = new ProgressBar(0, 0, {
			width: 100,
			height: 10,
			min: 10,
			max: 0,
			value: 5,
		});
		expect(bar.min).toBe(0);
		expect(bar.max).toBe(10);
		expect(bar.value).toBe(5);
		expect(bar.ratio).toBe(0.5);
	});

	it("a range widened around the value leaves the value alone", () => {
		const hp = health({ value: 40 });
		hp.max = 200;
		expect(hp.value).toBe(40);
		expect(hp.ratio).toBe(0.2);
	});

	it("onChange runs when the clamp moves the value, as any change of it does", () => {
		const onChange = vi.fn();
		const hp = health({ onChange });
		hp.max = 50;
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(50, 1, hp);
		// and not when the range changes around a value it keeps
		hp.max = 80;
		hp.min = 10;
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("the label follows the range, the value moved or not", () => {
		const hp = health({ value: 50, showLabel: true });
		const text = () => {
			return [].concat(hp.label._text).join("");
		};
		expect(text()).toBe("50%");
		hp.max = 200;
		expect(text()).toBe("25%");
		hp.max = 25;
		expect(text()).toBe("100%");
		hp.destroy();
	});

	it("the value setter still clamps to the current range", () => {
		const hp = health();
		hp.max = 50;
		hp.value = 80;
		expect(hp.value).toBe(50);
		hp.value = -5;
		expect(hp.value).toBe(0);
	});
});
