/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
// bitmask constants to check for flipped & rotated tiles
const TMX_FLIP_H          = 0x80000000;
const TMX_FLIP_V          = 0x40000000;
const TMX_FLIP_AD         = 0x20000000;
const TMX_CLEAR_BIT_MASK  = ~(TMX_FLIP_H | TMX_FLIP_V  | TMX_FLIP_AD);

// constant to identify the collision object layer
const COLLISION_GROUP     = "collision";

export { COLLISION_GROUP, TMX_CLEAR_BIT_MASK, TMX_FLIP_AD, TMX_FLIP_H, TMX_FLIP_V };
