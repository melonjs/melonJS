/**
 * Shared object shapes for the AfterBurner showcase.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import type { Camera3d, Mesh, Sprite, Tween } from "melonjs";

export interface BulletMover {
	sprite: Sprite;
	vx: number; // world units / second
	vy: number;
	vz: number;
}

export interface EnemyMover {
	mesh: Mesh;
	vx: number;
	vy: number;
	vz: number;
	/**
	 * Initial facing rotation (radians around Y), captured at spawn so
	 * the per-roll Tween's onUpdate can rebuild `currentTransform`
	 * from a clean baseline each frame instead of accumulating drift.
	 */
	facingY: number;
	/**
	 * Active barrel-roll Tween. Kept on the mover so `removeEnemy`
	 * can `.stop()` it — without that the Tween would keep firing
	 * its `onUpdate` against a destroyed mesh.
	 */
	rollTween: Tween;
	/**
	 * `true` if this enemy ever shoots — rolled at spawn from
	 * `ENEMY_FIRE_CHANCE` so each fly-by is a clear "this one's a
	 * threat / this one's just decoration" call. Non-firing enemies
	 * skip the fire tick entirely.
	 */
	canFire: boolean;
	/**
	 * Milliseconds until this enemy's next shot. Only consulted when
	 * `canFire` is true. Decremented each frame; on 0 a bullet is
	 * spawned and the cooldown is re-randomized.
	 */
	nextFireMs: number;
}

/**
 * Same physics shape as a player bullet (advanced via a velocity
 * vector each frame) but distinguished at the type level so the two
 * bullet streams stay in their own arrays — collisions, despawn
 * conditions, and visuals all differ.
 */
export interface EnemyBulletMover {
	sprite: Sprite;
	vx: number;
	vy: number;
	vz: number;
}

/**
 * One vapor-trail node — a single additive Sprite spawned at the
 * engine outlet and advancing in +Z (away from the camera) each frame.
 * As `ageMs` climbs toward `lifeMs`, the node fades out and shrinks
 * via `GameController.updateContrail`; once `ageMs >= lifeMs` it's
 * removed from `app.world`. `startScale` is captured at spawn so the
 * shrink interpolation has a stable baseline.
 */
export interface ContrailNode {
	sprite: Sprite;
	ageMs: number;
	startScale: number;
}

/**
 * Camera3d augmented with an ad-hoc `roll` field set by GameController
 * and read by SkyboxStage to rotate the horizon. Engine-side Camera3d
 * doesn't model roll as a first-class rotation axis yet (pitch + yaw
 * only); we hang the value on the camera object via this typed view so
 * both producer and consumer agree on the contract without spreading
 * `(camera as Camera3d & { roll: number })` casts through the code.
 */
export type Camera3dWithRoll = Camera3d & { roll: number };
