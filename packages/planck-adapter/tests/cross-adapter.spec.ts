/**
 * The same scenes, run on the built-in, matter and planck adapters.
 *
 * Each case states what the `PhysicsAdapter` contract promises on every
 * backend, so a case that passes on one adapter and fails on another is a
 * bug in that adapter, not an expected difference. Lives in this package
 * because it is the one with all three adapters available.
 *
 * - collision `depth` is the overlap in pixels (planck reported 0)
 * - a raycast finds a body made of several shapes (matter missed it)
 * - a body removed with `removeChildNow()` from a collision handler stops
 *   colliding (planck kept it as an invisible collider)
 * - the per-shape hooks get the same normal as the body hooks (matter's
 *   pointed the other way)
 * - `setFrictionAir()` at run time damps a body as the same `frictionAir`
 *   in its `bodyDef` does (planck left rotation undamped)
 * - a body with no `collisionMask` collides with every collision type
 *   (planck's default mask stopped at bit 15)
 * - `world.setAdapter()` moves every body from any adapter to any other
 */

import { MatterAdapter } from "@melonjs/matter-adapter";
import {
	Application,
	BuiltinAdapter,
	boot,
	Container,
	collision,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

type AnyAdapter = BuiltinAdapter | MatterAdapter | PlanckAdapter;

interface Backend {
	name: string;
	/** a fresh adapter, at its own default gravity */
	make(): AnyAdapter;
	/** how many bodies the adapter's engine holds */
	bodyCount(adapter: AnyAdapter): number;
}

const BACKENDS: Backend[] = [
	{
		name: "builtin",
		make: () => {
			return new BuiltinAdapter();
		},
		bodyCount: (adapter) => {
			return (adapter as BuiltinAdapter).bodies.size;
		},
	},
	{
		name: "matter",
		make: () => {
			return new MatterAdapter();
		},
		bodyCount: (adapter) => {
			const matter = adapter as MatterAdapter;
			return matter.matter.Composite.allBodies(matter.engine.world).length;
		},
	},
	{
		name: "planck",
		make: () => {
			return new PlanckAdapter();
		},
		bodyCount: (adapter) => {
			return (adapter as PlanckAdapter).world.getBodyCount();
		},
	},
];

const FRAME_MS = 16;
const FLOOR_Y = 500;
const BOX = 32;

type Handlers = Renderable & {
	onCollisionStart?: (response: CollisionInfo, other: Renderable) => void;
	onShapeCollisionStart?: (contact: CollisionInfo, other: Renderable) => void;
};

interface CollisionInfo {
	normal: { x: number; y: number };
	depth: number;
}

// A renderable anchored at its top-left corner, so `pos` is the corner of
// its body, always updated so the built-in adapter integrates it.
const make = (
	x: number,
	y: number,
	w: number,
	h: number,
	def: Renderable["bodyDef"],
): Handlers => {
	const r = new Renderable(x, y, w, h) as Handlers;
	r.anchorPoint.set(0, 0);
	r.alwaysUpdate = true;
	r.bodyDef = def;
	return r;
};

const staticRect = (x: number, y: number, w: number, h: number): Handlers => {
	return make(x, y, w, h, { type: "static", shapes: [new Rect(0, 0, w, h)] });
};

const dynamicBox = (x: number, y: number): Handlers => {
	return make(x, y, BOX, BOX, {
		type: "dynamic",
		shapes: [new Rect(0, 0, BOX, BOX)],
		fixedRotation: true,
	});
};

// a frame, as the engine runs it (the built-in fills its broadphase here)
const run = (world: World, frames: number) => {
	for (let i = 0; i < frames; i++) {
		world.update(FRAME_MS);
	}
};

// the box rests on the floor: its bottom edge on the floor's top edge
const expectLanded = (box: Renderable) => {
	expect(box.pos.y + BOX).toBeGreaterThan(FLOOR_Y - 3);
	expect(box.pos.y + BOX).toBeLessThan(FLOOR_Y + 3);
};

beforeAll(async () => {
	boot();
	const app = new Application(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
	await app.init();
});

describe.each(BACKENDS)("$name adapter", (backend) => {
	it("reports how deep two bodies overlap, in pixels", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		world.addChild(staticRect(0, FLOOR_Y, 800, 64));
		// born 8px into the floor
		const box = dynamicBox(384, FLOOR_Y - BOX + 8);
		const depths: number[] = [];
		box.onCollisionStart = (response) => {
			depths.push(response.depth);
		};
		world.addChild(box);
		run(world, 1);
		expect(depths.length).toBe(1);
		expect(depths[0]).toBeGreaterThan(6);
		expect(depths[0]).toBeLessThan(12);
	});

	it("raycasts onto a body made of several shapes", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const twin = make(300, 300, 80, 20, {
			type: "static",
			shapes: [new Rect(0, 0, 20, 20), new Rect(60, 0, 20, 20)],
		});
		world.addChild(twin);
		run(world, 1);
		const hit = world.adapter.raycast(
			new Vector2d(0, 310),
			new Vector2d(800, 310),
		);
		expect(hit?.renderable).toBe(twin);
		expect(hit?.point.x).toBeCloseTo(300, 0);
	});

	it("a body removed from a collision handler stops colliding", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		world.addChild(staticRect(0, FLOOR_Y, 800, 64));
		const ledge = staticRect(300, 300, 200, 20);
		world.addChild(ledge);
		const box = dynamicBox(384, 200);
		box.onCollisionStart = (_response, other) => {
			if (other === ledge) {
				world.removeChildNow(ledge);
			}
		};
		world.addChild(box);
		run(world, 240);
		// fell through where the ledge was, onto the floor
		expectLanded(box);
		expect(backend.bodyCount(world.adapter)).toBe(2);
	});

	it("the shape hooks get the same normal as the body hooks", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		world.addChild(staticRect(0, FLOOR_Y, 800, 64));
		const box = dynamicBox(384, 400);
		const bodyNormals: { x: number; y: number }[] = [];
		const shapeNormals: { x: number; y: number }[] = [];
		box.onCollisionStart = (response) => {
			bodyNormals.push({ ...response.normal });
		};
		box.onShapeCollisionStart = (contact) => {
			shapeNormals.push({ ...contact.normal });
		};
		world.addChild(box);
		run(world, 240);
		expect(bodyNormals.length).toBe(1);
		expect(shapeNormals.length).toBe(1);
		// the box must move up to leave the floor, from both hooks
		expect(bodyNormals[0].y).toBeLessThan(-0.7);
		expect(shapeNormals[0].x).toBeCloseTo(bodyNormals[0].x, 2);
		expect(shapeNormals[0].y).toBeCloseTo(bodyNormals[0].y, 2);
	});

	it("a body with no collisionMask collides with every collision type", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		// no collisionType, no collisionMask: each adapter's defaults
		world.addChild(staticRect(0, FLOOR_Y, 800, 64));
		const box = dynamicBox(384, 400);
		// a user type past bit 15, as a game with many types defines
		box.bodyDef = {
			...box.bodyDef,
			collisionType: collision.types.USER << 9,
		};
		world.addChild(box);
		run(world, 240);
		expectLanded(box);
	});

	it("setFrictionAir() damps a body as the same bodyDef frictionAir does", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const free = (x: number, frictionAir?: number) => {
			return make(x, 100, BOX, BOX, {
				type: "dynamic",
				shapes: [new Rect(0, 0, BOX, BOX)],
				fixedRotation: false,
				gravityScale: 0,
				frictionAir,
			});
		};
		const declared = free(100, 0.05);
		const assigned = free(500);
		world.addChild(declared);
		world.addChild(assigned);
		const adapter = world.adapter;
		adapter.setFrictionAir(assigned, 0.05);
		for (const r of [declared, assigned]) {
			adapter.setVelocity(r, new Vector2d(2, 0));
			adapter.setAngularVelocity(r, 0.1);
		}
		run(world, 30);
		const v1 = adapter.getVelocity(declared);
		const v2 = adapter.getVelocity(assigned);
		expect(v2.x).toBeCloseTo(v1.x, 4);
		expect(v2.y).toBeCloseTo(v1.y, 4);
		expect(adapter.getAngularVelocity(assigned)).toBeCloseTo(
			adapter.getAngularVelocity(declared),
			4,
		);
	});
});

