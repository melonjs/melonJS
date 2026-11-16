/**
 * melonJS — Starsweep: a monster, and what every kind does alike.
 *
 * A monster comes out of a portal, growing as it does, then walks the board
 * cell to cell (`movers.ts`), slowed by goo, kept off force-fields and off
 * panels about to give way. It falls if it walks off an edge or its panel
 * goes. Where it steps next is up to its kind, each a class of its own:
 * `Wobbler`, `Muncher`, `Chaser` and `Drone` (which flies instead).
 *
 * The field steps every monster itself (`step`), in a fixed order with the
 * rest of the game; the engine's own `update` only plays its animation.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { DebugPath, PathResult } from "@melonjs/pathfinding-plugin";
import { math, utils } from "melonjs";
import {
	type Cell,
	type Dir,
	DX,
	DY,
	dirOf,
	idx,
	isSolidGround,
	opposite,
	Tile,
} from "../rules/board";
import type { EnemyKind } from "../rules/levels";
import { drawGlow, type Renderer } from "../utils/draw";
import type { Navigation } from "../world/Navigation";
import type { Station } from "../world/Station";
import { Actor, GLOW, monsterAnimation, placeFalling } from "./Actor";
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

/** how fast a monster wades through goo, as a share of its speed */
const GOO_SLOW = 0.45;
/** seconds a monster takes to come out of its portal */
const SPAWN_TIME = 1;
/** what another monster's cell costs a search: they spread out */
export const FLANK_COST = 4;
/** the most cells one search may look at */
export const SEARCH_CAP = 400;

/** what a monster needs from the game around it */
export interface MonsterWorld {
	readonly station: Station;
	readonly nav: Navigation;
	/** where Bolt is: the cell it is mostly on, and its point on screen */
	bolt(): { cell: Cell; x: number; y: number };
	/** every monster on the board, this one included */
	monsters(): readonly Monster[];
	/** a monster walked off the edge, or its panel gave way */
	fell(m: Monster): void;
	/** a muncher landed on a cell */
	munched(cell: Cell): void;
}

/** what sets one kind apart from another */
export interface MonsterKind {
	kind: EnemyKind;
	/** walking speed, in cells per second */
	speed: number;
	/** what zapping one scores (twice as much for one that falls off) */
	score: number;
}

/** A monster on the board: one of the four kinds. */
export abstract class Monster extends Actor {
	readonly kind: EnemyKind;
	/** what zapping it scores */
	readonly score: number;
	/** the cell it steps from and to (a drone's is where it came out) */
	readonly walker: Mover;
	/** seconds left coming out of its portal; > 0 until it moves */
	spawning = SPAWN_TIME;
	/** 0 on its feet; from 1 down to 0 as it falls (tweened); -1 once gone */
	falling = 0;
	/** whether it flies over the board rather than walks it */
	readonly flies: boolean = false;
	/** the last route it planned, drawn on the board */
	plan: PathResult | undefined;
	/** its speed on this level, in cells per second */
	protected readonly speed: number;

	/**
	 * @param stats - its kind, speed and score
	 * @param world - the board, Bolt and the other monsters
	 * @param portal - the portal it comes out of
	 * @param pace - how much faster than its own speed it goes on this level
	 */
	constructor(
		stats: MonsterKind,
		protected readonly world: MonsterWorld,
		portal: Cell,
		pace: number,
	) {
		super(monsterAnimation(stats.kind, -1));
		this.kind = stats.kind;
		this.score = stats.score;
		this.speed = stats.speed * pace;
		this.walker = standingOn(portal);
		// level.load clears the world of everything that is not persistent
		this.isPersistent = true;
		// not all stepping in time
		this.setAnimationFrame(math.random(0, 8));
	}

	/** where it is across the screen */
	get x() {
		return moverX(this.walker);
	}

	/** where it is down the screen */
	get y() {
		return moverY(this.walker);
	}

	/** the cell it is on, or mostly on */
	get cell(): Cell {
		return nearestCell(this.walker);
	}

	/** out of its portal and on its feet: it moves, and it can be hit */
	get isLoose() {
		return this.spawning <= 0 && this.falling === 0;
	}

	/**
	 * Come out of the portal, then move.
	 * @param dt - seconds
	 * @param frozen - a freeze is on: it stays where it is
	 */
	step(dt: number, frozen: boolean) {
		if (this.falling !== 0) {
			return; // falling away, tweened
		}
		if (this.spawning > 0) {
			this.spawning -= dt;
			if (this.spawning <= 0) {
				this.chooseDir();
			}
			return;
		}
		if (!frozen) {
			this.move(dt);
		}
	}

