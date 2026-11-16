/**
 * melonJS — Starsweep: the power-ups.
 *
 * Every so often one appears on an open panel away from Bolt, and goes if
 * it is not picked up in time: a gem (points), an extra life, a freeze
 * (monsters stop), a shield (monsters pop on contact), a burst (sparks in
 * four directions) or a force-field (cells round Bolt that monsters cannot
 * cross). This keeps which are on the board and how long the timed ones
 * have left; the field decides what picking one up does.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math, utils } from "melonjs";
import { type Cell, COLS, idx, ROWS, Tile } from "./board";
import { drawPower, type PowerKind, type Renderer } from "./draw";
import { centreX, centreY, STAND_LIFT, TILE } from "./layout";
import type { Station } from "./station";

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
/** seconds a power-up stays on the board */
const POWER_LIFE = 9;
/** it blinks for this many seconds before it goes */
const POWER_BLINK = 2;
/** the fewest steps from Bolt a power-up appears */
const POWER_DISTANCE = 3;
/** how close Bolt must come to pick one up, as a share of a cell */
const PICKUP_REACH = 0.5;
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

/** a power-up on the board */
interface Power extends Cell {
	kind: PowerKind;
	/** seconds before it goes */
	life: number;
}

/** The power-ups on the board, and the timers of the ones running. */
export class Powers {
	private list: Power[] = [];
	private nextIn = 0;
	/** seconds left on each power-up that lasts (not the force-fields') */
	private readonly left = { freeze: 0, shield: 0, burst: 0 };

	/** none on the board and none running, for a new level */
	reset() {
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
			pw.life -= dt;
		}
		this.list = this.list.filter((pw) => pw.life > 0);
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
	pickUp(x: number, y: number): Power | null {
		const found = this.list.find(
			(pw) =>
				Math.hypot(centreX(pw.x) - x, centreY(pw.y) - STAND_LIFT - y) <
				TILE * PICKUP_REACH,
		);
		if (!found) {
			return null;
		}
		this.list = this.list.filter((pw) => pw !== found);
		return found;
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
					!this.list.some(at)
				) {
					spots.push({ x, y });
				}
			}
		}
		if (spots.length === 0) {
			return;
		}
		const kind = utils.array.random(wantsLife ? DRAW : DRAW_NO_LIFE);
		this.list.push({ ...utils.array.random(spots), kind, life: POWER_LIFE });
	}

	/** the power-ups on the board, blinking before they go */
	draw(r: Renderer, time: number) {
		for (const pw of this.list) {
			const blink =
				pw.life < POWER_BLINK && Math.floor(pw.life * 8) % 2 === 0 ? 0.3 : 1;
			drawPower(r, pw.kind, centreX(pw.x), centreY(pw.y) - 2, time, blink);
		}
	}
}
