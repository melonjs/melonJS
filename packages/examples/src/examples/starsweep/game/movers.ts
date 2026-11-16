/**
 * melonJS — Starsweep: things that walk the board, cell to cell.
 *
 * Bolt and the walking monsters are always between a cell they step from
 * and a cell they step to, part of the way along. The helpers here start,
 * finish and run those steps, and say where on the screen a walker is, so
 * Bolt and the monsters move by the same code.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math } from "melonjs";
import { centreX, centreY, STAND_LIFT } from "../config/layout";
import { type Cell, type Dir, DX, DY } from "../rules/board";

/** something that walks the board, one cell at a time */
export interface Mover {
	/** the cell it steps from (where it stands, when still) */
	fromX: number;
	fromY: number;
	/** the cell it steps to (the same as `from`, when still) */
	toX: number;
	toY: number;
	/** how far along the step it is: 0 at `from`, 1 at `to` */
	t: number;
	/** whether it is between two cells */
	moving: boolean;
	/** the way it steps, or last stepped */
	dir: Dir;
}

/**
 * A mover standing still on a cell, facing down.
 * @param cell - where it stands
 * @returns the mover's fields
 */
export const standingOn = (cell: Cell): Mover => ({
	fromX: cell.x,
	fromY: cell.y,
	toX: cell.x,
	toY: cell.y,
	t: 0,
	moving: false,
	dir: 2,
});

/** where a mover stands across the screen, part way along its step */
export const moverX = (m: Mover) => centreX(math.lerp(m.fromX, m.toX, m.t));
/** where a mover stands down the screen, part way along its step */
export const moverY = (m: Mover) =>
	centreY(math.lerp(m.fromY, m.toY, m.t)) - STAND_LIFT;

/** the cell a mover is mostly on: where it steps from, until half way */
export const nearestCell = (m: Mover): Cell =>
	m.t < 0.5 ? { x: m.fromX, y: m.fromY } : { x: m.toX, y: m.toY };

/** start a step from where the mover stands, towards `d` */
export const beginStep = (m: Mover, d: Dir) => {
	m.fromX = m.toX;
	m.fromY = m.toY;
	m.toX += DX[d];
	m.toY += DY[d];
	m.t = 0;
	m.moving = true;
	m.dir = d;
};

/** finish a step: the mover stands on the cell it stepped to */
export const land = (m: Mover) => {
	m.fromX = m.toX;
	m.fromY = m.toY;
	m.t = 0;
	m.moving = false;
};

/** how a mover goes on, for {@link walk} */
export interface Walk {
	/** cells per second, for the step under way */
	speed: () => number;
	/** start the next step when standing still; false to stay put */
	next: () => boolean;
	/** it reached a cell: land it, and set off what that cell does */
	arrive: () => void;
	/** whether it may keep walking (not knocked out, not falling, …) */
	going: () => boolean;
}

/**
 * Walk a mover on for `time` seconds: as many steps, and parts of steps,
 * as fit, so a fast walker on a slow frame still covers the right ground.
 * @param m - the mover
 * @param time - seconds to walk for
 * @param how - its speed, and what it does at each cell
 */
export const walk = (m: Mover, time: number, how: Walk) => {
	let left = time;
	while (left > 0 && how.going()) {
		if (!m.moving && !how.next()) {
			return;
		}
		const speed = how.speed();
		const need = (1 - m.t) / speed;
		if (left < need) {
			m.t += left * speed;
			return;
		}
		left -= need;
		how.arrive();
	}
};
