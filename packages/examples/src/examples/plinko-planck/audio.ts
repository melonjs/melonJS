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

/**
 * Tiny "chip drop" click for placing a bet — short, percussive, pitched
 * up slightly with each stacked wager so spamming a slot reads as a
 * climbing arpeggio (audible feedback that the wager is stacking).
 *
 * @param wager current stacked wager (1..MAX_BET_WAGER) for pitch climb
 * @param pan stereo position in `[-1, 1]` based on slot x
 */
export const playBetClick = (wager: number, pan = 0): void => {
	audio.tone({
		freq: 520 + wager * 90,
		duration: 0.08,
		gain: 0.1,
		pan,
		// pitchSlide is a frequency MULTIPLIER (not delta) — < 1 slides
		// down, > 1 slides up. 0.7 = end ~30 % below start, the right
		// amount for a chip "tick" tail.
		pitchSlide: 0.7,
	});
};

/**
 * Brief downward "thud" when the bet busts (ball landed in the wrong
 * slot). Low-pitched and quick — punctuates the loss without
 * overshadowing the next chime.
 *
 * @param pan stereo position in `[-1, 1]` based on the bet slot's x
 */
export const playBust = (pan = 0): void => {
	audio.tone({
		freq: 220,
		duration: 0.2,
		gain: 0.14,
		pan,
		// pitchSlide is a frequency multiplier — 0.25 ends at a quarter
		// of the start frequency for a dramatic downward "thud" tail.
		pitchSlide: 0.25,
	});
};

/**
 * Triumphant fanfare when the bet wins. Built from four layered
 * sources so the moment lands with real weight (the prior sine-wave
 * arpeggio read as a slightly louder chime — not enough):
 *
 *   - **Swoosh** — a rising bandpass-filtered white-noise burst,
 *     gives the win an "impact whoosh" that's hard to confuse with
 *     any other cue in the game.
 *   - **Bass thump** — a low triangle wave with a downward pitch
 *     slide, the visceral body of the impact.
 *   - **Brass fanfare** — a three-step triangle-wave arpeggio
 *     (root+fifth → fifth+octave → octave chord swell). Triangle
 *     waves have a brassier timbre than the sine chime, so the
 *     win actually sounds like a different *instrument* — not just
 *     a louder version of the landing chime.
 *   - **Bell sparkle** — a sine high-octave chord stack on the
 *     resolution beat, sells the celebration with shimmer on top.
 *
 * Lowered base octave (vs the chime) so the climb has room to ring
 * up two octaves without piercing — perceived loudness comes from
 * the layering + brass timbre, not raw pitch.
 *
 * Note-2 / note-3 staging uses `setTimeout` rather than scheduling
 * on the `AudioContext.currentTime` clock. `audio.tone` doesn't
 * expose a start-time offset; the alternative is to bypass it and
 * drive oscillators directly. We accept the JS event-loop jitter
 * (~1-4 ms in practice) because it's well under the ~30 ms
 * human transient-tightness threshold for note gaps of 100+ ms.
 * If the page unmounts mid-fanfare the deferred `audio.tone` calls
 * fire against a torn-down context — `getAudioContext()` returns
 * `null` in that state and the calls become silent no-ops, so the
 * setTimeout strategy is also safe-to-fire-late.
 *
 * @param score the bet slot's point value (sets the root note)
 * @param pan stereo position in `[-1, 1]`
 */
export const playWin = (score: number, pan = 0): void => {
	const base =
		score >= 100
			? 660
			: score >= 30
				? 523
				: score >= 10
					? 440
					: score >= 5
						? 392
						: 330;
	const fifth = base * 1.5;
	const octave = base * 2;

	// 1) Impact swoosh — bandpass white noise sweeping up. Lands at
	//    t=0 alongside the bass thump as the "BANG" of the win.
	audio.noise({
		duration: 0.35,
		type: "white",
		gain: 0.28,
		filter: { type: "bandpass", frequency: 600, Q: 1.2 },
		filterSweep: 6,
		pan,
	});

	// 2) Bass thump — low triangle with a downward pitch slide for
	//    visceral body.
	audio.tone({
		freq: base / 2,
		duration: 0.32,
		gain: 0.32,
		pan,
		wave: "triangle",
		pitchSlide: 0.4,
	});

	// 3) Brass note 1 — root + fifth stab. Triangle gives the brassy
	//    timbre so this doesn't blend back into the chime.
	audio.tone({
		freq: [base, fifth],
		duration: 0.16,
		gain: 0.3,
		pan,
		wave: "triangle",
		pitchSlide: 1.03,
	});

	// 4) Brass note 2 — fifth + octave climb at t=110ms.
	setTimeout(() => {
		audio.tone({
			freq: [fifth, octave],
			duration: 0.18,
			gain: 0.32,
			pan,
			wave: "triangle",
		});
	}, 110);

	// 5) Resolution chord at t=230ms — sustained octave + fifth +
	//    2-octave triangle chord. This is the headline "DAAAAH".
	setTimeout(() => {
		audio.tone({
			freq: [octave, octave * 1.5, octave * 2],
			duration: 0.75,
			gain: 0.38,
			pan,
			wave: "triangle",
		});
		// 6) Bell sparkle — sine high-octave stack on top of the
		//    chord swell for celebratory shimmer.
		audio.tone({
			freq: [octave * 2, octave * 3, octave * 4],
			duration: 0.55,
			gain: 0.16,
			pan,
		});
	}, 230);
};
