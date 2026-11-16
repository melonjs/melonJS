/**
 * melonJS — Starsweep: the monsters on the board.
 *
 * They come out of the level's portals, in the order its map lists, one
 * every few seconds while there is room, a little faster on each level.
 * Each is an entity of its own kind (`entities/Wobbler.ts`, `Muncher.ts`,
 * `Chaser.ts`, `Drone.ts`); this keeps them, steps them, and answers what
 * the field asks about them all.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { DebugPath } from "@melonjs/pathfinding-plugin";
import { type Container, utils } from "melonjs";
import * as sfx from "../audio/sfx";
import { ACTOR_Z } from "../config/layout";
import { Chaser } from "../entities/Chaser";
import { Drone } from "../entities/Drone";
import type { Monster, MonsterWorld } from "../entities/Monster";
import { Muncher } from "../entities/Muncher";
import { Wobbler } from "../entities/Wobbler";
import type { Cell } from "../rules/board";
import type { EnemyKind, LevelDef } from "../rules/levels";
import type { Renderer } from "../utils/draw";

/** how much faster monsters walk on each level after the first */
const SPEED_UP_PER_LEVEL = 0.03;
/** seconds after a level starts, or Bolt comes back, before the first one */
const FIRST_SPAWN = 1.5;

/** the class of each kind */
const KINDS: Record<
	EnemyKind,
	new (
		world: MonsterWorld,
		portal: Cell,
		pace: number,
	) => Monster
> = {
	wobbler: Wobbler,
	muncher: Muncher,
	chaser: Chaser,
	drone: Drone,
};

/** The monsters on the board: they come out, move, and go. */
export class Monsters {
	/** every monster on the board, falling ones included */
	list: Monster[] = [];

	private level!: LevelDef;
	/** their speed on this level, as a share of their own */
	private pace = 1;
	private spawnTimer = 0;
	private spawnCount = 0;
	private readonly world: MonsterWorld;

	/**
	 * @param world - the board and Bolt, and what happens to monsters
	 * @param actors - where they go
	 */
	constructor(
		world: Omit<MonsterWorld, "monsters">,
		private readonly actors: Container,
	) {
		this.world = {
			...world,
			monsters: () => this.list,
			popped: (m) => {
				this.remove(m);
				world.popped(m);
			},
		};
	}

	/** a new level: its monsters, in its order, a little faster each level */
	startLevel(level: LevelDef, index: number) {
		this.level = level;
		this.pace = 1 + index * SPEED_UP_PER_LEVEL;
		this.spawnCount = 0;
		this.reset();
	}

	/** none on the board, and a short wait before the next one comes out */
	reset() {
		for (const m of this.list) {
			this.actors.removeChild(m);
		}
		this.list = [];
		this.spawnTimer = FIRST_SPAWN;
	}

	/** take the ones that fell away off the board */
	prune() {
		for (const m of this.list.filter((m) => m.falling === -1)) {
			this.remove(m);
		}
	}

	/** take one off the board at once */
	remove(m: Monster) {
		m.falling = -1;
		this.list = this.list.filter((o) => o !== m);
		this.actors.removeChild(m);
	}

	/**
	 * Bring them out, and move them.
	 * @param dt - seconds
	 * @param frozen - a freeze is on: they stay where they are
	 */
	update(dt: number, frozen: boolean) {
		this.spawnTimer -= dt;
		const onFeet = this.list.filter((m) => m.falling === 0).length;
		if (this.spawnTimer <= 0 && onFeet < this.level.maxEnemies) {
			this.spawn();
		}
		for (const m of this.list) {
			m.step(dt, frozen);
		}
		this.prune();
	}

	/** a monster comes out of one of the portals */
	private spawn() {
		const portal = utils.array.random(this.world.station.portals);
		const kinds = this.level.enemies;
		const kind = kinds[this.spawnCount % kinds.length];
		this.spawnCount++;
		this.spawnTimer = this.level.spawnEvery;
		const m = new KINDS[kind](this.world, portal, this.pace);
		this.list.push(m);
		this.actors.addChild(m, ACTOR_Z.monster);
		sfx.sfxSpawn();
	}

	/** a panel gave way: the walking monsters on it fall */
	dropOn(cell: Cell) {
		for (const m of this.list) {
			const at = m.cell;
			if (!m.flies && m.isLoose && at.x === cell.x && at.y === cell.y) {
				m.drop();
			}
		}
	}

	/** a level was cleared: every monster goes in a puff */
	celebrate() {
		for (const m of this.list) {
			m.vanish();
		}
		this.reset();
	}

	/** the cell each monster is on, drones by where they hover */
	cells() {
		return this.list.map((m) => m.cell);
	}

	/** the routes to draw: every plan of a monster that is out */
	routes(): DebugPath[] {
		return this.list
			.map((m) => m.route())
			.filter((r): r is DebugPath => r !== null);
	}

	/**
	 * put each one's sprite where it is, playing what it is doing
	 * @param frozen - a freeze is on: they show it
	 */
	pose(frozen: boolean) {
		for (const m of this.list) {
			m.pose(frozen);
		}
	}

	/** a soft glow under each monster; their sprites draw over it */
	drawGlows(r: Renderer) {
		for (const m of this.list) {
			m.drawGlow(r);
		}
	}

	/** what each is heading for: a ring on each wobbler's panel */
	drawGoals(r: Renderer, time: number) {
		for (const m of this.list) {
			m.drawGoal(r, time);
		}
	}

	/** take them all off the board, for good */
	destroy() {
		this.reset();
	}
}
