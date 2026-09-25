/**
 * Plane — Mesh subclass for the AfterBurner player + enemies. Wraps the
 * Kenney speederA model (loaded once via the OBJ/MTL loader) with the
 * scene-specific setup that both the player and enemies share: uniform
 * scale via `size`, zeroed anchor so vertex world positions land where
 * `pos.x/y/depth` say, optional 180° Y-facing flip for enemies, and a
 * helper to randomize tint per spawn.
 *
 * Both roles use the same OBJ — the player gets `facing: 1` (nose along
 * the world +Z axis, toward the horizon) and enemies get `facing: -1`
 * (nose flipped back at the camera). Facing is stored in
 * `currentTransform` via `rotate(π, AXIS_Y)`; the player's bank update
 * later rebuilds `currentTransform` each tick (and re-applies that
 * rotation if needed), while enemies keep the constructor's matrix for
 * their entire flight.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { Box3d, collision, Mesh } from "melonjs";
import { AXIS_Y, SPEEDER_MODEL } from "./constants";

export interface PlaneSettings {
	/** uniform world-space scale (passed to Mesh as width + height) */
	size: number;
	/** +1 = nose toward +Z (player), -1 = nose toward -Z (enemy) */
	facing: 1 | -1;
}

export class Plane extends Mesh {
	constructor(settings: PlaneSettings) {
		super(0, 0, {
			model: SPEEDER_MODEL,
			material: SPEEDER_MODEL,
			width: settings.size,
			height: settings.size,
			cullBackFaces: true,
			// OBJ models carry vertex normals since #1572 — authored `vn`
			// where the file has them, generated from face geometry where it
			// does not — so they shade against the modelled surface instead
			// of reading flat under the scene lights.
			lit: true,
		});
		// Mesh defaults anchor to (0.5, 0.5), but Renderable.preDraw
		// applies `translate(-anchorPoint * width)` on top of the
		// currentTransform under Camera3d's view matrix, which would
		// offset the model from its world position. Zero out so vertices
		// land where pos.x/y/depth say.
		this.anchorPoint.set(0, 0);
		if (settings.facing === -1) {
			this.rotate(Math.PI, AXIS_Y);
		}

		// The hitbox is the model, measured. `getBounds3d()` bounds the
		// model-space geometry through this mesh's own placement, and it does
		// so from `originalVertices` rather than from whatever the last draw
		// left behind, so it is correct here, before the first frame.
		//
		// This is the difference between hitting a plane and hitting a ball
		// around a plane: a speeder is wide across the wings, long down the
		// fuselage and thin from above, and a single radius covering the
		// wingtips also covers a lot of empty sky above and below them.
		const box = this.getBounds3d();
		this.bodyDef = {
			// Enemies are static and the player is dynamic, which is what
			// pairs them in the broadphase: a pair is only considered when at
			// least one side moves under the simulation. `gravityScale: 0`
			// keeps the player weightless, since this game flies it by writing
			// `pos` directly and the world must not pull it down.
			type: settings.facing === 1 ? "dynamic" : "static",
			gravityScale: 0,
			shapes: [new Box3d(0, 0, 0, box.width, box.height, box.depth)],
			// SENSORS. A contact here means "you were hit", and the game
			// decides what that costs. A push-out would fight the flight
			// model, which owns where both planes are.
			isSensor: true,
			collisionType:
				settings.facing === 1
					? collision.types.PLAYER_OBJECT
					: collision.types.ENEMY_OBJECT,
			collisionMask:
				settings.facing === 1
					? collision.types.ENEMY_OBJECT
					: collision.types.PLAYER_OBJECT,
		};
	}

	/**
	 * Pick a random hue and apply it as the mesh tint. Used per-enemy
	 * at spawn so the squadron reads as a varied flight rather than a
	 * row of clones — pastel mid-light to keep the baked MTL palette
	 * (dark cockpits, metallic body) visible through the multiplicative
	 * tint. `Color.setHSL` takes hue in `[0..1]`, NOT degrees.
	 */
	randomizeTint(): void {
		this.tint.setHSL(Math.random(), 0.55, 0.7);
	}
}
