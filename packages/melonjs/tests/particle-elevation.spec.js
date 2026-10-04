import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, ParticleEmitter, video } from "../src/index.js";
import { particlePool } from "../src/particles/particle.ts";

/**
 * `elevation` — particles that move along Z (#1696).
 *
 * Particles were PLACED in 3D but MOVED in 2D: a particle kept the depth it
 * was born at for its whole life, so a burst under a perspective camera was a
 * flat disc facing the viewer rather than a sphere, and no trail could recede.
 *
 * The thing most of these tests are really guarding is the SECOND half of that
 * ticket: the 2D path has to remain TODAY's path, chosen by a gate, rather than
 * becoming the 3D path with zeros in it. An emitter that asks for no elevation
 * must take the same two trig call launch it always did, carry no Z, and not
 * start sorting its children.
 */
describe("particle elevation", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(400, 300, {
			parent: "screen",
			scale: "1.0",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterEach(() => {
		app.world.reset();
	});

	/** an emitter with `n` particles already launched */
	const burst = (settings) => {
		const e = new ParticleEmitter(100, 100, {
			totalParticles: 40,
			speed: 10,
			speedVariation: 0,
			...settings,
		});
		app.world.addChild(e);
		e.burstParticles();
		return e;
	};

	describe("a 2D emitter is untouched", () => {
		it("launches with no Z velocity and is not marked 3D", () => {
			const e = burst({ angle: 0, angleVariation: Math.PI * 2 });
			const kids = e.getChildren();
			expect(kids.length).toBeGreaterThan(0);
			for (const p of kids) {
				expect(p.velZ).toBe(0);
				expect(p.moves3d).toBe(false);
			}
		});

		it("keeps the depth it was born at, however long it runs", () => {
			const e = burst({ angle: 0, angleVariation: Math.PI * 2 });
			const before = e.getChildren().map((p) => {
				return p.depth;
			});
			for (let i = 0; i < 20; i++) {
				e.update(16);
			}
			const after = e.getChildren().map((p) => {
				return p.depth;
			});
			for (let i = 0; i < after.length; i++) {
				expect(after[i]).toBe(before[i]);
			}
		});

		it("does not turn sorting on, which would cost a sort per frame", () => {
			const e = burst({ angle: 0, angleVariation: Math.PI * 2 });
			expect(e.autoSort).toBe(false);
		});

		it("still launches at the full speed it was given", () => {
			const e = burst({ angle: 0, angleVariation: 0, speed: 10 });
			for (const p of e.getChildren()) {
				expect(Math.hypot(p.vel.x, p.vel.y)).toBeCloseTo(10, 5);
			}
		});
	});

	describe("an elevated emitter moves along Z", () => {
		it("launches with a Z velocity", () => {
			const e = burst({ elevation: Math.PI / 2 });
			for (const p of e.getChildren()) {
				expect(p.moves3d).toBe(true);
				expect(p.velZ).toBeCloseTo(10, 5);
			}
		});

		it("straight up the Z axis leaves nothing in the plane", () => {
			const e = burst({ elevation: Math.PI / 2 });
			for (const p of e.getChildren()) {
				expect(Math.hypot(p.vel.x, p.vel.y)).toBeCloseTo(0, 5);
			}
		});

		it("a negative elevation recedes instead", () => {
			const e = burst({ elevation: -Math.PI / 2 });
			for (const p of e.getChildren()) {
				expect(p.velZ).toBeCloseTo(-10, 5);
			}
		});

		it("the depth actually changes as it runs", () => {
			const e = burst({ elevation: Math.PI / 4 });
			const before = e.getChildren().map((p) => {
				return p.depth;
			});
			for (let i = 0; i < 10; i++) {
				e.update(16);
			}
			const after = e.getChildren().map((p) => {
				return p.depth;
			});
			expect(
				after.some((d, i) => {
					return d !== before[i];
				}),
			).toBe(true);
		});

		it("speed is the length of the WHOLE 3D vector, not of its shadow", () => {
			// without the cosine foreshortening, an "every direction" burst
			// would bunch toward the poles instead of covering a sphere
			const e = burst({
				angle: 0,
				angleVariation: Math.PI * 2,
				elevation: 0,
				elevationVariation: Math.PI / 2,
				speed: 10,
			});
			for (const p of e.getChildren()) {
				const len = Math.sqrt(
					p.vel.x * p.vel.x + p.vel.y * p.vel.y + p.velZ * p.velZ,
				);
				expect(len).toBeCloseTo(10, 5);
			}
		});

		it("a spherical burst genuinely spreads over Z, not just the plane", () => {
			const e = burst({
				angle: 0,
				angleVariation: Math.PI * 2,
				elevation: 0,
				elevationVariation: Math.PI / 2,
			});
			const zs = e.getChildren().map((p) => {
				return p.velZ;
			});
			expect(Math.min(...zs)).toBeLessThan(-1);
			expect(Math.max(...zs)).toBeGreaterThan(1);
		});
	});

	describe("sorting keys off the BLEND MODE, not off the 3D flag", () => {
		it("sorts a 3D burst drawn with an order-dependent blend", () => {
			const e = burst({ elevation: Math.PI / 4, blendMode: "normal" });
			expect(e.autoSort).toBe(true);
			expect(e.sortOn).toBe("depth");
		});

		it("does NOT sort a 3D ADDITIVE burst, which is commutative", () => {
			const e = burst({ elevation: Math.PI / 4, textureAdditive: true });
			expect(e.autoSort).toBe(false);
		});

		it("does not sort a 2D burst whatever its blend mode", () => {
			expect(burst({ blendMode: "normal" }).autoSort).toBe(false);
		});
	});

	// Deliberately adversarial: each of these was written to try to BREAK the
	// implementation rather than to confirm it.
	describe("trying to break it", () => {
		it("a pooled particle reused by a 2D emitter drops its Z motion", () => {
			// `particlePool` recycles instances between emitters. A particle
			// that lived in a 3D burst and is then handed to a 2D one must not
			// arrive still carrying `velZ` and `moves3d` from its last life.
			const hot = burst({ elevation: Math.PI / 4 });
			for (const p of hot.getChildren()) {
				expect(p.moves3d).toBe(true);
			}
			app.world.removeChildNow(hot);

			const cold = burst({ angle: 0, angleVariation: Math.PI * 2 });
			for (const p of cold.getChildren()) {
				expect(p.moves3d).toBe(false);
				expect(p.velZ).toBe(0);
			}
		});

		it("the depth change reaches the ABSOLUTE position, not just a field", () => {
			// `depth` proxies `pos.z`, and culling reads `getAbsolutePosition`.
			// Moving one without the other would look right in isolation and
			// cull wrongly.
			const e = burst({ elevation: Math.PI / 2 });
			const p = e.getChildren()[0];
			const before = p.getAbsolutePosition().z;
			for (let i = 0; i < 10; i++) {
				e.update(16);
			}
			expect(p.getAbsolutePosition().z).not.toBe(before);
		});

		it("turning sorting on does not move anything", () => {
			const flat = burst({ elevation: Math.PI / 4, textureAdditive: true });
			const flatZ = flat
				.getChildren()
				.map((p) => {
					return p.velZ;
				})
				.sort();
			app.world.removeChildNow(flat);
			const sorted = burst({ elevation: Math.PI / 4, blendMode: "normal" });
			expect(sorted.autoSort).toBe(true);
			// the same launch, whatever the draw order ends up being
			expect(sorted.getChildren().length).toBe(flatZ.length);
		});

		it("sorting flips BOTH ways when the blend mode changes at runtime", () => {
			const e = burst({ elevation: Math.PI / 4, blendMode: "normal" });
			expect(e.autoSort).toBe(true);
			e.blendMode = "additive";
			e.update(16);
			expect(e.autoSort).toBe(false);
			e.blendMode = "normal";
			e.update(16);
			expect(e.autoSort).toBe(true);
		});

		it("elevationVariation alone is enough to go 3D", () => {
			// the gate is on the COMPUTED elevation, so a zero mean with a
			// spread must still produce Z motion
			const e = burst({ elevation: 0, elevationVariation: Math.PI / 3 });
			expect(
				e.getChildren().some((p) => {
					return p.moves3d;
				}),
			).toBe(true);
		});

		it("a 3D burst left on the DEFAULT blend sorts, which costs something", () => {
			// `textureAdditive` is false and `blendMode` is "normal" by
			// default, and "normal" is not commutative: a 3D burst that says
			// nothing about blending therefore pays for a depth sort. That is
			// correct, and it is the one case where asking for elevation is
			// not free, so it is pinned here rather than discovered later.
			const e = burst({ elevation: Math.PI / 4 });
			expect(e.autoSort).toBe(true);
			// and saying "additive" is what buys it back
			e.blendMode = "additive";
			e.update(16);
			expect(e.autoSort).toBe(false);
		});

		it("exactly +/- PI/2 really does go straight along Z", () => {
			// cos(PI/2) is 6.1e-17, not 0: the in-plane part must be
			// negligible rather than merely small
			const e = burst({ elevation: Math.PI / 2, speed: 100 });
			for (const p of e.getChildren()) {
				expect(Math.abs(p.vel.x)).toBeLessThan(1e-10);
				expect(Math.abs(p.vel.y)).toBeLessThan(1e-10);
				expect(p.velZ).toBeCloseTo(100, 6);
			}
		});

		it("a 2D particle's depth is never written, even over a long life", () => {
			// the gate has to skip the write entirely, not write the same value
			const e = burst({ angle: 0, angleVariation: Math.PI * 2 });
			const p = e.getChildren()[0];
			let writes = 0;
			const real = Object.getOwnPropertyDescriptor(
				Object.getPrototypeOf(Object.getPrototypeOf(p)),
				"depth",
			);
			Object.defineProperty(p, "depth", {
				configurable: true,
				get: () => {
					return real.get.call(p);
				},
				set: (v) => {
					writes++;
					real.set.call(p, v);
				},
			});
			for (let i = 0; i < 30; i++) {
				e.update(16);
			}
			expect(writes).toBe(0);
		});

		it("speed 0 produces no motion in any axis, elevated or not", () => {
			const e = burst({ speed: 0, speedVariation: 0, elevation: Math.PI / 3 });
			for (const p of e.getChildren()) {
				expect(p.velZ).toBeCloseTo(0, 10);
				expect(Math.hypot(p.vel.x, p.vel.y)).toBeCloseTo(0, 10);
			}
		});
	});

	/**
	 * `minSpread` / `maxSpread` — aiming off an AXIS rather than within a
	 * rectangle of azimuth x elevation.
	 *
	 * The shape that motivated it is a ring of debris tangent to a sphere:
	 * the directions perpendicular to a surface normal. On the independent
	 * path the elevation that satisfies that is a function of the azimuth, so
	 * no pair of variations can describe it; the rectangle always contains
	 * directions that point into the sphere.
	 */
	describe("spread, around an axis", () => {
		/** the axis the emitter's `angle`/`elevation` pair names */
		const axisOf = (angle, elevation) => {
			const ce = Math.cos(elevation);
			return [ce * Math.cos(angle), -ce * Math.sin(angle), Math.sin(elevation)];
		};
		const dirOf = (p, speed) => {
			return [p.vel.x / speed, p.vel.y / speed, p.velZ / speed];
		};
		const dot = (a, b) => {
			return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
		};

		it("leaves the independent path alone when maxSpread is 0", () => {
			const e = burst({
				angle: 0.4,
				angleVariation: 0,
				elevation: 0,
				maxSpread: 0,
			});
			for (const p of e.getChildren()) {
				expect(p.moves3d).toBe(false);
				expect(p.velZ).toBe(0);
			}
		});

		it("puts every particle on the cone it was asked for", () => {
			for (const [angle, elev, theta] of [
				[0, 0, 0.3],
				[1.1, 0.7, 0.3],
				[-2.2, -1.2, 1.0],
				[0.5, Math.PI / 2, 0.6],
			]) {
				const e = burst({
					angle,
					elevation: elev,
					minSpread: theta,
					maxSpread: theta,
					speed: 10,
					speedVariation: 0,
				});
				const ax = axisOf(angle, elev);
				for (const p of e.getChildren()) {
					// exactly on the cone: the angle off the axis IS theta
					expect(
						Math.acos(Math.max(-1, Math.min(1, dot(dirOf(p, 10), ax)))),
					).toBeCloseTo(theta, 9);
				}
				app.world.removeChildNow(e);
			}
		});

		it("keeps the launch at full speed, so a ring is not slower than a cone", () => {
			const e = burst({
				elevation: 0.6,
				minSpread: Math.PI / 2,
				maxSpread: Math.PI / 2,
				speed: 7,
				speedVariation: 0,
			});
			for (const p of e.getChildren()) {
				expect(Math.hypot(p.vel.x, p.vel.y, p.velZ)).toBeCloseTo(7, 9);
			}
		});

		it("a 90 degree spread is a flat disc: nothing travels along the axis", () => {
			// the whole point. On the independent path this shape is
			// unreachable, and the rectangle leaks directions along the axis.
			for (const [angle, elev] of [
				[0, 0],
				[0.9, 0.4],
				[2.5, -1.3],
				[0, Math.PI / 2],
			]) {
				const e = burst({
					angle,
					elevation: elev,
					minSpread: Math.PI / 2,
					maxSpread: Math.PI / 2,
					speed: 9,
					speedVariation: 0,
				});
				const ax = axisOf(angle, elev);
				for (const p of e.getChildren()) {
					expect(Math.abs(dot(dirOf(p, 9), ax))).toBeLessThan(1e-9);
				}
				app.world.removeChildNow(e);
			}
		});

		it("covers the whole circle around the axis rather than one side", () => {
			const e = burst({
				angle: 0.3,
				elevation: 0.8,
				minSpread: Math.PI / 2,
				maxSpread: Math.PI / 2,
				speed: 5,
				speedVariation: 0,
				totalParticles: 400,
			});
			const ax = axisOf(0.3, 0.8);
			// a basis in the disc, to measure the azimuth the particles landed on
			let u = [ax[1], -ax[0], 0];
			const ul = Math.hypot(...u);
			u = u.map((v) => {
				return v / ul;
			});
			const v = [
				ax[1] * u[2] - ax[2] * u[1],
				ax[2] * u[0] - ax[0] * u[2],
				ax[0] * u[1] - ax[1] * u[0],
			];
			const quad = [0, 0, 0, 0];
			for (const p of e.getChildren()) {
				const d = dirOf(p, 5);
				const a = Math.atan2(dot(d, v), dot(d, u));
				quad[Math.min(3, Math.floor(((a + Math.PI) / (Math.PI * 2)) * 4))]++;
			}
			// 400 particles over 4 quadrants: every one well clear of empty
			for (const q of quad) {
				expect(q).toBeGreaterThan(40);
			}
		});

		it("ignores angleVariation and elevationVariation entirely", () => {
			// The axis is the one direction the whole burst is measured
			// against, so neither variation may move it: `minSpread` and
			// `maxSpread` own the spread here. `angleVariation` used to leak
			// in, because the azimuth was taken from the jittered `angle`
			// while the elevation was taken straight off the settings.
			const axis = axisOf(0.6, 0.35);
			const e = burst({
				angle: 0.6,
				elevation: 0.35,
				angleVariation: Math.PI,
				elevationVariation: Math.PI / 2,
				minSpread: 0.4,
				maxSpread: 0.4,
				speed: 6,
				speedVariation: 0,
				totalParticles: 200,
			});
			for (const p of e.getChildren()) {
				expect(
					Math.acos(Math.max(-1, Math.min(1, dot(dirOf(p, 6), axis)))),
				).toBeCloseTo(0.4, 9);
			}
		});

		it("a spread emitter sorts, even with elevation left at zero", () => {
			// `maxSpread` moves particles along Z on its own, so the gate that
			// decides sorting has to count it independently of `elevation`
			const e = burst({
				elevation: 0,
				elevationVariation: 0,
				minSpread: Math.PI / 2,
				maxSpread: Math.PI / 2,
				textureAdditive: false,
			});
			expect(e.autoSort).toBe(true);
			for (const p of e.getChildren()) {
				expect(p.moves3d).toBe(true);
			}
		});

		it("a pooled particle does not inherit moves3d from a spread life", () => {
			const hot = burst({ minSpread: 1, maxSpread: 1 });
			for (const p of hot.getChildren()) {
				expect(p.moves3d).toBe(true);
			}
			app.world.removeChildNow(hot);
			const cold = burst({ angle: 0, angleVariation: Math.PI * 2 });
			for (const p of cold.getChildren()) {
				expect(p.moves3d).toBe(false);
				expect(p.velZ).toBe(0);
			}
		});

		it("a band between min and max stays inside it at both ends", () => {
			const e = burst({
				angle: 0.2,
				elevation: 0.5,
				minSpread: 1.2,
				maxSpread: 1.5,
				speed: 8,
				speedVariation: 0,
				totalParticles: 300,
			});
			const ax = axisOf(0.2, 0.5);
			let lo = Infinity,
				hi = -Infinity;
			for (const p of e.getChildren()) {
				const t = Math.acos(Math.max(-1, Math.min(1, dot(dirOf(p, 8), ax))));
				expect(t).toBeGreaterThanOrEqual(1.2 - 1e-9);
				expect(t).toBeLessThanOrEqual(1.5 + 1e-9);
				lo = Math.min(lo, t);
				hi = Math.max(hi, t);
			}
			// and actually uses the band rather than collapsing to one edge
			expect(lo).toBeLessThan(1.25);
			expect(hi).toBeGreaterThan(1.45);
		});
	});

	/**
	 * The depth a particle is DRAWN at, which is a different number from the
	 * one it is culled and sorted at.
	 *
	 * `getAbsolutePosition().z` feeds the frustum test and the sort;
	 * `preDraw` feeds the renderer. Both have to come out at the emitter's
	 * slice plus the particle's own drift, and they get there by different
	 * routes, so a test on one says nothing about the other.
	 */
	describe("draw depth", () => {
		/**
		 * The REAL renderer with `setDepth` recorded, rather than a stub:
		 * `Renderable#preDraw` calls a good deal of renderer surface and a
		 * hand-rolled double drifts out of date silently.
		 */
		const record = (fn) => {
			const r = app.renderer;
			const real = r.setDepth.bind(r);
			const calls = [];
			// `setDepth` forces `currentDepth` to 0 unless the projection
			// carries a perspective term, so depth composition is inert in a
			// 2D scene and this has to stand a perspective one up to mean
			// anything. That gate is the real behaviour, not a test artifact.
			const projected = r.projectionMatrix.val[11];
			r.projectionMatrix.val[11] = -1;
			r.setDepth = (z) => {
				calls.push(z);
				real(z);
			};
			try {
				fn(r, calls);
			} finally {
				r.setDepth = real;
				r.projectionMatrix.val[11] = projected;
			}
			return calls;
		};

		it("draws at the emitter's slice plus its own drift, not at the drift alone", () => {
			const e = burst({ elevation: Math.PI / 4, totalParticles: 8 });
			const p = e.getChildren()[0];
			p.depth = 17;

			const calls = record((r, _calls) => {
				// what the emitter's own preDraw leaves behind for its children
				r.setDepth(900);
				_calls.length = 0;
				p.preDraw(r);
				p.postDraw(r);
			});

			// 917, not 17: `Renderable#preDraw` ASSIGNS rather than
			// accumulates, so without the composition the particle would be
			// drawn on the plane through the world origin
			expect(calls.at(-1)).toBeCloseTo(917);
		});

		it("agrees with the depth it is culled and sorted at", () => {
			const e = burst({ elevation: Math.PI / 4, totalParticles: 8 });
			e.pos.z = 640;
			const p = e.getChildren()[0];
			p.depth = -11;

			const calls = record((r, _calls) => {
				r.setDepth(640);
				_calls.length = 0;
				p.preDraw(r);
				p.postDraw(r);
			});

			// the draw depth and the cull/sort depth are computed by
			// different routes and must land on the same number
			expect(calls.at(-1)).toBeCloseTo(p.getAbsolutePosition().z);
			expect(calls.at(-1)).toBeCloseTo(629);
		});
	});

	/**
	 * Destroying a SORTING emitter, which is what an elevated one is.
	 *
	 * `Container#destroy` used to empty itself by calling its own public
	 * `reset()`. `ParticleEmitter` redefines `reset(settings)` to re-apply its
	 * settings, so on an emitter that call did nothing of what `destroy`
	 * wanted: the particles stayed as children and never went back to the
	 * pool, and the deferred sort stayed armed and then ran against an emitter
	 * whose `pos` had already been released, throwing out of
	 * `getAbsolutePosition` with no test to catch it.
	 *
	 * Only reachable through a sorting emitter, which before #1696 none of
	 * them were: 2D bursts are additive and commutative and never arm a sort.
	 */
	describe("destroy, on an emitter that owes a sort", () => {
		it("releases its particles and disarms the sort", () => {
			const e = burst({ elevation: Math.PI / 4, textureAdditive: false });
			// the premise: this emitter sorts, and so has work deferred
			expect(e.autoSort).toBe(true);
			expect(e.pendingSort).not.toBe(null);
			expect(e.getChildren().length).toBeGreaterThan(0);

			// through the container, which is the path `autoDestroyOnComplete`
			// takes: it is `removeChild` that calls `destroy`
			app.world.removeChildNow(e);

			expect(e.getChildren().length).toBe(0);
			expect(e.pendingSort).toBe(null);
		});

		it("hands its particles back to the pool instead of destroying them", () => {
			// The two tests above pass whether the particles are POOLED or
			// DESTROYED, since both leave the emitter empty. This is the one
			// that tells them apart. `Container#clearChildren` removes a
			// child with no keepalive, which routes to `pool.push`, and a
			// `Particle` has no `className` so the generic pool refuses it
			// and destroys it instead — permanently losing it to
			// `particlePool`, whose `used` count is never decremented.
			const e = burst({
				elevation: Math.PI / 4,
				textureAdditive: false,
				totalParticles: 40,
			});
			const kids = e.getChildren().slice();
			expect(kids).toHaveLength(40);
			const usedWhileAlive = particlePool.used();

			app.world.removeChildNow(e);

			// `Renderable#destroy` nulls `pos`, so a surviving one proves
			// these were recycled rather than torn down
			for (const particle of kids) {
				expect(particle.pos).toBeDefined();
			}
			expect(particlePool.used()).toBe(usedWhileAlive - 40);
		});

		it("leaves no deferred sort to fire after it is gone", async () => {
			const e = burst({ elevation: Math.PI / 4, textureAdditive: false });
			app.world.removeChildNow(e);
			// the defer is a `setTimeout(0)`: give it a turn to not happen.
			// An unhandled throw out of it would be reported by the runner as
			// an error rather than as this test failing, which is exactly how
			// it went unnoticed, so assert on the disarmed handle too.
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			expect(e.pendingSort).toBe(null);
		});
	});
});
