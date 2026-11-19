/**
 * Draw the same tile layers through the CPU renderer (`renderMode`
 * "perTile") and through the GPU one ("shader"), with the whole engine in
 * between (world, camera, renderer), and compare the two frames.
 *
 * The tiles are painted pixel by pixel, with no soft edges, and every pixel
 * of every tile has a colour of its own: a tile that lands one pixel off, is
 * flipped the wrong way, or shows in front of the wrong neighbour, changes
 * pixels. So the two paths are held to the same picture, exactly.
 */
import { vi } from "vitest";
import { Application, boot, TMXTileMap } from "../../src/index.js";
import { imgList } from "../../src/loader/cache.js";
import Renderer from "../../src/video/renderer.js";
import { drawOffscreen, grabFrame } from "./pixels.js";

export const FLIP_H = 0x80000000;
export const FLIP_V = 0x40000000;
export const FLIP_AD = 0x20000000;

let nextName = 0;

/**
 * Whether a pixel of a `w` × `h` tile image belongs to an isometric block
 * standing on a `tw` × `th` diamond at the bottom of the image: the diamond,
 * the same diamond at the top, and everything between them. A tile as tall
 * as its diamond is the diamond alone.
 * @param {number} x - pixel column in the tile
 * @param {number} y - pixel row in the tile
 * @param {number} w - tile image width
 * @param {number} h - tile image height
 * @param {number} tw - diamond width
 * @param {number} th - diamond height
 * @returns {boolean} whether the pixel is opaque
 */
export function inBlock(x, y, w, h, tw, th) {
	// across: how far from the diamond's vertical axis, in half widths
	const dx = Math.abs(x + 0.5 - w / 2) / (tw / 2);
	if (dx > 1) {
		return false;
	}
	// the diamond's edge at this column, from its centre line
	const edge = (1 - dx) * (th / 2);
	const top = th / 2 - edge;
	const bottom = h - th / 2 + edge;
	return y + 0.5 >= top && y + 0.5 <= bottom;
}

/**
 * Make a tileset image, registered with the loader, and its Tiled JSON.
 * @param {object} options
 * @param {number} options.tw - tile image width
 * @param {number} options.th - tile image height
 * @param {number} [options.count=8] - number of tiles
 * @param {number} [options.columns=4] - tiles per row of the image
 * @param {number} [options.margin=0] - margin round the image
 * @param {number} [options.spacing=0] - spacing between tiles
 * @param {(x: number, y: number, id: number) => boolean} [options.opaque] -
 * which pixels of a tile are opaque (all of them by default)
 * @param {object} [options.extra] - more Tiled tileset properties
 * (`tileoffset`, `tiles` with animations...)
 * @returns {object} the tileset's Tiled JSON, without its `firstgid`
 */
export function makeTileset(options) {
	const {
		tw,
		th,
		count = 8,
		columns = 4,
		margin = 0,
		spacing = 0,
		opaque,
		extra = {},
	} = options;
	const rows = Math.ceil(count / columns);
	const canvas = document.createElement("canvas");
	canvas.width = margin * 2 + columns * tw + (columns - 1) * spacing;
	canvas.height = margin * 2 + rows * th + (rows - 1) * spacing;
	const ctx = canvas.getContext("2d");
	const image = ctx.createImageData(canvas.width, canvas.height);
	const seed = nextName * 37;
	// the margin and spacing are a colour no tile has: sampled, they show
	for (let i = 0; i < image.data.length; i += 4) {
		image.data[i] = 255;
		image.data[i + 1] = 0;
		image.data[i + 2] = 255;
		image.data[i + 3] = 255;
	}
	for (let id = 0; id < count; id++) {
		const ox = margin + (id % columns) * (tw + spacing);
		const oy = margin + Math.floor(id / columns) * (th + spacing);
		for (let y = 0; y < th; y++) {
			for (let x = 0; x < tw; x++) {
				const o = ((oy + y) * canvas.width + ox + x) * 4;
				if (opaque !== undefined && !opaque(x, y, id)) {
					image.data[o + 3] = 0;
					image.data[o] = image.data[o + 1] = image.data[o + 2] = 0;
					continue;
				}
				// a colour per tile, and per pixel in it: never the
				// margin's, never the background's
				image.data[o] = 40 + ((id * 53 + seed) % 180);
				image.data[o + 1] = 30 + ((x * 7 + id * 11) % 200);
				image.data[o + 2] = 30 + ((y * 5 + id * 29) % 200);
				image.data[o + 3] = 255;
			}
		}
	}
	ctx.putImageData(image, 0, 0);
	const name = `tile-compare-${nextName++}`;
	imgList[name] = canvas;
	return {
		name,
		tilewidth: tw,
		tileheight: th,
		spacing,
		margin,
		tilecount: count,
		columns,
		image: `${name}.png`,
		imagewidth: canvas.width,
		imageheight: canvas.height,
		...extra,
	};
}

/**
 * Build a map from tilesets and layers.
 * @param {object} options
 * @param {string} options.orientation - Tiled orientation
 * @param {number} options.cols - map width, in tiles
 * @param {number} options.rows - map height, in tiles
 * @param {number} options.tw - grid tile width
 * @param {number} options.th - grid tile height
 * @param {object[]} options.tilesets - from {@link makeTileset}; their
 * `firstgid` is set here, one after the other
 * @param {object[]} options.layers - `{ data }` (gids, row by row) or
 * `{ chunks }` for an infinite map, plus any Tiled layer property
 * @param {object} [options.extra] - more Tiled map properties
 * @returns {TMXTileMap} the map
 */
