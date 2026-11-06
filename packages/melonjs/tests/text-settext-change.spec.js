import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, BitmapText, boot, Text, video } from "../src/index.js";

/**
 * `setText` replaces the text whenever its LINES change.
 *
 * Both `Text` and `BitmapText` decided whether anything had changed by
 * comparing `this._text.toString()` with `value.toString()`. The text is kept
 * as an array of lines, and an array's `toString()` joins them with commas, so
 * `setText("1,000")` on a label showing `["1", "000"]` looked like no change
 * and the label kept its two lines — and the reverse, an array after the
 * comma string, was ignored the same way. A score formatted with thousands
 * separators is all it takes.
 */
describe("setText replaces text whose toString() matches", () => {
	// a minimal BMFont: 4x4 glyphs, 6px advance, a 6px line
	const fontData = `info face="stc" size=4 padding=0,0,0,0 spacing=0,0
common lineHeight=6 base=4 scaleW=4 scaleH=4 pages=1 packed=0
page id=0 file="stc.png"
chars count=8
char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=44 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=48 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=49 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=50 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=65 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=66 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=67 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15`;

	let app;
	let image;

	beforeAll(async () => {
		boot();
		app = new Application(160, 120, {
			parent: "screen",
			renderer: video.CANVAS,
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

	const text = (value) => {
		return new Text(0, 0, { font: "sans-serif", size: 10, text: value });
	};
	const bitmap = (value) => {
		return new BitmapText(0, 0, { font: image, fontData, text: value });
	};

	describe("Text", () => {
		it("a comma string after an array of the same toString() replaces it", () => {
			const label = text(["1", "000"]);
			expect(label.measureText().height).toBe(2 * 10);
			label.setText("1,000");
			expect(label._text).toEqual(["1,000"]);
			expect(label.measureText().height).toBe(10);
			label.destroy();
		});

		it("an array after the comma string of the same toString() replaces it", () => {
			const label = text("1,000");
			label.setText(["1", "000"]);
			expect(label._text).toEqual(["1", "000"]);
			expect(label.measureText().height).toBe(2 * 10);
			label.destroy();
		});

		it("the bounds follow the new line count", () => {
			const label = text("a,b");
			const oneLine = label.getBounds().height;
			label.setText(["a", "b"]);
			expect(label.getBounds().height).toBe(2 * oneLine);
			label.destroy();
		});

		it("numbers, and array entries that are numbers, become strings", () => {
			const label = text(1000);
			expect(label._text).toEqual(["1000"]);
			label.setText([1, 2]);
			expect(label._text).toEqual(["1", "2"]);
			// drawn: every line is trimmed, which a number cannot be
			expect(() => {
				label.draw(app.renderer);
			}).not.toThrow();
			label.destroy();
		});

		it("the same lines again change nothing, and the caller's array is copied", () => {
			const lines = ["a", "b"];
			const label = text(lines);
			label.setText(["a", "b"]);
			expect(label._text).toEqual(["a", "b"]);
			lines[0] = "changed";
			expect(label._text).toEqual(["a", "b"]);
			label.destroy();
		});

		it("an empty label set to the empty string stays empty", () => {
			const label = text("");
			expect(label.measureText().height).toBe(0);
			label.setText("");
			expect(label.measureText().height).toBe(0);
			label.setText("x");
			label.setText("");
			expect(label._text).toEqual([""]);
			label.destroy();
		});
	});

	describe("BitmapText", () => {
		it("a comma string after an array of the same toString() replaces it", () => {
			const label = bitmap(["1", "000"]);
			expect(label._text).toEqual(["1", "000"]);
			const twoLines = label.measureText().height;
			label.isDirty = false;
			label.setText("1,000");
			expect(label._text).toEqual(["1,000"]);
			expect(label.isDirty).toBe(true);
			expect(label.measureText().height).toBeLessThan(twoLines);
			label.destroy();
		});

		it("an array after the comma string of the same toString() replaces it", () => {
			const label = bitmap("A,B");
			const oneLine = label.measureText().height;
			label.setText(["A", "B"]);
			expect(label._text).toEqual(["A", "B"]);
			expect(label.measureText().height).toBeGreaterThan(oneLine);
			label.destroy();
		});

		it("the same lines again are not marked dirty", () => {
			const label = bitmap(["A", "B"]);
			label.isDirty = false;
			label.setText("A\nB");
			expect(label.isDirty).toBe(false);
			label.setText(["A", "C"]);
			expect(label.isDirty).toBe(true);
			label.destroy();
		});

		it("numbers become strings, and draw", () => {
			const label = bitmap([12, 0]);
			expect(label._text).toEqual(["12", "0"]);
			expect(() => {
				label.draw(app.renderer);
			}).not.toThrow();
			label.destroy();
		});

		it("an empty label set to the empty string stays empty", () => {
			const label = bitmap("");
			const empty = label.measureText().height;
			label.isDirty = false;
			label.setText("");
			expect(label.isDirty).toBe(false);
			expect(label.measureText().height).toBe(empty);
			label.destroy();
		});
	});
});
