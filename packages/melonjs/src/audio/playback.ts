/**
 * File-based playback — load audio assets, then play / pause / fade /
 * seek / etc. Every function in this module operates on the shared
 * `audioState.tracks` map exposed from `backend.ts`, so the audio module's
 * other surfaces (track helpers, mix, unload) can see the same set of
 * loaded sounds.
 */

import { clamp } from "../math/math.ts";
import { isDataUrl } from "../utils/string.ts";
import { Sound } from "./backend/core.ts";
import type { SpatialSound } from "./backend/spatial.ts";
import {
	state as audioState,
	getGlobalVolume,
	getSoundOrThrow,
	soundLoadError,
	stopAllPlayback,
	stopOnAudioError,
} from "./state.ts";
import type {
	LoadSettings,
	PannerAttributes,
	PlayOptions,
	SoundAsset,
} from "./types.ts";

/**
 * Load an audio file.
 *
 * `sound.src` is treated as a base path / prefix; the URL is built as
 * `${sound.src}${sound.name}.${ext}` for each extension configured by
 * {@link init}, until one loads. Data URLs (`data:audio/...`) are
 * used as-is and skip the prefix-and-extension dance.
 * @param sound - The {@link SoundAsset} descriptor — logical `name`,
 *   `src` base path / prefix (or data URL), and optional playback
 *   flags (`autoplay`, `loop`, `stream`, `html5`).
 * @param onloadcb - Called when the resource has finished loading.
 * @param onerrorcb - Called when loading fails.
 * @param settings - Optional {@link LoadSettings} — `nocache` (query
 *   string appended for cache busting) and `withCredentials` (forwarded
 *   to the underlying XHR for cross-origin authenticated requests).
 * @returns The number of assets loaded (always `1` on success).
 * @category Audio
 */
export function load(
	sound: SoundAsset,
	onloadcb?: () => void,
	onerrorcb?: () => void,
	settings: LoadSettings = {},
): number {
	// already loaded? Return 0 ("cached", like every other asset parser) —
	// re-preloading a manifest (e.g. re-entering a stage that preloads) used
	// to silently replace the Sound and leak the old instance's decoded
	// buffers / HTML5 nodes. Unload first to genuinely reload a clip.
	if (typeof audioState.tracks[sound.name] !== "undefined") {
		return 0;
	}
	const urls: string[] = [];
	if (audioState.audioExts.length === 0) {
		throw new Error(
			"target audio extension(s) should be set through me.audio.init() before calling the preloader.",
		);
	}
	if (isDataUrl(sound.src)) {
		urls.push(sound.src);
	} else {
		for (let i = 0; i < audioState.audioExts.length; i++) {
			urls.push(
				`${sound.src + sound.name}.${audioState.audioExts[i]}${settings.nocache ?? ""}`,
			);
		}
	}

	// the spatial plugin augments every instance via its onSoundCreate hook
	audioState.tracks[sound.name] = new Sound({
		src: urls,
		volume: getGlobalVolume(),
		autoplay: sound.autoplay === true,
		loop: sound.loop === true,
		// forwarded only when set, so the backend keeps its own defaults
		...(sound.sprite !== undefined ? { sprite: sound.sprite } : {}),
		...(sound.pool !== undefined ? { pool: sound.pool } : {}),
		...(sound.rate !== undefined ? { rate: sound.rate } : {}),
		...(sound.mute !== undefined ? { mute: sound.mute } : {}),
		...(sound.preload !== undefined ? { preload: sound.preload } : {}),
		...(sound.format !== undefined ? { format: sound.format } : {}),
		// `on` is a melonJS-side grouping; the backend takes flat `onplay` etc.
		...(sound.on?.play !== undefined ? { onplay: sound.on.play } : {}),
		...(sound.on?.pause !== undefined ? { onpause: sound.on.pause } : {}),
		...(sound.on?.stop !== undefined ? { onstop: sound.on.stop } : {}),
		...(sound.on?.end !== undefined ? { onend: sound.on.end } : {}),
		...(sound.on?.fade !== undefined ? { onfade: sound.on.fade } : {}),
		...(sound.on?.seek !== undefined ? { onseek: sound.on.seek } : {}),
		...(sound.on?.rate !== undefined ? { onrate: sound.on.rate } : {}),
		...(sound.on?.volume !== undefined ? { onvolume: sound.on.volume } : {}),
		...(sound.on?.mute !== undefined ? { onmute: sound.on.mute } : {}),
		...(sound.on?.unlock !== undefined ? { onunlock: sound.on.unlock } : {}),
		html5: sound.stream === true || sound.html5 === true,
		// @ts-expect-error xhrWithCredentials is a valid Sound option but not in the type definitions
		xhrWithCredentials: settings.withCredentials,
		onloaderror() {
			soundLoadError.call(this, sound.name, onerrorcb, stopOnAudioError);
		},
		onload() {
			delete audioState.retryCounters[sound.name];
			if (typeof onloadcb === "function") {
				onloadcb();
			}
		},
	}) as SpatialSound;

	return 1;
}

