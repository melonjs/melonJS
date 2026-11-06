import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, BitmapText, boot, Text, video } from "../src/index.js";

/**
 * Measuring another string leaves the label alone.
 *
 * `Text#measureText(text)` and `BitmapText#measureText(text)` measured into the
 * label's own `metrics`, the very object it is aligned, bounded and drawn
 * with. `hud.measureText("00:00").width` — what the ui-and-text skill and the
 * TSDoc recommend for reserving room for a counter — therefore replaced the
 * label's width, height and ink padding with those of "00:00", and a centred
 * or right-aligned label was drawn shifted (and its ink clipped) until its next
 * `setText` re-measured it.
 *
 * Now the label's own text (the default) still refreshes and returns its own
 * metrics, while any other text is measured into a TextMetrics of its own.
 */
describe("measureText(other) does not change the label", () => {
	const fontData = `info face="mts" size=4 padding=0,0,0,0 spacing=0,0
common lineHeight=6 base=4 scaleW=4 scaleH=4 pages=1 packed=0
page id=0 file="mts.png"
chars count=3
char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=65 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=66 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15`;

	let app;
	let image;

	beforeAll(async () => {
		boot();
		app = new Application(200, 100, {
			parent: "screen",
			renderer: video.CANVAS,
			transparent: true,
			backgroundColor: "rgba(0, 0, 0, 0)",
		});
		await app.init();
		image = document.createElement("canvas");
		image.width = image.height = 4;
		const ctx = image.getContext("2d");
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, 4, 4);
	});

	afterAll(() => {
		app?.destroy();
	});

	/** the label's layout, as it is drawn and bounded */
	const layout = (label) => {
		const m = label.metrics;
		const b = label.getBounds();
		return {
			x: m.x,
			y: m.y,
			width: m.width,
			height: m.height,
			inkPadTop: m.inkPadTop,
			inkPadBottom: m.inkPadBottom,
			inkPadLeft: m.inkPadLeft,
			inkPadRight: m.inkPadRight,
			bounds: [b.left, b.top, b.right, b.bottom],
		};
	};

	/**
	 * draw the label alone and find where its ink landed: the box of the
	 * pixels brighter than half. A box rather than the pixels themselves, as
	 * antialiased edges are not bit-identical from one draw to the next.
	 */
	const render = (label) => {
		const renderer = app.renderer;
		const context = renderer.getContext();
		const canvas = renderer.getCanvas();
		const { width, height } = canvas;
		context.save();
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, width, height);
		context.restore();
		label.draw(renderer);
		// as the frame loop does once the label has been drawn: the next draw
		// reuses its bake rather than repainting it
		label.isDirty = false;
		const data = context.getImageData(0, 0, width, height).data;
		const box = { left: width, top: height, right: -1, bottom: -1 };
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (data[(y * width + x) * 4] > 128) {
					box.left = Math.min(box.left, x);
					box.right = Math.max(box.right, x);
					box.top = Math.min(box.top, y);
					box.bottom = Math.max(box.bottom, y);
				}
			}
		}
		return box;
	};

	describe("Text", () => {
		const centred = () => {
			return new Text(100, 50, {
				font: "sans-serif",
				size: 20,
				fillStyle: "#ffffff",
				textAlign: "center",
				textBaseline: "middle",
				text: "12",
			});
		};

		it("measures the other string, and leaves the label's metrics and bounds", () => {
			const label = centred();
			const before = layout(label);
			const own = label.measureText().width;

			const other = label.measureText("00:00\n00:00");
			expect(other.width).toBeGreaterThan(own);
			expect(other.height).toBe(2 * 20);
			expect(other).not.toBe(label.metrics);

			expect(layout(label)).toEqual(before);
			label.destroy();
		});

		it("a centred label draws in the same pixels after measuring another string", () => {
			const label = centred();
			const before = render(label);
			expect(before.right).toBeGreaterThan(before.left);
			label.measureText("WWWWWWWWWW");
			expect(render(label)).toEqual(before);
			label.destroy();
		});

		it("with no argument it is still the label's own metrics", () => {
			const label = centred();
			expect(label.measureText()).toBe(label.metrics);
			expect(label.measureText().width).toBe(label.metrics.width);
			label.destroy();
		});

		it("two measures are independent results", () => {
			const label = centred();
			const short = label.measureText("1");
			const long = label.measureText("1111111111");
			expect(short.width).toBeLessThan(long.width);
			label.destroy();
		});

		it("measures in the label's style, as its own text would be", () => {
			const label = centred();
			// the label's own string, measured as another: the same box
			const copy = label.measureText("12");
			expect(copy.width).toBe(label.metrics.width);
			expect(copy.height).toBe(label.metrics.height);
			label.destroy();
		});

		it("arrays, numbers and the empty string measure without side effects", () => {
			const label = centred();
			const before = layout(label);
			expect(label.measureText(["a", "bb", "ccc"]).height).toBe(3 * 20);
			expect(label.measureText(12345).width).toBeGreaterThan(0);
			expect(label.measureText("").width).toBe(0);
			expect(layout(label)).toEqual(before);
			label.destroy();
		});
	});

	describe("BitmapText", () => {
		const centred = () => {
			return new BitmapText(100, 50, {
				font: image,
				fontData,
				textAlign: "center",
				textBaseline: "middle",
				text: "AB",
			});
		};

		it("measures the other string, and leaves the label's metrics and bounds", () => {
			const label = centred();
			const before = layout(label);
			const other = label.measureText("AAAAAA\nB");
			expect(other.width).toBe(36);
			expect(other.height).toBeGreaterThan(label.metrics.height);
			expect(other).not.toBe(label.metrics);
			expect(layout(label)).toEqual(before);
			label.destroy();
		});

		it("a centred label draws in the same pixels after measuring another string", () => {
			const label = centred();
			const before = render(label);
			expect(before.right).toBeGreaterThan(before.left);
			label.measureText("AAAAAAAAAA\nA\nA");
			expect(render(label)).toEqual(before);
			label.destroy();
		});

		it("with no argument it is still the label's own metrics", () => {
			const label = centred();
			expect(label.measureText()).toBe(label.metrics);
			label.destroy();
		});
	});
});
