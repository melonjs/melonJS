// external import
import { Howl, Howler } from "howler";
import { clamp } from "./../math/math.ts";
import { isDataUrl } from "./../utils/string.ts";
import type {
	LoadSettings,
	NoiseFilter,
	NoiseOptions,
	PannerAttributes,
	SoundAsset,
	ToneOptions,
} from "./types.ts";

// re-export so `me.audio.<Type>` resolves alongside the runtime API
export type {
	LoadSettings,
	NoiseFilter,
	NoiseOptions,
	PannerAttributes,
	SoundAsset,
	ToneOptions,
};

/**
 * audio channel list
 * @ignore
 */
const audioTracks: Record<string, Howl | undefined> = {};

/**
 * current active track
 * @ignore
 */
let current_track_id: string | null = null;

/**
 * error retry counter
 * @ignore
 */
let retry_counter: number = 0;

/**
 * list of active audio formats
 * @ignore
 */
let audioExts: string[] = [];

/**
 * event listener callback on load error
 * @ignore
 */
const soundLoadError = function (
	sound_name: string,
	onerror_cb?: () => void,
): void {
	// check the retry counter
	if (retry_counter++ > 3) {
		// something went wrong
		const errmsg = `melonJS: failed loading ${sound_name}`;
		if (!stopOnAudioError) {
			// disable audio
			disable();
			// call error callback if defined
			onerror_cb?.();
			// warning
			console.warn(`${errmsg}, disabling audio`);
		} else {
			onerror_cb?.();
			// throw an exception and stop everything !
			throw new Error(errmsg);
		}
		// else try loading again !
	} else {
		audioTracks[sound_name]?.load();
	}
};

/**
 * Whether to stop on an audio loading error.
 *
 * When `true`, melonJS throws an exception and aborts loading.
 * When `false`, melonJS disables sound and logs a warning to the console.
 * @default true
 */
// eslint-disable-next-line prefer-const
export let stopOnAudioError: boolean = true;

/**
 * Initialize and configure the audio module.
 *
 * For maximum browser coverage, list at least two formats — typically
 * webm first then mp3. Webm has near-universal modern coverage with
 * great compression / quality balance; mp3 covers older browsers.
 * Order matters: melonJS picks the first compatible format from the
 * list, so put the preferred one first.
 * @param format - Comma-separated audio formats to prioritize.
 *   One or more of: `"mp3"`, `"mpeg"`, `"opus"`, `"ogg"`, `"oga"`,
 *   `"wav"`, `"aac"`, `"caf"`, `"m4a"`, `"m4b"`, `"mp4"`, `"weba"`,
 *   `"webm"`, `"dolby"`, `"flac"`. Defaults to `"mp3"`.
 * @returns `true` when audio support was successfully initialised.
 * @example
 * // initialise with webm preferred, mp3 as fallback
 * if (!me.audio.init("webm,mp3")) {
 *     alert("Sorry but your browser does not support html 5 audio !");
 *     return;
 * }
 * @category Audio
 */
export function init(format: string = "mp3"): boolean {
	// convert it into an array
	audioExts = format.split(",");

	return !Howler.noAudio;
}

/**
 * Returns the underlying WebAudio `AudioContext` used by the audio
 * module (the same one shared with file-based playback), or `null` if
 * audio is disabled or no compatible WebAudio implementation is
 * available.
 *
 * Use this when you need to build a custom WebAudio graph — procedural
 * SFX, custom filters / spatial nodes, audio analysis — without
 * spawning a second context. Browsers throttle or refuse multiple
 * `AudioContext` instances on the same page and each has its own
 * suspend-until-gesture state, so sharing matters.
 *
 * The context is lazily created on first access; the call also returns
 * the cached instance on every subsequent call.
 * @category Audio
 */
export function getAudioContext(): AudioContext | null {
	if (Howler.noAudio) return null;
	// Howler only creates its `AudioContext` lazily — on the first Howl
	// constructor, the first volume/mute call, etc. Procedural-only
	// users (calling `tone` without ever loading a sound file) never
	// hit any of those code paths, leaving `Howler.ctx` undefined.
	// Nudging `Howler.volume()` triggers Howler's internal
	// `setupAudioContext` without changing the master volume.
	if (!Howler.ctx) {
		Howler.volume(Howler.volume());
	}
	// `ctx` is declared non-nullable in @types/howler but can still be
	// undefined when setup couldn't create one (very restricted envs).
	return Howler.ctx ?? null;
}

