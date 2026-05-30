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
 * Build a soft cool-white puff used for the contrail behind the jet.
 * Symmetric radial fade (bright dot at center) so the puff stays
 * coherent as it grows over its lifetime — unlike the exhaust teardrop,
 * which is shaped to imply a thrust direction.
 */
export function makeContrailPuffTexture(): HTMLCanvasElement {
	const size = 36;
	const cx = size / 2;
	const cy = size / 2;
	const g = new Gradient("radial", [cx, cy, 0, cx, cy, size / 2])
		.addColorStop(0, "rgba(255, 255, 255, 0.95)")
		.addColorStop(0.3, "rgba(220, 230, 255, 0.6)")
		.addColorStop(0.7, "rgba(180, 200, 255, 0.18)")
		.addColorStop(1, "rgba(160, 180, 255, 0)");
	return bakeGradient(g, size, size);
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
