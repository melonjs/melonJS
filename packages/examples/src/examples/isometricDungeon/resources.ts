/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { soundResources } from "./fx/sound";

const base = `${import.meta.env.BASE_URL}assets/isometricDungeon/`;

export const resources = [
	{ name: "dungeon", type: "image", src: `${base}dungeon.png` },
	{ name: "dungeon", type: "tmx", src: `${base}dungeon.tmx` },
	{ name: "hero", type: "image", src: `${base}hero.png` },
	{ name: "hero", type: "json", src: `${base}hero.json` },
	{ name: "kenneyLogo", type: "image", src: `${base}kenney-logo.png` },
	...soundResources(`${base}sfx/`),
];
