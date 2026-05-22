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

// Per-instance shine shader. Each coin owns its own ShaderEffect,
// matching the pattern used by every other ShaderEffect consumer in
// the 19.5+ example suite (`plinko-planck/entities/peg.ts`,
// `dropZone.ts`).
//
// CoinEntity is registered with `pool.register("CoinEntity", ..., true)`
// in createGame.ts, so onDestroyEvent does NOT fire on pool return —
// only on real destroy (level reset, app shutdown). The GAME_UPDATE
// subscription is therefore tied to onActivateEvent / onDeactivateEvent
// (which DO fire on every pool recycle cycle) instead of the
// constructor / onDestroyEvent pair.

export class CoinEntity extends Collectable {
	private shineShader: ShineEffect | undefined;
	private shineUpdateHandler: (() => void) | undefined;
	private shineSubscribed = false;

	/**
	 * constructor
	 */
	constructor(x, y, _settings) {
		// call the super constructor. Collectable defaults to a static
		// sensor body — picked up on overlap, no physical push under
		// either adapter.
		super(
			x,
			y,
			Object.assign({
				image: gameState.texture,
				region: "coin.png",
				shapes: [new Ellipse(35 / 2, 35 / 2, 35, 35)], // coins are 35x35
			}),
		);
		// shader creation + GAME_UPDATE subscription happen in
		// onActivateEvent — `parentApp.renderer` may not be available
		// at construction time, and the subscription must be re-bound
		// on every pool-recycled activation anyway (see class doc).
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
			// Renderer not ready yet — defer until the level (and its
			// renderer) is fully initialised.
			event.once(event.LEVEL_LOADED, () => {
				if (this.attachShine()) {
					this.subscribeShine();
				}
			});
		}
	}

	override onDeactivateEvent() {
		// pool.removeChildNow fires onDeactivateEvent on every coin
		// pickup; balance the GAME_UPDATE subscription here so we
		// don't accumulate stale handlers across the coin's many
		// activate/deactivate cycles.
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
		// TMX objects are children of their object-layer container, not of
		// `game.world` directly — use the actual ancestor so removeChild's
		// `hasChild` guard doesn't throw "Child is not mine".
		(this.ancestor as Container | undefined)?.removeChild(this);
	}

	override onDestroyEvent() {
		// Only fires on real destroy (level reset / app shutdown) —
		// pool returns skip this hook entirely. The engine clears
		// our postEffects on full renderable destroy; we just need to
		// release the GAME_UPDATE subscription if it's still live.
		this.unsubscribeShine();
		this.shineShader = undefined;
		this.shineUpdateHandler = undefined;
	}
}
