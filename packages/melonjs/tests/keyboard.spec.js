import { beforeEach, describe, expect, it } from "vitest";
import { input } from "../src/index.js";

describe("Keyboard Input", () => {
	beforeEach(() => {
		// clean up any previous bindings
		input.unbindKey(input.KEY.LEFT);
		input.unbindKey(input.KEY.RIGHT);
		input.unbindKey(input.KEY.UP);
		input.unbindKey(input.KEY.SPACE);
		input.unbindKey(input.KEY.X);
	});

	describe("bindKey() / unbindKey()", () => {
		it("should bind a key to an action", () => {
			input.bindKey(input.KEY.LEFT, "left");
			expect(input.getBindingKey(input.KEY.LEFT)).toEqual("left");
		});

		it("should bind multiple keys to different actions", () => {
			input.bindKey(input.KEY.LEFT, "left");
			input.bindKey(input.KEY.RIGHT, "right");
			expect(input.getBindingKey(input.KEY.LEFT)).toEqual("left");
			expect(input.getBindingKey(input.KEY.RIGHT)).toEqual("right");
		});

		it("should unbind a key", () => {
			input.bindKey(input.KEY.LEFT, "left");
			input.unbindKey(input.KEY.LEFT);
			expect(input.getBindingKey(input.KEY.LEFT)).toBeUndefined();
		});

		it("should allow rebinding a key to a different action", () => {
			input.bindKey(input.KEY.SPACE, "jump");
			expect(input.getBindingKey(input.KEY.SPACE)).toEqual("jump");
			input.bindKey(input.KEY.SPACE, "shoot");
			expect(input.getBindingKey(input.KEY.SPACE)).toEqual("shoot");
		});
	});

	describe("getBindingKey()", () => {
		it("should return the action for a bound key", () => {
			input.bindKey(input.KEY.UP, "up");
			expect(input.getBindingKey(input.KEY.UP)).toEqual("up");
		});

		it("should return undefined for an unbound key", () => {
			expect(input.getBindingKey(input.KEY.DOWN)).toBeUndefined();
		});
	});

	describe("triggerKeyEvent()", () => {
		it("should simulate a key down event", () => {
			input.bindKey(input.KEY.LEFT, "left");
			input.triggerKeyEvent(input.KEY.LEFT, true);
			expect(input.keyStatus("left")).toEqual(true);
			// release the key
			input.triggerKeyEvent(input.KEY.LEFT, false);
		});

		it("should simulate a key up event", () => {
			input.bindKey(input.KEY.LEFT, "left");
			input.triggerKeyEvent(input.KEY.LEFT, true);
			input.triggerKeyEvent(input.KEY.LEFT, false);
			expect(input.keyStatus("left")).toEqual(false);
		});
	});

	describe("isKeyPressed() / keyStatus()", () => {
		it("keyStatus() should return false when key is not pressed", () => {
			input.bindKey(input.KEY.RIGHT, "right");
			expect(input.keyStatus("right")).toEqual(false);
		});

		it("keyStatus() should return true when key is pressed", () => {
			input.bindKey(input.KEY.RIGHT, "right");
			input.triggerKeyEvent(input.KEY.RIGHT, true);
			expect(input.keyStatus("right")).toEqual(true);
			input.triggerKeyEvent(input.KEY.RIGHT, false);
		});

		it("isKeyPressed() should return true when key is pressed", () => {
			input.bindKey(input.KEY.RIGHT, "right");
			input.triggerKeyEvent(input.KEY.RIGHT, true);
			expect(input.isKeyPressed("right")).toEqual(true);
			input.triggerKeyEvent(input.KEY.RIGHT, false);
		});

		it("isKeyPressed() with lock should only return true once", () => {
			input.bindKey(input.KEY.X, "jump", true);
			input.triggerKeyEvent(input.KEY.X, true);
			// first call should return true and lock the key
			expect(input.isKeyPressed("jump")).toEqual(true);
			// second call should return false because the key is locked
			expect(input.isKeyPressed("jump")).toEqual(false);
			input.triggerKeyEvent(input.KEY.X, false);
		});
	});

	describe("unlockKey()", () => {
		it("should unlock a previously locked key", () => {
			input.bindKey(input.KEY.X, "jump", true);
			input.triggerKeyEvent(input.KEY.X, true);
			// consume the press (locks the key)
			expect(input.isKeyPressed("jump")).toEqual(true);
			// key is now locked
			expect(input.isKeyPressed("jump")).toEqual(false);
			// unlock it
			input.unlockKey("jump");
			// should be readable again
			expect(input.isKeyPressed("jump")).toEqual(true);
			input.triggerKeyEvent(input.KEY.X, false);
		});
	});
});
