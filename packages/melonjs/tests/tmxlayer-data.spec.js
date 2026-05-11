import { beforeAll, describe, expect, it } from "vitest";
import { boot, TMXTileMap, video } from "../src/index.js";
import {
	TMX_CLEAR_BIT_MASK,
	TMX_FLIP_AD,
	TMX_FLIP_H,
	TMX_FLIP_V,
} from "../src/level/tiled/constants.js";
import Tile from "../src/level/tiled/TMXTile.js";
import { imgList } from "../src/loader/cache.js";

// flip-mask bit layout in layerData's G channel (mirrors TMXLayer.js)
const FLIP_H_BIT = 1 << 0;
const FLIP_V_BIT = 1 << 1;
const FLIP_AD_BIT = 1 << 2;

function fakeImage(name, w = 64, h = 64) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	imgList[name] = canvas;
	return canvas;
}

const tilesetData = {
	firstgid: 1,
	name: "testtiles",
	tilewidth: 32,
	tileheight: 32,
	spacing: 0,
	margin: 0,
	tilecount: 4,
	columns: 2,
	image: "testtiles.png",
};

// 4 cols x 3 rows = 12 cells, with a mix of empty (0) and populated cells
function buildMapJSON(data) {
	return {
		width: 4,
		height: 3,
		tilewidth: 32,
		tileheight: 32,
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		version: "1.10",
		tiledversion: "1.12.0",
		tilesets: [tilesetData],
		layers: [
			{
				type: "tilelayer",
				name: "Background",
				width: 4,
				height: 3,
				data,
				visible: true,
				opacity: 1,
			},
		],
	};
}

function makeLayer(data) {
	const map = new TMXTileMap("test", buildMapJSON(data));
	const groups = map.getLayers();
	return groups[0];
}

const ALL_ZERO_4x3 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

