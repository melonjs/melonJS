/**
 * melonJS — Starsweep: a spark Bolt zapped.
 *
 * It flies straight, a glowing `Trail` behind it, until it hits a wall,
 * leaves the board, or touches a monster, which pops. It finds monsters
 * with the engine's collision detection: it has a body, and its
 * `onCollisionStart` is called when that body touches a monster's.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type CollisionResponse,
	collision,
	Ellipse,
	Renderable,
	type Trail,
	Vector2d,
} from "melonjs";
import { cellUnder, REACH, TILE } from "../config/layout";
import type { Effects } from "../fx/Effects";
import { type Dir, DX, DY, idx, inBounds, Tile } from "../rules/board";
import { drawGlow, type Renderer } from "../utils/draw";
import type { Station } from "../world/Station";
import { Monster } from "./Monster";

/** a spark's speed, in cells per second */
const SPEED = 15;
/** how big a spark is drawn: its glow's radius */
const GLOW_SIZE = 16;
/** a spark's colour, and the burst where it stops */
export const SPARK_COLOR = "#fff2a8";

/** A spark in flight. */
export class Spark extends Renderable {
	/** where it is, which its trail follows */
	readonly at: Vector2d;
	/** the ribbon behind it */
	readonly trail: Trail;
	/** it hit something, and is done */
	spent = false;

	/**
	 * @param x - where it leaves from
	 * @param y - where it leaves from
	 * @param dir - the way it flies
	 * @param station - the board, for the walls
	 * @param effects - for its trail, and its burst on a wall
	 */
	constructor(
		x: number,
		y: number,
		readonly dir: Dir,
		private readonly station: Station,
		private readonly effects: Effects,
	) {
		super(x - GLOW_SIZE, y - GLOW_SIZE, GLOW_SIZE * 2, GLOW_SIZE * 2);
		this.anchorPoint.set(0, 0);
		// level.load clears the world of everything that is not persistent
		this.isPersistent = true;
		this.at = new Vector2d(x, y);
		this.trail = effects.trail(this.at);
		this.bodyDef = {
			type: "dynamic",
			shapes: [
				new Ellipse(GLOW_SIZE, GLOW_SIZE, REACH.spark * 2, REACH.spark * 2),
			],
			isSensor: true,
			gravityScale: 0,
			collisionType: collision.types.PROJECTILE_OBJECT,
			collisionMask: collision.types.ENEMY_OBJECT,
		};
	}

	/**
	 * Fly on; a wall or the board's edge stops it, in a little burst.
	 * @param dt - seconds
	 */
	step(dt: number) {
		const step = SPEED * TILE * dt;
		this.at.x += DX[this.dir] * step;
		this.at.y += DY[this.dir] * step;
		this.pos.set(this.at.x - GLOW_SIZE, this.at.y - GLOW_SIZE);
		const { x, y } = cellUnder(this.at.x, this.at.y);
		if (!inBounds(x, y) || this.station.tiles[idx(x, y)] === Tile.WALL) {
			this.effects.burst(this.at.x, this.at.y, SPARK_COLOR, 5, 80);
			this.spent = true;
		}
	}

	/** it touched a monster: one that is out pops, and the spark is done */
	onCollisionStart(_response: CollisionResponse, other: Renderable) {
		if (!this.spent && other instanceof Monster && other.isLoose) {
			this.spent = true;
			other.pop();
		}
	}

	/** a glow, and a white-hot core */
	override draw(r: Renderer) {
		drawGlow(r, this.at.x, this.at.y, GLOW_SIZE, SPARK_COLOR, 1);
		r.setColor("#ffffff");
		r.fillEllipse(this.at.x, this.at.y, 5, 5);
	}
}
