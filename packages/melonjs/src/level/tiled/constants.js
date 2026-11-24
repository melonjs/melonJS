import {
	GID_FLIP_AD,
	GID_FLIP_H,
	GID_FLIP_V,
	GID_MASK,
	COLLISION_GROUP as TILEMAP_COLLISION_GROUP,
} from "../tilemap/constants.js";

// latest supported Tiled map format version
export const TILED_SUPPORTED_VERSION = "1.12";

// bitmask constants to check for flipped & rotated tiles: the tile map's own,
// which are Tiled's encoding
export const TMX_FLIP_H = GID_FLIP_H;
export const TMX_FLIP_V = GID_FLIP_V;
export const TMX_FLIP_AD = GID_FLIP_AD;
export const TMX_CLEAR_BIT_MASK = GID_MASK;

// constant to identify the collision object layer
export const COLLISION_GROUP = TILEMAP_COLLISION_GROUP;