/**
 * Check whether the given audio codec is supported by the browser.
 * @param codec - The audio format to check.
 * @returns `true` when the format is supported.
 * @category Audio
 */
export function hasFormat(codec: string): boolean {
	return hasAudio() && Howler.codecs(codec);
}

/**
 * Check whether audio (HTML5 or WebAudio) is supported by the browser.
 * @returns `true` when at least one audio backend is available.
 * @category Audio
 */
export function hasAudio(): boolean {
	return !Howler.noAudio;
}

/**
 * Enable audio output. Only useful if audio is supported and was
 * previously disabled through {@link disable}.
 * @category Audio
 */
export function enable(): void {
	unmuteAll();
}

/**
 * Disable audio output.
 * @category Audio
 */
export function disable(): void {
	muteAll();
}

/**
 * Load an audio file.
 * @param sound - The {@link SoundAsset} descriptor — logical `name`,
 *   `src` path (extensions resolved against {@link init}'s format list,
 *   or a full data URL), and optional playback flags (`autoplay`,
 *   `loop`, `stream`, `html5`).
 * @param onloadcb - Called when the resource has finished loading.
 * @param onerrorcb - Called when loading fails.
 * @param settings - Optional {@link LoadSettings} — currently `nocache`
 *   (cache-buster query string) and `withCredentials` (cross-origin
 *   auth). Forwarded to the underlying `fetch` request.
 * @returns The number of assets loaded (always `1` on success).
 * @category Audio
 */
export function load(
	sound: SoundAsset,
	onloadcb?: () => void,
	onerrorcb?: () => void,
	settings: LoadSettings = {},
): number {
	const urls: string[] = [];
	if (audioExts.length === 0) {
		throw new Error(
			"target audio extension(s) should be set through me.audio.init() before calling the preloader.",
		);
	}
	if (isDataUrl(sound.src)) {
		urls.push(sound.src);
	} else {
		for (let i = 0; i < audioExts.length; i++) {
			urls.push(
				`${sound.src + sound.name}.${audioExts[i]}${settings.nocache ?? ""}`,
			);
		}
	}

	audioTracks[sound.name] = new Howl({
		src: urls,
		volume: Howler.volume(),
		autoplay: sound.autoplay === true,
		loop: (sound.loop = true),
		html5: sound.stream === true || sound.html5 === true,
		// @ts-expect-error xhrWithCredentials is a valid Howl option but not in the type definitions
		xhrWithCredentials: settings.withCredentials,
		onloaderror() {
			soundLoadError.call(this, sound.name, onerrorcb);
		},
		onload() {
			retry_counter = 0;
			if (typeof onloadcb === "function") {
				onloadcb();
			}
		},
	});

	return 1;
}

/**
 * Play the specified sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param loop - Whether to loop the clip. Defaults to `false`.
 * @param onend - Called when the sound instance ends playing.
 * @param volume - Playback volume, `0.0..1.0`. Defaults to the current
 *   global volume.
 * @returns The sound instance ID.
 * @example
 * // play the "cling" audio clip
 * me.audio.play("cling");
 * // play & loop the "engine" audio clip
 * me.audio.play("engine", true);
 * // play the "gameover_sfx" audio clip and call myFunc when finished
 * me.audio.play("gameover_sfx", false, myFunc);
 * // play the "gameover_sfx" audio clip at half volume
 * me.audio.play("gameover_sfx", false, null, 0.5);
 * @category Audio
 */
