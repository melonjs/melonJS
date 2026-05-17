/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	audio,
	Body,
	collision,
	game,
	ParticleEmitter,
	Rect,
	Sprite,
} from "melonjs";
import { gameState } from "../gameState";

/**
 * A base enemy entity using Sprite + Body
 * follow a horizontal path defined by the box size in Tiled
 */
class PathEnemyEntity extends Sprite {
	alive: boolean;
	startX: number;
	endX: number;
	walkLeft: boolean;
	isMovingEnemy: boolean;
	particleTint: string;

	/**
	 * constructor
	 */
	constructor(x, y, settings, frameNames: string[]) {
		// save the area size defined in Tiled
		const width = settings.width || settings.framewidth;

		// create the sprite from texture atlas animation frames
		super(x, y, {
			...gameState.texture.getAnimationSettings(frameNames),
			anchorPoint: { x: 0, y: 0 },
		});

		// add a physic body matching the sprite max frame dimensions
		this.body = new Body(this, new Rect(0, 0, this.width, this.height));

		// set start/end position based on the initial area size
		this.startX = x;
		this.endX = x + width - settings.framewidth;
		this.pos.x = x + width - settings.framewidth;

		this.walkLeft = false;

		// body walking & flying speed
		this.body.setMaxVelocity(settings.velX || 1, settings.velY || 15);

		// set a "enemyObject" type
		this.body.collisionType = collision.types.ENEMY_OBJECT;

		// only check for collision against player and world shape
		this.body.setCollisionMask(
			collision.types.PLAYER_OBJECT | collision.types.WORLD_SHAPE,
		);

		// don't update the entities when out of the viewport
		this.alwaysUpdate = false;

		// a specific flag to recognize these enemies
		this.isMovingEnemy = true;

		// living state
		this.alive = true;

		// default tint for particles
		this.particleTint = "#FFF";
	}

	/**
	 * manage the enemy movement
	 */
	update(dt) {
		if (this.alive) {
			if (this.walkLeft === true)
				if (this.pos.x <= this.startX) {
					// if reach start position
					this.walkLeft = false;
					this.flipX(true);
				} else {
					this.body.force.x = -this.body.maxVel.x;
				}
		}

		if (this.walkLeft === false) {
			if (this.pos.x >= this.endX) {
				// if reach the end position
				this.walkLeft = true;
				this.flipX(false);
			} else {
				this.body.force.x = this.body.maxVel.x;
			}
		}

		// return true if we moved of if flickering
		return super.update(dt);
	}

	/**
	 * collision handle
	 */
	onCollision(response, other) {
		if (other.body.collisionType === collision.types.WORLD_SHAPE) {
			// solid against world shapes (platforms, ground)
			return true;
		}

		// res.y >0 means touched by something on the bottom
		// which mean at top position for this one
		if (this.alive && response.overlapV.y > 0 && response.a.body.falling) {
			// make it dead
			this.alive = false;
			//avoid further collision and delete it
			this.body.setCollisionMask(collision.types.NO_OBJECT);
			// make the body static
			this.body.setStatic(true);
			// set dead animation
			this.setCurrentAnimation("dead");

			const emitter = new ParticleEmitter(this.centerX, this.centerY, {
				width: this.width / 4,
				height: this.height / 4,
				tint: this.particleTint,
				totalParticles: 32,
				angle: 0,
				angleVariation: 6.283185307179586,
				minLife: 400,
				maxLife: 800,
				speed: 3,
				autoDestroyOnComplete: true,
			});

			game.world.addChild(emitter, this.pos.z);
			game.world.removeChild(this);
			emitter.burstParticles();

			// dead sfx
			audio.play("enemykill", false);
			// give some score
			gameState.data.score += 150;
		}
		return false;
	}
}

/**
 * A Slime enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
export class SlimeEnemyEntity extends PathEnemyEntity {
	/**
	 * constructor
	 */
	constructor(x, y, settings) {
		// super constructor with slime frame names
		super(x, y, settings, [
			"slime_normal.png",
			"slime_walk.png",
			"slime_dead.png",
		]);

		// custom animation speed ?
		if (settings.animationspeed) {
			this.animationspeed = settings.animationspeed;
		}

		// walking animation
		this.addAnimation("walk", ["slime_normal.png", "slime_walk.png"]);
		// dead animation
		this.addAnimation("dead", ["slime_dead.png"]);

		// set default one
		this.setCurrentAnimation("walk");

		// particle tint matching the sprite color
		this.particleTint = "#FF35B8";
	}
}

/**
 * A Fly enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
export class FlyEnemyEntity extends PathEnemyEntity {
	startY: number;
	endY: number;
	flyUp: boolean;

	/**
	 * constructor
	 */
	constructor(x, y, settings) {
		// super constructor with fly frame names
		super(x, y, settings, ["fly_normal.png", "fly_fly.png", "fly_dead.png"]);

		// set vertical patrol range (bob up and down by half height)
		const bobRange = settings.height || this.height;
		this.startY = y;
		this.endY = y + bobRange;
		this.flyUp = true;

		// allow vertical movement
		this.body.setMaxVelocity(settings.velX || 1, settings.velY || 1);

		// custom animation speed ?
		if (settings.animationspeed) {
			this.animationspeed = settings.animationspeed;
		}

		// walking animation
		this.addAnimation("walk", ["fly_normal.png", "fly_fly.png"]);
		// dead animation
		this.addAnimation("dead", ["fly_dead.png"]);

		// set default one
		this.setCurrentAnimation("walk");

		// particle tint matching the sprite color
		this.particleTint = "#000000";
	}

	/**
	 * manage the fly movement (horizontal + vertical bobbing)
	 */
	update(dt) {
		if (this.alive) {
			// vertical bobbing — apply force against gravity to fly
			if (this.flyUp) {
				if (this.pos.y <= this.startY) {
					this.flyUp = false;
				} else {
					this.body.force.y = -this.body.maxVel.y;
				}
			} else {
				if (this.pos.y >= this.endY) {
					this.flyUp = true;
				} else {
					this.body.force.y = this.body.maxVel.y;
				}
			}
		}

		return super.update(dt);
	}
}
