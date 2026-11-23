import { warnOnce } from "../../lang/console.js";
import { SCROLLING_VECTORS, setLayerScrolling } from "../tilemap/layer.js";
import TileLayer, {
	FLIP_AD_BIT,
	FLIP_H_BIT,
	FLIP_V_BIT,
} from "../tilemap/TileLayer.js";
import {
	TMX_CLEAR_BIT_MASK,
	TMX_FLIP_AD,
	TMX_FLIP_H,
	TMX_FLIP_V,
} from "./constants.js";
import * as TMXUtils from "./TMXUtils.js";

/**
 * additional import for TypeScript
 * @import TilesetGroup from "../tilemap/TilesetGroup.js";
 */

/**
 * extract a 3-bit flip mask from a raw 32-bit GID (Tiled's flip bits live in
 * the upper 3 bits)
 * @ignore
 * @internal
 */
function flipMaskFromGid(gid) {
	return (
		(gid & TMX_FLIP_H ? FLIP_H_BIT : 0) |
		(gid & TMX_FLIP_V ? FLIP_V_BIT : 0) |
		(gid & TMX_FLIP_AD ? FLIP_AD_BIT : 0)
	);
}

/**
 * Decode a tiled layer's data blob directly into the typed-array layerData.
 * `data` holds `width` x `height` cells whose top left one is the map's tile
 * (`x`, `y`): a whole finite layer, or one chunk of an infinite map's layer.
 * A cell outside the layer's grid is left out, never wrapped into another row.
 * Data that does not hold exactly `width` x `height` tiles throws
 * @ignore
 * @internal
 */
function setLayerData(layer, data, x, y, width, height, chunk = false) {
	// as Tiled does, refuse data that does not fill the cells exactly: a
	// missing tile would otherwise be left empty, without a word
	if (data.length !== width * height) {
		const where = chunk ? ` (the chunk at ${x}, ${y})` : "";
		throw new Error(
			`Tiled layer "${layer.name}" has ${data.length} tiles of data for its ${width} x ${height} cells${where}`,
		);
	}
	let idx = 0;
	const cols = layer.cols;
	const rows = layer.rows;
	const layerData = layer.layerData;
	// where the data's first cell sits in the layer's grid
	const offsetX = x - layer.startx;
	const offsetY = y - layer.starty;
	// One-shot warning when a layer's flip-stripped GID won't fit in the
	// `Uint16Array` cell — silent truncation would render the wrong tile.
	// 65535 is far above any realistic tileset size, but flag it loudly
	// so users with degenerate maps notice immediately.
	let overflowedGid = 0;
	for (let row = 0; row < height; row++) {
		const cy = row + offsetY;
		for (let col = 0; col < width; col++) {
			const rawGid = data[idx++];
			const cx = col + offsetX;
			if (rawGid !== 0 && cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
				const flatIdx = (cy * cols + cx) * 2;
				const cleanGid = rawGid & TMX_CLEAR_BIT_MASK;
				if (cleanGid > 0xffff && overflowedGid === 0) {
					overflowedGid = cleanGid;
				}
				layerData[flatIdx] = cleanGid;
				layerData[flatIdx + 1] = flipMaskFromGid(rawGid);
			}
		}
	}
	if (overflowedGid !== 0) {
		console.warn(
			"melonJS: TMX layer contains GID " +
				overflowedGid +
				" which exceeds the 16-bit cell capacity (max 65535). Tiles will be truncated and render incorrectly.",
		);
	}
}

/**
 * Apply a layer's custom properties (and attributes) to the layer, as its
 * fields. One named as a scrolling field of the layer (`ratio`, the property
 * an image layer takes) sets that field, rather than taking its place: the
 * layer is drawn by it. A value that is not a number is left out, with a
 * warning.
 * @ignore
 * @internal
 */
