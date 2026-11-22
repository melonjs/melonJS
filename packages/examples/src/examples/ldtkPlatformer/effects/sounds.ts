/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { audio } from "melonjs";

/**
 * The game's sounds, made by the engine as they are played: `audio.tone` is
 * a note, `audio.noise` a hiss or a thump, so there is no sound file to
 * load. A second note is sequenced with `delay`, on the audio clock.
 */
export const sounds = {
	jump() {
		audio.tone({
			freq: 280,
			duration: 0.14,
			wave: "square",
			pitchSlide: 1.9,
			gain: 0.04,
		});
	},

	/** the second jump, in the air: the same blip, higher */
	airJump() {
		audio.tone({
			freq: 420,
			duration: 0.12,
			wave: "square",
			pitchSlide: 1.9,
			gain: 0.04,
		});
	},

	land() {
		audio.noise({
			duration: 0.08,
			type: "brown",
			gain: 0.3,
			filter: { type: "lowpass", frequency: 300 },
		});
	},

	/** into the water, or out of it */
	splash() {
		audio.noise({
			duration: 0.35,
			gain: 0.12,
			filter: { type: "bandpass", frequency: 1800, Q: 0.7 },
			filterSweep: 0.3,
		});
	},

	/** a stroke under water */
	stroke() {
		audio.noise({
			duration: 0.15,
			type: "pink",
			gain: 0.08,
			filter: { type: "lowpass", frequency: 700 },
			filterSweep: 0.5,
		});
	},

	/** an item taken: two notes, the second a fourth above */
	pickup() {
		audio.tone({ freq: 988, duration: 0.08, wave: "square", gain: 0.04 });
		audio.tone({
			freq: 1319,
			duration: 0.25,
			wave: "square",
			gain: 0.04,
			delay: 0.07,
		});
	},

	/** a teleport taken: a rising hum while the screen closes */
	teleport() {
		audio.tone({
			freq: [220, 331],
			duration: 0.5,
			wave: "triangle",
			pitchSlide: 3,
			gain: 0.06,
		});
	},

	/** and one falling as it opens again */
	arrive() {
		audio.tone({
			freq: [660, 993],
			duration: 0.4,
			wave: "triangle",
			pitchSlide: 0.33,
			gain: 0.06,
		});
	},

	/** a room seen for the first time: three notes going up */
	discover() {
		[523, 659, 784].forEach((freq, i) => {
			audio.tone({ freq, duration: 0.3, gain: 0.03, delay: i * 0.09 });
		});
	},
};
