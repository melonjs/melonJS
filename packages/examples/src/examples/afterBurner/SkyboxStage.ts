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
	state,
	type WebGLRenderer,
	type World,
} from "melonjs";
import {
	GRID_ROW_COUNT,
	GRID_SCROLL_PER_S,
	HORIZON_BASE_FRACTION,
} from "./constants";
import type { Camera3dWithRoll } from "./types";

type Renderer = CanvasRenderer | WebGLRenderer;

// Pre-baked mountain peak silhouette — a sequence of (x, heightFrac)
// pairs covering one full tile, then tiled horizontally across the
// horizon. Heights are normalized [0, 1] and scaled to pixels per
// frame so the silhouette stays consistent as the canvas resizes.
// Spacing is INTENTIONALLY irregular and slopes are asymmetric (steep
// one side, gentle the other) so the ridges read as real mountains
// instead of dome-symmetric hills. Deliberate `h = 0` runs let the
// horizon line through between mountain clusters.
const MOUNTAIN_PEAKS: Array<[x: number, h: number]> = [
	[0.0, 0.0],
	// Cluster 1 — asymmetric ridge with a steep west face
	[0.025, 0.4],
	[0.06, 0.75],
	[0.08, 0.62],
	[0.11, 0.88],
	[0.13, 0.5],
	[0.17, 0.28],
	[0.21, 0.0],
	[0.25, 0.0],
	// Cluster 2 — twin peak, near peak taller and offset
	[0.28, 0.35],
	[0.31, 0.62],
	[0.345, 0.45],
	[0.37, 0.92],
	[0.4, 0.58],
	[0.43, 0.3],
	[0.46, 0.0],
	[0.52, 0.0],
	// Cluster 3 — single dominant peak with foothills
	[0.55, 0.42],
	[0.58, 0.68],
	[0.605, 0.55],
	[0.635, 1.0],
	[0.66, 0.7],
	[0.69, 0.4],
	[0.72, 0.0],
	[0.77, 0.0],
	// Cluster 4 — small ridge to break the spacing
	[0.8, 0.32],
	[0.84, 0.7],
	[0.86, 0.5],
	[0.89, 0.78],
	[0.92, 0.45],
	[0.96, 0.2],
	[1.0, 0.0],
];

// Indices of local-maximum peaks — pre-computed once at module load
// so the per-frame draw loop doesn't need the neighbor lookup. A peak
// is a summit when its height strictly exceeds both neighbors AND
// both neighbors are above zero (so we don't draw a "snow cap" on a
// height-0 floor segment).
const SUMMIT_INDICES: number[] = MOUNTAIN_PEAKS.map((p, i, arr) => {
	if (i === 0 || i === arr.length - 1) return -1;
	const prev = arr[i - 1][1];
	const next = arr[i + 1][1];
	if (p[1] > prev && p[1] > next && p[1] > 0.25) {
		return i;
	}
	return -1;
}).filter((i) => i >= 0);

export class SkyboxStage extends Stage {
	app: Application | null = null;
	sky: Gradient | null = null;
	ground: Gradient | null = null;
	orthoProjection = new Matrix3d();
	scrollT = 0; // 0..1, animated each frame
	// When true, the ground-grid scroll freezes (the rest of the
	// backdrop — gradients, horizon, roll — still tracks the camera).
	// Set by GameController on death so the world visibly stops with
	// the player; cleared on `reset()`. Engine-level pause already
	// freezes `update()` calls, so it doesn't need this gate.
	scrollPaused = false;

	override onResetEvent(app: Application): void {
		this.app = app;
		this.scrollT = 0;
		this.scrollPaused = false;
	}

