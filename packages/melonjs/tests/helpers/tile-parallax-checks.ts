import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Application,
	Container,
	type LDtkLevel,
	type LDtkProjectJson,
	level,
	loader,
	PlacedTileLayer,
	type Renderable,
	TileLayer,
	Tileset,
	TilesetGroup,
	Vector2d,
	video,
} from "../../src/index.js";
import {
	diff,
	enter,
	frame,
	HEIGHT,
	makeApp,
	objectsIn,
	WIDTH,
} from "./ldtk-harness.ts";
import {
	defs,
	entity,
	layer,
	levelJson,
	projectJson,
	TILE,
	tile,
	tilesetImage,
} from "./ldtk-project-builder.ts";
import { paintTile as paintSquare } from "./pixels.js";

/** a tile of a layer under test: where it is in the layer, and which it is */
interface Placed {
	x: number;
	y: number;
	id: number;
	/** 1: mirrored across; 2: mirrored down */
	flip: number;
}

/** a point, or a value for each axis */
interface XY {
	x: number;
	y: number;
}

/** how a layer scrolls with the camera, as a tile layer's definition takes it */
interface Scrolling {
	/** 1 scrolls with the world, 0 stays on the screen */
	ratio?: number | XY;
	/** where the camera is when the layer is where it was placed */
	parallaxOrigin?: XY;
	/** the point of the view that is measured: its top left corner unless said */
	parallaxAnchor?: XY;
	parallaxScale?: number;
}

/** a tile layer, as far as its scrolling goes */
type ScrollingLayer = Renderable & {
	ratio: Vector2d;
	parallaxOrigin: Vector2d;
	parallaxAnchor: Vector2d;
	parallaxScale: number;
};

/** the middle of the view, as an anchor */
const CENTRE = { x: 0.5, y: 0.5 };

/**
 * how a layer scrolls, read from it
 * @param layer - a tile layer
 * @returns its ratio, its origin, its anchor and its scale
 */
const scrollingOf = (layer: Renderable | undefined) => {
	const read = layer as ScrollingLayer;
	return {
		ratio: [read.ratio.x, read.ratio.y],
		origin: [read.parallaxOrigin.x, read.parallaxOrigin.y],
		anchor: [read.parallaxAnchor.x, read.parallaxAnchor.y],
		scale: read.parallaxScale,
	};
};

const BACKGROUND = "#101830";

/**
 * Tile layers that scroll at a pace of their own: a layer's `ratio` is the
 * share of the camera's movement it makes in the world, as an image layer's,
 * and its `parallaxScale` scales it. Each frame is compared with
 * the same tiles painted with the 2D canvas alone, where the rule puts them.
 * @param renderer - the renderer to ask for
 * @param name - its name
 * @param tolerance - the largest difference of a channel that is not counted
 * @param gpuEdge - the share of the view's pixels that may differ where a
 * scaled layer is drawn by the GPU's tile shader: it draws the layer as one
 * piece, so the tiles inside it are not each put on whole pixels as tiles
 * drawn one by one are, and differ from them by a pixel along some edges
 */
