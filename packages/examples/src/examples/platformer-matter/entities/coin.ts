/**
 * melonJS — Platformer (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	audio,
	Collectable,
	type Container,
	Ellipse,
	event,
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

	/**
	 * constructor
	 */
	constructor(x, y, _settings) {
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
			width: 0.2, // wider, gentler glint
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

	override onActivateEvent() {
		super.onActivateEvent();
		if (this.attachShine()) {
			this.subscribeShine();
		} else {
			// renderer not ready yet — defer to LEVEL_LOADED
			event.once(event.LEVEL_LOADED, () => {
				if (this.attachShine()) {
					this.subscribeShine();
				}
			});
		}
	}

	override onDeactivateEvent() {
		this.unsubscribeShine();
		super.onDeactivateEvent();
	}

	// called by the pool on object recycling
	onResetEvent(x, y, _settings) {
		this.shift(x, y);
	}

	/**
	 * One-shot pickup — `onCollisionStart` fires exactly once per contact
	 * begin on both adapters, so no per-frame dedupe is needed.
	 */
	onCollisionStart() {
		audio.play("cling", false);
		gameState.data.score += 250;
		// remove from the actual ancestor (object layer), not game.world
		(this.ancestor as Container | undefined)?.removeChild(this);
	}

	override onDestroyEvent() {
		// fires only on real destroy (level reset / app shutdown)
		this.unsubscribeShine();
		this.shineShader = undefined;
		this.shineUpdateHandler = undefined;
	}
}
