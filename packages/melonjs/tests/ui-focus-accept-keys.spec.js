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
import { ringVisible } from "../src/renderable/ui/uifocus.ts";

// One Enter press, one click.
//
// A button's `bindKey` yielded Enter and Space to the focused widget only
// while the focus ring showed, but the focus pressed the focused widget
// whether the ring showed or not. Once the mouse had moved (the ring hidden,
// the focus kept), one Enter clicked both an OK bound to Enter and the
// focused Cancel, and which went first depended on the order the listeners
// were added in. The rule is now one, on both sides: while another widget has
// the focus and can take a press, the accept keys are its.

let app;
const added = [];

const at = (gameX, gameY) => {
	const canvas = app.renderer.getCanvas();
	const rect = canvas.getBoundingClientRect();
	return {
		clientX: rect.left + (gameX * rect.width) / canvas.width,
		clientY: rect.top + (gameY * rect.height) / canvas.height,
	};
};

const pointer = (type, gameX, gameY, pointerId = 1) => {
	app.renderer.getCanvas().dispatchEvent(
		new PointerEvent(type, {
			...at(gameX, gameY),
			pointerId,
			width: 1,
			height: 1,
			isPrimary: true,
			bubbles: true,
		}),
	);
};

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

const press = (code) => {
	key(code);
	key(code, true);
};

/** an OK button clicked by a key */
const okButton = (onClick, bindKey = input.KEY.ENTER) => {
	return new UITextButton(50, 50, {
		text: "OK",
		width: 100,
		height: 40,
		bindKey,
		onClick,
	});
};

/** the widget that takes the focus, of each kind, and how to see it pressed */
const focusKinds = {
	UITextButton: () => {
		const onClick = vi.fn();
		const w = new UITextButton(50, 150, {
			text: "Cancel",
			width: 100,
			height: 40,
			onClick,
		});
		return { w, clicks: onClick };
	},
	UICheckbox: () => {
		const onChange = vi.fn();
		const w = new UICheckbox(50, 150, { label: "Sound", onChange });
		return { w, clicks: onChange };
	},
	UISlider: () => {
		const w = new UISlider(50, 150, { length: 200 });
		const clicks = vi.spyOn(w, "onRelease");
		return { w, clicks };
	},
};

/**
 * Both orders the two listeners can be in: the bindKey button added before
 * the focus listens (it hears the key first), or after (the focus hears it
 * first). The focus listens from the first `focus()` until nothing has it.
 */
const orders = {
	"the bindKey button hears the key first": (ok, focused) => {
		place(ok);
		place(focused);
		focused.focus();
	},
	"the focus hears the key first": (ok, focused) => {
		place(focused);
		focused.focus();
		place(ok);
	},
};

