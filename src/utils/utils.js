/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 */
(function () {


    /**
     * a collection of utility functions
     * @namespace me.utils
     * @memberOf me
     */
    me.utils = (function () {
        // hold public stuff in our singleton
        var api = {};

        /*
         * PRIVATE STUFF
         */

        // guid default value
        var GUID_base  = "";
        var GUID_index = 0;

        /*
         * PUBLIC STUFF
         */

        /**
         * Get image pixels
         * @public
         * @function
         * @memberOf me.utils
         * @name getPixels
         * @param {Image|Canvas} image Image to read
         * @return {ImageData} Canvas ImageData object
         */
        api.getPixels = function (arg) {
            if (arg instanceof HTMLImageElement) {
                var _context = me.CanvasRenderer.getContext2d(
                    me.video.createCanvas(arg.width, arg.height)
                );
                _context.drawImage(arg, 0, 0);
                return _context.getImageData(0, 0, arg.width, arg.height);
            }
            else {
                // canvas !
                return arg.getContext("2d").getImageData(0, 0, arg.width, arg.height);
            }
        };

        /**
         * reset the GUID Base Name
         * the idea here being to have a unique ID
         * per level / object
         * @ignore
         */
        api.resetGUID = function (base, index) {
            // also ensure it's only 8bit ASCII characters
            GUID_base  = me.utils.string.toHex(base.toString().toUpperCase());
            GUID_index = index || 0;
        };

        /**
         * create and return a very simple GUID
         * Game Unique ID
         * @ignore
         */
        api.createGUID = function (index) {
            // to cover the case of undefined id for groups
            GUID_index += index || 1;
            return GUID_base + "-" + (index || GUID_index);
        };

        // return our object
        return api;
    })();
})();
