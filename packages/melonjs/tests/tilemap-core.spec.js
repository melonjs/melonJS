import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Container,
	createLevelObject,
	hasObjectFactory,
	mergeGridRects,
	PlacedTileLayer,
	Renderable,
	registerObjectClass,
	registerObjectFactory,
	registerTiledObjectClass,
	registerTiledObjectFactory,
	TileLayer,
	Tileset,
	TilesetGroup,
	TMXLayer,
	TMXTileset,
	TMXTilesetGroup,
	video,
} from "../src/index.js";
import { grabFrame } from "./helpers/pixels.js";

/**
 * The tile map classes that belong to no map editor: a tileset, a tile layer
 * and a layer of freely placed tiles, each built from a plain description,
 * and the object registry under its neutral names. The Tiled classes are
 * built on them, so a reader for another level format can be too.
 *
 * What a layer draws is checked against a picture made with the 2D canvas
 * alone, pixel for pixel.
 */
const SIZE = 96;
const TILE = 8;
const COLS = 4;
const ROWS = 3;

/** the tileset image: 4 x 3 tiles, each its own color with a lighter top left corner */
const tilesImage = (margin = 0, spacing = 0) => {
	const canvas = document.createElement("canvas");
	canvas.width = margin * 2 + COLS * TILE + (COLS - 1) * spacing;
	canvas.height = margin * 2 + ROWS * TILE + (ROWS - 1) * spacing;
	const c = canvas.getContext("2d");
	c.fillStyle = "#ff00ff";
	c.fillRect(0, 0, canvas.width, canvas.height);
	for (let id = 0; id < COLS * ROWS; id++) {
		const x = margin + (id % COLS) * (TILE + spacing);
		const y = margin + Math.floor(id / COLS) * (TILE + spacing);
		c.fillStyle = `rgb(${40 + id * 16}, ${220 - id * 16}, ${(id * 53) % 256})`;
		c.fillRect(x, y, TILE, TILE);
		// a corner, so that a mirrored tile is not the tile
		c.fillStyle = "#ffffff";
		c.fillRect(x, y, 3, 2);
	}
	return canvas;
};

/** where a tile is in the image */
const tileSource = (id, margin = 0, spacing = 0) => {
	return [
		margin + (id % COLS) * (TILE + spacing),
		margin + Math.floor(id / COLS) * (TILE + spacing),
	];
};

describe("mergeGridRects", () => {
	const cover = (rows) => {
		const grid = rows.map((row) => {
			return Array.from(row, (c) => {
				return c === "#";
			});
		});
		const cols = grid[0].length;
		const rects = mergeGridRects(cols, grid.length, (col, row) => {
			return grid[row][col];
		});
		// every solid cell exactly once, no other
		const count = grid.map((row) => {
			return row.map(() => {
				return 0;
			});
		});
		for (const r of rects) {
			for (let y = r.y; y < r.y + r.height; y++) {
				for (let x = r.x; x < r.x + r.width; x++) {
					count[y][x]++;
				}
			}
		}
		for (let y = 0; y < grid.length; y++) {
			for (let x = 0; x < cols; x++) {
				expect(count[y][x], `cell ${x}, ${y}`).toBe(grid[y][x] ? 1 : 0);
			}
		}
		return rects;
	};

	it("an empty grid gives no rectangle", () => {
		expect(cover(["....", "...."])).toEqual([]);
		expect(
			mergeGridRects(0, 0, () => {
				return true;
			}),
		).toEqual([]);
	});

	it("a full grid is one rectangle", () => {
		expect(cover(["####", "####", "####"])).toEqual([
			{ x: 0, y: 0, width: 4, height: 3 },
		]);
	});

	it("a row's runs are apart, and a run joins the one above only over the same columns", () => {
		expect(cover(["##.##", "##.#.", "....."])).toEqual([
			{ x: 0, y: 0, width: 2, height: 2 },
			{ x: 3, y: 0, width: 2, height: 1 },
			{ x: 3, y: 1, width: 1, height: 1 },
		]);
	});

	it("a rectangle ends where a row breaks it, and another starts below", () => {
		expect(cover(["###", "...", "###", "###"])).toEqual([
			{ x: 0, y: 0, width: 3, height: 1 },
			{ x: 0, y: 2, width: 3, height: 2 },
		]);
	});

	it("covers a room's walls with four rectangles", () => {
		const rects = cover(["######", "#....#", "#....#", "#....#", "######"]);
		expect(rects).toHaveLength(4);
	});
});

