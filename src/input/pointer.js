(function () {

    /**
     * cache value for the offset of the canvas position within the page
     * @ignore
     */
    var viewportOffset = new me.Vector2d();

    /**
     * a pointer object, representing a single finger on a touch enabled device.
     * @class
     * @extends me.Rect
     * @memberOf me
     * @constructor
     */
    me.Pointer = me.Rect.extend({
        /**
         * @ignore
         */
        init : function (x, y, w, h) {

          /**
            * the originating Event Object
            * @public
            * @type {PointerEvent|TouchEvent|MouseEvent}
            * @name event
            * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
            * @see https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
            * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
            * @memberOf me.Pointer
            */
            this.event = undefined;

           /**
            * a string containing the event's type.
            * @public
            * @type {String}
            * @name type
            * @see https://developer.mozilla.org/en-US/docs/Web/API/Event/type
            * @memberOf me.Pointer
            */
            this.type = undefined;


           /**
            * the button property indicates which button was pressed on the mouse to trigger the event.
            * @public
            * @type {Number}
            * @name button
            * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
            * @memberOf me.Pointer
            */
            this.button = 0;

           /**
            * indicates whether or not the pointer device that created the event is the primary pointer.
            * @public
            * @type {Boolean}
            * @name isPrimary
            * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
            * @memberOf me.Pointer
            */
            this.isPrimary = false;

           /**
            * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
            * @public
            * @type {Number}
            * @name pageX
            * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX
            * @memberOf me.Pointer
            */
            this.pageX = 0;

           /**
            * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
            * @public
            * @type {Number}
            * @name pageY
            * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY
            * @memberOf me.Pointer
            */
            this.pageY = 0;

           /**
            * the horizontal coordinate within the application's client area at which the event occurred
            * @public
            * @type {Number}
            * @name clientX
            * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
            * @memberOf me.Pointer
            */
            this.clientX = 0;

           /**
            * the vertical coordinate within the application's client area at which the event occurred
            * @public
            * @type {Number}
            * @name clientY
            * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
            * @memberOf me.Pointer
            */
            this.clientY = 0;

           /**
            * an unsigned long representing the unit of the delta values scroll amount
            * @public
            * @type {Number}
            * @name deltaMode
            * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
            * @memberOf me.Pointer
            */
            this.deltaMode = 0;

           /**
            * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
            * @public
            * @type {Number}
            * @name deltaX
            * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX
            * @memberOf me.Pointer
            */
            this.deltaX = 0;

           /**
            * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
            * @public
            * @type {Number}
            * @name deltaY
            * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
            * @memberOf me.Pointer
            */
            this.deltaY = 0;

           /**
            * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
            * @public
            * @type {Number}
            * @name deltaZ
            * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ
            * @memberOf me.Pointer
            */
            this.deltaZ = 0;

           /**
            * Event normalized X coordinate within the game canvas itself<br>
            * <img src="images/event_coord.png"/>
            * @public
            * @type {Number}
            * @name gameX
            * @memberOf me.Pointer
            */
            this.gameX = 0;

           /**
            * Event normalized Y coordinate within the game canvas itself<br>
            * <img src="images/event_coord.png"/>
            * @public
            * @type {Number}
            * @name gameY
            * @memberOf me.Pointer
            */
            this.gameY = 0;

           /**
            * Event X coordinate relative to the viewport
            * @public
            * @type {Number}
            * @name gameScreenX
            * @memberOf me.Pointer
            */
            this.gameScreenX = 0;

           /**
            * Event Y coordinate relative to the viewport
            * @public
            * @type {Number}
            * @name gameScreenY
            * @memberOf me.Pointer
            */
            this.gameScreenY = 0;

           /**
            * Event X coordinate relative to the map
            * @public
            * @type {Number}
            * @name gameWorldX
            * @memberOf me.Pointer
            */
            this.gameWorldX = 0;

           /**
            * Event Y coordinate relative to the map
            * @public
            * @type {Number}
            * @name gameWorldY
            * @memberOf me.Pointer
            */
            this.gameWorldY = 0;

           /**
            * Event X coordinate relative to the holding container
            * @public
            * @type {Number}
            * @name gameLocalX
            * @memberOf me.Pointer
            */
            this.gameLocalX = 0;

           /**
            * Event Y coordinate relative to the holding container
            * @public
            * @type {Number}
            * @name gameLocalY
            * @memberOf me.Pointer
            */
            this.gameLocalY = 0;

           /**
            * The unique identifier of the contact for a touch, mouse or pen
            * @public
            * @type {Number}
            * @name pointerId
            * @memberOf me.Pointer
            * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
            */
            this.pointerId = undefined;

            // parent constructor
            this._super(me.Rect, "init", [x || 0, y || 0, w || 1, h || 1]);
        },

        /**
         * initialize the Pointer object using the given Event Object
         * @name me.Pointer#set
         * @private
         * @function
         * @param {Event} event the original Event object
         * @param {Number} pageX the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
         * @param {Number} pageY the vertical coordinate at which the event occurred, relative to the left edge of the entire document
         * @param {Number} clientX the horizontal coordinate within the application's client area at which the event occurred
         * @param {Number} clientX the vertical coordinate within the application's client area at which the event occurred
         * @param {Number} pointedId the Pointer, Touch or Mouse event Id
         */
        setEvent : function (event, pageX, pageY, clientX, clientY, pointerId) {
            var width = 1;
            var height = 1;

            // the original event object
            this.event = event;

            this.pageX = pageX || 0;
            this.pageY = pageY || 0;
            this.clientX = clientX || 0;
            this.clientY = clientY || 0;

            // translate to local coordinates
            me.input.globalToLocal(this.pageX, this.pageY, this.pos);

            // true if not originally a pointer event
            this.isNormalized = !me.device.PointerEvent || (me.device.PointerEvent && !(event instanceof window.PointerEvent));

            if (event.type === "wheel") {
                this.deltaMode = event.deltaMode || 0;
                this.deltaX = event.deltaX || 0;
                this.deltaY = event.deltaY || 0;
                this.deltaZ = event.deltaZ || 0;
            } else {
                this.deltaMode = 0;
                this.deltaX = 0;
                this.deltaY = 0;
                this.deltaZ = 0;
            }

            // could be 0, so test if defined
            this.pointerId = (typeof pointerId !== "undefined") ? pointerId : 1;

            this.isPrimary = (typeof event.isPrimary !== "undefined") ? event.isPrimary : true;

            // in case of touch events, button is not defined
            this.button = event.button || 0;

            this.type = event.type;

            this.gameScreenX = this.pos.x;
            this.gameScreenY = this.pos.y;

            // get the current screen to world offset
            if (typeof me.game.viewport !== "undefined") {
                me.game.viewport.localToWorld(this.gameScreenX, this.gameScreenY, viewportOffset);
            }

            /* Initialize the two coordinate space properties. */
            this.gameWorldX = viewportOffset.x;
            this.gameWorldY = viewportOffset.y;

            // get the pointer size
            if (this.isNormalized === false) {
                // native PointerEvent
                width = event.width || 1;
                height = event.height || 1;
            } else if (typeof(event.radiusX) === "number") {
                // TouchEvent
                width = (event.radiusX * 2) || 1;
                height = (event.radiusY * 2) || 1;
            }
            // resize the pointer object accordingly
            this.resize(width, height);
        }
    });
})();
