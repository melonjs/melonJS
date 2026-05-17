/**
 * melonJS — Whac-A-Mole mini-game example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Camera2d,
	ChromaticAberrationEffect,
	DropShadowEffect,
	pool,
	type Renderer,
	type Sprite,
	Tween,
	VignetteEffect,
	type WebGLRenderer,
} from "melonjs";

/**
 * Attach an always-on vignette to the viewport.
 * Effects degrade gracefully on Canvas (ShaderEffect logs a warning and
 * leaves `enabled = false`; all method calls become no-ops).
 */
export function setupViewportEffects(
	viewport: Camera2d,
	renderer: Renderer,
): void {
	viewport.addPostEffect(new VignetteEffect(renderer as WebGLRenderer));
}

/**
 * Attach a dormant chromatic aberration effect to a sprite.
 */
export function attachChromaticAberration(
	sprite: Sprite,
	renderer: Renderer,
): ChromaticAberrationEffect {
	const fx = new ChromaticAberrationEffect(renderer as WebGLRenderer, {
		offset: 0,
		textureSize: [sprite.width, sprite.height],
	});
	sprite.addPostEffect(fx);
	return fx;
}

/**
 * Attach a static drop shadow to a sprite, giving it weight on the scene.
 */
export function attachDropShadow(sprite: Sprite, renderer: Renderer): void {
	sprite.addPostEffect(
		new DropShadowEffect(renderer as WebGLRenderer, {
			offsetX: 2.0,
			offsetY: 3.0,
			color: [0.0, 0.0, 0.0],
			opacity: 0.2,
			textureSize: [sprite.width, sprite.height],
		}),
	);
}

/**
 * Trigger a brief chromatic-aberration burst on the given effect.
 * Uses a Tween with `updateWhenPaused = true` so the decay animates
 * *through* a freeze.
 * @param fx - the effect to drive
 * @param peak - peak offset in texels
 * @param durationMs - total duration of the decay
 */
export function triggerChromaticBurst(
	fx: ChromaticAberrationEffect,
	peak = 8,
	durationMs = 250,
): void {
	fx.setOffset(peak);
	const driver = { offset: peak };
	const tween = pool.pull("me.Tween", driver) as Tween;
	tween.updateWhenPaused = true;
	tween
		.to({ offset: 0 }, { duration: durationMs })
		.easing(Tween.Easing.Cubic.Out)
		.onUpdate(() => fx.setOffset(driver.offset))
		.start();
}
