import { beforeAll, describe, expect, it } from "vitest";
import { BitmapText, boot, loader, Text, video } from "../src/index.js";

describe("Text visible characters", () => {
	beforeAll(() => {
		boot();
		video.init(100, 100, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	describe("Text", () => {
		it("visibleCharacters should default to -1", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			expect(t.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should default to 1.0", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			expect(t.visibleRatio).toEqual(1.0);
		});

		it("setting visibleRatio should update visibleCharacters", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello World",
			});
			t.visibleRatio = 0.5;
			// "Hello World" = 11 chars, 0.5 * 11 = 5
			expect(t.visibleCharacters).toEqual(5);
		});

		it("setting visibleRatio to 1.0 should reset to -1", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleRatio = 0.5;
			expect(t.visibleCharacters).not.toEqual(-1);
			t.visibleRatio = 1.0;
			expect(t.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should reflect visibleCharacters", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "1234567890",
			});
			t.visibleCharacters = 5;
			expect(t.visibleRatio).toBeCloseTo(0.5);
		});

		it("setting visibleCharacters should mark isDirty", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.isDirty = false;
			t.visibleCharacters = 3;
			expect(t.isDirty).toBe(true);
		});

		it("setting visibleRatio should mark isDirty", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.isDirty = false;
			t.visibleRatio = 0.5;
			expect(t.isDirty).toBe(true);
		});

		it("setting same visibleCharacters should not mark isDirty", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleCharacters = 3;
			t.isDirty = false;
			t.visibleCharacters = 3;
			expect(t.isDirty).toBe(false);
		});

		it("multiline should count characters across lines", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "AB\nCD\nEF",
			});
			// 3 lines: "AB", "CD", "EF" = 6 chars total
			t.visibleRatio = 0.5;
			expect(t.visibleCharacters).toEqual(3);
		});

		it("visibleCharacters = 0 should show nothing", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleCharacters = 0;
			expect(t.visibleRatio).toEqual(0);
		});

		it("empty text should handle visibleRatio gracefully", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "",
			});
			expect(t.visibleRatio).toEqual(1.0);
			t.visibleRatio = 0.5;
			// no chars -> visibleCharacters = 0
			expect(t.visibleCharacters).toEqual(0);
		});

		it("visibleRatio should clamp negative values to 0", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleRatio = -0.5;
			expect(t.visibleCharacters).toEqual(0);
			expect(t.visibleRatio).toEqual(0);
		});

		it("visibleRatio should clamp values above 1.0", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleRatio = 1.5;
			expect(t.visibleCharacters).toEqual(-1);
			expect(t.visibleRatio).toEqual(1.0);
		});

		it("visibleRatio should handle NaN gracefully", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleRatio = NaN;
			// NaN is not finite -> treated as 1.0
			expect(t.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should handle Infinity gracefully", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleRatio = Infinity;
			expect(t.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should handle -Infinity gracefully", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleRatio = -Infinity;
			// -Infinity is not finite, treated as 1.0 (show all)
			expect(t.visibleCharacters).toEqual(-1);
		});

		it("single line should count characters correctly", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleCharacters = 3;
			expect(t.visibleRatio).toBeCloseTo(0.6);
		});

		it("visibleCharacters larger than text length should not crash", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hi",
			});
			t.visibleCharacters = 100;
			expect(t.visibleRatio).toBeGreaterThan(1.0);
		});

		it("changing text should adjust visibleRatio", () => {
			const t = new Text(0, 0, {
				font: "Arial",
				size: 16,
				text: "Hello",
			});
			t.visibleCharacters = 3;
			expect(t.visibleRatio).toBeCloseTo(0.6); // 3/5
			t.setText("Hello World");
			// visibleCharacters stays 3, but ratio changes (3/11)
			expect(t.visibleCharacters).toEqual(3);
			expect(t.visibleRatio).toBeCloseTo(3 / 11);
		});
	});

	describe("BitmapText", () => {
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

		it("visibleCharacters should default to -1", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			expect(b.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should default to 1.0", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			expect(b.visibleRatio).toEqual(1.0);
		});

		it("setting visibleRatio should update visibleCharacters", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO WORLD",
			});
			b.visibleRatio = 0.5;
			expect(b.visibleCharacters).toEqual(5);
		});

		it("setting visibleRatio to 1.0 should reset to -1", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleRatio = 0.5;
			expect(b.visibleCharacters).not.toEqual(-1);
			b.visibleRatio = 1.0;
			expect(b.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should reflect visibleCharacters", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "1234567890",
			});
			b.visibleCharacters = 5;
			expect(b.visibleRatio).toBeCloseTo(0.5);
		});

		it("setting visibleCharacters should mark isDirty", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.isDirty = false;
			b.visibleCharacters = 3;
			expect(b.isDirty).toBe(true);
		});

		it("setting visibleRatio should mark isDirty", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.isDirty = false;
			b.visibleRatio = 0.5;
			expect(b.isDirty).toBe(true);
		});

		it("setting same visibleCharacters should not mark isDirty", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleCharacters = 3;
			b.isDirty = false;
			b.visibleCharacters = 3;
			expect(b.isDirty).toBe(false);
		});

		it("visibleCharacters = 0 should show nothing", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleCharacters = 0;
			expect(b.visibleRatio).toEqual(0);
		});

		it("empty text should handle visibleRatio gracefully", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "",
			});
			expect(b.visibleRatio).toEqual(1.0);
			b.visibleRatio = 0.5;
			expect(b.visibleCharacters).toEqual(0);
		});

		it("multiline should count characters across lines", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "AB\nCD\nEF",
			});
			b.visibleRatio = 0.5;
			expect(b.visibleCharacters).toEqual(3);
		});

		it("visibleRatio should clamp negative values", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleRatio = -0.5;
			expect(b.visibleCharacters).toEqual(0);
		});

		it("visibleRatio should clamp values above 1.0", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleRatio = 1.5;
			expect(b.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should handle NaN gracefully", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleRatio = NaN;
			expect(b.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should handle Infinity gracefully", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleRatio = Infinity;
			expect(b.visibleCharacters).toEqual(-1);
		});

		it("visibleRatio should handle -Infinity gracefully", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleRatio = -Infinity;
			// -Infinity is not finite, treated as 1.0 (show all)
			expect(b.visibleCharacters).toEqual(-1);
		});

		it("single line should count characters correctly", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleCharacters = 3;
			expect(b.visibleRatio).toBeCloseTo(0.6);
		});

		it("visibleCharacters larger than text length should not crash", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HI",
			});
			b.visibleCharacters = 100;
			expect(b.visibleRatio).toBeGreaterThan(1.0);
		});

		it("changing text should adjust visibleRatio", () => {
			const b = new BitmapText(0, 0, {
				font: "xolo12",
				text: "HELLO",
			});
			b.visibleCharacters = 3;
			expect(b.visibleRatio).toBeCloseTo(0.6); // 3/5
			b.setText("HELLO WORLD");
			// visibleCharacters stays 3, but ratio changes (3/11)
			expect(b.visibleCharacters).toEqual(3);
			expect(b.visibleRatio).toBeCloseTo(3 / 11);
		});
	});
});
