/**
 * Physics bodies of nested children.
 *
 * `Container.addChild` registered the bodies of the added child and of that
 * child's own children, and no further; `removeChildNow` took out the removed
 * child's body and none of its descendants'. So:
 *  - a `bodyDef` two levels down was never registered (`leaf.body` stayed
 *    `undefined`), and the renderable never fell nor collided;
 *  - a group detached with `keepalive` — which is what moving it with
 *    `addChild` does — left its children's bodies in the adapter, still
 *    simulated while out of the world;
 *  - adding that group again registered them a second time, which the builtin
 *    adapter refuses: `other.addChild(group)` on a group holding a `bodyDef`
 *    child threw "BuiltinAdapter.addBody: renderable is already
 *    adapter-managed".
 * The whole subtree is now registered on the way in and unregistered on the way
 * out, at any depth, once each.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	boot,
	Container,
	collision,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

const withBodyDef = (name, x = 0, y = 0, extra = {}) => {
	const r = new Renderable(x, y, 16, 16);
	r.name = name;
	r.alwaysUpdate = true;
	r.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 16, 16)], ...extra };
	return r;
};

const group = (name) => {
	const c = new Container(0, 0, 800, 600);
	c.name = name;
	c.alwaysUpdate = true;
	return c;
};

/** record (by name) the renderables an adapter method is called with */
const spy = (adapter, method) => {
	const calls = [];
	const original = adapter[method].bind(adapter);
	adapter[method] = (renderable, ...rest) => {
		calls.push(renderable.name);
		return original(renderable, ...rest);
	};
	return calls;
};

