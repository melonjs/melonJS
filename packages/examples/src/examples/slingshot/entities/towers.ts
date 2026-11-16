/**
 * melonJS — Slingshot: the towers of wood and stone.
 *
 * Every block is a box with a dynamic `Box3d` body. The towers are built in
 * three dimensions, floors of four posts under a slab, so they topple and
 * tumble in depth as well as sideways when a pet hits them.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Box3d, type World } from "melonjs";
import { RIVAL_SIZE, STONE, WOOD } from "../constants";
import { createBox } from "../meshes/box";

/** a place on a tower where a rival sits */
export interface Perch {
	x: number;
	y: number;
	z: number;
}

// a wooden floor: four posts at the corners, under a slab
const POST = 20;
const POST_HEIGHT = 130;
const SLAB = 20;
// how far out from the middle the posts stand, across and in depth
const POST_SPREAD_X = 66;
const POST_SPREAD_Z = 46;
// the slab overhangs the posts a little
const SLAB_WIDTH = 2 * POST_SPREAD_X + POST + 24;
const SLAB_DEPTH = 2 * POST_SPREAD_Z + POST + 24;

/**
 * Build the towers into the world.
 * @param world - the game world
 * @returns where the rivals sit
 */
export const buildTowers = (world: World): Perch[] => {
	// one block: its centre at (x, y), `w` × `h` × `d`, at depth z
	const block = (
		x: number,
		y: number,
		z: number,
		w: number,
		h: number,
		d: number,
		material: typeof WOOD | typeof STONE,
	) => {
		const box = createBox(w, h, d, material);
		box.pos.set(x, y);
		box.bodyDef = {
			type: "dynamic",
			shapes: [new Box3d(0, 0, 0, w, h, d)],
			// stone is over three times as heavy as wood
			density: material === WOOD ? 0.6 : 2,
			friction: 0.7,
		};
		world.addChild(box, z);
	};

	/**
	 * A wooden tower, `floors` storeys high, standing on `base` (y of the
	 * surface under it). A rival sits on every slab.
	 * @param x - its middle, across
	 * @param z - its middle, in depth
	 * @param floors - how many storeys
	 * @param base - the height it stands on
	 * @returns the perches on its slabs
	 */
	const tower = (x: number, z: number, floors: number, base = 0): Perch[] => {
		const perches: Perch[] = [];
		let floor = base;
		for (let i = 0; i < floors; i++) {
			for (const sx of [-POST_SPREAD_X, POST_SPREAD_X]) {
				for (const sz of [-POST_SPREAD_Z, POST_SPREAD_Z]) {
					block(
						x + sx,
						floor - POST_HEIGHT / 2,
						z + sz,
						POST,
						POST_HEIGHT,
						POST,
						WOOD,
					);
				}
			}
			const slabTop = floor - POST_HEIGHT - SLAB;
			block(x, slabTop + SLAB / 2, z, SLAB_WIDTH, SLAB, SLAB_DEPTH, WOOD);
			perches.push({ x, y: slabTop - RIVAL_SIZE / 2, z });
			floor = slabTop;
		}
		return perches;
	};

	/**
	 * A stone keep: four columns of stone blocks under a stone lintel, and a
	 * two-storey wooden tower on top, a rival on the lintel inside it.
	 * @param x - its middle, across
	 * @param z - its middle, in depth
	 * @returns the perches on the lintel and on the tower
	 */
	const keep = (x: number, z: number): Perch[] => {
		const stone = 60;
		const courses = 3;
		for (const sx of [-90, 90]) {
			for (const sz of [-60, 60]) {
				for (let i = 0; i < courses; i++) {
					block(
						x + sx,
						-stone / 2 - i * stone,
						z + sz,
						stone,
						stone,
						stone,
						STONE,
					);
				}
			}
		}
		const lintel = 26;
		const lintelTop = -courses * stone - lintel;
		block(x, lintelTop + lintel / 2, z, 260, lintel, 190, STONE);
		return [
			// on the lintel, between the posts of the tower above (not on the
			// ground: landing there knocks a rival out)
			{ x, y: lintelTop - RIVAL_SIZE / 2, z },
			...tower(x, z, 2, lintelTop),
		];
	};

	// three structures, set apart in depth too, so that the view from behind
	// the slingshot sees all of them; a rival on some floors, not every one
	const left = tower(160, -70, 3);
	const right = tower(760, 60, 4);
	return [left[1], left[2], ...keep(450, -10), right[1], right[3]];
};
