/**
 * melonJS — Jungle Rabbit: the shared text style.
 *
 * Every label in the game is a `BitmapText` drawn from a baked atlas, because
 * `Text` cannot be crisp here. Crang is an outline face with no pixel grid —
 * at every size from 6 to 40, between 18% and 80% of its ink lands on partial
 * alpha — so the browser anti-aliases each glyph as it bakes it, and the
 * upscale from the 480x270 frame to the window magnifies every grey edge
 * pixel into a grey block. Nothing in the canvas API turns that off:
 * `antiAlias` and `imageSmoothingEnabled` govern image drawing, not glyph
 * rasterization. It is also why the same screen came out crisp in one browser
 * and soft in another — engines ship different font rasterizers, so they bake
 * different textures from the same face at the same size.
 *
 * The atlases carry the white-into-gold ramp and the black outline baked in,
 * two colours and nothing in between, so a label magnifies exactly like the
 * sprites beside it.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { BitmapText, type GlyphEffect } from "melonjs";

/**
 * The sizes the baked atlases provide.
 *
 * A bitmap face has the sizes it was baked at and no others, so this is a
 * three-step scale rather than a number. Each step has its OWN atlas, baked at
 * that size and drawn at a ratio of 1: a fractional ratio resamples hard
 * pixels unevenly, anything below 1 drops whole stems, and even a clean
 * doubling halves the detail, which in this face costs the counters first.
 */
export type TextStyle = "title" | "body" | "fine";

const STYLES = {
	/** headings */
	title: {
		font: "CrangTitle",
		fontData: "CrangTitle",
		size: 1,
		lineHeight: 44,
	},
	/** the HUD, prompts and stats */
	body: { font: "Crang", fontData: "Crang", size: 1, lineHeight: 22 },
	/** the credits line, baked unstroked — a full 1px outline on a 9px glyph
	    closes its counters */
	fine: { font: "CrangSmall", fontData: "CrangSmall", size: 1, lineHeight: 13 },
} as const satisfies Record<
	TextStyle,
	{ font: string; fontData: string; size: number; lineHeight: number }
>;

/**
 * The distance between two baselines, for laying a block out by hand.
 * @param style - the type scale step
 * @returns the line advance in buffer pixels
 */
export const lineHeightOf = (style: TextStyle) => STYLES[style].lineHeight;

/**
 * A line of menu text in the display face.
 *
 * Newlines are honoured: `BitmapText` aligns each line independently, so one
 * label is enough for a centred block. The per-line helper this replaces
 * existed only because `Text` re-anchors a gradient to every line box and
 * re-rasterizes its whole canvas on each `setText`; a baked atlas does
 * neither.
 * @param x - screen x
 * @param y - screen y
 * @param style - the type scale step
 * @param text - the string, split on newlines
 * @param align - horizontal alignment
 * @returns the configured, floating label
 */
export const menuText = (
	x: number,
	y: number,
	style: TextStyle,
	text: string,
	align: "left" | "center" | "right" = "center",
) => {
	const label = new BitmapText(x, y, {
		...STYLES[style],
		// the atlas already carries 1.45 line spacing in its `lineHeight`, so
		// this is a multiplier of 1, not of the font size
		lineHeight: 1,
		textAlign: align,
		text,
	});
	// `floating` exempts it from the perspective projection, but NOT from the
	// depth sort — z still means distance, so a HUD wants to be NEAR the
	// camera to draw last.
	label.floating = true;
	return label;
};

/**
 * The same, under the combo ramp.
 *
 * A second atlas PAGE against the same descriptor: identical geometry, hotter
 * colours. `fillStyle` could not do this — on a bitmap face it is a flat tint,
 * and no single multiplier maps one ramp's two ends onto another's.
 * @param x - screen x
 * @param y - screen y
 * @param text - the string
 * @returns the configured, floating label
 */
