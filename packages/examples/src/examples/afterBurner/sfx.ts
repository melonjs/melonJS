/**
 * Procedural SFX for the AfterBurner showcase. Built on the public
 * `audio.tone` / `audio.noise` API shipped in melonJS 19.5 — no audio
 * assets, no preload step, just a WebAudio graph per shot.
 *
 * Each function picks a sound shape that reads at a glance: laser blip
 * for fire, mid-band crunch for an enemy explosion, brown-noise rumble
 * for the player death. Tweak the frequencies / durations here; the
 * gameplay code only knows the call name.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { audio } from "melonjs";

/**
 * Punchy laser shot: a noise crack on the attack + a long sawtooth tone
 * with a deep downward pitch slide. Three layers, all triggered together:
 *
 *  1. **noise crack** — bandpass-shaped white noise, 25ms — adds the
 *     "kkkt" transient at the front so the shot has bite, not just
 *     a tweet.
 *  2. **main tone** — sawtooth from 1400 → 110 Hz over 180ms — the
 *     deep slide is what makes it read as a laser blast vs. a beep.
 *  3. **partial** — high square at 2200 Hz with the same slide — adds
 *     grit and a touch of metallic ring without dominating.
 *
 * Gains kept modest so holding fire (140ms cooldown) doesn't fatigue.
 * Pan applies across all three so the shot sits coherently on one side.
 */
export function playFire(pan = 0): void {
	audio.noise({
		type: "white",
		duration: 0.025,
		gain: 0.18,
		attack: 0.001,
		pan,
		filter: { type: "bandpass", frequency: 1800, Q: 1.5 },
		filterSweep: 0.6,
	});
	audio.tone({
		freq: 1400,
		duration: 0.18,
		wave: "sawtooth",
		gain: 0.12,
		attack: 0.002,
		pitchSlide: 0.08, // big drop — "pyoow" not "pip"
		pan,
	});
	audio.tone({
		freq: 2200,
		duration: 0.12,
		wave: "square",
		gain: 0.04,
		attack: 0.001,
		pitchSlide: 0.12,
		pan,
	});
}

/**
 * Cinema-style fireball. Five overlapping layers, two of them staggered
 * via `setTimeout`, modelled on real demolition footage rather than a
 * single noise burst:
 *
 *  1. **initial crack** (t=0) — short highpass white-noise transient,
 *     the sharp "bang" that opens the explosion.
 *  2. **body punch** (t=0) — long 90→25 Hz sine slide. Carries most of
 *     the perceived "weight" of the blast.
 *  3. **mid-band growl** (t=0) — sawtooth at 180 Hz, downward slide.
 *     Adds harmonic grit to the body so it sounds like metal tearing,
 *     not just a thump.
 *  4. **deep rumble tail** (t=0) — brown noise, 1.4 s, lowpass closing
 *     downward. The lingering boom-echo.
 *  5. **secondary blast** (t≈80 ms) — repeat of crack + smaller punch.
 *     Real explosions are never a single bang; the double-tap turns a
 *     "thump" into a "BOOM-boom".
 *
 * Gains are stronger than the previous version — rapid kills can stack
 * three or four of these but the master gain ceiling in the audio
 * module clips gracefully, so we lean into the impact.
 */
export function playEnemyHit(pan = 0): void {
	// 1. crack
	audio.noise({
		type: "white",
		duration: 0.06,
		gain: 0.55,
		attack: 0.0005,
		pan,
		filter: { type: "highpass", frequency: 900, Q: 0.7 },
	});
	// 2. body punch
	audio.tone({
		freq: 90,
		duration: 0.55,
		wave: "sine",
		gain: 0.8,
		attack: 0.001,
		pitchSlide: 0.28,
		pan,
	});
	// 3. mid-band growl
	audio.tone({
		freq: 180,
		duration: 0.35,
		wave: "sawtooth",
		gain: 0.32,
		attack: 0.002,
		pitchSlide: 0.25,
		pan,
	});
	// 4. deep rumble tail
	audio.noise({
		type: "brown",
		duration: 1.4,
		gain: 0.55,
		attack: 0.015,
		pan,
		filter: { type: "lowpass", frequency: 1600, Q: 0.5 },
		filterSweep: 0.18,
	});
	// 5. secondary blast — real explosions double-tap
	setTimeout(() => {
		audio.noise({
			type: "white",
			duration: 0.05,
			gain: 0.4,
			attack: 0.001,
			pan,
			filter: { type: "highpass", frequency: 1200, Q: 0.8 },
		});
		audio.tone({
			freq: 70,
			duration: 0.32,
			wave: "sine",
			gain: 0.5,
			attack: 0.002,
			pitchSlide: 0.3,
			pan,
		});
	}, 80);
}

/**
 * Long brown-noise rumble for the player explosion. Heavier than the
 * enemy hit (longer + lower + bigger gain) so the death reads as a
 * different event, not just another bigger pop. Layered tone underneath
 * adds a "hull tearing" sub-bass.
 */
export function playPlayerDeath(): void {
	audio.noise({
		type: "brown",
		duration: 1.1,
		gain: 0.55,
		attack: 0.005,
		filter: { type: "lowpass", frequency: 900, Q: 0.6 },
		filterSweep: 0.25,
	});
	audio.tone({
		freq: [55, 82],
		duration: 0.9,
		wave: "sawtooth",
		gain: 0.18,
		attack: 0.01,
		pitchSlide: 0.4,
	});
}
