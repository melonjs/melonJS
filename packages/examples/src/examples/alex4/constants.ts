/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */

/**
 * The game logic runs in the original 160x120 pixel space (16x16 tiles) and
 * everything is drawn 4 times bigger, on a 640x480 canvas
 */
export const SCALE = 4;
export const SCREEN_W = 160;
export const SCREEN_H = 120;
export const TILE = 16;
/** playable rows of a map (the 8th row of the Tiled maps sits under the HUD) */
export const MAP_ROWS = 7;

/** the original game logic ran at a fixed 50 ticks per second */
export const TICK_MS = 20;

/** the four Game Boy-ish colors of the original palette */
export const PALETTE = ["#0c4400", "#507d44", "#99b689", "#deeed2"];

/** the level files, in play order */
export const LEVELS = [
	"a4_level1",
	"a4_level2",
	"a4_level3",
	"a4_level4",
	"a4_level5",
	"a4_level6",
	"a4_level7",
	"a4_level8",
	"a4_level9",
	"a4_level10",
	"a4_level11",
	"a4_level12",
];

/** win conditions, as stored in the map `win` property */
export const WIN_EXIT = 1;
export const WIN_KILL_GUARDIAN = 2;
export const WIN_KILL_ALL = 4;
