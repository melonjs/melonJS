import { beforeAll, describe, expect, it } from "vitest";
import { boot, TMXTileMap, video } from "../src/index.js";
import {
	TMX_FLIP_AD,
	TMX_FLIP_H,
	TMX_FLIP_V,
} from "../src/level/tiled/constants.js";
import Tile, { buildFlipTransform } from "../src/level/tiled/TMXTile.js";
import { imgList } from "../src/loader/cache.js";
import { Matrix2d } from "../src/math/matrix2d.ts";

// flip-mask bit layout (mirrors TMXLayer / TMXTile)
const FLIP_H_BIT = 1 << 0;
const FLIP_V_BIT = 1 << 1;
const FLIP_AD_BIT = 1 << 2;

function paintGradientCanvas(name, w, h, colors) {
	// build a canvas with distinct colored tile cells so we can detect
	// flips / wrong tile selection by reading pixels
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	// 2x2 grid of distinct flat colors for a 2-column tileset
	const cellW = w / 2;
	const cellH = h / 2;
	for (let i = 0; i < colors.length; i++) {
		const col = i % 2;
		const row = Math.floor(i / 2);
		ctx.fillStyle = colors[i];
		ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
	}
	imgList[name] = canvas;
	return canvas;
}

const tilesetData = {
	firstgid: 1,
	name: "rawtest",
	tilewidth: 32,
	tileheight: 32,
	spacing: 0,
	margin: 0,
	tilecount: 4,
	columns: 2,
	image: "rawtest.png",
};

function buildOrthogonalMap(data, cols = 4, rows = 3) {
	return {
		width: cols,
		height: rows,
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
				width: cols,
				height: rows,
				data,
				visible: true,
				opacity: 1,
			},
		],
	};
}

function makeOrthogonalLayer(data, cols = 4, rows = 3) {
	const map = new TMXTileMap("rawtest", buildOrthogonalMap(data, cols, rows));
	return map.getLayers()[0];
}

// minimal renderer mock that records every drawImage call — sufficient to
// detect tileset selection, source-rect lookup, and destination position
function makeRecordingRenderer() {
	const calls = [];
	const transformStack = [];
	let current = { tx: 0, ty: 0 };
	return {
		uvOffset: 0,
		drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
			calls.push({
				image,
				sx,
				sy,
				sw,
				sh,
				dx: dx + current.tx,
				dy: dy + current.ty,
				dw,
				dh,
			});
		},
		save() {
			transformStack.push({ tx: current.tx, ty: current.ty });
		},
		restore() {
			current = transformStack.pop() ?? { tx: 0, ty: 0 };
		},
		translate(x, y) {
			current.tx += x;
			current.ty += y;
		},
		transform() {
			// the orientation-renderer flips multiply the matrix into the
			// renderer's transform stack; we don't need to model the matrix
			// in detail for this test — we already verify the math separately
		},
		__calls: () => {
			return calls;
		},
	};
}

