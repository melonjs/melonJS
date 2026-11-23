import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	collision,
	level,
	loader,
	state,
	TMXLayer,
	TMXTileMap,
	video,
} from "../src/index.js";
import { copyFrame } from "./helpers/pixels.js";

/**
 * A tile map is one asset under three type names: `"tmx"`, `"tilemap"` and
 * `"spritefusion"`. One parser and one reader take them all, and take a map
 * in the words of either editor: Tiled's (`width`, `tilewidth`, a layer's
 * `data`, `properties`) or Sprite Fusion's (`mapWidth`, `tileSize`, a layer's
 * `tiles`, `attributes`).
 *
 * The Sprite Fusion fixtures are written for these tests in the form of
 * exports made with the editor: `map.tmx` and `map.json` are the same map
 * through its two exports, `instance/map.json` one with attributes given to
 * one placed tile at a time.
 */

const TILE = 16;

const MAP_TMX = new URL("./fixtures/spritefusion/map.tmx", import.meta.url)
	.href;
const MAP_JSON = new URL("./fixtures/spritefusion/map.json", import.meta.url)
	.href;
const SHEET = new URL(
	"./fixtures/spritefusion/spritesheet.png",
	import.meta.url,
).href;
const INSTANCE_JSON = new URL(
	"./fixtures/spritefusion/instance/map.json",
	import.meta.url,
).href;
// a folder with no spritesheet.png in it: a Sprite Fusion map, and a Tiled one
const NO_SHEET_JSON = new URL(
	"./fixtures/spritefusion/nosheet/map.json",
	import.meta.url,
).href;
const NO_SHEET_TILED = new URL(
	"./fixtures/spritefusion/nosheet/tiled.json",
	import.meta.url,
).href;

// the four tiles of `spritesheet.png`, and those of the other map's
const GROUND = [0, 160, 0];
const LAVA = [200, 0, 0];
const SKY = [0, 0, 200];
const PICKUP = [220, 220, 0];
const OTHER_FLOOR = [120, 60, 0];
const OTHER_DOOR = [200, 0, 200];

/** what the map of `map.tmx` / `map.json` shows, cell by cell */
const PICTURE = [
	[SKY, SKY, SKY, SKY, SKY, SKY],
	[SKY, PICKUP, SKY, SKY, SKY, SKY],
	[SKY, SKY, SKY, SKY, GROUND, SKY],
	[GROUND, GROUND, LAVA, LAVA, GROUND, GROUND],
];

/** the attributes the lava tile was given in the editor */
const LAVA_ATTRIBUTES = {
	type: "lava",
	damage: 25,
	slow: 0.5,
	isSolid: false,
	isDangerous: true,
};

const preload = (assets) => {
	return loader.preload(assets, undefined, false);
};

const makeApp = async (renderer, width = 6 * TILE, height = 4 * TILE) => {
	boot();
	const app = new Application(width, height, {
		parent: "screen",
		renderer,
		consoleHeader: false,
		antiAlias: false,
	});
	await app.init();
	state.change(state.DEFAULT, true);
	return app;
};

const loadLevel = async (app, name) => {
	app.world.reset();
	await level.load(name, { container: app.world, async: true });
	return level.getCurrentLevel();
};

/** the gid in every cell of a layer, row by row */
const cellsOf = (layer) => {
	const cells = [];
	for (let row = 0; row < layer.rows; row++) {
		const line = [];
		for (let col = 0; col < layer.cols; col++) {
			line.push(layer.layerData[(row * layer.cols + col) * 2]);
		}
		cells.push(line);
	}
	return cells;
};

/** the walls in the world: layer, place and size, top to bottom */
const wallsOf = (app) => {
	return app.world
		.getChildren()
		.filter((child) => {
			return child.bodyDef?.collisionType === collision.types.WORLD_SHAPE;
		})
		.map((wall) => {
			return [wall.layer, wall.pos.x, wall.pos.y, wall.width, wall.height];
		})
		.sort((a, b) => {
			return a[2] - b[2] || a[1] - b[1];
		});
};

/** the colour in the middle of every cell of the frame just drawn */
const coloursOf = (app, cols, rows) => {
	app.world.update(16);
	app.viewport.update(16);
	app.repaint();
	app.draw();
	const frame = copyFrame(app.renderer);
	const picture = [];
	for (let row = 0; row < rows; row++) {
		const line = [];
		for (let col = 0; col < cols; col++) {
			const at =
				((row * TILE + TILE / 2) * frame.width + col * TILE + TILE / 2) * 4;
			line.push([frame.data[at], frame.data[at + 1], frame.data[at + 2]]);
		}
		picture.push(line);
	}
	return picture;
};

/** the properties of every cell of a layer that has some */
const propertiesOf = (layer) => {
	const found = {};
	for (let row = 0; row < layer.rows; row++) {
		for (let col = 0; col < layer.cols; col++) {
			const properties = layer.getProperties(col, row);
			if (properties !== undefined) {
				found[`${col},${row}`] = properties;
			}
		}
	}
	return found;
};

/** a tileset over the test spritesheet, loaded by the game as `spritesheet` */
const tilesetJSON = (extra = {}) => {
	return {
		firstgid: 1,
		name: "tiles",
		image: "spritesheet.png",
		tilewidth: TILE,
		tileheight: TILE,
		...extra,
	};
};

/** a map as Tiled writes it in JSON: 4 x 2 tiles */
const tiledJSON = (layers, extra = {}) => {
	return {
		type: "map",
		version: "1.10",
		tiledversion: "1.11.0",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 4,
		height: 2,
		tilewidth: TILE,
		tileheight: TILE,
		nextobjectid: 1,
		tilesets: [tilesetJSON()],
		layers,
		...extra,
	};
};

