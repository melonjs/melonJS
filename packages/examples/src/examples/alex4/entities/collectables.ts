/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	audio,
	Collectable,
	type CollisionResponse,
	collision,
	Rect,
	type Renderable,
	type TMXObject,
} from "melonjs";
import { gameState } from "../gameState";
import { shaders } from "../shaders";
import { burst, flash } from "./effects";
import { PlayerEntity } from "./player";

/**
 * a generic pickup: Alex eats it on contact
 */
class Pickup extends Collectable {
	constructor(x: number, y: number, settings: TMXObject, region: string) {
		super(
			x,
			y,
			Object.assign(settings, {
				anchorPoint: { x: 0, y: 0 },
				image: gameState.atlas,
				region,
				shapes: [new Rect(8, 8, 48, 48)],
			}),
		);
	}

	/** what happens when picked up */
	collect() {}

	onCollisionStart(_response: CollisionResponse, other: Renderable) {
		if (!(other instanceof PlayerEntity) || other.dying) {
			return;
		}
		// avoid any further collision and remove it
		this.body.setCollisionMask(collision.types.NO_OBJECT);
		this.parentApp.world.removeChild(this);
		this.collect();
		other.eat();
	}
}

/************************************************************************************/
/*      cherry: 10 points                                                           */
/************************************************************************************/
export class CherryEntity extends Pickup {
	static count = 0;

	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, "cherry");
		CherryEntity.count++;
	}

	override collect() {
		audio.play("cherry");
		gameState.score += 10;
		gameState.cherries++;
		// all the cherries of the level!
		if (gameState.cherries === CherryEntity.count) {
			flash(
				this.parentApp.world,
				"all100",
				this.pos.x + 16,
				this.pos.y,
				100,
				1000,
			);
		}
	}
}

/************************************************************************************/
/*      star: 100 points                                                            */
/************************************************************************************/
export class StarEntity extends Pickup {
	static count = 0;

	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, "star");
		this.addPostEffect(shaders.shine);
		StarEntity.count++;
	}

	override collect() {
		audio.play("star");
		gameState.score += 100;
		gameState.stars++;
		if (gameState.stars === StarEntity.count) {
			flash(
				this.parentApp.world,
				"all100",
				this.pos.x + 16,
				this.pos.y,
				100,
				1000,
			);
		}
	}
}

/************************************************************************************/
/*      heart: some energy, or 100 points when full                                 */
/************************************************************************************/
export class HeartEntity extends Pickup {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, "heart");
	}

	override collect() {
		audio.play("heart");
		if (gameState.energy < 2) {
			gameState.energy++;
		} else {
			gameState.score += 100;
		}
	}
}

/************************************************************************************/
/*      extra life                                                                  */
/************************************************************************************/
export class OneUpEntity extends Pickup {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, "oneup");
	}

	override collect() {
		audio.play("xtralife");
		gameState.lives++;
		burst(this.parentApp.world, this.pos.x + 32, this.pos.y + 32, 32);
	}
}

/************************************************************************************/
/*      egg: something to spit                                                      */
/************************************************************************************/
export class EggEntity extends Pickup {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings, "egg");
	}

	override collect() {
		audio.play("eat");
		gameState.eggs++;
	}
}
