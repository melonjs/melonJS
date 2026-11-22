import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type Application,
	type LDtkLevel,
	type LDtkProject,
	type LDtkProjectJson,
	type LDtkTile,
	LDtkWorld,
	level,
	loader,
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
import {
	defs,
	entity,
	layer,
	levelJson,
	projectJson,
	tile,
	tilesetImage,
} from "./helpers/ldtk-project-builder.ts";

/**
 * What the samples that come with LDtk do not hold, in a project made for
 * the test: a tileset whose tiles are not the size of the layer's cells, a
 * layer moved and faded, tiles past the level's edges, text and enum tags
 * on tiles, level fields, and a project of several worlds.
 */
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
		// values of three kinds, half faded, with no tiles of its own
		layer("Zones", "IntGrid", 16, 10, 6, [], {
			__opacity: 0.5,
			__tilesetDefUid: null,
			layerDefUid: 12,
			intGridCsv: new Array<number>(60).fill(0).map((_, i) => {
				return i < 30 ? (i % 3) + 1 : 0;
			}),
		}),
	]);
};

/** a level with a background image: a part of the tileset, enlarged and placed */
const backdropLevel = () => {
	return levelJson("Backdrop", [], {
		bgRelPath: "art/ldtk-test-tiles.png",
		__bgPos: {
			// the second and third tiles of the first row, twice their size
			cropRect: [16, 0, 32, 16],
			scale: [2, 2],
			topLeftPx: [24, 40],
		},
	});
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
				backdropLevel(),
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
		// a layer with a parallax factor, and a table of content: one kind
		// of entity as LDtk 1.5 lists them, one as it did before
		const extrasDefs = defs();
		extrasDefs.layers[0].parallaxFactorX = 0.5;
		const reference = (entityIid: string, levelIid: string) => {
			return { entityIid, layerIid: "layer-iid", levelIid, worldIid: "w" };
		};
		const extras = projectJson(
			[
				levelJson("Far", [layer("Far", "Tiles", 16, 4, 4, [tile(16, 0, 1)])]),
				levelJson("Near", [], { worldX: 160 }),
			],
			{
				iid: "extras",
				defs: extrasDefs,
				toc: [
					{
						identifier: "Start",
						instancesData: [
							{
								iids: reference("start-iid", "Near-iid"),
								worldX: 168,
								worldY: 8,
								widPx: 16,
								heiPx: 24,
								fields: { facing: "left" },
							},
						],
					},
					{
						identifier: "Door",
						instances: [reference("door-iid", "Far-iid")],
					},
				],
			},
		);
		await loader.preload(
			[
				{ name: "single", type: "ldtk", data: single },
				{ name: "multi", type: "ldtk", data: multi },
				{ name: "extras", type: "ldtk", data: extras },
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

	it("keeps the names LDtk gives the values of an IntGrid layer, and none for a value with no name", async () => {
		await enter(app, "single:Faded");
		const zones = current().getIntGrid("Zones");
		expect(zones).toBeDefined();
		expect([...(zones?.names ?? [])]).toEqual([[1, "water"]]);
		expect(zones?.nameAt(0, 0)).toBe("water");
		expect(zones?.nameAt(1, 0)).toBeUndefined();
		expect(zones?.nameAt(2, 0)).toBeUndefined();
		// each has its color all the same
		expect([...(zones?.colors ?? [])]).toEqual([
			[1, "#2060c0"],
			[2, "#c02020"],
			[3, "#20c020"],
		]);
	});

	it("an IntGrid layer shown in its colors is faded as the layer is in LDtk", async () => {
		await enter(app, "single:Faded", { showIntGrid: true });
		const shown = current().layers.filter((part) => {
			return part.name === "Zones";
		});
		expect(shown).toHaveLength(1);
		expect(shown[0].getOpacity()).toBe(0.5);
		// and the hidden one is there, not shown
		const hidden = current().layers.filter((part) => {
			return part.name === "Collisions";
		});
		expect(hidden).toHaveLength(1);
		expect(hidden[0].getOpacity()).toBe(0);
	});

	it("draws a level's background image where LDtk places it: the part it shows, at its scale", async () => {
		const project = loader.getLDtk("single") as LDtkProject;
		const info = project.getLevel("Backdrop");
		expect(info).toBeDefined();
		if (info === undefined) {
			return;
		}
		await enter(app, info.id);
		app.viewport.moveTo(0, 0);
		const result = diff(
			frame(app),
			referenceView(
				info.bgColor,
				[
					{
						picture: referenceLevel(project.json, info.json, false),
						x: Math.trunc((WIDTH - info.width) / 2),
						y: Math.trunc((HEIGHT - info.height) / 2),
					},
				],
				0,
				0,
			),
			1,
		);
		expect(
			result.different,
			`${result.first} (worst ${String(result.worst)})`,
		).toBe(0);
		// something of the image is on screen, where it was put
		const background = app.world.getChildByName("background");
		expect(background).toHaveLength(1);
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

	it("lists the entities of the table of content, where they are in the world", () => {
		const project = loader.getLDtk("extras") as LDtkProject;
		const [start] = project.getTableOfContent("Start");
		expect(start).toMatchObject({
			identifier: "Start",
			iid: "start-iid",
			x: 168,
			y: 8,
			width: 16,
			height: 24,
			fields: { facing: "left" },
		});
		expect(start.level?.identifier).toBe("Near");
		expect(start.iids.layerIid).toBe("layer-iid");
		// as a file saved before LDtk 1.5 lists them: no position
		const [door] = project.getTableOfContent("Door");
		expect(door.iid).toBe("door-iid");
		expect(door.level?.identifier).toBe("Far");
		expect(door.x).toBeUndefined();
		expect(door.fields).toEqual({});
		// all of them, in LDtk's order; none of a kind that is not listed
		expect(
			project.getTableOfContent().map((listed) => {
				return listed.identifier;
			}),
		).toEqual(["Start", "Door"]);
		expect(project.getTableOfContent("Chest")).toEqual([]);
		// and none in a file with no table of content at all
		expect(
			(loader.getLDtk("single") as LDtkProject).getTableOfContent(),
		).toEqual([]);
	});

	it("says once that a layer's parallax is not applied, and draws the layer in its place", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await enter(app, "extras:Far");
		await enter(app, "extras:Far");
		const said = warn.mock.calls.filter((call) => {
			return String(call[0]).includes("parallax");
		});
		warn.mockRestore();
		expect(said).toHaveLength(1);
		expect(String(said[0][0])).toContain('layer "Far"');
		// where its tile is in the level, whatever the factor
		const project = loader.getLDtk("extras") as LDtkProject;
		const info = project.getLevel("Far");
		expect(info).toBeDefined();
		if (info !== undefined) {
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
			expect(result.different).toBe(0);
		}
		// a layer with no factor says nothing
		const quiet = vi.spyOn(console, "warn").mockImplementation(() => {});
		await enter(app, "single:Fields");
		expect(
			quiet.mock.calls.filter((call) => {
				return String(call[0]).includes("parallax");
			}),
		).toHaveLength(0);
		quiet.mockRestore();
	});
});
