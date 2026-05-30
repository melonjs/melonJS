/**
 * OutRun-style horizontal hash bands scrolling toward the camera.
 * `scrollT` advances in `update(dt)` and is gated by both
 * `state.isPaused()` (engine `Stage.update` runs through pauses) and
 * a local `scrollPaused` flag (set by GameController on death so the
 * ground visibly stops with the player).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import {
	type Camera3d,
	type CanvasRenderer,
	Renderable,
	state,
	type WebGLRenderer,
} from "melonjs";
import { GRID_ROW_COUNT, GRID_SCROLL_PER_S } from "../constants";
import { computeHorizonY } from "./horizonMath";

type Renderer = CanvasRenderer | WebGLRenderer;
const PAD = 200;
const ROW_COLOR = "#ffd89c";

export class GroundGrid extends Renderable {
	scrollT = 0;
	scrollPaused = false;

	constructor() {
		super(0, 0, 1, 1);
		this.alwaysUpdate = true;
	}

	override update(dt: number): boolean {
		if (!this.scrollPaused && !state.isPaused()) {
			this.scrollT = (this.scrollT + (dt / 1000) * GRID_SCROLL_PER_S) % 1;
		}
		return false;
	}

	override draw(renderer: Renderer, viewport: Camera3d): void {
		const w = renderer.width;
		const h = renderer.height;
		const vpY = computeHorizonY(viewport, h);
		const groundHeight = h - vpY;
		renderer.setColor(ROW_COLOR);
		for (let i = 0; i < GRID_ROW_COUNT; i++) {
			const t = (i / GRID_ROW_COUNT + this.scrollT) % 1;
			const progress = t * t;
			const y = vpY + groundHeight * progress;
			const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
			renderer.setGlobalAlpha(alpha * 0.2);
			renderer.lineWidth = 1 + progress * 2;
			renderer.strokeLine(-PAD, y, w + PAD, y);
		}
		renderer.setGlobalAlpha(1);
		renderer.lineWidth = 1;
	}
}
