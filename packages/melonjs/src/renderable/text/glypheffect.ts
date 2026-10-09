import type { Color } from "../../math/color.ts";

/** Mutable per-glyph output, reset before each call. Do not retain it. */
export interface GlyphEffectOutput {
	/** Horizontal offset in drawing pixels, after font scaling. */
	offsetX: number;
	/** Vertical offset in drawing pixels, after font scaling. */
	offsetY: number;
	/** Multiplicative tint; reset to opaque white before each call. */
	readonly tint: Color;
}

/** Reused per-glyph context. Read its values during the callback only. */
export interface GlyphEffectContext {
	/** UTF-16 character index across drawn lines, excluding line breaks. */
	index: number;
	/** The UTF-16 character represented by this glyph. */
	char: string;
	/** The BMFont character code. */
	code: number;
	/** Elapsed update time in milliseconds while the effect is enabled. */
	time: number;
	/** Unmodified glyph destination coordinates, after alignment and scaling. */
	x: number;
	y: number;
}

/** Modify the reused output to offset or tint a BitmapText glyph. */
export type GlyphEffect = (
	out: GlyphEffectOutput,
	context: GlyphEffectContext,
) => void;
