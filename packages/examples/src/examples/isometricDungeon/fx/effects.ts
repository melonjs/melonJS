/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, BloomEffect, GlowEffect } from "melonjs";

/** the level's shader effects; on the Canvas renderer they do nothing */
export interface DungeonEffects {
	/** on the camera, high enough that only the sparks bloom, not the lit floor */
	bloom: BloomEffect;
	/** the pulsing outline of every closed chest, in pixels of its art */
	chestGlow: GlowEffect;
}

let current: DungeonEffects | undefined;

/**
 * Make the level's effects while the loading screen is up. An effect's
 * shader is built when the effect is made: made here, it compiles behind the
 * loading screen, not behind the fade into the level when the level is
 * built. Both are `shared`, so taking one off what it is on keeps it for the
 * next time the level is played, and every chest wears the same glow.
 * @param app - the application
 * @returns the effects
 */
export function prepareEffects(app: Application): DungeonEffects {
	const bloom = new BloomEffect(app.renderer, {
		threshold: 0.94,
		intensity: 0.6,
		radius: 3,
	});
	bloom.shared = true;
	const chestGlow = new GlowEffect(app.renderer, {
		color: [1.0, 0.72, 0.18],
		width: 4,
		intensity: 0.8,
	});
	chestGlow.shared = true;
	current = { bloom, chestGlow };
	return current;
}

/**
 * the effects {@link prepareEffects} made
 * @returns the effects
 */
export function dungeonEffects(): DungeonEffects {
	if (current === undefined) {
		throw new Error("prepareEffects() has not run");
	}
	return current;
}
