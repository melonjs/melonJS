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

/**
 * The original game moved things 50 times a second, at a quarter of our
 * scale: one of its pixels per tick is this many of ours per frame.
 */
export const TICK = 4 * (50 / 60);
/**
 * The speed up, in our pixels per frame, for a vertical speed of the original
 * (in quarter pixels per tick, with a gravity of 1): the one that reaches the
 * same height with our gravity. The original moved by `dy >> 2` on each tick,
 * so its jumps went up `ceil(d / 4)` pixels per step: -16, Alex's jump, is
 * 40 of its pixels high, 160 of ours, for a speed of 18.2.
 */
export function jumpSpeed(dy: number) {
	let height = 0;
	for (let d = 1; d <= dy; d++) {
		height += Math.ceil(d / 4);
	}
	// our gravity moves a body by its speed after each step: the height of a
	// jump at v is v * v / 2g - v / 2
	const g = 0.98;
	return (g + Math.sqrt(g * g + 8 * g * height * 4)) / 2;
}
/** its gravity for the bullets, in pixels per tick: 0.1, as a gravity scale */
export const BULLET_GRAVITY = (0.1 * TICK * (50 / 60)) / 0.98;

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

/** temporary, for testing: every level can be picked from the menu */
export const ALL_LEVELS_UNLOCKED = true;

/** the level is won by killing its guardian (map `win` property) */
export const WIN_KILL_GUARDIAN = 2;

/** the four colors of the original palette, darkest first */
export const PALETTE = ["#0c4400", "#507d44", "#99b689", "#deeed2"];

/** fade color used between screens */
export const FADE_COLOR = "#dfedd2";
