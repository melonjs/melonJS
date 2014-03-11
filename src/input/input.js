    /*
     * MelonJS Game Engine
     * Copyright (C) 2011 - 2014, Olivier Biot, Jason Oster
     * http://www.melonjs.org/
     *
     */

    /**
     * @namespace me.input
     * @memberOf me
     */
    me.input = (function() {

        // hold public stuff in our singleton
        var obj = {};

        /*---------------------------------------------

            PRIVATE STUFF

          ---------------------------------------------*/

        /**
         * prevent event propagation
         * @ignore
         */
        obj._preventDefault = function (e) {
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


        /*---------------------------------------------

            PUBLIC STUFF

          ---------------------------------------------*/

        /**
         * Global flag to specify if melonJS should prevent default browser action on registered key events <br>
         * This is also configurable per key through the bindKey function
         * default : true
         * @public
         * @type Boolean
         * @name preventDefault
         * @memberOf me.input
         */
        obj.preventDefault = true;

        // return our object
        return obj;
    })();
