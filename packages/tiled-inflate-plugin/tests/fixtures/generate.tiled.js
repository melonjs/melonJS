/* global tiled, TileMap, Tileset, TileLayer, Tile, TextFile */
/**
 * Writes the maps the tests load, with Tiled's own encoder: run it with
 * Tiled 1.10 or later, from this directory:
 *
 *   Tiled --evaluate generate.tiled.js "$PWD"
 *
 * (on macOS, Tiled is /Applications/Tiled.app/Contents/MacOS/Tiled)
 *
 * Every map holds the same tiles, flipped ones included, in each layer data
 * format Tiled saves: CSV and uncompressed base64 (which the engine decodes
 * itself) and gzip, zlib and zstd (which need the plugin). `expected.json`
 * lists every tile, as Tiled stores it, for the tests to check them against.
 */
const dir = tiled.scriptArguments[0];
if (!dir) {
	throw new Error(
		"pass the output directory: Tiled --evaluate generate.tiled.js <dir>",
	);
}

const T = 16;
const H = 0x80000000;
const V = 0x40000000;
const AD = 0x20000000;

// the tileset: 4 x 2 tiles of 16 x 16, each its own colour
const COLOURS = [
	0xffe6194b, 0xff3cb44b, 0xffffe119, 0xff4363d8, 0xfff58231, 0xff911eb4,
	0xff46f0f0, 0xfff032e6,
];
const image = new Image(4 * T, 2 * T, Image.Format_ARGB32);
for (let i = 0; i < 8; i++) {
	const x0 = (i % 4) * T;
	const y0 = Math.floor(i / 4) * T;
	for (let y = 0; y < T; y++) {
		for (let x = 0; x < T; x++) {
			image.setPixel(x0 + x, y0 + y, COLOURS[i]);
		}
	}
}
image.save(`${dir}/tiles.png`);

/**
 * the tiles of the two layers, as [col, row, gid] where gid carries Tiled's
 * flip bits (H, V, AD)
 * @param {number} col0 - first column
 * @param {number} row0 - first row
 * @param {number} cols - columns
 * @param {number} rows - rows
 * @returns {{ground: number[][], detail: number[][]}} the tiles
 */
function pattern(col0, row0, cols, rows) {
	const ground = [];
	const detail = [];
	const flips = [0, H, V, AD, H | V, H | AD, V | AD, H | V | AD];
	let n = 0;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			// every cell of the ground: all eight tiles, unflipped
			ground.push([col0 + col, row0 + row, 1 + ((col + row * 3) % 8)]);
			// one cell in three of the detail: every tile, every flip
			if ((col * 7 + row * 5) % 3 === 0) {
				const gid = 1 + (n % 8);
				detail.push([
					col0 + col,
					row0 + row,
					(gid | flips[Math.floor(n / 8) % 8]) >>> 0,
				]);
				n++;
			}
		}
	}
	return { ground, detail };
}

/**
 * the tiles of the big maps: every tile, every flip, from a fixed seed
 * (tests/maps.spec.js makes the same ones)
 * @param {number} cols - columns
 * @param {number} rows - rows
 * @returns {number[][]} [col, row, gid]
 */
function noise(cols, rows) {
	let seed = 12345;
	const tiles = [];
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
}

/**
 * builds a map
 * @param {object} spec - the map
 * @returns {TileMap} the map
 */
function build(spec) {
	const map = new TileMap();
	map.setSize(spec.width, spec.height);
	map.setTileSize(T, T);
	map.infinite = spec.infinite;
	map.layerDataFormat = spec.format;
	if (spec.level !== undefined) {
		map.compressionLevel = spec.level;
	}
	const tileset = new Tileset("tiles");
	tileset.setTileSize(T, T);
	tileset.image = `${dir}/tiles.png`;
	map.addTileset(tileset);
	for (const [name, tiles] of Object.entries(spec.layers)) {
		const layer = new TileLayer(name);
		map.addLayer(layer);
		const edit = layer.edit();
		for (const [col, row, gid] of tiles) {
			const flags =
				(gid & H ? Tile.FlippedHorizontally : 0) |
				(gid & V ? Tile.FlippedVertically : 0) |
				(gid & AD ? Tile.FlippedAntiDiagonally : 0);
			edit.setTile(col, row, tileset.tile((gid & 0x0fffffff) - 1), flags);
		}
		edit.apply();
	}
	return map;
}

/**
 * saves a map, failing loudly
 * @param {TileMap} map - the map
 * @param {string} file - its file name, .tmx or .tmj
 */
function save(map, file) {
	const format = tiled.mapFormat(file.endsWith(".tmx") ? "tmx" : "json");
	const error = format.write(map, `${dir}/${file}`);
	if (error) {
		throw new Error(`${file}: ${error}`);
	}
}

const FORMATS = {
	csv: TileMap.CSV,
	base64: TileMap.Base64,
	gzip: TileMap.Base64Gzip,
	zlib: TileMap.Base64Zlib,
	zstd: TileMap.Base64Zstandard,
};

// a 13 x 9 map, and an infinite one whose tiles cross six 16 x 16 chunks
// either side of the origin, and one far away
const finite = {
	width: 13,
	height: 9,
	infinite: false,
	layers: pattern(0, 0, 13, 9),
};
const infiniteLayers = pattern(-18, -5, 32, 16);
infiniteLayers.detail.push([40, 33, (8 | H | V | AD) >>> 0]);
const infinite = {
	width: 13,
	height: 9,
	infinite: true,
	layers: infiniteLayers,
};

for (const [name, format] of Object.entries(FORMATS)) {
	for (const ext of ["tmx", "tmj"]) {
		save(build(Object.assign({}, finite, { format })), `map-${name}.${ext}`);
		save(
			build(Object.assign({}, infinite, { format })),
			`infinite-${name}.${ext}`,
		);
	}
}

// compression levels: zlib 0 stores the data in uncompressed blocks
save(
	build(Object.assign({}, finite, { format: TileMap.Base64Zlib, level: 0 })),
	"map-zlib-level0.tmx",
);
save(
	build(Object.assign({}, finite, { format: TileMap.Base64Gzip, level: 9 })),
	"map-gzip-level9.tmj",
);
save(
	build(
		Object.assign({}, finite, { format: TileMap.Base64Zstandard, level: 1 }),
	),
	"map-zstd-level1.tmx",
);
save(
	build(
		Object.assign({}, finite, { format: TileMap.Base64Zstandard, level: 22 }),
	),
	"map-zstd-level22.tmj",
);

// a 96 x 64 map, big enough for several compressed blocks
const big = {
	width: 96,
	height: 64,
	infinite: false,
	layers: { ground: noise(96, 64) },
};
for (const name of ["gzip", "zlib", "zstd"]) {
	save(
		build(Object.assign({}, big, { format: FORMATS[name] })),
		`big-${name}.tmj`,
	);
}

const expected = new TextFile(`${dir}/expected.json`, TextFile.WriteOnly);
expected.write(
	JSON.stringify({
		finite: {
			width: finite.width,
			height: finite.height,
			layers: finite.layers,
		},
		infinite: { layers: infinite.layers },
	}),
);
expected.commit();
tiled.log("fixtures written to " + dir);
