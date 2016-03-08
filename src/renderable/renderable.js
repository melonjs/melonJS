/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
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
             * @public
             * @readonly
             * @type Boolean
             * @default false
             * @name inViewport
             * @memberOf me.Renderable
             */
            this.inViewport = false;

            /**
             * Whether the renderable object will always update, even when outside of the viewport<br>
             * @public
             * @type Boolean
             * @default false
             * @name alwaysUpdate
             * @memberOf me.Renderable
             */
            this.alwaysUpdate = false;

            /**
             * Whether to update this object when the game is paused.
             * @public
             * @type Boolean
             * @default false
             * @name updateWhenPaused
             * @memberOf me.Renderable
             */
            this.updateWhenPaused = false;

            /**
             * make the renderable object persistent over level changes<br>
             * @public
             * @type Boolean
             * @default false
             * @name isPersistent
             * @memberOf me.Renderable
             */
            this.isPersistent = false;

            /**
             * Define if a renderable follows screen coordinates (floating)<br>
             * or the world coordinates (not floating)<br>
             * @public
             * @type Boolean
             * @default false
             * @name floating
             * @memberOf me.Renderable
             */
            this.floating = false;

            /**
             * Define the object anchoring point<br>
             * This is used when positioning, or scaling the object<br>
             * The anchor point is a value between 0.0 and 1.0 (1.0 being the maximum size of the object) <br>
             * (0, 0) means the top-left corner, <br>
             * (1, 1) means the bottom-right corner, <br>
             * @public
             * @type me.Vector2d
             * @default <0.5,0.5>
             * @name anchorPoint
             * @memberOf me.Renderable
             */
            this.anchorPoint = new me.Vector2d(0.5, 0.5);

            /**
             * Define the renderable opacity<br>
             * Set to zero if you do not wish an object to be drawn
             * @see me.Renderable#setOpacity
             * @see me.Renderable#getOpacity
             * @public
             * @type Number
             * @default 1.0
             * @name me.Renderable#alpha
             */
            this.alpha = 1.0;

            /**
             * a reference to the Container object that contains this renderable,
             * or undefined if it has not been added to one.
             * @public
             * @type me.Container
             * @default undefined
             * @name me.Renderable#ancestor
             */
            this.ancestor = undefined;

            /**
             * The bounding rectangle for this renderable
             * @ignore
             * @type {me.Rect}
             * @name _bounds
             * @memberOf me.Renderable
             */
            if (this._bounds) {
                this._bounds.setShape(x, y, width, height);
            }
            else {
                this._bounds = new me.Rect(x, y, width, height);
            }

            /**
             * Absolute position in the game world
             * @ignore
             * @type {me.Vector2d}
             * @name _absPos
             * @memberOf me.Renderable
             */
            if (this._absPos) {
                this._absPos.set(x, y);
            }
            else {
                this._absPos = new me.Vector2d(x, y);
            }

            // set position to observable. Can use updateBounds, as _bounds using a regular vector.
            // will not lead to stack too deep.
            if (this.pos) {
                this.pos.setMuted(x, y, 0).setCallback(this.updateBoundsPos.bind(this));
            } else {
                this.pos = new me.ObservableVector3d(x, y, 0, { onUpdate: this.updateBoundsPos.bind(this) });
            }

            this._width = width;
            this._height = height;

            this.shapeType = "Rectangle";

            // ensure it's fully opaque by default
            this.setOpacity(1.0);
        },

        /**
         * returns the bounding box for this renderable
         * @name getBounds
         * @memberOf me.Renderable
         * @function
         * @return {me.Rect} bounding box Rectangle object
         */
        getBounds : function () {
            return this._bounds;
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
         * update the renderable's bounding rect dimensions
         * @private
         * @name resizeBounds
         * @memberOf me.Renderable
         * @function
         */
        resizeBounds : function (width, height) {
            this._bounds.resize(width, height);
            return this._bounds;
        },

        /**
         * set the renderable alpha channel value<br>
         * @name setOpacity
         * @memberOf me.Renderable
         * @function
         * @param {Number} alpha opacity value between 0.0 and 1.0
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
            return false;
        },

        /**
         * update the renderable's bounding rect (private)
         * @private
         * @name updateBoundsPos
         * @memberOf me.Renderable
         * @function
         */
        updateBoundsPos : function (newX, newY) {
            this._bounds.pos.set(newX, newY);
            // XXX: This is called from the constructor, before it gets an ancestor
            if (this.ancestor) {
                this._bounds.pos.add(this.ancestor._absPos);
            }
            return this._bounds;
        },

        /**
         * update the bounds
         * @private
         * @deprecated
         * @name updateBounds
         * @memberOf me.Entity
         * @function
         */
        updateBounds : function () {
            console.warn("Deprecated: me.Renderable.updateBounds");
            return this._super(me.Rect, "updateBounds");
        },

        /**
         * object draw
         * called by the game manager on each game loop
         * @name draw
         * @memberOf me.Renderable
         * @function
         * @protected
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
         **/
        draw : function (/*renderer*/) {
            // empty one !
        },

        /**
         * Destroy function<br>
         * @ignore
         */
        destroy : function () {
            this.onDestroyEvent.apply(this, arguments);
        },

        /**
         * OnDestroy Notification function<br>
         * Called by engine before deleting the object
         * @name onDestroyEvent
         * @memberOf me.Renderable
         * @function
         */
        onDestroyEvent : function () {
            // to be extended !
        }
    });

    /**
     * width of the Renderable bounding box<br>
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Renderable
     */
    Object.defineProperty(me.Renderable.prototype, "width", {
        get : function () {
            return this._width;
        },
        set : function (value) {
            this.resizeBounds(value, this._height);
            this._width = value;
        },
        configurable : true
    });

    /**
     * height of the Renderable bounding box <br>
     * @public
     * @type {Number}
     * @name height
     * @memberOf me.Renderable
     */
    Object.defineProperty(me.Renderable.prototype, "height", {
        get : function () {
            return this._height;
        },
        set : function (value) {
            this.resizeBounds(this._width, value);
            this._height = value;
        },
        configurable : true
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
