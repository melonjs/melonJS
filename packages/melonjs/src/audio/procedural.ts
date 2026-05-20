/**
 * Procedural audio — fire-and-forget envelope-shaped primitives that
 * build on the shared `AudioContext` exposed by `backend.ts`. Designed
 * for "just play a beep / explosion / whoosh" use cases where loading
 * an audio file would be overkill.
 *
 * Two primitives:
 *   - `tone` for pitched sources (clicks, chimes, lasers, chord pings).
 *   - `noise` for non-pitched sources (explosions, hi-hats, swooshes,
 *     wind, footsteps).
 *
 * Both share the same envelope + output routing rails so future
 * primitives can be added with zero copy-paste.
 */

import { getAudioContext, getMasterGain } from "./backend.ts";
import type { NoiseOptions, ToneOptions } from "./types.ts";

// ---------------------------------------------------------------------
// Procedural-audio internals — shared between `tone` and `noise`.
// ---------------------------------------------------------------------

/**
 * Resume the AudioContext if a browser autoplay policy has it
 * suspended. Best-effort and idempotent; the promise is intentionally
 * unawaited because we want the same call site to work in both gesture
 * and non-gesture contexts.
 * @ignore
 */
function _resumeIfSuspended(ctx: AudioContext): void {
	if (ctx.state === "suspended") {
		ctx.resume().catch(() => {
			/* ignore */
		});
	}
}

/**
 * Build the linear-attack / exponential-decay gain envelope used by
 * every procedural primitive.
 *
 * The decay uses an exponential ramp when there's enough headroom for
 * a smooth taper (peak gain greater than the `0.0001` near-silence
 * floor). Otherwise we use a linear ramp to `0`, which covers both
 * `gain === 0` (exp ramps reject a `0` start value with
 * `InvalidStateError`) AND tiny positive gains where a target of
 * `0.0001` would ramp UP and produce an audible click.
 * @ignore
 */
function _buildGainEnvelope(
	ctx: AudioContext,
	t0: number,
	t1: number,
	attack: number,
	duration: number,
	gain: number,
): GainNode {
	// Clamp attack to `[0.001, duration / 2]`. For very short durations
	// (< 2 ms) the range is degenerate — the upper bound wins so the
	// envelope still fits inside the playback window.
	const atk = Math.min(duration / 2, Math.max(0.001, attack));
	const env = ctx.createGain();
	env.gain.setValueAtTime(0, t0);
	env.gain.linearRampToValueAtTime(gain, t0 + atk);
	if (gain > 0.0001) {
		env.gain.exponentialRampToValueAtTime(0.0001, t1);
	} else {
		env.gain.linearRampToValueAtTime(0, t1);
	}
	return env;
}

/**
 * Final hop of any procedural primitive — route `source` to the audio
 * module's master gain (so `muteAll` / `setVolume` apply), optionally
 * through a `StereoPanner`. Falls back to `ctx.destination` only if the
 * master gain isn't available (very restricted audio envs).
 *
 * Returns the `StereoPannerNode` it created (or `null` if `pan === 0`)
 * so the caller can disconnect it once playback ends.
 * @ignore
 */
function _connectToOutput(
	ctx: AudioContext,
	source: AudioNode,
	pan: number,
	t0: number,
): StereoPannerNode | null {
	const out = getMasterGain() ?? ctx.destination;
	if (pan === 0) {
		source.connect(out);
		return null;
	}
	const panner = ctx.createStereoPanner();
	panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
	source.connect(panner).connect(out);
	return panner;
}

