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
	});
});
