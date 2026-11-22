/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, type LDtkWorld, level } from "melonjs";
import { gameState } from "./gameState";

/** the world, as the level director holds it once it is loaded */
export const ldtkWorld = () => {
	return level.getCurrentLevel() as unknown as LDtkWorld;
};

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
	gameState.visited.add(room.identifier);
	app.viewport.setBounds(room.x, room.y, room.width, room.height);
	// the room and the ones it touches: the others leave, with their walls
	// and their entities, and so do the rooms of another depth
	world.streamAround(
		room.x,
		room.y,
		room.width,
		room.height,
		1,
		gameState.depth,
	);
	return true;
}
