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
	FlashEffect,
	type PhysicsAdapter,
	Rect,
	type Renderable,
	Sprite,
	state,
	type TMXObject,
	Tween,
	timer,
	Vector2d,
} from "melonjs";
import { HEIGHT, jumpSpeed, TICK } from "../constants";
import { rumble } from "../gamepad";
import { gameState } from "../gameState";
import { dust, flash, HIT_STOP, points, shake } from "./effects";
import type { Hazard, PlayerEntity, Touch } from "./player";
import type { Shootable } from "./projectiles";

/**
 * The bodies of the enemies have two shapes: a solid one, colliding with the
 * level only, and a trigger one to know when Alex or an egg touches them
 * (a trigger never pushes anyone, so enemies do not shove Alex around).
 */
export function enemyShapes(solid: Rect, hitbox: Rect = solid.clone()) {
	solid.collisionMask = collision.types.WORLD_SHAPE;
	hitbox.collisionMask =
		collision.types.PLAYER_OBJECT | collision.types.PROJECTILE_OBJECT;
	hitbox.isTrigger = true;
	return [solid, hitbox];
}

/**
 * The collision boxes of the original game, in its pixels (a quarter of
 * ours): `w` by `h` up from the feet, `ox` from the left of the sprite.
 */
type Box = { w: number; h: number; ox: number };
const HUMAN_BOX: Box = { w: 12, h: 14, ox: 2 };
const BIG_HUMAN_BOX: Box = { w: 12, h: 19, ox: 2 };

/************************************************************************************/
/*                                                                                  */
/*      a generic enemy                                                             */
/*                                                                                  */
/************************************************************************************/
export class GenericEnemyEntity extends Sprite implements Hazard, Shootable {
	alive = true;
	walkLeft = true;
	/** one pixel every other tick in the original */
	walkSpeed = TICK / 2;
	/** shaking, in its last second flat */
	private wobble = 0;
	/** jumped on, waiting to be eaten */
	flat = false;
	edible = false;

	// what can be done to it
	stompable = true;
	flatable = true;
	rollable = true;
	shootable = true;

	protected adapter!: PhysicsAdapter;
	protected vel = new Vector2d();
	private timers: number[] = [];

	constructor(
		x: number,
		y: number,
		settings: TMXObject,
		frames: string[],
		box = HUMAN_BOX,
	) {
		const atlas = gameState.atlas.getAnimationSettings(frames);
		// stand on the bottom of the Tiled object
		super(x, y + settings.height - atlas.frameheight, {
			...atlas,
			anchorPoint: { x: 0, y: 0 },
		});
		this.bodyDef = {
			type: "dynamic",
			shapes: enemyShapes(this.hitbox(box)),
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask:
				collision.types.WORLD_SHAPE |
				collision.types.PLAYER_OBJECT |
				collision.types.PROJECTILE_OBJECT,
			maxVelocity: { x: 2, y: 16 },
		};
	}

	override onActivateEvent() {
		this.adapter = this.parentApp.world.adapter;
	}

	/** the original collision box, at the bottom of the frame */
	protected hitbox({ w, h, ox }: Box) {
		return new Rect(ox * 4, this.height - h * 4, w * 4, h * 4);
	}

	override onDeactivateEvent() {
		for (const id of this.timers) {
			timer.clearTimeout(id);
		}
	}

	/** do something in a while (unless we are gone by then) */
	protected later(ms: number, fn: () => void) {
		this.timers.push(
			timer.setTimeout(() => {
				// gone, and maybe destroyed already: a flattened enemy eaten or
				// knocked out, or its level reloaded, before it got back up
				if (this.ancestor) {
					fn();
				}
			}, ms),
		);
	}

	override update(dt: number) {
		if (this.alive) {
			this.think();
		}
		// about to get up: shake, a pixel of the original each way
		if (this.wobble > 0) {
			this.currentTransform
				.identity()
				.translate(((this.wobble++ % 3) - 1) * 4, 0);
		}

		// fell out of the map
		if (this.pos.y > HEIGHT + 64) {
			this.parentApp.world.removeChild(this);
		}

		super.update(dt);
		return true;
	}

