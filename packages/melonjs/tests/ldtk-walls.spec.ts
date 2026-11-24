import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Application,
	collision,
	type LDtkLevel,
	level,
	Rect,
	Renderable,
	registerObjectFactory,
	video,
} from "../src/index.js";
import { enter, loadSamples, makeApp } from "./helpers/ldtk-harness.ts";

/**
 * The walls of an LDtk level are what the unnamed shapes of a Tiled map's
 * collision layer are: built by the object registry's "shape" factory, then
 * made static walls of the world. A game that replaced that factory for its
 * Tiled maps gets its own objects for the walls of an LDtk level as well.
 */
describe("the walls of an LDtk level, built as a Tiled map's are", () => {
	let app: Application;

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
		await loadSamples();
	});

	afterAll(() => {
		app.destroy();
	});

	const walls = () => {
		return app.world.getChildren().filter((child) => {
			return child.bodyDef !== undefined;
		});
	};

	it("a body in the physics world for each, which stops what falls on it", async () => {
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const built = walls();
		expect(built.length).toBeGreaterThan(10);
		// each is in the world's bodies, as a wall
		for (const wall of built) {
			const body = wall.body as { collisionType: number } | undefined;
			expect(body).toBeDefined();
			expect(body?.collisionType).toBe(collision.types.WORLD_SHAPE);
		}
		// the layer's solid cells, and nothing else, are inside a wall
		const grid = (level.getCurrentLevel() as unknown as LDtkLevel).getIntGrid(
			"Collisions",
		);
		expect(grid).toBeDefined();
		if (grid === undefined) {
			return;
		}
		const inWall = (x: number, y: number) => {
			return built.some((wall) => {
				return (
					x >= wall.pos.x &&
					x < wall.pos.x + wall.width &&
					y >= wall.pos.y &&
					y < wall.pos.y + wall.height
				);
			});
		};
		for (let row = 0; row < grid.rows; row++) {
			for (let col = 0; col < grid.cols; col++) {
				expect(
					inWall(col * 16 + 8, row * 16 + 8),
					`cell ${String(col)}, ${String(row)}`,
				).toBe(grid.valueAt(col, row) !== 0);
			}
		}
	});

	it("come from the game's own shape factory, when it registered one", async () => {
		const made: { x: number; y: number; width: number; height: number }[] = [];
		class Wall extends Renderable {
			custom = true;
		}
		registerObjectFactory(
			"shape",
			(settings: {
				x: number;
				y: number;
				width: number;
				height: number;
				intGridValue?: number;
			}) => {
				made.push(settings);
				const wall = new Wall(
					settings.x,
					settings.y,
					settings.width,
					settings.height,
				);
				wall.anchorPoint.set(0, 0);
				// a sensor, until the level makes it a wall
				wall.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, settings.width, settings.height)],
					collisionType: collision.types.ACTION_OBJECT,
				};
				return wall;
			},
		);
		await enter(app, "Typical_TopDown_example:World_Level_0");
		const built = walls();
		expect(built.length).toBeGreaterThan(10);
		expect(made).toHaveLength(built.length);
		for (const wall of built) {
			expect(wall).toBeInstanceOf(Wall);
			// made a static wall of the world all the same
			const def = wall.bodyDef as { type: string; collisionType: number };
			expect(def.type).toBe("static");
			expect(def.collisionType).toBe(collision.types.WORLD_SHAPE);
			expect(wall.name).toBe("Collisions");
		}
		// the factory was told what each wall is made of
		expect(
			made.every((settings) => {
				return (settings as { intGridValue?: number }).intGridValue === 1;
			}),
		).toBe(true);
	});
});
