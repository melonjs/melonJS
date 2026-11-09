import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Draggable,
	event,
	input,
	video,
} from "../src/index.js";

/**
 * `Draggable` jumped as soon as it was dragged under a scrolled or zoomed
 * camera.
 *
 * The grab offset was taken from the region's pointerdown, whose `gameX` is in
 * world coordinates for an object in the world, and the drag followed the
 * global `POINTERMOVE`, whose `gameX` is in screen coordinates. With the
 * camera anywhere but at the origin, unzoomed, the two differ, so the first
 * move put the object off by the camera's position, away from the pointer;
 * the release then landed outside it, and the drag never ended.
 */
describe("Draggable under a moved camera", () => {
	let app;
	const created = [];

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	afterEach(() => {
		// removing it destroys it, which also releases its listeners
		for (const d of created.splice(0)) {
			app.world.removeChildNow(d);
		}
		app.world.reset();
		app.world.broadphase.clear();
		app.viewport.zoom = 1;
		app.viewport.reset();
	});

	/** what a frame does for the hit test: index the objects where they are now */
	const frame = () => {
		for (const d of created) {
			d.updateBounds(true);
		}
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
	};

	const draggable = (x, y, floating = false) => {
		const d = new Draggable(x, y, 50, 50);
		d.anchorPoint.set(0, 0);
		d.floating = floating;
		app.world.addChild(d);
		created.push(d);
		frame();
		return d;
	};

	/** send a pointer event at a CANVAS (screen) position */
	const send = (type, x, y) => {
		frame();
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
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
	};

	/** press at a screen position, move by (dx, dy) screen pixels, release */
	const drag = (x, y, dx, dy) => {
		send("pointerdown", x, y);
		send("pointermove", x + dx, y + dy);
		send("pointerup", x + dx, y + dy);
	};

	const scrollCamera = (x, y) => {
		app.viewport.setBounds(0, 0, 4000, 4000);
		app.viewport.moveTo(x, y);
		// the test means nothing if the camera did not actually move
		expect(app.viewport.pos.x).toBe(x);
		expect(app.viewport.pos.y).toBe(y);
	};

	it("follows the pointer under a scrolled camera", () => {
		scrollCamera(100, 50);
		// in the world at (400, 300), so drawn at (300, 250)
		const d = draggable(400, 300);
		send("pointerdown", 310, 260);
		expect(d.dragging).toBe(true);
		send("pointermove", 330, 270);
		// moved with the pointer, not by the camera's position
		expect(d.pos.x).toBeCloseTo(420);
		expect(d.pos.y).toBeCloseTo(310);
		send("pointerup", 330, 270);
	});

	it("ends the drag when released under a scrolled camera", () => {
		scrollCamera(100, 50);
		const d = draggable(400, 300);
		let ends = 0;
		const onEnd = () => {
			ends++;
		};
		event.on(event.DRAGEND, onEnd);
		try {
			drag(310, 260, 20, 10);
		} finally {
			event.off(event.DRAGEND, onEnd);
		}
		expect(ends).toBe(1);
		expect(d.dragging).toBe(false);
	});

	it("follows the pointer under a zoomed camera", () => {
		app.viewport.zoom = 2;
		const d = draggable(100, 100);
		// where the camera draws its corner, and the pointer's world point there
		const corner = app.viewport.worldToLocal(110, 110);
		send("pointerdown", corner.x, corner.y);
		expect(d.dragging).toBe(true);
		send("pointermove", corner.x + 20, corner.y + 10);
		// 20 screen pixels at a zoom of 2 is 10 world units
		expect(d.pos.x).toBeCloseTo(110);
		expect(d.pos.y).toBeCloseTo(105);
		send("pointerup", corner.x + 20, corner.y + 10);
		expect(d.dragging).toBe(false);
	});

	// ---- what must keep working --------------------------------------------

	it("follows the pointer one to one with the camera at the origin", () => {
		const d = draggable(100, 100);
		drag(110, 120, 35, -15);
		expect(d.pos.x).toBeCloseTo(135);
		expect(d.pos.y).toBeCloseTo(85);
		expect(d.dragging).toBe(false);
	});

	it("keeps following over several moves, and stops after the release", () => {
		const d = draggable(100, 100);
		send("pointerdown", 110, 110);
		for (let i = 1; i <= 5; i++) {
			send("pointermove", 110 + i * 10, 110);
		}
		expect(d.pos.x).toBeCloseTo(150);
		send("pointerup", 160, 110);
		send("pointermove", 300, 300);
		expect(d.pos.x).toBeCloseTo(150);
		expect(d.pos.y).toBeCloseTo(100);
	});

	it("drags a floating one in screen space, wherever the camera is", () => {
		scrollCamera(100, 50);
		// floating: drawn at its own position, whatever the camera
		const d = draggable(200, 200, true);
		drag(210, 210, 30, 20);
		expect(d.pos.x).toBeCloseTo(230);
		expect(d.pos.y).toBeCloseTo(220);
		expect(d.dragging).toBe(false);
	});

	it("does not move when the pointer moves without a press on it", () => {
		scrollCamera(100, 50);
		const d = draggable(400, 300);
		send("pointermove", 20, 20);
		send("pointerdown", 20, 20);
		send("pointermove", 40, 40);
		send("pointerup", 40, 40);
		expect(d.pos.x).toBe(400);
		expect(d.pos.y).toBe(300);
	});
});
