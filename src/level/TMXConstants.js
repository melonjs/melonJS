/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {
    me.TMXConstants = {
        // some custom constants
        COLLISION_GROUP             : "collision",

        // bitmask constants to check for flipped & rotated tiles
        TMX_FLIP_H                  : 0x80000000,
        TMX_FLIP_V                  : 0x40000000,
        TMX_FLIP_AD                 : 0x20000000,
        TMX_CLEAR_BIT_MASK          : ~(0x80000000 | 0x40000000 | 0x20000000)
    };
})();
