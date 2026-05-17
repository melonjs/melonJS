/**
 * melonJS — Pool (Matter) example: CueBall + cue-stick rendering.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { event, input, type Pointer, type Renderer } from "melonjs";
import {
	BALL_RADIUS,
	MAX_DRAG,
	PLAY_LEFT,
	PLAY_W,
	STRIKE_FORCE_SCALE,
	VIEWPORT_H,
} from "../constants";
import { gameState } from "../gameState";
import { Ball } from "./ball";

/**
 * Spawn point for the cue ball — head-spot, 1/4 along the table from
 * the left, vertically centered on the rack apex (`VIEWPORT_H / 2`).
 * Both X and Y are stored as the ball's TOP-LEFT coordinate (subtract
 * `BALL_RADIUS` from the desired center).
 */
export const CUE_SPAWN_X = PLAY_LEFT + PLAY_W / 4 - BALL_RADIUS;
export const CUE_SPAWN_Y = VIEWPORT_H / 2 - BALL_RADIUS;

/**
 * Drag-distance dead-zone (px). A pointerdown→pointerup gesture shorter
 * than this is treated as a tap rather than a strike — prevents the cue
 * from firing a near-zero impulse with a wildly amplified direction
 * vector when the player clicks the ball without dragging.
 */
const MIN_DRAG_PX = 4;

/**
 * The cue ball — drag-back-to-aim, release-to-strike. Pulls on the
 * shared `gameState` for aim/power so the HUD can render an aim
 * indicator without coupling to this class.
 *
 * Input model:
 *   - pointerdown on cue ball (and all balls at rest)  → start aim
 *   - pointermove anywhere                             → update aim
 *   - pointerup anywhere                               → apply impulse
 *
 * Drag distance maps to impulse magnitude up to MAX_DRAG. The impulse
 * vector points from the pointer back toward the cue — the player
 * pulls back from the cue ball like a slingshot.
 */
export class CueBall extends Ball {
	private boundOnMove: (p: Pointer) => void;
	private boundOnUp: () => void;

	constructor(x: number, y: number) {
		super(x, y, 0); // 0 → ball_16 (white)
		this.name = "cueBall";
		// Looser rest threshold than the numbered balls — the cue is the
		// only ball that gates re-aim, and waiting for sub-0.2 px/frame
		// micro-drift to decay introduces a noticeable input dead-zone
		// after each strike. 0.25 (|v| < 0.5 px/frame) is visually
		// indistinguishable from "stopped" while keeping the gate snappy.
		this.restThresholdSq = 0.25;
		// Renderable defaults to isKinematic=true, which makes the pointer
		// event dispatcher skip this renderable entirely (see
		// input/pointerevent.ts). We need the opposite: receive pointerdown
		// so the player can aim the cue.
		this.isKinematic = false;
		this.boundOnMove = (p) => {
			this._onMove(p);
		};
		this.boundOnUp = () => {
			this._onUp();
		};
	}

	/**
	 * Wire up the pointer events.
	 *   - pointerdown is region-based (only fires while the pointer is
	 *     over the cue ball) — registered via melonJS so the bounds check
	 *     is automatic and consistent with the rest of the engine.
	 *   - pointermove uses melonJS's global POINTERMOVE system event so
	 *     the drag tracks even when the pointer leaves the cue's bounds.
	 *   - pointerup is a raw DOM listener on the window — melonJS has no
	 *     global POINTERUP system event, and a region-based registration
	 *     would only fire if the player released over the cue itself
	 *     (rarely true during a drag-back-to-strike gesture).
	 */
	override onActivateEvent() {
		input.registerPointerEvent("pointerdown", this, this._onDown.bind(this));
		event.on(event.POINTERMOVE, this.boundOnMove);
		window.addEventListener("pointerup", this.boundOnUp);
		window.addEventListener("pointercancel", this.boundOnUp);
	}

	override onDeactivateEvent() {
		input.releasePointerEvent("pointerdown", this);
		event.off(event.POINTERMOVE, this.boundOnMove);
		window.removeEventListener("pointerup", this.boundOnUp);
		window.removeEventListener("pointercancel", this.boundOnUp);
	}

	/**
	 * Re-aim gate: only the cue ball needs to be at rest. Real pool
	 * requires *all* balls to settle, but in a casual single-player
	 * sim that just adds dead time — the numbered balls can keep
	 * rolling in the background while the player lines up the next
	 * shot. Their motion doesn't affect cue-ball aim accuracy.
	 */
	private canPlay(): boolean {
		return !gameState.gameOver && this.isAtRest();
	}