describe("the object registry, under its neutral names", () => {
	it("is the Tiled registry", () => {
		expect(registerObjectClass).toBe(registerTiledObjectClass);
		expect(registerObjectFactory).toBe(registerTiledObjectFactory);
	});

	it("tells a registered name from one that is not", () => {
		class Chest extends Renderable {
			constructor(x, y, settings) {
				super(x, y, settings.width, settings.height);
				this.loot = settings.loot;
			}
		}
		expect(hasObjectFactory("TilemapCoreChest")).toBe(false);
		registerObjectClass("TilemapCoreChest", Chest);
		expect(hasObjectFactory("TilemapCoreChest")).toBe(true);
		// the engine's own classes are registered too
		expect(hasObjectFactory("Trigger")).toBe(true);

		const chest = createLevelObject({
			class: "TilemapCoreChest",
			name: "c1",
			x: 12,
			y: 34,
			z: 5,
			width: 16,
			height: 8,
			loot: "key",
		});
		expect(chest).toBeInstanceOf(Chest);
		expect(chest.pos.x).toBe(12);
		expect(chest.pos.y).toBe(34);
		expect(chest.pos.z).toBe(5);
		expect(chest.loot).toBe("key");
	});

	it("a tile layer handed to it is the object: any tile layer, not only a Tiled one", () => {
		const layer = new TileLayer({
			name: "plain",
			cols: 2,
			rows: 2,
			tilewidth: 8,
			tileheight: 8,
			tilesets: new TilesetGroup(),
		});
		expect(createLevelObject(layer)).toBe(layer);
	});

	it("a factory is given the description and the map", () => {
		const map = { name: "a map" };
		const factory = vi.fn((settings) => {
			return new Renderable(settings.x, settings.y, 1, 1);
		});
		registerObjectFactory("TilemapCoreSign", factory);
		const settings = { name: "TilemapCoreSign", x: 1, y: 2, z: 0 };
		const made = createLevelObject(settings, map);
		expect(factory).toHaveBeenCalledWith(settings, map);
		expect(made).toBe(factory.mock.results[0].value);
	});
});

