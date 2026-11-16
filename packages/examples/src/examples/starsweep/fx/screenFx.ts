/**
 * melonJS — Starsweep: the post-effects on the screen.
 *
 * Bloom makes the powered panels, sparks and characters glow, a vignette
 * frames the screen, and a chromatic aberration burst kicks in when Bolt
 * gets hit. Each is one of the engine's `ShaderEffect` presets, added to a
 * camera with `addPostEffect`; on Canvas they switch themselves off.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	BloomEffect,
	type Camera3d,
	ChromaticAberrationEffect,
	type Renderable,
	type ShaderEffect,
	Tween,
	VignetteEffect,
} from "melonjs";

let bloom: BloomEffect | null = null;
let aberration: ChromaticAberrationEffect | null = null;
let vignette: VignetteEffect | null = null;

/**
 * Bloom and the chromatic aberration of hits on the game's camera, and a
 * vignette on the camera that draws first (the space camera, when there is
 * one). Built once, and added again after a screen change, which can bring
 * a new camera.
 *
 * The game's camera draws after the space camera, and its post-effect pass
 * is blended over what that one drew, so the space shows through around the
 * game (melonJS 20.15 and later).
 * @param app - the application
 * @param first - the camera that draws first, if not the game's
 */
export const setupScreenFx = (app: Application, first?: Camera3d | null) => {
	const renderer = app.renderer;
	bloom ??= new BloomEffect(renderer, {
		threshold: 0.72,
		intensity: 0.55,
		radius: 3,
	});
	aberration ??= new ChromaticAberrationEffect(renderer, { offset: 0 });
	vignette ??= new VignetteEffect(renderer, { strength: 0.22, size: 22 });
	const add = (camera: Renderable, effect: ShaderEffect) => {
		if (!camera.postEffects.includes(effect)) {
			camera.addPostEffect(effect);
		}
	};
	add(app.viewport, bloom);
	add(app.viewport, aberration);
	add(first ?? app.viewport, vignette);
};

/** a short colour-split shudder, for hits */
export const aberrationBurst = (peak = 7, duration = 450) => {
	const fx = aberration;
	if (!fx?.enabled) {
		return;
	}
	const driver = { offset: peak };
	fx.setOffset(peak);
	new Tween(driver)
		.to({ offset: 0 }, { duration })
		.easing(Tween.Easing.Cubic.Out)
		.onUpdate(() => fx.setOffset(driver.offset))
		.start();
};
