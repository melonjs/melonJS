/**
 * melonJS — Whac-A-Mole mini-game example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
/**
 * Whack-A-Mole
 * Freely reused from the Cocos2d Whack-a-mole Tutorial
 * http://maniacdev.com/2011/01/tutorial-cocos2d-example-whack-a-mole-game/
 * Original version by Ray Wenderlich, the creator of the Space Game Starter
 * Kit and co-author of the Learning Cocos2D book, as part of an excellent set
 * of iOS tutorials on how to create a whack-a-mole game using the open source
 * iPhone game engine Cocos2D.
 **/

const base = `${import.meta.env.BASE_URL}assets/whac-a-mole/`;

export const resources = [
	{
		name: "background",
		type: "image",
		src: `${base}img/background/bg_dirt128.png`,
	},
	{
		name: "grass_upper",
		type: "image",
		src: `${base}img/foreground/grass_upper128.png`,
	},
	{
		name: "grass_lower",
		type: "image",
		src: `${base}img/foreground/grass_lower128.png`,
	},
	{ name: "mole", type: "image", src: `${base}img/sprites/mole.png` },
	{ name: "PressStart2P", type: "image", src: `${base}fnt/PressStart2P.png` },
	{ name: "PressStart2P", type: "binary", src: `${base}fnt/PressStart2P.fnt` },
	{ name: "whack", type: "audio", src: `${base}bgm/` },
	{ name: "ow", type: "audio", src: `${base}sfx/` },
];
