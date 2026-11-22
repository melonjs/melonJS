import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type Application,
	collision,
	IntGrid,
	LDtkEntity,
	type LDtkEntitySettings,
	LDtkLevel,
	type LDtkProject,
	type LDtkProjectJson,
	level,
	loader,
	PlacedTileLayer,
	Renderable,
	registerObjectClass,
	TileLayer,
	video,
} from "../src/index.js";
import {
	drawEntityTile,
	type EntityTile,
} from "../src/level/ldtk/renderables.ts";
import {
	diff,
	enter,
	frame,
	HEIGHT,
	loadSamples,
	makeApp,
	referenceView,
	SAMPLES,
	sampleURL,
	WIDTH,
} from "./helpers/ldtk-harness.ts";

/**
 * What a game sees of an LDtk project, with nothing to register: its
 * levels in the level director, their IntGrid layers, walls and entities,
 * and the project gone when it is unloaded.
 */
let app: Application;
let projects: Map<string, LDtkProject>;

const current = () => {
	return level.getCurrentLevel() as unknown as LDtkLevel;
};

const children = () => {
	return app.world.getChildren();
};

beforeAll(async () => {
	app = await makeApp(video.CANVAS);
	projects = await loadSamples();
});

afterAll(() => {
	app.destroy();
});

