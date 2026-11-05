import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	event,
	input,
	UIBaseElement,
	UISlider,
	video,
} from "../src/index.js";

// A UISlider's pointer press ends through onRelease or onCancel, once.
//
// UIBaseElement promises that a press (onClick) ends in exactly one of
// onRelease (let go) or onCancel (called off). The slider ends its drags
// itself, and its `endDrag` set `released` without calling onRelease, so a
// drag by the pointer never got one; and `cancelPress` ended the drag (which
// set `released`) before the base class's `cancelPress`, which then found
// the slider already up and skipped onCancel. Only the keyboard path, which
// goes through the base class, kept the promise.

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

/** a slider that records the order of its callbacks */
const probe = (settings = {}) => {
	const calls = [];
	const s = new UISlider(100, 100, {
		length: 200,
		...settings,
		onChangeEnd: () => {
			calls.push("onChangeEnd");
		},
	});
	s.onClick = (e) => {
		calls.push(e === undefined ? "onClick()" : "onClick(pointer)");
		return false;
	};
	s.onRelease = (e) => {
		calls.push(e === undefined ? "onRelease()" : "onRelease(pointer)");
		return false;
	};
	s.onCancel = () => {
		calls.push("onCancel");
	};
	place(s);
	const b = s.getBounds();
	const y = b.top + b.height / 2;
	return { s, calls, x: b.left, y };
};

describe("UISlider: a press ends through onRelease or onCancel", () => {
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
		pointer("pointerup", 790, 590);
		for (const widget of added.splice(0)) {
			if (widget.ancestor) {
				widget.ancestor.removeChildNow(widget);
			}
		}
		syncBroadphase();
		vi.restoreAllMocks();
	});

	it("a drag let go over the slider: onClick, then onRelease with the event, then onChangeEnd", () => {
		const { s, calls, x, y } = probe();
		pointer("pointermove", x + 50, y);
		pointer("pointerdown", x + 50, y);
		pointer("pointermove", x + 120, y);
		pointer("pointerup", x + 120, y);
		expect(s.dragging).toBe(false);
		expect(s.released).toBe(true);
		expect(calls).toEqual([
			"onClick(pointer)",
			"onRelease(pointer)",
			"onChangeEnd",
		]);
	});

	it("a click on the track, which jumps the value there: onRelease, then onChangeEnd", () => {
		const { s, calls, x, y } = probe();
		pointer("pointermove", x + 50, y);
		pointer("pointerdown", x + 50, y);
		calls.length = 0;
		pointer("pointerup", x + 50, y);
		expect(s.released).toBe(true);
		expect(calls).toEqual(["onRelease(pointer)", "onChangeEnd"]);
	});

	it("a drag let go off the canvas: onRelease once", () => {
		const { s, calls, x, y } = probe();
		pointer("pointermove", x + 50, y);
		pointer("pointerdown", x + 50, y);
		// dragged off the slider and off the canvas
		pointer("pointermove", x + 50, y + 300);
		window.dispatchEvent(
			new PointerEvent("pointerup", { pointerId: 1, bubbles: true }),
		);
		expect(s.dragging).toBe(false);
		expect(
			calls.filter((c) => {
				return c.startsWith("onRelease");
			}),
		).toHaveLength(1);
		expect(calls).not.toContain("onCancel");
		// and the engine's own pointer-up, later, adds nothing
		pointer("pointerup", x + 50, y);
		expect(
			calls.filter((c) => {
				return c.startsWith("onRelease");
			}),
		).toHaveLength(1);
	});

	it("a drag the browser cancels ends through onRelease, as on any widget", () => {
		const { calls, x, y } = probe();
		pointer("pointermove", x + 50, y);
		pointer("pointerdown", x + 50, y);
		pointer("pointermove", x + 120, y);
		window.dispatchEvent(
			new PointerEvent("pointercancel", { pointerId: 1, bubbles: true }),
		);
		expect(
			calls.filter((c) => {
				return c.startsWith("onRelease");
			}),
		).toHaveLength(1);
		expect(calls).not.toContain("onCancel");
	});

	it("leaving the slider mid-drag does not end the press", () => {
		const { s, calls, x, y } = probe();
		pointer("pointermove", x + 50, y);
		pointer("pointerdown", x + 50, y);
		pointer("pointermove", x + 50, y + 200);
		expect(s.dragging).toBe(true);
		expect(s.released).toBe(false);
		expect(calls).toEqual(["onClick(pointer)"]);
	});

	const callOffs = {
		"cancelPress()": (s) => {
			s.cancelPress();
		},
		"enabled = false": (s) => {
			s.enabled = false;
		},
		"removing it": (s) => {
			app.world.removeChildNow(s, true);
			syncBroadphase();
		},
	};

	for (const [how, callOff] of Object.entries(callOffs)) {
		it(`a drag called off by ${how}: onCancel once, no onRelease, no onChangeEnd`, () => {
			const { s, calls, x, y } = probe();
			pointer("pointermove", x + 50, y);
			pointer("pointerdown", x + 50, y);
			pointer("pointermove", x + 120, y);
			calls.length = 0;
			callOff(s);
			expect(s.dragging).toBe(false);
			expect(s.released).toBe(true);
			expect(calls).toEqual(["onCancel"]);
			// the pointer-up that follows does nothing more
			pointer("pointerup", x + 120, y);
			window.dispatchEvent(
				new PointerEvent("pointerup", { pointerId: 1, bubbles: true }),
			);
			// nor does calling it off again
			s.cancelPress();
			expect(calls).toEqual(["onCancel"]);
		});
	}

	it("Enter with the focus still ends through onRelease", () => {
		const { s, calls } = probe();
		s.focus();
		key(input.KEY.ENTER);
		key(input.KEY.ENTER, true);
		expect(calls).toEqual(["onClick()", "onRelease()"]);
	});

	it("Enter held with the focus and called off: onCancel once", () => {
		const { s, calls } = probe();
		s.focus();
		key(input.KEY.ENTER);
		s.enabled = false;
		key(input.KEY.ENTER, true);
		expect(calls).toEqual(["onClick()", "onCancel"]);
	});

	it("a second drag after a cancelled one ends normally", () => {
		const { s, calls, x, y } = probe();
		pointer("pointermove", x + 50, y);
		pointer("pointerdown", x + 50, y);
		s.cancelPress();
		pointer("pointerup", x + 50, y);
		calls.length = 0;
		pointer("pointerdown", x + 60, y);
		pointer("pointermove", x + 140, y);
		pointer("pointerup", x + 140, y);
		expect(s.dragging).toBe(false);
		expect(calls).toEqual([
			"onClick(pointer)",
			"onRelease(pointer)",
			"onChangeEnd",
		]);
	});
});
