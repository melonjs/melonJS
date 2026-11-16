/**
 * Maps saved by Tiled itself (`tests/fixtures`, written by
 * `generate.tiled.js`), loaded the way a game loads them: `loader.preload`,
 * then `level.load`. Every layer format must give back every tile Tiled
 * saved, flipped ones included, on finite and infinite maps.
 *
 * Then map files that are damaged or unusual, served in place of the real
 * ones: a game must get an error that says what is wrong, never a map with
 * other tiles.
 */
import {
	Application,
	boot,
	level,
	loader,
	plugin,
	state,
	type Tile,
	type TMXLayer,
	type TMXTileMap,
	TMXUtils,
	video,
} from "melonjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TiledInflatePlugin } from "../src/index.js";
import expected from "./fixtures/expected.json";

const H = 0x80000000;
const V = 0x40000000;
const AD = 0x20000000;

const fixture = (file: string) =>
	new URL(`./fixtures/${file}`, import.meta.url).href;

type Tiles = number[][];

/**
 * every tile of a layer as Tiled stores it, its global id with the flip bits,
 * by "col,row"
 * @param layer - the layer
 * @returns the tiles
 */
const tilesOf = (layer: TMXLayer) => {
	const tiles = new Map<string, number>();
	for (let row = layer.starty; row < layer.starty + layer.rows; row++) {
		for (let col = layer.startx; col < layer.startx + layer.cols; col++) {
			// null for an empty cell, though typed `Tile`
			const tile = layer.cellAt(col, row) as Tile | null;
			if (tile !== null) {
				tiles.set(
					`${col},${row}`,
					(tile.tileId |
						(tile.flippedX ? H : 0) |
						(tile.flippedY ? V : 0) |
						(tile.flippedAD ? AD : 0)) >>>
						0,
				);
			}
		}
	}
	return tiles;
};

const asTiles = (tiles: Tiles) =>
	new Map(tiles.map(([col, row, gid]) => [`${col},${row}`, gid >>> 0]));

/**
 * the tiles of the big maps, as generate.tiled.js makes them
 * @param cols - columns
 * @param rows - rows
 * @returns [col, row, gid]
 */
const noise = (cols: number, rows: number) => {
	let seed = 12345;
	const tiles: Tiles = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
			const r = seed >>> 16;
			if (r % 5 !== 0) {
				const flip = (r >> 3) % 8;
				tiles.push([
					col,
					row,
					((1 + (r % 8)) |
						(flip & 1 ? H : 0) |
						(flip & 2 ? V : 0) |
						(flip & 4 ? AD : 0)) >>>
						0,
				]);
			}
		}
	}
	return tiles;
};

let app: Application;
let loads = 0;

/**
 * preloads a map file, as a game does
 * @param src - its URL
 * @returns the name it was loaded as
 */
const preload = async (src: string) => {
	const name = `map${loads++}`;
	await loader.preload([{ name, type: "tmx", src }], undefined, false);
	return name;
};

/**
 * loads a preloaded map into the world, as a game does
 * @param name - its name
 * @returns its tile layers, by name
 */
const enter = async (name: string) => {
	await level.load(name, {
		container: app.world,
		setViewportBounds: false,
		async: true,
	});
	const map = level.getCurrentLevel() as TMXTileMap;
	return new Map(map.getLayers().map((layer) => [layer.name, layer]));
};

const load = async (src: string) => enter(await preload(src));

/**
 * expects the layers to hold exactly the tiles Tiled saved
 * @param layers - the loaded layers
 * @param tiles - Tiled's tiles, by layer name
 */
const expectTiles = (
	layers: Map<string, TMXLayer>,
	tiles: Record<string, Tiles>,
) => {
	expect([...layers.keys()].sort()).toEqual(Object.keys(tiles).sort());
	for (const [name, list] of Object.entries(tiles)) {
		const layer = layers.get(name);
		expect(layer, name).toBeDefined();
		expect(tilesOf(layer as TMXLayer), name).toEqual(asTiles(list));
	}
};

