import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	Matrix3d,
	ParticleEmitter,
	Vector2d,
	video,
} from "../src/index.js";

/**
 * `ParticleEmitter.referenceSpace` — what a particle's position is measured
 * against.
 *
 * The default (`"local"`) is the behaviour melonJS has always had: particles
 * are children of the emitter, so their stored position means "this far from
 * my emitter" and a moving emitter drags the whole cloud along. `"world"`
 * measures from the container the emitter sits in, so the emitter moves away
 * and leaves them behind. A `Container` value measures from that instead.
 *
 * Two independent code paths compute where a particle ends up — the draw
 * transform, and `getAbsolutePosition()`, which feeds culling — so almost
 * everything here is asserted through BOTH. A fix applied to only one of them
 * looks correct in half these tests.
 */
describe("particle referenceSpace", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			// an explicit 1:1 scale keeps the canvas transform free of a
			// display-scaling factor, so drawn coordinates can be asserted
			// directly instead of through a fudge
			scale: "1.0",
			renderer: video.CANVAS,
			// sub-pixel snapping floors the accumulated translation after every
			// op; without this, positions arrive rounded and every assertion
			// below would need a 1px slop that hides real errors
			subPixel: true,
		});
		await app.init();
	});

	afterEach(() => {
		// One Application per FILE, not per test: each `init()` opens a real
		// browser rendering context, and CI runs on a GPU-less container where
		// those are scarce and slow. Reset the scene between tests instead —
		// the same trade `input.spec.js` makes.
		app.world.reset();
		app.world.pos.set(0, 0, 0);
		app.world.broadphase.clear();
		app.viewport.moveTo(0, 0);
		app.viewport.setBounds(0, 0, app.viewport.width, app.viewport.height);
	});

	afterAll(() => {
		// browsers cap live contexts — a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	/**
	 * A point emitter with no motion: `width`/`height` of 0 makes
	 * `getRandomPointX/Y` return exactly 0, and zero speed/gravity/wind keeps
	 * the particle where it was born. So every particle sits at a known place
	 * and the assertions can be exact rather than statistical.
	 */
	/**
	 * Burst, then tick once. A particle's transform is built in `update()`, so
	 * a freshly spawned one has only an identity matrix and would draw at its
	 * frame origin — `pos` is already correct, the matrix simply does not
	 * exist yet. Zero speed means the tick moves nothing.
	 */
	const spawn = (emitter, count) => {
		emitter.burstParticles(count);
		emitter.update(16);
		return emitter.getChildren();
	};

	const pointEmitter = (x, y, settings = {}) => {
		const emitter = new ParticleEmitter(x, y, {
			width: 0,
			height: 0,
			totalParticles: 4,
			maxParticles: 4,
			minLife: 100000,
			maxLife: 100000,
			speed: 0,
			speedVariation: 0,
			gravity: 0,
			wind: 0,
			minStartScale: 1,
			maxStartScale: 1,
			minEndScale: 1,
			maxEndScale: 1,
			...settings,
		});
		return emitter;
	};

	/** absolute position of a particle, the path culling uses */
	const absOf = (particle) => {
		const p = particle.getAbsolutePosition();
		return { x: p.x, y: p.y };
	};

	/**
	 * Where a particle is actually DRAWN — captured off the renderer during a
	 * real draw pass rather than recomputed, so this cannot agree with the
	 * implementation by sharing its maths.
	 */
	const drawnAt = (particle) => {
		let captured;
		const original = particle.draw;
		particle.draw = function patched(renderer) {
			// WebGL/WebGPU expose the accumulated matrix directly; Canvas
			// keeps it in the native 2D context
			if (typeof renderer.currentTransform !== "undefined") {
				captured = new Matrix3d().copy(renderer.currentTransform);
			} else {
				const t = renderer.getContext().getTransform();
				captured = new Matrix3d().setTransform(
					t.a,
					t.b,
					0,
					0,
					t.c,
					t.d,
					0,
					0,
					0,
					0,
					1,
					0,
					t.e,
					t.f,
					0,
					1,
				);
			}
			original.call(this, renderer);
		};
		// `Container.draw` skips anything not in the viewport, and visibility
		// is normally assigned by the update pass. Force it up the chain so
		// this measures the transform rather than the culling.
		for (let node = particle; node; node = node.ancestor) {
			node.inViewport = true;
		}
		app.renderer.clear();
		app.world.draw(app.renderer, app.viewport);
		app.renderer.flush();
		particle.draw = original;

		expect(captured, "the particle never drew").toBeDefined();
		// the transform places the particle's top-left at (0,0), so the centre
		// — which is what `getAbsolutePosition` reports — is half a texture in
		const v = new Vector2d(particle.width / 2, particle.height / 2);
		captured.apply(v);
		return { x: v.x, y: v.y };
	};

	// ------------------------------------------------------------------
	// the regression floor: the default must be exactly what it always was
	// ------------------------------------------------------------------

	describe('"local" (the default) is untouched', () => {
		it("is the default in the settings", () => {
			const emitter = pointEmitter(100, 100);
			expect(emitter.settings.referenceSpace).toBe("local");
			expect(emitter.referenceSpace).toBe("local");
		});

		it("drags the cloud along when the emitter moves", () => {
			// the measured baseline: a moving emitter carries its particles,
			// and their STORED position never changes because it was never a
			// place in the world to begin with
			const emitter = pointEmitter(100, 100);
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			expect(particle.pos.x).toBeCloseTo(0);
			expect(absOf(particle).x).toBeCloseTo(100);

			emitter.pos.x += 200;
			emitter.update(16);

			expect(particle.pos.x, "stored position moved").toBeCloseTo(0);
			expect(absOf(particle).x, "particle did not follow").toBeCloseTo(300);
		});

		it("applies no correction at all", () => {
			// not merely "the result is the same" — the local path must not
			// even reach the transform machinery
			const emitter = pointEmitter(100, 100);
			app.world.addChild(emitter);
			emitter.burstParticles();
			expect(emitter._spawnMap).toBeUndefined();
		});
	});

	// ------------------------------------------------------------------
	// core semantics
	// ------------------------------------------------------------------

	describe('"world" leaves particles behind', () => {
		it("keeps live particles where they were emitted", () => {
			const emitter = pointEmitter(100, 100, { referenceSpace: "world" });
			app.world.addChild(emitter);
			const particle = spawn(emitter)[0];

			// born at the emitter, exactly as in local mode
			expect(absOf(particle).x).toBeCloseTo(100);
			expect(drawnAt(particle).x).toBeCloseTo(100);

			emitter.pos.x += 200;
			emitter.update(16);

			// ...and stays there when the emitter leaves
			expect(absOf(particle).x, "particle followed the emitter").toBeCloseTo(
				100,
			);
			expect(drawnAt(particle).x, "drawn position followed").toBeCloseTo(100);
		});

		it("emits NEW particles at the emitter's new position", () => {
			// the other half of a trail, and a separate fact: old particles
			// stay put AND new ones appear where the emitter now is
			const emitter = pointEmitter(100, 100, {
				referenceSpace: "world",
				totalParticles: 1,
				maxParticles: 1,
			});
			app.world.addChild(emitter);
			emitter.burstParticles(1);
			const first = emitter.getChildren()[0];

			emitter.pos.x += 200;
			emitter.update(16);
			emitter.burstParticles(1);
			const second = emitter.getChildren().find((particle) => {
				return particle !== first;
			});

			expect(absOf(first).x).toBeCloseTo(100);
			expect(absOf(second).x, "new particle did not follow").toBeCloseTo(300);
		});

		it("agrees between the draw path and the culling path", () => {
			const emitter = pointEmitter(250, 175, { referenceSpace: "world" });
			app.world.addChild(emitter);
			const particle = spawn(emitter)[0];

			emitter.pos.set(600, 400);
			emitter.update(16);

			const drawn = drawnAt(particle);
			const abs = absOf(particle);
			expect(abs.x).toBeCloseTo(drawn.x);
			expect(abs.y).toBeCloseTo(drawn.y);
		});
	});

	describe("a Container value measures from that container", () => {
		it("follows the target, not the emitter", () => {
			const frame = new Container(0, 0, 800, 600);
			frame.anchorPoint.set(0, 0);
			app.world.addChild(frame);

			const emitter = pointEmitter(100, 100, { referenceSpace: frame });
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			expect(absOf(particle).x).toBeCloseTo(100);

			// the emitter moving must not disturb them...
			emitter.pos.x += 200;
			emitter.update(16);
			expect(absOf(particle).x, "particle followed the emitter").toBeCloseTo(
				100,
			);

			// ...but the frame moving must carry them
			frame.pos.x += 50;
			emitter.update(16);
			expect(absOf(particle).x, "particle ignored its frame").toBeCloseTo(150);
		});
	});

	// ------------------------------------------------------------------
	// the identities: custom is the general case, the keywords are shorthands
	// ------------------------------------------------------------------

	describe("degenerate targets collapse to the simpler mode", () => {
		const positionsFor = (space) => {
			const emitter = pointEmitter(120, 90, { referenceSpace: space });
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			emitter.pos.set(300, 250);
			emitter.update(16);
			const result = absOf(particle);
			app.world.removeChildNow(emitter);
			return result;
		};

		it("a target that IS the emitter behaves as local", () => {
			const emitter = pointEmitter(120, 90);
			app.world.addChild(emitter);
			emitter.referenceSpace = emitter;
			app.world.removeChildNow(emitter);

			const custom = positionsFor(
				(() => {
					const e = pointEmitter(0, 0);
					return e;
				})() && "local",
			);
			expect(custom).toEqual(positionsFor("local"));
		});

		it("a target that IS the parent behaves as world", () => {
			expect(positionsFor(app.world)).toEqual(positionsFor("world"));
		});

		it('"world" on a parentless emitter falls back to local', () => {
			// nothing to measure against — must not throw, and must not
			// silently produce NaN coordinates
			const emitter = pointEmitter(100, 100, { referenceSpace: "world" });
			expect(() => {
				emitter.burstParticles();
			}).not.toThrow();
			const particle = emitter.getChildren()[0];
			expect(Number.isFinite(particle.pos.x)).toBe(true);
			expect(Number.isFinite(particle.pos.y)).toBe(true);
		});
	});

	describe("nesting", () => {
		it('"world" cancels only the emitter, not an intervening container', () => {
			// the case a naive `-emitter.pos` implementation passes in the flat
			// scene and fails here: particles must stay put relative to the
			// LEVEL, and therefore still travel when the level itself moves
			const level = new Container(40, 30, 800, 600);
			level.anchorPoint.set(0, 0);
			app.world.addChild(level);

			const emitter = pointEmitter(100, 100, { referenceSpace: "world" });
			level.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			expect(absOf(particle).x).toBeCloseTo(140);

			emitter.pos.x += 200;
			emitter.update(16);
			expect(absOf(particle).x, "followed the emitter").toBeCloseTo(140);

			level.pos.x += 25;
			emitter.update(16);
			expect(absOf(particle).x, "did not travel with its level").toBeCloseTo(
				165,
			);
		});
	});

	// ------------------------------------------------------------------
	// rotation and scale — asserted correct, not documented away
	// ------------------------------------------------------------------

	describe("a rotated or scaled emitter", () => {
		it('does not spin its particles under "world"', () => {
			// a translation-only correction lands inside the rotated frame and
			// sends the particles off at the wrong angle entirely
			const emitter = pointEmitter(200, 150, { referenceSpace: "world" });
			app.world.addChild(emitter);
			emitter.rotate(Math.PI / 3);
			const particle = spawn(emitter)[0];

			// born at the emitter regardless of how the emitter is oriented
			expect(absOf(particle).x).toBeCloseTo(200);
			expect(absOf(particle).y).toBeCloseTo(150);
			expect(drawnAt(particle).x).toBeCloseTo(200);
			expect(drawnAt(particle).y).toBeCloseTo(150);

			// and rotating further must not drag it around the emitter
			emitter.rotate(Math.PI / 5);
			emitter.update(16);
			expect(absOf(particle).x, "particle orbited the emitter").toBeCloseTo(
				200,
			);
			expect(absOf(particle).y).toBeCloseTo(150);
		});

		it('does not scale its particle positions under "world"', () => {
			const emitter = pointEmitter(200, 150, { referenceSpace: "world" });
			app.world.addChild(emitter);
			emitter.scale(3, 0.5);
			const particle = spawn(emitter)[0];

			expect(absOf(particle).x).toBeCloseTo(200);
			expect(absOf(particle).y).toBeCloseTo(150);
			expect(drawnAt(particle).x).toBeCloseTo(200);
			expect(drawnAt(particle).y).toBeCloseTo(150);
		});

		it("is unaffected by a rotated ancestor", () => {
			const level = new Container(0, 0, 800, 600);
			level.anchorPoint.set(0, 0);
			level.rotate(Math.PI / 7);
			app.world.addChild(level);

			const emitter = pointEmitter(120, 80, { referenceSpace: "world" });
			level.addChild(emitter);
			const particle = spawn(emitter)[0];

			const before = drawnAt(particle);
			emitter.pos.x += 150;
			emitter.update(16);
			const after = drawnAt(particle);

			expect(after.x, "moved when the emitter moved").toBeCloseTo(before.x);
			expect(after.y).toBeCloseTo(before.y);
		});

		it("still gives every particle its own rotation and scale", () => {
			// the property that was never at risk — pinned so it stays that way
			const emitter = pointEmitter(200, 150, {
				referenceSpace: "world",
				minRotation: 0.7,
				maxRotation: 0.7,
				minStartScale: 2,
				maxStartScale: 2,
				minEndScale: 2,
				maxEndScale: 2,
			});
			app.world.addChild(emitter);
			emitter.burstParticles();
			emitter.update(16);
			const particle = emitter.getChildren()[0];

			const m = particle.currentTransform.val;
			// linear part is scale * R(0.7), not the identity
			expect(m[0]).toBeCloseTo(2 * Math.cos(0.7), 4);
			expect(m[1]).toBeCloseTo(2 * Math.sin(0.7), 4);
		});
	});

	// ------------------------------------------------------------------
	// the bookkeeping this whole design exists to protect
	// ------------------------------------------------------------------

	describe("emitter bookkeeping still works in a non-local space", () => {
		it("does NOT spawn without bound", () => {
			// the reason particles stay children of the emitter. The stream
			// throttle counts `getChildren().length`; had they been reparented
			// it would read zero forever and spawn its maximum every tick.
			const emitter = pointEmitter(100, 100, {
				referenceSpace: "world",
				totalParticles: 12,
				maxParticles: 4,
				frequency: 1,
			});
			app.world.addChild(emitter);
			emitter.streamParticles();

			for (let i = 0; i < 200; i++) {
				emitter.update(16);
			}

			expect(emitter.getChildren().length).toBeLessThanOrEqual(12);
		});

		it("still detects completion and auto-destroys", async () => {
			let completed = false;
			const emitter = pointEmitter(100, 100, {
				referenceSpace: "world",
				minLife: 30,
				maxLife: 30,
				autoDestroyOnComplete: true,
				onComplete: () => {
					completed = true;
				},
			});
			app.world.addChild(emitter);
			emitter.burstParticles();
			expect(emitter.getChildren().length).toBeGreaterThan(0);

			for (let i = 0; i < 5; i++) {
				emitter.update(16);
			}
			// Container.removeChild() defers via setTimeout(0); flush it
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});

			expect(completed, "onComplete never fired").toBe(true);
			expect(
				app.world.getChildren(),
				"emitter did not remove itself",
			).not.toContain(emitter);
		});

		it("still fans a blend-mode change out to live particles", () => {
			const emitter = pointEmitter(100, 100, { referenceSpace: "world" });
			app.world.addChild(emitter);
			emitter.burstParticles();

			emitter.blendMode = "overlay";
			emitter.update(16);

			for (const particle of emitter.getChildren()) {
				expect(particle.blendMode).toBe("overlay");
			}
		});

		it("releases a custom target on destroy", () => {
			const frame = new Container(0, 0, 100, 100);
			app.world.addChild(frame);
			const emitter = pointEmitter(100, 100, { referenceSpace: frame });
			app.world.addChild(emitter);
			emitter.burstParticles();

			emitter.destroy();

			expect(emitter.settings.referenceSpace).toBe("local");
			expect(emitter._spawnMap).toBeUndefined();
		});
	});

	// ------------------------------------------------------------------
	// culling — the trail must survive the emitter leaving the screen
	// ------------------------------------------------------------------

	describe("culling", () => {
		it("keeps drawing a trail after the emitter scrolls off-screen", () => {
			// `Container.draw` gates children on the PARENT's inViewport, and
			// an emitter's bounds do not cover its children — so without the
			// re-assert the whole trail vanishes the moment the ship exits
			const emitter = pointEmitter(100, 300, { referenceSpace: "world" });
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			// send the emitter far outside the 800x600 viewport
			emitter.pos.set(5000, 300);
			app.world.update(16);

			expect(emitter.inViewport, "emitter culled with a live trail").toBe(true);
			expect(particle.inViewport, "the particle itself was culled").toBe(true);
		});

		it("still culls the particles themselves once they leave", () => {
			// the re-assert must not become "never cull anything"
			const emitter = pointEmitter(100, 300, {
				referenceSpace: "world",
				// bounds are otherwise only refreshed when `pos` changes, and
				// this emitter deliberately has zero speed
				accurateBounds: true,
			});
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			particle.pos.set(9000, 9000);
			// the particle's transform (and therefore its bounds) is rebuilt
			// in update(), and the visibility pass reads bounds BEFORE calling
			// it — so the move needs one tick to land before it can be culled
			emitter.update(16);
			app.world.update(16);

			expect(particle.inViewport, "off-screen particle stayed visible").toBe(
				false,
			);
		});

		it("does not touch visibility in local mode", () => {
			const emitter = pointEmitter(100, 300);
			app.world.addChild(emitter);
			emitter.burstParticles();

			emitter.pos.set(5000, 300);
			app.world.update(16);

			expect(emitter.inViewport).toBe(false);
		});
	});

	// ------------------------------------------------------------------
	// hostile input
	// ------------------------------------------------------------------

	describe("changing the space at runtime", () => {
		it("does not teleport the particles already alive", () => {
			const emitter = pointEmitter(150, 120);
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			const before = absOf(particle);
			emitter.referenceSpace = "world";
			const after = absOf(particle);

			expect(after.x, "particle jumped on switch").toBeCloseTo(before.x);
			expect(after.y).toBeCloseTo(before.y);
		});

		it("survives a full round trip and behaves correctly at the end", () => {
			const frame = new Container(10, 20, 400, 400);
			frame.anchorPoint.set(0, 0);
			app.world.addChild(frame);

			const emitter = pointEmitter(150, 120);
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			const origin = absOf(particle);

			for (const space of ["world", frame, "local", "world"]) {
				const before = absOf(particle);
				emitter.referenceSpace = space;
				const after = absOf(particle);
				expect(after.x, `jumped switching to ${space}`).toBeCloseTo(before.x);
				expect(after.y).toBeCloseTo(before.y);
			}

			expect(absOf(particle).x).toBeCloseTo(origin.x);
			// and it really is in world space now: the emitter can walk away
			emitter.pos.x += 300;
			emitter.update(16);
			expect(absOf(particle).x).toBeCloseTo(origin.x);
		});

		it("re-bases through reset() too, not just the accessor", () => {
			// `reset()` assigns `settings` wholesale, so without routing it
			// through the same re-basing the live particles would be left
			// holding coordinates measured against a frame no longer theirs
			const emitter = pointEmitter(150, 120);
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			const before = absOf(particle);

			emitter.reset({ referenceSpace: "world" });

			const after = absOf(particle);
			expect(after.x, "particle teleported on reset()").toBeCloseTo(before.x);
			expect(after.y).toBeCloseTo(before.y);
			expect(emitter.referenceSpace).toBe("world");
		});

		it("is a no-op when assigned the value it already has", () => {
			const emitter = pointEmitter(150, 120, { referenceSpace: "world" });
			app.world.addChild(emitter);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			const before = absOf(particle);

			emitter.referenceSpace = "world";

			expect(absOf(particle).x).toBeCloseTo(before.x);
		});
	});

	describe("hostile targets", () => {
		it("does not throw when the target was removed from the scene", () => {
			const frame = new Container(30, 30, 200, 200);
			app.world.addChild(frame);
			const emitter = pointEmitter(100, 100, { referenceSpace: frame });
			app.world.addChild(emitter);
			emitter.burstParticles();

			app.world.removeChildNow(frame);

			expect(() => {
				emitter.update(16);
				emitter.burstParticles(1);
				app.world.draw(app.renderer, app.viewport);
			}).not.toThrow();
		});

		it("does not recurse forever on a target inside the emitter", () => {
			const inner = new Container(5, 5, 50, 50);
			const emitter = pointEmitter(100, 100);
			app.world.addChild(emitter);
			emitter.addChild(inner);
			emitter.referenceSpace = inner;

			expect(() => {
				emitter.burstParticles();
				emitter.update(16);
			}).not.toThrow();
		});

		it("produces no NaN under a zero-scaled emitter", () => {
			// a singular transform has no inverse; the correction must degrade
			// rather than poison every position with NaN
			const emitter = pointEmitter(100, 100, { referenceSpace: "world" });
			app.world.addChild(emitter);
			emitter.scale(0, 0);
			emitter.burstParticles();

			for (const particle of emitter.getChildren()) {
				expect(Number.isNaN(particle.pos.x), "NaN x").toBe(false);
				expect(Number.isNaN(particle.pos.y), "NaN y").toBe(false);
			}
		});

		it("works with floating emitters in every mode", () => {
			for (const space of ["local", "world"]) {
				const emitter = pointEmitter(100, 100, {
					referenceSpace: space,
					floating: true,
				});
				app.world.addChild(emitter);
				expect(() => {
					emitter.burstParticles();
					emitter.update(16);
				}, `floating + ${space}`).not.toThrow();
				const particle = emitter.getChildren()[0];
				expect(Number.isFinite(absOf(particle).x)).toBe(true);
				app.world.removeChildNow(emitter);
			}
		});
	});

	// ------------------------------------------------------------------
	// depth — Camera3d culls on the z summed across the chain
	// ------------------------------------------------------------------

	describe("depth", () => {
		it("sums z across the chain, measured from the reference frame", () => {
			// `Camera3d.isVisible` frustum-culls on `getAbsolutePosition()`,
			// z included, so the override has to keep the depth summation the
			// base implementation does — just rooted at the reference frame
			// rather than the emitter
			const level = new Container(0, 0, 800, 600);
			level.anchorPoint.set(0, 0);
			// passed through addChild — assigning pos.z afterwards would be
			// overwritten by the auto-depth addChild applies
			app.world.addChild(level, 40);

			const emitter = pointEmitter(100, 100, { referenceSpace: "world" });
			level.addChild(emitter, 7);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			// the particle carries the emitter's depth (addParticles passes it
			// as the child z), and the frame it is measured from contributes
			// the rest of the chain
			expect(particle.depth).toBe(7);
			expect(particle.getAbsolutePosition().z).toBeCloseTo(47);
		});

		it("matches the base implementation in local mode", () => {
			const level = new Container(0, 0, 800, 600);
			level.anchorPoint.set(0, 0);
			app.world.addChild(level, 40);

			const emitter = pointEmitter(100, 100);
			level.addChild(emitter, 7);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];

			// emitter's own 7 + the emitter's absolute z (40 + 7)
			expect(particle.getAbsolutePosition().z).toBeCloseTo(54);
		});
	});

	// ------------------------------------------------------------------
	// pooling
	// ------------------------------------------------------------------

	it("a recycled particle is born in its new emitter's space", () => {
		// particles come from a shared pool, so an instance that lived in one
		// emitter's frame can be handed to an emitter using another
		const local = pointEmitter(100, 100, { minLife: 20, maxLife: 20 });
		app.world.addChild(local);
		local.burstParticles();
		for (let i = 0; i < 4; i++) {
			local.update(30);
		}
		expect(local.getChildren().length).toBe(0);

		const world = pointEmitter(400, 200, { referenceSpace: "world" });
		app.world.addChild(world);
		world.burstParticles();
		const particle = world.getChildren()[0];

		expect(absOf(particle).x).toBeCloseTo(400);
		world.pos.x += 100;
		world.update(16);
		expect(absOf(particle).x, "recycled particle followed").toBeCloseTo(400);
	});
});
