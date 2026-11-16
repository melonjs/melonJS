import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	input,
	Renderable,
	UITextButton,
} from "../../src/index.js";

/**
 * Shared by `pointer-floating-draw-order-2d.spec.js` and `-3d.spec.js`, one
 * Application per file: the pointer listeners stay on the first
 * Application's canvas, so a second one in the same file gets no events.
 *
 * Overlapping floating (screen-space) regions are asked for a pointer event
 * the way they are drawn, topmost first.
 *
 * Under a `Camera2d` the world sorts on z: the HIGHER z draws on top. Under a
 * `Camera3d` it sorts on `"depth"`, where a floating child is ordered by its
 * `|z|` alone and the SMALLER one draws on top (a dialog goes at depth 1, not
 * 9000). The dispatcher ranked candidates by raw z under both, so under a
 * `Camera3d` a full-screen floating region at depth 4 was asked before a
 * button at depth 1 drawn over it, and took the press.
 */

const SIZE = 200;

// the button sits in the middle of the canvas, the region covers all of it
const BUTTON = { x: 60, y: 80, w: 80, h: 40 };
const ON_BUTTON = [BUTTON.x + BUTTON.w / 2, BUTTON.y + BUTTON.h / 2];
const OFF_BUTTON = [20, 20];

/**
 * Define the suite for one camera.
 * @param {object} options - the camera under test
 * @param {string} options.name - its name, for the suite title
 * @param {Function} options.cameraClass - `Camera2d` or `Camera3d`
 * @param {number} options.renderer - the `video.*` renderer to use
 * @param {Function} options.top - `(a, b) => true` when depth `a` draws over depth `b`
 */
export function describeFloatingDrawOrder({
	name,
	cameraClass,
	renderer,
	top,
}) {
	describe(`floating pointer regions under a ${name}`, () => {
		let app;
		let region;
		let button;
		let regionPresses;
		let buttonClicks;

		beforeAll(async () => {
			await boot();
			app = new Application(SIZE, SIZE, {
				parent: "screen",
				scale: "auto",
				renderer,
				cameraClass,
			});
			await app.init();
		});

		afterAll(() => {
			// browsers cap live contexts: a leak fails unrelated specs
			app?.destroy();
		});

		afterEach(() => {
			if (region) {
				input.releaseAllPointerEvents(region);
				app.world.removeChildNow(region);
			}
			if (button) {
				app.world.removeChildNow(button);
			}
			region = button = undefined;
			app.world.broadphase.clear();
		});

		/** a full-screen floating region at `regionDepth`, a button at `buttonDepth` */
		const place = (regionDepth, buttonDepth) => {
			regionPresses = 0;
			buttonClicks = 0;

			region = new Renderable(0, 0, SIZE, SIZE);
			region.anchorPoint.set(0, 0);
			region.floating = true;
			region.isKinematic = false;
			app.world.addChild(region, regionDepth);
			input.registerPointerEvent("pointerdown", region, () => {
				regionPresses++;
				// consume, as a "press anywhere" region would
				return false;
			});

			button = new UITextButton(BUTTON.x, BUTTON.y, {
				font: "sans-serif",
				text: "OK",
				borderWidth: BUTTON.w,
				borderHeight: BUTTON.h,
				onClick: () => {
					buttonClicks++;
				},
			});
			// registers its pointer events as it enters the world
			app.world.addChild(button, buttonDepth);

			// the order the frame would draw them in, and a fresh broadphase
			app.world.sortNow(true);
			region.updateBounds(true);
			button.updateBounds(true);
			app.world.broadphase.clear();
			app.world.broadphase.insertContainer(app.world);
		};

		/** press and release at a CANVAS (screen) position */
		const click = ([x, y]) => {
			const canvas = app.renderer.getCanvas();
			const rect = canvas.getBoundingClientRect();
			for (const type of ["pointerdown", "pointerup"]) {
				canvas.dispatchEvent(
					new PointerEvent(type, {
						clientX: rect.left + (x * rect.width) / canvas.width,
						clientY: rect.top + (y * rect.height) / canvas.height,
						button: 0,
						buttons: type === "pointerup" ? 0 : 1,
						pointerId: 1,
						pointerType: "mouse",
						width: 1,
						height: 1,
						isPrimary: true,
						bubbles: true,
					}),
				);
			}
		};

		it(`sorts the world the expected way`, () => {
			expect(app.world.sortOn).toBe(cameraClass === Camera3d ? "depth" : "z");
		});

		it("a press on a button drawn over the region reaches the button only", () => {
			// the button's depth is the one drawn on top under this camera
			const [over, under] = top(1, 4) ? [1, 4] : [4, 1];
			place(under, over);

			click(ON_BUTTON);
			expect(buttonClicks, "the button was not clicked").toBe(1);
			expect(regionPresses, "the region behind it got the press").toBe(0);

			// and the region still answers where the button is not, so the
			// test cannot pass by the region never being hit
			click(OFF_BUTTON);
			expect(regionPresses).toBe(1);
			expect(buttonClicks).toBe(1);
		});

		it("a region drawn over the button takes the press from it", () => {
			// the other way round: the region is the one on top
			const [over, under] = top(1, 4) ? [1, 4] : [4, 1];
			place(over, under);

			click(ON_BUTTON);
			expect(regionPresses, "the region on top missed the press").toBe(1);
			expect(buttonClicks, "the covered button was clicked").toBe(0);
		});
	});
}
