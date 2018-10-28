/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 */

// placeholder for all deprecated classes,
// and corresponding alias for backward compatibility

/**
 * @ignore
 */
me.ScreenObject = me.Stage.extend({
    /** @ignore */
    init: function (settings) {
        // super constructor
        this._super(me.Stage, "init", settings);
        // deprecation warning
        console.log("me.ScreenObject is deprecated, please use me.Stage");
    }
});
