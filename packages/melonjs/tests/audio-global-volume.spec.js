import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getSoundOrThrow } from "../src/audio/state.ts";
import { audio } from "../src/index.js";
import {
	AMPLITUDE,
	expectLevel,
	level,
	loadClip,
	settle,
	startEngine,
	stopEngine,
	until,
	wait,
} from "./helpers/audio-output.js";

/**
 * The global volume was applied twice.
 *
 * `setVolume(v)` sets the master gain every buffered clip goes through, and
 * the HTML5 path multiplies each element's volume by it. On top of that,
 * `play()` / `playTrack()` without a volume of their own gave each new voice
 * the global volume as ITS level, and `load()` gave the clip the same. So a
 * slider at 0.5 played new sounds at 0.25 while the procedural `tone` /
 * `noise` (master gain only) played at 0.5, and a sound started while the
 * slider was at 0 stayed silent for its whole life whatever the slider did
 * afterwards: its own level was 0, and the master gain only scales it.
 *
 * The model the engine's own pieces already agree on, and the one these tests
 * pin: the global volume is the master gain, applied once to everything; a
 * sound's own `volume` is its level within the mix, `1` when not given.
 *
 * The level asserted is what the engine makes audible (see
 * `helpers/audio-output.js`): amplitude × master gain × the voice's own gain.
 */

describe("the global volume is applied once", () => {
	beforeAll(startEngine);
	afterAll(stopEngine);

	afterEach(() => {
		audio.stop();
		audio.stopTrack();
		audio.unloadAll();
		audio.setVolume(1);
		audio.unmuteAll();
	});

	describe("proof", () => {
		it("a new sound plays at the global volume, not at its square", async () => {
			await loadClip("gv-half");
			audio.setVolume(0.5);
			audio.play("gv-half", true);
			await settle();
			// pre-fix: 0.5 (master) x 0.5 (the voice's own level) = 0.125
			expectLevel(level(), AMPLITUDE * 0.5);
		});

		it("a track started while the volume is 0 is heard when the volume comes back", async () => {
			// the slider at 0, a level starts its music, the slider back to 1
			await loadClip("gv-zero");
			audio.setVolume(0);
			audio.playTrack("gv-zero");
			await settle();
			expectLevel(level(), 0);
			audio.setVolume(1);
			await settle();
			// pre-fix: silent for good, the voice's own level was 0
			expectLevel(level(), AMPLITUDE);
		});

		it("a sound started at one global volume matches one started at another", async () => {
			await loadClip("gv-a");
			await loadClip("gv-b");
			audio.setVolume(1);
			audio.play("gv-a", true);
			audio.setVolume(0.5);
			await settle();
			const before = level();
			expectLevel(before, AMPLITUDE * 0.5);
			audio.stop("gv-a");
			audio.play("gv-b", true);
			await settle();
			// pre-fix: the second sound was half as loud as the first
			expectLevel(level(), before);
		});

		it("a clip that autoplays at load is not scaled twice either", async () => {
			audio.setVolume(0.5);
			await loadClip("gv-auto", { autoplay: true, loop: true });
			await until(() => {
				return audio.playing("gv-auto");
			});
			await settle();
			// pre-fix: the clip took the global volume as its own level at load
			expectLevel(level(), AMPLITUDE * 0.5);
		});

		it("a streamed (HTML5) clip is not scaled twice either", async () => {
			await loadClip("gv-html5", { stream: true });
			audio.setVolume(0.5);
			const id = audio.play("gv-html5", true);
			const voice = getSoundOrThrow("gv-html5")._soundById(id);
			await until(() => {
				return voice._node.volume !== 1;
			});
			// the element's volume is its own level x the global volume
			// pre-fix: 0.25
			expect(voice._node.volume).toBeCloseTo(0.5, 5);
			// and the slider still moves it
			audio.setVolume(0.2);
			expect(voice._node.volume).toBeCloseTo(0.2, 5);
		});
	});

	describe("what must not change", () => {
		it("an explicit per-play volume is that sound's level, scaled by the global volume", async () => {
			await loadClip("gv-explicit");
			audio.setVolume(0.5);
			audio.play("gv-explicit", { loop: true, volume: 0.4 });
			await settle();
			expectLevel(level(), AMPLITUDE * 0.5 * 0.4);
		});

		it("the positional volume argument still works", async () => {
			await loadClip("gv-positional");
			audio.play("gv-positional", true, null, 0.4);
			await settle();
			expectLevel(level(), AMPLITUDE * 0.4);
		});

		it("playTrack with a volume plays at that volume", async () => {
			await loadClip("gv-track");
			audio.playTrack("gv-track", 0.6);
			await settle();
			expectLevel(level(), AMPLITUDE * 0.6);
		});

		it("at the default global volume a plain play is at full level", async () => {
			await loadClip("gv-full");
			audio.play("gv-full", true);
			await settle();
			expectLevel(level(), AMPLITUDE);
		});

		it("setVolume moves a sound that is already playing", async () => {
			await loadClip("gv-live");
			audio.play("gv-live", true);
			await settle();
			audio.setVolume(0.25);
			await settle();
			expectLevel(level(), AMPLITUDE * 0.25);
			expect(audio.getVolume()).toBe(0.25);
		});

		it("muteAll silences everything and unmuteAll brings it back", async () => {
			await loadClip("gv-mute");
			audio.play("gv-mute", true);
			await settle();
			audio.muteAll();
			await settle();
			expectLevel(level(), 0);
			audio.unmuteAll();
			await settle();
			expectLevel(level(), AMPLITUDE);
		});

		it("setVolume while muted takes effect on unmute", async () => {
			await loadClip("gv-muted-set");
			audio.play("gv-muted-set", true);
			audio.muteAll();
			audio.setVolume(0.5);
			await settle();
			expectLevel(level(), 0);
			audio.unmuteAll();
			await settle();
			expectLevel(level(), AMPLITUDE * 0.5);
		});

		it("mute / unmute of one clip", async () => {
			await loadClip("gv-clip-mute");
			audio.play("gv-clip-mute", true);
			await settle();
			audio.mute("gv-clip-mute");
			await settle();
			expectLevel(level(), 0);
			audio.unmute("gv-clip-mute");
			await settle();
			expectLevel(level(), AMPLITUDE);
		});

		it("fade moves the sound's own level", async () => {
			await loadClip("gv-fade");
			const id = audio.play("gv-fade", true);
			audio.fade("gv-fade", 1, 0, 60, id);
			await wait(250);
			expectLevel(level(), 0);
			audio.fade("gv-fade", 0, 1, 60, id);
			await wait(250);
			expectLevel(level(), AMPLITUDE);
		});
	});
});
