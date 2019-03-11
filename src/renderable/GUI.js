(function () {

    /**
     * GUI Object<br>
     * A very basic object to manage GUI elements <br>
     * The object simply register on the "pointerdown" <br>
     * or "touchstart" event and call the onClick function"
     * @class
     * @extends me.Sprite
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinate of the GUI Object
     * @param {Number} y the y coordinate of the GUI Object
     * @param {Object} settings See {@link me.Sprite}
     * @example
     *
     * // create a basic GUI Object
     * var myButton = me.GUI_Object.extend(
     * {
     *    init:function (x, y)
     *    {
     *       var settings = {}
     *       settings.image = "button";
     *       settings.framewidth = 100;
     *       settings.frameheight = 50;
     *       // super constructor
     *       this._super(me.GUI_Object, "init", [x, y, settings]);
     *       // define the object z order
     *       this.pos.z = 4;
     *    },
     *
     *    // output something in the console
     *    // when the object is clicked
     *    onClick:function (event)
     *    {
     *       console.log("clicked!");
     *       // don't propagate the event
     *       return false;
     *    }
     * });
     *
     * // add the object at pos (10,10)
     * me.game.world.addChild(new myButton(10,10));
     *
     */
    me.GUI_Object = me.Sprite.extend({
        /**
         * @ignore
         */
        init : function (x, y, settings) {
            /**
             * object can be clicked or not
             * @public
             * @type boolean
             * @default true
             * @name me.GUI_Object#isClickable
             */
            this.isClickable = true;

            /**
             * Tap and hold threshold timeout in ms
             * @type {number}
             * @default 250
             * @name me.GUI_Object#holdThreshold
             */
            this.holdThreshold = 250;

            /**
             * object can be tap and hold
             * @public
             * @type boolean
             * @default false
             * @name me.GUI_Object#isHoldable
             */
            this.isHoldable = false;

            /**
             * true if the pointer is over the object
             * @public
             * @type boolean
             * @default false
             * @name me.GUI_Object#hover
             */
            this.hover = false;

            // object has been updated (clicked,etc..)
            this.holdTimeout = null;
            this.updated = false;
            this.released = true;

            // call the parent constructor
            this._super(me.Sprite, "init", [ x, y, settings ]);

            // GUI items use screen coordinates
            this.floating = true;

            // enable event detection
            this.isKinematic = false;
        },

        /**
         * return true if the object has been clicked
         * @ignore
         */
        update : function (dt) {
            // call the parent constructor
            var updated = this._super(me.Sprite, "update", [ dt ]);
            // check if the button was updated
            if (this.updated) {
                // clear the flag
                if (!this.released) {
                    this.updated = false;
                }
                return true;
            }
            // else only return true/false based on the parent function
            return updated;
        },

        /**
         * function callback for the pointerdown event
         * @ignore
         */
        clicked : function (event) {
            // Check if left mouse button is pressed
            if (event.button === 0 && this.isClickable) {
                this.updated = true;
                this.released = false;
                if (this.isHoldable) {
                    if (this.holdTimeout !== null) {
                        me.timer.clearTimeout(this.holdTimeout);
                    }
                    this.holdTimeout = me.timer.setTimeout(this.hold.bind(this), this.holdThreshold, false);
                    this.released = false;
                }
                return this.onClick.call(this, event);
            }
        },

        /**
         * function called when the object is pressed <br>
         * to be extended <br>
         * return false if we need to stop propagating the event
         * @name onClick
         * @memberOf me.GUI_Object.prototype
         * @public
         * @function
         * @param {Event} event the event object
         */
        onClick : function (/* event */) {
            return false;
        },

        /**
         * function callback for the pointerEnter event
         * @ignore
         */
        enter : function (event) {
            this.hover = true;
            return this.onOver.call(this, event);
        },

        /**
         * function called when the pointer is over the object
         * @name onOver
         * @memberOf me.GUI_Object.prototype
         * @public
         * @function
         * @param {Event} event the event object
         */
        onOver : function (/* event */) {},

        /**
         * function callback for the pointerLeave event
         * @ignore
         */
        leave : function (event) {
            this.hover = false;
            this.release.call(this, event);
            return this.onOut.call(this, event);
        },

        /**
         * function called when the pointer is leaving the object area
         * @name onOut
         * @memberOf me.GUI_Object.prototype
         * @public
         * @function
         * @param {Event} event the event object
         */
        onOut : function (/* event */) {},

        /**
         * function callback for the pointerup event
         * @ignore
         */
        release : function (event) {
            if (this.released === false) {
                this.released = true;
                me.timer.clearTimeout(this.holdTimeout);
                return this.onRelease.call(this, event);
            }
        },

        /**
         * function called when the object is pressed and released <br>
         * to be extended <br>
         * return false if we need to stop propagating the event
         * @name onRelease
         * @memberOf me.GUI_Object.prototype
         * @public
         * @function
         * @param {Event} event the event object
         */
        onRelease : function () {
            return false;
        },

        /**
         * function callback for the tap and hold timer event
         * @ignore
         */
        hold : function () {
            me.timer.clearTimeout(this.holdTimeout);
            if (!this.released) {
                this.onHold.call(this);
            }
        },

        /**
         * function called when the object is pressed and held<br>
         * to be extended <br>
         * @name onHold
         * @memberOf me.GUI_Object.prototype
         * @public
         * @function
         */
        onHold : function () {},

        /**
         * function called when added to the game world or a container
         * @ignore
         */
        onActivateEvent : function () {
            // register pointer events
            me.input.registerPointerEvent("pointerdown", this, this.clicked.bind(this));
            me.input.registerPointerEvent("pointerup", this, this.release.bind(this));
            me.input.registerPointerEvent("pointercancel", this, this.release.bind(this));
            me.input.registerPointerEvent("pointerenter", this, this.enter.bind(this));
            me.input.registerPointerEvent("pointerleave", this, this.leave.bind(this));
        },

        /**
         * function called when removed from the game world or a container
         * @ignore
         */
        onDeactivateEvent : function () {
            // release pointer events
            me.input.releasePointerEvent("pointerdown", this);
            me.input.releasePointerEvent("pointerup", this);
            me.input.releasePointerEvent("pointercancel", this);
            me.input.releasePointerEvent("pointerenter", this);
            me.input.releasePointerEvent("pointerleave", this);
            me.timer.clearTimeout(this.holdTimeout);
        }
    });
})();
