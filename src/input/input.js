/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org/
 *
 */
(function () {
    /**
     * @namespace me.input
     * @memberOf me
     */
    me.input = (function () {
        // hold public stuff in our singleton
        var api = {};

        /*
         * PRIVATE STUFF
         */

        /**
         * prevent event propagation
         * @ignore
         */
        api._preventDefaultFn = function (e) {
            // stop event propagation
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            else {
                e.cancelBubble = true;
            }
            // stop event default processing
            if (e.preventDefault)  {
                e.preventDefault();
            }
            else  {
                e.returnValue = false;
            }

            return false;
        };

        /*
         * PUBLIC STUFF
         */

        /**
         * Global flag to specify if melonJS should prevent all default browser action on registered events.
         * default : true
         * @public
         * @type Boolean
         * @name preventDefault
         * @memberOf me.input
         */
        api.preventDefault = true;

        // return our object
        return api;
    })();
})();
