/**
 * `World.reset` and the bodies of a persistent container's children.
 *
 * A reset keeps a persistent child with everything below it, but it kept a
 * physics body only when the body's own renderable was flagged
 * `isPersistent`. A persistent HUD or player group therefore came through a
 * state change or a `level.load` with all its children still in the tree and
 * none of their bodies in the simulation: nothing in it fell or collided any
 * more. The bodies of everything the reset keeps are now kept with it.
 */
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import {
	Application,
	Body,
	boot,
	Container,
	level,
	loader,
	Rect,
	Renderable,
	Stage,
	video,
	World,
} from "../src/index.js";
import state from "../src/state/state.ts";

const withBodyDef = (name, x = 0, y = 0) => {
	const r = new Renderable(x, y, 16, 16);
	r.name = name;
	r.alwaysUpdate = true;
	r.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 16, 16)] };
	return r;
};

const group = (name) => {
	const c = new Container(0, 0, 800, 600);
	c.name = name;
	c.alwaysUpdate = true;
	return c;
};

const MAP = {
	type: "map",
	version: "1.10",
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	width: 4,
	height: 4,
	tilewidth: 16,
	tileheight: 16,
	nextlayerid: 2,
	nextobjectid: 1,
	layers: [
		{
			id: 1,
			name: "ground",
			type: "tilelayer",
			visible: true,
			opacity: 1,
			x: 0,
			y: 0,
			width: 4,
			height: 4,
			data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		},
	],
	tilesets: [],
};

describe("World.reset keeps the bodies of what it keeps", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		await loader.preload(
			[{ name: "world-reset-persistent-map", type: "tmx", data: MAP }],
			undefined,
			false,
		);
	});

	afterAll(() => {
		app?.destroy();
	});

	describe("on a standalone world", () => {
		let world;
		let adapter;

		beforeEach(() => {
			world = new World(0, 0, 800, 600);
			adapter = world.adapter;
		});

		it("keeps the body of a persistent container's child", () => {
			const hud = group("hud");
			hud.isPersistent = true;
			const leaf = withBodyDef("leaf");
			hud.addChild(leaf);
			world.addChild(hud);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);

			world.reset();
			expect(world.hasChild(hud)).toEqual(true);
			expect(hud.hasChild(leaf)).toEqual(true);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
		});

		it("keeps bodies three levels below a persistent container, and the container's own", () => {
			const a = group("a");
			a.isPersistent = true;
			a.bodyDef = { type: "static", shapes: [new Rect(0, 0, 16, 16)] };
			const b = group("b");
			const c = group("c");
			const leaf = withBodyDef("leaf");
			const legacy = new Renderable(0, 0, 16, 16);
			legacy.body = new Body(legacy, new Rect(0, 0, 16, 16));
			c.addChild(leaf);
			b.addChild(c);
			b.addChild(legacy);
			a.addChild(b);
			world.addChild(a);
			expect(adapter.bodies.size).toEqual(3);

			world.reset();
			expect(adapter.bodies.has(a.body)).toEqual(true);
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
			expect(adapter.bodies.has(legacy.body)).toEqual(true);
			expect(adapter.bodies.size).toEqual(3);
		});

		it("still drops the bodies of what it removes", () => {
			const hud = group("hud");
			hud.isPersistent = true;
			hud.addChild(withBodyDef("kept"));
			const level1 = group("level");
			const gone = withBodyDef("gone");
			level1.addChild(gone);
			world.addChild(hud);
			world.addChild(level1);
			world.addChild(withBodyDef("direct"));
			expect(adapter.bodies.size).toEqual(3);

			world.reset();
			expect(adapter.bodies.size).toEqual(1);
			expect(adapter.bodies.has(gone.body)).toEqual(false);
		});

		it("still keeps a persistent body whose renderable is outside the tree", () => {
			const loose = new Renderable(0, 0, 16, 16);
			loose.isPersistent = true;
			loose.body = new Body(loose, new Rect(0, 0, 16, 16));
			world.addBody(loose.body);
			world.reset();
			expect(adapter.bodies.has(loose.body)).toEqual(true);
		});

		it("a persistent group's child still falls after a reset", () => {
			world.gravity.set(0, 1);
			const hud = group("hud");
			hud.isPersistent = true;
			const inner = group("inner");
			const leaf = withBodyDef("leaf", 100, 100);
			inner.addChild(leaf);
			hud.addChild(inner);
			world.addChild(hud);
			world.reset();
			const y0 = leaf.pos.y;
			for (let i = 0; i < 5; i++) {
				world.update(16);
			}
			expect(leaf.pos.y).toBeGreaterThan(y0);
		});

		it("the kept bodies can still be moved and removed without throwing", () => {
			const hud = group("hud");
			hud.isPersistent = true;
			const leaf = withBodyDef("leaf");
			hud.addChild(leaf);
			world.addChild(hud);
			world.reset();
			const other = group("other");
			world.addChild(other);
			expect(() => {
				other.addChild(hud);
			}).not.toThrow();
			expect(adapter.bodies.has(leaf.body)).toEqual(true);
			world.removeChildNow(other);
			expect(adapter.bodies.size).toEqual(0);
		});
	});

	describe("through the application", () => {
		let hud;
		let leaf;
		let transient;

		beforeEach(() => {
			state.stop();
			hud = group("hud");
			hud.isPersistent = true;
			const inner = group("inner");
			leaf = withBodyDef("leaf", 100, 100);
			inner.addChild(leaf);
			hud.addChild(inner);
			app.world.addChild(hud);
			// not persistent: proves the world was really reset
			transient = withBodyDef("transient");
			app.world.addChild(transient);
		});

		afterEach(async () => {
			state.stop();
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			if (hud.ancestor) {
				hud.ancestor.removeChildNow(hud);
			}
		});

		it("keeps the nested body across a level.load", async () => {
			expect(app.world.adapter.bodies.has(leaf.body)).toEqual(true);
			await level.load("world-reset-persistent-map", { async: true });
			expect(app.world.hasChild(transient)).toEqual(false);
			expect(app.world.hasChild(hud)).toEqual(true);
			expect(app.world.adapter.bodies.has(leaf.body)).toEqual(true);
		});

		it("keeps the nested body across a state change", async () => {
			class Screen extends Stage {}
			state.set(state.USER + 7, new Screen());
			state.change(state.USER + 7, true);
			await new Promise((resolve) => {
				setTimeout(resolve, 50);
			});
			expect(state.isCurrent(state.USER + 7)).toEqual(true);
			expect(app.world.hasChild(transient)).toEqual(false);
			expect(app.world.hasChild(hud)).toEqual(true);
			expect(app.world.adapter.bodies.has(leaf.body)).toEqual(true);
		});
	});
});