const tiledLayer = (name, data, extra = {}) => {
	return {
		type: "tilelayer",
		name,
		visible: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 4,
		height: 2,
		data,
		...extra,
	};
};

describe("the asset types of a tile map", () => {
	let app;

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
		await preload([{ name: "spritesheet", type: "image", src: SHEET }]);
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it('"tilemap" loads a map given inline, as a level', async () => {
		const before = level.levelCount();
		await preload([
			{
				name: "types-inline",
				type: "tilemap",
				data: tiledJSON([tiledLayer("floor", [0, 0, 0, 0, 1, 1, 2, 1])]),
			},
		]);
		expect(level.levelCount()).toBe(before + 1);
		const map = await loadLevel(app, "types-inline");
		expect(map).toBeInstanceOf(TMXTileMap);
		const [floor] = map.getLayers();
		expect(floor).toBeInstanceOf(TMXLayer);
		expect(cellsOf(floor)).toEqual([
			[0, 0, 0, 0],
			[1, 1, 2, 1],
		]);
	});

	it('"tilemap" loads a file as "tmx" does: the same map', async () => {
		await preload([
			{ name: "types-as-tmx", type: "tmx", src: MAP_TMX },
			{ name: "types-as-tilemap", type: "tilemap", src: MAP_TMX },
		]);
		const asTmx = await loadLevel(app, "types-as-tmx");
		const tmxCells = asTmx.getLayers().map(cellsOf);
		const tmxPicture = coloursOf(app, 6, 4);
		const asTilemap = await loadLevel(app, "types-as-tilemap");
		expect(asTilemap.getLayers().map(cellsOf)).toEqual(tmxCells);
		expect(coloursOf(app, 6, 4)).toEqual(tmxPicture);
		expect(tmxPicture).toEqual(PICTURE);
	});

	it("keeps one map a name, whichever of the type names asks", async () => {
		const first = tiledJSON([tiledLayer("first", new Array(8).fill(1))]);
		const second = tiledJSON([tiledLayer("second", new Array(8).fill(2))]);
		await preload([{ name: "types-once", type: "tilemap", data: first }]);
		const count = level.levelCount();
		// the name is taken: nothing is read again under another type name
		await preload([{ name: "types-once", type: "tmx", data: second }]);
		await preload([{ name: "types-once", type: "spritefusion", data: second }]);
		expect(loader.getTMX("types-once")).toBe(first);
		expect(level.levelCount()).toBe(count);
	});

	it("is freed under any of the type names", async () => {
		for (const [loadedAs, freedAs] of [
			["tilemap", "tilemap"],
			["tilemap", "tmx"],
			["tmx", "tilemap"],
			["spritefusion", "tmx"],
			["tmx", "spritefusion"],
		]) {
			const name = `types-free-${loadedAs}-${freedAs}`;
			await preload([
				{
					name,
					type: loadedAs,
					data: tiledJSON([tiledLayer("floor", new Array(8).fill(1))]),
				},
			]);
			expect(loader.getTMX(name), name).not.toBeNull();
			expect(loader.unload({ name, type: freedAs }), name).toBe(true);
			expect(loader.getTMX(name), name).toBeNull();
			expect(loader.unload({ name, type: freedAs }), name).toBe(false);
		}
	});

	it("leaves the level director when its bundle is unloaded", async () => {
		for (const type of ["tmx", "tilemap", "spritefusion"]) {
			const name = `types-bundled-${type}`;
			loader.setBundle(`bundle-${type}`, [
				{
					name,
					type,
					data: tiledJSON([tiledLayer("floor", new Array(8).fill(1))]),
				},
			]);
			const before = level.levelCount();
			await loader.load(`bundle-${type}`);
			expect(level.levelCount(), type).toBe(before + 1);
			loader.unload(`bundle-${type}`);
			expect(level.levelCount(), type).toBe(before);
			expect(loader.getTMX(name), type).toBeNull();
		}
	});

	it("takes a base URL of its own, and the one set for every type", async () => {
		const dir = MAP_TMX.slice(0, MAP_TMX.lastIndexOf("/") + 1);
		try {
			loader.setBaseURL("tilemap", dir);
			await preload([{ name: "types-base", type: "tilemap", src: "map.tmx" }]);
			expect(loader.getTMX("types-base")).not.toBeNull();

			loader.setBaseURL("tilemap", "");
			loader.setBaseURL("*", dir);
			await preload([
				{ name: "types-base-all", type: "tilemap", src: "map.tmx" },
				{ name: "types-base-fusion", type: "spritefusion", src: "map.json" },
			]);
			expect(loader.getTMX("types-base-all")).not.toBeNull();
			expect(loader.getTMX("types-base-fusion")).not.toBeNull();
			// and the spritesheet next to the map is not prefixed twice
			expect(loader.getImage("types-base-fusion~spritesheet")).not.toBeNull();
		} finally {
			loader.setBaseURL("*", "");
		}
	});

	it('"tsx", a tileset on its own, is still not a level', async () => {
		const before = level.levelCount();
		await preload([
			{ name: "types-tileset", type: "tsx", data: tilesetJSON() },
		]);
		expect(loader.getTMX("types-tileset")).not.toBeNull();
		expect(level.levelCount()).toBe(before);
	});
});

