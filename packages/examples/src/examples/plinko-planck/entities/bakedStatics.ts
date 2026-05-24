/**
 * melonJS — Plinko (Planck) example: pre-baked static backdrop.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Renders the static parts of the scene — background gradient + grid +
 * synthwave horizon, side walls + slot dividers + floor, and the
 * base appearance of every peg — into a single `CanvasRenderTarget`
 * **once** at scene init, then `drawImage`s the resulting bitmap each
 * frame.
 *
 * Replaces ~700 per-frame draw calls (4-layer glow stacks on 100 pegs,
 * multi-layer wall halos, background grid lines) with a single
 * texture upload + one `drawImage`. The bake is rasterised with the
 * native `Canvas2D` API into an offscreen canvas; melonJS's renderer
 * handles texture upload to the WebGL backend transparently when we
 * pass `target.canvas` to `drawImage`.
 *
 * Dynamic peg-flash overlays still render per-frame (in `Peg.draw`)
 * because they're transient state — only the BASE peg appearance is
 * baked in. Same for moving entities (balls, trails, score-fly,
 * spark bursts), which always render normally.
 */

import { CanvasRenderTarget, Renderable, type Renderer } from "melonjs";
import {
	COLOR_BG,
	COLOR_GRID,
	COLOR_HORIZON_HI,
	COLOR_HORIZON_LO,
	COLOR_PEG,
	COLOR_PEG_HOT,
	COLOR_WALL,
	COLOR_WALL_HOT,
	DROP_BAND_Y,
	PEG_COLS,
	PEG_FIELD_TOP,
	PEG_RADIUS,
	PEG_ROWS,
	PEG_X_SPACING,
	PEG_Y_SPACING,
	PLAY_LEFT,
	PLAY_RIGHT,
	PLAY_W,
	SLOT_COLORS,
	SLOT_COUNT,
	SLOT_HEIGHT,
	SLOT_SCORES,
	SLOT_TOP,
	SLOT_WALL_TOP,
	tierForScore,
	VIEWPORT_H,
	VIEWPORT_W,
} from "../constants";

/** Wall thickness (matches WALL_THICKNESS in wall.ts). */
const WALL_T = 6;
/** Synthwave grid: vertical lines fanning out from the bottom-centre vanishing point. */
const GRID_VERT_LINES = 13;
/** Synthwave grid: horizontal rows above the horizon. */
const GRID_HORIZ_ROWS = 8;
/** Bottom of the magenta sky-to-purple gradient above the horizon. */
const SKY_GRAD_BOTTOM_OFFSET = 60;

export class BakedStatics extends Renderable {
	private readonly target: CanvasRenderTarget;

	constructor() {
		super(0, 0, VIEWPORT_W, VIEWPORT_H);
		this.anchorPoint.set(0, 0);
		// Sits at the very back of the draw order.
		this.depth = -100;
		this.alwaysUpdate = true;

		// Allocate an offscreen 2D-canvas target at the game's source
		// viewport resolution. `transparent: true` lets the engine's
		// fit-scale background show through behind anti-aliased edges.
		// `antiAlias: true` softens the procedural strokes.
		this.target = new CanvasRenderTarget(VIEWPORT_W, VIEWPORT_H, {
			context: "2d",
			transparent: true,
			antiAlias: true,
		});
		this.bakeAll();
	}

	private bakeAll(): void {
		const ctx = this.target.context as CanvasRenderingContext2D;
		ctx.save();
		this.bakeBackground(ctx);
		this.bakeSlotBins(ctx);
		this.bakeWalls(ctx);
		this.bakeBasePegs(ctx);
		ctx.restore();
	}

