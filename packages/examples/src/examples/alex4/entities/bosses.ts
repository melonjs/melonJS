/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	audio,
	type CollisionResponse,
	collision,
	level,
	math,
	type PhysicsAdapter,
	Rect,
	type Renderable,
	Sprite,
	state,
	type TMXObject,
	timer,
	Vector2d,
} from "melonjs";
import {
	HEIGHT,
	jumpSpeed,
	PALETTE,
	TICK,
	WIN_KILL_GUARDIAN,
} from "../constants";
import { rumble } from "../gamepad";
import { gameState } from "../gameState";
import type { LevelMap, PlayScreen } from "../screens/play";
import { burst, dust, smoke } from "./effects";
import { enemyShapes, GenericEnemyEntity } from "./enemies";
import { Breakable } from "./level";
import type { Hazard, PlayerEntity } from "./player";
import { Spark } from "./projectiles";

/** tell the play screen, if this guardian was the one to beat */
function guardianDefeated() {
	const map = level.getCurrentLevel() as LevelMap;
	if ((map.win ?? 0) & WIN_KILL_GUARDIAN) {
		(state.current() as PlayScreen).onLevelComplete();
	}
}

/************************************************************************************/
/*                                                                                  */
/*      the spike truck: only a rolling Alex, hitting it from behind, hurts it      */
/*                                                                                  */
/************************************************************************************/
export class SpikeTruckEntity extends GenericEnemyEntity {
	/**
	 * the original took 1 of 100 energy on each tick the ball was in its back,
	 * about a quarter on each pass: here a hit is a pass
	 */
	energy = 4;
	private defeated = false;
	private engine = 0;

	constructor(x: number, y: number, settings: TMXObject) {
		super(
			x,
			y,
			settings,
			[
				"guard1_1",
				"guard1_2",
				"guard1_3",
				"guard1_4",
				"guard1_5",
				"guard1_6",
				"guard1_7",
				"guard1_8",
			],
			// the whole 32x32 truck, as in the original
			{ w: 32, h: 32, ox: 0 },
		);
		this.addAnimation(
			"walk",
			["guard1_1", "guard1_2", "guard1_3", "guard1_4"],
			100,
		);
		this.addAnimation(
			"hit",
			["guard1_5", "guard1_6", "guard1_7", "guard1_8"],
			100,
		);
		this.setCurrentAnimation("walk");

		this.stompable = this.flatable = this.rollable = this.shootable = false;
		this.alwaysUpdate = true;
	}

	override onActivateEvent() {
		super.onActivateEvent();
		// its engine runs all the time, as in the original
		this.engine = audio.play("engine", true);
	}

	override onDeactivateEvent() {
		super.onDeactivateEvent();
		audio.stop("engine", this.engine);
	}

	override touchPlayer(player: PlayerEntity) {
		if (!this.alive) {
			return;
		}
		// rolling into its back
		if (player.rolling && player.facingLeft === this.walkLeft) {
			if (!this.isFlickering()) {
				this.hit();
			}
		} else {
			player.hurt();
		}
	}

	private hit() {
		audio.play("hit");
		if (--this.energy > 0) {
			this.setCurrentAnimation("hit");
			this.flicker(1000, () => this.setCurrentAnimation("walk"));
		} else {
			this.kill(!this.walkLeft);
			audio.stop("engine", this.engine);
			// as in the original: up at -16, backwards at a pixel per tick
			this.body.setVelocity(this.walkLeft ? TICK : -TICK, -jumpSpeed(16));
			this.parentApp.viewport.shake(8, 400);
			rumble(300, 0.8, 0.8);
			// a puff of smoke, and down it goes
			burst(
				this.parentApp.world,
				this.pos.x + 64,
				this.pos.y + 32,
				48,
				PALETTE[1],
			);
		}
	}

	override update(dt: number) {
		if (!this.alive && !this.defeated) {
			// smoking all the way down, a puff every frame like the original
			smoke(
				this.parentApp.world,
				this.pos.x + math.random(32, 96),
				this.pos.y + this.height - math.random(64, 128),
			);
			if (this.pos.y > HEIGHT) {
				this.defeated = true;
				guardianDefeated();
			}
		}
		return super.update(dt);
	}
}

/************************************************************************************/
/*                                                                                  */
/*      the ground pounder: jumps on Alex. Jump on its head and its spikes come     */
/*      out: it then smashes the blocks it lands on, until it falls in the water    */
/*                                                                                  */
/************************************************************************************/
type PounderMode =
	| "wait"
	| "jump"
	| "spikes"
	| "spikejump"
	| "landed"
	| "fired"
	| "retracted"
	| "dead";

// the waits of the original, in ticks of 20 ms
const LONG_WAIT = 61 * 20;
const SPIKES_WAIT = 51 * 20;
const SHORT_WAIT = 11 * 20;

export class GroundPounderEntity extends Sprite implements Hazard {
	mode: PounderMode = "wait";
	private waitTimer = 0;
	private hitGround = false;
	private drilled = false;
	/** where its middle is heading to, above where Alex was */
	private targetX = 0;
	private adapter!: PhysicsAdapter;
	private vel = new Vector2d();

