import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getSoundOrThrow, state } from "../src/audio/state.ts";
import { audio } from "../src/index.js";
import {
	AMPLITUDE,
	expectLevel,
	level,
	loadClip,
	settle,
	startEngine,
	stopEngine,
	wait,
} from "./helpers/audio-output.js";

/**
 * `playTrack` on a paused track left the game silent.
 *
 * `playTrack(name)` plays the clip with no sprite region, and the backend
 * reads a play with no region as "resume the paused instance, if exactly one
 * is paused". With the track paused (a pause menu calling `pauseTrack()`, or
 * `state.pause(true)`), that one instance IS the track, so the play resumed
 * it and handed back ITS id; `playTrack` then stopped the track it was
 * replacing, by that same id. The "Retry" button of a pause menu calling
 * `playTrack("level1")` ended with no music at all.
 *
 * The level asserted is what the engine makes audible (see
 * `helpers/audio-output.js`): one voice reads as the clip's amplitude, two
 * layered voices as twice that.
 */

/**
 * voices of a clip that are actually sounding
 * @param {string} name - the clip
 * @returns {number} how many
 */
const sounding = (name) => {
	return getSoundOrThrow(name)._sounds.filter((v) => {
		return !v._paused;
	}).length;
};

describe("playTrack on a paused track", () => {
	beforeAll(startEngine);
	afterAll(stopEngine);

	afterEach(() => {
		audio.stop();
		audio.stopTrack();
		audio.unloadAll();
	});

	describe("proof", () => {
		it("restarts a track paused with pauseTrack, rather than silencing it", async () => {
			await loadClip("pt-level", {}, 3);
			audio.playTrack("pt-level");
			await settle();
			audio.pauseTrack();
			await settle();
			expectLevel(level(), 0);
			// the pause menu's "Retry"
			const id = audio.playTrack("pt-level");
			await settle();
			// pre-fix: the resumed instance was stopped by its own id
			expect(audio.playing("pt-level", id)).toBe(true);
			expectLevel(level(), AMPLITUDE);
			expect(state.currentTrackVoiceId).toBe(id);
		});

		it("restarts a track paused by name with audio.pause", async () => {
			await loadClip("pt-pause-name", {}, 3);
			audio.playTrack("pt-pause-name");
			await settle();
			audio.pause("pt-pause-name");
			const id = audio.playTrack("pt-pause-name");
			await settle();
			expect(audio.playing("pt-pause-name", id)).toBe(true);
			expectLevel(level(), AMPLITUDE);
		});

		it("restarts it from the beginning, as for a playing track", async () => {
			await loadClip("pt-restart", {}, 3);
			const first = audio.playTrack("pt-restart");
			await settle();
			getSoundOrThrow("pt-restart").seek(1.5, first);
			audio.pauseTrack();
			const id = audio.playTrack("pt-restart");
			await settle();
			expect(audio.playing("pt-restart", id)).toBe(true);
			// from the top, not from the 1.5 s it had reached when paused
			expect(getSoundOrThrow("pt-restart").seek(id)).toBeLessThan(0.5);
		});

		it("can still be stopped by stopTrack afterwards", async () => {
			await loadClip("pt-stop", {}, 3);
			audio.playTrack("pt-stop");
			await settle();
			audio.pauseTrack();
			audio.playTrack("pt-stop");
			await settle();
			expectLevel(level(), AMPLITUDE);
			audio.stopTrack();
			await settle();
			expectLevel(level(), 0);
			expect(sounding("pt-stop")).toBe(0);
		});
	});

	describe("what must not change", () => {
		it("playTrack on a playing track restarts it without layering", async () => {
			await loadClip("pt-playing", {}, 3);
			const first = audio.playTrack("pt-playing");
			await settle();
			const second = audio.playTrack("pt-playing");
			await settle();
			expect(audio.playing("pt-playing", second)).toBe(true);
			expect(audio.playing("pt-playing", first)).toBe(false);
			expect(sounding("pt-playing")).toBe(1);
			expectLevel(level(), AMPLITUDE);
		});

		it("switching tracks stops the old one", async () => {
			await loadClip("pt-a", {}, 3);
			await loadClip("pt-b", {}, 3);
			audio.playTrack("pt-a");
			await settle();
			const id = audio.playTrack("pt-b");
			await settle();
			expect(audio.playing("pt-a")).toBe(false);
			expect(audio.playing("pt-b", id)).toBe(true);
			expect(audio.getCurrentTrack()).toBe("pt-b");
			expectLevel(level(), AMPLITUDE);
		});

		it("switching away from a paused track leaves only the new one", async () => {
			await loadClip("pt-pa", {}, 3);
			await loadClip("pt-pb", {}, 3);
			audio.playTrack("pt-pa");
			await settle();
			audio.pauseTrack();
			audio.playTrack("pt-pb");
			await settle();
			expect(audio.playing("pt-pa")).toBe(false);
			expect(audio.playing("pt-pb")).toBe(true);
			expectLevel(level(), AMPLITUDE);
		});

		it("a paused track on a sprite region restarts on that region", async () => {
			await loadClip("pt-sprite", { sprite: { music: [0, 2000] } }, 3);
			audio.playTrack("pt-sprite", { sprite: "music" });
			await settle();
			audio.pauseTrack();
			const id = audio.playTrack("pt-sprite", { sprite: "music" });
			await settle();
			expect(audio.playing("pt-sprite", id)).toBe(true);
			expect(getSoundOrThrow("pt-sprite")._soundById(id)._sprite).toBe("music");
			expectLevel(level(), AMPLITUDE);
		});

		it("the track still loops, at the volume it was given", async () => {
			await loadClip("pt-loop", {}, 0.2);
			const id = audio.playTrack("pt-loop", 0.5);
			await wait(500);
			expect(audio.playing("pt-loop", id)).toBe(true);
			expectLevel(level(), AMPLITUDE * 0.5);
		});

		it("pauseTrack then resumeTrack continues the same voice", async () => {
			await loadClip("pt-resume", {}, 3);
			const id = audio.playTrack("pt-resume");
			await settle();
			getSoundOrThrow("pt-resume").seek(1.5, id);
			audio.pauseTrack();
			const at = getSoundOrThrow("pt-resume").seek(id);
			expect(at).toBeGreaterThan(1);
			audio.resumeTrack();
			await settle();
			expect(audio.playing("pt-resume", id)).toBe(true);
			expect(getSoundOrThrow("pt-resume").seek(id)).toBeGreaterThanOrEqual(at);
			expect(sounding("pt-resume")).toBe(1);
			expectLevel(level(), AMPLITUDE);
		});

		it("a track asked for while its clip is still loading plays once loaded", async () => {
			const loaded = loadClip("pt-loading", {}, 3);
			const id = audio.playTrack("pt-loading");
			await loaded;
			await settle();
			expect(audio.playing("pt-loading", id)).toBe(true);
			expectLevel(level(), AMPLITUDE);
		});

		it("a mistyped name still throws without stopping the music", async () => {
			await loadClip("pt-typo", {}, 3);
			audio.playTrack("pt-typo");
			await settle();
			expect(() => {
				audio.playTrack("pt-tpyo");
			}).toThrow(/does not exist/);
			expect(audio.playing("pt-typo")).toBe(true);
			expect(audio.getCurrentTrack()).toBe("pt-typo");
		});
	});
});
