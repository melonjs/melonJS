/**
 * melonJS — Jungle Rabbit: every sound, synthesised.
 *
 * `audio.tone` / `audio.noise` build these from oscillators and filtered noise
 * at call time, so the example still ships with no audio assets — the same
 * bargain the textures make.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { audio } from "melonjs";

/**
 * A carrot: two quick rising notes.
 *
 * Rising because a pickup should feel like a gain — the same interval falling
 * reads as a mistake, which is the whole vocabulary of arcade feedback.
 * @param pan - -1 to 1, so a carrot taken to the left is heard to the left
 */
export const playPickup = (pan = 0, step = 1) => {
	// Each multiplier step lifts the whole blip by a tone, so a run of carrots
	// climbs and a reset audibly drops back. Capped by the caller, or a long
	// combo would walk it off the top of the register.
	const lift = 1.122 ** (step - 1);
	// The arcade coin shape: two notes, the second a fifth up and a beat
	// later, rather than both at once. `delay` sequences them on the AUDIO
	// clock, so the interval holds through a frame spike — a `setTimeout`
	// here would swing the second note late and turn a blip into a stumble.
	audio.tone({
		freq: 988 * lift,
		duration: 0.06,
		wave: "square",
		gain: 0.34,
		attack: 0.001,
		pan,
	});
	audio.tone({
		freq: 1480 * lift,
		duration: 0.13,
		wave: "square",
		gain: 0.3,
		attack: 0.001,
		pan,
		delay: 0.055,
	});
	// a sine doubling the second note two octaves up: it rounds the square's
	// edge so the blip reads BRIGHT over the music rather than harsh
	audio.tone({
		freq: 2960 * lift,
		duration: 0.09,
		gain: 0.12,
		attack: 0.001,
		pan,
		delay: 0.055,
	});
};

/** hitting a boulder: a wooden thud with a splash of white water over it */
export const playHit = (pan = 0) => {
	// the impact itself, diving a bit over an octave
	audio.tone({
		freq: 190,
		duration: 0.26,
		wave: "triangle",
		gain: 0.58,
		attack: 0.001,
		pitchSlide: 0.3,
		pan,
	});
	// a square an octave above it, short — this is the "clunk" that carries
	// over the music, where the triangle alone is felt more than heard
	audio.tone({
		freq: 380,
		duration: 0.09,
		wave: "square",
		gain: 0.28,
		attack: 0.001,
		pitchSlide: 0.4,
		pan,
	});
	// the water it throws up, the filter closing as it settles
	audio.noise({
		type: "white",
		duration: 0.32,
		gain: 0.4,
		attack: 0.002,
		pan,
		filter: { type: "lowpass", frequency: 2200, Q: 0.8 },
		filterSweep: 0.25,
	});
};

/** the boat leaving the water, and landing back in it */
export const playJump = () => {
	audio.tone({
		freq: 420,
		duration: 0.16,
		wave: "sine",
		gain: 0.153,
		attack: 0.004,
		pitchSlide: 0.45,
	});
};

export const playSplash = () => {
	audio.noise({
		type: "white",
		duration: 0.26,
		gain: 0.17,
		attack: 0.003,
		filter: { type: "bandpass", frequency: 900, Q: 0.9 },
		filterSweep: 0.7,
	});
};

/**
 * The river itself: a short burst of filtered noise, re-triggered on a timer.
 *
 * A continuous bed would want a looping source; retriggering a soft burst
 * every few hundred milliseconds costs nothing and, with the attack and decay
 * overlapping, is indistinguishable from one at this volume.
 */
export const playRiver = () => {
	audio.noise({
		type: "pink",
		duration: 0.9,
		gain: 0.085,
		attack: 0.25,
		filter: { type: "lowpass", frequency: 650, Q: 0.5 },
	});
};

/** running out of lives */
export const playCapsize = () => {
	audio.tone({
		freq: 300,
		duration: 0.7,
		wave: "sawtooth",
		gain: 0.238,
		attack: 0.01,
		pitchSlide: 0.6,
	});
	audio.noise({
		type: "brown",
		duration: 0.8,
		gain: 0.204,
		attack: 0.02,
		filter: { type: "lowpass", frequency: 900, Q: 0.7 },
		filterSweep: 0.3,
	});
};
