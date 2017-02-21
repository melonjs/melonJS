/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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
             * the renderable default transformation matrix
             * @public
             * @type me.Matrix2d
             * @name currentTransform
             * @memberOf me.Renderable
             */
            if (typeof this.currentTransform !== "undefined") {
                this.currentTransform.identity();
            } else {
                this.currentTransform = me.pool.pull("me.Matrix2d");
            }

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
             * The anchor point is used for attachment behavior, and/or when applying transformations.<br>
             * The coordinate system places the origin at the top left corner of the frame (0, 0) and (1, 1) means the bottom-right corner<br>
             * <img src="images/anchor_point.png"/> :<br>
             * a Renderable's anchor point defaults to (0.5,0.5), which corresponds to the center position.<br>
             * @public
             * @type me.Vector2d
             * @default <0.5,0.5>
             * @name anchorPoint
             * @memberOf me.Renderable
             */
            this.anchorPoint = new me.Vector2d(0.5, 0.5);

            /**
             * [EXPERIMENTAL] when enabled, an object container will automatically
             * apply any defined transformation before calling the child draw method.
             * @public
             * @type Boolean
             * @default false
             * @name autoTransform
             * @memberOf me.Renderable
             * @example
             * // enable "automatic" transformation when the object is activated
             * onActivateEvent: function () {
             *     // reset the transformation matrix
             *     this.renderable.currentTransform.identity();
             *     // ensure the anchor point is the renderable center
             *     this.renderable.anchorPoint.set(0.5, 0.5);
             *     // enable auto transform
             *     this.renderable.autoTransform = true;
             *     ....
             * },
             * // add a rotation effect when updating the entity
             * update : function (dt) {
             *     ....
             *     this.renderable.currentTransform.rotate(0.025);
             *     ....
             *     return this._super(me.Entity, 'update', [dt]);
             * },
             */
            this.autoTransform = false;

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

            /**
             * Position of the Renderable relative to its parent container
             * @public
             * @type {me.ObservableVector3d}
             * @name pos
             * @memberOf me.Renderable
             */
            if (this.pos instanceof me.ObservableVector3d) {
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
         * multiply the renderable currentTransform with the given matrix
         * @name transform
         * @memberOf me.Renderable
         * @see me.Renderable#currentTransform
         * @function
         * @param {me.Matrix2d} matrix the transformation matrix
         * @return {me.Renderable} Reference to this object for method chaining
         */
        transform : function (m) {
            var bounds = this.getBounds();
            this.currentTransform.multiply(m);
            bounds.setPoints(bounds.transform(m).points);
            bounds.pos.setV(this.pos);
            return this;
        },

        /**
         * scale the renderable around his anchor point
         * @name scale
         * @memberOf me.Renderable
         * @function
         * @param {Number} x a number representing the abscissa of the scaling vector.
         * @param {Number} [y=x] a number representing the ordinate of the scaling vector.
         * @return {me.Renderable} Reference to this object for method chaining
         */
        scale : function (x, y) {
            var _x = x,
                _y = typeof(y) === "undefined" ? _x : y;

            // set the scaleFlag
            this.currentTransform.scale(_x, _y);
            // resize the bounding box
            this.getBounds().resize(this.width * _x, this.height * _y);
            return this;
        },

        /**
         * scale the renderable around his anchor point
         * @name scaleV
         * @memberOf me.Renderable
         * @function
         * @param {me.Vector2d} vector scaling vector
         * @return {me.Renderable} Reference to this object for method chaining
         */
        scaleV : function (v) {
            this.scale(v.x, v.y);
            return this;
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
         * @ignore
         * @name updateBoundsPos
         * @memberOf me.Renderable
         * @function
         */
        updateBoundsPos : function (newX, newY) {
            var bounds = this.getBounds();
            bounds.pos.set(newX, newY, bounds.pos.z);
            // XXX: This is called from the constructor, before it gets an ancestor
            if (this.ancestor) {
                bounds.pos.add(this.ancestor._absPos);
            }
            return bounds;
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
            me.pool.push(this.currentTransform);
            this.currentTransform = undefined;
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
     * width of the Renderable bounding box
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Renderable
     */
    Object.defineProperty(me.Renderable.prototype, "width", {
        /**
         * @ignore
         */
        get : function () {
            return this._width;
        },
        /**
         * @ignore
         */
        set : function (value) {
            this.getBounds().width = value;
            this._width = value;
        },
        configurable : true
    });

    /**
     * height of the Renderable bounding box
     * @public
     * @type {Number}
     * @name height
     * @memberOf me.Renderable
     */
    Object.defineProperty(me.Renderable.prototype, "height", {
        /**
         * @ignore
         */
        get : function () {
            return this._height;
        },
        /**
         * @ignore
         */
        set : function (value) {
            this.getBounds().height = value;
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
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Renderable.Error";
        }
    });
})();
