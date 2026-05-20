/**
 * melonJS — Plinko (Planck) example: procedural sound effects.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Two cues, both built on the engine's `audio.tone` primitive — no
 * asset files, no loaders, no licensing:
 *
 *   - peg clack: short percussive impulse with row-pitched + spatially
 *     panned variation per hit (heard 5-10× per drop, so the variation
 *     matters — without it a flurry of pegs all sound like one buzz)
 *   - score chime: tonal A-minor-pentatonic note (two partials a
 *     fifth apart) whose pitch climbs with the slot tier and pans
 *     toward whichever side scored
 *
 * `audio.tone` shares Howler's WebAudio context behind the scenes, so
 * the usual browser autoplay gating applies — the first DropZone click
 * (a user gesture) unlocks audio for every subsequent call.
 */

import { audio } from "melonjs";

/**
 * Throttle so a single ball pinging two contacts in the same physics
 * tick doesn't double-trigger — peg clacks within this window are
 * merged. Stored in ms.
 */
const CLACK_THROTTLE_MS = 16;
let lastClackAt = 0;

/**
 * Short percussive impulse for peg hits.
 *
 * @param pan stereo position in `[-1, 1]` — left wall to right wall.
 *   Cones the clack across the soundfield so a flurry of hits also
 *   describes a path through the playfield, not just a smear of clicks.
 * @param pitchHint `0..1` from top row (0) to bottom row (1). When
 *   present the clack is pitched on a descending scale (top-row
 *   bounces ring high, bottom-row bounces ring low) so a single ball
 *   dropping through the field literally plays an arpeggio downward.
 *   Without the hint we fall back to small random jitter so multiple
 *   balls don't fuse into one continuous buzz.
 */
export const playClack = (pan = 0, pitchHint?: number): void => {
	const now = performance.now();
	if (now - lastClackAt < CLACK_THROTTLE_MS) return;
	lastClackAt = now;

	// Top row (hint = 0) rings at 1400 Hz; bottom row (hint = 1) at
	// 700 Hz. No hint → random jitter in the same range.
	const freq =
		pitchHint !== undefined
			? 1400 - pitchHint * 700
			: 700 + Math.random() * 700;

	audio.tone({
		freq,
		duration: 0.08,
		gain: 0.08,
		pan,
		// Downward pitch slide gives the clack a "wood block" feel
		// rather than a flat sine pulse.
		pitchSlide: 0.5,
	});
};

/**
 * Tonal chime for slot landings — A-minor-pentatonic across the five
 * tiers (A4 / C5 / E5 / A5 / E6) with a perfect-fifth partial for a
 * richer "ping". Pan tracks the slot's horizontal position.
 *
 * @param score the slot's point value (drives base pitch)
 * @param pan stereo position in `[-1, 1]`.
 */
export const playChime = (score: number, pan = 0): void => {
	// Tier → A-minor pentatonic note.
	const base =
		score >= 100
			? 1320
			: score >= 30
				? 880
				: score >= 10
					? 659
					: score >= 5
						? 523
						: 440;

	audio.tone({
		freq: [base, base * 1.5],
		duration: 0.4,
		gain: 0.18,
		pan,
	});
};
