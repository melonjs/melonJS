/**
 * Box3d SENSOR contacts through a scrolling world (#1476 follow-up).
 *
 * `box3d.spec.js` covers the narrowphase and `Body`; `box3d-world.spec.js`
 * covers Z PUSH-OUT through a real world step. Neither covers the shape an
 * endless-runner actually uses, which is the whole of its collision code:
 *
 * - every body is a SENSOR, so there is no push-out to observe — the only
 *   evidence a contact happened is that `onCollisionStart` ran;
 * - the player is DYNAMIC with `gravityScale = 0` and its `pos` is written by
 *   the game, while the obstacles are STATIC and are MOVED (recycled) between
 *   steps rather than living where they were inserted;
 * - the run travels thousands of units down +Z, so the pair is re-formed at a
 *   different place in the broadphase on every lap.
 *
 * That combination is what this file pins, under BOTH broadphases: a game
 * that leaves `sortOn` at its default gets the `QuadTree`, and one that sets
 * `sortOn = "depth"` gets the `Octree`. A Camera3d game very easily ships on
 * the former without realising it, so the 3D narrowphase has to be reachable
 * from both.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	Box3d,
	boot,
	Container,
	collision,
	Renderable,
	video,
	World,
} from "../src/index.js";

/** roughly the scale an arcade 3D runner works at */
const LANE = 300;
const WATER_Y = -150;

/**
 * A sensor box that records the contacts it receives.
 *
 * `bodyDef` rather than `new Body(...)`: it is the declarative form a game is
 * meant to use, and it is applied by `addChild`, which is also what registers
 * the body with the adapter.
 * @param world - the world to add it to
 * @param opts - placement, size, body type and collision filtering
 * @returns the renderable, with a `hits` array of everything it touched
 */
function addSensor(world, opts) {
	const { x, y, z, w, h, d, type, collisionType, collisionMask } = opts;
	const r = new Renderable(x, y, w, h);
	r.anchorPoint.set(0.5, 0.5);
	// a Renderable is kinematic by default, and a kinematic body is not
	// paired against anything by the broadphase
	r.isKinematic = false;
	r.alwaysUpdate = true;
	r.bodyDef = {
		type,
		gravityScale: 0,
		shapes: [new Box3d(0, 0, 0, w, h, d)],
		collisionType,
		collisionMask,
		isSensor: true,
	};
	r.hits = [];
	// declared on the RENDERABLE: the dispatcher calls the handler on the
	// colliding object and checks `typeof`, so this is how a game opts in
	r.onCollisionStart = (_response, other) => {
		r.hits.push(other);
	};
	world.addChild(r, z);
	r.pos.z = z;
	return r;
}

/** every broadphase a 3D game can end up on, and how it is selected */
const BROADPHASES = [
	{ name: "QuadTree (default sortOn)", sortOn: undefined },
	{ name: "Octree (sortOn = depth)", sortOn: "depth" },
];

