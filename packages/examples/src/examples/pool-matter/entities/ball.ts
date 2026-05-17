/**
 * melonJS — Pool (Matter) example: Ball entity (numbered + cue base).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { MatterAdapter } from "@melonjs/matter-adapter";
import {
	type Container,
	collision,
	Ellipse,
	type PhysicsAdapter,
	type Renderer,
	Sprite,
	Tween,
	Vector2d,
} from "melonjs";
import {
	BALL_DENSITY,
	BALL_FRICTION_AIR_ROLL,
	BALL_FRICTION_AIR_SLIDE,
	BALL_RADIUS,
	BALL_RESTITUTION,
	ROLL_TRANSITION_VEL,
} from "../constants";

/**
 * Pre-baked soft drop-shadow texture, generated once and shared by every
 * ball. Using a `CanvasGradient`-painted offscreen canvas gives a soft
 * anti-aliased edge that `renderer.fillEllipse` can't produce, and it's
 * faster than running a per-frame `RadialGradientEffect` shader pass for
 * every ball — the gradient is rasterized exactly once at module load,
 * and the result uploads to the GPU as a normal texture that batches
 * with the rest of the scene. Sized just larger than the ball so the
 * shadow reads as a tight drop rather than a wide diffuse spot.
 */
const SHADOW_TEX_SIZE = Math.round(BALL_RADIUS * 2.5);

/**
 * Directional drop-shadow offset (px). Light is imagined coming from the
 * upper-left, so the shadow falls toward the lower-right. The magnitude
 * is intentionally noticeable — at the table's top-down framing a
 * symmetric centered shadow reads as a generic dark halo, while an
 * offset shadow gives the balls a clear sense of sitting *on* the felt.
 */
const SHADOW_OFFSET_X = 6;
const SHADOW_OFFSET_Y = 8;

/**
 * Specular highlight offset (px) from ball center — placed upper-left,
 * opposite the shadow direction. Sells the "glossy lacquered sphere"
 * look without needing a normal map: viewer brain reads bright spot +
 * dark drop as light from upper-left.
 */
const HIGHLIGHT_OFFSET_X = -Math.round(BALL_RADIUS * 0.35);
const HIGHLIGHT_OFFSET_Y = -Math.round(BALL_RADIUS * 0.45);
const HIGHLIGHT_RADIUS = 3;

/**
 * Sink animation duration (ms) — runs between the pocket sink trigger
 * and the actual removal from the world. Long enough to read as a ball
 * dropping into the hole, short enough that scoring doesn't lag.
 */
const SINK_MS = 500;
/** Final scale at the end of the sink tween — visually "ball fell in". */
const SINK_END_SCALE = 0.2;

// Module-scope scratch for `body.getVelocity(scratch)` — `isAtRest` is
// polled every frame for every ball, so reusing a single Vector2d
// avoids ~16 allocs per frame in a typical 16-ball break.
const restVelScratch = new Vector2d();
// Module-scope scratch for `adapter.setPosition(ball, scratch)` calls
// inside the sink tween's onUpdate. Multiple balls can be mid-sink at
// once, but onUpdate fires sequentially so the scratch is safe to share.
const sinkPosScratch = new Vector2d();
const ballShadowTexture: HTMLCanvasElement = (() => {
	const c = document.createElement("canvas");
	c.width = SHADOW_TEX_SIZE;
	c.height = SHADOW_TEX_SIZE;
	const ctx = c.getContext("2d");
	if (!ctx) return c;
	const cx = SHADOW_TEX_SIZE / 2;
	const cy = SHADOW_TEX_SIZE / 2;
	// Stronger center, sharper falloff — at this tighter texture size the
	// previous gentle gradient (0.45 → 0.22 → 0) looked washed out.
	const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, SHADOW_TEX_SIZE / 2);
	g.addColorStop(0, "rgba(0, 0, 0, 0.55)");
	g.addColorStop(0.55, "rgba(0, 0, 0, 0.28)");
	g.addColorStop(1, "rgba(0, 0, 0, 0)");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, SHADOW_TEX_SIZE, SHADOW_TEX_SIZE);
	return c;
})();

/**
 * A pool ball: sprite-rendered (ball_1.png … ball_16.png) with a
 * circle body. High restitution + low friction so balls behave like
 * hard rolling spheres on a felt table.
 *
 * Ball images are 32×32 pre-cropped — Sprite frames map 1:1 to display
 * pixels, body radius is BALL_RADIUS, anchor is top-left so `pos`
 * matches the body's top-left corner the same way other entities work.
 */
