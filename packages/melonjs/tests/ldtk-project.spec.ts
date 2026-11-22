import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Application,
	type LDtkLayerInstance,
	type LDtkLevel,
	type LDtkLevelJson,
	type LDtkProject,
	type LDtkProjectJson,
	type LDtkTile,
	LDtkWorld,
	level,
	loader,
	type Renderable,
	video,
} from "../src/index.js";
import {
	diff,
	enter,
	frame,
	HEIGHT,
	makeApp,
	referenceLevel,
	referenceView,
	WIDTH,
} from "./helpers/ldtk-harness.ts";

/**
 * What the samples that come with LDtk do not hold, in a project made for
 * the test: a tileset whose tiles are not the size of the layer's cells, a
 * layer moved and faded, tiles past the level's edges, text and enum tags
 * on tiles, level fields, and a project of several worlds.
 */
const TILE = 16;

/** a tileset image: eight 16 px tiles, each its own color with a white corner */
const tilesetImage = () => {
	const canvas = document.createElement("canvas");
	canvas.width = TILE * 4;
	canvas.height = TILE * 2;
	const c = canvas.getContext("2d") as CanvasRenderingContext2D;
	for (let id = 0; id < 8; id++) {
		const x = (id % 4) * TILE;
		const y = Math.floor(id / 4) * TILE;
		c.fillStyle = `rgb(${String(30 + id * 28)}, ${String(230 - id * 25)}, ${String((id * 67) % 256)})`;
		c.fillRect(x, y, TILE, TILE);
		c.fillStyle = "#ffffff";
		c.fillRect(x, y, 5, 3);
	}
	return canvas.toDataURL("image/png");
};

const tile = (x: number, y: number, t: number, f = 0, a = 1): LDtkTile => {
	return {
		px: [x, y],
		src: [(t % 4) * TILE, Math.floor(t / 4) * TILE],
		f,
		t,
		a,
	};
};

const layer = (
	identifier: string,
	type: string,
	gridSize: number,
	cols: number,
	rows: number,
	tiles: LDtkTile[],
	extra: Partial<LDtkLayerInstance> = {},
): LDtkLayerInstance => {
	return {
		__identifier: identifier,
		__type: type,
		__cWid: cols,
		__cHei: rows,
		__gridSize: gridSize,
		__opacity: 1,
		__pxTotalOffsetX: 0,
		__pxTotalOffsetY: 0,
		__tilesetDefUid: 1,
		__tilesetRelPath: "art/ldtk-test-tiles.png",
		iid: `${identifier}-iid`,
		levelId: 0,
		layerDefUid: type === "Tiles" ? 10 : 11,
		visible: true,
		intGridCsv: [],
		autoLayerTiles: type === "Tiles" ? [] : tiles,
		gridTiles: type === "Tiles" ? tiles : [],
		entityInstances: [],
		...extra,
	};
};

const levelJson = (
	identifier: string,
	layers: LDtkLayerInstance[],
	extra: Partial<LDtkLevelJson> = {},
): LDtkLevelJson => {
	return {
		identifier,
		iid: `${identifier}-iid`,
		uid: 0,
		worldX: 0,
		worldY: 0,
		worldDepth: 0,
		pxWid: 160,
		pxHei: 96,
		__bgColor: "#203040",
		fieldInstances: [],
		layerInstances: layers,
		__neighbours: [],
		...extra,
	};
};

const defs = (): LDtkProjectJson["defs"] => {
	return {
		tilesets: [
			{
				uid: 1,
				identifier: "Tiles",
				relPath: "art/ldtk-test-tiles.png",
				pxWid: 64,
				pxHei: 32,
				tileGridSize: TILE,
				spacing: 0,
				padding: 0,
				__cWid: 4,
				__cHei: 2,
				customData: [
					{ tileId: 3, data: "slippery" },
					{ tileId: 5, data: '{"damage": 2}' },
				],
				enumTags: [
					{ enumValueId: "Solid", tileIds: [0, 1, 5] },
					{ enumValueId: "Hazard", tileIds: [5] },
				],
			},
		],
		layers: [
			{
				uid: 10,
				identifier: "Tiles",
				type: "Tiles",
				gridSize: 8,
				intGridValues: [],
			},
			{
				uid: 11,
				identifier: "Auto",
				type: "AutoLayer",
				gridSize: 16,
				intGridValues: [],
			},
		],
		entities: [],
		enums: [],
	};
};

