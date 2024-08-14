import { beforeAll, describe, expect, it } from "vitest";
import { Color, getPool } from "../src/index.js";

describe("Color", () => {
	let red_color: Color;
	let green_color: Color;
	let blue_color: Color;

	//ToDo changing this to 'beforeEach' shows that currently tests leak their state into other tests, which is not good
	beforeAll(() => {
		red_color = new Color(255, 0, 0, 0.5);
		green_color = new Color().parseCSS("green");
		blue_color = new Color().parseHex("#0000FF");
	});

	describe("Color constructor", () => {
		it("creates a new Color instance with default values", () => {
			expect(green_color.r).toEqual(0);
			expect(green_color.g).toEqual(128);
			expect(green_color.b).toEqual(0);
			expect(green_color.alpha).toEqual(1);
		});

		it("creates a new Color instance using another Color object as parameter", () => {
			const color = new Color(red_color);
			expect(color.r).toEqual(255);
			expect(color.g).toEqual(0);
			expect(color.b).toEqual(0);
			expect(color.alpha).toEqual(0.5);
		});
	});

	describe("get a Color instance from the pool", () => {
		const pColor = getPool("color").get(0, 128, 0, 1);
		it("creates a new Color instance with specific values", () => {
			expect(pColor.r).toEqual(0);
			expect(pColor.g).toEqual(128);
			expect(pColor.b).toEqual(0);
			expect(pColor.alpha).toEqual(1);
		});

		it("get Color instance from the pool using another Color object as parameter", () => {
			const pColor2 = getPool("color").get(pColor);
			expect(pColor2.r).toEqual(0);
			expect(pColor2.g).toEqual(128);
			expect(pColor2.b).toEqual(0);
			expect(pColor2.alpha).toEqual(1);
		});

		it("get Color instance from the pool using a CSS String object as parameter", () => {
			const pColor2 = getPool("color").get("#008000");
			expect(pColor2.r).toEqual(0);
			expect(pColor2.g).toEqual(128);
			expect(pColor2.b).toEqual(0);
			expect(pColor2.alpha).toEqual(1);
		});

		it("get Color instance from the pool using a rgb String object as parameter", () => {
			const pColor3 = getPool("color").get("rgb(0,0,255)");
			expect(pColor3.r).toEqual(0);
			expect(pColor3.g).toEqual(0);
			expect(pColor3.b).toEqual(255);
			expect(pColor3.alpha).toEqual(1);
		});

		it("get Color instance from the pool usinng default values", () => {
			const pColor4 = getPool("color").get();
			expect(pColor4.r).toEqual(0);
			expect(pColor4.g).toEqual(0);
			expect(pColor4.b).toEqual(0);
			expect(pColor4.alpha).toEqual(1);
		});
	});

	describe("parseHex Function", () => {
		// #RGB
		it("#00F value is rgb(0, 0, 255)", () => {
			expect(blue_color.parseHex("#0000FF").toRGB()).toEqual("rgb(0,0,255)");
		});
		// #RGBA
		it("#0F08 value is rgba(0, 255, 0, 0.5)", () => {
			expect(blue_color.parseHex("#0F08").toRGBA()).toEqual(
				"rgba(0,255,0,0.5)",
			);
		});
		// #RRGGBB
		it("#FF00FF value is rgba(255, 0, 255, 1)", () => {
			expect(blue_color.parseHex("#FF00FF").toRGBA()).toEqual(
				"rgba(255,0,255,1)",
			);
		});
		// #RRGGBBAA (finish with the blue color so that the test below passes)
		it("#0000FF80 value is rgba(0, 0, 255, 0.5)", () => {
			expect(blue_color.parseHex("#0000FF80").toRGBA()).toEqual(
				"rgba(0,0,255,0.5)",
			);
		});

		// override the alpha with a specific value
		it("#0000FF80 value is rgba(0, 0, 255, 0.5)", () => {
			expect(blue_color.parseHex("#0000FF80").toRGBA(1.0)).toEqual(
				"rgba(0,0,255,1)",
			);
		});
	});

	describe("parseHSV Function", () => {
		// reuse blue_color to test the HSV2RGB functions
		it("(0, 0, 0) value is rgb(0, 0, 0)", () => {
			expect(blue_color.setHSV(0, 0, 0).toRGB()).toEqual("rgb(0,0,0)");
		});
		it("(0, 0, 1) value is rgb(255,255,255)", () => {
			expect(blue_color.setHSV(0, 0, 1).toRGB()).toEqual("rgb(255,255,255)");
		});
		it("(0.5, 1, 1) value is rgb(0,255,255)", () => {
			expect(blue_color.setHSV(0.5, 1, 1).toRGB()).toEqual("rgb(0,255,255)");
		});
		it("(0, 0, .75) value is rgb(0,255,255)", () => {
			expect(blue_color.setHSV(0, 0, 0.75).toRGB()).toEqual("rgb(191,191,191)");
		});
	});

	describe("parseHSL Function", () => {
		// reuse blue_color to test the HSL2RGB functions
		it("(0, 0, 0) value is rgb(0, 0, 0)", () => {
			expect(blue_color.setHSL(0, 0, 0).toRGB()).toEqual("rgb(0,0,0)");
		});
		it("(0, 0, 1) value is rgb(255,255,255)", () => {
			expect(blue_color.setHSL(0, 0, 1).toRGB()).toEqual("rgb(255,255,255)");
		});
		it("(0.5, 1, 0.25) value is rgb(0,255,255)", () => {
			expect(blue_color.setHSL(0.5, 1, 0.25).toRGB()).toEqual("rgb(0,127,127)");
		});
		it("(0, 0, .75) value is rgb(0,255,255)", () => {
			expect(blue_color.setHSL(0, 0, 0.75).toRGB()).toEqual("rgb(191,191,191)");
		});
	});

	describe("red_color", () => {
		it("is an instance of Color", () => {
			expect(red_color).toBeInstanceOf(Color);
		});

		it("red_color.r == 255", () => {
			expect(red_color.r).toEqual(255);
		});

		it("red_color.g == 0", () => {
			expect(red_color.g).toEqual(0);
		});

		it("red_color.b == 0", () => {
			expect(red_color.b).toEqual(0);
		});

		it("red_color.alpha == 0.5", () => {
			expect(red_color.alpha).toEqual(0.5);
		});

		it("red_color hex value is #FF0000", () => {
			expect(red_color.toHex()).toEqual("#FF0000");
		});

		it("red_color RGBA hex value is #FF0000FF", () => {
			expect(red_color.toHex8()).toEqual("#FF00007F");
		});

		it("red_color rgba value is rgba(255,0,0,0.5)", () => {
			expect(red_color.toRGBA()).toEqual("rgba(255,0,0,0.5)");
		});
	});

	describe("green_color", () => {
		it("green_color.r == 0", () => {
			expect(green_color.r).toEqual(0);
		});

		it("green_color.g == 128", () => {
			expect(green_color.g).toEqual(128);
		});

		it("green_color.b == 0", () => {
			expect(green_color.b).toEqual(0);
		});

		it("green_color.alpha == 1", () => {
			expect(green_color.alpha).toEqual(1);
		});

		it("green_color hex value is #008000", () => {
			expect(green_color.toHex()).toEqual("#008000");
		});

		it("(green_color + red_color) hex value is #FF8000", () => {
			expect(red_color.add(green_color).toHex()).toEqual("#FF8000");
		});

		it("darken (green_color + red_color) by 0.5 hex value is #7F4000", () => {
			expect(red_color.darken(0.5).toHex()).toEqual("#7F4000");
		});

		it("final red_color rgba value is rgba(127,64,0,0.75)", () => {
			expect(red_color.toRGBA()).toEqual("rgba(127,64,0,0.75)");
		});
	});

	describe("blue_color", () => {
		it("blue_color hex value is #0000FF", () => {
			blue_color.parseHex("#0000FF80");
			expect(blue_color.toHex()).toEqual("#0000FF");
		});

		it("blue_color rgb value is rgb(0, 0, 255)", () => {
			expect(blue_color.toRGB()).toEqual("rgb(0,0,255)");
		});

		it("blue_color rgba value is rgba(0, 0, 255, 0.5)", () => {
			expect(blue_color.toRGBA()).toEqual("rgba(0,0,255,0.5)");
		});

		it("lighten blue_color hex by 0.5 value is #7F7FFF", () => {
			expect(blue_color.lighten(0.5).toHex()).toEqual("#7F7FFF");
		});
	});

	describe("color lerp function", () => {
		it("Linearly interpolates between colors", () => {
			const _colorA = new Color(0, 0, 0);
			const _colorB = new Color(255, 128, 64);

			_colorA.lerp(_colorB, 0.5);

			expect(_colorA.r).toEqual(127);
			expect(_colorA.g).toEqual(64);
			expect(_colorA.b).toEqual(32);
		});
	});

	describe("color random function", () => {
		it("generate random colors using different ranges", () => {
			const _colorA = new Color().random();
			const _colorB = new Color().random(64, 127);
			const _colorC = new Color().random(-1, 256);

			// they should all be between 0 and 255
			expect(_colorA.r).toBeGreaterThan(-1);
			expect(_colorA.g).toBeGreaterThan(-1);
			expect(_colorA.b).toBeGreaterThan(-1);
			expect(_colorA.r).toBeLessThan(256);
			expect(_colorA.g).toBeLessThan(256);
			expect(_colorA.b).toBeLessThan(256);

			expect(_colorB.r).toBeGreaterThan(63);
			expect(_colorB.g).toBeGreaterThan(63);
			expect(_colorB.b).toBeGreaterThan(63);
			expect(_colorB.r).toBeLessThan(128);
			expect(_colorB.g).toBeLessThan(128);
			expect(_colorB.b).toBeLessThan(128);

			expect(_colorC.r).toBeGreaterThan(-1);
			expect(_colorC.g).toBeGreaterThan(-1);
			expect(_colorC.b).toBeGreaterThan(-1);
			expect(_colorC.r).toBeLessThan(256);
			expect(_colorC.g).toBeLessThan(256);
			expect(_colorC.b).toBeLessThan(256);
		});
	});

	describe("Color toUint32 function", () => {
		it("should return an unsigned 32-bit ARGB value", () => {
			const color = new Color(255, 0, 0);
			const uint32 = color.toUint32(1.0);
			//expect(uint32).toEqual(0xFFFF0000);
			// jasmine test the value as signed int32
			expect(uint32).toEqual(-65536);
		});

		it("should handle alpha values", () => {
			const color = new Color(255, 0, 0);
			const uint32 = color.toUint32(0.5);
			//expect(color.toUint32()).toEqual(0x7FFF0000);
			// jasmine test the value as signed int32
			expect(uint32).toEqual(2147418112);
		});

		it("should shift the alpha value to the first byte", () => {
			const color = new Color(0, 0, 0);
			const uint32 = color.toUint32(0.25);
			//expect(uint32).toEqual(0x3F000000);
			// jasmine test the value as signed int32
			expect(uint32).toEqual(1056964608);
		});

		it("should shift the red value to the second byte", () => {
			const color = new Color(255, 0, 0);
			const uint32 = color.toUint32(1.0);
			//expect(uint32).toEqual(0xFFFF0000);
			// jasmine test the value as signed int32
			expect(uint32).toEqual(-65536);
		});

		it("should shift the green value to the third byte", () => {
			const color = new Color(0, 255, 0);
			const uint32 = color.toUint32(1.0);
			//expect(uint32).toEqual(0xFF00FF00);
			// jasmine test the value as signed int32
			expect(uint32).toEqual(-16711936);
		});

		it("should leave the blue value in the fourth byte", () => {
			const color = new Color(0, 0, 255);
			const uint32 = color.toUint32(1.0);
			//expect(uint32).toEqual(0xFF0000FF);
			// jasmine test the value as signed int32
			expect(uint32).toEqual(-16776961);
		});
	});

	describe("color clone function", () => {
		it("cloned color hex value is #2060FF", () => {
			const _color = new Color().parseHex("#2060FF");
			const clone = _color.clone();
			expect(clone.r).toEqual(32);
			expect(clone.g).toEqual(96);
			expect(clone.b).toEqual(255);
		});
	});

	describe("color copy function", () => {
		it("copied color hex value is #8040FF", () => {
			const _color = new Color().parseHex("#8040FF");
			const copy = new Color().copy(_color);
			expect(copy.toHex()).toEqual("#8040FF");
		});
	});
});
