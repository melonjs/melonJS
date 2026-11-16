/**
 * melonJS — Starsweep: the monsters, how each kind moves, and their sprites.
 *
 * They come out of the level's portals, in the order the map lists, and
 * find their way with `@melonjs/pathfinding-plugin` (see `navigation.ts`):
 * - **wobblers** pick a panel some way off and walk there, round walls and
 *   holes, now and then taking a random step;
 * - **munchers** wander, mostly onto lit panels, and eat the light;
 * - **chasers** plan the cheapest way to Bolt, round goo, and keep off each
 *   other's cells, so they come at Bolt from different sides;
 * - **drones** fly, over open space too, diagonally along smoothed
 *   straight lines, planning again a few times a second.
 *
 * When a goal is out of reach, a plan leads as near as it can. Every plan
 * is drawn on the board, with a ring on the panel each wobbler is heading
 * for.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { DebugPath, PathResult } from "@melonjs/pathfinding-plugin";
import { type Container, math, utils } from "melonjs";
import * as sfx from "../audio/sfx";
import {
	ACTOR_Z,
	cellUnder,
	STAND_LIFT,
	standOn,
	TILE,
} from "../config/layout";
import { Actor, GLOW, monsterAnimation, placeFalling } from "../entities/Actor";
import {
	type Cell,
	COLS,
	type Dir,
	DX,
	DY,
	dirOf,
	idx,
	isSolidGround,
	opposite,
	ROWS,
	Tile,
} from "../rules/board";
import type { EnemyKind, LevelDef } from "../rules/levels";
import { drawGlow, type Renderer } from "../utils/draw";
import {
	beginStep,
	land,
	type Mover,
	moverX,
	moverY,
	nearestCell,
	standingOn,
	walk,
} from "./movers";
import type { Navigation } from "./Navigation";
import type { Station } from "./Station";

/** each kind's walking speed, in cells per second */
const SPEED: Record<EnemyKind, number> = {
	wobbler: 3.1,
	muncher: 2.7,
	chaser: 3.3,
	drone: 1.9,
};
/** what zapping each kind scores (twice as much for one that falls off) */
export const ENEMY_SCORE: Record<EnemyKind, number> = {
	wobbler: 100,
	muncher: 150,
	chaser: 200,
	drone: 250,
};
/** how much faster monsters walk on each level after the first */
const SPEED_UP_PER_LEVEL = 0.03;
/** how fast a monster wades through goo, as a share of its speed */
const GOO_SLOW = 0.45;
/** seconds after a level starts, or Bolt comes back, before the first one */
const FIRST_SPAWN = 1.5;
/** seconds a monster takes to come out of its portal */
const SPAWN_TIME = 1;
/** what another monster's cell costs a chaser's search: they spread out */
const FLANK_COST = 4;
/** the most cells one search may look at */
const SEARCH_CAP = 400;
/** seconds between two plans of a drone */
const DRONE_REPLAN = 0.4;
/** how often a chaser forgets Bolt for a step */
const CHASE_LAPSE = 0.1;
/** how often a wobbler takes a random step instead of its route */
const WOBBLE = 0.15;
/** how far off, in steps, a wobbler picks the panel it walks to */
const WANDER_MIN = 5;
/** tries to find a panel to walk to, before giving up until the next step */
const WANDER_TRIES = 30;
/** how often a muncher heads for a lit panel, when one is next to it */
const MUNCH_ODDS = 0.75;

/** a monster */
export interface Enemy extends Mover {
	kind: EnemyKind;
	/** seconds left coming out of its portal; > 0 until it moves */
	spawning: number;
	/** 0 on its feet; from 1 down to 0 as it falls (tweened); -1 once gone */
	falling: number;
	/** a flying drone's free position and route, not tied to cells */
	air?: {
		x: number;
		y: number;
		path: { x: number; y: number }[];
		replan: number;
	};
	/** the last route planned, drawn on the board */
	plan?: PathResult;
	/** the panel a wobbler is walking to, if it has picked one */
	goal?: Cell | undefined;
}

/** whether a monster is out and on its feet: it moves, and it can be hit */
export const isActive = (e: Enemy) => e.spawning <= 0 && e.falling === 0;
/** where a monster is across the screen */
export const enemyX = (e: Enemy) => (e.air ? e.air.x : moverX(e));
/** where a monster is down the screen */
export const enemyY = (e: Enemy) => (e.air ? e.air.y : moverY(e));

