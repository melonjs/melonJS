import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Color,
	ColorLayer,
	getPool,
	Text,
	video,
} from "../src/index.js";
import { colorLayerPool } from "../src/renderable/colorlayer.js";
import { textPool } from "../src/renderable/text/text.js";

/**
 * `Text` and `ColorLayer` on the typed pool.
 *
 * They were the last two classes whose only recycling route was the legacy
 * name-keyed pool, and the adversarial half of this file is `Text`: its
 * `onResetEvent` writes some fields unconditionally and others only when the
 * caller supplies a setting. Every field in the second group is a leak across
 * a recycle, because the pool hands the SAME instance back.
 */
describe("textPool", () => {
	let app;

	beforeAll(async () => {
		// `Text` measures through `game.renderer`, so a booted application is
		// the minimum this needs; `ColorLayer` below does not
		boot();
		app = new Application(64, 64, { parent: "screen", renderer: video.AUTO });
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	/** settings that exercise as many conditional branches as possible */
	const loud = {
		font: "Arial",
		size: 24,
		text: "FIRST",
		fillStyle: "#ff0000",
		strokeStyle: "#00ff00",
		lineWidth: 4,
		textAlign: "right",
		textBaseline: "bottom",
		lineHeight: 2,
		wordWrapWidth: 100,
		floating: true,
	};

	/** the barest settings that still make a valid label */
	const quiet = { font: "Arial", size: 12, text: "SECOND" };

	it("is the pool registered under the public `text` key", () => {
		expect(getPool("text")).toBe(textPool);
	});

	it("hands out a real Text bound to what was asked for", () => {
		const t = textPool.get(10, 20, quiet);
		try {
			expect(t).toBeInstanceOf(Text);
			expect(t.pos.x).toEqual(10);
			expect(t.pos.y).toEqual(20);
			expect(t._text.join("\n")).toEqual("SECOND");
		} finally {
			textPool.release(t);
		}
	});

	it("REGRESSION: a recycled label keeps NOTHING from the previous one", () => {
		// The adversarial case. `onResetEvent` applies `fillStyle`,
		// `strokeStyle` and `floating` only when the setting is present, so a
		// recycled label silently inherited the previous label's colour,
		// outline and viewport-pinning. A fresh `new Text()` never shows it,
		// because a fresh instance has the constructor defaults.
		const first = textPool.get(0, 0, loud);
		expect(first.fillStyle.toHex()).toEqual("#FF0000");
		textPool.release(first);

		const second = textPool.get(10, 20, quiet);
		try {
			// the same instance came back ...
			expect(second).toBe(first);
			// ... carrying none of the first label's state
			expect(second._text.join("\n")).toEqual("SECOND");
			expect(second.fillStyle.toHex()).toEqual("#000000");
			expect(second.strokeStyle.toHex()).toEqual("#000000");
			expect(second.floating).toBe(false);
			expect(second.lineWidth).toEqual(0);
			expect(second.textAlign).toEqual("left");
			expect(second.textBaseline).toEqual("top");
			expect(second.lineHeight).toEqual(1.0);
			expect(second.wordWrapWidth).toEqual(-1);
			expect(second.pos.x).toEqual(10);
			expect(second.pos.y).toEqual(20);
		} finally {
			textPool.release(second);
		}
	});

	it("REGRESSION: a recycled label keeps nothing inherited from Renderable either", () => {
		// The settings only name Text's own fields, so everything a game
		// drives through the base class survived a recycle. A damage number
		// tweened to alpha 0 came back invisible, one scaled up came back
		// large, one tinted came back tinted.
		const first = textPool.get(0, 0, quiet);
		first.setOpacity(0);
		first.tint.setColor(255, 0, 0, 1);
		first.blendMode = "multiply";
		first.name = "first-label";
		first.isKinematic = false;
		first.alwaysUpdate = true;
		first.scale(2, 3);
		first.flipX(true);
		textPool.release(first);

		const second = textPool.get(0, 0, quiet);
		try {
			expect(second).toBe(first);
			expect(second.alpha).toEqual(1);
			expect(second.tint.toHex()).toEqual("#FFFFFF");
			expect(second.blendMode).toEqual("normal");
			expect(second.name).toEqual("");
			expect(second.isKinematic).toBe(true);
			expect(second.alwaysUpdate).toBe(false);
			expect(second.currentTransform.isIdentity()).toBe(true);
			expect(second.isFlippedX).toBe(false);
			// Text anchors at the top-left, which `onResetEvent` applies
			// after the inherited reset
			expect(second.anchorPoint.x).toEqual(0);
			expect(second.anchorPoint.y).toEqual(0);
		} finally {
			textPool.release(second);
		}
	});

	it("a recycled label reuses its canvas and metrics rather than leaking them", () => {
		// the whole justification for pooling a label. A fresh
		// `CanvasRenderTarget` per reset also stranded the previous canvas and
		// its GL texture, which only `destroy()` frees
		const first = textPool.get(0, 0, quiet);
		const canvas = first.canvasTexture;
		const metrics = first.metrics;
		textPool.release(first);

		const second = textPool.get(0, 0, { ...quiet, text: "AGAIN" });
		try {
			expect(second.canvasTexture).toBe(canvas);
			expect(second.metrics).toBe(metrics);
		} finally {
			textPool.release(second);
		}
	});

	it("a recycled label re-measures rather than reporting the old size", () => {
		// the metrics are cached on the instance, so a short label recycled
		// from a long one must not keep the long one's width
		const long = textPool.get(0, 0, {
			font: "Arial",
			size: 24,
			text: "a very much longer piece of text",
		});
		const longWidth = long.getBounds().width;
		textPool.release(long);

		const short = textPool.get(0, 0, { font: "Arial", size: 24, text: "i" });
		try {
			expect(short.getBounds().width).toBeLessThan(longWidth);
		} finally {
			textPool.release(short);
		}
	});

	it("a recycled label drops the previous one's gradient fill", () => {
		// `fillGradient` is a separate field from `fillStyle`, so a label
		// recycled from a gradient-filled one into a plain colour would paint
		// the old ramp if the reset were conditional the way the colour was
		const ramp = app.renderer.createLinearGradient(0, 0, 0, 24);
		ramp.addColorStop(0, "#ffffff");
		ramp.addColorStop(1, "#000000");
		const first = textPool.get(0, 0, { ...quiet, fillStyle: ramp });
		expect(first.fillGradient).toBeDefined();
		textPool.release(first);

		// settings that say nothing about the fill: the gradient has to go
		// anyway, or the label paints the previous ramp
		const second = textPool.get(0, 0, quiet);
		expect(second.fillGradient).toBeUndefined();
		expect(second.fillStyle.toHex()).toEqual("#000000");
		textPool.release(second);

		// and the same when the new label names a plain colour
		const third = textPool.get(0, 0, { ...quiet, fillStyle: ramp });
		textPool.release(third);
		const fourth = textPool.get(0, 0, { ...quiet, fillStyle: "#00ff00" });
		try {
			expect(fourth.fillGradient).toBeUndefined();
			expect(fourth.fillStyle.toHex()).toEqual("#00FF00");
		} finally {
			textPool.release(fourth);
		}
	});

	it("accepts a Color instance without aliasing it", () => {
		// `fillStyle` is a pooled `Color` the label owns; a caller's Color must
		// be COPIED, or mutating theirs later silently repaints the label
		const mine = new Color(255, 0, 0, 1);
		const t = textPool.get(0, 0, { ...quiet, fillStyle: mine });
		try {
			expect(t.fillStyle.toHex()).toEqual("#FF0000");
			expect(t.fillStyle).not.toBe(mine);
			mine.setColor(0, 0, 255, 1);
			expect(t.fillStyle.toHex()).toEqual("#FF0000");
		} finally {
			textPool.release(t);
		}
	});

	it("counts instances in use, and gives them back on release", () => {
		const before = textPool.used();
		const a = textPool.get(0, 0, quiet);
		const b = textPool.get(0, 0, quiet);
		expect(textPool.used()).toEqual(before + 2);
		textPool.release(a);
		textPool.release(b);
		expect(textPool.used()).toEqual(before);
	});

	it("ignores a Text it did not create", () => {
		// `release` is reachable from game code, and a hand-built label was
		// never the pool's to recycle
		const foreign = new Text(0, 0, quiet);
		const before = textPool.used();
		expect(() => {
			textPool.release(foreign);
		}).not.toThrow();
		expect(textPool.used()).toEqual(before);

		const fresh = textPool.get(0, 0, { ...quiet, text: "THIRD" });
		try {
			expect(fresh).not.toBe(foreign);
			expect(fresh._text.join("\n")).toEqual("THIRD");
		} finally {
			textPool.release(fresh);
		}
	});
});

describe("colorLayerPool", () => {
	beforeAll(() => {
		boot();
	});

	it("is the pool registered under the public `colorLayer` key", () => {
		expect(getPool("colorLayer")).toBe(colorLayerPool);
	});

	it("hands out a real ColorLayer with the name, colour and depth asked for", () => {
		const layer = colorLayerPool.get("flash", "#ff0000", 7);
		try {
			expect(layer).toBeInstanceOf(ColorLayer);
			expect(layer.name).toEqual("flash");
			expect(layer.color.toHex()).toEqual("#FF0000");
			expect(layer.pos.z).toEqual(7);
		} finally {
			colorLayerPool.release(layer);
		}
	});

	it("REGRESSION: a recycled layer takes its new name, colour and depth", () => {
		const first = colorLayerPool.get("first", "#ff0000", 1);
		colorLayerPool.release(first);

		const second = colorLayerPool.get("second", "#0000ff", 2);
		try {
			expect(second).toBe(first);
			expect(second.name).toEqual("second");
			expect(second.color.toHex()).toEqual("#0000FF");
			expect(second.pos.z).toEqual(2);
		} finally {
			colorLayerPool.release(second);
		}
	});

	it("REGRESSION: a recycled layer keeps nothing inherited from Renderable", () => {
		const first = colorLayerPool.get("first", "#ff0000", 1);
		first.setOpacity(0.25);
		first.blendMode = "multiply";
		colorLayerPool.release(first);

		const second = colorLayerPool.get("second", "#0000ff", 2);
		try {
			expect(second).toBe(first);
			expect(second.alpha).toEqual(1);
			expect(second.blendMode).toEqual("normal");
			// and the layer's own default, which it sets after the reset
			expect(second.floating).toBe(true);
		} finally {
			colorLayerPool.release(second);
		}
	});

	it("defaults the depth when it is not given", () => {
		const layer = colorLayerPool.get("no-z", "#112233");
		try {
			expect(layer.pos.z).toEqual(0);
		} finally {
			colorLayerPool.release(layer);
		}
	});

	it("counts instances in use, and ignores a foreign layer", () => {
		const before = colorLayerPool.used();
		const a = colorLayerPool.get("a", "#000000", 0);
		expect(colorLayerPool.used()).toEqual(before + 1);
		colorLayerPool.release(a);
		expect(colorLayerPool.used()).toEqual(before);

		const foreign = new ColorLayer("foreign", "#ffffff", 0);
		expect(() => {
			colorLayerPool.release(foreign);
		}).not.toThrow();
		expect(colorLayerPool.used()).toEqual(before);
	});
});
