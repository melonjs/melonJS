/**
 * `isGrounded()` on the built-in solver for bodies that sink a pixel or more
 * per step.
 *
 * The bug: `Body#respondToCollision` decided the falling / jumping flags with
 * `falling = mtvY >= dir` (`dir` being 1 for a falling body). Under gravity a
 * body is `falling` at the start of every contact, and the floor push-out of a
 * body resting on it is exactly what it sank that step —
 * `mass * gravity * gravityScale * timer.tick`, 0.98 at the defaults. Anything
 * that sank 1px or more (gravity >= ~1.02, mass >= ~1.03, a low frame rate
 * where `timer.tick > 1`, or a floor moving up under it) stayed `falling`
 * forever while sitting flush on the floor, so `isGrounded()` was `false` and
 * a platformer actor could never jump.
 *
 * The fix decides from the DIRECTION of the push-out, not its size: pushed up
 * out of a floor is a landing, pushed down by a ceiling on the way up ends the
 * jump.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	boot,
	collision,
	Polygon,
	Rect,
	Renderable,
	timer,
	video,
	World,
} from "../src/index.js";

describe("Body : grounded state does not depend on how far a body sinks", () => {
	let app;
	let world;
	let savedTick;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	afterEach(() => {
		if (savedTick !== undefined) {
			timer.tick = savedTick;
			savedTick = undefined;
		}
	});

	// gravity is integrated against the global `timer.tick`, which the
	// application's own loop rewrites between tests: pin it for each run
	const setTick = (tick) => {
		if (savedTick === undefined) {
			savedTick = timer.tick;
		}
		timer.tick = tick;
	};

	const box = (x, y, w, h, isStatic, settings = {}) => {
		const r = new Renderable(x, y, w, h);
		r.anchorPoint.set(0, 0);
		r.isKinematic = false;
		r.alwaysUpdate = true;
		r.body = new Body(r, settings.shape ?? new Rect(0, 0, w, h));
		r.body.collisionType = isStatic
			? collision.types.WORLD_SHAPE
			: collision.types.PLAYER_OBJECT;
		r.body.isStatic = isStatic;
		if (settings.mass !== undefined) {
			r.body.setMass(settings.mass);
		}
		if (settings.gravityScale !== undefined) {
			r.body.gravityScale = settings.gravityScale;
		}
		r.body.setMaxVelocity(20, 20);
		world.addChild(r);
		return r;
	};

	const newWorld = (gravityY = 0.98) => {
		world = new World(0, 0, 800, 600);
		world.adapter.gravity.set(0, gravityY);
		return world;
	};

	const grounded = (r) => {
		return world.adapter.isGrounded(r);
	};

	const settle = (r, steps) => {
		// returns how many of the LAST ten steps reported the body grounded
		let groundedSteps = 0;
		for (let i = 0; i < steps; i++) {
			world.update(16);
			if (i >= steps - 10 && grounded(r)) {
				groundedSteps++;
			}
		}
		return groundedSteps;
	};

	describe("a crate resting flush on a static floor is grounded", () => {
		const cases = [
			{ name: "defaults (sinks 0.98px / step)", gravity: 0.98 },
			{ name: "gravity 1.5", gravity: 1.5 },
			{ name: "gravity 5", gravity: 5 },
			{ name: "mass 2 (heavy)", gravity: 0.98, mass: 2 },
			{ name: "mass 0.5 (light)", gravity: 0.98, mass: 0.5 },
			{ name: "gravityScale 3", gravity: 0.98, gravityScale: 3 },
			{ name: "30 fps (timer.tick 2)", gravity: 0.98, tick: 2 },
			{ name: "20 fps, gravity 1.5 (tick 3)", gravity: 1.5, tick: 3 },
		];
		for (const c of cases) {
			it(c.name, () => {
				setTick(c.tick ?? 1);
				newWorld(c.gravity);
				box(0, 360, 800, 40, true);
				const crate = box(100, 200, 44, 44, false, {
					mass: c.mass,
					gravityScale: c.gravityScale,
				});
				const groundedSteps = settle(crate, 200);
				// it really is resting on the floor...
				expect(crate.pos.y).toBeCloseTo(316, 6);
				// ...and says so on every step, not on some of them
				expect(crate.body.falling).toBe(false);
				expect(crate.body.jumping).toBe(false);
				expect(groundedSteps).toBe(10);
			});
		}
	});

	it("a crate in mid-air is not grounded", () => {
		setTick(1);
		newWorld(1.5);
		box(0, 560, 800, 40, true);
		const crate = box(100, 0, 44, 44, false);
		world.update(16);
		world.update(16);
		expect(crate.body.falling).toBe(true);
		expect(grounded(crate)).toBe(false);
	});

	it("a crate riding a floor that moves up is grounded", () => {
		// the push-out is the sink PLUS the platform's own rise, so this was
		// over 1px even at the default gravity
		setTick(1);
		newWorld(0.98);
		const lift = box(0, 400, 200, 20, true);
		const crate = box(50, 356, 44, 44, false);
		let groundedSteps = 0;
		for (let i = 0; i < 30; i++) {
			lift.pos.y -= 2;
			world.update(16);
			if (i >= 5 && grounded(crate)) {
				groundedSteps++;
			}
		}
		// carried with the lift, flush on top of it
		expect(crate.pos.y + 44).toBeCloseTo(lift.pos.y, 6);
		expect(groundedSteps).toBe(25);
	});

	it("a crate sliding down a wall is not grounded (heavy gravity)", () => {
		setTick(1);
		newWorld(1.5);
		box(300, 0, 40, 600, true);
		const crate = box(257, 0, 44, 44, false);
		for (let i = 0; i < 20; i++) {
			// pressing into the wall every step
			crate.body.force.x = 3;
			world.update(16);
			expect(grounded(crate)).toBe(false);
		}
		// it did touch the wall: pushed back out flush with its face
		expect(crate.pos.x + 44).toBeCloseTo(300, 6);
		expect(crate.body.falling).toBe(true);
	});

	it("a body jumping into a ceiling stops rising and falls", () => {
		setTick(1);
		newWorld(1.5);
		box(0, 100, 800, 20, true);
		const crate = box(100, 130, 44, 44, false);
		crate.body.vel.y = -15;
		crate.body.jumping = true;
		world.update(16);
		// the head hit the ceiling: no longer moving up, no longer jumping,
		// and not grounded
		expect(crate.pos.y).toBeCloseTo(120, 6);
		expect(crate.body.vel.y).toBeGreaterThanOrEqual(0);
		expect(crate.body.jumping).toBe(false);
		expect(crate.body.falling).toBe(true);
		expect(grounded(crate)).toBe(false);
	});

	it("a stack of two heavy crates is grounded top and bottom", () => {
		setTick(1);
		newWorld(1.5);
		box(0, 360, 800, 40, true);
		const bottom = box(100, 272, 44, 44, false, { mass: 2 });
		const top = box(100, 200, 44, 44, false, { mass: 2 });
		let bothGrounded = 0;
		for (let i = 0; i < 200; i++) {
			world.update(16);
			if (i >= 190 && grounded(bottom) && grounded(top)) {
				bothGrounded++;
			}
		}
		expect(bottom.body.falling).toBe(false);
		expect(top.body.falling).toBe(false);
		expect(bothGrounded).toBe(10);
	});

	it("a crate on a slope is grounded while it rides it (heavy gravity)", () => {
		setTick(1);
		newWorld(1.5);
		// a gentle static ramp, rising to the right: from (0, 500) to (600, 400)
		const ramp = new Renderable(0, 0, 600, 500);
		ramp.anchorPoint.set(0, 0);
		ramp.isKinematic = false;
		ramp.alwaysUpdate = true;
		ramp.body = new Body(
			ramp,
			new Polygon(0, 0, [
				{ x: 0, y: 500 },
				{ x: 600, y: 400 },
				{ x: 600, y: 500 },
			]),
		);
		ramp.body.collisionType = collision.types.WORLD_SHAPE;
		ramp.body.isStatic = true;
		world.addChild(ramp);
		const crate = box(400, 300, 30, 30, false);
		let onRamp = 0;
		let groundedOnRamp = 0;
		for (let i = 0; i < 120; i++) {
			world.update(16);
			// surface height under the crate's bottom-right corner
			const right = crate.pos.x + 30;
			const surfaceY = 500 - (right / 600) * 100;
			if (right > 0 && Math.abs(crate.pos.y + 30 - surfaceY) < 3) {
				onRamp++;
				if (grounded(crate)) {
					groundedOnRamp++;
				}
			}
		}
		expect(onRamp).toBeGreaterThan(20);
		expect(groundedOnRamp).toBe(onRamp);
	});

	describe("respondToCollision flags, one contact at a time", () => {
		// a duck-typed response, as `respondToCollision` documents: this body
		// escapes along -overlapV
		const contact = (mtvY) => {
			return {
				overlapV: { x: 0, y: mtvY },
				overlapN: { x: 0, y: Math.sign(mtvY) },
				overlap: Math.abs(mtvY),
			};
		};
		const lone = () => {
			const r = new Renderable(0, 0, 10, 10);
			r.anchorPoint.set(0, 0);
			r.body = new Body(r, new Rect(0, 0, 10, 10));
			return r;
		};

		for (const sink of [0.5, 0.98, 1, 1.5, 4, 15]) {
			it(`a falling body pushed up by ${sink}px has landed`, () => {
				const r = lone();
				r.body.falling = true;
				r.body.vel.y = sink;
				r.body.respondToCollision(contact(sink));
				expect(r.body.falling).toBe(false);
				expect(r.body.jumping).toBe(false);
				expect(r.body.vel.y).toBe(0);
			});
		}

		it("a rising, jumping body pushed up (a ledge it leaves) stays airborne", () => {
			const r = lone();
			r.body.jumping = true;
			r.body.vel.y = -5;
			r.body.respondToCollision(contact(2));
			expect(r.body.jumping).toBe(true);
			expect(r.body.falling || r.body.jumping).toBe(true);
		});

		it("a rising body without the jump flag pushed up stays airborne", () => {
			const r = lone();
			r.body.vel.y = -5;
			r.body.respondToCollision(contact(2));
			expect(r.body.falling).toBe(true);
		});

		for (const push of [0.5, 1, 4]) {
			it(`a jumping body pushed down by a ceiling (${push}px) falls`, () => {
				const r = lone();
				r.body.jumping = true;
				r.body.vel.y = -10;
				r.body.respondToCollision(contact(-push));
				expect(r.body.jumping).toBe(false);
				expect(r.body.falling).toBe(true);
				expect(r.body.vel.y).toBe(0);
			});
		}

		it("a standing body touched from above keeps its ground state", () => {
			const r = lone();
			r.body.falling = false;
			r.body.jumping = false;
			r.body.vel.y = 0;
			r.body.respondToCollision(contact(-1.5));
			expect(r.body.falling).toBe(false);
			expect(r.body.jumping).toBe(false);
		});

		it("a side contact does not touch the flags", () => {
			const r = lone();
			r.body.falling = true;
			r.body.vel.y = 3;
			r.body.respondToCollision({
				overlapV: { x: 2, y: 0 },
				overlapN: { x: 1, y: 0 },
				overlap: 2,
			});
			expect(r.body.falling).toBe(true);
		});

		it("a body ignoring gravity keeps its flags", () => {
			const r = lone();
			r.body.gravityScale = 0;
			r.body.falling = true;
			r.body.vel.y = 3;
			r.body.respondToCollision(contact(3));
			expect(r.body.falling).toBe(true);
		});
	});
});
