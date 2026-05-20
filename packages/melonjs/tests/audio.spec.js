import { describe, expect, it } from "vitest";
import { audio } from "../src/index.js";

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
				expect(ctx).toBeInstanceOf(AudioContext);
				// Same instance on every call (Howler caches its own).
				expect(audio.getAudioContext()).toBe(ctx);
			}
		});

		it("exports getMasterGain", () => {
			expect(typeof audio.getMasterGain).toBe("function");
		});

		it("getMasterGain returns the shared GainNode (or null)", () => {
			const gain = audio.getMasterGain();
			if (gain !== null) {
				expect(gain).toBeInstanceOf(GainNode);
				// Same instance on every call (shared master node).
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
	});
});
