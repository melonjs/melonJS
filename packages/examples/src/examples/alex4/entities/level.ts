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
	Rect,
	Renderable,
	Sprite,
	state,
	type TMXLayer,
	type TMXObject,
	Trigger,
	timer,
} from "melonjs";
import { gameState } from "../gameState";
import type { PlayScreen } from "../screens/play";
import { burst, shake } from "./effects";
import { PlayerEntity, type Touch } from "./player";
import { CannonBall } from "./projectiles";

/************************************************************************************/
/*                                                                                  */
/*      spikes: instant death                                                       */
/*                                                                                  */
/************************************************************************************/
export class SpikeEntity extends Renderable {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, settings.width, settings.height)],
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
			isSensor: true,
		};
	}

	touchPlayer(player: PlayerEntity, touch: Touch) {
		// the original killed when Alex's middle was in the cell
		if (touch.middle) {
			player.die();
		}
	}
}

/************************************************************************************/
/*                                                                                  */
/*      a spinning block: turns Alex into a ball                                    */
/*                                                                                  */
/************************************************************************************/
export class RollBlock extends Sprite {
	constructor(x: number, y: number) {
		const frames = ["spin1", "spin2", "spin3", "spin4"];
		super(x, y, {
			...gameState.atlas.getAnimationSettings(frames),
			anchorPoint: { x: 0, y: 0 },
		});
		this.addAnimation("spin", frames, 80);
		this.setCurrentAnimation("spin");

		// triggered when standing on it
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(8, -8, 48, 16)],
			collisionType: collision.types.ACTION_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
			isSensor: true,
		};
	}
}

/************************************************************************************/
/*                                                                                  */
/*      a block that breaks when hit by a rolling Alex (or a jumping guardian)      */
/*                                                                                  */
/************************************************************************************/
export class Breakable extends Renderable {
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, settings.width, settings.height)],
			collisionType: collision.types.WORLD_SHAPE,
		};
	}

	shatter() {
		if (!this.ancestor) {
			return;
		}
		// the block itself is drawn by the foreground layer
		const layer = this.parentApp.world.getChildByName(
			"Foreground",
		)[0] as TMXLayer;
		layer.clearTile(Math.round(this.pos.x / 64), Math.round(this.pos.y / 64));
		this.parentApp.world.removeChild(this);

		burst(this.parentApp.world, this.pos.x + 32, this.pos.y + 32, 32);
		shake(this.parentApp.viewport, "shatter");
		audio.play("crush");
	}
}

/************************************************************************************/
/*                                                                                  */
/*      a hidden cannon, firing at Alex                                             */
/*                                                                                  */
/************************************************************************************/
export class CannonEntity extends Renderable {
	private fireTimer = 0;

	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
	}

	override onActivateEvent() {
		this.fireTimer = timer.setInterval(() => this.fire(), 2500);
	}

	override onDeactivateEvent() {
		timer.clearInterval(this.fireTimer);
	}

	private fire() {
		const alex = this.parentApp.world.getChildByName("alex")[0];
		if (alex && this.inViewport) {
			const left = alex.pos.x + 96 < this.pos.x + 32;
			const x = left ? this.pos.x - 52 : this.pos.x + 64;
			this.parentApp.world.addChild(
				new CannonBall(x, this.pos.y + 4, left),
				15,
			);
			burst(
				this.parentApp.world,
				left ? this.pos.x : this.pos.x + 64,
				this.pos.y + 32,
				8,
			);
			audio.play("shoot");
		}
	}
}

/************************************************************************************/
/*                                                                                  */
/*      Lola, waiting in her cage                                                   */
/*                                                                                  */
/************************************************************************************/
export class LolaEntity extends Sprite {
	constructor(x: number, y: number) {
		super(x, y, {
			image: gameState.atlas,
			region: "lola",
			anchorPoint: { x: 0, y: 0 },
		});
	}
}

/************************************************************************************/
/*                                                                                  */
/*      the level exit                                                              */
/*                                                                                  */
/************************************************************************************/
export class ExitEntity extends Trigger {
	private reached = false;

	/** only when Alex's middle gets into the exit, as in the original */
	override onCollisionStart() {}

	onCollisionActive(_response: CollisionResponse, other: Renderable) {
		if (other instanceof PlayerEntity && other.middleIn(this.getBounds())) {
			this.triggerEvent();
		}
	}

	override triggerEvent() {
		if (!this.reached) {
			this.reached = true;
			(state.current() as PlayScreen).onLevelComplete();
		}
	}
}
