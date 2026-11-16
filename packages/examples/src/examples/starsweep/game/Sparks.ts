/**
 * melonJS — Starsweep: the sparks Bolt zaps.
 *
 * A spark flies straight the way Bolt faces, a glowing `Trail` behind it,
 * until it hits a wall, leaves the board, or pops a monster. One at a time,
 * or one each way while a burst power-up runs.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Trail, Vector2d } from "melonjs";
import * as sfx from "../audio/sfx";
import { cellUnder, TILE } from "../config/layout";
import type { Effects } from "../fx/Effects";
import { type Dir, DX, DY, idx, inBounds, Tile } from "../rules/board";
import { drawGlow, type Renderer } from "../utils/draw";
import {
	type Enemy,
	enemyX,
	enemyY,
	isActive,
	type Monsters,
} from "./Monsters";
import type { Station } from "./Station";

/** a spark's speed, in cells per second */
const SPARK_SPEED = 15;
/** seconds between two zaps */
const SPARK_COOLDOWN = 0.22;
/** sparks in flight at once: one, or one each way during a burst */
const MAX_SPARKS = 1;
const BURST_SPARKS = 4;
/** how close, as a share of a cell, a spark hits a monster */
const SPARK_REACH = 0.55;
/** a spark's colour, and the burst where it stops */
export const SPARK_COLOR = "#fff2a8";

/** what the sparks need from the game around them */
export interface SparkWorld {
	readonly station: Station;
	readonly monsters: Monsters;
	readonly effects: Effects;
	/** a spark hit a monster */
	hit(e: Enemy): void;
}

/** a spark in flight */
interface Spark {
	/** where it is, which its trail follows */
	at: Vector2d;
	dir: Dir;
	trail: Trail;
}

/** The sparks Bolt zaps. */
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
		this.cooldown = SPARK_COOLDOWN;
		sfx.sfxShoot();
		const dirs: Dir[] = burst ? [0, 1, 2, 3] : [facing];
		for (const dir of dirs) {
			if (this.list.length >= most) {
				break;
			}
			const at = new Vector2d(x, y);
			this.list.push({ at, dir, trail: this.world.effects.trail(at) });
		}
	}

	/** fly each spark on, and stop those that hit something */
	update(dt: number) {
		this.cooldown = Math.max(0, this.cooldown - dt);
		const { station, monsters, effects } = this.world;
		const step = SPARK_SPEED * TILE * dt;
		this.list = this.list.filter((s) => {
			const at = s.at;
			at.x += DX[s.dir] * step;
			at.y += DY[s.dir] * step;
			const cell = cellUnder(at.x, at.y);
			let hit =
				!inBounds(cell.x, cell.y) ||
				station.tiles[idx(cell.x, cell.y)] === Tile.WALL;
			if (hit) {
				effects.burst(at.x, at.y, SPARK_COLOR, 5, 80);
			} else {
				const e = monsters.list.find(
					(e) =>
						isActive(e) &&
						Math.hypot(enemyX(e) - at.x, enemyY(e) - at.y) < TILE * SPARK_REACH,
				);
				if (e) {
					this.world.hit(e);
					hit = true;
				}
			}
			if (hit) {
				effects.stop(s.trail);
			}
			return !hit;
		});
	}

	/** stop every spark, their trails fading out */
	clear() {
		for (const s of this.list) {
			this.world.effects.stop(s.trail);
		}
		this.list = [];
	}

	/** each spark: a glow, and a white-hot core */
	draw(r: Renderer) {
		for (const s of this.list) {
			drawGlow(r, s.at.x, s.at.y, 16, SPARK_COLOR, 1);
			r.setColor("#ffffff");
			r.fillEllipse(s.at.x, s.at.y, 5, 5);
		}
	}
}