export function parallaxChecks(
	renderer: typeof video.CANVAS | typeof video.WEBGL,
	name: string,
	tolerance: number,
	gpuEdge: number,
) {
	// in pixels
	const edge = Math.round(gpuEdge * WIDTH * HEIGHT);
	let app: Application;
	let image: HTMLImageElement;

	beforeAll(async () => {
		app = await makeApp(renderer);
		await loader.load({
			name: "ldtk-test-tiles",
			type: "image",
			src: tilesetImage(),
		});
		image = loader.getImage("ldtk-test-tiles") as HTMLImageElement;
	});

	afterAll(() => {
		app.destroy();
	});

	// paint a tile with the 2D canvas, its top left corner at the origin
	const paintTile = (
		c: CanvasRenderingContext2D,
		id: number,
		flip: number,
		alpha = 1,
	) => {
		const sx = (id % 4) * TILE;
		const sy = Math.floor(id / 4) * TILE;
		paintSquare(c, image, sx, sy, TILE, 0, 0, flip, alpha);
	};

	// a canvas the size of the view, filled with a color
	const blank = (color: string) => {
		const canvas = document.createElement("canvas");
		canvas.width = WIDTH;
		canvas.height = HEIGHT;
		const c = canvas.getContext("2d") as CanvasRenderingContext2D;
		c.imageSmoothingEnabled = false;
		c.fillStyle = color;
		c.fillRect(0, 0, WIDTH, HEIGHT);
		return c;
	};

	const pixels = (c: CanvasRenderingContext2D) => {
		return c.getImageData(0, 0, WIDTH, HEIGHT).data;
	};

	/**
	 * Paint the tiles of a layer where the layer is, at its scale. Each tile
	 * lands on whole pixels, as everything the engine draws does unless
	 * `subPixel` is set: each edge of the box it covers is rounded to the
	 * nearest pixel, and the tile stretched by less than a pixel to fit.
	 * @param c - where to paint
	 * @param tiles - the tiles, where they are in the layer
	 * @param x - where the point the layer is scaled from is drawn
	 * @param y - where the point the layer is scaled from is drawn
	 * @param insideX - where the layer's corner is from that point
	 * @param insideY - where the layer's corner is from that point
	 * @param scale - the layer's scale
	 */
	const paintLayer = (
		c: CanvasRenderingContext2D,
		tiles: { x: number; y: number; id: number; flip: number; alpha?: number }[],
		x: number,
		y: number,
		insideX: number,
		insideY: number,
		scale: number,
	) => {
		for (const placed of tiles) {
			const left = Math.round(x + scale * (insideX + placed.x));
			const top = Math.round(y + scale * (insideY + placed.y));
			const right = Math.round(x + scale * (insideX + placed.x + TILE));
			const bottom = Math.round(y + scale * (insideY + placed.y + TILE));
			c.save();
			c.translate(left, top);
			c.scale((right - left) / TILE, (bottom - top) / TILE);
			paintTile(c, placed.id, placed.flip, placed.alpha);
			c.restore();
		}
	};

	describe(`tile layers that follow the camera, on ${name}`, () => {
		// where the layers under test are placed, in their container
		const AT = { x: 40, y: 24 };
		// a grid of tiles with holes in it, some mirrored
		const gridTiles: Placed[] = [];
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 12; col++) {
				if ((col + row * 2) % 5 !== 0) {
					gridTiles.push({
						x: col * TILE,
						y: row * TILE,
						id: (col + row * 3) % 8,
						flip: (col * 7 + row) % 3,
					});
				}
			}
		}
		// tiles off any grid, some over others
		const looseTiles: Placed[] = gridTiles.map((placed, i) => {
			return {
				...placed,
				x: placed.x + (i % 3) * 5,
				y: placed.y + (i % 2) * 7,
			};
		});

		const tileset = () => {
			return new Tileset({
				name: "parallax tiles",
				image: "ldtk-test-tiles",
				tilewidth: TILE,
				tileheight: TILE,
			});
		};

		const gridLayer = (parallax?: Scrolling, renderMode = "auto") => {
			const made = new TileLayer({
				name: "grid",
				cols: 12,
				rows: 8,
				tilewidth: TILE,
				tileheight: TILE,
				tilesets: new TilesetGroup([tileset()]),
				offsetx: AT.x,
				offsety: AT.y,
				...parallax,
				renderMode,
			});
			for (const placed of gridTiles) {
				made.setCell(
					placed.x / TILE,
					placed.y / TILE,
					placed.id + 1,
					placed.flip,
				);
			}
			return made;
		};

		const looseLayer = (parallax?: Scrolling) => {
			return new PlacedTileLayer({
				name: "loose",
				tileset: tileset(),
				offsetx: AT.x,
				offsety: AT.y,
				...parallax,
				tiles: looseTiles.map((placed) => {
					return {
						x: placed.x,
						y: placed.y,
						tileId: placed.id,
						flip: placed.flip,
					};
				}),
			});
		};

		const KINDS: [string, (parallax?: Scrolling) => Renderable, Placed[]][] = [
			["a grid layer", gridLayer, gridTiles],
			// drawn once to a canvas of its own, which is what is then drawn
			[
				"a pre-rendered grid layer",
				(parallax) => {
					return gridLayer(parallax, "prerender");
				},
				gridTiles,
			],
			["a layer of placed tiles", looseLayer, looseTiles],
		];

		// put a layer in the world, alone, or in a container of the world
		const show = (made: Renderable, inside?: Container) => {
			app.world.reset();
			app.world.pos.set(0, 0);
			app.world.backgroundColor.parseCSS(BACKGROUND);
			if (inside !== undefined) {
				inside.addChild(made, 1);
				app.world.addChild(inside, 1);
			} else {
				app.world.addChild(made, 1);
			}
			app.viewport.setBounds(-4000, -4000, 8000, 8000);
		};

		const look = (x: number, y: number) => {
			app.viewport.moveTo(x, y);
			return frame(app);
		};

		// the frame the rule gives: a point of the layer's container is
		// drawn at the origin, plus what the ratio leaves of the way from
		// the origin to the view's anchor in whole pixels, plus its own
		// distance from the origin, scaled
		const expected = (
			tiles: Placed[],
			parallax: Scrolling | undefined,
			viewX: number,
			viewY: number,
			containerX = 0,
			containerY = 0,
		) => {
			const c = blank(BACKGROUND);
			const scale = parallax?.parallaxScale ?? 1;
			const given = parallax?.ratio ?? 1;
			const ratio = typeof given === "number" ? { x: given, y: given } : given;
			const originX = parallax?.parallaxOrigin?.x ?? 0;
			const originY = parallax?.parallaxOrigin?.y ?? 0;
			// the point of the view the layer is measured to (its top left
			// corner, unless the layer says another), in the container's
			// coordinates
			const anchor = parallax?.parallaxAnchor ?? { x: 0, y: 0 };
			const anchorX = viewX + WIDTH * anchor.x - containerX;
			const anchorY = viewY + HEIGHT * anchor.y - containerY;
			// the origin, moved to a whole pixel; the layer scaled from it
			const frameX = Math.round(originX + (anchorX - originX) * (1 - ratio.x));
			const frameY = Math.round(originY + (anchorY - originY) * (1 - ratio.y));
			paintLayer(
				c,
				tiles,
				frameX + containerX - viewX,
				frameY + containerY - viewY,
				AT.x - originX,
				AT.y - originY,
				scale,
			);
			return pixels(c);
		};

		const VIEWS: [number, number][] = [
			[0, 0],
			[100, 40],
			[-70, -30],
			[37, 13],
		];

		describe.each(KINDS)("%s", (kind, make, tiles) => {
			// Tiles placed one by one are drawn one by one, on every
			// renderer: each to whole pixels, as the reference paints them.
			// A layer drawn in one piece (by the tile shader, or from the
			// canvas it was pre-rendered to) is sampled as one picture when
			// scaled, and differs along the edges of its tiles: under 1% of
			// the frame for a pre-rendered one.
			let scaledEdge = 0;
			if (kind === "a grid layer") {
				scaledEdge = edge;
			} else if (kind === "a pre-rendered grid layer") {
				scaledEdge = Math.round(0.01 * WIDTH * HEIGHT);
			}

			it("with no parallax, is drawn where it was placed", () => {
				show(make());
				for (const [x, y] of VIEWS) {
					const result = diff(
						look(x, y),
						expected(tiles, undefined, x, y),
						tolerance,
					);
					expect(result.different, `${String(x)}, ${String(y)}`).toBe(0);
				}
			});

			it("scrolls by its ratio, and is in its place when the camera is on its origin", () => {
				const parallax = {
					ratio: { x: 0.5, y: 0.75 },
					parallaxOrigin: { x: 160, y: 120 },
					parallaxAnchor: CENTRE,
				};
				show(make(parallax));
				for (const [x, y] of VIEWS) {
					const picture = look(x, y);
					const result = diff(
						picture,
						expected(tiles, parallax, x, y),
						tolerance,
					);
					expect(
						result.different,
						`${String(x)}, ${String(y)}: ${result.first}`,
					).toBe(0);
				}
				// on its origin, where it was placed
				expect(
					diff(look(0, 0), expected(tiles, undefined, 0, 0), tolerance)
						.different,
				).toBe(0);
				// elsewhere, far from where a layer with no parallax is
				expect(
					diff(look(100, 40), expected(tiles, undefined, 100, 40), tolerance)
						.different,
				).toBeGreaterThan(2000);
			});

			it("is measured to the camera's position unless its anchor says another point of the view", () => {
				// with no anchor, to the view's top left corner, as an image
				// layer is: in its place when the camera is at the origin
				const corner = { ratio: { x: 0.5, y: 0.75 } };
				show(make(corner));
				for (const [x, y] of VIEWS) {
					const result = diff(
						look(x, y),
						expected(tiles, corner, x, y),
						tolerance,
					);
					expect(result.different, result.first).toBe(0);
				}
				expect(
					diff(look(0, 0), expected(tiles, undefined, 0, 0), tolerance)
						.different,
				).toBe(0);
				// and not where the view's centre would put it
				expect(
					diff(
						look(100, 40),
						expected(tiles, { ...corner, parallaxAnchor: CENTRE }, 100, 40),
						tolerance,
					).different,
				).toBeGreaterThan(2000);
				// said outright, the same
				show(make({ ...corner, parallaxAnchor: { x: 0, y: 0 } }));
				expect(
					diff(look(100, 40), expected(tiles, corner, 100, 40), tolerance)
						.different,
				).toBe(0);
				// to its right and bottom edges
				const edges = { ratio: 0.5, parallaxAnchor: { x: 1, y: 1 } };
				show(make(edges));
				const result = diff(
					look(-200, -160),
					expected(tiles, edges, -200, -160),
					tolerance,
				);
				expect(result.different, result.first).toBe(0);
			});

			it("a ratio above 1 moves it faster than the world", () => {
				const parallax = {
					ratio: { x: 1.5, y: 2 },
					parallaxOrigin: { x: 160, y: 120 },
					parallaxAnchor: CENTRE,
				};
				show(make(parallax));
				for (const [x, y] of [
					[20, 10],
					[-36, -18],
				]) {
					const result = diff(
						look(x, y),
						expected(tiles, parallax, x, y),
						tolerance,
					);
					expect(result.different, result.first).toBe(0);
				}
			});

			it("a ratio of 0 keeps it where it is on the screen, however far the camera goes", () => {
				const parallax = {
					ratio: 0,
					parallaxOrigin: { x: 160, y: 120 },
					parallaxAnchor: CENTRE,
				};
				show(make(parallax));
				const here = look(0, 0);
				expect(
					diff(here, expected(tiles, undefined, 0, 0), tolerance).different,
				).toBe(0);
				// the layer's own place is far out of these views: it is
				// drawn by where its parallax puts it
				for (const [x, y] of [
					[900, 700],
					[-1500, 300],
				]) {
					expect(
						diff(look(x, y), here, tolerance).different,
						`${String(x)}, ${String(y)}`,
					).toBe(0);
				}
			});

			it("is drawn smaller, from its origin, as a layer further away", () => {
				// (a scale that puts no pixel's centre on the edge of two of the
				// image's pixels, where each renderer would pick its own)
				const parallax = {
					ratio: 0.5,
					parallaxAnchor: CENTRE,
					parallaxScale: 0.8,
				};
				show(make(parallax));
				for (const [x, y] of [
					[0, 0],
					[120, 60],
					[-90, 44],
				]) {
					const picture = look(x, y);
					const result = diff(
						picture,
						expected(tiles, parallax, x, y),
						tolerance,
					);
					expect(
						result.different,
						`${String(x)}, ${String(y)}: ${result.first}`,
					).toBeLessThanOrEqual(scaledEdge);
					// and not the layer at its own size
					expect(
						diff(
							picture,
							expected(tiles, { ...parallax, parallaxScale: 1 }, x, y),
							tolerance,
						).different,
					).toBeGreaterThan(2000);
				}
			});

			it("is drawn larger with a scale alone, and shows the part of it the view is on", () => {
				const parallax = { parallaxScale: 2 };
				show(make(parallax));
				// twice its size: the view at (200, 150) is on the layer's
				// lower right, which a view of that place would not show at
				// the layer's own size
				for (const [x, y] of [
					[0, 0],
					[200, 150],
				]) {
					const result = diff(
						look(x, y),
						expected(tiles, parallax, x, y),
						tolerance,
					);
					expect(result.different, result.first).toBeLessThanOrEqual(
						scaledEdge,
					);
				}
				expect(
					diff(look(200, 150), pixels(blank(BACKGROUND)), tolerance).different,
				).toBeGreaterThan(5000);
			});

			it("in a container, follows from where the container is", () => {
				const parallax = {
					ratio: 0.5,
					parallaxOrigin: { x: 100, y: 80 },
					parallaxAnchor: CENTRE,
				};
				const container = new Container(30, 20, 400, 300);
				container.anchorPoint.set(0, 0);
				show(make(parallax), container);
				for (const [x, y] of [
					[0, 0],
					[64, 32],
				]) {
					const result = diff(
						look(x, y),
						expected(tiles, parallax, x, y, 30, 20),
						tolerance,
					);
					expect(result.different, result.first).toBe(0);
				}
			});

			it("is read from the layer and changed there; a ratio of 1 puts it back", () => {
				const made = make({ ratio: 0.5 }) as ScrollingLayer;
				show(made);
				// as an image layer keeps its ratio: a vector, to set
				expect(made.ratio).toBeInstanceOf(Vector2d);
				expect([made.ratio.x, made.ratio.y]).toEqual([0.5, 0.5]);
				expect([made.parallaxOrigin.x, made.parallaxOrigin.y]).toEqual([0, 0]);
				expect([made.parallaxAnchor.x, made.parallaxAnchor.y]).toEqual([0, 0]);
				expect(made.parallaxScale).toBe(1);
				expect(
					diff(
						look(100, 40),
						expected(tiles, { ratio: 0.5 }, 100, 40),
						tolerance,
					).different,
				).toBe(0);
				// changed while the game runs, one axis and then the other
				made.ratio.set(0.25, 1);
				made.parallaxOrigin.set(40, 0);
				expect(
					diff(
						look(100, 40),
						expected(
							tiles,
							{ ratio: { x: 0.25, y: 1 }, parallaxOrigin: { x: 40, y: 0 } },
							100,
							40,
						),
						tolerance,
					).different,
				).toBe(0);
				// at 1, it scrolls with the world again, whatever its origin
				made.ratio.set(1, 1);
				expect(
					diff(look(100, 40), expected(tiles, undefined, 100, 40), tolerance)
						.different,
				).toBe(0);
				// a layer made with nothing said scrolls with the world
				const plain = make() as ScrollingLayer;
				expect([plain.ratio.x, plain.ratio.y, plain.parallaxScale]).toEqual([
					1, 1, 1,
				]);
				// a scale is more than 0
				expect(() => {
					made.parallaxScale = 0;
				}).toThrow(/parallaxScale must be more than 0/);
				expect(() => {
					return make({ parallaxScale: -1 });
				}).toThrow(/parallaxScale must be more than 0/);
				expect(made.parallaxScale).toBe(1);
			});
		});

		it("leaves the layer's cells and bounds where it was placed", () => {
			const plain = gridLayer();
			const moved = gridLayer({
				ratio: 0.5,
				parallaxAnchor: CENTRE,
				parallaxScale: 0.5,
			});
			show(moved);
			look(100, 40);
			expect(moved.getBounds().left).toBe(plain.getBounds().left);
			expect(moved.getBounds().width).toBe(plain.getBounds().width);
			expect(moved.pos.x).toBe(AT.x);
			// the tile at a place in the world is the one placed there
			const first = gridTiles[0];
			const found = moved.getTile(AT.x + first.x + 3, AT.y + first.y + 3);
			expect(found.tileId).toBe(first.id + 1);
		});

		it.runIf(renderer === video.WEBGL)(
			"a grid layer with a ratio of its own is still drawn by the GPU",
			() => {
				const made = gridLayer({
					ratio: 0.5,
					parallaxAnchor: CENTRE,
					parallaxScale: 0.5,
				});
				show(made);
				look(60, 30);
				expect(made.renderMode).toBe("shader");
			},
		);
	});

	describe(`an LDtk layer's parallax, on ${name}`, () => {
		const COLS = 40;
		const ROWS = 30;
		const LEVEL_WIDTH = COLS * TILE;
		const LEVEL_HEIGHT = ROWS * TILE;
		const LEVEL_COLOR = "#203040";

		// the layer definitions under test, as LDtk saves them
		const DEFS = [
			// not scaled: in its place when the camera is on its centre
			{ uid: 20, identifier: "Back", x: 0.5, y: 0.25, scaling: false },
			// scaled by its factor across, from the level's corner
			{ uid: 21, identifier: "Far", x: 0.2, y: 0.5, scaling: true },
			// down only: LDtk scales by the factor across, so not at all
			{ uid: 22, identifier: "Rain", x: 0, y: -0.5, scaling: true },
		];

		const projectDefs = () => {
			const made = defs();
			for (const def of DEFS) {
				made.layers.push({
					...made.layers[1],
					uid: def.uid,
					identifier: def.identifier,
					__type: "Tiles",
					gridSize: TILE,
					parallaxFactorX: def.x,
					parallaxFactorY: def.y,
					parallaxScaling: def.scaling,
				});
			}
			return made;
		};

		// tiles all over a level, with gaps
		const scattered = (step: number) => {
			const tiles = [];
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					if ((col + row * 3) % step === 0) {
						tiles.push(
							tile(col * TILE, row * TILE, (col + row) % 8, (col + row) % 3),
						);
					}
				}
			}
			return tiles;
		};

		// a level: a layer of each definition asked for, under a plain one
		const parallaxLevel = (
			identifier: string,
			identifiers: string[],
			extra: Parameters<typeof levelJson>[2] = {},
		) => {
			const layers = [
				// the top-most first, as LDtk lists them
				layer("Auto", "AutoLayer", TILE, COLS, ROWS, scattered(11)),
				...identifiers.map((layerName, i) => {
					const def = DEFS.find((candidate) => {
						return candidate.identifier === layerName;
					});
					return layer(layerName, "Tiles", TILE, COLS, ROWS, scattered(3 + i), {
						layerDefUid: def?.uid ?? 11,
						// one of them moved in its level, as LDtk lets a
						// layer be
						__pxTotalOffsetX: i === 0 ? 8 : 0,
						__pxTotalOffsetY: i === 0 ? -8 : 0,
						pxOffsetX: i === 0 ? 8 : 0,
						pxOffsetY: i === 0 ? -8 : 0,
					});
				}),
			];
			return levelJson(identifier, layers, {
				pxWid: LEVEL_WIDTH,
				pxHei: LEVEL_HEIGHT,
				...extra,
			});
		};

		let project: LDtkProjectJson;

		beforeAll(async () => {
			const back = parallaxLevel("Back", ["Back"]);
			// an entity in the layer that follows the camera
			(back.layerInstances ?? [])[1].entityInstances.push(
				entity("Lamp", 64, 48),
			);
			project = projectJson(
				[
					back,
					parallaxLevel("Far", ["Far"], { worldX: 0, worldY: 512 }),
					parallaxLevel("All", ["Back", "Far", "Rain"], {
						worldX: 1024,
						worldY: 0,
					}),
					// in the same world, far enough for the layers of the
					// one above not to follow the camera all the way here
					parallaxLevel("Next", ["Far", "Back"], {
						worldX: 1024 + 4000,
						worldY: 0,
					}),
				],
				{ iid: "parallax", defs: projectDefs() },
			);
			await loader.load({ name: "parallax", type: "ldtk", data: project });
		});

		/**
		 * A level as LDtk's editor shows it for a camera, painted here: each
		 * layer's tiles moved by the camera's place in the level times the
		 * layer's factors (and by half the layer's size the other way when it
		 * is not scaled), and scaled by one minus the factor across when it
		 * is, from the level's corner.
		 * @param c - where to paint
		 * @param json - the level
		 * @param levelX - where the level is in the world
		 * @param levelY - where the level is in the world
		 * @param viewX - where the view starts in the world
		 * @param viewY - where the view starts in the world
		 */
		const paintLevel = (
			c: CanvasRenderingContext2D,
			json: LDtkProjectJson["levels"][number],
			levelX: number,
			levelY: number,
			viewX: number,
			viewY: number,
		) => {
			c.fillStyle = LEVEL_COLOR;
			c.fillRect(levelX - viewX, levelY - viewY, json.pxWid, json.pxHei);
			// the camera's centre, in the level
			const cameraX = viewX + WIDTH / 2 - levelX;
			const cameraY = viewY + HEIGHT / 2 - levelY;
			const layers = json.layerInstances ?? [];
			for (let i = layers.length - 1; i >= 0; i--) {
				const instance = layers[i];
				const def = DEFS.find((candidate) => {
					return candidate.uid === instance.layerDefUid;
				});
				const factorX = def?.x ?? 0;
				const factorY = def?.y ?? 0;
				const scaling = def?.scaling ?? true;
				const width = instance.__cWid * instance.__gridSize;
				const height = instance.__cHei * instance.__gridSize;
				const rootX = Math.round(
					cameraX * factorX + (scaling ? 0 : -width * 0.5 * factorX),
				);
				const rootY = Math.round(
					cameraY * factorY + (scaling ? 0 : -height * 0.5 * factorY),
				);
				const scale =
					!scaling || factorX === 0 ? 1 : Math.max(0.01, 1 - factorX);
				const tiles =
					instance.__type === "Tiles"
						? instance.gridTiles
						: instance.autoLayerTiles;
				paintLayer(
					c,
					tiles.map((placed) => {
						return {
							x: placed.px[0],
							y: placed.px[1],
							id: placed.t,
							flip: placed.f,
							alpha: placed.a ?? 1,
						};
					}),
					levelX - viewX + rootX,
					levelY - viewY + rootY,
					instance.__pxTotalOffsetX,
					instance.__pxTotalOffsetY,
					scale,
				);
			}
		};

		const levelOf = (identifier: string) => {
			const found = project.levels.find((candidate) => {
				return candidate.identifier === identifier;
			});
			if (found === undefined) {
				throw new Error(`no level ${identifier}`);
			}
			return found;
		};

		// a level loaded alone is at the world's origin
		const expectedAlone = (
			identifier: string,
			viewX: number,
			viewY: number,
		) => {
			const c = blank(LEVEL_COLOR);
			paintLevel(c, levelOf(identifier), 0, 0, viewX, viewY);
			return pixels(c);
		};

		const look = (x: number, y: number) => {
			app.viewport.moveTo(x, y);
			return frame(app);
		};

		it("a layer that is not scaled follows the camera, and is in its place when the camera is on its centre", async () => {
			await enter(app, "parallax:Back");
			for (const [x, y] of [
				[0, 0],
				[160, 120],
				[320, 240],
				[75, 199],
			]) {
				const result = diff(look(x, y), expectedAlone("Back", x, y), tolerance);
				expect(
					result.different,
					`${String(x)}, ${String(y)}: ${result.first}`,
				).toBe(0);
			}
			// the layers built carry what LDtk says
			const loaded = level.getCurrentLevel() as unknown as LDtkLevel;
			const parts = loaded.layers;
			const back = parts.filter((part) => {
				return part.name === "Back";
			});
			expect(back.length).toBeGreaterThan(0);
			for (const part of back) {
				// LDtk's factors of 0.5 and 0.25 are the share of the
				// camera's movement the layer follows: its ratio is the rest
				expect(scrollingOf(part)).toEqual({
					ratio: [0.5, 0.75],
					origin: [LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2],
					anchor: [0.5, 0.5],
					scale: 1,
				});
			}
			for (const part of parts) {
				if (part.name === "Auto") {
					expect(scrollingOf(part)).toEqual({
						ratio: [1, 1],
						origin: [0, 0],
						anchor: [0, 0],
						scale: 1,
					});
				}
			}
			// an entity of that layer is a thing of the level: it stays
			// where it is in it, moved by the layer's offset alone
			const [lamp] = objectsIn(app.world, "Lamp");
			expect([lamp.pos.x, lamp.pos.y]).toEqual([64 + 8, 48 - 8]);
		});

		it("a scaled layer is drawn smaller by its factor across, from the level's corner", async () => {
			await enter(app, "parallax:Far");
			for (const [x, y] of [
				[0, 0],
				[160, 120],
				[320, 240],
			]) {
				const picture = look(x, y);
				const result = diff(picture, expectedAlone("Far", x, y), tolerance);
				expect(
					result.different,
					`${String(x)}, ${String(y)}: ${result.first}`,
				).toBeLessThanOrEqual(edge);
			}
			const loaded = level.getCurrentLevel() as unknown as LDtkLevel;
			const far = loaded.layers.find((part) => {
				return part.name === "Far";
			});
			expect(scrollingOf(far)).toEqual({
				ratio: [0.8, 0.5],
				origin: [0, 0],
				anchor: [0.5, 0.5],
				scale: 0.8,
			});
		});

		it("each layer of a level follows by its own factors, a factor down alone not scaling it", async () => {
			await enter(app, "parallax:All");
			for (const [x, y] of [
				[0, 0],
				[200, 100],
				[320, 240],
			]) {
				const result = diff(look(x, y), expectedAlone("All", x, y), tolerance);
				expect(
					result.different,
					`${String(x)}, ${String(y)}: ${result.first}`,
				).toBeLessThanOrEqual(edge);
			}
			const loaded = level.getCurrentLevel() as unknown as LDtkLevel;
			const rain = loaded.layers.find((part) => {
				return part.name === "Rain";
			});
			expect(scrollingOf(rain).scale).toBe(1);
		});

		it("in a world, each level's layers follow from their own level", async () => {
			await enter(app, "parallax", { levels: ["All", "Next"] });
			for (const identifier of ["All", "Next"]) {
				const json = levelOf(identifier);
				for (const [x, y] of [
					[json.worldX, json.worldY],
					[json.worldX + 250, json.worldY + 130],
				]) {
					const c = blank(project.bgColor);
					paintLevel(c, json, json.worldX, json.worldY, x, y);
					const result = diff(look(x, y), pixels(c), tolerance);
					expect(
						result.different,
						`${identifier} from ${String(x)}, ${String(y)}: ${result.first}`,
					).toBeLessThanOrEqual(edge);
				}
			}
		});
	});
}
