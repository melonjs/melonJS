import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Container,
	Matrix3d,
	ParticleEmitter,
	video,
} from "../src/index.js";

describe("ParticleEmitter", () => {
	let emitter;

	let app;
	beforeEach(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		emitter = new ParticleEmitter(100, 100, {
			width: 16,
			height: 16,
			totalParticles: 10,
		});
	});

	afterEach(() => {
		// release the WebGL context this describe owns — browsers cap
		// live contexts, and a leak surfaces as UNRELATED specs failing
		app?.destroy();
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
				// frequency 1ms + maxParticles 4 means streamParticles spawns at
				// least one particle on the first update tick — exercises the
				// public _hasSpawned tracking path without poking internals.
				frequency: 1,
				maxParticles: 4,
			});
			parent.addChild(em);
			em.streamParticles(20);
			// first tick: duration not elapsed yet, frequency satisfied → spawn
			em.update(5);
			expect(em._hasSpawned).toBe(true);
			// second tick: duration elapses → stopStream() → _enabled = false
			em.update(20);
			drainParticles(em);
			em.update(0); // completion check fires → autoDestroy schedules removal
			await flushDefer();

			expect(parent.children).not.toContain(em);
		});
	});

	// ---------------------------------------------------------------------
	// Regression: `update(dt)` MUST always run Container.update on the
	// children (the particle walk + per-child visibility refresh), even
	// when `this.isDirty` is already true.
	//
	// The bug was the obvious-looking
	//     this.isDirty = this.isDirty || super.update(dt);
	// JS `||` short-circuits when the LHS is truthy — so on any frame
	// where the emitter was already dirty (very common: after spawning
	// particles, after a position change, etc.), `super.update(dt)`
	// never ran. Each particle stayed at its previous `inViewport`
	// state and was skipped by `Container.draw` — under Camera3d, where
	// particles start with `inViewport = false` until the first walk
	// computes it, the whole exhaust trail stayed invisible.
	//
	// Fix: cache the result of `super.update(dt)` in a local, THEN OR
	// into `isDirty` so the call always runs.
	describe("update() short-circuit regression (visibility refresh on dirty frames)", () => {
		it("calls super.update(dt) even when this.isDirty is already true", () => {
			const em = new ParticleEmitter(100, 100, {
				width: 16,
				height: 16,
				totalParticles: 4,
			});
			// Spy on Container's update — that's `super.update` from
			// inside ParticleEmitter.
			const containerProto = Object.getPrototypeOf(Object.getPrototypeOf(em));
			const superUpdate = vi.spyOn(containerProto, "update");

			// Force the precondition that previously masked the bug.
			em.isDirty = true;
			em.update(16);

			expect(superUpdate).toHaveBeenCalledTimes(1);
			expect(superUpdate).toHaveBeenCalledWith(16);

			superUpdate.mockRestore();
		});

		it("propagates the children-dirty signal into emitter.isDirty (true ∨ ? = true)", () => {
			// Even if children come back clean (super.update returns
			// false), the emitter must remain dirty if it was already
			// dirty before the call. Verifies the OR semantics are
			// preserved — the fix is `cache local → OR in`, not
			// `replace`.
			const em = new ParticleEmitter(100, 100, {
				width: 16,
				height: 16,
				totalParticles: 4,
			});
			const containerProto = Object.getPrototypeOf(Object.getPrototypeOf(em));
			vi.spyOn(containerProto, "update").mockReturnValue(false);

			em.isDirty = true;
			em.update(16);

			expect(em.isDirty).toBe(true);
			vi.restoreAllMocks();
		});

		it("particle update runs on every frame — burst, then dirty frame, then assert particle moved", () => {
			// End-to-end signal: spawn particles, mark emitter dirty
			// (which we know the bug skipped), advance time, and verify
			// at least one particle's position has changed. If
			// super.update were short-circuited, particles would never
			// see their `update(dt)` and stay frozen at spawn position.
			const em = new ParticleEmitter(100, 100, {
				width: 1,
				height: 1,
				totalParticles: 4,
				// pure horizontal motion so position deltas are easy to
				// detect; avoid randomness on the angle so the test is
				// deterministic.
				angle: 0,
				angleVariation: 0,
				speed: 5,
				speedVariation: 0,
				minLife: 10_000,
				maxLife: 10_000,
				gravity: 0,
				wind: 0,
				onlyInViewport: false,
			});
			em.burstParticles(2);
			const particle = em.getChildren()[0];
			const startX = particle.pos.x;

			// Pin the precondition that triggered the original bug:
			// emitter is already dirty when update fires.
			em.isDirty = true;
			em.update(16);

			expect(particle.pos.x).not.toBe(startX);
		});
	});

	describe("particle transform", () => {
		// The matrix a particle is expected to hold: the complete placement,
		// landing the particle's centre exactly on `pos`.
		//
		// The formula is the long-standing one. What changed is that it is no
		// longer conjugated: `pos` was already baked in here while
		// `autoTransform` stayed at its default `true`, so preDraw wrapped it
		// as `T(p)·C·T(-p)` and the drawn centre came out at `(2 - s)·p`.
		// Harmless while `p` was a few pixels from the emitter, fatal once
		// `referenceSpace` lets `p` be a position in the level.
		function expectedTransform(scale, angle, posX, posY, halfW, halfH) {
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const m = new Matrix3d();
			m.setTransform(
				scale * cos,
				scale * sin,
				0,
				0,
				-scale * sin,
				scale * cos,
				0,
				0,
				0,
				0,
				1,
				0,
				posX - scale * (halfW * cos - halfH * sin),
				posY - scale * (halfW * sin + halfH * cos),
				0,
				1,
			);
			return m;
		}

		// What the conjugation used to produce. Kept as an explicit statement
		// of the OLD behaviour so the difference is recorded rather than
		// quietly re-baselined: these two agree only when the linear part is
		// the identity, which is exactly why the drift went unnoticed.
		function conjugated(scale, angle, posX, posY, halfW, halfH) {
			const m = new Matrix3d();
			m.identity();
			m.translate(posX, posY);
			m.multiply(expectedTransform(scale, angle, posX, posY, halfW, halfH));
			m.translate(-posX, -posY);
			return m;
		}

		// Compare via apply() on probe points — independent of storage order.
		function expectEquivalent(ref, opt, label = "") {
			for (const [x, y] of [
				[0, 0],
				[1, 0],
				[0, 1],
				[10, 7],
				[-3, 4],
			]) {
				const a = { x, y };
				const b = { x, y };
				ref.apply(a);
				opt.apply(b);
				expect(b.x, `${label}x at (${x},${y})`).toBeCloseTo(a.x, 3);
				expect(b.y, `${label}y at (${x},${y})`).toBeCloseTo(a.y, 3);
			}
		}

		const cases = [
			{ s: 1, a: 0, px: 0, py: 0, hw: 8, hh: 8 },
			{ s: 1, a: Math.PI / 2, px: 100, py: 50, hw: 8, hh: 4 },
			{ s: 2, a: 0, px: 100, py: 50, hw: 8, hh: 4 },
			{ s: 0.5, a: Math.PI, px: -42, py: 17, hw: 16, hh: 8 },
			{ s: 1.5, a: Math.PI / 3, px: 7, py: -3, hw: 12, hh: 6 },
			{ s: 1, a: -Math.PI / 4, px: 0, py: 0, hw: 4, hh: 4 },
			{ s: 0, a: 2.399, px: -1234.5, py: -2.75, hw: 4, hh: 4 },
		];

		for (const c of cases) {
			it(`places the centre on pos for s=${c.s} a=${c.a.toFixed(2)}`, () => {
				// the property that matters: whatever the scale and rotation,
				// the particle's centre lands exactly on its position
				const m = expectedTransform(c.s, c.a, c.px, c.py, c.hw, c.hh);
				const centre = { x: c.hw, y: c.hh };
				m.apply(centre);
				expect(centre.x).toBeCloseTo(c.px, 3);
				expect(centre.y).toBeCloseTo(c.py, 3);
			});
		}

		it("no longer drifts the way the conjugation did", () => {
			// pins the removed artifact: with a shrinking particle the old
			// path put the centre at (2 - s)*p, which is invisible a few
			// pixels from an emitter and catastrophic in level coordinates
			const s = 0.25;
			const p = { x: 400, y: 300 };
			const old = conjugated(s, 0, p.x, p.y, 4, 4);
			const centre = { x: 4, y: 4 };
			old.apply(centre);
			expect(centre.x, "old path did not drift").toBeCloseTo((2 - s) * p.x, 3);

			const now = expectedTransform(s, 0, p.x, p.y, 4, 4);
			const fixed = { x: 4, y: 4 };
			now.apply(fixed);
			expect(fixed.x).toBeCloseTo(p.x, 3);
		});

		it("is what a real particle actually holds", () => {
			// The block this replaces compared two local helper functions and
			// never touched a Particle, so it would have kept passing against
			// a formula the engine no longer used. Read the instance.
			const em = new ParticleEmitter(120, 90, {
				width: 0,
				height: 0,
				totalParticles: 1,
				maxParticles: 1,
				minLife: 100000,
				maxLife: 100000,
				speed: 0,
				speedVariation: 0,
				gravity: 0,
				wind: 0,
				minRotation: 0.35,
				maxRotation: 0.35,
				minStartScale: 1.75,
				maxStartScale: 1.75,
				minEndScale: 1.75,
				maxEndScale: 1.75,
			});
			app.world.addChild(em);
			em.burstParticles();
			em.update(16);

			const particle = em.getChildren()[0];
			expectEquivalent(
				expectedTransform(
					1.75,
					0.35,
					particle.pos.x,
					particle.pos.y,
					particle.width / 2,
					particle.height / 2,
				),
				particle.currentTransform,
				"instance matrix: ",
			);
		});

		it("leaves autoTransform off so nothing conjugates it again", () => {
			// the flag and the matrix are one decision: with `autoTransform`
			// back on, preDraw would conjugate an already-complete placement
			const em = new ParticleEmitter(50, 50, { totalParticles: 1 });
			app.world.addChild(em);
			em.burstParticles();
			expect(em.getChildren()[0].autoTransform).toBe(false);
		});
	});

	describe("blendMode", () => {
		// An emitter draws no pixels of its own — each particle is a separate
		// renderable carrying its own blend mode, copied from
		// `settings.blendMode` when it is BORN. So `emitter.blendMode = x`,
		// which is the obvious thing to write and matches every other
		// renderable, used to reach nothing at all: the particles kept
		// rendering "normal" and it looked like they did not support blend
		// modes. Found while building the blend-modes-by-renderable example.
		it("reaches particles that are ALREADY alive", () => {
			emitter.burstParticles(6);
			expect(emitter.children.length).toBeGreaterThan(0);
			for (const particle of emitter.children) {
				expect(particle.blendMode).toBe("normal");
			}

			emitter.blendMode = "overlay";
			emitter.update(16);

			for (const particle of emitter.children) {
				expect(particle.blendMode, "a live particle kept the old mode").toBe(
					"overlay",
				);
			}
		});

		it("reaches particles emitted AFTERWARDS", () => {
			emitter.blendMode = "difference";
			emitter.update(16);
			emitter.burstParticles(4);

			expect(emitter.children.length).toBeGreaterThan(0);
			for (const particle of emitter.children) {
				expect(particle.blendMode, "a new particle missed the mode").toBe(
					"difference",
				);
			}
		});

		it("keeps the setting and the property in step", () => {
			emitter.blendMode = "color-dodge";
			emitter.update(16);
			// the setting is what newly born particles read, so the two must
			// not drift apart
			expect(emitter.settings.blendMode).toBe("color-dodge");
			expect(emitter.blendMode).toBe("color-dodge");
		});

		it("reports a mode supplied through the constructor", () => {
			const configured = new ParticleEmitter(0, 0, { blendMode: "screen" });
			// `Renderable`'s constructor assigns "normal" before this class
			// has its settings, so reset() has to sync the two back up
			expect(configured.blendMode).toBe("screen");
			expect(configured.settings.blendMode).toBe("screen");
			configured.burstParticles(3);
			for (const particle of configured.children) {
				expect(particle.blendMode).toBe("screen");
			}
		});

		it("picks a mode up through reset()", () => {
			emitter.reset({ blendMode: "hard-light" });
			expect(emitter.blendMode).toBe("hard-light");
			expect(emitter.settings.blendMode).toBe("hard-light");
		});

		it("does not re-walk the children when nothing changed", () => {
			// the propagation is a per-frame check on the emitter, so it must
			// cost a single string compare in the steady state rather than a
			// pass over every particle
			emitter.blendMode = "soft-light";
			emitter.update(16);
			const particle = emitter.children[0] ?? null;
			emitter.burstParticles(3);
			emitter.update(16);
			if (particle !== null) {
				const spy = vi.spyOn(particle, "blendMode", "set");
				emitter.update(16);
				expect(spy).not.toHaveBeenCalled();
				spy.mockRestore();
			}
		});
	});
});
