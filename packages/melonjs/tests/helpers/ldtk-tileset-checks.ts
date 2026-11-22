import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type Application,
	type LDtkLevel,
	type LDtkProjectJson,
	type LDtkTile,
	level,
	loader,
	TileLayer,
	type video,
} from "../../src/index.js";
import {
	diff,
	enter,
	frame,
	HEIGHT,
	makeApp,
	referenceLevel,
	referenceView,
	WIDTH,
} from "./ldtk-harness.ts";
import { defs, layer, levelJson } from "./ldtk-project-builder.ts";

/**
 * Tilesets the samples that come with LDtk do not have: an image that is not
 * a whole number of tiles wide (LDtk and the engine then count its columns
 * differently, so a tile's number is not the same in both), a spacing and a
 * padding, and two tilesets of different tile sizes cut from one image.
 * LDtk says where each tile is in the image: that is what has to be drawn.
 * @param renderer - the renderer to ask for
 * @param name - its name
 * @param tolerance - the largest difference of a channel that is not counted
 */
export function tilesetChecks(
	renderer: typeof video.CANVAS | typeof video.WEBGL,
	name: string,
	tolerance: number,
) {
	/**
	 * an image where every 8 px block is its own color
	 * @param width - its width
	 * @param height - its height
	 * @returns its data URL
	 */
	const blocks = (width: number, height: number) => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const c = canvas.getContext("2d") as CanvasRenderingContext2D;
		for (let y = 0; y < height; y += 8) {
			for (let x = 0; x < width; x += 8) {
				const n = (x / 8) * 7 + (y / 8) * 13;
				c.fillStyle = `rgb(${String(40 + ((n * 37) % 200))}, ${String(40 + ((n * 59) % 200))}, ${String(40 + ((n * 83) % 200))})`;
				c.fillRect(x, y, 8, 8);
			}
		}
		return canvas.toDataURL("image/png");
	};

	const tilesetDef = (
		uid: number,
		identifier: string,
		relPath: string,
		pxWid: number,
		pxHei: number,
		size: number,
		cols: number,
		rows: number,
		spacing = 0,
		padding = 0,
	) => {
		return {
			uid,
			identifier,
			relPath,
			pxWid,
			pxHei,
			tileGridSize: size,
			spacing,
			padding,
			__cWid: cols,
			__cHei: rows,
			customData: [],
			enumTags: [],
		};
	};

	// 40 x 32, in tiles of 16: two whole columns and half a third, which
	// LDtk counts as a column (3), the engine not (2)
	const oddTile = (
		x: number,
		y: number,
		col: number,
		row: number,
	): LDtkTile => {
		return {
			px: [x, y],
			src: [col * 16, row * 16],
			f: 0,
			t: row * 3 + col,
			a: 1,
		};
	};
	// 2 px around the tiles and 4 px between them: 16 px tiles at 2, 22, 42
	const spacedTile = (
		x: number,
		y: number,
		col: number,
		row: number,
	): LDtkTile => {
		return {
			px: [x, y],
			src: [2 + col * 20, 2 + row * 20],
			f: 0,
			t: row * 3 + col,
			a: 1,
		};
	};

	const project = (): LDtkProjectJson => {
		const definitions = defs();
		definitions.tilesets = [
			tilesetDef(1, "Odd", "art/ldtk-odd.png", 40, 32, 16, 3, 2),
			tilesetDef(2, "Spaced", "art/ldtk-spaced.png", 64, 44, 16, 3, 2, 4, 2),
			tilesetDef(3, "Small", "art/ldtk-shared.png", 64, 32, 16, 4, 2),
			tilesetDef(4, "Large", "art/ldtk-shared.png", 64, 32, 32, 2, 1),
		];
		const grid = (
			tiles: (x: number, y: number, i: number) => LDtkTile,
			count: number,
		) => {
			const list: LDtkTile[] = [];
			for (let i = 0; i < count; i++) {
				list.push(tiles((i % 10) * 16, Math.floor(i / 10) * 16, i));
			}
			return list;
		};
		return {
			jsonVersion: "1.5.3",
			iid: "tilesets",
			bgColor: "#101010",
			defaultGridSize: 16,
			worldLayout: "Free",
			worldGridWidth: 256,
			worldGridHeight: 256,
			externalLevels: false,
			defs: definitions,
			levels: [
				levelJson("Odd", [
					layer(
						"Tiles",
						"AutoLayer",
						16,
						10,
						6,
						// every whole tile of the image, by LDtk's numbers
						grid((x, y, i) => {
							return oddTile(x, y, i % 2, Math.floor(i / 2) % 2);
						}, 60),
						{ __tilesetDefUid: 1 },
					),
				]),
				levelJson("Partial", [
					layer(
						"Tiles",
						"AutoLayer",
						16,
						10,
						6,
						[
							...grid((x, y, i) => {
								return oddTile(x, y, i % 2, 0);
							}, 40),
							// the half column: not a whole tile of the image
							oddTile(0, 80, 2, 0),
							oddTile(16, 80, 2, 1),
						],
						{ __tilesetDefUid: 1 },
					),
				]),
				levelJson("Spaced", [
					layer(
						"Tiles",
						"AutoLayer",
						16,
						10,
						6,
						grid((x, y, i) => {
							return spacedTile(x, y, i % 3, Math.floor(i / 3) % 2);
						}, 60),
						{ __tilesetDefUid: 2 },
					),
				]),
				levelJson("Shared", [
					// 32 px tiles over 16 px ones, from the same image
					layer(
						"Large",
						"AutoLayer",
						32,
						5,
						3,
						[0, 1, 2, 3, 4].flatMap((i) => {
							return [
								{
									px: [i * 32, 32] as [number, number],
									src: [(i % 2) * 32, 0] as [number, number],
									f: 0,
									t: i % 2,
									a: 1,
								},
							];
						}),
						{ __tilesetDefUid: 4 },
					),
					layer(
						"Small",
						"AutoLayer",
						16,
						10,
						6,
						grid((x, y, i) => {
							return {
								px: [x, y],
								src: [(i % 4) * 16, (Math.floor(i / 4) % 2) * 16],
								f: 0,
								t: i % 8,
								a: 1,
							};
						}, 60),
						{ __tilesetDefUid: 3 },
					),
				]),
			],
			worlds: [],
		};
	};

	describe(`the tilesets of an LDtk level, on ${name}`, () => {
		let app: Application;

		beforeAll(async () => {
			app = await makeApp(renderer);
			await loader.preload(
				[
					{ name: "ldtk-odd", type: "image", src: blocks(40, 32) },
					{ name: "ldtk-spaced", type: "image", src: blocks(64, 44) },
					{ name: "ldtk-shared", type: "image", src: blocks(64, 32) },
				],
				undefined,
				false,
			);
			await loader.preload(
				[{ name: "sets", type: "ldtk", data: project() }],
				undefined,
				false,
			);
		});

		afterAll(() => {
			app.destroy();
		});

		/**
		 * expect the level on screen to be the level as the file describes it
		 * @param identifier - the level
		 */
		const expectAsSaved = async (identifier: string) => {
			const found = loader.getLDtk("sets");
			const info = found?.getLevel(identifier);
			expect(info).toBeDefined();
			if (found === null || info === undefined) {
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
							picture: referenceLevel(found.json, info.json, false),
							x: Math.trunc((WIDTH - info.width) / 2),
							y: Math.trunc((HEIGHT - info.height) / 2),
						},
					],
					0,
					0,
				),
				tolerance,
			);
			expect(
				result.different,
				`${identifier}: ${result.first} (worst ${String(result.worst)})`,
			).toBe(0);
		};

		it("an image that is not a whole number of tiles wide: each tile is the one LDtk points at", async () => {
			await expectAsSaved("Odd");
			// on a grid, and so by tile id: the id is the engine's for that
			// place of the image, not LDtk's number
			const layers = (level.getCurrentLevel() as unknown as LDtkLevel).layers;
			expect(layers).toHaveLength(1);
			const grid = layers[0] as TileLayer;
			expect(grid).toBeInstanceOf(TileLayer);
			// LDtk's tile 3 is the first of the second row: the engine's 2
			expect(grid.cellAt(2, 0).tileId).toBe(2 + 1);
			expect(grid.cellAt(3, 0).tileId).toBe(3 + 1);
		});

		it("a tile in a part of the image that is not a whole tile is left out, with a warning", async () => {
			const warned = vi.spyOn(console, "warn").mockImplementation(() => {
				// expected
			});
			const found = loader.getLDtk("sets");
			const info = found?.getLevel("Partial");
			await enter(app, info?.id ?? "");
			const grid = (level.getCurrentLevel() as unknown as LDtkLevel)
				.layers[0] as TileLayer;
			// the 40 whole tiles are there, the two others not
			expect(grid.cellAt(9, 3)).not.toBeNull();
			let cells = 0;
			for (let row = 0; row < grid.rows; row++) {
				for (let col = 0; col < grid.cols; col++) {
					cells +=
						grid.cellAt(col + grid.startx, row + grid.starty) === null ? 0 : 1;
				}
			}
			expect(cells).toBe(40);
			expect(
				warned.mock.calls.some((call) => {
					return String(call[0]).includes("no whole tile");
				}),
			).toBe(true);
			warned.mockRestore();
		});

		it("a tileset with a spacing and a padding", async () => {
			await expectAsSaved("Spaced");
		});

		it("two tilesets of different tile sizes on one image", async () => {
			await expectAsSaved("Shared");
		});
	});
}