	constructor(x: number, y: number, settings: TMXObject) {
		const frames = [
			"guard2_1a",
			"guard2_1b",
			"guard2_2",
			"guard2_3",
			"guard2_4",
			"guard2_5",
			"guard2_6",
		];
		const atlas = gameState.atlas.getAnimationSettings(frames);
		super(x, y + settings.height - atlas.frameheight, {
			...atlas,
			anchorPoint: { x: 0, y: 0 },
		});
		this.addAnimation("wait", ["guard2_1a", "guard2_1b"], 100);
		this.addAnimation("jump", ["guard2_2"]);
		this.addAnimation("spikes", ["guard2_3"]);
		this.addAnimation("spikejump", ["guard2_4"]);
		this.addAnimation("landed", ["guard2_5"]);
		this.addAnimation("retract", ["guard2_6"]);
		this.setCurrentAnimation("wait");

		// the body is the lower part of the machine
		this.bodyDef = {
			type: "dynamic",
			shapes: enemyShapes(new Rect(0, 64, 128, 128)),
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask:
				collision.types.WORLD_SHAPE | collision.types.PLAYER_OBJECT,
			maxVelocity: { x: TICK, y: 46 },
		};
		this.alwaysUpdate = true;
	}

	override onActivateEvent() {
		this.adapter = this.parentApp.world.adapter;
		this.wait(LONG_WAIT);
	}

	override onDeactivateEvent() {
		timer.clearTimeout(this.waitTimer);
	}

	/** stay put for a while, then do the next thing */
	private wait(ms: number) {
		timer.clearTimeout(this.waitTimer);
		this.waitTimer = timer.setTimeout(() => this.next(), ms);
	}

	override update(dt: number) {
		// broke through some blocks: now falling like a stone
		if (this.drilled) {
			this.drilled = false;
			this.mode = "jump";
			this.setCurrentAnimation("jump");
		}

		if (this.mode === "jump" || this.mode === "spikejump") {
			if (this.hitGround) {
				this.land();
			} else {
				// drifting a pixel per tick to above Alex, as in the original
				const diff = this.targetX - (this.pos.x + this.width / 2);
				const vx = Math.abs(diff) < TICK ? 0 : Math.sign(diff) * TICK;
				this.body.setVelocity(vx, this.body.getVelocity(this.vel).y);
			}
		}
		this.hitGround = false;

		// fell into the water
		if (this.mode !== "dead" && this.pos.y > HEIGHT) {
			this.mode = "dead";
			audio.play("kill");
			guardianDefeated();
		}

		super.update(dt);
		return true;
	}

	/** done waiting, what's next (the sequence of the original) */
	private next() {
		switch (this.mode) {
			case "wait":
				this.jumpAtAlex("jump");
				break;
			case "spikes":
				this.jumpAtAlex("spikejump");
				break;
			case "landed":
				// fire three sparks up
				audio.play("shoot");
				for (let i = 0; i < 3; i++) {
					const vx = math.random(-2, 3) * TICK;
					const vy = -math.random(2, 7) * TICK;
					this.parentApp.world.addChild(
						new Spark(this.pos.x + 56, this.pos.y + 64, vx, vy),
						15,
					);
				}
				this.mode = "fired";
				this.wait(SHORT_WAIT);
				break;
			case "fired":
				this.setCurrentAnimation("retract");
				this.mode = "retracted";
				this.wait(SHORT_WAIT);
				break;
			case "retracted":
				this.setCurrentAnimation("wait");
				this.mode = "wait";
				this.wait(LONG_WAIT);
				break;
		}
	}

	/**
	 * jump to above Alex: the further, the higher, in the original's quarter
	 * pixels per tick: 10 to 30, or from 10 with the spikes out (kept under 40
	 * here, so it never falls through a whole tile in one frame)
	 */
	private jumpAtAlex(mode: "jump" | "spikejump") {
		const alex = this.parentApp.world.getChildByName("alex")[0];
		const middle = this.pos.x + this.width / 2;
		this.targetX = alex ? alex.pos.x + alex.width / 2 : middle;
		const half = Math.abs(this.targetX - middle) / 4 / 2;
		const dy = Math.min(Math.max(half, 10), mode === "jump" ? 30 : 40);
		this.mode = mode;
		this.setCurrentAnimation(mode);
		this.body.setVelocity(0, -jumpSpeed(dy));
	}

	private land() {
		this.body.setVelocity(0, this.body.getVelocity(this.vel).y);
		dust(this.parentApp.world, this.pos.x + 64, this.pos.y + this.height);
		audio.play("impact");
		// it is heavy
		const viewport = this.parentApp.viewport;
		viewport.shake(10, 350, viewport.AXIS.VERTICAL);
		rumble(250, 1, 0.4);
		if (this.mode === "spikejump") {
			this.mode = "landed";
			this.setCurrentAnimation("landed");
			this.wait(SPIKES_WAIT);
		} else {
			this.mode = "wait";
			this.setCurrentAnimation("wait");
			this.wait(LONG_WAIT);
		}
	}

	touchPlayer(player: PlayerEntity, fromAbove: boolean) {
		if (this.mode === "dead") {
			return;
		}
		if (fromAbove) {
			// bounce on its head, which makes it angry
			player.bounce(15);
			audio.play("jump");
			if (this.mode === "wait") {
				this.mode = "spikes";
				this.setCurrentAnimation("spikes");
				this.wait(SPIKES_WAIT);
			}
		} else {
			player.hurt();
		}
	}

	onCollisionStart(response: CollisionResponse, other: Renderable) {
		if (
			other.body.collisionType !== collision.types.WORLD_SHAPE ||
			response.normal.y > -0.7
		) {
			return;
		}
		if (this.mode === "spikejump" && other instanceof Breakable) {
			// spikes out: smash all the blocks it lands on, and fall through
			other.shatter();
			this.drilled = true;
		} else {
			// landed, see update()
			this.hitGround = true;
		}
	}
}
