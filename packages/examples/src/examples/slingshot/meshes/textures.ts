/**
 * melonJS — Slingshot: the wood, stone and grass, painted in code.
 *
 * Each is drawn on a `CanvasRenderTarget` and handed to the loader as an
 * image (see `assets.ts`), so a mesh asks for it by name like any other
 * preloaded texture.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { CanvasRenderTarget } from "melonjs";
import { GRASS, type STONE, WOOD } from "../constants";

export type Paint = typeof WOOD | typeof STONE | typeof GRASS;

/**
 * Paint one 64 × 64 texture.
 * @param kind - wood planks, stone blocks or a grass checker
 * @returns the canvas it is painted on
 */
export const paint = (kind: Paint): HTMLCanvasElement => {
	const target = new CanvasRenderTarget(64, 64, { context: "2d" });
	const ctx = target.context as CanvasRenderingContext2D;
	if (kind === WOOD) {
		// planks, with a lighter grain line on two of them
		ctx.fillStyle = "#c98b4f";
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = "#b07440";
		for (let y = 0; y < 64; y += 16) {
			ctx.fillRect(0, y, 64, 3);
		}
		ctx.fillStyle = "#dca267";
		ctx.fillRect(0, 6, 64, 2);
		ctx.fillRect(0, 38, 64, 2);
	} else if (kind === GRASS) {
		// a two-tone checker
		ctx.fillStyle = "#7cb85a";
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = "#6fab4e";
		ctx.fillRect(0, 0, 32, 32);
		ctx.fillRect(32, 32, 32, 32);
	} else {
		// stone blocks laid in two courses
		ctx.fillStyle = "#9aa0a8";
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = "#868c94";
		ctx.fillRect(0, 31, 64, 3);
		ctx.fillRect(31, 0, 3, 31);
		ctx.fillRect(12, 34, 3, 30);
		ctx.fillRect(48, 34, 3, 30);
	}
	return target.canvas;
};
