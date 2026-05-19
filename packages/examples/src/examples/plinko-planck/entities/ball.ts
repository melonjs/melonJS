/**
 * melonJS — Plinko (Planck) example: Ball entity.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A glowing yellow-white ball that drops through the peg field, scores
 * a slot at the bottom, and is reaped when it lands. Renders as a
 * concentric-alpha glow plus a melonJS built-in `Trail` (yellow→magenta
 * fade) for the motion trail.
 *
 * Implemented as a `Container` (carrying the body) with a
 * `BallVisual` child handling the procedural draw — matches the
 * Peg / Wall / Slot pattern in this example. Top-level `Renderable`
 * instances with a `bodyDef` had visible position desync (body fell
 * through pegs but the rendered ball stayed near spawn); routing the
 * draw through a child renderable inside a container fixes it.
 *
 * Collision behaviour:
 *   - `onCollisionStart` against a Peg → trigger the peg's flash + score
 *     a small "bonus" point per bounce (gameplay sugar — the slot
 *     contributes the real points).
 *   - `onCollisionStart` against a Slot → call `slot.collect()` and mark
 *     for removal next frame (lazy reap; we don't mutate the world
 *     mid-physics-step).
 */

import type { CollisionResponse, Renderer } from "melonjs";
import {
	CanvasRenderTarget,
	Container,
	collision,
	Ellipse,
	Renderable,
	Trail,
	Vector2d,
} from "melonjs";
import {
	BALL_DENSITY,
	BALL_FRICTION,
	BALL_LINEAR_DAMPING,
	BALL_RADIUS,
	BALL_RESTITUTION,
	COLOR_BALL,
	COLOR_HORIZON_HI,
} from "../constants";
import { gameState } from "../gameState";
import { Peg } from "./peg";
import { Slot } from "./slot";

/**
 * Velocity below which a ball is considered "effectively stopped".
 * Once a ball spends `STUCK_FRAME_LIMIT` consecutive frames under this
 * threshold without entering a slot, it gets reaped — handles balls
 * that wedge between a wall and a peg and would otherwise sit
 * forever.
 */
const STUCK_VEL_THRESHOLD = 0.4;
const STUCK_FRAME_LIMIT = 120;

/**
 * Outermost halo radius — the BAKE target is sized to fit the full
 * glow, not just the core disc. With BALL_RADIUS=10 and 3 halo rings
 * expanding by `i*4`, the outer ring lands at radius 22 → target
 * canvas is 44×44 px.
 */
const BALL_HALO_RADIUS = BALL_RADIUS + 3 * 4;
const BALL_BAKE_SIZE = BALL_HALO_RADIUS * 2;

/**
 * Module-level baked bitmap for the ball appearance. Built lazily on
 * first BallVisual.draw (the renderer must exist by then) and shared
 * across every Ball instance — the visual is identical for all balls,
 * so we draw the same texture for each. Cuts the per-ball cost from 5
 * primitive draws + alpha-stack saves to a single `drawImage`.
 */
let bakedBall: CanvasRenderTarget | null = null;