describe.each([
	["Canvas", video.CANVAS],
	["WebGL", video.WEBGL],
])("a Sprite Fusion map, through its two exports (%s)", (label, renderer) => {
	const json = `fusion-json-${label}`;
	const tmx = `fusion-tmx-${label}`;
	let app;

	beforeAll(async () => {
		app = await makeApp(renderer);
		await preload([
			{ name: json, type: "spritefusion", src: MAP_JSON },
			{ name: tmx, type: "spritefusion", src: MAP_TMX },
		]);
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it("comes with its spritesheet, under a name of the map's own", () => {
		expect(loader.getImage(`${json}~spritesheet`)).not.toBeNull();
		expect(loader.getImage(`${tmx}~spritesheet`)).not.toBeNull();
		// not under the file's name, which every map of the editor's has
		expect(loader.getImage("spritesheet")).toBeNull();
	});

	it("is kept as the file has it: nothing is rewritten", async () => {
		const file = await (await fetch(MAP_JSON)).json();
		expect(loader.getTMX(json)).toEqual(file);
		// nor by reading it into a level, twice
		await loadLevel(app, json);
		await loadLevel(app, json);
		expect(loader.getTMX(json)).toEqual(file);
		expect(
			loader.getTMX(json).layers.map((layer) => {
				return layer.name;
			}),
		).toEqual(["Pickups", "Ground", "Background"]);
	});

	it("has its layers bottom first, the file's top one last", async () => {
		for (const name of [json, tmx]) {
			const map = await loadLevel(app, name);
			const layers = map.getLayers();
			expect(
				layers.map((layer) => {
					return [layer.name, layer.collider];
				}),
				name,
			).toEqual([
				["Background", false],
				["Ground", true],
				["Pickups", false],
			]);
			for (const layer of layers) {
				expect(layer).toBeInstanceOf(TMXLayer);
				expect(layer.getOpacity()).toBe(1);
				expect([layer.cols, layer.rows]).toEqual([6, 4]);
			}
			// drawn in that order
			expect(layers[0].pos.z).toBeLessThan(layers[1].pos.z);
			expect(layers[1].pos.z).toBeLessThan(layers[2].pos.z);
			expect([map.cols, map.rows, map.tilewidth, map.tileheight]).toEqual([
				6,
				4,
				TILE,
				TILE,
			]);
			expect(map.orientation).toBe("orthogonal");
		}
	});

	it("holds the same tile in every cell, from either export", async () => {
		const fromTmx = (await loadLevel(app, tmx)).getLayers().map(cellsOf);
		const fromJson = (await loadLevel(app, json)).getLayers().map(cellsOf);
		expect(fromJson).toEqual(fromTmx);
		// and they are the map's: the floor, lava in the middle of it
		expect(fromJson[1]).toEqual([
			[0, 0, 0, 0, 0, 0],
			[0, 0, 0, 0, 0, 0],
			[0, 0, 0, 0, 1, 0],
			[1, 1, 2, 2, 1, 1],
		]);
	});

	it("draws the map, tile by tile, from either export", async () => {
		for (const name of [json, tmx]) {
			await loadLevel(app, name);
			expect(coloursOf(app, 6, 4), name).toEqual(PICTURE);
		}
	});

	it("makes the same walls of the collider layers, from either export", async () => {
		for (const name of [json, tmx]) {
			await loadLevel(app, name);
			expect(wallsOf(app), name).toEqual([
				["Ground", 4 * TILE, 2 * TILE, TILE, TILE],
				["Ground", 0, 3 * TILE, 6 * TILE, TILE],
			]);
		}
	});

	it("gives a tile's attributes by its cell, the same from either export", async () => {
		const expected = [
			{},
			{ "2,3": LAVA_ATTRIBUTES, "3,3": LAVA_ATTRIBUTES },
			{ "1,1": { spawn: "enemy" } },
		];
		for (const name of [json, tmx]) {
			const layers = (await loadLevel(app, name)).getLayers();
			expect(layers.map(propertiesOf), name).toEqual(expected);
			// each of its type: a number, a boolean, not their text
			const lava = layers[1].getProperties(2, 3);
			expect(lava.damage).toBe(25);
			expect(lava.slow).toBe(0.5);
			expect(lava.isSolid).toBe(false);
			expect(lava.isDangerous).toBe(true);
			expect(lava.type).toBe("lava");
		}
	});

	it("keeps them where each export has them: on the tileset, or on the cell", async () => {
		// the TMX export gives them to the tile in the tileset
		const [, tmxGround] = (await loadLevel(app, tmx)).getLayers();
		const tile = tmxGround.cellAt(2, 3);
		expect(tile.tileset.getTileProperties(tile.tileId)).toEqual(
			LAVA_ATTRIBUTES,
		);
		expect(tmxGround.cellProperties).toBeNull();
		// the JSON export to each place the tile is in
		const [, jsonGround] = (await loadLevel(app, json)).getLayers();
		const placed = jsonGround.cellAt(2, 3);
		expect(placed.tileset.getTileProperties(placed.tileId)).toBeUndefined();
		expect(jsonGround.cellProperties.size).toBe(2);
	});
});

describe("Sprite Fusion maps, each with a spritesheet of its own", () => {
	let app;

	const loadBoth = () => {
		return preload([
			{ name: "sheets-first", type: "spritefusion", src: MAP_JSON },
			{ name: "sheets-second", type: "spritefusion", src: INSTANCE_JSON },
		]);
	};

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
	});

	beforeEach(async () => {
		loader.unloadAll();
		await loadBoth();
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it("draws each from the file next to it, though both are spritesheet.png", async () => {
		const first = await loadLevel(app, "sheets-first");
		const firstImage = first.getLayers()[0].tileset.image;
		expect(coloursOf(app, 6, 4)).toEqual(PICTURE);

		const second = await loadLevel(app, "sheets-second");
		const secondImage = second.getLayers()[0].tileset.image;
		expect(secondImage).not.toBe(firstImage);
		expect(firstImage).toBe(loader.getImage("sheets-first~spritesheet"));
		expect(secondImage).toBe(loader.getImage("sheets-second~spritesheet"));
		// a door top left, the floor under it, in the second map's colours
		const picture = coloursOf(app, 4, 2);
		expect(picture[0][0]).toEqual(OTHER_DOOR);
		expect(picture[0][2]).toEqual(OTHER_DOOR);
		expect(picture[1]).toEqual([
			OTHER_FLOOR,
			OTHER_FLOOR,
			OTHER_FLOOR,
			OTHER_DOOR,
		]);
	});

	it("gives attributes set on one placed tile to that cell alone", async () => {
		const map = await loadLevel(app, "sheets-second");
		const [floor, doors] = map.getLayers();
		expect([floor.name, doors.name]).toEqual(["Floor", "Doors"]);
		// three doors of the same tile: one locked, one not, one with nothing
		expect([
			cellsOf(doors)[0][0],
			cellsOf(doors)[0][2],
			cellsOf(doors)[1][3],
		]).toEqual([4, 4, 4]);
		expect(propertiesOf(doors)).toEqual({
			"0,0": { locked: true, key: "red" },
			"2,0": { locked: false },
		});
		expect(doors.getProperties(3, 1)).toBeUndefined();
		expect(propertiesOf(floor)).toEqual({});
		// nothing was given to the tile itself
		expect(doors.tileset.getTileProperties(4)).toBeUndefined();
		expect(wallsOf(app)).toEqual([["Floor", 0, TILE, 4 * TILE, TILE]]);
	});

	it("frees a map's spritesheet with the map, and no other", async () => {
		expect(loader.unload({ name: "sheets-first", type: "spritefusion" })).toBe(
			true,
		);
		expect(loader.getImage("sheets-first~spritesheet")).toBeNull();
		expect(loader.getImage("sheets-second~spritesheet")).not.toBeNull();
		// the other still draws
		await loadLevel(app, "sheets-second");
		expect(coloursOf(app, 4, 2)[1][0]).toEqual(OTHER_FLOOR);
		// and the first comes back whole
		await preload([
			{ name: "sheets-first", type: "spritefusion", src: MAP_JSON },
		]);
		expect(loader.getImage("sheets-first~spritesheet")).not.toBeNull();
		await loadLevel(app, "sheets-first");
		expect(coloursOf(app, 6, 4)).toEqual(PICTURE);
	});

	it("frees it under the map's other type names too", async () => {
		expect(loader.unload({ name: "sheets-second", type: "tmx" })).toBe(true);
		expect(loader.getImage("sheets-second~spritesheet")).toBeNull();
		expect(loader.getImage("sheets-first~spritesheet")).not.toBeNull();
	});

	it("frees it with the bundle the map is in", async () => {
		loader.unloadAll();
		loader.setBundle("sheets-bundle", [
			{ name: "sheets-bundled", type: "spritefusion", src: MAP_JSON },
		]);
		await loader.load("sheets-bundle");
		expect(loader.getImage("sheets-bundled~spritesheet")).not.toBeNull();
		loader.unload("sheets-bundle");
		expect(loader.getImage("sheets-bundled~spritesheet")).toBeNull();
		expect(loader.getTMX("sheets-bundled")).toBeNull();
	});

	it("leaves an image the game loaded as spritesheet alone", async () => {
		await preload([{ name: "spritesheet", type: "image", src: SHEET }]);
		const own = loader.getImage("spritesheet");
		// the map does not take it for its own, nor frees it
		const map = await loadLevel(app, "sheets-second");
		expect(map.getLayers()[0].tileset.image).not.toBe(own);
		loader.unload({ name: "sheets-second", type: "spritefusion" });
		loader.unload({ name: "sheets-first", type: "spritefusion" });
		expect(loader.getImage("spritesheet")).toBe(own);
	});
});

describe("a Sprite Fusion map under another type, or with no file", () => {
	let app;

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
	});

	beforeEach(() => {
		loader.unloadAll();
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it('is read under "tilemap" and "tmx" too, from the game\'s own spritesheet', async () => {
		for (const type of ["tilemap", "tmx"]) {
			const name = `plain-${type}`;
			await preload([{ name, type, src: MAP_JSON }]);
			// nothing was loaded with it
			expect(loader.getImage(`${name}~spritesheet`)).toBeNull();
			expect(loader.getImage("spritesheet")).toBeNull();
			// so it says which image it wants
			await expect(loadLevel(app, name)).rejects.toThrow(/spritesheet/);
			await preload([{ name: "spritesheet", type: "image", src: SHEET }]);
			await loadLevel(app, name);
			expect(coloursOf(app, 6, 4), type).toEqual(PICTURE);
			loader.unloadAll();
		}
	});

	it("is read from inline data, from the game's own spritesheet", async () => {
		const file = await (await fetch(MAP_JSON)).json();
		await preload([
			{ name: "spritesheet", type: "image", src: SHEET },
			{ name: "inline-fusion", type: "spritefusion", data: file },
		]);
		expect(loader.getTMX("inline-fusion")).toBe(file);
		expect(loader.getImage("inline-fusion~spritesheet")).toBeNull();
		await loadLevel(app, "inline-fusion");
		expect(coloursOf(app, 6, 4)).toEqual(PICTURE);
		expect(wallsOf(app)).toHaveLength(2);
	});

	it("fails to load when its spritesheet is not next to it, and leaves nothing", async () => {
		const before = level.levelCount();
		await expect(
			preload([{ name: "no-sheet", type: "spritefusion", src: NO_SHEET_JSON }]),
		).rejects.toThrow();
		expect(loader.getTMX("no-sheet")).toBeNull();
		expect(loader.getImage("no-sheet~spritesheet")).toBeNull();
		expect(level.levelCount()).toBe(before);
	});

	it("asks for no spritesheet for a map that draws from other images", async () => {
		// a Tiled map under the type, in a folder with no spritesheet.png:
		// asking for one would fail the load
		await preload([
			{ name: "tiles", type: "image", src: SHEET },
			{ name: "not-fusion", type: "spritefusion", src: NO_SHEET_TILED },
		]);
		expect(loader.getImage("not-fusion~spritesheet")).toBeNull();
		const map = await loadLevel(app, "not-fusion");
		expect(cellsOf(map.getLayers()[0])[0]).toEqual([1, 1, 1, 1]);
	});
});

describe("a Sprite Fusion file that is odd, or wrong", () => {
	let app;
	let serial = 0;

	/** load a map given inline, drawn from the test spritesheet */
	const load = async (data) => {
		const name = `odd-${serial++}`;
		await preload([{ name, type: "spritefusion", data }]);
		return loadLevel(app, name);
	};

	const fusion = (layers, extra = {}) => {
		return { tileSize: TILE, mapWidth: 4, mapHeight: 2, layers, ...extra };
	};

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
		await preload([{ name: "spritesheet", type: "image", src: SHEET }]);
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it("takes a tile's id as text or as a number", async () => {
		const map = await load(
			fusion([
				{
					name: "ids",
					tiles: [
						{ id: "1", x: 0, y: 0 },
						{ id: 1, x: 1, y: 0 },
						{ id: "03", x: 2, y: 0 },
					],
					collider: false,
				},
			]),
		);
		expect(cellsOf(map.getLayers()[0])[0]).toEqual([2, 2, 4, 0]);
	});

	it("leaves out a tile that is not in the map, or is no tile", async () => {
		const map = await load(
			fusion([
				{
					name: "strays",
					tiles: [
						{ id: "0", x: 0, y: 0 },
						{ id: "0", x: -1, y: 0 },
						{ id: "0", x: 4, y: 0 },
						{ id: "0", x: 0, y: 2 },
						{ id: "0", x: 0, y: -1 },
						{ id: "0", x: 1.5, y: 0 },
						{ id: "0", x: "one", y: 0 },
						{ id: "0", y: 0 },
						{ id: "lava", x: 2, y: 0 },
						{ id: "-1", x: 2, y: 0 },
						{ id: "1.5", x: 2, y: 0 },
						{ x: 2, y: 0 },
						{ id: "", x: 3, y: 1 },
						// between two cells: not in the one before it either
						{ id: "0", x: 1, y: 1 },
						{ id: "2", x: 1.5, y: 1 },
						{ id: "2", x: 1, y: 0.5 },
					],
					collider: true,
				},
			]),
		);
		const [layer] = map.getLayers();
		// (an id of no text is 0, the first tile: what `Number("")` is)
		expect(cellsOf(layer)).toEqual([
			[1, 0, 0, 0],
			[0, 1, 0, 1],
		]);
		// nothing else was written: no tile, and no flip of one
		expect(Array.from(layer.layerData)).toEqual([
			1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
		]);
		// and no wall for a tile that is not there
		expect(wallsOf(app)).toEqual([
			["strays", 0, 0, TILE, TILE],
			["strays", TILE, TILE, TILE, TILE],
			["strays", 3 * TILE, TILE, TILE, TILE],
		]);
	});

	it("keeps the last of two tiles in one cell, with its attributes alone", async () => {
		const map = await load(
			fusion([
				{
					name: "twice",
					tiles: [
						{ id: "0", x: 1, y: 1, attributes: { first: true } },
						{ id: "3", x: 1, y: 1, attributes: { second: true } },
						{ id: "2", x: 2, y: 1, attributes: { gone: true } },
						{ id: "1", x: 2, y: 1 },
					],
					collider: false,
				},
			]),
		);
		const [layer] = map.getLayers();
		expect(cellsOf(layer)[1]).toEqual([0, 4, 2, 0]);
		expect(layer.getProperties(1, 1)).toEqual({ second: true });
	});

	it("reads a layer with no tiles, and skips one that lists none", async () => {
		const map = await load(
			fusion([
				{ name: "top", tiles: [{ id: "0", x: 0, y: 0 }], collider: false },
				{ name: "nothing", collider: true },
				{ name: "empty", tiles: [], collider: true },
			]),
		);
		expect(
			map.getLayers().map((layer) => {
				return layer.name;
			}),
		).toEqual(["empty", "top"]);
		expect(wallsOf(app)).toEqual([]);
	});

	it("makes a layer solid only for a collider that is true", async () => {
		const tiles = [{ id: "0", x: 0, y: 0 }];
		const map = await load(
			fusion([
				{ name: "missing", tiles },
				{ name: "text", tiles, collider: "true" },
				{ name: "one", tiles, collider: 1 },
				{ name: "off", tiles, collider: false },
				{ name: "on", tiles, collider: true },
			]),
		);
		expect(wallsOf(app)).toEqual([["on", 0, 0, TILE, TILE]]);
		// and the layer says so in a word: true, false, or nothing
		expect(
			map.getLayers().map((layer) => {
				return [layer.name, layer.collider];
			}),
		).toEqual([
			["on", true],
			["off", false],
			["one", undefined],
			["text", undefined],
			["missing", undefined],
		]);
	});

	it("takes an attribute as it is written: no text is run or converted", async () => {
		globalThis.__fusionRan = false;
		const attributes = {
			run: "eval:globalThis.__fusionRan = true",
			data: 'json:{"a":1}',
			flag: "true",
			number: "12",
			empty: "",
			nothing: null,
			list: [1, "two"],
			nested: { deep: { deeper: 1 } },
		};
		const map = await load(
			fusion([
				{
					name: "attrs",
					tiles: [{ id: "0", x: 0, y: 0, attributes }],
					collider: false,
				},
			]),
		);
		const read = map.getLayers()[0].getProperties(0, 0);
		expect(read).toEqual(attributes);
		expect(read.run).toBe("eval:globalThis.__fusionRan = true");
		expect(read.flag).toBe("true");
		expect(read.number).toBe("12");
		expect(read.empty).toBe("");
		expect(globalThis.__fusionRan).toBe(false);
		delete globalThis.__fusionRan;
	});

	it("ignores attributes that are not a set of values", async () => {
		const map = await load(
			fusion([
				{
					name: "bad",
					tiles: [
						{ id: "0", x: 0, y: 0, attributes: null },
						{ id: "0", x: 1, y: 0, attributes: "lava" },
						{ id: "0", x: 2, y: 0, attributes: 7 },
					],
					collider: false,
				},
			]),
		);
		const [layer] = map.getLayers();
		expect(cellsOf(layer)[0]).toEqual([1, 1, 1, 0]);
		for (const col of [0, 1, 2]) {
			expect(layer.getProperties(col, 0) ?? {}).toEqual({});
		}
	});

	it("leaves out a tile the spritesheet does not have, and says so once", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {
			// kept quiet
		});
		try {
			const map = await load(
				fusion([
					{
						name: "past",
						tiles: [
							{ id: "3", x: 0, y: 0 },
							// the sheet holds four tiles
							{ id: "4", x: 1, y: 0, attributes: { lost: true } },
							{ id: "99", x: 2, y: 0 },
							{ id: "70000", x: 3, y: 0 },
						],
						collider: true,
					},
				]),
			);
			const [layer] = map.getLayers();
			expect(cellsOf(layer)[0]).toEqual([4, 0, 0, 0]);
			expect(layer.getProperties(1, 0)).toBeUndefined();
			expect(wallsOf(app)).toEqual([["past", 0, 0, TILE, TILE]]);
			// and the level draws, frame after frame
			expect(() => {
				coloursOf(app, 4, 2);
				coloursOf(app, 4, 2);
			}).not.toThrow();
			const said = warn.mock.calls.filter(([message]) => {
				return String(message).includes('layer "past" places tile');
			});
			expect(said.length).toBeGreaterThan(0);
			expect(String(said[0][0])).toContain("tile 4");
		} finally {
			warn.mockRestore();
		}
	});

	it("reads a map with no layer", async () => {
		const map = await load(fusion([]));
		expect(map.getLayers()).toEqual([]);
		expect([map.cols, map.rows]).toEqual([4, 2]);
	});

	it("is Tiled's when it has Tiled's words: its order kept, its sizes used", async () => {
		// the words of both: the map's are Tiled's
		const map = await load(
			tiledJSON(
				[
					tiledLayer("bottom", new Array(8).fill(1)),
					tiledLayer("top", new Array(8).fill(2)),
				],
				{ tileSize: 99, mapWidth: 99, mapHeight: 99 },
			),
		);
		expect([map.cols, map.rows, map.tilewidth, map.tileheight]).toEqual([
			4,
			2,
			TILE,
			TILE,
		]);
		expect(
			map.getLayers().map((layer) => {
				return layer.name;
			}),
		).toEqual(["bottom", "top"]);
	});
});

