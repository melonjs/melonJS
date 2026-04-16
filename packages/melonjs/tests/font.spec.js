import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	BitmapText,
	boot,
	Color,
	game,
	loader,
	Text,
	video,
} from "../src/index.js";

describe("Font : Text", () => {
	let font;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});

		font = new Text(0, 0, {
			font: "Arial",
			size: 8,
			fillStyle: "white",
			text: "test",
		});
	});

	describe("font set Size", async () => {
		it("default font size is '8'", async () => {
			expect(font.height).toEqual(8);
		});

		it("default font size is '10'", async () => {
			font.setFont("Arial", "10");
			expect(font.height).toEqual(10);
		});

		it("set font size to 12px", async () => {
			font.setFont("Arial", "12px");
			expect(font.height).toEqual(12);
		});

		it("set font size to 2ex", async () => {
			font.setFont("Arial", "2ex");
			expect(font.height).toEqual(2 * 12);
		});

		it("set font size to 1.5em", async () => {
			font.setFont("Arial", "1.5em");
			expect(font.height).toEqual(1.5 * 24);
		});

		it("set font size to 18pt", async () => {
			font.setFont("Arial", "18pt");
			expect(font.height).toEqual(18 * 0.75);
		});
	});

	describe("bold and italic", () => {
		it("bold() should add bold to the font", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 12,
				text: "test",
			});
			text.bold();
			expect(text.font).toContain("bold");
		});

		it("bold() should not duplicate when called twice", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 12,
				text: "test",
			});
			text.bold();
			text.bold();
			const matches = text.font.match(/bold/g);
			expect(matches.length).toEqual(1);
		});

		it("italic() should add italic to the font", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 12,
				text: "test",
			});
			text.italic();
			expect(text.font).toContain("italic");
		});

		it("italic() should not duplicate when called twice", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 12,
				text: "test",
			});
			text.italic();
			text.italic();
			const matches = text.font.match(/italic/g);
			expect(matches.length).toEqual(1);
		});

		it("should support both bold and italic together", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 12,
				text: "test",
			});
			text.bold();
			text.italic();
			expect(text.font).toContain("bold");
			expect(text.font).toContain("italic");
		});

		it("bold and italic via settings should not duplicate", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 12,
				text: "test",
				bold: true,
				italic: true,
			});
			text.bold();
			text.italic();
			const boldMatches = text.font.match(/bold/g);
			const italicMatches = text.font.match(/italic/g);
			expect(boldMatches.length).toEqual(1);
			expect(italicMatches.length).toEqual(1);
		});
	});

	describe("word wrapping", () => {
		it("word wrap a single string", async () => {
			font.wordWrapWidth = 150;
			font.setText(
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
			);
			expect(font.measureText().width).toBeLessThanOrEqual(font.wordWrapWidth);
		});
	});

	describe("setText", () => {
		it("should update text content", () => {
			font.setText("hello");
			expect(font.measureText()).toBeDefined();
		});

		it("should have a canvas texture after setText", () => {
			font.setText("test");
			expect(font.canvasTexture).toBeDefined();
			expect(font.canvasTexture.canvas).toBeInstanceOf(
				globalThis.HTMLCanvasElement,
			);
		});
	});

	describe("parentApp and renderer access", () => {
		it("should access renderer via parentApp when in container tree", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "hello",
			});
			game.world.addChild(text);

			expect(text.parentApp).toBeDefined();
			expect(text.parentApp).toBeInstanceOf(Application);
			expect(text.parentApp.renderer).toBe(game.renderer);

			game.world.removeChild(text);
		});
	});

	describe("TextMetrics", () => {
		it("lineHeight should return a positive value", () => {
			const metrics = font.measureText();
			expect(metrics.height).toBeGreaterThan(0);
		});

		it("measureText should return width and height for single line", () => {
			font.setText("hello");
			const metrics = font.measureText();
			expect(metrics.width).toBeGreaterThan(0);
			expect(metrics.height).toBeGreaterThan(0);
		});

		it("measureText should handle multiline text", () => {
			font.setText("line1\nline2\nline3");
			const metrics = font.measureText();
			const singleLine = new Text(0, 0, {
				font: "Arial",
				size: 8,
				text: "line1",
			});
			const singleMetrics = singleLine.measureText();
			// multiline should be taller than single line
			expect(metrics.height).toBeGreaterThan(singleMetrics.height);
		});

		it("measureText x position should reflect textAlign left", () => {
			const text = new Text(100, 50, {
				font: "Arial",
				size: 12,
				textAlign: "left",
				text: "test",
			});
			const metrics = text.measureText();
			expect(metrics.x).toEqual(100);
		});

		it("measureText x position should reflect textAlign right", () => {
			const text = new Text(100, 50, {
				font: "Arial",
				size: 12,
				textAlign: "right",
				text: "test",
			});
			const metrics = text.measureText();
			expect(metrics.x).toBeLessThan(100);
		});

		it("measureText x position should reflect textAlign center", () => {
			const text = new Text(100, 50, {
				font: "Arial",
				size: 12,
				textAlign: "center",
				text: "test",
			});
			const metrics = text.measureText();
			expect(metrics.x).toBeLessThan(100);
			expect(metrics.x).toBeGreaterThan(100 - metrics.width);
		});

		it("measureText y position should reflect textBaseline top", () => {
			const text = new Text(0, 50, {
				font: "Arial",
				size: 12,
				textBaseline: "top",
				text: "test",
			});
			const metrics = text.measureText();
			expect(metrics.y).toEqual(50);
		});

		it("measureText y position should reflect textBaseline middle", () => {
			const text = new Text(0, 50, {
				font: "Arial",
				size: 12,
				textBaseline: "middle",
				text: "test",
			});
			const metrics = text.measureText();
			expect(metrics.y).toBeLessThan(50);
		});

		it("measureText y position should reflect textBaseline bottom", () => {
			const text = new Text(0, 50, {
				font: "Arial",
				size: 12,
				textBaseline: "bottom",
				text: "test",
			});
			const metrics = text.measureText();
			expect(metrics.y).toBeLessThan(50);
		});
	});

	describe("Text updateBounds with textAlign", () => {
		it("left-aligned bounds should start at pos.x", () => {
			const t = new Text(100, 50, {
				font: "Arial",
				size: 16,
				textAlign: "left",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.left).toBeCloseTo(100, 0);
			expect(bounds.width).toBeGreaterThan(0);
			game.world.removeChildNow(t);
		});

		it("right-aligned bounds should end at pos.x", () => {
			const t = new Text(100, 50, {
				font: "Arial",
				size: 16,
				textAlign: "right",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.right).toBeCloseTo(100, 0);
			expect(bounds.left).toBeLessThan(100);
			game.world.removeChildNow(t);
		});

		it("center-aligned bounds should center on pos.x", () => {
			const t = new Text(100, 50, {
				font: "Arial",
				size: 16,
				textAlign: "center",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			const center = bounds.left + bounds.width / 2;
			expect(center).toBeCloseTo(100, 0);
			game.world.removeChildNow(t);
		});
	});

	describe("Text updateBounds with textBaseline", () => {
		it("top baseline bounds should start at pos.y", () => {
			const t = new Text(50, 100, {
				font: "Arial",
				size: 16,
				textBaseline: "top",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.top).toBeCloseTo(100, 0);
			game.world.removeChildNow(t);
		});

		it("bottom baseline bounds should end at pos.y", () => {
			const t = new Text(50, 100, {
				font: "Arial",
				size: 16,
				textBaseline: "bottom",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.bottom).toBeCloseTo(100, 0);
			expect(bounds.top).toBeLessThan(100);
			game.world.removeChildNow(t);
		});

		it("middle baseline bounds should center on pos.y", () => {
			const t = new Text(50, 100, {
				font: "Arial",
				size: 16,
				textBaseline: "middle",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			const center = bounds.top + bounds.height / 2;
			expect(center).toBeCloseTo(100, 0);
			game.world.removeChildNow(t);
		});

		it("alphabetic baseline should behave like bottom", () => {
			const t = new Text(50, 100, {
				font: "Arial",
				size: 16,
				textBaseline: "alphabetic",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.bottom).toBeCloseTo(100, 0);
			game.world.removeChildNow(t);
		});
	});

	describe("Text updateBounds combined align + baseline", () => {
		it("right + bottom should have bounds ending at pos", () => {
			const t = new Text(200, 200, {
				font: "Arial",
				size: 16,
				textAlign: "right",
				textBaseline: "bottom",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.right).toBeCloseTo(200, 0);
			expect(bounds.bottom).toBeCloseTo(200, 0);
			game.world.removeChildNow(t);
		});

		it("center + middle should center bounds on pos", () => {
			const t = new Text(200, 200, {
				font: "Arial",
				size: 16,
				textAlign: "center",
				textBaseline: "middle",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			const cx = bounds.left + bounds.width / 2;
			const cy = bounds.top + bounds.height / 2;
			expect(cx).toBeCloseTo(200, 0);
			expect(cy).toBeCloseTo(200, 0);
			game.world.removeChildNow(t);
		});
	});

	describe("Text bounds edge cases", () => {
		it("empty text should have zero-size bounds", () => {
			const t = new Text(50, 50, {
				font: "Arial",
				size: 16,
				text: "",
			});
			const bounds = t.getBounds();
			expect(bounds.width).toEqual(0);
			expect(bounds.height).toEqual(0);
		});

		it("bounds width should grow with text length", () => {
			const t1 = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "a",
			});
			const t2 = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "aaaaaaaaaa",
			});
			expect(t2.getBounds().width).toBeGreaterThan(t1.getBounds().width);
		});

		it("bounds height should grow with font size", () => {
			const t1 = new Text(0, 0, {
				font: "Arial",
				size: 12,
				text: "test",
			});
			const t2 = new Text(0, 0, {
				font: "Arial",
				size: 48,
				text: "test",
			});
			expect(t2.getBounds().height).toBeGreaterThan(t1.getBounds().height);
		});
	});

	describe("wordWrap", () => {
		it("should wrap long text within the given width", () => {
			font.wordWrapWidth = 100;
			font.setText(
				"This is a long sentence that should be wrapped into multiple lines",
			);
			const metrics = font.measureText();
			expect(metrics.width).toBeLessThanOrEqual(100);
		});

		it("should not wrap short text", () => {
			font.wordWrapWidth = 500;
			font.setText("Short");
			const metrics = font.measureText();
			expect(metrics.width).toBeLessThanOrEqual(500);
		});

		it("should handle empty text", () => {
			font.setText("");
			const metrics = font.measureText();
			expect(metrics.width).toEqual(0);
		});
	});

	describe("setText edge cases", () => {
		it("should accept a number", () => {
			const t = new Text(0, 0, { font: "Arial", size: 12, text: "" });
			t.setText(42);
			expect(t.measureText()).toBeDefined();
			expect(t.measureText().width).toBeGreaterThan(0);
		});

		it("should accept an array of strings", () => {
			const t = new Text(0, 0, { font: "Arial", size: 12, text: "" });
			t.setText(["line1", "line2"]);
			expect(t.measureText().height).toBeGreaterThan(0);
		});

		it("should return the Text for chaining", () => {
			const t = new Text(0, 0, { font: "Arial", size: 12, text: "" });
			expect(t.setText("hello")).toBe(t);
		});
	});

	describe("lineHeight", () => {
		it("custom lineHeight should affect multiline height", () => {
			const t1 = new Text(0, 0, {
				font: "Arial",
				size: 16,
				lineHeight: 1.0,
				text: "A\nB",
			});
			const t2 = new Text(0, 0, {
				font: "Arial",
				size: 16,
				lineHeight: 2.0,
				text: "A\nB",
			});
			expect(t2.getBounds().height).toBeGreaterThan(t1.getBounds().height);
		});
	});

	describe("Text updateBounds with hanging and ideographic baselines", () => {
		it("hanging baseline should behave like top", () => {
			const t = new Text(50, 100, {
				font: "Arial",
				size: 16,
				textBaseline: "hanging",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.top).toBeCloseTo(100, 0);
			game.world.removeChildNow(t);
		});

		it("ideographic baseline should behave like bottom", () => {
			const t = new Text(50, 100, {
				font: "Arial",
				size: 16,
				textBaseline: "ideographic",
				text: "test",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.bottom).toBeCloseTo(100, 0);
			game.world.removeChildNow(t);
		});
	});

	describe("Text multiline bounds", () => {
		it("center-aligned multiline bounds should center on pos.x", () => {
			const t = new Text(200, 50, {
				font: "Arial",
				size: 12,
				textAlign: "center",
				text: "line one\nline two long",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			const cx = bounds.left + bounds.width / 2;
			expect(cx).toBeCloseTo(200, 0);
			game.world.removeChildNow(t);
		});

		it("right-aligned multiline bounds should end at pos.x", () => {
			const t = new Text(200, 50, {
				font: "Arial",
				size: 12,
				textAlign: "right",
				text: "line one\nline two long",
			});
			game.world.addChild(t);
			const bounds = t.getBounds();
			expect(bounds.right).toBeCloseTo(200, 0);
			game.world.removeChildNow(t);
		});

		it("multiline height should equal numLines * lineHeight", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				lineHeight: 1.0,
				text: "A\nB\nC",
			});
			const bounds = t.getBounds();
			// 3 lines × 16px × 1.0 lineHeight = 48
			expect(bounds.height).toBeCloseTo(48, 0);
		});
	});

	describe("setFont", () => {
		it("should return the Text for chaining", () => {
			const t = new Text(0, 0, { font: "Arial", size: 12, text: "x" });
			expect(t.setFont("Verdana", 14)).toBe(t);
		});
	});

	describe("destroy", () => {
		it("should clean up resources when removed from world", () => {
			const text = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "destroy test",
			});
			game.world.addChild(text);

			// removeChildNow triggers destroy synchronously
			game.world.removeChildNow(text);

			expect(text.canvasTexture).toBeUndefined();
			expect(text.fillStyle).toBeUndefined();
			expect(text.strokeStyle).toBeUndefined();
		});
	});
});

describe("Font : BitmapText bounds", () => {
	beforeAll(async () => {
		await new Promise((resolve) => {
			loader.preload(
				[
					{
						name: "xolo12",
						type: "image",
						src: "/data/fnt/xolo12.png",
					},
					{
						name: "xolo12",
						type: "binary",
						src: "/data/fnt/xolo12.fnt",
					},
				],
				resolve,
			);
		});
	});

	describe("BitmapText updateBounds with textAlign", () => {
		it("left-aligned bounds should start at pos.x", () => {
			const b = new BitmapText(100, 50, {
				font: "xolo12",
				textAlign: "left",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.left).toBeCloseTo(100, 0);
			// skip width check — font binary may not load in test environment
			game.world.removeChildNow(b);
		});

		it("right-aligned bounds should end at pos.x", () => {
			const b = new BitmapText(100, 50, {
				font: "xolo12",
				textAlign: "right",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.right).toBeCloseTo(100, 0);
			expect(bounds.left).toBeLessThan(100);
			game.world.removeChildNow(b);
		});

		it("center-aligned bounds should center on pos.x", () => {
			const b = new BitmapText(100, 50, {
				font: "xolo12",
				textAlign: "center",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			const center = bounds.left + bounds.width / 2;
			expect(center).toBeCloseTo(100, 0);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText updateBounds with textBaseline", () => {
		// xolo12 font-wide glyphMinTop=1 (from brackets/pipes with yoffset=1)
		// so the visual bounds are offset from pos.y by the font-wide min yoffset
		const glyphYOff = 1;

		it("top baseline bounds should start at glyph position", () => {
			const b = new BitmapText(50, 100, {
				font: "xolo12",
				textBaseline: "top",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.top).toBeCloseTo(100 + glyphYOff, 0);
			game.world.removeChildNow(b);
		});

		it("bottom baseline bounds should end at pos.y", () => {
			const b = new BitmapText(50, 100, {
				font: "xolo12",
				textBaseline: "bottom",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.bottom).toBeCloseTo(100, 0);
			expect(bounds.top).toBeLessThan(100);
			game.world.removeChildNow(b);
		});

		it("middle baseline bounds should center on pos.y", () => {
			const b = new BitmapText(50, 100, {
				font: "xolo12",
				textBaseline: "middle",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			const center = bounds.top + bounds.height / 2;
			expect(center).toBeCloseTo(100, 0);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText updateBounds combined align + baseline", () => {
		it("right + bottom should have bounds ending at pos", () => {
			const b = new BitmapText(200, 200, {
				font: "xolo12",
				textAlign: "right",
				textBaseline: "bottom",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.right).toBeCloseTo(200, 0);
			expect(bounds.bottom).toBeCloseTo(200, 0);
			game.world.removeChildNow(b);
		});

		it("center + middle should center bounds on pos", () => {
			const b = new BitmapText(200, 200, {
				font: "xolo12",
				textAlign: "center",
				textBaseline: "middle",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			const cx = bounds.left + bounds.width / 2;
			const cy = bounds.top + bounds.height / 2;
			expect(cx).toBeCloseTo(200, 0);
			expect(cy).toBeCloseTo(200, 0);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText multiline baseline bounds", () => {
		it("bottom baseline multiline should end at pos.y", () => {
			const b = new BitmapText(100, 200, {
				font: "xolo12",
				textBaseline: "bottom",
				text: "LINE1\nLINE2\nLINE3",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.bottom).toBeCloseTo(200, 0);
			game.world.removeChildNow(b);
		});

		it("middle baseline multiline should center on pos.y", () => {
			const b = new BitmapText(100, 200, {
				font: "xolo12",
				textBaseline: "middle",
				text: "LINE1\nLINE2\nLINE3",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			const cy = bounds.top + bounds.height / 2;
			expect(cy).toBeCloseTo(200, 0);
			game.world.removeChildNow(b);
		});

		it("top baseline multiline height should grow with lines", () => {
			const b1 = new BitmapText(0, 0, {
				font: "xolo12",
				text: "A",
			});
			const b3 = new BitmapText(0, 0, {
				font: "xolo12",
				text: "A\nB\nC",
			});
			game.world.addChild(b1);
			game.world.addChild(b3);
			// 3 lines should be roughly 3x the height of 1 line
			expect(b3.getBounds().height).toBeGreaterThan(b1.getBounds().height * 2);
			game.world.removeChildNow(b1);
			game.world.removeChildNow(b3);
		});
	});

	describe("BitmapText bounds with scale", () => {
		it("scaled bitmap text bounds should reflect scaled size", () => {
			const b1 = new BitmapText(0, 0, {
				font: "xolo12",
				size: 1.0,
				text: "TEST",
			});
			const b2 = new BitmapText(0, 0, {
				font: "xolo12",
				size: 2.0,
				text: "TEST",
			});
			game.world.addChild(b1);
			game.world.addChild(b2);
			expect(b2.getBounds().width).toBeGreaterThan(b1.getBounds().width);
			expect(b2.getBounds().height).toBeGreaterThan(b1.getBounds().height);
			game.world.removeChildNow(b1);
			game.world.removeChildNow(b2);
		});

		it("resize should update bounds", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "TEST",
			});
			game.world.addChild(b);
			const w1 = b.getBounds().width;
			b.resize(3.0);
			expect(b.getBounds().width).toBeGreaterThan(w1);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText updateBounds with hanging and ideographic baselines", () => {
		it("hanging baseline should behave like top", () => {
			const b = new BitmapText(50, 100, {
				font: "xolo12",
				textBaseline: "hanging",
				text: "TEST",
			});
			const bTop = new BitmapText(50, 100, {
				font: "xolo12",
				textBaseline: "top",
				text: "TEST",
			});
			game.world.addChild(b);
			game.world.addChild(bTop);
			expect(b.getBounds().top).toBeCloseTo(bTop.getBounds().top, 0);
			expect(b.getBounds().bottom).toBeCloseTo(bTop.getBounds().bottom, 0);
			game.world.removeChildNow(b);
			game.world.removeChildNow(bTop);
		});

		it("ideographic baseline should behave like bottom", () => {
			const b = new BitmapText(50, 100, {
				font: "xolo12",
				textBaseline: "ideographic",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.bottom).toBeCloseTo(100, 0);
			expect(bounds.top).toBeLessThan(100);
			game.world.removeChildNow(b);
		});

		it("alphabetic baseline should behave like bottom", () => {
			const b = new BitmapText(50, 100, {
				font: "xolo12",
				textBaseline: "alphabetic",
				text: "TEST",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.bottom).toBeCloseTo(100, 0);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText setText", () => {
		it("should accept a number", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "" });
			b.setText(42);
			expect(b.measureText().width).toBeGreaterThan(0);
		});

		it("should accept an array of strings", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "" });
			b.setText(["LINE1", "LINE2"]);
			expect(b.measureText().height).toBeGreaterThan(0);
		});

		it("should return the BitmapText for chaining", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "" });
			expect(b.setText("TEST")).toBe(b);
		});

		it("changing text should update bounds width", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "A" });
			game.world.addChild(b);
			const w1 = b.getBounds().width;
			b.setText("ABCDEF");
			expect(b.getBounds().width).toBeGreaterThan(w1);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText set method", () => {
		it("should change textAlign", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				textAlign: "left",
				text: "TEST",
			});
			b.set("right");
			expect(b.textAlign).toEqual("right");
		});

		it("should change textAlign and scale", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "TEST",
			});
			b.set("center", 2.0);
			expect(b.textAlign).toEqual("center");
			expect(b.fontScale.x).toEqual(2.0);
		});

		it("should return the BitmapText for chaining", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "TEST" });
			expect(b.set("left")).toBe(b);
		});
	});

	describe("BitmapText fillStyle", () => {
		it("should accept a Color object", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "TEST" });
			const c = new Color(255, 0, 0);
			b.fillStyle = c;
			expect(b.fillStyle.r).toEqual(255);
		});

		it("should accept a CSS color string", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "TEST" });
			b.fillStyle = "#FF0000";
			expect(b.fillStyle.r).toEqual(255);
		});
	});

	describe("BitmapText resize", () => {
		it("should return the BitmapText for chaining", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "TEST" });
			expect(b.resize(2.0)).toBe(b);
		});

		it("should scale width and height proportionally", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				size: 1.0,
				text: "TEST",
			});
			game.world.addChild(b);
			const w1 = b.getBounds().width;
			const h1 = b.getBounds().height;
			b.resize(2.0);
			expect(b.getBounds().width).toBeCloseTo(w1 * 2, 0);
			expect(b.getBounds().height).toBeCloseTo(h1 * 2, 0);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText measureText", () => {
		it("should return metrics with width and height", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "TEST" });
			const m = b.measureText();
			expect(m.width).toBeGreaterThan(0);
			expect(m.height).toBeGreaterThan(0);
		});

		it("width should use visual extent for last glyph", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "T" });
			const m = b.measureText();
			// 'T' in xolo12: xadvance=11, xoffset+width=1+14=15
			// measureText should use max(11, 15) = 15
			expect(m.width).toEqual(15);
		});

		it("multiline width should be the widest line", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "AB\nABCDEF\nAB",
			});
			const bSingle = new BitmapText(0, 0, {
				font: "xolo12",
				text: "ABCDEF",
			});
			expect(b.measureText().width).toEqual(bSingle.measureText().width);
		});
	});

	describe("BitmapText lineHeight", () => {
		it("custom lineHeight should affect multiline height", () => {
			const b1 = new BitmapText(0, 0, {
				font: "xolo12",
				lineHeight: 1.0,
				text: "A\nB",
			});
			const b2 = new BitmapText(0, 0, {
				font: "xolo12",
				lineHeight: 2.0,
				text: "A\nB",
			});
			game.world.addChild(b1);
			game.world.addChild(b2);
			expect(b2.getBounds().height).toBeGreaterThan(b1.getBounds().height);
			game.world.removeChildNow(b1);
			game.world.removeChildNow(b2);
		});
	});

	describe("BitmapText wordWrap", () => {
		it("should wrap long text within the given width", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				wordWrapWidth: 80,
				text: "THIS IS A LONG TEXT THAT SHOULD WRAP",
			});
			expect(b.measureText().width).toBeLessThanOrEqual(80);
		});

		it("should produce more lines when wrapping", () => {
			const noWrap = new BitmapText(0, 0, {
				font: "xolo12",
				text: "THIS IS A LONG TEXT",
			});
			const wrapped = new BitmapText(0, 0, {
				font: "xolo12",
				wordWrapWidth: 60,
				text: "THIS IS A LONG TEXT",
			});
			expect(wrapped.measureText().height).toBeGreaterThan(
				noWrap.measureText().height,
			);
		});
	});

	describe("BitmapText bounds edge cases", () => {
		it("empty text should have zero-size bounds", () => {
			const b = new BitmapText(50, 50, {
				font: "xolo12",
				text: "",
			});
			game.world.addChild(b);
			const bounds = b.getBounds();
			expect(bounds.width).toEqual(0);
			expect(bounds.height).toEqual(0);
			game.world.removeChildNow(b);
		});

		it("multiline text bounds should encompass all lines", () => {
			const single = new BitmapText(0, 0, {
				font: "xolo12",
				text: "LINE1",
			});
			const multi = new BitmapText(0, 0, {
				font: "xolo12",
				text: "LINE1\nLINE2\nLINE3",
			});
			game.world.addChild(single);
			game.world.addChild(multi);
			expect(multi.getBounds().height).toBeGreaterThan(
				single.getBounds().height,
			);
			game.world.removeChildNow(single);
			game.world.removeChildNow(multi);
		});

		it("bounds width should grow with text length", () => {
			const b1 = new BitmapText(0, 0, {
				font: "xolo12",
				text: "A",
			});
			const b2 = new BitmapText(0, 0, {
				font: "xolo12",
				text: "ABCDEFGHIJ",
			});
			expect(b2.getBounds().width).toBeGreaterThan(b1.getBounds().width);
		});

		it("single character should have positive bounds", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "X",
			});
			game.world.addChild(b);
			expect(b.getBounds().width).toBeGreaterThan(0);
			expect(b.getBounds().height).toBeGreaterThan(0);
			game.world.removeChildNow(b);
		});
	});

	describe("BitmapText destroy", () => {
		it("should clean up resources", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "TEST",
			});
			game.world.addChild(b);
			game.world.removeChildNow(b);

			expect(b.fontScale).toBeUndefined();
			expect(b.fontData).toBeUndefined();
			expect(b.metrics).toBeUndefined();
		});
	});

	describe("BitmapTextData precomputed glyph extents", () => {
		it("glyphMinTop should be the smallest yoffset across all glyphs", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "X" });
			// xolo12 has brackets/pipes with yoffset=1 (the smallest)
			expect(b.fontData.glyphMinTop).toEqual(1);
		});

		it("glyphMaxBottom should be the largest yoffset+height", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "X" });
			// xolo12: brackets have yoffset=1, height=14 → 15
			expect(b.fontData.glyphMaxBottom).toEqual(15);
		});

		it("capHeight should equal the height of capital M minus padding", () => {
			const b = new BitmapText(0, 0, { font: "xolo12", text: "X" });
			// xolo12: 'M' height=10, padding=0
			expect(b.fontData.capHeight).toEqual(10);
		});
	});
});
