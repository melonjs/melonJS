/**
 * Reticle — corner-bracket targeting overlay positioned in world space
 * ahead of the player. After Burner's signature aim indicator: it
 * tracks the player's XY position so as the jet banks, the reticle
 * leads the cross-hair to where the bullets will visually converge.
 *
 * Lives in the world tree, not in screen space — Camera3d's perspective
 * naturally shrinks it with distance and parallaxes it correctly with
 * camera pitch/yaw, so it always reads as "out there in front of the
 * jet" rather than a flat HUD overlay.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { Sprite } from "melonjs";
import { RETICLE_SIZE } from "./constants";

export class Reticle extends Sprite {
	constructor(texture: HTMLCanvasElement) {
		super(0, 0, { image: texture });
		// Force the world-space size to match RETICLE_SIZE regardless of
		// the source canvas resolution — keeps the in-game footprint
		// constant when we re-tune the bracket art later.
		this.resize(RETICLE_SIZE, RETICLE_SIZE);
		// Additive blend so the reticle reads as a soft glow over the
		// sunset sky AND the ground, never as an opaque white square.
		this.blendMode = "additive";
		// Centered on its own anchor — `pos.x/y` becomes the reticle's
		// crosshair center, not its top-left corner. Matches how the
		// rest of the AfterBurner game thinks about positions.
		this.anchorPoint.set(0.5, 0.5);
	}
}
