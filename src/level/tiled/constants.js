// bitmask constants to check for flipped & rotated tiles
export const TMX_FLIP_H          = 0x80000000;
export const TMX_FLIP_V          = 0x40000000;
export const TMX_FLIP_AD         = 0x20000000;
export const TMX_CLEAR_BIT_MASK  = ~(TMX_FLIP_H | TMX_FLIP_V  | TMX_FLIP_AD);

// constant to identify the collision object layer
export const COLLISION_GROUP     = "collision";
