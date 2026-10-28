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
import { HEIGHT, PALETTE, WIN_KILL_GUARDIAN } from "../constants";
import { gameState } from "../gameState";
import type { LevelMap, PlayScreen } from "../screens/play";
import { burst, dust } from "./effects";
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
	energy = 4;
	private defeated = false;

	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, [
			"guard1_1",
			"guard1_2",
			"guard1_3",
			"guard1_4",
			"guard1_5",
			"guard1_6",
			"guard1_7",
			"guard1_8",
		]);
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
			this.body.setVelocity(this.walkLeft ? 2 : -2, -16);
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
type PounderMode = "wait" | "jump" | "spikes" | "spikejump" | "landed" | "dead";

export class GroundPounderEntity extends Sprite implements Hazard {
	mode: PounderMode = "wait";
	private waitTimer = 0;
	private hitGround = false;
	private drilled = false;
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
			maxVelocity: { x: 5, y: 30 },
		};
		this.alwaysUpdate = true;
	}

	override onActivateEvent() {
		this.adapter = this.parentApp.world.adapter;
		this.wait(1200);
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

		if (this.hitGround && (this.mode === "jump" || this.mode === "spikejump")) {
			this.land();
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

	/** done waiting, what's next */
	private next() {
		switch (this.mode) {
			case "wait":
				this.jumpAtAlex("jump");
				break;
			case "spikes":
				this.jumpAtAlex("spikejump");
				break;
			case "landed":
				// fire, then back to waiting
				audio.play("shoot");
				for (let i = 0; i < 3; i++) {
					const vx = math.randomFloat(-2, 2);
					const vy = -math.randomFloat(3, 7);
					this.parentApp.world.addChild(
						new Spark(this.pos.x + 56, this.pos.y + 40, vx, vy),
						15,
					);
				}
				this.setCurrentAnimation("retract");
				this.mode = "wait";
				this.wait(1200);
				break;
		}
	}

	private jumpAtAlex(mode: "jump" | "spikejump") {
		const alex = this.parentApp.world.getChildByName("alex")[0];
		const dx = alex ? alex.pos.x + 96 - (this.pos.x + 64) : 0;
		this.mode = mode;
		this.setCurrentAnimation(mode);
		this.body.setVelocity(
			Math.max(-5, Math.min(5, dx / 40)),
			-Math.min(Math.max(Math.abs(dx) / 16, 12), 20),
		);
	}

	private land() {
		this.body.setVelocity(0, this.body.getVelocity(this.vel).y);
		dust(this.parentApp.world, this.pos.x + 64, this.pos.y + this.height);
		audio.play("impact");
		if (this.mode === "spikejump") {
			this.mode = "landed";
			this.setCurrentAnimation("landed");
			this.wait(1000);
		} else {
			this.mode = "wait";
			this.setCurrentAnimation("wait");
			this.wait(1200);
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
				this.wait(1000);
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