/** every ordered pair of different backends */
const PAIRS = BACKENDS.flatMap((from) => {
	return BACKENDS.filter((to) => {
		return to !== from;
	}).map((to) => {
		return { from, to, name: `${from.name} to ${to.name}` };
	});
});

describe.each(PAIRS)("world.setAdapter(): $name", ({ from, to }) => {
	/** a floor, and a falling box one level down, as in a group */
	const scene = () => {
		const source = from.make();
		const target = to.make();
		const world = new World(0, 0, 800, 600, source);
		world.addChild(staticRect(0, FLOOR_Y, 800, 64));
		const box = dynamicBox(384, 300);
		const group = new Container(0, 0, 800, 600);
		group.addChild(box);
		world.addChild(group);
		return { world, box, source, target };
	};

	it("moves every body over, and the game carries on", () => {
		const { world, box, source, target } = scene();
		let starts = 0;
		box.onCollisionStart = () => {
			starts++;
		};
		run(world, 5);
		const y = box.pos.y;
		expect(y).toBeGreaterThan(300);
		expect(from.bodyCount(source)).toBe(2);

		world.setAdapter(target);
		expect(world.adapter).toBe(target);
		expect(world.physic).toBe(target.physicLabel);
		// the source is emptied, the target holds both bodies, where they were
		expect(from.bodyCount(source)).toBe(0);
		expect(to.bodyCount(target)).toBe(2);
		expect(box.pos.y).toBeCloseTo(y, 3);

		run(world, 240);
		expectLanded(box);
		// the landing is reported by the new adapter, to the same renderable
		expect(starts).toBe(1);
	});

	it("an adapter swapped out works again when swapped back in", () => {
		const { world, box, source, target } = scene();
		world.setAdapter(target);
		world.setAdapter(source);
		expect(world.adapter).toBe(source);
		expect(from.bodyCount(source)).toBe(2);
		expect(to.bodyCount(target)).toBe(0);
		run(world, 240);
		expectLanded(box);
	});

	it("a swap from a collision handler happens once the step ends", () => {
		const { world, box, source, target } = scene();
		// the adapter active in each call: the source's step, then the
		// target's first, which finds the box already touching the floor
		const seen: unknown[] = [];
		box.onCollisionStart = () => {
			world.setAdapter(target);
			seen.push(world.adapter);
		};
		run(world, 240);
		expect(seen[0]).toBe(source);
		expect(world.adapter).toBe(target);
		// nothing left behind in the source
		expect(from.bodyCount(source)).toBe(0);
		expect(to.bodyCount(target)).toBe(2);
		expectLanded(box);
	});
});
