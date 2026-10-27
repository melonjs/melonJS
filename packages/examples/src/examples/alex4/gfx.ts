/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { BitmapText, Color, loader, type Renderer } from "melonjs";
import { SCALE } from "./constants";

type Frame = { x: number; y: number; w: number; h: number };

let frames: Record<string, Frame> = {};
let atlas: HTMLImageElement;

/** read the sprite atlas once everything is preloaded */
export function initGfx() {
	const json = loader.getJSON("sprites") as unknown as {
		frames: Record<string, { frame: Frame }>;
	};
	frames = {};
	for (const [name, f] of Object.entries(json.frames)) {
		frames[name] = f.frame;
	}
	atlas = loader.getImage("sprites") as HTMLImageElement;
}

/** size of a sprite, in original (unscaled) pixels */
export function spriteSize(name: string) {
	const f = frames[name];
	return { w: f.w / SCALE, h: f.h / SCALE };
}

export type DrawOptions = {
	flipX?: boolean;
	flipY?: boolean;
	/** rotation in radians, around the sprite center */
	angle?: number;
};

/**
 * draw a sprite from the atlas with its top-left corner at (x, y),
 * given in original (unscaled) pixels
 */
export function drawSprite(
	renderer: Renderer,
	name: string,
	x: number,
	y: number,
	opts?: DrawOptions,
) {
	const f = frames[name];
	if (f === undefined) {
		return;
	}
	const dx = Math.round(x) * SCALE;
	const dy = Math.round(y) * SCALE;
	if (!opts || (!opts.flipX && !opts.flipY && !opts.angle)) {
		renderer.drawImage(atlas, f.x, f.y, f.w, f.h, dx, dy, f.w, f.h);
		return;
	}
	renderer.save();
	renderer.translate(dx + f.w / 2, dy + f.h / 2);
	if (opts.angle) {
		renderer.rotate(opts.angle);
	}
	renderer.scale(opts.flipX ? -1 : 1, opts.flipY ? -1 : 1);
	renderer.drawImage(atlas, f.x, f.y, f.w, f.h, -f.w / 2, -f.h / 2, f.w, f.h);
	renderer.restore();
}

/** draw a source rectangle of a sprite (used for the scrolling water) */
export function drawSpritePart(
	renderer: Renderer,
	name: string,
	sx: number,
	sy: number,
	sw: number,
	sh: number,
	x: number,
	y: number,
) {
	const f = frames[name];
	if (f === undefined) {
		return;
	}
	renderer.drawImage(
		atlas,
		f.x + sx * SCALE,
		f.y + sy * SCALE,
		sw * SCALE,
		sh * SCALE,
		Math.round(x) * SCALE,
		Math.round(y) * SCALE,
		sw * SCALE,
		sh * SCALE,
	);
}

const fonts: Record<number, BitmapText> = {};
const OUTLINE = new Color(12, 68, 0);
const savedTint = new Color();
const fontScales: Record<number, number> = {};

/** draw a whole image with its top-left corner at (x, y), in canvas pixels */
export function blit(
	renderer: Renderer,
	image: HTMLImageElement,
	x: number,
	y: number,
) {
	const w = image.width;
	const h = image.height;
	renderer.drawImage(image, 0, 0, w, h, Math.round(x), Math.round(y), w, h);
}

/**
 * draw a line of text with one of the two atascii bitmap fonts
 * (they only have upper case glyphs). Coordinates are canvas pixels.
 */
export function drawText(
	renderer: Renderer,
	text: string | number,
	x: number,
	y: number,
	size: 32 | 40 = 32,
	align: "left" | "center" | "right" = "left",
	scale = 1,
	outline = false,
) {
	let font = fonts[size];
	if (font === undefined) {
		font = new BitmapText(0, 0, { font: `atascii${size}` });
		fonts[size] = font;
	}
	font.textAlign = align;
	if ((fontScales[size] ?? 1) !== scale) {
		font.resize(scale);
		fontScales[size] = scale;
	}
	font.setText(String(text).toUpperCase());
	if (outline) {
		// a dark outline, one original pixel wide (`textout_outline`)
		const d = SCALE * scale;
		savedTint.copy(renderer.currentTint);
		renderer.setTint(OUTLINE, savedTint.alpha);
		for (const [ox, oy] of [
			[-d, 0],
			[d, 0],
			[0, -d],
			[0, d],
		]) {
			font.pos.x = x + ox;
			font.pos.y = y + oy;
			font.draw(renderer);
		}
		renderer.setTint(savedTint, 1);
	}
	font.pos.x = x;
	font.pos.y = y;
	font.draw(renderer);
}

/** draw outlined text, readable over the light backgrounds */
export function drawLabel(
	renderer: Renderer,
	text: string | number,
	x: number,
	y: number,
	size: 32 | 40 = 32,
	align: "left" | "center" | "right" = "left",
) {
	drawText(renderer, text, x, y, size, align, 1, true);
}

/** width in canvas pixels of a line of text (fixed pitch fonts) */
export function textWidth(
	text: string | number,
	size: 32 | 40 = 32,
	scale = 1,
) {
	return String(text).length * size * scale;
}
