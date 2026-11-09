import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, event, input } from "../src/index.js";

/**
 * Keys held when the window loses the focus stayed pressed.
 *
 * Once the window is not focused the browser sends its key events elsewhere,
 * so the release of a key held across an Alt-Tab never arrives: `keyStatus`
 * kept counting it, and the hero kept walking after coming back to the game.
 * The engine already turns the window's `blur` (and a hidden tab) into its own
 * `BLUR` event; nothing in the input code listened to it.
 *
 * A gamepad is the exception: it is polled every frame and lets go of its own
 * presses, so what it holds is left to it.
 */
describe("keys held when the window loses the focus", () => {
	beforeAll(() => {
		// registers the keyboard and the window focus listeners
		boot();
	});

	afterEach(() => {
		for (const key of [input.KEY.LEFT, input.KEY.RIGHT, input.KEY.D]) {
			globalThis.dispatchEvent(new KeyboardEvent("keyup", { keyCode: key }));
		}
		input.unbindKey(input.KEY.LEFT);
		input.unbindKey(input.KEY.RIGHT);
		input.unbindKey(input.KEY.D);
		input.unbindKey(input.KEY.X);
	});

	const key = (type, keyCode) => {
		globalThis.dispatchEvent(new KeyboardEvent(type, { keyCode }));
	};
	const blur = () => {
		globalThis.dispatchEvent(new Event("blur"));
	};
	const focus = () => {
		globalThis.dispatchEvent(new Event("focus"));
	};

	it("releases a key held when the window is blurred", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		key("keydown", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(true);

		// Alt-Tab: the keyup goes to another window
		blur();
		expect(input.keyStatus("right")).toBe(false);
		expect(input.isKeyPressed("right")).toBe(false);
	});

	it("releases them on the engine's BLUR event too (a hidden tab)", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		key("keydown", input.KEY.RIGHT);
		event.emit(event.BLUR);
		expect(input.keyStatus("right")).toBe(false);
	});

	it("releases every key bound to an action, and every action", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.LEFT, "left");
		key("keydown", input.KEY.RIGHT);
		key("keydown", input.KEY.D);
		key("keydown", input.KEY.LEFT);
		blur();
		expect(input.keyStatus("right")).toBe(false);
		expect(input.keyStatus("left")).toBe(false);

		// and pressing one again after coming back counts once
		focus();
		key("keydown", input.KEY.D);
		expect(input.keyStatus("right")).toBe(true);
		key("keyup", input.KEY.D);
		expect(input.keyStatus("right")).toBe(false);
	});

	it("unlocks a locked key, so it fires again on the next press", () => {
		input.bindKey(input.KEY.X, "jump", true);
		key("keydown", input.KEY.X);
		expect(input.isKeyPressed("jump")).toBe(true);
		// read once: locked until the key is released
		expect(input.isKeyPressed("jump")).toBe(false);

		blur();
		focus();
		key("keydown", input.KEY.X);
		expect(input.isKeyPressed("jump")).toBe(true);
		expect(input.isKeyPressed("jump")).toBe(false);
		key("keyup", input.KEY.X);
	});

	it("releases a key pressed through a bound mouse button", () => {
		input.bindKey(input.KEY.X, "fire");
		// how bindPointer presses it: the button as the source
		input.triggerKeyEvent(input.KEY.X, true, 1);
		expect(input.keyStatus("fire")).toBe(true);
		blur();
		expect(input.keyStatus("fire")).toBe(false);
	});

	// ---- what must keep working --------------------------------------------

	it("a key still held when the focus returns is pressed again by its keydown", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		key("keydown", input.KEY.RIGHT);
		blur();
		focus();
		// the key repeats once the window has the focus again
		key("keydown", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(true);
		expect(input.isKeyPressed("right")).toBe(true);
		key("keyup", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(false);
	});

	it("a keyup arriving after the blur does not unbalance the count", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		key("keydown", input.KEY.RIGHT);
		blur();
		key("keyup", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(false);
		key("keydown", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(true);
		key("keyup", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(false);
	});

	it("leaves a key held by a gamepad to the gamepad", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		// how the gamepad poll presses it: its button as a source of 256 and up
		input.triggerKeyEvent(input.KEY.RIGHT, true, 256 + 15);
		blur();
		// still held: the poll sees the pad and lets go when the button does
		expect(input.keyStatus("right")).toBe(true);
		input.triggerKeyEvent(input.KEY.RIGHT, false, 256 + 15);
		expect(input.keyStatus("right")).toBe(false);
	});

	it("keeps the gamepad's lock on an action it still holds", () => {
		input.bindKey(input.KEY.X, "jump", true);
		input.triggerKeyEvent(input.KEY.X, true, 256);
		expect(input.isKeyPressed("jump")).toBe(true);
		blur();
		// the same press must not read as a second jump
		expect(input.isKeyPressed("jump")).toBe(false);
		input.triggerKeyEvent(input.KEY.X, false, 256);
	});

	it("releases the keyboard's press and keeps the gamepad's, on one action", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		key("keydown", input.KEY.RIGHT);
		input.triggerKeyEvent(input.KEY.RIGHT, true, 256 + 15);
		blur();
		expect(input.keyStatus("right")).toBe(true);
		input.triggerKeyEvent(input.KEY.RIGHT, false, 256 + 15);
		expect(input.keyStatus("right")).toBe(false);
	});

	it("does not change a normal press and release", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.X, "jump", true);
		key("keydown", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(true);
		key("keyup", input.KEY.RIGHT);
		expect(input.keyStatus("right")).toBe(false);

		key("keydown", input.KEY.X);
		expect(input.isKeyPressed("jump")).toBe(true);
		expect(input.isKeyPressed("jump")).toBe(false);
		key("keyup", input.KEY.X);
		key("keydown", input.KEY.X);
		expect(input.isKeyPressed("jump")).toBe(true);
		key("keyup", input.KEY.X);
	});

	it("a focus without a blur leaves the held keys alone", () => {
		input.bindKey(input.KEY.RIGHT, "right");
		key("keydown", input.KEY.RIGHT);
		focus();
		expect(input.keyStatus("right")).toBe(true);
	});
});
