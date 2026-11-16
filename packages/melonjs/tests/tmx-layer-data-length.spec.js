import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, TMXTileMap, video } from "../src/index.js";
import * as TMXUtils from "../src/level/tiled/TMXUtils.js";
import { imgList } from "../src/loader/cache.js";

/**
 * A tile layer's data must hold exactly one tile per cell: `width` x
 * `height` for a layer, and for each chunk of an infinite map's layer. Tiled
 * refuses a map whose data does not ("Corrupt layer data"). melonJS read the
 * missing tiles as `undefined` and left their cells empty without a word,
 * and ignored tiles past the last cell; it now throws, naming the layer, in
 * every encoding: CSV, base64, and a JSON array.
 */

const COLS = 5;
const ROWS = 3;
const CELLS = COLS * ROWS;

// tile ids 1 to 3, every cell filled
const ids = (count) => {
	return Array.from({ length: count }, (_, i) => {
		return 1 + (i % 3);
	});
};

const base64 = (list) => {
	const bytes = new Uint8Array(new Uint32Array(list).buffer);
	return btoa(String.fromCharCode(...bytes));
};

const tileset = {
	firstgid: 1,
	name: "length-tiles",
	tilewidth: 16,
	tileheight: 16,
	spacing: 0,
	margin: 0,
	tilecount: 3,
	columns: 3,
	image: "length-tiles.png",
	imagewidth: 48,
	imageheight: 16,
};

// a Tiled JSON map of one tile layer
const jsonMap = (layer) => {
	return {
		type: "map",
		version: "1.10",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: COLS,
		height: ROWS,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 2,
		nextobjectid: 1,
		tilesets: [tileset],
		layers: [
			{
				id: 1,
				name: "ground",
				type: "tilelayer",
				visible: true,
				opacity: 1,
				x: 0,
				y: 0,
				width: COLS,
				height: ROWS,
				...layer,
			},
		],
	};
};

// the same map in TMX (XML), as the loader parses it
const tmxMap = (data) => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down" width="${COLS}" height="${ROWS}" tilewidth="16" tileheight="16" infinite="0" nextlayerid="2" nextobjectid="1">
 <tileset firstgid="1" name="length-tiles" tilewidth="16" tileheight="16" tilecount="3" columns="3">
  <image source="length-tiles.png" width="48" height="16"/>
 </tileset>
 <layer id="1" name="ground" width="${COLS}" height="${ROWS}">
  ${data}
 </layer>
</map>`;
	return TMXUtils.parse(new DOMParser().parseFromString(xml, "text/xml")).map;
};

// the ways Tiled writes a layer's data
const ENCODINGS = {
	"TMX CSV": (list) => {
		return tmxMap(`<data encoding="csv">\n${list.join(",\n")}\n</data>`);
	},
	"TMX base64": (list) => {
		return tmxMap(`<data encoding="base64">\n   ${base64(list)}\n  </data>`);
	},
	"JSON array": (list) => {
		return jsonMap({ data: list });
	},
	"JSON base64": (list) => {
		return jsonMap({ encoding: "base64", data: base64(list) });
	},
};

// an infinite JSON map: two 4 x 4 chunks, the second as given
const infiniteMap = (second) => {
	const map = jsonMap({
		startx: 0,
		starty: 0,
		width: 8,
		height: 4,
		chunks: [
			{ x: 0, y: 0, width: 4, height: 4, data: ids(16) },
			{ x: 4, y: 0, width: 4, height: 4, data: second },
		],
	});
	map.infinite = true;
	return map;
};

const layerOf = (name, data) => {
	return new TMXTileMap(name, data).getLayers()[0];
};

describe("a tile layer's data must fill its cells", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(COLS * 16, ROWS * 16, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		const image = document.createElement("canvas");
		image.width = 48;
		image.height = 16;
		imgList["length-tiles"] = image;
	});

	afterAll(() => {
		delete imgList["length-tiles"];
		app.destroy?.();
	});

	describe.each(Object.entries(ENCODINGS))("%s", (encoding, make) => {
		it("exactly one tile per cell loads, every cell set", () => {
			const layer = layerOf(`exact ${encoding}`, make(ids(CELLS)));
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					expect(layer.cellAt(col, row)?.tileId).toBe(
						1 + ((row * COLS + col) % 3),
					);
				}
			}
		});

		it.each([
			["one tile short", CELLS - 1],
			["half the tiles", 7],
			["one tile too many", CELLS + 1],
			["a whole row too many", CELLS + COLS],
		])("%s throws, naming the layer", (_, count) => {
			expect(() => {
				return layerOf(`${count} ${encoding}`, make(ids(count)));
			}).toThrow(
				`Tiled layer "ground" has ${count} tiles of data for its ${COLS} x ${ROWS} cells`,
			);
		});
	});

	it("an infinite map's chunks of exactly their size load", () => {
		const layer = layerOf("infinite exact", infiniteMap(ids(16)));
		expect(layer.cellAt(7, 3)?.tileId).toBe(1 + (15 % 3));
	});

	it.each([15, 17])(
		"a chunk of %i tiles for 4 x 4 cells throws, naming it",
		(count) => {
			expect(() => {
				return layerOf(`infinite ${count}`, infiniteMap(ids(count)));
			}).toThrow(
				`Tiled layer "ground" has ${count} tiles of data for its 4 x 4 cells (the chunk at 4, 0)`,
			);
		},
	);
});
