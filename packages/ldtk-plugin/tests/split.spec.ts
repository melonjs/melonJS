import { describe, expect, it } from "vitest";
import type { LDtkProjectJson, LDtkTile } from "../src/index.ts";
import { splitTiles, type TileChunk } from "../src/split.ts";
import { SAMPLES, sampleURL } from "./helpers/harness.ts";

/**
 * A tile layer of LDtk split into grids and lists of placed tiles: whatever
 * the tiles, every one of them has to come out once, a grid has to hold what
 * a grid can, and a tile LDtk draws over another has to be drawn after it.
 */
const tile = (x: number, y: number, t = 1, f = 0, a = 1): LDtkTile => {
	return { px: [x, y], src: [0, 0], f, t, a };
};

/**
 * what a split has to hold, whatever the tiles
 * @param tiles - the tiles, in LDtk's order
 * @param chunks - what they were split into
 * @param gridSize - the size of the layer's cells
 * @param tileSize - the size of the tileset's tiles
 */
const expectSound = (
	tiles: LDtkTile[],
	chunks: TileChunk[],
	gridSize: number,
	tileSize: number,
) => {
	// when each tile is drawn
	const order = new Map<LDtkTile, number>();
	let step = 0;
	for (const chunk of chunks) {
		if (chunk.kind === "grid") {
			const cells = new Set<string>();
			for (const t of chunk.tiles) {
				// on the grid, opaque, at the size of a cell, one a cell,
				// within the cells the chunk says it covers
				expect(t.px[0] % gridSize).toBe(0);
				expect(t.px[1] % gridSize).toBe(0);
				expect(t.a ?? 1).toBe(1);
				expect(tileSize).toBe(gridSize);
				const col = t.px[0] / gridSize;
				const row = t.px[1] / gridSize;
				expect(col).toBeGreaterThanOrEqual(chunk.startx);
				expect(col).toBeLessThan(chunk.startx + chunk.cols);
				expect(row).toBeGreaterThanOrEqual(chunk.starty);
				expect(row).toBeLessThan(chunk.starty + chunk.rows);
				const cell = `${String(col)},${String(row)}`;
				expect(cells.has(cell), `two tiles in cell ${cell}`).toBe(false);
				cells.add(cell);
				expect(order.has(t)).toBe(false);
				// a grid's tiles are drawn at once
				order.set(t, step);
			}
			step++;
		} else {
			expect(chunk.tiles.length).toBeGreaterThan(0);
			for (const t of chunk.tiles) {
				expect(order.has(t)).toBe(false);
				order.set(t, step++);
			}
		}
	}
	// every tile, once
	expect(order.size).toBe(tiles.length);

	// a tile that overlaps an earlier one is drawn after it: checked cell by
	// cell, against the last tile drawn on each pixel-cell it touches
	const overlap = (a: LDtkTile, b: LDtkTile) => {
		return (
			a.px[0] < b.px[0] + tileSize &&
			b.px[0] < a.px[0] + tileSize &&
			a.px[1] < b.px[1] + tileSize &&
			b.px[1] < a.px[1] + tileSize
		);
	};
	const buckets = new Map<string, LDtkTile[]>();
	for (const t of tiles) {
		const c0 = Math.floor(t.px[0] / tileSize);
		const r0 = Math.floor(t.px[1] / tileSize);
		for (let r = r0; r <= r0 + 1; r++) {
			for (let c = c0; c <= c0 + 1; c++) {
				const key = `${String(c)},${String(r)}`;
				const earlier = buckets.get(key) ?? [];
				for (const other of earlier) {
					if (other !== t && overlap(other, t)) {
						expect(
							order.get(t) as number,
							`a tile at ${t.px.join(", ")} over one at ${other.px.join(", ")}`,
						).toBeGreaterThan(order.get(other) as number);
					}
				}
				earlier.push(t);
				buckets.set(key, earlier);
			}
		}
	}
};

