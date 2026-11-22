import { type Application, level, type video } from "melonjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	IntGrid,
	type LDtkLevelInfo,
	type LDtkProject,
	LDtkWorld,
} from "../../src/index.ts";
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
} from "./harness.ts";

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
				// the viewport follows the whole world, LDtk's coordinates kept
				const bounds = project.worlds[0].bounds;
				expect(world.x).toBe(bounds.x);
				expect(world.y).toBe(bounds.y);
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
			expect(world.getIntGrid("World_Level_0", "nothing")).toBeUndefined();
			expect(world.getIntGrid("nowhere", "Collisions")).toBeUndefined();

			// the player of that level, placed by its centre at 168, 168
			const players = world.getEntities("Player");
			expect(players).toHaveLength(1);
			expect(players[0].pos.x).toBe(256 + 160);
			expect(players[0].pos.y).toBe(160);
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

			// taking a level out takes its walls and entities with it
			const before = walls.length;
			world.unloadLevel("World_Level_0");
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
		});
	});
}