describe("Tile rendering raw path (drawTileRaw)", () => {
	beforeAll(() => {
		boot();
		video.init(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		paintGradientCanvas("rawtest", 64, 64, [
			"#ff0000",
			"#00ff00",
			"#0000ff",
			"#ffff00",
		]);
	});

	describe("buildFlipTransform helper", () => {
		// Matrix2d.val is column-major: [a, c, e, b, d, f, 0, 0, 1]
		// For a pure axis-aligned scale-around-center transform, expected (a, d)
		// components must match. Translate components (e, f) should sum to 0
		// after the round-trip.
		const cases = [
			[0, "identity", { a: 1, d: 1 }],
			[FLIP_H_BIT, "H", { a: -1, d: 1 }],
			[FLIP_V_BIT, "V", { a: 1, d: -1 }],
			[FLIP_H_BIT | FLIP_V_BIT, "H+V", { a: -1, d: -1 }],
		];

		for (const [mask, label, expected] of cases) {
			it(`builds matrix for flipMask=${label}`, () => {
				const m = new Matrix2d();
				buildFlipTransform(m, mask, 32, 32);
				// val layout: val[0]=a, val[3]=b, val[1]=c, val[4]=d, val[2]=e, val[5]=f
				expect(Math.round(m.val[0] * 1e6) / 1e6).toBe(expected.a);
				expect(Math.round(m.val[4] * 1e6) / 1e6).toBe(expected.d);
			});
		}

		it("AD-flipped matrix has non-zero off-diagonal terms (rotation present)", () => {
			const m = new Matrix2d();
			buildFlipTransform(m, FLIP_AD_BIT, 32, 32);
			// AD flip = rotate(-90) + scale(-1, 1) — off-diagonal terms must be non-zero
			expect(Math.abs(m.val[3]) + Math.abs(m.val[1])).toBeGreaterThan(0.5);
		});

		it("matches Tile.setTileTransform output on the legacy path", () => {
			const layer = makeOrthogonalLayer([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
			for (const flipBits of [
				0,
				TMX_FLIP_H,
				TMX_FLIP_V,
				TMX_FLIP_AD,
				TMX_FLIP_H | TMX_FLIP_V,
				TMX_FLIP_H | TMX_FLIP_AD,
				TMX_FLIP_V | TMX_FLIP_AD,
				TMX_FLIP_H | TMX_FLIP_V | TMX_FLIP_AD,
			]) {
				const tile = new Tile(0, 0, (1 | flipBits) >>> 0, layer.tileset);

				const fromFlags = new Matrix2d();
				tile.setTileTransform(fromFlags);

				const fromMask = new Matrix2d();
				const flipMask =
					(tile.flippedX ? FLIP_H_BIT : 0) |
					(tile.flippedY ? FLIP_V_BIT : 0) |
					(tile.flippedAD ? FLIP_AD_BIT : 0);
				buildFlipTransform(fromMask, flipMask, 32, 32);

				// every component of val[] must match (within float precision)
				for (let i = 0; i < 9; i++) {
					expect(fromMask.val[i]).toBeCloseTo(fromFlags.val[i], 5);
				}
			}
		});
	});

	describe("TMXTileset.drawTileRaw", () => {
		it("emits the same source rect + destination as drawTile for a non-flipped tile", () => {
			const layer = makeOrthogonalLayer([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
			const tileset = layer.tileset;
			const rawRenderer = makeRecordingRenderer();
			const oldRenderer = makeRecordingRenderer();

			tileset.drawTileRaw(rawRenderer, 100, 200, 1, 0);
			tileset.drawTile(oldRenderer, 100, 200, new Tile(0, 0, 1, tileset));

			const rawCall = rawRenderer.__calls()[0];
			const oldCall = oldRenderer.__calls()[0];
			expect(rawCall.sx).toBe(oldCall.sx);
			expect(rawCall.sy).toBe(oldCall.sy);
			expect(rawCall.sw).toBe(oldCall.sw);
			expect(rawCall.sh).toBe(oldCall.sh);
			expect(rawCall.dx).toBe(oldCall.dx);
			expect(rawCall.dy).toBe(oldCall.dy);
			expect(rawCall.dw).toBe(oldCall.dw);
			expect(rawCall.dh).toBe(oldCall.dh);
			expect(rawCall.image).toBe(oldCall.image);
		});

		it("selects the correct atlas source rect for each GID", () => {
			const layer = makeOrthogonalLayer([1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]);
			const tileset = layer.tileset;

			for (const gid of [1, 2, 3, 4]) {
				const renderer = makeRecordingRenderer();
				tileset.drawTileRaw(renderer, 0, 0, gid, 0);
				const call = renderer.__calls()[0];
				const expectedOffset = tileset.atlas[tileset.getViewTileId(gid)].offset;
				expect(call.sx).toBe(expectedOffset.x);
				expect(call.sy).toBe(expectedOffset.y);
			}
		});

		it("non-flipped tile produces no save/restore (no transform pass)", () => {
			const layer = makeOrthogonalLayer([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
			const tileset = layer.tileset;
			let saved = 0;
			let restored = 0;
			const renderer = {
				uvOffset: 0,
				drawImage() {},
				save() {
					saved++;
				},
				restore() {
					restored++;
				},
				translate() {},
				transform() {},
			};
			tileset.drawTileRaw(renderer, 0, 0, 1, 0);
			expect(saved).toBe(0);
			expect(restored).toBe(0);
		});

		it("flipped tile wraps drawImage with save/restore", () => {
			const layer = makeOrthogonalLayer([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
			const tileset = layer.tileset;
			let saved = 0;
			let restored = 0;
			const renderer = {
				uvOffset: 0,
				drawImage() {},
				save() {
					saved++;
				},
				restore() {
					restored++;
				},
				translate() {},
				transform() {},
			};
			tileset.drawTileRaw(renderer, 0, 0, 1, FLIP_H_BIT);
			expect(saved).toBe(1);
			expect(restored).toBe(1);
		});

		it("matches drawTile for every flip combination", () => {
			const layer = makeOrthogonalLayer([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
			const tileset = layer.tileset;

			const flipCases = [
				[0, 0],
				[TMX_FLIP_H, FLIP_H_BIT],
				[TMX_FLIP_V, FLIP_V_BIT],
				[TMX_FLIP_AD, FLIP_AD_BIT],
				[TMX_FLIP_H | TMX_FLIP_V, FLIP_H_BIT | FLIP_V_BIT],
				[TMX_FLIP_H | TMX_FLIP_AD, FLIP_H_BIT | FLIP_AD_BIT],
				[TMX_FLIP_V | TMX_FLIP_AD, FLIP_V_BIT | FLIP_AD_BIT],
				[
					TMX_FLIP_H | TMX_FLIP_V | TMX_FLIP_AD,
					FLIP_H_BIT | FLIP_V_BIT | FLIP_AD_BIT,
				],
			];

			for (const [legacyFlips, mask] of flipCases) {
				const rawRenderer = makeRecordingRenderer();
				const oldRenderer = makeRecordingRenderer();

				tileset.drawTileRaw(rawRenderer, 50, 50, 1, mask);
				tileset.drawTile(
					oldRenderer,
					50,
					50,
					new Tile(0, 0, (1 | legacyFlips) >>> 0, tileset),
				);

				const r = rawRenderer.__calls()[0];
				const o = oldRenderer.__calls()[0];
				expect(r.sx).toBe(o.sx);
				expect(r.sy).toBe(o.sy);
				expect(r.dx).toBeCloseTo(o.dx, 6);
				expect(r.dy).toBeCloseTo(o.dy, 6);
				expect(r.dw).toBeCloseTo(o.dw, 6);
				expect(r.dh).toBeCloseTo(o.dh, 6);
			}
		});
	});

	describe("TMXOrthogonalRenderer.drawTileRaw", () => {
		it("matches drawTile for every flip combination", () => {
			const layer = makeOrthogonalLayer([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
			const tmxRenderer = layer.getRenderer();
			const tileset = layer.tileset;

			const cases = [
				[0, 0],
				[TMX_FLIP_H, FLIP_H_BIT],
				[TMX_FLIP_V, FLIP_V_BIT],
				[TMX_FLIP_AD, FLIP_AD_BIT],
			];
			for (const [legacyFlips, mask] of cases) {
				const rawRenderer = makeRecordingRenderer();
				const oldRenderer = makeRecordingRenderer();

				tmxRenderer.drawTileRaw(rawRenderer, 2, 1, 1, mask, tileset);
				tmxRenderer.drawTile(
					oldRenderer,
					2,
					1,
					new Tile(2, 1, (1 | legacyFlips) >>> 0, tileset),
				);

				const r = rawRenderer.__calls()[0];
				const o = oldRenderer.__calls()[0];
				expect(r.dx).toBeCloseTo(o.dx, 6);
				expect(r.dy).toBeCloseTo(o.dy, 6);
				expect(r.sx).toBe(o.sx);
				expect(r.sy).toBe(o.sy);
			}
		});
	});

	describe("drawTileLayer hot loop bypasses Tile construction", () => {
		it("Orthogonal: renders a populated layer without constructing any Tile", () => {
			const data = [1, 2, 3, 4, 0, 1, 0, 2, 3, 0, 4, 0];
			const layer = makeOrthogonalLayer(data);

			let tileConstructorCalls = 0;
			const origSetMinMax = Tile.prototype.setMinMax;
			Tile.prototype.setMinMax = function (...args) {
				tileConstructorCalls++;
				return origSetMinMax.apply(this, args);
			};

			try {
				const renderer = makeRecordingRenderer();
				const rect = {
					pos: { x: 0, y: 0 },
					width: 4 * 32,
					height: 3 * 32,
					right: 4 * 32,
					bottom: 3 * 32,
				};
				layer.getRenderer().drawTileLayer(renderer, layer, rect);
				expect(tileConstructorCalls).toBe(0);
				// every non-zero cell produced a drawImage call (8 cells set in `data`)
				expect(renderer.__calls().length).toBe(8);
			} finally {
				Tile.prototype.setMinMax = origSetMinMax;
			}
		});

		it("Orthogonal: hot loop yields the same drawImage sequence as the legacy drawTile path", () => {
			const data = [
				1,
				(2 | TMX_FLIP_H) >>> 0,
				(3 | TMX_FLIP_V) >>> 0,
				(4 | TMX_FLIP_H | TMX_FLIP_V) >>> 0,
				0,
				1,
				0,
				2,
				3,
				0,
				4,
				0,
			];
			const layerNew = makeOrthogonalLayer(data);
			const layerOld = makeOrthogonalLayer(data);

			const tmxNew = layerNew.getRenderer();
			const tmxOld = layerOld.getRenderer();

			// run the new hot loop
			const newRenderer = makeRecordingRenderer();
			const rect = {
				pos: { x: 0, y: 0 },
				width: 4 * 32,
				height: 3 * 32,
				right: 4 * 32,
				bottom: 3 * 32,
			};
			tmxNew.drawTileLayer(newRenderer, layerNew, rect);

			// emulate the legacy hot loop manually (cellAt → drawTile)
			const oldRenderer = makeRecordingRenderer();
			for (let y = 0; y < 3; y++) {
				for (let x = 0; x < 4; x++) {
					const t = layerOld.cellAt(x, y, false);
					if (t) {
						tmxOld.drawTile(oldRenderer, x, y, t);
					}
				}
			}

			const newCalls = newRenderer.__calls();
			const oldCalls = oldRenderer.__calls();
			expect(newCalls.length).toBe(oldCalls.length);
			for (let i = 0; i < newCalls.length; i++) {
				const n = newCalls[i];
				const o = oldCalls[i];
				expect(n.sx).toBe(o.sx);
				expect(n.sy).toBe(o.sy);
				expect(n.sw).toBe(o.sw);
				expect(n.sh).toBe(o.sh);
				expect(n.dx).toBeCloseTo(o.dx, 6);
				expect(n.dy).toBeCloseTo(o.dy, 6);
				expect(n.dw).toBeCloseTo(o.dw, 6);
				expect(n.dh).toBeCloseTo(o.dh, 6);
				expect(n.image).toBe(o.image);
			}
		});

		it("Orthogonal: empty cells produce no drawImage calls", () => {
			const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			const layer = makeOrthogonalLayer(data);
			const renderer = makeRecordingRenderer();
			const rect = {
				pos: { x: 0, y: 0 },
				width: 4 * 32,
				height: 3 * 32,
				right: 4 * 32,
				bottom: 3 * 32,
			};
			layer.getRenderer().drawTileLayer(renderer, layer, rect);
			expect(renderer.__calls().length).toBe(0);
		});

		it("Orthogonal: tileset short-circuit cache works (single-tileset layer = no per-cell lookup)", () => {
			const data = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
			const layer = makeOrthogonalLayer(data);
			const tilesets = layer.tilesets;

			let lookupCalls = 0;
			const origGetTilesetByGid = tilesets.getTilesetByGid.bind(tilesets);
			tilesets.getTilesetByGid = function (gid) {
				lookupCalls++;
				return origGetTilesetByGid(gid);
			};

			try {
				const renderer = makeRecordingRenderer();
				const rect = {
					pos: { x: 0, y: 0 },
					width: 4 * 32,
					height: 3 * 32,
					right: 4 * 32,
					bottom: 3 * 32,
				};
				layer.getRenderer().drawTileLayer(renderer, layer, rect);
				// all GIDs (1..4) are in the same tileset — short-circuit cache hits, no lookups
				expect(lookupCalls).toBe(0);
				expect(renderer.__calls().length).toBe(12);
			} finally {
				tilesets.getTilesetByGid = origGetTilesetByGid;
			}
		});

		// note: renderorder="left-up" / "right-up" / "left-down" rely on a
		// pre-existing bound-clamping quirk in the orientation renderer (the
		// swap can drive start.x to cols, which is out of layerData range).
		// That behavior is identical before and after this refactor (the old
		// 2D-array path would have thrown TypeError; the new typed-array path
		// reads undefined and skips). Out of scope to fix here.
	});
});
