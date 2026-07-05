/**
 * `me.audio` — the audio module's public surface.
 *
 * Composition:
 * - {@link ./backend.ts} — shared internal state + the two WebAudio
 *   escape hatches (`getAudioContext`, `getMasterGain`) + the
 *   `stopOnAudioError` flag.
 * - {@link ./playback.ts} — file-based playback (`load`, `play`,
 *   `pause`, `resume`, `stop`, `fade`, `seek`, `rate`, `stereo`,
 *   `position`, `orientation`, `panner`).
 * - {@link ./procedural.ts} — procedural primitives (`tone`, `noise`).
 * - {@link ./types.ts} — public TypeScript shapes.
 *
 * This file owns the remaining lifecycle / track / mix / unload
 * helpers, plus the barrel re-exports that compose the namespace.
 */

import {
	getGlobalVolume,
	getSoundOrThrow,
	hasCodec,
	isAudioAvailable,
	isGlobalMuted,
	setGlobalMuted,
	setGlobalVolume,
	state,
} from "./backend.ts";
import { play } from "./playback.ts";

// Public re-exports from the split modules.
export {
	getAudioContext,
	getMasterGain,
	setStopOnAudioError,
	stopOnAudioError,
} from "./backend.ts";
export {
	fade,
	load,
	orientation,
	panner,
	pause,
	play,
	position,
	rate,
	resume,
	seek,
	stereo,
	stop,
} from "./playback.ts";
export { noise, tone } from "./procedural.ts";
// Public type surface.
export type {
	LoadSettings,
	NoiseFilter,
	NoiseOptions,
	PannerAttributes,
	SoundAsset,
	ToneOptions,
} from "./types.ts";

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
	state.audioExts = format.split(",");
	return isAudioAvailable();
}

/**
 * Check whether the given audio codec is supported by the browser.
 * @param codec - The audio format to check.
 * @returns `true` when the format is supported.
 * @category Audio
 */
export function hasFormat(codec: string): boolean {
	return hasCodec(codec);
}

/**
 * Check whether audio (HTML5 or WebAudio) is supported by the browser.
 * @returns `true` when at least one audio backend is available.
 * @category Audio
 */
export function hasAudio(): boolean {
	return isAudioAvailable();
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
	state.currentTrackId = sound_name;
	return play(state.currentTrackId, true, null, volume);
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
	if (state.currentTrackId !== null) {
		state.tracks[state.currentTrackId]?.stop();
		state.currentTrackId = null;
	}
}

/**
 * Pause the current audio track.
 * @example
 * me.audio.pauseTrack();
 * @category Audio
 */
export function pauseTrack(): void {
	if (state.currentTrackId !== null) {
		state.tracks[state.currentTrackId]?.pause();
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
	if (state.currentTrackId !== null) {
		state.tracks[state.currentTrackId]?.play();
	}
}

/**
 * Return the name of the current audio track, or `null` if none is set.
 * @returns The current track name, or `null`.
 * @category Audio
 */
export function getCurrentTrack(): string | null {
	return state.currentTrackId;
}

/**
 * Set the default global volume.
 * @param volume - Volume value, `0.0..1.0`.
 * @category Audio
 */
export function setVolume(volume: number): void {
	setGlobalVolume(volume);
}

/**
 * Get the default global volume.
 * @returns The current volume value, `0.0..1.0`.
 * @category Audio
 */
export function getVolume(): number {
	return getGlobalVolume();
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
	getSoundOrThrow(sound_name).mute(shouldMute, id);
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
	setGlobalMuted(true);
}

/**
 * Unmute all audio.
 * @category Audio
 */
export function unmuteAll(): void {
	setGlobalMuted(false);
}

/**
 * Return whether audio is currently muted globally.
 * @returns `true` when audio is muted globally.
 * @category Audio
 */
export function muted(): boolean {
	return isGlobalMuted();
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
	const sound = state.tracks[sound_name];
	if (!sound) {
		return false;
	}

	// forget the current-track pointer if it referenced this sound, so
	// getCurrentTrack() / pauseTrack() / resumeTrack() don't act on a ghost
	if (state.currentTrackId === sound_name) {
		state.currentTrackId = null;
	}

	// destroy the Howl object
	sound.unload();
	delete state.tracks[sound_name];
	return true;
}

/**
 * Unload every loaded audio track to free memory.
 * @example
 * me.audio.unloadAll();
 * @category Audio
 */
export function unloadAll(): void {
	for (const sound_name in state.tracks) {
		if (Object.prototype.hasOwnProperty.call(state.tracks, sound_name)) {
			unload(sound_name);
		}
	}
}
