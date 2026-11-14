import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, BitmapText, boot, Text, video } from "../src/index.js";

/**
 * `wordWrapWidth` only ever ADDS line breaks.
 *
 * `TextMetrics#wordWrap`, shared by `Text` and `BitmapText`, had two faults:
 *
 * - a first word wider than the wrap width was pushed onto a fresh line
 *   without checking that the line it closed held anything, so the label
 *   started with a blank line (and a blank line before every over-wide word);
 * - it replaced every `\n` with a space before wrapping, so the explicit line
 *   breaks of a wrapped label were lost: `"Hello\nWorld"` came out on ONE
 *   line as soon as `wordWrapWidth` was set, although the `Text` class
 *   example promises a wrapped, multi-line label.
 *
 * Each `\n`-separated paragraph is now wrapped on its own, so a wrapped label
 * keeps every line, blank ones included, that it has unwrapped.
 */

// a minimal BMFont: 4x4 glyphs, 6px advance
const fontData = `info face="wrap" size=4 padding=0,0,0,0 spacing=0,0
common lineHeight=6 base=4 scaleW=4 scaleH=4 pages=1 packed=0
page id=0 file="wrap.png"
chars count=5
char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=65 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=66 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=67 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=68 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15`;

/** the lines a label lays out, as drawn (trailing whitespace is never drawn) */
const linesOf = (label) => {
	return label._text.map((line) => {
		return line.trimEnd();
	});
};

