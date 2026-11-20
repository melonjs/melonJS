/**
 * Keys as the browser sends them, and as the engine triggers them itself.
 *
 * A key comes down two ways: pressed on the keyboard, with the browser's
 * event, or triggered by the engine (`input.triggerKeyEvent`, a pointer
 * button bound to a key) with no event at all. Both press the same action;
 * only the first has a default action of the browser to stop.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, event, input } from "../src/index.js";

const KEYS = [input.KEY.LEFT, input.KEY.RIGHT, input.KEY.X, input.KEY.Z];

describe("keyboard events", () => {
	beforeAll(() => {
		// registers the keyboard listeners
		boot();
	});

	afterEach(() => {
		for (const keyCode of KEYS) {
			globalThis.dispatchEvent(new KeyboardEvent("keyup", { keyCode }));
			input.triggerKeyEvent(keyCode, false);
			input.triggerKeyEvent(keyCode, false, 1);
			input.unbindKey(keyCode);
		}
	});

	/** send a key event as the browser does, and hand it back */
	const press = (type, keyCode) => {
		const sent = new KeyboardEvent(type, { keyCode, cancelable: true });
		globalThis.dispatchEvent(sent);
		return sent;
	};

	describe("a key pressed on the keyboard", () => {
		it("presses its action, and lets go of it", () => {
			input.bindKey(input.KEY.LEFT, "left");
			expect(input.keyStatus("left")).toBe(false);
			press("keydown", input.KEY.LEFT);
			expect(input.keyStatus("left")).toBe(true);
			expect(input.isKeyPressed("left")).toBe(true);
			press("keyup", input.KEY.LEFT);
			expect(input.keyStatus("left")).toBe(false);
		});

		it("is told from another key by its code", () => {
			input.bindKey(input.KEY.LEFT, "left");
			input.bindKey(input.KEY.RIGHT, "right");
			press("keydown", input.KEY.RIGHT);
			expect(input.keyStatus("right")).toBe(true);
			expect(input.keyStatus("left")).toBe(false);
		});

		it("held down, counts once however often the browser repeats it", () => {
			input.bindKey(input.KEY.LEFT, "left");
			press("keydown", input.KEY.LEFT);
			press("keydown", input.KEY.LEFT);
			press("keydown", input.KEY.LEFT);
			press("keyup", input.KEY.LEFT);
			expect(input.keyStatus("left")).toBe(false);
		});

		it("tells the KEYDOWN and KEYUP listeners the action and the key", () => {
			input.bindKey(input.KEY.X, "fire");
			const heard = [];
			const down = (action, keyCode) => {
				heard.push(["down", action, keyCode]);
			};
			const up = (action, keyCode) => {
				heard.push(["up", action, keyCode]);
			};
			event.on(event.KEYDOWN, down);
			event.on(event.KEYUP, up);
			try {
				press("keydown", input.KEY.X);
				press("keyup", input.KEY.X);
				// a key with no binding is heard too, with no action
				press("keydown", input.KEY.Z);
			} finally {
				event.off(event.KEYDOWN, down);
				event.off(event.KEYUP, up);
			}
			expect(heard).toEqual([
				["down", "fire", input.KEY.X],
				["up", "fire", input.KEY.X],
				["down", undefined, input.KEY.Z],
			]);
		});
	});

	describe("the browser's own action for the key", () => {
		it("is stopped for a key bound with preventDefault, down and up", () => {
			input.bindKey(input.KEY.LEFT, "left", false, true);
			expect(press("keydown", input.KEY.LEFT).defaultPrevented).toBe(true);
			expect(press("keyup", input.KEY.LEFT).defaultPrevented).toBe(true);
		});

		it("is left alone for a key bound without it", () => {
			input.bindKey(input.KEY.RIGHT, "right", false, false);
			expect(press("keydown", input.KEY.RIGHT).defaultPrevented).toBe(false);
			expect(press("keyup", input.KEY.RIGHT).defaultPrevented).toBe(false);
			// and the action is pressed all the same
			press("keydown", input.KEY.RIGHT);
			expect(input.keyStatus("right")).toBe(true);
		});

		it("is left alone for a key with no binding", () => {
			expect(press("keydown", input.KEY.Z).defaultPrevented).toBe(false);
			expect(press("keyup", input.KEY.Z).defaultPrevented).toBe(false);
		});

		it("is stopped for a key with no binding when the listener that uses it says so", () => {
			// what a focused text field or button does with a key it takes
			const uses = () => {
				input.preventKeyDefault();
			};
			event.on(event.KEYDOWN, uses);
			try {
				expect(press("keydown", input.KEY.Z).defaultPrevented).toBe(true);
			} finally {
				event.off(event.KEYDOWN, uses);
			}
			// once the key event is over there is nothing left to stop
			expect(() => {
				input.preventKeyDefault();
			}).not.toThrow();
			expect(press("keydown", input.KEY.Z).defaultPrevented).toBe(false);
		});

		it("is not stopped by that for a key the engine triggered: it has no event", () => {
			const uses = () => {
				input.preventKeyDefault();
			};
			event.on(event.KEYDOWN, uses);
			try {
				expect(() => {
					input.triggerKeyEvent(input.KEY.Z, true);
					input.triggerKeyEvent(input.KEY.Z, false);
				}).not.toThrow();
			} finally {
				event.off(event.KEYDOWN, uses);
			}
		});
	});

	describe("a key the engine triggers itself", () => {
		it("presses its action with no browser event, bound with preventDefault or not", () => {
			input.bindKey(input.KEY.X, "fire", false, true);
			expect(() => {
				input.triggerKeyEvent(input.KEY.X, true);
			}).not.toThrow();
			expect(input.keyStatus("fire")).toBe(true);
			expect(() => {
				input.triggerKeyEvent(input.KEY.X, false);
			}).not.toThrow();
			expect(input.keyStatus("fire")).toBe(false);
		});

		it("held by the key and by a pointer button, stays pressed until both let go", () => {
			input.bindKey(input.KEY.X, "fire");
			// the key itself, then a pointer button standing in for it
			press("keydown", input.KEY.X);
			input.triggerKeyEvent(input.KEY.X, true, 1);
			expect(input.keyStatus("fire")).toBe(true);
			press("keyup", input.KEY.X);
			expect(input.keyStatus("fire")).toBe(true);
			input.triggerKeyEvent(input.KEY.X, false, 1);
			expect(input.keyStatus("fire")).toBe(false);
		});

		it("the same button pressed twice counts once", () => {
			input.bindKey(input.KEY.X, "fire");
			input.triggerKeyEvent(input.KEY.X, true, 1);
			input.triggerKeyEvent(input.KEY.X, true, 1);
			input.triggerKeyEvent(input.KEY.X, false, 1);
			expect(input.keyStatus("fire")).toBe(false);
		});

		it("a locked key reads as pressed once, from the keyboard or triggered", () => {
			input.bindKey(input.KEY.X, "fire", true);
			press("keydown", input.KEY.X);
			expect(input.isKeyPressed("fire")).toBe(true);
			expect(input.isKeyPressed("fire")).toBe(false);
			press("keyup", input.KEY.X);
			input.triggerKeyEvent(input.KEY.X, true);
			expect(input.isKeyPressed("fire")).toBe(true);
			expect(input.isKeyPressed("fire")).toBe(false);
		});
	});
});