export class Ball extends Sprite {
	/** ball number (0 = cue, 1-15 = numbered) */
	ballNumber: number;
	/**
	 * Squared-velocity threshold below which `isAtRest()` returns true.
	 * Default is tight (|v| < 0.2 px/frame ≈ truly still) so the racked
	 * balls aren't flagged "moving" by tiny Verlet jitter. `CueBall`
	 * overrides this with a looser value — the cue gates re-aim so a
	 * stricter check would force the player to wait for the very last
	 * post-impact micro-drift to decay.
	 */
	protected restThresholdSq = 0.04;
	/**
	 * Sink state — set by `startSink()` when the pocket decides this
	 * ball has dropped in far enough to disappear. The visual fade is
	 * driven by a `Tween` on `this.alpha`; this flag exists so other
	 * code (collision handlers, raycasts) can short-circuit while the
	 * ball is mid-fade.
	 */
	private sinking = false;
	/**
	 * Per-frame scale factor applied around the ball's center during
	 * the sink animation. Tweened from `1` (full size) to `SINK_END_SCALE`
	 * over `SINK_MS` so the ball appears to drop into the hole instead
	 * of just fading in place. Read by `draw()`; written by the sink
	 * `Tween`.
	 */
	private sinkScale = 1;
	/**
	 * Sink-tween 0..1 progress driving the ball's slide from its impact
	 * position to the pocket center. Driven by the sink `Tween` with an
	 * ease-out curve so the ball appears to keep its momentum forward
	 * briefly and decelerate into the pocket instead of teleporting.
	 */
	private sinkLerp = 0;
	private sinkStartX = 0;
	private sinkStartY = 0;
	private sinkTargetX = 0;
	private sinkTargetY = 0;

	constructor(x: number, y: number, ballNumber: number) {
		const imageName = ballNumber === 0 ? "ball_16" : `ball_${ballNumber}`;
		super(x, y, {
			image: imageName,
			anchorPoint: new Vector2d(0, 0),
		});

		this.ballNumber = ballNumber;
		this.name = `ball${ballNumber}`;

		// `Sprite` reads its `width`/`height` from the loaded image. Body
		// shape is in local coords (centered in the renderable's bounds).
		this.bodyDef = {
			type: "dynamic",
			shapes: [
				new Ellipse(
					this.width / 2,
					this.height / 2,
					BALL_RADIUS * 2,
					BALL_RADIUS * 2,
				),
			],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			restitution: BALL_RESTITUTION,
			// Start in the "rolling" regime; `update` swaps to the sliding
			// value whenever speed exceeds ROLL_TRANSITION_VEL.
			frictionAir: BALL_FRICTION_AIR_ROLL,
			density: BALL_DENSITY,
			// pool is top-down — no gravity (also set adapter-level to 0)
			gravityScale: 0,
		};

		// always draw, even if the broadphase culls it briefly
		this.alwaysUpdate = true;
	}

	/** Is the ball nearly motionless? Used to gate "can the player strike?" */
	isAtRest(): boolean {
		if (!this.body) return true;
		const v = this.body.getVelocity(restVelScratch);
		return v.x * v.x + v.y * v.y < this.restThresholdSq;
	}

	override update(dt: number): boolean {
		if (!this.sinking && this.body) {
			const v = this.body.getVelocity(restVelScratch);
			const speedSq = v.x * v.x + v.y * v.y;

			// Sliding-vs-rolling friction split. Real pool balls slide
			// for the first fraction of a second after a strike — kinetic
			// friction against the felt is ~3× rolling friction. Matter
			// only models one `frictionAir`, so we swap between the two
			// regimes based on current speed: above `ROLL_TRANSITION_VEL`
			// the ball is sliding (high drag); below it, rolling (low
			// drag). Writes through the matter `body.frictionAir` directly
			// — Matter reads it each integration step, so no rebind needed.
			const sliding = speedSq > ROLL_TRANSITION_VEL * ROLL_TRANSITION_VEL;
			const target = sliding ? BALL_FRICTION_AIR_SLIDE : BALL_FRICTION_AIR_ROLL;
			// Under MatterAdapter, the renderable's `body` IS the
			// underlying `Matter.Body` (with helper methods spliced on
			// at registration). Cast to it so we can write the matter-
			// native `frictionAir` field — Matter reads it each step,
			// so no other API call is needed. Matter-specific code path,
			// not portable to BuiltinAdapter.
			(this.body as MatterAdapter.Body).frictionAir = target;

			// Resting-velocity snap. `frictionAir` is exponential, so a
			// ball approaches but never reaches zero — it can drift at
			// 0.01 px/frame for tens of seconds and never visually settle.
			// Once we've crossed the `isAtRest()` threshold, hard-zero the
			// velocity so the position locks. Skip while sinking (the sink
			// tween already drives position via the adapter).
			if (speedSq < this.restThresholdSq && (v.x !== 0 || v.y !== 0)) {
				this.body.setVelocity(0, 0);
			}
		}
		return super.update(dt);
	}

