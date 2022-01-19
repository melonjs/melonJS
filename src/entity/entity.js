import Vector2d from "./../math/vector2.js";
import Renderable from "./../renderable/renderable.js";
import Sprite from "./../renderable/sprite.js";
import Body from "./../physics/body.js";
import Polygon from "./../geometries/poly.js";


/**
 * @classdesc
 * a Generic Object Entity
 * @class Entity
 * @augments me.Renderable
 * @memberof me
 * @see me.Renderable
 * @param {number} x the x coordinates of the entity object
 * @param {number} y the y coordinates of the entity object
 * @param {object} settings Entity properties, to be defined through Tiled or when calling the entity constructor
 * <img src="images/object_properties.png"/>
 * @param {number} settings.width the physical width the entity takes up in game
 * @param {number} settings.height the physical height the entity takes up in game
 * @param {string} [settings.name] object entity name
 * @param {string} [settings.id] object unique IDs
 * @param {Image|string} [settings.image] resource name of a spritesheet to use for the entity renderable component
 * @param {me.Vector2d} [settings.anchorPoint=0.0] Entity anchor point
 * @param {number} [settings.framewidth=settings.width] width of a single frame in the given spritesheet
 * @param {number} [settings.frameheight=settings.width] height of a single frame in the given spritesheet
 * @param {string} [settings.type] object type
 * @param {number} [settings.collisionMask] Mask collision detection for this object
 * @param {me.Rect[]|me.Polygon[]|me.Line[]|me.Ellipse[]} [settings.shapes] the initial list of collision shapes (usually populated through Tiled)
 */

class Entity extends Renderable {


    /**
     * @ignore
     */
    constructor(x, y, settings) {

        // ensure mandatory properties are defined
        if ((typeof settings.width !== "number") || (typeof settings.height !== "number")) {
            throw new Error("height and width properties are mandatory when passing settings parameters to an object entity");
        }

        // call the super constructor
        super(x, y, settings.width, settings.height);

        /**
         * The array of renderable children of this entity.
         * @ignore
         */
        this.children = [];

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
         * @type {string}
         * @name type
         * @memberof me.Entity
         */
        this.type = settings.type || "";

        /**
         * object unique ID (as defined in Tiled)
         * @public
         * @type {number}
         * @name id
         * @memberof me.Entity
         */
        this.id = settings.id || "";

        /**
         * dead/living state of the entity<br>
         * default value : true
         * @public
         * @type {boolean}
         * @name alive
         * @memberof me.Entity
         */
        this.alive = true;

        /**
         * the entity body object
         * @public
         * @type {me.Body}
         * @name body
         * @memberof me.Entity
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
        this.body = new Body(this, settings.shapes, this.onBodyUpdate.bind(this));

        // resize the entity if required
        if (this.width === 0 && this.height === 0) {
            this.resize(this.body.getBounds().width, this.body.getBounds().height);
        }

        // set the  collision mask and type (if defined)
        this.body.setCollisionMask(settings.collisionMask);
        this.body.setCollisionType(settings.collisionType);

        // disable for entities
        this.autoTransform = false;
    }


    /**
     * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
     * @public
     * @type {me.Renderable}
     * @name renderable
     * @memberof me.Entity
     */

    get renderable() {
        return this.children[0];
    }

    set renderable(value) {
        if (value instanceof Renderable) {
            this.children[0] = value;
            this.children[0].ancestor = this;
        } else {
            throw new Error(value + "should extend me.Renderable");
        }
    }

    /** @ignore */
    update(dt) {
        if (this.renderable) {
            this.isDirty |= this.renderable.update(dt);
        }
        return super.update(dt);
    }

    /**
     * update the bounds position when the body is modified
     * @ignore
     * @name onBodyUpdate
     * @memberof me.Entity
     * @function
     * @param {me.Body} body the body whose bounds to update
     */
    onBodyUpdate(body) {
        // update the entity bounds to include the body bounds
        this.getBounds().addBounds(body.getBounds(), true);
        // update the bounds pos
        this.updateBoundsPos(this.pos.x, this.pos.y);
    }

    preDraw(renderer) {
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
    }

    /**
     * object draw<br>
     * not to be called by the end user<br>
     * called by the game manager on each game loop
     * @name draw
     * @memberof me.Entity
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {me.Rect} rect region to draw
     */
    draw(renderer, rect) {
        var renderable = this.renderable;
        if (renderable instanceof Renderable) {
            // predraw (apply transforms)
            renderable.preDraw(renderer);

            // draw the object
            renderable.draw(renderer, rect);

            // postdraw (clean-up);
            renderable.postDraw(renderer);
        }
    }

    /**
     * Destroy function<br>
     * @ignore
     */
    destroy() {
        // free some property objects
        if (this.renderable) {
            this.renderable.destroy.apply(this.renderable, arguments);
            this.children.splice(0, 1);
        }

        // call the parent destroy method
        super.destroy(arguments);
    }

    /**
     * onDeactivateEvent Notification function<br>
     * Called by engine before deleting the object
     * @name onDeactivateEvent
     * @memberof me.Entity
     * @function
     */
    onDeactivateEvent() {
        if (this.renderable && this.renderable.onDeactivateEvent) {
            this.renderable.onDeactivateEvent();
        }
    }

};

export default Entity;
