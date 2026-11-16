/**
 * The adapter's public types: its options, the joints it makes, and the
 * vectors it takes.
 */
import type { Renderable } from "melonjs";

/**
 * Minimum melonJS version this adapter requires: the lower bound of its
 * `melonjs` peer dependency range, so the two cannot disagree. 20.16 is the
 * first with the 3D shapes and the 3D adapter interface.
 * @hidden
 */
export const REQUIRED_MELONJS_VERSION = "20.16.0";

/**
 * A point or a vector in pixels whose `z` may be left out: a
 * {@link Vector3d}, a {@link Vector2d} or a plain object. What a missing `z`
 * means is said where it is taken.
 */
export interface Vector3Like {
	x: number;
	y: number;
	z?: number | undefined;
}

/**
 * What `world.addJoint()` passes to {@link Rapier3dAdapter.addJoint}: melonJS's
 * `JointDefinition`, whose anchors and axis may also carry a `z`.
 */
export interface Rapier3dJointDefinition {
	type: "hinge" | "rope" | "weld" | "slider";
	a: Renderable;
	b: Renderable;
	/** in `a`'s own space, relative to its `pos`; `z` defaults to `0` */
	anchorA?: Vector3Like;
	/** in `b`'s own space, relative to its `pos`; `z` defaults to `0` */
	anchorB?: Vector3Like;
	collideConnected?: boolean;
	limits?: { min: number; max: number };
	maxLength?: number;
	/**
	 * `"hinge"`: the axis the bodies turn about, default Z, so a hinge turns
	 * as it does in 2D. `"slider"`: the direction `b` slides in, default X.
	 * In `a`'s own space; `z` defaults to `0`.
	 */
	axis?: Vector3Like;
}

/**
 * Options accepted by the {@link Rapier3dAdapter} constructor and by
 * {@link Rapier3dAdapter.create}.
 */
export interface Rapier3dAdapterOptions {
	/**
	 * World gravity in **pixels per second²**. Default `{x: 0, y: 320, z: 0}`,
	 * about 10 m/s² at the default `pixelsPerMeter` of 32, pulling down: the
	 * engine's 3D convention is Y-down (see `Camera3d`). Converted to meters
	 * for Rapier.
	 */
	gravity?: Vector3Like;
	/**
	 * Rapier is tuned for objects about a meter across, so the adapter works
	 * in meters and converts at every boundary (positions, velocities,
	 * gravity, forces, queries). Default `32`: a 32-pixel cube is one meter.
	 * Raising it makes every body smaller in meters, so lighter, and the same
	 * force moves it further; motion under gravity alone looks the same in
	 * pixels. Must be a positive number.
	 */
	pixelsPerMeter?: number;
	/**
	 * Rapier steps per engine frame, each of `dt / N` seconds. More sub-steps
	 * make fast contacts and tall stacks more accurate, at about `N` times
	 * the physics cost. Default `1`; values below 1 are clamped to 1. A
	 * force applied once in a frame acts across all of them.
	 */
	subSteps?: number;
}
