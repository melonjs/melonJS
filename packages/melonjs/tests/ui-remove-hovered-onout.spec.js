import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	UIBaseElement,
	UIPanel,
	UITextButton,
	video,
} from "../src/index.js";

// A widget removed from the world while the pointer is on it hears nothing
// more from the pointer, so the leave that would call its `onOut` never
// comes. It used to drop its hover silently: whatever its `onOver` had set
// up stayed, a tooltip on screen for good, a hand cursor over nothing. Its
// hover now ends as if the pointer had left, through `onOut`, once, and after
// a press in progress was called off through `onCancel`.

let app;
const added = [];

const pointer = (type, gameX, gameY) => {
	const canvas = app.renderer.getCanvas();
	const rect = canvas.getBoundingClientRect();
	canvas.dispatchEvent(
		new PointerEvent(type, {
			clientX: rect.left + (gameX * rect.width) / canvas.width,
			clientY: rect.top + (gameY * rect.height) / canvas.height,
			pointerId: 1,
			width: 1,
			height: 1,
			isPrimary: true,
			bubbles: true,
		}),
	);
};

const sync = () => {
	app.world.broadphase.clear();
	app.world.broadphase.insertContainer(app.world);
};

/**
 * an inventory slot: shows a tooltip on hover, hides it on out, and logs
 * every callback in order
 */
class Slot extends UITextButton {
	constructor(x, y, tooltip) {
		super(x, y, { text: "Potion", width: 100, height: 40 });
		this.tooltip = tooltip;
		this.calls = [];
	}
	onOver() {
		this.calls.push("over");
		this.tooltip.visible = true;
	}
	onOut(event) {
		this.calls.push(event === undefined ? "out(removed)" : "out");
		this.tooltip.visible = false;
	}
	onCancel() {
		this.calls.push("cancel");
	}
}

const place = (renderable, parent = app.world) => {
	parent.addChild(renderable);
	added.push(renderable);
	sync();
	return renderable;
};

describe("UI: a widget removed while hovered gets its onOut", () => {
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
		for (const r of added.splice(0)) {
			r.ancestor?.removeChildNow(r);
		}
		pointer("pointerup", 790, 590);
		sync();
	});

	it("removed on its own: onOut once, with no event, and the tooltip goes", () => {
		const tooltip = { visible: false };
		const slot = place(new Slot(50, 50, tooltip));
		pointer("pointermove", 60, 60);
		expect(tooltip.visible).toBe(true);
		// the potion is used: its slot goes, the pointer has not moved
		app.world.removeChildNow(slot, true);
		sync();
		expect(tooltip.visible).toBe(false);
		expect(slot.hover).toBe(false);
		expect(slot.calls).toEqual(["over", "out(removed)"]);
		// the pointer then moves on: no second onOut
		pointer("pointermove", 600, 500);
		expect(slot.calls).toEqual(["over", "out(removed)"]);
	});

	it("removed with the panel holding it: onOut once", () => {
		const tooltip = { visible: false };
		const panel = place(
			new UIPanel(40, 40, { width: 200, height: 120, layout: "none" }),
		);
		const slot = new Slot(10, 10, tooltip);
		panel.addChild(slot);
		sync();
		pointer("pointermove", 60, 60);
		expect(slot.hover).toBe(true);
		expect(tooltip.visible).toBe(true);
		// the bag is closed
		app.world.removeChildNow(panel, true);
		sync();
		expect(tooltip.visible).toBe(false);
		expect(slot.calls).toEqual(["over", "out(removed)"]);
	});

	it("removed with a plain container holding it: onOut once", () => {
		const tooltip = { visible: false };
		const group = place(new Container(0, 0, 800, 600));
		const slot = new Slot(50, 50, tooltip);
		group.addChild(slot);
		sync();
		pointer("pointermove", 60, 60);
		expect(tooltip.visible).toBe(true);
		app.world.removeChildNow(group, true);
		sync();
		expect(tooltip.visible).toBe(false);
		expect(slot.calls).toEqual(["over", "out(removed)"]);
	});

	it("removed while held: onCancel first, then onOut", () => {
		const slot = place(new Slot(50, 50, { visible: false }));
		pointer("pointermove", 60, 60);
		pointer("pointerdown", 60, 60);
		expect(slot.released).toBe(false);
		app.world.removeChildNow(slot, true);
		sync();
		expect(slot.calls).toEqual(["over", "cancel", "out(removed)"]);
	});

	it("not hovered when removed: no onOut", () => {
		const slot = place(new Slot(50, 50, { visible: false }));
		pointer("pointermove", 600, 500);
		app.world.removeChildNow(slot, true);
		sync();
		expect(slot.calls).toEqual([]);
	});

	it("hovered, left, then removed: onOut only for the leave", () => {
		const slot = place(new Slot(50, 50, { visible: false }));
		pointer("pointermove", 60, 60);
		pointer("pointermove", 600, 500);
		app.world.removeChildNow(slot, true);
		sync();
		expect(slot.calls).toEqual(["over", "out"]);
	});

	it("added back and removed again without a hover: no second onOut", () => {
		const slot = place(new Slot(50, 50, { visible: false }));
		pointer("pointermove", 60, 60);
		app.world.removeChildNow(slot, true);
		sync();
		// the pointer leaves while it is out, then it comes back
		pointer("pointermove", 600, 500);
		app.world.addChild(slot);
		sync();
		app.world.removeChildNow(slot, true);
		sync();
		expect(slot.calls).toEqual(["over", "out(removed)"]);
	});

	it("added back, it lights again under the pointer, and its next removal calls onOut again", () => {
		const tooltip = { visible: false };
		const slot = place(new Slot(50, 50, tooltip));
		pointer("pointermove", 60, 60);
		app.world.removeChildNow(slot, true);
		sync();
		app.world.addChild(slot);
		sync();
		pointer("pointermove", 62, 62);
		expect(tooltip.visible).toBe(true);
		app.world.removeChildNow(slot, true);
		sync();
		expect(tooltip.visible).toBe(false);
		expect(slot.calls).toEqual([
			"over",
			"out(removed)",
			"over",
			"out(removed)",
		]);
	});

	it("a plain leave still calls onOut with its pointer event", () => {
		const slot = place(new Slot(50, 50, { visible: false }));
		pointer("pointermove", 60, 60);
		pointer("pointermove", 600, 500);
		expect(slot.calls).toEqual(["over", "out"]);
	});
});
