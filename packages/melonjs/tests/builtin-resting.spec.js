import { beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Rect, Renderable, video } from "../src/index.js";

/**
 * What the built-in solver guarantees when a body comes to rest.
 *
 * It resolves each contact ONCE per step: both bodies are pushed apart by
 * their mass ratio and there is no iteration pass, unlike planck's velocity
 * and position iterations. That has a sharp consequence worth pinning,
 * because the two halves of it pull in opposite directions:
 *
 * - a dynamic body resting on STATIC geometry is exact, because the contact
 *   gets the full push-out. This is the platformer case the built-in world
 *   exists for, and it is the half that must never regress;
 * - a body squeezed BETWEEN two contacts is not, because the per-pair
 *   corrections compete within the single pass. Stacking piles of dynamic
 *   bodies is what the planck and matter adapters are for.
 *
 * The second half is deliberately pinned loosely: the exact resting overlap
 * is an artefact of resolution order, and freezing it would be freezing a
 * wart. What is pinned is that it stays bounded, so a regression that let a
 * stack sink through the floor would still be caught.
 */
describe("built-in solver resting behaviour", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(400, 400, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	/**
	 * @param {number} x - left edge
	 * @param {number} y - top edge
	 * @param {number} w - width
	 * @param {number} h - height
	 * @param {string} type - "static" or "dynamic"
	 * @returns {Renderable} the body's renderable, already in the world
	 */
	const box = (x, y, w, h, type) => {
		const r = new Renderable(x, y, w, h);
		r.anchorPoint.set(0, 0);
		r.isKinematic = false;
		r.bodyDef = { type, shapes: [new Rect(0, 0, w, h)] };
		app.world.addChild(r);
		return r;
	};

	/**
	 * @param {number} steps - how many 16ms steps to run
	 */
	const settle = (steps) => {
		for (let i = 0; i < steps; i++) {
			app.world.update(16);
		}
	};

	it("rests a dynamic body exactly on static ground", () => {
		// the platformer case: one body, one contact, full push-out. A
		// 44-tall box on a floor whose top edge is 360 rests at exactly 316,
		// with no sink and no hover.
		const floor = box(0, 360, 400, 40, "static");
		const crate = box(100, 40, 44, 44, "dynamic");
		settle(400);

		expect(crate.pos.y).toBe(316);
		expect(crate.pos.y + crate.height).toBe(floor.pos.y);

		app.world.removeChildNow(crate);
		app.world.removeChildNow(floor);
	});

	it("sinks a stacked body into static ground, but never through it", () => {
		// Three dynamic boxes squeezed together overlap each other AND drive
		// the bottom one into the floor: the box above pushes it down by half
		// the overlap, the floor pushes it back up next step, and gravity
		// re-adds the difference, so the single pass settles on a standing
		// sink of roughly 16px rather than resolving it. That is the
		// documented limit of a solver with no iteration pass; stacking piles
		// of dynamic bodies is what the planck and matter adapters are for.
		//
		// The exact depth is an artefact of resolution order and is NOT
		// pinned. What is pinned is the boundary that would actually break a
		// game: the body stays inside the ground it rests on instead of
		// passing out the bottom of it.
		const floor = box(0, 360, 400, 40, "static");
		const boxes = [];
		for (let i = 0; i < 3; i++) {
			boxes.push(box(100, 100 - i * 60, 44, 44, "dynamic"));
		}
		settle(900);

		const lowest = Math.max(
			...boxes.map((b) => {
				return b.pos.y;
			}),
		);
		// it sinks, but by less than half its own height...
		expect(lowest).toBeGreaterThan(316);
		expect(lowest).toBeLessThan(316 + 22);
		// ...and never leaves the floor's underside, which would be tunnelling
		expect(lowest + 44).toBeLessThanOrEqual(floor.pos.y + floor.height);

		for (const b of boxes) {
			app.world.removeChildNow(b);
		}
		app.world.removeChildNow(floor);
	});
});

/**
 * `preDraw` applies the anchor offset even when `autoTransform` is off.
 *
 * The two are independent, and the combination is a silent-failure trap: a
 * custom `draw()` that reads `this.pos` and turns `autoTransform` off (because
 * something else already owns the orientation, as a physics readback does)
 * still has the normalized anchor offset applied underneath it, and renders
 * half its own size away from where it is. Nothing throws.
 */
describe("preDraw anchor offset", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(200, 200, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	/**
	 * @param {Renderable} r - the renderable to pre-draw
	 * @returns {number[]} the translate calls preDraw made, flattened
	 */
	const translationsDuringPreDraw = (r) => {
		const calls = [];
		const renderer = app.renderer;
		const real = renderer.translate.bind(renderer);
		renderer.translate = (x, y) => {
			calls.push(x, y);
			return real(x, y);
		};
		renderer.save();
		r.preDraw(renderer);
		renderer.restore();
		renderer.translate = real;
		return calls;
	};

	it("offsets by the anchor with autoTransform off", () => {
		const r = new Renderable(10, 20, 80, 80);
		r.autoTransform = false;
		// the default anchor is centred, so the offset is half the size
		expect(translationsDuringPreDraw(r)).toEqual([-40, -40]);
	});

	it("does not offset once the anchor is zeroed", () => {
		// what a custom draw reading `this.pos` must do
		const r = new Renderable(10, 20, 80, 80);
		r.autoTransform = false;
		r.anchorPoint.set(0, 0);
		expect(translationsDuringPreDraw(r)).toEqual([-0, -0]);
	});

	it("skips the offset entirely when the renderable places itself", () => {
		const r = new Renderable(10, 20, 80, 80);
		r.autoTransform = false;
		r.applyAnchorTransform = false;
		expect(translationsDuringPreDraw(r)).toEqual([]);
	});
});