/**
 * Play the specified sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param loopOrOptions - Whether to loop the clip (defaults to `false`), or a
 *   {@link PlayOptions} object. The object form is the only way to name a
 *   sprite region; the boolean form is unchanged.
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
 * // play a named region of a sprite sheet, at half volume
 * me.audio.play("sfx", { sprite: "jump", volume: 0.5 });
 * @category Audio
 */
export function play(
	sound_name: string,
	loopOrOptions: boolean | PlayOptions = false,
	onend?: (() => void) | null,
	volume?: number,
): number {
	// The second parameter used to be `loop` only. An options object is accepted
	// in its place so sprites (and anything added later) do not have to be
	// appended after `volume` positionally. The positional form is unchanged.
	const options: PlayOptions =
		typeof loopOrOptions === "object" && loopOrOptions !== null
			? loopOrOptions
			: { loop: loopOrOptions };
	const loop = options.loop === true;
	const endCallback = options.onend ?? onend;
	const level = options.volume ?? volume;

	const sound = getSoundOrThrow(sound_name);
	// `play()` returns null when the named sprite is missing or no instance is
	// free. The clip is loaded (getSoundOrThrow), so the only reachable null is
	// an unknown sprite name — reported rather than passed on as a bad id.
	const id = sound.play(options.sprite);
	if (id === null) {
		throw new Error(
			options.sprite !== undefined
				? `melonJS: audio clip "${sound_name}" has no sprite named "${options.sprite}"`
				: `melonJS: audio clip "${sound_name}" could not be played`,
		);
	}
	sound.loop(loop, id);
	sound.volume(
		typeof level === "number" ? clamp(level, 0.0, 1.0) : getGlobalVolume(),
		id,
	);
	if (typeof endCallback === "function") {
		if (loop) {
			sound.on("end", endCallback, id);
		} else {
			sound.once("end", endCallback, id);
		}
	}
	return id;
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
	getSoundOrThrow(sound_name).fade(from, to, duration, id);
}

/** @inheritDoc */
export function seek(sound_name: string): number;
/** @inheritDoc */
export function seek(sound_name: string, seek: number, id?: number): void;
/**
 * Get or set the playback position of a sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param pos - Seek position in seconds. Omit to read.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current seek position when called as a getter; nothing
 *   when called as a setter (the Sound object Howler returns from the
 *   setter form is an internal, not part of this API).
 * @example
 * // read the current position of the background music
 * let current_pos = me.audio.seek("dst-gameforest");
 * // rewind the background music to the beginning
 * me.audio.seek("dst-gameforest", 0);
 * @category Audio
 */
export function seek(
	sound_name: string,
	pos?: number,
	id?: number,
): number | void {
	const sound = getSoundOrThrow(sound_name);
	if (pos === undefined) {
		return sound.seek();
	}
	// forward the exact arity — Howler's core methods dispatch on argument
	// count, so an explicit trailing undefined would be parsed as an id
	if (id === undefined) {
		sound.seek(pos);
	} else {
		sound.seek(pos, id);
	}
}

