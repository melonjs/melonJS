/**
 * Silence the game's sound effects while the window does not have focus.
 *
 * `Application` pauses the game on blur and resumes it on focus (its
 * `pauseOnBlur` / `resumeOnFocus` settings, both on by default), and
 * `state.pause()` already pauses the MUSIC TRACK. Nothing ever silenced the
 * sound effects, so a looping one — an engine hum, an alarm, ambience — kept
 * playing over whatever the player switched to.
 *
 * Driven from `Application#_onBlur` / `_onFocus` rather than from
 * `STATE_PAUSE`, deliberately. A state pause is not always a focus loss:
 * `state.freeze()` forwards its `music` flag into `state.pause()` for a
 * hit-stop measured in tens of milliseconds, and muting there would punch a
 * hole in the very impact sound the freeze exists to emphasise. A game's own
 * pause menu is the same story, and would lose its UI clicks. Focus loss is
 * the case where silence is unambiguously right.
 *
 * Driving it from the application also means the existing `stopOnBlur` /
 * `pauseOnBlur` / `resumeOnFocus` settings gate it, instead of a fourth
 * setting that says almost the same thing. A game that opted out of pausing
 * in the background is a game that wants to keep running there, audio
 * included.
 *
 * MUTED rather than stopped or paused:
 *
 * - stopping discards playback ids, and an id is the handle a game holds to
 *   reposition or fade a sound, so a loop could never be resumed in place;
 * - per-voice pausing would have to be taught about every source in turn, and
 *   would miss the procedural `tone` / `noise` primitives and anything a game
 *   hangs off `getMasterGain()`;
 * - muting zeroes the master gain, which everything routes through, and it
 *   lets a short one-shot finish silently instead of queueing up to fire the
 *   moment the player comes back.
 */

import { isGlobalMuted, setGlobalMuted } from "./state.ts";

/**
 * Whether this module is the reason audio is muted.
 *
 * A game that muted itself must come back muted: the player chose silence,
 * and a focus round trip is not consent to undo that. Latched, so two blurs
 * followed by one focus cannot capture the muted state we set ourselves and
 * then restore it as though the game had asked for sound.
 */
let mutedByBlur = false;

/**
 * Mute the mix on blur, unless the game was already muted.
 *
 * Called by the application when the window loses focus and its settings say
 * the game should not keep running in the background.
 * @internal
 * @ignore
 */
export function muteOnBlur(): void {
	if (mutedByBlur || isGlobalMuted()) {
		// already silent, by us or by the game: nothing to capture, and
		// nothing to restore later
		return;
	}
	mutedByBlur = true;
	setGlobalMuted(true);
}

/**
 * Restore the mix on focus, but only if we are the ones who muted it.
 * @internal
 * @ignore
 */
export function unmuteOnFocus(): void {
	if (!mutedByBlur) {
		return;
	}
	mutedByBlur = false;
	setGlobalMuted(false);
}

/**
 * Whether the mix is currently silenced because the window lost focus.
 * @returns true while blur-muted
 * @internal
 * @ignore
 */
export function isMutedByBlur(): boolean {
	return mutedByBlur;
}

/**
 * Forget that we muted, without touching the mix. For tests and teardown.
 * @internal
 * @ignore
 */
export function resetAutoPause(): void {
	mutedByBlur = false;
}
