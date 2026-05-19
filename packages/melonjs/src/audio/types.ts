/**
 * Public type declarations for the audio module. Kept in a dedicated
 * file so the runtime entry point (`audio.ts`) stays focused on
 * implementation; consumers can import types from
 * `me.audio` exactly as before.
 */

/**
 * Sound asset descriptor passed to `audio.load`.
 * @category Audio
 */
export interface SoundAsset {
	/** Logical name used to play / stop / reference the sound later. */
	name: string;
	/**
	 * Path or data URL to the audio resource (without extension when
	 * using `audio.init` formats).
	 */
	src: string;
	/** Begin playback immediately on load. Defaults to `false`. */
	autoplay?: boolean;
	/** Loop playback when the clip ends. Defaults to `false`. */
	loop?: boolean;
	/**
	 * Stream the resource instead of fully decoding upfront — preferred
	 * for long music tracks. Defaults to `false`.
	 */
	stream?: boolean;
	/**
	 * Force the HTML5 `<audio>` element backend instead of WebAudio
	 * decoding. Defaults to `false`.
	 */
	html5?: boolean;
}

/**
 * Optional settings forwarded to the underlying `fetch` request used
 * to load audio resources. Mirrors a subset of the standard `RequestInit`
 * surface (see
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/RequestInit | MDN — RequestInit}).
 * @category Audio
 */
export interface LoadSettings {
	/** Cache-busting query string appended to the resource URL. */
	nocache?: string;
	/** Forwarded to `fetch.credentials` for cross-origin authenticated requests. */
	withCredentials?: boolean;
}

/**
 * Spatial-audio cone + distance attributes passed to `audio.panner`.
 * Mirrors the WebAudio `PannerNode` configuration so positional sound
 * effects can be set up declaratively (see
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics#creating_a_panner_node | MDN — creating a panner node}
 * for an end-to-end conceptual overview).
 * @category Audio
 */
export interface PannerAttributes {
	/**
	 * Inner cone angle in degrees within which there is no volume
	 * reduction. Defaults to `360` (omnidirectional).
	 */
	coneInnerAngle?: number | undefined;
	/**
	 * Outer cone angle in degrees outside which the volume is reduced
	 * to `coneOuterGain`. Defaults to `360`.
	 */
	coneOuterAngle?: number | undefined;
	/**
	 * Linear volume multiplier (`0..1`) applied outside
	 * `coneOuterAngle`. Defaults to `0` (silent outside the cone).
	 */
	coneOuterGain?: number | undefined;
	/**
	 * Distance-attenuation algorithm. Defaults to `"inverse"`.
	 */
	distanceModel?: "inverse" | "linear";
	/**
	 * Distance at which volume reduction stops (used by the `"linear"`
	 * model; clamps the falloff curve for the other one). Defaults to
	 * `10000`.
	 */
	maxDistance?: number;
	/**
	 * Spatialization algorithm — `"equalpower"` (cheap, stereo-only) or
	 * `"HRTF"` (head-related, full 3D). Defaults to `"HRTF"`.
	 */
	panningModel?: "HRTF" | "equalpower";
	/**
	 * Reference distance for the falloff curve — volume is `1` at this
	 * distance from the listener. Defaults to `1`.
	 */
	refDistance?: number;
	/**
	 * Steepness of the falloff curve for the `"inverse"` model.
	 * Defaults to `1`.
	 */
	rolloffFactor?: number;
}

/**
 * Optional band-shaping filter applied to the procedural noise burst
 * produced by `noise`. Mirrors a subset of the WebAudio `BiquadFilterNode`
 * configuration so users can sculpt the spectral colour without dropping
 * to a custom WebAudio graph.
 * @category Audio
 */
export interface NoiseFilter {
	/**
	 * Filter shape — `"lowpass"`, `"highpass"`, `"bandpass"`,
	 * `"lowshelf"`, `"highshelf"`, `"peaking"`, `"notch"`, or
	 * `"allpass"`. See the WebAudio `BiquadFilterNode` docs.
	 */
	type: BiquadFilterType;
	/** Centre / cutoff frequency in Hz. */
	frequency: number;
	/** Filter resonance / quality factor. Defaults to the WebAudio default (`1`). */
	Q?: number;
}

/**
 * Options for `noise`.
 * @category Audio
 */
export interface NoiseOptions {
	/** Total burst length in seconds (envelope decays over this window). */
	duration: number;
	/**
	 * Spectral colour of the noise source:
	 *   - `"white"` — flat, all frequencies equal (default).
	 *   - `"pink"` — −3 dB / octave roll-off, perceptually balanced —
	 *     classic for breath, wind, and acoustic-sounding ambient texture.
	 *   - `"brown"` (red) — −6 dB / octave roll-off, low and rumbly —
	 *     classic for distant thunder, ocean, low-fi rumble.
	 */
	type?: "white" | "pink" | "brown";
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
	 * Optional {@link NoiseFilter} applied to the noise source before
	 * the master gain. Use this to colour the noise — a lowpass on
	 * brown noise gives "explosion thump", a highpass on white gives
	 * "hi-hat tick", a bandpass gives "swoosh".
	 */
	filter?: NoiseFilter;
	/**
	 * Frequency multiplier applied to {@link NoiseFilter.frequency}
	 * over `duration` as an exponential ramp. `1` = no sweep (default);
	 * `>1` = filter opens upward (rising swoosh, laser pew);
	 * `<1` = filter closes downward (descending thunk, explosion settle).
	 * Has no effect when `filter` is unset.
	 */
	filterSweep?: number;
}

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
