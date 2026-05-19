/**
 * melonJS — Plinko (Planck) example: procedural background.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Draws the neon-cyberpunk backdrop entirely with `Renderer` primitives:
 *   1. solid dark-blue fill
 *   2. perspective grid lines (vanishing-point at the bottom centre)
 *      to give the field a synthwave-runner feel
 *   3. horizontal magenta "horizon" glow at the slot tops
 *
 * No sprites, no atlas, no off-screen canvas — everything is a handful
 * of `fillRect` + `strokeLine` calls per frame.
 */

import { Renderable, type Renderer } from "melonjs";
import {
	COLOR_BG,
	COLOR_GRID,
	COLOR_HORIZON_HI,
	COLOR_HORIZON_LO,
	SLOT_TOP,
	VIEWPORT_H,
	VIEWPORT_W,
} from "../constants";

/** Number of vertical grid lines fanning out from the vanishing point. */
const GRID_VERT_LINES = 13;
/** Number of horizontal grid rows. */
const GRID_HORIZ_ROWS = 8;
/** Bottom of the magenta sky-to-purple gradient above the horizon. */
const SKY_GRAD_BOTTOM_OFFSET = 60;

export class Background extends Renderable {
	private bgGradient: ReturnType<Renderer["createLinearGradient"]> | undefined;
	private skyGradient: ReturnType<Renderer["createLinearGradient"]> | undefined;

	constructor() {
		super(0, 0, VIEWPORT_W, VIEWPORT_H);
		this.anchorPoint.set(0, 0);
		// Background sits at the very back of the draw order so the
		// peg field, balls, and HUD layer on top correctly. Negative
		// depth puts it before z=0 content (everything else defaults
		// to z=0).
		this.depth = -100;
		this.alwaysUpdate = true;
	}

	override draw(renderer: Renderer): void {
		const horizonY = SLOT_TOP - 30;

		// Build the gradients on first draw. The renderer isn't
		// available at constructor time (it's only initialised after
		// `video.init`), and the bg gradient's coordinates depend on
		// the horizon position computed above.
		if (!this.bgGradient) {
			this.bgGradient = renderer.createLinearGradient(0, 0, 0, VIEWPORT_H);
			this.bgGradient.addColorStop(0, "#020216"); // near-black top
			this.bgGradient.addColorStop(0.7, COLOR_BG);
			this.bgGradient.addColorStop(1, "#0a0a28"); // softly lifted bottom
		}
		if (!this.skyGradient) {
			this.skyGradient = renderer.createLinearGradient(
				0,
				horizonY - SKY_GRAD_BOTTOM_OFFSET,
				0,
				horizonY,
			);
			// fades from transparent through deep purple to hot magenta
			// at the horizon line — classic synthwave silhouette.
			this.skyGradient.addColorStop(0, `${COLOR_HORIZON_LO}00`);
			this.skyGradient.addColorStop(0.6, `${COLOR_HORIZON_LO}55`);
			this.skyGradient.addColorStop(1, COLOR_HORIZON_HI);
		}

		// 1) Full-viewport dark gradient
		renderer.setColor(this.bgGradient);
		renderer.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);

		// 2) Synthwave perspective grid below the play field —
		// vanishing point off-screen below, lines fanning toward the
		// top, clipped at the horizon.
		const vpY = VIEWPORT_H + 80;
		const vpX = VIEWPORT_W / 2;

		renderer.setColor(COLOR_GRID);
		renderer.lineWidth = 1;
		// vertical (radial) lines
		for (let i = 0; i <= GRID_VERT_LINES; i++) {
			const t = i / GRID_VERT_LINES;
			const bottomX = t * VIEWPORT_W;
			const lineDx = bottomX - vpX;
			const lineDy = VIEWPORT_H - vpY;
			const k = (horizonY - vpY) / lineDy;
			const topX = vpX + lineDx * k;
			renderer.strokeLine(topX, horizonY, bottomX, VIEWPORT_H);
		}
		// horizontal rows — log-spaced toward horizon so the rows
		// compress visually as they approach the vanishing point.
		for (let i = 1; i <= GRID_HORIZ_ROWS; i++) {
			const t = i / GRID_HORIZ_ROWS;
			const y = horizonY + (VIEWPORT_H - horizonY) * t * t;
			renderer.strokeLine(0, y, VIEWPORT_W, y);
		}

		// 3) Sky gradient above the horizon — engine-native linear
		// gradient, gives a clean synthwave fade where the horizon
		// "sun band" used to be.
		renderer.setColor(this.skyGradient);
		renderer.fillRect(
			0,
			horizonY - SKY_GRAD_BOTTOM_OFFSET,
			VIEWPORT_W,
			SKY_GRAD_BOTTOM_OFFSET,
		);

		// 4) Hot horizon line — solid pixel-thin strip at the very
		// bottom of the sky gradient so the horizon reads as a sharp
		// glowing edge.
		renderer.setColor(COLOR_HORIZON_HI);
		renderer.fillRect(0, horizonY - 1, VIEWPORT_W, 3);
	}
}
