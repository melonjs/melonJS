/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { SPRITES, WORLD } from "./config";

const base = `${import.meta.env.BASE_URL}assets/`;

export const resources = [
	// LDtk's "GridVania" sample world, as the editor saves it: its tileset
	// image loads with it
	{
		name: WORLD,
		type: "ldtk",
		src: `${base}ldtk/WorldMap_GridVania_layout.ldtk`,
	},
	// the player and the items: LDtk shows this world's entities with its
	// own built-in icons, which are not in the project's files and are not
	// to be redistributed, so the game brings its own
	{
		name: SPRITES,
		type: "image",
		src: `${base}ldtkPlatformer/sprites.png`,
	},
	// the HUD's bitmap font
	{
		name: "PressStart2P",
		type: "image",
		src: `${base}platformer/fnt/PressStart2P.png`,
	},
	{
		name: "PressStart2P",
		type: "binary",
		src: `${base}platformer/fnt/PressStart2P.fnt`,
	},
];
