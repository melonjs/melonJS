import { expect } from "vitest";
import { audioEngine } from "../../src/audio/backend/core.ts";
import { audio } from "../../src/index.js";

/**
 * Helpers for audio specs that assert on what the engine makes AUDIBLE.
 *
 * A test page cannot really run an `AudioContext`: browsers start one
 * suspended until a user gesture, and a real (trusted) gesture cannot be
 * used here, because user activation lands on the page every spec file
 * shares, unlocking the context of the files that rely on it staying locked.
 * So the context stays suspended, the engine is told it is running (the
 * technique `audio-backend.spec.js` uses), and the graph the engine builds is
 * read instead of rendered:
 *
 * - every `AudioBufferSourceNode` started and not yet stopped or disconnected
 *   is a sound being heard;
 * - each such source feeds a voice's `GainNode`, which feeds the master gain;
 * - the gain an `AudioParam` holds is the last value the engine scheduled on
 *   it (a suspended context never renders, so `.value` does not move).
 *
 * `level()` sums, over the sources being heard, amplitude × voice gain ×
 * master gain: exactly what an analyser after the master gain would read for
 * a constant signal. One voice at full level reads as `AMPLITUDE`, two
 * layered voices as twice that, silence as 0.
 */

/** the nominal amplitude of every clip, the unit `level()` reports in */
export const AMPLITUDE = 0.5;

/**
 * A silent WAV, as a data URL: its content plays no part, only its length.
 * @param {number} durationSec - length
 * @returns {string} the data URL
 */
export const makeWavDataUrl = (durationSec = 1) => {
	const sampleRate = 8000;
	const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
	const dataSize = numSamples * 2;
	const buf = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buf);
	let p = 0;
	const str = (s) => {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(p++, s.charCodeAt(i));
		}
	};
	const u32 = (v) => {
		view.setUint32(p, v, true);
		p += 4;
	};
	const u16 = (v) => {
		view.setUint16(p, v, true);
		p += 2;
	};
	str("RIFF");
	u32(36 + dataSize);
	str("WAVE");
	str("fmt ");
	u32(16);
	u16(1);
	u16(1);
	u32(sampleRate);
	u32(sampleRate * 2);
	u16(2);
	u16(16);
	str("data");
	u32(dataSize);
	let bytes = "";
	const all = new Uint8Array(buf);
	for (let i = 0; i < all.length; i++) {
		bytes += String.fromCharCode(all[i]);
	}
	return `data:audio/wav;base64,${btoa(bytes)}`;
};

/**
 * Load a clip through the public `audio.load`.
 * @param {string} name - the clip name
 * @param {object} [extra] - more load options (`sprite`, `stream`, `on`, ...)
 * @param {number} [durationSec] - the clip's length
 * @returns {Promise<void>} settles when the clip has loaded
 */
export const loadClip = (name, extra = {}, durationSec = 1) => {
	audio.init("wav");
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => {
			reject(new Error(`timeout ${name}`));
		}, 4000);
		audio.load(
			{ name, src: makeWavDataUrl(durationSec), ...extra },
			() => {
				clearTimeout(t);
				resolve();
			},
			() => {
				clearTimeout(t);
				reject(new Error(`load failed ${name}`));
			},
		);
	});
};

export const wait = (ms) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

/**
 * Poll until a condition holds.
 * @param {Function} predicate - the condition
 * @param {number} [ms] - how long to wait before failing
 */
export const until = async (predicate, ms = 2000) => {
	const end = performance.now() + ms;
	while (!predicate()) {
		if (performance.now() > end) {
			throw new Error("condition not met in time");
		}
		await wait(10);
	}
};

/** the last value scheduled on each AudioParam */
const scheduled = new WeakMap();
/** the sources started and not stopped or disconnected since */
const heard = new Set();
/** where each source was connected */
const feeds = new WeakMap();

let restoreGraph = null;

/**
 * Record what the engine does to the graph. Idempotent.
 */
