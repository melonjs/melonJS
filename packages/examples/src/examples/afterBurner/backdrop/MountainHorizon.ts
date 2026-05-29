/**
 * Two parallax mountain layers (far haze + near silhouette) baked
 * into offscreen canvases at construction. Per frame the draw walk
 * blits each layer three times across the horizon for tile coverage
 * and lets the engine project everything through the screen ortho
 * set by the parent {@link BackdropContainer}.
 *
 * Yaw parallax (~half a tile across the play-area width) is computed
 * fresh each frame from the active camera; the near range moves at
 * full rate, the far range at ~45% to give a depth cue.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import {
	type Camera3d,
	type CanvasRenderer,
	Renderable,
	type WebGLRenderer,
} from "melonjs";
import { computeHorizonY } from "./horizonMath";

type Renderer = CanvasRenderer | WebGLRenderer;

// Pre-baked peak silhouette — irregular spacing + asymmetric slopes
// so the ridges read like real mountains. Deliberate `h = 0` runs
// give the horizon visible gaps between mountain clusters.
const MOUNTAIN_PEAKS: ReadonlyArray<readonly [x: number, h: number]> = [
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
// so the bake loop doesn't redo the neighbor lookup. Summit needs
// strictly higher than both neighbors AND above 0.25 so floor segments
// and minor shoulders don't get snow.
const SUMMIT_INDICES: number[] = MOUNTAIN_PEAKS.map((p, i, arr) => {
	if (i === 0 || i === arr.length - 1) return -1;
	const prev = arr[i - 1][1];
	const next = arr[i + 1][1];
	if (p[1] > prev && p[1] > next && p[1] > 0.25) {
		return i;
	}
	return -1;
}).filter((i) => i >= 0);

interface BakedLayer {
	canvas: HTMLCanvasElement;
	tileW: number;
	tileH: number;
	cacheKey: string;
}

function bakeLayer(
	tileW: number,
	baseH: number,
	fillColor: string,
	snowColor: string,
): BakedLayer {
	const canvas = document.createElement("canvas");
	canvas.width = Math.ceil(tileW);
	canvas.height = Math.ceil(baseH);
	const tileH = canvas.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return { canvas, tileW: canvas.width, tileH, cacheKey: "" };
	}
	// Silhouette
	ctx.fillStyle = fillColor;
	ctx.beginPath();
	ctx.moveTo(0, tileH);
	for (const [px, ph] of MOUNTAIN_PEAKS) {
		ctx.lineTo(px * tileW, tileH - ph * baseH);
	}
	ctx.lineTo(tileW, tileH);
	ctx.closePath();
	ctx.fill();
	// Snow caps
	ctx.fillStyle = snowColor;
	for (const i of SUMMIT_INDICES) {
		const [px, ph] = MOUNTAIN_PEAKS[i];
		const [lx, lh] = MOUNTAIN_PEAKS[i - 1];
		const [rx, rh] = MOUNTAIN_PEAKS[i + 1];
		const sx = px * tileW;
		const sy = tileH - ph * baseH;
		const t = 0.18;
		const llx = (px + (lx - px) * t) * tileW;
		const lly = tileH - (ph + (lh - ph) * t) * baseH;
		const rrx = (px + (rx - px) * t) * tileW;
		const rry = tileH - (ph + (rh - ph) * t) * baseH;
		ctx.beginPath();
		ctx.moveTo(llx, lly);
		ctx.lineTo(sx, sy);
		ctx.lineTo(rrx, rry);
		ctx.closePath();
		ctx.fill();
	}
	return {
		canvas,
		tileW: canvas.width,
		tileH,
		cacheKey: `${canvas.width}x${tileH}|${fillColor}|${snowColor}`,
	};
}

const FAR_FILL = "#3a1f33";
const FAR_SNOW = "#a87694";
const NEAR_FILL = "#1f0d1a";
const NEAR_SNOW = "#ffd4c4";

export class MountainHorizon extends Renderable {
	private bakedFar: BakedLayer | null = null;
	private bakedNear: BakedLayer | null = null;

	constructor() {
		super(0, 0, 1, 1);
		this.alwaysUpdate = true;
	}

	private getOrBake(
		current: BakedLayer | null,
		tileW: number,
		baseH: number,
		fillColor: string,
		snowColor: string,
	): BakedLayer {
		const w = Math.ceil(tileW);
		const h = Math.ceil(baseH);
		const key = `${w}x${h}|${fillColor}|${snowColor}`;
		if (current && current.cacheKey === key) {
			return current;
		}
		return bakeLayer(tileW, baseH, fillColor, snowColor);
	}

	override draw(renderer: Renderer, viewport: Camera3d): void {
		const w = renderer.width;
		const h = renderer.height;
		const horizonY = computeHorizonY(viewport, h);
		const mountainBaseH = h * 0.18;
		const tileW = w * 1.4;
		const yaw = viewport.yaw;
		const baseYawToPixels = -tileW * 0.5;

		// Far range (smaller, lighter, slower parallax).
		this.bakedFar = this.getOrBake(
			this.bakedFar,
			tileW,
			mountainBaseH * 0.6,
			FAR_FILL,
			FAR_SNOW,
		);
		this.drawLayer(
			renderer,
			horizonY,
			this.bakedFar,
			tileW,
			yaw * baseYawToPixels * 0.45,
			0.75,
			0.5,
		);

		// Near range (full height, deepest silhouette, full parallax).
		this.bakedNear = this.getOrBake(
			this.bakedNear,
			tileW,
			mountainBaseH,
			NEAR_FILL,
			NEAR_SNOW,
		);
		this.drawLayer(
			renderer,
			horizonY,
			this.bakedNear,
			tileW,
			yaw * baseYawToPixels,
			1.0,
			0,
		);
	}

	private drawLayer(
		renderer: Renderer,
		horizonY: number,
		baked: BakedLayer,
		tileW: number,
		offset: number,
		alpha: number,
		xShift: number,
	): void {
		renderer.setGlobalAlpha(alpha);
		const top = horizonY - baked.tileH;
		for (let tile = -1; tile <= 1; tile++) {
			const baseX = tile * tileW + (offset % tileW) + xShift * tileW;
			renderer.drawImage(
				baked.canvas,
				0,
				0,
				baked.tileW,
				baked.tileH,
				baseX,
				top,
				baked.tileW,
				baked.tileH,
			);
		}
		renderer.setGlobalAlpha(1);
	}
}
