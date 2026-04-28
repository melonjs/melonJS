import {
	type Camera2d,
	ChromaticAberrationEffect,
	DropShadowEffect,
	type Renderer,
	type Sprite,
	VignetteEffect,
	type WebGLRenderer,
} from "melonjs";

/**
 * Attach an always-on vignette to the viewport.
 * Skips silently if the renderer is not WebGL (post-effects are WebGL-only).
 */
export function setupViewportEffects(
	viewport: Camera2d,
	renderer: Renderer,
): void {
	if (!renderer.type.startsWith("WebGL")) {
		return;
	}
	const r = renderer as WebGLRenderer;
	viewport.addPostEffect(new VignetteEffect(r));
}

/**
 * Attach a dormant chromatic aberration effect to a sprite.
 * No-op on canvas renderer.
 * @returns the effect instance, or null if not attached
 */
export function attachChromaticAberration(
	sprite: Sprite,
	renderer: Renderer,
): ChromaticAberrationEffect | null {
	if (!renderer.type.startsWith("WebGL")) {
		return null;
	}
	const r = renderer as WebGLRenderer;
	const fx = new ChromaticAberrationEffect(r, {
		offset: 0,
		textureSize: [sprite.width, sprite.height],
	});
	sprite.addPostEffect(fx);
	return fx;
}

/**
 * Attach a static drop shadow to a sprite, giving it weight on the scene.
 * No-op on canvas renderer.
 */
export function attachDropShadow(sprite: Sprite, renderer: Renderer): void {
	if (!renderer.type.startsWith("WebGL")) {
		return;
	}
	const r = renderer as WebGLRenderer;
	sprite.addPostEffect(
		new DropShadowEffect(r, {
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
 * Decays in real-time using performance.now() so it animates *through* a freeze.
 * @param fx - the effect to drive (no-op if null)
 * @param peak - peak offset in texels
 * @param durationMs - total duration of the burst (rise + decay)
 */
export function triggerChromaticBurst(
	fx: ChromaticAberrationEffect | null,
	peak = 8,
	durationMs = 250,
): void {
	if (fx === null) {
		return;
	}
	const start = globalThis.performance.now();

	fx.setOffset(peak);

	const tick = (): void => {
		const t = (globalThis.performance.now() - start) / durationMs;
		if (t >= 1) {
			fx.setOffset(0);
			return;
		}
		// ease-out cubic from peak → 0
		const eased = 1 - (1 - t) ** 3;
		fx.setOffset(peak * (1 - eased));
		globalThis.requestAnimationFrame(tick);
	};

	globalThis.requestAnimationFrame(tick);
}
