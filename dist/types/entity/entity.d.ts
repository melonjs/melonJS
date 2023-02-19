/**
 * @classdesc
 * a Generic Object Entity
 * @augments Renderable
 * @see Renderable
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
        image?: string | (new (width?: number | undefined, height?: number | undefined) => HTMLImageElement) | undefined;
        anchorPoint?: any;
        framewidth?: number | undefined;
        frameheight?: number | undefined;
        type?: string | undefined;
        collisionMask?: number | undefined;
        shapes?: Polygon[] | Line[] | Ellipse[] | Rect[] | undefined;
    });
    /**
     * The array of renderable children of this entity.
     * @ignore
     */
    children: any[];
    public set renderable(arg: Renderable);
    /**
     * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
     * @public
     * @type {Renderable}
     * @name renderable
     * @memberof Entity
     */
    public get renderable(): Renderable;
    /**
     * object type (as defined in Tiled)
     * @public
     * @type {string}
     * @name type
     * @memberof Entity
     */
    public type: string;
    /**
     * object unique ID (as defined in Tiled)
     * @public
     * @type {number}
     * @name id
     * @memberof Entity
     */
    public id: number;
    /**
     * dead/living state of the entity<br>
     * default value : true
     * @public
     * @type {boolean}
     * @name alive
     * @memberof Entity
     */
    public alive: boolean;
    body: Body;
    /** @ignore */
    update(dt: any): boolean;
    /**
     * update the bounds when the body is modified
     * @ignore
     * @name onBodyUpdate
     * @memberof Entity
     * @param {Body} body - the body whose bounds to update
     */
    onBodyUpdate(): void;
    preDraw(renderer: any): void;
    /**
     * onDeactivateEvent Notification function<br>
     * Called by engine before deleting the object
     * @name onDeactivateEvent
     * @memberof Entity
     */
    onDeactivateEvent(): void;
}
import Renderable from "./../renderable/renderable.js";
import Body from "./../physics/body.js";
