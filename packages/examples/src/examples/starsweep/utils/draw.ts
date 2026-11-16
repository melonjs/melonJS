/**
 * melonJS — Starsweep: what every drawing in the game shares.
 *
 * The renderers it runs on, and the soft glow drawn under characters,
 * power-ups and sparks. Everything drawn by hand is shapes (rects,
 * ellipses, arcs, lines, polygons) through the renderer, so it runs the
 * same on Canvas, WebGL and WebGPU.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { CanvasRenderer, WebGLRenderer, WebGPURenderer } from "melonjs";

/** the renderers the game runs on, which all draw every shape used here */
export type Renderer = CanvasRenderer | WebGLRenderer | WebGPURenderer;

/** A soft halo: stacked translucent discs, so it fades towards the edge. */
export const drawGlow = (
	r: Renderer,
	cx: number,
	cy: number,
	radius: number,
	color: string,
	alpha: number,
) => {
	r.setColor(color);
	r.setGlobalAlpha(alpha * 0.07);
	for (let k = 1; k >= 0.3; k -= 0.14) {
		r.fillEllipse(cx, cy, radius * k, radius * k);
	}
	r.setGlobalAlpha(1);
};
