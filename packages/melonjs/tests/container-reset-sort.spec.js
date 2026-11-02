/**
 * A reset keeps the sort pending for the children it keeps.
 *
 * Adding a child queues a sort for the next tick. `Container#reset` cancels
 * that sort, then removes every child that is not persistent. The
 * persistent ones it keeps were then left in the order they were added,
 * their depth ignored, until something else sorted the container. The usual
 * way to get there: a screen adds its persistent objects (a sky behind, a
 * HUD in front) and loads a level straight away. `level.load` resets the
 * world, and the sky stayed drawn over everything.
 *
 * Order is read as the children array, which `Container.draw` walks
 * backwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	level,
	loader,
	Renderable,
	state,
	video,
} from "../src/index.js";

const MAP = {
	type: "map",
	version: "1.10",
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	width: 2,
	height: 2,
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
			width: 2,
			height: 2,
			data: [0, 0, 0, 0],
		},
	],
	tilesets: [],
};

/** the next tick, where a deferred sort runs */
const nextTick = () => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

const named = (name, persistent = true) => {
	const r = new Renderable(0, 0, 10, 10);
	r.name = name;
	r.isPersistent = persistent;
	return r;
};

const names = (container) => {
	return container.getChildren().map((child) => {
		return child.name;
	});
};

/** the order `container` would have once sorted */
const sortedNames = (container) => {
	const order = [...container.getChildren()].sort(container._comparator);
	return order.map((child) => {
		return child.name;
	});
};

describe("Container#reset and a pending sort", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		// without switching to the loading screen
		await loader.preload(
			[{ name: "reset-sort-map", type: "tmx", data: MAP }],
			undefined,
			false,
		);
	});

	afterAll(() => {
		app?.destroy();
	});

	it("sorts the persistent children a reset keeps", async () => {
		const c = new Container(0, 0, 100, 100);
		// added back first: children are appended and the array is topmost
		// first, so this order is wrong until sorted
		c.addChild(named("back"), -10);
		c.addChild(named("middle"), 0);
		c.addChild(named("front"), 10);
		c.addChild(named("level", false), 5);
		const expected = sortedNames(c).filter((name) => {
			return name !== "level";
		});
		expect(expected).toEqual(["front", "middle", "back"]);
		c.reset();
		expect(names(c)).not.toContain("level");
		await nextTick();
		expect(names(c)).toEqual(expected);
	});

	it("queues no sort when none was pending", () => {
		const c = new Container(0, 0, 100, 100);
		c.addChild(named("a"), 1);
		c.sortNow();
		clearTimeout(c.pendingSort);
		c.pendingSort = null;
		c.reset();
		expect(c.pendingSort).toBe(null);
	});

	it("queues no sort when it keeps no children", () => {
		const c = new Container(0, 0, 100, 100);
		c.addChild(named("gone", false), 1);
		c.reset();
		expect(c.pendingSort).toBe(null);
	});

	it("queues no sort on a destroyed container", () => {
		const c = new Container(0, 0, 100, 100);
		c.addChild(named("kept"), 1);
		c.addChild(named("other"), 2);
		c.destroy();
		expect(c.pendingSort).toBe(null);
	});

	it("keeps the depth order of what a screen added just before level.load", async () => {
		const world = app.world;
		// a screen's own persistent objects, a sky behind, a HUD in front and
		// a container for the level between them, with a level loaded into
		// that container straight after
		const board = new Container(0, 0, 100, 100);
		board.name = "board";
		board.isPersistent = true;
		world.addChild(named("sky"), -10);
		world.addChild(board, 0);
		world.addChild(named("hud"), 10);
		state.stop();
		await level.load("reset-sort-map", {
			container: board,
			setViewportBounds: false,
			async: true,
		});
		await nextTick();
		// the HUD over the level, the level over the sky
		expect(names(world)).toEqual(["hud", "board", "sky"]);
		for (const child of [...world.getChildren()]) {
			world.removeChildNow(child);
		}
	});
});
