import { describe, expect, it } from "vitest";
import { audio } from "../src/index.js";

// Build a valid silent WAV in-memory and serve it as a data URL.
// Used by every test that needs an actually-loaded clip to exercise
// the per-clip playback / spatial / mix functions.
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

describe("audio", () => {
	it("should export init function", () => {
		expect(typeof audio.init).toBe("function");
	});

	it("should export play function", () => {
		expect(typeof audio.play).toBe("function");
	});

	it("should export stop function", () => {
		expect(typeof audio.stop).toBe("function");
	});

	it("should export load function", () => {
		expect(typeof audio.load).toBe("function");
	});

	it("should export setVolume and getVolume", () => {
		expect(typeof audio.setVolume).toBe("function");
		expect(typeof audio.getVolume).toBe("function");
	});

	it("should export mute and unmute", () => {
		expect(typeof audio.mute).toBe("function");
		expect(typeof audio.unmute).toBe("function");
	});

	it("should export muteAll and unmuteAll", () => {
		expect(typeof audio.muteAll).toBe("function");
		expect(typeof audio.unmuteAll).toBe("function");
	});

	it("init should accept format string", () => {
		// init returns true/false based on audio support
		const result = audio.init("mp3,ogg");
		expect(typeof result).toBe("boolean");
	});

	it("getVolume should return a number", () => {
		expect(typeof audio.getVolume()).toBe("number");
	});

	it("setVolume should clamp between 0 and 1", () => {
		audio.setVolume(0.5);
		expect(audio.getVolume()).toBe(0.5);
		audio.setVolume(2.0);
		expect(audio.getVolume()).toBeLessThanOrEqual(1.0);
		audio.setVolume(-1.0);
		expect(audio.getVolume()).toBeGreaterThanOrEqual(0.0);
	});

	describe("procedural audio", () => {
		it("exports getAudioContext + tone", () => {
			expect(typeof audio.getAudioContext).toBe("function");
			expect(typeof audio.tone).toBe("function");
		});

		it("getAudioContext returns the shared WebAudio context (or null)", () => {
			const ctx = audio.getAudioContext();
			// Browser/Playwright env: should be an AudioContext instance.
			// Headless env without audio: null.
			if (ctx !== null) {
				// Guard the global lookup — `webkitAudioContext`-only
				// browsers expose `ctx` without a top-level
				// `AudioContext` global.
				if (typeof globalThis.AudioContext !== "undefined") {
					expect(ctx).toBeInstanceOf(globalThis.AudioContext);
				}
				// Same instance on every call.
				expect(audio.getAudioContext()).toBe(ctx);
			}
		});

		it("exports getMasterGain", () => {
			expect(typeof audio.getMasterGain).toBe("function");
		});

		it("getMasterGain returns the shared GainNode (or null)", () => {
			const gain = audio.getMasterGain();
			if (gain !== null) {
				// Same guard as above — `GainNode` may not be a global
				// constructor in every WebAudio implementation.
				if (typeof globalThis.GainNode !== "undefined") {
					expect(gain).toBeInstanceOf(globalThis.GainNode);
				} else {
					// Duck-type fallback: a real GainNode has a `.gain`
					// AudioParam.
					expect(gain.gain).toBeDefined();
				}
				expect(audio.getMasterGain()).toBe(gain);
			}
		});

		it("tone is a no-op when audio is unavailable (no throw)", () => {
			// Even with a real context, this should never throw.
			expect(() => {
				return audio.tone({ freq: 440, duration: 0.05 });
			}).not.toThrow();
		});

		it("tone accepts a number or array of partials", () => {
			expect(() => {
				return audio.tone({ freq: 880, duration: 0.05 });
			}).not.toThrow();
			expect(() => {
				return audio.tone({ freq: [440, 660, 880], duration: 0.05 });
			}).not.toThrow();
		});

		it("tone accepts every documented option without throwing", () => {
			expect(() => {
				return audio.tone({
					freq: 1200,
					duration: 0.08,
					wave: "square",
					gain: 0.05,
					attack: 0.01,
					pan: -0.5,
					pitchSlide: 0.5,
				});
			}).not.toThrow();
		});

		it("tone clamps pan to [-1, 1]", () => {
			// Out-of-range pan should be clamped internally, no throw.
			expect(() => {
				return audio.tone({ freq: 440, duration: 0.05, pan: -5 });
			}).not.toThrow();
			expect(() => {
				return audio.tone({ freq: 440, duration: 0.05, pan: 5 });
			}).not.toThrow();
		});

		it("tone tolerates zero / negative duration without throwing", () => {
			// Internal min-duration floor avoids ramping to identical
			// timestamps that WebAudio rejects with InvalidStateError.
			expect(() => {
				return audio.tone({ freq: 440, duration: 0 });
			}).not.toThrow();
			expect(() => {
				return audio.tone({ freq: 440, duration: -1 });
			}).not.toThrow();
		});

		it("tone schedules nodes on the shared context (when available)", () => {
			const ctx = audio.getAudioContext();
			if (!ctx) {
				return;
			} // headless env — skip the WebAudio assertions
			const before = ctx.currentTime;
			audio.tone({ freq: 880, duration: 0.05 });
			// Time should keep advancing — sanity check we didn't blow
			// up the context.
			expect(ctx.state).not.toBe("closed");
			expect(ctx.currentTime).toBeGreaterThanOrEqual(before);
		});

		it("exports noise", () => {
			expect(typeof audio.noise).toBe("function");
		});

		it("noise accepts every documented option without throwing", () => {
			expect(() => {
				return audio.noise({ duration: 0.05 });
			}).not.toThrow();
			expect(() => {
				return audio.noise({
					duration: 0.05,
					type: "white",
					gain: 0.05,
					attack: 0.01,
					pan: 0.3,
				});
			}).not.toThrow();
			expect(() => {
				return audio.noise({ duration: 0.05, type: "pink" });
			}).not.toThrow();
			expect(() => {
				return audio.noise({ duration: 0.05, type: "brown" });
			}).not.toThrow();
		});

		it("noise accepts an optional filter + sweep without throwing", () => {
			expect(() => {
				return audio.noise({
					duration: 0.1,
					filter: { type: "lowpass", frequency: 800 },
					filterSweep: 0.5,
				});
			}).not.toThrow();
			expect(() => {
				return audio.noise({
					duration: 0.1,
					filter: { type: "bandpass", frequency: 400, Q: 1.5 },
					filterSweep: 4,
				});
			}).not.toThrow();
		});

		it("noise clamps pan to [-1, 1]", () => {
			expect(() => {
				return audio.noise({ duration: 0.05, pan: -5 });
			}).not.toThrow();
			expect(() => {
				return audio.noise({ duration: 0.05, pan: 5 });
			}).not.toThrow();
		});

		it("noise tolerates zero / negative duration without throwing", () => {
			expect(() => {
				return audio.noise({ duration: 0 });
			}).not.toThrow();
			expect(() => {
				return audio.noise({ duration: -1 });
			}).not.toThrow();
		});

		it("noise schedules nodes on the shared context (when available)", () => {
			const ctx = audio.getAudioContext();
			if (!ctx) {
				return;
			}
			const before = ctx.currentTime;
			audio.noise({ duration: 0.05, type: "pink" });
			expect(ctx.state).not.toBe("closed");
			expect(ctx.currentTime).toBeGreaterThanOrEqual(before);
		});

		it("noise respects muteAll / unmuteAll (routes through master gain)", () => {
			const ctx = audio.getAudioContext();
			if (!ctx) {
				return;
			}
			audio.muteAll();
			expect(() => {
				return audio.noise({ duration: 0.05 });
			}).not.toThrow();
			audio.unmuteAll();
			expect(() => {
				return audio.noise({ duration: 0.05 });
			}).not.toThrow();
		});

		// Regression guards for the WebAudio exponential-ramp rule:
		// `exponentialRampToValueAtTime` requires the value at the start
		// of the ramp to be strictly positive. Each of these inputs would
		// otherwise route through such a ramp with a non-positive value
		// and throw InvalidStateError.

		it("tone tolerates gain: 0 (envelope decays linearly when peak is silent)", () => {
			expect(() => {
				return audio.tone({ freq: 440, duration: 0.05, gain: 0 });
			}).not.toThrow();
		});

		it("tone tolerates freq <= 0 with pitchSlide (skips the ramp)", () => {
			expect(() => {
				return audio.tone({
					freq: 0,
					duration: 0.05,
					pitchSlide: 0.5,
				});
			}).not.toThrow();
			expect(() => {
				return audio.tone({
					freq: -100,
					duration: 0.05,
					pitchSlide: 0.5,
				});
			}).not.toThrow();
		});

		it("noise tolerates gain: 0 (envelope decays linearly when peak is silent)", () => {
			expect(() => {
				return audio.noise({ duration: 0.05, gain: 0 });
			}).not.toThrow();
		});

		it("noise tolerates filter.frequency <= 0 with filterSweep (skips the ramp)", () => {
			expect(() => {
				return audio.noise({
					duration: 0.1,
					filter: { type: "lowpass", frequency: 0 },
					filterSweep: 2,
				});
			}).not.toThrow();
			expect(() => {
				return audio.noise({
					duration: 0.1,
					filter: { type: "lowpass", frequency: -50 },
					filterSweep: 2,
				});
			}).not.toThrow();
		});
	});

	describe("position / orientation (3D spatial overloads)", () => {
		it("exports position and orientation", () => {
			expect(typeof audio.position).toBe("function");
			expect(typeof audio.orientation).toBe("function");
		});

		it("position throws when the clip doesn't exist (setter shape)", () => {
			expect(() => {
				return audio.position("nope", 1, 2, 3);
			}).toThrow();
		});

		it("position throws when the clip doesn't exist (getter shape)", () => {
			expect(() => {
				return audio.position("nope");
			}).toThrow();
		});

		it("orientation throws when the clip doesn't exist (setter shape)", () => {
			expect(() => {
				return audio.orientation("nope", 1, 2, 3);
			}).toThrow();
		});

		it("orientation throws when the clip doesn't exist (getter shape)", () => {
			expect(() => {
				return audio.orientation("nope");
			}).toThrow();
		});

		it("position round-trips: set then read returns the set value", async () => {
			await loadClip("pos-roundtrip");
			audio.position("pos-roundtrip", 10, 20, 30);
			const p = audio.position("pos-roundtrip");
			expect(p).toEqual([10, 20, 30]);
			audio.unload("pos-roundtrip");
		});

		it("orientation round-trips: set then read returns the set value", async () => {
			await loadClip("ori-roundtrip");
			audio.orientation("ori-roundtrip", 0, 1, 0);
			const o = audio.orientation("ori-roundtrip");
			expect(o).toEqual([0, 1, 0]);
			audio.unload("ori-roundtrip");
		});
	});

	describe("mute / format / availability wrappers", () => {
		it("exports muted, hasFormat, hasAudio, unmute", () => {
			expect(typeof audio.muted).toBe("function");
			expect(typeof audio.hasFormat).toBe("function");
			expect(typeof audio.hasAudio).toBe("function");
			expect(typeof audio.unmute).toBe("function");
		});

		it("hasAudio returns a boolean", () => {
			expect(typeof audio.hasAudio()).toBe("boolean");
		});

		it("hasFormat returns a boolean for any codec string", () => {
			expect(typeof audio.hasFormat("mp3")).toBe("boolean");
			expect(typeof audio.hasFormat("webm")).toBe("boolean");
			expect(typeof audio.hasFormat("bogus-codec")).toBe("boolean");
		});

		it("muted returns a boolean and tracks muteAll / unmuteAll", () => {
			// Snapshot original state so we don't leak side-effects.
			const wasMuted = audio.muted();
			expect(typeof wasMuted).toBe("boolean");

			audio.muteAll();
			expect(audio.muted()).toBe(true);

			audio.unmuteAll();
			expect(audio.muted()).toBe(false);

			// Restore original state.
			if (wasMuted) {
				audio.muteAll();
			}
		});

		it("enable / disable are aliases for unmuteAll / muteAll", () => {
			expect(typeof audio.enable).toBe("function");
			expect(typeof audio.disable).toBe("function");
			const wasMuted = audio.muted();

			audio.disable();
			expect(audio.muted()).toBe(true);

			audio.enable();
			expect(audio.muted()).toBe(false);

			if (wasMuted) {
				audio.muteAll();
			}
		});

		it("stop() with no arguments doesn't throw (stop-all path)", () => {
			expect(() => {
				return audio.stop();
			}).not.toThrow();
		});

		it("getCurrentTrack returns null when nothing is set", () => {
			// stopTrack() clears the current id; calling it from a clean
			// state should leave getCurrentTrack at null.
			audio.stopTrack();
			expect(audio.getCurrentTrack()).toBeNull();
		});
	});

	describe("playback contract", () => {
		// Negative-path: every per-clip function shares the same contract
		// — call with an unknown clip name → throw. A parameterised table
		// locks that invariant in across the whole surface so a future
		// refactor (e.g. swapping `if (!sound) throw` for optional
		// chaining) can't silently turn it into a no-op.
		describe("throws on missing clip", () => {
			const cases = [
				[
					"play",
					() => {
						return audio.play("nope");
					},
				],
				[
					"fade",
					() => {
						return audio.fade("nope", 0, 1, 100);
					},
				],
				[
					"seek",
					() => {
						return audio.seek("nope", 0);
					},
				],
				[
					"rate",
					() => {
						return audio.rate("nope", 1);
					},
				],
				[
					"stereo",
					() => {
						return audio.stereo("nope", 0);
					},
				],
				[
					"pause",
					() => {
						return audio.pause("nope");
					},
				],
				[
					"resume",
					() => {
						return audio.resume("nope");
					},
				],
				[
					"panner",
					() => {
						return audio.panner("nope");
					},
				],
				[
					"stop with name",
					() => {
						return audio.stop("nope");
					},
				],
				[
					"mute",
					() => {
						return audio.mute("nope");
					},
				],
			];

			for (const [name, fn] of cases) {
				it(`${name} throws when the clip doesn't exist`, () => {
					expect(fn).toThrow();
				});
			}
		});

		// Positive-path: a real loaded clip + each function called against
		// it. These don't validate that audio is actually audible (that's
		// human-ear territory), but they prove the calls accept their
		// happy-path args and don't crash. Catches dumb regressions —
		// wrong number of args, missing fallthrough branch, type-cast
		// hiding a real error.
		describe("positive path with a loaded clip", () => {
			const CLIP = "positive-path";

			it("loads a clip, exercises every per-clip API, then unloads", async () => {
				await loadClip(CLIP);

				// play / pause / resume / stop
				const id = audio.play(CLIP);
				expect(typeof id).toBe("number");
				expect(() => {
					return audio.pause(CLIP, id);
				}).not.toThrow();
				expect(() => {
					return audio.resume(CLIP, id);
				}).not.toThrow();
				expect(() => {
					return audio.stop(CLIP, id);
				}).not.toThrow();

				// fade
				const fadeId = audio.play(CLIP);
				expect(() => {
					return audio.fade(CLIP, 1, 0, 50, fadeId);
				}).not.toThrow();
				audio.stop(CLIP, fadeId);

				// seek / rate (both with and without args)
				expect(() => {
					return audio.seek(CLIP, 0);
				}).not.toThrow();
				expect(typeof audio.seek(CLIP)).toBe("number");
				expect(() => {
					return audio.rate(CLIP, 1.5);
				}).not.toThrow();
				expect(typeof audio.rate(CLIP)).toBe("number");

				// stereo (setter + getter)
				expect(() => {
					return audio.stereo(CLIP, -0.5);
				}).not.toThrow();
				expect(typeof audio.stereo(CLIP)).toBe("number");

				// panner (set returns the resulting attributes; get returns
				// the current attributes)
				const attrs = audio.panner(CLIP, {
					panningModel: "HRTF",
					refDistance: 1,
				});
				expect(typeof attrs).toBe("object");
				expect(typeof audio.panner(CLIP)).toBe("object");

				// mute / unmute on the clip (not the global mute pair)
				expect(() => {
					return audio.mute(CLIP);
				}).not.toThrow();
				expect(() => {
					return audio.unmute(CLIP);
				}).not.toThrow();

				audio.unload(CLIP);
			});
		});
	});
});
