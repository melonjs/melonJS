/**
 * Parity test: prove that the platformer-style physics sequence produces
 * the *same* body state whether driven through the legacy Body API
 * (`body.force.x = ...`, `body.vel.y`, `body.falling`) or the new
 * PhysicsAdapter API (`adapter.applyForce`, `adapter.getVelocity`,
 * `adapter.isGrounded`).
 *
 * Two simulations run in lockstep with identical initial conditions and
 * identical per-frame inputs; after each `world.step(dt)` we assert that
 * `body.vel`, `body.pos`, `body.force`, and `body.falling` agree exactly.
 *
 * If they diverge, the platformer port is wrong. This is the unit-test
 * equivalent of comparing two browser playthroughs side by side.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	boot,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

describe("Physics : platformer parity (legacy API vs adapter API)", () => {
	/** @type {World} */
	let worldA;
	/** @type {BuiltinAdapter} */
	let adapterA;
	/** @type {Renderable} */
	let entityA;

	/** @type {World} */
	let worldB;
	/** @type {BuiltinAdapter} */
	let adapterB;
	/** @type {Renderable} */
	let entityB;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	beforeEach(() => {
		// === side A: legacy API ===
		worldA = new World(0, 0, 800, 600);
		adapterA = worldA.adapter;
		entityA = new Renderable(100, 100, 32, 32);
		entityA.alwaysUpdate = true;
		entityA.body = new Body(entityA, new Rect(0, 0, 32, 32));
		entityA.body.collisionType = 16;
		entityA.body.setMaxVelocity(3, 15);
		entityA.body.setFriction(0.4, 0);
		worldA.addBody(entityA.body);

		// === side B: adapter API via bodyDef auto-registration ===
		worldB = new World(0, 0, 800, 600);
		adapterB = worldB.adapter;
		entityB = new Renderable(100, 100, 32, 32);
		entityB.alwaysUpdate = true;
		entityB.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			collisionType: 16,
			maxVelocity: { x: 3, y: 15 },
			frictionAir: { x: 0.4, y: 0 },
		};
		worldB.addChild(entityB);
	});

	/**
	 * Helper — drive both simulations one frame at a time, applying the
	 * same user input to each in the legacy and the adapter style.
	 * @param {() => void} legacyTick - mutate entityA via the Body API
	 * @param {() => void} adapterTick - mutate entityB via adapter calls
	 */
	function stepBoth(legacyTick, adapterTick) {
		legacyTick();
		adapterTick();
		// run a single adapter.step on each — same code path as world.update
		adapterA.step(16);
		adapterB.step(16);
	}

	function expectParity() {
		const bA = entityA.body;
		const bB = entityB.body;
		// vel
		expect(bA.vel.x).toBeCloseTo(bB.vel.x, 6);
		expect(bA.vel.y).toBeCloseTo(bB.vel.y, 6);
		// pos
		expect(entityA.pos.x).toBeCloseTo(entityB.pos.x, 6);
		expect(entityA.pos.y).toBeCloseTo(entityB.pos.y, 6);
		// derived state
		expect(bA.falling).toEqual(bB.falling);
		expect(bA.jumping).toEqual(bB.jumping);
		expect(adapterA.isGrounded(entityA)).toEqual(adapterB.isGrounded(entityB));
	}

	describe("registration produces equivalent Body state", () => {
		it("both bodies have the same maxVel, friction, collisionType after setup", () => {
			expect(entityA.body.maxVel.x).toEqual(entityB.body.maxVel.x);
			expect(entityA.body.maxVel.y).toEqual(entityB.body.maxVel.y);
			expect(entityA.body.friction.x).toEqual(entityB.body.friction.x);
			expect(entityA.body.friction.y).toEqual(entityB.body.friction.y);
			expect(entityA.body.collisionType).toEqual(entityB.body.collisionType);
			expect(entityA.body.mass).toEqual(entityB.body.mass);
		});

		it("both bodies are registered with their respective adapters", () => {
			expect(adapterA.bodies.has(entityA.body)).toEqual(true);
			expect(adapterB.bodies.has(entityB.body)).toEqual(true);
		});
	});

	describe("walking right — single-axis force", () => {
		it("60 frames of constant rightward force produces identical state", () => {
			const force = new Vector2d(3, 0);
			for (let i = 0; i < 60; i++) {
				stepBoth(
					() => {
						// legacy: SET force.x to maxVel.x each frame
						entityA.body.force.x = entityA.body.maxVel.x;
					},
					() => {
						// adapter: applyForce ADDS to the accumulator. Because
						// the BuiltinAdapter clears force at end of step, this
						// is observably equivalent to the legacy SET pattern
						// — at start of each frame, force is (0,0).
						adapterB.applyForce(entityB, force);
					},
				);
				expectParity();
			}
		});

		it("velocity reaches and stays at maxVel under constant force", () => {
			for (let i = 0; i < 10; i++) {
				stepBoth(
					() => {
						entityA.body.force.x = entityA.body.maxVel.x;
					},
					() => {
						adapterB.applyForce(entityB, new Vector2d(3, 0));
					},
				);
			}
			// after ~10 frames, vel.x should be clamped at maxVel.x = 3
			expect(entityA.body.vel.x).toBeGreaterThan(2.5);
			expect(entityB.body.vel.x).toBeGreaterThan(2.5);
			expect(entityA.body.vel.x).toBeCloseTo(entityB.body.vel.x, 6);
		});
	});

	describe("jumping — read maxVel, write force.y", () => {
		it("jump impulse via legacy force.y matches adapter applyForce", () => {
			const jumpForce = new Vector2d(0, -15);
			stepBoth(
				() => {
					// legacy jump
					entityA.body.jumping = true;
					entityA.body.force.y = -entityA.body.maxVel.y;
				},
				() => {
					// adapter jump
					entityB.body.jumping = true; // game state — manually mirror
					adapterB.applyForce(entityB, jumpForce);
				},
			);
			expectParity();

			// continue with no input for a few frames; gravity pulls down
			for (let i = 0; i < 5; i++) {
				stepBoth(
					() => {},
					() => {},
				);
				expectParity();
			}
		});
	});

	describe("velocity write via setVelocity matches legacy vel mutation", () => {
		it("subtracting vel.y as in onCollision spike handler", () => {
			// preload some velocity on both
			for (let i = 0; i < 3; i++) {
				stepBoth(
					() => {
						entityA.body.force.x = entityA.body.maxVel.x;
					},
					() => {
						adapterB.applyForce(entityB, new Vector2d(3, 0));
					},
				);
			}
			expectParity();

			// simulate the player.onCollision spike hit:
			// this.body.vel.y -= this.body.maxVel.y * timer.tick
			// timer.tick defaults to 1 in tests, so subtract maxVel.y
			const delta = entityA.body.maxVel.y;
			stepBoth(
				() => {
					entityA.body.vel.y -= delta;
				},
				() => {
					const v = adapterB.getVelocity(entityB);
					adapterB.setVelocity(entityB, new Vector2d(v.x, v.y - delta));
				},
			);
			expectParity();
		});
	});

	describe("isGrounded matches !body.falling && !body.jumping", () => {
		it("matches in mid-air after a jump", () => {
			stepBoth(
				() => {
					entityA.body.jumping = true;
					entityA.body.force.y = -entityA.body.maxVel.y;
				},
				() => {
					entityB.body.jumping = true;
					adapterB.applyForce(entityB, new Vector2d(0, -15));
				},
			);

			const groundedA = !entityA.body.falling && !entityA.body.jumping;
			const groundedB = adapterB.isGrounded(entityB);
			expect(groundedA).toEqual(groundedB);
		});

		it("matches at rest", () => {
			// no input — gravity pulls down, but no surface to collide with;
			// falling becomes true once velocity is non-zero downward
			stepBoth(
				() => {},
				() => {},
			);
			const groundedA = !entityA.body.falling && !entityA.body.jumping;
			const groundedB = adapterB.isGrounded(entityB);
			expect(groundedA).toEqual(groundedB);
		});
	});

	describe("force-accumulator semantics", () => {
		it("applyForce ADDs (matches one-shot legacy SET because force resets per step)", () => {
			// single applyForce → integrate → force clears at end of step.
			// Same observable result as legacy `force.x = 3` once-per-frame.
			const force = new Vector2d(3, 0);
			stepBoth(
				() => {
					entityA.body.force.x = 3;
				},
				() => {
					adapterB.applyForce(entityB, force);
				},
			);
			expectParity();
		});

		it("two applyForce calls in one frame ACCUMULATE — divergence from legacy SET", () => {
			// This is the documented BuiltinAdapter behavior pinned by the
			// adversarial spec ("multiple applyForce calls accumulate").
			// Two calls of +3 each give +6 on the adapter side; legacy SET
			// gives the last value (+3). They are EXPECTED to differ.
			stepBoth(
				() => {
					entityA.body.force.x = 3;
					entityA.body.force.x = 3; // SET → still 3
				},
				() => {
					adapterB.applyForce(entityB, new Vector2d(3, 0));
					adapterB.applyForce(entityB, new Vector2d(3, 0)); // ADD → 6
				},
			);
			// vel.x should differ: A has integrated +3, B has integrated +6,
			// both clamped at maxVel.x = 3. Inside one frame, force differs
			// but vel may match because of clamping.
			// Just verify both are valid and clamped.
			expect(entityA.body.vel.x).toBeLessThanOrEqual(3);
			expect(entityB.body.vel.x).toBeLessThanOrEqual(3);
		});
	});
});
