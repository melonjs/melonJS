const base = `${import.meta.env.BASE_URL}assets/platformer/`;

export const resources = [
	/* Graphics. */
	{ name: "tileset", type: "image", src: `${base}img/tileset.png` },
	{ name: "background", type: "image", src: `${base}img/background.png` },
	{ name: "clouds", type: "image", src: `${base}img/clouds.png` },

	/* Maps. */
	{ name: "map1", type: "tmx", src: `${base}map/map1.tmx` },
	{ name: "map2", type: "tmx", src: `${base}map/map2.json` },

	/* Tilesets. */
	{ name: "tileset", type: "tsx", src: `${base}map/tileset.json` },

	/* Background music. */
	{ name: "dst-gameforest", type: "audio", src: `${base}bgm/` },

	/* Sound effects. */
	{ name: "cling", type: "audio", src: `${base}sfx/` },
	{ name: "die", type: "audio", src: `${base}sfx/` },
	{ name: "enemykill", type: "audio", src: `${base}sfx/` },
	{ name: "jump", type: "audio", src: `${base}sfx/` },

	/* Atlases */
	{ name: "texture", type: "json", src: `${base}img/texture.json` },
	{ name: "texture", type: "image", src: `${base}img/texture.png` },

	/* Bitmap Font */
	{ name: "PressStart2P", type: "image", src: `${base}fnt/PressStart2P.png` },
	{ name: "PressStart2P", type: "binary", src: `${base}fnt/PressStart2P.fnt` },
];
