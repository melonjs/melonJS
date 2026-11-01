/**
 * melonJS — Glowpaint: sound effects.
 *
 * Every sound is synthesised on the fly with `audio.tone` / `audio.noise`,
 * so the example ships no audio files.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { audio } from "melonjs";

// a pentatonic run, so a long painting streak climbs without going sour
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (semitones: number) => 440 * 2 ** (semitones / 12);

/** One tile lit. `streak` counts tiles lit in a row without pausing. */
export const sfxPaint = (streak: number) => {
	const step = SCALE[Math.min(streak, SCALE.length - 1)];
	audio.tone({
		freq: note(step + 3),
		duration: 0.09,
		wave: "triangle",
		gain: 0.12,
		attack: 0.002,
	});
};

export const sfxShoot = () => {
	audio.tone({
		freq: 1200,
		duration: 0.12,
		wave: "square",
		gain: 0.05,
		attack: 0.001,
		pitchSlide: 0.35,
	});
};

export const sfxPop = () => {
	audio.noise({
		type: "white",
		duration: 0.14,
		gain: 0.2,
		filter: { type: "bandpass", frequency: 900, Q: 1.2 },
		filterSweep: 0.3,
	});
	audio.tone({
		freq: 300,
		duration: 0.18,
		wave: "sine",
		gain: 0.18,
		pitchSlide: 2.5,
	});
};

export const sfxUnpaint = () => {
	audio.tone({
		freq: 180,
		duration: 0.08,
		wave: "sawtooth",
		gain: 0.03,
		pitchSlide: 0.7,
	});
};

export const sfxPickup = () => {
	[0, 4, 7, 12].forEach((s, i) => {
		audio.tone({
			freq: note(s + 12),
			duration: 0.1,
			wave: "square",
			gain: 0.05,
			delay: i * 0.05,
		});
	});
};

export const sfxDie = () => {
	audio.noise({
		type: "brown",
		duration: 0.6,
		gain: 0.35,
		filter: { type: "lowpass", frequency: 1200 },
		filterSweep: 0.1,
	});
	audio.tone({
		freq: 660,
		duration: 0.7,
		wave: "sawtooth",
		gain: 0.08,
		pitchSlide: 0.1,
	});
};

export const sfxFall = () => {
	audio.tone({
		freq: 900,
		duration: 0.9,
		wave: "sine",
		gain: 0.15,
		pitchSlide: 0.12,
	});
};

export const sfxCrumble = () => {
	audio.noise({
		type: "pink",
		duration: 0.18,
		gain: 0.08,
		filter: { type: "lowpass", frequency: 700 },
	});
};

export const sfxSpawn = () => {
	audio.tone({
		freq: 110,
		duration: 0.5,
		wave: "triangle",
		gain: 0.1,
		attack: 0.2,
		pitchSlide: 1.5,
	});
};

export const sfxClear = () => {
	[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => {
		audio.tone({
			freq: note(s),
			duration: 0.22,
			wave: "triangle",
			gain: 0.12,
			delay: i * 0.08,
		});
	});
};

export const sfxGameOver = () => {
	[12, 7, 3, 0].forEach((s, i) => {
		audio.tone({
			freq: note(s - 12),
			duration: 0.35,
			wave: "triangle",
			gain: 0.14,
			delay: i * 0.22,
		});
	});
};

export const sfxStart = () => {
	[0, 7, 12].forEach((s, i) => {
		audio.tone({
			freq: note(s),
			duration: 0.12,
			wave: "square",
			gain: 0.05,
			delay: i * 0.07,
		});
	});
};
