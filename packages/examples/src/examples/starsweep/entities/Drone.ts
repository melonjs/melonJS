/**
 * melonJS — Starsweep: the drone.
 *
 * It flies, over open space too: it plans across the flying grid (see
 * `world/Navigation.ts`), diagonally, along smoothed straight lines, and
 * heads for each point in turn, planning again a few times a second as Bolt
 * moves. Drones keep off each other's way, and never fall.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { cellUnder, STAND_LIFT, standOn, TILE } from "../config/layout";
import { type Cell, dirOf } from "../rules/board";
import { FLANK_COST, Monster, type MonsterWorld, SEARCH_CAP } from "./Monster";

/** seconds between two plans */
const REPLAN = 0.4;
/** its flying speed, in cells per second, the same on every level */
const FLY_SPEED = 1.9;

/** A drone: it flies at Bolt, over the gaps. */
export class Drone extends Monster {
	override readonly flies = true;
	/** where it is, free of the cells */
	private readonly air: { x: number; y: number };
	/** the points left on its route */
	private path: { x: number; y: number }[] = [];
	/** seconds before it plans again */
	private replan = 0;

	/**
	 * @param world - the board, Bolt and the other monsters
	 * @param portal - the portal it comes out of
	 * @param pace - how much faster than its own speed it goes on this level
	 */
	constructor(world: MonsterWorld, portal: Cell, pace: number) {
		super({ kind: "drone", speed: FLY_SPEED, score: 250 }, world, portal, pace);
		this.air = standOn(portal.x, portal.y);
	}

	override get x() {
		return this.air.x;
	}

	override get y() {
		return this.air.y;
	}

	/** the cell it hovers over */
	override get cell() {
		return cellUnder(this.air.x, this.air.y);
	}

	/** it flies its own way, so there is no step on the cells to plan */
	protected nextStep() {
		return -1 as const;
	}

	/** fly on, planning again now and then */
	protected override move(dt: number) {
		const grid = this.world.nav.fly;
		if (!grid) {
			return;
		}
		const air = this.air;
		this.replan -= dt;
		if (this.replan <= 0) {
			this.replan = REPLAN;
			const bolt = this.world.bolt();
			const others = this.world
				.monsters()
				.filter((o) => o !== this && o.flies && o.falling === 0)
				.map((o) => ({ x: o.x, y: o.y + STAND_LIFT }));
			// planned between cell centres: where they stand, lowered back
			this.plan = grid.findPath(
				{ x: air.x, y: air.y + STAND_LIFT },
				{ x: bolt.x, y: bolt.y + STAND_LIFT },
				{
					diagonalMode: "onlyIfNoObstacles",
					smooth: true,
					avoid: others,
					avoidWeight: FLANK_COST,
					maxNodes: SEARCH_CAP,
					allowPartialPath: true,
				},
			);
			// path[0] is the cell it is in: fly on from there
			this.path = this.plan.path
				.slice(1)
				.map((point) => ({ x: point.x, y: point.y - STAND_LIFT }));
		}
		let step = FLY_SPEED * TILE * dt;
		while (step > 0 && this.path.length > 0) {
			const to = this.path[0];
			const dx = to.x - air.x;
			const dy = to.y - air.y;
			const d = Math.hypot(dx, dy);
			if (d > 0.5) {
				// look the way it flies
				this.walker.dir = dirOf(dx, dy);
			}
			if (d <= step) {
				air.x = to.x;
				air.y = to.y;
				this.path.shift();
				step -= d;
			} else {
				air.x += (dx / d) * step;
				air.y += (dy / d) * step;
				step = 0;
			}
		}
	}
}
