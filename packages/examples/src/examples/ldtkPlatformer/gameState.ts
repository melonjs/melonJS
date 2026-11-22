/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { LDtkLevelInfo } from "melonjs";

/** what the game remembers while the rooms of the world come and go */
export const gameState = {
	/** the items taken, by their unique id in LDtk: not built again */
	taken: new Set<string>(),
	/** what was collected, by item type */
	bag: new Map<string, number>(),
	/** the world depth the player is on: rooms of another depth are out */
	depth: 0,
	/** the room the player is in */
	room: undefined as LDtkLevelInfo | undefined,
	/** the rooms the player has been in */
	visited: new Set<string>(),
};
