import buchOutdoor from "./assets/map/buch-outdoor.png";
import desertTmx from "./assets/map/desert.tmx?url";
import desertInfiniteTmx from "./assets/map/desert-infinite.tmx?url";
import desertTilesetXml from "./assets/map/desert-tileset.xml?url";
import freeTileset from "./assets/map/free_tileset_version_10.png";
import hexagonalTmx from "./assets/map/hexagonal-mini.tmx?url";
import hexmini from "./assets/map/hexmini.png";
import islandJson from "./assets/map/island-1.json?url";
import isometricImg from "./assets/map/isometric_grass_and_water.png";
import isometricTmx from "./assets/map/isometric_grass_and_water.tmx?url";
import orthogonalTmx from "./assets/map/orthogonal-outside.tmx?url";
import perspectiveWallsImg from "./assets/map/perspective_walls.png";
import perspectiveTmx from "./assets/map/perspective_walls.tmx?url";
import perspectiveTsx from "./assets/map/perspective_walls-tileset.xml?url";
import beachTilesetImg from "./assets/map/rpg/beach_tileset.png";
import beachTilesetTsx from "./assets/map/rpg/beach_tileset.xml?url";
import rpgTmx from "./assets/map/rpg/island.tmx?url";
import sewerTileset from "./assets/map/sewer_tileset.png";
import sewersTmx from "./assets/map/sewers.tmx?url";
import spritesJson from "./assets/map/sprites.json?url";
import spritesImg from "./assets/map/sprites-table-16-16.png";
import tmwDesertSpacing from "./assets/map/tmw_desert_spacing.png";
import villageTmx from "./assets/map/village.tmx?url";

export const resources = [
	// village
	{ name: "village", type: "tmx", src: villageTmx },
	{ name: "free_tileset_version_10", type: "image", src: freeTileset },
	// desert
	{ name: "desert", type: "tmx", src: desertTmx },
	{ name: "desert-infinite", type: "tmx", src: desertInfiniteTmx },
	{ name: "desert-tileset", type: "tsx", src: desertTilesetXml },
	{ name: "tmw_desert_spacing", type: "image", src: tmwDesertSpacing },
	// sewer
	{ name: "sewer_tileset", type: "image", src: sewerTileset },
	{ name: "sewers", type: "tmx", src: sewersTmx },
	// isometric
	{ name: "isometric", type: "tmx", src: isometricTmx },
	{
		name: "isometric_grass_and_water",
		type: "image",
		src: isometricImg,
	},
	{ name: "perspective_walls", type: "image", src: perspectiveWallsImg },
	// orthogonal
	{ name: "orthogonal", type: "tmx", src: orthogonalTmx },
	{ name: "buch-outdoor", type: "image", src: buchOutdoor },
	// perspective
	{ name: "perspective", type: "tmx", src: perspectiveTmx },
	{ name: "perspective_walls-tileset", type: "tsx", src: perspectiveTsx },
	// hexagonal
	{ name: "hexagonal-mini", type: "tmx", src: hexagonalTmx },
	{ name: "hexmini", type: "image", src: hexmini },
	// rpg
	{ name: "rpg", type: "tmx", src: rpgTmx },
	{ name: "beach_tileset", type: "tsx", src: beachTilesetTsx },
	{ name: "beach_tileset", type: "image", src: beachTilesetImg },
	// island rotated tiles
	{ name: "island-rotated-tiles", type: "tmx", src: islandJson },
	{ name: "sprites", type: "tsx", src: spritesJson },
	{ name: "sprites-table-16-16", type: "image", src: spritesImg },
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
];