describe.each([
	{ name: "WebGL", renderer: video.WEBGL },
	{ name: "Canvas", renderer: video.CANVAS },
])("tile map classes built from a plain description, on $name", (backend) => {
	let app;
	let renderer;
	let image;
	let tileset;

	beforeAll(async () => {
		boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: backend.renderer,
			failIfMajorPerformanceCaveat: false,
			antiAlias: false,
			backgroundColor: "#000000",
		});
		await app.init();
		renderer = app.renderer;
		// a second application in the page takes the stage's camera when reset
		if (app.viewport === undefined) {
			app.reset();
		}
		image = tilesImage();
		tileset = new Tileset({
			name: "tiles",
			image,
			tilewidth: TILE,
			tileheight: TILE,
		});
	});

	afterAll(() => {
		app.destroy();
	});

	/** one frame of the world holding only these renderables */
	const picture = async (...renderables) => {
		for (const renderable of renderables) {
			app.world.addChild(renderable);
		}
		app.world.update(16);
		// drawn without waiting for an update to find them in view
		for (const renderable of renderables) {
			renderable.inViewport = true;
		}
		app.isDirty = true;
		app.draw();
		const frame = grabFrame(renderer);
		for (const renderable of renderables) {
			app.world.removeChildNow(renderable, true);
		}
		return Array.from((await frame).data);
	};

	/** the picture a list of draws gives on a plain 2D canvas over black */
	const reference = (paint) => {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = SIZE;
		const c = canvas.getContext("2d");
		c.fillStyle = "#000000";
		c.fillRect(0, 0, SIZE, SIZE);
		paint(c);
		return Array.from(c.getImageData(0, 0, SIZE, SIZE).data);
	};

	/** a tile on the reference: mirrored and faded as asked */
	const paintTile = (c, id, x, y, flip = 0, alpha = 1, source = image) => {
		const [sx, sy] = tileSource(id);
		c.save();
		c.globalAlpha = alpha;
		c.translate(x + (flip & 1 ? TILE : 0), y + (flip & 2 ? TILE : 0));
		c.scale(flip & 1 ? -1 : 1, flip & 2 ? -1 : 1);
		c.drawImage(source, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
		c.restore();
	};

	/** the pictures match, to within what blending rounds a channel by */
	const expectSame = (actual, expected, tolerance = 0) => {
		let worst = 0;
		let at = -1;
		for (let i = 0; i < expected.length; i++) {
			const d = Math.abs(actual[i] - expected[i]);
			if (d > worst) {
				worst = d;
				at = i;
			}
		}
		const pixel = Math.floor(at / 4);
		expect(
			worst,
			`worst channel difference, at pixel ${pixel % SIZE}, ${Math.floor(pixel / SIZE)}`,
		).toBeLessThanOrEqual(tolerance);
	};

	describe("Tileset", () => {
		it("numbers its tiles from 1, row by row, as far as the image holds", () => {
			expect(tileset.firstgid).toBe(1);
			expect(tileset.lastgid).toBe(COLS * ROWS);
			expect(tileset.contains(1)).toBe(true);
			expect(tileset.contains(COLS * ROWS)).toBe(true);
			expect(tileset.contains(COLS * ROWS + 1)).toBe(false);
			expect(tileset.isCollection).toBe(false);
			expect(tileset.image).toBe(image);
			for (let id = 0; id < COLS * ROWS; id++) {
				const [sx, sy] = tileSource(id);
				const frame = tileset.atlas[tileset.getViewTileId(id + 1)];
				expect([frame.offset.x, frame.offset.y], `tile ${id}`).toEqual([
					sx,
					sy,
				]);
			}
		});

		it("takes a margin, a spacing, a first gid and a tile count", () => {
			const spaced = new Tileset({
				image: tilesImage(3, 2),
				tilewidth: TILE,
				tileheight: TILE,
				margin: 3,
				spacing: 2,
				firstgid: 100,
				tilecount: 10,
			});
			expect(spaced.firstgid).toBe(100);
			expect(spaced.lastgid).toBe(109);
			for (let id = 0; id < 10; id++) {
				const frame = spaced.atlas[id];
				expect([frame.offset.x, frame.offset.y], `tile ${id}`).toEqual(
					tileSource(id, 3, 2),
				);
			}
		});

		it("refuses an image that was not loaded, by its name", () => {
			expect(() => {
				return new Tileset({
					name: "missing",
					image: "tilemap-core-no-such-image",
					tilewidth: TILE,
					tileheight: TILE,
				});
			}).toThrow(/'tilemap-core-no-such-image' file for tileset 'missing'/);
		});

		it("holds properties, a class and an animation for a tile", () => {
			const own = new Tileset({
				image: tilesImage(),
				tilewidth: TILE,
				tileheight: TILE,
			});
			expect(own.getTileProperties(3)).toBeUndefined();
			expect(own.getTileClass(3)).toBeUndefined();
			own.setTileProperty(3, { solid: true });
			own.setTileClass(3, "Wall");
			expect(own.getTileProperties(3)).toEqual({ solid: true });
			expect(own.getTileClass(3)).toBe("Wall");

			expect(own.isAnimated).toBe(false);
			own.setTileAnimation(1, [
				{ tileid: 1, duration: 100 },
				{ tileid: 5, duration: 100 },
			]);
			expect(own.isAnimated).toBe(true);
			expect(own.getViewTileId(2)).toBe(1);
			// another tile is not animated
			expect(own.getViewTileId(3)).toBe(2);
		});

		it("is what a Tiled tileset is built on", () => {
			expect(Object.getPrototypeOf(TMXTileset)).toBe(Tileset);
		});
	});

	describe("TilesetGroup", () => {
		it("finds the tileset of a gid among the ones it is given", () => {
			const second = new Tileset({
				image: tilesImage(),
				tilewidth: TILE,
				tileheight: TILE,
				firstgid: 13,
			});
			const group = new TilesetGroup([tileset, second]);
			expect(group.length).toBe(2);
			expect(group.getTilesetByIndex(1)).toBe(second);
			expect(group.getTilesetByGid(12)).toBe(tileset);
			expect(group.getTilesetByGid(13)).toBe(second);
			expect(() => {
				return group.getTilesetByGid(99);
			}).toThrow(/no matching tileset/);
			expect(new TMXTilesetGroup()).toBeInstanceOf(TilesetGroup);
		});
	});

	describe("TileLayer", () => {
		const layerOf = (def = {}) => {
			return new TileLayer({
				name: "ground",
				cols: 6,
				rows: 5,
				tilewidth: TILE,
				tileheight: TILE,
				tilesets: new TilesetGroup([tileset]),
				// compared tile for tile, not through the layer's GPU path
				renderMode: "perTile",
				...def,
			});
		};

		it("is an empty grid of the size asked, which a Tiled layer is too", () => {
			const layer = layerOf();
			expect(layer.cols).toBe(6);
			expect(layer.rows).toBe(5);
			expect(layer.width).toBe(6 * TILE);
			expect(layer.height).toBe(5 * TILE);
			expect(layer.name).toBe("ground");
			expect(layer.orientation).toBe("orthogonal");
			for (let row = 0; row < 5; row++) {
				for (let col = 0; col < 6; col++) {
					expect(layer.cellAt(col, row)).toBeNull();
				}
			}
			expect(Object.getPrototypeOf(TMXLayer)).toBe(TileLayer);
		});

		it("reads back the cells it is given", () => {
			const layer = layerOf();
			layer.setCell(2, 1, 5);
			layer.setCell(3, 4, 12, 1);
			const tile = layer.cellAt(2, 1);
			expect(tile.tileId).toBe(5);
			expect(tile.flipped).toBe(false);
			const mirrored = layer.cellAt(3, 4);
			expect(mirrored.tileId).toBe(12);
			expect(mirrored.flippedX).toBe(true);
			expect(layer.getTileId(2 * TILE + 1, TILE + 1)).toBe(5);
			layer.clearTile(2, 1);
			expect(layer.cellAt(2, 1)).toBeNull();
		});

		it("draws its cells where they are, mirrored where asked", async () => {
			const layer = layerOf();
			layer.setCell(0, 0, 1);
			layer.setCell(1, 0, 2, 1);
			layer.setCell(5, 4, 12, 2);
			layer.setCell(2, 3, 7, 3);
			expectSame(
				await picture(layer),
				reference((c) => {
					paintTile(c, 0, 0, 0);
					paintTile(c, 1, TILE, 0, 1);
					paintTile(c, 11, 5 * TILE, 4 * TILE, 2);
					paintTile(c, 6, 2 * TILE, 3 * TILE, 3);
				}),
			);
		});

		it("is moved by its offset, and faded by its opacity", async () => {
			const layer = layerOf({ offsetx: 13, offsety: 21, opacity: 0.5 });
			layer.setCell(1, 1, 4);
			expect(layer.pos.x).toBe(13);
			expect(layer.pos.y).toBe(21);
			expectSame(
				await picture(layer),
				reference((c) => {
					paintTile(c, 3, 13 + TILE, 21 + TILE, 0, 0.5);
				}),
				1,
			);
		});

		it("a non-orthogonal grid needs the renderer of its map", () => {
			expect(() => {
				return layerOf({ orientation: "isometric" });
			}).toThrow(/needs the renderer of its map/);
		});
	});

	describe("PlacedTileLayer", () => {
		const placed = (tiles, def = {}) => {
			return new PlacedTileLayer({ name: "props", tileset, tiles, ...def });
		};

		it("holds its tiles in the order given, and reaches as far as they do", () => {
			const layer = placed([
				{ x: 3, y: 5, tileId: 2 },
				{ x: 40, y: 20, tileId: 9, flip: 3, alpha: 0.25 },
			]);
			expect(layer.length).toBe(2);
			expect(layer.getTile(0)).toEqual({
				x: 3,
				y: 5,
				tileId: 2,
				flip: 0,
				alpha: 1,
			});
			expect(layer.getTile(1)).toEqual({
				x: 40,
				y: 20,
				tileId: 9,
				flip: 3,
				alpha: 0.25,
			});
			expect(layer.getTile(2)).toBeUndefined();
			expect(layer.width).toBe(40 + TILE);
			expect(layer.height).toBe(20 + TILE);
			expect(layer.name).toBe("props");

			// a size given is kept where the tiles do not reach it
			const sized = placed([{ x: 0, y: 0, tileId: 0 }], {
				width: 64,
				height: 48,
			});
			expect(sized.width).toBe(64);
			expect(sized.height).toBe(48);
		});

		it("grows past its first allocation without losing a tile", () => {
			const layer = placed([]);
			for (let i = 0; i < 300; i++) {
				expect(layer.addTile(i, i * 2, i % 12, i % 4, 1)).toBe(i);
			}
			expect(layer.length).toBe(300);
			for (const i of [0, 63, 64, 127, 128, 299]) {
				expect(layer.getTile(i)).toEqual({
					x: i,
					y: i * 2,
					tileId: i % 12,
					flip: i % 4,
					alpha: 1,
				});
			}
		});

		it("finds the tiles covering a point, bottom-most first", () => {
			const layer = placed([
				{ x: 10, y: 10, tileId: 0 },
				{ x: 30, y: 10, tileId: 1 },
				{ x: 14, y: 12, tileId: 2 },
			]);
			expect(layer.tilesAt(15, 13)).toEqual([0, 2]);
			expect(layer.tilesAt(10, 10)).toEqual([0]);
			// a tile ends before its right and bottom edges
			expect(layer.tilesAt(18, 18)).toEqual([2]);
			expect(layer.tilesAt(22, 20)).toEqual([]);
			expect(layer.tilesAt(0, 0)).toEqual([]);
		});

		it("changes a tile in place, and is emptied", () => {
			const layer = placed([{ x: 4, y: 4, tileId: 1, flip: 1, alpha: 0.5 }], {
				width: 20,
				height: 20,
			});
			layer.setTile(0, 6);
			expect(layer.getTile(0)).toEqual({
				x: 4,
				y: 4,
				tileId: 6,
				flip: 1,
				alpha: 0.5,
			});
			layer.setTile(0, 7, 2, 1);
			expect(layer.getTile(0)).toEqual({
				x: 4,
				y: 4,
				tileId: 7,
				flip: 2,
				alpha: 1,
			});
			expect(() => {
				return layer.setTile(1, 0);
			}).toThrow(RangeError);
			layer.clear();
			expect(layer.length).toBe(0);
			expect(layer.width).toBe(20);
			expect(layer.height).toBe(20);
		});

		it("draws tiles off the grid, over one another in the order of the list", async () => {
			const tiles = [
				{ x: 5, y: 7, tileId: 0 },
				{ x: 9, y: 10, tileId: 5 },
				{ x: 11, y: 3, tileId: 10 },
				{ x: 60, y: 61, tileId: 3 },
			];
			expectSame(
				await picture(placed(tiles)),
				reference((c) => {
					for (const t of tiles) {
						paintTile(c, t.tileId, t.x, t.y);
					}
				}),
			);
			// the other way round is another picture: the order is what is drawn
			const reversed = reference((c) => {
				for (const t of [...tiles].reverse()) {
					paintTile(c, t.tileId, t.x, t.y);
				}
			});
			expect(await picture(placed(tiles))).not.toEqual(reversed);
		});

		it("mirrors a tile across, down, and both", async () => {
			const tiles = [
				{ x: 4, y: 4, tileId: 1, flip: 0 },
				{ x: 20, y: 4, tileId: 1, flip: 1 },
				{ x: 36, y: 4, tileId: 1, flip: 2 },
				{ x: 52, y: 4, tileId: 1, flip: 3 },
			];
			expectSame(
				await picture(placed(tiles)),
				reference((c) => {
					for (const t of tiles) {
						paintTile(c, t.tileId, t.x, t.y, t.flip);
					}
				}),
			);
		});

		it("fades a tile by its own opacity, and the next one not", async () => {
			const tiles = [
				{ x: 4, y: 4, tileId: 2 },
				{ x: 8, y: 8, tileId: 6, alpha: 0.5 },
				{ x: 12, y: 12, tileId: 9, alpha: 0.25 },
				{ x: 40, y: 12, tileId: 4 },
			];
			expectSame(
				await picture(placed(tiles)),
				reference((c) => {
					for (const t of tiles) {
						paintTile(c, t.tileId, t.x, t.y, 0, t.alpha ?? 1);
					}
				}),
				2,
			);
		});

		it("is moved by its offset, faded by its opacity, and both with a tile's own", async () => {
			const tiles = [
				{ x: 0, y: 0, tileId: 8 },
				{ x: 20, y: 6, tileId: 3, alpha: 0.5 },
			];
			const layer = placed(tiles, { offsetx: 17, offsety: 29, opacity: 0.5 });
			expect(layer.pos.x).toBe(17);
			expect(layer.pos.y).toBe(29);
			expectSame(
				await picture(layer),
				reference((c) => {
					paintTile(c, 8, 17, 29, 0, 0.5);
					paintTile(c, 3, 37, 35, 0, 0.25);
				}),
				2,
			);
		});

		it("draws between the layers around it, by its z", async () => {
			const under = placed([{ x: 10, y: 10, tileId: 0 }], { z: 1 });
			const over = placed([{ x: 14, y: 14, tileId: 5 }], { z: 2 });
			const expected = reference((c) => {
				paintTile(c, 0, 10, 10);
				paintTile(c, 5, 14, 14);
			});
			// whichever is added first
			expectSame(await picture(over, under), expected);
		});

		it("is drawn where a moved container puts it", async () => {
			const container = new Container(20, 30, 40, 40);
			container.anchorPoint.set(0, 0);
			container.addChild(placed([{ x: 2, y: 3, tileId: 7 }]));
			expectSame(
				await picture(container),
				reference((c) => {
					paintTile(c, 7, 22, 33);
				}),
			);
		});

		it("keeps the tiles a moved container brings into view", async () => {
			// out of the view by its own position, in it by the container's
			const container = new Container(-200, -150, 400, 400);
			container.anchorPoint.set(0, 0);
			container.addChild(
				placed([
					{ x: 210, y: 160, tileId: 4 },
					{ x: 10, y: 10, tileId: 1 },
				]),
			);
			expectSame(
				await picture(container),
				reference((c) => {
					paintTile(c, 4, 10, 10);
				}),
			);
		});

		it("draws only the tiles in view", async () => {
			const tiles = [];
			// a field far larger than the 96 px view, a tile every 16 px
			for (let y = 0; y < 640; y += 16) {
				for (let x = 0; x < 640; x += 16) {
					tiles.push({ x, y, tileId: (x / 16 + y / 16) % 12 });
				}
			}
			const layer = placed(tiles);
			const drawn = vi.spyOn(tileset, "drawTileRaw");
			await picture(layer);
			// 6 x 6 of the 1600 are in the view
			expect(drawn).toHaveBeenCalledTimes(36);
			drawn.mockRestore();
		});

		it("follows the camera", async () => {
			const tiles = [
				{ x: 200, y: 150, tileId: 4 },
				{ x: 230, y: 170, tileId: 9 },
				// out of the view once the camera is there
				{ x: 10, y: 10, tileId: 1 },
			];
			const layer = placed(tiles, { width: 400, height: 300 });
			const viewport = app.viewport;
			const bounds = viewport.bounds.clone();
			viewport.setBounds(0, 0, 400, 300);
			viewport.moveTo(190, 140);
			const actual = await picture(layer);
			viewport.moveTo(0, 0);
			viewport.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
			expectSame(
				actual,
				reference((c) => {
					paintTile(c, 4, 10, 10);
					paintTile(c, 9, 40, 30);
				}),
			);
		});

		it("shows the frames of a tile its tileset animates", async () => {
			const animated = new Tileset({
				image: tilesImage(),
				tilewidth: TILE,
				tileheight: TILE,
			});
			animated.setTileAnimation(2, [
				{ tileid: 2, duration: 100 },
				{ tileid: 11, duration: 100 },
			]);
			const layer = new PlacedTileLayer({
				tileset: animated,
				tiles: [{ x: 6, y: 6, tileId: 2 }],
			});
			expectSame(
				await picture(layer),
				reference((c) => {
					paintTile(c, 2, 6, 6);
				}),
			);
			// the second frame, once the first has had its time
			const next = new PlacedTileLayer({
				tileset: animated,
				tiles: [{ x: 6, y: 6, tileId: 2 }],
			});
			animated.animations.get(2).dt = 0;
			animated.animations.get(2).idx = 1;
			animated.animations.get(2).cur = animated.animations.get(2).frames[1];
			expectSame(
				await picture(next),
				reference((c) => {
					paintTile(c, 11, 6, 6);
				}),
			);
		});
	});
});
