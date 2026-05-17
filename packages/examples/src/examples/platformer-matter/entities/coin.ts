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

// shared shine shader for all coins — one ShineEffect instance,
// ref-counted so it survives across level reloads / pool recycling
let coinShader: ShineEffect | undefined;
let coinShaderRefCount = 0;
let coinUpdateHandler: (() => void) | undefined;

export class CoinEntity extends Collectable {
	/**
	 * Did *this* instance increment the shared shader's refcount? The
	 * shader is installed inside an `event.once(LEVEL_LOADED, …)` handler;
	 * coins constructed after that event has already fired register a
	 * listener that never runs and therefore never bump the refcount. The
	 * unconditional decrement in `onDestroyEvent` would otherwise drive
	 * the refcount negative and tear the shader down with live coins
	 * still using it.
	 */
	private didIncrementRefCount = false;

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

		// Apply the built-in shine shader. The renderer is needed to build
		// the shader, which isn't available before the first level loads —
		// so we attempt it now (for coins constructed after LEVEL_LOADED)
		// and also register a one-shot LEVEL_LOADED handler (for coins
		// constructed during preload).
		const attach = () => {
			if (this.didIncrementRefCount) return;
			const renderer = this.parentApp?.renderer;
			if (!renderer) return false;
			if (!coinShader) {
				coinShader = new ShineEffect(renderer, {
					color: [1.0, 0.95, 0.7], // warm white-gold highlight
					speed: 0.8,
					width: 0.2, // wider, gentler glint
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
		// Only release the shared shader ref if *this* instance acquired
		// one — otherwise a coin destroyed before its LEVEL_LOADED handler
		// fired would over-decrement and tear the shader down with live
		// coins still using it.
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
