/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	audio,
	Collectable,
	collision,
	Ellipse,
	event,
	game,
	ShineEffect,
	timer,
} from "melonjs";
import { gameState } from "../gameState";

// shared shine shader for all coins — one ShineEffect instance,
// ref-counted so it survives across level reloads / pool recycling
let coinShader: ShineEffect | undefined;
let coinShaderRefCount = 0;
let coinUpdateHandler: (() => void) | undefined;

export class CoinEntity extends Collectable {
	/**
	 * Did *this* instance increment the shared shader's refcount? Without
	 * tracking it per-instance, a coin destroyed before its LEVEL_LOADED
	 * handler runs would over-decrement in onDestroyEvent.
	 */
	private didIncrementRefCount = false;

	/**
	 * constructor
	 */
	constructor(x, y, _settings) {
		// call the super constructor
		super(
			x,
			y,
			Object.assign({
				image: gameState.texture,
				region: "coin.png",
				shapes: [new Ellipse(35 / 2, 35 / 2, 35, 35)], // coins are 35x35
			}),
		);

		// Apply the built-in shine shader. Attempt immediately for coins
		// constructed after the first level loaded, otherwise defer to the
		// next LEVEL_LOADED event.
		const attach = () => {
			if (this.didIncrementRefCount) return true;
			const renderer = this.parentApp?.renderer;
			if (!renderer) return false;
			if (!coinShader) {
				coinShader = new ShineEffect(renderer, {
					color: [1.0, 0.95, 0.7], // warm white-gold highlight
					speed: 0.8,
					width: 0.25, // wider, gentler glint
					intensity: 0.22, // softer highlight
					angle: 0.35, // slight diagonal sweep (~20°)
					bands: 14.5, // ~14 parallel etched-rim glints
					pulseDepth: 0.04, // very subtle brightness pulse
				});
				coinUpdateHandler = () => {
					coinShader?.setTime(timer.getTime() / 1000.0);
				};
				event.on(event.GAME_UPDATE, coinUpdateHandler);
			}
			coinShaderRefCount++;
			this.didIncrementRefCount = true;
			this.addPostEffect(coinShader);
			return true;
		};
		if (!attach()) {
			event.once(event.LEVEL_LOADED, attach);
		}
	}

	// called by the pool on object recycling
	onResetEvent(x, y, _settings) {
		this.shift(x, y);
		// only check for collision against player
		this.body.setCollisionMask(collision.types.PLAYER_OBJECT);
	}

	/**
	 * collision handling
	 */
	onCollision(/*response*/) {
		// do something when collide
		audio.play("cling", false);
		// give some score
		gameState.data.score += 250;

		//avoid further collision and delete it
		this.body.setCollisionMask(collision.types.NO_OBJECT);

		game.world.removeChild(this);

		return false;
	}

	onDestroyEvent() {
		// Only release the shared shader ref if this instance acquired one.
		if (!this.didIncrementRefCount) return;
		this.didIncrementRefCount = false;
		if (coinShader && --coinShaderRefCount <= 0) {
			if (coinUpdateHandler) {
				event.off(event.GAME_UPDATE, coinUpdateHandler);
				coinUpdateHandler = undefined;
			}
			coinShader = undefined;
			coinShaderRefCount = 0;
		}
	}
}
