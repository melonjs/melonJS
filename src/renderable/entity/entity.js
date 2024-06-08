import pool from "../../system/pooling.js";
import Renderable from "../renderable.js";
import Sprite from "../sprite.js";
import Body from "../../physics/body.js";

/**
 * @import Line from "./../../geometries/line.js";
 * @import Rect from "./../../geometries/rectangle.js";
 * @import Ellipse from "./../../geometries/ellipse.js";
 * @import Polygon from "./../../geometries/poly.js";
 * @import Bounds from "./../../physics/bounds.js";
 * @import CanvasRenderer from "./../../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../../video/webgl/webgl_renderer.js";
 **/

/**
 * @classdesc
 * a Generic Object Entity
 * @augments Renderable
 */
export default class Entity extends Renderable {
    /**
     * @param {number} x - the x coordinates of the entity object
     * @param {number} y - the y coordinates of the entity object
     * @param {object} settings - Entity properties, to be defined through Tiled or when calling the entity constructor
     * <img src="images/object_properties.png"/>
     * @param {number} settings.width - the physical width the entity takes up in game
     * @param {number} settings.height - the physical height the entity takes up in game
     * @param {string} [settings.name] - object entity name
     * @param {string} [settings.id] - object unique IDs
     * @param {Image|string} [settings.image] - resource name of a spritesheet to use for the entity renderable component
     * @param {Vector2d} [settings.anchorPoint=0.0] - Entity anchor point
     * @param {number} [settings.framewidth=settings.width] - width of a single frame in the given spritesheet
     * @param {number} [settings.frameheight=settings.width] - height of a single frame in the given spritesheet
     * @param {string} [settings.type] - object type
     * @param {number} [settings.collisionMask] - Mask collision detection for this object
     * @param {Rect[]|Polygon[]|Line[]|Ellipse[]} [settings.shapes] - the initial list of collision shapes (usually populated through Tiled)
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
            this.anchorPoint.setMuted(settings.anchorPoint.x, settings.anchorPoint.y);
        } else {
            // for backward compatibility
            this.anchorPoint.setMuted(0, 0);
        }

        // set the sprite name if specified
        if (typeof (settings.name) === "string") {
            this.name = settings.name;
        }

        /**
         * object type (as defined in Tiled)
         * @type {string}
         */
        this.type = settings.type || "";

        /**
         * object unique ID (as defined in Tiled)
         * @type {number}
         */
        this.id = settings.id || "";

        /**
         * dead/living state of the entity<br>
         * default value : true
         * @type {boolean}
         */
        this.alive = true;

        // initialize the default body
        if (typeof settings.shapes === "undefined") {
            settings.shapes = pool.pull("Polygon", 0, 0, [
                pool.pull("Vector2d", 0,          0),
                pool.pull("Vector2d", this.width, 0),
                pool.pull("Vector2d", this.width, this.height),
                pool.pull("Vector2d", 0,          this.height)
            ]);
        }

        /**
         * the entity body object
         * @type {Body}
         */
        this.body = new Body(this, settings.shapes, () => this.onBodyUpdate());

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
     * @type {Renderable}
     */

    get renderable() {
        return this.children[0];
    }

    set renderable(value) {
        if (value instanceof Renderable) {
            this.children[0] = value;
            this.children[0].ancestor = this;
            this.updateBounds();
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
     * update the bounding box for this entity.
     * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
     * @returns {Bounds} this entity bounding box Rectangle object
     */
    updateBounds(absolute = true) {
        let bounds = this.getBounds();

        bounds.clear();
        bounds.addFrame(
            0,
            0,
            this.width,
            this.height
        );

        // add each renderable bounds
        if (this.children && this.children.length > 0) {
            bounds.addBounds(this.children[0].getBounds());
        }

        if (this.body) {
            bounds.addBounds(this.body.getBounds());
        }

        if (absolute === true) {
            let absPos = this.getAbsolutePosition();
            bounds.centerOn(absPos.x + bounds.x + bounds.width / 2,  absPos.y + bounds.y + bounds.height / 2);
        }

        return bounds;
    }

    /**
     * update the bounds when the body is modified
     */
    onBodyUpdate() {
        this.updateBounds();
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
     * draw this entity (automatically called by melonJS)
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    draw(renderer, viewport) {
        let renderable = this.renderable;
        if (renderable instanceof Renderable) {
            // predraw (apply transforms)
            renderable.preDraw(renderer);

            // draw the object
            renderable.draw(renderer, viewport);

            // postdraw (clean-up);
            renderable.postDraw(renderer);
        }
    }

    /**
     * Destroy function
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
     * onDeactivateEvent Notification function
     */
    onDeactivateEvent() {
        if (this.renderable && this.renderable.onDeactivateEvent) {
            this.renderable.onDeactivateEvent();
        }
    }

}