	/** what to do this frame, while alive */
	think() {
		const vel = this.body.getVelocity(this.vel);
		if (this.flat) {
			this.body.setVelocity(0, vel.y);
		} else {
			this.walk(vel.y);
		}
	}

	/** walk ahead */
	walk(vy: number) {
		this.body.setVelocity(this.walkLeft ? -this.walkSpeed : this.walkSpeed, vy);
		this.flipX(!this.walkLeft);
	}

	/** in the order the original checked it */
	touchPlayer(player: PlayerEntity, touch: Touch) {
		if (!this.alive) {
			return;
		}
		if (this.flat) {
			if (player.rolling) {
				if (touch.body) {
					this.kill(player.facingLeft);
				}
			} else if (touch.mouth && this.edible) {
				this.eaten(player);
			}
		} else if (touch.above && this.stompable && !player.rolling) {
			this.stomp(player.pos.y + 96);
			player.bounce();
		} else if (touch.body) {
			if (player.rolling && this.rollable) {
				this.kill(player.facingLeft);
			} else {
				player.hurt();
			}
		}
	}

	/** jumped on, Alex's feet at `feet` */
	stomp(feet: number) {
		state.freeze(HIT_STOP.stomp);
		shake(this.parentApp.viewport, "stomp");
		audio.play("stomp");
		// where they meet, as in the original: over its middle, at his feet
		flash(
			this.parentApp.world,
			"particle_bopp",
			this.pos.x + this.width / 2,
			feet,
		);
		if (this.flatable) {
			this.flat = true;
			this.edible = false;
			this.setCurrentAnimation("flat");
			this.later(250, () => {
				this.edible = true;
			});
			// get back on its feet after 5 seconds, shaking in the last one
			this.later(4000, () => {
				this.wobble = 1;
				this.later(1000, () => {
					this.wobble = 0;
					this.currentTransform.identity();
					if (this.flat && this.alive) {
						this.flat = false;
						this.setCurrentAnimation("walk");
					}
				});
			});
		} else {
			this.kill(false);
		}
	}

	/** miam miam */
	eaten(player: PlayerEntity) {
		this.alive = false;
		this.parentApp.world.removeChild(this);
		gameState.score += 50;
		points(this.parentApp, this.pos.x + this.width / 2, this.pos.y, 50);
		// an eaten enemy is an egg to spit (the original only had the eggs
		// lying around in a few levels)
		gameState.eggs++;
		audio.play("eat");
		player.eat();
	}

	shot(fromLeft: boolean) {
		if (this.alive) {
			this.kill(!fromLeft);
			// an egg hits as hard as a stomp: the enemy flashes, the
			// action holds still a moment and the screen shakes
			this.flashLight();
			state.freeze(HIT_STOP.stomp);
			shake(this.parentApp.viewport, "stomp");
			rumble(80, 0.3, 0.5);
		}
	}

	/**
	 * all over in the lightest green of the game (#deeed2), fading back in a
	 * third of a second
	 */
	private flashLight() {
		const effect = new FlashEffect(this.parentApp.renderer, {
			color: [222 / 255, 238 / 255, 210 / 255],
		});
		effect.setIntensity(1);
		this.addPostEffect(effect);
		const fade = { intensity: 1 };
		new Tween(fade)
			.to({ intensity: 0 }, { duration: 300 })
			.onUpdate(() => effect.setIntensity(fade.intensity))
			.start();
	}

	/** knocked out: flip over and fall out of the screen */
	kill(left: boolean) {
		this.alive = false;
		this.flat = false;
		audio.play("kill");
		this.flipY(true);
		this.body.setCollisionMask(collision.types.NO_OBJECT);
		this.adapter.setGravityScale(this, 1);
		this.body.setVelocity(left ? -2 : 2, -10);
		this.alwaysUpdate = true;
	}

	onCollisionActive(response: CollisionResponse, other: Renderable) {
		// bumped into a wall: turn around
		if (
			this.alive &&
			other.body.collisionType === collision.types.WORLD_SHAPE &&
			Math.abs(response.normal.x) > 0.7 &&
			response.normal.x > 0 === this.walkLeft
		) {
			this.walkLeft = !this.walkLeft;
		}
	}
}

