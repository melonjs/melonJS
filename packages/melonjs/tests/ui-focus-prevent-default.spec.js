import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	input,
	UIBaseElement,
	UITextButton,
	video,
} from "../src/index.js";

// The keys the UI uses do not scroll the page around the game.
//
// melonJS stopped the browser's own action only for keys bound with
// `input.bindKey`. The UI's keyboard focus reads the arrow keys, Enter and
// Space without binding them, so in a game embedded in a page that scrolls
// (a game portal's frame), an arrow key moved the focus and scrolled the
// page at the same time.

let app;
const added = [];

/** a key press from the browser; returns whether its default was stopped */
const keyDown = (keyCode) => {
	const e = new KeyboardEvent("keydown", { keyCode, cancelable: true });
	globalThis.dispatchEvent(e);
	globalThis.dispatchEvent(new KeyboardEvent("keyup", { keyCode }));
	return e.defaultPrevented;
};

const place = (widget) => {
	app.world.addChild(widget);
	added.push(widget);
	app.world.broadphase.clear();
	app.world.broadphase.insertContainer(app.world);
	return widget;
};

const button = (y, settings = {}) => {
	return place(
		new UITextButton(50, y, {
			text: "Button",
			width: 100,
			height: 40,
			...settings,
		}),
	);
};

describe("UI: the keys the focus and the buttons use", () => {
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterEach(() => {
		UIBaseElement.focusOwner?.blur();
		for (const widget of added.splice(0)) {
			widget.ancestor?.removeChildNow(widget);
		}
		input.unbindKey(input.KEY.DOWN);
		input.setPreventDefault(true);
		vi.restoreAllMocks();
	});

	it("an arrow key that moves the focus does not scroll the page", () => {
		const top = button(100);
		const bottom = button(200);
		top.focus();
		expect(keyDown(input.KEY.DOWN)).toBe(true);
		expect(UIBaseElement.focusOwner).toBe(bottom);
	});

	it("nor does one at the last widget that way, where the focus stays", () => {
		const only = button(100);
		only.focus();
		for (const key of [
			input.KEY.UP,
			input.KEY.DOWN,
			input.KEY.LEFT,
			input.KEY.RIGHT,
		]) {
			expect(keyDown(key)).toBe(true);
		}
		expect(UIBaseElement.focusOwner).toBe(only);
	});

	it("Enter and Space pressing the focused button do not scroll the page", () => {
		const onClick = vi.fn();
		button(100, { onClick }).focus();
		expect(keyDown(input.KEY.ENTER)).toBe(true);
		expect(keyDown(input.KEY.SPACE)).toBe(true);
		expect(onClick).toHaveBeenCalledTimes(2);
	});

	it("with nothing focused, the arrow keys and Space are left to the page", () => {
		button(100);
		button(200);
		expect(keyDown(input.KEY.DOWN)).toBe(false);
		expect(keyDown(input.KEY.SPACE)).toBe(false);
	});

	it("a focused button that is disabled leaves Enter to the page", () => {
		const off = button(100);
		off.focus();
		off.enabled = false;
		expect(keyDown(input.KEY.ENTER)).toBe(false);
	});

	it("a button's own key shortcut does not scroll the page", () => {
		const onClick = vi.fn();
		button(100, { bindKey: input.KEY.SPACE, onClick });
		expect(keyDown(input.KEY.SPACE)).toBe(true);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("a key the game bound follows its own binding's preventDefault", () => {
		input.bindKey(input.KEY.DOWN, "down", false, false);
		const top = button(100);
		const bottom = button(200);
		top.focus();
		expect(keyDown(input.KEY.DOWN)).toBe(false);
		// still the focus's to use
		expect(UIBaseElement.focusOwner).toBe(bottom);
	});

	it("nothing is stopped with input.setPreventDefault(false)", () => {
		input.setPreventDefault(false);
		const top = button(100);
		button(200);
		top.focus();
		expect(keyDown(input.KEY.DOWN)).toBe(false);
		expect(keyDown(input.KEY.ENTER)).toBe(false);
	});
});
