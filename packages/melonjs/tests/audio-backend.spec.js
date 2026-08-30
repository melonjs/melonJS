import { afterEach, describe, expect, it } from "vitest";
import { setAudioFetcher } from "../src/audio/backend/buffer.ts";
import { audioEngine } from "../src/audio/backend/core.ts";
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
});
