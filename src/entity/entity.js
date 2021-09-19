import Vector2d from "./../math/vector2.js";
import Renderable from "./../renderable/renderable.js";
import Sprite from "./../renderable/sprite.js";
import Body from "./../physics/body.js";
import Polygon from "./../shapes/poly.js";


/**
 * a Generic Object Entity
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @see me.Renderable
 * @constructor
 * @param {Number} x the x coordinates of the entity object
 * @param {Number} y the y coordinates of the entity object
 * @param {Object} settings Entity properties, to be defined through Tiled or when calling the entity constructor
 * <img src="images/object_properties.png"/>
 * @param {Number} settings.width the physical width the entity takes up in game
 * @param {Number} settings.height the physical height the entity takes up in game
 * @param {String} [settings.name] object entity name
 * @param {String} [settings.id] object unique IDs
 * @param {Image|String} [settings.image] resource name of a spritesheet to use for the entity renderable component
 * @param {me.Vector2d} [settings.anchorPoint=0.0] Entity anchor point
 * @param {Number} [settings.framewidth=settings.width] width of a single frame in the given spritesheet
 * @param {Number} [settings.frameheight=settings.width] height of a single frame in the given spritesheet
 * @param {String} [settings.type] object type
 * @param {Number} [settings.collisionMask] Mask collision detection for this object
 * @param {me.Rect[]|me.Polygon[]|me.Line[]|me.Ellipse[]} [settings.shapes] the initial list of collision shapes (usually populated through Tiled)
 */
var Entity = Renderable.extend({
    /**
     * @ignore
     */
    init : function (x, y, settings) {

        /**
         * The array of renderable children of this entity.
         * @ignore
         */
        this.children = [];

        // ensure mandatory properties are defined
        if ((typeof settings.width !== "number") || (typeof settings.height !== "number")) {
            throw new Error("height and width properties are mandatory when passing settings parameters to an object entity");
        }

        // call the super constructor
        this._super(Renderable, "init", [x, y, settings.width, settings.height]);

        if (settings.image) {
            // set the frame size to the given entity size, if not defined in settings
            settings.framewidth = settings.framewidth || settings.width;
            settings.frameheight = settings.frameheight || settings.height;
            this.renderable = new Sprite(0, 0, settings);
        }

        // Update anchorPoint
        if (settings.anchorPoint) {
            this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
        } else {
            // for backward compatibility
            this.anchorPoint.set(0, 0);
        }

        // set the sprite name if specified
        if (typeof (settings.name) === "string") {
            this.name = settings.name;
        }

        /**
         * object type (as defined in Tiled)
         * @public
         * @type String
         * @name type
         * @memberOf me.Entity
         */
        this.type = settings.type || "";

        /**
         * object unique ID (as defined in Tiled)
         * @public
         * @type Number
         * @name id
         * @memberOf me.Entity
         */
        this.id = settings.id || "";

        /**
         * dead/living state of the entity<br>
         * default value : true
         * @public
         * @type Boolean
         * @name alive
         * @memberOf me.Entity
         */
        this.alive = true;

        /**
         * the entity body object
         * @public
         * @type me.Body
         * @name body
         * @memberOf me.Entity
         */
        // initialize the default body

        if (typeof settings.shapes === "undefined") {
            settings.shapes = new Polygon(0, 0, [
                new Vector2d(0,          0),
                new Vector2d(this.width, 0),
                new Vector2d(this.width, this.height),
                new Vector2d(0,          this.height)
            ]);
        }

        if (typeof this.body !== "undefined") {
            this.body.init(this, settings.shapes, this.onBodyUpdate.bind(this));
        }
        else {
            this.body = new Body(this, settings.shapes, this.onBodyUpdate.bind(this));
        }

        // resize the entity if required
        if (this.width === 0 && this.height === 0) {
            this.resize(this.body.getBounds().width, this.body.getBounds().height);
        }

        // set the  collision mask and type (if defined)
        this.body.setCollisionMask(settings.collisionMask);
        this.body.setCollisionType(settings.collisionType);

        // disable for entities
        this.autoTransform = false;
    },

    /** @ignore */
    update : function (dt) {
        if (this.renderable) {
            return this.renderable.update(dt);
        }
        return this._super(Renderable, "update", [dt]);
    },

    /**
     * update the bounds position when the body is modified
     * @private
     * @name onBodyUpdate
     * @memberOf me.Entity
     * @function
     */
    onBodyUpdate : function (body) {
        // update the entity bounds to include the body bounds
        this.getBounds().addBounds(body.getBounds(), true);
        // update the bounds pos
        this.updateBoundsPos(this.pos.x, this.pos.y);
    },

    preDraw : function (renderer) {
        renderer.save();

        // translate to the entity position
        renderer.translate(
            this.pos.x + this.body.getBounds().x,
            this.pos.y + this.body.getBounds().y
        );

        if (this.renderable instanceof Renderable) {
            // draw the child renderable's anchorPoint at the entity's
            // anchor point.  the entity's anchor point is a scale from
            // body position to body width/height
            renderer.translate(
                this.anchorPoint.x * this.body.getBounds().width,
                this.anchorPoint.y * this.body.getBounds().height
            );
        }
    },

    /**
     * object draw<br>
     * not to be called by the end user<br>
     * called by the game manager on each game loop
     * @name draw
     * @memberOf me.Entity
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {me.Rect} region to draw
     **/
    draw : function (renderer, rect) {
        var renderable = this.renderable;
        if (renderable instanceof Renderable) {
            // predraw (apply transforms)
            renderable.preDraw(renderer);

            // draw the object
            renderable.draw(renderer, rect);

            // postdraw (clean-up);
            renderable.postDraw(renderer);
        }
    },

    /**
     * Destroy function<br>
     * @ignore
     */
    destroy : function () {
        // free some property objects
        if (this.renderable) {
            this.renderable.destroy.apply(this.renderable, arguments);
            this.children.splice(0, 1);
        }

        // call the parent destroy method
        this._super(Renderable, "destroy", arguments);
    },

    /**
     * onDeactivateEvent Notification function<br>
     * Called by engine before deleting the object
     * @name onDeactivateEvent
     * @memberOf me.Entity
     * @function
     */
    onDeactivateEvent : function () {
      if (this.renderable && this.renderable.onDeactivateEvent) {
          this.renderable.onDeactivateEvent();
      }
    },

    /**
     * onCollision callback<br>
     * triggered in case of collision, when this entity body is being "touched" by another one<br>
     * @name onCollision
     * @memberOf me.Entity
     * @function
     * @param {me.collision.ResponseObject} response the collision response object
     * @param {me.Entity} other the other entity touching this one (a reference to response.a or response.b)
     * @return {Boolean} true if the object should respond to the collision (its position and velocity will be corrected)
     */
    onCollision : function () {
        return false;
    }
});


/**
 * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
 * @public
 * @type me.Renderable
 * @name renderable
 * @memberOf me.Entity
 */
Object.defineProperty(Entity.prototype, "renderable", {
    /* for backward compatiblity */
    /**
     * @ignore
     */
    get : function () {
        return this.children[0];
    },
    /**
     * @ignore
     */
    set : function (value) {
        if (value instanceof Renderable) {
            this.children[0] = value;
            this.children[0].ancestor = this;
        } else {
            throw new Error(value + "should extend me.Renderable");
        }
    },
    configurable : true
});

export default Entity;
