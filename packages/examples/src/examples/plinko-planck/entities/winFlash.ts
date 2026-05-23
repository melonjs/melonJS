/**
 * melonJS — Plinko (Planck) example: full-viewport bet-win celebration.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * One-shot Renderable attached to the world on a bet win; auto-removes
 * itself when the animation completes. Layered for impact:
 *
 *   - viewport-wide gold wash fading quadratically (peaks in the
 *     first ~150 ms, gone by `WIN_FLASH_MS`),
 *   - two expanding shockwave rings centred on the winning slot
 *     (white hot ring + delayed gold trailing ring),
 *   - additive blend so both rings brighten pegs/walls they cross
 *     instead of obscuring them.
 *
 * Sized to dominate without being painful — the gold wash peaks
 * around 50 % alpha which lets the slot, sparks, and score-fly
 * still read through it.
 */

import type { Container, Renderer } from "melonjs";
import { Renderable, timer } from "melonjs";
import { COLOR_BALL, VIEWPORT_H, VIEWPORT_W, WIN_FLASH_MS } from "../constants";

export class WinFlash extends Renderable {
	private readonly startAt: number;
	private readonly cx: number;
	private readonly cy: number;

	constructor(cx: number, cy: number) {
		super(0, 0, VIEWPORT_W, VIEWPORT_H);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		// Below the HUD (depth 100) but above the playfield. ScoreFly
		// is depth 200, so the score popup still reads in front.
		this.depth = 150;
		this.floating = true;
		this.blendMode = "additive";
		this.startAt = timer.getTime();
		this.cx = cx;
		this.cy = cy;
	}

	override update(_dt: number): boolean {
		const elapsed = timer.getTime() - this.startAt;
		if (elapsed >= WIN_FLASH_MS) {
			const parent = this.ancestor as Container | null;
			parent?.removeChild(this);
		}
		return true;
	}

	override draw(renderer: Renderer): void {
		const elapsed = timer.getTime() - this.startAt;
		if (elapsed >= WIN_FLASH_MS) return;
		const t = elapsed / WIN_FLASH_MS;

		// 1) Full-screen gold wash — quadratic decay so the punch is
		//    front-loaded and the trail bleeds out cleanly.
		const flashAlpha = (1 - t) * (1 - t) * 0.55;
		renderer.save();
		renderer.setGlobalAlpha(flashAlpha);
		renderer.setColor(COLOR_BALL);
		renderer.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
		renderer.restore();

		// 2) Primary shockwave ring — white-hot, expands fast.
		const r1 = t * 400;
		const a1 = (1 - t) * 0.9;
		const lw1 = 10 + (1 - t) * 14;
		renderer.save();
		renderer.setGlobalAlpha(a1);
		renderer.setColor("#ffffff");
		renderer.lineWidth = lw1;
		renderer.strokeEllipse(this.cx, this.cy, r1, r1);
		renderer.restore();

		// 3) Trailing gold ring — delayed 20 %, slower, holds the
		//    afterglow.
		if (t > 0.2) {
			const t2 = (t - 0.2) / 0.8;
			const r2 = t2 * 280;
			const a2 = (1 - t2) * 0.7;
			const lw2 = 6 + (1 - t2) * 10;
			renderer.save();
			renderer.setGlobalAlpha(a2);
			renderer.setColor(COLOR_BALL);
			renderer.lineWidth = lw2;
			renderer.strokeEllipse(this.cx, this.cy, r2, r2);
			renderer.restore();
		}
	}
}
