import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	Color,
	event,
	Rect,
	TMXTileMap,
	video,
} from "../src/index.js";
import Tile from "../src/level/tiled/TMXTile.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * A pre-rendered tile layer is baked once into an offscreen canvas and drawn
 * as one image. The bake must hold every tile the layer draws: on hexagonal,
 * staggered and oblique maps the layer reaches past `cols * tilewidth`
 * (an oblique one even left of 0), and an oversized or offset tile reaches
 * past its cell. A tile set or cleared at runtime must show in it too.
 *
 * Each case draws the layer tile by tile and from its bake, onto canvases of
 * the same size, and compares every pixel.
 */

// a tileset image of two opaque tiles, red then blue, `w` x `h` each
const tilesetImage = (name, w, h) => {
	const canvas = document.createElement("canvas");
	canvas.width = w * 2;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#ff0000";
	ctx.fillRect(0, 0, w, h);
	ctx.fillStyle = "#0000ff";
	ctx.fillRect(w, 0, w, h);
	// a dark edge, so a tile cut short shows
	ctx.strokeStyle = "#000000";
	ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
	ctx.strokeRect(w + 0.5, 0.5, w - 1, h - 1);
	imgList[name] = canvas;
	return `${name}.png`;
};

const COLS = 5;
const ROWS = 4;

/**
 * a map of one tile layer, every cell filled, its tiles taken in turn from
 * each tileset given (two tiles each)
 * @param {object} map - the orientation's map attributes
 * @param {...object} tilesets - each tileset's tile size, offset or render size
 * @returns {object} the layer
 */
const layerOf = (map, ...tilesets) => {
	const name = `prerender-${map.orientation}-${map.staggeraxis ?? ""}`;
	const data = [];
	for (let i = 0; i < COLS * ROWS; i++) {
		data.push(1 + (i % (tilesets.length * 2)));
	}
	const tmx = new TMXTileMap(name, {
		width: COLS,
		height: ROWS,
		renderorder: "right-down",
		infinite: false,
		version: "1.10",
		tiledversion: "1.12.0",
		...map,
		tilesets: tilesets.map((tileset, i) => {
			const image = `${name}-${i}-${tileset.tilewidth}x${tileset.tileheight}`;
			return {
				firstgid: 1 + i * 2,
				name: image,
				spacing: 0,
				margin: 0,
				tilecount: 2,
				columns: 2,
				image: tilesetImage(image, tileset.tilewidth, tileset.tileheight),
				...tileset,
			};
		}),
		layers: [
			{
				type: "tilelayer",
				name: "ground",
				width: COLS,
				height: ROWS,
				data,
				visible: true,
				opacity: 1,
			},
		],
	});
	return tmx.getLayers()[0];
};

