/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * A base class for renderable objects.
     * @class
     * @extends me.Rect
     * @memberOf me
     * @constructor
     * @param {Number} x position of the renderable object
     * @param {Number} y position of the renderable object
     * @param {Number} width object width
     * @param {Number} height object height
     */
    me.Renderable = me.Rect.extend(
    /** @scope me.Renderable.prototype */
    {
        /**
         * @ignore
         */
        init : function (x, y, width, height) {
            /**
             * to identify the object as a renderable object
             * @ignore
             */
            this.isRenderable = true;

           /**
            * (G)ame (U)nique (Id)entifier" <br>
            * a GUID will be allocated for any renderable object added <br>
            * to an object container (including the `me.game.world` container)
            * @public
            * @type String
            * @name GUID
            * @memberOf me.Renderable
            */
            this.GUID = undefined;

            /**
             * Whether the renderable object is visible and within the viewport<br>
             * default value : false
             * @public
             * @readonly
             * @type Boolean
             * @name inViewport
             * @memberOf me.Renderable
             */
            this.inViewport = false;

            /**
             * Whether the renderable object will always update, even when outside of the viewport<br>
             * default value : false
             * @public
             * @type Boolean
             * @name alwaysUpdate
             * @memberOf me.Renderable
             */
            this.alwaysUpdate = false;

            /**
             * Whether to update this object when the game is paused.
             * default value : false
             * @public
             * @type Boolean
             * @name updateWhenPaused
             * @memberOf me.Renderable
             */
            this.updateWhenPaused = false;

            /**
             * make the renderable object persistent over level changes<br>
             * default value : false
             * @public
             * @type Boolean
             * @name isPersistent
             * @memberOf me.Renderable
             */
            this.isPersistent = false;

            /**
             * Define if a renderable follows screen coordinates (floating)<br>
             * or the world coordinates (not floating)<br>
             * default value : false
             * @public
             * @type Boolean
             * @name floating
             * @memberOf me.Renderable
             */
            this.floating = false;

            /**
             * Z-order for object sorting<br>
             * default value : NaN; will be automatically set by me.Container.addChild()
             * @private
             * @type Number
             * @name z
             * @memberOf me.Renderable
             */
            this.z = NaN;

            /**
             * Define the object anchoring point<br>
             * This is used when positioning, or scaling the object<br>
             * The anchor point is a value between 0.0 and 1.0 (1.0 being the maximum size of the object) <br>
             * (0, 0) means the top-left corner, <br>
             * (1, 1) means the bottom-right corner, <br>
             * default anchoring point is the center (0.5, 0.5) of the object.
             * @public
             * @type me.Vector2d
             * @name anchorPoint
             * @memberOf me.Renderable
             */
            this.anchorPoint = new me.Vector2d();

            /**
             * Define the renderable opacity<br>
             * Set to zero if you do not wish an object to be drawn
             * @see me.Renderable#setOpacity
             * @see me.Renderable#getOpacity
             * @public
             * @type Number
             * @name me.Renderable#alpha
             */
            this.alpha = 1.0;
            // call the super constructor
            this._super(me.Rect, "init", [x, y, width, height]);

            // set the default anchor point (middle of the renderable)
            this.anchorPoint.set(0.5, 0.5);

            // ensure it's fully opaque by default
            this.setOpacity(1.0);

            /**
             * Absolute position in the game world
             * @private
             * @name me.Renderable#_absoluteBounds
             */
            this._absoluteBounds = new me.Rect(x, y, width, height);
        },

        /**
         * get the renderable alpha channel value<br>
         * @name getOpacity
         * @memberOf me.Renderable
         * @function
         * @return {Number} current opacity value between 0 and 1
         */
        getOpacity : function () {
            return this.alpha;
        },

        /**
         * set the renderable alpha channel value<br>
         * @name setOpacity
         * @memberOf me.Renderable
         * @function
         * @param {Number} alpha opacity value between 0 and 1
         */
        setOpacity : function (alpha) {
            if (typeof (alpha) === "number") {
                this.alpha = alpha.clamp(0.0, 1.0);
                // Set to 1 if alpha is NaN
                if (this.alpha !== this.alpha) {
                    this.alpha = 1.0;
                }
            }
        },

        /**
         * update function
         * called by the game manager on each game loop
         * @name update
         * @memberOf me.Renderable
         * @function
         * @protected
         * @param {Number} dt time since the last update in milliseconds.
         * @return false
         **/
        update : function () {
            this.updateAbsoluteBounds();
            return false;
        },

        updateAbsoluteBounds : function () {
            if (this.ancestor && this.ancestor._absoluteBounds) {
                var pos = this.ancestor._absoluteBounds.pos;
                this._absoluteBounds.setShape(this.pos.x + pos.x, this.pos.y + pos.y, this.width, this.height);
            }
            else {
                this._absoluteBounds.setShape(this.pos.x, this.pos.y, this.width, this.height);
            }
        },

        /**
         * object draw
         * called by the game manager on each game loop
         * @name draw
         * @memberOf me.Renderable
         * @function
         * @protected
         * @param {Renderer} a renderer object: me.CanvasRenderer or me.WebGLRenderer
         **/
        draw : function (/*renderer*/) {
            // empty one !
        }
    });

    /**
     * Base class for Renderable exception handling.
     * @name Error
     * @class
     * @memberOf me.Renderable
     * @constructor
     * @param {String} msg Error message.
     */
    me.Renderable.Error = me.Error.extend({
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Renderable.Error";
        }
    });
})();
