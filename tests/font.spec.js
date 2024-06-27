import { beforeAll, describe, expect, it } from "vitest";
import { Text, boot, video } from "../src/index.js";

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
});
