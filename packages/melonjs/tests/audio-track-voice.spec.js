import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { audioEngine } from "../src/audio/backend/core.ts";
import { state as audioState, getSoundOrThrow } from "../src/audio/state.ts";
import { audio, state } from "../src/index.js";
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
 * `pauseTrack()` / `resumeTrack()` acted on the whole clip, not on the track.
 *
 * `playTrack` records the voice it started, but the two used the backend's
 * bare `pause()` / `play()`: the first paused EVERY instance of the clip, and
 * the second resumed only when exactly one instance was paused. With anything
 * else of the same clip around (a sprite file holding the music and the
 * effects, or the same clip also played as an effect), `pauseTrack()` paused
 * the effects too, and `resumeTrack()` left the track paused and started a new
 * instance of the whole file from the top, once and unlooped; on a clip with a
 * sprite map it threw a TypeError instead, as there is no whole-file region.
 * Called while the track was playing, `resumeTrack()` layered a second copy
 * of it.
 *
 * The engine calls both itself: `state.pause(true)` / `state.resume(true)`,
 * and on blur / focus through `pauseOnBlur` / `resumeOnFocus`.
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

describe("pauseTrack / resumeTrack act on the track's own voice", () => {
	beforeAll(startEngine);
	afterAll(stopEngine);

	afterEach(() => {
		audio.stop();
		audio.stopTrack();
		audio.unloadAll();
	});

	describe("proof", () => {
		it("resumeTrack resumes the track when another instance of the clip was paused with it", async () => {
			await loadClip("tv-mix", {}, 3);
			const track = audio.playTrack("tv-mix");
			// the same clip, also playing as an effect
			audio.play("tv-mix", true);
			await settle();
			audio.pauseTrack();
			audio.pause("tv-mix");
			await settle();
			audio.resumeTrack();
			await settle();
			// pre-fix: the track stayed paused, a new instance started instead
			expect(audio.playing("tv-mix", track)).toBe(true);
			expect(sounding("tv-mix")).toBe(1);
		});

		it("pauseTrack pauses the track only, not the clip's other instances", async () => {
			await loadClip("tv-other", {}, 3);
			const track = audio.playTrack("tv-other");
			const effect = audio.play("tv-other", true, null, 0.5);
			await settle();
			expectLevel(level(), AMPLITUDE * 1.5);
			audio.pauseTrack();
			await settle();
			// pre-fix: the effect was paused too
			expect(audio.playing("tv-other", track)).toBe(false);
			expect(audio.playing("tv-other", effect)).toBe(true);
			expectLevel(level(), AMPLITUDE * 0.5);
			audio.resumeTrack();
			await settle();
			expect(audio.playing("tv-other", track)).toBe(true);
			expect(sounding("tv-other")).toBe(2);
			expectLevel(level(), AMPLITUDE * 1.5);
		});

		it("a sprite file holding the music and the effects", async () => {
			await loadClip(
				"tv-sfx",
				{ sprite: { music: [0, 2000], hum: [2000, 900] } },
				3,
			);
			const track = audio.playTrack("tv-sfx", { sprite: "music" });
			const hum = audio.play("tv-sfx", { sprite: "hum", loop: true });
			await settle();
			audio.pauseTrack();
			await settle();
			expect(audio.playing("tv-sfx", hum)).toBe(true);
			// pre-fix: pauseTrack had paused both, and resumeTrack threw a
			// TypeError, as the clip has no whole-file region to start
			audio.pause("tv-sfx", hum);
			expect(() => {
				audio.resumeTrack();
			}).not.toThrow();
			await settle();
			expect(audio.playing("tv-sfx", track)).toBe(true);
			expect(audio.playing("tv-sfx", hum)).toBe(false);
			expect(getSoundOrThrow("tv-sfx")._soundById(track)._sprite).toBe("music");
		});

		it("resumeTrack on a track that is playing does not layer a second copy", async () => {
			await loadClip("tv-layer", {}, 3);
			const track = audio.playTrack("tv-layer");
			await settle();
			audio.resumeTrack();
			await settle();
			// pre-fix: 2 x AMPLITUDE, a second unlooped copy from the top
			expectLevel(level(), AMPLITUDE);
			expect(sounding("tv-layer")).toBe(1);
			expect(audio.playing("tv-layer", track)).toBe(true);
		});

		it("paused and resumed while the track is still starting, it plays once", async () => {
			// a blur and a focus before the context has started: the track's
			// voice is still waiting for the context when both arrive.
			// pre-fix: the group pause was queued behind the start, and the
			// bare play() started a second voice; once the context ran, the
			// pause took both, and the track stayed paused
			await loadClip("tv-pending", {}, 3);
			const ctx = audio.getAudioContext();
			await ctx.suspend();
			audioEngine.state = "suspended";
			const track = audio.playTrack("tv-pending");
			audio.pauseTrack();
			audio.resumeTrack();
			await wait(400);
			expect(audioEngine.state).toBe("running");
			expect(audio.playing("tv-pending", track)).toBe(true);
			// once, not twice over
			expectLevel(level(), AMPLITUDE);
			audio.stopTrack();
			await settle();
			expectLevel(level(), 0);
		});

		it("resumed while the track is still starting, it plays once", async () => {
			await loadClip("tv-pending-resume", {}, 3);
			await audio.getAudioContext().suspend();
			audioEngine.state = "suspended";
			const track = audio.playTrack("tv-pending-resume");
			// pre-fix: the bare play() started a second voice under the first
			audio.resumeTrack();
			await wait(400);
			expect(audio.playing("tv-pending-resume", track)).toBe(true);
			expect(sounding("tv-pending-resume")).toBe(1);
			expectLevel(level(), AMPLITUDE);
		});
	});

	describe("what must not change", () => {
		it("pauseTrack then resumeTrack continues the track where it was", async () => {
			await loadClip("tv-basic", {}, 3);
			const track = audio.playTrack("tv-basic");
			await settle();
			getSoundOrThrow("tv-basic").seek(1.5, track);
			audio.pauseTrack();
			await settle();
			expectLevel(level(), 0);
			const at = getSoundOrThrow("tv-basic").seek(track);
			expect(at).toBeGreaterThan(1);
			audio.resumeTrack();
			await settle();
			expect(audio.playing("tv-basic", track)).toBe(true);
			expect(getSoundOrThrow("tv-basic").seek(track)).toBeGreaterThanOrEqual(
				at,
			);
			expectLevel(level(), AMPLITUDE);
		});

		it("the resumed track still loops", async () => {
			await loadClip("tv-loop", {}, 0.2);
			const track = audio.playTrack("tv-loop");
			await wait(100);
			audio.pauseTrack();
			audio.resumeTrack();
			await wait(500);
			expect(audio.playing("tv-loop", track)).toBe(true);
		});

		it("pausing twice and resuming once resumes", async () => {
			await loadClip("tv-twice", {}, 3);
			const track = audio.playTrack("tv-twice");
			await settle();
			audio.pauseTrack();
			audio.pauseTrack();
			audio.resumeTrack();
			await settle();
			expect(audio.playing("tv-twice", track)).toBe(true);
			expect(sounding("tv-twice")).toBe(1);
		});

		it("both are no-ops with no current track", () => {
			expect(audio.getCurrentTrack()).toBe(null);
			expect(() => {
				audio.pauseTrack();
				audio.resumeTrack();
			}).not.toThrow();
		});

		it("paused while the track is still starting, it is paused once started", async () => {
			await loadClip("tv-pending-pause", {}, 3);
			await audio.getAudioContext().suspend();
			audioEngine.state = "suspended";
			const track = audio.playTrack("tv-pending-pause");
			audio.pauseTrack();
			await wait(400);
			expect(audio.playing("tv-pending-pause", track)).toBe(false);
			expectLevel(level(), 0);
			audio.resumeTrack();
			await settle();
			expect(audio.playing("tv-pending-pause", track)).toBe(true);
			expectLevel(level(), AMPLITUDE);
		});

		it("state.pause(true) / state.resume(true) pause and resume the track", async () => {
			await loadClip("tv-state", {}, 3);
			const track = audio.playTrack("tv-state");
			await settle();
			state.pause(true);
			await settle();
			expect(audio.playing("tv-state", track)).toBe(false);
			state.resume(true);
			await settle();
			expect(audio.playing("tv-state", track)).toBe(true);
			expect(sounding("tv-state")).toBe(1);
		});

		it("resumeTrack after the track's clip was stopped by name still starts it", async () => {
			// what resumeTrack did with nothing paused: start the clip. Kept
			await loadClip("tv-stopped", {}, 3);
			audio.playTrack("tv-stopped");
			await settle();
			audio.stop("tv-stopped");
			await settle();
			expect(audio.playing("tv-stopped")).toBe(false);
			audio.resumeTrack();
			await settle();
			expect(audio.playing("tv-stopped")).toBe(true);
			expect(audioState.currentTrackId).toBe("tv-stopped");
		});
	});
});