/** a level of layers a grid alone cannot hold */
const oddLevel = () => {
	// on a grid of 16: a full floor, a second tile on two cells in three,
	// mirrored ones, and tiles reaching past the level's edges
	const auto: LDtkTile[] = [];
	for (let row = 0; row < 6; row++) {
		for (let col = 0; col < 10; col++) {
			auto.push(tile(col * 16, row * 16, (col + row) % 8, (col + row) % 4));
			if ((col + row) % 3 !== 0) {
				auto.push(tile(col * 16, row * 16, (col * 3 + row) % 8));
			}
		}
	}
	auto.push(tile(-8, 24, 6), tile(40, -8, 7), tile(152, 88, 2));
	// on a grid of 8, with tiles of 16: every tile overlaps its neighbours,
	// some are faded, the layer is moved and half transparent
	const small: LDtkTile[] = [];
	for (let i = 0; i < 40; i++) {
		small.push(
			tile(
				8 + ((i * 24) % 136),
				8 + ((i * 16) % 72),
				i % 8,
				i % 4,
				i % 5 === 0 ? 0.5 : 1,
			),
		);
	}
	// hidden in LDtk: not drawn, whatever it holds
	const hidden: LDtkTile[] = [];
	for (let i = 0; i < 60; i++) {
		hidden.push(tile((i % 10) * 16, Math.floor(i / 10) * 16, 4));
	}
	return levelJson("Odd", [
		layer("Hidden", "AutoLayer", 16, 10, 6, hidden, { visible: false }),
		layer("Small", "Tiles", 8, 20, 12, small, {
			__opacity: 0.5,
			__pxTotalOffsetX: 6,
			__pxTotalOffsetY: -4,
		}),
		layer("Auto", "AutoLayer", 16, 10, 6, auto),
	]);
};

/**
 * an entity, as LDtk saves it
 * @param identifier - its identifier
 * @param x - where its pivot is
 * @param y - where its pivot is
 * @returns the entity
 */
const entity = (identifier: string, x: number, y: number) => {
	return {
		__identifier: identifier,
		iid: `${identifier}-iid`,
		defUid: 1,
		px: [x, y] as [number, number],
		__pivot: [0, 0] as [number, number],
		__grid: [0, 0] as [number, number],
		width: 16,
		height: 16,
		__tags: [],
		fieldInstances: [],
	};
};

/** a level whose layers are faded, or hidden in LDtk */
const fadedLevel = () => {
	const walls = new Array<number>(60).fill(0);
	for (let col = 0; col < 10; col++) {
		walls[5 * 10 + col] = 1;
	}
	return levelJson("Faded", [
		layer("Faded_things", "Entities", 16, 10, 6, [], {
			__opacity: 0.5,
			__tilesetDefUid: null,
			entityInstances: [entity("Lamp", 16, 16)],
		}),
		layer("Hidden_things", "Entities", 16, 10, 6, [], {
			visible: false,
			__tilesetDefUid: null,
			entityInstances: [entity("Ghost", 48, 16)],
		}),
		// hidden in the editor, to see the art: still the level's floor
		layer("Collisions", "IntGrid", 16, 10, 6, [], {
			visible: false,
			__tilesetDefUid: null,
			intGridCsv: walls,
		}),
	]);
};