describe("word wrap", () => {
	let app;
	let image;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		image = document.createElement("canvas");
		image.width = image.height = 4;
		const ctx = image.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, 4, 4);
	});

	afterAll(() => {
		app?.destroy();
	});

	describe("Text", () => {
		const SIZE = 20;
		const make = (text, wordWrapWidth, extra = {}) => {
			return new Text(0, 0, {
				font: "sans-serif",
				size: SIZE,
				text,
				wordWrapWidth,
				...extra,
			});
		};
		/** how wide `string` is in the label's own font */
		const widthOf = (label, string) => {
			const context = label.canvasTexture.context;
			context.save();
			context.font = label.font;
			const width = context.measureText(string).width;
			context.restore();
			return width;
		};

		it("a first word wider than wordWrapWidth does not add a blank leading line", () => {
			const label = make("WWWWWWWW A", 40);
			expect(linesOf(label)).toEqual(["WWWWWWWW", "A"]);
			expect(label.measureText().height).toBe(2 * SIZE);
			label.destroy();
		});

		it("a single word wider than wordWrapWidth stays one line", () => {
			const label = make("WWWWWWWW", 40);
			expect(linesOf(label)).toEqual(["WWWWWWWW"]);
			expect(label.measureText().height).toBe(SIZE);
			label.destroy();
		});

		it("an over-wide word in the middle gets its own line, with no blank one", () => {
			const label = make("A WWWWWWWW B", 40);
			expect(linesOf(label)).toEqual(["A", "WWWWWWWW", "B"]);
			label.destroy();
		});

		it("keeps explicit line breaks that fit", () => {
			const label = make("Hello\nWorld", 400);
			expect(linesOf(label)).toEqual(["Hello", "World"]);
			expect(label.measureText().height).toBe(2 * SIZE);
			label.destroy();
		});

		it("the class example: a wrapped label keeps its first line on its own", () => {
			const label = new Text(8, 8, {
				font: "sans-serif",
				size: 24,
				wordWrapWidth: 200,
				text: "Hello melonJS!\nStyled, wrapped, multi-line text.",
			});
			const lines = linesOf(label);
			expect(lines[0]).toBe("Hello melonJS!");
			expect(lines.length).toBeGreaterThanOrEqual(2);
			expect(lines.slice(1).join(" ")).toBe(
				"Styled, wrapped, multi-line text.",
			);
			for (const line of lines) {
				expect(widthOf(label, line)).toBeLessThan(200);
			}
			label.destroy();
		});

		it("wraps each paragraph on its own: a line break is never merged away", () => {
			const label = make("AAA BBB CCC\nDDD", 70);
			const lines = linesOf(label);
			// the last line of the first paragraph ends at CCC...
			expect(lines.indexOf("DDD")).toBe(lines.length - 1);
			expect(lines.slice(0, -1).join(" ")).toBe("AAA BBB CCC");
			// ...and every line is greedy: the next word would not have fitted
			for (let i = 0; i < lines.length - 2; i++) {
				const next = lines[i + 1].split(" ")[0];
				expect(
					widthOf(label, lines[i] + " " + next + " "),
				).toBeGreaterThanOrEqual(70);
			}
			label.destroy();
		});

		it("blank lines, leading and trailing breaks are kept as they are unwrapped", () => {
			for (const text of [
				"\nHello",
				"Hello\n",
				"A\n\nB",
				"\n\n",
				"A\n\n\nB\n",
			]) {
				const wrapped = make(text, 400);
				const plain = make(text);
				expect(linesOf(wrapped), JSON.stringify(text)).toEqual(linesOf(plain));
				expect(wrapped.measureText().height).toBe(plain.measureText().height);
				wrapped.destroy();
				plain.destroy();
			}
		});

		it("an array of strings is one line per entry, as it is unwrapped", () => {
			const label = make(["Hello", "World"], 400);
			expect(linesOf(label)).toEqual(["Hello", "World"]);
			label.destroy();
		});

		it("accepts \\r\\n line breaks", () => {
			const label = make("Hello\r\nWorld", 400);
			expect(linesOf(label)).toEqual(["Hello", "World"]);
			label.destroy();
		});

		it("no wrapped line carries a line break character", () => {
			const label = make(
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit\nsed do eiusmod",
				120,
			);
			for (const line of label._text) {
				expect(line).not.toMatch(/[\r\n]/);
			}
			label.destroy();
		});

		it("setting the same text again lays it out the same", () => {
			const text = "WWWWWWWW A B C\n\nD E F G H I J K";
			const label = make(text, 60);
			const first = linesOf(label);
			label.setText(text);
			expect(linesOf(label)).toEqual(first);
			label.setText(label._text);
			expect(linesOf(label)).toEqual(first);
			label.destroy();
		});

		it("a wrapped multi-line label draws every line", () => {
			// a blank first line would push the text down one line box
			const label = make("WWWWWWWW A", 40, { fillStyle: "#ffffff" });
			const canvas = label.canvasTexture.canvas;
			const data = label.canvasTexture.context.getImageData(
				0,
				0,
				canvas.width,
				label.metrics.inkPadTop + SIZE,
			).data;
			let ink = 0;
			for (let i = 3; i < data.length; i += 4) {
				if (data[i] > 0) {
					ink++;
				}
			}
			expect(ink, "the first line box holds the long word").toBeGreaterThan(0);
			label.destroy();
		});
	});

	describe("BitmapText", () => {
		const make = (text, wordWrapWidth) => {
			return new BitmapText(0, 0, {
				font: image,
				fontData,
				text,
				wordWrapWidth,
			});
		};

		it("a first word wider than wordWrapWidth does not add a blank leading line", () => {
			const label = make("AAAAAA B", 20);
			expect(linesOf(label)).toEqual(["AAAAAA", "B"]);
			label.destroy();
		});

		it("an over-wide word in the middle gets its own line, with no blank one", () => {
			const label = make("B AAAAAA C", 20);
			expect(linesOf(label)).toEqual(["B", "AAAAAA", "C"]);
			label.destroy();
		});

		it("wraps words greedily: two 6px words fit in 30px, three do not", () => {
			// "A B " is 24px, "A " alone 12px — the trailing space counts
			const label = make("A B C D", 30);
			expect(linesOf(label)).toEqual(["A B", "C D"]);
			label.destroy();
		});

		it("keeps explicit line breaks that fit", () => {
			const label = make("A\nB", 100);
			expect(linesOf(label)).toEqual(["A", "B"]);
			label.destroy();
		});

		it("wraps each paragraph on its own", () => {
			const label = make("A B C\nD", 30);
			expect(linesOf(label)).toEqual(["A B", "C", "D"]);
			label.destroy();
		});

		it("blank lines, leading and trailing breaks are kept as they are unwrapped", () => {
			for (const text of ["\nA", "A\n", "A\n\nB", "\n\n"]) {
				const wrapped = make(text, 100);
				const plain = make(text);
				expect(linesOf(wrapped), JSON.stringify(text)).toEqual(linesOf(plain));
				expect(wrapped.measureText().height).toBe(plain.measureText().height);
				wrapped.destroy();
				plain.destroy();
			}
		});
	});

	it("a long first word of a later paragraph adds no blank line either", () => {
		// "AB CD " is 36px and fits in 40; "ABCDABCD" is 48 and does not
		const bitmap = new BitmapText(0, 0, {
			font: image,
			fontData,
			text: "AB CD\nABCDABCD A\n\nB",
			wordWrapWidth: 40,
		});
		expect(linesOf(bitmap)).toEqual(["AB CD", "ABCDABCD", "A", "", "B"]);
		bitmap.destroy();
	});
});
