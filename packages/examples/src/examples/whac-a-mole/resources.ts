import fontFnt from "./assets/fnt/PressStart2P.fnt?url";
import fontPng from "./assets/fnt/PressStart2P.png";
import background from "./assets/img/background/bg_dirt128.png";
import grassLower from "./assets/img/foreground/grass_lower128.png";
import grassUpper from "./assets/img/foreground/grass_upper128.png";
import mole from "./assets/img/sprites/mole.png";

/**
 * Whack-A-Mole
 * Freely reused from the Cocos2d Whack-a-mole Tutorial
 * http://maniacdev.com/2011/01/tutorial-cocos2d-example-whack-a-mole-game/
 * Original version by Ray Wenderlich, the creator of the Space Game Starter
 * Kit and co-author of the Learning Cocos2D book, as part of an excellent set
 * of iOS tutorials on how to create a whack-a-mole game using the open source
 * iPhone game engine Cocos2D.
 **/

const basePath = import.meta.env.BASE_URL;
const whackBgm = `${basePath}assets/whac-a-mole/bgm/`;
const owSfx = `${basePath}assets/whac-a-mole/sfx/`;

export const resources = [
	{
		name: "background",
		type: "image",
		src: background,
	},
	// upper part of foreground
	{
		name: "grass_upper",
		type: "image",
		src: grassUpper,
	},
	// lower part of foreground
	{
		name: "grass_lower",
		type: "image",
		src: grassLower,
	},
	// more sprites
	{ name: "mole", type: "image", src: mole },

	// bitmap font
	{ name: "PressStart2P", type: "image", src: fontPng },
	{ name: "PressStart2P", type: "binary", src: fontFnt },

	// main music track
	{ name: "whack", type: "audio", src: whackBgm },
	// Laugh audio FX
	/*{ name: "laugh", type: "audio", src: "data/sfx/" },*/
	// ow audio FX
	{ name: "ow", type: "audio", src: owSfx },
];
