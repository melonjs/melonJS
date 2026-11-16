/**
 * melonJS — Starsweep: a spark Bolt zapped.
 *
 * It flies straight, a glowing `Trail` behind it, until it hits a wall,
 * leaves the board or pops a monster (`game/Sparks.ts` decides which).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Renderable, type Trail, Vector2d } from "melonjs";
import { cellUnder, TILE } from "../config/layout";
import { type Dir, DX, DY } from "../rules/board";
import { drawGlow, type Renderer } from "../utils/draw";

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

	/**
	 * @param x - where it leaves from
	 * @param y - where it leaves from
	 * @param dir - the way it flies
	 * @param makeTrail - the trail to follow it (see `fx/Effects.ts`)
	 */
	constructor(
		x: number,
		y: number,
		readonly dir: Dir,
		makeTrail: (target: Vector2d) => Trail,
	) {
		super(x - GLOW_SIZE, y - GLOW_SIZE, GLOW_SIZE * 2, GLOW_SIZE * 2);
		this.anchorPoint.set(0, 0);
		// level.load clears the world of everything that is not persistent
		this.isPersistent = true;
		this.at = new Vector2d(x, y);
		this.trail = makeTrail(this.at);
	}

	/** the cell it is over */
	get cell() {
		return cellUnder(this.at.x, this.at.y);
	}

	/**
	 * Fly on.
	 * @param dt - seconds
	 */
	step(dt: number) {
		const step = SPEED * TILE * dt;
		this.at.x += DX[this.dir] * step;
		this.at.y += DY[this.dir] * step;
		this.pos.set(this.at.x - GLOW_SIZE, this.at.y - GLOW_SIZE);
	}

	/** a glow, and a white-hot core */
	override draw(r: Renderer) {
		drawGlow(r, this.at.x, this.at.y, GLOW_SIZE, SPARK_COLOR, 1);
		r.setColor("#ffffff");
		r.fillEllipse(this.at.x, this.at.y, 5, 5);
	}
}
