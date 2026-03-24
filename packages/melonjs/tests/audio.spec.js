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
});
