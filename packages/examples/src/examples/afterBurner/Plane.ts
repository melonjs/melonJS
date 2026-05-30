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
import { Mesh } from "melonjs";
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