	override update(dt: number): boolean {
		// `Stage.update` runs every frame even while the engine is
		// paused — only `GAME_UPDATE` is gated by `state.isPaused()`
		// in `Application._tick`. So we have to check the pause
		// state explicitly here to avoid the ground bands scrolling
		// during blur / explicit-pause windows. `scrollPaused` is the
		// separate game-over freeze toggled by `GameController`.
		if (!this.scrollPaused && !state.isPaused()) {
			this.scrollT = (this.scrollT + (dt / 1000) * GRID_SCROLL_PER_S) % 1;
		}
		return super.update(dt);
	}

	/**
	 * Paint one mountain range layer. Tiles three copies of
	 * {@link MOUNTAIN_PEAKS} horizontally (so any horizontal scroll
	 * lands at least one full tile inside the visible window) and
	 * paints snow caps on each summit on top of the silhouette.
	 *
	 * `xShift` lets the caller offset peaks within the tile so the
	 * near and far layers don't have summits stacked on top of each
	 * other, which would defeat the depth illusion.
	 */
	_drawMountainLayer(
		renderer: Renderer,
		horizonY: number,
		pad: number,
		tileW: number,
		baseH: number,
		offset: number,
		fillColor: string,
		snowColor: string,
		alpha: number,
		xShift: number,
	): void {
		renderer.setColor(fillColor);
		renderer.setGlobalAlpha(alpha);
		// Render 3 tiles (left neighbor, visible, right neighbor) so
		// the silhouette always fully covers the canvas regardless of
		// the parallax offset.
		for (let tile = -1; tile <= 1; tile++) {
			const baseX = tile * tileW + (offset % tileW) + xShift * tileW;
			renderer.beginPath();
			// Base sits AT the horizon (not below it). Adding any padding
			// here would land inside the ground rect and read as a solid
			// dark band — the bug the user spotted. The roll padding for
			// the backdrop is already handled by the over-sized sky /
			// ground rects, and the mountain polygon shares their
			// rotation frame, so no vertical extension is needed.
			renderer.moveTo(baseX, horizonY);
			for (const [px, ph] of MOUNTAIN_PEAKS) {
				renderer.lineTo(baseX + px * tileW, horizonY - ph * baseH);
			}
			renderer.lineTo(baseX + tileW, horizonY);
			renderer.closePath();
			renderer.fill();
		}

		// Snow caps — for each pre-computed summit, draw a small
		// triangle hugging the top 30% of the peak's height. Lifts
		// only the local maxima, ignoring floor segments and minor
		// shoulders so the snow reads as "summit catching the sun".
		renderer.setColor(snowColor);
		renderer.setGlobalAlpha(alpha);
		for (let tile = -1; tile <= 1; tile++) {
			const baseX = tile * tileW + (offset % tileW) + xShift * tileW;
			for (const i of SUMMIT_INDICES) {
				const [px, ph] = MOUNTAIN_PEAKS[i];
				const [lx, lh] = MOUNTAIN_PEAKS[i - 1];
				const [rx, rh] = MOUNTAIN_PEAKS[i + 1];
				const sx = baseX + px * tileW;
				const sy = horizonY - ph * baseH;
				// Just 18% of the way down each slope — small crest at
				// the very tip of the peak rather than a dome covering
				// the upper third (which read as rounded "hills").
				const t = 0.18;
				const llx = baseX + (px + (lx - px) * t) * tileW;
				const lly = horizonY - (ph + (lh - ph) * t) * baseH;
				const rrx = baseX + (px + (rx - px) * t) * tileW;
				const rry = horizonY - (ph + (rh - ph) * t) * baseH;
				renderer.beginPath();
				renderer.moveTo(llx, lly);
				renderer.lineTo(sx, sy);
				renderer.lineTo(rrx, rry);
				renderer.closePath();
				renderer.fill();
			}
		}
		renderer.setGlobalAlpha(1);
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
			// it back here (typed via Camera3dWithRoll). When the player
			// banks, the horizon and speed-line fan tilt with the cockpit.
			const roll = (camera as Partial<Camera3dWithRoll>).roll ?? 0;
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
			// Multi-stop gradient with each stop's color picked along a
			// natural-feeling brown ramp (chocolate → terracotta → warm
			// sand), spaced so no single midpoint produces a visible
			// hue inflection. A pure 2-stop gradient between the dark
			// and light browns interpolated through perceptually-flat
			// colors that the eye still picked out as a visible band;
			// laddering through the intermediate hues defeats that
			// because every neighboring pair is visually close.
			this.ground.addColorStop(0, "#2a1408");
			this.ground.addColorStop(0.18, "#3b1d10");
			this.ground.addColorStop(0.38, "#562a18");
			this.ground.addColorStop(0.58, "#754023");
			this.ground.addColorStop(0.8, "#9b5230");
			this.ground.addColorStop(1, "#b8623c");

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

			// ── Distant mountain silhouette ──
			// Two parallax layers: a FAR range painted first (smaller,
			// lighter, slower yaw response — "distant haze") and a NEAR
			// range painted second on top (taller, darker, full parallax).
			// Together they create the layered-ridge look of a real
			// horizon. Each layer also gets snowy summit caps on its
			// local-maximum peaks so the eye picks up "those are
			// MOUNTAINS, not just a sawtooth".
			//
			// The horizontal offset is `yaw * yawToPixels` — a parallax
			// constant tuned by eye so a full play-area yaw shifts the
			// near silhouette about half a tile, and the far one half
			// as much, giving the depth cue.
			const mountainBaseH = h * 0.18; // tallest peak at full height
			const tileW = w * 1.4; // a touch wider than the canvas so the seam never lines up
			const yaw = camera.yaw;
			const baseYawToPixels = -tileW * 0.5; // negative so yaw-right pulls peaks left
			this._drawMountainLayer(
				renderer,
				horizonClamped,
				pad,
				tileW,
				mountainBaseH * 0.6,
				yaw * baseYawToPixels * 0.45,
				"#3a1f33", // lighter haze purple for the distant range
				"#a87694", // dusty pink snow cap, low-saturation for distance
				0.75,
				0.5, // peak-X shift to break the seam between layers
			);
			this._drawMountainLayer(
				renderer,
				horizonClamped,
				pad,
				tileW,
				mountainBaseH,
				yaw * baseYawToPixels,
				"#1f0d1a", // deep silhouette purple for the near range
				"#ffd4c4", // warm sunset-lit snow on near peaks
				1.0,
				0,
			);

			// ── OutRun-style ground bands ──
			// Horizontal lines that scroll from the horizon toward the
			// camera, accelerating as they get closer (`progress = t*t`)
			// and thickening with proximity. Pure Z-axis motion — the
			// previous radial verticals were dropped because together
			// with the rows they read as a Tron grid more than a
			// receding ground plane. Each line extends `pad` past the
			// visible rect on each side, matching the sky/ground
			// fillRects above, so the camera roll rotation never
			// reveals an unpainted corner.
			const vpY = horizonClamped;
			const groundHeight = h - vpY;
			// Pre-pick the grid color once; only `setGlobalAlpha` and
			// `lineWidth` change per-line, so the renderer keeps the
			// same color binding across the whole pass.
			renderer.setColor("#ffd89c"); // warm cream — matches the sunset palette

			for (let i = 0; i < GRID_ROW_COUNT; i++) {
				const t = (i / GRID_ROW_COUNT + this.scrollT) % 1;
				const progress = t * t;
				const y = vpY + groundHeight * progress;
				// fade in on emerge, fade out near the camera so the
				// row pop is hidden behind the cockpit edge
				const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
				renderer.setGlobalAlpha(alpha * 0.2);
				renderer.lineWidth = 1 + progress * 2;
				renderer.strokeLine(-pad, y, w + pad, y);
			}

			renderer.setGlobalAlpha(1);
			renderer.lineWidth = 1;

			renderer.restore();
		}
		super.draw(renderer, world);
	}
}