describe("an LDtk project in the level director", () => {
	it("registers each level by the project's name and its identifier, then the world", () => {
		const project = projects.get("Typical_TopDown_example") as LDtkProject;
		expect(
			project.levels.map((info) => {
				return info.id;
			}),
		).toEqual([
			"Typical_TopDown_example:World_Level_0",
			"Typical_TopDown_example:World_Level_1",
			"Typical_TopDown_example:World_Level_2",
		]);
		expect(project.worlds).toHaveLength(1);
		expect(project.worlds[0].id).toBe("Typical_TopDown_example");
		// every level of every sample, and a world for each
		let count = 0;
		for (const sample of SAMPLES) {
			count += (projects.get(sample) as LDtkProject).levels.length + 1;
		}
		expect(level.levelCount()).toBe(count);
	});

	it("loads a level by its id: what the director holds describes it", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		expect(level.getCurrentLevelId()).toBe(
			"Typical_TopDown_example:World_Level_0",
		);
		const loaded = current();
		expect(loaded).toBeInstanceOf(LDtkLevel);
		expect(loaded.identifier).toBe("World_Level_0");
		expect(loaded.width).toBe(512);
		expect(loaded.height).toBe(256);
		expect(loaded.tilewidth).toBe(16);
		expect(loaded.cols).toBe(32);
		expect(loaded.rows).toBe(16);
		expect(loaded.orientation).toBe("orthogonal");
		// read as a Tiled map is: its area, its layers, its grid
		const bounds = loaded.getBounds();
		expect([bounds.left, bounds.top, bounds.width, bounds.height]).toEqual([
			0, 0, 512, 256,
		]);
		expect(loaded.getLayers()).toBe(loaded.layers);
		const cell = loaded.getRenderer().pixelToTileCoords(40, 20);
		expect([cell.x, cell.y]).toEqual([2.5, 1.25]);
		expect(loaded.info.neighbours).toEqual([
			{ identifier: "World_Level_1", dir: "w" },
			{ identifier: "World_Level_2", dir: "e" },
		]);
		// its tile layers, bottom-most first, each named after its LDtk layer
		expect(loaded.layers.length).toBeGreaterThan(0);
		expect(
			loaded.layers.every((layer) => {
				return layer instanceof TileLayer || layer instanceof PlacedTileLayer;
			}),
		).toBe(true);
		const names = [
			...new Set(
				loaded.layers.map((layer) => {
					return layer.name;
				}),
			),
		];
		expect(names).toEqual([
			"Default_floor",
			"Custom_floor",
			"Collisions",
			"Wall_tops",
		]);
		// in the world in that order, each layer's parts together
		const z = loaded.layers.map((layer) => {
			return (layer.pos as unknown as { z: number }).z;
		});
		expect(z).toEqual(
			[...z].sort((a, b) => {
				return a - b;
			}),
		);
		// the background is the level's
		expect(app.world.backgroundColor.toHex().toLowerCase()).toBe(
			loaded.backgroundcolor.toLowerCase(),
		);
	});

	it("steps through a project's levels in LDtk's order, and reloads one", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		await level.next({ container: app.world, async: true });
		expect(current().identifier).toBe("World_Level_1");
		await level.reload({ container: app.world, async: true });
		expect(current().identifier).toBe("World_Level_1");
		expect(current().layers.length).toBeGreaterThan(0);
		await level.previous({ container: app.world, async: true });
		expect(current().identifier).toBe("World_Level_0");
	});

	it("lets go of a level when another is loaded", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const first = current();
		const kept = children().length;
		expect(kept).toBeGreaterThan(0);
		await enter(app, "AutoLayers_1_basic:AutoLayer");
		expect(first.layers).toEqual([]);
		expect(first.getIntGrid("Collisions")).toBeUndefined();
		expect(first.getEntities()).toEqual([]);
		expect(first.container).toBeUndefined();
		// nothing of the first level is left in the world
		expect(
			children().some((child) => {
				return child.name === "Wall_tops";
			}),
		).toBe(false);
	});

	it("has the viewport follow the level: its bounds, and a small level centred", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		// 512 x 256 in a 320 x 240 view
		expect(app.viewport.bounds.width).toBe(512);
		expect(app.viewport.bounds.height).toBe(256);
		expect(app.world.pos.x).toBe(0);
		// 272 x 256: narrower than the view, centred across
		await enter(app, "AutoLayers_2_stamps:Stamps");
		expect(app.viewport.bounds.width).toBe(WIDTH);
		expect(app.viewport.bounds.height).toBe(256);
		expect(app.world.pos.x).toBe((WIDTH - 272) / 2);
		expect(app.world.pos.y).toBe(0);
		// unless told not to
		app.viewport.setBounds(0, 0, 1000, 1000);
		app.world.pos.set(0, 0);
		await enter(app, "AutoLayers_2_stamps:Stamps", {
			setViewportBounds: false,
		});
		expect(app.viewport.bounds.width).toBe(1000);
		expect(app.world.pos.x).toBe(0);
	});

	it("reads a tile id as the tile LDtk means, for every tile of every sample", async () => {
		for (const sample of SAMPLES) {
			const project = projects.get(sample) as LDtkProject;
			const info = project.levels[0];
			await enter(app, info.id, { entities: false });
			// each tileset the level's layers draw with, by its name
			const tilesets = new Map<
				string,
				{ atlas: { offset: { x: number; y: number } }[] }
			>();
			for (const layer of current().layers) {
				const tileset =
					layer instanceof TileLayer
						? layer.tilesets.getTilesetByIndex(0)
						: (layer as PlacedTileLayer).tileset;
				tilesets.set(tileset.name, tileset);
			}
			for (const json of project.levels) {
				for (const layer of json.json.layerInstances ?? []) {
					const def = project.tilesets.get(layer.__tilesetDefUid ?? -1);
					const tileset = tilesets.get(def?.identifier ?? "");
					if (tileset === undefined) {
						continue;
					}
					for (const tile of [...layer.gridTiles, ...layer.autoLayerTiles]) {
						const offset = tileset.atlas[tile.t].offset;
						if (offset.x !== tile.src[0] || offset.y !== tile.src[1]) {
							throw new Error(
								`${sample}: tile ${String(tile.t)} of ${def?.identifier ?? ""} is at ${String(offset.x)}, ${String(offset.y)}, LDtk has it at ${tile.src.join(", ")}`,
							);
						}
					}
				}
			}
		}
	});
});

