import { describe, expect, it } from "vitest";
import { soundLoadError, state } from "../src/audio/backend.ts";
import { audio } from "../src/index.js";

// Build a valid silent WAV in-memory and serve it as a data URL (same
// helper as audio.spec.js — kept local, the spec files don't share code).
const makeSilentWavDataUrl = (durationSec = 0.01) => {
	const sampleRate = 8000;
	const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
	const dataSize = numSamples * 2; // 16-bit mono
	const buf = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buf);
	let p = 0;
	const writeStr = (s) => {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(p++, s.charCodeAt(i));
		}
	};
	const writeU32 = (v) => {
		view.setUint32(p, v, true);
		p += 4;
	};
	const writeU16 = (v) => {
		view.setUint16(p, v, true);
		p += 2;
	};
	writeStr("RIFF");
	writeU32(36 + dataSize);
	writeStr("WAVE");
	writeStr("fmt ");
	writeU32(16); // PCM chunk size
	writeU16(1); // format = PCM
	writeU16(1); // mono
	writeU32(sampleRate);
	writeU32(sampleRate * 2); // byte rate
	writeU16(2); // block align
	writeU16(16); // bits per sample
	writeStr("data");
	writeU32(dataSize);
	// samples already zero-initialised → silence
	const bytes = new Uint8Array(buf);
	let bin = "";
	for (let i = 0; i < bytes.length; i++) {
		bin += String.fromCharCode(bytes[i]);
	}
	return `data:audio/wav;base64,${btoa(bin)}`;
};

const loadClip = (name) => {
	audio.init("wav");
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`timeout loading ${name}`));
		}, 2000);
		audio.load(
			{ name, src: makeSilentWavDataUrl() },
			() => {
				clearTimeout(timeout);
				resolve();
			},
			() => {
				clearTimeout(timeout);
				reject(new Error(`load failed for ${name}`));
			},
		);
	});
};

/**
 * Audit fixes for the audio module, written failing-first — each test below
 * documents a confirmed bug from the 2026-07 adversarial code audit.
 */
describe("audio audit fixes", () => {
	it("load() returns 0 and keeps the same Howl when the clip is already loaded", async () => {
		// pre-fix: the audio parser was the only one without an already-loaded
		// guard — re-preloading a manifest silently replaced each Howl and
		// leaked the old instance (decoded buffers / HTML5 nodes)
		await loadClip("audit-cached");
		const before = state.tracks["audit-cached"];
		const count = audio.load({
			name: "audit-cached",
			src: makeSilentWavDataUrl(),
		});
		expect(count).toBe(0);
		expect(state.tracks["audit-cached"]).toBe(before);
		audio.unload("audit-cached");
	});

	it("a flaky sound's retries don't consume another sound's retry budget", () => {
		// pre-fix: a single global retryCounter was shared by every sound —
		// three failures of sound A pushed sound B's FIRST failure straight
		// over the give-up threshold (a spurious fatal error under the
		// default stopOnAudioError)
		let aGaveUp = false;
		let bGaveUp = false;
		for (let i = 0; i < 3; i++) {
			soundLoadError(
				"audit-flaky-a",
				() => {
					aGaveUp = true;
				},
				false,
			);
		}
		expect(aGaveUp).toBe(false); // still within its own 3-retry budget
		soundLoadError(
			"audit-flaky-b",
			() => {
				bGaveUp = true;
			},
			false,
		);
		expect(bGaveUp).toBe(false); // b's FIRST failure must only start ITS budget
		// a's 4th failure exhausts a's own budget
		soundLoadError(
			"audit-flaky-a",
			() => {
				aGaveUp = true;
			},
			false,
		);
		expect(aGaveUp).toBe(true);
		// the give-up path (stopOnError=false) mutes audio globally — restore
		audio.unmuteAll();
	});

	it("setStopOnAudioError() is the supported way to change the flag", () => {
		// pre-fix: the flag was DOCUMENTED as settable, but it's a module
		// export — assigning through the namespace throws, so the
		// "disable audio instead of throwing" mode was unreachable
		expect(() => {
			audio.stopOnAudioError = false;
		}).toThrow(TypeError);
		expect(typeof audio.setStopOnAudioError).toBe("function");
		audio.setStopOnAudioError(false);
		expect(audio.stopOnAudioError).toBe(false);
		audio.setStopOnAudioError(true);
		expect(audio.stopOnAudioError).toBe(true);
	});

	it("seek()/rate() setter form returns undefined; getter form returns a number", async () => {
		// pre-fix: the setter form returned Howler's Howl object while the
		// signature declared `number` — the same get/set contract lie class
		// fixed for stereo/position/orientation/panner in #1456
		await loadClip("audit-seekrate");
		expect(audio.seek("audit-seekrate", 0)).toBeUndefined();
		expect(typeof audio.seek("audit-seekrate")).toBe("number");
		expect(audio.rate("audit-seekrate", 1.5)).toBeUndefined();
		expect(typeof audio.rate("audit-seekrate")).toBe("number");
		audio.unload("audit-seekrate");
	});

	it("position()/stereo() getters return neutral defaults when never set", async () => {
		// pre-fix: both getters passed Howler's internal `null` through,
		// while typed to return a tuple / number
		await loadClip("audit-spatial");
		expect(audio.stereo("audit-spatial")).toBe(0);
		expect(audio.position("audit-spatial")).toEqual([0, 0, 0]);
		audio.unload("audit-spatial");
	});

	it("resume() without id targets the paused instances instead of spawning a new one", async () => {
		// pre-fix: resume() forwarded to Howler's bare play(), which only
		// auto-resumes when EXACTLY ONE instance is paused — with two or
		// more (e.g. pause() without id pauses the whole group) it spawned
		// a brand-new instance from 0 and left the paused ones stuck forever
		await loadClip("audit-resume");
		const id1 = audio.play("audit-resume");
		const id2 = audio.play("audit-resume");
		audio.pause("audit-resume"); // no id → pauses the whole group
		const howl = state.tracks["audit-resume"];
		expect(howl._sounds.length).toBe(2);

		audio.resume("audit-resume");

		// no third instance spawned; the resume targeted the existing two
		// (instance count is deterministic even when the headless audio
		// context is locked — actual playback state isn't)
		expect(howl._sounds.length).toBe(2);
		expect(
			howl._sounds
				.map((s) => {
					return s._id;
				})
				.sort(),
		).toEqual([id1, id2].sort());
		audio.stop("audit-resume");
		audio.unload("audit-resume");
	});

	it("unload() clears the current-track pointer when it referenced the unloaded clip", async () => {
		// pre-fix: getCurrentTrack() kept reporting a track that no longer
		// existed, and pauseTrack()/resumeTrack() silently no-op'd on it
		await loadClip("audit-track");
		audio.playTrack("audit-track");
		expect(audio.getCurrentTrack()).toBe("audit-track");
		audio.unload("audit-track");
		expect(audio.getCurrentTrack()).toBeNull();
	});
});
