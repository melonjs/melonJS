/**
 * Audio backend — the shared internal surface every other audio module
 * (procedural, playback) builds on. Keeps the Howler reference and the
 * cross-module mutable state in one place so the public surface modules
 * stay backend-agnostic.
 *
 * Not part of the public `me.audio.*` API — the two getters
 * `getAudioContext` / `getMasterGain` are re-exported from `audio.ts`
 * for end users; everything else (the `state` object, `soundLoadError`)
 * is internal.
 */

import { Howl, Howler } from "howler";

/**
 * Whether to stop on an audio loading error.
 *
 * When `true`, melonJS throws an exception and aborts loading.
 * When `false`, melonJS disables sound and logs a warning to the console.
 *
 * Read-only through the `me.audio` namespace (module namespace properties
 * can't be assigned) — change it with {@link setStopOnAudioError}.
 * @default true
 * @see setStopOnAudioError
 */
export let stopOnAudioError: boolean = true;

/**
 * Set the {@link stopOnAudioError} flag — whether an audio clip that still
 * fails after its retries throws (aborting loading) or just disables sound
 * with a console warning. This setter is the supported way to change the
 * flag: assigning `me.audio.stopOnAudioError = false` directly throws a
 * TypeError, because module namespace properties are read-only.
 * @param value - `true` to throw on a failed load, `false` to disable sound instead
 * @example
 * // don't abort the whole game when audio fails to load
 * me.audio.setStopOnAudioError(false);
 * @category Audio
 */
export function setStopOnAudioError(value: boolean): void {
	stopOnAudioError = value;
}

/**
 * Cross-module mutable state. A single object so multiple consumers
 * can read and mutate the same fields without the "ESM `let` exports
 * don't share writes across modules" footgun.
 *
 * Fields:
 * - `tracks` — loaded Howl instances keyed by logical sound name.
 *   `Howl | undefined` because missing keys return undefined at runtime
 *   even though the type signature wouldn't normally admit it.
 * - `currentTrackId` — the name of the currently-playing track managed
 *   by the `playTrack` / `stopTrack` helpers.
 * - `retryCounters` — per-sound retry counters for `soundLoadError`'s
 *   back-off, keyed by sound name (a single shared counter let parallel
 *   loads steal each other's retry budget).
 * - `audioExts` — the active list of audio formats set by `init`.
 * @ignore
 */
export const state = {
	tracks: {} as Record<string, Howl | undefined>,
	currentTrackId: null as string | null,
	retryCounters: {} as Record<string, number>,
	audioExts: [] as string[],
};

/**
 * Look up a loaded `Howl` instance by logical name, or throw a
 * uniform "audio clip X does not exist" error if it isn't loaded.
 * Used by every per-clip helper across `playback.ts` / `audio.ts` so
 * the error contract stays identical across the whole surface.
 * @ignore
 */
export function getSoundOrThrow(sound_name: string): Howl {
	const sound = state.tracks[sound_name];
	if (!sound) {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
	return sound;
}

/**
 * Event listener callback on load error. Retries the load up to 3
 * times, then either throws or disables audio (depending on the
 * `stopOnAudioError` flag re-exported from `audio.ts`).
 * @ignore
 */
export const soundLoadError = function (
	sound_name: string,
	onerror_cb?: () => void,
	stopOnError: boolean = true,
): void {
	// per-sound retry budget — a single shared counter let parallel loads
	// steal each other's retries: three failures of one flaky file pushed
	// ANOTHER sound's first failure straight over the give-up threshold
	const retries = state.retryCounters[sound_name] ?? 0;
	if (retries >= 3) {
		delete state.retryCounters[sound_name];
		const errmsg = `melonJS: failed loading ${sound_name}`;
		if (!stopOnError) {
			// disable audio
			Howler.mute(true);
			onerror_cb?.();
			console.warn(`${errmsg}, disabling audio`);
		} else {
			onerror_cb?.();
			throw new Error(errmsg);
		}
	} else {
		state.retryCounters[sound_name] = retries + 1;
		state.tracks[sound_name]?.load();
	}
};

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
	// hit any of those code paths, leaving `Howler.ctx` null. Nudging
	// `Howler.volume()` triggers Howler's internal `setupAudioContext`
	// without changing the master volume.
	//
	// Gate the nudge on `usingWebAudio` so we don't fire it on every
	// call in HTML5-only mode — `Howler.ctx` is permanently null there
	// and the nudge can't help (the runtime check would just re-decide
	// "no WebAudio" and return immediately).
	if (Howler.usingWebAudio && !Howler.ctx) {
		Howler.volume(Howler.volume());
	}
	// `ctx` is declared non-nullable in @types/howler but can still be
	// null when WebAudio is unavailable (HTML5-only mode).
	return Howler.ctx ?? null;
}

