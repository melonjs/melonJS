import type { LDtkTile } from "./types.ts";

/**
 * What a tile layer of LDtk becomes: LDtk stacks tiles in a cell, places them
 * off the grid and fades them one by one, none of which a grid of one tile a
 * cell holds. Its tiles are split into grids where they fit one, and lists of
 * placed tiles where they do not, drawn in an order that keeps every tile
 * over the ones LDtk draws it over.
 */

/** tiles that fit a grid: one a cell, on the grid, opaque */
export interface GridChunk {
	kind: "grid";
	/** the first column and row of the cells the tiles cover */
	startx: number;
	starty: number;
	cols: number;
	rows: number;
	/** the tiles */
	tiles: LDtkTile[];
}

/** tiles drawn one by one, in the order of the list */
export interface PlacedChunk {
	kind: "placed";
	tiles: LDtkTile[];
}

export type TileChunk = GridChunk | PlacedChunk;

/** how {@link splitTiles} splits */
export interface SplitOptions {
	/**
	 * how many tiles deep a cell can be before the rest goes to one list
	 * @default 8
	 */
	maxLevels?: number;
	/**
	 * a grid of fewer tiles than this is not worth a layer of its own, and
	 * joins the placed tiles
	 * @default 32
	 */
	minGridTiles?: number;
	/**
	 * the largest tile id a grid's cell can hold
	 * @default 65534
	 */
	maxTileId?: number;
}

/**
 * Split the tiles of a layer, given in the order LDtk draws them, into
 * chunks to draw one after the other.
 *
 * Every tile is given a depth: one more than the deepest tile drawn before it
 * on any cell it touches. Two tiles of one depth never overlap, so a depth is
 * drawn in any order: its tiles that sit on the grid, opaque, at the size of
 * a cell go to a grid, the others to a list. Depths are drawn in turn.
 * @param tiles - the tiles, in the order LDtk draws them
 * @param gridSize - the size of the layer's cells, in pixels
 * @param cols - the layer's width, in cells
 * @param rows - the layer's height, in cells
 * @param tileSize - the size of the tileset's tiles, in pixels
 * @param options - how to split
 * @returns the chunks, in the order to draw them
 */
export function splitTiles(
	tiles: LDtkTile[],
	gridSize: number,
	cols: number,
	rows: number,
	tileSize: number,
	options: SplitOptions = {},
): TileChunk[] {
	const maxLevels = options.maxLevels ?? 8;
	const minGridTiles = options.minGridTiles ?? 32;
	const maxTileId = options.maxTileId ?? 0xfffe;
	// a tile fits a cell only at the cell's size: a grid draws a larger one
	// from the bottom of its cell, LDtk from the top
	const sameSize = tileSize === gridSize;

	// how deep each cell is so far; the last one stands for everything
	// outside the layer
	const outside = cols * rows;
	const depth = new Uint16Array(outside + 1);

	const grids: LDtkTile[][] = [];
	const lists: LDtkTile[][] = [];
	// past the deepest level kept apart: one list, in LDtk's order
	const overflow: LDtkTile[] = [];

	for (const tile of tiles) {
		const x = tile.px[0];
		const y = tile.px[1];
		const c0 = Math.floor(x / gridSize);
		const r0 = Math.floor(y / gridSize);
		const c1 = Math.floor((x + tileSize - 1) / gridSize);
		const r1 = Math.floor((y + tileSize - 1) / gridSize);
		const inside = c0 >= 0 && r0 >= 0 && c1 < cols && r1 < rows;

		// the deepest tile already on a cell this one touches
		let level = 0;
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				const cell =
					c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : outside;
				level = Math.max(level, depth[cell]);
			}
		}
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				const cell =
					c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : outside;
				depth[cell] = level + 1;
			}
		}

		if (level >= maxLevels) {
			overflow.push(tile);
			continue;
		}
		while (grids.length <= level) {
			grids.push([]);
			lists.push([]);
		}
		const fitsGrid =
			sameSize &&
			inside &&
			x === c0 * gridSize &&
			y === r0 * gridSize &&
			(tile.a ?? 1) >= 1 &&
			tile.t <= maxTileId;
		(fitsGrid ? grids : lists)[level].push(tile);
	}

	const chunks: TileChunk[] = [];
	const place = (placed: LDtkTile[]) => {
		if (placed.length === 0) {
			return;
		}
		const last = chunks.at(-1);
		if (last?.kind === "placed") {
			// two lists in a row are one
			for (const tile of placed) {
				last.tiles.push(tile);
			}
		} else {
			chunks.push({ kind: "placed", tiles: placed.slice() });
		}
	};
	for (let level = 0; level < grids.length; level++) {
		const grid = grids[level];
		if (grid.length >= minGridTiles) {
			let minC = cols;
			let minR = rows;
			let maxC = 0;
			let maxR = 0;
			for (const tile of grid) {
				const c = tile.px[0] / gridSize;
				const r = tile.px[1] / gridSize;
				minC = Math.min(minC, c);
				minR = Math.min(minR, r);
				maxC = Math.max(maxC, c);
				maxR = Math.max(maxR, r);
			}
			chunks.push({
				kind: "grid",
				startx: minC,
				starty: minR,
				cols: maxC - minC + 1,
				rows: maxR - minR + 1,
				tiles: grid,
			});
		} else {
			place(grid);
		}
		place(lists[level]);
	}
	place(overflow);
	return chunks;
}
