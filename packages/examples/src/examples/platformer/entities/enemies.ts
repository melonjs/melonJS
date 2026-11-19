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
				// raised from 3 with the 20.2 particle transform fix — see
				// the CHANGELOG; bursts no longer gain radius as they fade
				speed: 4.5,
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

// the purple of the slime's body, as it is in the texture atlas
const SLIME_COLOR = "#E98AF4";

// a drop of slime, in pixels: wider than tall, as a drop lies on the ground
const DROP_WIDTH = 16;
const DROP_HEIGHT = 6;

let dropImage: HTMLCanvasElement | undefined;

/**
 * A drop of slime: a white blob, made once and tinted by the emitter that
 * draws it.
 */
function dropTexture() {
	if (dropImage === undefined) {
		dropImage = document.createElement("canvas");
		dropImage.width = DROP_WIDTH;
		dropImage.height = DROP_HEIGHT;
		const context = dropImage.getContext("2d");
		if (context) {
			context.fillStyle = "#fff";
			context.beginPath();
			context.ellipse(
				DROP_WIDTH / 2,
				DROP_HEIGHT / 2,
				DROP_WIDTH / 2,
				DROP_HEIGHT / 2,
				0,
				0,
				Math.PI * 2,
			);
			context.fill();
		}
	}
	return dropImage;
}

// the slime pooled under the body: how thick, and how far it reaches past
// each end of the sprite
const POOL_HEIGHT = 6;
const POOL_MARGIN = 2;

const poolImages = new Map<number, HTMLCanvasElement>();

/**
 * The pool of slime a slime stands in: a bar with round ends, in its colour,
 * made once for each width.
 */
function poolTexture(width: number) {
	let image = poolImages.get(width);
	if (image === undefined) {
		image = document.createElement("canvas");
		image.width = width;
		image.height = POOL_HEIGHT;
		const context = image.getContext("2d");
		if (context) {
			context.fillStyle = SLIME_COLOR;
			context.beginPath();
			context.roundRect(0, 0, width, POOL_HEIGHT, POOL_HEIGHT / 2);
			context.fill();
		}
		poolImages.set(width, image);
	}
	return image;
}

/**
 * The trail a slime leaves on the ground: drops that stay where they fell
 * (`referenceSpace: "world"`) while the slime moves on, and shrink away.
 *
 * They are dropped along the base of the sprite, on one line, and drawn
 * behind it, where the pool the slime stands in ends.
 */
class SlimeTrail extends ParticleEmitter {
	slime: SlimeEnemyEntity;

	constructor(slime: SlimeEnemyEntity) {
		// the emitter centres its spawn area on the point it is given: the
		// middle of the slime's base
		super(slime.centerX, slime.pos.y + slime.height, {
			image: dropTexture(),
			// a drop is born whole inside the base, not hanging off its ends
			width: slime.width - DROP_WIDTH,
			height: 1,
			referenceSpace: "world",
			tint: SLIME_COLOR,
			totalParticles: 80,
			// one drop at a time, over thirty a second: they run into each
			// other under the slime, and break up as they dry behind it
			maxParticles: 1,
			frequency: 30,
			// they do not move: a drop settles where it fell
			speed: 0,
			speedVariation: 0,
			minLife: 1200,
			maxLife: 2200,
			minStartScale: 0.8,
			maxStartScale: 1.1,
			minEndScale: 0,
			maxEndScale: 0.2,
			// gone by itself once the stream is stopped and the last drop
			// has dried
			autoDestroyOnComplete: true,
		});
		this.slime = slime;
	}

	override update(dt: number) {
		// follow the slime: `pos` is the top left of the spawn area
		if (this.slime.alive) {
			this.setPosition(
				this.slime.centerX - this.width / 2,
				this.slime.pos.y + this.slime.height - this.height / 2,
			);
		}
		return super.update(dt);
	}
}

/**
 * A Slime enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
export class SlimeEnemyEntity extends PathEnemyEntity {
	trail: SlimeTrail | undefined;
	pool: Sprite | undefined;

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

	/**
	 * Where the pool of slime under the body is: along the base of the
	 * sprite, half behind it and half below. The body stands a couple of
	 * pixels above the tile it walks on (its walk frame is shorter still),
	 * and the pool fills that strip from one end of the sprite to the other
	 */
	placePool() {
		this.pool?.setPosition(
			this.pos.x - POOL_MARGIN,
			this.pos.y + this.height - POOL_HEIGHT / 2,
		);
	}

	/**
	 * In the level: a pool of slime under the body and a trail behind it,
	 * both drawn just behind the slime
	 */
	onActivateEvent() {
		this.pool = new Sprite(0, 0, {
			image: poolTexture(this.width + POOL_MARGIN * 2),
			anchorPoint: { x: 0, y: 0 },
		});
		this.placePool();
		this.ancestor.addChild(this.pool, this.pos.z - 0.5);

		this.trail = new SlimeTrail(this);
		this.ancestor.addChild(this.trail, this.pos.z - 0.5);
		this.trail.streamParticles();
	}

	/**
	 * the pool follows the slime
	 */
	update(dt) {
		const updated = super.update(dt);
		this.placePool();
		return updated;
	}

	/**
	 * Out of the level (squashed, or the level is over): the pool goes with
	 * the slime, and no new drops fall. The ones on the ground dry up, and
	 * the emitter goes with the last of them
	 */
	onDeactivateEvent() {
		// unless the level took them away first
		if (this.pool?.ancestor) {
			this.pool.ancestor.removeChild(this.pool);
		}
		if (this.trail?.ancestor) {
			this.trail.stopStream();
		}
		this.pool = undefined;
		this.trail = undefined;
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