	/**
	 * Begin the "drop into pocket" animation. Pocket calls this once it
	 * decides the ball has crossed its sink-radius threshold. The ball
	 * is converted to a sensor so it stops blocking other balls during
	 * the fade — without that, the fading sprite still has a physics
	 * presence and you can see other balls bounce off "thin air."
	 *
	 * A single `Tween` drives three values together over `SINK_MS` with
	 * an ease-out curve so the ball reads as "keeps moving forward
	 * briefly, then settles":
	 *   - `alpha`     : 1 → 0 (fade out, applied by `Renderable.preDraw`)
	 *   - `sinkScale` : 1 → `SINK_END_SCALE` (shrinks the sprite around center)
	 *   - `sinkLerp`  : 0 → 1 (interpolates body position from impact point
	 *                          toward `(targetX, targetY)` via
	 *                          `adapter.setPosition` each frame)
	 * `onComplete` removes the ball from its parent container, which
	 * auto-cleans up the physics body via the adapter's `removeBody`.
	 */
	startSink(adapter: PhysicsAdapter, targetX: number, targetY: number): void {
		if (this.sinking) return;
		this.sinking = true;
		// `setSensor` is optional on the PhysicsAdapter interface — both
		// BuiltinAdapter and MatterAdapter implement it, so the call is
		// safe in practice; the `?.` keeps TS happy without forcing a
		// non-null assertion.
		adapter.setSensor?.(this, true);
		this.body.setVelocity(0, 0);

		// Capture the ball's current world-center; the sink tween
		// interpolates it toward the pocket center each frame via
		// `adapter.setPosition`, with an ease-out curve so the ball
		// reads as "keeps moving forward briefly, then settles into
		// the pocket" instead of teleporting in place.
		this.sinkStartX = this.pos.x + this.width / 2;
		this.sinkStartY = this.pos.y + this.height / 2;
		this.sinkTargetX = targetX;
		this.sinkTargetY = targetY;

		new Tween(this)
			.to(
				{ alpha: 0, sinkScale: SINK_END_SCALE, sinkLerp: 1 },
				{ duration: SINK_MS },
			)
			.easing(Tween.Easing.Quadratic.Out)
			.onUpdate(() => {
				const t = this.sinkLerp;
				const cx = this.sinkStartX + (this.sinkTargetX - this.sinkStartX) * t;
				const cy = this.sinkStartY + (this.sinkTargetY - this.sinkStartY) * t;
				sinkPosScratch.set(cx, cy);
				adapter.setPosition(this, sinkPosScratch);
			})
			.onComplete(() => {
				const parent = this.ancestor as Container | undefined;
				parent?.removeChild(this);
			})
			.start();
	}

	/** True if the ball is currently mid-sink-animation. */
	isSinking(): boolean {
		return this.sinking;
	}

	override draw(renderer: Renderer): void {
		const cx = this.pos.x + this.width / 2;
		const cy = this.pos.y + this.height / 2;

		// Sink animation: tween-driven `sinkScale` shrinks the visual
		// (shadow + sprite + highlight) around the ball's center. The
		// matching alpha tween fades it out. Both reach their end value
		// at the same time and `onComplete` removes the ball.
		const scaling = this.sinkScale !== 1;
		if (scaling) {
			renderer.save();
			renderer.translate(cx, cy);
			renderer.scale(this.sinkScale, this.sinkScale);
			renderer.translate(-cx, -cy);
		}

		// The sink fade is handled by a `Tween` on `this.alpha` which
		// drives the renderer's `globalAlpha` via `Renderable.preDraw`.
		// Shadow (`drawImage`) and specular (`fillEllipse`) both inherit
		// that alpha automatically, so the entire ball — shadow, sprite,
		// highlight — fades together with no special draw branch.

		// Drop shadow: paint the pre-baked soft-gradient texture offset
		// down-right under the ball. Looks the same on Canvas + WebGL
		// (matter-platformer runs on either) and is one drawImage per
		// ball instead of a per-frame ellipse rasterization.
		const sx = cx - SHADOW_TEX_SIZE / 2 + SHADOW_OFFSET_X;
		const sy = cy - SHADOW_TEX_SIZE / 2 + SHADOW_OFFSET_Y;
		renderer.drawImage(
			ballShadowTexture,
			0,
			0,
			SHADOW_TEX_SIZE,
			SHADOW_TEX_SIZE,
			sx,
			sy,
			SHADOW_TEX_SIZE,
			SHADOW_TEX_SIZE,
		);
		super.draw(renderer);

		// Specular highlight — a small bright disc offset toward upper-
		// left of the ball center (opposite the shadow). Subtle alpha so
		// it doesn't compete with the numbered stripes painted into the
		// ball sprites.
		renderer.setColor("rgba(255, 255, 255, 0.55)");
		renderer.fillEllipse(
			cx + HIGHLIGHT_OFFSET_X,
			cy + HIGHLIGHT_OFFSET_Y,
			HIGHLIGHT_RADIUS,
			HIGHLIGHT_RADIUS,
		);

		if (scaling) {
			renderer.restore();
		}
	}
}