beforeAll(async () => {
	boot();
	app = new Application(13 * 16, 9 * 16, {
		parent: "screen",
		renderer: video.CANVAS,
		consoleHeader: false,
	});
	await app.init();
	state.stop();
	await loader.preload(
		[{ name: "tiles", type: "image", src: fixture("tiles.png") }],
		undefined,
		false,
	);
});

describe("without the plugin", () => {
	it("a compressed .tmx fails to preload, and the error names the plugin", async () => {
		const error = await loader
			.preload(
				[{ name: "no-plugin-tmx", type: "tmx", src: fixture("map-zlib.tmx") }],
				undefined,
				false,
			)
			.then(
				() => undefined,
				(e: unknown) => e as Error,
			);
		expect((error?.cause as Error).message).toBe(
			"No inflate function set: register @melonjs/tiled-inflate-plugin to load a Tiled map with gzip, zlib or zstd compressed layers",
		);
	});

	it("a compressed .tmj fails to load, and the error names the plugin", async () => {
		const name = await preload(fixture("map-zstd.tmj"));
		await expect(enter(name)).rejects.toThrow(
			"register @melonjs/tiled-inflate-plugin",
		);
	});

	it.each(["map-csv.tmx", "map-base64.tmj"])(
		"an uncompressed map (%s) loads",
		async (file) => {
			expectTiles(await load(fixture(file)), expected.finite.layers);
		},
	);
});

describe("maps Tiled saved", () => {
	beforeAll(() => {
		plugin.register(TiledInflatePlugin);
	});

	it("registering the plugin installs its decompression in the engine", async () => {
		const map = await (await fetch(fixture("map-zlib.tmj"))).json();
		const ids = TMXUtils.decode(map.layers[0].data, "base64", "zlib");
		expect(Array.from(ids)).toEqual(
			expected.finite.layers.ground.map(([, , gid]) => gid),
		);
	});

	const formats = ["csv", "base64", "gzip", "zlib", "zstd"];
	const files = formats.flatMap((format) =>
		["tmx", "tmj"].map((ext) => `${format}.${ext}`),
	);

	it.each(files)("map-%s: every tile, flips included", async (file) => {
		const layers = await load(fixture(`map-${file}`));
		expectTiles(layers, expected.finite.layers);
		for (const layer of layers.values()) {
			expect([layer.cols, layer.rows]).toEqual([13, 9]);
		}
	});

	it.each(files)(
		"infinite-%s: every tile of every chunk, around the origin and far from it",
		async (file) => {
			const layers = await load(fixture(`infinite-${file}`));
			expectTiles(layers, expected.infinite.layers);
			const detail = layers.get("detail") as TMXLayer;
			expect(tilesOf(detail).get("40,33")).toBe((8 | H | V | AD) >>> 0);
		},
	);

	it.each([
		"map-zlib-level0.tmx",
		"map-gzip-level9.tmj",
		"map-zstd-level1.tmx",
		"map-zstd-level22.tmj",
	])("%s, at another compression level", async (file) => {
		expectTiles(await load(fixture(file)), expected.finite.layers);
	});

	it.each(["gzip", "zlib", "zstd"])(
		"big-%s: 96 x 64 tiles, over several compressed blocks",
		async (format) => {
			const layers = await load(fixture(`big-${format}.tmj`));
			expectTiles(layers, { ground: noise(96, 64) });
		},
	);
});

