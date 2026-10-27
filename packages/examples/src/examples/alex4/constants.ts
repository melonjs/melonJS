/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */

/** the screen: the original 160x120 at 4x, widened to about 16:9 */
export const WIDTH = 832;
export const HEIGHT = 480;
/** where the menus, laid out for the original 640 pixels, start */
export const INSET = (WIDTH - 640) / 2;

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

/** the level is won by killing its guardian (map `win` property) */
export const WIN_KILL_GUARDIAN = 2;

/** the four colors of the original palette, darkest first */
export const PALETTE = ["#0c4400", "#507d44", "#99b689", "#deeed2"];

/** fade color used between screens */
export const FADE_COLOR = "#dfedd2";
