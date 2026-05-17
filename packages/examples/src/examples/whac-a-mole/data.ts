/**
 * melonJS — Whac-A-Mole mini-game example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
// Add an index signature to the 'data' object
interface Data {
	[key: string]: number;
}

/**
 * local game data
 */
export const data: Data = {
	// score information
	score: 0 as number,
	hiscore: 0 as number,
};