/** what the monsters need from the field */
export interface MonsterWorld {
	readonly station: Station;
	readonly nav: Navigation;
	/** where Bolt is: the cell it is mostly on, and its point on screen */
	bolt(): { cell: Cell; x: number; y: number };
	/** a monster walked off the edge, or its panel gave way */
	fell(e: Enemy): void;
	/** a muncher landed on a cell */
	munched(cell: Cell): void;
}

/** The monsters on the board: they come out, move, and are drawn. */
export class Monsters {
	/** every monster on the board, falling ones included */
	list: Enemy[] = [];

	private level!: LevelDef;
	/** their speed on this level, as a share of their own */
	private pace = 1;
	private spawnTimer = 0;
	private spawnCount = 0;
	private readonly sprites = new Map<Enemy, Actor>();

	/**
	 * @param world - the board and Bolt, and what happens to monsters
	 * @param actors - where their sprites go
	 */
	constructor(
		private readonly world: MonsterWorld,
		private readonly actors: Container,
	) {}

	/** a new level: its monsters, in its order, a little faster each level */
	startLevel(level: LevelDef, index: number) {
		this.level = level;
		this.pace = 1 + index * SPEED_UP_PER_LEVEL;
		this.spawnCount = 0;
		this.reset();
	}

	/** none on the board, and a short wait before the next one comes out */
	reset() {
		this.list = [];
		this.spawnTimer = FIRST_SPAWN;
	}

	/** take the ones that are gone off the board */
	prune() {
		this.list = this.list.filter((e) => e.falling !== -1);
	}

	/** take one off the board at once */
	remove(e: Enemy) {
		e.falling = -1;
		this.list = this.list.filter((o) => o !== e);
	}

	/**
	 * Bring them out, and move them.
	 * @param dt - seconds
	 * @param frozen - a freeze is on: they stay where they are
	 */
	update(dt: number, frozen: boolean) {
		this.spawnTimer -= dt;
		const onFeet = this.list.filter((e) => e.falling === 0).length;
		if (this.spawnTimer <= 0 && onFeet < this.level.maxEnemies) {
			this.spawn();
		}
		for (const e of this.list) {
			if (e.falling !== 0) {
				continue; // falling away, tweened
			}
			if (e.spawning > 0) {
				e.spawning -= dt;
				if (e.spawning <= 0) {
					this.chooseDir(e);
				}
				continue;
			}
			if (frozen) {
				continue;
			}
			if (e.air) {
				this.fly(e, dt);
				continue;
			}
			// wading through goo
			const here = nearestCell(e);
			const goo = this.world.station.tiles[idx(here.x, here.y)] === Tile.GOO;
			const speed = SPEED[e.kind] * this.pace * (goo ? GOO_SLOW : 1);
			walk(e, dt, {
				speed: () => speed,
				next: () => this.chooseDir(e),
				arrive: () => this.arrive(e),
				going: () => e.falling === 0,
			});
		}
		this.prune();
	}

	/**
	 * A monster's panel gave way, or it walked off: it falls, from the cell
	 * it is mostly on.
	 */
	drop(e: Enemy) {
		const cell = nearestCell(e);
		e.fromX = e.toX = cell.x;
		e.fromY = e.toY = cell.y;
		e.t = 0;
		e.moving = false;
		this.world.fell(e);
	}

	/** the cell each monster is on, drones by where they hover */
	cells() {
		return this.list.map((e) =>
			e.air ? cellUnder(e.air.x, e.air.y) : nearestCell(e),
		);
	}

	/** the routes to draw: every plan of a monster that is out */
	routes(): DebugPath[] {
		return this.list
			.filter((e) => e.plan !== undefined && isActive(e))
			.map((e) => ({
				result: e.plan as PathResult,
				from: { x: enemyX(e), y: enemyY(e) },
				color: GLOW[e.kind],
			}));
	}

	/** whether a monster may step onto a cell */
	canEnter(x: number, y: number) {
		const { station, nav } = this.world;
		// they keep off a panel about to give way, and off force-fields
		return (
			isSolidGround(station.ground(x, y)) &&
			!station.isCrumbling(x, y) &&
			!nav.hasField(x, y)
		);
	}

