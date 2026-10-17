/**
 * melonJS — Earth Defender: everything the game loads before it starts.
 *
 * A FUNCTION rather than a constant, because the list is not fully static:
 * `sfxAssets()` synthesises its clips into WAV data URLs when it is called,
 * so a module-level constant would do that work at import time, before the
 * audio format support it checks has been settled by `audio.init`.
 *
 * Paths and names live in `constants.ts` with the rest of the tuning; this
 * file only says which of them are loaded and how.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	ATM_SHADER,
	BATTLE_MUSIC,
	BGM_BASE,
	BOMB_ASSET,
	BOMB_MODEL,
	DAMAGE_SHADER,
	DOME_ASSET,
	DOME_MODEL,
	EARTH_ASSET,
	EARTH_MODEL,
	GLOW_SHADER,
	HUD_FONT,
	HUD_FONT_ASSET,
	HUNTER_MODEL,
	LASER_SOUNDS,
	MENU_MUSIC,
	RIPPLE_SHADER,
	ROCK_ALBEDO,
	ROCK_ALBEDO_ASSET,
	ROCK_ASSET,
	ROCK_MODEL,
	ROCK_NORMAL,
	ROCK_NORMAL_ASSET,
	SFX_BASE,
	SHIELD_SHADER,
	SHIP_ASSET_BASE,
	SHIP_MODEL,
	SHOCK_SHADER,
	UFO_ASSET,
	UFO_MODEL,
	UFO_SOUND,
} from "./constants";
import { SFX_FILES, sfxAssets } from "./fx/sfx";
import { atmosphere } from "./shaders/atmosphere";
import { domeGlow } from "./shaders/domeGlow";
import { damageVignette, domeRipple } from "./shaders/impact";
import { shieldShell } from "./shaders/shield";
import { shockwave } from "./shaders/shockwave";

/**
 * The game's preload manifest.
 * @returns every resource `loader.preload` should fetch or compile
 */
export const earthDefenderAssets = () => [
	{
		name: SHIP_MODEL,
		type: "obj",
		src: `${SHIP_ASSET_BASE}${SHIP_MODEL}.obj`,
	},
	{
		name: SHIP_MODEL,
		type: "mtl",
		src: `${SHIP_ASSET_BASE}${SHIP_MODEL}.mtl`,
	},
	// the hunter, from the same pack: a different hull so the two craft
	// are told apart by silhouette rather than by colour
	{
		name: HUNTER_MODEL,
		type: "obj",
		src: `${SHIP_ASSET_BASE}${HUNTER_MODEL}.obj`,
	},
	{
		name: HUNTER_MODEL,
		type: "mtl",
		src: `${SHIP_ASSET_BASE}${HUNTER_MODEL}.mtl`,
	},
	{ name: HUD_FONT, type: "fontface", src: HUD_FONT_ASSET },
	{ name: EARTH_MODEL, type: "glb", src: EARTH_ASSET },
	{ name: DOME_MODEL, type: "glb", src: DOME_ASSET },
	{ name: ROCK_MODEL, type: "glb", src: ROCK_ASSET },
	{ name: UFO_MODEL, type: "glb", src: UFO_ASSET },
	{ name: BOMB_MODEL, type: "glb", src: BOMB_ASSET },
	{ name: UFO_SOUND, type: "audio", src: SFX_BASE },
	...LASER_SOUNDS.map((name: string) => {
		return { name, type: "audio" as const, src: SFX_BASE };
	}),
	...SFX_FILES.map((name: string) => {
		return { name, type: "audio" as const, src: SFX_BASE };
	}),
	// Not streamed: a streamed clip bypasses the master gain, so it would
	// ignore `audio.muteAll()` and the mute-on-blur with it.
	{ name: MENU_MUSIC, type: "audio", src: BGM_BASE },
	{ name: BATTLE_MUSIC, type: "audio", src: BGM_BASE },
	// Everything else the game makes a noise about, synthesised into WAV
	// data URLs at boot rather than shipped. They are ordinary clips once
	// loaded, which is the point: only a clip can be PLACED in the world,
	// and most of these happen somewhere other than at the craft.
	...sfxAssets(),
	{ name: ROCK_ALBEDO, type: "image", src: ROCK_ALBEDO_ASSET },
	{ name: ROCK_NORMAL, type: "image", src: ROCK_NORMAL_ASSET },
	// The bolts' light on the glass. A "shader" resource is COMPILED at
	// load time and the loader owns it as a shared instance, so the
	// compile lands inside the loading screen and every pool clones the
	// program rather than building its own.
	{ name: GLOW_SHADER, type: "shader", data: domeGlow },
	// and the craft's shell, generated per fragment rather than painted
	{ name: SHIELD_SHADER, type: "shader", data: shieldShell },
	// and the wave a rock leaves when it breaks
	{ name: SHOCK_SHADER, type: "shader", data: shockwave },
	// the shell ringing when the craft is struck
	{ name: RIPPLE_SHADER, type: "shader", data: domeRipple },
	// and the red closing in as the shield goes, on its own screen quad
	{ name: DAMAGE_SHADER, type: "shader", data: damageVignette },
	// the band of lit air past the limb
	{ name: ATM_SHADER, type: "shader", data: atmosphere },
];
