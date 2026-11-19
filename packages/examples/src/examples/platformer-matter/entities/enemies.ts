/**
 * melonJS — Platformer (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	audio,
	type CollisionResponse,
	type Container,
	collision,
	game,
	ParticleEmitter,
	type PhysicsAdapter,
	Rect,
	type Renderable,
	Sprite,
	Vector2d,
} from "melonjs";
import { gameState } from "../gameState";

/**
 * A base enemy entity using Sprite + adapter-managed body.
 * Follows a horizontal path defined by the box size in Tiled.
 */
class PathEnemyEntity extends Sprite {
	alive: boolean;
	startX: number;
	endX: number;
	walkLeft: boolean;
	isMovingEnemy: boolean;
	particleTint: string;
	protected maxVelX: number;
	protected maxVelY: number;
	// scratch only needed for `body.getVelocity(out)`; setVelocity takes
	// primitives so no second scratch is required.
	protected scratchVel = new Vector2d();
	// cached adapter ref for the few queries with no body-level equivalent
	// (setCollisionMask, setStatic) — set in onActivateEvent.
	protected adapter!: PhysicsAdapter;

	constructor(x, y, settings, frameNames: string[]) {
		// save the area size defined in Tiled
		const width = settings.width || settings.framewidth;

		super(x, y, {
			...gameState.texture.getAnimationSettings(frameNames),
			anchorPoint: { x: 0, y: 0 },
		});

		// hold our own velocity constants so the hot loop doesn't have to
		// read them back through the adapter every frame
		this.maxVelX = settings.velX || 1;
		this.maxVelY = settings.velY || 15;

		// declarative body — adapter-portable
		this.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, this.width, this.height)],
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask:
				collision.types.PLAYER_OBJECT | collision.types.WORLD_SHAPE,
			maxVelocity: { x: this.maxVelX, y: this.maxVelY },
			// a platformer actor must stay upright: since matter-adapter 2.0.0
			// `fixedRotation` follows matter's own default of `false`, so a
			// body that should never tip over asks for it
			fixedRotation: true,
		};

		this.startX = x;
		this.endX = x + width - settings.framewidth;
		this.pos.x = x + width - settings.framewidth;

		this.walkLeft = false;
		this.alwaysUpdate = false;
		this.isMovingEnemy = true;
		this.alive = true;
		this.particleTint = "#FFF";
	}

	onActivateEvent() {
		this.adapter = this.parentApp.world.adapter;
	}

	update(dt) {
		if (this.alive) {
			const body = this.body;
			// preserve gravity-driven Y velocity while we set X each frame
			const vel = body.getVelocity(this.scratchVel);
			if (this.walkLeft === true)
				if (this.pos.x <= this.startX) {
					this.walkLeft = false;
					this.flipX(true);
				} else {
					body.setVelocity(-this.maxVelX, vel.y);
				}

			if (this.walkLeft === false) {
				if (this.pos.x >= this.endX) {
					this.walkLeft = true;
					this.flipX(false);
				} else {
					body.setVelocity(this.maxVelX, vel.y);
				}
			}
		}

		return super.update(dt);
	}

	/**
	 * One-shot collision handler — fires when contact begins.
	 *
	 * Stomp detection: read `response.normal.y` — the MTV for `this`
	 * (the enemy). When the player lands on top, the enemy needs to be
	 * pushed DOWN to escape ⇒ `normal.y > 0.7`. The player side sees the
	 * mirrored normal (`< -0.7`), so both handlers always agree on
	 * whether the contact was a stomp. Identical contract on either
	 * adapter.
	 */
	onCollisionStart(response: CollisionResponse, other: Renderable) {
		if (
			!this.alive ||
			!other.body ||
			other.body.collisionType !== collision.types.PLAYER_OBJECT
		) {
			return;
		}
		// Stomp check via the contact normal, not the player's velocity.
		// Why not velocity: the adapter dispatches `onCollisionStart` to
		// the player first, and the player resets its own `vel.y` to
		// -JUMP_VEL inside its handler. By the time this enemy-side handler
		// runs, the player's vel.y has already flipped from "falling toward
		// me" to "bouncing up off me" — any velocity check here reads the
		// post-bounce state and rejects every real stomp.
		// Why not position alone: a taller player walking sideways into a
		// shorter enemy on the same ground has its centre Y ABOVE the
		// enemy's centre Y (taller → centre higher up) — a position-only
		// check false-positives that as a stomp.
		// `response.normal` is the MTV for `this` (the enemy). When the
		// player lands on top, the enemy needs to be pushed DOWN to
		// separate ⇒ `normal.y > 0.7`. The player side sees the mirrored
		// normal (`< -0.7`), so both handlers always agree on whether the
		// contact was a stomp.
		const stomped = response.normal.y > 0.7;
		if (!stomped) {
			return;
		}
		this.alive = false;
		// stop being a collidable target so the player passes through,
		// and freeze integration on us — both via the portable body API.
		this.body.setCollisionMask(collision.types.NO_OBJECT);
		this.body.setStatic(true);
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

		const parent = this.ancestor as Container | undefined;
		(parent ?? game.world).addChild(emitter, this.pos.z);
		parent?.removeChild(this);
		emitter.burstParticles();

		audio.play("enemykill", false);
		gameState.data.score += 150;
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

	constructor(x, y, settings) {
		super(x, y, settings, [
			"slime_normal.png",
			"slime_walk.png",
			"slime_dead.png",
		]);

		if (settings.animationspeed) {
			this.animationspeed = settings.animationspeed;
		}

		this.addAnimation("walk", ["slime_normal.png", "slime_walk.png"]);
		this.addAnimation("dead", ["slime_dead.png"]);
		this.setCurrentAnimation("walk");
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
	override onActivateEvent() {
		super.onActivateEvent();
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

	constructor(x, y, settings) {
		super(x, y, settings, ["fly_normal.png", "fly_fly.png", "fly_dead.png"]);

		const bobRange = settings.height || this.height;
		this.startY = y;
		this.endY = y + bobRange;
		this.flyUp = true;

		// fly enemy has its own Y limit — override the bodyDef cap before
		// auto-registration runs at addChild time
		this.maxVelY = settings.velY || 1;
		this.bodyDef.maxVelocity = { x: this.maxVelX, y: this.maxVelY };
		// fly bobs under its own control — opt out of world gravity so the
		// integrator doesn't fight the per-frame Y velocity we set below
		this.bodyDef.gravityScale = 0;

		if (settings.animationspeed) {
			this.animationspeed = settings.animationspeed;
		}

		this.addAnimation("walk", ["fly_normal.png", "fly_fly.png"]);
		this.addAnimation("dead", ["fly_dead.png"]);
		this.setCurrentAnimation("walk");
		this.particleTint = "#000000";
	}

	update(dt) {
		if (this.alive) {
			const body = this.body;
			// Fly enemy: control Y velocity directly each frame. Preserve
			// X (so the inherited PathEnemyEntity horizontal motion isn't
			// stomped). gravityScale is 0 in the TMX def for fly enemies,
			// so there's no gravity counter-force to fight.
			const vel = body.getVelocity(this.scratchVel);
			// On direction change, snap the new velocity in the same frame so
			// the integrator doesn't carry one frame's worth of overshoot
			// past the boundary.
			if (this.flyUp) {
				if (this.pos.y <= this.startY) {
					this.flyUp = false;
					body.setVelocity(vel.x, this.maxVelY);
				} else {
					body.setVelocity(vel.x, -this.maxVelY);
				}
			} else {
				if (this.pos.y >= this.endY) {
					this.flyUp = true;
					body.setVelocity(vel.x, -this.maxVelY);
				} else {
					body.setVelocity(vel.x, this.maxVelY);
				}
			}
		}

		return super.update(dt);
	}
}