	/**
	 * Slot bin gradients + tier bands + edge highlights. Same geometry
	 * `buildSlots()` produces in `slot.ts`. SlotBin's per-frame draw is
	 * reduced to the post-landing pulse overlay (a single white rect
	 * with animated alpha) — see `SlotBin.draw`.
	 */
	private bakeSlotBins(ctx: CanvasRenderingContext2D): void {
		const slotWidth = (PLAY_RIGHT - PLAY_LEFT) / SLOT_COUNT;
		for (let i = 0; i < SLOT_COUNT; i++) {
			const x = PLAY_LEFT + i * slotWidth;
			const y = SLOT_TOP;
			const w = slotWidth;
			const h = SLOT_HEIGHT;
			const score = SLOT_SCORES[i % SLOT_SCORES.length];
			const color = SLOT_COLORS[tierForScore(score)];

			// Vertical fill gradient — transparent top → solid bottom.
			const grad = ctx.createLinearGradient(x, y, x, y + h);
			grad.addColorStop(0, `${color}10`);
			grad.addColorStop(0.4, `${color}80`);
			grad.addColorStop(1, color);
			ctx.fillStyle = grad;
			ctx.globalAlpha = 0.7;
			ctx.fillRect(x, y, w, h);
			ctx.globalAlpha = 1;

			// Score-tier band at the top — solid color stripe.
			ctx.fillStyle = color;
			ctx.globalAlpha = 0.85;
			ctx.fillRect(x, y, w, 4);
			ctx.globalAlpha = 1;

			// Hot top edge — base intensity, brightens during pulse
			// via the SlotBin overlay.
			ctx.fillStyle = "#ffffff";
			ctx.globalAlpha = 0.5;
			ctx.fillRect(x, y, w, 1);
			ctx.globalAlpha = 1;
		}
	}

	/** Synthwave gradient + perspective grid + horizon strip. */
	private bakeBackground(ctx: CanvasRenderingContext2D): void {
		// 1) Full-viewport dark vertical gradient (lifted slightly at bottom).
		const bgGrad = ctx.createLinearGradient(0, 0, 0, VIEWPORT_H);
		bgGrad.addColorStop(0, "#020216");
		bgGrad.addColorStop(0.7, COLOR_BG);
		bgGrad.addColorStop(1, "#0a0a28");
		ctx.fillStyle = bgGrad;
		ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);

