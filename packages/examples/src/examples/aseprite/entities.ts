/**
 * melonJS — Aseprite animation playback example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import * as me from "melonjs";

/**
 * The paladin: one sprite holding every animation of its Aseprite atlas.
 */
export function createPaladin(): me.Sprite {
	const textureAtlas = new me.TextureAtlas(
		me.loader.getJSON("paladin"),
		me.loader.getImage("paladin"),
	);

	// with no list of names: every frame of the atlas, and an animation for
	// each tag set in Aseprite
	const paladin = textureAtlas.createAnimationFromName();
	paladin.setCurrentAnimation("run front");
	paladin.scale(4);
	paladin.pos.set(210, 250);
	return paladin;
}
