import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	device,
	input,
	Renderable,
	video,
} from "../src/index.js";

/**
 * Pointer coordinates went wrong once `devicePixelRatio` changed: browser
 * zoom, or the window moved to a screen with another pixel density.
 *
 * The canvas keeps its design size as its backing store and is given a CSS
 * size of that times the fit factor, so a CSS pixel on it is `1 / factor`
 * canvas pixels, whatever the pixel ratio. The renderer's `scaleRatio` holds
 * that factor multiplied by the ratio read once at load
 * (`device.devicePixelRatio`), and `globalToLocal` divided by it and then
 * multiplied by the LIVE ratio: the two cancelled only while the ratio stayed
 * what it was at load, and every pointer position was off by their quotient
 * after that.
 */
describe("pointer coordinates after devicePixelRatio changes", () => {
	let app;
	let original;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		original = Object.getOwnPropertyDescriptor(globalThis, "devicePixelRatio");
	});

	afterAll(() => {
		app?.destroy();
	});

	const regions = [];
	afterEach(() => {
		// put the browser's own property back
		if (original) {
			Object.defineProperty(globalThis, "devicePixelRatio", original);
		}
		for (const region of regions.splice(0)) {
			input.releaseAllPointerEvents(region);
		}
		app.world.reset();
		app.world.broadphase.clear();
	});

	/** what zooming the page or changing screens does to the ratio */
	const setRatio = (ratio) => {
		Object.defineProperty(globalThis, "devicePixelRatio", {
			configurable: true,
			get: () => ratio,
		});
		expect(globalThis.devicePixelRatio).toBe(ratio);
	};

	/** the page coordinates of a canvas pixel, from the canvas's real layout */
	const pageAt = (x, y) => {
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		return {
			clientX: rect.left + (x * rect.width) / canvas.width,
			clientY: rect.top + (y * rect.height) / canvas.height,
		};
	};

	/** press at a canvas pixel and return the pointer the viewport saw */
	const pressAt = (x, y) => {
		let seen;
		const onDown = (pointer) => {
			seen = { x: pointer.gameScreenX, y: pointer.gameScreenY };
		};
		input.registerPointerEvent("pointerdown", app.viewport, onDown);
		try {
			const canvas = app.renderer.getCanvas();
			for (const type of ["pointerdown", "pointerup"]) {
				canvas.dispatchEvent(
					new PointerEvent(type, {
						...pageAt(x, y),
						pointerId: 1,
						pointerType: "mouse",
						width: 1,
						height: 1,
						isPrimary: true,
						bubbles: true,
					}),
				);
			}
		} finally {
			input.releasePointerEvent("pointerdown", app.viewport, onDown);
		}
		return seen;
	};

	it.for([2, 1.5, 0.5, 3])(
		"maps a press to the canvas pixel under it at a ratio of %s",
		(ratio) => {
			// precondition: the canvas was laid out at another ratio
			expect(device.devicePixelRatio).not.toBe(ratio);
			setRatio(ratio);
			const p = pressAt(400, 300);
			expect(p.x).toBeCloseTo(400, 3);
			expect(p.y).toBeCloseTo(300, 3);
			const q = pressAt(100, 50);
			expect(q.x).toBeCloseTo(100, 3);
			expect(q.y).toBeCloseTo(50, 3);
		},
	);

	it("globalToLocal agrees, after the ratio changes", () => {
		setRatio(2);
		const { clientX, clientY } = pageAt(200, 150);
		const v = input.globalToLocal(
			clientX + globalThis.scrollX,
			clientY + globalThis.scrollY,
		);
		expect(v.x).toBeCloseTo(200, 3);
		expect(v.y).toBeCloseTo(150, 3);
	});

	it("still hits a region where it is drawn, after the ratio changes", () => {
		const region = new Renderable(100, 100, 50, 50);
		region.anchorPoint.set(0, 0);
		region.isKinematic = false;
		app.world.addChild(region);
		region.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		regions.push(region);
		let hits = 0;
		input.registerPointerEvent("pointerdown", region, () => {
			hits++;
		});

		setRatio(2);
		pressAt(125, 125);
		expect(hits, "missed where it is drawn").toBe(1);
		// and not where it would be at twice the distance
		pressAt(62, 62);
		expect(hits, "hit at half its distance").toBe(1);
	});

	// ---- what must keep working --------------------------------------------

	it("maps a press exactly as before while the ratio does not change", () => {
		const p = pressAt(400, 300);
		expect(p.x).toBeCloseTo(400, 3);
		expect(p.y).toBeCloseTo(300, 3);
		const q = pressAt(799, 1);
		expect(q.x).toBeCloseTo(799, 3);
		expect(q.y).toBeCloseTo(1, 3);
	});

	it("follows the canvas's new size after a resize, at the new ratio", () => {
		setRatio(2);
		// the window resizes when the page is zoomed: the canvas is laid out again
		globalThis.dispatchEvent(new Event("resize"));
		app.resize(800, 600);
		const p = pressAt(600, 450);
		expect(p.x).toBeCloseTo(600, 3);
		expect(p.y).toBeCloseTo(450, 3);
	});
});
