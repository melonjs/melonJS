import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { setAudioFetcher } from "../src/audio/backend/buffer.ts";
import { audioEngine } from "../src/audio/backend/core.ts";
import { Sound } from "../src/audio/backend/sound.ts";
import { state } from "../src/audio/state.ts";
import { audio } from "../src/index.js";
import { fetchData } from "../src/utils/fetchdata.js";

// Build a valid silent WAV in-memory and serve it as a data URL (same helper as
// audio.spec.js / audio-audit.spec.js — kept local, the spec files don't share
// code).
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
 * Regression cover for the vendored audio backend.
 *
 * The backend was howler until 20.3 and is now vendored under
 * `src/audio/backend`. Every test in the first block below pins a bug that the
 * 3.0 TypeScript baseline shipped with — each one is written against the
 * behaviour of 2.2.4, the version being replaced, so a future change that
 * reintroduces the port's mistake fails here rather than in a game.
 *
 * Two of these had no coverage at all before, which is precisely why they
 * survived the swap: `pannerAttr` with an instance id, and unregistering the
 * spatial plugin.
 */
describe("audio backend", () => {
	describe("regressions the 3.0 baseline shipped with", () => {
		it("group getters read back what was set (pos)", async () => {
			// the port dropped 2.2.4's `typeof id === 'undefined'` branch, so the
			// getter returned the Sound itself and the group value was never
			// written — a set could not be read back
			await loadClip("be-pos");
			audio.position("be-pos", 10, 20, 30);
			expect(audio.position("be-pos")).toEqual([10, 20, 30]);
			audio.unload("be-pos");
		});

		it("group getters read back what was set (orientation)", async () => {
			await loadClip("be-orient");
			audio.orientation("be-orient", 0, 1, 0);
			expect(audio.orientation("be-orient")).toEqual([0, 1, 0]);
			audio.unload("be-orient");
		});

		it("group getters read back what was set (stereo)", async () => {
			await loadClip("be-stereo");
			audio.stereo("be-stereo", -1);
			expect(audio.stereo("be-stereo")).toBe(-1);
			audio.unload("be-stereo");
		});

		it("a getter never returns the sound object itself", async () => {
			// the specific shape of the bug: chaining leaked out of the read path
			await loadClip("be-notself");
			const sound = state.tracks["be-notself"];
			expect(audio.position("be-notself")).not.toBe(sound);
			expect(audio.stereo("be-notself")).not.toBe(sound);
			expect(audio.orientation("be-notself")).not.toBe(sound);
			audio.unload("be-notself");
		});

		it("pannerAttr accepts an instance id and returns that instance's attributes", async () => {
			// no coverage before the vendor: a `const` reassignment on this path
			// got through the whole suite and was only caught by the bundler
			await loadClip("be-panner");
			const sound = state.tracks["be-panner"];
			const id = audio.play("be-panner");
			expect(() => {
				return sound.pannerAttr(id);
			}).not.toThrow();
			expect(typeof sound.pannerAttr(id)).toBe("object");
			audio.stop("be-panner");
			audio.unload("be-panner");
		});

		it("pannerAttr sets and reads back a documented attribute", async () => {
			await loadClip("be-panner2");
			// a set before a panner node exists is queued until the sound plays, so
			// this pins the read contract rather than a raced value
			expect(() => {
				return audio.panner("be-panner2", { coneInnerAngle: 90 });
			}).not.toThrow();
			const attrs = audio.panner("be-panner2");
			expect(typeof attrs).toBe("object");
			expect(typeof attrs.coneInnerAngle).toBe("number");
			audio.unload("be-panner2");
		});

		it("loop() accepts an instance id", async () => {
			// the implementation read an id from its arguments, but the overloads
			// only ever declared loop(loop), so the id form was unreachable in TS
			await loadClip("be-loop");
			const sound = state.tracks["be-loop"];
			const id = audio.play("be-loop");
			expect(() => {
				return sound.loop(true, id);
			}).not.toThrow();
			// a per-instance set must NOT move the group value — matching 2.2.4
			expect(sound.loop()).toBe(false);
			audio.stop("be-loop");
			audio.unload("be-loop");
		});

		it("spatial state is installed on every sound without a registry", () => {
			// upstream gated spatial behind a plugin registry; there was only ever
			// one plugin, so it is installed directly now. These are the methods
			// that registry used to attach.
			expect(typeof audioEngine.pos).toBe("function");
			expect(typeof audioEngine.orientation).toBe("function");
			expect(typeof audioEngine.stereo).toBe("function");
		});

		it("spatial calls work before anything has played", async () => {
			// the audio context is created lazily; 2.2.4 made it during init, so a
			// pos() before the first sound silently discarded the value
			await loadClip("be-early");
			audio.position("be-early", 5, 5, 5);
			expect(audio.position("be-early")).toEqual([5, 5, 5]);
			audio.unload("be-early");
		});
	});

	describe("playback contract", () => {
		// mirrors the sequence upstream's manual test pages step through:
		// play → pause → resume → stop, volume, rate, seek, mute, fade
		it("play returns an id, and pause/resume/stop accept it", async () => {
			await loadClip("be-seq");
			const id = audio.play("be-seq");
			expect(typeof id).toBe("number");
			expect(() => {
				return audio.pause("be-seq", id);
			}).not.toThrow();
			expect(() => {
				return audio.resume("be-seq", id);
			}).not.toThrow();
			expect(() => {
				return audio.stop("be-seq", id);
			}).not.toThrow();
			audio.unload("be-seq");
		});

		it("volume round-trips per clip", async () => {
			await loadClip("be-vol");
			audio.setVolume(0.5);
			expect(audio.getVolume()).toBeCloseTo(0.5, 5);
			audio.setVolume(1);
			audio.unload("be-vol");
		});

		it("rate and seek round-trip", async () => {
			await loadClip("be-rate");
			// no play() first: immediately after play the sound holds `_playLock`
			// and the change is queued rather than applied, which is why the audit
			// spec only asserts the type
			audio.rate("be-rate", 1.5);
			expect(audio.rate("be-rate")).toBeCloseTo(1.5, 5);
			expect(typeof audio.seek("be-rate")).toBe("number");
			audio.unload("be-rate");
		});

		it("mute and unmute apply without throwing", async () => {
			await loadClip("be-mute");
			audio.play("be-mute");
			expect(() => {
				return audio.mute("be-mute");
			}).not.toThrow();
			expect(() => {
				return audio.unmute("be-mute");
			}).not.toThrow();
			audio.stop("be-mute");
			audio.unload("be-mute");
		});

		it("fade does not throw and leaves the clip usable", async () => {
			await loadClip("be-fade");
			const id = audio.play("be-fade");
			expect(() => {
				return audio.fade("be-fade", 0, 1, 10, id);
			}).not.toThrow();
			audio.stop("be-fade");
			audio.unload("be-fade");
		});
	});

	describe("engine surface", () => {
		it("exposes the spatial API without the caller registering a plugin", () => {
			// upstream ships spatial as opt-in; melonJS treats it as public API, so
			// the singleton is constructed with it already registered
			expect(typeof audioEngine.pos).toBe("function");
			expect(typeof audioEngine.orientation).toBe("function");
			expect(typeof audioEngine.stereo).toBe("function");
		});

		it("reports codec support for a format it can decode", () => {
			expect(typeof audioEngine.codecs("wav")).toBe("boolean");
		});

		it("global volume round-trips through the engine", () => {
			const before = audioEngine.volume();
			audioEngine.volume(0.25);
			expect(audioEngine.volume()).toBeCloseTo(0.25, 5);
			audioEngine.volume(before);
		});
	});

	describe("sprites and clip state (20.3 additions)", () => {
		// these are additive: every existing call form still works, asserted below
		const loadClipOfLength = (name, seconds) => {
			audio.init("wav");
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`timeout loading ${name}`));
				}, 2000);
				audio.load(
					{ name, src: makeSilentWavDataUrl(seconds) },
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

		const loadSprited = (name) => {
			audio.init("wav");
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`timeout loading ${name}`));
				}, 2000);
				audio.load(
					{
						name,
						src: makeSilentWavDataUrl(0.05),
						sprite: { first: [0, 20], second: [20, 20] },
					},
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

		it("plays a named sprite region", async () => {
			await loadSprited("sp-basic");
			const id = audio.play("sp-basic", { sprite: "first" });
			expect(typeof id).toBe("number");
			audio.stop("sp-basic");
			audio.unload("sp-basic");
		});

		it("an unknown sprite name throws rather than returning a bad id", async () => {
			await loadSprited("sp-bad");
			expect(() => {
				return audio.play("sp-bad", { sprite: "nope" });
			}).toThrow(/no sprite named/);
			audio.unload("sp-bad");
		});

		it("the options form carries loop and volume", async () => {
			await loadSprited("sp-opts");
			const id = audio.play("sp-opts", {
				sprite: "second",
				loop: true,
				volume: 0.25,
			});
			expect(typeof id).toBe("number");
			audio.stop("sp-opts");
			audio.unload("sp-opts");
		});

		it("the positional form still works unchanged", async () => {
			// backward compatibility: play(name), play(name, loop),
			// play(name, loop, onend), play(name, loop, onend, volume)
			await loadClip("sp-compat");
			expect(typeof audio.play("sp-compat")).toBe("number");
			expect(typeof audio.play("sp-compat", true)).toBe("number");
			expect(typeof audio.play("sp-compat", false, null)).toBe("number");
			expect(typeof audio.play("sp-compat", false, null, 0.5)).toBe("number");
			audio.stop("sp-compat");
			audio.unload("sp-compat");
		});

		it("a clip with no sprite map is unaffected", async () => {
			await loadClip("sp-none");
			expect(typeof audio.play("sp-none")).toBe("number");
			audio.stop("sp-none");
			audio.unload("sp-none");
		});

		it("duration() reports a number", async () => {
			await loadClip("sp-dur");
			expect(typeof audio.duration("sp-dur")).toBe("number");
			audio.unload("sp-dur");
		});

		it("playing() reports instance state", async () => {
			// Headless has no user gesture, so the AudioContext stays suspended and
			// an instance never leaves `_playLock` — playback genuinely does not
			// start here. What can be pinned is that the accessor reads instance
			// state rather than throwing or guessing: false before any play, false
			// for an id that does not exist, and false once stopped.
			await loadClipOfLength("sp-playing", 0.5);
			expect(audio.playing("sp-playing")).toBe(false);
			expect(audio.playing("sp-playing", 999999)).toBe(false);
			const id = audio.play("sp-playing");
			expect(typeof audio.playing("sp-playing", id)).toBe("boolean");
			audio.stop("sp-playing");
			expect(audio.playing("sp-playing")).toBe(false);
			audio.unload("sp-playing");
		});

		it("state() reports the load state", async () => {
			await loadClip("sp-state");
			expect(audio.state("sp-state")).toBe("loaded");
			audio.unload("sp-state");
		});
	});

	describe("load options (20.3 additions)", () => {
		const loadWith = (name, extra) => {
			audio.init("wav");
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`timeout loading ${name}`));
				}, 2000);
				audio.load(
					{ name, src: makeSilentWavDataUrl(0.05), ...extra },
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

		it("rate is applied at load time", async () => {
			await loadWith("lo-rate", { rate: 1.5 });
			expect(audio.rate("lo-rate")).toBeCloseTo(1.5, 5);
			audio.unload("lo-rate");
		});

		it("pool is forwarded and does not cap concurrent playback", async () => {
			// `pool` sizes the pool of FINISHED instances kept for reuse — it is
			// not a concurrency limit, which is what the name suggests. Playing
			// three at once with pool:2 is expected to give three live instances.
			await loadWith("lo-pool", { pool: 2 });
			const clip = state.tracks["lo-pool"];
			expect(clip._pool).toBe(2);
			audio.play("lo-pool");
			audio.play("lo-pool");
			audio.play("lo-pool");
			expect(clip._sounds.length).toBe(3);
			audio.stop("lo-pool");
			audio.unload("lo-pool");
		});

		it("mute is applied at load time", async () => {
			await loadWith("lo-mute", { mute: true });
			expect(state.tracks["lo-mute"]._muted).toBe(true);
			audio.unload("lo-mute");
		});

		it("an explicit format is accepted for an extensionless source", async () => {
			await loadWith("lo-format", { format: "wav" });
			expect(audio.state("lo-format")).toBe("loaded");
			audio.unload("lo-format");
		});

		it("the on.load callback fires", async () => {
			let fired = false;
			await loadWith("lo-onload", {
				on: {
					load: () => {
						fired = true;
					},
				},
			});
			// `load` is not part of the documented map; the melonJS onload
			// callback covers it, so this only asserts the map is harmless
			expect(fired).toBe(false);
			audio.unload("lo-onload");
		});

		it("on.play is registered without disturbing load", async () => {
			let plays = 0;
			await loadWith("lo-onplay", {
				on: {
					play: () => {
						plays += 1;
					},
				},
			});
			expect(audio.state("lo-onplay")).toBe("loaded");
			expect(typeof plays).toBe("number");
			audio.unload("lo-onplay");
		});

		it("omitting every new option leaves behaviour unchanged", async () => {
			// the whole point of forwarding conditionally: a clip declared the old
			// way must reach the backend with the backend's own defaults
			await loadClip("lo-plain");
			expect(audio.state("lo-plain")).toBe("loaded");
			expect(audio.rate("lo-plain")).toBeCloseTo(1, 5);
			expect(typeof audio.play("lo-plain")).toBe("number");
			audio.stop("lo-plain");
			audio.unload("lo-plain");
		});
	});

	describe("audio context creation", () => {
		it("is idempotent — repeated calls return the same context", () => {
			// The creation helper used to have no internal guard: calling it twice
			// built a second AudioContext and leaked the first. Six call sites each
			// wrote their own `if (!ctx)` guard, so the invariant held only while
			// every copy stayed correct. The guard now lives in one place.
			const first = audioEngine.ensureContext();
			const second = audioEngine.ensureContext();
			const third = audioEngine.ensureContext();
			expect(second).toBe(first);
			expect(third).toBe(first);
		});

		it("returns the context the engine is actually using", () => {
			const ctx = audioEngine.ensureContext();
			if (ctx !== null) {
				expect(ctx).toBe(audioEngine.ctx);
			} else {
				// no Web Audio in this environment — the engine must agree
				expect(audioEngine.ctx).toBeFalsy();
			}
		});

		it("getAudioContext() returns that same context", () => {
			// the public accessor used to nudge `volume()` to force creation
			// because the real function was private to a third-party dependency
			expect(audio.getAudioContext()).toBe(audioEngine.ensureContext());
		});

		it("a master gain node exists alongside the context", () => {
			const ctx = audioEngine.ensureContext();
			if (ctx !== null) {
				expect(audio.getMasterGain()).toBe(audioEngine.masterGain);
				expect(audioEngine.masterGain).not.toBeNull();
			}
		});
	});

	describe("network loading path", () => {
		// Every other audio test uses a `data:` URL, which takes the base64 branch
		// and never touches the network code. These load a real file so the fetch
		// path is actually exercised — it now goes through the engine's own
		// `fetchData`, which falls back to XHR for `file:` URLs because `fetch()`
		// cannot read them in a Cordova/Capacitor WebView. Audio was the last
		// asset type still calling `fetch()` directly.
		const loadFromUrl = (name, ext) => {
			audio.init(ext);
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`timeout loading ${name}`));
				}, 5000);
				audio.load(
					{ name, src: "data/sfx/" },
					() => {
						clearTimeout(timeout);
						resolve();
					},
					(err) => {
						clearTimeout(timeout);
						reject(new Error(`load failed for ${name}: ${err}`));
					},
				);
			});
		};

		it("loads an mp3 over the network and decodes it", async () => {
			await loadFromUrl("silence", "mp3");
			expect(audio.state("silence")).toBe("loaded");
			expect(typeof audio.duration("silence")).toBe("number");
			audio.unload("silence");
		});

		it("loads an ogg over the network", async () => {
			await loadFromUrl("silence", "ogg");
			expect(audio.state("silence")).toBe("loaded");
			audio.unload("silence");
		});

		it("a network-loaded clip plays like any other", async () => {
			await loadFromUrl("silence", "mp3");
			expect(typeof audio.play("silence")).toBe("number");
			audio.stop("silence");
			audio.unload("silence");
		});
	});

	describe("fetch / decode boundary", () => {
		// The backend decodes audio; it does not fetch it. The engine installs a
		// transport, so network policy — the `file:` fallback for Cordova and
		// Capacitor WebViews, cache mode, credentials, cross-origin — lives in one
		// place instead of audio having its own private copy.
		const engineFetcher = (url, options) => {
			return fetchData(url, "arrayBuffer", {
				withCredentials: options.withCredentials === true,
			});
		};

		it("works with no fetcher installed — the default is a real transport", async () => {
			// The default used to be a rejecting stub that had to be replaced at
			// import time. That was unsafe here specifically: a rejection is not
			// reported as an error, it silently switches the clip to HTML5
			// streaming — so a missed wiring would have degraded every network
			// clip with nothing logged anywhere.
			audio.init("mp3");
			const clip = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("timeout"));
				}, 5000);
				audio.load(
					{ name: "silence", src: "data/sfx/" },
					() => {
						clearTimeout(timeout);
						resolve(state.tracks["silence"]);
					},
					(err) => {
						clearTimeout(timeout);
						reject(new Error(`load failed: ${err}`));
					},
				);
			});
			// decoded through Web Audio, not degraded to a streaming element
			expect(clip._webAudio).toBe(true);
			expect(clip._html5).toBe(false);
			audio.unload("silence");
		});

		afterEach(() => {
			// always restore the engine's real transport
			setAudioFetcher(engineFetcher);
		});

		it("routes loading through the installed fetcher", async () => {
			let sawUrl = null;
			setAudioFetcher((url, options) => {
				sawUrl = url;
				return engineFetcher(url, options);
			});
			audio.init("mp3");
			await new Promise((resolve, reject) => {
				audio.load({ name: "silence", src: "data/sfx/" }, resolve, reject);
			});
			expect(sawUrl).toContain("data/sfx/silence.mp3");
			audio.unload("silence");
		});

		it("a rejected fetch falls back to a streaming element rather than failing", async () => {
			// this is why fetching and decoding were entangled: a failed fetch is
			// not merely a load error, it switches the clip's playback strategy
			setAudioFetcher(() => {
				return Promise.reject(new Error("network down"));
			});
			audio.init("mp3");
			const clip = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("timeout"));
				}, 5000);
				audio.load(
					{ name: "silence", src: "data/sfx/" },
					() => {
						clearTimeout(timeout);
						resolve(state.tracks["silence"]);
					},
					() => {
						clearTimeout(timeout);
						reject(new Error("load reported failure instead of falling back"));
					},
				);
			});
			expect(clip._html5).toBe(true);
			expect(clip._webAudio).toBe(false);
			audio.unload("silence");
		});

		it("a data: URL never reaches the fetcher", async () => {
			// base64 sources are decoded inline; only network sources are fetched
			let called = false;
			setAudioFetcher((url, options) => {
				called = true;
				return engineFetcher(url, options);
			});
			await loadClip("fx-inline");
			expect(called).toBe(false);
			audio.unload("fx-inline");
		});
	});

	describe("looping a voice that has no window yet", () => {
		it("does not put a non-finite loopEnd on the buffer source", async () => {
			// `audio.play(name, { loop: true })` is two calls underneath: the
			// play, then `loop(true, id)` on the id it returned. There are two
			// paths through `play()` that hand an id back BEFORE the voice has
			// been given its loop window: a clip that is still loading queues
			// the play, and a suspended AudioContext defers it to "resume".
			// `loop()` then wrote `undefined` into `loopEnd` and Web Audio
			// threw "The provided value is non-finite" out of the caller's
			// frame, which in a game is the scene that was being built.
			await loadClip("loop-window");
			const clip = state.tracks["loop-window"];
			const id = audio.play("loop-window");
			const voice = clip._soundById(id);
			expect(voice).toBeTruthy();

			// The state either unconfigured path leaves behind, set up here
			// rather than played into: a buffer source only exists once a play
			// has actually STARTED, and nothing starts headless, where there
			// is no gesture to resume the context with.
			voice._node.bufferSource = audio.getAudioContext().createBufferSource();
			voice._start = undefined;
			voice._stop = undefined;

			expect(() => {
				clip.loop(true, id);
			}).not.toThrow();
			expect(Number.isFinite(voice._node.bufferSource.loopEnd)).toBe(true);

			// and the window IS still written once the voice has one, so this
			// is not fixed by never writing it
			voice._start = 0.25;
			voice._stop = 1.5;
			clip.loop(true, id);
			expect(voice._node.bufferSource.loopStart).toBe(0.25);
			expect(voice._node.bufferSource.loopEnd).toBe(1.5);

			audio.stop("loop-window");
			audio.unload("loop-window");
		});
	});

	describe("off(event, undefined, id) clears EVERY listener for that id", () => {
		// `off` is list surgery, so it is exercised directly: building a real
		// Sound would need a decoded clip and a context, and neither has any
		// bearing on which entries come out of the array.
		const listeners = (events) => {
			return { _onend: events };
		};

		it("removes all of an id's listeners, not just the first", () => {
			// How the engine ends a voice: `stop(id)` then
			// `off("end", undefined, id)`. Stopping at the first match left
			// the rest live, and the id is REUSED by the next voice, so a
			// callback outlived its sound and then fired against someone
			// else's.
			const a = () => {};
			const b = () => {};
			const other = () => {};
			const target = listeners([
				{ fn: a, id: 7 },
				{ fn: b, id: 7 },
				{ fn: other, id: 9 },
			]);
			Sound.prototype.off.call(target, "end", undefined, 7);
			expect(target._onend).toEqual([{ fn: other, id: 9 }]);
		});

		it("still removes exactly one when a function is named", () => {
			// the other half of the contract: a named listener is one
			// registration, and removing it must not take its twin with it
			const a = () => {};
			const target = listeners([
				{ fn: a, id: 3 },
				{ fn: a, id: 3 },
			]);
			Sound.prototype.off.call(target, "end", a, 3);
			expect(target._onend).toHaveLength(1);
		});

		it("leaves listeners registered without an id alone", () => {
			const a = () => {};
			const global = () => {};
			const target = listeners([
				{ fn: a, id: 4 },
				{ fn: global, id: undefined },
			]);
			Sound.prototype.off.call(target, "end", undefined, 4);
			expect(target._onend).toEqual([{ fn: global, id: undefined }]);
		});
	});
	describe("a context stopped behind the engine's back", () => {
		// The test page has had no gesture, so the real context sits in
		// "suspended" for the whole run: exactly the shape of a context the
		// browser stopped. What is under test is who notices and what they do
		// about it, so `resume()` is observed or stubbed on the instance and
		// the engine's own `state` is set by hand to say what it believes.
		//
		// Order matters for the first tests, which need the page still locked;
		// the unlock test then completes it. The gesture tests count calls
		// exactly, which needs the unlock listeners gone, so each completes
		// the unlock itself when it runs alone.
		let ctx;
		let savedState;
		let savedResume;
		const tick = (ms = 20) => {
			return new Promise((resolve) => {
				setTimeout(resolve, ms);
			});
		};
		// complete the page's unlock so its gesture listeners are gone and a
		// gesture reaches resume by the owner's net alone
		const completeUnlock = async () => {
			if (audioEngine._audioUnlocked) {
				return;
			}
			ctx.resume = () => {
				return Promise.resolve();
			};
			document.dispatchEvent(new Event("click"));
			await tick();
			expect(audioEngine._audioUnlocked).toBe(true);
		};
		beforeAll(async () => {
			// the first Sound of a page runs the unlock path, which closes the
			// boot context and builds the one the engine keeps; capture after
			await loadClip("recover-boot");
			audio.unload("recover-boot");
		});
		beforeEach(() => {
			ctx = audioEngine.ensureContext();
			savedState = audioEngine.state;
			savedResume = ctx.resume;
		});
		afterEach(() => {
			audioEngine.state = savedState;
			ctx.resume = savedResume;
		});

		it("is restarted from statechange before any unlock has completed", () => {
			// The watch used to be registered inside the scratch source's
			// `onended`, and a one-sample buffer in a context that is not
			// running never ends: the protection only existed once the
			// context had already proved it could run. Here nothing has ever
			// unlocked, and the watch must already be in place.
			expect(audioEngine._audioUnlocked).toBe(false);
			audioEngine.state = "running";
			const resume = vi.fn(() => {
				return new Promise(() => {});
			});
			ctx.resume = resume;
			ctx.dispatchEvent(new Event("statechange"));
			expect(resume).toHaveBeenCalledTimes(1);
		});

		it("leaves a suspension the engine asked for alone", () => {
			// `_autoSuspend` moves `state` off "running" before it suspends, and
			// that is the whole signal. Resuming on every non-running
			// statechange undid the engine's own idle suspension in the same
			// tick, so an idle game kept its audio thread running for good.
			audioEngine.state = "suspended";
			const resume = vi.fn(() => {
				return new Promise(() => {});
			});
			ctx.resume = resume;
			ctx.dispatchEvent(new Event("statechange"));
			expect(resume).not.toHaveBeenCalled();
		});

		it("is restarted even inside the engine's own idle window", () => {
			// With a one-shot just ended the engine has a 30-second suspension
			// pending. `_autoResume` used to read "running, timer pending" as
			// "cancel the timer, done", without looking at the context, so a
			// stop by the browser in that window was never reverted: the next
			// play went into a stopped context, and only the one after found
			// the timer gone and resumed.
			audioEngine.state = "running";
			if (audioEngine._suspendTimer) {
				clearTimeout(audioEngine._suspendTimer);
			}
			audioEngine._suspendTimer = setTimeout(() => {}, 100000);
			const resume = vi.fn(() => {
				return new Promise(() => {});
			});
			ctx.resume = resume;
			ctx.dispatchEvent(new Event("statechange"));
			expect(resume).toHaveBeenCalledTimes(1);
			expect(audioEngine._suspendTimer).toBeNull();
		});

		it("sends the resume event to the voices waiting on it when it restarts", async () => {
			// A bare `ctx.resume()` restarts the hardware and nothing else: no
			// "resume" reaches the voices parked under `_playLock`, which wait
			// for exactly that event. The engine's own state transition is
			// pinned by the gesture test below, where it is a real one; here
			// `state` is "running" by construction, for the watch to fire.
			await loadClip("recover-books");
			const sound = state.tracks["recover-books"];
			const resumed = vi.fn();
			sound.on("resume", resumed);
			audioEngine.state = "running";
			ctx.resume = () => {
				return Promise.resolve();
			};
			ctx.dispatchEvent(new Event("statechange"));
			// the resolved resume is a microtask, then `_emit` hands each
			// listener to its own `setTimeout(0)`
			await tick();
			expect(resumed).toHaveBeenCalledTimes(1);
			sound.off("resume", resumed);
			audio.unload("recover-books");
		});

		it("unlocks from a resolved resume() even if the scratch source never ends", async () => {
			// It completes the unlock for the page, and the listeners it
			// removes do not come back: every gesture test below relies on
			// that to count calls exactly.
			//
			// The scratch source's `onended` was the only completion signal.
			// In this page it never fires, so after a gesture the engine was
			// left half-unlocked for good: listeners still attached, no
			// "unlock" event ever sent to a sound.
			if (audioEngine.autoUnlock) {
				audioEngine._unlockAudio();
			}
			expect(audioEngine._audioUnlocked).toBe(false);
			ctx.resume = () => {
				return Promise.resolve();
			};
			document.dispatchEvent(new Event("click"));
			await tick();
			expect(audioEngine._audioUnlocked).toBe(true);
		});

		it("is revived by a gesture even after the engine idled on purpose", async () => {
			// Thirty idle seconds is how `_autoSuspend` leaves `state` at
			// "suspended", and an earlier recovery net asked whether the engine
			// still believed it was running before it would act. From here
			// that is answered "no" forever: no gesture and no return to the
			// tab could restart it, and only the next play would.
			await completeUnlock();
			audioEngine.state = "suspended";
			const resume = vi.fn(() => {
				return Promise.resolve();
			});
			ctx.resume = resume;
			// exact: the unlock listeners are gone, so the owner's own net is
			// the only route from a keypress to resume
			document.dispatchEvent(new Event("keydown"));
			expect(resume).toHaveBeenCalledTimes(1);
			await tick();
			// and it went through the bookkeeping: the engine's state followed
			expect(audioEngine.state).toBe("running");
			audioEngine.state = "suspended";
			document.dispatchEvent(new Event("visibilitychange"));
			expect(resume).toHaveBeenCalledTimes(2);
			await tick();
			expect(audioEngine.state).toBe("running");
		});

		it("corrects an engine that believes it is stopped under a running context", async () => {
			// The two can disagree: the unlock path's scratch resume starts the
			// hardware and tells nobody. A net that only asked the context
			// found it running and did nothing, which left every voice the
			// engine had parked waiting until the next play happened to call
			// `_autoResume` itself. A gesture is the moment to put it right.
			await completeUnlock();
			audioEngine.state = "suspended";
			Object.defineProperty(ctx, "state", {
				configurable: true,
				get: () => {
					return "running";
				},
			});
			const resume = vi.fn(() => {
				return Promise.resolve();
			});
			ctx.resume = resume;
			document.dispatchEvent(new Event("keydown"));
			expect(resume).toHaveBeenCalledTimes(1);
			await tick();
			expect(audioEngine.state).toBe("running");
			delete ctx.state;
		});

		it("takes a generated tone through the engine's bookkeeping, not around it", async () => {
			// The generators used to carry a private `ctx.resume()`. It brought
			// the hardware back and left the engine's own `state` where it
			// was, so a page could play a beep while every loaded clip stayed
			// parked. The beep now asks the owner, and the engine's state
			// follows the resume it issues.
			audioEngine.state = "suspended";
			const resume = vi.fn(() => {
				return Promise.resolve();
			});
			ctx.resume = resume;
			audio.tone({ freq: 440, duration: 0.01, gain: 0 });
			expect(resume).toHaveBeenCalledTimes(1);
			await tick();
			expect(audioEngine.state).toBe("running");
		});

		it("comes back from an idle suspension the browser never acknowledged", async () => {
			// THE reported bug, from the engine's side. `_autoSuspend` moves the
			// engine to "suspending" and waited for `ctx.suspend()` to settle
			// before it would move on; a resume asked for meanwhile only raised
			// a flag for that settlement to act on. WebKit does not settle it:
			// a suspend requested outside a user gesture, on a context the
			// page was never allowed to start, is parked behind the autoplay
			// restriction until the context next actually suspends, which an
			// engine waiting on that very promise never asks for again. Thirty
			// idle seconds on a freshly loaded page, then the first click: the
			// unlock path's own scratch resume starts the hardware, so a
			// generated tone is heard, while every loaded clip parks under
			// `_playLock` for a "resume" that cannot come, for the life of the
			// page.
			await completeUnlock();
			await loadClip("recover-wedge");
			const sound = state.tracks["recover-wedge"];
			// the suspend the browser will never answer
			const savedSuspend = ctx.suspend;
			ctx.suspend = () => {
				return new Promise(() => {});
			};
			vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
			try {
				audioEngine._autoSuspend();
				vi.advanceTimersByTime(30000);
			} finally {
				vi.useRealTimers();
			}
			expect(audioEngine.state).toBe("suspending");
			// the first gesture of the page: the unlock listeners are still
			// attached, and their scratch resume is what starts the hardware
			audioEngine._audioUnlocked = false;
			audioEngine.autoUnlock = true;
			audioEngine._unlockAudio();
			let running = false;
			Object.defineProperty(ctx, "state", {
				configurable: true,
				get: () => {
					return running ? "running" : "suspended";
				},
			});
			ctx.resume = () => {
				running = true;
				return Promise.resolve();
			};
			// the game plays a clip from its click handler, after the nets
			const played = vi.fn();
			sound.on("play", played);
			let id = null;
			document.addEventListener(
				"click",
				() => {
					id = sound.play();
				},
				{ once: true },
			);
			document.dispatchEvent(new Event("click"));
			await tick();
			// the hardware is running: a generated tone would be heard here
			expect(ctx.state).toBe("running");
			// and so must the engine be, with the clip actually started. The
			// fixture is ten milliseconds long, so `playing()` is already false
			// again by now: the "play" event is the record that it started
			expect(audioEngine.state).toBe("running");
			expect(played).toHaveBeenCalledTimes(1);
			expect(played.mock.calls[0][0]).toBe(id);
			delete ctx.state;
			ctx.suspend = savedSuspend;
			audio.unload("recover-wedge");
		});

		it("follows the context the engine is actually using", () => {
			// LAST: `unload()` closes the live context and builds another, the
			// way the mobile sample-rate path does at the first unlock. A
			// watch bound to the first one guards nothing, and its "closed"
			// notification must not act on the successor.
			const replaced = ctx;
			audioEngine.unload();
			ctx = audioEngine.ctx;
			expect(ctx).not.toBe(replaced);
			expect(audioEngine.contextOwner.current).toBe(ctx);
			savedResume = ctx.resume;
			audioEngine.state = "running";
			const resume = vi.fn(() => {
				return new Promise(() => {});
			});
			ctx.resume = resume;
			ctx.dispatchEvent(new Event("statechange"));
			expect(resume).toHaveBeenCalledTimes(1);
			replaced.dispatchEvent(new Event("statechange"));
			expect(resume).toHaveBeenCalledTimes(1);
		});
	});
});