export function makeMap(options) {
	const {
		orientation,
		cols,
		rows,
		tw,
		th,
		tilesets,
		layers,
		extra = {},
	} = options;
	let firstgid = 1;
	const sets = tilesets.map((tileset) => {
		const set = { ...tileset, firstgid };
		firstgid += tileset.tilecount;
		return set;
	});
	return new TMXTileMap(`tile-compare-map-${nextName++}`, {
		width: cols,
		height: rows,
		tilewidth: tw,
		tileheight: th,
		orientation,
		renderorder: "right-down",
		infinite: false,
		version: "1.10",
		tiledversion: "1.10.2",
		tilesets: sets,
		layers: layers.map((layer, i) => {
			return {
				type: "tilelayer",
				name: `layer${i}`,
				width: cols,
				height: rows,
				visible: true,
				opacity: 1,
				...layer,
			};
		}),
		...extra,
	});
}

/**
 * A layer's data, filled by a function of each cell.
 * @param {number} cols - columns
 * @param {number} rows - rows
 * @param {(col: number, row: number) => number} gidOf - the cell's gid, 0 for none
 * @returns {number[]} the gids, row by row
 */
export function fill(cols, rows, gidOf) {
	const data = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			data.push(gidOf(col, row));
		}
	}
	return data;
}

/**
 * The application the comparisons draw with, its loop held still so that
 * frames are drawn only when a test asks. `null` when the renderer asked
 * for is not available (a WebGPU device, on a machine without one).
 * @param {number} renderer - `video.WEBGL` or `video.WEBGPU`
 * @param {string} type - the `renderer.type` expected
 * @param {number} [width=320] - canvas width
 * @param {number} [height=240] - canvas height
 * @returns {Promise<Application|null>} the application
 */
export async function makeApp(renderer, type, width = 320, height = 240) {
	// no frame of the engine's own: a test draws each one
	vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
		return 1;
	});
	vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
	boot();
	let app;
	try {
		app = new Application(width, height, {
			parent: "screen",
			renderer,
			consoleHeader: false,
		});
		await app.init();
	} catch {
		return null;
	}
	if (!app.renderer.type.startsWith(type)) {
		app.destroy();
		return null;
	}
	drawOffscreen(app.renderer);
	// not black: a tile that is not drawn shows
	app.renderer.backgroundColor.setColor(16, 24, 48);
	app.viewport.setBounds(-100000, -100000, 200000, 200000);
	return app;
}

/**
 * Put a map's layers in the world, in place of whatever was there.
 * @param {Application} app - the application
 * @param {TMXTileMap} map - the map
 * @returns {object[]} the map's tile layers
 */
export function show(app, map) {
	app.world.reset();
	app.renderer.reset?.();
	app.renderer.backgroundColor.setColor(16, 24, 48);
	map.addTo(app.world, true, false);
	app.viewport.setBounds(-100000, -100000, 200000, 200000);
	return map.getLayers();
}

let clock = 1000;

/**
 * Draw one frame with every layer in the given mode, and return it with how
 * many times the CPU tile renderer was reached while drawing it.
 * @param {Application} app - the application
 * @param {object[]} layers - the layers
 * @param {string} mode - "perTile", "shader" or "prerender"
 * @param {number} [dt=0] - game time to pass before the frame, in ms
 * @returns {Promise<{frame: ImageData, cpuDraws: number}>} the frame
 */
export async function drawIn(app, layers, mode, dt = 0) {
	for (const layer of layers) {
		layer.renderMode = mode;
	}
	// the world updated (what is in view, and animated tiles when time
	// passes), then drawn
	clock += dt;
	app.world.update(dt);
	app.viewport.update(dt);
	const cpu = vi.spyOn(Renderer.prototype, "drawTileLayer");
	app.repaint();
	app.draw();
	const cpuDraws = cpu.mock.calls.length;
	cpu.mockRestore();
	const frame = await grabFrame(app.renderer);
	return { frame, cpuDraws };
}

/**
 * Compare two frames.
 * @param {ImageData} a - one frame
 * @param {ImageData} b - the other
 * @param {number} [tolerance=0] - largest difference of a channel that is
 * not counted
 * @returns {{different: number, worst: number, first: string}} how many
 * pixels differ, by how much at most, and the first one
 */
export function diff(a, b, tolerance = 0) {
	let different = 0;
	let worst = 0;
	let first = "";
	for (let i = 0; i < a.data.length; i += 4) {
		const d = Math.max(
			Math.abs(a.data[i] - b.data[i]),
			Math.abs(a.data[i + 1] - b.data[i + 1]),
			Math.abs(a.data[i + 2] - b.data[i + 2]),
		);
		if (d > tolerance) {
			different++;
			if (first === "") {
				const p = i / 4;
				first = `(${p % a.width}, ${Math.floor(p / a.width)}): [${a.data.slice(i, i + 3)}] against [${b.data.slice(i, i + 3)}]`;
			}
		}
		worst = Math.max(worst, d);
	}
	return { different, worst, first };
}

/**
 * How many pixels of a frame are not the background: how much was drawn.
 * @param {ImageData} frame - the frame
 * @returns {number} the count
 */
export function drawn(frame) {
	let count = 0;
	for (let i = 0; i < frame.data.length; i += 4) {
		if (
			frame.data[i] !== 16 ||
			frame.data[i + 1] !== 24 ||
			frame.data[i + 2] !== 48
		) {
			count++;
		}
	}
	return count;
}
