import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	event,
	input,
	UIBaseElement,
	UICheckbox,
	UISlider,
	UITextButton,
	video,
} from "../src/index.js";

// Enter or Space held on the focused widget while the window loses focus.
//
// The key-up then goes to another window. A button's `bindKey` listens to
// BLUR and calls its press off (onCancel, no click), but the focus did not:
// after an alt-tab with Enter held, the focused widget stayed down, every
// pad A was refused (one accept at a time) until an Enter key-up came along,
// and that key-up then completed the stale press as a click. The focus now
// calls the press off on BLUR too.

let app;
const added = [];

const syncBroadphase = () => {
	app.world.broadphase.clear();
	app.world.broadphase.insertContainer(app.world);
};

const place = (widget) => {
	app.world.addChild(widget);
	added.push(widget);
	syncBroadphase();
	return widget;
};

const key = (code, up = false) => {
	event.emit(up ? event.KEYUP : event.KEYDOWN, undefined, code);
};

/** a virtual pad, driven a frame at a time */
const makePad = () => {
	const buttons = [];
	for (let i = 0; i < 17; i++) {
		buttons.push({ pressed: false, value: 0 });
	}
	const pad = { id: "blur pad", buttons, axes: [0, 0, 0, 0] };
	input.addVirtualGamepad(pad, 0);
	let t = 1000;
	const frame = () => {
		t += 16;
		event.emit(event.GAME_BEFORE_UPDATE, t);
	};
	const a = (down) => {
		buttons[input.GAMEPAD.BUTTONS.FACE_1].pressed = down;
		frame();
	};
	return {
		frame,
		a,
		remove: () => {
			input.removeVirtualGamepad(pad);
		},
	};
};

/** the focusable widgets, and what a completed accept does on each */
const kinds = {
	UITextButton: () => {
		const done = vi.fn();
		const w = new UITextButton(50, 50, {
			text: "Fire",
			width: 100,
			height: 40,
			onClick: done,
		});
		return { w, done };
	},
	UICheckbox: () => {
		const done = vi.fn();
		const w = new UICheckbox(50, 50, { label: "Sound", onChange: done });
		return { w, done };
	},
	UISlider: () => {
		const w = new UISlider(50, 50, { length: 200 });
		const done = vi.spyOn(w, "onRelease");
		return { w, done };
	},
};

describe("UI: an accept held through the window losing focus", () => {
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
			if (widget.ancestor) {
				widget.ancestor.removeChildNow(widget);
			}
		}
		vi.restoreAllMocks();
	});

	for (const [kind, make] of Object.entries(kinds)) {
		describe(kind, () => {
			it("Enter held is called off by BLUR: onCancel once, no release, no click", () => {
				const { w, done } = make();
				place(w);
				const onCancel = vi.spyOn(w, "onCancel");
				const onRelease = vi.spyOn(w, "onRelease");
				w.focus();
				key(input.KEY.ENTER);
				expect(w.released).toBe(false);
				event.emit(event.BLUR);
				expect(w.released).toBe(true);
				expect(onCancel).toHaveBeenCalledTimes(1);
				// the key-up, if it ever comes, completes nothing
				key(input.KEY.ENTER, true);
				expect(onRelease).not.toHaveBeenCalled();
				expect(done).not.toHaveBeenCalled();
				expect(onCancel).toHaveBeenCalledTimes(1);
				// and the focus stays where it was
				expect(UIBaseElement.focusOwner).toBe(w);
			});

			it("after an Enter held through BLUR, the pad's A presses it", () => {
				const { w, done } = make();
				place(w);
				const pad = makePad();
				try {
					w.focus();
					key(input.KEY.ENTER);
					event.emit(event.BLUR);
					pad.frame();
					pad.a(true);
					pad.a(false);
					expect(done).toHaveBeenCalledTimes(1);
				} finally {
					pad.remove();
				}
			});

			it("A held through BLUR is called off, and its release does nothing", () => {
				const { w, done } = make();
				place(w);
				const onCancel = vi.spyOn(w, "onCancel");
				const pad = makePad();
				try {
					w.focus();
					pad.frame();
					pad.a(true);
					expect(w.released).toBe(false);
					event.emit(event.BLUR);
					expect(w.released).toBe(true);
					expect(onCancel).toHaveBeenCalledTimes(1);
					pad.a(false);
					expect(done).not.toHaveBeenCalled();
					// Enter works again straight away
					key(input.KEY.ENTER);
					key(input.KEY.ENTER, true);
					expect(done).toHaveBeenCalledTimes(1);
				} finally {
					pad.remove();
				}
			});
		});
	}

	it("BLUR with nothing held leaves the focused widget alone", () => {
		const { w } = kinds.UITextButton();
		place(w);
		const onCancel = vi.spyOn(w, "onCancel");
		w.focus();
		event.emit(event.BLUR);
		expect(onCancel).not.toHaveBeenCalled();
		expect(w.released).toBe(true);
	});

	it("once nothing has the focus, BLUR no longer reaches the focus", () => {
		const { w } = kinds.UITextButton();
		place(w);
		w.focus();
		w.blur();
		const onCancel = vi.spyOn(w, "onCancel");
		// a press from the pointer side, which BLUR is not about
		w.released = false;
		event.emit(event.BLUR);
		expect(onCancel).not.toHaveBeenCalled();
		w.released = true;
	});
});