describe("the IntGrid layers of a level", () => {
	it("are kept for the game to read: values, names and colors", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const grid = current().getIntGrid("Collisions") as IntGrid;
		expect(grid).toBeInstanceOf(IntGrid);
		expect(grid.cols).toBe(32);
		expect(grid.rows).toBe(16);
		expect(grid.cellSize).toBe(16);
		const json = (projects.get("Typical_TopDown_example") as LDtkProject)
			.getLevel("World_Level_0")
			?.json.layerInstances?.find((layer) => {
				return layer.__identifier === "Collisions";
			});
		expect(Array.from(grid.values)).toEqual(json?.intGridCsv);
		expect(grid.names.get(1)).toBe("walls");
		expect(grid.colors.get(1)).toMatch(/^#[0-9a-f]{6}$/i);
		// the top row is wall from the 16th column on, floor before
		expect(grid.valueAt(15, 1)).toBe(1);
		expect(grid.nameAt(15, 1)).toBe("walls");
		expect(grid.valueAt(1, 1)).toBe(0);
		expect(grid.nameAt(1, 1)).toBeUndefined();
		expect(grid.valueAtPixel(15 * 16 + 3, 16 + 9)).toBe(1);
		// outside the grid
		expect(grid.valueAt(-1, 0)).toBe(0);
		expect(grid.valueAt(0, 16)).toBe(0);
		expect(grid.valueAtPixel(-5, 4)).toBe(0);
		expect(current().getIntGrid("no such layer")).toBeUndefined();
	});

	/**
	 * the cells a set of rectangles covers, counted
	 * @param grid - the grid
	 * @param rects - the rectangles, in pixels
	 * @returns how many rectangles cover each cell
	 */
	const coverage = (
		grid: IntGrid,
		rects: { x: number; y: number; width: number; height: number }[],
	) => {
		const count = new Uint8Array(grid.cols * grid.rows);
		for (const rect of rects) {
			for (let y = rect.y; y < rect.y + rect.height; y += grid.cellSize) {
				for (let x = rect.x; x < rect.x + rect.width; x += grid.cellSize) {
					count[
						((y - grid.y) / grid.cellSize) * grid.cols +
							(x - grid.x) / grid.cellSize
					]++;
				}
			}
		}
		return count;
	};

	it("cover their cells with few rectangles, each of one value", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const grid = current().getIntGrid("Collisions") as IntGrid;
		const rects = grid.rects();
		const count = coverage(grid, rects);
		let solid = 0;
		for (let i = 0; i < count.length; i++) {
			expect(count[i], `cell ${String(i)}`).toBe(grid.values[i] !== 0 ? 1 : 0);
			solid += grid.values[i] !== 0 ? 1 : 0;
		}
		expect(solid).toBeGreaterThan(100);
		// far fewer rectangles than cells
		expect(rects.length).toBeLessThan(solid / 4);
		expect(
			rects.every((rect) => {
				return rect.value === 1;
			}),
		).toBe(true);
		// only the values asked for
		expect(
			grid.rects((value) => {
				return value === 7;
			}),
		).toEqual([]);
	});

	it("named like a collision layer, make one static body per rectangle", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const grid = current().getIntGrid("Collisions") as IntGrid;
		const walls = children().filter((child) => {
			return child.name === "Collisions" && child.bodyDef !== undefined;
		});
		expect(walls).toHaveLength(grid.rects().length);
		const count = coverage(
			grid,
			walls.map((wall) => {
				return {
					x: wall.pos.x,
					y: wall.pos.y,
					width: wall.width,
					height: wall.height,
				};
			}),
		);
		for (let i = 0; i < count.length; i++) {
			expect(count[i]).toBe(grid.values[i] !== 0 ? 1 : 0);
		}
		for (const wall of walls) {
			const def = wall.bodyDef as {
				type: string;
				collisionType: number;
				shapes: { getBounds(): { width: number; height: number } }[];
			};
			expect(def.type).toBe("static");
			expect(def.collisionType).toBe(collision.types.WORLD_SHAPE);
			// one shape, the size of the run of cells
			expect(def.shapes).toHaveLength(1);
			expect(def.shapes[0].getBounds().width).toBe(wall.width);
			expect(def.shapes[0].getBounds().height).toBe(wall.height);
			// what it is made of, for a collision handler
			const made = wall as unknown as {
				intGridValue: number;
				intGridName: string;
				body: { collisionType: number } | undefined;
			};
			expect(made.intGridValue).toBe(1);
			expect(made.intGridName).toBe("walls");
			// the world made a body of it
			expect(made.body).toBeDefined();
			expect(made.body?.collisionType).toBe(collision.types.WORLD_SHAPE);
		}
	});

	it("are solid only where asked: by layer, and by value", async () => {
		const bodies = () => {
			return children().filter((child) => {
				return child.bodyDef !== undefined;
			});
		};
		// a layer not named like one is not solid by itself
		await enter(app, "AutoLayers_1_basic:AutoLayer");
		expect(bodies()).toEqual([]);
		const name = current().info.json.layerInstances?.find((layer) => {
			return layer.__type === "IntGrid";
		})?.__identifier as string;
		await enter(app, "AutoLayers_1_basic:AutoLayer", {
			collisionLayers: [name],
		});
		expect(bodies().length).toBeGreaterThan(0);
		expect(
			bodies().every((body) => {
				return body.name === name;
			}),
		).toBe(true);
		// none where the list names no layer
		await enter(app, "Typical_TopDown_example:World_Level_0", {
			collisionLayers: [],
		});
		expect(bodies()).toEqual([]);
		// and none for a value that is not solid
		await enter(app, "Typical_TopDown_example:World_Level_0", {
			solidValues: [2],
		});
		expect(bodies()).toEqual([]);
		await enter(app, "Typical_TopDown_example:World_Level_0", {
			solidValues: [1],
		});
		expect(bodies().length).toBeGreaterThan(0);
	});

	it("are drawn in LDtk's colors when asked, where a layer has no tiles", async () => {
		const project = projects.get("SeparateLevelFiles") as LDtkProject;
		const info = project.levels[0];
		// nothing but the background otherwise
		await enter(app, info.id);
		expect(current().layers).toEqual([]);

		await enter(app, info.id, { showIntGrid: true });
		expect(current().layers).toHaveLength(1);
		const grid = current().getIntGrid("IntGrid") as IntGrid;
		const canvas = document.createElement("canvas");
		canvas.width = info.width;
		canvas.height = info.height;
		const c = canvas.getContext("2d") as CanvasRenderingContext2D;
		let painted = 0;
		for (let row = 0; row < grid.rows; row++) {
			for (let col = 0; col < grid.cols; col++) {
				const color = grid.colors.get(grid.valueAt(col, row));
				if (color !== undefined) {
					c.fillStyle = color;
					c.fillRect(col * 16, row * 16, 16, 16);
					painted++;
				}
			}
		}
		expect(painted).toBeGreaterThan(0);
		app.viewport.moveTo(0, 0);
		const result = diff(
			frame(app),
			referenceView(
				info.bgColor,
				[
					{
						picture: canvas,
						// `referenceView` takes pictures with a margin
						x: Math.trunc((WIDTH - info.width) / 2) + 64,
						y: Math.trunc((HEIGHT - info.height) / 2) + 64,
					},
				],
				0,
				0,
			),
		);
		expect(result.different, result.first).toBe(0);
	});
});

