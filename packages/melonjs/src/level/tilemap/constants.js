// The bits of a global tile id (gid) that say how the tile is flipped, as a
// 32-bit id carries them: across, down, and along its diagonal. Tiled's own
// encoding, kept for every tile layer.
export const GID_FLIP_H = 0x80000000;
export const GID_FLIP_V = 0x40000000;
export const GID_FLIP_AD = 0x20000000;
// what is left of a gid once its flip bits are cleared: the tile itself
export const GID_MASK = ~(GID_FLIP_H | GID_FLIP_V | GID_FLIP_AD);

// The same three flips packed in the low bits: what a tile layer stores
// beside each cell's tile id, and what a placed tile carries
export const FLIP_H_BIT = 1 << 0;
export const FLIP_V_BIT = 1 << 1;
export const FLIP_AD_BIT = 1 << 2;

// what the name of a level's collision layer contains, in any case
export const COLLISION_GROUP = "collision";
