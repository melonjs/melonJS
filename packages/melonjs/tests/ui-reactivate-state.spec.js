import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	event,
	input,
	Renderable,
	UIBaseElement,
	UICheckbox,
	UIPanel,
	UISlider,
	UITextButton,
	video,
} from "../src/index.js";

// A widget taken out of the scene and put back later (a menu closed and
// opened again, kept alive) must come back at rest.
//
// Removed, a widget hears nothing more from the pointer: the dispatcher
// forgets it, so neither the leave of a hover nor the pointer-up of a press
// ever reaches it. `onDeactivateEvent` used to release the handlers and
// leave `hover` and `released` as they were. A button removed while hovered
// came back drawn lit (and grown by `hoverScale`) with no pointer near it;
// one removed mid-press came back `released === false`, drawn held, and its
// `bindKey` and Enter / A with the focus did nothing, as both wait for
// `released`. A press is now called off on removal, through `onCancel`,
// exactly once, and the hover is dropped.

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

/** take a widget out of the world, keeping it alive */
const remove = (widget) => {
	app.world.removeChildNow(widget, true);
	syncBroadphase();
};

/** and put it back */
const readd = (widget) => {
	app.world.addChild(widget);
	syncBroadphase();
};

const key = (code, up = false) => {
	event.emit(up ? event.KEYUP : event.KEYDOWN, undefined, code);
};

const press = (code) => {
	key(code);
	key(code, true);
};

/** a few frames, for the bounce to ease */
const frames = (widget, n = 60) => {
	for (let i = 0; i < n; i++) {
		widget.update(16);
	}
};

/** the scale the bounce draws the widget at now */
const drawnScale = (widget) => {
	const scale = vi.spyOn(app.renderer, "scale");
	widget.preDraw(app.renderer);
	widget.postDraw(app.renderer);
	const s = scale.mock.calls.length > 0 ? scale.mock.calls[0][0] : 1;
	scale.mockRestore();
	return s;
};

/** a widget of each kind, its pressable point, in screen pixels */
const kinds = {
	UITextButton: () => {
		return new UITextButton(50, 50, {
			text: "Go",
			width: 100,
			height: 40,
			hoverScale: 1.2,
			pressScale: 0.8,
		});
	},
	UICheckbox: () => {
		const box = new UICheckbox(50, 50, { label: "Sound" });
		box.hoverScale = 1.2;
		box.pressScale = 0.8;
		return box;
	},
	UISlider: () => {
		return new UISlider(50, 50, { length: 200 });
	},
	UIPanel: () => {
		return new UIPanel(50, 50, {
			width: 120,
			height: 80,
			draggable: true,
			hoverScale: 1.2,
			pressScale: 0.8,
		});
	},
	UIBaseElement: () => {
		const el = new UIBaseElement(50, 50, 100, 40);
		el.isHoldable = true;
		el.hoverScale = 1.2;
		el.pressScale = 0.8;
		return el;
	},
};

/** a point the widget takes a press at: the slider's track, else the middle */
const spot = (widget) => {
	const b = widget.getBounds();
	if (widget instanceof UISlider) {
		return [b.left + 50, b.top + b.height / 2];
	}
	return [b.left + 10, b.top + 10];
};