describe("attributes beside properties, in a map of Tiled's form", () => {
	let app;
	let serial = 0;

	const load = async (data) => {
		const name = `both-${serial++}`;
		await preload([{ name, type: "tilemap", data }]);
		return loadLevel(app, name);
	};

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
		await preload([{ name: "spritesheet", type: "image", src: SHEET }]);
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it("reads both on a layer, the attribute kept where they share a name", async () => {
		const map = await load(
			tiledJSON([
				tiledLayer("floor", new Array(8).fill(1), {
					properties: [
						{ name: "speed", type: "int", value: 3 },
						{ name: "mood", type: "string", value: "calm" },
					],
					attributes: { mood: "angry", depth: 2, hidden: false },
				}),
			]),
		);
		const [floor] = map.getLayers();
		expect(floor.speed).toBe(3);
		expect(floor.mood).toBe("angry");
		expect(floor.depth).toBe(2);
		expect(floor.hidden).toBe(false);
	});

	it("still converts a property's text, and leaves an attribute's alone", async () => {
		const map = await load(
			tiledJSON([
				tiledLayer("floor", new Array(8).fill(1), {
					properties: [{ name: "fromProperty", type: "string", value: "12" }],
					attributes: { fromAttribute: "12" },
				}),
			]),
		);
		const [floor] = map.getLayers();
		expect(floor.fromProperty).toBe(12);
		expect(floor.fromAttribute).toBe("12");
	});

	it("makes a layer solid by a collider attribute as by the property", async () => {
		await load(
			tiledJSON([
				tiledLayer("by-attribute", [1, 0, 0, 0, 0, 0, 0, 0], {
					attributes: { collider: true },
				}),
				tiledLayer("by-property", [0, 0, 0, 0, 0, 0, 0, 1], {
					properties: [{ name: "collider", type: "bool", value: true }],
				}),
				tiledLayer("not", [0, 1, 0, 0, 0, 0, 0, 0], {
					attributes: { collider: false },
				}),
			]),
		);
		expect(wallsOf(app)).toEqual([
			["by-attribute", 0, 0, TILE, TILE],
			["by-property", 3 * TILE, TILE, TILE, TILE],
		]);
	});

	it("reads both on the map and on an object", async () => {
		const map = await load(
			tiledJSON(
				[
					tiledLayer("floor", new Array(8).fill(1)),
					{
						type: "objectgroup",
						name: "things",
						visible: true,
						opacity: 1,
						x: 0,
						y: 0,
						objects: [
							{
								id: 1,
								name: "door",
								type: "",
								x: 0,
								y: 0,
								width: TILE,
								height: TILE,
								rotation: 0,
								visible: true,
								properties: [{ name: "locked", type: "bool", value: true }],
								attributes: { key: "red" },
							},
						],
					},
				],
				{
					properties: [{ name: "music", type: "string", value: "cave" }],
					attributes: { gravity: 0.5 },
				},
			),
		);
		expect(map.music).toBe("cave");
		expect(map.gravity).toBe(0.5);
		const [door] = app.world.getChildByName("door");
		expect(door).toBeDefined();
	});

	it("reads both on a tile of a tileset", async () => {
		const map = await load(
			tiledJSON([tiledLayer("floor", [1, 2, 3, 4, 0, 0, 0, 0])], {
				tilesets: [
					tilesetJSON({
						tiles: [
							{
								id: 0,
								properties: [{ name: "solid", type: "bool", value: true }],
							},
							{ id: 1, attributes: { type: "lava", damage: 25 } },
							{
								id: 2,
								properties: [
									{ name: "solid", type: "bool", value: true },
									{ name: "type", type: "string", value: "stone" },
								],
								attributes: { type: "ice", slippery: true },
							},
						],
					}),
				],
			}),
		);
		const [floor] = map.getLayers();
		const tileset = floor.tileset;
		expect(tileset.getTileProperties(1)).toEqual({ solid: true });
		expect(tileset.getTileProperties(2)).toEqual({ type: "lava", damage: 25 });
		expect(tileset.getTileProperties(3)).toEqual({
			solid: true,
			type: "ice",
			slippery: true,
		});
		expect(tileset.getTileProperties(4)).toBeUndefined();
		// and by the cell, as for any map
		expect(propertiesOf(floor)).toEqual({
			"0,0": { solid: true },
			"1,0": { type: "lava", damage: 25 },
			"2,0": { solid: true, type: "ice", slippery: true },
		});
	});

	it("reads a layer given as a list of tiles, counted from the first tileset", async () => {
		const map = await load(
			tiledJSON(
				[
					{
						type: "tilelayer",
						name: "listed",
						visible: true,
						opacity: 1,
						tiles: [
							{ id: 0, x: 0, y: 0 },
							{
								id: 3,
								x: 3,
								y: 1,
								properties: [{ name: "open", type: "bool", value: true }],
								attributes: { key: "blue" },
							},
						],
					},
				],
				{ tilesets: [tilesetJSON({ firstgid: 5 })] },
			),
		);
		const [layer] = map.getLayers();
		// the size of the map, as the layer gives none
		expect([layer.cols, layer.rows]).toEqual([4, 2]);
		expect(cellsOf(layer)).toEqual([
			[5, 0, 0, 0],
			[0, 0, 0, 8],
		]);
		expect(layer.getProperties(3, 1)).toEqual({ open: true, key: "blue" });
		// in the order Tiled gives layers: this is not a Sprite Fusion file
		expect(layer.getOpacity()).toBe(1);
	});

	it("reads a layer's cells, not its list, when it has both", async () => {
		const map = await load(
			tiledJSON([
				tiledLayer("both", [1, 1, 1, 1, 0, 0, 0, 0], {
					tiles: [{ id: 3, x: 0, y: 1 }],
				}),
			]),
		);
		expect(cellsOf(map.getLayers()[0])).toEqual([
			[1, 1, 1, 1],
			[0, 0, 0, 0],
		]);
	});

	it("reads an image layer that has attributes and no properties", async () => {
		const map = await load(
			tiledJSON([
				tiledLayer("floor", new Array(8).fill(1)),
				{
					type: "imagelayer",
					name: "backdrop",
					image: "spritesheet.png",
					visible: true,
					opacity: 1,
					x: 0,
					y: 0,
					attributes: { mood: "calm" },
				},
			]),
		);
		expect(app.world.getChildByName("backdrop")).toHaveLength(1);
		expect(map.getLayers()).toHaveLength(2);
	});
});