const instrument = () => {
	if (restoreGraph !== null) {
		return;
	}
	const param = AudioParam.prototype;
	const source = AudioBufferSourceNode.prototype;
	const node = AudioNode.prototype;
	const saved = {
		setValueAtTime: param.setValueAtTime,
		linearRampToValueAtTime: param.linearRampToValueAtTime,
		start: source.start,
		stop: source.stop,
		connect: node.connect,
		disconnect: node.disconnect,
	};
	param.setValueAtTime = function (value, time) {
		scheduled.set(this, value);
		return saved.setValueAtTime.call(this, value, time);
	};
	param.linearRampToValueAtTime = function (value, time) {
		scheduled.set(this, value);
		return saved.linearRampToValueAtTime.call(this, value, time);
	};
	source.start = function (...args) {
		heard.add(this);
		return saved.start.apply(this, args);
	};
	source.stop = function (...args) {
		heard.delete(this);
		return saved.stop.apply(this, args);
	};
	node.connect = function (destination, ...rest) {
		if (this instanceof AudioBufferSourceNode) {
			feeds.set(this, destination);
		}
		return saved.connect.call(this, destination, ...rest);
	};
	node.disconnect = function (...args) {
		if (this instanceof AudioBufferSourceNode) {
			heard.delete(this);
		}
		return saved.disconnect.apply(this, args);
	};
	restoreGraph = () => {
		Object.assign(param, {
			setValueAtTime: saved.setValueAtTime,
			linearRampToValueAtTime: saved.linearRampToValueAtTime,
		});
		Object.assign(source, { start: saved.start, stop: saved.stop });
		Object.assign(node, {
			connect: saved.connect,
			disconnect: saved.disconnect,
		});
		restoreGraph = null;
	};
};

const gainOf = (audioParam) => {
	return scheduled.has(audioParam) ? scheduled.get(audioParam) : 1;
};

let savedEngine = null;

/**
 * Have the engine play as it would on a running context, and record the
 * graph it builds. Call from `beforeAll`; undo with {@link stopEngine}.
 */
export const startEngine = async () => {
	// the first Sound of a page runs the unlock path, which can replace the
	// context: start from the one the engine keeps
	await loadClip("engine-boot");
	audio.unload("engine-boot");
	instrument();
	const ctx = audio.getAudioContext();
	savedEngine = { ctx, state: audioEngine.state, resume: ctx.resume };
	ctx.resume = () => {
		return Promise.resolve();
	};
	audioEngine.state = "running";
	// the master gain's current value, so a level read before any change
	// starts from what the engine set it to
	scheduled.set(
		audioEngine.masterGain.gain,
		audioEngine._muted ? 0 : audioEngine.volume(),
	);
};

/** Undo {@link startEngine}. */
export const stopEngine = () => {
	if (savedEngine !== null) {
		savedEngine.ctx.resume = savedEngine.resume;
		audioEngine.state = savedEngine.state;
		savedEngine = null;
	}
	restoreGraph?.();
	heard.clear();
};

/**
 * The level the engine makes audible right now.
 * @returns {number} Σ amplitude × voice gain × master gain over every source
 *   being heard
 */
export const level = () => {
	const master = gainOf(audioEngine.masterGain.gain);
	let sum = 0;
	for (const source of heard) {
		const into = feeds.get(source);
		// voices only: the unlock path's scratch source goes straight out
		if (into instanceof GainNode && into !== audioEngine.masterGain) {
			sum += AMPLITUDE * gainOf(into.gain) * master;
		}
	}
	return sum;
};

/**
 * how many sources are being heard
 * @returns {number} the count
 */
export const sourcesHeard = () => {
	let count = 0;
	for (const source of heard) {
		if (feeds.get(source) instanceof GainNode) {
			count++;
		}
	}
	return count;
};

/** let timers and queued backend work run */
export const settle = () => {
	return wait(150);
};

/**
 * Assert a level.
 * @param {number} actual - the level read
 * @param {number} expected - the level expected
 */
export const expectLevel = (actual, expected) => {
	expect(
		Math.abs(actual - expected),
		`level ${actual.toFixed(3)}, expected ${expected.toFixed(3)}`,
	).toBeLessThan(0.001);
};