describe("Container: physics bodies of nested children", () => {
	let app;
	let world;
	let adapter;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
		adapter = world.adapter;
	});

	describe("registration at any depth", () => {
		it("registers a grandchild's bodyDef when its tree is added", () => {
			const outer = group("outer");
			const inner = group("inner");
			const leaf = withBodyDef("leaf");
			inner.addChild(leaf);
			outer.addChild(inner);
			world.addChild(outer);
			expect(leaf.body).toBeInstanceOf(Body);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
		});

		it("registers bodies three levels down, through addChildAt too", () => {
			const a = group("a");
			const b = group("b");
			const c = group("c");
			const leaf = withBodyDef("leaf");
			const legacy = new Renderable(0, 0, 16, 16);
			legacy.body = new Body(legacy, new Rect(0, 0, 16, 16));
			c.addChild(leaf);
			c.addChild(legacy);
			b.addChild(c);
			a.addChild(b);
			world.addChildAt(a, 0);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
			expect(adapter.bodies.has(legacy.body)).toEqual(true);
			expect(adapter.bodies.size).toEqual(2);
		});

		it("registers a child added to a nested container already in the world", () => {
			const outer = group("outer");
			const inner = group("inner");
			outer.addChild(inner);
			world.addChild(outer);
			const leaf = withBodyDef("leaf");
			inner.addChild(leaf);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
		});

		it("does not register anything for a tree outside the world", () => {
			const outer = group("outer");
			const inner = group("inner");
			const leaf = withBodyDef("leaf");
			inner.addChild(leaf);
			outer.addChild(inner);
			expect(leaf.body).toBeUndefined();
			expect(adapter.bodies.size).toEqual(0);
		});

		it("calls adapter.addBody once per body", () => {
			const added = spy(adapter, "addBody");
			const outer = group("outer");
			const inner = group("inner");
			const leaf = withBodyDef("leaf");
			const mid = withBodyDef("mid");
			inner.addChild(leaf);
			outer.addChild(inner);
			outer.addChild(mid);
			world.addChild(outer);
			expect(added).toEqual(["leaf", "mid"]);
		});
	});

	describe("reparenting", () => {
		it("moving a group that holds a bodyDef child to another container does not throw", () => {
			const g = group("g");
			world.addChild(g);
			const leaf = withBodyDef("leaf");
			g.addChild(leaf);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);

			const other = group("other");
			world.addChild(other);
			expect(() => {
				other.addChild(g);
			}).not.toThrow();
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
			expect(adapter.bodies.size).toEqual(1);
		});

		it("moves a three-level tree between containers, keeping every body once", () => {
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf");
			const mid = withBodyDef("mid");
			b.addChild(leaf);
			a.addChild(b);
			a.addChild(mid);
			const left = group("left");
			const right = group("right");
			world.addChild(left);
			world.addChild(right);
			left.addChild(a);
			expect(adapter.bodies.size).toEqual(2);

			const added = spy(adapter, "addBody");
			const removed = spy(adapter, "removeBody");
			right.addChildAt(a, 0);
			left.addChild(a);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
			expect(adapter.bodies.has(mid.body)).toEqual(true);
			expect(adapter.bodies.size).toEqual(2);
			// out and back in, once per body per move
			expect(added.length).toEqual(4);
			expect(removed.length).toEqual(4);
		});

		it("moving a group out of the world takes its bodies out; moving it back puts them back", () => {
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf");
			b.addChild(leaf);
			a.addChild(b);
			world.addChild(a);
			const offstage = group("offstage");
			offstage.addChild(a);
			expect(adapter.bodies.has(leaf.body)).toEqual(false);
			expect(adapter.bodies.size).toEqual(0);
			world.addChild(a);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
		});

		it("moves a nested body into a second world", () => {
			const world2 = new World(0, 0, 800, 600);
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf");
			b.addChild(leaf);
			a.addChild(b);
			world.addChild(a);
			world2.addChild(a);
			expect(adapter.bodies.has(leaf.body)).toEqual(false);
			expect(world2.adapter.bodies.has(leaf.body)).toEqual(true);
		});
	});

	describe("removal at any depth", () => {
		it("removing a group with keepalive takes its children's bodies out, and adding it back does not throw", () => {
			const g = group("g");
			world.addChild(g);
			const leaf = withBodyDef("leaf");
			g.addChild(leaf);

			world.removeChildNow(g, true);
			expect(adapter.bodies.has(leaf.body)).toEqual(false);
			expect(() => {
				world.addChild(g);
			}).not.toThrow();
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
		});

		it("keepalive remove then re-add, three levels deep, twice", () => {
			const a = group("a");
			const b = group("b");
			const c = group("c");
			const leaf = withBodyDef("leaf");
			c.addChild(leaf);
			b.addChild(c);
			a.addChild(b);
			world.addChild(a);
			for (let i = 0; i < 2; i++) {
				world.removeChildNow(a, true);
				expect(adapter.bodies.size).toEqual(0);
				world.addChild(a);
				expect(adapter.bodies.has(leaf.body)).toEqual(true);
				expect(adapter.bodies.size).toEqual(1);
			}
		});

		it("destroying a group takes every body below it out, once each", () => {
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf");
			const mid = withBodyDef("mid");
			b.addChild(leaf);
			a.addChild(b);
			a.addChild(mid);
			world.addChild(a);
			const removed = spy(adapter, "removeBody");
			world.removeChildNow(a);
			expect(adapter.bodies.size).toEqual(0);
			// the group is taken out, then its `destroy()` empties it: one
			// removal each all the same
			expect(removed.sort()).toEqual(["leaf", "mid"]);
		});

		it("keepalive remove, then destroy while detached, removes nothing twice", () => {
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf");
			b.addChild(leaf);
			a.addChild(b);
			world.addChild(a);
			const removed = spy(adapter, "removeBody");
			world.removeChildNow(a, true);
			a.destroy();
			expect(removed).toEqual(["leaf"]);
			expect(adapter.bodies.size).toEqual(0);
		});

		it("takes out a persistent grandchild's body when its non-persistent group is removed", () => {
			const a = group("a");
			const leaf = withBodyDef("leaf");
			leaf.isPersistent = true;
			a.addChild(leaf);
			world.addChild(a);
			world.removeChildNow(a);
			expect(adapter.bodies.has(leaf.body)).toEqual(false);
		});

		it("still removes a body registered by a direct adapter.addBody call", () => {
			const a = group("a");
			const b = group("b");
			const leaf = new Renderable(0, 0, 16, 16);
			b.addChild(leaf);
			a.addChild(b);
			world.addChild(a);
			adapter.addBody(leaf, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 16, 16)],
			});
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
			world.removeChildNow(a, true);
			expect(adapter.bodies.has(leaf.body)).toEqual(false);
		});
	});

	describe("nested bodies are simulated", () => {
		it("gravity moves a grandchild", () => {
			world.gravity.set(0, 1);
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf", 100, 100);
			b.addChild(leaf);
			a.addChild(b);
			world.addChild(a);
			const y0 = leaf.pos.y;
			for (let i = 0; i < 5; i++) {
				world.update(16);
			}
			expect(leaf.pos.y).toBeGreaterThan(y0);
		});

		it("a group kept alive out of the world is not simulated", () => {
			world.gravity.set(0, 1);
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf", 100, 100);
			b.addChild(leaf);
			a.addChild(b);
			world.addChild(a);
			world.removeChildNow(a, true);
			const y0 = leaf.pos.y;
			for (let i = 0; i < 5; i++) {
				world.update(16);
			}
			expect(leaf.pos.y).toEqual(y0);
		});

		it("a nested body and a world body collide", () => {
			const a = group("a");
			const b = group("b");
			const leaf = withBodyDef("leaf", 100, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.ALL_OBJECT,
			});
			b.addChild(leaf);
			a.addChild(b);
			world.addChild(a);
			const wall = withBodyDef("wall", 108, 100, {
				type: "static",
				collisionType: collision.types.WORLD_SHAPE,
				collisionMask: collision.types.ALL_OBJECT,
			});
			world.addChild(wall);
			const hits = [];
			leaf.onCollisionStart = (_response, other) => {
				hits.push(other);
			};
			world.update(16);
			expect(hits).toContain(wall);
		});
	});
});
