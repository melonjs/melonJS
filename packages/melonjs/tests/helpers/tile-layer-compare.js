/**
 * Draw the same tile layers through the CPU renderer (`renderMode`
 * "perTile") and through the GPU one ("shader"), with the whole engine in
 * between (world, camera, renderer), and compare the two frames.
 *
 * The tiles are painted pixel by pixel, and every pixel of every tile has a
 * colour of its own: a tile that lands one pixel off, is flipped the wrong
 * way, or shows in front of the wrong neighbour, changes pixels. With hard
 * edges (the default) the two paths are held to the same picture, exactly;
 * with soft ones (`alpha`), to a rounding step or two.
 */
import { expect, vi } from "vitest";
import { Application, boot, TMXTileMap, timer } from "../../src/index.js";
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
 * @param {(x: number, y: number, id: number) => boolean} [options.opaque]
 * which pixels of a tile are opaque (all of them by default)
 * @param {(x: number, y: number, id: number) => number} [options.alpha]
 * how opaque each pixel is, 0 to 255, for soft edges and see-through tiles
 * (in place of `opaque`)
 * @param {boolean} [options.outerMargin=true] - false for an image that
 * stops at its last column and row, with no margin after them, as Tiled
 * lets one
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
		alpha,
		outerMargin = true,
		extra = {},
	} = options;
	const rows = Math.ceil(count / columns);
	const canvas = document.createElement("canvas");
	const outer = outerMargin ? margin : 0;
	canvas.width = margin + outer + columns * tw + (columns - 1) * spacing;
	canvas.height = margin + outer + rows * th + (rows - 1) * spacing;
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
				const a = alpha !== undefined ? alpha(x, y, id) : 255;
				if (a <= 0 || (opaque !== undefined && !opaque(x, y, id))) {
					image.data[o + 3] = 0;
					image.data[o] = image.data[o + 1] = image.data[o + 2] = 0;
					continue;
				}
				// a colour per tile, and per pixel in it: never the
				// margin's, never the background's
				image.data[o] = 40 + ((id * 53 + seed) % 180);
				image.data[o + 1] = 30 + ((x * 7 + id * 11) % 200);
				image.data[o + 2] = 30 + ((y * 5 + id * 29) % 200);
				image.data[o + 3] = a;
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
 * The picture of a map, painted here with a 2D canvas and no engine: every
 * tile of every layer, in the order Tiled draws them (rows from the top,
 * each from the left), where Tiled draws them, with nothing left out for
 * being out of view. What both of the engine's renderers are held to.
 *
 * Orthogonal, isometric, staggered and hexagonal maps (the last two take
 * their `staggeraxis`, `staggerindex` and `hexsidelength` from the scene's
 * `extra`). Tiles are drawn whole, bottom-aligned on their cell and moved by
 * their tileset's `tileoffset`; flipped across, down or along the diagonal (the
 * last on square tiles only, where a flip is a quarter turn in place).
 * A layer is moved by its offset in Tiled (`offsetx`, `offsety`). Layer
 * opacity and tint are for the caller to apply to the picture.
 * @param {object} scene - what {@link makeMap} was given
 * @param {number} viewX - the view's left, in the map's pixels
 * @param {number} viewY - the view's top
 * @param {number} width - the view's width
 * @param {number} height - the view's height
 * @returns {ImageData} the picture
 */
