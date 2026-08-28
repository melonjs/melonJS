import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	ParticleEmitter,
	Vector2d,
	video,
} from "../src/index.js";

/**
 * Particle bounds are computed lazily.
 *
 * A `Renderable` refreshes its bounds from a callback fired on every `pos`
 * assignment, which is right for a scene object and wrong for a particle:
 * `Particle.update` writes `pos.x` and `pos.y` separately, so the callback
 * fired twice per particle per frame — and both runs happened BEFORE
 * `currentTransform` was rebuilt, deriving bounds from the previous frame's
 * matrix and then discarding them. Measured, that redundant pass was about two
 * thirds of the whole particle update loop.
 *
 * A particle now invalidates on write and recomputes on read. These tests pin
 * both halves of that: that the laziness is real (no eager recompute), and
 * that nothing which READS bounds can tell the difference.
 */
describe("particle bounds", () => {
	let app;

	beforeEach(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			renderer: video.CANVAS,
			subPixel: true,
		});
		await app.init();
	});

	afterEach(() => {
		app?.destroy();
	});

	const emitterWith = (settings = {}) => {
		const emitter = new ParticleEmitter(200, 150, {
			width: 0,
			height: 0,
			totalParticles: 3,
			maxParticles: 3,
			minLife: 100000,
			maxLife: 100000,
			speed: 4,
			speedVariation: 0,
			angle: 0,
			angleVariation: 0,
			gravity: 0,
			wind: 0,
			minStartScale: 1,
			maxStartScale: 1,
			minEndScale: 1,
			maxEndScale: 1,
			...settings,
		});
		app.world.addChild(emitter);
		return emitter;
	};

	/** where the transform actually places the particle's centre */
	const drawnCentre = (particle) => {
		const v = new Vector2d(particle.width / 2, particle.height / 2);
		particle.currentTransform.apply(v);
		const anc = particle.ancestor.getAbsolutePosition();
		return { x: v.x + anc.x, y: v.y + anc.y };
	};

	// ------------------------------------------------------------------
	// the laziness itself
	// ------------------------------------------------------------------

	it("does not recompute bounds when the position is written", () => {
		// the whole point: two writes per frame used to mean two full
		// recomputes, both from a matrix that had not been rebuilt yet
		const emitter = emitterWith();
		emitter.burstParticles();
		const particle = emitter.getChildren()[0];
		particle.getBounds(); // settle any pending refresh

		const spy = vi.spyOn(particle, "updateBounds");
		particle.pos.x += 10;
		particle.pos.y += 10;

		expect(
			spy,
			"position write triggered an eager recompute",
		).not.toHaveBeenCalled();
		expect(particle._boundsDirty, "write did not invalidate").toBe(true);
		spy.mockRestore();
	});

	it("recomputes once on read, then not again until it moves", () => {
		const emitter = emitterWith();
		emitter.burstParticles();
		const particle = emitter.getChildren()[0];
		particle.pos.x += 10;

		const spy = vi.spyOn(particle, "updateBounds");
		particle.getBounds();
		particle.getBounds();
		particle.getBounds();

		expect(spy, "reads should collapse to one recompute").toHaveBeenCalledTimes(
			1,
		);
		spy.mockRestore();
	});

	it("still marks the renderable dirty on a position write", () => {
		// the replaced callback did two things; only the expensive half went
		const emitter = emitterWith();
		emitter.burstParticles();
		const particle = emitter.getChildren()[0];
		particle.isDirty = false;

		particle.pos.x += 1;

		expect(particle.isDirty).toBe(true);
	});

	// ------------------------------------------------------------------
	// nothing that reads bounds can tell
	// ------------------------------------------------------------------

	it("reports bounds on the drawn position after moving", () => {
		const emitter = emitterWith();
		emitter.burstParticles();
		const particle = emitter.getChildren()[0];

		for (let i = 0; i < 5; i++) {
			emitter.update(16);
		}

		const centre = drawnCentre(particle);
		const bounds = particle.getBounds();
		expect(bounds.centerX).toBeCloseTo(centre.x, 3);
		expect(bounds.centerY).toBeCloseTo(centre.y, 3);
	});

	it("keeps updateBounds() eager for callers that use its return value", () => {
		// Container.updateBounds aggregates child bounds through the RETURN of
		// child.updateBounds() under enableChildBoundsUpdate. Deferring there
		// would have fed it stale values.
		const emitter = emitterWith();
		emitter.burstParticles();
		const particle = emitter.getChildren()[0];
		emitter.update(16);

		particle.pos.x += 500;
		const returned = particle.updateBounds();

		expect(particle._boundsDirty, "explicit recompute left it dirty").toBe(
			false,
		);
		expect(returned.centerX).toBeCloseTo(particle.getBounds().centerX, 3);
	});

	it("aggregates correct child bounds under enableChildBoundsUpdate", () => {
		// the interaction that made overriding updateBounds the wrong lever
		const emitter = emitterWith();
		emitter.enableChildBoundsUpdate = true;
		emitter.burstParticles();
		for (let i = 0; i < 6; i++) {
			emitter.update(16);
		}

		const aggregate = emitter.updateBounds();
		for (const particle of emitter.getChildren()) {
			const b = particle.getBounds();
			expect(aggregate.left).toBeLessThanOrEqual(b.left + 0.001);
			expect(aggregate.right).toBeGreaterThanOrEqual(b.right - 0.001);
		}
	});

	it("culls on bounds that reflect where the particle actually is", () => {
		const emitter = emitterWith();
		emitter.burstParticles();
		const particle = emitter.getChildren()[0];

		particle.pos.set(9000, 9000);
		emitter.update(16);
		app.world.update(16);

		expect(particle.inViewport, "off-screen particle stayed visible").toBe(
			false,
		);
	});

	// ------------------------------------------------------------------
	// lifecycle
	// ------------------------------------------------------------------

	it("re-installs the cheap callback on a pooled particle", () => {
		// a recycled instance could otherwise come back carrying the eager
		// callback and quietly lose the optimisation
		const first = emitterWith({ minLife: 20, maxLife: 20 });
		first.burstParticles();
		for (let i = 0; i < 4; i++) {
			first.update(30);
		}
		expect(first.getChildren().length).toBe(0);

		const second = emitterWith();
		second.burstParticles();
		const particle = second.getChildren()[0];
		particle.getBounds();

		const spy = vi.spyOn(particle, "updateBounds");
		particle.pos.x += 5;
		expect(spy, "recycled particle recomputed eagerly").not.toHaveBeenCalled();
		expect(particle._boundsDirty).toBe(true);
		spy.mockRestore();
	});

	it("survives construction, where updateBounds runs before field init", () => {
		// `Polygon.setVertices` reaches updateBounds() from the base
		// constructor chain, before a subclass's field initializers exist —
		// which is why the flag cannot be a #private field
		expect(() => {
			const emitter = emitterWith();
			emitter.burstParticles();
			emitter.getChildren()[0].getBounds();
		}).not.toThrow();
	});

	it("gives the same bounds with accurateBounds on or off", () => {
		// the setting used to trade accuracy for speed; bounds are now always
		// current, so it is inert and documented as deprecated
		const measure = (accurateBounds) => {
			const emitter = emitterWith({ accurateBounds });
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			for (let i = 0; i < 4; i++) {
				emitter.update(16);
			}
			const b = particle.getBounds();
			const result = { x: b.centerX, y: b.centerY, w: b.width };
			app.world.removeChildNow(emitter);
			return result;
		};

		const off = measure(false);
		const on = measure(true);
		expect(on.x).toBeCloseTo(off.x, 3);
		expect(on.y).toBeCloseTo(off.y, 3);
		expect(on.w).toBeCloseTo(off.w, 3);
	});

	// ------------------------------------------------------------------
	// extent
	// ------------------------------------------------------------------

	describe("extent", () => {
		it("encloses every corner of the rotated quad", () => {
			// culling must never discard something still on screen, so the box
			// has to contain the transformed quad whatever its rotation
			const emitter = emitterWith({
				minRotation: 0.7,
				maxRotation: 0.7,
				minStartScale: 1.8,
				maxStartScale: 1.8,
				minEndScale: 1.8,
				maxEndScale: 1.8,
			});
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			emitter.update(16);

			const bounds = particle.getBounds();
			const anc = particle.ancestor.getAbsolutePosition();
			const w = particle.width;
			const h = particle.height;

			for (const [cx, cy] of [
				[0, 0],
				[w, 0],
				[0, h],
				[w, h],
			]) {
				const corner = new Vector2d(cx, cy);
				particle.currentTransform.apply(corner);
				const px = corner.x + anc.x;
				const py = corner.y + anc.y;
				expect(px, `corner ${cx},${cy} outside left`).toBeGreaterThanOrEqual(
					bounds.left - 0.001,
				);
				expect(px, `corner ${cx},${cy} outside right`).toBeLessThanOrEqual(
					bounds.right + 0.001,
				);
				expect(py, `corner ${cx},${cy} outside top`).toBeGreaterThanOrEqual(
					bounds.top - 0.001,
				);
				expect(py, `corner ${cx},${cy} outside bottom`).toBeLessThanOrEqual(
					bounds.bottom + 0.001,
				);
			}
		});

		it("scales its extent with the particle", () => {
			// the only per-frame term in the radius
			const make = (scale) => {
				const emitter = emitterWith({
					minStartScale: scale,
					maxStartScale: scale,
					minEndScale: scale,
					maxEndScale: scale,
				});
				emitter.burstParticles();
				emitter.update(16);
				const width = emitter.getChildren()[0].getBounds().width;
				app.world.removeChildNow(emitter);
				return width;
			};

			expect(make(2)).toBeCloseTo(make(1) * 2, 3);
		});
	});
});