const bakeBallTexture = (): CanvasRenderTarget => {
	const target = new CanvasRenderTarget(BALL_BAKE_SIZE, BALL_BAKE_SIZE, {
		context: "2d",
		transparent: true,
		antiAlias: true,
	});
	const ctx = target.context as CanvasRenderingContext2D;
	const cx = BALL_HALO_RADIUS;
	const cy = BALL_HALO_RADIUS;
	// Outer glow halo — 3 alpha-stacked rings expanding outward.
	for (let i = 3; i >= 1; i--) {
		const a = 0.22 * (1 - (i - 1) / 3);
		const r = BALL_RADIUS + i * 4;
		ctx.fillStyle = `rgba(255, 245, 160, ${a})`; // COLOR_BALL
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
	}
	// Core ball — solid yellow disc.
	ctx.fillStyle = COLOR_BALL;
	ctx.beginPath();
	ctx.arc(cx, cy, BALL_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	// Hot inner highlight — bright white centre.
	ctx.fillStyle = `rgba(255, 255, 255, 0.95)`; // COLOR_BALL_HOT @ 0.95
	ctx.beginPath();
	ctx.arc(cx, cy, BALL_RADIUS * 0.42, 0, Math.PI * 2);
	ctx.fill();
	return target;
};

/**
 * Visual half of the ball — pre-rendered into a shared bitmap and
 * blitted per frame as a single `drawImage` call. With up to MAX_BALLS
 * (60) in flight, this turns ~300 primitive ellipse draws per frame
 * into 60 `drawImage` quads (or a single batched draw under WebGL).
 * Lives as a child of the Ball Container, so it inherits the parent's
 * pos updates without needing its own bodyDef.
 */
class BallVisual extends Renderable {
	constructor() {
		super(0, 0, BALL_RADIUS * 2, BALL_RADIUS * 2);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	override draw(renderer: Renderer): void {
		if (bakedBall === null) {
			bakedBall = bakeBallTexture();
		}
		// The bitmap is centred on the halo; draw it offset so the
		// centre lands at (BALL_RADIUS, BALL_RADIUS) — the ball centre
		// in this BallVisual's local coordinate space. melonJS's
		// `drawImage` only types the full 9-arg form (the 3- and 5-arg
		// short forms are runtime-supported but not in the .d.ts).
		const dx = BALL_RADIUS - BALL_HALO_RADIUS;
		const dy = BALL_RADIUS - BALL_HALO_RADIUS;
		renderer.drawImage(
			bakedBall.canvas,
			0,
			0,
			BALL_BAKE_SIZE,
			BALL_BAKE_SIZE,
			dx,
			dy,
			BALL_BAKE_SIZE,
			BALL_BAKE_SIZE,
		);
	}
}

export class Ball extends Container {
	/**
	 * Set true by `onCollisionStart` when the ball enters a Slot — the
	 * world reaps Ball entries with `pendingRemoval === true` once per
	 * frame so the mutation happens between physics steps.
	 */
	pendingRemoval = false;

	/**
	 * Set by `onCollisionStart` to the Slot we just landed in. The
	 * scoring effects (spark burst + score-fly popup) AND the actual
	 * `slot.collect()` call run AFTER the physics step from
	 * `reapPendingBalls`, not inside the contact callback — adding
	 * children to the world during the planck step corrupts the
	 * contact-list iterator and crashes the adapter on subsequent
	 * `addBody` calls.
	 */
	pendingSlot: Slot | null = null;

	/**
	 * Built-in {@link Trail} renderable that auto-follows this ball's
	 * centre. Stored so we can detach it from the world when the ball
	 * is reaped (otherwise the trail orphans into the world and keeps
	 * emitting from a dead target reference).
	 */
	trail!: Trail;

	/**
	 * Virtual Vector2d target the Trail samples each frame. `Trail`
	 * accepts either a Renderable (it reads `target.pos.{x,y}`) or a
	 * plain Vector2d (it reads `target.{x,y}`); we use the latter
	 * here. Our container's pos is the ball's **top-left**; we want
	 * the trail to follow the ball's **centre**, so this vector gets
	 * updated each frame in `update()` shifted by BALL_RADIUS on
	 * both axes.
	 */
	private readonly trailAnchor = new Vector2d();

	/** Last sampled position — used to estimate frame-to-frame speed. */
	private lastX = 0;
	private lastY = 0;
	/** Consecutive frames the ball has measured below the stuck threshold. */
	private stuckFrames = 0;

	constructor(x: number, y: number) {
		super(x, y, BALL_RADIUS * 2, BALL_RADIUS * 2);
		this.anchorPoint.set(0, 0);
		this.bodyDef = {
			type: "dynamic",
			shapes: [
				new Ellipse(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS * 2, BALL_RADIUS * 2),
			],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.WORLD_SHAPE,
			density: BALL_DENSITY,
			friction: BALL_FRICTION,
			restitution: BALL_RESTITUTION,
			frictionAir: BALL_LINEAR_DAMPING,
			// Keep the ball axis-aligned. Visually it's a perfect
			// rotational-symmetric circle so the spin produces zero
			// readable change, and freely-spinning balls can wedge
			// against peg/wall corners and orbit there indefinitely.
			fixedRotation: true,
		};
		this.addChild(new BallVisual());
	}

	override update(dt: number): boolean {
		// Update the trail's virtual target to the ball CENTRE rather
		// than its top-left.
		this.trailAnchor.set(this.pos.x + BALL_RADIUS, this.pos.y + BALL_RADIUS);

		// Stuck-ball detection — estimate frame speed by sampling
		// position delta from the previous frame.
		const dx = this.pos.x - this.lastX;
		const dy = this.pos.y - this.lastY;
		const speed2 = dx * dx + dy * dy;
		this.lastX = this.pos.x;
		this.lastY = this.pos.y;
		if (speed2 < STUCK_VEL_THRESHOLD * STUCK_VEL_THRESHOLD) {
			this.stuckFrames++;
			if (this.stuckFrames >= STUCK_FRAME_LIMIT) {
				this.pendingRemoval = true;
			}
		} else {
			this.stuckFrames = 0;
		}
		super.update(dt);
		return true;
	}

	override onActivateEvent(): void {
		this.lastX = this.pos.x;
		this.lastY = this.pos.y;
		this.stuckFrames = 0;
		this.trailAnchor.set(this.pos.x + BALL_RADIUS, this.pos.y + BALL_RADIUS);
		// Built-in Trail anchored to the ball centre. Yellow → magenta
		// → transparent gradient, additive blend so the streak reads
		// as a glowing comet rather than a flat ribbon. Attached to
		// the same world container the ball lives in so it isn't
		// transformed by the ball's own coordinate frame.
		this.trail = new Trail({
			target: this.trailAnchor,
			length: 28,
			lifetime: 520,
			width: BALL_RADIUS * 1.5,
			minDistance: 3,
			gradient: [COLOR_BALL, `${COLOR_HORIZON_HI}aa`, `${COLOR_HORIZON_HI}00`],
			opacity: 0.75,
			blendMode: "additive",
		});
		this.trail.depth = (this.depth ?? 0) - 1;
		const parent = this.ancestor as Container | null;
		if (parent) {
			parent.addChild(this.trail);
		}
	}

	override onDeactivateEvent(): void {
		const parent = this.trail.ancestor as Container | null;
		if (parent) {
			parent.removeChild(this.trail);
		}
	}

	onCollisionStart(_response: CollisionResponse, other: Renderable): void {
		if (other instanceof Peg) {
			other.flash();
			// Small per-bounce bonus — visual sugar so the score
			// ticks up as the ball travels, not just at landing.
			gameState.score += 1;
			return;
		}
		if (other instanceof Slot) {
			if (this.pendingRemoval) return; // already scored
			// Defer slot.collect() until after the physics step. Adding
			// the spark-burst emitter and ScoreFly children to the
			// world DURING the planck contact dispatch invalidates the
			// adapter's contact-list iterator and crashes the next
			// addBody() call (body.createFixture on null). Resolved
			// from `reapPendingBalls`.
			this.pendingSlot = other;
			this.pendingRemoval = true;
		}
	}
}

/**
 * True if any `Ball` is currently in the world container's children.
 * Used by the HUD to gate the GAME OVER prompt (only shown once the
 * playfield has fully drained — otherwise the player would see the
 * prompt while their last balls were still scoring).
 * @param world the world container hosting Ball children
 */
export const hasActiveBalls = (world: Container): boolean => {
	const children = world.getChildren();
	for (const c of children) {
		if (c instanceof Ball) return true;
	}
	return false;
};

/**
 * Reap any balls that landed in a slot last frame. Called from
 * `PlayScreen.update` (after the physics step + collision dispatch).
 * Removing children inside `onCollisionStart` would mutate the world
 * mid-step; this lazy pass keeps mutations between physics frames.
 * @param world the world container hosting Ball children
 */
export const reapPendingBalls = (world: Container): void => {
	const children = world.getChildren();
	// Iterate backwards because `removeChild` mutates the array.
	for (let i = children.length - 1; i >= 0; i--) {
		const c = children[i];
		if (c instanceof Ball && c.pendingRemoval) {
			// Run the deferred slot effects (spark burst + score-fly)
			// before removing the ball. Safe here because we're
			// outside the planck contact dispatch — adding new world
			// children no longer corrupts the contact-list iterator.
			if (c.pendingSlot) {
				c.pendingSlot.collect();
				c.pendingSlot = null;
			}
			world.removeChild(c);
		}
	}
};
