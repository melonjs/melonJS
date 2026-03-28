const base = `${import.meta.env.BASE_URL}assets/tiledMapLoader/map/`;

export const resources = [
	// village
	{ name: "village", type: "tmx", src: `${base}village.tmx` },
	{
		name: "free_tileset_version_10",
		type: "image",
		src: `${base}free_tileset_version_10.png`,
	},
	// desert
	{ name: "desert", type: "tmx", src: `${base}desert.tmx` },
	{ name: "desert-infinite", type: "tmx", src: `${base}desert-infinite.tmx` },
	{ name: "desert-tileset", type: "tsx", src: `${base}desert-tileset.xml` },
	{
		name: "tmw_desert_spacing",
		type: "image",
		src: `${base}tmw_desert_spacing.png`,
	},
	// sewer
	{ name: "sewer_tileset", type: "image", src: `${base}sewer_tileset.png` },
	{ name: "sewers", type: "tmx", src: `${base}sewers.tmx` },
	// isometric
	{
		name: "isometric",
		type: "tmx",
		src: `${base}isometric_grass_and_water.tmx`,
	},
	{
		name: "isometric_grass_and_water",
		type: "image",
		src: `${base}isometric_grass_and_water.png`,
	},
	{
		name: "perspective_walls",
		type: "image",
		src: `${base}perspective_walls.png`,
	},
	// orthogonal
	{ name: "orthogonal", type: "tmx", src: `${base}orthogonal-outside.tmx` },
	{ name: "buch-outdoor", type: "image", src: `${base}buch-outdoor.png` },
	// perspective
	{ name: "perspective", type: "tmx", src: `${base}perspective_walls.tmx` },
	{
		name: "perspective_walls-tileset",
		type: "tsx",
		src: `${base}perspective_walls-tileset.xml`,
	},
	// hexagonal
	{ name: "hexagonal-mini", type: "tmx", src: `${base}hexagonal-mini.tmx` },
	{ name: "hexmini", type: "image", src: `${base}hexmini.png` },
	// rpg
	{ name: "rpg", type: "tmx", src: `${base}rpg/island.tmx` },
	{ name: "beach_tileset", type: "tsx", src: `${base}rpg/beach_tileset.xml` },
	{ name: "beach_tileset", type: "image", src: `${base}rpg/beach_tileset.png` },
	// oblique
	{ name: "oblique", type: "tmx", src: `${base}oblique.tmx` },
	{ name: "gravel", type: "image", src: `${base}oblique/gravel.png` },
	{ name: "hole", type: "image", src: `${base}oblique/hole.png` },
	// island rotated tiles
	{ name: "island-rotated-tiles", type: "tmx", src: `${base}island-1.json` },
	{ name: "sprites", type: "tsx", src: `${base}sprites.json` },
	{
		name: "sprites-table-16-16",
		type: "image",
		src: `${base}sprites-table-16-16.png`,
	},
];

export const levels = [
	{ name: "village", label: "Village" },
	{ name: "desert", label: "Desert" },
	{ name: "sewers", label: "Sewers" },
	{ name: "isometric", label: "Isometric" },
	{ name: "orthogonal", label: "Orthogonal" },
	{ name: "perspective", label: "Perspective" },
	{ name: "hexagonal-mini", label: "Hexagonal" },
	{ name: "rpg", label: "RPG Island" },
	{ name: "island-rotated-tiles", label: "Rotated Tiles" },
	{ name: "desert-infinite", label: "Infinite Desert" },
	{ name: "oblique", label: "Oblique" },
];
