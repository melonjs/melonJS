/**
 * melonJS — Starsweep: the muncher.
 *
 * It wanders, mostly onto lit panels when one is next to it, and eats the
 * light off every panel it lands on.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math, utils } from "melonjs";
import { type Cell, type Dir, DX, DY } from "../rules/board";
import { Monster, type MonsterWorld } from "./Monster";

/** how often it heads for a lit panel, when one is next to it */
const MUNCH_ODDS = 0.75;

/** A muncher: it eats the light back off the panels. */
export class Muncher extends Monster {
	/**
	 * @param world - the board, Bolt and the other monsters
	 * @param portal - the portal it comes out of
	 * @param pace - how much faster than its own speed it goes on this level
	 */
	constructor(world: MonsterWorld, portal: Cell, pace: number) {
		super({ kind: "muncher", speed: 2.7, score: 150 }, world, portal, pace);
	}

	protected nextStep(choices: Dir[]): Dir | -1 {
		if (math.randomFloat(0, 1) >= MUNCH_ODDS) {
			return -1;
		}
		const w = this.walker;
		const onLit = choices.filter((d) =>
			this.world.station.isLit(w.toX + DX[d], w.toY + DY[d]),
		);
		return onLit.length > 0 ? utils.array.random(onLit) : -1;
	}

	protected override landedOn(cell: Cell) {
		this.world.munched(cell);
	}
}
