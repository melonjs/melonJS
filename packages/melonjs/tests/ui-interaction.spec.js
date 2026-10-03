import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Draggable,
	DropTarget,
	event,
	input,
	loader,
	UIBaseElement,
	UISpriteElement,
	UITextButton,
	video,
} from "../src/index.js";
import Renderer from "../src/video/renderer.js";

// Pointer-interaction coverage for the UI / drag-and-drop widgets.
// Until #1499 nothing in CI ever dispatched a pointer event at a widget —
// onClick/onRelease/drag wiring only worked because humans clicked things.

// dispatch a pointer event at GAME coordinates — converts to client
// coordinates via the canvas bounding rect so the test is independent of
// how `scale: "auto"` sized/positioned the canvas in the runner page
const dispatchPointer = (type, gameX, gameY) => {
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

const syncBroadphase = () => {
	app.world.broadphase.clear();
	app.world.broadphase.insertContainer(app.world);
};

let app;

describe("UI pointer interaction", () => {
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		await new Promise((resolve) => {
			loader.preload(
				[
					{
						name: "xolo12",
						type: "image",
						src: "/data/fnt/xolo12.png",
					},
					{
						name: "xolo12",
						type: "binary",
						src: "/data/fnt/xolo12.fnt",
					},
				],
				resolve,
			);
		});
	});

	describe("UITextButton", () => {
		const makeButton = () => {
			const btn = new UITextButton(50, 50, {
				font: "xolo12",
				text: "OK",
				borderWidth: 100,
				borderHeight: 40,
			});
			btn.anchorPoint.set(0, 0);
			return btn;
		};

		it("pointerdown over the button fires onClick", () => {
			const btn = makeButton();
			app.world.addChild(btn);
			syncBroadphase();
			const clickSpy = vi.spyOn(btn, "onClick");

			try {
				dispatchPointer("pointerdown", 75, 70);
				expect(clickSpy).toHaveBeenCalled();
			} finally {
				clickSpy.mockRestore();
				app.world.removeChildNow(btn);
			}
		});

		it("pointerup over the button fires onRelease", () => {
			const btn = makeButton();
			app.world.addChild(btn);
			syncBroadphase();
			const releaseSpy = vi.spyOn(btn, "onRelease");

			try {
				dispatchPointer("pointerdown", 75, 70);
				dispatchPointer("pointerup", 75, 70);
				expect(releaseSpy).toHaveBeenCalled();
			} finally {
				releaseSpy.mockRestore();
				app.world.removeChildNow(btn);
			}
		});

		it("pointerdown outside the button does not fire onClick", () => {
			const btn = makeButton();
			app.world.addChild(btn);
			syncBroadphase();
			const clickSpy = vi.spyOn(btn, "onClick");

			try {
				dispatchPointer("pointerdown", 400, 400);
				expect(clickSpy).not.toHaveBeenCalled();
			} finally {
				clickSpy.mockRestore();
				app.world.removeChildNow(btn);
			}
		});
	});

	describe("UISpriteElement", () => {
		it("pointerdown over the element fires onClick", () => {
			const el = new UISpriteElement(50, 50, {
				image: Renderer.createCanvas(32, 32),
				framewidth: 32,
				frameheight: 32,
			});
			el.anchorPoint.set(0, 0);
			app.world.addChild(el);
			syncBroadphase();
			const clickSpy = vi.spyOn(el, "onClick");

			try {
				dispatchPointer("pointerdown", 60, 60);
				expect(clickSpy).toHaveBeenCalled();
			} finally {
				clickSpy.mockRestore();
				app.world.removeChildNow(el);
			}
		});
	});

	describe("Draggable", () => {
		it("full drag cycle through real pointer events", () => {
			const d = new Draggable(50, 50, 32, 32);
			d.anchorPoint.set(0, 0);
			app.world.addChild(d);
			syncBroadphase();

			try {
				// grab at (60, 60) — 10px inside the top-left corner
				dispatchPointer("pointerdown", 60, 60);
				expect(d.dragging).toBe(true);

				// drag to (100, 90): pos follows pointer minus grab offset
				dispatchPointer("pointermove", 100, 90);
				expect(d.pos.x).toBeCloseTo(90);
				expect(d.pos.y).toBeCloseTo(80);

				// release over the (moved) draggable
				d.updateBounds();
				syncBroadphase();
				dispatchPointer("pointerup", 100, 90);
				expect(d.dragging).toBe(false);
			} finally {
				app.world.removeChildNow(d);
			}
		});
	});

	// A panel stacked over another panel's button used to let the covered
	// button answer the pointer: `pos.z` is container-local (`autoDepth`
	// numbers each container's children from 1), but the hit-test sorted one
	// FLAT list of broadphase candidates on raw z, so a button at local z=8
	// inside a low panel outranked an entire panel drawn on top of it.
	describe("hit-test ordering across containers", () => {
		// panel A (100,100)-(300,300) holding a button at (120,120)-(180,160);
		// panel B (150,150)-(350,350) covers the button's top-left corner, so
		// (165, 155) is inside BOTH the button and panel B
		const makeOverlap = (zA, zB) => {
			const panelA = new UIBaseElement(100, 100, 200, 200);
			panelA.anchorPoint.set(0, 0);
			const button = new UIBaseElement(20, 20, 60, 40);
			button.anchorPoint.set(0, 0);
			// an explicit local z, exactly as `addChild(child, z)` is meant to
			// be used — and higher than any z panel B can be given
			panelA.addChild(button, 8);
			const panelB = new UIBaseElement(150, 150, 200, 200);
			panelB.anchorPoint.set(0, 0);
			app.world.addChild(panelA, zA);
			app.world.addChild(panelB, zB);
			syncBroadphase();
			return { panelA, panelB, button };
		};

		const teardown = ({ panelA, panelB }) => {
			app.world.removeChildNow(panelA);
			app.world.removeChildNow(panelB);
			syncBroadphase();
		};

		it("a click over the covering panel does not reach the covered button", () => {
			const parts = makeOverlap(1, 2);
			const panelSpy = vi.spyOn(parts.panelB, "onClick").mockReturnValue(false);
			const buttonSpy = vi.spyOn(parts.button, "onClick");
			try {
				dispatchPointer("pointerdown", 165, 155);
				expect(panelSpy).toHaveBeenCalled();
				expect(buttonSpy).not.toHaveBeenCalled();
			} finally {
				panelSpy.mockRestore();
				buttonSpy.mockRestore();
				teardown(parts);
			}
		});

		it("the same button still answers where the covering panel is not over it", () => {
			const parts = makeOverlap(1, 2);
			const buttonSpy = vi.spyOn(parts.button, "onClick");
			try {
				// (130, 130) is inside the button and outside panel B
				dispatchPointer("pointerdown", 130, 130);
				expect(buttonSpy).toHaveBeenCalled();
			} finally {
				buttonSpy.mockRestore();
				teardown(parts);
			}
		});

		it("moveToTop lifts a panel above the other panel's button", () => {
			const parts = makeOverlap(1, 1);
			const buttonSpy = vi.spyOn(parts.button, "onClick");
			const bSpy = vi.spyOn(parts.panelB, "onClick").mockReturnValue(false);
			const aSpy = vi.spyOn(parts.panelA, "onClick").mockReturnValue(false);
			try {
				app.world.moveToTop(parts.panelB);
				syncBroadphase();
				dispatchPointer("pointerdown", 165, 155);
				expect(bSpy).toHaveBeenCalled();
				expect(buttonSpy).not.toHaveBeenCalled();
			} finally {
				aSpy.mockRestore();
				bSpy.mockRestore();
				buttonSpy.mockRestore();
				teardown(parts);
			}
		});

		it("two panels sharing a z resolve by child order, as draw does", () => {
			// equal z is not a draw-order coin toss: the sort in `Container#draw`
			// is stable and its reverse walk paints the LOWER index last, so the
			// first-added panel is the one on top. Panel A is therefore still
			// the top panel here, and its button is what the pointer should find.
			const parts = makeOverlap(1, 1);
			const buttonSpy = vi
				.spyOn(parts.button, "onClick")
				.mockReturnValue(false);
			const bSpy = vi.spyOn(parts.panelB, "onClick").mockReturnValue(false);
			try {
				dispatchPointer("pointerdown", 165, 155);
				expect(buttonSpy).toHaveBeenCalled();
				expect(bSpy).not.toHaveBeenCalled();
			} finally {
				bSpy.mockRestore();
				buttonSpy.mockRestore();
				teardown(parts);
			}
		});

		it("a child is hit before the container that holds it", () => {
			const parts = makeOverlap(1, 2);
			const panelSpy = vi.spyOn(parts.panelA, "onClick").mockReturnValue(false);
			const buttonSpy = vi
				.spyOn(parts.button, "onClick")
				.mockReturnValue(false);
			try {
				dispatchPointer("pointerdown", 130, 130);
				expect(buttonSpy).toHaveBeenCalled();
				expect(panelSpy).not.toHaveBeenCalled();
			} finally {
				panelSpy.mockRestore();
				buttonSpy.mockRestore();
				teardown(parts);
			}
		});

		it("hovering the covering panel does not light up the covered button", () => {
			const parts = makeOverlap(1, 2);
			const overSpy = vi.spyOn(parts.panelB, "onOver").mockReturnValue(false);
			try {
				dispatchPointer("pointermove", 165, 155);
				expect(overSpy).toHaveBeenCalled();
				expect(parts.button.hover).toBe(false);
			} finally {
				overSpy.mockRestore();
				teardown(parts);
			}
		});

		it("a pointermove callback keeps it unlit once the pointer is already inside", () => {
			const parts = makeOverlap(1, 2);
			const overSpy = vi.spyOn(parts.panelB, "onOver").mockReturnValue(false);
			// `onOver` only runs on the frame the pointer crosses in; after
			// that the dispatcher reaches the plain `pointermove` callbacks
			input.registerPointerEvent("pointermove", parts.panelB, () => {
				return false;
			});
			try {
				dispatchPointer("pointermove", 165, 155);
				dispatchPointer("pointermove", 166, 156);
				expect(parts.button.hover).toBe(false);
			} finally {
				input.releasePointerEvent("pointermove", parts.panelB);
				overSpy.mockRestore();
				teardown(parts);
			}
		});

		it("a lit button goes dark when the pointer moves onto the panel covering it", () => {
			// panel B covers the button's bottom-right corner, so the pointer
			// can go from the exposed part straight onto the panel while never
			// leaving the button's own bounds. Nothing was then telling the
			// button it had lost the pointer, and it stayed lit under B.
			const parts = makeOverlap(1, 2);
			const overSpy = vi.spyOn(parts.panelB, "onOver").mockReturnValue(false);
			input.registerPointerEvent("pointermove", parts.panelB, () => {
				return false;
			});
			try {
				// the button is (120,120)-(180,160) and panel B starts at
				// (150,150), so (135, 135) is in the button and clear of B
				dispatchPointer("pointermove", 135, 135);
				expect(parts.button.hover).toBe(true);

				// (165, 155) is in the button and INSIDE panel B
				dispatchPointer("pointermove", 165, 155);
				expect(parts.button.hover).toBe(false);
			} finally {
				input.releasePointerEvent("pointermove", parts.panelB);
				overSpy.mockRestore();
				teardown(parts);
			}
		});

		it("onOut fires once for that, not on every frame the pointer stays there", () => {
			const parts = makeOverlap(1, 2);
			const overSpy = vi.spyOn(parts.panelB, "onOver").mockReturnValue(false);
			const outSpy = vi.spyOn(parts.button, "onOut");
			input.registerPointerEvent("pointermove", parts.panelB, () => {
				return false;
			});
			try {
				dispatchPointer("pointermove", 135, 135);
				dispatchPointer("pointermove", 165, 155);
				expect(outSpy).toHaveBeenCalledTimes(1);
				dispatchPointer("pointermove", 166, 156);
				dispatchPointer("pointermove", 167, 157);
				expect(outSpy).toHaveBeenCalledTimes(1);
			} finally {
				input.releasePointerEvent("pointermove", parts.panelB);
				outSpy.mockRestore();
				overSpy.mockRestore();
				teardown(parts);
			}
		});

		it("a consumed click does not change what is hovered", () => {
			// only a MOVE reassigns the pointer. A press, a release or a wheel
			// consumed by the panel says nothing about where the pointer is, so
			// it must not take the hover off whatever is under the panel.
			const parts = makeOverlap(1, 2);
			const clickSpy = vi.spyOn(parts.panelB, "onClick").mockReturnValue(false);
			try {
				dispatchPointer("pointermove", 135, 135);
				expect(parts.button.hover).toBe(true);
				// straight to a press over the covered corner, no move first
				dispatchPointer("pointerdown", 165, 155);
				expect(clickSpy).toHaveBeenCalled();
				expect(parts.button.hover).toBe(true);
			} finally {
				clickSpy.mockRestore();
				teardown(parts);
			}
		});

		it("an uncovered sibling keeps its hover when something else consumes", () => {
			// the sweep must only take the pointer away from what is actually
			// under the consumer, not from everything left in the walk
			const parts = makeOverlap(1, 2);
			const far = new UIBaseElement(500, 400, 60, 40);
			far.anchorPoint.set(0, 0);
			app.world.addChild(far, 3);
			syncBroadphase();
			try {
				dispatchPointer("pointermove", 520, 420);
				expect(far.hover).toBe(true);
				// a move far away: `far` is out of bounds and leaves on its own
				dispatchPointer("pointermove", 165, 155);
				expect(far.hover).toBe(false);
			} finally {
				app.world.removeChildNow(far);
				teardown(parts);
			}
		});

		it("without consuming the enter, the covered button still lights up", () => {
			// the ordering fix alone does not make a panel opaque: it decides
			// WHO is asked first, and an element that consumes nothing still
			// lets the walk carry on to whatever is underneath
			const parts = makeOverlap(1, 2);
			try {
				dispatchPointer("pointermove", 165, 155);
				expect(parts.panelB.hover).toBe(true);
				expect(parts.button.hover).toBe(true);
			} finally {
				teardown(parts);
			}
		});
	});

	describe("DropTarget", () => {
		it("drop() fires when a draggable is released overlapping the target", () => {
			const target = new DropTarget(100, 100, 50, 50);
			target.anchorPoint.set(0, 0);
			app.world.addChild(target);
			const item = new Draggable(110, 110, 10, 10);
			item.anchorPoint.set(0, 0);
			app.world.addChild(item);
			const dropSpy = vi.spyOn(target, "drop");

			try {
				event.emit(event.DRAGEND, {}, item);
				expect(dropSpy).toHaveBeenCalledWith(item);
			} finally {
				dropSpy.mockRestore();
				app.world.removeChildNow(item);
				app.world.removeChildNow(target);
			}
		});

		it("drop() does not fire for a non-overlapping draggable", () => {
			const target = new DropTarget(100, 100, 50, 50);
			target.anchorPoint.set(0, 0);
			app.world.addChild(target);
			const far = new Draggable(500, 500, 8, 8);
			far.anchorPoint.set(0, 0);
			app.world.addChild(far);
			const dropSpy = vi.spyOn(target, "drop");

			try {
				event.emit(event.DRAGEND, {}, far);
				expect(dropSpy).not.toHaveBeenCalled();
			} finally {
				dropSpy.mockRestore();
				app.world.removeChildNow(far);
				app.world.removeChildNow(target);
			}
		});
	});
});
