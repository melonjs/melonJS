import whackMp3 from "./assets/bgm/whack.mp3";
import fontFnt from "./assets/fnt/PressStart2P.fnt?url";
import fontPng from "./assets/fnt/PressStart2P.png";
import background from "./assets/img/background/bg_dirt128.png";
import grassLower from "./assets/img/foreground/grass_lower128.png";
import grassUpper from "./assets/img/foreground/grass_upper128.png";
import mole from "./assets/img/sprites/mole.png";
import "./assets/bgm/whack.ogg";
import owMp3 from "./assets/sfx/ow.mp3";
import "./assets/sfx/ow.ogg";

/**
 * Whack-A-Mole
 * Freely reused from the Cocos2d Whack-a-mole Tutorial
 * http://maniacdev.com/2011/01/tutorial-cocos2d-example-whack-a-mole-game/
 * Original version by Ray Wenderlich, the creator of the Space Game Starter
 * Kit and co-author of the Learning Cocos2D book, as part of an excellent set
 * of iOS tutorials on how to create a whack-a-mole game using the open source
 * iPhone game engine Cocos2D.
 **/

const whackBgm = whackMp3.slice(0, whackMp3.lastIndexOf("/") + 1);
const owSfx = owMp3.slice(0, owMp3.lastIndexOf("/") + 1);

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
