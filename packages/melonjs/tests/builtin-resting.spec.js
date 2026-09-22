import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Rect, Renderable, video } from "../src/index.js";

/**
 * What the built-in solver guarantees when a body comes to rest.
 *
 * It resolves each contact ONCE per step: both bodies are pushed apart by
 * their mass ratio and there is no iteration pass, unlike planck's velocity
 * and position iterations. Two guarantees survive that, and both are pinned
 * here:
 *
 * - a dynamic body resting on STATIC geometry is exact, because the contact
 *   gets the full push-out. This is the platformer case the built-in world
 *   exists for, and it is the half that must never regress, not by a
 *   fraction of a pixel;
 * - a body squeezed between another dynamic body and static geometry does
 *   not end the step inside the static geometry. Its two contacts still
 *   compete within the single pass, but the immovable one gets the casting
 *   vote: see `Body#immovableBlock`.
 *
 * What is NOT guaranteed is the interior of a dynamic pile. A body squeezed
 * between two DYNAMIC bodies has no immovable side to defer to, so the
 * per-pair corrections compete and leave a small standing overlap, bounded
 * by how far gravity moves a body in one step. Stacking piles of dynamic
 * bodies is what the planck and matter adapters are for; the overlap is
 * pinned loosely below, only tightly enough to catch a stack that sinks.
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

	it("keeps a stacked body out of static ground", () => {
		// The squeeze case. Three dynamic boxes settle on the floor; the
		// bottom one has a contact with the floor AND a contact with the box
		// above, and the single pass resolves each exactly once. The floor
		// pushes it out, the box above pushes it back in, and before
		// `Body#immovableBlock` whichever landed last won: the bottom box
		// settled ~16px INSIDE the floor and stayed there, a stable
		// equilibrium rather than a transient.
		//
		// Now the immovable side gets the casting vote, so the bottom box
		// rests exactly where a lone box would.
		const floor = box(0, 360, 400, 40, "static");
		const boxes = [];
		for (let i = 0; i < 3; i++) {
			boxes.push(box(100, 100 - i * 60, 44, 44, "dynamic"));
		}
		settle(900);

		const ys = boxes
			.map((b) => {
				return b.pos.y;
			})
			.sort((a, b) => {
				return a - b;
			});
		const lowest = ys[ys.length - 1];
		// no sink at all: flush with the floor, same as the lone-body case
		expect(lowest).toBe(316);
		expect(lowest + 44).toBe(floor.pos.y);
		// and it is an equilibrium, not a frame it happens to pass through
		settle(120);
		expect(
			Math.max(
				...boxes.map((b) => {
					return b.pos.y;
				}),
			),
		).toBe(316);

		// The interior of the pile is NOT exact — boxes squeezed between two
		// dynamic bodies have no immovable side to defer to. Pinned only
		// loosely, as a bound: no pair may overlap by more than a small
		// fraction of a box, which a sinking stack would blow through.
		for (let i = 0; i < ys.length - 1; i++) {
			const spacing = ys[i + 1] - ys[i];
			expect(spacing).toBeGreaterThan(44 - 4);
			expect(spacing).toBeLessThanOrEqual(44);
		}

		for (const b of boxes) {
			app.world.removeChildNow(b);
		}
		app.world.removeChildNow(floor);
	});

	it("separates a dynamic pair instead of translating it", () => {
		// The detector hands ONE SAT response to both bodies of a pair, and
		// that response is oriented for `response.a`. Read verbatim by both,
		// it moved them the same way — the pair was translated rather than
		// separated, and the two outer-loop visits made them swap places
		// every step. That is what drove a squeezed body into static
		// geometry in the first place, so it is pinned directly: equal
		// masses, no gravity, one step, symmetric separation.
		const a = new Renderable(100, 100, 44, 44);
		a.anchorPoint.set(0, 0);
		a.isKinematic = false;
		a.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 44, 44)] };
		app.world.addChild(a);
		const b = new Renderable(124, 100, 44, 44);
		b.anchorPoint.set(0, 0);
		b.isKinematic = false;
		b.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 44, 44)] };
		app.world.addChild(b);
		a.body.gravityScale = 0;
		b.body.gravityScale = 0;

		// a couple of steps for the broadphase to pick both up, then the
		// pair is resolved in one: 20px of overlap, split evenly and in
		// OPPOSITE directions
		settle(10);
		expect(a.pos.x).toBe(90);
		expect(b.pos.x).toBe(134);
		// and they stay apart rather than leapfrogging
		settle(50);
		expect(a.pos.x).toBe(90);
		expect(b.pos.x).toBe(134);

		app.world.removeChildNow(a);
		app.world.removeChildNow(b);
	});

	it("still honours a pair that opted out of push-out while squeezed", () => {
		// `immovableBlock` is written by an applied correction and read by
		// another, so a pair whose `onCollision` returned false — the
		// one-way-platform idiom — takes part in neither half. The crate
		// falls straight through the slab and lands on the floor, exactly as
		// if the slab were not there, even though a second dynamic body is
		// pressing down on it the whole way.
		const floor = box(0, 360, 400, 40, "static");
		const slab = box(80, 300, 120, 16, "static");
		slab.type = "platform";
		const crate = box(100, 40, 44, 44, "dynamic");
		crate.onCollision = (response, other) => {
			return other.type !== "platform";
		};
		const pusher = box(100, -40, 44, 44, "dynamic");
		settle(700);

		// through the slab and flush with the floor
		expect(crate.pos.y).toBe(316);
		// the pusher, which never opted out, is held up by the slab
		expect(pusher.pos.y).toBe(300 - 44);

		for (const r of [crate, pusher, slab, floor]) {
			app.world.removeChildNow(r);
		}
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
describe("a body whose renderable is not anchored at its corner", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(400, 400, {
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
	 * `anchorPoint` moves where a renderable DRAWS: `updateBounds()` shifts
	 * its bounds by `-size * anchorPoint` and `preDraw` shifts its pixels by
	 * the same amount. The collision shapes have to land in that frame too,
	 * or the hitbox is somewhere the artwork is not.
	 *
	 * Only the `bodyDef` path is in scope. `Entity` sets its own anchor to
	 * (0, 0), as Tiled objects do, so the legacy route never saw this.
	 *
	 * Stated as behaviour, not as shape coordinates: the bottom edge of what
	 * is drawn comes to rest on the floor, whatever the anchor.
	 * @param {number} anchor - anchorPoint on both axes
	 * @param {boolean} [placesItself] - clear `applyAnchorTransform`, the way
	 * a `GLTFModel` and a world-space `Mesh` do
	 */
	const restingDrawnBottom = (anchor, placesItself = false) => {
		const floor = new Renderable(0, 360, 400, 40);
		floor.anchorPoint.set(0, 0);
		floor.isKinematic = false;
		floor.bodyDef = { type: "static", shapes: [new Rect(0, 0, 400, 40)] };
		app.world.addChild(floor);

		const crate = new Renderable(100, 100, 44, 44);
		crate.anchorPoint.set(anchor, anchor);
		crate.applyAnchorTransform = !placesItself;
		crate.isKinematic = false;
		crate.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 44, 44)] };
		app.world.addChild(crate);

		for (let i = 0; i < 400; i++) {
			app.world.update(16);
		}
		// where the bottom of the artwork ended up. A renderable that has
		// opted out of the anchor draws from `pos` whatever its anchor says,
		// so its own drawn bottom is a full height below `pos`.
		const drawnTop = placesItself ? 0 : crate.height * crate.anchorPoint.y;
		return crate.pos.y - drawnTop + crate.height;
	};

	it("rests on the floor when anchored at its corner", () => {
		// the control: this is the case that has always worked
		expect(restingDrawnBottom(0)).toBeCloseTo(360, 6);
	});

	it("rests on the floor when centred on its position", () => {
		expect(restingDrawnBottom(0.5)).toBeCloseTo(360, 6);
	});

	it("rests on the floor when anchored at its bottom edge", () => {
		// the platformer anchor: feet on the ground
		expect(restingDrawnBottom(1)).toBeCloseTo(360, 6);
	});

	it("ignores the anchor on a renderable that places itself", () => {
		// `applyAnchorTransform === false` is a renderable saying it draws at
		// `pos` and pivots about its own origin, which is what `preDraw`
		// reads and what `GLTFModel` and a `Camera3d`-space `Mesh` set. Its
		// `anchorPoint` still holds the default (0.5, 0.5) and means nothing,
		// so reading it here put the body half a bounds box off the artwork.
		expect(restingDrawnBottom(0.5, true)).toBeCloseTo(360, 6);
	});
});

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

