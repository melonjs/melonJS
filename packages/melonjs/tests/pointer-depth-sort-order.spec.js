/**
 * Under a `Camera3d` the world sorts on `"depth"`: `draw` paints a floating
 * child by `|pos.z|`, the smallest on top, and a world child by its distance
 * from the camera, the nearest on top. The pointer hit-test ranked the same
 * children by raw `pos.z`, the highest on top, so the region asked first was
 * not the one on screen: a full-screen floating region added after a button
 * (and so given a larger depth) took the press meant for the button drawn
 * over it. Hit-testing now follows the order `draw` paints in.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	Container,
	input,
	Renderable,
	video,
} from "../src/index.js";

const SIZE = 200;

describe("pointer hit order under the camera-distance sort", () => {
	let app;
	const added = [];

	beforeAll(async () => {
		await boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			cameraClass: Camera3d,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	afterEach(() => {
		for (const r of added.splice(0)) {
			input.releaseAllPointerEvents(r);
			app.world.removeChildNow(r);
		}
	});

	/** a floating region over `w × h` screen pixels at (x, y), at depth z */
	const region = (x, y, w, h, z) => {
		const r = new Renderable(x, y, w, h);
		r.anchorPoint.set(0, 0);
		r.floating = true;
		r.isKinematic = false;
		app.world.addChild(r, z);
		added.push(r);
		return r;
	};

	/** send a pointer event at a CANVAS (screen) position */
	const send = (type, x, y) => {
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

	const press = (x, y) => {
		// the hit-test reads the broadphase, which the world fills as it updates
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		send("pointerdown", x, y);
		send("pointerup", x, y);
	};

	it("the world sorts on depth under a Camera3d", () => {
		expect(app.world.sortOn).toBe("depth");
	});

	it("a button drawn over a full-screen region gets the press first, and can keep it", () => {
		const button = region(20, 20, 60, 30, 1);
		// added after the button, with no depth: autoDepth gives it a larger
		// one, which the depth sort draws behind the button
		const aim = region(0, 0, SIZE, SIZE);
		expect(Math.abs(aim.pos.z)).toBeGreaterThan(1);
		const order = [];
		input.registerPointerEvent("pointerdown", aim, () => {
			order.push("aim");
		});
		input.registerPointerEvent("pointerdown", button, () => {
			order.push("button");
			return false;
		});
		press(40, 30);
		expect(order).toEqual(["button"]);

		// and the aim region still takes a press anywhere else
		order.length = 0;
		press(150, 150);
		expect(order).toEqual(["aim"]);
	});

	it("follows the order draw paints in", () => {
		const button = region(20, 20, 60, 30, 1);
		const aim = region(0, 0, SIZE, SIZE, 7);
		const order = [];
		input.registerPointerEvent("pointerdown", aim, () => {
			order.push("aim");
		});
		input.registerPointerEvent("pointerdown", button, () => {
			order.push("button");
		});
		press(40, 30);
		app.world.sortNow();
		// draw walks the children backwards: the lower index paints on top
		const drawnOnTop =
			app.world.getChildIndex(button) < app.world.getChildIndex(aim)
				? "button"
				: "aim";
		expect(order[0]).toBe(drawnOnTop);
		expect(order).toEqual(["button", "aim"]);
	});

	it("ranks a floating child by |z|: a negative depth is as far as a positive one", () => {
		const back = region(0, 0, SIZE, SIZE, -5);
		const front = region(0, 0, SIZE, SIZE, 2);
		const order = [];
		input.registerPointerEvent("pointerdown", back, () => {
			order.push("back");
		});
		input.registerPointerEvent("pointerdown", front, () => {
			order.push("front");
		});
		press(100, 100);
		expect(order).toEqual(["front", "back"]);
	});

	it("an equal depth keeps the draw's tie order", () => {
		const first = region(0, 0, SIZE, SIZE, 3);
		const second = region(0, 0, SIZE, SIZE, 3);
		app.world.sortNow();
		const order = [];
		input.registerPointerEvent("pointerdown", first, () => {
			order.push("first");
		});
		input.registerPointerEvent("pointerdown", second, () => {
			order.push("second");
		});
		press(100, 100);
		const top =
			app.world.getChildIndex(first) < app.world.getChildIndex(second)
				? "first"
				: "second";
		expect(order[0]).toBe(top);
	});

	it("a container on another sort keeps ranking its children by z", () => {
		// a UI panel is a plain container: "z", the highest on top
		const panel = new Container(0, 0, SIZE, SIZE);
		panel.floating = true;
		app.world.addChild(panel, 1);
		try {
			expect(panel.sortOn).toBe("z");
			const low = new Renderable(0, 0, 50, 50);
			const high = new Renderable(0, 0, 50, 50);
			for (const r of [low, high]) {
				r.anchorPoint.set(0, 0);
				r.isKinematic = false;
			}
			panel.addChild(low, 1);
			panel.addChild(high, 2);
			expect(app.world._sortReverseZ(high, low)).toBeGreaterThan(0);
			expect(app.world._sortReverseZ(low, high)).toBeLessThan(0);
		} finally {
			app.world.removeChildNow(panel);
		}
	});
});
