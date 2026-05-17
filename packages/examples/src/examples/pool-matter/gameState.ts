/**
 * melonJS — Pool (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Shared mutable state for the pool example. The play screen, HUD, and
 * entities all read/write through this object — keeps cross-entity
 * coordination simple without dragging in a state-management library.
 */
export const gameState = {
	/** total score: 1 per solid/striped pocketed, 8 ends the game */
	score: 0,
	/** how many object balls remain on the table (7 solids + 7 stripes + 1 eight-ball = 15) */
	ballsRemaining: 15,
	/** true while the cue ball is being aimed (mouse down on cue) */
	aiming: false,
	/** start position (world coords) of the current drag-to-aim */
	aimStartX: 0,
	aimStartY: 0,
	/** current pointer position during drag-to-aim */
	aimCurrentX: 0,
	aimCurrentY: 0,
	/** true once the 8-ball has been sunk */
	gameOver: false,
};