/**
 * Fire a single-shot envelope-shaped oscillator on the shared
 * {@link getAudioContext} context. Designed for the "just play a beep"
 * niche where loading an audio file is overkill — UI clicks, hit
 * confirms, retro arcade-style cues, placeholder feedback during
 * prototyping.
 *
 * Multi-partial `freq` makes chimes, bells, and simple chords a single
 * call; `pitchSlide` covers percussive pitch-drops and rising stings.
 * The context is shared with file-based playback, so the usual browser
 * autoplay gating applies: the first call after a user gesture lets
 * every subsequent call play.
 *
 * **Requires WebAudio.** When WebAudio is not supported (or audio is
 * explicitly disabled) this is a silent no-op: {@link getAudioContext}
 * returns `null` and nothing is scheduled. Use the return value of
 * {@link getAudioContext} to detect that case up front if your game
 * wants to show a "no audio" badge or fall back to a different
 * feedback channel.
 * @param opts - the {@link ToneOptions} (frequency, duration,
 *   envelope, pan, slide). See the interface for per-field defaults.
 * @example
 * // simple UI click
 * me.audio.tone({ freq: 1200, duration: 0.08, pitchSlide: 0.5 });
 * // chime, panned right, two partials a fifth apart
 * me.audio.tone({ freq: [880, 1320], duration: 0.4, gain: 0.18, pan: 0.5 });
 * // descending "thud" — square wave with a wide pitch drop
 * me.audio.tone({ freq: 200, duration: 0.15, wave: "square", pitchSlide: 0.25 });
 * @category Audio
 */
export function tone(opts: ToneOptions): void {
	const ctx = getAudioContext();
	if (!ctx) return;

	const {
		freq,
		duration,
		wave = "sine",
		gain = 0.1,
		attack = 0.005,
		pan = 0,
		pitchSlide = 1,
	} = opts;

	const freqs = Array.isArray(freq) ? freq : [freq];
	// Empty partial list = nothing to play. Bail before building any
	// nodes so we don't leave an env/panner connected forever (no
	// oscillator would ever fire `onended` to clean them up).
	if (freqs.length === 0) return;

	_resumeIfSuspended(ctx);

	const dur = Math.max(0.001, duration);
	const t0 = ctx.currentTime;
	const t1 = t0 + dur;
	const env = _buildGainEnvelope(ctx, t0, t1, attack, dur, gain);
	const panner = _connectToOutput(ctx, env, pan, t0);

	// Count oscillators down to zero so the LAST one to end is the one
	// that disconnects the shared envelope + panner — otherwise we'd
	// leave the graph half-wired.
	let remaining = freqs.length;
	for (const f of freqs) {
		const osc = ctx.createOscillator();
		osc.type = wave;
		osc.frequency.setValueAtTime(f, t0);
		// Pitch slide also goes through `exponentialRampToValueAtTime`,
		// which needs the starting frequency to be > 0. Skip the ramp
		// when `f <= 0` (silent / DC) so it can't throw.
		if (pitchSlide !== 1 && f > 0) {
			osc.frequency.exponentialRampToValueAtTime(
				Math.max(0.01, f * pitchSlide),
				t1,
			);
		}
		osc.connect(env);
		osc.start(t0);
		// Small tail so the exponential ramp has room to settle before
		// the node is torn down.
		osc.stop(t1 + 0.02);
		osc.onended = () => {
			osc.disconnect();
			if (--remaining === 0) {
				env.disconnect();
				panner?.disconnect();
			}
		};
	}
}

/**
 * Fill a buffer in-place with single-channel noise samples of the
 * requested spectral colour. Pink uses Paul Kellet's refined coefficients;
 * brown is a leaky integrator over white. Output is roughly normalised
 * to `[-1, 1]` for both coloured variants.
 * @ignore
 */
function fillNoiseBuffer(
	data: Float32Array,
	type: "white" | "pink" | "brown",
): void {
	const n = data.length;
	if (type === "white") {
		for (let i = 0; i < n; i++) {
			data[i] = Math.random() * 2 - 1;
		}
		return;
	}
	if (type === "pink") {
		let b0 = 0;
		let b1 = 0;
		let b2 = 0;
		let b3 = 0;
		let b4 = 0;
		let b5 = 0;
		let b6 = 0;
		for (let i = 0; i < n; i++) {
			const w = Math.random() * 2 - 1;
			b0 = 0.99886 * b0 + w * 0.0555179;
			b1 = 0.99332 * b1 + w * 0.0750759;
			b2 = 0.969 * b2 + w * 0.153852;
			b3 = 0.8665 * b3 + w * 0.3104856;
			b4 = 0.55 * b4 + w * 0.5329522;
			b5 = -0.7616 * b5 - w * 0.016898;
			data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
			b6 = w * 0.115926;
		}
		return;
	}
	// brown: leaky integrator over white, rescaled into audible range.
	let last = 0;
	for (let i = 0; i < n; i++) {
		const w = Math.random() * 2 - 1;
		last = (last + 0.02 * w) / 1.02;
		data[i] = last * 3.5;
	}
}

