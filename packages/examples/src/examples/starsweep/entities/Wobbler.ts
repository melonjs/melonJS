/**
 * melonJS — Starsweep: the wobbler.
 *
 * It picks a panel some way off and walks there, round walls and holes,
 * with `@melonjs/pathfinding-plugin` (see `world/Navigation.ts`), then picks
 * another. Out of reach, it goes as near as it can, then gives up on that
 * panel. Now and then it takes a random step instead. A ring marks the
 * panel it is heading for.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math } from "melonjs";
import { standOn } from "../config/layout";
import { type Cell, COLS, type Dir, ROWS } from "../rules/board";
import type { Renderer } from "../utils/draw";
import { GLOW } from "./Actor";
import { Monster, type MonsterWorld, SEARCH_CAP } from "./Monster";

/** how often it takes a random step instead of its route */
const WOBBLE = 0.15;
/** how far off, in steps, it picks the panel it walks to */
const WANDER_MIN = 5;
/** tries to find a panel to walk to, before giving up until the next step */
const WANDER_TRIES = 30;

/** A wobbler: it wanders from one far panel to the next. */
export class Wobbler extends Monster {
	/** the panel it is walking to, if it has picked one */
	goal: Cell | undefined;

	/**
	 * @param world - the board, Bolt and the other monsters
	 * @param portal - the portal it comes out of
	 * @param pace - how much faster than its own speed it goes on this level
	 */
	constructor(world: MonsterWorld, portal: Cell, pace: number) {
		super({ kind: "wobbler", speed: 3.1, score: 100 }, world, portal, pace);
	}

	protected nextStep(): Dir | -1 {
		const grid = this.world.nav.walk;
		if (math.randomFloat(0, 1) <= WOBBLE || !grid) {
			return -1;
		}
		const w = this.walker;
		if (
			this.goal === undefined ||
			(this.goal.x === w.toX && this.goal.y === w.toY)
		) {
			this.goal = this.pickGoal();
			if (this.goal === undefined) {
				return -1;
			}
		}
		const step = this.firstStep(
			grid.findPath(
				grid.getPointPosition(w.toX, w.toY),
				grid.getPointPosition(this.goal.x, this.goal.y),
				{ maxNodes: SEARCH_CAP, allowPartialPath: true },
			),
		);
		if (step === -1) {
			// as near as it gets: another panel next time
			this.goal = undefined;
		}
		return step;
	}

	/**
	 * a panel to walk to, some way off
	 * @returns the panel, or undefined if none was found
	 */
	private pickGoal(): Cell | undefined {
		const w = this.walker;
		for (let tries = 0; tries < WANDER_TRIES; tries++) {
			const x = math.random(0, COLS);
			const y = math.random(0, ROWS);
			if (
				Math.abs(x - w.toX) + Math.abs(y - w.toY) >= WANDER_MIN &&
				this.canEnter(x, y) &&
				this.world.nav.walk?.isSolid(x, y) === false
			) {
				return { x, y };
			}
		}
		return undefined;
	}

	/** a ring on the panel it is walking to */
	override drawGoal(r: Renderer, time: number) {
		if (this.goal === undefined || !this.isLoose) {
			return;
		}
		const at = standOn(this.goal.x, this.goal.y);
		r.lineWidth = 2;
		r.setGlobalAlpha(0.5 + 0.3 * Math.sin(time * 6));
		r.setColor(GLOW[this.kind]);
		r.strokeEllipse(at.x, at.y, 11, 7);
		r.setGlobalAlpha(1);
	}
}
