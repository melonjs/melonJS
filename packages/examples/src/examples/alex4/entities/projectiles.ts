/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type CollisionResponse,
	collision,
	game,
	Rect,
	type Renderable,
	Sprite,
} from "melonjs";
import { gameState } from "../gameState";
import { burst } from "./effects";
import type { PlayerEntity } from "./player";

/** something that can be killed by an egg */
export interface Shootable {
	shootable: boolean;
	shot(fromLeft: boolean): void;
}

type ProjectileSettings = {
	frames: string[];
	vx: number;
	vy?: number;
	gravityScale?: number;
	collisionType: number;
	collisionMask: number;
};

/**
 * base class for everything that flies and stops at the first wall
 */
class Projectile extends Sprite {
	vx: number;
	vy: number;
	private done = false;

	constructor(x: number, y: number, settings: ProjectileSettings) {
		super(x, y, {
			...gameState.atlas.getAnimationSettings(settings.frames),
			anchorPoint: { x: 0, y: 0 },
		});
		this.addAnimation("fly", settings.frames, 80);
		this.setCurrentAnimation("fly");
		// the original sprites look to the left
		this.flipX(settings.vx > 0);

		this.vx = settings.vx;
		this.vy = settings.vy ?? 0;
		const shape = new Rect(0, 0, this.width, this.height);
		// a trigger reports the hits, but never pushes or gets pushed
		shape.isTrigger = true;
		this.bodyDef = {
			type: "dynamic",
			shapes: [shape],
			gravityScale: settings.gravityScale ?? 0,
			maxVelocity: { x: Math.abs(this.vx), y: 20 },
			collisionType: settings.collisionType,
			collisionMask: settings.collisionMask,
		};
		this.alwaysUpdate = true;
	}

	override onActivateEvent() {
		this.body.setVelocity(this.vx, this.vy);
	}

	override update(dt: number) {
		super.update(dt);
		if (!this.inViewport) {
			this.explode(false);
		}
		return true;
	}

	/** hit something */
	protected explode(withBurst = true) {
		if (this.done) {
			return;
		}
		this.done = true;
		if (withBurst) {
			burst(this.pos.x + this.width / 2, this.pos.y + this.height / 2, 8);
		}
		game.world.removeChild(this);
	}

	onCollisionStart(_response: CollisionResponse, other: Renderable) {
		if (other.body.collisionType === collision.types.WORLD_SHAPE) {
			this.explode();
		}
	}
}

/********************************************************************************/
/*      an egg, spit by Alex                                                    */
/********************************************************************************/
export class EggShot extends Projectile {
	constructor(x: number, y: number, left: boolean) {
		super(x, y, {
			frames: ["egg2"],
			vx: left ? -8 : 8,
			collisionType: collision.types.PROJECTILE_OBJECT,
			collisionMask: collision.types.WORLD_SHAPE | collision.types.ENEMY_OBJECT,
		});
	}

	override onCollisionStart(response: CollisionResponse, other: Renderable) {
		if (other.body.collisionType !== collision.types.ENEMY_OBJECT) {
			super.onCollisionStart(response, other);
			return;
		}
		const enemy = other as unknown as Shootable;
		if (enemy.shootable) {
			enemy.shot(this.vx > 0);
			this.explode();
		}
	}
}

/********************************************************************************/
/*      things fired at Alex                                                    */
/********************************************************************************/
class EnemyShot extends Projectile {
	touchPlayer(player: PlayerEntity) {
		player.hurt();
		this.explode();
	}
}

/** the hidden cannons fire these */
export class CannonBall extends EnemyShot {
	constructor(x: number, y: number, left: boolean) {
		super(x, y, {
			frames: ["enemy6"],
			vx: left ? -5 : 5,
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask:
				collision.types.WORLD_SHAPE | collision.types.PLAYER_OBJECT,
		});
	}
}

/** the ground pounder fires these, and they fall down */
export class Spark extends EnemyShot {
	constructor(x: number, y: number, vx: number, vy: number) {
		super(x, y, {
			frames: ["bullet_1", "bullet_2"],
			vx,
			vy,
			gravityScale: 0.2,
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask:
				collision.types.WORLD_SHAPE | collision.types.PLAYER_OBJECT,
		});
	}
}
