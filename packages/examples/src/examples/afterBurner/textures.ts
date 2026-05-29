/**
 * Canvas-based texture factories for the AfterBurner showcase. Built
 * once at GameController init so each Sprite shares the same image
 * cache entry — no PNG asset round-trip needed. Gradient stops use
 * melonJS's {@link Gradient} (rather than raw Canvas2D) so the color
 * stops live in the engine's gradient pipeline and stay swappable
 * with `renderer.createLinearGradient` / `createRadialGradient`
 * elsewhere in the codebase.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { Gradient } from "melonjs";

/**
 * Render a melonJS {@link Gradient} into a fresh standalone canvas of
 * the given size. Avoids `Gradient.toCanvas`'s shared render target
 * (which would clobber across factory calls) by materializing via
 * `toCanvasGradient(ctx)` directly onto our own 2D context.
 */
function bakeGradient(g: Gradient, w: number, h: number): HTMLCanvasElement {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d") as CanvasRenderingContext2D;
	ctx.fillStyle = g.toCanvasGradient(ctx);
	ctx.fillRect(0, 0, w, h);
	return c;
}

/**
 * Build a teardrop "thrust plume" texture used for engine-exhaust
 * sprites. The bright hot core sits near the TOP of the canvas; the
 * glow fades down and outward, so when the sprite's top is anchored at
 * the engine outlet, the visible flame extends behind the plane like a
 * real exhaust trail. Tinted at the Sprite level for warm engine glow.
 */
export function makeExhaustPuffTexture(): HTMLCanvasElement {
	const w = 32;
	const h = 40;
	// Radial gradient centered near the top, fades to transparent as it
	// approaches the bottom — gives a "hot at the outlet, cooling in the
	// plume" silhouette without needing per-pixel masking.
	const cx = w / 2;
	const cy = h * 0.22;
	const g = new Gradient("radial", [cx, cy, 0, cx, cy, h * 0.75])
		.addColorStop(0, "rgba(255, 255, 255, 1)")
		.addColorStop(0.25, "rgba(255, 220, 160, 0.85)")
		.addColorStop(0.6, "rgba(255, 120, 60, 0.35)")
		.addColorStop(1, "rgba(255, 60, 30, 0)");
	return bakeGradient(g, w, h);
}

/**
 * Build the targeting reticle texture — four arcade-style corner
 * brackets framing a small center dot. The reticle sits in world space
 * ahead of the player at `PLAYER_Z + RETICLE_FORWARD_Z`, so Camera3d
 * naturally scales it down with distance and tracks the player's bank.
 * Drawn in semi-transparent white so it reads against both sky and
 * ground without dominating the scene.
 */
export function makeReticleTexture(): HTMLCanvasElement {
	const size = 64;
	const c = document.createElement("canvas");
	c.width = size;
	c.height = size;
	const ctx = c.getContext("2d") as CanvasRenderingContext2D;
	// Soft white with a hint of warm — matches the After Burner HUD palette.
	ctx.strokeStyle = "rgba(255, 240, 200, 0.95)";
	ctx.fillStyle = "rgba(255, 240, 200, 0.95)";
	ctx.lineWidth = 3;
	ctx.lineCap = "square";

	const bracket = size * 0.25; // arm length of each corner bracket
	const pad = size * 0.1; // inset from each edge

	// Top-left bracket
	ctx.beginPath();
	ctx.moveTo(pad, pad + bracket);
	ctx.lineTo(pad, pad);
	ctx.lineTo(pad + bracket, pad);
	ctx.stroke();

	// Top-right
	ctx.beginPath();
	ctx.moveTo(size - pad - bracket, pad);
	ctx.lineTo(size - pad, pad);
	ctx.lineTo(size - pad, pad + bracket);
	ctx.stroke();

	// Bottom-left
	ctx.beginPath();
	ctx.moveTo(pad, size - pad - bracket);
	ctx.lineTo(pad, size - pad);
	ctx.lineTo(pad + bracket, size - pad);
	ctx.stroke();

	// Bottom-right
	ctx.beginPath();
	ctx.moveTo(size - pad - bracket, size - pad);
	ctx.lineTo(size - pad, size - pad);
	ctx.lineTo(size - pad, size - pad - bracket);
	ctx.stroke();

	// Small center dot for precise aim reference.
	ctx.beginPath();
	ctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
	ctx.fill();

	return c;
}

/**
 * Build a tiny ~12x32 canvas used as the bullet texture — a vertical
 * "laser bolt" with a hot white core falling off into a transparent
 * yellow halo.
 */
export function makeLaserBoltTexture(): HTMLCanvasElement {
	const w = 12;
	const h = 32;
	const g = new Gradient("linear", [0, 0, 0, h])
		.addColorStop(0, "rgba(255, 240, 100, 0)")
		.addColorStop(0.45, "rgba(255, 255, 200, 0.85)")
		.addColorStop(0.5, "rgba(255, 255, 255, 1)")
		.addColorStop(0.55, "rgba(255, 255, 200, 0.85)")
		.addColorStop(1, "rgba(255, 240, 100, 0)");
	return bakeGradient(g, w, h);
}