function applyLayerProperties(layer, data) {
	const kept = {};
	for (const name of SCROLLING_VECTORS) {
		kept[name] = layer[name];
	}
	TMXUtils.applyTMXProperties(layer, data);
	for (const name of SCROLLING_VECTORS) {
		const given = layer[name];
		if (given === kept[name]) {
			continue;
		}
		layer[name] = kept[name];
		try {
			setLayerScrolling(layer, { [name]: given });
		} catch {
			warnOnce(
				`melonJS: layer "${layer.name}": its \`${name}\` property is not a number, nor an {x, y} of numbers: left out`,
			);
		}
	}
}

/**
 * Fill a layer from a list of the tiles placed in it: the other form a
 * layer's cells come in, one entry for each tile rather than one number for
 * each cell (Sprite Fusion writes a layer this way). An entry is
 * `{ id, x, y }`: the tile's id in the map's first tileset, and the column
 * and row of its cell. Its `properties` or `attributes`, if any, are what
 * this one tile has of its own, which {@link TileLayer#getTileProperties}
 * returns. A tile outside the layer's grid is left out.
 * @ignore
 * @internal
 */
function setPlacedTiles(layer, tiles) {
	const firstgid = layer.tileset?.firstgid ?? 1;
	const cols = layer.cols;
	const rows = layer.rows;
	const layerData = layer.layerData;
	for (let i = 0, len = tiles.length; i < len; i++) {
		const tile = tiles[i];
		const id = +tile.id;
		const col = +tile.x;
		const row = +tile.y;
		if (
			!Number.isInteger(id) ||
			id < 0 ||
			!Number.isInteger(col) ||
			!Number.isInteger(row) ||
			col < 0 ||
			col >= cols ||
			row < 0 ||
			row >= rows
		) {
			continue;
		}
		const gid = firstgid + id;
		// a tile no tileset has (a spritesheet replaced by a smaller one)
		// would throw each time the layer is drawn
		if (layer.tilesets.findTileset(gid) === undefined) {
			warnOnce(
				`melonJS: layer "${layer.name}" places tile ${id}, which the map's tilesets do not have: left out`,
			);
			continue;
		}
		layerData[(row * cols + col) * 2] = gid;
		// what this one tile was given, on top of what its tileset says
		// (and nothing of a tile listed earlier for the same cell)
		let own;
		if (tile.properties !== undefined || tile.attributes !== undefined) {
			own = {};
			TMXUtils.applyTMXProperties(own, tile);
		}
		layer.setTileProperties(col, row, own);
	}
}

/**
 * the cells an infinite map's layer covers, in the map's tile coordinates:
 * the map's own area and every chunk of the layer. Tiled gives a TMX layer
 * the map's size whatever its chunks hold, and a JSON one the chunks' bounds
 * (`startx`, `starty`), which can start left of or above the map. The start
 * is moved to an even column and row, so that a staggered or hexagonal
 * layer's cells keep the stagger of the map's tiles they hold
 * @ignore
 * @internal
 */
function chunksExtent(map, chunks) {
	let minX = 0;
	let minY = 0;
	let maxX = map.cols;
	let maxY = map.rows;
	for (let i = 0, len = chunks.length; i < len; i++) {
		const chunk = chunks[i];
		minX = Math.min(minX, +chunk.x);
		minY = Math.min(minY, +chunk.y);
		maxX = Math.max(maxX, +chunk.x + +chunk.width);
		maxY = Math.max(maxY, +chunk.y + +chunk.height);
	}
	minX -= minX & 1;
	minY -= minY & 1;
	return { x: minX, y: minY, cols: maxX - minX, rows: maxY - minY };
}

