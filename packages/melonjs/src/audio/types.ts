/**
 * Public type declarations for the audio module. Kept in a dedicated
 * file so the runtime entry point (`audio.ts`) stays focused on
 * implementation; consumers can import types from
 * `me.audio` exactly as before.
 */

/**
 * Options for `tone`.
 * @category Audio
 */
export interface ToneOptions {
	/**
	 * Carrier frequency in Hz. Pass an array to layer multiple
	 * partials (chord, bell ring, fundamental + harmonic) — they
	 * share the gain envelope, pan, and pitch slide.
	 */
	freq: number | number[];
	/** Total sound length in seconds (envelope decays over this window). */
	duration: number;
	/** Oscillator waveform. Defaults to `"sine"`. */
	wave?: OscillatorType;
	/** Peak gain at attack end, `0..1`. Defaults to `0.1`. */
	gain?: number;
	/**
	 * Attack time in seconds — linear ramp from 0 up to `gain`.
	 * Capped at `duration / 2`. Defaults to `0.005`.
	 */
	attack?: number;
	/**
	 * Stereo pan, `-1` (full left) to `1` (full right). Defaults to `0`.
	 */
	pan?: number;
	/**
	 * Frequency multiplier applied over `duration` as an exponential
	 * ramp. `1` = no slide (default); `0.5` = slide an octave down;
	 * `2` = slide an octave up. Useful for percussive impacts (small
	 * value < 1) or rising stings (value > 1).
	 */
	pitchSlide?: number;
}
