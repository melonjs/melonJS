/**
 * `isSleeping()`: the portable read of the engine's own sleep flag. A
 * dynamic body that came to rest sleeps, a force or a velocity wakes it, and
 * a static body, or a renderable the adapter does not know, never sleeps.
 */

import {
	Application,
	boot,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MatterAdapter } from "../src/index";

describe("MatterAdapter#isSleeping", () => {
	let adapter: MatterAdapter;

	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(async () => {
		adapter = new MatterAdapter({
			gravity: { x: 0, y: 1 },
			matterEngineOptions: { enableSleeping: true },
		});
		new World(0, 0, 800, 600, adapter);
	});

	const add = (
		type: "static" | "dynamic",
		x: number,
		y: number,
		w: number,
		h: number,
	): Renderable => {
		const r = new Renderable(x, y, w, h);
		r.anchorPoint.set(0, 0);
		adapter.addBody(r, { type, shapes: [new Rect(0, 0, w, h)] });
		return r;
	};

	const step = () => {
		adapter.step(1000 / 60);
		adapter.syncFromPhysics();
	};

	const run = (n: number) => {
		for (let i = 0; i < n; i++) {
			step();
		}
	};

	/**
	 * Steps until `r` sleeps, or gives up.
	 * @param r - the body's renderable
	 * @param max - the steps to give up after
	 * @returns whether it fell asleep
	 */
	const settle = (r: Renderable, max = 1200): boolean => {
		for (let i = 0; i < max; i++) {
			step();
			if (adapter.isSleeping(r)) {
				return true;
			}
		}
		return false;
	};

	it("reports the capability", () => {
		expect(adapter.capabilities.sleepingBodies).toBe(true);
	});

	it("is false for a renderable the adapter does not know", () => {
		expect(adapter.isSleeping(new Renderable(0, 0, 8, 8))).toBe(false);
	});

	it("is false for a static body, however long it rests", () => {
		const ground = add("static", 0, 500, 800, 40);
		run(240);
		expect(adapter.isSleeping(ground)).toBe(false);
	});

	it("is false for a body that is falling", () => {
		add("static", 0, 500, 800, 40);
		const box = add("dynamic", 380, 100, 32, 32);
		run(10);
		expect(adapter.isSleeping(box)).toBe(false);
	});

	it("is true once the body has come to rest", () => {
		add("static", 0, 500, 800, 40);
		const box = add("dynamic", 380, 400, 32, 32);
		expect(settle(box)).toBe(true);
		// it rests on the ground
		expect(box.pos.y).toBeGreaterThan(450);
		expect(box.pos.y).toBeLessThan(470);
	});

	it("is false again once a velocity wakes the body", () => {
		add("static", 0, 500, 800, 40);
		const box = add("dynamic", 380, 400, 32, 32);
		expect(settle(box)).toBe(true);
		adapter.setVelocity(box, new Vector2d(5, -5));
		expect(adapter.isSleeping(box)).toBe(false);
	});

	it("is false again once an impulse wakes the body, which then moves", () => {
		add("static", 0, 500, 800, 40);
		const box = add("dynamic", 380, 400, 32, 32);
		expect(settle(box)).toBe(true);
		const x = box.pos.x;
		adapter.applyImpulse(box, new Vector2d(50, 0));
		expect(adapter.isSleeping(box)).toBe(false);
		run(10);
		expect(box.pos.x).toBeGreaterThan(x);
	});

	it("is false again once a body is removed", () => {
		add("static", 0, 500, 800, 40);
		const box = add("dynamic", 380, 400, 32, 32);
		expect(settle(box)).toBe(true);
		adapter.removeBody(box);
		expect(adapter.isSleeping(box)).toBe(false);
	});
});
