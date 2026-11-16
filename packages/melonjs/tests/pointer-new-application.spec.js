import { afterAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	input,
	Renderable,
	Stage,
	state,
	video,
} from "../src/index.js";

/**
 * Pointer events follow the current Application.
 *
 * The pointer module put its DOM listeners on the first Application's canvas
 * once and never moved them, so after that app was destroyed and another made,
 * the new canvas got no pointer events at all: nothing a region registered
 * there was ever called.
 */
describe("pointer events with a new Application", () => {
	const apps = [];

	afterAll(() => {
		// browsers cap live contexts: a leak fails unrelated specs
		for (const app of apps) {
			if (app.isInitialized) {
				app.destroy();
			}
		}
	});

	const makeApp = async () => {
		await boot();
		const app = new Application(200, 200, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		apps.push(app);
		// as a game does: the app takes its camera from the stage it enters,
		// and only the first Application is put into one automatically
		const id = state.USER + apps.length;
		state.set(id, new Stage());
		state.change(id, true);
		expect(app.viewport, "no camera").toBeDefined();
		return app;
	};

	/** a region covering the whole canvas, counting its presses */
	const addRegion = (app) => {
		const region = new Renderable(0, 0, 200, 200);
		region.anchorPoint.set(0, 0);
		region.isKinematic = false;
		region.presses = 0;
		app.world.addChild(region);
		region.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		input.registerPointerEvent("pointerdown", region, () => {
			region.presses++;
		});
		return region;
	};

	/** press at the middle of `canvas` */
	const press = (canvas) => {
		const rect = canvas.getBoundingClientRect();
		canvas.dispatchEvent(
			new PointerEvent("pointerdown", {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
				button: 0,
				buttons: 1,
				pointerId: 1,
				pointerType: "mouse",
				width: 1,
				height: 1,
				isPrimary: true,
				bubbles: true,
			}),
		);
	};

	it("a region in a second Application gets presses on its canvas", async () => {
		const first = await makeApp();
		const firstCanvas = first.renderer.getCanvas();
		const old = addRegion(first);
		press(firstCanvas);
		expect(old.presses, "the first app never worked").toBe(1);

		// kept in the page, to check it is let go of below
		first.destroy(false);
		input.releaseAllPointerEvents(old);

		const second = await makeApp();
		const region = addRegion(second);
		press(second.renderer.getCanvas());
		// once: a listener left over from the first canvas, or added twice,
		// would show here
		expect(region.presses, "the second canvas got no event").toBe(1);
		expect(input.pointerEventTarget).toBe(second.renderer.getCanvas());

		// the old canvas is not listened to any more
		press(firstCanvas);
		expect(region.presses).toBe(1);
		expect(old.presses).toBe(1);

		input.releaseAllPointerEvents(region);
		firstCanvas.remove();
	});

	it("a press on a destroyed app's canvas, left in the page, is ignored", async () => {
		const app = await makeApp();
		const canvas = app.renderer.getCanvas();
		const region = addRegion(app);
		press(canvas);
		expect(region.presses).toBe(1);

		app.destroy(false);
		// its world is gone: dispatching into it must not run or throw
		expect(() => {
			press(canvas);
		}).not.toThrow();
		expect(region.presses).toBe(1);

		input.releaseAllPointerEvents(region);
		canvas.remove();
	});
});
