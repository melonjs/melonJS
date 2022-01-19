import ObservableVector2d from "./../math/observable_vector2.js";
import ObservableVector3d from "./../math/observable_vector3.js";
import Rect from "./../geometries/rectangle.js";
import Container from "./container.js";
import pool from "./../system/pooling.js";
import { releaseAllPointerEvents } from "./../input/input.js";
import { clamp } from "./../math/math.js";

/**
 * @classdesc
 * A base class for renderable objects.
 * @class Renderable
 * @augments me.Rect
 * @memberof me
 * @param {number} x position of the renderable object (accessible through inherited pos.x property)
 * @param {number} y position of the renderable object (accessible through inherited pos.y property)
 * @param {number} width object width
 * @param {number} height object height
 */
class Renderable extends Rect {

    /**
     * @ignore
     */
    constructor(x, y, width, height) {

        // parent constructor
        super(x, y, width, height);

        /**
         * to identify the object as a renderable object
         * @ignore
         */
        this.isRenderable = true;

        /**
         * If true then physic collision and input events will not impact this renderable
         * @public
         * @type {boolean}
         * @default true
         * @name isKinematic
         * @memberof me.Renderable
         */
        this.isKinematic = true;

        /**
         * the renderable physic body
         * @public
         * @type {me.Body}
         * @see me.Body
         * @name body
         * @memberof me.Renderable#
         * @example
         *  // define a new Player Class
         *  class PlayerEntity extends me.Sprite {
         *      // constructor
         *      constructor(x, y, settings) {
         *          // call the parent constructor
         *          super(x, y , settings);
         *
         *          // define a basic walking animation
         *          this.addAnimation("walk",  [...]);
         *          // define a standing animation (using the first frame)
         *          this.addAnimation("stand",  [...]);
         *          // set the standing animation as default
         *          this.setCurrentAnimation("stand");
         *
         *          // add a physic body
         *          this.body = new me.Body(this);
         *          // add a default collision shape
         *          this.body.addShape(new me.Rect(0, 0, this.width, this.height));
         *          // configure max speed, friction, and initial force to be applied
         *          this.body.setMaxVelocity(3, 15);
         *          this.body.setFriction(0.4, 0);
         *          this.body.force.set(3, 0);
         *
         *          // set the display to follow our position on both axis
         *          me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);
         *      }
         *
         *      ...
         *
         * }
         */
        this.body = undefined;

        /**
         * the renderable default transformation matrix
         * @public
         * @type {me.Matrix2d}
         * @name currentTransform
         * @memberof me.Renderable#
         */
        if (typeof this.currentTransform === "undefined") {
            this.currentTransform = pool.pull("Matrix2d");
        }
        this.currentTransform.identity();

       /**
        * (G)ame (U)nique (Id)entifier" <br>
        * a GUID will be allocated for any renderable object added <br>
        * to an object container (including the `me.game.world` container)
        * @public
        * @type {string}
        * @name GUID
        * @memberof me.Renderable
        */
        this.GUID = undefined;

        /**
         * an event handler that is called when the renderable leave or enter a camera viewport
         * @public
         * @type {Function}
         * @default undefined
         * @name onVisibilityChange
         * @memberof me.Renderable#
         * @example
         * this.onVisibilityChange = function(inViewport) {
         *     if (inViewport === true) {
         *         console.log("object has entered the in a camera viewport!");
         *     }
         * };
         */
        this.onVisibilityChange = undefined;

        /**
         * Whether the renderable object will always update, even when outside of the viewport<br>
         * @public
         * @type {boolean}
         * @default false
         * @name alwaysUpdate
         * @memberof me.Renderable
         */
        this.alwaysUpdate = false;

        /**
         * Whether to update this object when the game is paused.
         * @public
         * @type {boolean}
         * @default false
         * @name updateWhenPaused
         * @memberof me.Renderable
         */
        this.updateWhenPaused = false;

        /**
         * make the renderable object persistent over level changes<br>
         * @public
         * @type {boolean}
         * @default false
         * @name isPersistent
         * @memberof me.Renderable
         */
        this.isPersistent = false;

        /**
         * If true, this renderable will be rendered using screen coordinates,
         * as opposed to world coordinates. Use this, for example, to define UI elements.
         * @public
         * @type {boolean}
         * @default false
         * @name floating
         * @memberof me.Renderable
         */
        this.floating = false;

        /**
         * The anchor point is used for attachment behavior, and/or when applying transformations.<br>
         * The coordinate system places the origin at the top left corner of the frame (0, 0) and (1, 1) means the bottom-right corner<br>
         * <img src="images/anchor_point.png"/><br>
         * a Renderable's anchor point defaults to (0.5,0.5), which corresponds to the center position.<br>
         * <br>
         * <i><b>Note:</b> Object created through Tiled will have their anchorPoint set to (0, 0) to match Tiled Level editor implementation.
         * To specify a value through Tiled, use a json expression like `json:{"x":0.5,"y":0.5}`. </i>
         * @public
         * @type {me.ObservableVector2d}
         * @default <0.5,0.5>
         * @name anchorPoint
         * @memberof me.Renderable#
         */
        if (this.anchorPoint instanceof ObservableVector2d) {
            this.anchorPoint.setMuted(0.5, 0.5).setCallback(this.onAnchorUpdate, this);
        } else {
            this.anchorPoint = pool.pull("ObservableVector2d", 0.5, 0.5, { onUpdate: this.onAnchorUpdate, scope: this });
        }

        /**
         * When enabled, an object container will automatically apply
         * any defined transformation before calling the child draw method.
         * @public
         * @type {boolean}
         * @default true
         * @name autoTransform
         * @memberof me.Renderable
         * @example
         * // enable "automatic" transformation when the object is activated
         * onActivateEvent: function () {
         *     // reset the transformation matrix
         *     this.currentTransform.identity();
         *     // ensure the anchor point is the renderable center
         *     this.anchorPoint.set(0.5, 0.5);
         *     // enable auto transform
         *     this.autoTransform = true;
         *     ....
         * }
         */
        this.autoTransform = true;

        /**
         * Define the renderable opacity<br>
         * Set to zero if you do not wish an object to be drawn
         * @see me.Renderable#setOpacity
         * @see me.Renderable#getOpacity
         * @public
         * @type {number}
         * @default 1.0
         * @name me.Renderable#alpha
         */
        this.alpha = 1.0;

        /**
         * a reference to the parent object that contains this renderable
         * @public
         * @type {me.Container|me.Entity}
         * @default undefined
         * @name me.Renderable#ancestor
         */
        this.ancestor = undefined;

        /**
         * A mask limits rendering elements to the shape and position of the given mask object.
         * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
         * @public
         * @type {me.Rect|me.Polygon|me.Line|me.Ellipse}
         * @name mask
         * @default undefined
         * @memberof me.Renderable#
         * @example
         * // apply a mask in the shape of a Star
         * myNPCSprite.mask = new me.Polygon(myNPCSprite.width / 2, 0, [
         *    // draw a star
         *    {x: 0, y: 0},
         *    {x: 14, y: 30},
         *    {x: 47, y: 35},
         *    {x: 23, y: 57},
         *    {x: 44, y: 90},
         *    {x: 0, y: 62},
         *    {x: -44, y: 90},
         *    {x: -23, y: 57},
         *    {x: -47, y: 35},
         *    {x: -14, y: 30}
         * ]);
         */
        this.mask = undefined;

        /**
         * define a tint for this renderable. a (255, 255, 255) r, g, b value will remove the tint effect.
         * @public
         * @type {me.Color}
         * @name tint
         * @default (255, 255, 255)
         * @memberof me.Renderable#
         * @example
         * // add a red tint to this renderable
         * this.tint.setColor(255, 128, 128);
         * // remove the tint
         * this.tint.setColor(255, 255, 255);
         */
        this.tint = pool.pull("Color", 255, 255, 255, 1.0);

        /**
         * The name of the renderable
         * @public
         * @type {string}
         * @name name
         * @default ""
         * @memberof me.Renderable
         */
        this.name = "";

        /**
         * Position of the Renderable relative to its parent container
         * @public
         * @type {me.ObservableVector3d}
         * @name pos
         * @memberof me.Renderable#
         */
        if (this.pos instanceof ObservableVector3d) {
            this.pos.setMuted(x, y, 0).setCallback(this.updateBoundsPos, this);
        } else {
            this.pos = pool.pull("ObservableVector3d", x, y, 0, { onUpdate: this.updateBoundsPos, scope: this});
        }

        /**
         * when true the renderable will be redrawn during the next update cycle
         * @type {boolean}
         * @name isDirty
         * @default false
         * @memberof me.Renderable#
         */
        this.isDirty = false;

        // keep track of when we flip
        this._flip = {
            x : false,
            y : false
        };

        // viewport flag
        this._inViewport = false;

        // ensure it's fully opaque by default
        this.setOpacity(1.0);
    }