const ORIENTATIONS = [
	[
		"orthogonal, tiles taller than their cell",
		{ orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
		{ tilewidth: 32, tileheight: 48 },
	],
	[
		"orthogonal, tiles offset past their cell",
		{ orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
		{ tilewidth: 32, tileheight: 32, tileoffset: { x: 6, y: 10 } },
	],
	[
		"orthogonal, tiles smaller than their cell",
		{ orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
		{ tilewidth: 16, tileheight: 16 },
	],
	[
		"orthogonal, small tiles scaled to their cell",
		{ orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
		{ tilewidth: 16, tileheight: 16, tilerendersize: "grid" },
	],
	[
		"orthogonal, two tilesets offset opposite ways",
		{ orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
		{ tilewidth: 32, tileheight: 32, tileoffset: { x: -6, y: 8 } },
		{ tilewidth: 32, tileheight: 32, tileoffset: { x: 10, y: -4 } },
	],
	[
		"isometric, tiles smaller than their cell",
		{ orientation: "isometric", tilewidth: 32, tileheight: 16 },
		{ tilewidth: 16, tileheight: 16 },
	],
	[
		"isometric, tiles taller than their cell",
		{ orientation: "isometric", tilewidth: 32, tileheight: 16 },
		{ tilewidth: 32, tileheight: 32 },
	],
	[
		"isometric, tiles the size of their cell",
		{ orientation: "isometric", tilewidth: 32, tileheight: 16 },
		{ tilewidth: 32, tileheight: 16 },
	],
	[
		"hexagonal, staggered along y, with a tile offset",
		{
			orientation: "hexagonal",
			tilewidth: 14,
			tileheight: 12,
			hexsidelength: 6,
			staggeraxis: "y",
			staggerindex: "odd",
		},
		{ tilewidth: 18, tileheight: 18, tileoffset: { x: 0, y: 1 } },
	],
	[
		"hexagonal, staggered along x",
		{
			orientation: "hexagonal",
			tilewidth: 12,
			tileheight: 14,
			hexsidelength: 6,
			staggeraxis: "x",
			staggerindex: "even",
		},
		{ tilewidth: 18, tileheight: 18 },
	],
	[
		"staggered",
		{
			orientation: "staggered",
			tilewidth: 32,
			tileheight: 16,
			staggeraxis: "y",
			staggerindex: "odd",
		},
		{ tilewidth: 32, tileheight: 32 },
	],
	[
		"oblique, skewed left of 0",
		{ orientation: "oblique", tilewidth: 40, tileheight: 14, skewx: -12 },
		{ tilewidth: 51, tileheight: 26 },
	],
];

// the layout of that name, as `layerOf` arguments
const layout = (name) => {
	return ORIENTATIONS.find(([label]) => {
		return label === name;
	}).slice(1);
};

describe("TMXLayer pre-rendered", () => {
	const renderers = [];
	let app;

	beforeAll(async () => {
		await boot();
		// tilesets build their atlas through the game's renderer
		app = new Application(64, 64, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	afterEach(() => {
		for (const renderer of renderers.splice(0)) {
			renderer.destroy();
		}
	});

	// a canvas renderer the size of the layer and a margin, drawing it
	// with its top left corner at (PAD, PAD)
	const PAD = 40;
	const target = (layer) => {
		const bounds = layer.getRenderer().getBounds(layer);
		const area = new Rect(
			bounds.left - PAD,
			bounds.top - PAD,
			bounds.width + PAD * 2,
			bounds.height + PAD * 2,
		);
		const renderer = new CanvasRenderer({
			width: Math.ceil(area.width),
			height: Math.ceil(area.height),
			transparent: true,
		});
		renderers.push(renderer);
		renderer.translate(-area.left, -area.top);
		return { renderer, area };
	};

	const pixels = (renderer) => {
		const canvas = renderer.getCanvas();
		return renderer.getContext().getImageData(0, 0, canvas.width, canvas.height)
			.data;
	};

	// the layer drawn tile by tile, and from its bake
	const both = (layer) => {
		const tiles = target(layer);
		layer.getRenderer().drawTileLayer(tiles.renderer, layer, tiles.area);
		const baked = target(layer);
		layer.renderMode = "prerender";
		layer.onActivateEvent();
		layer.draw(baked.renderer, baked.area);
		return { tiles: pixels(tiles.renderer), baked: pixels(baked.renderer) };
	};

	// how many pixels differ, and how many the tiles cover
	const differences = ({ tiles, baked }) => {
		let differ = 0;
		let covered = 0;
		for (let i = 0; i < tiles.length; i += 4) {
			if (tiles[i + 3] > 0) {
				covered++;
			}
			if (
				tiles[i] !== baked[i] ||
				tiles[i + 1] !== baked[i + 1] ||
				tiles[i + 2] !== baked[i + 2] ||
				tiles[i + 3] !== baked[i + 3]
			) {
				differ++;
			}
		}
		return { differ, covered };
	};

	describe.each(ORIENTATIONS)("%s", (_name, map, ...tilesets) => {
		it("bakes every tile the layer draws", () => {
			const layer = layerOf(map, ...tilesets);
			const { differ, covered } = differences(both(layer));
			expect(covered).toBeGreaterThan(COLS * ROWS * 50);
			expect(differ).toBe(0);
		});

		it("shows a tile set at runtime", () => {
			const layer = layerOf(map, ...tilesets);
			both(layer);
			layer.setTile(new Tile(0, 0, 2, layer.tileset), COLS - 1, ROWS - 1);
			layer.setTile(new Tile(0, 0, 1, layer.tileset), 1, 0);
			expect(differences(both(layer)).differ).toBe(0);
		});

		it("clears a tile at runtime, and only that tile", () => {
			const layer = layerOf(map, ...tilesets);
			both(layer);
			layer.clearTile(2, 1);
			layer.clearTile(COLS - 1, 0);
			const { differ } = differences(both(layer));
			expect(differ).toBe(0);
		});
	});

	describe("a tile changed at runtime", () => {
		const fits = [
			{ orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
			{ tilewidth: 32, tileheight: 32 },
		];

		it("is redrawn in its cell alone where no other tile overlaps it", () => {
			const layer = layerOf(...fits);
			both(layer);
			const bake = vi.spyOn(layer, "_bakePreRender");
			layer.setTile(new Tile(0, 0, 2, layer.tileset), 0, 0);
			layer.clearTile(1, 0);
			const tiles = target(layer);
			layer.getRenderer().drawTileLayer(tiles.renderer, layer, tiles.area);
			const baked = target(layer);
			layer.draw(baked.renderer, baked.area);
			expect(bake).not.toHaveBeenCalled();
			expect(
				differences({
					tiles: pixels(tiles.renderer),
					baked: pixels(baked.renderer),
				}).differ,
			).toBe(0);
		});

		it("bakes the layer again, once, before it next draws where tiles overlap", () => {
			const layer = layerOf(
				...layout("isometric, tiles taller than their cell"),
			);
			both(layer);
			const bake = vi.spyOn(layer, "_bakePreRender");
			layer.setTile(new Tile(0, 0, 2, layer.tileset), 0, 0);
			layer.clearTile(1, 1);
			layer.clearTile(2, 2);
			expect(bake).not.toHaveBeenCalled();
			const { renderer, area } = target(layer);
			layer.draw(renderer, area);
			layer.draw(renderer, area);
			expect(bake).toHaveBeenCalledTimes(1);
		});

		it("leaves a layer drawn tile by tile alone", () => {
			const layer = layerOf(...fits);
			const bake = vi.spyOn(layer, "_bakePreRender");
			layer.setTile(new Tile(0, 0, 2, layer.tileset), 0, 0);
			layer.clearTile(1, 0);
			expect(layer.canvasRenderer).toBeUndefined();
			expect(bake).not.toHaveBeenCalled();
		});
	});

	it("draws only the part of the bake in view, from inside the bake", () => {
		// an oblique layer skewed left: its bake starts left of 0. A view
		// starting before the bake reads from its first pixel, and is drawn
		// where that pixel belongs; read from before it, a GPU renderer
		// would stretch the bake's edge over the gap
		const layer = layerOf(...ORIENTATIONS.at(-1).slice(1));
		layer.renderMode = "prerender";
		layer.onActivateEvent();
		const canvas = layer.canvasRenderer.getCanvas();
		const originX = layer._preRenderX;
		const originY = layer._preRenderY;
		expect(originX).toBeLessThan(0);
		const calls = [];
		const spy = {
			drawImage(...args) {
				calls.push(args.slice(1));
			},
		};
		const draw = CanvasRenderer.prototype.drawTileLayer;
		draw.call(spy, layer, new Rect(originX - 30, originY - 20, 100, 60));
		expect(calls).toEqual([[0, 0, 70, 40, originX, originY, 70, 40]]);
		// running past the bake's far corner
		calls.length = 0;
		const right = originX + canvas.width;
		const bottom = originY + canvas.height;
		draw.call(spy, layer, new Rect(right - 10, bottom - 5, 50, 50));
		expect(calls).toEqual([
			[
				canvas.width - 10,
				canvas.height - 5,
				10,
				5,
				right - 10,
				bottom - 5,
				10,
				5,
			],
		]);
		// wholly outside it
		calls.length = 0;
		draw.call(spy, layer, new Rect(right + 1, originY, 20, 20));
		expect(calls).toEqual([]);
	});

	describe("drawn tile by tile from inside the map", () => {
		it.each([
			["orthogonal, tiles smaller than their cell"],
			["orthogonal, small tiles scaled to their cell"],
		])("%s: draws every tile in view", (name) => {
			// a view starting 20 pixels in, inside the first column
			const layer = layerOf(...layout(name));
			const full = target(layer);
			layer.getRenderer().drawTileLayer(full.renderer, layer, full.area);
			const part = target(layer);
			const view = new Rect(20, full.area.top, 400, full.area.height);
			layer.getRenderer().drawTileLayer(part.renderer, layer, view);
			const a = pixels(full.renderer);
			const b = pixels(part.renderer);
			const width = full.renderer.getCanvas().width;
			let differ = 0;
			for (let i = 0; i < a.length; i += 4) {
				// the pixels from x = 20 on, in the view
				if ((i / 4) % width >= 20 - full.area.left && a[i + 3] !== b[i + 3]) {
					differ++;
				}
			}
			expect(differ).toBe(0);
		});
	});

	describe("a tile changed after the bake was drawn", () => {
		// the renderer drawing the bake keeps a copy of it: a texture on the
		// GPU, a tinted image on Canvas. The change must reach that copy
		const fits = [
			{ orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
			{ tilewidth: 32, tileheight: 32 },
		];
		const change = (layer) => {
			layer.setTile(new Tile(0, 0, 2, layer.tileset), 0, 0);
			layer.clearTile(2, 1);
			layer.clearTile(COLS - 1, ROWS - 1);
		};

		describe("on WebGL", () => {
			const SIZE = 320;
			let gl;

			beforeAll(async () => {
				try {
					gl = await getWebGLRenderer(SIZE, SIZE);
				} catch {
					// no WebGL here: the tests below mark themselves skipped
				}
				if (gl) {
					gl.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
					gl.currentBatcher.setProjection(gl.projectionMatrix);
				}
			});

			afterAll(() => {
				releaseWebGLRenderer();
			});

			// the layer drawn on WebGL with its top left corner at (40, 40)
			const draw = (drawLayer) => {
				gl.clearColor("#000000ff");
				gl.save();
				gl.translate(40, 40);
				drawLayer();
				gl.flush();
				gl.restore();
				const out = new Uint8Array(SIZE * SIZE * 4);
				gl.gl.readPixels(
					0,
					0,
					SIZE,
					SIZE,
					gl.gl.RGBA,
					gl.gl.UNSIGNED_BYTE,
					out,
				);
				return out;
			};

			it.each([
				["redrawn in its cell", fits],
				["baked again", layout("isometric, tiles taller than their cell")],
			])("shows when the tile is %s", (_how, args, ctx) => {
				if (gl === undefined) {
					ctx.skip("WebGL renderer not available in this environment");
				}
				const layer = layerOf(...args);
				const area = new Rect(-40, -40, SIZE, SIZE);
				layer.renderMode = "prerender";
				layer.onActivateEvent();
				const before = draw(() => {
					layer.draw(gl, area);
				});
				change(layer);
				const after = draw(() => {
					layer.draw(gl, area);
				});
				const expected = draw(() => {
					layer.getRenderer().drawTileLayer(gl, layer, area);
				});
				let changed = 0;
				let differ = 0;
				for (let i = 0; i < after.length; i++) {
					changed += after[i] !== before[i] ? 1 : 0;
					differ += after[i] !== expected[i] ? 1 : 0;
				}
				expect(changed).toBeGreaterThan(0);
				expect(differ).toBe(0);
			});
		});

		it("shows on a tinted layer on Canvas", () => {
			const layer = layerOf(...fits);
			const tinted = target(layer);
			tinted.renderer.setTint(new Color(255, 255, 0));
			layer.renderMode = "prerender";
			layer.onActivateEvent();
			layer.draw(tinted.renderer, tinted.area);
			change(layer);
			tinted.renderer.clearRect(-1e4, -1e4, 2e4, 2e4);
			layer.draw(tinted.renderer, tinted.area);
			// the same tiles, drawn one by one with the same tint
			const tiles = target(layer);
			tiles.renderer.setTint(new Color(255, 255, 0));
			layer.getRenderer().drawTileLayer(tiles.renderer, layer, tiles.area);
			expect(
				differences({
					tiles: pixels(tiles.renderer),
					baked: pixels(tinted.renderer),
				}).differ,
			).toBe(0);
		});
	});

	it("bakes without announcing a resize to the game", () => {
		// the game's own renderer takes the size a resize announces
		const resized = vi.fn();
		event.on(event.CANVAS_ONRESIZE, resized);
		try {
			const layer = layerOf(
				...layout("hexagonal, staggered along y, with a tile offset"),
			);
			both(layer);
			const canvas = layer.canvasRenderer.getCanvas();
			layer.clearTile(0, 0);
			const { renderer, area } = target(layer);
			layer.draw(renderer, area);
			// baked again into the same canvas
			expect(layer.canvasRenderer.getCanvas()).toBe(canvas);
			expect(resized).not.toHaveBeenCalled();
		} finally {
			event.off(event.CANVAS_ONRESIZE, resized);
		}
	});
});