	/** a monster comes out of one of the portals */
	private spawn() {
		const portal = utils.array.random(this.world.station.portals);
		const kinds = this.level.enemies;
		const kind = kinds[this.spawnCount % kinds.length];
		this.spawnCount++;
		this.spawnTimer = this.level.spawnEvery;
		const enemy: Enemy = {
			...standingOn(portal),
			kind,
			spawning: SPAWN_TIME,
			falling: 0,
		};
		if (kind === "drone") {
			enemy.air = { ...standOn(portal.x, portal.y), path: [], replan: 0 };
		}
		this.list.push(enemy);
		sfx.sfxSpawn();
	}

	/**
	 * Where a monster steps next, by its kind.
	 * @returns false when it has nowhere to go
	 */
	private chooseDir(e: Enemy) {
		const options = ([0, 1, 2, 3] as Dir[]).filter((d) =>
			this.canEnter(e.toX + DX[d], e.toY + DY[d]),
		);
		if (options.length === 0) {
			return false;
		}
		// not straight back, unless there is no other way
		const forward = options.filter((d) => d !== opposite(e.dir));
		const choices = forward.length > 0 ? forward : options;
		let planned: Dir | -1 = -1;
		switch (e.kind) {
			case "chaser":
				if (math.randomFloat(0, 1) > CHASE_LAPSE) {
					planned = this.chaseStep(e);
				}
				break;
			case "wobbler":
				if (math.randomFloat(0, 1) > WOBBLE) {
					planned = this.wanderStep(e);
				}
				break;
			case "muncher":
				if (math.randomFloat(0, 1) < MUNCH_ODDS) {
					const onLit = choices.filter((d) =>
						this.world.station.isLit(e.toX + DX[d], e.toY + DY[d]),
					);
					if (onLit.length > 0) {
						planned = utils.array.random(onLit);
					}
				}
				break;
			case "drone":
				break;
		}
		beginStep(
			e,
			planned !== -1 && options.includes(planned)
				? planned
				: utils.array.random(choices),
		);
		return true;
	}

	/** a monster reached a cell: it falls off an edge, or a muncher eats */
	private arrive(e: Enemy) {
		land(e);
		const cell = { x: e.toX, y: e.toY };
		if (this.world.station.ground(cell.x, cell.y) === Tile.VOID) {
			this.drop(e);
			return;
		}
		if (e.kind === "muncher") {
			this.world.munched(cell);
		}
	}

