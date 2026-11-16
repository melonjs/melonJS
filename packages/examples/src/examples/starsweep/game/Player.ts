/**
 * melonJS — Starsweep: Bolt, as the player moves it.
 *
 * Where Bolt is, and where it is stepping to (a `Mover`, see `movers.ts`),
 * the way it faces, and how it is drawn: the `Bolt` sprite each level
 * builds from its map, with a shield ring around it while a shield is up.
 * Bolt walks the way the controls point, ice and arrows carry it on, it
 * lights each panel it lands on, and it falls off into open space.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Container, Tween } from "melonjs";
import { ACTOR_Z } from "../config/layout";
import { Actor, boltAnimation, GLOW, placeFalling } from "../entities/Actor";
import type { Bolt } from "../entities/Bolt";
import type { Controls } from "../input/Controls";
import {
	type Cell,
	canStep,
	type Dir,
	DX,
	DY,
	forcedDir,
	Tile,
} from "../rules/board";
import { drawGlow, type Renderer } from "../utils/draw";
import {
	beginStep,
	fallAway,
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

/** Bolt's walking speed, in cells per second */
const WALK_SPEED = 5.2;
/** Bolt's speed when ice or an arrow carries it */
const SLIDE_SPEED = 9;
/** seconds Bolt fades for when knocked out */
const KO_TIME = 1.3;
/** how far a knocked-out Bolt floats up as it fades, in pixels */
const KO_RISE = 16;
/** seconds Bolt cheers after picking something up */
const CHEER_TIME = 0.8;
/** how high Bolt hops when a level is cleared, in pixels, and how fast */
const HOP = { height: 10, speed: 8 };

/** how Bolt is drawn this frame, from what the game is doing */
export type BoltPose = "hidden" | "playing" | "knocked-out" | "cheering";

/** what Bolt needs from the game around it */
export interface PlayerWorld {
	readonly station: Station;
	readonly nav: Navigation;
	readonly controls: Controls;
	/** Bolt landed on a cell (lighting its panel is up to the game) */
	landed(cell: Cell): void;
	/** Bolt stepped off into open space */
	fellOff(): void;
}

/** Bolt's state: a mover, and the rest of what it is doing */
interface BoltState extends Mover {
	/** the way it looks; a slide on ice keeps it */
	facing: Dir;
	/** ice or an arrow is carrying it */
	forced: boolean;
	/** 0 on its feet; from 1 down to 0 as it falls (tweened); -1 once gone */
	falling: number;
	/** seconds it cannot be hurt for, after coming back */
	invuln: number;
}

/** Bolt, moved by the player. */
export class Player {
	private state: BoltState = Player.standing({ x: 0, y: 0 });
	/** the sprite, from the level's map; none before the first level */
	private sprite: Bolt | null = null;
	private readonly shieldRing = new Actor("shield");
	/** knocked out: fading and floating up, both tweened */
	private readonly ko = { alpha: 1, rise: 0 };
	/** > 0 while Bolt is pleased with itself */
	private cheer = 0;

	/**
	 * @param world - the game around Bolt
	 * @param actors - where the characters' sprites go
	 */
	constructor(
		private readonly world: PlayerWorld,
		private readonly actors: Container,
	) {
		this.shieldRing.isPersistent = true;
		actors.addChild(this.shieldRing, ACTOR_Z.shield);
	}

	/** Bolt standing still on a cell, facing down */
	private static standing(cell: Cell): BoltState {
		return {
			...standingOn(cell),
			facing: 2,
			forced: false,
			falling: 0,
			invuln: 0,
		};
	}

	/** where Bolt is across the screen */
	get x() {
		return moverX(this.state);
	}

	/** where Bolt is down the screen */
	get y() {
		return moverY(this.state);
	}

	/** the cell Bolt is on, or mostly on */
	get cell() {
		return nearestCell(this.state);
	}

	/** the way Bolt faces */
	get facing() {
		return this.state.facing;
	}

	/** false for a while after Bolt comes back */
	get canBeHurt() {
		return this.state.invuln <= 0;
	}

	/**
	 * The level built Bolt where its map's `Bolt` object is: draw it with
	 * the other characters, over the glows the field draws under them, in
	 * place of the last level's.
	 */
	take(bolt: Bolt) {
		if (this.sprite) {
			this.actors.removeChildNow(this.sprite);
		}
		this.sprite = bolt;
		bolt.isPersistent = true;
		// adding a child to another container moves it there
		this.actors.addChild(bolt, ACTOR_Z.bolt);
	}

