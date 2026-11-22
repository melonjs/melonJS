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

/**
 * A level's layers are in their draw order as soon as the level is loaded.
 *
 * A container draws its children from the last to the first, and keeps them
 * sorted by `z`, highest first. A level adds its layers bottom-most first and
 * then asked for a sort, which the container does on a timer: until the timer
 * fired, the children were in the order they were added, and a frame drawn in
 * between showed the level's layers back to front, the background over
 * everything. Whether a frame falls there is the browser's choice.
 *
 * Checked in the same task as the load, before any timer can fire, for a
 * Tiled map, an LDtk level, an LDtk world, and a level added to a world while
 * the game runs.
 */
const tiledMap = () => {
	const layer = (id, name) => {
		return {
			id,
			name,
			type: "tilelayer",
			visible: true,
			opacity: 1,
			x: 0,
			y: 0,
			width: 4,
			height: 4,
			data: new Array(16).fill(0),
		};
	};
	return {
		type: "map",
		version: "1.10",
		tiledversion: "1.12.0",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 4,
		height: 4,
		tilewidth: 16,
		tileheight: 16,
		nextobjectid: 3,
		tilesets: [],
		layers: [
			layer(1, "ground"),
			layer(2, "walls"),
			{
				id: 3,
				name: "things",
				type: "objectgroup",
				visible: true,
				opacity: 1,
				x: 0,
				y: 0,
				objects: [
					{ id: 1, name: "a", x: 4, y: 4, width: 8, height: 8, visible: true },
					{ id: 2, name: "b", x: 20, y: 4, width: 8, height: 8, visible: true },
				],
			},
			layer(4, "roof"),
		],
	};
};

const ldtkLevel = (identifier, worldX) => {
	const layer = (name, type) => {
		// enough tiles for a grid, and a second one on each cell
		const tiles = [];
		for (let i = 0; i < 40; i++) {
			const px = [(i % 8) * 16, Math.floor(i / 8) * 16];
			tiles.push({ px, src: [0, 0], f: 0, t: 0, a: 1 });
			tiles.push({ px, src: [16, 0], f: 0, t: 1, a: 1 });
		}
		return {
			__identifier: name,
			__type: type,
			__cWid: 8,
			__cHei: 5,
			__gridSize: 16,
			__opacity: 1,
			__pxTotalOffsetX: 0,
			__pxTotalOffsetY: 0,
			__tilesetDefUid: 1,
			__tilesetRelPath: "order-tiles.png",
			iid: `${identifier}-${name}`,
			levelId: 0,
			layerDefUid: 10,
			visible: true,
			intGridCsv: [],
			autoLayerTiles: tiles,
			gridTiles: [],
			entityInstances: [],
		};
	};
	return {
		identifier,
		iid: `${identifier}-iid`,
		uid: 0,
		worldX,
		worldY: 0,
		worldDepth: 0,
		pxWid: 128,
		pxHei: 80,
		__bgColor: "#203040",
		fieldInstances: [],
		// top-most first, as LDtk saves them
		layerInstances: [layer("Roof", "AutoLayer"), layer("Ground", "AutoLayer")],
		__neighbours: [],
	};
};

const ldtkProject = () => {
	return {
		jsonVersion: "1.5.3",
		iid: "order",
		bgColor: "#101010",
		defaultGridSize: 16,
		worldLayout: "Free",
		worldGridWidth: 128,
		worldGridHeight: 128,
		externalLevels: false,
		defs: {
			tilesets: [
				{
					uid: 1,
					identifier: "Tiles",
					relPath: "order-tiles.png",
					pxWid: 32,
					pxHei: 16,
					tileGridSize: 16,
					spacing: 0,
					padding: 0,
					__cWid: 2,
					__cHei: 1,
					customData: [],
					enumTags: [],
				},
			],
			layers: [
				{
					uid: 10,
					identifier: "Auto",
					__type: "AutoLayer",
					gridSize: 16,
					intGridValues: [],
				},
			],
			entities: [],
			enums: [],
		},
		levels: [ldtkLevel("First", 0), ldtkLevel("Second", 128)],
		worlds: [],
	};
};

describe("the draw order of a level's layers, right after it is loaded", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		state.change(state.DEFAULT, true);
		const image = document.createElement("canvas");
		image.width = 32;
		image.height = 16;
		await loader.load({
			name: "order-tiles",
			type: "image",
			src: image.toDataURL("image/png"),
		});
		await loader.preload(
			[
				{ name: "order-tiled", type: "tmx", data: tiledMap() },
				{ name: "order-ldtk", type: "ldtk", data: ldtkProject() },
			],
			undefined,
			false,
		);
	});

	afterAll(() => {
		app?.destroy();
	});

	/** the z of the world's children, in the order the container holds them */
	const order = () => {
		return app.world.getChildren().map((child) => {
			return child.pos.z;
		});
	};

	/** highest first: what a container draws back to front, last to first */
	const expectSorted = (zs) => {
		expect(zs.length).toBeGreaterThan(1);
		expect(zs).toEqual(
			[...zs].sort((a, b) => {
				return b - a;
			}),
		);
	};

	it("a Tiled map", async () => {
		await level.load("order-tiled", { container: app.world, async: true });
		const zs = order();
		// three tile layers and the two objects of the object layer
		expect(zs).toHaveLength(5);
		expectSorted(zs);
		// the roof, the last layer of the map, is drawn last: it is first
		expect(app.world.getChildren()[0].name).toBe("roof");
		expect(app.world.getChildren().at(-1).name).toBe("ground");
	});

	it("an LDtk level", async () => {
		await level.load("order-ldtk:First", { container: app.world, async: true });
		const zs = order();
		// two layers of two grids each
		expect(zs).toHaveLength(4);
		expectSorted(zs);
		expect(app.world.getChildren()[0].name).toBe("Roof");
		expect(app.world.getChildren().at(-1).name).toBe("Ground");
	});

	it("an LDtk world, and a level added to it while the game runs", async () => {
		await level.load("order-ldtk", {
			container: app.world,
			async: true,
			levels: ["First"],
		});
		// the level's background under its layers
		expectSorted(order());
		expect(app.world.getChildren().at(-1).name).toBe("background");
		// a container of the game's own, kept in an order of its own
		const hud = new Container(0, 0, 10, 10);
		hud.autoSort = false;
		for (const z of [1, 5]) {
			const item = new Renderable(0, 0, 4, 4);
			item.name = `item${z}`;
			hud.addChild(item, z);
		}
		app.world.addChild(hud, 100000);
		const hudOrder = () => {
			return hud.getChildren().map((item) => {
				return item.name;
			});
		};
		expect(hudOrder()).toEqual(["item1", "item5"]);
		const world = level.getCurrentLevel();
		world.loadLevel("Second");
		// the level is in its draw order; the game's container is as it was
		expect(hudOrder()).toEqual(["item1", "item5"]);
		app.world.removeChildNow(hud);
		const zs = order();
		expect(zs).toHaveLength(10);
		expectSorted(zs);
		// both backgrounds under every layer
		expect(
			app.world
				.getChildren()
				.slice(-2)
				.map((child) => {
					return child.name;
				}),
		).toEqual(["background", "background"]);
	});
});
