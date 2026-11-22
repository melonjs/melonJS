import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Application,
	IntGrid,
	type LDtkEntity,
	type LDtkEntityReference,
	type LDtkLevel,
	type LDtkLevelInfo,
	type LDtkProject,
	LDtkWorld,
	level,
	type video,
} from "../../src/index.js";
import {
	diff,
	enter,
	frame,
	HEIGHT,
	loadSamples,
	makeApp,
	referenceLevel,
	referenceView,
	WIDTH,
} from "./ldtk-harness.ts";

/**
 * A whole world of an LDtk project loaded at once: its levels where LDtk
 * puts them, a deeper one under a shallower one, each over its own background
 * color. Then levels added and taken out while the game runs.
 * @param renderer - the renderer to ask for
 * @param name - its name
 * @param tolerance - the largest difference of a channel that is not counted
 */
export function worldChecks(
	renderer: typeof video.CANVAS | typeof video.WEBGL,
	name: string,
	tolerance: number,
) {
	describe(`a world of an LDtk project, on ${name}`, () => {
		let app: Application;
		let projects: Map<string, LDtkProject>;

		const current = () => {
			return level.getCurrentLevel() as unknown as LDtkWorld;
		};

		beforeAll(async () => {
			app = await makeApp(renderer);
			projects = await loadSamples();
		});

		afterAll(() => {
			app.destroy();
		});

		/**
		 * the view of a world as LDtk draws it: the levels given, each over
		 * its background color, the deeper ones first
		 * @param project - the project
		 * @param levels - the levels in the game
		 * @param viewX - the view's left edge
		 * @param viewY - the view's top edge
		 * @returns the view's pixels
		 */
		const expectedView = (
			project: LDtkProject,
			levels: LDtkLevelInfo[],
			viewX: number,
			viewY: number,
		) => {
			const ordered = [...levels].sort((a, b) => {
				return a.depth - b.depth;
			});
			return referenceView(
				project.json.bgColor,
				ordered
					.filter((info) => {
						return (
							info.x < viewX + WIDTH + 64 &&
							info.x + info.width > viewX - 64 &&
							info.y < viewY + HEIGHT + 64 &&
							info.y + info.height > viewY - 64
						);
					})
					.map((info) => {
						return {
							picture: referenceLevel(project.json, info.json, true),
							x: info.x,
							y: info.y,
						};
					}),
				viewX,
				viewY,
			);
		};

		/**
		 * expect the view to show the levels given, from a place in the world
		 * @param project - the project
		 * @param levels - the levels in the game
		 * @param viewX - the view's left edge
		 * @param viewY - the view's top edge
		 */
		const expectView = (
			project: LDtkProject,
			levels: LDtkLevelInfo[],
			viewX: number,
			viewY: number,
		) => {
			app.viewport.moveTo(viewX, viewY);
			// where the camera is, once kept within the world
			const x = app.viewport.pos.x;
			const y = app.viewport.pos.y;
			const result = diff(
				frame(app),
				expectedView(project, levels, x, y),
				tolerance,
			);
			expect(
				result.different,
				`from ${String(x)}, ${String(y)}: ${result.first} (worst ${String(result.worst)})`,
			).toBe(0);
		};

		for (const sample of [
			"WorldMap_GridVania_layout",
			"WorldMap_Free_layout",
			"Typical_TopDown_example",
		]) {
			it(`${sample}: every level where LDtk puts it, the deeper ones under`, async () => {
				const project = projects.get(sample) as LDtkProject;
				await enter(app, sample, { entities: false });
				const world = current();
				expect(world).toBeInstanceOf(LDtkWorld);
				expect(world.loadedLevels()).toEqual(
					project.levels.map((info) => {
						return info.identifier;
					}),
				);
				// the area the levels cover, from LDtk's own numbers
				const known: Record<string, number[]> = {
					WorldMap_GridVania_layout: [-1024, -256, 4352, 2304],
					WorldMap_Free_layout: [-480, -640, 1472, 992],
					Typical_TopDown_example: [0, 0, 1024, 256],
				};
				expect([
					project.worlds[0].bounds.x,
					project.worlds[0].bounds.y,
					project.worlds[0].bounds.width,
					project.worlds[0].bounds.height,
				]).toEqual(known[sample]);
				// the viewport follows the whole world, LDtk's coordinates kept
				const bounds = project.worlds[0].bounds;
				expect(world.x).toBe(bounds.x);
				expect(world.y).toBe(bounds.y);
				const area = world.getBounds();
				expect([area.left, area.top, area.width, area.height]).toEqual([
					bounds.x,
					bounds.y,
					bounds.width,
					bounds.height,
				]);
				expect(app.viewport.bounds.left).toBe(bounds.x);
				expect(app.viewport.bounds.top).toBe(bounds.y);
				expect(app.viewport.bounds.width).toBe(Math.max(bounds.width, WIDTH));
				expect(app.viewport.bounds.height).toBe(
					Math.max(bounds.height, HEIGHT),
				);
				// from the corner of each level, and from where two meet
				for (const info of project.levels) {
					expectView(project, project.levels, info.x, info.y);
					expectView(
						project,
						project.levels,
						info.x + info.width - (WIDTH >> 1),
						info.y + info.height - (HEIGHT >> 1),
					);
				}
			});
		}

		it("lays the levels of a linear world out in a row or a column, 48 pixels apart", () => {
			const column = projects.get(
				"Test_file_for_API_showing_all_features",
			) as LDtkProject;
			expect(column.worlds[0].layout).toBe("LinearVertical");
			let y = 0;
			for (const info of column.levels) {
				expect(info.x).toBe(0);
				expect(info.y).toBe(y);
				y += info.height + 48;
			}
			expect(column.worlds[0].bounds).toEqual({
				x: 0,
				y: 0,
				width: 680,
				height: y - 48,
			});
			const row = projects.get("SeparateLevelFiles") as LDtkProject;
			expect(row.worlds[0].layout).toBe("LinearHorizontal");
			expect(
				row.levels.map((info) => {
					return [info.x, info.y];
				}),
			).toEqual([
				[0, 0],
				[240 + 48, 0],
				[(240 + 48) * 2, 0],
			]);
		});

		it("Test_file_for_API_showing_all_features: a column of levels, drawn", async () => {
			const sample = "Test_file_for_API_showing_all_features";
			const project = projects.get(sample) as LDtkProject;
			await enter(app, sample, { entities: false });
			// the views with no background image in them: a scaled image
			// is rounded to the pixel each renderer's own way
			for (const info of project.levels.slice(0, 2)) {
				expectView(project, project.levels, info.x, info.y);
			}
		});

		it("starts with the levels asked for, and takes others in and out", async () => {
			const sample = "WorldMap_GridVania_layout";
			const project = projects.get(sample) as LDtkProject;
			const [first, second, third] = project.levels;
			await enter(app, sample, {
				entities: false,
				levels: [first.identifier],
			});
			const world = current();
			expect(world.loadedLevels()).toEqual([first.identifier]);
			expect(world.isLoaded(first.identifier)).toBe(true);
			expect(world.isLoaded(second.identifier)).toBe(false);
			// the viewport is the whole world's all the same
			expect(app.viewport.bounds.width).toBe(project.worlds[0].bounds.width);
			expectView(project, [first], first.x, first.y);
			const count = app.world.getChildren().length;
			expect(count).toBeGreaterThan(0);

			// another level, while the game runs
			expect(world.loadLevel(second.identifier)).toBe(true);
			expect(world.loadLevel(second.identifier)).toBe(false);
			expect(world.loadedLevels()).toEqual([
				first.identifier,
				second.identifier,
			]);
			expect(app.world.getChildren().length).toBeGreaterThan(count);
			expectView(project, [first, second], second.x, second.y);
			expectView(project, [first, second], first.x, first.y);

			// and out again: nothing of it is left
			expect(world.unloadLevel(second.identifier)).toBe(true);
			expect(world.unloadLevel(second.identifier)).toBe(false);
			// a child leaves once the frame is over
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			expect(app.world.getChildren()).toHaveLength(count);
			expect(world.loadedLevels()).toEqual([first.identifier]);
			expectView(project, [first], second.x, second.y);

			expect(() => {
				return world.loadLevel("no such level");
			}).toThrow(/no level "no such level"/);
			expect(third).toBeDefined();
		});

		it("puts a level's walls, entities and IntGrid where the level is", async () => {
			const sample = "Typical_TopDown_example";
			const project = projects.get(sample) as LDtkProject;
			await enter(app, sample);
			const world = current();
			// the second level of the file stands at 0, the first at 256
			const info = project.getLevel("World_Level_0") as LDtkLevelInfo;
			expect(info.x).toBe(256);
			const grid = world.getIntGrid("World_Level_0", "Collisions") as IntGrid;
			expect(grid).toBeInstanceOf(IntGrid);
			expect(grid.x).toBe(256);
			expect(grid.y).toBe(0);
			expect(grid.valueAtPixel(256 + 15 * 16 + 3, 16 + 9)).toBe(1);
			// the second cell of that row is floor, the eighteenth wall: the
			// level's own place in the world is taken off
			expect(grid.valueAtPixel(256 + 16 + 3, 16 + 9)).toBe(0);
			expect(grid.valueAtPixel(16 + 3, 16 + 9)).toBe(0);
			expect(world.getIntGrid("World_Level_0", "nothing")).toBeUndefined();
			expect(world.getIntGrid("nowhere", "Collisions")).toBeUndefined();

			// the player of that level, placed by its centre at 168, 168
			const players = world.getEntities("Player");
			expect(players).toHaveLength(1);
			expect(players[0].pos.x).toBe(256 + 160);
			expect(players[0].pos.y).toBe(160);
			// its pivot, in the world
			expect((players[0] as LDtkEntity).source.px).toEqual({
				x: 256 + 168,
				y: 168,
			});
			// every entity of the three levels
			expect(world.getEntities()).toHaveLength(8 + 8 + 5);

			// walls within their level's area
			const walls = app.world.getChildren().filter((child) => {
				return child.bodyDef !== undefined;
			});
			expect(walls.length).toBeGreaterThan(30);
			const bounds = project.worlds[0].bounds;
			for (const wall of walls) {
				expect(wall.pos.x).toBeGreaterThanOrEqual(bounds.x);
				expect(wall.pos.x + wall.width).toBeLessThanOrEqual(
					bounds.x + bounds.width,
				);
			}

			// taking a level out takes its walls, entities and layers with it
			const before = walls.length;
			const layersBefore = world.layers.length;
			const itsLayers = world.layers.filter((layer) => {
				return layer.pos.x >= 256 && layer.pos.x < 768;
			}).length;
			expect(itsLayers).toBeGreaterThan(0);
			world.unloadLevel("World_Level_0");
			expect(world.layers).toHaveLength(layersBefore - itsLayers);
			expect(world.getLayers()).toBe(world.layers);
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			expect(world.getEntities("Player")).toEqual([]);
			expect(world.getEntities()).toHaveLength(8 + 5);
			const after = app.world.getChildren().filter((child) => {
				return child.bodyDef !== undefined;
			});
			expect(after.length).toBeLessThan(before);
			expect(
				after.every((wall) => {
					return wall.pos.x + wall.width <= 256 || wall.pos.x >= 768;
				}),
			).toBe(true);
			expect(app.world.getChildByName("Player")).toEqual([]);
		});

		it("puts walls and IntGrid values where a level is, down as well as across", async () => {
			const sample = "WorldMap_GridVania_layout";
			const project = projects.get(sample) as LDtkProject;
			// a level that is not on the world's top row
			const info = project.getLevel("Cross_roads") as LDtkLevelInfo;
			expect([info.x, info.y]).toEqual([0, 256]);
			await enter(app, sample, { levels: ["Cross_roads"] });
			const world = current();
			const grid = world.getIntGrid("Cross_roads", "Collisions") as IntGrid;
			expect([grid.x, grid.y]).toEqual([0, 256]);
			const rects = grid.rects();
			expect(rects.length).toBeGreaterThan(0);
			for (const rect of rects) {
				expect(rect.y).toBeGreaterThanOrEqual(256);
				expect(rect.y + rect.height).toBeLessThanOrEqual(256 + info.height);
			}
			// the walls are those rectangles
			const walls = app.world.getChildren().filter((child) => {
				return child.bodyDef !== undefined;
			});
			expect(
				walls
					.map((wall) => {
						return [wall.pos.x, wall.pos.y, wall.width, wall.height].join();
					})
					.sort(),
			).toEqual(
				rects
					.map((rect) => {
						return [rect.x, rect.y, rect.width, rect.height].join();
					})
					.sort(),
			);
		});

		it("finds the levels an area touches, and keeps the ones within reach", async () => {
			const sample = "Typical_TopDown_example";
			await enter(app, sample, { entities: false, levels: [] });
			const world = current();
			expect(world.loadedLevels()).toEqual([]);
			const at = (x: number, y: number, w = 0, h = 0) => {
				return world.levelsAt(x, y, w, h).map((info) => {
					return info.identifier;
				});
			};
			// World_Level_1 from 0, World_Level_0 from 256, World_Level_2 from 768
			expect(at(100, 100)).toEqual(["World_Level_1"]);
			expect(at(500, 100)).toEqual(["World_Level_0"]);
			expect(at(2000, 100)).toEqual([]);
			expect(at(200, 0, 100, 100).sort()).toEqual([
				"World_Level_0",
				"World_Level_1",
			]);
			// a point on the edge two levels share touches both
			expect(at(256, 100).sort()).toEqual(["World_Level_0", "World_Level_1"]);
			expect(at(255, 100)).toEqual(["World_Level_1"]);

			// the player in the first room: that room alone
			expect(world.streamAround(100, 100, 16, 16)).toEqual({
				loaded: ["World_Level_1"],
				unloaded: [],
			});
			// nearing the door: the next room comes in
			expect(world.streamAround(200, 100, 16, 16, 64)).toEqual({
				loaded: ["World_Level_0"],
				unloaded: [],
			});
			expect(world.loadedLevels().sort()).toEqual([
				"World_Level_0",
				"World_Level_1",
			]);
			// well into the second room: the first one goes
			expect(world.streamAround(500, 100, 16, 16, 64)).toEqual({
				loaded: [],
				unloaded: ["World_Level_1"],
			});
			// nothing changes while the player stays
			expect(world.streamAround(510, 100, 16, 16, 64)).toEqual({
				loaded: [],
				unloaded: [],
			});
			expect(world.loadedLevels()).toEqual(["World_Level_0"]);
			// the margin reaches back as well as forward: just right of the
			// first room's edge, the first room is within 64 px on the left
			expect(world.streamAround(300, 100, 16, 16, 64)).toEqual({
				loaded: ["World_Level_1"],
				unloaded: [],
			});
			// and a level is known by its iid as by its identifier
			const iid = world.info.levels[2].iid;
			expect(world.isLoaded(iid)).toBe(false);
			expect(world.loadLevel(iid)).toBe(true);
			expect(world.isLoaded(iid)).toBe(true);
			expect(world.isLoaded(world.info.levels[2].identifier)).toBe(true);
			expect(world.isLoaded("no such level")).toBe(false);
			expect(world.unloadLevel(iid)).toBe(true);
			expect(world.isLoaded(iid)).toBe(false);
		});

		const GRIDVANIA = "WorldMap_GridVania_layout";
		const names = (levels: LDtkLevelInfo[]) => {
			return levels
				.map((info) => {
					return info.identifier;
				})
				.sort();
		};
		// a child taken out leaves once the frame is over
		const nextFrame = () => {
			return new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		};

		it("in a world of stacked levels, finds and keeps the levels of one depth", async () => {
			await enter(app, GRIDVANIA, { entities: false, levels: [] });
			const world = current();
			// the entrance, and the shop a depth above it, cover the same place
			expect(names(world.levelsAt(300, 100))).toEqual(["Entrance", "Shop"]);
			expect(names(world.levelsAt(300, 100, 0, 0, 0))).toEqual(["Entrance"]);
			expect(names(world.levelsAt(300, 100, 0, 0, 1))).toEqual(["Shop"]);
			expect(world.levelsAt(300, 100, 0, 0, 5)).toEqual([]);
			expect(world.streamAround(300, 100, 16, 16, 0, 0)).toEqual({
				loaded: ["Entrance"],
				unloaded: [],
			});
			// up a depth: the levels of the depth left are taken out
			expect(world.streamAround(300, 100, 16, 16, 0, 1)).toEqual({
				loaded: ["Shop"],
				unloaded: ["Entrance"],
			});
			expect(world.loadedLevels()).toEqual(["Shop"]);
			// with no depth, every level the area touches
			world.streamAround(300, 100, 16, 16);
			expect(world.loadedLevels().sort()).toEqual(["Entrance", "Shop"]);
		});

		it("builds the entities the game wants, asked again each time a level is built", async () => {
			const asked: string[] = [];
			const taken = new Set<string>();
			await enter(app, GRIDVANIA, {
				levels: ["Entrance"],
				entities: (entity, info) => {
					asked.push(`${info.identifier}:${entity.__identifier}`);
					return !taken.has(entity.iid) && entity.__identifier !== "Ladder";
				},
			});
			const world = current();
			// the entrance holds three items, the player and a ladder
			expect(asked.sort()).toEqual([
				"Entrance:Item",
				"Entrance:Item",
				"Entrance:Item",
				"Entrance:Ladder",
				"Entrance:Player",
			]);
			expect(world.getEntities("Item")).toHaveLength(3);
			expect(world.getEntities("Player")).toHaveLength(1);
			expect(world.getEntities("Ladder")).toHaveLength(0);
			// an item the player took: not there when the level comes back
			const item = world.getEntities("Item")[0] as LDtkEntity;
			expect(world.getEntity(item.iid)).toBe(item);
			taken.add(item.iid);
			world.unloadLevel("Entrance");
			world.loadLevel("Entrance");
			expect(asked).toHaveLength(10);
			expect(world.getEntities("Item")).toHaveLength(2);
			expect(world.getEntity(item.iid)).toBeUndefined();
			expect(world.getEntity("no such entity")).toBeUndefined();
		});

		it("keeps an entity when its level goes, and does not build it again", async () => {
			await enter(app, GRIDVANIA, { levels: ["Entrance"] });
			const world = current();
			const [player] = world.getEntities("Player");
			expect(world.keep(player)).toBe(true);
			// the game's now: no longer one of the level's, and kept once
			expect(world.keep(player)).toBe(false);
			expect(world.getEntities("Player")).toEqual([]);
			const items = world.getEntities("Item").length;
			expect(items).toBe(3);
			world.unloadLevel("Entrance");
			await nextFrame();
			expect(player.ancestor).toBe(app.world);
			expect(app.world.getChildByName("Player")).toEqual([player]);
			expect(app.world.getChildByName("Item")).toEqual([]);
			// the level again: its items, and not a second player
			world.loadLevel("Entrance");
			expect(app.world.getChildByName("Player")).toEqual([player]);
			expect(world.getEntities("Item")).toHaveLength(items);
			// only an entity of a level in the game can be kept
			expect(world.keep(app.world)).toBe(false);
		});

		it("finds the entity a reference points at, its level loaded or not", async () => {
			const project = projects.get(GRIDVANIA) as LDtkProject;
			await enter(app, GRIDVANIA, { levels: [] });
			const world = current();
			let followed = 0;
			for (const info of project.levels) {
				for (const layer of info.json.layerInstances ?? []) {
					for (const placed of layer.entityInstances) {
						const destination = placed.fieldInstances.find((field) => {
							return field.__identifier === "destination";
						})?.__value as LDtkEntityReference | null | undefined;
						if (destination === null || destination === undefined) {
							continue;
						}
						followed++;
						const found = project.findEntity(destination);
						expect(found, placed.iid).toBeDefined();
						if (found === undefined) {
							continue;
						}
						expect(found.instance.iid).toBe(destination.entityIid);
						expect(found.level.iid).toBe(destination.levelIid);
						expect(found.instance.__identifier).toBe("Teleport");
						// by its iid alone, the same
						expect(project.findEntity(destination.entityIid)).toEqual(found);
						// and where the entity is once its level is in the game
						world.loadLevel(found.level.identifier);
						const built = world.getEntity(destination.entityIid);
						expect(built, placed.iid).toBeDefined();
						expect([built?.pos.x, built?.pos.y]).toEqual([found.x, found.y]);
						expect([built?.width, built?.height]).toEqual([
							found.width,
							found.height,
						]);
					}
				}
			}
			// the sample's teleports, each leading to another
			expect(followed).toBeGreaterThan(4);
			expect(project.findEntity("no such entity")).toBeUndefined();
			expect(project.findEntity(null)).toBeUndefined();
			expect(project.findEntity(undefined)).toBeUndefined();
		});

		it("a level loaded alone takes the same choice of entities, and gives one by its id", async () => {
			await enter(app, `${GRIDVANIA}:Entrance`, {
				entities: (entity) => {
					return entity.__identifier === "Item";
				},
			});
			const loaded = level.getCurrentLevel() as unknown as LDtkLevel;
			const items = loaded.getEntities() as LDtkEntity[];
			expect(items).toHaveLength(3);
			expect(loaded.getEntities("Player")).toEqual([]);
			expect(loaded.getEntity(items[1].iid)).toBe(items[1]);
			expect(loaded.getEntity("no such entity")).toBeUndefined();
			// where the project says it is, less where the level is in its world
			const project = projects.get(GRIDVANIA) as LDtkProject;
			const found = project.findEntity(items[1].iid);
			expect(found).toBeDefined();
			expect([items[1].pos.x, items[1].pos.y]).toEqual([
				(found?.x ?? 0) - (found?.level.x ?? 0),
				(found?.y ?? 0) - (found?.level.y ?? 0),
			]);
		});
	});
}
