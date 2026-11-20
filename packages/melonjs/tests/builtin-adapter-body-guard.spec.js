/**
 * What the built-in adapter makes of the body it is handed.
 *
 * `Renderable#body` is typed as the portable `PhysicsBody`, since another
 * adapter puts a body of its own kind there. The built-in adapter needs its
 * own `Body`, and checks for it where it used to take it on trust: a method
 * that cannot do without one says so in a `TypeError` of its own, the 3D
 * queries answer nothing where there is no octree to walk, and a raycast
 * passes over what is not one of its bodies.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	BuiltinAdapter,
	boot,
	collision,
	Quaternion,
	Rect,
	Renderable,
	Vector2d,
	Vector3d,
	video,
	World,
} from "../src/index.js";

/** every adapter method that cannot do its work without a body */
const NEEDS_A_BODY = {
	setVelocity: (adapter, r) => {
		adapter.setVelocity(r, new Vector2d(1, 2));
	},
	applyForce: (adapter, r) => {
		adapter.applyForce(r, new Vector2d(1, 0));
	},
	applyImpulse: (adapter, r) => {
		adapter.applyImpulse(r, new Vector2d(1, 0));
	},
	setAngle: (adapter, r) => {
		adapter.setAngle(r, 0.5);
	},
	getAngle: (adapter, r) => {
		return adapter.getAngle(r);
	},
	setRotation: (adapter, r) => {
		adapter.setRotation(r, new Quaternion());
	},
	setAngularVelocity: (adapter, r) => {
		adapter.setAngularVelocity(r, 1);
	},
	getAngularVelocity: (adapter, r) => {
		return adapter.getAngularVelocity(r);
	},
	applyTorque: (adapter, r) => {
		adapter.applyTorque(r, 1);
	},
	setStatic: (adapter, r) => {
		adapter.setStatic(r, false);
	},
	setGravityScale: (adapter, r) => {
		adapter.setGravityScale(r, 0.5);
	},
	setFrictionAir: (adapter, r) => {
		adapter.setFrictionAir(r, 0.1);
	},
	setMaxVelocity: (adapter, r) => {
		adapter.setMaxVelocity(r, { x: 3, y: 4 });
	},
	getMaxVelocity: (adapter, r) => {
		return adapter.getMaxVelocity(r);
	},
	setCollisionType: (adapter, r) => {
		adapter.setCollisionType(r, collision.types.ENEMY_OBJECT);
	},
	setCollisionMask: (adapter, r) => {
		adapter.setCollisionMask(r, collision.types.PLAYER_OBJECT);
	},
	setSensor: (adapter, r) => {
		adapter.setSensor(r, true);
	},
	isGrounded: (adapter, r) => {
		return adapter.isGrounded(r);
	},
};

/** the methods that answer for a renderable with no body, as they always did */
const DOES_WITHOUT = {
	getVelocity: (adapter, r) => {
		return adapter.getVelocity(r);
	},
	getVelocity3d: (adapter, r) => {
		return adapter.getVelocity3d(r);
	},
	setPosition: (adapter, r) => {
		adapter.setPosition(r, new Vector2d(5, 6));
	},
	getRotation: (adapter, r) => {
		return adapter.getRotation(r);
	},
	getAngularVelocity3d: (adapter, r) => {
		return adapter.getAngularVelocity3d(r);
	},
	getBodyAABB: (adapter, r) => {
		return adapter.getBodyAABB(r, r.getBounds().clone());
	},
	getBodyShapes: (adapter, r) => {
		return adapter.getBodyShapes(r);
	},
};

