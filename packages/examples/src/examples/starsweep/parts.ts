/**
 * melonJS — Starsweep: where each part sits in `monsters.png`.
 *
 * Generated from Kenney's Monster Builder Pack (CC0) at half size; the
 * sizes below are in atlas pixels.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
export const PARTS = {
	body_whiteA: [89, 99, 82, 82],
	body_greenD: [0, 99, 87, 91],
	body_darkB: [72, 0, 96, 96],
	body_redC: [0, 0, 70, 97],
	eye_cute_light: [160, 192, 32, 34],
	eye_cute_dark: [194, 192, 32, 34],
	eye_closed_happy: [90, 291, 21, 9],
	eye_dead: [224, 255, 16, 16],
	eye_yellow: [0, 255, 32, 34],
	eye_angry_red: [55, 255, 30, 28],
	detail_blue_antenna_large: [34, 255, 19, 29],
	detail_green_eye: [129, 192, 29, 39],
	detail_dark_horn_small: [30, 291, 16, 14],
	detail_red_horn_large: [87, 255, 20, 21],
	arm_whiteB: [173, 99, 26, 80],
	leg_whiteD: [0, 192, 36, 61],
	leg_greenD: [38, 192, 36, 61],
	leg_darkE: [76, 192, 51, 54],
	leg_redB: [201, 99, 28, 74],
	mouthA: [150, 255, 35, 17],
	mouthB: [187, 255, 35, 17],
	mouthC: [109, 255, 39, 19],
	mouth_closed_happy: [48, 291, 40, 12],
	eyebrowC: [0, 291, 28, 16],
} as const;

export type PartName = keyof typeof PARTS;
