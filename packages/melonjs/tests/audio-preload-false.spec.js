import { afterEach, describe, expect, it, vi } from "vitest";
import { state } from "../src/audio/state.ts";
import { audio } from "../src/index.js";

/**
 * A clip declared with `preload: false` is not fetched until it is played,
 * then streamed so the sound starts as soon as enough has arrived (#1784).
 *
 * It used to be fetched never: the backend only loads a clip up front when
 * `preload` is on, and `play()` on a clip not loaded queues the play and
 * waits for a load nothing had started, so the clip stayed silent for good.
 *
 * The test context is not unlocked for audio, so whether a sound is audible
 * is not what these assert: they follow the clip's own state, whether its
 * element was asked to fetch, and whether the queued play reached it.
 */

// a valid silent WAV as a data URL (same helper as the other audio specs;
// spec files do not share code)
const makeSilentWavDataUrl = (durationSec = 0.05) => {
	const sampleRate = 8000;
	const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
	const dataSize = numSamples * 2;
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
	writeU32(16);
	writeU16(1);
	writeU16(1);
	writeU32(sampleRate);
	writeU32(sampleRate * 2);
	writeU16(2);
	writeU16(16);
	writeStr("data");
	writeU32(dataSize);
	const bytes = new Uint8Array(buf);
	let bin = "";
	for (let i = 0; i < bytes.length; i++) {
		bin += String.fromCharCode(bytes[i]);
	}
	return `data:audio/wav;base64,${btoa(bin)}`;
};

/** declare a clip; resolves once the loader has reported it done */
const declare = (name, options = {}) => {
	audio.init("wav");
	return new Promise((resolve, reject) => {
		audio.load(
			{ name, src: makeSilentWavDataUrl(), ...options },
			resolve,
			() => {
				reject(new Error(`load failed for ${name}`));
			},
		);
	});
};

/** wait until `test()` holds, or give up after `ms` */
const until = async (test, ms = 3000) => {
	const end = performance.now() + ms;
	while (!test() && performance.now() < end) {
		await new Promise((resolve) => {
			setTimeout(resolve, 20);
		});
	}
	return test();
};

describe("audio: preload: false", () => {
	const declared = [];
	let mediaPlay;

	const lazy = async (name, options = {}) => {
		declared.push(name);
		await declare(name, { preload: false, ...options });
		return state.tracks[name];
	};

	afterEach(() => {
		mediaPlay?.mockRestore();
		mediaPlay = undefined;
		for (const name of declared.splice(0)) {
			audio.unload(name);
		}
	});

	/** count the plays reaching an <audio> element, without needing a gesture */
	const spyOnMediaPlay = () => {
		mediaPlay = vi
			.spyOn(HTMLMediaElement.prototype, "play")
			.mockImplementation(() => {
				return Promise.resolve();
			});
		return mediaPlay;
	};

	it("is not fetched before it is played, and is streamed", async () => {
		const sound = await lazy("lazy-idle");
		expect(audio.state("lazy-idle")).toBe("unloaded");
		// nothing created to fetch it
		expect(sound._sounds.length).toBe(0);
		// played through an <audio> element, which plays as it arrives
		expect(sound._html5).toBe(true);
	});

	it("is fetched by its first play, which then reaches it", async () => {
		const sound = await lazy("lazy-play");
		const played = spyOnMediaPlay();

		expect(typeof audio.play("lazy-play")).toBe("number");
		expect(audio.state("lazy-play")).not.toBe("unloaded");
		// its element is asked to fetch: `preload="none"` would leave it
		// never playable
		expect(sound._sounds[0]._node.preload).toBe("auto");

		expect(
			await until(() => {
				return audio.state("lazy-play") === "loaded";
			}),
		).toBe(true);
		// the queued play ran once the clip could play
		expect(
			await until(() => {
				return played.mock.calls.length > 0;
			}),
		).toBe(true);
	});

	it("is not fetched twice by a second play while it loads", async () => {
		const sound = await lazy("lazy-twice");
		spyOnMediaPlay();
		const load = vi.spyOn(sound, "load");

		audio.play("lazy-twice");
		audio.play("lazy-twice");
		expect(load).toHaveBeenCalledTimes(1);
		expect(
			await until(() => {
				return audio.state("lazy-twice") === "loaded";
			}),
		).toBe(true);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("is fetched by playTrack as well", async () => {
		await lazy("lazy-track");
		const played = spyOnMediaPlay();

		audio.playTrack("lazy-track");
		expect(audio.state("lazy-track")).not.toBe("unloaded");
		expect(
			await until(() => {
				return audio.state("lazy-track") === "loaded";
			}),
		).toBe(true);
		expect(
			await until(() => {
				return played.mock.calls.length > 0;
			}),
		).toBe(true);
		audio.stopTrack();
	});

	it("is fetched right away when it autoplays", async () => {
		const played = spyOnMediaPlay();
		await lazy("lazy-autoplay", { autoplay: true });

		expect(audio.state("lazy-autoplay")).not.toBe("unloaded");
		expect(
			await until(() => {
				return played.mock.calls.length > 0;
			}),
		).toBe(true);
	});

	it("leaves a clip preloaded as before: fetched up front and buffered", async () => {
		declared.push("eager");
		await declare("eager");
		const sound = state.tracks.eager;
		expect(audio.state("eager")).toBe("loaded");
		expect(sound._html5).toBe(false);
	});
});