/************************************************************************************/
/*      the small human: walks, and falls off the edges                             */
/************************************************************************************/
export class Enemy1Entity extends GenericEnemyEntity {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, [
			"enemy1_01",
			"enemy1_02",
			"enemy1_03",
			"enemy1_04",
			"enemy1_05",
		]);
		this.addAnimation(
			"walk",
			["enemy1_01", "enemy1_02", "enemy1_03", "enemy1_04"],
			100,
		);
		this.addAnimation("flat", ["enemy1_05"]);
		this.setCurrentAnimation("walk");
	}
}

/************************************************************************************/
/*      the big human, with a spear: walks back and forth on its platform           */
/************************************************************************************/
export class Enemy2Entity extends GenericEnemyEntity {
	startX: number;
	endX: number;

	constructor(x: number, y: number, settings: TMXObject) {
		super(
			x,
			y,
			settings,
			["enemy2_01", "enemy2_02", "enemy2_03", "enemy2_04", "enemy2_05"],
			BIG_HUMAN_BOX,
		);
		this.addAnimation(
			"walk",
			["enemy2_01", "enemy2_02", "enemy2_03", "enemy2_04"],
			100,
		);
		this.addAnimation("flat", ["enemy2_05"]);
		this.setCurrentAnimation("walk");

		// the Tiled object is the area to walk in, start from its right end
		this.startX = x;
		this.endX = x + settings.width - this.width;
		this.pos.x = this.endX;
	}

	override walk(vy: number) {
		if (this.walkLeft && this.pos.x <= this.startX) {
			this.walkLeft = false;
		} else if (!this.walkLeft && this.pos.x >= this.endX) {
			this.walkLeft = true;
		}
		super.walk(vy);
	}
}

/************************************************************************************/
/*      the crusher: falls on Alex when he walks under it                           */
/************************************************************************************/
export class CrusherEntity extends GenericEnemyEntity {
	startY: number;
	mode: "wait" | "fall" | "landed" | "rise" = "wait";
	private hitGround = false;
	private alex: Renderable | undefined;

	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, ["enemy3"]);
		this.addAnimation("idle", ["enemy3"]);
		this.setCurrentAnimation("idle");
		this.stompable = this.rollable = this.shootable = false;

		// it hangs on a chain: only the spiked bottom is solid
		this.bodyDef = {
			type: "dynamic",
			shapes: enemyShapes(new Rect(4, this.height - 64, 120, 64)),
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask:
				collision.types.WORLD_SHAPE | collision.types.PLAYER_OBJECT,
			gravityScale: 0,
			maxVelocity: { x: 0, y: 20 },
		};
		this.startY = this.pos.y;
	}

	override think() {
		switch (this.mode) {
			case "wait": {
				// looked up once, not on every frame
				this.alex ??= this.parentApp.world.getChildByName("alex")[0];
				const alex = this.alex;
				if (alex && Math.abs(alex.pos.x + 96 - (this.pos.x + 64)) < 128) {
					this.mode = "fall";
					this.adapter.setGravityScale(this, 1);
					// a little hop up first, as in the original
					this.body.setVelocity(0, -jumpSpeed(4));
				}
				break;
			}
			case "fall":
				if (this.hitGround) {
					this.mode = "landed";
					audio.play("impact");
					dust(this.parentApp.world, this.pos.x + 64, this.pos.y + this.height);
					// the ground shakes
					shake(this.parentApp.viewport, "crusher");
					rumble(150, 0.8, 0.3);
					// and back up, slowly
					this.later(500, () => {
						this.mode = "rise";
						this.adapter.setGravityScale(this, 0);
					});
				}
				break;
			case "rise":
				this.body.setVelocity(0, -TICK / 2);
				if (this.pos.y <= this.startY) {
					this.body.setVelocity(0, 0);
					this.mode = "wait";
				}
				break;
		}
		this.hitGround = false;
	}

	onCollisionStart(response: CollisionResponse, other: Renderable) {
		// only flag it here, and land in think()
		if (
			other.body.collisionType === collision.types.WORLD_SHAPE &&
			response.normal.y < -0.7
		) {
			this.hitGround = true;
		}
	}

	override touchPlayer(player: PlayerEntity, touch: Touch) {
		if (touch.body) {
			player.hurt();
		}
	}
}

