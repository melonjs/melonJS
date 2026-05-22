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

// Per-instance shine shader. Matches the pattern used by every other
// `ShaderEffect` consumer in the 19.5+ example suite
// (`plinko-planck/entities/peg.ts`, `dropZone.ts`): each renderable
// owns its own `ShaderEffect`, lifetime tied to the renderable's
// own destroy. A previous version of this file kept a module-level
// singleton + manual refcount to share one program across all coins,
// which was a deviation from the rest of the codebase and made
// every coin transitively depend on the singleton's lifecycle. Per-
// instance is simpler and matches plinko's pattern.

export class CoinEntity extends Collectable {
	private shineShader: ShineEffect | undefined;
	private shineUpdateHandler: (() => void) | undefined;

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

		// Attach the shine shader as soon as a renderer is available.
		// For the first coins in the world this happens on LEVEL_LOADED;
		// for coins constructed afterwards it happens immediately.
		const attach = () => {
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
			event.on(event.GAME_UPDATE, this.shineUpdateHandler);
			this.addPostEffect(this.shineShader);
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
		// Release the per-coin GAME_UPDATE handler — the engine's
		// removePostEffect path destroys the `ShineEffect` itself, but
		// it does NOT touch our event subscription. Without this
		// off-call we'd accumulate one dead handler per coin pickup.
		if (this.shineUpdateHandler) {
			event.off(event.GAME_UPDATE, this.shineUpdateHandler);
			this.shineUpdateHandler = undefined;
		}
		this.shineShader = undefined;
	}
}
