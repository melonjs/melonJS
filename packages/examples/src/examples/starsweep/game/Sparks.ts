/**
 * melonJS — Starsweep: the sparks in flight.
 *
 * Bolt zaps one `Spark` at a time the way it faces, or one each way while
 * a burst power-up runs, with a short cool-down between zaps. Each spark
 * flies on until it hits a wall, leaves the board or pops a monster (see
 * `entities/Spark.ts`); this takes the ones that are done off the board.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Container } from "melonjs";
import * as sfx from "../audio/sfx";
import { ACTOR_Z } from "../config/layout";
import { Spark } from "../entities/Spark";
import type { Effects } from "../fx/Effects";
import type { Dir } from "../rules/board";
import type { Station } from "../world/Station";

/** seconds between two zaps */
const COOLDOWN = 0.22;
/** sparks in flight at once: one, or one each way during a burst */
const MAX_SPARKS = 1;
const BURST_SPARKS = 4;

/** The sparks Bolt zapped. */
export class Sparks {
	private list: Spark[] = [];
	/** seconds before the next zap */
	private cooldown = 0;

	/**
	 * @param station - the board, for the walls
	 * @param effects - for the sparks' trails and bursts
	 * @param actors - where the sparks go, over the characters
	 */
	constructor(
		private readonly station: Station,
		private readonly effects: Effects,
		private readonly actors: Container,
	) {}

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
			const spark = new Spark(x, y, dir, this.station, this.effects);
			this.list.push(spark);
			this.actors.addChild(spark, ACTOR_Z.spark);
		}
	}

	/** fly each spark on, and take the ones that are done off the board */
	update(dt: number) {
		this.cooldown = Math.max(0, this.cooldown - dt);
		for (const spark of this.list) {
			if (!spark.spent) {
				spark.step(dt);
			}
		}
		for (const spark of this.list.filter((s) => s.spent)) {
			this.stop(spark);
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
		this.effects.stop(spark.trail);
		this.list = this.list.filter((s) => s !== spark);
		this.actors.removeChild(spark);
	}
}
