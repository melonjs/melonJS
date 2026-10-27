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
	game,
	input,
	type PhysicsAdapter,
	Rect,
	type Renderable,
	Sprite,
	state,
	type TMXObject,
	Vector2d,
} from "melonjs";
import { gameState } from "../gameState";
import type { PlayScreen } from "../screens/play";
import { Breakable, RollBlock } from "./level";
import { EggShot } from "./projectiles";

const WALK_SPEED = 3.5;
const ROLL_SPEED = 6.5;
const JUMP_SPEED = 17;

/** anything that hurts (or can be stomped by) Alex */
export interface Hazard {
	touchPlayer(player: PlayerEntity, fromAbove: boolean): void;
}

/********************************************************************************/
/*                                                                              */
/*      main player                                                             */
/*                                                                              */
/********************************************************************************/

export class PlayerEntity extends Sprite {
	facingLeft: boolean;
	rolling = false;
	eating = false;
	spitting = false;
	dying = false;
	grounded = false;
	private gone = false;
	private adapter!: PhysicsAdapter;
	private vel = new Vector2d();

	constructor(x: number, y: number, settings: TMXObject & { facing?: string }) {
		// the frames are 192x160: Alex stands in the middle column, feet 96px down
		super(x - 64, y + settings.height - 96, {
			...gameState.atlas.getAnimationSettings([
				"alex_walk0",
				"alex_walk1",
				"alex_walk2",
				"alex_walk3",
				"alex_full_walk0",
				"alex_full_walk1",
				"alex_full_walk2",
				"alex_full_walk3",
				"alex_jump",
				"alex_full_jump",
				"alex_spit",
				"alex_jump_spit",
				"alex_eat",
				"alex_ball0",
				"alex_ball1",
				"alex_ball2",
				"alex_ball3",
			]),
			anchorPoint: { x: 0, y: 0 },
		});
		this.name = "alex";

		this.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(76, 36, 40, 60)],
			collisionType: collision.types.PLAYER_OBJECT,
			maxVelocity: { x: ROLL_SPEED, y: JUMP_SPEED + 4 },
		};

		// keep updating when jumping out of the screen
		this.alwaysUpdate = true;

		this.addAnimation("stand", ["alex_walk0"]);
		this.addAnimation(
			"walk",
			["alex_walk0", "alex_walk1", "alex_walk2", "alex_walk3"],
			80,
		);
		this.addAnimation("full_stand", ["alex_full_walk0"]);
		this.addAnimation(
			"full_walk",
			[
				"alex_full_walk0",
				"alex_full_walk1",
				"alex_full_walk2",
				"alex_full_walk3",
			],
			80,
		);
		this.addAnimation("jump", ["alex_jump"]);
		this.addAnimation("full_jump", ["alex_full_jump"]);
		this.addAnimation("spit", ["alex_spit"], 160);
		this.addAnimation("jump_spit", ["alex_jump_spit"], 160);
		this.addAnimation("eat", ["alex_eat"], 160);
		this.addAnimation(
			"roll",
			["alex_ball0", "alex_ball1", "alex_ball2", "alex_ball3"],
			50,
		);
		this.setCurrentAnimation("stand");

		// the original sprites look to the left
		this.facingLeft = settings.facing === "left";
		this.flipX(!this.facingLeft);
	}

	override onActivateEvent() {
		const app = this.parentApp;
		this.adapter = app.world.adapter;
		app.viewport.follow(this, app.viewport.AXIS.HORIZONTAL, 0.1);
	}

	override update(dt: number) {
		if (this.dying) {
			// once out of the screen, let the play screen decide what's next
			if (!this.gone && this.pos.y > game.viewport.height) {
				this.gone = true;
				(state.current() as PlayScreen).onPlayerDeath();
			}
			return super.update(dt);
		}

		const vel = this.body.getVelocity(this.vel);
		this.grounded = this.adapter.isGrounded?.(this) ?? false;

		if (this.rolling) {
			vel.x = this.facingLeft ? -ROLL_SPEED : ROLL_SPEED;
		} else if (input.isKeyPressed("left")) {
			vel.x = -WALK_SPEED;
			this.face(true);
		} else if (input.isKeyPressed("right")) {
			vel.x = WALK_SPEED;
			this.face(false);
		} else {
			vel.x = 0;
		}

		if (input.isKeyPressed("jump") && this.grounded) {
			vel.y = -JUMP_SPEED;
			audio.play("jump");
		} else if (!input.keyStatus("jump") && vel.y < 0) {
			// let go of the button for a shorter jump
			vel.y /= 2;
		}
		this.body.setVelocity(vel.x, vel.y);

		if (input.isKeyPressed("fire")) {
			this.spit();
		}

		// fell in a hole
		if (this.pos.y > game.viewport.height - 96) {
			this.die();
		}

		this.updateAnimation(vel.x);
		super.update(dt);
		return true;
	}

	private face(left: boolean) {
		this.facingLeft = left;
		this.flipX(!left);
	}

	private updateAnimation(vx: number) {
		if (this.eating) {
			return;
		}
		const full = gameState.eggs > 0 ? "full_" : "";
		if (this.rolling) {
			this.setCurrentAnimation("roll");
		} else if (this.spitting) {
			this.setCurrentAnimation(this.grounded ? "spit" : "jump_spit", {
				loop: false,
				onComplete: () => {
					this.spitting = false;
				},
			});
		} else if (!this.grounded) {
			this.setCurrentAnimation(`${full}jump`);
		} else if (vx !== 0) {
			this.setCurrentAnimation(`${full}walk`);
		} else {
			this.setCurrentAnimation(`${full}stand`);
		}
	}

	/** chew whatever was just picked up */
	eat() {
		if (this.rolling || this.dying) {
			return;
		}
		this.eating = true;
		this.spitting = false;
		this.setCurrentAnimation("eat", {
			loop: false,
			onComplete: () => {
				this.eating = false;
			},
		});
	}

	/** spit an egg, if we have one */
	private spit() {
		if (this.rolling || this.spitting || gameState.eggs === 0) {
			return;
		}
		gameState.eggs--;
		this.spitting = true;
		this.eating = false;
		const x = this.facingLeft ? this.pos.x + 36 : this.pos.x + 128;
		game.world.addChild(
			new EggShot(x, this.pos.y + 40, this.facingLeft),
			this.depth,
		);
		audio.play("spit");
	}

	/** turn into a ball, until we hit a wall */
	startRoll() {
		if (this.rolling || !this.grounded || this.dying) {
			return;
		}
		this.rolling = true;
		this.eating = this.spitting = false;
		audio.play("turn");
	}

	private stopRoll() {
		this.rolling = false;
		this.body.setVelocity(0, this.body.getVelocity(this.vel).y);
		audio.play("hit");
	}

	/** jump off something we landed on */
	bounce(height = 8) {
		const vy = input.keyStatus("jump") ? -20 : -height;
		this.body.setVelocity(this.body.getVelocity(this.vel).x, vy);
	}

	/** ouch */
	hurt() {
		if (this.dying || this.isFlickering()) {
			return;
		}
		gameState.energy--;
		if (gameState.energy <= 0) {
			this.die();
		} else {
			audio.play("hurt");
			this.flicker(2000);
		}
	}

	/** so sad... */
	die() {
		if (this.dying) {
			return;
		}
		this.dying = true;
		this.rolling = false;
		gameState.lives--;
		gameState.energy = 0;
		gameState.eggs = 0;

		// flip upside down, jump and fall through everything
		this.flipY(true);
		this.setCurrentAnimation("jump");
		this.body.setCollisionMask(collision.types.NO_OBJECT);
		this.body.setVelocity(0, -15);

		audio.play("die");
		(state.current() as PlayScreen).onPlayerDying();
	}

	onCollisionStart(_response: CollisionResponse, other: Renderable) {
		if (this.dying) {
			return;
		}
		if (other instanceof RollBlock) {
			this.startRoll();
		} else if (other instanceof Breakable && this.rolling) {
			other.shatter();
		}
	}

	onCollisionActive(response: CollisionResponse, other: Renderable) {
		if (this.dying) {
			return;
		}
		switch (other.body.collisionType) {
			case collision.types.WORLD_SHAPE:
				// rolled into a wall
				if (
					this.rolling &&
					!(other instanceof Breakable) &&
					Math.abs(response.normal.x) > 0.7
				) {
					this.stopRoll();
				}
				break;

			case collision.types.ENEMY_OBJECT: {
				// landing on top of it?
				const fromAbove =
					response.normal.y < -0.7 && this.body.getVelocity(this.vel).y >= 0;
				(other as unknown as Hazard).touchPlayer(this, fromAbove);
				break;
			}
		}
	}
}