/**
 * Fire a single-shot envelope-shaped noise burst on the shared
 * {@link getAudioContext} context. Sits alongside {@link tone} as the
 * non-pitched half of the procedural-audio surface — `tone` is the right
 * tool for anything with a clear pitch (clicks, chimes, lasers), `noise`
 * is the right tool for anything percussive without one (explosions,
 * hi-hats, swooshes, footsteps, wind).
 *
 * The output runs through the master gain shared with file-based
 * playback, so {@link muteAll} / {@link setVolume} apply uniformly.
 * Browser autoplay gating applies — the first call after a user
 * gesture lets every subsequent call play.
 *
 * **Requires WebAudio.** When WebAudio is not supported (or audio is
 * explicitly disabled) this is a silent no-op: {@link getAudioContext}
 * returns `null` and nothing is scheduled.
 * @param opts - the {@link NoiseOptions} (duration, spectral colour,
 *   envelope, pan, optional filter + sweep). See the interface for
 *   per-field defaults.
 * @example
 * // Explosion: brown rumble closing into a thud
 * me.audio.noise({
 *     duration: 0.8,
 *     type: "brown",
 *     gain: 0.4,
 *     filter: { type: "lowpass", frequency: 800 },
 *     filterSweep: 0.3,
 * });
 * // Hi-hat: short, bright, top-end only
 * me.audio.noise({
 *     duration: 0.05,
 *     filter: { type: "highpass", frequency: 7000 },
 *     gain: 0.2,
 * });
 * // Swoosh: bandpass white with rising sweep — UI transition, melee whoosh
 * me.audio.noise({
 *     duration: 0.3,
 *     filter: { type: "bandpass", frequency: 400, Q: 1.5 },
 *     filterSweep: 4,
 *     gain: 0.3,
 * });
 * // Wind / breath: long, low-pink, no sweep
 * me.audio.noise({
 *     duration: 2,
 *     type: "pink",
 *     filter: { type: "bandpass", frequency: 600 },
 *     gain: 0.08,
 * });
 * // Footstep on dirt — short brown thump
 * me.audio.noise({
 *     duration: 0.08,
 *     type: "brown",
 *     filter: { type: "lowpass", frequency: 200 },
 *     gain: 0.25,
 * });
 * @category Audio
 */
export function noise(opts: NoiseOptions): void {
	const ctx = getAudioContext();
	if (!ctx) return;

	const {
		duration,
		type = "white",
		gain = 0.1,
		attack = 0.005,
		pan = 0,
		filter,
		filterSweep = 1,
	} = opts;

	_resumeIfSuspended(ctx);

	const dur = Math.max(0.001, duration);
	const t0 = ctx.currentTime;
	const t1 = t0 + dur;
	const env = _buildGainEnvelope(ctx, t0, t1, attack, dur, gain);

	// Source: a one-shot buffer of `dur * sampleRate` random samples.
	const sampleCount = Math.max(1, Math.ceil(dur * ctx.sampleRate));
	const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
	fillNoiseBuffer(buffer.getChannelData(0), type);
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.connect(env);

	// Optional band-shaping filter (with optional sweep on its frequency).
	let tail: AudioNode = env;
	if (filter !== undefined) {
		const biquad = ctx.createBiquadFilter();
		biquad.type = filter.type;
		biquad.frequency.setValueAtTime(filter.frequency, t0);
		if (filter.Q !== undefined) {
			biquad.Q.setValueAtTime(filter.Q, t0);
		}
		// Filter sweep also goes through `exponentialRampToValueAtTime`
		// — only schedule the ramp when both start and target are > 0.
		if (filterSweep !== 1 && filter.frequency > 0) {
			biquad.frequency.exponentialRampToValueAtTime(
				Math.max(0.01, filter.frequency * filterSweep),
				t1,
			);
		}
		tail.connect(biquad);
		tail = biquad;
	}

	const panner = _connectToOutput(ctx, tail, pan, t0);

	src.start(t0);
	src.stop(t1 + 0.02);
	src.onended = () => {
		src.disconnect();
		env.disconnect();
		// If a filter was inserted between env and the output, tail !== env.
		if (tail !== env) tail.disconnect();
		panner?.disconnect();
	};
}
