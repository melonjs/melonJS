/**
 * melonJS — Platformer (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	audio,
	type CollisionResponse,
	collision,
	input,
	level,
	type PhysicsAdapter,
	Rect,
	type Renderable,
	Sprite,
	Vector2d,
	video,
} from "melonjs";
import { LAND_TOLERANCE, oneWayPlatforms } from "../createGame";
import { gameState } from "../gameState";

const MAX_VEL_X = 3;
const MAX_VEL_Y = 20;
// Matter-idiomatic platformer tuning:
//   WALK_FORCE — applied each frame the direction key is held. Body
//       accelerates under matter's force/mass*dt² integration; top speed
//       is bounded by the adapter's maxVelocity clamp.
//   JUMP_VEL  — instant upward velocity on press (Body.setVelocity is the
//       Matter pattern for "impulse"; applyForce is for sustained forces).
//       One key press = one full-strength jump, matching the legacy SAT
//       platformer behaviour (no hold-to-extend mechanic). Set to
//       MAX_VEL_Y so the impulse delivers the same peak vertical speed
//       the legacy SAT version reached via `force.y = -maxVel.y`.
const WALK_FORCE = 0.012;
// Tuned slightly below MAX_VEL_Y so the arc apex matches the legacy SAT
// platformer's feel. Setting it equal to MAX_VEL_Y produced a noticeably
// higher jump because matter's gravity decelerates more slowly than the
// legacy fixed-step integrator on the way up.
const JUMP_VEL = 18;

export class PlayerEntity extends Sprite {
	dying: boolean;
	jumping: boolean;
	multipleJump: number;
	// scratch vectors reused every frame. `body.applyForce(x, y)` and
	// `body.setVelocity(x, y)` take primitives so no scratch is needed
	// for those; only `body.getVelocity(out)` and `adapter.setPosition(v)`
	// require Vector2d arguments.
	private scratchVel = new Vector2d();
	private scratchPos = new Vector2d();
	// cached adapter reference for the few queries that have no body-level
	// equivalent (isGrounded, setPosition). Set in onActivateEvent.
	private adapter!: PhysicsAdapter;

	constructor(x, y, settings) {
		// create the sprite using atlas animation frames
		super(x, y, {
			...gameState.texture.getAnimationSettings([
				"walk0001.png",
				"walk0002.png",
				"walk0003.png",
				"walk0004.png",
				"walk0005.png",
				"walk0006.png",
				"walk0007.png",
				"walk0008.png",
				"walk0009.png",
				"walk0010.png",
				"walk0011.png",
			]),
			anchorPoint: { x: 0, y: 0 },
		});

		// declare the physics body in engine-portable terms.
		// Container.addChild auto-registers this with world.adapter when
		// the entity is added to the world tree.
		this.bodyDef = {
			type: "dynamic",
			shapes: [
				new Rect(
					(this.width - settings.width) / 2,
					this.height - settings.height,
					settings.width,
					settings.height,
				),
			],
			collisionType: collision.types.PLAYER_OBJECT,
			maxVelocity: { x: MAX_VEL_X, y: MAX_VEL_Y },
			// scalar frictionAir — matter-native form. Low so the jump arc
			// isn't aggressively damped on the Y axis; horizontal stop-feel
			// comes from `applyForce` only being applied while the key is
			// held, plus the velocity cap.
			frictionAir: 0.02,
		};

		// player can exit the viewport (jumping, falling into a hole, etc.)
		this.alwaysUpdate = true;

		this.dying = false;
		// jumping is game state (multi-jump bookkeeping), not physics state —
		// owned by the entity so the same code works on any adapter.
		this.jumping = false;
		this.multipleJump = 1;

		// enable keyboard
		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.X, "jump", true);
		input.bindKey(input.KEY.UP, "jump", true);
		input.bindKey(input.KEY.SPACE, "jump", true);
		input.bindKey(input.KEY.DOWN, "down");

		input.bindKey(input.KEY.A, "left");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.W, "jump", true);
		input.bindKey(input.KEY.S, "down");

		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_1 },
			input.KEY.UP,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_2 },
			input.KEY.UP,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.DOWN },
			input.KEY.DOWN,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_3 },
			input.KEY.DOWN,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_4 },
			input.KEY.DOWN,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.LEFT },
			input.KEY.LEFT,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.RIGHT },
			input.KEY.RIGHT,
		);

		// map axes
		input.bindGamepad(
			0,
			{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: -0.5 },
			input.KEY.LEFT,
		);
		input.bindGamepad(
			0,
			{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: 0.5 },
			input.KEY.RIGHT,
		);
		input.bindGamepad(
			0,
			{ type: "axes", code: input.GAMEPAD.AXES.LY, threshold: -0.5 },
			input.KEY.UP,
		);

		// define a basic walking animation
		this.addAnimation("stand", [{ name: "walk0001.png", delay: 100 }]);
		this.addAnimation("walk", [
			{ name: "walk0001.png", delay: 100 },
			{ name: "walk0002.png", delay: 100 },
			{ name: "walk0003.png", delay: 100 },
		]);
		this.addAnimation("jump", [
			{ name: "walk0004.png", delay: 150 },
			{ name: "walk0005.png", delay: 150 },
			{ name: "walk0006.png", delay: 150 },
			{ name: "walk0002.png", delay: 150 },
			{ name: "walk0001.png", delay: 150 },
		]);

		// set as default
		this.setCurrentAnimation("walk");
	}

	/**
	 * called when added to the game world
	 */
	onActivateEvent() {
		const app = this.parentApp;
		// cache the adapter ref so the hot loop doesn't chain through parentApp
		this.adapter = app.world.adapter;
		// set the viewport to follow this renderable on both axis, and enable damping
		app.viewport.follow(this, app.viewport.AXIS.BOTH, 0.1);
	}

	/**
	 * Matter-idiomatic update:
	 *   - Horizontal: sustained `applyForce` while a direction key is held.
	 *     Matter integrates the force into velocity; the adapter's velocity
	 *     clamp caps top speed. Releasing the key stops applying force, so
	 *     `frictionAir` (and any contact friction) decelerates the body.
	 *   - Vertical jump: `setVelocity` on each press (Matter's pattern for
	 *     instant velocity changes). One key press = one full-strength jump,
	 *     matching the legacy SAT platformer's fixed-height behaviour.
	 *     Up to two jumps total (ground + air-jump), reset on landing.
	 */
	update(dt) {
		const body = this.body;
		const vel = body.getVelocity(this.scratchVel);
		const grounded = this.adapter.isGrounded(this);

		// One-way platform pass-through, the matter-native way: rebuild
		// the player's collisionFilter.mask each frame from per-platform
		// bits. A platform contributes its bit to the mask iff the
		// player's bottom is currently at or above the platform's top
		// (within LAND_TOLERANCE) AND the player isn't holding DOWN.
		// All other states (rising through from below, walking sideways
		// at platform height, dropping with DOWN) clear the bit, so the
		// pair is filtered out at broad-phase before matter creates it —
		// no `pair.isActive` games, no event-order traps. Matter's
		// solver then handles landing/standing/walking naturally.
		const playerBottom = this.pos.y + this.height;
		const downHeld = input.isKeyPressed("down");
		let mask = collision.types.ALL_OBJECT;
		for (const p of oneWayPlatforms) {
			const cameFromAbove = playerBottom <= p.top + LAND_TOLERANCE;
			if (!cameFromAbove || downHeld) {
				mask &= ~p.bit;
			}
		}
		this.adapter.setCollisionMask(this, mask);

		// Horizontal: apply force while held. `isKeyPressed` fires every
		// frame for non-locked binds (left/right), so the force is sustained
		// naturally.
		if (input.isKeyPressed("left")) {
			body.applyForce(-WALK_FORCE, 0);
			this.flipX(true);
			if (grounded) this.setCurrentAnimation("walk");
		} else if (input.isKeyPressed("right")) {
			body.applyForce(WALK_FORCE, 0);
			this.flipX(false);
			if (grounded) this.setCurrentAnimation("walk");
		}

		// Jump: lock-bound key, so `isKeyPressed("jump")` is edge-triggered
		// (one true per press). Each press fires one full-strength impulse;
		// no hold-to-extend mechanic so behaviour matches the legacy SAT
		// platformer 1:1.
		if (input.isKeyPressed("jump")) {
			if (this.multipleJump <= 2) {
				this.setCurrentAnimation("jump");
				this.jumping = true;
				body.setVelocity(vel.x, -JUMP_VEL);
				this.multipleJump++;
				audio.stop("jump");
				audio.play("jump", false);
			}
		} else if (grounded) {
			this.multipleJump = 1;
			this.jumping = false;
		} else if (!this.jumping && this.multipleJump < 2) {
			// fell off a ledge without ever pressing jump — burn the first
			// jump so the air-jump still feels like a single jump
			this.multipleJump = 2;
		}

		// re-read velocity after the forces above to decide animation.
		// Matter integrates with floating-point, so resting velocities
		// drift around tiny non-zero values — use an epsilon instead of
		// an exact `=== 0` comparison.
		body.getVelocity(this.scratchVel);
		if (
			Math.abs(this.scratchVel.x) < 0.05 &&
			Math.abs(this.scratchVel.y) < 0.05 &&
			grounded
		) {
			this.setCurrentAnimation("stand");
		}

		// check if we fell into a hole
		if (!this.inViewport && this.getBounds().top > video.renderer.height) {
			const app = this.parentApp;
			// if yes reset the game
			app.world.removeChild(this);
			app.viewport.fadeIn("#fff", 150, () => {
				audio.play("die", false);
				level.reload();
				app.viewport.fadeOut("#fff", 150);
			});
			return true;
		}

		// check if we moved (an "idle" animation would definitely be cleaner)
		if (vel.x !== 0 || vel.y !== 0 || this.isFlickering()) {
			super.update(dt);
			return true;
		}
		return false;
	}

	/**
	 * One-shot collision handler — fires exactly once when contact begins.
	 *
	 *   - "did I land on this?" → `response.normal.y < -0.7`: the MTV for
	 *     `this` points upward, meaning I need to be pushed up to separate ⇒
	 *     I'm sitting on top of `other`. Same signal the enemy side reads
	 *     (mirrored: `normal.y > 0.7`), so both handlers agree every time.
	 *   - "should this be solid?" → handled by matter's solver via the
	 *     `collisionFilter` mask; we don't reshape any response object.
	 */
	onCollisionStart(response: CollisionResponse, other: Renderable) {
		if (other.body.collisionType !== collision.types.ENEMY_OBJECT) {
			return;
		}
		// Stomp test via the contact normal — same signal the enemy side
		// uses (mirrored), so we always agree. `response.normal` is the
		// MTV for `this`: `normal.y < -0.7` means "push me up to escape"
		// ⇒ I'm on top of the enemy. See the matching comment on
		// `Enemy.onCollisionStart` for the dispatch-order reason velocity
		// is *not* a reliable signal here.
		const stomp = other.isMovingEnemy && response.normal.y < -0.7;
		if (stomp) {
			const body = this.body;
			const vel = body.getVelocity(this.scratchVel);
			body.setVelocity(vel.x, -JUMP_VEL * 0.75);
		} else {
			// side hit, head-butt, or contact with a non-moving danger
			this.hurt();
		}
	}

	/**
	 * Slope + one-way-platform response.
	 *
	 * Both shapes are configured as sensors in `createGame` so the matter
	 * solver detects overlap but doesn't apply its own contact resolution —
	 * we own the response here.
	 *
	 * Slope handling is a direct port of the built-in platformer's SAT idiom:
	 *
	 * ```ts
	 * // packages/examples/src/examples/platformer/entities/player.ts
	 * response.overlapV.y = Math.abs(response.overlap);  // push up by overlap
	 * response.overlapV.x = 0;                            // no horizontal push
	 * ```
	 *
	 * `response.depth` is matter's penetration magnitude — the unsigned scalar
	 * equivalent of SAT's `Math.abs(response.overlap)`. Translating the legacy
	 * idiom: push the player straight up by `response.depth`, ignore the
	 * contact normal's direction. Generalises to any slope angle (the
	 * built-in SAT version did too, via the same scalar-overlap trick) — no
	 * dependency on the TMX polygon's exact vertices.
	 */
	onCollisionActive(response: CollisionResponse, other: Renderable) {
		const body = this.body;

		if (other.type === "slope") {
			// Order matters under matter: `setVelocity` mutates body.position
			// by (newVel - oldVel) to keep Verlet integration consistent.
			// Setting velocity AFTER setPosition would shift the body back
			// off the slope by the gravity-step amount. Set velocity FIRST,
			// then snap position.
			const vel = body.getVelocity(this.scratchVel);
			if (vel.y > 0) {
				body.setVelocity(vel.x, 0);
			}
			this.adapter.setPosition(
				this,
				this.scratchPos.set(this.pos.x, this.pos.y - response.depth),
			);
			return;
		}

		// One-way platforms are handled via `collisionFilter.mask` updates
		// at the top of `update()` — see the `oneWayPlatforms` loop. The
		// solver handles landing, standing, and walking naturally for
		// pairs that survive the broad-phase filter, so this handler has
		// nothing to do for platforms.

		// Enemy contact while we're already in contact: legacy SAT's
		// `onCollision` fires every frame and `hurt()` self-gates on
		// `isFlickering`, so a side-hit re-triggers automatically once
		// the flicker window expires. `onCollisionStart` only fires on
		// contact-begin, so without this branch a player who stays in
		// contact through the 750ms flicker never gets hurt again.
		// Stomp detection stays in onCollisionStart (one-shot bounce —
		// firing it every frame would re-bounce the player while still
		// overlapping the enemy).
		if (other.body.collisionType === collision.types.ENEMY_OBJECT) {
			const stomp = other.isMovingEnemy && response.normal.y < -0.7;
			if (!stomp) {
				this.hurt();
			}
		}
	}

	/**
	 * ouch
	 */
	hurt() {
		if (!this.isFlickering()) {
			// tint to red and flicker
			this.tint.setColor(255, 192, 192);
			this.flicker(750, () => {
				// clear the tint once the flickering effect is over
				this.tint.setColor(255, 255, 255);
			});

			// flash the screen and shake the camera
			this.parentApp.viewport.fadeIn("#FFFFFF", 75);
			this.parentApp.viewport.shake(4, 200);
			audio.play("die", false);
		}
	}
}