/** @inheritDoc */
export function rate(sound_name: string): number;
/** @inheritDoc */
export function rate(sound_name: string, rate: number, id?: number): void;
/**
 * Get or set the playback rate of a sound.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param rate - Playback rate (`0.5..4.0`, where `1.0` is normal
 *   speed). Omit to read.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current playback rate when called as a getter; nothing
 *   when called as a setter (the Sound object Howler returns from the
 *   setter form is an internal, not part of this API).
 * @example
 * // read the current playback rate
 * let rate = me.audio.rate("dst-gameforest");
 * // speed it up 2×
 * me.audio.rate("dst-gameforest", 2.0);
 * @category Audio
 */
export function rate(
	sound_name: string,
	rate?: number,
	id?: number,
): number | void {
	const sound = getSoundOrThrow(sound_name);
	if (rate === undefined) {
		return sound.rate();
	}
	// forward the exact arity — Howler's core methods dispatch on argument
	// count, so an explicit trailing undefined would be parsed as an id
	if (id === undefined) {
		sound.rate(rate);
	} else {
		sound.rate(rate, id);
	}
}

/** @inheritDoc */
export function stereo(sound_name: string): number;
/** @inheritDoc */
export function stereo(sound_name: string, pan: number, id?: number): void;
/**
 * Get or set the stereo panning for a sound.
 *
 * Call with just `sound_name` to read back the group's current pan;
 * call with a `pan` value (and optionally `id`) to write it.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param pan - Pan value, `-1.0` (full left) to `1.0` (full right).
 *   Omit to read the current value.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current pan value when called as a getter; nothing when
 *   called as a setter.
 * @example
 * me.audio.stereo("cling", -1);   // set
 * me.audio.stereo("cling");        // read
 * @category Audio
 */
export function stereo(
	sound_name: string,
	pan?: number,
	id?: number,
): number | void {
	const sound = getSoundOrThrow(sound_name);
	if (pan === undefined) {
		// Howler keeps the group pan at null until it's first set — the
		// documented return type is a number, so map that to centered
		return (sound.stereo() as number | null) ?? 0;
	}
	sound.stereo(pan, id);
}

/** @inheritDoc */
export function position(sound_name: string): [number, number, number];
/** @inheritDoc */
export function position(
	sound_name: string,
	x: number,
	y?: number,
	z?: number,
	id?: number,
): void;
/**
 * Get or set the 3D spatial position of a sound.
 *
 * Call with just `sound_name` to read back the group's current
 * position; call with `x` (and optionally `y` / `z` / `id`) to write
 * it. Missing `y` / `z` default to `0` and `-0.5` respectively.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param x - X-coordinate of the audio source. Omit to read.
 * @param y - Y-coordinate. Defaults to `0` when setting.
 * @param z - Z-coordinate. Defaults to `-0.5` when setting.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current `[x, y, z]` when called as a getter; nothing
 *   when called as a setter.
 * @category Audio
 */
export function position(
	sound_name: string,
	x?: number,
	y?: number,
	z?: number,
	id?: number,
): [number, number, number] | void {
	const sound = getSoundOrThrow(sound_name);
	if (x === undefined) {
		// Howler keeps the group position at null until it's first set — the
		// documented return type is a tuple, so map that to the origin
		return (sound.pos() as [number, number, number] | null) ?? [0, 0, 0];
	}
	sound.pos(x, y, z, id);
}

/** @inheritDoc */
export function orientation(sound_name: string): [number, number, number];
/** @inheritDoc */
export function orientation(
	sound_name: string,
	x: number,
	y?: number,
	z?: number,
	id?: number,
): void;
/**
 * Get or set the direction the audio source is pointing in 3D space.
 * Combined with the {@link PannerAttributes} cone settings, a sound
 * pointing away from the listener will be quieter or silent.
 *
 * Call with just `sound_name` to read back the group's current
 * orientation; call with `x` (and optionally `y` / `z` / `id`) to write
 * it.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param x - X-component of the orientation vector. Omit to read.
 * @param y - Y-component. Defaults to the current value when setting.
 * @param z - Z-component. Defaults to the current value when setting.
 * @param id - Sound instance ID. When omitted, all sounds in the group
 *   are affected.
 * @returns The current `[x, y, z]` when called as a getter; nothing
 *   when called as a setter.
 * @category Audio
 */
