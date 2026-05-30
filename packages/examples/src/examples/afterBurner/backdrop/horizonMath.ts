/**
 * Shared math for the AfterBurner backdrop layers. The pitch-driven
 * horizon Y is recomputed by every layer each frame; keeping the
 * formula in one place avoids drift between SkyGradient,
 * MountainHorizon, and GroundGrid landing on slightly different Y
 * values when the camera tilts.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import type { Camera3d } from "melonjs";
import { HORIZON_BASE_FRACTION } from "../constants";

/**
 * Compute the clamped horizon screen Y for the given camera + canvas
 * height. Positive pitch drops the horizon, negative pitch raises it
 * (standard `tan(pitch) / tan(fov/2)` NDC offset). Clamped 40 px from
 * either edge so the ground / sky never fully disappear during
 * extreme pitches.
 */
export function computeHorizonY(camera: Camera3d, h: number): number {
	const pitchOffsetPx =
		(Math.tan(camera.pitch) / Math.tan(camera.fov / 2)) * (h / 2);
	const horizon = h * HORIZON_BASE_FRACTION + pitchOffsetPx;
	return Math.max(40, Math.min(h - 40, horizon));
}
