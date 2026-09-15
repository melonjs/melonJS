/**
 * melonJS — Jungle Rabbit: the menus' shared text style.
 *
 * The white-into-gold ramp is a `Gradient` handed straight to `fillStyle` —
 * the same object `Renderer#setColor` takes, built the way the canvas API
 * builds one. It colours the FILL only, because `Text` strokes in a separate
 * pass, so the black outline stays black without the game having to tell the
 * two apart.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { game, Text } from "melonjs";
import { TEXT_RAMP_BOTTOM, TEXT_RAMP_TOP } from "./constants";

/**
 * A line of menu text: the display face, a thin black outline, and the
 * white-into-gold ramp.
 * @param x - screen x
 * @param y - screen y
 * @param size - font size in the internal buffer's pixels
 * @param text - the string
 * @param align - horizontal alignment
 * @param outline - stroke width in buffer pixels. The stroke is drawn OVER the
 * fill, so it eats into the glyph rather than sitting outside it — at the
 * default 1 a 9px line is nearly 11% of the glyph height and closes the
 * counters up entirely. Small text wants a proportionally thinner one.
 * @returns the configured, floating text
 */
export const menuText = (
	x: number,
	y: number,
	size: number,
	text: string,
	align: "left" | "center" | "right" = "center",
	outline = 1,
) => {
	// One line box: `Text` re-anchors a gradient toeach line by default, so a
	// multi-line label gets the same ramp on every line without this having to
	// know how many there are.
	const ramp = game.renderer.createLinearGradient(0, 0, 0, size * 1.45);
	ramp.addColorStop(0, TEXT_RAMP_TOP);
	ramp.addColorStop(1, TEXT_RAMP_BOTTOM);

	const label = new Text(x, y, {
		font: "Crang",
		size,
		lineHeight: 1.45,
		fillStyle: ramp,
		strokeStyle: "#000000",
		lineWidth: outline,
		textAlign: align,
		text,
	});
	label.floating = true;
	return label;
};

/**
 * The same, as one `Text` PER LINE.
 *
 * A multi-line label bakes as one canvas, so a gradient authored for one line
 * box would leave every line below the first past its last stop. The engine can
 * repeat the ramp per line, but one label per line is simpler to reason about
 * and re-bakes only the line that actually changed.
 * @param x - screen x
 * @param y - screen y of the FIRST line
 * @param size - font size in the internal buffer's pixels
 * @param text - the string; split on newlines
 * @param align - horizontal alignment
 * @param outline - stroke width in buffer pixels
 * @returns one configured, floating label per line, top-down
 */
export const menuLines = (
	x: number,
	y: number,
	size: number,
	text: string,
	align: "left" | "center" | "right" = "center",
	outline = 1,
) => {
	return text.split("\n").map((line, i) => {
		return menuText(x, y + i * size * 1.45, size, line, align, outline);
	});
};
