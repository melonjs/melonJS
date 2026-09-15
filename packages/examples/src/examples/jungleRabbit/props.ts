/**
 * melonJS — Jungle Rabbit: the shared palette every model samples.
 *
 * The scenery is authored in a modelling tool and preloaded as glTF, but the
 * colour is not baked into a drawn texture. Every model shares one material
 * whose image is this strip — one pixel per shade — and each vertex's UV points
 * at the centre of a cell. That way a single merged mesh can be green *and*
 * brown *and* pink in one draw call, with nothing to bleed under
 * `textureFilter: "nearest"`.
 *
 * The models carry the same strip embedded, so the two must agree: change a
 * colour here and the assets need re-exporting against it.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/** palette cells, in order; a model's UVs index into these */
const PALETTE = [
	"#5ab84f", // 0 frond, lit
	"#358c3f", // 1 frond, shaded
	"#8a6136", // 2 palm trunk
	"#4f8f3a", // 3 moss — wet river stone, and the base of every trunk
	"#9aa6ae", // 4 stone light
	"#6f7c86", // 5 stone dark
	"#f08a2c", // 6 carrot
	"#4fae55", // 7 carrot top
	"#f7e8d2", // 8  fur, lit
	"#e2cdae", // 9  fur, shaded
	"#f2a6bd", // 10 ear lining, and the paler bloom
	"#ffffff", // 11 cotton tail
	"#b7793f", // 12 boat, planking
	"#7d4f27", // 13 boat, hull below the waterline
	"#e8595f", // 14 scarf
	"#5b3a1f", // 15 paddle
	"#6b4a2a", // 16 coconut
	"#7fd04f", // 17 broad leaf, lit
	"#3f9c46", // 18 broad leaf, shaded
	"#e8556f", // 19 flower
];

/** how many cells the strip carries — every model's UVs are baked against it */
export const PALETTE_CELLS = PALETTE.length;

/** the white cell, for geometry that takes its colour from a vertex tint */
export const WHITE_CELL = 11;

/** the palette strip every model samples */
export const bakePalette = () => {
	const canvas = document.createElement("canvas");
	canvas.width = PALETTE.length;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (ctx !== null) {
		PALETTE.forEach((color, i) => {
			ctx.fillStyle = color;
			ctx.fillRect(i, 0, 1, 1);
		});
	}
	return canvas;
};

/** raw geometry, ready for the `Mesh` constructor */
export interface Geometry {
	vertices: Float32Array;
	uvs: Float32Array;
	normals: Float32Array;
	/** 16- or 32-bit, whichever the source glTF used for its index buffer */
	indices: Uint16Array | Uint32Array;
}
