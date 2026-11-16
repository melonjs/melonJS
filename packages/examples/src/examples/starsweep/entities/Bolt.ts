/**
 * melonJS — Starsweep: Bolt, the robot the player moves.
 *
 * Each map's `actors` object layer has one `Bolt` object, where Bolt
 * begins. This class is registered under that name
 * (`registerTiledObjectClass`, in `ExampleStarsweep.ts`), so `level.load`
 * builds one there; the field then takes it in (`join`) and steps it.
 *
 * Bolt walks the board cell to cell (`movers.ts`) the way the controls
 * point, ice and arrows carry it on, it lights each panel it lands on, and
 * it falls off into open space. A shield ring shows round it while a shield
 * is up.
 *
 * It has a body for the engine's collision detection, and reacts to what
 * it touches in `onCollisionActive`: a monster catches it (or pops, under a
 * shield), a power-up is picked up. Its knock-out and its fall make their
 * own sound and particles; the field only counts the lives.
 *
 * The field steps Bolt itself (`step`), in a fixed order with the rest of
 * the game; the engine's own `update` only plays its animation.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type CollisionResponse,
	type Container,
	collision,
	game,
	type Renderable,
	Tween,
} from "melonjs";
import * as sfx from "../audio/sfx";
import { ACTOR_Z, REACH } from "../config/layout";
import type { Effects } from "../fx/Effects";
import { aberrationBurst } from "../fx/screenFx";
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
import type { Navigation } from "../world/Navigation";
import type { Station } from "../world/Station";
import {
	Actor,
	boltAnimation,
	characterBody,
	GLOW,
	placeFalling,
} from "./Actor";
import { Monster } from "./Monster";
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
import { type PowerKind, PowerUp } from "./PowerUp";

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
/** the flash of sparks when Bolt is caught */
const KO_COLOR = "#fff2a8";
/** how hard the screen shakes when Bolt is caught: pixels, milliseconds */
const KO_SHAKE = { strength: 8, duration: 350 };
/** how much the colours split when Bolt is caught, and when it falls */
const KO_ABERRATION = 9;
const FALL_ABERRATION = 4;
/** how high Bolt hops when a level is cleared, in pixels, and how fast */
const HOP = { height: 10, speed: 8 };

/** how Bolt is drawn this frame, from what the game is doing */
export type BoltPose = "hidden" | "playing" | "knocked-out" | "cheering";

/** what Bolt needs from the game around it */
export interface BoltWorld {
	readonly station: Station;
	readonly nav: Navigation;
	readonly controls: Controls;
	readonly effects: Effects;
	/** where the characters' sprites go */
	readonly actors: Container;
	/** whether play is on: Bolt only moves, catches and is caught then */
	playing(): boolean;
	/** whether a shield is up: monsters that touch Bolt pop */
	shielded(): boolean;
	/** Bolt landed on a cell (lighting its panel is up to the game) */
	landed(cell: Cell): void;
	/**
	 * Bolt was caught, or fell: a life is lost
	 * @param caught - true if a monster caught it, false if it fell
	 */
	lost(caught: boolean): void;
	/** Bolt picked a power-up up */
	collected(kind: PowerKind): void;
}

/** Bolt, as a map places it and the player moves it. */
export class Bolt extends Actor {
	/** where Bolt stands, or the step it is taking */
	private walker: Mover;
	/** the way it looks; a slide on ice keeps it */
	private facingDir: Dir = 2;
	/** ice or an arrow is carrying it */
	private forced = false;
	/** 0 on its feet; from 1 down to 0 as it falls (tweened); -1 once gone */
	falling = 0;
	/** seconds it cannot be hurt for, after coming back */
	invuln = 0;
	/** > 0 while Bolt is pleased with itself */
	private cheer = 0;
	/** knocked out: fading and floating up, both tweened */
	private readonly ko = { alpha: 1, rise: 0 };
	private readonly shieldRing = new Actor("shield");
	private world: BoltWorld | null = null;

	/**
	 * @param x - the object's x, in the map
	 * @param y - the object's y, in the map
	 */
	constructor(x: number, y: number) {
		super("bolt-idle-down");
		this.place(x, y);
		this.walker = standingOn({ x: 0, y: 0 });
		this.bodyDef = characterBody(
			REACH.bolt,
			collision.types.PLAYER_OBJECT,
			collision.types.ENEMY_OBJECT | collision.types.COLLECTABLE_OBJECT,
		);
	}

	/**
	 * Take Bolt into the game: it is drawn with the other characters, over
	 * the glows the field draws under them (adding a child to another
	 * container moves it there), with its shield ring.
	 * @param world - the game around Bolt
	 */
	join(world: BoltWorld) {
		this.world = world;
		this.isPersistent = true;
		this.shieldRing.isPersistent = true;
		world.actors.addChild(this, ACTOR_Z.bolt);
		world.actors.addChild(this.shieldRing, ACTOR_Z.shield);
	}

	/** take Bolt and its ring off the board, for the next level's */
	leave() {
		const actors = this.world?.actors;
		if (actors) {
			actors.removeChildNow(this.shieldRing);
			actors.removeChildNow(this);
		}
		this.world = null;
	}

	/** where Bolt is across the screen */
	get x() {
		return moverX(this.walker);
	}

	/** where Bolt is down the screen */
	get y() {
		return moverY(this.walker);
	}

