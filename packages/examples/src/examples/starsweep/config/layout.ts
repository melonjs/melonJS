/**
 * melonJS — Starsweep: where things are on the screen.
 *
 * The screen's size, where the board sits on it, and the conversions from
 * a board cell to screen pixels that the field, the monsters and the
 * effects all use.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { COLS, ROWS } from "../rules/board";

/** the screen, portrait 9:16, so it fills a phone held upright */
export const WIDTH = 576;
export const HEIGHT = 1024;

/** a board cell's size, in pixels */
export const TILE = 48;

/** the board's top left corner on the screen, centred across */
export const OX = (WIDTH - COLS * TILE) / 2;
export const OY = 118;
/** where the board ends and the touch controls' zone begins */
export const BOARD_BOTTOM = OY + ROWS * TILE;

/**
 * How far above its cell's centre a character stands, so its feet sit on
 * the panel's face rather than on its front edge.
 */
export const STAND_LIFT = 4;

/** the colour behind everything, before the sky is drawn */
export const BACKGROUND = "#0b0a24";

/**
 * a cell's centre across the screen; a fractional column is part way to
 * the next cell
 */
export const centreX = (col: number) => OX + col * TILE + TILE / 2;
/** a cell's centre down the screen; a fractional row is part way */
export const centreY = (row: number) => OY + row * TILE + TILE / 2;

/**
 * Where a character stands on a cell: its centre, lifted by
 * {@link STAND_LIFT}.
 * @param x - the column
 * @param y - the row
 * @returns the point, in pixels
 */
export const standOn = (x: number, y: number) => ({
	x: centreX(x),
	y: centreY(y) - STAND_LIFT,
});

/**
 * The cell under a point on the screen, where a character standing there
 * is (so its lift is undone first).
 * @param x - in pixels
 * @param y - in pixels
 * @returns the column and row, which can be off the board
 */
export const cellUnder = (x: number, y: number) => ({
	x: Math.floor((x - OX) / TILE),
	y: Math.floor((y + STAND_LIFT - OY) / TILE),
});

/**
 * the order in the actors layer, back to front: power-ups on the panels,
 * then Bolt, its shield, the monsters, and the sparks flying over them
 */
export const ACTOR_Z = {
	powerUp: 0,
	bolt: 1,
	shield: 2,
	monster: 3,
	spark: 4,
} as const;

/**
 * How far from its centre each thing touches others, in pixels: the engine
 * finds two touching when their circles meet, so a monster catches Bolt
 * 0.62 of a cell away, a spark pops a monster 0.55 away, and Bolt picks a
 * power-up up 0.5 away.
 */
export const REACH = {
	bolt: TILE * 0.31,
	monster: TILE * 0.31,
	spark: TILE * 0.24,
	powerUp: TILE * 0.19,
} as const;
