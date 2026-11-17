import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	event,
	input,
	Renderable,
	video,
} from "../src/index.js";

/**
 * `event.POINTERUP` and `event.POINTERCANCEL`: a release, or a pointer the
 * browser took away, broadcast wherever it happened, the way `POINTERMOVE`
 * is. A region's own "pointerup" only fires when the release lands on it,
 * and the canvas does not hear a mouse released off it, so a drag needs
 * this to know it ended.
 */
describe("the global pointer release events", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		// pointer input starts with the first registered pointer event
		const starter = new Renderable(0, 0, 1, 1);
		input.registerPointerEvent("pointerdown", starter, () => {});
		input.releasePointerEvent("pointerdown", starter);
	});

	afterAll(() => {
		app?.destroy();
	});

	const listeners = [];
	afterEach(() => {
		for (const [name, fn] of listeners.splice(0)) {
			event.off(name, fn);
		}
		app.world.reset();
		app.world.broadphase.clear();
	});

	/** listen to a global event for this test only, and collect what it sends */
	const collect = (name) => {
		const got = [];
		const fn = (pointer) => {
			got.push({
				x: pointer.gameScreenX,
				y: pointer.gameScreenY,
				gameX: pointer.gameX,
				gameY: pointer.gameY,
				id: pointer.pointerId,
				type: pointer.type,
			});
		};
		event.on(name, fn);
		listeners.push([name, fn]);
		return got;
	};

	/** a pointer event at a canvas position, sent to `target` */
	const send = (target, type, x, y, pointerId = 1, pointerType = "mouse") => {
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		target.dispatchEvent(
			new PointerEvent(type, {
				clientX: rect.left + (x * rect.width) / canvas.width,
				clientY: rect.top + (y * rect.height) / canvas.height,
				button: 0,
				buttons: type === "pointerdown" ? 1 : 0,
				pointerId,
				pointerType,
				isPrimary: pointerId === 1,
				bubbles: true,
			}),
		);
	};

	it("fires for a release over the canvas, in screen coordinates", () => {
		const ups = collect(event.POINTERUP);
		const canvas = app.renderer.getCanvas();
		send(canvas, "pointerdown", 200, 150);
		send(canvas, "pointerup", 300, 250);
		expect(ups.length).toBe(1);
		expect(ups[0].x).toBeCloseTo(300, 0);
		expect(ups[0].y).toBeCloseTo(250, 0);
		// gameX / gameY are the screen ones too, as for POINTERMOVE
		expect(ups[0].gameX).toBe(ups[0].x);
		expect(ups[0].gameY).toBe(ups[0].y);
		expect(ups[0].type).toBe("pointerup");
	});

	it("fires for a mouse released off the canvas, which the canvas never hears", () => {
		const ups = collect(event.POINTERUP);
		const canvas = app.renderer.getCanvas();
		send(canvas, "pointerdown", 400, 300);
		// the release lands on the page, outside the canvas
		send(document.body, "pointerup", 900, -40);
		expect(ups.length).toBe(1);
		expect(ups[0].x).toBeCloseTo(900, 0);
		expect(ups[0].y).toBeCloseTo(-40, 0);
	});

	it("fires even when a page script stops the event", () => {
		const ups = collect(event.POINTERUP);
		const stopper = (e) => {
			e.stopPropagation();
		};
		document.body.addEventListener("pointerup", stopper);
		try {
			send(document.body, "pointerup", 10, 10);
		} finally {
			document.body.removeEventListener("pointerup", stopper);
		}
		expect(ups.length).toBe(1);
	});

	it("fires once per release, not once per listener on the way", () => {
		const ups = collect(event.POINTERUP);
		const canvas = app.renderer.getCanvas();
		for (let i = 0; i < 3; i++) {
			send(canvas, "pointerdown", 100, 100);
			send(canvas, "pointerup", 100, 100);
		}
		expect(ups.length).toBe(3);
	});

	it("tells each finger apart by its pointerId", () => {
		const ups = collect(event.POINTERUP);
		const canvas = app.renderer.getCanvas();
		send(canvas, "pointerdown", 100, 100, 1, "touch");
		send(canvas, "pointerdown", 500, 100, 2, "touch");
		send(canvas, "pointerup", 500, 120, 2, "touch");
		send(canvas, "pointerup", 100, 120, 1, "touch");
		expect(
			ups.map((u) => {
				return u.id;
			}),
		).toEqual([2, 1]);
	});

	it("POINTERCANCEL fires for a pointer the browser took away, and POINTERUP does not", () => {
		const ups = collect(event.POINTERUP);
		const cancels = collect(event.POINTERCANCEL);
		const canvas = app.renderer.getCanvas();
		send(canvas, "pointerdown", 100, 100, 3, "touch");
		send(canvas, "pointercancel", 100, 100, 3, "touch");
		expect(cancels.length).toBe(1);
		expect(cancels[0].id).toBe(3);
		expect(cancels[0].type).toBe("pointercancel");
		expect(ups.length).toBe(0);
	});

	it("a region still hears only the releases that land on it", () => {
		const region = new Renderable(100, 100, 100, 100);
		region.anchorPoint.set(0, 0);
		region.isKinematic = false;
		app.world.addChild(region);
		region.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		let regionUps = 0;
		input.registerPointerEvent("pointerdown", region, () => {});
		input.registerPointerEvent("pointerup", region, () => {
			regionUps++;
		});
		const ups = collect(event.POINTERUP);
		const canvas = app.renderer.getCanvas();
		try {
			// pressed on it, released elsewhere: the broadcast only
			send(canvas, "pointerdown", 150, 150);
			send(canvas, "pointerup", 600, 500);
			expect(regionUps).toBe(0);
			// pressed and released on it: both
			send(canvas, "pointerdown", 150, 150);
			send(canvas, "pointerup", 150, 150);
			expect(regionUps).toBe(1);
			expect(ups.length).toBe(2);
		} finally {
			input.releaseAllPointerEvents(region);
		}
	});

	it("a listener removed with event.off hears nothing more", () => {
		let heard = 0;
		const fn = () => {
			heard++;
		};
		event.on(event.POINTERUP, fn);
		const canvas = app.renderer.getCanvas();
		send(canvas, "pointerup", 50, 50);
		event.off(event.POINTERUP, fn);
		send(canvas, "pointerup", 50, 50);
		expect(heard).toBe(1);
	});
});
