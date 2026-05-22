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

// Per-instance shine shader. Pool-recycled (recycle:true) so
// onDestroyEvent doesn't fire on pickup — bind GAME_UPDATE on
// activate, unbind on deactivate.

export class CoinEntity extends Collectable {
	private shineShader: ShineEffect | undefined;
	private shineUpdateHandler: (() => void) | undefined;
	private shineSubscribed = false;
	private deferredAttachHandler: (() => void) | undefined;

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
		// shader + subscription deferred to onActivateEvent
	}

	private attachShine(): boolean {
		if (this.shineShader) return true;
		const renderer = this.parentApp?.renderer;
		if (!renderer) return false;
		this.shineShader = new ShineEffect(renderer, {
			color: [1.0, 0.95, 0.7], // warm white-gold highlight
			speed: 0.8,
			width: 0.25, // wider, gentler glint
			intensity: 0.22, // softer highlight
			angle: 0.35, // slight diagonal sweep (~20°)
			bands: 14.5, // ~14 parallel etched-rim glints
			pulseDepth: 0.04, // very subtle brightness pulse
		});
		this.shineUpdateHandler = () => {
			this.shineShader?.setTime(timer.getTime() / 1000.0);
		};
		this.addPostEffect(this.shineShader);
		return true;
	}

	private subscribeShine() {
		if (this.shineSubscribed || !this.shineUpdateHandler) return;
		event.on(event.GAME_UPDATE, this.shineUpdateHandler);
		this.shineSubscribed = true;
	}

	private unsubscribeShine() {
		if (!this.shineSubscribed || !this.shineUpdateHandler) return;
		event.off(event.GAME_UPDATE, this.shineUpdateHandler);
		this.shineSubscribed = false;
	}

	private cancelDeferredAttach() {
		if (this.deferredAttachHandler) {
			event.off(event.LEVEL_LOADED, this.deferredAttachHandler);
			this.deferredAttachHandler = undefined;
		}
	}

	onActivateEvent() {
		super.onActivateEvent();
		if (this.attachShine()) {
			this.subscribeShine();
		} else {
			// renderer not ready yet — defer to LEVEL_LOADED. Keep a
			// handler ref so we can cancel it if we deactivate /
			// destroy before LEVEL_LOADED fires (otherwise a pooled
			// coin would silently re-subscribe to GAME_UPDATE).
			this.cancelDeferredAttach();
			this.deferredAttachHandler = () => {
				this.deferredAttachHandler = undefined;
				if (this.attachShine()) {
					this.subscribeShine();
				}
			};
			event.once(event.LEVEL_LOADED, this.deferredAttachHandler);
		}
	}

	onDeactivateEvent() {
		this.cancelDeferredAttach();
		this.unsubscribeShine();
		super.onDeactivateEvent();
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
		// fires only on real destroy (level reset / app shutdown)
		this.cancelDeferredAttach();
		this.unsubscribeShine();
		this.shineShader = undefined;
		this.shineUpdateHandler = undefined;
	}
}