describe("a body pinned against immovable geometry by a dynamic one", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(600, 600, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	// in afterEach, not at the end of each test: an assertion that fails
	// throws, so a cleanup written inline never runs, and the leftover bodies
	// shield the next test from the very defect it exists to catch
	afterEach(() => {
		for (const c of app.world.getChildren().slice()) {
			app.world.removeChildNow(c);
		}
	});

	/**
	 * @param {number} x - left edge
	 * @param {number} y - top edge
	 * @param {number} w - width
	 * @param {number} h - height
	 * @param {string} type - "static" or "dynamic"
	 * @param {number} [mass] - overrides the default mass
	 * @returns {Renderable} the body's renderable, in the world
	 */
	const box = (x, y, w, h, type, mass) => {
		const r = new Renderable(x, y, w, h);
		r.anchorPoint.set(0, 0);
		r.isKinematic = false;
		r.alwaysUpdate = true;
		// no gravity: the horizontal axis has nothing playing gravity's part,
		// which is exactly what made this case different from a floor
		r.bodyDef = {
			type,
			shapes: [new Rect(0, 0, w, h)],
			gravityScale: 0,
		};
		app.world.addChild(r);
		if (mass !== undefined) {
			r.body.mass = mass;
		}
		return r;
	};

	/**
	 * @param {Renderable} pusher - the body driven into the victim
	 * @param {number} force - horizontal force per step
	 * @param {number} steps - how many steps to run
	 * @param {Renderable} victim - the body to watch
	 * @returns {number} the deepest x the victim reached
	 */
	const shove = (pusher, force, steps, victim) => {
		let worst = victim.pos.x;
		for (let i = 0; i < steps; i++) {
			pusher.body.force.x = force;
			app.world.update(16);
			worst = Math.max(worst, victim.pos.x);
		}
		return worst;
	};

	it("is not driven into a wall it is resting flush against", () => {
		// The record of "immovable geometry is on that side" is keyed on the
		// contact NORMAL, not the MTV, because SAT reports a pair resting
		// exactly flush as colliding with an overlap of zero: the MTV is then
		// (0, 0) while the normal is intact. Keyed on the MTV, this body wrote
		// no record and the push drove it inside the wall on every other step,
		// for ever. Gravity masks this vertically by re-creating a sub-pixel
		// overlap each step; nothing does that horizontally.
		box(300, 0, 40, 600, "static");
		const victim = box(256, 300, 44, 44, "dynamic");
		const pusher = box(180, 300, 44, 44, "dynamic", 50);

		// force 2, not a large one: the pusher has to stay in CONTACT for the
		// defect to be reachable. Anything past ~32 here moves the pusher
		// further than its own width in a single step, so it tunnels clean
		// past the victim and the scenario never happens. Keyed on the MTV
		// this reached 265.80, ten pixels inside a forty-pixel wall.
		expect(shove(pusher, 2, 200, victim)).toBe(256);
	});

	it("is not driven through thin geometry by a heavy body", () => {
		// the tail of the same defect. Nothing here is thickness-dependent in
		// the solver; what thin geometry changes is the CONSEQUENCE, since an
		// excursion larger than the wall puts the body clean through it.
		box(300, 0, 8, 600, "static");
		const victim = box(256, 300, 44, 44, "dynamic");
		const pusher = box(180, 300, 44, 44, "dynamic", 50);

		// same defect, thinner geometry: keyed on the MTV the victim reached
		// 271.69, which is further out than this wall is thick, so it spent
		// whole frames on the far side of it.
		expect(shove(pusher, 8, 200, victim)).toBe(256);
	});

	it("releases a body the moment the geometry pinning it is gone", () => {
		// The record is cleared in a pass of its own, before any body is
		// simulated. Cleared at the head of the simulation loop instead, a
		// body simulated EARLY reads the records of the bodies the loop has
		// not reached yet, and those still hold the PREVIOUS step's value.
		//
		// The pusher is added first deliberately: it has to be simulated
		// before the crate for that stale read to be the one deciding the
		// step. Reordering these three lines defuses the test.
		const pusher = box(312, 300, 44, 44, "dynamic", 50);
		const wall = box(400, 0, 40, 600, "static");
		const crate = box(356, 300, 44, 44, "dynamic");

		// pinned: shoved hard against the wall for a hundred steps and never
		// driven into it
		expect(shove(pusher, 2, 100, crate)).toBe(356);

		// now take the wall away
		app.world.removeChildNow(wall);
		pusher.body.force.x = 2;
		app.world.update(16);

		// and the crate has to move on the very next step. Off a stale
		// record it stood still for a frame, deferring to a wall that was no
		// longer there.
		expect(crate.pos.x).toBeGreaterThan(356);
	});
});