/**
 * a TMX Tile Layer Object: a {@link TileLayer} read from a tile map (a Tiled
 * map, Tiled QT 0.7.x format, or a Sprite Fusion one), with the layer's
 * tiles decoded and its custom properties applied.
 *
 * The layer's tiles come as `data`, the gid of every cell (encoded and
 * compressed as Tiled writes it), or as `tiles`, a list of
 * `{ id, x, y, attributes }` for the tiles placed in it. Its `properties`
 * and its `attributes` become fields of the layer; a `collider` set to true
 * makes its tiles solid.
 * @category Tilemap
 */
export default class TMXLayer extends TileLayer {
	/**
	 * @param {object} map - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
	 * @param {object} data - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
	 * @param {number} tilewidth - width of each tile in pixels
	 * @param {number} tileheight - height of each tile in pixels
	 * @param {string} orientation - "isometric" or "orthogonal"
	 * @param {TilesetGroup} tilesets - tileset as defined in Tiled
	 * @param {number} z - z-index position
	 */
	constructor(map, data, tilewidth, tileheight, orientation, tilesets, z) {
		// an infinite map's layer covers the map and every one of its chunks
		const chunks = map.infinite === 1 ? (data.chunks ?? []) : undefined;
		const extent = chunks !== undefined ? chunksExtent(map, chunks) : undefined;
		// a hidden layer is one of no opacity
		const visible = typeof data.visible !== "undefined" ? +data.visible : 1;

		super({
			name: data.name,
			// a layer can have a tile size of its own
			tilewidth: data.tilewidth || tilewidth,
			tileheight: data.tileheight || tileheight,
			orientation,
			tilesets,
			// the cell is the map renderer's: on a staggered or a hexagonal
			// map it can be a pixel less than the map's tile size
			renderer: map.getRenderer(),
			// Tiled sets the render order on the map, which every layer follows
			renderorder: data.renderorder || map.renderorder || "right-down",
			class: data.class,
			z,
			startx: extent?.x ?? 0,
			starty: extent?.y ?? 0,
			// (a layer that does not give its size has the map's)
			cols: extent?.cols ?? +(data.width ?? map.cols),
			rows: extent?.rows ?? +(data.height ?? map.rows),
			opacity: visible ? +(data.opacity ?? 1) : 0,
			// layer blend mode (Tiled 1.12+)
			blendMode: TMXUtils.tiledBlendMode(data.mode),
			offsetx: +data.offsetx || 0,
			offsety: +data.offsety || 0,
			// the layer's parallax factor (Tiled 1.5+): a group gives its
			// layers its own on top (see TMXGroup)
			...TMXUtils.tiledParallax(
				map,
				TMXUtils.tiledParallaxFactor(data.parallaxx),
				TMXUtils.tiledParallaxFactor(data.parallaxy),
			),
			_configure: (layer) => {
				// layer tint
				if (typeof data.tintcolor === "string") {
					// Tiled provides #RRGGBB or #AARRGGBB
					layer.tint.parseHex(data.tintcolor, true);
				}
				// check if we have any user-defined properties
				applyLayerProperties(layer, data);
				// the `collider` property, when the layer has it as a field
				// of its own (Sprite Fusion's JSON)
				if (typeof data.collider === "boolean") {
					layer.collider = data.collider;
				}
			},
			_fill: (layer) => {
				if (data.data === undefined && Array.isArray(data.tiles)) {
					// the tiles one by one, rather than every cell
					setPlacedTiles(layer, data.tiles);
				} else if (map.infinite === 0) {
					// initialize and set the layer data
					setLayerData(
						layer,
						TMXUtils.decode(data.data, data.encoding, data.compression),
						0,
						0,
						layer.cols,
						layer.rows,
					);
				} else if (chunks !== undefined) {
					// infinite map, initialize per chunk
					for (let i = 0, len = chunks.length; i < len; i++) {
						const chunk = chunks[i];
						setLayerData(
							layer,
							TMXUtils.decode(chunk.data, data.encoding, data.compression),
							+chunk.x,
							+chunk.y,
							+chunk.width,
							+chunk.height,
							true,
						);
					}
				}
			},
		});
	}
}