    /**
     * Whether the renderable object is floating, or contained in a floating container
     * @public
     * @see me.Renderable#floating
     * @readonly
     * @type {boolean}
     * @name isFloating
     * @memberof me.Renderable
     */
    get isFloating() {
        return this.floating === true || (typeof this.ancestor !== "undefined" && this.ancestor.floating === true);
    }

    /**
     * Whether the renderable object is visible and within the viewport
     * @public
     * @readonly
     * @type {boolean}
     * @default false
     * @name inViewport
     * @memberof me.Renderable
     */

    get inViewport() {
        return this._inViewport;
    }

    set inViewport(value) {
        if (this._inViewport !== value) {
            this._inViewport = value;
            if (typeof this.onVisibilityChange === "function") {
                this.onVisibilityChange.call(this, value);
            }
        }
    }

    /**
     * returns true if this renderable is flipped on the horizontal axis
     * @public
     * @see me.Renderable#flipX
     * @type {boolean}
     * @name isFlippedX
     * @memberof me.Renderable
     */

    get isFlippedX() {
        return this._flip.x === true;
    }

    /**
     * returns true if this renderable is flipped on the vertical axis
     * @public
     * @see me.Renderable#flipY
     * @type {boolean}
     * @name isFlippedY
     * @memberof me.Renderable
     */