describe("the entities of a level", () => {
	it("with no class registered, are boxes to find and read", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const entities = current().getEntities();
		expect(entities).toHaveLength(8);
		expect(
			entities.every((entity) => {
				return entity instanceof LDtkEntity && entity.ancestor === app.world;
			}),
		).toBe(true);
		// found by name in the world, as any renderable is
		expect(app.world.getChildByName("Player")).toHaveLength(1);
		expect(current().getEntities("Door")).toHaveLength(4);

		// LDtk places the player by its centre: at 168, 168, 16 x 16
		const player = current().getEntities("Player")[0] as LDtkEntity;
		expect(player.pos.x).toBe(160);
		expect(player.pos.y).toBe(160);
		expect(player.width).toBe(16);
		expect(player.height).toBe(16);
		expect(player.pivot).toEqual({ x: 0.5, y: 0.5 });
		expect(player.source.px).toEqual({ x: 168, y: 168 });
		expect(player.fields).toEqual({ life: 100, ammo: 10 });
		expect(player.tags).toEqual(["actor"]);
		expect(player.iid).toMatch(/^[0-9a-f-]{36}$/);
		expect(player.source.layer).toBe("Entities");
		expect(player.source.level).toBe("World_Level_0");
		// no body: it stands for the game's own class
		expect(player.bodyDef).toBeUndefined();

		// a door by its top left corner
		const door = current()
			.getEntities("Door")
			.find((entity) => {
				return entity.pos.x === 112;
			}) as LDtkEntity;
		expect(door.pos.y).toBe(144);
		expect(door.width).toBe(16);
		expect(door.height).toBe(48);
		expect(door.fields).toEqual({ lockedWith: "KeyA" });

		// above the tile layers below its own layer
		const z = (renderable: Renderable) => {
			return (renderable.pos as unknown as { z: number }).z;
		};
		for (const layer of current().layers) {
			expect(z(player)).toBeGreaterThan(z(layer));
		}
	});

	it("give every kind of field its value", async () => {
		await enter(app, "Test_file_for_API_showing_all_features:Everything");
		const entity = current().getEntities("EntityFieldsTest")[0] as LDtkEntity;
		expect(entity.fields).toMatchObject({
			Integer: 1,
			Float: 1.5,
			Boolean: false,
			String_singleLine: "foo",
			Enum: "A",
			ExternEnum: "Value1",
			Color: "#D181E8",
			Point: { cx: 4, cy: 17 },
			FilePath: "README.md",
			Array_Integer: [1, 2, 3],
			Array_Enum: ["A", "B", "C"],
		});
		expect(entity.fields.Array_points).toHaveLength(4);
		// 32 x 32 around 152, 312
		expect(entity.pos.x).toBe(136);
		expect(entity.pos.y).toBe(296);
	});

	it("with a class registered, are built by it from their settings", async () => {
		const made: { x: number; y: number; settings: LDtkEntitySettings }[] = [];
		class Item extends Renderable {
			kind: unknown;
			constructor(x: number, y: number, settings: LDtkEntitySettings) {
				super(x, y, settings.width, settings.height);
				made.push({ x, y, settings });
				this.name = settings.name;
				this.kind = settings.fields.type;
			}
		}
		registerObjectClass("Item", Item as never);
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const items = current().getEntities("Item");
		expect(items).toHaveLength(2);
		expect(
			items.every((item) => {
				return item instanceof Item && item.ancestor === app.world;
			}),
		).toBe(true);
		expect(made).toHaveLength(2);
		// 20 x 20 around 296, 56
		const key = made.find((entry) => {
			return entry.settings.fields.type === "KeyA";
		});
		expect(key).toBeDefined();
		expect(key?.x).toBe(286);
		expect(key?.y).toBe(46);
		expect(key?.settings).toMatchObject({
			name: "Item",
			class: "Item",
			x: 286,
			y: 46,
			width: 20,
			height: 20,
			tags: ["actor"],
			layer: "Entities",
			level: "World_Level_0",
			anchorPoint: { x: 0, y: 0 },
			pivot: { x: 0.5, y: 0.5 },
		});
		// a field named like a setting stays under `fields` alone
		expect(key?.settings.type).toBe("Item");
		// the others are still boxes
		expect(current().getEntities("Player")[0]).toBeInstanceOf(LDtkEntity);

		// a field with a free name is also read straight off the settings
		class Player extends Renderable {
			constructor(x: number, y: number, settings: LDtkEntitySettings) {
				super(x, y, settings.width, settings.height);
				made.push({ x, y, settings });
				this.name = settings.name;
			}
		}
		made.length = 0;
		registerObjectClass("Player", Player as never);
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const player = made.find((entry) => {
			return entry.settings.name === "Player";
		});
		expect(player?.settings.life).toBe(100);
		expect(player?.settings.ammo).toBe(10);
		expect(player?.settings.fields).toEqual({ life: 100, ammo: 10 });
		expect(typeof player?.settings.z).toBe("number");
	});

	it("are left out when asked", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0", {
			entities: false,
		});
		expect(current().getEntities()).toEqual([]);
		expect(app.world.getChildByName("Door")).toEqual([]);
	});

	it("draw the tile LDtk shows them with, the way it is set to fill their box", () => {
		const image = document.createElement("canvas");
		const tile = (mode: string): EntityTile => {
			return { image, x: 32, y: 48, width: 16, height: 8, mode };
		};
		const drawn = (mode: string, pivotX = 0.5, pivotY = 0.5) => {
			const drawImage = vi.fn();
			drawEntityTile(
				{ drawImage } as never,
				tile(mode),
				100,
				200,
				40,
				40,
				pivotX,
				pivotY,
			);
			return drawImage.mock.calls.map((call) => {
				return call.slice(1) as number[];
			});
		};
		// source x, y, width, height, then where and how large
		expect(drawn("Stretch")).toEqual([[32, 48, 16, 8, 100, 200, 40, 40]]);
		// borders are not read: stretched
		expect(drawn("NineSlice")).toEqual(drawn("Stretch"));
		// whole, 2.5 times larger, in the middle of the box
		expect(drawn("FitInside")).toEqual([[32, 48, 16, 8, 100, 210, 40, 20]]);
		// held by its pivot: at the top, or at the bottom
		expect(drawn("FitInside", 0, 0)).toEqual([
			[32, 48, 16, 8, 100, 200, 40, 20],
		]);
		expect(drawn("FitInside", 1, 1)).toEqual([
			[32, 48, 16, 8, 100, 220, 40, 20],
		]);
		// 5 times larger to fill the box: the middle 8 x 8 of it shows
		expect(drawn("Cover")).toEqual([[36, 48, 8, 8, 100, 200, 40, 40]]);
		// at its own size, around the pivot
		expect(drawn("FullSizeUncropped")).toEqual([
			[32, 48, 16, 8, 112, 216, 16, 8],
		]);
		expect(drawn("FullSizeCropped")).toEqual([
			[32, 48, 16, 8, 112, 216, 16, 8],
		]);
		// side by side to fill the box, the last column and row cut to it
		const repeated = drawn("Repeat");
		expect(repeated).toHaveLength(3 * 5);
		expect(repeated[0]).toEqual([32, 48, 16, 8, 100, 200, 16, 8]);
		expect(repeated[2]).toEqual([32, 48, 8, 8, 132, 200, 8, 8]);
		expect(repeated.at(-1)).toEqual([32, 48, 8, 8, 132, 232, 8, 8]);
		// a box of no size draws nothing
		const drawImage = vi.fn();
		drawEntityTile({ drawImage } as never, tile("Stretch"), 0, 0, 0, 10, 0, 0);
		expect(drawImage).not.toHaveBeenCalled();
	});

	it("show their tile when its tileset has an image", async () => {
		await enter(app, "Entities:Entities_demo");
		const withTile = current()
			.getEntities()
			.filter((entity) => {
				return entity instanceof LDtkEntity && entity.tile !== undefined;
			}) as LDtkEntity[];
		const project = projects.get("Entities") as LDtkProject;
		const expected = (
			project.getLevel("Entities_demo")?.json.layerInstances ?? []
		)
			.flatMap((layer) => {
				return layer.entityInstances;
			})
			.filter((entity) => {
				const def = project.tilesets.get(entity.__tile?.tilesetUid ?? -1);
				return typeof def?.relPath === "string";
			});
		expect(withTile).toHaveLength(expected.length);
		for (const entity of withTile) {
			const json = expected.find((candidate) => {
				return candidate.iid === entity.iid;
			});
			expect(entity.tile).toMatchObject({
				x: json?.__tile?.x,
				y: json?.__tile?.y,
				width: json?.__tile?.w,
				height: json?.__tile?.h,
			});
			expect(entity.tile?.image).toBe(
				loader.getImage(
					project.tilesets.get(json?.__tile?.tilesetUid ?? -1)?.relPath ?? "",
				),
			);
		}
	});
});

