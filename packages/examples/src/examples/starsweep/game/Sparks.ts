/**
 * melonJS — Starsweep: the sparks in flight.
 *
 * Bolt zaps one `Spark` at a time the way it faces, or one each way while
 * a burst power-up runs, with a short cool-down between zaps. Each flies on
 * until it hits a wall, leaves the board or pops a monster.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Container } from "melonjs";
import * as sfx from "../audio/sfx";
import { ACTOR_Z, TILE } from "../config/layout";
import type { Monster } from "../entities/Monster";
import { SPARK_COLOR, Spark } from "../entities/Spark";
import type { Effects } from "../fx/Effects";
import { type Dir, idx, inBounds, Tile } from "../rules/board";
import type { Station } from "../world/Station";

/** seconds between two zaps */
const COOLDOWN = 0.22;
/** sparks in flight at once: one, or one each way during a burst */
const MAX_SPARKS = 1;
const BURST_SPARKS = 4;
/** how close, as a share of a cell, a spark hits a monster */
const REACH = 0.55;

/** what the sparks need from the game around them */
export interface SparkWorld {
	readonly station: Station;
	readonly effects: Effects;
	/** where the sparks go, over the characters */
	readonly actors: Container;
	/** the monsters a spark can hit */
	monsters(): readonly Monster[];
	/** a spark hit a monster */
	hit(m: Monster): void;
}

/** The sparks Bolt zapped. */
export class Sparks {
	private list: Spark[] = [];
	/** seconds before the next zap */
	private cooldown = 0;

	/** @param world - the game around the sparks */
	constructor(private readonly world: SparkWorld) {}

	/**
	 * Zap from (x, y): a spark the way Bolt faces, or one each way during a
	 * burst. Nothing while the last zap cools down or too many are flying.
	 * @param burst - whether a burst power-up runs
	 */
	fire(x: number, y: number, facing: Dir, burst: boolean) {
		const most = burst ? BURST_SPARKS : MAX_SPARKS;
		if (this.cooldown > 0 || this.list.length >= most) {
			return;
		}
		this.cooldown = COOLDOWN;
		sfx.sfxShoot();
		const dirs: Dir[] = burst ? [0, 1, 2, 3] : [facing];
		for (const dir of dirs) {
			if (this.list.length >= most) {
				break;
			}
			const spark = new Spark(x, y, dir, (at) => this.world.effects.trail(at));
			this.list.push(spark);
			this.world.actors.addChild(spark, ACTOR_Z.spark);
		}
	}

	/** fly each spark on, and stop those that hit something */
	update(dt: number) {
		this.cooldown = Math.max(0, this.cooldown - dt);
		const { station, effects } = this.world;
		for (const spark of [...this.list]) {
			spark.step(dt);
			const { x, y } = spark.cell;
			if (!inBounds(x, y) || station.tiles[idx(x, y)] === Tile.WALL) {
				effects.burst(spark.at.x, spark.at.y, SPARK_COLOR, 5, 80);
				this.stop(spark);
				continue;
			}
			const hit = this.world
				.monsters()
				.find(
					(m) =>
						m.isLoose &&
						Math.hypot(m.x - spark.at.x, m.y - spark.at.y) < TILE * REACH,
				);
			if (hit) {
				this.world.hit(hit);
				this.stop(spark);
			}
		}
	}

	/** stop every spark, their trails fading out */
	clear() {
		for (const spark of [...this.list]) {
			this.stop(spark);
		}
	}

	/** take a spark off the board; its trail fades out on its own */
	private stop(spark: Spark) {
		this.world.effects.stop(spark.trail);
		this.list = this.list.filter((s) => s !== spark);
		this.world.actors.removeChild(spark);
	}
}
