/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { save, type TextureAtlas } from "melonjs";

/** global game data, shared by the screens and the entities */
export const gameState = {
	score: 0,
	lives: 2,
	// hearts, 2 at most
	energy: 1,
	// eggs Alex can spit
	eggs: 0,
	// index of the current level in LEVELS
	level: 0,

	// pickups in the current level, for the level complete screen
	stars: 0,
	cherries: 0,

	// the sprites, converted from the original game data
	atlas: undefined as unknown as TextureAtlas,

	// remembered between sessions (in localStorage)
	saved: undefined as unknown as { maxLevel: number; hiscore: number },

	/** reset everything for a new game */
	reset(level = 0) {
		this.score = 0;
		this.lives = 2;
		this.energy = 1;
		this.eggs = 0;
		this.level = level;
	},

	/** remember the furthest level reached and the best score */
	record() {
		this.saved.maxLevel = Math.max(this.saved.maxLevel, this.level);
		this.saved.hiscore = Math.max(this.saved.hiscore, this.score);
	},
};

export function initSaveData() {
	gameState.saved = save.add({ maxLevel: 0, hiscore: 0 });
}