		// 2) Perspective grid below the horizon — vanishing point off-
		// screen below, lines fanning toward the top, clipped at the
		// horizon line just under the slot tops.
		const horizonY = SLOT_TOP - 30;
		const vpY = VIEWPORT_H + 80;
		const vpX = VIEWPORT_W / 2;
		ctx.strokeStyle = COLOR_GRID;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i <= GRID_VERT_LINES; i++) {
			const t = i / GRID_VERT_LINES;
			const bottomX = t * VIEWPORT_W;
			const lineDx = bottomX - vpX;
			const lineDy = VIEWPORT_H - vpY;
			const k = (horizonY - vpY) / lineDy;
			const topX = vpX + lineDx * k;
			ctx.moveTo(topX, horizonY);
			ctx.lineTo(bottomX, VIEWPORT_H);
		}
		for (let i = 1; i <= GRID_HORIZ_ROWS; i++) {
			const t = i / GRID_HORIZ_ROWS;
			const y = horizonY + (VIEWPORT_H - horizonY) * t * t;
			ctx.moveTo(0, y);
			ctx.lineTo(VIEWPORT_W, y);
		}
		ctx.stroke();

		// 3) Sky gradient strip above the horizon (deep purple → magenta).
		const skyGrad = ctx.createLinearGradient(
			0,
			horizonY - SKY_GRAD_BOTTOM_OFFSET,
			0,
			horizonY,
		);
		skyGrad.addColorStop(0, `${COLOR_HORIZON_LO}00`);
		skyGrad.addColorStop(0.6, `${COLOR_HORIZON_LO}55`);
		skyGrad.addColorStop(1, COLOR_HORIZON_HI);
		ctx.fillStyle = skyGrad;
		ctx.fillRect(
			0,
			horizonY - SKY_GRAD_BOTTOM_OFFSET,
			VIEWPORT_W,
			SKY_GRAD_BOTTOM_OFFSET,
		);

		// 4) Hot horizon line.
		ctx.fillStyle = COLOR_HORIZON_HI;
		ctx.fillRect(0, horizonY - 1, VIEWPORT_W, 3);
	}

	/** Side walls + slot dividers + floor. Same geometry as wall.ts. */
	private bakeWalls(ctx: CanvasRenderingContext2D): void {
		const drawWall = (x: number, y: number, w: number, h: number) => {
			// Outer halo — 2 alpha rects expanding outward.
			for (let i = 2; i >= 1; i--) {
				const a = 0.18 * (1 - (i - 1) / 2);
				ctx.fillStyle = `rgba(255, 16, 240, ${a})`;
				ctx.fillRect(x - i * 2, y - i * 2, w + i * 4, h + i * 4);
			}
			// Body
			ctx.fillStyle = COLOR_WALL;
			ctx.fillRect(x, y, w, h);
			// Hot inner centerline highlight
			ctx.fillStyle = `rgba(255, 255, 255, 0.85)`;
			if (w >= h) {
				ctx.fillRect(x + 2, y + Math.max(1, h / 2 - 1), w - 4, 2);
			} else {
				ctx.fillRect(x + Math.max(1, w / 2 - 1), y + 2, 2, h - 4);
			}
		};
		const fieldTop = DROP_BAND_Y;
		const fieldBottom = SLOT_TOP;
		// Left + right side walls.
		drawWall(PLAY_LEFT - WALL_T, fieldTop, WALL_T, fieldBottom - fieldTop);
		drawWall(PLAY_RIGHT, fieldTop, WALL_T, fieldBottom - fieldTop);
		// Slot dividers.
		const slotWidth = (PLAY_RIGHT - PLAY_LEFT) / SLOT_COUNT;
		const dividerH = VIEWPORT_H - SLOT_WALL_TOP;
		for (let i = 0; i <= SLOT_COUNT; i++) {
			const x = PLAY_LEFT + i * slotWidth - WALL_T / 2;
			drawWall(x, SLOT_WALL_TOP, WALL_T, dividerH);
		}
		// Floor strip. `drawWall` uses a single magenta tone for every
		// wall — COLOR_WALL_HOT (kept imported for theme parity with
		// peg.ts) is the white highlight applied via the hot centre
		// stripe, not a second wall colour.
		drawWall(PLAY_LEFT, VIEWPORT_H - WALL_T, PLAY_RIGHT - PLAY_LEFT, WALL_T);
		// Unused-symbol guard so the import doesn't drop on lint.
		void COLOR_WALL_HOT;
	}

	/** Base appearance of every peg in the triangular grid. */
	private bakeBasePegs(ctx: CanvasRenderingContext2D): void {
		const fieldW = (PEG_COLS - 1) * PEG_X_SPACING;
		const baseX = PLAY_LEFT + (PLAY_W - fieldW) / 2;

		const drawPeg = (cx: number, cy: number) => {
			// Outer glow halo — 3 alpha rings.
			for (let i = 3; i >= 1; i--) {
				const a = 0.22 * (1 - (i - 1) / 3);
				const r = PEG_RADIUS + i * 3;
				ctx.fillStyle = `rgba(0, 255, 255, ${a})`;
				ctx.beginPath();
				ctx.arc(cx, cy, r, 0, Math.PI * 2);
				ctx.fill();
			}
			// Core cyan disc.
			ctx.fillStyle = COLOR_PEG;
			ctx.beginPath();
			ctx.arc(cx, cy, PEG_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			// Hot-white inner highlight (base intensity, no flash).
			ctx.fillStyle = `rgba(255, 255, 255, 0.7)`;
			ctx.beginPath();
			ctx.arc(cx, cy, PEG_RADIUS * 0.5, 0, Math.PI * 2);
			ctx.fill();
		};

		// Wall-adjacent peg columns (one peg-radius inside each wall) —
		// mirror the gutter-fill pegs added in `peg.ts:buildPegField`
		// so the baked visual matches the collision geometry.
		const wallLeftCx = PLAY_LEFT + PEG_RADIUS;
		const wallRightCx = PLAY_RIGHT - PEG_RADIUS;
		for (let row = 0; row < PEG_ROWS; row++) {
			const isOdd = row % 2 === 1;
			const colsThisRow = isOdd ? PEG_COLS - 1 : PEG_COLS;
			const xOffset = isOdd ? PEG_X_SPACING / 2 : 0;
			const y = PEG_FIELD_TOP + row * PEG_Y_SPACING;
			for (let col = 0; col < colsThisRow; col++) {
				const x = baseX + xOffset + col * PEG_X_SPACING;
				drawPeg(x, y);
			}
			if (isOdd) {
				drawPeg(wallLeftCx, y);
				drawPeg(wallRightCx, y);
			}
		}
		void COLOR_PEG_HOT; // unused-symbol guard (hot is the white highlight inline)
	}

	override draw(renderer: Renderer): void {
		// Single drawImage per frame — the engine handles texture
		// upload + caching transparently. WebGL batches this into one
		// quad draw.
		renderer.drawImage(this.target.canvas, 0, 0);
	}
}
