/**
 * melonJS — Slingshot: the field the game is played on.
 *
 * The sun and the sky light, the backdrop all round, the ground, and the
 * stone deck the slingshot stands on, with the next pets waiting on it.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Box3d, Light3d, type Mesh, type World } from "melonjs";
import {
	AXIS_Y,
	DECK_TOP,
	FIELD_DEPTH,
	FIELD_WIDTH,
	GRASS,
	GROUND_Y,
	PETS,
	POUCH,
	QUEUE_GAP,
	STONE,
} from "../constants";
import { createBackdrop } from "../meshes/backdrop";
import { createBox } from "../meshes/box";

// tall enough that a wall's top edge stays above the view
const WALL_HEIGHT = 4200;
// the picture's horizon is this far down it, and meets the ground
const HORIZON = 0.55;

/**
 * Build the field into the world.
 * @param world - the game world
 * @returns the ground, which a rival is knocked out by landing on
 */
export const buildField = (world: World): Mesh => {
	// the sky above the backdrop, in the colour of its top edge
	world.backgroundColor.setColor(135, 206, 235);

	world.addChild(
		new Light3d({
			type: "directional",
			direction: [-0.5, 0.8, 0.35],
			color: "#fff4e6",
			intensity: 1.1,
		}),
	);
	world.addChild(
		new Light3d({ type: "ambient", color: "#8fa3c2", intensity: 0.75 }),
	);

	// one backdrop wall per side, so the camera finds trees whichever way it
	// turns
	for (const [x, z, width, turn] of [
		[0, FIELD_DEPTH, FIELD_WIDTH * 2, 0],
		[0, -FIELD_DEPTH, FIELD_WIDTH * 2, 0],
		[-FIELD_WIDTH, 0, FIELD_DEPTH * 2, Math.PI / 2],
		[FIELD_WIDTH, 0, FIELD_DEPTH * 2, Math.PI / 2],
	]) {
		const wall = createBackdrop(width, WALL_HEIGHT);
		wall.pos.set(x, WALL_HEIGHT * (0.5 - HORIZON));
		if (turn !== 0) {
			wall.rotate(turn, AXIS_Y);
		}
		world.addChild(wall, z);
	}

	// the ground: a thick static slab, its top at y = 0
	const ground = createBox(FIELD_WIDTH * 2, 40, FIELD_DEPTH * 2, GRASS);
	ground.pos.set(0, GROUND_Y + 20);
	ground.castGroundShadow = false;
	ground.bodyDef = {
		type: "static",
		shapes: [new Box3d(0, 0, 0, FIELD_WIDTH * 2, 40, FIELD_DEPTH * 2)],
		friction: 0.8,
	};
	world.addChild(ground, 0);

	// the deck: a raised stone platform, long enough for every pet in line
	const left = POUCH.x - 70 - QUEUE_GAP * (PETS.length - 1) - 40;
	const right = POUCH.x + 60;
	const width = right - left;
	const deck = createBox(width, -DECK_TOP, 120, STONE);
	deck.pos.set((left + right) / 2, DECK_TOP / 2);
	deck.bodyDef = {
		type: "static",
		shapes: [new Box3d(0, 0, 0, width, -DECK_TOP, 120)],
		friction: 0.8,
	};
	world.addChild(deck, 0);

	return ground;
};
