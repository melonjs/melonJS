/**
 * A level made with LDtk, loaded by the engine, read by the plugin as a
 * Tiled map is: its walls come from an IntGrid layer rather than from an
 * object layer, and the grid built from the collision shapes has to know
 * them all the same.
 */
import {
	Application,
	boot,
	type LDtkLevel,
	level,
	loader,
	state,
	Vector2d,
	video,
} from "melonjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PathfindingPlugin } from "../src/index.ts";

const T = 16;
const COLS = 10;
const ROWS = 6;

// a room: walls all around, and one across the middle with a gap in it
const walls = [
	"##########",
	"#........#",
	"#........#",
	"####.#####",
	"#........#",
	"##########",
];

const project = {
	jsonVersion: "1.5.3",
	iid: "pf-ldtk",
	bgColor: "#101010",
	defaultGridSize: T,
	worldLayout: "Free",
	worldGridWidth: 256,
	worldGridHeight: 256,
	externalLevels: false,
	defs: {
		tilesets: [],
		layers: [
			{
				uid: 1,
				identifier: "Collisions",
				type: "IntGrid",
				gridSize: T,
				intGridValues: [{ value: 1, identifier: "walls", color: "#000000" }],
			},
		],
		entities: [],
		enums: [],
	},
	levels: [
		{
			identifier: "Room",
			iid: "room-iid",
			uid: 0,
			worldX: 0,
			worldY: 0,
			worldDepth: 0,
			pxWid: COLS * T,
			pxHei: ROWS * T,
			__bgColor: "#203040",
			fieldInstances: [],
			layerInstances: [
				{
					__identifier: "Collisions",
					__type: "IntGrid",
					__cWid: COLS,
					__cHei: ROWS,
					__gridSize: T,
					__opacity: 1,
					__pxTotalOffsetX: 0,
					__pxTotalOffsetY: 0,
					__tilesetDefUid: null,
					__tilesetRelPath: null,
					iid: "collisions-iid",
					levelId: 0,
					layerDefUid: 1,
					visible: true,
					intGridCsv: walls.flatMap((row) => {
						return Array.from(row, (c) => {
							return c === "#" ? 1 : 0;
						});
					}),
					autoLayerTiles: [],
					gridTiles: [],
					entityInstances: [],
				},
			],
			__neighbours: [],
		},
	],
	worlds: [],
};

describe("a grid from a level made with LDtk", () => {
	let app: Application;

	beforeAll(async () => {
		boot();
		app = new Application(COLS * T, ROWS * T, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		await loader.preload(
			[{ name: "pf-ldtk", type: "ldtk", data: project }],
			undefined,
			false,
		);
		state.stop();
		await level.load("pf-ldtk:Room", {
			container: app.world,
			setViewportBounds: false,
			async: true,
		});
	});

	afterAll(() => {
		app.destroy();
	});

	it("is built from the walls of the IntGrid layer, cell for cell", () => {
		const plugin = new PathfindingPlugin({}, app);
		const grid = plugin.grid;
		expect(grid).not.toBeNull();
		if (grid === null) {
			return;
		}
		expect(grid.cols).toBe(COLS);
		expect(grid.rows).toBe(ROWS);
		const loaded = level.getCurrentLevel() as unknown as LDtkLevel;
		const values = loaded.getIntGrid("Collisions");
		expect(values).toBeDefined();
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				expect(grid.isSolid(col, row), `cell ${col}, ${row}`).toBe(
					walls[row][col] === "#",
				);
				expect(values?.valueAt(col, row)).toBe(walls[row][col] === "#" ? 1 : 0);
			}
		}
	});

	it("finds the way through the gap in the wall, and none once it is closed", () => {
		const plugin = new PathfindingPlugin({}, app);
		const grid = plugin.grid;
		expect(grid).not.toBeNull();
		if (grid === null) {
			return;
		}
		const from = new Vector2d(1.5 * T, 1.5 * T);
		const to = new Vector2d(8.5 * T, 4.5 * T);
		const { found, path } = grid.findPath(from, to);
		expect(found).toBe(true);
		// through the only opening, in column 4 of row 3
		expect(
			path.some((point) => {
				return Math.floor(point.x / T) === 4 && Math.floor(point.y / T) === 3;
			}),
		).toBe(true);
		// no step of it inside a wall
		for (const point of path) {
			expect(walls[Math.floor(point.y / T)][Math.floor(point.x / T)]).toBe(".");
		}
		grid.setSolid(4, 3, true);
		expect(grid.findPath(from, to).found).toBe(false);
	});
});
