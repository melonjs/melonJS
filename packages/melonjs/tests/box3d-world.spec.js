/**
 * End-to-end Z resolution through a real world step (#1476).
 *
 * `box3d.spec.js` tests the narrowphase and `Body` in isolation. This file
 * drives the whole path a game actually takes — `world.update()` → adapter
 * step → broadphase → detector → push-out — because that is where the pieces
 * can be individually correct and still not compose: the Octree has to hand
 * the pair over, the 2D bounds pre-gate has to let a depth-only contact
 * through, and the push-out has to land on `pos.z`.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	Box3d,
	boot,
	collision,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

/**
 * A renderable centred on its position carrying a Box3d body.
 *
 * The body is attached BEFORE `addChild`: `Container.addChild` is what
 * registers a body with the adapter (it reads `child.bodyDef` / `child.body`
 * at insertion time), so a body assigned afterwards never enters the
 * simulation and the object silently never collides.
 */
function addBox(world, { x, y, z, w, h, d, isStatic = false, type }) {
	const r = new Renderable(x, y, w, h);
	r.anchorPoint.set(0.5, 0.5);
	r.isKinematic = false;
	r.alwaysUpdate = true;
	r.body = new Body(r, new Box3d(0, 0, 0, w, h, d));
	r.body.collisionType = type ?? collision.types.ENEMY_OBJECT;
	r.body.collisionMask = collision.types.ALL_OBJECT;
	r.body.isStatic = isStatic;
	r.body.gravityScale = 0;
	world.addChild(r, z);
	return r;
}

describe("Box3d — resolution through a full world step", () => {
	/** @type {World} */
	let world;

	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
		// Octree broadphase — this is also what a 2.5D game sets
		world.sortOn = "depth";
	});

	it("pushes a body out of a static wall along Z", () => {
		// mover overlaps the wall by 10 along z and nothing else
		const wall = addBox(world, {
			x: 100,
			y: 100,
			z: 200,
			w: 200,
			h: 200,
			d: 40,
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBox(world, {
			x: 100,
			y: 100,
			z: 170,
			w: 40,
			h: 40,
			d: 40,
			type: collision.types.PLAYER_OBJECT,
		});

		expect(wall).toBeDefined();
		const before = mover.pos.z;
		world.update(16);

		// separated along z, and moved AWAY from the wall (toward -z)
		expect(mover.pos.z).toBeLessThan(before);
		expect(Math.abs(mover.pos.z - 200)).toBeGreaterThanOrEqual(40 / 2 + 40 / 2);
	});

	it("does not push along X or Y when only Z overlaps", () => {
		addBox(world, {
			x: 100,
			y: 100,
			z: 200,
			w: 200,
			h: 200,
			d: 40,
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBox(world, {
			x: 100,
			y: 100,
			z: 170,
			w: 40,
			h: 40,
			d: 40,
			type: collision.types.PLAYER_OBJECT,
		});

		world.update(16);
		expect(mover.pos.x).toBeCloseTo(100, 5);
		expect(mover.pos.y).toBeCloseTo(100, 5);
	});

	it("leaves a body alone when it is separated in Z only", () => {
		// fully overlapping in XY, far apart in Z — the case a 2D shape
		// would call a collision and push apart in the screen plane
		addBox(world, {
			x: 100,
			y: 100,
			z: 600,
			w: 200,
			h: 200,
			d: 40,
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBox(world, {
			x: 100,
			y: 100,
			z: 0,
			w: 40,
			h: 40,
			d: 40,
			type: collision.types.PLAYER_OBJECT,
		});

		world.update(16);
		expect(mover.pos.x).toBeCloseTo(100, 5);
		expect(mover.pos.y).toBeCloseTo(100, 5);
		expect(mover.pos.z).toBeCloseTo(0, 5);
	});

	it("stops Z velocity into the surface", () => {
		addBox(world, {
			x: 100,
			y: 100,
			z: 200,
			w: 200,
			h: 200,
			d: 40,
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBox(world, {
			x: 100,
			y: 100,
			z: 170,
			w: 40,
			h: 40,
			d: 40,
			type: collision.types.PLAYER_OBJECT,
		});
		mover.body.velZ = 5; // driving straight into the wall

		world.update(16);
		expect(mover.body.velZ).toBeLessThanOrEqual(0);
	});

	it("clears forceZ every step, like force", () => {
		// `force` is documented as being cancelled after every update cycle,
		// and callers set it per-frame while a key is held. `forceZ` has to
		// follow the same contract: left uncleared, one frame of input
		// accelerates the body along z forever — which reads to a player as
		// the controls being stuck.
		const mover = addBox(world, {
			x: 100,
			y: 100,
			z: 0,
			w: 40,
			h: 40,
			d: 40,
			type: collision.types.PLAYER_OBJECT,
		});

		mover.body.forceZ = 5;
		world.update(16);
		expect(mover.body.forceZ).toEqual(0);

		// and with no further input the body must stop gaining speed
		const afterFirst = mover.body.velZ;
		world.update(16);
		expect(mover.body.velZ).toBeLessThanOrEqual(afterFirst);
	});

	it("a 2D body pair under the same world is untouched in Z", () => {
		// the compat guarantee, through the full step rather than in isolation
		const a = new Renderable(100, 100, 32, 32);
		a.anchorPoint.set(0.5, 0.5);
		a.isKinematic = false;
		a.alwaysUpdate = true;
		a.body = new Body(a, new Rect(0, 0, 32, 32));
		a.body.collisionType = collision.types.PLAYER_OBJECT;
		a.body.gravityScale = 0;
		world.addChild(a, 50);

		const b = new Renderable(116, 100, 32, 32);
		b.anchorPoint.set(0.5, 0.5);
		b.isKinematic = false;
		b.alwaysUpdate = true;
		b.body = new Body(b, new Rect(0, 0, 32, 32));
		b.body.collisionType = collision.types.ENEMY_OBJECT;
		b.body.gravityScale = 0;
		world.addChild(b, 50);

		world.update(16);

		// they separate in X as they always did, and neither moved in Z
		expect(a.pos.z).toEqual(50);
		expect(b.pos.z).toEqual(50);
		expect(Number.isNaN(a.pos.x)).toBe(false);
	});
});