describe("an LDtk project made for the test", () => {
	let app: Application;

	const current = () => {
		return level.getCurrentLevel() as unknown as LDtkLevel;
	};

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
		// the tileset, loaded by the game under its file's name
		await loader.load({
			name: "ldtk-test-tiles",
			type: "image",
			src: tilesetImage(),
		});
		const single: LDtkProjectJson = {
			jsonVersion: "1.5.3",
			iid: "single",
			bgColor: "#101010",
			defaultGridSize: 16,
			worldLayout: "Free",
			worldGridWidth: 256,
			worldGridHeight: 256,
			externalLevels: false,
			defs: defs(),
			levels: [
				oddLevel(),
				fadedLevel(),
				levelJson("Fields", [], {
					fieldInstances: [
						{ __identifier: "music", __type: "String", __value: "cave.ogg" },
						{ __identifier: "gravity", __type: "Float", __value: 0.5 },
						{ __identifier: "boss", __type: "Bool", __value: true },
						{ __identifier: "next", __type: "String", __value: null },
					],
				}),
			],
			worlds: [],
		};
		const multi: LDtkProjectJson = {
			...single,
			iid: "multi",
			worldLayout: null,
			levels: [],
			worlds: [
				{
					identifier: "Overworld",
					iid: "w1",
					worldLayout: "Free",
					worldGridWidth: 256,
					worldGridHeight: 256,
					levels: [
						levelJson("Field", [], { worldX: 0, worldY: 0 }),
						levelJson("Forest", [], { worldX: 160, worldY: 0 }),
					],
				},
				{
					identifier: "Underworld",
					iid: "w2",
					worldLayout: "LinearHorizontal",
					worldGridWidth: 256,
					worldGridHeight: 256,
					levels: [
						levelJson("Cave", [], { worldX: -1, worldY: -1 }),
						levelJson("Lair", [], { worldX: -1, worldY: -1 }),
					],
				},
			],
		};
		await loader.preload(
			[
				{ name: "single", type: "ldtk", data: single },
				{ name: "multi", type: "ldtk", data: multi },
			],
			undefined,
			false,
		);
	});

	afterAll(() => {
		app.destroy();
	});

	it("draws layers a grid cannot hold as LDtk does: other tile sizes, offsets, opacity, tiles past the edges", async () => {
		const project = loader.getLDtk("single") as LDtkProject;
		const info = project.getLevel("Odd");
		expect(info).toBeDefined();
		if (info === undefined) {
			return;
		}
		await enter(app, info.id);
		// the layer of 16 px tiles on 8 px cells is all placed tiles; the
		// other is two grids, and a list for the tiles past the edges
		const kinds = current().layers.map((part) => {
			return `${part.name}:${part.constructor.name.replace(/^_/, "")}`;
		});
		expect(kinds).toEqual([
			"Auto:TileLayer",
			"Auto:TileLayer",
			"Auto:PlacedTileLayer",
			"Small:PlacedTileLayer",
			// hidden in LDtk, and the top-most layer
			"Hidden:TileLayer",
		]);
		// the layer hidden in LDtk is in the world, as a hidden layer of a
		// Tiled map is: there, and not shown
		const hidden = app.world.getChildByName("Hidden");
		expect(hidden.length).toBeGreaterThan(0);
		for (const part of hidden) {
			expect(part.getOpacity()).toBe(0);
		}
		const x = Math.trunc((WIDTH - info.width) / 2);
		const y = Math.trunc((HEIGHT - info.height) / 2);
		app.viewport.moveTo(0, 0);
		const result = diff(
			frame(app),
			referenceView(
				info.bgColor,
				[{ picture: referenceLevel(project.json, info.json, false), x, y }],
				0,
				0,
			),
			1,
		);
		expect(
			result.different,
			`${result.first} (worst ${String(result.worst)})`,
		).toBe(0);
	});

	it("an entity takes its layer's opacity, and a hidden layer still holds its entities and its walls", async () => {
		await enter(app, "single:Faded");
		const lamp = current().getEntities("Lamp")[0];
		expect(lamp.getOpacity()).toBe(0.5);
		// hidden in LDtk: in the game, not shown
		const ghost = current().getEntities("Ghost")[0];
		expect(ghost).toBeDefined();
		expect(ghost.getOpacity()).toBe(0);
		// a collision layer hidden in the editor is still the floor
		const walls = app.world.getChildren().filter((child) => {
			return child.bodyDef !== undefined;
		});
		expect(walls).toHaveLength(1);
		expect([
			walls[0].pos.x,
			walls[0].pos.y,
			walls[0].width,
			walls[0].height,
		]).toEqual([0, 80, 160, 16]);
		expect(current().getIntGrid("Collisions")?.valueAt(3, 5)).toBe(1);
	});

	it("gives the text and the enum tags LDtk keeps for a tile", () => {
		const project = loader.getLDtk("single") as LDtkProject;
		expect(project.getTileData("Tiles", 3)).toBe("slippery");
		expect(project.getTileData("Tiles", 5)).toBe('{"damage": 2}');
		expect(project.getTileData("Tiles", 4)).toBeUndefined();
		expect(project.getTileData("No such tileset", 3)).toBeUndefined();
		expect(project.getTileTags("Tiles", 5)).toEqual(["Solid", "Hazard"]);
		expect(project.getTileTags("Tiles", 0)).toEqual(["Solid"]);
		expect(project.getTileTags("Tiles", 2)).toEqual([]);
		expect(project.getTileTags("No such tileset", 0)).toEqual([]);
	});

	it("gives a level's fields, an empty one as null", async () => {
		await enter(app, "single:Fields");
		expect(current().fields).toEqual({
			music: "cave.ogg",
			gravity: 0.5,
			boss: true,
			next: null,
		});
		expect(current().backgroundcolor).toBe("#203040");
		// a level with no layer is its background alone
		expect(current().layers).toEqual([]);
	});

	it("finds a level by its identifier or its iid", () => {
		const project = loader.getLDtk("single") as LDtkProject;
		expect(project.getLevel("Odd")?.iid).toBe("Odd-iid");
		expect(project.getLevel("Odd-iid")?.identifier).toBe("Odd");
		expect(project.getLevel("Nowhere")).toBeUndefined();
		expect(loader.getLDtk("no such project")).toBeNull();
	});

	it("a project of several worlds: the first by the project's name, the others by theirs", async () => {
		const project = loader.getLDtk("multi") as LDtkProject;
		expect(
			project.worlds.map((world) => {
				return [world.identifier, world.id, world.layout];
			}),
		).toEqual([
			["Overworld", "multi", "Free"],
			["Underworld", "multi@Underworld", "LinearHorizontal"],
		]);
		expect(project.getWorld()?.identifier).toBe("Overworld");
		expect(project.getWorld("Underworld")?.levels).toHaveLength(2);
		expect(project.getWorld("Nowhere")).toBeUndefined();
		// every level by the project's name and its own, whatever its world
		expect(
			project.levels.map((info) => {
				return [info.id, info.world, info.x, info.y];
			}),
		).toEqual([
			["multi:Field", "Overworld", 0, 0],
			["multi:Forest", "Overworld", 160, 0],
			["multi:Cave", "Underworld", 0, 0],
			["multi:Lair", "Underworld", 160 + 48, 0],
		]);

		await enter(app, "multi@Underworld");
		const world = level.getCurrentLevel() as unknown as LDtkWorld;
		expect(world).toBeInstanceOf(LDtkWorld);
		expect(world.loadedLevels()).toEqual(["Cave", "Lair"]);
		expect(world.width).toBe(160 * 2 + 48);
		await enter(app, "multi");
		expect(
			(level.getCurrentLevel() as unknown as LDtkWorld).loadedLevels(),
		).toEqual(["Field", "Forest"]);
		await enter(app, "multi:Lair");
		expect(current().identifier).toBe("Lair");
	});
});
