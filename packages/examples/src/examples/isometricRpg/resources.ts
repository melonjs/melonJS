const base = `${import.meta.env.BASE_URL}assets/isometricRpg/`;

export const resources = [
	{ name: "forest", type: "image", src: `${base}forest.png` },
	{
		name: "isometric_grass_and_water",
		type: "image",
		src: `${base}isometric_grass_and_water.png`,
	},
	{
		name: "Blank_Sprite_Sheet",
		type: "image",
		src: `${base}Blank_Sprite_Sheet_4_2_by_KnightYamato.png`,
	},
	{ name: "isometric", type: "tmx", src: `${base}isometric.tmx` },
	{
		name: "isometric_staggered",
		type: "tmx",
		src: `${base}isometric_staggered.tmx`,
	},
];