	/** the cell Bolt is on, or mostly on */
	get cell() {
		return nearestCell(this.walker);
	}

	/** the way Bolt faces */
	get facing() {
		return this.facingDir;
	}

	/** false for a while after Bolt comes back */
	get canBeHurt() {
		return this.invuln <= 0;
	}

	/**
	 * Bolt back on its feet at a cell, facing down, for a level or a new life.
	 * @param invuln - seconds it cannot be hurt for
	 */
	reset(start: Cell, invuln = 0) {
		this.walker = standingOn(start);
		this.facingDir = 2;
		this.forced = false;
		this.falling = 0;
		this.invuln = invuln;
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
	step(dt: number, going: () => boolean) {
		const world = this.world;
		if (!world) {
			return;
		}
		this.invuln = Math.max(0, this.invuln - dt);
		this.cheer = Math.max(0, this.cheer - dt);
		walk(this.walker, dt, {
			speed: () => (this.forced ? SLIDE_SPEED : WALK_SPEED),
			next: () => {
				const d = world.controls.dir;
				if (d === -1) {
					return false;
				}
				this.facingDir = d;
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
		const w = this.walker;
		const { station, nav } = this.world as BoltWorld;
		if (!canStep(station.ground(w.toX + DX[d], w.toY + DY[d]), forced)) {
			return false;
		}
		// a cracked panel gives way once Bolt steps off it: monsters keep off
		if (station.stepOff(w.toX, w.toY)) {
			nav.keepOff({ x: w.toX, y: w.toY });
		}
		beginStep(w, d);
		this.forced = forced;
		return true;
	}

	/** Bolt reached a cell: it falls, or lands and may be carried on */
	private arrive() {
		const w = this.walker;
		const world = this.world as BoltWorld;
		land(w);
		const g = world.station.ground(w.toX, w.toY);
		if (g === Tile.VOID) {
			this.fall();
			return;
		}
		world.landed({ x: w.toX, y: w.toY });
		const f = forcedDir(g, w.dir);
		if (f !== -1) {
			// an arrow turns Bolt round; ice slides it on as it was
			this.facingDir = g === Tile.ICE ? this.facingDir : f;
			this.forced = this.startStep(f, true);
		} else {
			this.forced = false;
		}
	}

	/**
	 * Bolt touches something: a monster that is out catches it, or pops if a
	 * shield is up; a power-up is picked up. Called by the engine every step
	 * the two bodies touch.
	 */
	onCollisionActive(_response: CollisionResponse, other: Renderable) {
		const world = this.world;
		if (!world?.playing()) {
			return;
		}
		if (other instanceof Monster) {
			if (!other.isLoose) {
				return;
			}
			if (world.shielded()) {
				other.pop();
			} else if (this.canBeHurt) {
				this.knockOut();
			}
		} else if (other instanceof PowerUp) {
			const kind = other.collect();
			if (kind !== null) {
				this.cheer = CHEER_TIME;
				world.collected(kind);
			}
		}
	}

	/** Bolt falls off into space: a life is lost */
	fall() {
		const world = this.world;
		if (!world?.playing()) {
			return;
		}
		world.lost(false);
		fallAway(this);
		sfx.sfxFall();
		aberrationBurst(FALL_ABERRATION);
	}

	/**
	 * Bolt was caught: a flash of sparks and a shake, then X eyes, floating
	 * up as it fades away. A life is lost.
	 */
	private knockOut() {
		const world = this.world as BoltWorld;
		world.lost(true);
		sfx.sfxDie();
		world.effects.burst(this.x, this.y, KO_COLOR, 30, 220, 300);
		game.viewport.shake(KO_SHAKE.strength, KO_SHAKE.duration);
		aberrationBurst(KO_ABERRATION);
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
	pose(pose: BoltPose, time: number, shield: boolean) {
		let ring = false;
		if (pose === "hidden") {
			this.alpha = 0;
		} else if (pose === "knocked-out") {
			this.play("bolt-ko");
			if (this.falling > 0) {
				// tumbling down into space
				placeFalling(this, this.x, this.y, this.falling);
			} else if (this.falling === 0) {
				// knocked out: floats up as it fades away
				this.place(this.x, this.y - this.ko.rise, 1, this.ko.alpha);
			} else {
				this.alpha = 0;
			}
		} else if (pose === "cheering") {
			// a little victory hop
			const hop = Math.abs(Math.sin(time * HOP.speed)) * HOP.height;
			this.play("bolt-cheer");
			this.place(this.x, this.y - hop);
		} else {
			// blinking while it cannot be hurt
			const blink = this.invuln > 0 && Math.floor(this.invuln * 10) % 2 === 0;
			this.play(
				this.cheer > 0
					? "bolt-cheer"
					: boltAnimation(this.walker.moving && !this.forced, this.facingDir),
			);
			this.place(this.x, this.y, 1, blink ? 0.35 : 1);
			ring = shield;
		}
		this.shieldRing.place(this.pos.x, this.pos.y, 1, ring ? 1 : 0);
	}

	/** the soft glow under Bolt, drawn before the sprites */
	drawGlow(r: Renderer) {
		if (this.alpha > 0) {
			drawGlow(r, this.pos.x, this.pos.y, 28, GLOW.bolt, 0.8 * this.alpha);
		}
	}
}
