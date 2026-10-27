/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { audio } from "melonjs";

// bumped on every change, so a jingle ending late does not start a stale song
let generation = 0;

/** play a level or boss song, after its little start jingle */
export function playMusic(kind: "level" | "boss" | "menu") {
	stopMusic();
	const id = ++generation;
	if (kind === "menu") {
		audio.playTrack("menu_song");
		return;
	}
	const intro = kind === "boss" ? "boss_start" : "level_start";
	const song = kind === "boss" ? "boss_song" : "level_song";
	audio.play(intro, false, () => {
		if (id === generation) {
			audio.playTrack(song);
		}
	});
}

/** stop the current song (and any pending one) */
export function stopMusic() {
	generation++;
	audio.stopTrack();
	for (const jingle of ["level_start", "boss_start"]) {
		audio.stop(jingle);
	}
}
