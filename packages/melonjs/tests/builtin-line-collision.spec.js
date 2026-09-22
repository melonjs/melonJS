/**
 * `Line` collision shapes on the built-in solver.
 *
 * Kept in their own file deliberately. These cases let a body fall a long way
 * when the contact is missed, and the built-in world integrates gravity
 * against the global `timer.tick`, so running them alongside other physics
 * specs perturbs what those measure.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Line,
	Rect,
	Renderable,
	Vector2d,
	video,
} from "../src/index.js";

describe("Line collision shapes", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterEach(() => {
		for (const c of app.world.getChildren().slice()) {
			app.world.removeChildNow(c);
		}
	});

	/**
	 * A `Line` is two points and no area, and it is what Tiled emits for every
	 * polyline, so it is the natural way to author a slope or a strip of
	 * ground. The SAT resolves a contact against an axis-aligned segment but
	 * finds none at all against a slanted one, however slowly the body
	 * approaches it.
	 *
	 * The body starts just above the surface on purpose: a zero-thickness
	 * shape is trivially tunnelled through at speed, which is a separate
	 * question from whether the segment collides at all.
	 * @param {Vector2d[]} points - the segment, in ground-local coordinates
	 * @returns {number} the y the body's bottom edge came to rest at
	 */
	const settleOnto = (points) => {
		const ground = new Renderable(0, 200, 400, 200);
		ground.anchorPoint.set(0, 0);
		ground.isKinematic = false;
		ground.alwaysUpdate = true;
		ground.bodyDef = { type: "static", shapes: [new Line(0, 0, points)] };
		app.world.addChild(ground);

		const box = new Renderable(190, 272, 20, 20);
		box.anchorPoint.set(0, 0);
		box.isKinematic = false;
		box.alwaysUpdate = true;
		box.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 20, 20)] };
		app.world.addChild(box);

		for (let i = 0; i < 400; i++) {
			app.world.update(16);
		}
		return box.pos.y + 20;
	};

	it("rests a body on a horizontal Line", () => {
		// the case that already works: segment at local y=100, ground at 200
		expect(
			settleOnto([new Vector2d(0, 100), new Vector2d(400, 100)]),
		).toBeCloseTo(300, 0);
	});

	it("rides a sloped Line rather than passing through it", () => {
		// The solver resolves a sloped contact correctly, but has no surface
		// friction, so the body slides DOWN the incline instead of resting on
		// it. Asserting a resting height would therefore be wrong, and reading
		// the final `y` would be worse: a body that slid off the end of the
		// ramp and one that fell straight through both finish far below and
		// are indistinguishable in that number.
		//
		// What is pinned instead is that it rides the surface: its distance to
		// the slope stays small while its x advances.
		const ground = new Renderable(0, 200, 400, 200);
		ground.anchorPoint.set(0, 0);
		ground.isKinematic = false;
		ground.alwaysUpdate = true;
		ground.bodyDef = {
			type: "static",
			shapes: [new Line(0, 0, [new Vector2d(0, 0), new Vector2d(400, 200)])],
		};
		app.world.addChild(ground);

		const box = new Renderable(100, 180, 20, 20);
		box.anchorPoint.set(0, 0);
		box.isKinematic = false;
		box.alwaysUpdate = true;
		box.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 20, 20)] };
		app.world.addChild(box);

		let startX = 0;
		let worstDepth = 0;
		for (let i = 0; i < 40; i++) {
			app.world.update(16);
			if (i === 10) {
				startX = box.pos.x;
			}
			if (i >= 10) {
				// the segment's height at the body's current x
				const surfaceY = 200 + (box.pos.x + 10) * 0.5;
				worstDepth = Math.max(worstDepth, box.pos.y + 20 - surfaceY);
			}
		}
		// never sank below the surface, and travelled along it
		expect(worstDepth).toBeLessThan(4);
		expect(box.pos.x).toBeGreaterThan(startX + 50);
	});

	// Regression for the multi-shape push-out. The fault was never in `Line`:
	// the same three segments as three separate static bodies held the crate
	// perfectly. `collides()` reports ONE contact per body pair — it returns at
	// the first overlapping shape pair it finds — and the detector's extra-pass
	// loop re-ran exactly that same short-circuiting scan up to three times, so
	// it kept re-resolving the pair it had already resolved (an exact touch,
	// overlap 0.00) while the crate's other corner sank into the neighbouring
	// segment unmeasured.
	//
	// Measured before the fix, with the siblings probed one at a time: the
	// crate rested on the flat arm at overlap 0.00 while its overlap with the
	// down-slope grew 0.22, 1.94, 7.70, 13.45, 18.68 over frames 197-227 — the
	// full rate of its sideways drift, never corrected. At frame 228 the flat
	// arm stopped overlapping, the down-slope was finally the first pair the
	// scan reached, and 18.68px of accumulated penetration was resolved the
	// short way: straight down through the segment, and the crate fell out.
	it("does not sink through a segment it is resting on", () => {
		// A polyline valley, as Tiled would give you: down-slope, flat,
		// up-slope, all on one body. With no surface friction the crate
		// swings from arm to arm, which is expected; what is NOT expected is
		// that it sinks THROUGH an arm while barely moving.
		const ground = new Renderable(0, 380, 180, 80);
		ground.anchorPoint.set(0, 0);
		ground.isKinematic = false;
		ground.alwaysUpdate = true;
		ground.bodyDef = {
			type: "static",
			shapes: [
				new Line(0, 0, [new Vector2d(0, 10), new Vector2d(60, 60)]),
				new Line(0, 0, [new Vector2d(60, 60), new Vector2d(120, 60)]),
				new Line(0, 0, [new Vector2d(120, 60), new Vector2d(180, 10)]),
			],
		};
		app.world.addChild(ground);

		const crate = new Renderable(14, 120, 28, 28);
		crate.anchorPoint.set(0, 0);
		crate.isKinematic = false;
		crate.alwaysUpdate = true;
		crate.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 28, 28)] };
		app.world.addChild(crate);

		// world height of the valley under a given x, or undefined off its span
		const valleyY = (x) => {
			if (x < 0 || x > 180) {
				return undefined;
			}
			if (x < 60) {
				return 390 + x * (50 / 60);
			}
			if (x <= 120) {
				return 440;
			}
			return 440 - (x - 120) * (50 / 60);
		};

		let escapedAt = -1;
		let worstDepth = -Infinity;
		for (let i = 0; i < 300; i++) {
			app.world.update(16);
			// the valley floor is world y=440; well below it means it is out
			if (escapedAt < 0 && crate.pos.y + 28 > 480) {
				escapedAt = i;
			}
			// How far the crate's bottom edge is below the surface UNDER IT.
			// Reading its `y` alone cannot tell riding from falling through:
			// both end up far down the screen. Sampled across the footprint
			// because the two ends sit over different arms at a junction.
			if (i > 60) {
				for (const x of [crate.pos.x, crate.pos.x + 14, crate.pos.x + 28]) {
					const surfaceY = valleyY(x);
					if (surfaceY !== undefined) {
						worstDepth = Math.max(worstDepth, crate.pos.y + 28 - surfaceY);
					}
				}
			}
		}
		expect(escapedAt).toBe(-1);
		// it settled ON the geometry, not inside it
		expect(worstDepth).toBeLessThan(1);
		expect(crate.pos.y + 28).toBeCloseTo(440, 1);
	});
});