describe("the properties of a cell", () => {
	let app;
	let layer;
	const SHARED = { type: "lava", damage: 25 };

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
		await preload([
			{ name: "spritesheet", type: "image", src: SHEET },
			{
				name: "cells",
				type: "tilemap",
				data: tiledJSON([tiledLayer("floor", [1, 2, 2, 0, 0, 0, 0, 3])], {
					tilesets: [tilesetJSON({ tiles: [{ id: 1, attributes: SHARED }] })],
				}),
			},
		]);
	});

	beforeEach(async () => {
		[layer] = (await loadLevel(app, "cells")).getLayers();
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it("are those of its tile in the tileset, when it has none of its own", () => {
		expect(layer.getProperties(1, 0)).toEqual(SHARED);
		expect(layer.getProperties(2, 0)).toEqual(SHARED);
		// a tile with none, and no tile
		expect(layer.getProperties(0, 0)).toBeUndefined();
		expect(layer.getProperties(3, 0)).toBeUndefined();
	});

	it("has its own over the tileset's, which stay what they were", () => {
		layer.setProperties(1, 0, { damage: 99, cursed: true });
		expect(layer.getProperties(1, 0)).toEqual({
			type: "lava",
			damage: 99,
			cursed: true,
		});
		// the other cell of the same tile, and the tileset
		expect(layer.getProperties(2, 0)).toEqual(SHARED);
		expect(layer.tileset.getTileProperties(2)).toEqual({
			type: "lava",
			damage: 25,
		});
		expect(SHARED).toEqual({ type: "lava", damage: 25 });
	});

	it("has its own alone, on a tile the tileset says nothing of", () => {
		const own = { locked: true };
		layer.setProperties(0, 0, own);
		expect(layer.getProperties(0, 0)).toEqual(own);
		expect(layer.getProperties(3, 1)).toBeUndefined();
	});

	it("loses its own when they are taken back", () => {
		layer.setProperties(1, 0, { cursed: true });
		layer.setProperties(1, 0);
		expect(layer.getProperties(1, 0)).toEqual(SHARED);
		layer.setProperties(1, 0, { cursed: true });
		layer.setProperties(1, 0, null);
		expect(layer.getProperties(1, 0)).toEqual(SHARED);
		// taking back what was never given is nothing
		layer.setProperties(3, 1);
		expect(layer.getProperties(3, 1)).toBeUndefined();
	});

	it("loses its own when another tile is put there, by any way", () => {
		const own = { cursed: true };
		// setCell
		layer.setProperties(0, 0, own);
		layer.setCell(0, 0, 1);
		expect(layer.getProperties(0, 0)).toBeUndefined();
		// setTile
		layer.setProperties(0, 0, own);
		layer.setTile(layer.getTileById(2, 0, 0), 0, 0);
		expect(layer.getProperties(0, 0)).toEqual(SHARED);
		// clearTile, and a tile put back after
		layer.setProperties(0, 0, own);
		layer.clearTile(0, 0);
		expect(layer.getProperties(0, 0)).toBeUndefined();
		layer.setCell(0, 0, 1);
		expect(layer.getProperties(0, 0)).toBeUndefined();
		// the cell next to it kept its own all along
		layer.setProperties(1, 0, own);
		layer.setCell(0, 0, 3);
		expect(layer.getProperties(1, 0)).toEqual({ ...SHARED, cursed: true });
	});

	it("has none while it holds no tile, whatever it was given", () => {
		layer.setProperties(3, 0, { ghost: true });
		expect(layer.getProperties(3, 0)).toBeUndefined();
		// and the tile put there later does not inherit them
		layer.setCell(3, 0, 1);
		expect(layer.getProperties(3, 0)).toBeUndefined();
	});

	it("is nothing outside the layer, and giving there does nothing", () => {
		for (const [col, row] of [
			[-1, 0],
			[0, -1],
			[4, 0],
			[0, 2],
			[Number.NaN, 0],
			[0, Number.NaN],
			[Number.POSITIVE_INFINITY, 0],
			[undefined, undefined],
		]) {
			expect(() => {
				layer.setProperties(col, row, { stray: true });
			}).not.toThrow();
			expect(layer.getProperties(col, row)).toBeUndefined();
		}
		// none of them landed in a cell of the layer
		expect(propertiesOf(layer)).toEqual({ "1,0": SHARED, "2,0": SHARED });
		expect(layer.cellProperties).toBeNull();
	});

	it("takes the cell a position is in, as the other cell methods do", () => {
		layer.setProperties(0.9, 0.9, { here: true });
		expect(layer.getProperties(0, 0)).toEqual({ here: true });
		expect(layer.getProperties(0.2, 0.7)).toEqual({ here: true });
		expect(layer.getProperties(1.5, 0)).toEqual(SHARED);
	});

	it("names a cell in the map's coordinates, on a map that starts left of 0", async () => {
		const chunk = new Array(16 * 16).fill(0);
		chunk[0] = 2;
		chunk[1] = 1;
		await preload([
			{
				name: "cells-infinite",
				type: "tilemap",
				data: tiledJSON(
					[
						{
							type: "tilelayer",
							name: "wide",
							visible: true,
							opacity: 1,
							x: 0,
							y: 0,
							startx: -16,
							starty: 0,
							width: 16,
							height: 16,
							chunks: [{ x: -16, y: 0, width: 16, height: 16, data: chunk }],
						},
					],
					{
						infinite: true,
						tilesets: [tilesetJSON({ tiles: [{ id: 1, attributes: SHARED }] })],
					},
				),
			},
		]);
		const [wide] = (await loadLevel(app, "cells-infinite")).getLayers();
		expect(wide.startx).toBe(-16);
		expect(wide.getProperties(-16, 0)).toEqual(SHARED);
		expect(wide.getProperties(-15, 0)).toBeUndefined();
		wide.setProperties(-15, 0, { marked: true });
		expect(wide.getProperties(-15, 0)).toEqual({ marked: true });
		// not the cell of the same number counted from the layer's corner
		expect(wide.getProperties(1, 0)).toBeUndefined();
		expect(wide.getProperties(-17, 0)).toBeUndefined();
		wide.setCell(-15, 0, 2);
		expect(wide.getProperties(-15, 0)).toEqual(SHARED);
	});

	it("starts again with the level: what a game gave is not kept", async () => {
		layer.setProperties(0, 0, { cursed: true });
		[layer] = (await loadLevel(app, "cells")).getLayers();
		expect(layer.getProperties(0, 0)).toBeUndefined();
	});
});
