/**
 * melonJS — Starsweep: the chaser.
 *
 * It plans the cheapest way to Bolt with `@melonjs/pathfinding-plugin`
 * (see `world/Navigation.ts`), round goo, and keeps off the other monsters'
 * cells, so chasers come at Bolt from different sides. Now and then it
 * forgets Bolt for a step. When Bolt is out of reach, it goes as near as
 * it can.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math } from "melonjs";
import type { Cell, Dir } from "../rules/board";
import { FLANK_COST, Monster, type MonsterWorld, SEARCH_CAP } from "./Monster";

/** how often it forgets Bolt for a step */
const CHASE_LAPSE = 0.1;

/** A chaser: it comes for Bolt. */
export class Chaser extends Monster {
	/**
	 * @param world - the board, Bolt and the other monsters
	 * @param portal - the portal it comes out of
	 * @param pace - how much faster than its own speed it goes on this level
	 */
	constructor(world: MonsterWorld, portal: Cell, pace: number) {
		super({ kind: "chaser", speed: 3.3, score: 200 }, world, portal, pace);
	}

	protected nextStep(): Dir | -1 {
		const grid = this.world.nav.walk;
		if (math.randomFloat(0, 1) <= CHASE_LAPSE || !grid) {
			return -1;
		}
		const others = this.world
			.monsters()
			.filter((o) => o !== this && !o.flies && o.isLoose)
			.map((o) => grid.getPointPosition(o.walker.toX, o.walker.toY));
		const bolt = this.world.bolt().cell;
		const w = this.walker;
		return this.firstStep(
			grid.findPath(
				grid.getPointPosition(w.toX, w.toY),
				grid.getPointPosition(bolt.x, bolt.y),
				{
					avoid: others,
					avoidWeight: FLANK_COST,
					maxNodes: SEARCH_CAP,
					allowPartialPath: true,
				},
			),
		);
	}
}
