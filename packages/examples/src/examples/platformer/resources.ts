/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { loader } from "melonjs";

const base = `${import.meta.env.BASE_URL}assets/platformer/`;

/**
 * The game's assets, as a record of named bundles: what every level needs,
 * and what each map brings with it. `loader.preload(resources)` declares each
 * one as a bundle and loads them all at boot; from then on a map's bundle is
 * freed and loaded again by its id (see LevelTrigger). A bundle is only a
 * lifetime: the assets keep their own names, so `loader.getImage("background")`
 * reads them whichever bundle loaded them.
 *
 * Bundle ids are the map names, so a level trigger's `to` names both. An
 * asset may appear in several bundles, and is freed with the last of them to
 * be unloaded: both maps draw the same background hills and clouds, so those
 * two images are listed in BOTH map bundles, and when the game unloads the
 * map it left, they stay, still held by the map being played.
 */
export const resources: Record<string, loader.Asset[]> = {
	/* everything both levels use */
	common: [
		/* the player, enemies, coins and HUD, in one atlas */
		{ name: "texture", type: "json", src: `${base}img/texture.json` },
		{ name: "texture", type: "image", src: `${base}img/texture.png` },

		/* the HUD's bitmap font */
		{ name: "PressStart2P", type: "image", src: `${base}fnt/PressStart2P.png` },
		{
			name: "PressStart2P",
			type: "binary",
			src: `${base}fnt/PressStart2P.fnt`,
		},

		/* the tileset both maps are built from */
		{ name: "tileset", type: "image", src: `${base}img/tileset.png` },
		{ name: "tileset", type: "tsx", src: `${base}map/tileset.json` },

		/* the music, played in every level */
		{ name: "dst-gameforest", type: "audio", src: `${base}bgm/` },

		/* sound effects */
		{ name: "cling", type: "audio", src: `${base}sfx/` },
		{ name: "die", type: "audio", src: `${base}sfx/` },
		{ name: "enemykill", type: "audio", src: `${base}sfx/` },
		{ name: "jump", type: "audio", src: `${base}sfx/` },
	],

	/* the first map, and the images it draws */
	map1: [
		{ name: "map1", type: "tmx", src: `${base}map/map1.tmx` },
		{ name: "background", type: "image", src: `${base}img/background.png` },
		{ name: "clouds", type: "image", src: `${base}img/clouds.png` },
	],

	/* the second map: the same two images, shared with map1 */
	map2: [
		{ name: "map2", type: "tmx", src: `${base}map/map2.json` },
		{ name: "background", type: "image", src: `${base}img/background.png` },
		{ name: "clouds", type: "image", src: `${base}img/clouds.png` },
	],
};