describe("UI: a widget removed and added back starts at rest", () => {
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
		pointer("pointermove", 790, 590);
		for (const widget of added.splice(0)) {
			if (widget.ancestor) {
				widget.ancestor.removeChildNow(widget);
			}
		}
		pointer("pointerup", 790, 590);
		syncBroadphase();
		vi.restoreAllMocks();
	});

	for (const [name, make] of Object.entries(kinds)) {
		describe(name, () => {
			it("removed while hovered, it is not hovered nor grown when added back", () => {
				const w = place(make());
				const [x, y] = spot(w);
				pointer("pointermove", x, y);
				expect(w.hover).toBe(true);
				frames(w);
				if (w.hoverScale !== 1) {
					expect(drawnScale(w)).toBeCloseTo(w.hoverScale, 2);
				}
				remove(w);
				// the pointer leaves while it is out: no leave can reach it
				pointer("pointermove", 600, 500);
				expect(w.hover).toBe(false);
				readd(w);
				pointer("pointermove", 610, 500);
				expect(w.hover).toBe(false);
				// drawn at rest straight away, not shrinking back from hover
				expect(drawnScale(w)).toBe(1);
				// and the pointer coming back over it lights it again
				pointer("pointermove", x, y);
				expect(w.hover).toBe(true);
			});

			it("removed mid-press, it comes back up, with onCancel once and no onRelease", () => {
				const w = place(make());
				const onCancel = vi.spyOn(w, "onCancel");
				const onRelease = vi.spyOn(w, "onRelease");
				const [x, y] = spot(w);
				pointer("pointermove", x, y);
				pointer("pointerdown", x, y);
				expect(w.released).toBe(false);
				frames(w);
				if (w.pressScale !== 1) {
					expect(drawnScale(w)).toBeCloseTo(w.pressScale, 2);
				}
				remove(w);
				expect(w.released).toBe(true);
				expect(onCancel).toHaveBeenCalledTimes(1);
				// the pointer-up comes while it is out of the scene
				pointer("pointerup", x, y);
				pointer("pointermove", 600, 500);
				readd(w);
				expect(w.released).toBe(true);
				expect(drawnScale(w)).toBe(1);
				expect(onCancel).toHaveBeenCalledTimes(1);
				expect(onRelease).not.toHaveBeenCalled();
				if (w instanceof UISlider) {
					expect(w.dragging).toBe(false);
				}
				// removed again, at rest: nothing more to call off
				remove(w);
				expect(onCancel).toHaveBeenCalledTimes(1);
				readd(w);
			});

			it("removed mid-press, the focus presses it once added back", () => {
				const w = place(make());
				w.focusable = true;
				const onClick = vi.spyOn(w, "onClick");
				const onRelease = vi.spyOn(w, "onRelease");
				const [x, y] = spot(w);
				pointer("pointermove", x, y);
				pointer("pointerdown", x, y);
				remove(w);
				pointer("pointerup", x, y);
				pointer("pointermove", 600, 500);
				readd(w);
				onClick.mockClear();
				w.focus();
				press(input.KEY.ENTER);
				expect(onClick).toHaveBeenCalledTimes(1);
				expect(onRelease).toHaveBeenCalledTimes(1);
				expect(w.released).toBe(true);
			});
		});
	}

	it("a button removed mid-press clicks with its bindKey once added back", () => {
		const onClick = vi.fn();
		const btn = place(
			new UITextButton(50, 50, {
				text: "Go",
				width: 100,
				height: 40,
				bindKey: input.KEY.G,
				onClick,
			}),
		);
		pointer("pointermove", 75, 70);
		pointer("pointerdown", 75, 70);
		// removed on the press, as a subclass's onClick() closing its menu
		remove(btn);
		pointer("pointerup", 75, 70);
		pointer("pointermove", 400, 400);
		readd(btn);
		// the press removed was not a click
		expect(onClick).not.toHaveBeenCalled();
		press(input.KEY.G);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("a button whose bindKey is held when removed calls onCancel once", () => {
		const onClick = vi.fn();
		const btn = place(
			new UITextButton(50, 50, {
				text: "Go",
				width: 100,
				height: 40,
				bindKey: input.KEY.G,
				onClick,
			}),
		);
		const onCancel = vi.spyOn(btn, "onCancel");
		key(input.KEY.G);
		expect(btn.released).toBe(false);
		remove(btn);
		key(input.KEY.G, true);
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onClick).not.toHaveBeenCalled();
		readd(btn);
		press(input.KEY.G);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("a widget held by Enter with the focus when removed calls onCancel once", () => {
		const onClick = vi.fn();
		const btn = place(
			new UITextButton(50, 50, { text: "Go", width: 100, height: 40, onClick }),
		);
		const onCancel = vi.spyOn(btn, "onCancel");
		btn.focus();
		key(input.KEY.ENTER);
		expect(btn.released).toBe(false);
		remove(btn);
		key(input.KEY.ENTER, true);
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onClick).not.toHaveBeenCalled();
		expect(btn.released).toBe(true);
	});

	it("a button inside a panel removed mid-press comes back up with the panel", () => {
		const panel = place(new UIPanel(50, 50, { width: 200, height: 120 }));
		const btn = panel.addChild(
			new UITextButton(20, 20, { text: "Go", width: 100, height: 40 }),
		);
		syncBroadphase();
		const onCancel = vi.spyOn(btn, "onCancel");
		const b = btn.getBounds();
		pointer("pointermove", b.left + 10, b.top + 10);
		pointer("pointerdown", b.left + 10, b.top + 10);
		expect(btn.hover).toBe(true);
		expect(btn.released).toBe(false);
		remove(panel);
		expect(btn.released).toBe(true);
		expect(btn.hover).toBe(false);
		expect(panel.hover).toBe(false);
		expect(onCancel).toHaveBeenCalledTimes(1);
		pointer("pointerup", b.left + 10, b.top + 10);
		readd(panel);
		expect(btn.released).toBe(true);
	});

	it("a button removed by its own press still keeps the press from what is behind", () => {
		const behind = vi.fn();
		const under = new Renderable(0, 0, 800, 600);
		under.isKinematic = false;
		under.depth = -10;
		place(under);
		input.registerPointerEvent("pointerdown", under, behind);
		input.registerPointerEvent("pointerup", under, behind);
		try {
			class Closer extends UITextButton {
				onClick() {
					app.world.removeChildNow(this, true);
					return false;
				}
			}
			const btn = place(
				new Closer(100, 100, { text: "Close", width: 80, height: 40 }),
			);
			const onCancel = vi.spyOn(btn, "onCancel");
			pointer("pointermove", 120, 120);
			pointer("pointerdown", 120, 120);
			expect(btn.ancestor).toBeUndefined();
			expect(onCancel).toHaveBeenCalledTimes(1);
			expect(behind).not.toHaveBeenCalled();
		} finally {
			input.releasePointerEvent("pointerdown", under);
			input.releasePointerEvent("pointerup", under);
		}
	});
});