    get isFlippedY() {
        return this._flip.y === true;
    }

    /**
     * returns the bounding box for this renderable
     * @name getBounds
     * @memberof me.Renderable.prototype
     * @function
     * @returns {me.Bounds} bounding box Rectangle object
     */
    getBounds() {
        if (typeof this._bounds === "undefined") {
            super.getBounds();
            if (this.isFinite()) {
                this._bounds.setMinMax(this.pos.x, this.pos.y, this.pos.x + this.width, this.pos.y + this.height);
            } else {
                // e.g. containers or game world can have infinite size
                this._bounds.setMinMax(this.pos.x, this.pos.y, this.width, this.height);
            }

        }
        return this._bounds;
    }

    /**
     * get the renderable alpha channel value<br>
     * @name getOpacity
     * @memberof me.Renderable.prototype
     * @function
     * @returns {number} current opacity value between 0 and 1
     */
    getOpacity() {
        return this.alpha;
    }

    /**
     * set the renderable alpha channel value<br>
     * @name setOpacity
     * @memberof me.Renderable.prototype
     * @function
     * @param {number} alpha opacity value between 0.0 and 1.0
     */
    setOpacity(alpha) {
        if (typeof (alpha) === "number") {
            this.alpha = clamp(alpha, 0.0, 1.0);
            // Set to 1 if alpha is NaN
            if (isNaN(this.alpha)) {
                this.alpha = 1.0;
            }
            this.isDirty = true;
        }
    }

    /**
     * flip the renderable on the horizontal axis (around the center of the renderable)
     * @see me.Matrix2d#scaleX
     * @name flipX
     * @memberof me.Renderable.prototype
     * @function
     * @param {boolean} [flip=true] `true` to flip this renderable.
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    flipX(flip = true) {
        this._flip.x = !!flip;
        this.isDirty = true;
        return this;
    }

    /**
     * flip the renderable on the vertical axis (around the center of the renderable)
     * @see me.Matrix2d#scaleY
     * @name flipY
     * @memberof me.Renderable.prototype
     * @function
     * @param {boolean} [flip=true] `true` to flip this renderable.
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    flipY(flip = true) {
        this._flip.y = !!flip;
        this.isDirty = true;
        return this;
    }

    /**
     * multiply the renderable currentTransform with the given matrix
     * @name transform
     * @memberof me.Renderable.prototype
     * @see me.Renderable#currentTransform
     * @function
     * @param {me.Matrix2d} m the transformation matrix
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    transform(m) {
        this.currentTransform.multiply(m);
        //super.transform(m);
        this.updateBoundsPos(this.pos.x, this.pos.y);
        this.isDirty = true;
        return this;
    }

    /**
     * return the angle to the specified target
     * @name angleTo
     * @memberof me.Renderable
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target
     * @returns {number} angle in radians
     */
    angleTo(target) {
        var a = this.getBounds();
        var ax, ay;

        if (target instanceof Renderable) {
            var b = target.getBounds();
            ax = b.centerX - a.centerX;
            ay = b.centerY - a.centerY;
        } else { // vector object
            ax = target.x - a.centerX;
            ay = target.y - a.centerY;
        }

        return Math.atan2(ay, ax);
    }