/************************************************************************************/
/*      the fish: jumps out of the water, again and again                           */
/************************************************************************************/
/** the jump speeds of the fishes in the original, by height in tiles */
const FISH_JUMP = [8, 14, 18, 21, 23, 26, 28];
/** the wait in the water between two jumps, in steps */
const REST = 48;
/** how far off the screen a fish still moves (32 pixels of the original) */
const NEAR = 128;

class FishEntity extends GenericEnemyEntity {
	jumpSpeed: number;
	private jumping = false;
	/** steps before the next jump (none before the first one) */
	private rest = 0;
	private adapterPos = new Vector2d();

	constructor(x: number, y: number, settings: TMXObject, frames: string[]) {
		super(x, y, settings, frames);
		this.flatable = false;
		this.alwaysUpdate = true;

		// the original jump speeds, by how many tiles above the bottom of the
		// screen it was placed (it jumps from there, its feet at the bottom)
		const rows = Math.floor((HEIGHT - (this.pos.y + this.height)) / 64);
		this.jumpSpeed = jumpSpeed(FISH_JUMP[Math.min(Math.max(rows, 0), 6)]);
		// hidden under the screen until it jumps
		this.pos.y = HEIGHT + 40;

		// it swims through the walls and the water
		const hitbox = this.hitbox(HUMAN_BOX);
		hitbox.isTrigger = true;
		this.bodyDef = {
			type: "dynamic",
			shapes: [hitbox],
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask:
				collision.types.PLAYER_OBJECT | collision.types.PROJECTILE_OBJECT,
			gravityScale: 0,
			maxVelocity: { x: 0, y: 40 },
		};
	}

	/**
	 * As the original, which moves an enemy only while it is on the screen,
	 * or nearly: a fish jumps the moment it comes in sight, and waits between
	 * jumps only there. They would otherwise all have been jumping since the
	 * level started, out of step with each other, by the time Alex comes:
	 * the bounces off the jellyfish that level 8 is built on are then a
	 * matter of luck, when they are possible at all.
	 */
	private nearScreen() {
		const view = this.parentApp.viewport;
		return (
			this.pos.x > view.pos.x - NEAR &&
			this.pos.x < view.pos.x + view.width + NEAR
		);
	}

	private jump() {
		this.jumping = true;
		// from the bottom of the screen
		this.adapter.setPosition(
			this,
			this.adapterPos.set(this.pos.x, HEIGHT - this.height),
		);
		this.adapter.setGravityScale(this, 1);
		this.body.setVelocity(0, -this.jumpSpeed);
	}

	override think() {
		const vy = this.body.getVelocity(this.vel).y;
		if (this.jumping && vy > 0 && this.pos.y + this.height >= HEIGHT) {
			// back in the water, out of sight for a bit
			this.jumping = false;
			this.adapter.setGravityScale(this, 0);
			this.body.setVelocity(0, 0);
			this.adapter.setPosition(
				this,
				this.adapterPos.set(this.pos.x, HEIGHT + 40),
			);
			this.rest = REST;
		} else if (!this.jumping && this.nearScreen() && --this.rest <= 0) {
			this.jump();
		}
		this.onJump(vy);
	}

	onJump(_vy: number) {}
}

export class SpikeFishEntity extends FishEntity {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, ["enemy4"]);
		this.addAnimation("walk", ["enemy4"]);
		this.setCurrentAnimation("walk");
		this.stompable = false;
	}
}

export class JellyFishEntity extends FishEntity {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, ["enemy5_01", "enemy5_02"]);
		this.addAnimation("walk", ["enemy5_01"]);
		this.addAnimation("up", ["enemy5_02"]);
		this.setCurrentAnimation("walk");
	}

	override onJump(vy: number) {
		// stretched while going up
		this.setCurrentAnimation(vy < 0 ? "up" : "walk");
	}
}
