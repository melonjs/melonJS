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
    constructor(x: number, y: number, settings: {
        width: number;
        height: number;
        name?: string | undefined;
        id?: string | undefined;
        image?: string | (new (width?: number, height?: number) => HTMLImageElement) | undefined;
        anchorPoint?: any;
        framewidth?: number | undefined;
        frameheight?: number | undefined;
        type?: string | undefined;
        collisionMask?: number | undefined;
        shapes?: Rect[] | Polygon[] | Line[] | Ellipse[] | undefined;
    });
    /**
     * The array of renderable children of this entity.
     * @ignore
     */
    children: any[];
    set renderable(value: Renderable);
    /**
     * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
     * @type {Renderable}
     */
    get renderable(): Renderable;
    /**
     * object unique ID (as defined in Tiled)
     * @type {number}
     */
    id: number;
    /**
     * dead/living state of the entity<br>
     * default value : true
     * @type {boolean}
     */
    alive: boolean;
    /** @ignore */
    update(dt: any): boolean;
    /**
     * update the bounding box for this entity.
     * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
     * @returns {Bounds} this entity bounding box Rectangle object
     */
    updateBounds(absolute?: boolean | undefined): Bounds;
    /**
     * update the bounds when the body is modified
     */
    onBodyUpdate(): void;
    preDraw(renderer: any): void;
    /**
     * draw this entity (automatically called by melonJS)
     * @protected
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    protected draw(renderer: CanvasRenderer | WebGLRenderer, viewport?: any): void;
    /**
     * onDeactivateEvent Notification function
     */
    onDeactivateEvent(): void;
}
import Renderable from "../renderable.js";
