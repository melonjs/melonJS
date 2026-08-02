import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Draggable,
	DropTarget,
	event,
	loader,
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