describe("loading and unloading a project", () => {
	it("loads the images the project names with it, under their file's name", () => {
		for (const name of [
			"Cavernas_by_Adam_Saltsman",
			"Inca_front_by_Kronbits-extended",
			"Inca_back2_by_Kronbits",
			"SunnyLand_by_Ansimuz-extended",
			"TopDown_by_deepnight",
			// a background image, and a tileset saved by Aseprite
			"Beach by deepnight",
			"NuclearBlaze_by_deepnight",
		]) {
			const image = loader.getImage(name) as { width: number } | null;
			expect(image, name).not.toBeNull();
			expect(image?.width, name).toBeGreaterThan(0);
		}
	});

	it("reads the levels a project saves in files of their own", () => {
		const project = projects.get("SeparateLevelFiles") as LDtkProject;
		expect(project.json.externalLevels).toBe(true);
		expect(project.levels).toHaveLength(3);
		for (const info of project.levels) {
			expect(info.json.layerInstances?.length).toBeGreaterThan(0);
			expect(info.json.layerInstances?.[0].intGridCsv.length).toBe(15 * 15);
		}
	});

	it("takes a project given as data, and uses the images the game loaded", async () => {
		const response = await fetch(sampleURL("AutoLayers_1_basic.ldtk"));
		const data = (await response.json()) as LDtkProjectJson;
		await loader.preload(
			[{ name: "inline", type: "ldtk", data }],
			undefined,
			false,
		);
		expect(loader.getLDtk("inline")?.levels).toHaveLength(1);
		await enter(app, "inline:AutoLayer", { entities: false });
		expect(current().layers.length).toBeGreaterThan(0);
		loader.unload({ name: "inline", type: "ldtk" });
	});

	it("refuses a file that is not an LDtk project", async () => {
		const quiet = vi.spyOn(console, "error").mockImplementation(() => {
			// expected
		});
		await expect(
			loader.preload(
				[{ name: "notldtk", type: "ldtk", data: { hello: "world" } }],
				undefined,
				false,
			),
		).rejects.toThrow();
		expect(loader.getLDtk("notldtk")).toBeNull();
		quiet.mockRestore();
	});

	it("unloading a project takes its levels out of the director, and frees its images once no project uses them", async () => {
		const before = level.levelCount();
		// the only user of this tileset
		expect(loader.getImage("TopDown_by_deepnight")).not.toBeNull();
		expect(
			loader.unload({ name: "Typical_TopDown_example", type: "ldtk" }),
		).toBe(true);
		expect(loader.getLDtk("Typical_TopDown_example")).toBeNull();
		expect(level.levelCount()).toBe(before - 4);
		expect(() => {
			return level.load("Typical_TopDown_example:World_Level_0", {
				container: app.world,
			});
		}).toThrow(/not found/);
		expect(loader.getImage("TopDown_by_deepnight")).toBeNull();
		// a tileset another project still uses stays
		expect(
			loader.unload({ name: "WorldMap_GridVania_layout", type: "ldtk" }),
		).toBe(true);
		expect(loader.getImage("SunnyLand_by_Ansimuz-extended")).not.toBeNull();
		// unloading it again frees nothing
		expect(
			loader.unload({ name: "WorldMap_GridVania_layout", type: "ldtk" }),
		).toBe(false);

		// and it loads again
		await loader.preload(
			[
				{
					name: "Typical_TopDown_example",
					type: "ldtk",
					src: sampleURL("Typical_TopDown_example.ldtk"),
				},
			],
			undefined,
			false,
		);
		expect(loader.getImage("TopDown_by_deepnight")).not.toBeNull();
		await enter(app, "Typical_TopDown_example:World_Level_2");
		expect(current().identifier).toBe("World_Level_2");
	});
});