export function orientation(
	sound_name: string,
	x?: number,
	y?: number,
	z?: number,
	id?: number,
): [number, number, number] | void {
	const sound = getSoundOrThrow(sound_name);
	if (x === undefined) {
		return sound.orientation() as [number, number, number];
	}
	sound.orientation(x, y, z, id);
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
	const sound = getSoundOrThrow(sound_name);
	if (attributes !== undefined) {
		// "set" overload returns the Sound for chaining; we still want
		// to hand the caller the current attribute snapshot back. Our
		// `distanceModel` covers the full WebAudio union (including
		// `"exponential"`) while Howler's declared parameter type only
		// lists `"linear" | "inverse"` — its runtime accepts all three.
		// Cast at the boundary so the type check passes; the upstream
		// the backend's declaration is incomplete here.
		const attrs = attributes as Parameters<SpatialSound["pannerAttr"]>[0];
		if (id !== undefined) sound.pannerAttr(attrs, id);
		else sound.pannerAttr(attrs);
	}
	return (
		id !== undefined ? sound.pannerAttr(id) : sound.pannerAttr()
	) as PannerAttributes;
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
	if (sound_name === undefined) {
		stopAllPlayback();
		return;
	}
	const sound = getSoundOrThrow(sound_name);
	sound.stop(id);
	// remove the defined onend callback (if any defined)
	sound.off("end", undefined, id);
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
	getSoundOrThrow(sound_name).pause(id);
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
	const sound = getSoundOrThrow(sound_name);
	if (typeof id !== "undefined") {
		sound.play(id);
		return;
	}
	// "all sounds in the group are resumed" (see JSDoc above): Howler's bare
	// play() only auto-resumes when EXACTLY ONE instance is paused — with two
	// or more (e.g. pause() without id pauses the whole group) it spawns a
	// brand-new instance from 0 and leaves the paused ones stuck. Howler has
	// no public instance list, so read _sounds directly (same justified
	// private access as the Howler `_muted` read in audio.ts).
	const sounds = (
		sound as unknown as {
			_sounds: { _paused: boolean; _ended: boolean; _id: number }[];
		}
	)._sounds;
	const paused = sounds.filter((s) => {
		return s._paused && !s._ended;
	});
	if (paused.length === 0) {
		// nothing to resume — keep the legacy start-playback behavior
		sound.play();
		return;
	}
	for (const s of paused) {
		sound.play(s._id);
	}
}

/**
 * Get the duration of an audio clip, in seconds.
 *
 * With no `id`, returns the duration of the whole clip; with one, the duration
 * of the region that instance is playing, which differs when the instance was
 * started from a sprite.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param id - Sound instance ID. Omit for the whole clip.
 * @returns Duration in seconds, or `0` while the clip is still loading.
 * @example
 * const total = me.audio.duration("theme");
 * @category Audio
 */
export function duration(sound_name: string, id?: number): number {
	return getSoundOrThrow(sound_name).duration(id);
}

/**
 * Check whether an audio clip is currently playing.
 *
 * With no `id`, reports whether *any* instance of the clip is playing; with
 * one, only that instance.
 * @param sound_name - Audio clip name (case-sensitive).
 * @param id - Sound instance ID. Omit to ask about the whole group.
 * @returns `true` when playing.
 * @example
 * if (!me.audio.playing("theme")) {
 *     me.audio.play("theme", true);
 * }
 * @category Audio
 */
export function playing(sound_name: string, id?: number): boolean {
	return getSoundOrThrow(sound_name).playing(id);
}

/**
 * Get the load state of an audio clip.
 *
 * Useful when a clip was declared with `preload: false`, or to tell "still
 * loading" apart from "loaded but silent".
 * @param sound_name - Audio clip name (case-sensitive).
 * @returns `"unloaded"`, `"loading"` or `"loaded"`.
 * @example
 * if (me.audio.state("theme") === "loaded") { ... }
 * @category Audio
 */
export function state(sound_name: string): "unloaded" | "loading" | "loaded" {
	return getSoundOrThrow(sound_name).state() as
		| "unloaded"
		| "loading"
		| "loaded";
}