	private _onDown(pointer: Pointer): boolean {
		if (!this.canPlay()) return false;
		gameState.aiming = true;
		gameState.aimStartX = pointer.gameWorldX;
		gameState.aimStartY = pointer.gameWorldY;
		gameState.aimCurrentX = pointer.gameWorldX;
		gameState.aimCurrentY = pointer.gameWorldY;
		return false;
	}

	private _onMove(pointer: Pointer): void {
		if (!gameState.aiming) return;
		gameState.aimCurrentX = pointer.gameWorldX;
		gameState.aimCurrentY = pointer.gameWorldY;
	}

	private _onUp(): void {
		if (!gameState.aiming) return;
		gameState.aiming = false;
		// drag vector goes pointer → cue center. Released impulse is
		// opposite (slingshot: pull back to shoot forward).
		const cueCenterX = this.pos.x + this.width / 2;
		const cueCenterY = this.pos.y + this.height / 2;
		let dx = cueCenterX - gameState.aimCurrentX;
		let dy = cueCenterY - gameState.aimCurrentY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < MIN_DRAG_PX) return; // ignore tiny taps
		// clamp drag distance to MAX_DRAG for the magnitude calc
		const power = Math.min(dist, MAX_DRAG) / MAX_DRAG;
		// normalize direction
		dx /= dist;
		dy /= dist;
		const impulse = power * STRIKE_FORCE_SCALE;
		this.body.applyImpulse(dx * impulse, dy * impulse);
	}

	override draw(renderer: Renderer): void {
		super.draw(renderer);

		const aiming = gameState.aiming;
		const cx = this.pos.x + this.width / 2;
		const cy = this.pos.y + this.height / 2;

		// Idle-ready pulse glow ring. Motion is what the eye actually
		// catches — a static resting cue read as decoration, but a soft
		// ring expanding-and-fading on a ~1 Hz sine wave reliably says
		// "you can interact with this thing now." Hidden during aim
		// because the cue stick itself takes over as the affordance.
		if (!aiming && this.canPlay()) {
			// `Date.now() * 0.006` ≈ 6 rad/sec ≈ one full cycle per ~1 s.
			// Phase shift via Date.now() is meaningless (we only care
			// about relative motion); using a wall-clock source keeps
			// the pulse frame-rate independent.
			const t = (Math.sin(Date.now() * 0.006) + 1) * 0.5; // 0..1
			const ringRadius = BALL_RADIUS + 4 + t * 8;
			// Dense at the small end (eye-catching), fades as it expands
			// (suggests a halo dissipating outward).
			const alpha = 0.6 - t * 0.45;
			renderer.setColor(`rgba(255, 255, 255, ${alpha.toFixed(3)})`);
			const prevLineWidth = renderer.lineWidth;
			renderer.lineWidth = 2;
			renderer.strokeEllipse(cx, cy, ringRadius, ringRadius);
			renderer.lineWidth = prevLineWidth;
			return;
		}

		if (!aiming) return;

		// Real pool players use the cue itself as the aim guide — drop
		// the straight aim line and render the cue stick instead. The
		// stick retracts (slides away from the ball) as drag power
		// increases, just like a real cue being pulled back.
		const dx = cx - gameState.aimCurrentX;
		const dy = cy - gameState.aimCurrentY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < MIN_DRAG_PX) return;
		const power = Math.min(dist, MAX_DRAG) / MAX_DRAG;
		// Strike direction (unit vector): drag vector points pointer →
		// cue center, which is the same direction the ball flies after
		// release (slingshot model). Used both for the cue stick angle
		// below and the aim-trajectory raycast immediately following.
		const sx = dx / dist;
		const sy = dy / dist;
		// Direction from cue center back toward where the cue body sits
		// — negative of strike direction. Cue is drawn along +X after
		// rotation, so we rotate by the angle of (-dx, -dy).
		const backAngle = Math.atan2(-dy, -dx);

		// Aim trajectory preview — raycast from the cue ball center in
		// the strike direction, find the first sibling ball it would
		// collide with, render a translucent "ghost ball" at that
		// contact point plus a dotted line from cue to ghost. Helps the
		// player line up shots and reads as a professional billiards
		// trainer affordance.
		//
		// Math: cue center moves along (cx + t·sx, cy + t·sy). For each
		// target ball at (ox, oy), find t where the centers are exactly
		// (cue_r + target_r) = 2·BALL_RADIUS apart — that's the
		// cue-on-target contact instant. Solve the quadratic
		//   t² + 2(ex·sx + ey·sy)·t + (ex² + ey² − 4·R²) = 0
		// with (ex, ey) = (cx − ox, cy − oy) and (sx, sy) unit; pick the
		// smaller positive root for the first hit.
		const TRAJECTORY_MAX = 1200;
		const ancestor = this.ancestor as { children?: unknown[] } | undefined;
		let minT = Number.POSITIVE_INFINITY;
		if (ancestor?.children) {
			for (const child of ancestor.children) {
				if (!(child instanceof Ball) || child === this) continue;
				if (child.isSinking()) continue;
				const ox = child.pos.x + child.width / 2;
				const oy = child.pos.y + child.height / 2;
				const ex = cx - ox;
				const ey = cy - oy;
				const b = 2 * (ex * sx + ey * sy);
				const c = ex * ex + ey * ey - 4 * BALL_RADIUS * BALL_RADIUS;
				const disc = b * b - 4 * c;
				if (disc < 0) continue; // ray misses this ball entirely
				const t = (-b - Math.sqrt(disc)) / 2; // nearer root
				if (t <= 0) continue; // behind us (or already overlapping)
				if (t < minT) minT = t;
			}
		}
		const trajLen = minT === Number.POSITIVE_INFINITY ? TRAJECTORY_MAX : minT;
		const ghostX = cx + sx * trajLen;
		const ghostY = cy + sy * trajLen;
		const prevLineDashLineWidth = renderer.lineWidth;
		renderer.setColor("#ffffff");
		renderer.lineWidth = 1.5;
		renderer.setLineDash([5, 5]);
		// Trim the dotted line so it starts at the cue ball edge and
		// ends at the ghost ball edge, not the centers — otherwise the
		// segments overlap with the ball graphics on both ends.
		renderer.strokeLine(
			cx + sx * BALL_RADIUS,
			cy + sy * BALL_RADIUS,
			ghostX - sx * BALL_RADIUS,
			ghostY - sy * BALL_RADIUS,
		);
		renderer.setLineDash([]);
		// Ghost ball outline at the predicted first contact. Same radius
		// as the cue ball so the player can sight whether the contact
		// edge will align with their target ball cleanly.
		renderer.setColor("#ffffff");
		renderer.strokeEllipse(ghostX, ghostY, BALL_RADIUS, BALL_RADIUS);
		renderer.lineWidth = prevLineDashLineWidth;
		// Cue retracts (gap between tip and ball) with power — visual
		// feedback for charge level.
		const retract = 4 + 22 * power;
		const tipGap = BALL_RADIUS + retract;
		const cueLen = 260;
		const tipThick = 4;
		const buttThick = 9;

		renderer.save();
		// Force-reset globalAlpha. Canvas2d `save()` saves the alpha but
		// previous draws (preDraw on this renderable, sibling sprite
		// draws, etc.) can leave the multiplied globalAlpha state at <1.
		// The cue stick uses hex colors with implicit alpha=1, but
		// globalAlpha multiplies into the final pixel — without this
		// reset the stick renders translucent against the felt.
		renderer.setGlobalAlpha(1);
		renderer.translate(cx, cy);
		renderer.rotate(backAngle);
		// Tapered body: three rectangles at increasing thickness from
		// tip → butt. Color goes light wood → brown → dark stain.
		const seg = cueLen / 3;
		renderer.setColor("#e0c896");
		renderer.fillRect(tipGap, -tipThick / 2, seg, tipThick);
		renderer.setColor("#a87547");
		renderer.fillRect(
			tipGap + seg,
			-(tipThick + buttThick) / 4,
			seg,
			(tipThick + buttThick) / 2,
		);
		renderer.setColor("#3a2010");
		renderer.fillRect(tipGap + seg * 2, -buttThick / 2, seg, buttThick);
		// Decorative red wrap band at the joint
		renderer.setColor("#b22222");
		renderer.fillRect(
			tipGap + seg * 2 - 6,
			-(buttThick / 2) - 1,
			5,
			buttThick + 2,
		);
		// White cue tip cap (where it actually contacts the ball)
		renderer.setColor("#f5f5ff");
		renderer.fillRect(tipGap - 4, -tipThick / 2 - 1, 4, tipThick + 2);
		renderer.restore();

		// Power meter — only drawn during aim (this branch is unreachable
		// otherwise; the idle-ready early-return above guards it).
		const r = Math.floor(255 * power);
		const g = Math.floor(255 * (1 - power));
		renderer.setColor(`rgb(${r}, ${g}, 64)`);
		renderer.fillRect(cx - 30, cy + BALL_RADIUS + 14, 60 * power, 3);
		renderer.setColor("#ffffff");
		renderer.strokeRect(cx - 30, cy + BALL_RADIUS + 14, 60, 3);
	}
}
