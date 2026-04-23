import { beforeAll, describe, expect, it } from "vitest";
import { boot, Text, video } from "../src/index.js";

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
			// no chars → visibleCharacters = 0
			expect(t.visibleCharacters).toEqual(0);
		});
	});

	// BitmapText tests require font data loaded via the loader,
	// which isn't available in the unit test environment.
	// The visibleCharacters/visibleRatio logic is identical to Text
	// and is validated through the Text tests above.
	// BitmapText-specific draw behavior is tested visually in the text example.
});
