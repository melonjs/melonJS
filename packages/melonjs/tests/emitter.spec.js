import { beforeEach, describe, expect, it } from "vitest";
import { boot, ParticleEmitter, video } from "../src/index.js";

describe("ParticleEmitter", () => {
	let emitter;

	beforeEach(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		emitter = new ParticleEmitter(100, 100, {
			width: 16,
			height: 16,
			totalParticles: 10,
		});
	});

	it("should be created at the specified position", () => {
		expect(emitter).toBeDefined();
		// emitter is centered around the given coordinates
		expect(emitter.pos).toBeDefined();
	});

	it("should have default settings after construction", () => {
		expect(emitter.settings).toBeDefined();
		expect(emitter.settings.totalParticles).toEqual(10);
	});

	it("should not be running initially", () => {
		expect(emitter.isRunning()).toEqual(false);
	});

	describe("burstParticles()", () => {
		it("should add particles to the emitter", () => {
			emitter.burstParticles();
			expect(emitter.children.length).toBeGreaterThan(0);
		});

		it("should add the specified number of particles", () => {
			emitter.burstParticles(5);
			expect(emitter.children.length).toEqual(5);
		});

		it("should not be running after burst", () => {
			emitter.burstParticles();
			expect(emitter.isRunning()).toEqual(false);
		});
	});

	describe("streamParticles()", () => {
		it("should set the emitter to running", () => {
			emitter.streamParticles();
			expect(emitter.isRunning()).toEqual(true);
		});

		it("should accept a duration parameter", () => {
			emitter.streamParticles(5000);
			expect(emitter.isRunning()).toEqual(true);
		});
	});

	describe("stopStream()", () => {
		it("should stop a running stream", () => {
			emitter.streamParticles();
			expect(emitter.isRunning()).toEqual(true);
			emitter.stopStream();
			expect(emitter.isRunning()).toEqual(false);
		});
	});

	describe("reset()", () => {
		it("should apply new settings", () => {
			emitter.reset({ totalParticles: 20, speed: 5 });
			expect(emitter.settings.totalParticles).toEqual(20);
			expect(emitter.settings.speed).toEqual(5);
		});
	});

	describe("getRandomPointX/Y()", () => {
		it("should return a number within bounds", () => {
			const x = emitter.getRandomPointX();
			const y = emitter.getRandomPointY();
			expect(typeof x).toEqual("number");
			expect(typeof y).toEqual("number");
			expect(x).toBeGreaterThanOrEqual(0);
			expect(y).toBeGreaterThanOrEqual(0);
		});
	});
});