describe("TMXLayer.layerData (Uint16Array refactor)", () => {
	beforeAll(() => {
		boot();
		video.init(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		fakeImage("testtiles", 64, 64);
	});

	describe("Allocation & shape", () => {
		it("layerData is a Uint16Array (not a 2D Array)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.layerData).toBeInstanceOf(Uint16Array);
			expect(Array.isArray(layer.layerData)).toBe(false);
		});

		it("layerData.length === cols * rows * 2 exactly", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.layerData.length).toBe(layer.cols * layer.rows * 2);
			expect(layer.layerData.length).toBe(4 * 3 * 2);
			expect(layer.layerData.length).toBe(24);
		});

		it("all-zero map fills layerData with zeros (empty cells)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			for (let i = 0; i < layer.layerData.length; i++) {
				expect(layer.layerData[i]).toBe(0);
			}
		});

		it("cachedTile starts as null (lazy-allocated on first cellAt call)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.cachedTile).toBe(null);
		});

		it("cachedTile is allocated on first cellAt call that hits a populated cell", () => {
			const data = [...ALL_ZERO_4x3];
			data[5] = 1;
			const layer = makeLayer(data);
			expect(layer.cachedTile).toBe(null);
			layer.cellAt(1, 1, false);
			expect(Array.isArray(layer.cachedTile)).toBe(true);
			expect(layer.cachedTile.length).toBe(layer.cols * layer.rows);
		});

		it("cachedTile stays null if cellAt only hits empty cells", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			layer.cellAt(0, 0, false);
			layer.cellAt(2, 1, false);
			expect(layer.cachedTile).toBe(null);
		});

		it("setTile does NOT allocate cachedTile (renderer hot loop bypasses)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1, layer.tileset);
			layer.setTile(tile, 1, 1);
			expect(layer.cachedTile).toBe(null);
		});

		it("clearTile does NOT allocate cachedTile", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);
			layer.clearTile(0, 0);
			expect(layer.cachedTile).toBe(null);
		});

		it("dataVersion starts at 0", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.dataVersion).toBe(0);
		});

		it("row-major layout: cell (x, y) lives at layerData[(y * cols + x) * 2]", () => {
			// place a unique GID at (3, 2) — the last cell of a 4x3 map
			const data = [...ALL_ZERO_4x3];
			data[2 * 4 + 3] = 1; // y=2, x=3 → flat input idx 11 → GID=1
			const layer = makeLayer(data);
			const expectedIdx = (2 * layer.cols + 3) * 2; // = 22
			expect(layer.layerData[expectedIdx]).toBe(1);
			expect(layer.layerData[expectedIdx + 1]).toBe(0);
		});
	});

	describe("Round-trip every flip combination", () => {
		// 8 combinations of (H, V, AD)
		const cases = [
			[false, false, false, 0],
			[true, false, false, FLIP_H_BIT],
			[false, true, false, FLIP_V_BIT],
			[false, false, true, FLIP_AD_BIT],
			[true, true, false, FLIP_H_BIT | FLIP_V_BIT],
			[true, false, true, FLIP_H_BIT | FLIP_AD_BIT],
			[false, true, true, FLIP_V_BIT | FLIP_AD_BIT],
			[true, true, true, FLIP_H_BIT | FLIP_V_BIT | FLIP_AD_BIT],
		];

		for (const [flipH, flipV, flipAD, expectedMask] of cases) {
			const label = `H=${flipH} V=${flipV} AD=${flipAD}`;
			it(`encodes/decodes flip mask correctly: ${label}`, () => {
				const layer = makeLayer(ALL_ZERO_4x3);
				const tileset = layer.tileset;
				const gid =
					1 |
					(flipH ? TMX_FLIP_H : 0) |
					(flipV ? TMX_FLIP_V : 0) |
					(flipAD ? TMX_FLIP_AD : 0);
				const tile = new Tile(0, 0, gid, tileset);
				layer.setTile(tile, 1, 1);

				// raw byte assertion — the encoding contract
				const idx = (1 * layer.cols + 1) * 2;
				expect(layer.layerData[idx]).toBe(1);
				expect(layer.layerData[idx + 1]).toBe(expectedMask);

				// round-trip through cellAt — returns a view rebuilt from
				// layerData bytes (not necessarily the same object as `tile`)
				const got = layer.cellAt(1, 1, false);
				expect(got).not.toBeNull();
				expect(got.tileId).toBe(1);
				expect(got.flippedX).toBe(flipH);
				expect(got.flippedY).toBe(flipV);
				expect(got.flippedAD).toBe(flipAD);
				expect(got.flipped).toBe(flipH || flipV || flipAD);

				// flipped tiles get a currentTransform; unflipped don't
				if (flipH || flipV || flipAD) {
					expect(got.currentTransform).not.toBeNull();
				} else {
					expect(got.currentTransform).toBeNull();
				}
			});

			it(`reconstitutes a Tile from raw bytes correctly (no cache hit): ${label}`, () => {
				// write raw bytes into layerData without going through setTile,
				// so cachedTile stays null and cellAt rebuilds from the bytes
				const layer = makeLayer(ALL_ZERO_4x3);
				const idx = (2 * layer.cols + 0) * 2;
				layer.layerData[idx] = 3; // tileId = 3
				layer.layerData[idx + 1] = expectedMask;

				const got = layer.cellAt(0, 2, false);
				expect(got).not.toBeNull();
				expect(got.tileId).toBe(3);
				expect(got.flippedX).toBe(flipH);
				expect(got.flippedY).toBe(flipV);
				expect(got.flippedAD).toBe(flipAD);
				expect(got.col).toBe(0);
				expect(got.row).toBe(2);
			});

			it(`parser path: legacy GID with flip bits decodes correctly: ${label}`, () => {
				const legacyGid =
					2 |
					(flipH ? TMX_FLIP_H : 0) |
					(flipV ? TMX_FLIP_V : 0) |
					(flipAD ? TMX_FLIP_AD : 0);
				// Tiled normalizes the upper bits into a signed-int; data arrays
				// commonly hold these as unsigned 32-bit values (we just pass through)
				const data = [...ALL_ZERO_4x3];
				data[0] = legacyGid >>> 0; // unsigned form
				const layer = makeLayer(data);

				expect(layer.layerData[0]).toBe(2);
				expect(layer.layerData[1]).toBe(expectedMask);

				const got = layer.cellAt(0, 0, false);
				expect(got.tileId).toBe(2);
				expect(got.flippedX).toBe(flipH);
				expect(got.flippedY).toBe(flipV);
				expect(got.flippedAD).toBe(flipAD);
			});
		}
	});

	describe("GID range adversarial", () => {
		it("GID = 1 (minimum non-empty) works end-to-end", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);
			expect(layer.layerData[0]).toBe(1);
			expect(layer.cellAt(0, 0, false).tileId).toBe(1);
		});

		it("GID = 0 stays an empty cell (cellAt returns null)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.cellAt(0, 0, false)).toBeNull();
			expect(layer.cellAt(3, 2, false)).toBeNull();
			expect(layer.layerData[0]).toBe(0);
		});

		it("GID with all flip bits set is correctly masked at parse time", () => {
			// raw Tiled GID = 4 with all 3 flip bits set
			const legacyGid = (4 | TMX_FLIP_H | TMX_FLIP_V | TMX_FLIP_AD) >>> 0;
			const data = [...ALL_ZERO_4x3];
			data[5] = legacyGid;
			const layer = makeLayer(data);
			const idx = (1 * layer.cols + 1) * 2;
			expect(layer.layerData[idx]).toBe(4); // gid channel: flip bits stripped
			expect(layer.layerData[idx + 1]).toBe(
				FLIP_H_BIT | FLIP_V_BIT | FLIP_AD_BIT,
			); // flip channel only
		});

		it("flip bits never leak into the GID channel", () => {
			// every entry of layerData[idx] (the GID slots) must satisfy
			// (value & flipMaskOfGid) === 0 — i.e. flip bits never appear in GID
			const data = [...ALL_ZERO_4x3];
			for (let i = 0; i < data.length; i++) {
				const flipPattern = (i & 1 ? TMX_FLIP_H : 0) | (i & 2 ? TMX_FLIP_V : 0);
				data[i] = ((i + 1) | flipPattern) >>> 0;
			}
			const layer = makeLayer(data);
			// every GID slot must fit in 16 bits with no flip bits leaked
			for (let i = 0; i < layer.layerData.length; i += 2) {
				expect(layer.layerData[i] & TMX_CLEAR_BIT_MASK).toBe(
					layer.layerData[i],
				);
				expect(layer.layerData[i] >= 0 && layer.layerData[i] <= 0xffff).toBe(
					true,
				);
			}
		});
	});

	describe("Empty / cleared cell semantics", () => {
		it("fresh layer: every cell returns null via cellAt", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			for (let y = 0; y < layer.rows; y++) {
				for (let x = 0; x < layer.cols; x++) {
					expect(layer.cellAt(x, y, false)).toBeNull();
				}
			}
		});

		it("fresh layer: getTileId returns null for every cell", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.getTileId(0, 0)).toBeNull();
			expect(layer.getTileId(50, 50)).toBeNull();
		});

		it("clearTile after setTile zeros both channels", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1 | TMX_FLIP_H, layer.tileset);
			layer.setTile(tile, 2, 1);
			const idx = (1 * layer.cols + 2) * 2;
			expect(layer.layerData[idx]).toBe(1);
			expect(layer.layerData[idx + 1]).toBe(FLIP_H_BIT);

			layer.clearTile(2, 1);
			expect(layer.layerData[idx]).toBe(0);
			expect(layer.layerData[idx + 1]).toBe(0);
			expect(layer.cellAt(2, 1, false)).toBeNull();
			expect(layer.getTileId(2 * 32, 1 * 32)).toBeNull();
		});

		it("clearTile invalidates cachedTile slot when cache is allocated", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);
			// trigger lazy alloc + populate the slot
			const tile = layer.cellAt(0, 0, false);
			expect(layer.cachedTile[0]).toBe(tile);
			// clearing should null the slot
			layer.clearTile(0, 0);
			expect(layer.cachedTile[0]).toBeNull();
		});

		it("empty-cell guard: cellAt never returns a Tile with tileId === 0", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			// directly write a 0 to a slot then read it
			const idx = (1 * layer.cols + 1) * 2;
			layer.layerData[idx] = 0;
			layer.layerData[idx + 1] = 0;
			expect(layer.cellAt(1, 1, false)).toBeNull();
		});
	});

	describe("Identity stability via cachedTile", () => {
		it("repeated cellAt for the same cell returns the SAME Tile object", () => {
			const data = [...ALL_ZERO_4x3];
			data[5] = 2;
			const layer = makeLayer(data);
			const a = layer.cellAt(1, 1, false);
			const b = layer.cellAt(1, 1, false);
			expect(a).not.toBeNull();
			expect(a).toBe(b); // strict identity equality
		});

		it("cellAt for distinct populated cells returns distinct Tiles", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			data[1] = 2;
			const layer = makeLayer(data);
			const a = layer.cellAt(0, 0, false);
			const b = layer.cellAt(1, 0, false);
			expect(a).not.toBe(b);
		});

		it("setTile invalidates the cache: next cellAt returns the new tile's data", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile1 = new Tile(0, 0, 1, layer.tileset);
			const tile2 = new Tile(0, 0, 2, layer.tileset);

			layer.setTile(tile1, 0, 0);
			// trigger cache allocation by calling cellAt
			const got1 = layer.cellAt(0, 0, false);
			expect(got1.tileId).toBe(1);

			// overwriting should null the cached view; next cellAt rebuilds
			layer.setTile(tile2, 0, 0);
			const got2 = layer.cellAt(0, 0, false);
			expect(got2.tileId).toBe(2);
			expect(got2).not.toBe(got1);
		});

		it("clearTile then setTile produces a fresh view (no resurrection)", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);
			const got1 = layer.cellAt(0, 0, false);
			layer.clearTile(0, 0);
			expect(layer.cellAt(0, 0, false)).toBeNull();
			// re-populate the cell
			const tile2 = new Tile(0, 0, 2, layer.tileset);
			layer.setTile(tile2, 0, 0);
			const got2 = layer.cellAt(0, 0, false);
			expect(got2.tileId).toBe(2);
			expect(got2).not.toBe(got1);
		});

		it("isometricRpg-style usage: stable identity across pointerMove calls", () => {
			// regression for examples/isometricRpg/play.ts line 49:
			//   if (tile && tile !== this.currentTile) { ... }
			const data = [...ALL_ZERO_4x3];
			data[6] = 3;
			const layer = makeLayer(data);
			const tile1 = layer.cellAt(2, 1, false);
			const tile2 = layer.cellAt(2, 1, false);
			const tile3 = layer.cellAt(2, 1, false);
			expect(tile1).toBe(tile2);
			expect(tile2).toBe(tile3);
		});
	});

	describe("dataVersion", () => {
		it("initial value is 0", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.dataVersion).toBe(0);
		});

		it("setTile increments dataVersion by exactly 1", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1, layer.tileset);
			layer.setTile(tile, 0, 0);
			expect(layer.dataVersion).toBe(1);
			layer.setTile(tile, 0, 1);
			expect(layer.dataVersion).toBe(2);
		});

		it("clearTile increments dataVersion by exactly 1", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1, layer.tileset);
			layer.setTile(tile, 0, 0);
			expect(layer.dataVersion).toBe(1);
			layer.clearTile(0, 0);
			expect(layer.dataVersion).toBe(2);
		});

		it("cellAt does NOT bump dataVersion", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);
			const v0 = layer.dataVersion;
			layer.cellAt(0, 0, false);
			layer.cellAt(0, 0, false); // cached
			layer.cellAt(1, 0, false); // empty
			expect(layer.dataVersion).toBe(v0);
		});

		it("getTile / getTileId do NOT bump dataVersion", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);
			const v0 = layer.dataVersion;
			layer.getTile(0, 0);
			layer.getTileId(0, 0);
			expect(layer.dataVersion).toBe(v0);
		});

		it("after N mutations dataVersion === N (monotone)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1, layer.tileset);
			for (let i = 1; i <= 10; i++) {
				layer.setTile(tile, i % layer.cols, Math.floor(i / layer.cols));
				expect(layer.dataVersion).toBe(i);
			}
		});
	});

	describe("Bounds & coordinate edge cases", () => {
		it("cellAt with boundsCheck on rejects negative coords", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.cellAt(-1, 0)).toBeNull();
			expect(layer.cellAt(0, -1)).toBeNull();
		});

		it("cellAt with boundsCheck on rejects out-of-range coords", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.cellAt(layer.cols, 0)).toBeNull();
			expect(layer.cellAt(0, layer.rows)).toBeNull();
			expect(layer.cellAt(100, 100)).toBeNull();
		});

		it("cellAt truncates fractional coordinates via ~~", () => {
			const data = [...ALL_ZERO_4x3];
			data[5] = 1; // y=1, x=1
			const layer = makeLayer(data);
			const a = layer.cellAt(1, 1, false);
			const b = layer.cellAt(1.9, 1.9, false);
			const c = layer.cellAt(1.0001, 1.99999, false);
			expect(a).toBe(b);
			expect(b).toBe(c);
		});

		it("cellAt with NaN coordinates resolves to (0, 0)", () => {
			// ~~NaN === 0
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);
			expect(layer.cellAt(Number.NaN, Number.NaN, false)).toBe(
				layer.cellAt(0, 0, false),
			);
		});

		it("getTile in world coords outside the layer returns null", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			expect(layer.getTile(-1, 0)).toBeNull();
			expect(layer.getTile(layer.width + 1, 0)).toBeNull();
		});
	});

	describe("setTile / clearTile bounds validation", () => {
		it("setTile at out-of-bounds coords is a no-op (does not allocate cachedTile or mutate layerData)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1, layer.tileset);

			layer.setTile(tile, -1, 0);
			layer.setTile(tile, 0, -1);
			layer.setTile(tile, layer.cols, 0);
			layer.setTile(tile, 0, layer.rows);
			layer.setTile(tile, 100, 100);

			expect(layer.cachedTile).toBe(null); // no allocation triggered
			expect(layer.dataVersion).toBe(0); // no successful writes
			for (let i = 0; i < layer.layerData.length; i++) {
				expect(layer.layerData[i]).toBe(0);
			}
		});

		it("setTile at out-of-bounds returns the tile unchanged (preserves return contract)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1, layer.tileset);
			expect(layer.setTile(tile, -1, 0)).toBe(tile);
			expect(layer.setTile(tile, 100, 100)).toBe(tile);
		});

		it("clearTile at out-of-bounds coords is a no-op (does not allocate cachedTile or mutate layerData)", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			const layer = makeLayer(data);

			layer.clearTile(-1, 0);
			layer.clearTile(0, -1);
			layer.clearTile(layer.cols, 0);
			layer.clearTile(0, layer.rows);
			layer.clearTile(100, 100);

			expect(layer.cachedTile).toBe(null); // no allocation triggered
			expect(layer.dataVersion).toBe(0); // no successful clears
			// the populated cell at (0, 0) is untouched
			expect(layer.layerData[0]).toBe(1);
		});

		it("setTile bounds check rejects exactly on the edge (cols, rows)", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1, layer.tileset);
			// cols=4, rows=3 — these specific indices must be rejected
			layer.setTile(tile, 4, 0);
			layer.setTile(tile, 0, 3);
			expect(layer.dataVersion).toBe(0);
			// but cols-1, rows-1 are valid
			layer.setTile(tile, 3, 2);
			expect(layer.dataVersion).toBe(1);
		});
	});

	describe("Cross-cell isolation", () => {
		it("setTile at one cell does not mutate any other layerData byte", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const snapshot = new Uint16Array(layer.layerData);
			const tile = new Tile(0, 0, 1 | TMX_FLIP_H, layer.tileset);
			layer.setTile(tile, 1, 1);
			const idx = (1 * layer.cols + 1) * 2;
			for (let i = 0; i < layer.layerData.length; i++) {
				if (i === idx || i === idx + 1) {
					continue;
				}
				expect(layer.layerData[i]).toBe(snapshot[i]);
			}
		});

		it("clearTile at one cell does not mutate any other cachedTile slot", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			data[5] = 2;
			data[11] = 3;
			const layer = makeLayer(data);
			const t1 = layer.cellAt(0, 0, false);
			const t2 = layer.cellAt(1, 1, false);
			const t3 = layer.cellAt(3, 2, false);
			// cache is now allocated and populated for these three cells
			expect(layer.cachedTile).not.toBeNull();

			layer.clearTile(1, 1);
			expect(layer.cachedTile[0]).toBe(t1);
			expect(layer.cachedTile[1 * 4 + 1]).toBeNull();
			expect(layer.cachedTile[2 * 4 + 3]).toBe(t3);
			expect(t2).not.toBeNull(); // local ref still valid
		});
	});

	describe("Parser path (setLayerData)", () => {
		it("decodes a mix of empty + populated + flipped cells correctly", () => {
			const data = [
				1,
				0,
				2,
				0,
				0,
				(3 | TMX_FLIP_H) >>> 0,
				0,
				0,
				4,
				0,
				0,
				(1 | TMX_FLIP_V | TMX_FLIP_AD) >>> 0,
			];
			const layer = makeLayer(data);

			// (0, 0) = gid 1, no flip
			expect(layer.layerData[0]).toBe(1);
			expect(layer.layerData[1]).toBe(0);

			// (2, 0) = gid 2, no flip
			expect(layer.layerData[4]).toBe(2);
			expect(layer.layerData[5]).toBe(0);

			// (1, 1) = gid 3, flipped H
			expect(layer.layerData[(1 * 4 + 1) * 2]).toBe(3);
			expect(layer.layerData[(1 * 4 + 1) * 2 + 1]).toBe(FLIP_H_BIT);

			// (0, 2) = gid 4
			expect(layer.layerData[(2 * 4 + 0) * 2]).toBe(4);
			expect(layer.layerData[(2 * 4 + 0) * 2 + 1]).toBe(0);

			// (3, 2) = gid 1, flipped V + AD
			expect(layer.layerData[(2 * 4 + 3) * 2]).toBe(1);
			expect(layer.layerData[(2 * 4 + 3) * 2 + 1]).toBe(
				FLIP_V_BIT | FLIP_AD_BIT,
			);

			// empty cells stay zero
			expect(layer.layerData[2]).toBe(0); // (1, 0) gid
			expect(layer.layerData[3]).toBe(0); // (1, 0) flip
		});

		it("setLayerData allocates ZERO TMXTile objects during parse", () => {
			// spy on Tile constructor — track call count across the parse
			let constructorCalls = 0;
			const origInit = Tile.prototype.setMinMax;
			// setMinMax is called from Tile's constructor — instrument it
			Tile.prototype.setMinMax = function (...args) {
				constructorCalls++;
				return origInit.apply(this, args);
			};
			try {
				// dense data — half cells filled
				const data = [1, 2, 3, 4, 1, 0, 3, 0, 0, 2, 0, 4];
				makeLayer(data);
				expect(constructorCalls).toBe(0);
			} finally {
				Tile.prototype.setMinMax = origInit;
			}
		});

		it("does not allocate cachedTile during parse", () => {
			const data = [1, 2, 3, 4, 1, 0, 3, 0, 0, 2, 0, 4];
			const layer = makeLayer(data);
			expect(layer.cachedTile).toBe(null);
		});
	});

	describe("Tile.col / Tile.row consistency", () => {
		it("cellAt(x, y) returns a Tile with col === x and row === y", () => {
			const data = [...ALL_ZERO_4x3];
			data[0] = 1;
			data[2 * 4 + 3] = 2; // (3, 2)
			const layer = makeLayer(data);

			const a = layer.cellAt(0, 0, false);
			expect(a.col).toBe(0);
			expect(a.row).toBe(0);

			const b = layer.cellAt(3, 2, false);
			expect(b.col).toBe(3);
			expect(b.row).toBe(2);
		});
	});

	describe("Hot-path encoding round-trip stress", () => {
		it("dense map with mixed GIDs + all flip combinations round-trips byte-for-byte", () => {
			// build a 4x3 map where every cell exercises a different combination
			const flipPatterns = [
				0,
				TMX_FLIP_H,
				TMX_FLIP_V,
				TMX_FLIP_AD,
				TMX_FLIP_H | TMX_FLIP_V,
				TMX_FLIP_H | TMX_FLIP_AD,
				TMX_FLIP_V | TMX_FLIP_AD,
				TMX_FLIP_H | TMX_FLIP_V | TMX_FLIP_AD,
				0,
				TMX_FLIP_H,
				TMX_FLIP_V,
				TMX_FLIP_AD,
			];
			const data = [];
			for (let i = 0; i < 12; i++) {
				const gid = (i % 4) + 1; // GIDs 1..4
				data.push((gid | flipPatterns[i]) >>> 0);
			}

			const layer = makeLayer(data);

			// verify every cell decodes correctly via cellAt
			for (let y = 0; y < 3; y++) {
				for (let x = 0; x < 4; x++) {
					const i = y * 4 + x;
					const expectedGid = (i % 4) + 1;
					const flip = flipPatterns[i];
					const expectedH = (flip & TMX_FLIP_H) !== 0;
					const expectedV = (flip & TMX_FLIP_V) !== 0;
					const expectedAD = (flip & TMX_FLIP_AD) !== 0;

					const t = layer.cellAt(x, y, false);
					expect(t).not.toBeNull();
					expect(t.tileId).toBe(expectedGid);
					expect(t.flippedX).toBe(expectedH);
					expect(t.flippedY).toBe(expectedV);
					expect(t.flippedAD).toBe(expectedAD);
				}
			}
		});
	});

	describe("setTile / clearTile parity with cellAt", () => {
		it("setTile writes the same encoding the parser would produce", () => {
			// build two layers: one via parser, one via setTile after the fact
			const data = [...ALL_ZERO_4x3];
			data[0] = (2 | TMX_FLIP_H | TMX_FLIP_AD) >>> 0;
			const parsed = makeLayer(data);

			const built = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(
				0,
				0,
				(2 | TMX_FLIP_H | TMX_FLIP_AD) >>> 0,
				built.tileset,
			);
			built.setTile(tile, 0, 0);

			// raw layerData should match byte-for-byte
			expect(built.layerData[0]).toBe(parsed.layerData[0]);
			expect(built.layerData[1]).toBe(parsed.layerData[1]);
		});

		it("repeated setTile/clearTile cycles leave layerData in a clean state", () => {
			const layer = makeLayer(ALL_ZERO_4x3);
			const tile = new Tile(0, 0, 1 | TMX_FLIP_V, layer.tileset);

			for (let i = 0; i < 5; i++) {
				layer.setTile(tile, 2, 1);
				layer.clearTile(2, 1);
			}
			const idx = (1 * layer.cols + 2) * 2;
			expect(layer.layerData[idx]).toBe(0);
			expect(layer.layerData[idx + 1]).toBe(0);
			expect(layer.cellAt(2, 1, false)).toBeNull();
		});
	});
});