    /**
     * return the distance to the specified target
     * @name distanceTo
     * @memberof me.Renderable
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target
     * @returns {number} distance
     */
    distanceTo(target) {
        var a = this.getBounds();
        var dx, dy;

        if (target instanceof Renderable) {
            var b = target.getBounds();
            dx = a.centerX - b.centerX;
            dy = a.centerY - b.centerY;
        } else { // vector object
            dx = a.centerX - target.x;
            dy = a.centerY - target.y;
        }

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Rotate this renderable towards the given target.
     * @name lookAt
     * @memberof me.Renderable.prototype
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target the renderable or position to look at
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    lookAt(target) {
        var position;

        if (target instanceof Renderable) {
            position = target.pos;
        } else {
            position = target;
        }

        var angle = this.angleTo(position);

        this.rotate(angle);

        return this;
    }

    /**
     * Rotate this renderable by the specified angle (in radians).
     * @name rotate
     * @memberof me.Renderable.prototype
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    rotate(angle, v) {
        if (!isNaN(angle)) {
            this.currentTransform.rotate(angle, v);
            //this.updateBoundsPos(this.pos.x, this.pos.y);
            this.isDirty = true;
        }
        return this;
    }

    /**
     * scale the renderable around his anchor point.  Scaling actually applies changes
     * to the currentTransform member wich is used by the renderer to scale the object
     * when rendering.  It does not scale the object itself.  For example if the renderable
     * is an image, the image.width and image.height properties are unaltered but the currentTransform
     * member will be changed.
     * @name scale
     * @memberof me.Renderable.prototype
     * @function
     * @param {number} x a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] a number representing the ordinate of the scaling vector.
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    scale(x, y) {
        this.currentTransform.scale(x, y);
        super.scale(x, y);
        this.isDirty = true;
        return this;
    }

    /**
     * scale the renderable around his anchor point
     * @name scaleV
     * @memberof me.Renderable.prototype
     * @function
     * @param {me.Vector2d} v scaling vector
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    scaleV(v) {
        this.scale(v.x, v.y);
        return this;
    }

    /**
     * update function. <br>
     * automatically called by the game manager {@link me.game}
     * @name update
     * @memberof me.Renderable.prototype
     * @function
     * @protected
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean} true if the renderable is dirty
     */
    update(/* dt */) {
        return this.isDirty;
    }

    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberof me.Renderable.prototype
     * @function
     * @returns {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds() {
        super.updateBounds();
        this.updateBoundsPos(this.pos.x, this.pos.y);
        return this.getBounds();
    }

    /**
     * update the renderable's bounding rect (private)
     * @ignore
     * @name updateBoundsPos
     * @memberof me.Renderable.prototype
     * @function
     */
     updateBoundsPos(newX, newY) {
         var bounds = this.getBounds();

         bounds.shift(newX, newY);

         if (typeof this.anchorPoint !== "undefined" && bounds.isFinite()) {
             bounds.translate(
                 -(this.anchorPoint.x * bounds.width),
                 -(this.anchorPoint.y * bounds.height)
             );
         }

         /*
         if (typeof this.body !== "undefined") {
              var bodyBounds = this.body.getBounds();
              bounds.translate(bodyBounds.x, bodyBounds.y);
         }
         */

         // XXX: This is called from the constructor, before it gets an ancestor
         if (this.ancestor instanceof Container && this.floating !== true) {
             bounds.translate(this.ancestor.getAbsolutePosition());
         }
         //return bounds;
     }

     /**
      * return the renderable absolute position in the game world
      * @name getAbsolutePosition
      * @memberof me.Renderable.prototype
      * @function
      * @returns {me.Vector2d}
      */
      getAbsolutePosition() {
          if (typeof this._absPos === "undefined") {
              this._absPos = pool.pull("Vector2d");
          }
          // XXX Cache me or something
          this._absPos.set(this.pos.x, this.pos.y);
          if (this.ancestor instanceof Container && this.floating !== true) {
              this._absPos.add(this.ancestor.getAbsolutePosition());
          }
          return this._absPos;
      }

    /**
     * called when the anchor point value is changed
     * @private
     * @name onAnchorUpdate
     * @memberof me.Renderable.prototype
     * @function
     * @param {number} x the new X value to be set for the anchor
     * @param {number} y the new Y value to be set for the anchor
     */
     onAnchorUpdate(x, y) {
         // since the callback is called before setting the new value
         // manually update the anchor point (required for updateBoundsPos)
         this.anchorPoint.setMuted(x, y);
         // then call updateBounds
         this.updateBoundsPos(this.pos.x, this.pos.y);
     }

    /**
     * prepare the rendering context before drawing
     * (apply defined transforms, anchor point). <br>
     * automatically called by the game manager {@link me.game}
     * @name preDraw
     * @memberof me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    preDraw(renderer) {
        var bounds = this.getBounds();
        var ax = bounds.width * this.anchorPoint.x,
            ay = bounds.height * this.anchorPoint.y;

        // save renderer context
        renderer.save();

        // apply the defined alpha value
        renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

        // apply flip
        if (this._flip.x || this._flip.y) {
            var dx = this._flip.x ? this.centerX - ax : 0,
                dy = this._flip.y ? this.centerY - ay : 0;

            renderer.translate(dx, dy);
            renderer.scale(this._flip.x  ? -1 : 1, this._flip.y  ? -1 : 1);
            renderer.translate(-dx, -dy);
        }

        // apply stencil mask if defined
        if (typeof this.mask !== "undefined") {
            renderer.translate(this.pos.x, this.pos.y);
            renderer.setMask(this.mask);
            renderer.translate(-this.pos.x, -this.pos.y);
        }

        if ((this.autoTransform === true) && (!this.currentTransform.isIdentity())) {
            // apply the renderable transformation matrix
            renderer.translate(this.pos.x, this.pos.y);
            renderer.transform(this.currentTransform);
            renderer.translate(-this.pos.x, -this.pos.y);
        }

        // offset by the anchor point
        renderer.translate(-ax, -ay);

        // apply the current tint and opacity
        renderer.setTint(this.tint, this.getOpacity());
    }

    /**
     * object draw. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberof me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    draw(/*renderer*/) {
        // empty one !
    }

    /**
     * restore the rendering context after drawing. <br>
     * automatically called by the game manager {@link me.game}
     * @name postDraw
     * @memberof me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    postDraw(renderer) {

        // remove the previously applied tint
        renderer.clearTint();

        // clear the mask if set
        if (typeof this.mask !== "undefined") {
            renderer.clearMask();
        }

        // restore the context
        renderer.restore();

        // reset the dirty flag
        this.isDirty = false;
    }

    /**
     * onCollision callback, triggered in case of collision,
     * when this renderable body is colliding with another one
     * @name onCollision
     * @memberof me.Renderable.prototype
     * @function
     * @param {me.collision.ResponseObject} response the collision response object
     * @param {me.Renderable} other the other renderable touching this one (a reference to response.a or response.b)
     * @returns {boolean} true if the object should respond to the collision (its position and velocity will be corrected)
     * @example
     * // colision handler
     * onCollision(response) {
     *     if (response.b.body.collisionType === me.collision.types.ENEMY_OBJECT) {
     *         // makes the other object solid, by substracting the overlap vector to the current position
     *         this.pos.sub(response.overlapV);
     *         this.hurt();
     *         // not solid
     *         return false;
     *     }
     *     // Make the object solid
     *     return true;
     * },
     */
    onCollision() {
        return false;
    }

    /**
     * Destroy function<br>
     * @ignore
     */
    destroy() {
        // allow recycling object properties
        pool.push(this.currentTransform);
        this.currentTransform = undefined;

        pool.push(this.anchorPoint);
        this.anchorPoint = undefined;

        pool.push(this.pos);
        this.pos = undefined;

        if (typeof this._absPos !== "undefined") {
            pool.push(this._absPos);
            this._absPos = undefined;
        }

        pool.push(this._bounds);
        this._bounds = undefined;

        this.onVisibilityChange = undefined;

        if (typeof this.mask !== "undefined") {
            pool.push(this.mask);
            this.mask = undefined;
        }

        if (typeof this.tint !== "undefined") {
            pool.push(this.tint);
            this.tint = undefined;
        }

        this.ancestor = undefined;

        // destroy the physic body if defined
        if (typeof this.body !== "undefined") {
            this.body.destroy.apply(this.body, arguments);
            this.body = undefined;
        }

        // release all registered events
        releaseAllPointerEvents(this);

        // call the user defined destroy method
        this.onDestroyEvent.apply(this, arguments);
    }

    /**
     * OnDestroy Notification function<br>
     * Called by engine before deleting the object
     * @name onDestroyEvent
     * @memberof me.Renderable
     * @function
     */
    onDestroyEvent() {
        // to be extended !
    }

};


export default Renderable;
