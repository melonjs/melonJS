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