/**
 * Return the audio module's master gain node — the single `GainNode`
 * every playback path runs through on its way to `ctx.destination`,
 * and the lever that {@link setVolume} / {@link muteAll} manipulate.
 *
 * Connect to this node (instead of `ctx.destination`) whenever you
 * build a custom WebAudio graph and want the result to respect the
 * engine's mute / volume state. Returns `null` when audio is disabled
 * or unavailable.
 * @category Audio
 */
export function getMasterGain(): GainNode | null {
	// Chains through `getAudioContext` so the same lazy-init nudge
	// covers both — when audio runs on HTML5 Audio instead of WebAudio,
	// `Howler.ctx` is null and we short-circuit here. The remaining
	// `?? null` defends against the narrow iOS-8-webview edge case where
	// ctx is created but `masterGain` isn't (Howler flips
	// `usingWebAudio` to false between the two steps).
	if (!getAudioContext()) return null;
	return Howler.masterGain ?? null;
}

// ---------------------------------------------------------------------
// Thin wrappers over Howler's global surface. Kept internal (not
// re-exported from `audio.ts`) so users still go through the public
// `setVolume` / `muteAll` / `hasFormat` / etc. helpers. Their job is
// to isolate the Howler reference to this file — when the backend
// gets swapped, only these wrappers change.
// ---------------------------------------------------------------------

/**
 * Get the audio module's global volume.
 * @ignore
 */
export function getGlobalVolume(): number {
	return Howler.volume();
}

/**
 * Set the audio module's global volume.
 * @ignore
 */
export function setGlobalVolume(v: number): void {
	Howler.volume(v);
}

/**
 * Mute or unmute the audio module globally.
 * @ignore
 */
export function setGlobalMuted(muted: boolean): void {
	Howler.mute(muted);
}

/**
 * Whether the audio module is currently muted globally.
 * @ignore
 */
export function isGlobalMuted(): boolean {
	// Howler doesn't expose a public muted getter — peek at the private
	// flag that `Howler.mute(true/false)` sets internally. Narrow cast
	// (vs. `as any`) documents the single field we're reaching for.
	return (Howler as unknown as { _muted: boolean })._muted;
}

/**
 * Stop every playing sound on every channel.
 * @ignore
 */
export function stopAllPlayback(): void {
	Howler.stop();
}

/**
 * Whether the given audio codec is supported by the backend / browser.
 * @ignore
 */
export function hasCodec(codec: string): boolean {
	if (!isAudioAvailable()) return false;
	// `Howler.codecs(...)` is declared `boolean` in @types/howler but at
	// runtime returns `undefined` for unrecognised codecs (lookup in a
	// dict). Widen the cast so a strict comparison yields a clean
	// boolean for the public surface (`audio.hasFormat`).
	return (Howler.codecs(codec) as boolean | undefined) === true;
}

/**
 * Whether at least one audio backend (HTML5 or WebAudio) is available.
 * @ignore
 */
export function isAudioAvailable(): boolean {
	return !Howler.noAudio;
}
