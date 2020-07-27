(function () {
    /**
     * @namespace me.input
     * @memberOf me
     */
    me.input = {

        /**
         * the default target element for keyboard events (usually the window element in which the game is running)
         * @public
         * @type EventTarget
         * @name keyBoardEventTarget
         * @memberOf me.input
         */
        keyBoardEventTarget : null,

        /**
         * the default target element for pointer events (usually the canvas element in which the game is rendered)
         * @public
         * @type EventTarget
         * @name pointerEventTarget
         * @memberOf me.input
         */
        pointerEventTarget : null,

        /**
         * specify if melonJS should prevent all default browser action on registered events.
         * @public
         * @type Boolean
         * @default true
         * @name preventDefault
         * @memberOf me.input
         */
         preventDefault : true
    };

})();