export function reference(scene, viewX, viewY, width, height) {
	const { orientation, cols, rows, tw, th, tilesets, layers } = scene;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = "rgb(16, 24, 48)";
	ctx.fillRect(0, 0, width, height);
	ctx.translate(-viewX, -viewY);

	let firstgid = 1;
	const sets = tilesets.map((tileset) => {
		const set = { ...tileset, firstgid, image: imgList[tileset.name] };
		firstgid += tileset.tilecount;
		return set;
	});
	const drawTile = (raw, left, bottom) => {
		const gid = raw & 0x1fffffff;
		const set = sets.findLast((candidate) => {
			return gid >= candidate.firstgid;
		});
		const id = gid - set.firstgid;
		const w = set.tilewidth;
		const h = set.tileheight;
		const sx = set.margin + (id % set.columns) * (w + set.spacing);
		const sy = set.margin + Math.floor(id / set.columns) * (h + set.spacing);
		const x = left + (set.tileoffset?.x ?? 0);
		const y = bottom - h + (set.tileoffset?.y ?? 0);
		ctx.save();
		ctx.translate(x + w / 2, y + h / 2);
		if ((raw & FLIP_AD) !== 0) {
			ctx.rotate(-Math.PI / 2);
			ctx.scale(-1, 1);
		}
		const ad = (raw & FLIP_AD) !== 0;
		if ((raw & FLIP_H) !== 0) {
			ctx.scale(ad ? 1 : -1, ad ? -1 : 1);
		}
		if ((raw & FLIP_V) !== 0) {
			ctx.scale(ad ? -1 : 1, ad ? 1 : -1);
		}
		ctx.drawImage(set.image, sx, sy, w, h, -w / 2, -h / 2, w, h);
		ctx.restore();
	};

	for (const layer of layers) {
		const ox = layer.offsetx ?? 0;
		const oy = layer.offsety ?? 0;
		// the layer's cells: a plain grid, or an infinite map's chunks
		const cells = new Map();
		const put = (col, row, gid) => {
			if (gid !== 0) {
				cells.set(`${col},${row}`, gid);
			}
		};
		if (layer.chunks !== undefined) {
			for (const chunk of layer.chunks) {
				chunk.data.forEach((gid, i) => {
					put(
						chunk.x + (i % chunk.width),
						chunk.y + Math.floor(i / chunk.width),
						gid,
					);
				});
			}
		} else {
			layer.data.forEach((gid, i) => {
				put(i % cols, Math.floor(i / cols), gid);
			});
		}
		const ordered = [...cells.entries()].map(([key, gid]) => {
			const [col, row] = key.split(",").map(Number);
			return { col, row, gid };
		});
		if (orientation === "isometric") {
			// rows of constant col + row, each from the left
			ordered.sort((a, b) => {
				return a.col + a.row - (b.col + b.row) || a.col - b.col;
			});
			for (const { col, row, gid } of ordered) {
				drawTile(
					gid,
					ox + ((col - row - 1) * tw) / 2 + (rows * tw) / 2,
					oy + ((col + row + 2) * th) / 2,
				);
			}
		} else if (orientation === "staggered" || orientation === "hexagonal") {
			// Every other row (or column, with `staggeraxis` "x") is
			// shifted by half a cell; a hexagonal map's cells are longer
			// by `hexsidelength` along the stagger axis. Tiles are drawn
			// from the top of the screen down, each line from the left.
			const { staggeraxis, staggerindex, hexsidelength = 0 } = scene.extra;
			const staggerX = staggeraxis === "x";
			const even = staggerindex === "even" ? 1 : 0;
			const side = orientation === "hexagonal" ? hexsidelength : 0;
			const sideX = staggerX ? side : 0;
			const sideY = staggerX ? 0 : side;
			// Tiled's own numbers (libtiled's hexagonal `RenderParams`, as
			// of Tiled 1.10), all whole: half of what a side leaves of a
			// tile, rounded down; a column and a row; and the cell a tile
			// stands on, the tile's size less the pixel dropped
			const offsetX = Math.trunc((tw - sideX) / 2);
			const offsetY = Math.trunc((th - sideY) / 2);
			const columnWidth = offsetX + sideX;
			const rowHeight = offsetY + sideY;
			const cw = columnWidth + offsetX;
			const ch = rowHeight + offsetY;
			const place = ({ col, row }) => {
				// `& 1` and not `% 2`: an infinite map has negative cells
				return staggerX
					? {
							x: col * columnWidth,
							y: row * (ch + sideY) + ((col & 1) ^ even) * rowHeight,
						}
					: {
							x: col * (cw + sideX) + ((row & 1) ^ even) * columnWidth,
							y: row * rowHeight,
						};
			};
			const placed = ordered.map((cell) => {
				return { ...cell, ...place(cell) };
			});
			placed.sort((a, b) => {
				return a.y - b.y || a.x - b.x;
			});
			for (const { gid, x, y } of placed) {
				drawTile(gid, ox + x, oy + y + ch);
			}
		} else {
			// the map's render order: rows from the top or the bottom, each
			// from the left or the right ("right-down" unless said)
			const order = scene.extra?.renderorder ?? "right-down";
			const down = order.endsWith("down") ? 1 : -1;
			const right = order.startsWith("right") ? 1 : -1;
			ordered.sort((a, b) => {
				return down * (a.row - b.row) || right * (a.col - b.col);
			});
			for (const { col, row, gid } of ordered) {
				drawTile(gid, ox + col * tw, oy + (row + 1) * th);
			}
		}
	}
	return ctx.getImageData(0, 0, width, height);
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
 * @param {string} [renderMode] - a render mode to ask of every layer before
 * it is activated ("prerender" needs asking then: it bakes at activation)
 * @param {boolean} [centered=false] - as `level.load` adds a map: one
 * smaller than the view is centred in it, by moving the world (`world.pos`)
 * @returns {object[]} the map's tile layers
 */
export function show(app, map, renderMode, centered = false) {
	app.world.reset();
	// where a map centred before this one left it
	app.world.pos.set(0, 0, app.world.pos.z);
	app.renderer.reset?.();
	app.renderer.backgroundColor.setColor(16, 24, 48);
	if (renderMode !== undefined) {
		for (const layer of map.getLayers()) {
			layer.renderMode = renderMode;
		}
	}
	map.addTo(app.world, true, centered);
	// the layers in their order now: the world sorts its children later, on
	// a timer no frame of these tests waits for
	app.world.sortNow(true);
	app.viewport.setBounds(-100000, -100000, 200000, 200000);
	return map.getLayers();
}

let clock = 0;

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
	// time passes (animated tiles advance once per tick of the engine's
	// clock), then the world is updated: what is in view, what has changed
	if (dt > 0) {
		clock = Math.max(clock, timer.getTime()) + dt;
		timer.update(clock);
	}
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

/** views over a map: inside, over each edge, and scrolled part way */
const DEFAULT_VIEWS = [
	[0, 0],
	[70, 20],
	[-40, -80],
	[230, 110],
	[-150, 30],
	[100, -200],
];

/**
 * Draw a scene both ways from each view, and expect the reference
 * picture from both, the GPU path drawing alone.
 * @param {Application} app - the application, from {@link makeApp}
 * @param {object} scene - what {@link makeMap} takes
 * @param {object} [options]
 * @param {number[][]} [options.views] - where to look from
 * @param {object[]} [options.layers] - the scene's layers, when
 * they are in the world already (and were changed there). Without
 * them the scene is put in the world here, and every layer of it is
 * expected to take the GPU path of its own accord
 * @param {boolean} [options.oracle=true] - false where the reference
 * does not reach (a zoomed camera): the two paths are then compared
 * with each other alone
 * @param {(picture: ImageData) => ImageData} [options.expected]
 * what the reference becomes (a faded or tinted layer)
 * @param {number} [options.tolerance=0] - the largest difference of a
 * channel that is not counted
 * @param {number} [options.share=0] - the largest share of the pixels
 * drawn that the two paths may differ by
 * @param {number[]} [options.origin] - where the map's origin is drawn,
 * when the world or a container the layers are in was moved
 * @returns {Promise<number>} how many pixels were drawn, in all
 */
export async function comparePaths(app, scene, options = {}) {
	const {
		views = DEFAULT_VIEWS,
		oracle = true,
		expected,
		tolerance = 0,
		share = 0,
		origin = [0, 0],
	} = options;
	const { width, height } = app.viewport;
	let layers = options.layers;
	if (layers === undefined) {
		layers = show(app, makeMap(scene));
		for (const layer of layers) {
			expect(layer.renderMode, layer.name).toBe("shader");
		}
	}
	let total = 0;
	for (const [x, y] of views) {
		app.viewport.moveTo(x, y);
		const cpu = await drawIn(app, layers, "perTile");
		const gpu = await drawIn(app, layers, "shader");
		// a layer out of view is not drawn at all; one in view is
		// drawn tile by tile by the CPU path, and never by the GPU one
		expect(cpu.cpuDraws).toBeLessThanOrEqual(layers.length);
		expect(gpu.cpuDraws, "the GPU path reaches no CPU renderer").toBe(0);
		const at = `view (${x}, ${y})`;
		const count = drawn(gpu.frame);
		const allowed = Math.floor(count * share);
		if (oracle) {
			let ref = reference(scene, x - origin[0], y - origin[1], width, height);
			if (expected !== undefined) {
				ref = expected(ref);
			}
			const c = diff(ref, cpu.frame, tolerance);
			expect(c.different, `${at}, CPU path: ${c.first}`).toBe(0);
			// and where something is to be seen, the layer was asked for it
			if (drawn(ref) > 0) {
				expect(cpu.cpuDraws, `${at}, CPU draws`).toBeGreaterThan(0);
			}
			const g = diff(ref, gpu.frame, tolerance);
			expect(g.different, `${at}, GPU path: ${g.first}`).toBe(0);
		}
		const d = diff(cpu.frame, gpu.frame, tolerance);
		expect(
			d.different,
			`${at}, CPU against GPU: ${d.first}`,
		).toBeLessThanOrEqual(allowed);
		total += count;
	}
	return total;
}