	/**
	 * A chaser plans the cheapest way to Bolt, off the other monsters' cells.
	 * @returns the first step, or -1 to wander
	 */
	private chaseStep(e: Enemy) {
		const grid = this.world.nav.walk;
		if (!grid) {
			return -1;
		}
		const others = this.list
			.filter((o) => o !== e && !o.air && isActive(o))
			.map((o) => grid.getPointPosition(o.toX, o.toY));
		const bolt = this.world.bolt().cell;
		return this.firstStep(
			e,
			grid.findPath(
				grid.getPointPosition(e.toX, e.toY),
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

	/**
	 * A wobbler walks to a panel it picked, some way off, then picks another.
	 * Out of reach, it goes as near as it can, then gives up on that panel.
	 * @returns the first step, or -1 to wander
	 */
	private wanderStep(e: Enemy) {
		const grid = this.world.nav.walk;
		if (!grid) {
			return -1;
		}
		if (e.goal === undefined || (e.goal.x === e.toX && e.goal.y === e.toY)) {
			e.goal = this.pickGoal(e);
			if (e.goal === undefined) {
				return -1;
			}
		}
		const step = this.firstStep(
			e,
			grid.findPath(
				grid.getPointPosition(e.toX, e.toY),
				grid.getPointPosition(e.goal.x, e.goal.y),
				{ maxNodes: SEARCH_CAP, allowPartialPath: true },
			),
		);
		if (step === -1) {
			// as near as it gets: another panel next time
			e.goal = undefined;
		}
		return step;
	}

	/**
	 * Keep a monster's plan, and take its first step.
	 * @returns the step's direction, or -1 when the plan goes nowhere
	 */
	private firstStep(e: Enemy, plan: PathResult): Dir | -1 {
		e.plan = plan;
		// cells[0] is where it stands
		const next = plan.cells[1];
		if (next === undefined) {
			return -1;
		}
		return dirOf(next.x - e.toX, next.y - e.toY);
	}

	/**
	 * a panel for a wobbler to walk to, some way off
	 * @returns the panel, or undefined if none was found
	 */
	private pickGoal(e: Enemy): Cell | undefined {
		for (let tries = 0; tries < WANDER_TRIES; tries++) {
			const x = math.random(0, COLS);
			const y = math.random(0, ROWS);
			if (
				Math.abs(x - e.toX) + Math.abs(y - e.toY) >= WANDER_MIN &&
				this.canEnter(x, y) &&
				this.world.nav.walk?.isSolid(x, y) === false
			) {
				return { x, y };
			}
		}
		return undefined;
	}

	/**
	 * A drone flies: it plans across the flying grid (open space too),
	 * diagonally, along smoothed straight lines, and heads for each point in
	 * turn, planning again a few times a second as Bolt moves.
	 */
	private fly(e: Enemy, dt: number) {
		const air = e.air;
		const grid = this.world.nav.fly;
		if (!air || !grid) {
			return;
		}
		air.replan -= dt;
		if (air.replan <= 0) {
			air.replan = DRONE_REPLAN;
			const bolt = this.world.bolt();
			const others = this.list
				.filter((o) => o !== e && o.air !== undefined && o.falling === 0)
				.map((o) => ({ x: enemyX(o), y: enemyY(o) + STAND_LIFT }));
			// planned between cell centres: where they stand, lowered back
			e.plan = grid.findPath(
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
			air.path = e.plan.path
				.slice(1)
				.map((point) => ({ x: point.x, y: point.y - STAND_LIFT }));
		}
		let step = SPEED[e.kind] * TILE * dt;
		while (step > 0 && air.path.length > 0) {
			const to = air.path[0];
			const dx = to.x - air.x;
			const dy = to.y - air.y;
			const d = Math.hypot(dx, dy);
			if (d > 0.5) {
				// look the way it flies
				e.dir = dirOf(dx, dy);
			}
			if (d <= step) {
				air.x = to.x;
				air.y = to.y;
				air.path.shift();
				step -= d;
			} else {
				air.x += (dx / d) * step;
				air.y += (dy / d) * step;
				step = 0;
			}
		}
	}

	/**
	 * put each monster's sprite where it is, playing what it is doing
	 * @param frozen - a freeze is on: they show it
	 */
	place(frozen: boolean) {
		// a sprite for each monster, gone with it
		for (const [e, sprite] of this.sprites) {
			if (!this.list.includes(e)) {
				this.actors.removeChild(sprite);
				this.sprites.delete(e);
			}
		}
		for (const e of this.list) {
			let sprite = this.sprites.get(e);
			if (!sprite) {
				sprite = new Actor(monsterAnimation(e.kind, -1));
				sprite.isPersistent = true;
				// not all stepping in time
				sprite.setAnimationFrame(math.random(0, 8));
				this.sprites.set(e, sprite);
				this.actors.addChild(sprite, ACTOR_Z.monster);
			}
			const x = enemyX(e);
			const y = enemyY(e);
			if (e.falling > 0) {
				sprite.play(monsterAnimation(e.kind, -1));
				placeFalling(sprite, x, y, e.falling);
			} else if (e.spawning > 0) {
				// coming out of the portal
				const grow = 1 - e.spawning / SPAWN_TIME;
				sprite.play(monsterAnimation(e.kind, -1));
				sprite.place(x, y, 0.2 + grow * 0.8, grow * 0.8);
			} else if (frozen) {
				sprite.play(`${e.kind}-frozen`);
				sprite.place(x, y);
			} else {
				sprite.play(monsterAnimation(e.kind, e.dir));
				sprite.place(x, y);
			}
		}
	}

	/** take every sprite off the board, for good */
	destroy() {
		for (const sprite of this.sprites.values()) {
			this.actors.removeChild(sprite);
		}
		this.sprites.clear();
	}

	/** a soft glow under each monster; their sprites draw over it */
	drawGlows(r: Renderer) {
		for (const [e, sprite] of this.sprites) {
			const k = sprite.alpha * (e.falling > 0 ? e.falling : 1);
			drawGlow(r, sprite.pos.x, sprite.pos.y, 26 * k, GLOW[e.kind], 0.7 * k);
		}
	}

	/** a ring on the panel each wobbler is walking to */
	drawGoals(r: Renderer, time: number) {
		r.lineWidth = 2;
		for (const e of this.list) {
			if (e.goal === undefined || !isActive(e)) {
				continue;
			}
			const at = standOn(e.goal.x, e.goal.y);
			r.setGlobalAlpha(0.5 + 0.3 * Math.sin(time * 6));
			r.setColor(GLOW[e.kind]);
			r.strokeEllipse(at.x, at.y, 11, 7);
			r.setGlobalAlpha(1);
		}
	}
}