describe("Box3d — sensor contacts through a scrolling world", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	for (const broadphase of BROADPHASES) {
		describe(broadphase.name, () => {
			/** @type {World} */
			let world;

			beforeEach(() => {
				world = new World(0, 0, 800, 600);
				if (broadphase.sortOn !== undefined) {
					world.sortOn = broadphase.sortOn;
				}
			});

			it("reports a sensor overlap instead of pushing out", () => {
				const player = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.COLLECTABLE_OBJECT,
				});
				addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 10,
					w: 40,
					h: 40,
					d: 40,
					type: "static",
					collisionType: collision.types.COLLECTABLE_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});

				world.update(16);

				expect(player.hits.length).toBe(1);
				// a sensor reports and does NOT resolve: the overlap is still
				// there afterwards, which is what lets a game own the response
				expect(player.pos.z).toBe(0);
			});

			it("does not report when the boxes are apart in Z only", () => {
				const player = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.COLLECTABLE_OBJECT,
				});
				addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 400,
					w: 40,
					h: 40,
					d: 40,
					type: "static",
					collisionType: collision.types.COLLECTABLE_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});

				world.update(16);

				// the 2D footprints overlap exactly — only the depth separates
				// them, so this is the case a 2D-only pre-gate would get wrong
				expect(player.hits.length).toBe(0);
			});

			it("keeps reporting thousands of units down the run", () => {
				const player = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.COLLECTABLE_OBJECT,
				});
				const prop = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 200,
					w: 40,
					h: 40,
					d: 40,
					type: "static",
					collisionType: collision.types.COLLECTABLE_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});

				// Walk the pair down +Z the way a runner does: the player
				// advances, and the obstacle is RECYCLED ahead of it once it
				// falls behind. Laps are what a fixed-bounds broadphase root
				// eventually runs out of.
				const laps = [];
				for (let lap = 0; lap < 12; lap++) {
					const before = player.hits.length;
					for (let step = 0; step < 40; step++) {
						player.pos.z += 20;
						world.update(16);
					}
					laps.push(player.hits.length - before);
					prop.pos.z = player.pos.z + 200;
				}

				// every lap has to land its contact, not just the early ones
				expect(
					laps.every((count) => {
						return count > 0;
					}),
				).toBe(true);
			});

			it("still reports once the run leaves the broadphase root bounds", () => {
				// the Octree root is a fixed origin-centred ±10000 box, so an
				// endless runner drives straight out of it; out-of-bounds items
				// lose spatial pruning but must NOT lose their contacts
				const farZ = 40000;
				const player = addSensor(world, {
					x: -LANE,
					y: WATER_Y,
					z: farZ,
					w: 40,
					h: 40,
					d: 40,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.ENEMY_OBJECT,
				});
				addSensor(world, {
					x: -LANE,
					y: WATER_Y,
					z: farZ + 10,
					w: 40,
					h: 40,
					d: 40,
					type: "static",
					collisionType: collision.types.ENEMY_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});

				world.update(16);

				expect(player.hits.length).toBe(1);
			});

			it("finds a static obstacle that was MOVED after insertion", () => {
				const player = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.ENEMY_OBJECT,
				});
				const prop = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 5000,
					w: 40,
					h: 40,
					d: 40,
					type: "static",
					collisionType: collision.types.ENEMY_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});

				world.update(16);
				expect(player.hits.length).toBe(0);

				// recycled onto the player: a static body's shape has to track
				// `pos` after insertion, or a recycled obstacle collides where
				// it used to be rather than where it is drawn
				prop.pos.z = 10;
				world.update(16);

				expect(player.hits.length).toBe(1);
			});

			it("respects the collision mask across the 3D pair", () => {
				const player = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					// collectables only — the obstacle below must not report
					collisionMask: collision.types.COLLECTABLE_OBJECT,
				});
				addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "static",
					collisionType: collision.types.ENEMY_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});

				world.update(16);

				expect(player.hits.length).toBe(0);
			});

			it("still pairs once the tree has SUBDIVIDED", () => {
				// The cases above hold two bodies, and a node only splits past
				// `collision.maxChildren` — so they never exercise a
				// subdivided tree at all. A real course carries dozens of
				// props, which is what forces the split, and a pair that lands
				// in different octants is never handed to the narrowphase.
				const player = addSensor(world, {
					x: 0,
					y: WATER_Y,
					z: 700,
					w: 52,
					h: 60,
					d: 92,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.ENEMY_OBJECT,
				});
				// dead centre of the hull, the way a rock the boat drove into is
				const rock = addSensor(world, {
					x: -24,
					y: WATER_Y - 2,
					z: 700,
					w: 92,
					h: 68,
					d: 80,
					type: "static",
					collisionType: collision.types.ENEMY_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});
				// the rest of the course, spread the way a runner spreads it
				for (let i = 0; i < 36; i++) {
					addSensor(world, {
						x: (i % 2 === 0 ? -1 : 1) * (60 + i * 9),
						y: WATER_Y,
						z: 300 + i * 180,
						w: 92,
						h: 68,
						d: 80,
						type: "static",
						collisionType: collision.types.ENEMY_OBJECT,
						collisionMask: collision.types.PLAYER_OBJECT,
					});
				}

				world.update(16);

				expect(player.hits).toContain(rock);
			});

			it("pairs a model-shaped container once it has an extent", () => {
				// The shape a `GLTFModel` has: a `Container`, which carries no
				// dimensions of its own and so reports the EMPTY bounds it was
				// initialised with. The broadphase files every item by
				// `getBounds()`, so one with no extent cannot be placed and
				// silently collides with nothing.
				const player = new Container(0, 0, Infinity, Infinity);
				// a container reports an EMPTY bounds until it has a size of
				// its own — which is what a `GLTFModel` takes from the glTF
				// scene's bounding box
				player.resize(52, 60);
				player.isKinematic = false;
				player.alwaysUpdate = true;
				player.bodyDef = {
					type: "dynamic",
					gravityScale: 0,
					shapes: [new Box3d(0, 0, 0, 52, 60, 92)],
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.ENEMY_OBJECT,
					isSensor: true,
				};
				player.hits = [];
				player.onCollisionStart = (_response, other) => {
					player.hits.push(other);
				};
				world.addChild(player, 700);
				player.pos.set(0, WATER_Y, 700);

				// it reports an extent, so the broadphase can place it
				const bounds = player.updateBounds(true);
				expect(bounds.isFinite()).toBe(true);
				// A container's `anchorPoint` is forced to (0, 0), so its box
				// runs from `pos` rather than centring on it — worth knowing,
				// because the BODY is centred on `pos`, so the two disagree by
				// half the size. `GLTFModel` sidesteps this by placing its own
				// measured extent instead of leaning on `resize`.
				expect(bounds.left).toBe(0);
				expect(bounds.top).toBe(WATER_Y);
				expect(bounds.width).toBe(52);
				expect(bounds.height).toBe(60);

				const rock = addSensor(world, {
					x: -24,
					y: WATER_Y - 2,
					z: 700,
					w: 92,
					h: 68,
					d: 80,
					type: "static",
					collisionType: collision.types.ENEMY_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});
				// enough company to make the tree subdivide around them
				for (let i = 0; i < 36; i++) {
					addSensor(world, {
						x: (i % 2 === 0 ? -1 : 1) * (60 + i * 9),
						y: WATER_Y,
						z: 300 + i * 180,
						w: 92,
						h: 68,
						d: 80,
						type: "static",
						collisionType: collision.types.ENEMY_OBJECT,
						collisionMask: collision.types.PLAYER_OBJECT,
					});
				}

				world.update(16);

				expect(player.hits).toContain(rock);
			});

			it("separates lanes that only differ in X", () => {
				const player = addSensor(world, {
					x: -LANE,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "dynamic",
					collisionType: collision.types.PLAYER_OBJECT,
					collisionMask: collision.types.ENEMY_OBJECT,
				});
				addSensor(world, {
					x: LANE,
					y: WATER_Y,
					z: 0,
					w: 40,
					h: 40,
					d: 40,
					type: "static",
					collisionType: collision.types.ENEMY_OBJECT,
					collisionMask: collision.types.PLAYER_OBJECT,
				});

				world.update(16);

				expect(player.hits.length).toBe(0);
			});
		});
	}
});