describe("in a runtime with no atob", () => {
	beforeAll(() => {
		vi.stubGlobal("atob", undefined);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	it.each(
		["gzip", "zlib", "zstd"].flatMap((format) =>
			["tmx", "tmj"].flatMap((ext) => [
				`map-${format}.${ext}`,
				`infinite-${format}.${ext}`,
			]),
		),
	)("%s loads with the plugin's own base64 decoder", async (file) => {
		expect(typeof globalThis.atob).toBe("undefined");
		const layers = await load(fixture(file));
		expectTiles(
			layers,
			file.startsWith("map")
				? expected.finite.layers
				: expected.infinite.layers,
		);
	});

	it.each(["gzip", "zlib", "zstd"])(
		"big-%s loads with the plugin's own base64 decoder",
		async (format) => {
			const layers = await load(fixture(`big-${format}.tmj`));
			expectTiles(layers, { ground: noise(96, 64) });
		},
	);
});

describe("map files that are damaged or unusual", () => {
	// files served in place of real ones, by path
	const served = new Map<string, string>();

	beforeAll(() => {
		const realFetch = globalThis.fetch.bind(globalThis);
		vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
			const href =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url;
			const body = served.get(new URL(href, location.href).pathname);
			return body !== undefined
				? Promise.resolve(new Response(body))
				: realFetch(input, init);
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	/**
	 * serves a fixture, edited
	 * @param file - the fixture
	 * @param edit - changes its text
	 * @returns the URL it is served at
	 */
	const serve = async (file: string, edit: (text: string) => string) => {
		const text = await (await fetch(fixture(file))).text();
		const path = `/served/${served.size}/${file}`;
		served.set(path, edit(text));
		return `${location.origin}${path}`;
	};

	/**
	 * changes the data of the first tile layer of a .tmx or a .tmj
	 * @param file - the fixture
	 * @param change - changes the layer's base64 data
	 * @returns the URL the edited map is served at
	 */
	const withLayerData = (file: string, change: (data: string) => string) =>
		serve(file, (text) => {
			if (file.endsWith(".tmj")) {
				const map = JSON.parse(text);
				map.layers[0].data = change(map.layers[0].data);
				return JSON.stringify(map);
			}
			return text.replace(
				/(<data encoding="base64"[^>]*>)\s*([^<]*?)\s*(<\/data>)/,
				(_, open, data, close) => `${open}\n   ${change(data)}\n  ${close}`,
			);
		});

	/**
	 * one base64 character, in the middle, changed to another
	 * @param data - base64 data
	 * @returns the damaged data
	 */
	const oneCharChanged = (data: string) => {
		const at = data.length >> 1;
		return (
			data.slice(0, at) + (data[at] === "A" ? "B" : "A") + data.slice(at + 1)
		);
	};

	/**
	 * the error a game gets from preloading a map, then loading it
	 * @param src - the map's URL
	 * @returns the reason: the loader reports a .tmx it could not read as
	 * "Failed loading resource", with the reason as its cause
	 */
	const failure = async (src: string) => {
		try {
			await load(src);
		} catch (error) {
			const failed = error as Error;
			return failed.message.startsWith("Failed loading resource")
				? (failed.cause as Error)
				: failed;
		}
		return undefined;
	};

	/**
	 * zlib compressed base64, as Tiled writes it
	 * @param ids - tile ids
	 * @returns the layer data
	 */
	const zlibData = async (ids: Uint32Array) => {
		// the ids' bytes, in a buffer of their own
		const bytes = new Uint8Array(ids.byteLength);
		bytes.set(new Uint8Array(ids.buffer, ids.byteOffset, ids.byteLength));
		const zlib = new Uint8Array(
			await new Response(
				new Blob([bytes])
					.stream()
					.pipeThrough(new CompressionStream("deflate")),
			).arrayBuffer(),
		);
		return btoa(String.fromCharCode(...zlib));
	};

	it.each(["gzip", "zlib"])(
		"a %s .tmx with one character of its data changed fails to preload",
		async (format) => {
			const src = await withLayerData(`map-${format}.tmx`, oneCharChanged);
			const error = await failure(src);
			expect(error?.message).toMatch(
				`@melonjs/tiled-inflate-plugin: cannot read ${format} compressed layer data`,
			);
		},
	);

	it("a zstd .tmx whose frame header is damaged fails to preload", async () => {
		const src = await withLayerData(
			"map-zstd.tmx",
			(data) => (data[0] === "A" ? "B" : "A") + data.slice(1),
		);
		expect((await failure(src))?.message).toMatch(
			"@melonjs/tiled-inflate-plugin: cannot read zstd compressed layer data",
		);
	});

	it("a zstd .tmx with a tile byte changed loads other tiles: zstd as Tiled writes it has no checksum", async () => {
		const src = await withLayerData("map-zstd.tmx", oneCharChanged);
		const layers = await load(src);
		expect(tilesOf(layers.get("ground") as TMXLayer)).not.toEqual(
			asTiles(expected.finite.layers.ground),
		);
	});

	it.each(["gzip", "zlib"])(
		"a %s .tmj with one character of its data changed fails to load",
		async (format) => {
			const src = await withLayerData(`big-${format}.tmj`, oneCharChanged);
			const error = await failure(src);
			expect(error?.message).toMatch(
				`@melonjs/tiled-inflate-plugin: cannot read ${format} compressed layer data`,
			);
		},
	);

	it.each(["gzip.tmj", "zlib.tmx", "zstd.tmj"])(
		"map-%s with its data cut in half fails",
		async (file) => {
			const src = await withLayerData(`map-${file}`, (data) =>
				data.slice(0, (data.length >> 1) & ~3),
			);
			expect((await failure(src))?.message).toMatch(
				"@melonjs/tiled-inflate-plugin: cannot read",
			);
		},
	);

	it("a map saying zlib that holds gzip data loads, as it did with pako", async () => {
		const src = await serve("map-gzip.tmx", (text) =>
			text.replaceAll('compression="gzip"', 'compression="zlib"'),
		);
		expectTiles(await load(src), expected.finite.layers);
	});

	it("a map whose layers use a compression Tiled does not write fails, naming it", async () => {
		const src = await serve("map-zlib.tmx", (text) =>
			text.replaceAll('compression="zlib"', 'compression="lz4"'),
		);
		expect((await failure(src))?.message).toBe(
			'@melonjs/tiled-inflate-plugin: Tiled layer compression "lz4" is not supported: use gzip, zlib or zstd',
		);
	});

	it("a .tmx edited on Windows, its data re-indented with tabs and CRLF, loads", async () => {
		const src = await serve("map-zstd.tmx", (text) =>
			text
				.replace(
					/(<data encoding="base64"[^>]*>)\s*([^<]*?)\s*(<\/data>)/g,
					(_, open, data, close) =>
						`${open}\r\n\t\t${data.match(/.{1,10}/g)?.join("\r\n\t\t")}\r\n\t${close}`,
				)
				.replaceAll("\n", "\r\n"),
		);
		expectTiles(await load(src), expected.finite.layers);
	});

	it.each([
		["fewer", 12],
		["more", 13 * 9 + 1],
	])(
		"a layer whose data holds %s tiles than its cells fails, as Tiled refuses it",
		async (_, count) => {
			// the ground layer's tiles, as many as asked, recompressed
			const ground = new Uint32Array(count).map(
				(_, i) => expected.finite.layers.ground[i % (13 * 9)][2],
			);
			const data = await zlibData(ground);
			const src = await withLayerData("map-zlib.tmj", () => data);
			expect((await failure(src))?.message).toBe(
				`Tiled layer "ground" has ${count} tiles of data for its 13 x 9 cells`,
			);
		},
	);

	it("an infinite map's chunk whose data is one tile short fails, naming the chunk", async () => {
		const data = await zlibData(new Uint32Array(16 * 16 - 1).fill(1));
		const src = await serve("infinite-zlib.tmj", (text) => {
			const map = JSON.parse(text);
			map.layers[0].chunks[0].data = data;
			return JSON.stringify(map);
		});
		const chunk = JSON.parse(
			await (await fetch(fixture("infinite-zlib.tmj"))).text(),
		).layers[0].chunks[0];
		expect((await failure(src))?.message).toBe(
			`Tiled layer "ground" has 255 tiles of data for its 16 x 16 cells (the chunk at ${chunk.x}, ${chunk.y})`,
		);
	});
});