export const hotText = (x: number, y: number, text: string) => {
	const label = new BitmapText(x, y, {
		font: "CrangHot",
		fontData: "Crang",
		size: 1,
		lineHeight: 1,
		textAlign: "left",
		text,
	});
	label.floating = true;
	return label;
};

/**
 * A wave travelling along the line.
 *
 * `glyphEffect` is a `BitmapText` feature with no equivalent on `Text`: it
 * offsets and tints each glyph INSIDE the existing batch, so an animated
 * heading still costs one draw call and no re-rasterization.
 *
 * The phase comes from the glyph's POSITION, not its index, and that is the
 * whole difference between a wave and a mechanism. Stepping the phase per
 * glyph advances it as far across a narrow "I" as across a wide "M", so the
 * wavelength stretches and squashes with whatever the line happens to spell.
 * Taking it from `ctx.x` gives the wave one fixed length in pixels and lets
 * it travel through the text at a constant rate.
 *
 * The offset is ROUNDED, for the same reason `subPixel` defaults to false:
 * the engine adds it to the destination unchanged, and a fractional
 * destination in a 480x270 buffer magnified with nearest sampling makes the
 * glyph's OWN pixels come out uneven, differently each frame. That is a
 * shimmer, not motion. Whole pixels mean the travel is a handful of steps, so
 * the amplitude has to be big enough to give it several.
 * @param amplitude - how far a glyph rides, in whole buffer pixels
 * @param rate - radians per millisecond
 * @param spread - radians per buffer pixel along the line; the wavelength is
 * `2 * PI / spread`
 * @returns the effect, to assign to `label.glyphEffect`
 */
export const waveEffect =
	(amplitude: number, rate: number, spread: number): GlyphEffect =>
	(out, ctx) => {
		out.offsetY = Math.round(
			Math.sin(ctx.time * rate + ctx.x * spread) * amplitude,
		);
	};

/**
 * A deterministic angle per glyph per tick.
 *
 * The fractional part of a scaled sine: no state, no allocation, and the same
 * sequence every run, so two identical deaths shake identically.
 * @param index - the glyph
 * @param tick - which re-target
 * @returns an angle in radians
 */
const scatter = (index: number, tick: number) => {
	const h = Math.sin(index * 127.1 + tick * 311.7) * 43758.5453;
	return (h - Math.floor(h)) * Math.PI * 2;
};

/**
 * One hit, ringing down to nothing.
 *
 * Not a sine. A shake wants each glyph thrown somewhere unrelated to its
 * neighbours, so every glyph picks a RANDOM direction, holds it for a tick
 * and slides to the next — which is what separates a shake from the wave
 * above, where the whole line moves as one body.
 *
 * `ctx.time` counts from the moment an effect is ASSIGNED, not from when the
 * label was built, so attaching this at the moment of the crash starts it at
 * full strength. It decays on the square, so most of the movement is over
 * early and the tail is a settle.
 * @param amplitude - how far a glyph is thrown at the moment of impact, in
 * whole buffer pixels
 * @param durationMs - how long it rings before it is still
 * @param rate - how many times a second each glyph picks a new direction
 * @returns the effect, to assign to `label.glyphEffect`
 */
export const impactEffect =
	(amplitude: number, durationMs: number, rate: number): GlyphEffect =>
	(out, ctx) => {
		const left = 1 - ctx.time / durationMs;
		// settled — `out` is zeroed before each call, so this leaves the glyph
		// exactly where the layout put it
		if (left <= 0) {
			return;
		}
		const amp = amplitude * left * left;
		const tick = (ctx.time / 1000) * rate;
		const held = Math.floor(tick);
		const k = tick - held;
		const from = scatter(ctx.index, held);
		const to = scatter(ctx.index, held + 1);
		// rounded, like the wave: whole buffer pixels or it shimmers
		out.offsetX = Math.round(
			(Math.sin(from) + (Math.sin(to) - Math.sin(from)) * k) * amp,
		);
		out.offsetY = Math.round(
			(Math.cos(from) + (Math.cos(to) - Math.cos(from)) * k) * amp,
		);
	};
