/**
 * File-based playback — load audio assets, then play / pause / fade /
 * seek / etc. Every function in this module operates on the shared
 * `state.tracks` map exposed from `backend.ts`, so the audio module's
 * other surfaces (track helpers, mix, unload) can see the same set of
 * loaded sounds.
 */

import { Howl } from "howler";
import { clamp } from "../math/math.ts";
import { isDataUrl } from "../utils/string.ts";
import {
	getGlobalVolume,
	getSoundOrThrow,
	soundLoadError,
	state,
	stopAllPlayback,
	stopOnAudioError,
} from "./backend.ts";
import type { LoadSettings, PannerAttributes, SoundAsset } from "./types.ts";

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
	const urls: string[] = [];
	if (state.audioExts.length === 0) {
		throw new Error(
			"target audio extension(s) should be set through me.audio.init() before calling the preloader.",
		);
	}
	if (isDataUrl(sound.src)) {
		urls.push(sound.src);
	} else {
		for (let i = 0; i < state.audioExts.length; i++) {
			urls.push(
				`${sound.src + sound.name}.${state.audioExts[i]}${settings.nocache ?? ""}`,
			);
		}
	}

	state.tracks[sound.name] = new Howl({
		src: urls,
		volume: getGlobalVolume(),
		autoplay: sound.autoplay === true,
		loop: sound.loop === true,
		html5: sound.stream === true || sound.html5 === true,
		// @ts-expect-error xhrWithCredentials is a valid Howl option but not in the type definitions
		xhrWithCredentials: settings.withCredentials,
		onloaderror() {
			soundLoadError.call(this, sound.name, onerrorcb, stopOnAudioError);
		},
		onload() {
			state.retryCounter = 0;
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
	const sound = getSoundOrThrow(sound_name);
	const id = sound.play();
	sound.loop(loop, id);
	sound.volume(
		typeof volume === "number" ? clamp(volume, 0.0, 1.0) : getGlobalVolume(),
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
	return getSoundOrThrow(sound_name).seek(...args);
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
	return getSoundOrThrow(sound_name).rate(...args);
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
		return sound.stereo();
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
		return sound.pos();
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
		return sound.orientation();
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
		// "set" overload returns the Howl for chaining; we still want
		// to hand the caller the current attribute snapshot back. Our
		// `distanceModel` covers the full WebAudio union (including
		// `"exponential"`) while Howler's declared parameter type only
		// lists `"linear" | "inverse"` — its runtime accepts all three.
		// Cast at the boundary so the type check passes; the upstream
		// `@types/howler` declaration is incomplete here.
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
	getSoundOrThrow(sound_name).play(id);
}
