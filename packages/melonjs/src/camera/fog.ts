/**
 * Distance-fog types, in their own module so `Camera2d` can declare the
 * resolver hook that `Camera3d` overrides without the two importing each
 * other.
 */
import type { Color } from "../math/color.ts";

/**
 * Which curve maps distance to fog density.
 *
 * `"linear"` is parameterised by two distances and `"exp2"` by a single
 * density — the two parameterisations inherited from fixed-function graphics
 * pipelines, and still what stylised scenes want.
 */
export type FogMode = "linear" | "exp2";

/**
 * {@link Camera3d#setFog} options. Every field is optional: the defaults are
 * resolved live each frame, so fog stays consistent with the camera and the
 * backdrop instead of drifting out of step with them.
 *
 * The values you DO pass are read once, at the call. Mutating this object
 * afterwards has no effect — and would have skipped `setFog`'s validation if it
 * did. The one live handle is a {@link Color} passed as `color`, which is kept
 * by reference so it can be animated; see that field.
 */
export interface FogOptions {
	/**
	 * the curve mapping distance to density.
	 * @default "linear"
	 */
	mode?: FogMode;
	/**
	 * linear only — distance at which fog starts. Omit and it tracks the
	 * camera's own `near` clip plane.
	 */
	near?: number;
	/**
	 * linear only — distance at which fog fully hides the scene. Omit and it
	 * tracks the camera's own `far` clip plane, which is what keeps geometry
	 * from clipping before it has finished fading.
	 */
	far?: number;
	/**
	 * exp2 only — how fast the scene colour is lost with distance. Omit and it
	 * resolves to `2 / far`, leaving a few percent of the scene colour at the
	 * far plane whatever the world scale.
	 */
	density?: number;
	/**
	 * fog colour. Omit and it tracks `renderer.backgroundColor` live, so
	 * geometry dissolves into the backdrop with no extra work — including
	 * through a day/night fade. A {@link Color} is kept **by reference**, so
	 * mutating it animates the fog; a CSS string or `[r, g, b]` in 0..1 is
	 * parsed into a colour this camera owns.
	 */
	color?: Color | string | [number, number, number];
}

/**
 * The resolved per-frame fog values handed to the renderer. Distances are
 * pre-baked into the form the shaders want so neither backend divides.
 * @ignore
 */
export interface Fog3dState {
	/** 1 = linear, 2 = exp2 (0 never reaches the renderer — null does) */
	mode: number;
	/** linear: distance at which fog starts */
	near: number;
	/** linear: 1 / (far - near) */
	invRange: number;
	/** exp2: density */
	density: number;
	/** straight (unpremultiplied) fog colour, 3 components in 0..1 */
	color: Float32Array;
}
