import knight from "./assets/Blank_Sprite_Sheet_4_2_by_KnightYamato.png";
import forest from "./assets/forest.png";
import map from "./assets/isometric.tmx?url";
import grassAndWater from "./assets/isometric_grass_and_water.png";
import mapStaggered from "./assets/isometric_staggered.tmx?url";

export const resources = [
	/* Graphics.
	 * @example
	 * { name: "example", type:"image", src: "data/img/example.png" },
	 */
	{ name: "forest", type: "image", src: forest },
	{
		name: "isometric_grass_and_water",
		type: "image",
		src: grassAndWater,
	},
	{
		name: "Blank_Sprite_Sheet",
		type: "image",
		src: knight,
	},

	/* Maps.
	 * @example
	 * { name: "example01", type: "tmx", src: "data/map/example01.tmx" },
	 * { name: "example01", type: "tmx", src: "data/map/example01.json" },
	 */
	{ name: "isometric", type: "tmx", src: map },
	{
		name: "isometric_staggered",
		type: "tmx",
		src: mapStaggered,
	},

	/* Background music.
	 * @example
	 * { name: "example_bgm", type: "audio", src: "data/bgm/" },
	 */

	/* Sound effects.
	 * @example
	 * { name: "example_sfx", type: "audio", src: "data/sfx/" }
	 */

	/* Atlases
	 * @example
	 * { name: "example_tps", type: "json", src: "data/img/example_tps.json" },
	 */
];
