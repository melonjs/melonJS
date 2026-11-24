/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Application } from "melonjs";
import { sounds } from "../effects/sounds";
import { gameState } from "../gameState";
import { ldtkWorld } from "./world";

/** how far around the player's room the world keeps its neighbours, in pixels */
const REACH = 1;

/**
 * Follow the player from room to room. A room is a level of the LDtk world:
 * when the player enters another one, the camera is held to it, and the
 * world keeps that room and the ones touching it, on the player's depth.
 * @param app - the application
 * @param x - where the player is, in the world
 * @param y - where the player is, in the world
 * @returns false when the player is in no room
 */
export function trackRoom(app: Application, x: number, y: number): boolean {
	const world = ldtkWorld();
	const rooms = world.levelsAt(x, y, 0, 0, gameState.depth);
	if (rooms.length === 0) {
		return false;
	}
	// on the edge two rooms share, the player stays in the one it is in
	if (gameState.room !== undefined && rooms.includes(gameState.room)) {
		return true;
	}

	const room = rooms[0];
	gameState.room = room;
	if (!gameState.visited.has(room.identifier)) {
		gameState.visited.add(room.identifier);
		sounds.discover();
	}
	app.viewport.setBounds(room.x, room.y, room.width, room.height);
	// The room and the ones it touches stay in the game. The others leave,
	// with their walls and their objects, and so do the rooms of another
	// depth, which cover the same place.
	world.streamAround(
		room.x,
		room.y,
		room.width,
		room.height,
		REACH,
		gameState.depth,
	);
	return true;
}

/**
 * What the player's room is made of at a point: the name LDtk gives the
 * value of the room's "Collisions" IntGrid layer there, "walls" or "water".
 * The walls are solid bodies already; the layer is read here for what a
 * body does not tell (the water, and what a ladder goes through).
 * @param x - the point, in the world
 * @param y - the point, in the world
 * @returns the value's name, or undefined where the layer is empty
 */
export function groundAt(x: number, y: number): string | undefined {
	const room = gameState.room;
	if (room === undefined) {
		return undefined;
	}
	const grid = ldtkWorld().getIntGrid(room.identifier, "Collisions");
	return grid?.names.get(grid.valueAtPixel(x, y));
}