describe("splitting the tiles of an LDtk layer", () => {
	it("no tile, no chunk", () => {
		expect(splitTiles([], 16, 10, 10, 16)).toEqual([]);
	});

	it("one tile a cell, on the grid: one grid, over the cells the tiles cover", () => {
		const tiles: LDtkTile[] = [];
		for (let row = 3; row < 9; row++) {
			for (let col = 2; col < 12; col++) {
				tiles.push(tile(col * 16, row * 16, col + row));
			}
		}
		const chunks = splitTiles(tiles, 16, 20, 20, 16);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatchObject({
			kind: "grid",
			startx: 2,
			starty: 3,
			cols: 10,
			rows: 6,
		});
		expect(chunks[0].tiles).toHaveLength(60);
		expectSound(tiles, chunks, 16, 16);
	});

	it("a handful of tiles is not worth a grid: one list", () => {
		const tiles = [tile(0, 0), tile(16, 0), tile(32, 16)];
		const chunks = splitTiles(tiles, 16, 10, 10, 16);
		expect(chunks).toEqual([{ kind: "placed", tiles }]);
		// unless asked
		expect(
			splitTiles(tiles, 16, 10, 10, 16, { minGridTiles: 1 }),
		).toMatchObject([{ kind: "grid", startx: 0, starty: 0, cols: 3, rows: 2 }]);
	});

	it("tiles stacked in a cell: a grid a depth, in LDtk's order", () => {
		const base: LDtkTile[] = [];
		const over: LDtkTile[] = [];
		for (let i = 0; i < 40; i++) {
			base.push(tile(i * 16, 0, 1));
			over.push(tile(i * 16, 0, 2));
		}
		// LDtk saves the stack cell by cell
		const tiles = base.flatMap((t, i) => {
			return [t, over[i]];
		});
		const chunks = splitTiles(tiles, 16, 40, 1, 16);
		expect(chunks.map((c) => c.kind)).toEqual(["grid", "grid"]);
		expect(chunks[0].tiles).toEqual(base);
		expect(chunks[1].tiles).toEqual(over);
		expectSound(tiles, chunks, 16, 16);
	});

	it("a tile off the grid, a faded one, a tile id too large for a cell: placed, not in a grid", () => {
		const grid: LDtkTile[] = [];
		for (let i = 0; i < 40; i++) {
			grid.push(tile(i * 16, 0));
		}
		const off = tile(8, 40);
		const faded = tile(32, 64, 1, 0, 0.5);
		const large = tile(64, 64, 70000);
		const tiles = [...grid, off, faded, large];
		const chunks = splitTiles(tiles, 16, 40, 10, 16);
		expect(chunks.map((c) => c.kind)).toEqual(["grid", "placed"]);
		expect(chunks[0].tiles).toEqual(grid);
		expect(chunks[1].tiles).toEqual([off, faded, large]);
		expectSound(tiles, chunks, 16, 16);
	});

	it("a tileset of another tile size than the cells: nothing fits a grid", () => {
		const tiles: LDtkTile[] = [];
		for (let i = 0; i < 50; i++) {
			tiles.push(tile(i * 8, 0));
		}
		const chunks = splitTiles(tiles, 8, 60, 4, 16);
		expect(chunks.every((c) => c.kind === "placed")).toBe(true);
		expectSound(tiles, chunks, 8, 16);
	});

	it("a tile off the grid over grid tiles is drawn after them, and a grid tile over it after it", () => {
		const under: LDtkTile[] = [];
		const top: LDtkTile[] = [];
		for (let i = 0; i < 40; i++) {
			under.push(tile(i * 16, 0, 1));
			top.push(tile(i * 16, 0, 3));
		}
		// straddles the first two cells, between the two grids
		const between = tile(8, 0, 2);
		const tiles = [...under, between, ...top];
		const chunks = splitTiles(tiles, 16, 40, 1, 16);
		expectSound(tiles, chunks, 16, 16);
		// the two top tiles over it are a depth above the others
		const kinds = chunks.map((c) => c.kind);
		expect(kinds[0]).toBe("grid");
		expect(chunks[0].tiles).toEqual(under);
	});

	it("tiles past the layer's edges are kept, and drawn in order", () => {
		const tiles = [
			tile(-16, 0, 1),
			tile(-16, 0, 2),
			tile(160, 160, 3),
			tile(-8, -8, 4),
		];
		const chunks = splitTiles(tiles, 16, 10, 10, 16, { minGridTiles: 1 });
		expect(chunks.every((c) => c.kind === "placed")).toBe(true);
		expectSound(tiles, chunks, 16, 16);
		expect(chunks.flatMap((c) => c.tiles)).toHaveLength(4);
	});

	it("a cell deeper than the depths kept apart: the rest in one list, in LDtk's order", () => {
		const tiles: LDtkTile[] = [];
		for (let depth = 0; depth < 12; depth++) {
			for (let i = 0; i < 40; i++) {
				tiles.push(tile(i * 16, 0, depth));
			}
		}
		const chunks = splitTiles(tiles, 16, 40, 1, 16, { maxLevels: 4 });
		expect(chunks.map((c) => c.kind)).toEqual([
			"grid",
			"grid",
			"grid",
			"grid",
			"placed",
		]);
		expect(chunks[4].tiles).toEqual(tiles.slice(160));
		expectSound(tiles, chunks, 16, 16);
	});

	it("random tiles, stacked, off the grid and faded: sound whatever they are", () => {
		let seed = 987654321;
		const random = (n: number) => {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
			return (seed >>> 8) % n;
		};
		for (let round = 0; round < 30; round++) {
			const tiles: LDtkTile[] = [];
			const count = 50 + random(400);
			for (let i = 0; i < count; i++) {
				const onGrid = random(4) !== 0;
				tiles.push(
					tile(
						onGrid ? random(20) * 16 : random(330) - 8,
						onGrid ? random(15) * 16 : random(250) - 8,
						random(200),
						random(4),
						random(8) === 0 ? 0.5 : 1,
					),
				);
			}
			const options = {
				maxLevels: 1 + random(8),
				minGridTiles: random(40),
			};
			expectSound(tiles, splitTiles(tiles, 16, 20, 15, 16, options), 16, 16);
		}
	});

	it("every tile layer of the LDtk samples: sound, and mostly grids", async () => {
		let total = 0;
		let inGrids = 0;
		let layers = 0;
		for (const sample of SAMPLES) {
			const response = await fetch(sampleURL(`${sample}.ldtk`));
			const project = (await response.json()) as LDtkProjectJson;
			for (const level of project.levels) {
				for (const layer of level.layerInstances ?? []) {
					const tiles =
						layer.__type === "Tiles" ? layer.gridTiles : layer.autoLayerTiles;
					const tileset = project.defs.tilesets.find((def) => {
						return def.uid === layer.__tilesetDefUid;
					});
					if (tiles.length === 0 || tileset === undefined) {
						continue;
					}
					const chunks = splitTiles(
						tiles,
						layer.__gridSize,
						layer.__cWid,
						layer.__cHei,
						tileset.tileGridSize,
					);
					expectSound(tiles, chunks, layer.__gridSize, tileset.tileGridSize);
					layers++;
					total += tiles.length;
					for (const chunk of chunks) {
						if (chunk.kind === "grid") {
							inGrids += chunk.tiles.length;
						}
					}
				}
			}
		}
		expect(layers).toBeGreaterThan(100);
		expect(total).toBeGreaterThan(49000);
		// the point of the split: what can be a grid is one
		expect(inGrids / total).toBeGreaterThan(0.8);
	});
});
