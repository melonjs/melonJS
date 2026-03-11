import fontFnt from "./assets/fnt/PressStart2P.fnt?url";
import font from "./assets/fnt/PressStart2P.png";
import background from "./assets/img/background.png";
import clouds from "./assets/img/clouds.png";
import textureJson from "./assets/img/texture.json?url";
import texture from "./assets/img/texture.png";
import tileSet from "./assets/img/tileset.png";
import map1 from "./assets/map/map1.tmx?url";
import map2 from "./assets/map/map2.json?url";
import tileSetJson from "./assets/map/tileset.json?url";

const basePath = import.meta.env.BASE_URL;
const bgm = `${basePath}assets/platformer/bgm/`;
const cling = `${basePath}assets/platformer/sfx/`;
const die = `${basePath}assets/platformer/sfx/`;
const enemyKill = `${basePath}assets/platformer/sfx/`;
const jump = `${basePath}assets/platformer/sfx/`;

export const resources = [
	/* Graphics.
	 * @example
	 * { name: "example", type:"image", src: "data/img/example.png" },
	 */
	{ name: "tileset", type: "image", src: tileSet },
	{ name: "background", type: "image", src: background },
	{ name: "clouds", type: "image", src: clouds },

	/* Maps.
	 * @example
	 * { name: "example01", type: "tmx", src: "data/map/example01.tmx" },
	 * { name: "example01", type: "tmx", src: "data/map/example01.json" },
	 */
	{ name: "map1", type: "tmx", src: map1 },
	{ name: "map2", type: "tmx", src: map2 },

	/* Tilesets.
	 * @example
	 * { name: "example01", type: "tsx", src: "data/map/example01.tsx" },
	 * { name: "example01", type: "tsx", src: "data/map/example01.json" },
	 */
	{ name: "tileset", type: "tsx", src: tileSetJson },

	/* Background music.
	 * @example
	 * { name: "example_bgm", type: "audio", src: "data/bgm/" },
	 */
	{ name: "dst-gameforest", type: "audio", src: bgm },

	/* Sound effects.
	 * @example
	 * { name: "example_sfx", type: "audio", src: "data/sfx/" }
	 */
	{ name: "cling", type: "audio", src: cling },
	{ name: "die", type: "audio", src: die },
	{ name: "enemykill", type: "audio", src: enemyKill },
	{ name: "jump", type: "audio", src: jump },

	/* Atlases
	 * @example
	 * { name: "example_tps", type: "json", src: "data/img/example_tps.json" },
	 */
	// texturePacker
	{ name: "texture", type: "json", src: textureJson },
	{ name: "texture", type: "image", src: texture },

	/* Bitmap Font
	 * @example
	 * { name: "example_fnt", type: "image", src: "data/img/example_fnt.png" },
	 * { name: "example_fnt", type: "binary", src: "data/img/example_fnt.fnt" },
	 */
	{ name: "PressStart2P", type: "image", src: font },
	{ name: "PressStart2P", type: "binary", src: fontFnt },
];
