/**
 * melonJS — Starsweep: the power-ups, coming and going.
 *
 * Every so often a `PowerUp` appears on an open panel away from Bolt, of a
 * kind drawn by the odds below, and goes again if it is not picked up in
 * time. This keeps the ones on the board, and how long the timed ones
 * picked up (freeze, shield, burst) have left; the field decides what
 * picking one up does.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Container, math, utils } from "melonjs";
import { ACTOR_Z } from "../config/layout";
import { type PowerKind, PowerUp } from "../entities/PowerUp";
import { type Cell, COLS, idx, ROWS, Tile } from "../rules/board";
import type { Station } from "../world/Station";

/** the power-ups that last a while, and how long, in seconds */
export const POWER_TIME = {
	freeze: 5,
	shield: 7,
	burst: 9,
	field: 6,
} as const;
/** a power-up that lasts a while */
export type TimedPower = keyof typeof POWER_TIME;

/** seconds between two power-ups, picked between these */
const POWER_EVERY = [9, 14] as const;
/** the fewest steps from Bolt a power-up appears */
const POWER_DISTANCE = 3;
/**
 * How often each kind turns up: out of every 88 power-ups, about 8 are a
 * life, 22 a gem, and so on. A life only turns up when one is missing.
 */
const ODDS: readonly [PowerKind, number][] = [
	["life", 8],
	["gem", 22],
	["freeze", 16],
	["shield", 16],
	["burst", 14],
	["field", 12],
];
/** one entry per chance, so a kind drawn with `utils.array.random` follows the odds */
const DRAW = ODDS.flatMap(([kind, n]) => new Array<PowerKind>(n).fill(kind));
/** the same, without the life */
const DRAW_NO_LIFE = DRAW.filter((kind) => kind !== "life");

/** The power-ups on the board, and the timers of the ones running. */
export class Powers {
	private list: PowerUp[] = [];
	private nextIn = 0;
	/** seconds left on each power-up that lasts (not the force-fields') */
	private readonly left = { freeze: 0, shield: 0, burst: 0 };

	/** @param actors - where the power-ups go, under the characters */
	constructor(private readonly actors: Container) {}

	/** none on the board and none running, for a new level */
	reset() {
		for (const pw of this.list) {
			this.actors.removeChild(pw);
		}
		this.list = [];
		this.nextIn = math.randomFloat(...POWER_EVERY);
		this.left.freeze = this.left.shield = this.left.burst = 0;
	}

	/**
	 * Count down: a new one now and then, old ones going, timers running out.
	 * @param dt - seconds
	 * @param station - the board, for where one may appear
	 * @param bolt - where Bolt is, so they appear away from it
	 * @param wantsLife - whether an extra life may appear
	 */
	update(dt: number, station: Station, bolt: Cell, wantsLife: boolean) {
		this.left.freeze = Math.max(0, this.left.freeze - dt);
		this.left.shield = Math.max(0, this.left.shield - dt);
		this.left.burst = Math.max(0, this.left.burst - dt);
		this.nextIn -= dt;
		if (this.nextIn <= 0) {
			this.nextIn = math.randomFloat(...POWER_EVERY);
			this.spawn(station, bolt, wantsLife);
		}
		for (const pw of this.list) {
			pw.step(dt);
			if (pw.gone) {
				this.take(pw);
			}
		}
	}

	/** start a power-up's timer */
	start(kind: "freeze" | "shield" | "burst") {
		this.left[kind] = POWER_TIME[kind];
	}

	/** whether a power-up's timer is running */
	active(kind: "freeze" | "shield" | "burst") {
		return this.left[kind] > 0;
	}

	/** the seconds a power-up has left, 0 once it ran out */
	timeLeft(kind: "freeze" | "shield" | "burst") {
		return this.left[kind];
	}

	/**
	 * Bolt, at a point on the screen, picks up any power-up it is on.
	 * @returns the one picked up, or null
	 */
	pickUp(x: number, y: number): PowerUp | null {
		const found = this.list.find((pw) => pw.isReachedFrom(x, y));
		if (found) {
			this.take(found);
		}
		return found ?? null;
	}

	/** take one off the board */
	private take(pw: PowerUp) {
		this.list = this.list.filter((o) => o !== pw);
		this.actors.removeChild(pw);
	}

	/** a power-up on an open panel away from Bolt, of a kind drawn by odds */
	private spawn(station: Station, bolt: Cell, wantsLife: boolean) {
		const spots: Cell[] = [];
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const t = station.tiles[idx(x, y)];
				const at = (c: Cell) => c.x === x && c.y === y;
				if (
					(t === Tile.FLOOR || t === Tile.ICE || t === Tile.GOO) &&
					Math.abs(x - bolt.x) + Math.abs(y - bolt.y) >= POWER_DISTANCE &&
					!station.portals.some(at) &&
					!this.list.some((pw) => at(pw.cell))
				) {
					spots.push({ x, y });
				}
			}
		}
		if (spots.length === 0) {
			return;
		}
		const kind = utils.array.random(wantsLife ? DRAW : DRAW_NO_LIFE);
		const pw = new PowerUp(kind, utils.array.random(spots));
		this.list.push(pw);
		this.actors.addChild(pw, ACTOR_Z.powerUp);
	}
}
