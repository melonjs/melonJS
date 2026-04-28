import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	boot,
	Container,
	Matrix3d,
	ParticleEmitter,
	video,
} from "../src/index.js";

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

	describe("autoDestroyOnComplete / onComplete", () => {
		const baseSettings = {
			width: 16,
			height: 16,
			totalParticles: 4,
		};

		// Simulate all particles dying by clearing the children list. We test
		// the completion *logic* directly here; particle lifetime decay is
		// covered by the existing burst/stream tests above.
		function drainParticles(em) {
			em.getChildren().length = 0;
		}

		// Container.removeChild() defers via setTimeout(0); flush it.
		function flushDefer() {
			return new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		}

		it("clamps min to max when partial override creates a reversed range", () => {
			// classic footgun: user sets only `maxLife`, the default `minLife: 1000`
			// is larger, which would otherwise produce a 5..1000ms range.
			const em = new ParticleEmitter(0, 0, { ...baseSettings, maxLife: 5 });
			expect(em.settings.minLife).toBe(5);
			expect(em.settings.maxLife).toBe(5);

			// same safeguard applies to scale and rotation pairs
			const em2 = new ParticleEmitter(0, 0, {
				...baseSettings,
				maxStartScale: 0.5,
				maxRotation: 1.0,
			});
			expect(em2.settings.minStartScale).toBeLessThanOrEqual(0.5);
			expect(em2.settings.minRotation).toBeLessThanOrEqual(1.0);
		});

		it("exposes autoDestroyOnComplete and onComplete in defaults (false / undefined)", () => {
			const em = new ParticleEmitter(0, 0, baseSettings);
			expect(em.settings.autoDestroyOnComplete).toBe(false);
			expect(em.settings.onComplete).toBeUndefined();
		});

		it("does not auto-destroy by default (backward compatible)", async () => {
			const parent = new Container(0, 0, 800, 600);
			const em = new ParticleEmitter(100, 100, baseSettings);
			parent.addChild(em);
			em.burstParticles();
			drainParticles(em);

			em.update(0);
			await flushDefer();

			// emitter must still be in its parent (default behavior)
			expect(parent.children).toContain(em);
		});

		it("auto-removes from parent after a burst when autoDestroyOnComplete is true", async () => {
			const parent = new Container(0, 0, 800, 600);
			const em = new ParticleEmitter(100, 100, {
				...baseSettings,
				autoDestroyOnComplete: true,
			});
			parent.addChild(em);
			em.burstParticles();
			expect(em.children.length).toBeGreaterThan(0);

			drainParticles(em);
			em.update(0);
			await flushDefer();

			expect(parent.children).not.toContain(em);
		});

		it("fires onComplete once when all particles die after a burst", () => {
			const onComplete = vi.fn();
			const em = new ParticleEmitter(100, 100, {
				...baseSettings,
				onComplete,
			});
			em.burstParticles();
			drainParticles(em);
			em.update(0);

			expect(onComplete).toHaveBeenCalledTimes(1);

			// further updates with no particles must not re-fire
			em.update(0);
			expect(onComplete).toHaveBeenCalledTimes(1);
		});

		it("does not fire onComplete on a fresh, never-started emitter", () => {
			const onComplete = vi.fn();
			const em = new ParticleEmitter(100, 100, {
				...baseSettings,
				autoDestroyOnComplete: true,
				onComplete,
			});

			// run an update without ever calling burst/stream
			em.update(0);

			expect(onComplete).not.toHaveBeenCalled();
		});

		it("auto-removes from parent after a stream completes (duration elapsed + drained)", async () => {
			const parent = new Container(0, 0, 800, 600);
			const em = new ParticleEmitter(100, 100, {
				...baseSettings,
				autoDestroyOnComplete: true,
			});
			parent.addChild(em);
			em.streamParticles(0); // tiny duration so stopStream fires next tick
			em._hasSpawned = true; // simulate particles having been spawned
			em.update(20); // duration elapsed → stopStream() → _enabled = false
			drainParticles(em);
			em.update(0); // completion check fires
			await flushDefer();

			expect(parent.children).not.toContain(em);
		});
	});

	describe("particle transform (closed-form equivalence)", () => {
		// Reference implementation: the original 4-step builder.
		function buildReference(scale, angle, posX, posY, halfW, halfH) {
			const m = new Matrix3d();
			m.setTransform(
				scale,
				0,
				0,
				0,
				0,
				scale,
				0,
				0,
				0,
				0,
				1,
				0,
				posX - halfW * scale,
				posY - halfH * scale,
				0,
				1,
			);
			m.translate(halfW, halfH);
			m.rotate(angle);
			m.translate(-halfW, -halfH);
			return m;
		}

		// Optimized implementation: same matrix in a single setTransform call.
		// Derivation: T(p − halfSize·s)·S(s) · T(half) · R(θ) · T(−half)
		//   m00 = s·cos      m01 = −s·sin
		//   m10 = s·sin      m11 = s·cos
		//   m03 = pos.x − s·(halfW·cos − halfH·sin)
		//   m13 = pos.y − s·(halfW·sin + halfH·cos)
		function buildClosedForm(scale, angle, posX, posY, halfW, halfH) {
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const sCos = scale * cos;
			const sSin = scale * sin;
			const tx = posX - scale * (halfW * cos - halfH * sin);
			const ty = posY - scale * (halfW * sin + halfH * cos);
			const m = new Matrix3d();
			m.setTransform(
				sCos,
				sSin,
				0,
				0,
				-sSin,
				sCos,
				0,
				0,
				0,
				0,
				1,
				0,
				tx,
				ty,
				0,
				1,
			);
			return m;
		}

		// Compare two matrices element-wise via apply() on probe points — works
		// regardless of internal storage order/conventions.
		function expectEquivalent(ref, opt) {
			const probes = [
				[0, 0],
				[1, 0],
				[0, 1],
				[10, 7],
				[-3, 4],
			];
			for (const [x, y] of probes) {
				const a = { x, y };
				const b = { x, y };
				ref.apply(a);
				opt.apply(b);
				expect(b.x).toBeCloseTo(a.x, 5);
				expect(b.y).toBeCloseTo(a.y, 5);
			}
		}

		const cases = [
			{ s: 1, a: 0, px: 0, py: 0, hw: 8, hh: 8 },
			{ s: 1, a: Math.PI / 2, px: 100, py: 50, hw: 8, hh: 4 },
			{ s: 2, a: 0, px: 100, py: 50, hw: 8, hh: 4 },
			{ s: 0.5, a: Math.PI, px: -42, py: 17, hw: 16, hh: 8 },
			{ s: 1.5, a: Math.PI / 3, px: 7, py: -3, hw: 12, hh: 6 },
			{ s: 1, a: -Math.PI / 4, px: 0, py: 0, hw: 4, hh: 4 },
		];

		for (const c of cases) {
			it(`matches reference for s=${c.s} a=${c.a.toFixed(2)} pos=(${c.px},${c.py}) half=(${c.hw},${c.hh})`, () => {
				const ref = buildReference(c.s, c.a, c.px, c.py, c.hw, c.hh);
				const opt = buildClosedForm(c.s, c.a, c.px, c.py, c.hw, c.hh);
				expectEquivalent(ref, opt);
			});
		}
	});
});