describe("UI: Enter and Space with a focused widget and a bindKey button", () => {
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
		syncBroadphase();
		vi.restoreAllMocks();
	});

	for (const [order, setUp] of Object.entries(orders)) {
		describe(order, () => {
			for (const [kind, make] of Object.entries(focusKinds)) {
				for (const keyName of ["ENTER", "SPACE"]) {
					it(`${keyName} with a ${kind} focused and the ring hidden presses only the ${kind}`, () => {
						const ok = vi.fn();
						const { w, clicks } = make();
						setUp(okButton(ok, input.KEY[keyName]), w);
						// the mouse moves: the ring hides, the focus stays
						pointer("pointermove", 700, 500);
						expect(ringVisible()).toBe(false);
						expect(UIBaseElement.focusOwner).toBe(w);
						press(input.KEY[keyName]);
						expect(ok).not.toHaveBeenCalled();
						expect(clicks).toHaveBeenCalledTimes(1);
					});

					it(`${keyName} with a ${kind} focused and the ring shown presses only the ${kind}`, () => {
						const ok = vi.fn();
						const { w, clicks } = make();
						setUp(okButton(ok, input.KEY[keyName]), w);
						expect(ringVisible()).toBe(true);
						press(input.KEY[keyName]);
						expect(ok).not.toHaveBeenCalled();
						expect(clicks).toHaveBeenCalledTimes(1);
					});
				}
			}

			it("a focused button that is disabled leaves Enter to the bindKey", () => {
				const ok = vi.fn();
				const { w, clicks } = focusKinds.UITextButton();
				setUp(okButton(ok), w);
				w.enabled = false;
				pointer("pointermove", 700, 500);
				press(input.KEY.ENTER);
				expect(ok).toHaveBeenCalledTimes(1);
				expect(clicks).not.toHaveBeenCalled();
			});

			it("a focused button that is hidden leaves Enter to the bindKey", () => {
				const ok = vi.fn();
				const { w, clicks } = focusKinds.UITextButton();
				setUp(okButton(ok), w);
				w.isRenderable = false;
				press(input.KEY.ENTER);
				expect(ok).toHaveBeenCalledTimes(1);
				expect(clicks).not.toHaveBeenCalled();
			});

			it("a key other than Enter and Space still goes to its bindKey button", () => {
				const ok = vi.fn();
				const { w, clicks } = focusKinds.UITextButton();
				setUp(okButton(ok, input.KEY.ESC), w);
				pointer("pointermove", 700, 500);
				press(input.KEY.ESC);
				expect(ok).toHaveBeenCalledTimes(1);
				expect(clicks).not.toHaveBeenCalled();
			});
		});
	}

	it("the bindKey button with the focus itself is clicked once", () => {
		const ok = vi.fn();
		const btn = place(okButton(ok));
		btn.focus();
		press(input.KEY.ENTER);
		expect(ok).toHaveBeenCalledTimes(1);
		pointer("pointermove", 700, 500);
		press(input.KEY.ENTER);
		expect(ok).toHaveBeenCalledTimes(2);
	});

	it("with nothing focused, Enter goes to the bindKey button", () => {
		const ok = vi.fn();
		const { w, clicks } = focusKinds.UITextButton();
		place(okButton(ok));
		place(w);
		w.focus();
		w.blur();
		press(input.KEY.ENTER);
		expect(ok).toHaveBeenCalledTimes(1);
		expect(clicks).not.toHaveBeenCalled();
	});

	it("a focused widget that removes itself on the press does not hand the key to the bindKey", () => {
		const ok = vi.fn();
		class Closer extends UITextButton {
			onClick() {
				this.ancestor.removeChildNow(this, true);
				return false;
			}
		}
		const closer = new Closer(50, 150, {
			text: "Close",
			width: 100,
			height: 40,
		});
		// the focus listens first, so it presses before the bindKey hears it
		place(closer);
		closer.focus();
		place(okButton(ok));
		key(input.KEY.ENTER);
		expect(closer.ancestor).toBeUndefined();
		key(input.KEY.ENTER, true);
		expect(ok).not.toHaveBeenCalled();
		// the key press is over: the next one goes to the shortcut
		press(input.KEY.ENTER);
		expect(ok).toHaveBeenCalledTimes(1);
	});

	it("a bindKey press that gives the focus to another widget does not press that one too", () => {
		const other = vi.fn();
		const target = new UITextButton(50, 150, {
			text: "Next",
			width: 100,
			height: 40,
			onClick: other,
		});
		class Opener extends UITextButton {
			onClick() {
				target.focus();
				return false;
			}
		}
		const opener = new Opener(50, 50, {
			text: "Open",
			width: 100,
			height: 40,
			bindKey: input.KEY.ENTER,
		});
		place(opener);
		place(target);
		// the shortcut hears the key, and starts the focus listening during it
		press(input.KEY.ENTER);
		expect(UIBaseElement.focusOwner).toBe(target);
		expect(other).not.toHaveBeenCalled();
		// the next press is the focused button's
		press(input.KEY.ENTER);
		expect(other).toHaveBeenCalledTimes(1);
	});

	it("a key press taken by the focus is let go by the window losing focus", () => {
		const ok = vi.fn();
		const { w, clicks } = focusKinds.UITextButton();
		place(w);
		w.focus();
		place(okButton(ok));
		key(input.KEY.ENTER);
		// alt-tab: the Enter key-up goes to another window
		event.emit(event.BLUR);
		w.blur();
		// the next Enter, with nothing focused, is the shortcut's
		press(input.KEY.ENTER);
		expect(ok).toHaveBeenCalledTimes(1);
		expect(clicks).not.toHaveBeenCalled();
	});
});
