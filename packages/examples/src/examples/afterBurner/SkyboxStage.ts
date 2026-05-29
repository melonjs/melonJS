/**
 * SkyboxStage — sunset sky → horizon → desert ground gradient with
 * animated speed-line chevrons, painted as a screen-space backdrop
 * **before** the world (and its perspective camera) draws.
 *
 * Done via an ortho projection swap so the gradient and lines fill the
 * canvas regardless of Camera3d's perspective matrix; the camera's
 * projection is restored before delegating to `super.draw` so gameplay
 * still renders correctly.
 *
 * Two effects keyed off the camera:
 * - **horizon Y tracks `camera.pitch`** — when the player banks up the
 *   horizon drops, when they dive it climbs. Pixel offset is
 *   `tan(pitch) / tan(fov / 2) * (screenH / 2)`, the standard
 *   perspective→screen formula for a point at infinity.
 * - **speed-line chevrons** scroll outward from the vanishing point on
 *   the ground each frame, animated by `scrollT` advanced from
 *   `update(dt)`. Sells the "Mach-2 forward motion" feel.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import {
	type Application,
	type Camera3d,
	type CanvasRenderer,
	type Gradient,
	Matrix3d,
	Stage,
	type WebGLRenderer,
	type World,
} from "melonjs";
import {
	HORIZON_BASE_FRACTION,
	SPEED_LINE_COUNT,
	SPEED_LINE_SCROLL_PER_S,
} from "./constants";

type Renderer = CanvasRenderer | WebGLRenderer;

export class SkyboxStage extends Stage {
	app: Application | null = null;
	sky: Gradient | null = null;
	ground: Gradient | null = null;
	orthoProjection = new Matrix3d();
	scrollT = 0; // 0..1, animated each frame

	override onResetEvent(app: Application): void {
		this.app = app;
		this.scrollT = 0;
	}

	override update(dt: number): boolean {
		this.scrollT = (this.scrollT + (dt / 1000) * SPEED_LINE_SCROLL_PER_S) % 1;
		return super.update(dt);
	}

	override draw(renderer: Renderer, world: World): void {
		if (this.app) {
			const w = renderer.width;
			const h = renderer.height;

			// Read the live Camera3d from this stage's own cameras map
			// — `app.viewport` is set at reset and can lag a stage swap.
			const camera = this.cameras.get("default") as Camera3d | undefined;
			if (!camera) {
				super.draw(renderer, world);
				return;
			}

			// Horizon Y from camera pitch. With Y-down + the lookAt
			// math in Camera3d, negative pitch = looking down (target
			// below camera) → horizon rises on screen; positive pitch
			// = looking up → horizon drops. `tan(pitch) / tan(fov/2)`
			// gives the NDC offset, *h/2 converts to pixels.
			const fov = camera.fov;
			const pitchOffsetPx =
				(Math.tan(camera.pitch) / Math.tan(fov / 2)) * (h / 2);
			const horizon = h * HORIZON_BASE_FRACTION + pitchOffsetPx;
			// clamp so the ground is always at least a sliver visible
			// (prevents pathological all-sky / all-ground frames during
			// extreme pitches)
			const horizonClamped = Math.max(40, Math.min(h - 40, horizon));

			// Swap to a screen-space ortho projection so fillRect lands
			// on actual pixels, not perspective-projected world rects.
			renderer.save();
			renderer.resetTransform();
			this.orthoProjection.ortho(0, w, h, 0, -1, 1);
			renderer.setProjection(this.orthoProjection);

			// Apply the camera roll to the backdrop. Camera3d doesn't
			// have a built-in `roll` field, so we hang one on the
			// camera object from GameController.updateCamera and read
			// it back here (typed via cast). When the player banks,
			// the horizon and speed-line fan tilt with the cockpit.
			const roll = (camera as Camera3d & { roll?: number }).roll ?? 0;
			if (roll !== 0) {
				renderer.translate(w / 2, h / 2);
				renderer.rotate(roll);
				renderer.translate(-w / 2, -h / 2);
			}

			// Rebuild the gradients per frame so they stretch correctly
			// with the moving horizon. Two `createLinearGradient` calls
			// per frame is cheap (just object allocation + stop list)
			// and lets the horizon Y be fully dynamic.
			this.sky = renderer.createLinearGradient(0, 0, 0, horizonClamped);
			this.sky.addColorStop(0, "#0d1442"); // deep blue zenith
			this.sky.addColorStop(0.55, "#4a2a82"); // purple mid-sky
			this.sky.addColorStop(0.85, "#d4476a"); // pink lower-sky
			this.sky.addColorStop(1, "#ff9c4a"); // bright orange at horizon

			this.ground = renderer.createLinearGradient(0, horizonClamped, 0, h);
			this.ground.addColorStop(0, "#b8623c"); // warm sand at horizon
			this.ground.addColorStop(0.3, "#5c2e1a"); // mid-ground brown
			this.ground.addColorStop(1, "#1a0e08"); // near-black under-camera

			// Oversize the rects by `pad` on every side so the roll
			// rotation doesn't reveal black corners. 200px buffer covers
			// the maximum bank without over-painting noticeably.
			const pad = 200;
			renderer.setColor(this.sky);
			renderer.fillRect(-pad, -pad, w + pad * 2, horizonClamped + pad);
			renderer.setColor(this.ground);
			renderer.fillRect(
				-pad,
				horizonClamped,
				w + pad * 2,
				h - horizonClamped + pad,
			);

			// Speed-line chevrons. Each line goes from the vanishing
			// point (centerX, horizon) outward to a position on the
			// bottom edge. We animate by interpolating each line's
			// progress 0→1 from vanishing point to bottom edge — t
			// near 0 is short stub near the horizon, t near 1 is a
			// long streak reaching the bottom of the screen. As t
			// wraps, lines disappear off-screen and respawn at the
			// horizon: instant Mach-2 forward-motion cue.
			const vpX = w / 2;
			const vpY = horizonClamped;
			renderer.setColor("#ffd89c"); // warm cream — matches the sunset palette
			renderer.lineWidth = 2;
			for (let i = 0; i < SPEED_LINE_COUNT; i++) {
				const t = (i / SPEED_LINE_COUNT + this.scrollT) % 1;
				// non-linear distribution: lines accelerate as they
				// approach the camera (matches real perspective motion)
				const progress = t * t;
				const groundHeight = h - vpY;
				// each line's X spread at t=0 is 0 (at vp), at t=1 is
				// half the canvas width on each side
				const spread = w * 0.7;
				// distribute lines around the screen by their index —
				// avoids all lines being on top of each other when scrollT
				// is the same for every line at evenly spaced t's
				const angleOffset = (i / SPEED_LINE_COUNT) * 2 * Math.PI;
				const sideX = Math.cos(angleOffset) * spread * progress;
				const endX = vpX + sideX;
				const endY = vpY + groundHeight * progress;
				// fade the line in as it leaves the horizon, fade out
				// just before exiting bottom — avoids hard pop-in/out
				const alpha =
					t < 0.1
						? t / 0.1 // fade in
						: t > 0.9
							? (1 - t) / 0.1 // fade out
							: 1;
				renderer.setGlobalAlpha(alpha * 0.7);
				renderer.strokeLine(vpX, vpY, endX, endY);
			}
			renderer.setGlobalAlpha(1);

			renderer.restore();
		}
		super.draw(renderer, world);
	}
}