	/** walk on, slowly through goo */
	protected move(dt: number) {
		const here = this.cell;
		const goo = this.world.station.tiles[idx(here.x, here.y)] === Tile.GOO;
		const speed = this.speed * (goo ? GOO_SLOW : 1);
		walk(this.walker, dt, {
			speed: () => speed,
			next: () => this.chooseDir(),
			arrive: () => this.arrive(),
			going: () => this.falling === 0,
		});
	}

	/**
	 * Where it steps next: the step its kind plans, or else a random one,
	 * not straight back unless there is no other way.
	 * @returns false when it has nowhere to go
	 */
	private chooseDir() {
		const w = this.walker;
		const options = ([0, 1, 2, 3] as Dir[]).filter((d) =>
			this.canEnter(w.toX + DX[d], w.toY + DY[d]),
		);
		if (options.length === 0) {
			return false;
		}
		const forward = options.filter((d) => d !== opposite(w.dir));
		const choices = forward.length > 0 ? forward : options;
		const planned = this.nextStep(choices);
		beginStep(
			w,
			planned !== -1 && options.includes(planned)
				? planned
				: utils.array.random(choices),
		);
		return true;
	}

	/**
	 * The step its kind plans from where it stands.
	 * @param choices - the open ways, not back the way it came
	 * @returns the step, or -1 for a random one
	 */
	protected abstract nextStep(choices: Dir[]): Dir | -1;

	/** it reached a cell: it falls off an edge, or does what its kind does */
	private arrive() {
		const w = this.walker;
		land(w);
		const cell = { x: w.toX, y: w.toY };
		if (this.world.station.ground(cell.x, cell.y) === Tile.VOID) {
			this.drop();
			return;
		}
		this.landedOn(cell);
	}

	/** what its kind does on a cell it lands on: nothing, but for munchers */
	protected landedOn(_cell: Cell) {}

	/** whether it may step onto a cell */
	protected canEnter(x: number, y: number) {
		const { station, nav } = this.world;
		// they keep off a panel about to give way, and off force-fields
		return (
			isSolidGround(station.ground(x, y)) &&
			!station.isCrumbling(x, y) &&
			!nav.hasField(x, y)
		);
	}

	/**
	 * Keep a plan, and take its first step.
	 * @returns the step's direction, or -1 when the plan goes nowhere
	 */
	protected firstStep(plan: PathResult): Dir | -1 {
		this.plan = plan;
		// cells[0] is where it stands
		const next = plan.cells[1];
		if (next === undefined) {
			return -1;
		}
		return dirOf(next.x - this.walker.toX, next.y - this.walker.toY);
	}

	/** Its panel gave way, or it walked off: it falls, from where it stands. */
	drop() {
		const w = this.walker;
		const cell = this.cell;
		w.fromX = w.toX = cell.x;
		w.fromY = w.toY = cell.y;
		w.t = 0;
		w.moving = false;
		this.world.fell(this);
	}

	/** the route to draw on the board, while it is out */
	route(): DebugPath | null {
		if (this.plan === undefined || !this.isLoose) {
			return null;
		}
		return {
			result: this.plan,
			from: { x: this.x, y: this.y },
			color: GLOW[this.kind],
		};
	}

	/**
	 * Put the sprite where it is, playing what it is doing.
	 * @param frozen - a freeze is on: it shows it
	 */
	pose(frozen: boolean) {
		const { x, y } = this;
		if (this.falling > 0) {
			this.play(monsterAnimation(this.kind, -1));
			placeFalling(this, x, y, this.falling);
		} else if (this.spawning > 0) {
			// coming out of the portal
			const grow = 1 - this.spawning / SPAWN_TIME;
			this.play(monsterAnimation(this.kind, -1));
			this.place(x, y, 0.2 + grow * 0.8, grow * 0.8);
		} else if (frozen) {
			this.play(`${this.kind}-frozen`);
			this.place(x, y);
		} else {
			this.play(monsterAnimation(this.kind, this.walker.dir));
			this.place(x, y);
		}
	}

	/** the soft glow under it, drawn before the sprites */
	drawGlow(r: Renderer) {
		const k = this.alpha * (this.falling > 0 ? this.falling : 1);
		drawGlow(r, this.pos.x, this.pos.y, 26 * k, GLOW[this.kind], 0.7 * k);
	}

	/** what it is heading for, drawn on the board: nothing, but for wobblers */
	drawGoal(_r: Renderer, _time: number) {}
}