	/**
	 * Bolt back on its feet at a cell, for a level or a new life.
	 * @param invuln - seconds it cannot be hurt for
	 */
	reset(start: Cell, invuln = 0) {
		this.state = Player.standing(start);
		this.state.invuln = invuln;
		this.ko.alpha = 1;
		this.ko.rise = 0;
		this.cheer = 0;
	}

	/**
	 * Walk the way the controls point, and let ice and arrows carry Bolt on.
	 * @param dt - seconds since the last frame
	 * @param going - whether play goes on; asked after each step, as landing
	 * can end it (a cleared level, a fall)
	 */
	update(dt: number, going: () => boolean) {
		const p = this.state;
		p.invuln = Math.max(0, p.invuln - dt);
		this.cheer = Math.max(0, this.cheer - dt);
		walk(p, dt, {
			speed: () => (p.forced ? SLIDE_SPEED : WALK_SPEED),
			next: () => {
				const d = this.world.controls.dir;
				if (d === -1) {
					return false;
				}
				p.facing = d;
				return this.startStep(d, false);
			},
			arrive: () => this.arrive(),
			going,
		});
	}

	/**
	 * Begin one of Bolt's steps.
	 * @param d - which way
	 * @param forced - ice or an arrow carries it
	 * @returns false when the way is blocked
	 */
	private startStep(d: Dir, forced: boolean) {
		const p = this.state;
		const { station, nav } = this.world;
		if (!canStep(station.ground(p.toX + DX[d], p.toY + DY[d]), forced)) {
			return false;
		}
		// a cracked panel gives way once Bolt steps off it: monsters keep off
		if (station.stepOff(p.toX, p.toY)) {
			nav.keepOff({ x: p.toX, y: p.toY });
		}
		beginStep(p, d);
		p.forced = forced;
		return true;
	}

	/** Bolt reached a cell: it falls, or lands and may be carried on */
	private arrive() {
		const p = this.state;
		land(p);
		const g = this.world.station.ground(p.toX, p.toY);
		if (g === Tile.VOID) {
			this.world.fellOff();
			return;
		}
		this.world.landed({ x: p.toX, y: p.toY });
		const f = forcedDir(g, p.dir);
		if (f !== -1) {
			// an arrow turns Bolt round; ice slides it on as it was
			p.facing = g === Tile.ICE ? p.facing : f;
			p.forced = this.startStep(f, true);
		} else {
			p.forced = false;
		}
	}

	/** Bolt picked something up: a little cheer */
	cheerUp() {
		this.cheer = CHEER_TIME;
	}

	/** Bolt falls off into space */
	fall() {
		fallAway(this.state);
	}

	/** Bolt was caught: X eyes, floating up as it fades away */
	knockOut() {
		new Tween(this.ko)
			.to({ alpha: 0, rise: KO_RISE }, { duration: KO_TIME * 1000 })
			.start();
	}

	/**
	 * Put the sprite where Bolt is, playing what it is doing.
	 * @param pose - what the game is doing
	 * @param time - seconds since the game started doing it
	 * @param shield - whether a shield is up
	 */
	place(pose: BoltPose, time: number, shield: boolean) {
		const sprite = this.sprite;
		const p = this.state;
		let ring = false;
		if (!sprite) {
			this.shieldRing.alpha = 0;
			return;
		}
		if (pose === "hidden") {
			sprite.alpha = 0;
		} else if (pose === "knocked-out") {
			sprite.play("bolt-ko");
			if (p.falling > 0) {
				// tumbling down into space
				placeFalling(sprite, this.x, this.y, p.falling);
			} else if (p.falling === 0) {
				// knocked out: floats up as it fades away
				sprite.place(this.x, this.y - this.ko.rise, 1, this.ko.alpha);
			} else {
				sprite.alpha = 0;
			}
		} else if (pose === "cheering") {
			// a little victory hop
			const hop = Math.abs(Math.sin(time * HOP.speed)) * HOP.height;
			sprite.play("bolt-cheer");
			sprite.place(this.x, this.y - hop);
		} else {
			// blinking while it cannot be hurt
			const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
			sprite.play(
				this.cheer > 0
					? "bolt-cheer"
					: boltAnimation(p.moving && !p.forced, p.facing),
			);
			sprite.place(this.x, this.y, 1, blink ? 0.35 : 1);
			ring = shield;
		}
		this.shieldRing.place(sprite.pos.x, sprite.pos.y, 1, ring ? 1 : 0);
	}

	/** the soft glow under Bolt, drawn before the sprites */
	drawGlow(r: Renderer) {
		const sprite = this.sprite;
		if (sprite && sprite.alpha > 0) {
			drawGlow(
				r,
				sprite.pos.x,
				sprite.pos.y,
				28,
				GLOW.bolt,
				0.8 * sprite.alpha,
			);
		}
	}
}
