import { describe, expect, it } from "vitest";
import { Bounds, Pointer } from "../src/index.js";

describe("Pointer", () => {
	describe("class existence", () => {
		it("Pointer class should be exported", () => {
			expect(Pointer).toBeDefined();
			expect(typeof Pointer).toBe("function");
		});
	});

	describe("inheritance", () => {
		it("Pointer should extend Bounds", () => {
			const pointer = new Pointer();
			expect(pointer).toBeInstanceOf(Bounds);
		});
	});

	describe("constructor defaults", () => {
		it("should construct with no arguments", () => {
			const pointer = new Pointer();
			expect(pointer).toBeDefined();
		});

		it("should construct with position and size arguments", () => {
			const pointer = new Pointer(10, 20, 5, 5);
			expect(pointer).toBeDefined();
		});

		it("button should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.button).toBe(0);
		});

		it("type should default to empty string", () => {
			const pointer = new Pointer();
			expect(pointer.type).toBe("");
		});

		it("isPrimary should default to false", () => {
			const pointer = new Pointer();
			expect(pointer.isPrimary).toBe(false);
		});

		it("pageX and pageY should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.pageX).toBe(0);
			expect(pointer.pageY).toBe(0);
		});

		it("clientX and clientY should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.clientX).toBe(0);
			expect(pointer.clientY).toBe(0);
		});

		it("gameX and gameY should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.gameX).toBe(0);
			expect(pointer.gameY).toBe(0);
		});

		it("gameScreenX and gameScreenY should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.gameScreenX).toBe(0);
			expect(pointer.gameScreenY).toBe(0);
		});

		it("gameWorldX and gameWorldY should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.gameWorldX).toBe(0);
			expect(pointer.gameWorldY).toBe(0);
		});

		it("gameLocalX and gameLocalY should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.gameLocalX).toBe(0);
			expect(pointer.gameLocalY).toBe(0);
		});

		it("movementX and movementY should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.movementX).toBe(0);
			expect(pointer.movementY).toBe(0);
		});

		it("deltaX, deltaY, deltaZ should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.deltaX).toBe(0);
			expect(pointer.deltaY).toBe(0);
			expect(pointer.deltaZ).toBe(0);
		});

		it("deltaMode should default to 0", () => {
			const pointer = new Pointer();
			expect(pointer.deltaMode).toBe(0);
		});

		it("event should default to undefined", () => {
			const pointer = new Pointer();
			expect(pointer.event).toBeUndefined();
		});

		it("pointerId should default to undefined", () => {
			const pointer = new Pointer();
			expect(pointer.pointerId).toBeUndefined();
		});

		it("isNormalized should default to false", () => {
			const pointer = new Pointer();
			expect(pointer.isNormalized).toBe(false);
		});

		it("locked should default to false", () => {
			const pointer = new Pointer();
			expect(pointer.locked).toBe(false);
		});

		it("bind should be an array of three entries", () => {
			const pointer = new Pointer();
			expect(Array.isArray(pointer.bind)).toBe(true);
			expect(pointer.bind.length).toBe(3);
		});
	});

	describe("mouse button constants", () => {
		it("LEFT constant should be 0", () => {
			const pointer = new Pointer();
			expect(pointer.LEFT).toBe(0);
		});

		it("MIDDLE constant should be 1", () => {
			const pointer = new Pointer();
			expect(pointer.MIDDLE).toBe(1);
		});

		it("RIGHT constant should be 2", () => {
			const pointer = new Pointer();
			expect(pointer.RIGHT).toBe(2);
		});
	});

	describe("bounds initialisation", () => {
		it("should set bounds from constructor arguments", () => {
			const pointer = new Pointer(5, 10, 4, 8);
			// Bounds uses setMinMax(x, y, x+w, y+h)
			expect(pointer.left).toBe(5);
			expect(pointer.top).toBe(10);
			expect(pointer.width).toBe(4);
			expect(pointer.height).toBe(8);
		});

		it("default construction should produce a 1x1 bounds at origin", () => {
			const pointer = new Pointer();
			expect(pointer.width).toBe(1);
			expect(pointer.height).toBe(1);
		});
	});
});
