/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/** the LDtk project: the name its file is loaded under */
export const WORLD = "gridvania";

/** the sheet the player and the items are drawn from */
export const SPRITES = "ldtk-platformer-sprites";

/** the size of a tile of the world, and of a frame of the sprite sheet */
export const TILE = 16;

/**
 * Draw orders above every layer of every depth of the world: an LDtk world
 * gives its layers draw orders from 0 up, a block of them for each depth.
 */
export const Z = {
	particles: 99_999,
	player: 100_000,
	hud: 100_001,
};
