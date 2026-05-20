/**
 * melonJS — Pool (Matter) example: procedural sound effects.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Five thin wrappers around `audio.tone` — no asset files, no loaders.
 * Each maps a gameplay event to a single envelope-shaped tone:
 *   - playStrike       cue-on-ball thwack on release
 *   - playBallClick    classic billiards click on ball-ball contact
 *   - playRailBounce   softer thud on cushion bounce
 *   - playPocketDrop   two-partial ring on a successful pot
 *   - playScratch      descending fail tone when the cue ball is pocketed
 *
 * Most wrappers take a normalised `velocity` factor in `[0, 1]` so the
 * gain scales with impact intensity, plus a `pan` in `[-1, 1]` so a
 * shot on the left rail clacks left and a shot on the right rail
 * clacks right — same trick as the plinko peg pans.
 */

import { audio } from "melonjs";
import { VIEWPORT_W } from "./constants";

/**
 * Convert a world x-coordinate to a stereo pan in `[-1, 1]`. Centre of
 * the table is 0; left edge is -1, right edge is 1.
 */
export const panForX = (x: number): number => {
	const normalised = (x / VIEWPORT_W) * 2 - 1;
	return Math.max(-1, Math.min(1, normalised));
};

/**
 * Normalise a matter body's per-step velocity magnitude into a `[0, 1]`
 * factor for gain scaling. Pool ball velocities at full break are
 * roughly in the 8–12 px/step range; we cap at 10 so a hard break
 * tops out at gain factor 1 and lighter contacts scale linearly down.
 */
export const velocityFactor = (speed: number): number => {
	return Math.max(0, Math.min(1, speed / 10));
};

/** Sharp "thwack" when the cue strikes the cue ball on release. */
export const playStrike = (power: number, pan = 0): void => {
	audio.tone({
		freq: 1200,
		duration: 0.08,
		gain: 0.15 * Math.max(0.2, power),
		pan,
		pitchSlide: 0.4,
	});
};

/** Classic billiards click on ball-ball contact. Pitch jitter so a
 *  multi-ball break doesn't smear into one buzz. */
export const playBallClick = (velocity: number, pan = 0): void => {
	const v = velocityFactor(velocity);
	if (v < 0.05) return; // skip vanishingly soft taps
	audio.tone({
		freq: 900 + Math.random() * 400,
		duration: 0.05,
		gain: 0.1 * v,
		pan,
		pitchSlide: 0.6,
	});
};

/** Softer low thud on cushion bounces. Distinguishable from ball-ball
 *  by frequency band (mid-low vs upper-mid). */
export const playRailBounce = (velocity: number, pan = 0): void => {
	const v = velocityFactor(velocity);
	if (v < 0.05) return;
	audio.tone({
		freq: 350,
		duration: 0.1,
		gain: 0.12 * v,
		pan,
		pitchSlide: 0.5,
	});
};

/** Satisfying two-partial ring when a numbered ball drops in a pocket. */
export const playPocketDrop = (pan = 0): void => {
	audio.tone({
		freq: [440, 660],
		duration: 0.25,
		gain: 0.18,
		pan,
	});
};

/** Descending sawtooth "buzzer" when the cue ball gets pocketed. */
export const playScratch = (pan = 0): void => {
	audio.tone({
		freq: 400,
		duration: 0.4,
		wave: "sawtooth",
		gain: 0.15,
		pan,
		pitchSlide: 0.3,
	});
};
