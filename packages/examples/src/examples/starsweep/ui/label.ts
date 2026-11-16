/**
 * melonJS — Starsweep: the game's font, and its text labels.
 *
 * The words on screen are the engine's `Text`, in Kenney Future.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Text } from "melonjs";

/** Kenney Future, a CC0 sci-fi face, loaded by the bootstrap */
export const FONT = "starsweepFuture";

/**
 * A line of text in the game's font, fixed on the screen (it does not move
 * with the camera), hung from its top.
 * @param x - where it is anchored across, by `align`
 * @param y - its top
 * @param size - the font size, in pixels
 * @param color - its colour
 * @param align - which side of it `x` is
 * @param text - what it says; set it later with `setText`
 * @returns the label, to add to a container
 */
export const makeLabel = (
	x: number,
	y: number,
	size: number,
	color: string,
	align: "left" | "center" | "right" = "center",
	text = " ",
) => {
	const label = new Text(x, y, {
		font: FONT,
		size,
		fillStyle: color,
		textAlign: align,
		textBaseline: "top",
		text,
	});
	label.floating = true;
	return label;
};
