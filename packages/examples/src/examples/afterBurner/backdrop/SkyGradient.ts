/**
 * Sky + ground vertical gradient backdrop. Both gradients are baked
 * into a SINGLE tall offscreen canvas at construction — the previous
 * implementation called `renderer.createLinearGradient(…)` every
 * frame, which inside the engine rasterizes a power-of-two canvas
 * (~2 M pixels for a 1024×768 viewport) via Canvas2D's
 * `createLinearGradient` + `fillStyle` + `fillRect`. At 60 fps that's
 * ~120 M pixels of gradient bake per second purely to redraw colors
 * that never change.
 *
 * Now we bake once into a `BAKED_W × BAKED_H` canvas: the upper half
 * holds the sky stops, the lower half the ground stops. Each frame
 * the draw walk does two `drawImage` blits — vertical stretch to the
 * current horizon Y (so a moving horizon still works), horizontal
 * stretch to the canvas width + pad. Color resolution stays high
 * because `BAKED_H` is generous.
 *
 * The layer is added as a non-floating child of
 * `BackdropContainer`; the container applies the camera roll once
 * and sets the screen-ortho projection via the engine's floating
 * wrap, so this layer just draws.
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

// 1-pixel wide is enough — both gradients are purely vertical, so
// `drawImage` stretches the single pixel column across the canvas
// width. Big BAKED_H gives smooth interpolation for the color ramp.
const BAKED_W = 1;
const BAKED_SKY_H = 1024;
const BAKED_GROUND_H = 1024;
const SKY_STOPS: ReadonlyArray<[number, string]> = [
	[0, "#0d1442"], // deep blue zenith
	[0.55, "#4a2a82"], // purple mid-sky
	[0.85, "#d4476a"], // pink lower-sky
	[1, "#ff9c4a"], // bright orange at horizon
];
const GROUND_STOPS: ReadonlyArray<[number, string]> = [
	// Multi-stop brown ramp picked so no single midpoint produces a
	// visible hue inflection. See SkyboxStage history for the
	// rationale (purple→brown 2-stop banded; this 6-stop ladder
	// defeats that by keeping every neighboring pair visually close).
	[0, "#2a1408"],
	[0.18, "#3b1d10"],
	[0.38, "#562a18"],
	[0.58, "#754023"],
	[0.8, "#9b5230"],
	[1, "#b8623c"],
];
// Vertical pad to match the rest of the backdrop's roll-resilience —
// the rect overshoots top + bottom so the camera roll rotation
// doesn't reveal an unpainted corner.
const PAD = 200;

function bakeVerticalGradient(
	h: number,
	stops: ReadonlyArray<[number, string]>,
): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = BAKED_W;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return canvas;
	}
	const gradient = ctx.createLinearGradient(0, 0, 0, h);
	for (const [offset, color] of stops) {
		gradient.addColorStop(offset, color);
	}
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, BAKED_W, h);
	return canvas;
}

export class SkyGradient extends Renderable {
	private skyCanvas: HTMLCanvasElement;
	private groundCanvas: HTMLCanvasElement;

	constructor() {
		super(0, 0, 1, 1);
		this.alwaysUpdate = true;
		this.skyCanvas = bakeVerticalGradient(BAKED_SKY_H, SKY_STOPS);
		this.groundCanvas = bakeVerticalGradient(BAKED_GROUND_H, GROUND_STOPS);
	}

	override draw(renderer: Renderer, viewport: Camera3d): void {
		const w = renderer.width;
		const h = renderer.height;
		const horizonY = computeHorizonY(viewport, h);

		// Sky: from `-PAD` (top with roll padding) to `horizonY`. Vertical
		// stretch from 1024 → (horizonY + PAD); horizontal stretch from
		// 1 → (w + 2*PAD).
		renderer.drawImage(
			this.skyCanvas,
			0,
			0,
			BAKED_W,
			BAKED_SKY_H,
			-PAD,
			-PAD,
			w + PAD * 2,
			horizonY + PAD,
		);

		// Ground: from `horizonY` to `h + PAD`.
		renderer.drawImage(
			this.groundCanvas,
			0,
			0,
			BAKED_W,
			BAKED_GROUND_H,
			-PAD,
			horizonY,
			w + PAD * 2,
			h - horizonY + PAD,
		);
	}
}