describe("BuiltinAdapter: the body it is handed", () => {
	let app;
	let adapter;
	let world;

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
		adapter = new BuiltinAdapter();
		world = new World(0, 0, 800, 600, adapter);
	});

	const plain = () => {
		return new Renderable(0, 0, 32, 32);
	};
	const registered = () => {
		const r = plain();
		adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
		return r;
	};

	describe("a method that needs a body", () => {
		for (const [name, call] of Object.entries(NEEDS_A_BODY)) {
			it(`${name}: says a renderable with no body has none`, () => {
				const r = plain();
				expect(r.body).toBeUndefined();
				expect(() => {
					call(adapter, r);
				}).toThrow(TypeError);
				expect(() => {
					call(adapter, r);
				}).toThrow(/no built-in body/);
			});
		}

		it("says the same of a body of another kind, however alike", () => {
			// what another adapter would leave on a renderable: the method
			// names of a `Body`, and none of its state
			const r = plain();
			r.body = Object.fromEntries(
				Object.keys(NEEDS_A_BODY).map((name) => {
					return [name, () => {}];
				}),
			);
			for (const [name, call] of Object.entries(NEEDS_A_BODY)) {
				expect(() => {
					call(adapter, r);
				}, name).toThrow(/no built-in body/);
			}
		});

		it("works on a body the adapter made", () => {
			for (const [name, call] of Object.entries(NEEDS_A_BODY)) {
				const r = registered();
				expect(() => {
					call(adapter, r);
				}, name).not.toThrow();
			}
		});

		it("does what it did: the body takes what it was given", () => {
			const r = registered();
			adapter.setVelocity(r, new Vector2d(1, 2));
			expect([r.body.vel.x, r.body.vel.y]).toEqual([1, 2]);
			adapter.setAngle(r, 0.5);
			expect(adapter.getAngle(r)).toBeCloseTo(0.5, 6);
			adapter.setAngularVelocity(r, 2);
			expect(adapter.getAngularVelocity(r)).toBe(2);
			adapter.setStatic(r, true);
			expect(r.body.isStatic).toBe(true);
			adapter.setGravityScale(r, 0.25);
			expect(r.body.gravityScale).toBe(0.25);
			adapter.setMaxVelocity(r, { x: 3, y: 4 });
			expect(adapter.getMaxVelocity(r)).toEqual({ x: 3, y: 4 });
			adapter.setCollisionType(r, collision.types.ENEMY_OBJECT);
			expect(r.body.collisionType).toBe(collision.types.ENEMY_OBJECT);
			adapter.setCollisionMask(r, collision.types.PLAYER_OBJECT);
			expect(r.body.collisionMask).toBe(collision.types.PLAYER_OBJECT);
			adapter.setSensor(r, true);
			expect(r.body.isSensor).toBe(true);
		});

		it("works on a body made by hand and never registered, the old way", () => {
			// `this.body = new Body(this, shape)` in a constructor, with the
			// adapter's methods called before the renderable is in a world
			for (const [name, call] of Object.entries(NEEDS_A_BODY)) {
				const r = plain();
				r.body = new Body(r, [new Rect(0, 0, 32, 32)]);
				expect(adapter.bodies.has(r.body)).toBe(false);
				expect(() => {
					call(adapter, r);
				}, name).not.toThrow();
			}
			const r = plain();
			r.body = new Body(r, [new Rect(0, 0, 32, 32)]);
			adapter.setVelocity(r, new Vector2d(7, 8));
			expect([r.body.vel.x, r.body.vel.y]).toEqual([7, 8]);
		});

		it("works on a class of the game's own that extends Body", () => {
			class HeavyBody extends Body {}
			for (const [name, call] of Object.entries(NEEDS_A_BODY)) {
				const r = plain();
				r.body = new HeavyBody(r, [new Rect(0, 0, 32, 32)]);
				expect(() => {
					call(adapter, r);
				}, name).not.toThrow();
			}
		});
	});

	describe("a method that does without a body", () => {
		for (const [name, call] of Object.entries(DOES_WITHOUT)) {
			it(`${name}: answers for a renderable with none`, () => {
				const r = plain();
				expect(() => {
					call(adapter, r);
				}).not.toThrow();
			});
		}

		it("answers with nothing moving, and no shape", () => {
			const r = plain();
			const v = adapter.getVelocity(r);
			expect([v.x, v.y]).toEqual([0, 0]);
			const v3 = adapter.getVelocity3d(r);
			expect([v3.x, v3.y, v3.z]).toEqual([0, 0, 0]);
			expect(adapter.getBodyShapes(r)).toHaveLength(0);
			expect(adapter.getBodyAABB(r, r.getBounds().clone())).toBeUndefined();
		});
	});

	describe("a raycast", () => {
		const wall = (x) => {
			const r = new Renderable(x, 100, 20, 100);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			r.body = new Body(r, [new Rect(0, 0, 20, 100)]);
			world.addChild(r);
			return r;
		};
		const rebuild = () => {
			world.broadphase.clear();
			world.broadphase.insertContainer(world);
		};

		it("passes over what is in the broadphase with a body of another kind", () => {
			const target = wall(300);
			rebuild();
			// in the ray's way, nearer than the wall: one with a body that is
			// not the adapter's, one with none
			const foreign = new Renderable(150, 100, 20, 100);
			foreign.anchorPoint.set(0, 0);
			foreign.body = { collisionType: collision.types.ALL_OBJECT };
			const bare = new Renderable(200, 100, 20, 100);
			bare.anchorPoint.set(0, 0);
			world.broadphase.insert(foreign);
			world.broadphase.insert(bare);

			let hit;
			expect(() => {
				hit = adapter.raycast(new Vector2d(0, 150), new Vector2d(600, 150));
			}).not.toThrow();
			expect(hit).not.toBeNull();
			expect(hit.renderable).toBe(target);
			expect(hit.point.x).toBeCloseTo(300, 3);
		});

		it("still stops at the nearest of its own bodies", () => {
			const near = wall(120);
			wall(300);
			rebuild();
			const hit = adapter.raycast(new Vector2d(0, 150), new Vector2d(600, 150));
			expect(hit.renderable).toBe(near);
		});
	});

	describe("the 3D queries", () => {
		it("answer nothing in a 2D world", () => {
			expect(world.sortOn).toBe("z");
			expect(
				adapter.raycast3d(new Vector3d(0, 0, 0), new Vector3d(1, 1, 1)),
			).toBeNull();
			expect(adapter.querySphere(new Vector3d(0, 0, 0), 100)).toEqual([]);
		});

		it("answer in a world sorted by depth", () => {
			world.sortOn = "depth";
			expect(() => {
				adapter.raycast3d(new Vector3d(0, 0, 0), new Vector3d(1, 1, 1));
				adapter.querySphere(new Vector3d(0, 0, 0), 100);
			}).not.toThrow();
			expect(adapter.querySphere(new Vector3d(0, 0, 0), 100)).toEqual([]);
		});

		it("answer nothing, and do not fail, where there is no octree to walk", () => {
			// a world sorted by depth whose broadphase is something else: no
			// octant to walk, so nothing found, as in a 2D world
			world.sortOn = "depth";
			const octree = world.broadphase;
			world.broadphase = {
				retrieve: () => {
					return [];
				},
				clear: () => {},
			};
			try {
				expect(
					adapter.raycast3d(new Vector3d(0, 0, 0), new Vector3d(1, 1, 1)),
				).toBeNull();
				expect(adapter.querySphere(new Vector3d(0, 0, 0), 100)).toEqual([]);
			} finally {
				world.broadphase = octree;
			}
		});
	});
});