export function play(
	sound_name: string,
	loop: boolean = false,
	onend?: (() => void) | null,
	volume?: number,
): number {
	const sound = audioTracks[sound_name];
	if (sound) {
		const id = sound.play();
		if (typeof loop === "boolean") {
			// arg[0] can take different types in howler 2.0
			sound.loop(loop, id);
		}
		sound.volume(
			typeof volume === "number" ? clamp(volume, 0.0, 1.0) : Howler.volume(),
			id,
		);
		if (typeof onend === "function") {
			if (loop) {
				sound.on("end", onend, id);
			} else {
				sound.once("end", onend, id);
			}
		}
		return id;
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Fade a currently playing sound between two volumes.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param from - Volume to fade from, `0.0..1.0`.
 * @param to - Volume to fade to, `0.0..1.0`.
 * @param duration - Fade time in milliseconds.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are faded.
 * @category Audio
 */
export function fade(
	sound_name: string,
	from: number,
	to: number,
	duration: number,
	id?: number,
): void {
	const sound = audioTracks[sound_name];
	if (sound) {
		sound.fade(from, to, duration, id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Get or set the playback position of a sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param args - Optional seek position in seconds, optionally followed
 *   by the sound instance ID.
 * @returns The current seek position when no extra arguments are given.
 * @example
 * // read the current position of the background music
 * let current_pos = me.audio.seek("dst-gameforest");
 * // rewind the background music to the beginning
 * me.audio.seek("dst-gameforest", 0);
 * @category Audio
 */
export function seek(sound_name: string, ...args: number[]): number {
	const sound = audioTracks[sound_name];
	if (sound) {
		return sound.seek(...args);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Get or set the playback rate of a sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param args - Optional playback rate (`0.5..4.0`, where `1.0` is
 *   normal speed), optionally followed by the sound instance ID.
 * @returns The current playback rate when no extra arguments are given.
 * @example
 * // read the current playback rate
 * let rate = me.audio.rate("dst-gameforest");
 * // speed it up 2×
 * me.audio.rate("dst-gameforest", 2.0);
 * @category Audio
 */
export function rate(sound_name: string, ...args: number[]): number {
	const sound = audioTracks[sound_name];
	if (sound) {
		return sound.rate(...args);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Get or set the stereo panning for a sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param pan - Pan value, `-1.0` (full left) to `1.0` (full right).
 *   Omit to read the current value.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current pan value.
 * @example
 * me.audio.stereo("cling", -1);
 * @category Audio
 */
export function stereo(sound_name: string, pan?: number, id?: number): number {
	const sound = audioTracks[sound_name];
	if (sound) {
		return (
			pan !== undefined ? sound.stereo(pan, id) : sound.stereo()
		) as number;
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Get or set the 3D spatial position of a sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param x - X-coordinate of the audio source.
 * @param y - Y-coordinate of the audio source.
 * @param z - Z-coordinate of the audio source.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current 3D position as `[x, y, z]`.
 * @category Audio
 */
export function position(
	sound_name: string,
	x: number,
	y: number,
	z: number,
	id?: number,
): number[] {
	const sound = audioTracks[sound_name];
	if (sound) {
		return sound.pos(x, y, z, id) as unknown as number[];
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Get or set the direction the audio source is pointing in 3D space.
 * Combined with the {@link PannerAttributes} cone settings, a sound
 * pointing away from the listener will be quieter or silent.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param x - X-component of the orientation vector.
 * @param y - Y-component of the orientation vector.
 * @param z - Z-component of the orientation vector.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current 3D orientation as `[x, y, z]`.
 * @category Audio
 */
export function orientation(
	sound_name: string,
	x: number,
	y: number,
	z: number,
	id?: number,
): number[] {
	const sound = audioTracks[sound_name];
	if (sound) {
		return sound.orientation(x, y, z, id) as unknown as number[];
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Get or set the panner-node attributes for a sound or sound group.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param attributes - The {@link PannerAttributes} to apply (cone angles,
 *   distance model, panning algorithm, …). See the interface for
 *   per-field defaults.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The resulting {@link PannerAttributes} after the update.
 * @example
 * me.audio.panner("cling", {
 *     panningModel: "HRTF",
 *     refDistance: 0.8,
 *     rolloffFactor: 2.5,
 *     distanceModel: "exponential",
 * });
 * @category Audio
 */
export function panner(
	sound_name: string,
	attributes?: PannerAttributes,
	id?: number,
): PannerAttributes {
	const sound = audioTracks[sound_name];
	if (!sound) {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
	if (attributes !== undefined) {
		// "set" overload returns the Howl for chaining; we still want
		// to hand the caller the current attribute snapshot back. The
		// cast widens our `distanceModel` (full WebAudio union including
		// `"exponential"`) to Howler's narrower declared union — the
		// runtime accepts all three values; only the `@types/howler`
		// declaration is incomplete.
		const attrs = attributes as Parameters<Howl["pannerAttr"]>[0];
		if (id !== undefined) sound.pannerAttr(attrs, id);
		else sound.pannerAttr(attrs);
	}
	return id !== undefined ? sound.pannerAttr(id) : sound.pannerAttr();
}

/**
 * Stop the specified sound on all channels.
 * @param sound_name - Audio clip name (case-sensitive). When omitted,
 *   every sound currently playing is stopped.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are stopped.
 * @example
 * me.audio.stop("cling");
 * @category Audio
 */
export function stop(sound_name?: string, id?: number): void {
	if (typeof sound_name !== "undefined") {
		const sound = audioTracks[sound_name];
		if (sound) {
			sound.stop(id);
			// remove the defined onend callback (if any defined)
			sound.off("end", undefined, id);
		} else {
			throw new Error(`audio clip ${sound_name} does not exist`);
		}
	} else {
		Howler.stop();
	}
}

/**
 * Pause the specified sound on all channels. Does not reset the
 * current playback position.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are paused.
 * @example
 * me.audio.pause("cling");
 * @category Audio
 */
export function pause(sound_name: string, id?: number): void {
	const sound = audioTracks[sound_name];
	if (sound) {
		sound.pause(id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Resume the specified sound on all channels.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are resumed.
 * @example
 * // play an audio clip
 * let id = me.audio.play("myClip");
 * // ...
 * // pause it
 * me.audio.pause("myClip", id);
 * // ...
 * // resume
 * me.audio.resume("myClip", id);
 * @category Audio
 */
export function resume(sound_name: string, id?: number): void {
	const sound = audioTracks[sound_name];
	if (sound) {
		sound.play(id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Play the specified audio track. Automatically loops the clip and
 * tracks it as the current track for {@link stopTrack} / {@link pauseTrack}
 * / {@link resumeTrack}.
 * @param sound_name - Audio track name (case-sensitive).
 * @param volume - Playback volume, `0.0..1.0`. Defaults to the current
 *   global volume.
 * @returns The sound instance ID.
 * @example
 * me.audio.playTrack("awesome_music");
 * @category Audio
 */
export function playTrack(sound_name: string, volume?: number): number {
	current_track_id = sound_name;
	return play(current_track_id, true, null, volume);
}

/**
 * Stop the current audio track.
 * @see {@link playTrack}
 * @example
 * me.audio.playTrack("awesome_music");
 * me.audio.stopTrack();
 * @category Audio
 */
export function stopTrack(): void {
	if (current_track_id !== null) {
		audioTracks[current_track_id]?.stop();
		current_track_id = null;
	}
}

/**
 * Pause the current audio track.
 * @example
 * me.audio.pauseTrack();
 * @category Audio
 */
export function pauseTrack(): void {
	if (current_track_id !== null) {
		audioTracks[current_track_id]?.pause();
	}
}

/**
 * Resume the previously paused audio track.
 * @example
 * me.audio.playTrack("awesome_music");
 * me.audio.pauseTrack();
 * me.audio.resumeTrack();
 * @category Audio
 */
export function resumeTrack(): void {
	if (current_track_id !== null) {
		audioTracks[current_track_id]?.play();
	}
}

/**
 * Return the name of the current audio track, or `null` if none is set.
 * @returns The current track name, or `null`.
 * @category Audio
 */
export function getCurrentTrack(): string | null {
	return current_track_id;
}

/**
 * Set the default global volume.
 * @param volume - Volume value, `0.0..1.0`.
 * @category Audio
 */
export function setVolume(volume: number): void {
	Howler.volume(volume);
}

/**
 * Get the default global volume.
 * @returns The current volume value, `0.0..1.0`.
 * @category Audio
 */
export function getVolume(): number {
	return Howler.volume();
}

/**
 * Mute or unmute the specified sound. Playback continues; only the
 * audible output is suppressed.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @param shouldMute - `true` to mute, `false` to unmute. Defaults to
 *   `true`.
 * @example
 * // mute the background music
 * me.audio.mute("awesome_music");
 * @category Audio
 */
export function mute(
	sound_name: string,
	id?: number,
	shouldMute: boolean = true,
): void {
	const sound = audioTracks[sound_name];
	if (sound) {
		sound.mute(shouldMute, id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Unmute the specified sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @category Audio
 */
export function unmute(sound_name: string, id?: number): void {
	mute(sound_name, id, false);
}

/**
 * Mute all audio.
 * @category Audio
 */
export function muteAll(): void {
	Howler.mute(true);
}

/**
 * Unmute all audio.
 * @category Audio
 */
export function unmuteAll(): void {
	Howler.mute(false);
}

/**
 * Return whether audio is currently muted globally.
 * @returns `true` when audio is muted globally.
 * @category Audio
 */
export function muted(): boolean {
	// Howler doesn't expose a public muted getter — peek at the private
	// flag that `Howler.mute(true/false)` sets internally. Narrow cast
	// (vs. `as any`) documents the single field we're reaching for.
	return (Howler as unknown as { _muted: boolean })._muted;
}

/**
 * Unload the specified audio track to free memory.
 * @param sound_name - Audio track name (case-sensitive).
 * @returns `true` when the track was found and unloaded.
 * @example
 * me.audio.unload("awesome_music");
 * @category Audio
 */
export function unload(sound_name: string): boolean {
	const sound = audioTracks[sound_name];
	if (!sound) {
		return false;
	}

	// destroy the Howl object
	sound.unload();
	delete audioTracks[sound_name];
	return true;
}

/**
 * Unload every loaded audio track to free memory.
 * @example
 * me.audio.unloadAll();
 * @category Audio
 */
export function unloadAll(): void {
	for (const sound_name in audioTracks) {
		if (Object.prototype.hasOwnProperty.call(audioTracks, sound_name)) {
			unload(sound_name);
		}
	}
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

	// Browsers suspend the context until a user gesture; calling
	// `resume()` from inside a gesture-driven handler is a no-op once
	// the context is running. Best-effort — ignore the promise.
	if (ctx.state === "suspended") {
		ctx.resume().catch(() => {
			/* ignore */
		});
	}

	const dur = Math.max(0.001, duration);
	const t0 = ctx.currentTime;
	const t1 = t0 + dur;
	const atk = Math.max(0.001, Math.min(attack, dur / 2));

	// Gain envelope shared by every partial: linear attack → decay.
	// Decay uses exponential when peak gain > 0 (smoother taper); falls
	// back to linear when gain is 0 because `exponentialRampToValueAtTime`
	// requires its starting value to be strictly positive.
	const env = ctx.createGain();
	env.gain.setValueAtTime(0, t0);
	env.gain.linearRampToValueAtTime(gain, t0 + atk);
	if (gain > 0) {
		env.gain.exponentialRampToValueAtTime(0.0001, t1);
	} else {
		env.gain.linearRampToValueAtTime(0, t1);
	}

	const freqs = Array.isArray(freq) ? freq : [freq];
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
	}

	// Route through the audio module's master gain (the same node every
	// other audio call goes through), so global mute / volume / fades
	// apply uniformly — `audio.muteAll()` silences tones too, and
	// `audio.setVolume(0.5)` halves them.
	const out = Howler.masterGain;
	if (pan === 0) {
		env.connect(out);
	} else {
		const panner = ctx.createStereoPanner();
		panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
		env.connect(panner).connect(out);
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

	if (ctx.state === "suspended") {
		ctx.resume().catch(() => {
			/* ignore */
		});
	}

	const dur = Math.max(0.001, duration);
	const t0 = ctx.currentTime;
	const t1 = t0 + dur;
	const atk = Math.max(0.001, Math.min(attack, dur / 2));

	// Source: a one-shot buffer of `dur * sampleRate` random samples.
	const sampleCount = Math.max(1, Math.ceil(dur * ctx.sampleRate));
	const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
	fillNoiseBuffer(buffer.getChannelData(0), type);
	const src = ctx.createBufferSource();
	src.buffer = buffer;

	// Gain envelope — same linear-attack / exponential-decay shape as
	// `tone`, with the same guard against an exp ramp from 0 (which
	// WebAudio rejects with InvalidStateError).
	const env = ctx.createGain();
	env.gain.setValueAtTime(0, t0);
	env.gain.linearRampToValueAtTime(gain, t0 + atk);
	if (gain > 0) {
		env.gain.exponentialRampToValueAtTime(0.0001, t1);
	} else {
		env.gain.linearRampToValueAtTime(0, t1);
	}

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

	// Route through master gain so mute/volume apply uniformly.
	const out = Howler.masterGain;
	if (pan === 0) {
		tail.connect(out);
	} else {
		const panner = ctx.createStereoPanner();
		panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
		tail.connect(panner).connect(out);
	}

	src.start(t0);
	src.stop(t1 + 0.02);
}
