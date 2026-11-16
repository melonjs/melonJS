/**
 * melonJS — Slingshot: the towers of wood and stone.
 *
 * Every block is a box with a dynamic `Box3d` body, so the towers topple and
 * tumble in three dimensions when a pet hits them.
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

// how deep every block is, along Z
const BLOCK_DEPTH = 70;

/**
 * Build the towers into the world.
 * @param world - the game world
 * @returns where the rivals sit, one per tower floor
 */
export const buildTowers = (world: World): Perch[] => {
	// one block, its centre at (x, y), at depth z
	const block = (
		x: number,
		y: number,
		w: number,
		h: number,
		material: typeof WOOD | typeof STONE,
		z: number,
	) => {
		const box = createBox(w, h, BLOCK_DEPTH, material);
		box.pos.set(x, y);
		box.bodyDef = {
			type: "dynamic",
			shapes: [new Box3d(0, 0, 0, w, h, BLOCK_DEPTH)],
			// stone is over three times as heavy as wood
			density: material === WOOD ? 0.6 : 2,
			friction: 0.7,
		};
		world.addChild(box, z);
	};

	// a two-storey wooden tower: posts, a plank, smaller posts, a plank
	const tower = (x: number, z: number): Perch[] => {
		block(x - 60, -65, 22, 130, WOOD, z);
		block(x + 60, -65, 22, 130, WOOD, z);
		block(x, -141, 180, 22, WOOD, z);
		block(x - 45, -202, 20, 100, WOOD, z);
		block(x + 45, -202, 20, 100, WOOD, z);
		block(x, -263, 140, 22, WOOD, z);
		return [
			{ x, y: -152 - RIVAL_SIZE / 2, z },
			{ x, y: -274 - RIVAL_SIZE / 2, z },
		];
	};

	// two stone columns with a wooden lintel
	const gate = (x: number, z: number): Perch[] => {
		for (const side of [-55, 55]) {
			for (let i = 0; i < 3; i++) {
				block(x + side, -30 - i * 60, 60, 60, STONE, z);
			}
		}
		block(x, -191, 200, 22, WOOD, z);
		return [{ x, y: -202 - RIVAL_SIZE / 2, z }];
	};

	return [...tower(180, 10), ...gate(470, -15), ...tower(720, 20)];
};
