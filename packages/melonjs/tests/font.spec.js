import { beforeAll, describe, expect, it } from "vitest";
import { Application, boot, game, Text, video } from "../src/index.js";

describe("Font : Text", () => {
	let font;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});

		font = new Text(0, 0, {
			font: "Arial",
			size: 8,
			fillStyle: "white",
			text: "test",
			offScreenCanvas: false,
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
