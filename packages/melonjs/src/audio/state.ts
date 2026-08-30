/**
 * Shared audio state — the internal surface every other audio module
 * (procedural, playback) builds on. Holds the cross-module mutable state
 * and the thin wrappers over the backend's global surface, so the public
 * modules stay backend-agnostic.
 *
 * The backend implementation itself lives in `./backend/`.
 *
 * Not part of the public `me.audio.*` API — the two getters
 * `getAudioContext` / `getMasterGain` are re-exported from `audio.ts`
 * for end users; everything else (the `state` object, `soundLoadError`)
 * is internal.
 */

import { audioEngine } from "./backend/core.ts";
import type { SpatialSound } from "./backend/spatial.ts";

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
 * - `tracks` — loaded Sound instances keyed by logical sound name.
 *   `Sound | undefined` because missing keys return undefined at runtime
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
	tracks: {} as Record<string, SpatialSound | undefined>,
	currentTrackId: null as string | null,
	retryCounters: {} as Record<string, number>,
	audioExts: [] as string[],
};

/**
 * Look up a loaded `Sound` instance by logical name, or throw a
 * uniform "audio clip X does not exist" error if it isn't loaded.
 * Used by every per-clip helper across `playback.ts` / `audio.ts` so
 * the error contract stays identical across the whole surface.
 * @ignore
 */
export function getSoundOrThrow(sound_name: string): SpatialSound {
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
			audioEngine.mute(true);
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
	if (audioEngine.noAudio) return null;
	// Creates the context on first access. This used to nudge
	// `audioEngine.volume()` to trigger the backend's internal setup, because
	// that setup was private to a third-party dependency; the backend is now
	// maintained in-tree, so the real function is called directly.
	return audioEngine.ensureContext();
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
	// `audioEngine.ctx` is null and we short-circuit here. The remaining
	// `?? null` defends against the narrow iOS-8-webview edge case where
	// ctx is created but `masterGain` isn't (audioEngine flips
	// `usingWebAudio` to false between the two steps).
	if (!getAudioContext()) return null;
	return audioEngine.masterGain ?? null;
}

// ---------------------------------------------------------------------
// Thin wrappers over audioEngine's global surface. Kept internal (not
// re-exported from `audio.ts`) so users still go through the public
// `setVolume` / `muteAll` / `hasFormat` / etc. helpers. Their job is
// to isolate the audioEngine reference to this file — when the backend
// gets swapped, only these wrappers change.
// ---------------------------------------------------------------------

/**
 * Get the audio module's global volume.
 * @ignore
 */
export function getGlobalVolume(): number {
	return audioEngine.volume() as number;
}

/**
 * Set the audio module's global volume.
 * @ignore
 */
export function setGlobalVolume(v: number): void {
	audioEngine.volume(v);
}

/**
 * Mute or unmute the audio module globally.
 * @ignore
 */
export function setGlobalMuted(muted: boolean): void {
	audioEngine.mute(muted);
}

/**
 * Whether the audio module is currently muted globally.
 * @ignore
 */
export function isGlobalMuted(): boolean {
	// audioEngine doesn't expose a public muted getter — peek at the private
	// flag that `audioEngine.mute(true/false)` sets internally. Narrow cast
	// (vs. `as any`) documents the single field we're reaching for.
	return (audioEngine as unknown as { _muted: boolean })._muted;
}

/**
 * Stop every playing sound on every channel.
 * @ignore
 */
export function stopAllPlayback(): void {
	audioEngine.stop();
}

/**
 * Whether the given audio codec is supported by the backend / browser.
 * @ignore
 */
export function hasCodec(codec: string): boolean {
	if (!isAudioAvailable()) return false;
	// `audioEngine.codecs(...)` is declared `boolean` by the backend but at
	// runtime returns `undefined` for unrecognised codecs (lookup in a
	// dict). Widen the cast so a strict comparison yields a clean
	// boolean for the public surface (`audio.hasFormat`).
	return (audioEngine.codecs(codec) as boolean | undefined) === true;
}

/**
 * Whether at least one audio backend (HTML5 or WebAudio) is available.
 * @ignore
 */
export function isAudioAvailable(): boolean {
	return !audioEngine.noAudio;
}
