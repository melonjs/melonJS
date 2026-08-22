/**
 * Renderable GUIDs must be unique, because collision pair identity is built
 * from them.
 *
 * `createGUID()` returned `index || GUID_index`, and `index` defaults to 1, so
 * it returned the literal string "-1" on every call. The incrementing counter
 * was computed and then discarded. Every renderable added to a container
 * therefore shared one GUID.
 *
 * GUID's only consumer is `Detector._pairKey`, so the whole collision
 * lifecycle collapsed onto a single key: with two pairs colliding anywhere in
 * the world at once, the second was treated as already-seen this frame and its
 * `onCollisionStart` / `onCollisionActive` / `onCollisionEnd` never fired.
 * `onCollision` was unaffected, which is why this survived: the legacy handler
 * is dispatched outside the first-visit guard.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	collision,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

const T = collision.types;

describe("Renderable GUID uniqueness and collision pair identity", () => {
	/** @type {World} */
	let world;
	let app;

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

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
	});

	it("gives every renderable added to a container a distinct GUID", () => {
		const made = Array.from({ length: 25 }, () => {
			const r = new Renderable(0, 0, 8, 8);
			world.addChild(r);
			return r.GUID;
		});
		expect(new Set(made).size).toBe(made.length);
		// the old bug produced "-1" for EVERY renderable; the first one is
		// still legitimately "-1", so what matters is that they diverge
		expect(made.filter((g) => g === made[0])).toHaveLength(1);
	});

	it("keeps them distinct when the renderables share an id", () => {
		// `Container.addChild` passes `child.id` as the counter STRIDE. A null
		// id (the default) or a zero id must still advance it.
		const made = [];
		for (const id of [null, 0, 0, 7, 7, undefined]) {
			const r = new Renderable(0, 0, 8, 8);
			r.id = id;
			world.addChild(r);
			made.push(r.GUID);
		}
		expect(new Set(made).size).toBe(made.length);
	});

	it("fires the collision lifecycle for EVERY simultaneously colliding pair", () => {
		// the user-visible symptom. Two independent pairs, far apart, colliding
		// in the same step. Before the fix only the first fired.
		const mk = (x, y, type) => {
			const r = new Renderable(x, y, 32, 32);
			r.alwaysUpdate = true;
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: type,
				collisionMask: T.ALL_OBJECT,
				gravityScale: 0,
			};
			world.addChild(r);
			return r;
		};
		const a1 = mk(100, 100, T.PLAYER_OBJECT);
		mk(108, 100, T.ENEMY_OBJECT);
		const a2 = mk(100, 400, T.PLAYER_OBJECT);
		mk(108, 400, T.ENEMY_OBJECT);

		const started = [];
		const active = [];
		a1.onCollisionStart = () => started.push("pair1");
		a2.onCollisionStart = () => started.push("pair2");
		a1.onCollisionActive = () => active.push("pair1");
		a2.onCollisionActive = () => active.push("pair2");

		world.update(16);

		expect(started).toContain("pair1");
		expect(started).toContain("pair2");
		expect(active).toContain("pair1");
		expect(active).toContain("pair2");
	});

	it("fires onCollisionEnd for every pair that separates", () => {
		const mk = (x, y, type) => {
			const r = new Renderable(x, y, 32, 32);
			r.alwaysUpdate = true;
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: type,
				collisionMask: T.ALL_OBJECT,
				gravityScale: 0,
			};
			world.addChild(r);
			return r;
		};
		const a1 = mk(100, 100, T.PLAYER_OBJECT);
		mk(108, 100, T.ENEMY_OBJECT);
		const a2 = mk(100, 400, T.PLAYER_OBJECT);
		mk(108, 400, T.ENEMY_OBJECT);
		const ended = [];
		a1.onCollisionEnd = () => ended.push("pair1");
		a2.onCollisionEnd = () => ended.push("pair2");

		world.update(16);
		// pull both apart
		a1.pos.x = 600;
		a1.body.getBounds().translate(500, 0);
		a2.pos.x = 600;
		a2.body.getBounds().translate(500, 0);
		world.update(16);

		expect(ended).toContain("pair1");
		expect(ended).toContain("pair2");
	});
});
