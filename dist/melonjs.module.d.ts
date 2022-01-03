/**
 * @classdesc
 * a bitmap font object
 * @class BitmapText
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {number} x position of the text object
 * @param {number} y position of the text object
 * @param {object} settings the text configuration
 * @param {string|Image} settings.font a font name to identify the corresponing source image
 * @param {string} [settings.fontData=settings.font] the bitmap font data corresponding name, or the bitmap font data itself
 * @param {number} [settings.size] size a scaling ratio
 * @param {me.Color|string} [settings.fillStyle] a CSS color value used to tint the bitmapText (@see me.BitmapText.tint)
 * @param {number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
 * @param {string} [settings.textAlign="left"] horizontal text alignment
 * @param {string} [settings.textBaseline="top"] the text baseline
 * @param {number} [settings.lineHeight=1.0] line spacing height
 * @param {me.Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
 * @param {(string|string[])} [settings.text] a string, or an array of strings
 * @example
 * // Use me.loader.preload or me.loader.load to load assets
 * me.loader.preload([
 *     { name: "arial", type: "binary" src: "data/font/arial.fnt" },
 *     { name: "arial", type: "image" src: "data/font/arial.png" },
 * ])
 * // Then create an instance of your bitmap font:
 * var myFont = new me.BitmapText(x, y, {font:"arial", text:"Hello"});
 * // two possibilities for using "myFont"
 * // either call the draw function from your Renderable draw function
 * myFont.draw(renderer, "Hello!", 0, 0);
 * // or just add it to the word container
 * me.game.world.addChild(myFont);
 */
export class BitmapText {
    /** @ignore */
    constructor(x: any, y: any, settings: any);
    /**
     * Set the default text alignment (or justification),<br>
     * possible values are "left", "right", and "center".
     * @public
     * @type {string}
     * @default "left"
     * @name textAlign
     * @memberOf me.BitmapText
     */
    public textAlign: string;
    /**
     * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
     * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
     * @public
     * @type {string}
     * @default "top"
     * @name textBaseline
     * @memberOf me.BitmapText
     */
    public textBaseline: string;
    /**
     * Set the line spacing height (when displaying multi-line strings). <br>
     * Current font height will be multiplied with this value to set the line height.
     * @public
     * @type {number}
     * @default 1.0
     * @name lineHeight
     * @memberOf me.BitmapText
     */
    public lineHeight: number;
    /**
     * the text to be displayed
     * @private
     * @type {string[]}
     * @name _text
     * @memberOf me.BitmapText
     */
    private _text;
    /** @ignore */
    fontScale: any;
    fontImage: any;
    fontData: any;
    floating: boolean;
    /**
     * change the font settings
     * @name set
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {string} textAlign ("left", "center", "right")
     * @param {number} [scale]
     * @returns {me.BitmapText} this object for chaining
     */
    set(textAlign: string, scale?: number): me.BitmapText;
    isDirty: boolean;
    /**
     * change the text to be displayed
     * @name setText
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {number|string|string[]} value a string, or an array of strings
     * @returns {me.BitmapText} this object for chaining
     */
    setText(value: number | string | string[]): me.BitmapText;
    public set fillStyle(arg: me.Color);
    /**
     * defines the color used to tint the bitmap text
     * @public
     * @type {me.Color}
     * @name fillStyle
     * @see me.Renderable#tint
     * @memberOf me.BitmapText
     */
    public get fillStyle(): me.Color;
    tint: me.Color;
    /**
     * change the font display size
     * @name resize
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {number} scale ratio
     * @returns {me.BitmapText} this object for chaining
     */
    resize(scale: number): me.BitmapText;
    /**
     * measure the given text size in pixels
     * @name measureText
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {string} [text]
     * @param {me.Rect} [ret] a object in which to store the text metrics
     * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
     */
    measureText(text?: string, ret?: me.Rect): TextMetrics;
    /**
     * @ignore
     */
    update(): boolean;
    /**
     * draw the bitmap font
     * @name draw
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
     * @param {string} [text]
     * @param {number} [x]
     * @param {number} [y]
     */
    draw(renderer: me.CanvasRenderer | me.WebGLRenderer, text?: string, x?: number, y?: number): void;
    /**
     * Destroy function
     * @ignore
     */
    destroy(): void;
}
/**
 * Class for storing relevant data from the font file.
 * @class me.BitmapTextData
 * @memberOf me
 * @ignore
 * @param data {string} - The bitmap font data pulled from the resource loader using me.loader.getBinary()
 * @constructor
 */
export class BitmapTextData {
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(data: any): void;
    padTop: number;
    padRight: number;
    padBottom: number;
    padLeft: number;
    lineHeight: number;
    capHeight: any;
    descent: any;
    /**
     * The map of glyphs, each key is a char code.
     * @name glyphs
     * @type {object}
     * @memberOf me.BitmapTextData
     */
    glyphs: object;
    /**
     * This parses the font data text and builds a map of glyphs containing the data for each character
     * @name parse
     * @memberOf me.BitmapTextData
     * @function
     * @param {string} fontData
     */
    parse(fontData: string): void;
}
/**
 * a Generic Physic Body Object with some physic properties and behavior functionality, to as a member of a Renderable.
 * @class Body
 * @memberOf me
 * @constructor
 * @param {me.Renderable} ancestor the parent object this body is attached to
 * @param {me.Rect|me.Rect[]|me.Polygon|me.Polygon[]|me.Line|me.Line[]|me.Ellipse|me.Ellipse[]|me.Bounds|me.Bounds[]|object} [shapes] a initial shape, list of shapes, or JSON object defining the body
 * @param {Function} [onBodyUpdate] callback for when the body is updated (e.g. add/remove shapes)
 */
export class Body {
    constructor(parent: any, shapes: any, onBodyUpdate: any);
    /**
     * a reference to the parent object that contains this body,
     * or undefined if it has not been added to one.
     * @public
     * @type {me.Renderable}
     * @default undefined
     * @name me.Body#ancestor
     */
    public ancestor: me.Renderable;
    bounds: Bounds$1;
    shapes: any[];
    /**
     * The body collision mask, that defines what should collide with what.<br>
     * (by default will collide with all entities)
     * @ignore
     * @type {number}
     * @default me.collision.types.ALL_OBJECT
     * @name collisionMask
     * @see me.collision.types
     * @memberOf me.Body
     */
    collisionMask: number;
    /**
     * define the collision type of the body for collision filtering
     * @public
     * @type {number}
     * @default me.collision.types.ENEMY_OBJECT
     * @name collisionType
     * @see me.collision.types
     * @memberOf me.Body
     * @example
     * // set the body collision type
     * myEntity.body.collisionType = me.collision.types.PLAYER_OBJECT;
     */
    public collisionType: number;
    vel: Vector2d;
    force: Vector2d;
    friction: Vector2d;
    /**
     * the body bouciness level when colliding with other solid bodies :
     * a value of 0 will not bounce, a value of 1 will fully rebound.
     * @public
     * @type {number}
     * @default 0
     * @name bounce
     * @memberOf me.Body
     */
    public bounce: number;
    /**
     * the body mass
     * @public
     * @type {number}
     * @default 1
     * @name mass
     * @memberOf me.Body
     */
    public mass: number;
    maxVel: Vector2d;
    /**
     * either this body is a static body or not
     * @readonly
     * @public
     * @type {boolean}
     * @default false
     * @name isStatic
     * @memberOf me.Body
     */
    public readonly isStatic: boolean;
    /**
     * The degree to which this body is affected by the world gravity
     * @public
     * @see me.World.gravity
     * @type {number}
     * @default 1.0
     * @name gravityScale
     * @memberOf me.Body
     */
    public gravityScale: number;
    /**
     * If true this body won't be affected by the world gravity
     * @public
     * @see me.World.gravity
     * @type {boolean}
     * @default false
     * @name ignoreGravity
     * @memberOf me.Body
     */
    public ignoreGravity: boolean;
    /**
     * falling state of the body<br>
     * true if the object is falling<br>
     * false if the object is standing on something<br>
     * @readonly
     * @public
     * @type {boolean}
     * @default false
     * @name falling
     * @memberOf me.Body
     */
    public readonly falling: boolean;
    /**
     * jumping state of the body<br>
     * equal true if the body is jumping<br>
     * @readonly
     * @public
     * @type {boolean}
     * @default false
     * @name jumping
     * @memberOf me.Body
     */
    public readonly jumping: boolean;
    onBodyUpdate: any;
    /**
     * set the body as a static body
     * static body do not move automatically and do not check againt collision with others
     * @name setStatic
     * @memberOf me.Body
     * @public
     * @function
     * @param {boolean} [isStatic=true]
     */
    public setStatic(isStatic?: boolean): void;
    /**
     * add a collision shape to this body <br>
     * (note: me.Rect objects will be converted to me.Polygon before being added)
     * @name addShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse|me.Bounds|object} shape a shape or JSON object
     * @returns {number} the shape array length
     * @example
     * // add a rectangle shape
     * this.body.addShape(new me.Rect(0, 0, image.width, image.height));
     * // add a shape from a JSON object
     * this.body.addShape(me.loader.getJSON("shapesdef").banana);
     */
    public addShape(shape: me.Rect | me.Polygon | me.Line | me.Ellipse | me.Bounds | object): number;
    /**
     * set the body vertices to the given one
     * @name setVertices
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {number} [index=0] the shape object for which to set the vertices
     * @param {boolean} [clear=true] either to reset the body definition before adding the new vertices
     */
    public setVertices(vertices: me.Vector2d[], index?: number, clear?: boolean): void;
    /**
     * add the given vertices to the body shape
     * @name addVertices
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {number} [index=0] the shape object for which to set the vertices
     */
    public addVertices(vertices: me.Vector2d[], index?: number): void;
    /**
     * add collision mesh based on a JSON object
     * (this will also apply any physic properties defined in the given JSON file)
     * @name fromJSON
     * @memberOf me.Body
     * @public
     * @function
     * @param {object} json a JSON object as exported from a Physics Editor tool
     * @param {string} [id] an optional shape identifier within the given the json object
     * @see https://www.codeandweb.com/physicseditor
     * @returns {number} how many shapes were added to the body
     * @example
     * // define the body based on the banana shape
     * this.body.fromJSON(me.loader.getJSON("shapesdef").banana);
     * // or ...
     * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
     */
    public fromJSON(json: object, id?: string): number;
    /**
     * return the collision shape at the given index
     * @name getShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {number} [index=0] the shape object at the specified index
     * @returns {me.Polygon|me.Line|me.Ellipse} shape a shape object if defined
     */
    public getShape(index?: number): me.Polygon | me.Line | me.Ellipse;
    /**
     * returns the AABB bounding box for this body
     * @name getBounds
     * @memberOf me.Body
     * @function
     * @returns {me.Bounds} bounding box Rectangle object
     */
    getBounds(): me.Bounds;
    /**
     * remove the specified shape from the body shape list
     * @name removeShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Polygon|me.Line|me.Ellipse} shape a shape object
     * @returns {number} the shape array length
     */
    public removeShape(shape: me.Polygon | me.Line | me.Ellipse): number;
    /**
     * remove the shape at the given index from the body shape list
     * @name removeShapeAt
     * @memberOf me.Body
     * @public
     * @function
     * @param {number} index the shape object at the specified index
     * @returns {number} the shape array length
     */
    public removeShapeAt(index: number): number;
    /**
     * By default all entities are able to collide with all other entities, <br>
     * but it's also possible to specify 'collision filters' to provide a finer <br>
     * control over which entities can collide with each other.
     * @name setCollisionMask
     * @memberOf me.Body
     * @public
     * @function
     * @see me.collision.types
     * @param {number} [bitmask = me.collision.types.ALL_OBJECT] the collision mask
     * @example
     * // filter collision detection with collision shapes, enemies and collectables
     * myEntity.body.setCollisionMask(me.collision.types.WORLD_SHAPE | me.collision.types.ENEMY_OBJECT | me.collision.types.COLLECTABLE_OBJECT);
     * ...
     * // disable collision detection with all other objects
     * myEntity.body.setCollisionMask(me.collision.types.NO_OBJECT);
     */
    public setCollisionMask(bitmask?: number): void;
    /**
     * define the collision type of the body for collision filtering
     * @name setCollisionType
     * @memberOf me.Body
     * @public
     * @function
     * @see me.collision.types
     * @param {number} type the collision type
     * @example
     * // set the body collision type
     * myEntity.body.collisionType = me.collision.types.PLAYER_OBJECT;
     */
    public setCollisionType(type: number): void;
    /**
     * the built-in function to solve the collision response
     * @protected
     * @name respondToCollision
     * @memberOf me.Body
     * @function
     * @param {me.collision.ResponseObject} response the collision response object
     */
    protected respondToCollision(response: me.collision.ResponseObject): void;
    /**
     * The forEach() method executes a provided function once per body shape element. <br>
     * the callback function is invoked with three arguments: <br>
     *    - The current element being processed in the array <br>
     *    - The index of element in the array. <br>
     *    - The array forEach() was called upon. <br>
     * @name forEach
     * @memberOf me.Body.prototype
     * @function
     * @param {Function} callback fnction to execute on each element
     * @param {object} [thisArg] value to use as this(i.e reference Object) when executing callback.
     * @example
     * // iterate through all shapes of the physic body
     * mySprite.body.forEach((shape) => {
     *    shape.doSomething();
     * });
     * mySprite.body.forEach((shape, index) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... }, thisArg);
     */
    forEach(callback: Function, thisArg?: object, ...args: any[]): void;
    /**
     * Returns true if the any of the shape composing the body contains the given point.
     * @name contains
     * @memberOf me.Body
     * @function
     * @param  {me.Vector2d} point
     * @returns {boolean} true if contains
     */
    /**
     * Returns true if the any of the shape composing the body contains the given point.
     * @name contains
     * @memberOf me.Body
     * @function
     * @param  {number} x x coordinate
     * @param  {number} y y coordinate
     * @returns {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * Rotate this body (counter-clockwise) by the specified angle (in radians).
     * Unless specified the body will be rotated around its center point
     * @name rotate
     * @memberOf me.Body
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v=me.Body.getBounds().center] an optional point to rotate around
     * @returns {me.Body} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.Body;
    /**
     * cap the body velocity (body.maxVel property) to the specified value<br>
     * @name setMaxVelocity
     * @memberOf me.Body
     * @function
     * @param {number} x max velocity on x axis
     * @param {number} y max velocity on y axis
     * @protected
     */
    protected setMaxVelocity(x: number, y: number): void;
    /**
     * set the body default friction
     * @name setFriction
     * @memberOf me.Body
     * @function
     * @param {number} x horizontal friction
     * @param {number} y vertical friction
     * @protected
     */
    protected setFriction(x?: number, y?: number): void;
    /**
     * compute the new velocity value
     * @ignore
     */
    computeVelocity(): void;
    /**
     * Updates the parent's position as well as computes the new body's velocity based
     * on the values of force/friction/gravity.  Velocity chages are proportional to the
     * me.timer.tick value (which can be used to scale velocities).  The approach to moving the
     * parent Entity is to compute new values of the Body.vel property then add them to
     * the parent.pos value thus changing the postion the amount of Body.vel each time the
     * update call is made. <br>
     * Updates to Body.vel are bounded by maxVel (which defaults to viewport size if not set) <br>
     *
     * In addition, when the gravity calcuation is made, if the Body.vel.y > 0 then the Body.falling
     * property is set to true and Body.jumping is set to !Body.falling.
     *
     * At this time a call to Body.Update does not call the onBodyUpdate callback that is listed in the constructor arguments.
     * @name update
     * @ignore
     * @memberOf me.Body
     * @function
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean} true if resulting velocity is different than 0
     */
    update(dt: number): boolean;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(): void;
}
/**
 * @classdesc
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 * @class Bounds
 * @memberOf me
 * @constructor
 * @memberOf me
 * @param {me.Vector2d[]} [vertices] an array of me.Vector2d points
 * @returns {me.Bounds} A new bounds object
 */
declare class Bounds$1 {
    constructor(vertices: any);
    onResetEvent(vertices: any): void;
    min: {
        x: number;
        y: number;
    };
    max: {
        x: number;
        y: number;
    };
    _center: Vector2d;
    /**
     * reset the bound
     * @name clear
     * @memberOf me.Bounds
     * @function
     */
    clear(): void;
    /**
     * sets the bounds to the given min and max value
     * @name setMinMax
     * @memberOf me.Bounds
     * @function
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     */
    setMinMax(minX: number, minY: number, maxX: number, maxY: number): void;
    public set x(arg: number);
    /**
     * x position of the bound
     * @public
     * @type {number}
     * @name x
     * @memberOf me.Bounds
     */
    public get x(): number;
    public set y(arg: number);
    /**
     * y position of the bounds
     * @public
     * @type {number}
     * @name y
     * @memberOf me.Bounds
     */
    public get y(): number;
    public set width(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberOf me.Bounds
     */
    public get width(): number;
    public set height(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberOf me.Bounds
     */
    public get height(): number;
    /**
     * left coordinate of the bound
     * @public
     * @type {number}
     * @name left
     * @memberOf me.Bounds
     */
    public get left(): number;
    /**
     * right coordinate of the bound
     * @public
     * @type {number}
     * @name right
     * @memberOf me.Bounds
     */
    public get right(): number;
    /**
     * top coordinate of the bound
     * @public
     * @type {number}
     * @name top
     * @memberOf me.Bounds
     */
    public get top(): number;
    /**
     * bottom coordinate of the bound
     * @public
     * @type {number}
     * @name bottom
     * @memberOf me.Bounds
     */
    public get bottom(): number;
    /**
     * center position of the bound on the x axis
     * @public
     * @type {number}
     * @name centerX
     * @memberOf me.Bounds
     */
    public get centerX(): number;
    /**
     * center position of the bound on the y axis
     * @public
     * @type {number}
     * @name centerY
     * @memberOf me.Bounds
     */
    public get centerY(): number;
    /**
     * return the center position of the bound
     * @public
     * @type {me.Vector2d}
     * @name center
     * @memberOf me.Bounds
     */
    public get center(): me.Vector2d;
    /**
     * Updates bounds using the given vertices
     * @name update
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     */
    update(vertices: me.Vector2d[]): void;
    /**
     * add the given vertices to the bounds definition.
     * @name add
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    add(vertices: me.Vector2d[], clear?: boolean): void;
    /**
     * add the given bounds to the bounds definition.
     * @name addBounds
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds} bounds
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    addBounds(bounds: me.Bounds, clear?: boolean): void;
    /**
     * add the given point to the bounds definition.
     * @name addPoint
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} v
     * @param {me.Matrix2d} [m] an optional transform to apply to the given point
     */
    addPoint(v: me.Vector2d, m?: me.Matrix2d): void;
    /**
     * add the given quad coordinates to this bound definition, multiplied by the given matrix
     * @name addFrame
     * @memberOf me.Bounds
     * @function
     * @param {number} x0 - left X coordinates of the quad
     * @param {number} y0 - top Y coordinates of the quad
     * @param {number} x1 - right X coordinates of the quad
     * @param {number} y1 - bottom y coordinates of the quad
     * @param {me.Matrix2d} [m] an optional transform to apply to the given frame coordinates
     */
    addFrame(x0: number, y0: number, x1: number, y1: number, m?: me.Matrix2d): void;
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} point
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    contains(...args: any[]): boolean;
    /**
     * Returns true if the two bounds intersect.
     * @name overlaps
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds|me.Rect} bounds
     * @returns {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds: me.Bounds | me.Rect): boolean;
    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @name isFinite
     * @memberOf me.Bounds
     * @function
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite(): boolean;
    /**
     * Translates the bounds by the given vector.
     * @name translate
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} vector
     */
    /**
     * Translates the bounds by x on the x axis, and y on the y axis
     * @name translate
     * @memberOf me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     */
    translate(...args: any[]): void;
    /**
     * Shifts the bounds to the given position vector.
     * @name shift
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} position
     */
    /**
     * Shifts the bounds to the given x, y position.
     * @name shift
     * @memberOf me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     */
    shift(...args: any[]): void;
    /**
     * clone this bounds
     * @name clone
     * @memberOf me.Bounds
     * @function
     * @returns {me.Bounds}
     */
    clone(): me.Bounds;
    /**
     * Returns a polygon whose edges are the same as this bounds.
     * @name toPolygon
     * @memberOf me.Bounds
     * @function
     * @returns {me.Polygon} a new Polygon that represents this bounds.
     */
    toPolygon(): me.Polygon;
}
/**
 * @classdesc
 * a 2D orthographic camera
 * @class Camera2d
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {number} minX start x offset
 * @param {number} minY start y offset
 * @param {number} maxX end x offset
 * @param {number} maxY end y offset
 */
export class Camera2d {
    /**
     * @ignore
     */
    constructor(minX: any, minY: any, maxX: any, maxY: any);
    /**
     * Axis definition
     * @property {number} NONE no axis
     * @property {number} HORIZONTAL horizontal axis only
     * @property {number} VERTICAL vertical axis only
     * @property {number} BOTH both axis
     * @public
     * @constant
     * @enum {number}
     * @name AXIS
     * @memberOf me.Camera2d
     */
    public AXIS: {
        NONE: number;
        HORIZONTAL: number;
        VERTICAL: number;
        BOTH: number;
    };
    /**
     * Camera bounds
     * @public
     * @type {me.Bounds}
     * @name bounds
     * @memberOf me.Camera2d
     */
    public bounds: me.Bounds;
    /**
     * [IMTERNAL] enable or disable damping
     * @private
     * @type {boolean}
     * @name smoothFollow
     * @see me.Camera2d.damping
     * @default true
     * @memberOf me.Camera2d
     */
    private smoothFollow;
    /**
     * Camera damping for smooth transition [0 .. 1].
     * 1 being the maximum value and will snap the camera to the target position
     * @public
     * @type {number}
     * @name damping
     * @default 1.0
     * @memberOf me.Camera2d
     */
    public damping: number;
    /**
     * the closest point relative to the camera
     * @public
     * @type {number}
     * @name near
     * @default -1000
     * @memberOf me.Camera2d
     */
    public near: number;
    /**
     * the furthest point relative to the camera.
     * @public
     * @type {number}
     * @name far
     * @default 1000
     * @memberOf me.Camera2d
     */
    public far: number;
    /**
     * the default camera projection matrix
     * (2d cameras use an orthographic projection by default).
     * @public
     * @type {me.Matrix3d}
     * @name projectionMatrix
     * @memberOf me.Camera2d
     */
    public projectionMatrix: me.Matrix3d;
    /**
     * the invert camera transform used to unproject points
     * @ignore
     * @type {me.Matrix2d}
     * @name invCurrentTransform
     * @memberOf me.Camera2d
     */
    invCurrentTransform: me.Matrix2d;
    offset: Vector2d;
    target: any;
    follow_axis: number;
    _shake: {
        intensity: number;
        duration: number;
        axis: number;
        onComplete: any;
    };
    _fadeOut: {
        color: any;
        tween: any;
    };
    _fadeIn: {
        color: any;
        tween: any;
    };
    name: string;
    isKinematic: boolean;
    /** @ignore */
    _updateProjectionMatrix(): void;
    /** @ignore */
    _followH(target: any): any;
    /** @ignore */
    _followV(target: any): any;
    /**
     * reset the camera position to specified coordinates
     * @name reset
     * @memberOf me.Camera2d
     * @function
     * @param {number} [x=0]
     * @param {number} [y=0]
     */
    reset(x?: number, y?: number): void;
    /**
     * change the deadzone settings.
     * the "deadzone" defines an area within the current camera in which
     * the followed renderable can move without scrolling the camera.
     * @name setDeadzone
     * @see me.Camera2d.follow
     * @memberOf me.Camera2d
     * @function
     * @param {number} w deadzone width
     * @param {number} h deadzone height
     */
    setDeadzone(w: number, h: number): void;
    deadzone: Rect;
    /**
     * resize the camera
     * @name resize
     * @memberOf me.Camera2d
     * @function
     * @param {number} w new width of the camera
     * @param {number} h new height of the camera
     * @returns {me.Camera2d} this camera
     */
    resize(w: number, h: number): me.Camera2d;
    /**
     * set the camera boundaries (set to the world limit by default).
     * the camera is bound to the given coordinates and cannot move/be scrolled outside of it.
     * @name setBounds
     * @memberOf me.Camera2d
     * @function
     * @param {number} x world left limit
     * @param {number} y world top limit
     * @param {number} w world width limit
     * @param {number} h world height limit
     */
    setBounds(x: number, y: number, w: number, h: number): void;
    /**
     * set the camera to follow the specified renderable. <br>
     * (this will put the camera center around the given target)
     * @name follow
     * @memberOf me.Camera2d
     * @function
     * @param {me.Renderable|me.Vector2d} target renderable or position vector to follow
     * @param {me.Camera2d.AXIS} [axis=this.AXIS.BOTH] Which axis to follow
     * @param {number} [damping=1] default damping value
     * @example
     * // set the camera to follow this renderable on both axis, and enable damping
     * me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH, 0.1);
     */
    follow(target: me.Renderable | me.Vector2d, axis?: me.Camera2d.AXIS, damping?: number): void;
    /**
     * unfollow the current target
     * @name unfollow
     * @memberOf me.Camera2d
     * @function
     */
    unfollow(): void;
    /**
     * move the camera upper-left position by the specified offset.
     * @name move
     * @memberOf me.Camera2d
     * @see me.Camera2d.focusOn
     * @function
     * @param {number} x
     * @param {number} y
     * @example
     * // Move the camera up by four pixels
     * me.game.viewport.move(0, -4);
     */
    move(x: number, y: number): void;
    /**
     * move the camera upper-left position to the specified coordinates
     * @name moveTo
     * @memberOf me.Camera2d
     * @see me.Camera2d.focusOn
     * @function
     * @param {number} x
     * @param {number} y
     */
    moveTo(x: number, y: number): void;
    /** @ignore */
    updateTarget(): boolean;
    /** @ignore */
    update(dt: any): boolean;
    /**
     * shake the camera
     * @name shake
     * @memberOf me.Camera2d
     * @function
     * @param {number} intensity maximum offset that the screen can be moved
     * while shaking
     * @param {number} duration expressed in milliseconds
     * @param {me.Camera2d.AXIS} [axis=this.AXIS.BOTH] specify on which axis you
     *   want the shake effect
     * @param {Function} [onComplete] callback once shaking effect is over
     * @param {boolean} [force] if true this will override the current effect
     * @example
     * // shake it baby !
     * me.game.viewport.shake(10, 500, me.game.viewport.AXIS.BOTH);
     */
    shake(intensity: number, duration: number, axis?: me.Camera2d.AXIS, onComplete?: Function, force?: boolean): void;
    /**
     * fadeOut(flash) effect<p>
     * screen is filled with the specified color and slowly goes back to normal
     * @name fadeOut
     * @memberOf me.Camera2d
     * @function
     * @param {me.Color|string} color a CSS color value
     * @param {number} [duration=1000] expressed in milliseconds
     * @param {Function} [onComplete] callback once effect is over
     * @example
     * // fade the camera to white upon dying, reload the level, and then fade out back
     * me.game.viewport.fadeIn("#fff", 150, function() {
     *     me.audio.play("die", false);
     *     me.level.reload();
     *     me.game.viewport.fadeOut("#fff", 150);
     * });
     */
    fadeOut(color: me.Color | string, duration?: number, onComplete?: Function): void;
    /**
     * fadeIn effect <p>
     * fade to the specified color
     * @name fadeIn
     * @memberOf me.Camera2d
     * @function
     * @param {me.Color|string} color a CSS color value
     * @param {number} [duration=1000] expressed in milliseconds
     * @param {Function} [onComplete] callback once effect is over
     * @example
     * // flash the camera to white for 75ms
     * me.game.viewport.fadeIn("#FFFFFF", 75);
     */
    fadeIn(color: me.Color | string, duration?: number, onComplete?: Function): void;
    /**
     * set the camera position around the specified object
     * @name focusOn
     * @memberOf me.Camera2d
     * @function
     * @param {me.Renderable} target the renderable to focus the camera on
     */
    focusOn(target: me.Renderable): void;
    /**
     * check if the specified renderable is in the camera
     * @name isVisible
     * @memberOf me.Camera2d
     * @function
     * @param {me.Renderable} obj to be checked against
     * @param {boolean} [floating = obj.floating] if visibility check should be done against screen coordinates
     * @returns {boolean}
     */
    isVisible(obj: me.Renderable, floating?: boolean): boolean;
    /**
     * convert the given "local" (screen) coordinates into world coordinates
     * @name localToWorld
     * @memberOf me.Camera2d
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} [v] an optional vector object where to set the
     * converted value
     * @returns {me.Vector2d}
     */
    localToWorld(x: number, y: number, v?: number): me.Vector2d;
    /**
     * convert the given world coordinates into "local" (screen) coordinates
     * @name worldToLocal
     * @memberOf me.Camera2d
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} [v] an optional vector object where to set the
     * converted value
     * @returns {me.Vector2d}
     */
    worldToLocal(x: number, y: number, v?: number): me.Vector2d;
    /**
     * render the camera effects
     * @ignore
     */
    drawFX(renderer: any): void;
    /**
     * draw all object visibile in this viewport
     * @ignore
     */
    draw(renderer: any, container: any): void;
}
/**
 * @classdesc
 * a canvas renderer object
 * @class CanvasRenderer
 * @extends me.Renderer
 * @memberOf me
 * @constructor
 * @param {object} options The renderer parameters
 * @param {number} options.width The width of the canvas without scaling
 * @param {number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing
 * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
 * @param {boolean} [options.textureSeamFix=true] enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
 * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
 */
export class CanvasRenderer {
    constructor(options: any);
    context: any;
    backBufferCanvas: any;
    backBufferContext2D: any;
    cache: TextureCache;
    uvOffset: number;
    /**
     * Reset context state
     * @name reset
     * @memberOf me.CanvasRenderer.prototype
     * @function
     */
    reset(): void;
    /**
     * Reset the canvas transform to identity
     * @name resetTransform
     * @memberOf me.CanvasRenderer.prototype
     * @function
     */
    resetTransform(): void;
    /**
     * Set a blend mode for the given context
     * @name setBlendMode
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {string} [mode="normal"] blend mode : "normal", "multiply"
     * @param {CanvasRenderingContext2D} [context]
     */
    setBlendMode(mode?: string, context?: CanvasRenderingContext2D): void;
    currentBlendMode: string;
    /**
     * prepare the framebuffer for drawing a new frame
     * @name clear
     * @memberOf me.CanvasRenderer.prototype
     * @function
     */
    clear(): void;
    /**
     * render the main framebuffer on screen
     * @name flush
     * @memberOf me.CanvasRenderer.prototype
     * @function
     */
    flush(): void;
    /**
     * Clears the main framebuffer with the given color
     * @name clearColor
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Color|string} color CSS color.
     * @param {boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(color: me.Color | string, opaque?: boolean): void;
    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @name clearRect
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x x axis of the coordinate for the rectangle starting point.
     * @param {number} y y axis of the coordinate for the rectangle starting point.
     * @param {number} width The rectangle's width.
     * @param {number} height The rectangle's height.
     */
    clearRect(x: number, y: number, width: number, height: number): void;
    /**
     * Create a pattern with the specified repetition
     * @name createPattern
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Image} image Source image
     * @param {string} repeat Define how the pattern should be repeated
     * @returns {CanvasPattern}
     * @see me.ImageLayer#repeat
     * @example
     * var tileable   = renderer.createPattern(image, "repeat");
     * var horizontal = renderer.createPattern(image, "repeat-x");
     * var vertical   = renderer.createPattern(image, "repeat-y");
     * var basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image: new (width?: number, height?: number) => HTMLImageElement, repeat: string): CanvasPattern;
    /**
     * Draw an image onto the main using the canvas api
     * @name drawImage
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
     * @param {number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {number} sh The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dw The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {number} dh The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image: new (width?: number, height?: number) => HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
    /**
     * Draw a pattern within the given rectangle.
     * @name drawPattern
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {CanvasPattern} pattern Pattern object
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @see me.CanvasRenderer#createPattern
     */
    drawPattern(pattern: CanvasPattern, x: number, y: number, width: number, height: number): void;
    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @name strokeArc
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean, fill?: boolean): void;
    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @name fillArc
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     */
    fillArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean): void;
    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @name strokeEllipse
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeEllipse(x: number, y: number, w: number, h: number, fill?: boolean): void;
    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @name fillEllipse
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     */
    fillEllipse(x: number, y: number, w: number, h: number): void;
    /**
     * Stroke a line of the given two points
     * @name strokeLine
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    strokeLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Fill a line of the given two points
     * @name fillLine
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    fillLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Stroke the given me.Polygon on the screen
     * @name strokePolygon
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokePolygon(poly: me.Polygon, fill?: boolean): void;
    /**
     * Fill the given me.Polygon on the screen
     * @name fillPolygon
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     */
    fillPolygon(poly: me.Polygon): void;
    /**
     * Stroke a rectangle at the specified coordinates
     * @name strokeRect
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeRect(x: number, y: number, width: number, height: number, fill?: boolean): void;
    /**
     * Draw a filled rectangle at the specified coordinates
     * @name fillRect
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRect(x: number, y: number, width: number, height: number): void;
    /**
     * return a reference to the system 2d Context
     * @name getContext
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @returns {CanvasRenderingContext2D}
     */
    getContext(): CanvasRenderingContext2D;
    /**
     * return a reference to the font 2d Context
     * @ignore
     */
    getFontContext(): CanvasRenderingContext2D;
    /**
     * save the canvas context
     * @name save
     * @memberOf me.CanvasRenderer.prototype
     * @function
     */
    save(): void;
    /**
     * restores the canvas context
     * @name restore
     * @memberOf me.CanvasRenderer.prototype
     * @function
     */
    restore(): void;
    /**
     * rotates the canvas context
     * @name rotate
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} angle in radians
     */
    rotate(angle: number): void;
    /**
     * scales the canvas context
     * @name scale
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    scale(x: number, y: number): void;
    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @name setColor
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Color|string} color css color value
     */
    setColor(color: me.Color | string): void;
    /**
     * Set the global alpha on the canvas context
     * @name setGlobalAlpha
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} alpha 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(alpha: number): void;
    /**
     * Set the line width on the context
     * @name setLineWidth
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} width Line width
     */
    setLineWidth(width: number): void;
    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @name setTransform
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    setTransform(mat2d: me.Matrix2d): void;
    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @name transform
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    transform(mat2d: me.Matrix2d): void;
    /**
     * Translates the context to the given position
     * @name translate
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    translate(x: number, y: number): void;
    /**
     * clip the given region from the original canvas. Once a region is clipped,
     * all future drawing will be limited to the clipped region.
     * You can however save the current region using the save(),
     * and restore it (with the restore() method) any time in the future.
     * (<u>this is an experimental feature !</u>)
     * @name clipRect
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    clipRect(x: number, y: number, width: number, height: number): void;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @name setMask
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
     */
    setMask(mask?: me.Rect | me.Polygon | me.Line | me.Ellipse): void;
    /**
     * disable (remove) the rendering mask set through setMask.
     * @name clearMask
     * @see me.CanvasRenderer#setMask
     * @memberOf me.CanvasRenderer.prototype
     * @function
     */
    clearMask(): void;
}
/**
 * @classdesc
 * a basic collectable helper class for immovable object (e.g. a coin)
 * @class Collectable
 * @extends me.Sprite
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinates of the collectable
 * @param {number} y the y coordinates of the collectable
 * @param {object} settings See {@link me.Sprite}
 */
export class Collectable {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    name: any;
    type: any;
    id: any;
    body: Body;
}
/**
 * @classdesc
 * A color manipulation object.
 * @class Color
 * @memberOf me
 * @constructor
 * @param {number|Float32Array} [r=0] red component or array of color components
 * @param {number} [g=0] green component
 * @param {number} [b=0] blue component
 * @param {number} [alpha=1.0] alpha value
 */
export class Color {
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(r?: number, g?: number, b?: number, alpha?: number): me.Color;
    glArray: Float32Array;
    readonly set r(arg: number);
    /**
     * Color Red Component [0 .. 255]
     * @type {number}
     * @name r
     * @readonly
     * @memberOf me.Color
     */
    readonly get r(): number;
    readonly set g(arg: number);
    /**
     * Color Green Component [0 .. 255]
     * @type {number}
     * @name g
     * @readonly
     * @memberOf me.Color
     */
    readonly get g(): number;
    readonly set b(arg: number);
    /**
     * Color Blue Component [0 .. 255]
     * @type {number}
     * @name b
     * @readonly
     * @memberOf me.Color
     */
    readonly get b(): number;
    readonly set alpha(arg: number);
    /**
     * Color Alpha Component [0.0 .. 1.0]
     * @type {number}
     * @name alpha
     * @readonly
     * @memberOf me.Color
     */
    readonly get alpha(): number;
    /**
     * Set this color to the specified value.
     * @name setColor
     * @memberOf me.Color
     * @function
     * @param {number} r red component [0 .. 255]
     * @param {number} g green component [0 .. 255]
     * @param {number} b blue component [0 .. 255]
     * @param {number} [alpha=1.0] alpha value [0.0 .. 1.0]
     * @returns {me.Color} Reference to this object for method chaining
     */
    setColor(r: number, g: number, b: number, alpha?: number): me.Color;
    /**
     * Create a new copy of this color object.
     * @name clone
     * @memberOf me.Color
     * @function
     * @returns {me.Color} Reference to the newly cloned object
     */
    clone(): me.Color;
    /**
     * Copy a color object or CSS color into this one.
     * @name copy
     * @memberOf me.Color
     * @function
     * @param {me.Color|string} color
     * @returns {me.Color} Reference to this object for method chaining
     */
    copy(color: me.Color | string): me.Color;
    /**
     * Blend this color with the given one using addition.
     * @name add
     * @memberOf me.Color
     * @function
     * @param {me.Color} color
     * @returns {me.Color} Reference to this object for method chaining
     */
    add(color: me.Color): me.Color;
    /**
     * Darken this color value by 0..1
     * @name darken
     * @memberOf me.Color
     * @function
     * @param {number} scale
     * @returns {me.Color} Reference to this object for method chaining
     */
    darken(scale: number): me.Color;
    /**
     * Linearly interpolate between this color and the given one.
     * @name lerp
     * @memberOf me.Color
     * @function
     * @param {me.Color} color
     * @param {number} alpha with alpha = 0 being this color, and alpha = 1 being the given one.
     * @returns {me.Color} Reference to this object for method chaining
     */
    lerp(color: me.Color, alpha: number): me.Color;
    /**
     * Lighten this color value by 0..1
     * @name lighten
     * @memberOf me.Color
     * @function
     * @param {number} scale
     * @returns {me.Color} Reference to this object for method chaining
     */
    lighten(scale: number): me.Color;
    /**
     * Generate random r,g,b values for this color object
     * @name random
     * @memberOf me.Color
     * @function
     * @param {number} [min=0] minimum value for the random range
     * @param {number} [max=255] maxmium value for the random range
     * @returns {me.Color} Reference to this object for method chaining
     */
    random(min?: number, max?: number): me.Color;
    /**
     * Return true if the r,g,b,a values of this color are equal with the
     * given one.
     * @name equals
     * @memberOf me.Color
     * @function
     * @param {me.Color} color
     * @returns {boolean}
     */
    equals(color: me.Color): boolean;
    /**
     * Parse a CSS color string and set this color to the corresponding
     * r,g,b values
     * @name parseCSS
     * @memberOf me.Color
     * @function
     * @param {string} cssColor
     * @returns {me.Color} Reference to this object for method chaining
     */
    parseCSS(cssColor: string): me.Color;
    /**
     * Parse an RGB or RGBA CSS color string
     * @name parseRGB
     * @memberOf me.Color
     * @function
     * @param {string} rgbColor
     * @returns {me.Color} Reference to this object for method chaining
     */
    parseRGB(rgbColor: string): me.Color;
    /**
     * Parse a Hex color ("#RGB", "#RGBA" or "#RRGGBB", "#RRGGBBAA" format) and set this color to
     * the corresponding r,g,b,a values
     * @name parseHex
     * @memberOf me.Color
     * @function
     * @param {string} hexColor
     * @param {boolean} [argb = false] true if format is #ARGB, or #AARRGGBB (as opposed to #RGBA or #RGGBBAA)
     * @returns {me.Color} Reference to this object for method chaining
     */
    parseHex(hexColor: string, argb?: boolean): me.Color;
    /**
     * Pack this color into a Uint32 ARGB representation
     * @name toUint32
     * @memberOf me.Color
     * @function
     * @param {number} [alpha=1.0] alpha value [0.0 .. 1.0]
     * @returns {Uint32}
     */
    toUint32(alpha?: number): Uint32;
    /**
     * return an array representation of this object
     * @name toArray
     * @memberOf me.Color
     * @function
     * @returns {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * Get the color in "#RRGGBB" format
     * @name toHex
     * @memberOf me.Color
     * @function
     * @returns {string}
     */
    toHex(): string;
    /**
     * Get the color in "#RRGGBBAA" format
     * @name toHex8
     * @memberOf me.Color
     * @function
     * @returns {string}
     */
    toHex8(): string;
    /**
     * Get the color in "rgb(R,G,B)" format
     * @name toRGB
     * @memberOf me.Color
     * @function
     * @returns {string}
     */
    toRGB(): string;
    /**
     * Get the color in "rgba(R,G,B,A)" format
     * @name toRGBA
     * @memberOf me.Color
     * @function
     * @returns {string}
     */
    toRGBA(): string;
}
/**
 * @classdesc
 * a generic Color Layer Object.  Fills the entire Canvas with the color not just the container the object belongs to.
 * @class ColorLayer
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {string} name Layer name
 * @param {me.Color|string} color CSS color
 * @param {number} [z = 0] z-index position
 */
export class ColorLayer {
    /**
     * @ignore
     */
    constructor(name: any, color: any, z: any);
    /**
     * the layer color component
     * @public
     * @type {me.Color}
     * @name color
     * @memberOf me.ColorLayer#
     */
    public color: me.Color;
    onResetEvent(name: any, color: any, z?: number): void;
    name: any;
    floating: boolean;
    /**
     * draw the color layer
     * @ignore
     */
    draw(renderer: any, rect: any): void;
    /**
     * Destroy function
     * @ignore
     */
    destroy(): void;
}
/**
 * @classdesc
 * me.Container represents a collection of child objects
 * @class Container
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {number} [x=0] position of the container (accessible via the inherited pos.x property)
 * @param {number} [y=0] position of the container (accessible via the inherited pos.y property)
 * @param {number} [w=me.game.viewport.width] width of the container
 * @param {number} [h=me.game.viewport.height] height of the container
 */
export class Container {
    /**
     * @ignore
     */
    constructor(x?: number, y?: number, width?: any, height?: any, root?: boolean);
    /**
     * keep track of pending sort
     * @ignore
     */
    pendingSort: any;
    /**
     * whether the container is the root of the scene
     * @public
     * @type {boolean}
     * @default false
     * @name root
     * @memberOf me.Container
     */
    public root: boolean;
    /**
     * The array of children of this container.
     * @ignore
     */
    children: any[];
    /**
     * The property of the child object that should be used to sort on <br>
     * value : "x", "y", "z"
     * @public
     * @type {string}
     * @default me.game.sortOn
     * @name sortOn
     * @memberOf me.Container
     */
    public sortOn: string;
    /**
     * Specify if the children list should be automatically sorted when adding a new child
     * @public
     * @type {boolean}
     * @default true
     * @name autoSort
     * @memberOf me.Container
     */
    public autoSort: boolean;
    /**
     * Specify if the children z index should automatically be managed by the parent container
     * @public
     * @type {boolean}
     * @default true
     * @name autoDepth
     * @memberOf me.Container
     */
    public autoDepth: boolean;
    /**
     * Specify if the container draw operation should clip his children to its own bounds
     * @public
     * @type {boolean}
     * @default false
     * @name clipping
     * @memberOf me.Container
     */
    public clipping: boolean;
    /**
     * a callback to be extended, triggered after a child has been added or removed
     * @name onChildChange
     * @memberOf me.Container#
     * @function
     * @param {number} index added or removed child index
     */
    onChildChange: () => void;
    /**
     * Specify if the container bounds should automatically take in account
     * all child bounds when updated (this is expensive and disabled by default,
     * only enable if necessary)
     * @public
     * @type {boolean}
     * @default false
     * @name enableChildBoundsUpdate
     * @memberOf me.Container
     */
    public enableChildBoundsUpdate: boolean;
    /**
     * Used by the debug panel plugin
     * @ignore
     */
    drawCount: number;
    autoTransform: boolean;
    isKinematic: boolean;
    /**
     * reset the container, removing all childrens, and reseting transforms.
     * @name reset
     * @memberOf me.Container
     * @function
     */
    reset(): void;
    /**
     * Add a child to the container <br>
     * if auto-sort is disable, the object will be appended at the bottom of the list.
     * Adding a child to the container will automatically remove it from its other container.
     * Meaning a child can only have one parent.  This is important if you add a renderable
     * to a container then add it to the me.game.world container it will move it out of the
     * orginal container.  Then when the me.game.world.reset() is called the renderable
     * will not be in any container.
     * @name addChild
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {number} [z] forces the z index of the child to the specified value
     * @returns {me.Renderable} the added child
     */
    addChild(child: me.Renderable, z?: number): me.Renderable;
    /**
     * Add a child to the container at the specified index<br>
     * (the list won't be sorted after insertion)
     * @name addChildAt
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {number} index
     * @returns {me.Renderable} the added child
     */
    addChildAt(child: me.Renderable, index: number): me.Renderable;
    /**
     * The forEach() method executes a provided function once per child element. <br>
     * the callback function is invoked with three arguments: <br>
     *    - The current element being processed in the array <br>
     *    - The index of element in the array. <br>
     *    - The array forEach() was called upon. <br>
     * @name forEach
     * @memberOf me.Container.prototype
     * @function
     * @param {Function} callback fnction to execute on each element
     * @param {object} [thisArg] value to use as this(i.e reference Object) when executing callback.
     * @example
     * // iterate through all children of the root container
     * me.game.world.forEach((child) => {
     *    // do something with the child
     *    child.doSomething();
     * });
     * me.game.world.forEach((child, index) => { ... });
     * me.game.world.forEach((child, index, array) => { ... });
     * me.game.world.forEach((child, index, array) => { ... }, thisArg);
     */
    forEach(callback: Function, thisArg?: object, ...args: any[]): void;
    /**
     * Swaps the position (z-index) of 2 children
     * @name swapChildren
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {me.Renderable} child2
     */
    swapChildren(child: me.Renderable, child2: me.Renderable): void;
    /**
     * Returns the Child at the specified index
     * @name getChildAt
     * @memberOf me.Container.prototype
     * @function
     * @param {number} index
     * @returns {me.Renderable} the child at the specified index
     */
    getChildAt(index: number): me.Renderable;
    /**
     * Returns the index of the given Child
     * @name getChildIndex
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @returns {number} index
     */
    getChildIndex(child: me.Renderable): number;
    /**
     * Returns the next child within the container or undefined if none
     * @name getNextChild
     * @memberOf me.Container
     * @function
     * @param {me.Renderable} child
     * @returns {me.Renderable} child
     */
    getNextChild(child: me.Renderable): me.Renderable;
    /**
     * Returns true if contains the specified Child
     * @name hasChild
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @returns {boolean}
     */
    hasChild(child: me.Renderable): boolean;
    /**
     * return the child corresponding to the given property and value.<br>
     * note : avoid calling this function every frame since
     * it parses the whole object tree each time
     * @name getChildByProp
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {string} prop Property name
     * @param {string|RegExp|number|boolean} value Value of the property
     * @returns {me.Renderable[]} Array of childs
     * @example
     * // get the first child object called "mainPlayer" in a specific container :
     * var ent = myContainer.getChildByProp("name", "mainPlayer");
     *
     * // or query the whole world :
     * var ent = me.game.world.getChildByProp("name", "mainPlayer");
     *
     * // partial property matches are also allowed by using a RegExp.
     * // the following matches "redCOIN", "bluecoin", "bagOfCoins", etc :
     * var allCoins = me.game.world.getChildByProp("name", /coin/i);
     *
     * // searching for numbers or other data types :
     * var zIndex10 = me.game.world.getChildByProp("z", 10);
     * var inViewport = me.game.world.getChildByProp("inViewport", true);
     */
    public getChildByProp(prop: string, value: string | RegExp | number | boolean): me.Renderable[];
    /**
     * returns the list of childs with the specified class type
     * @name getChildByType
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {object} classType
     * @returns {me.Renderable[]} Array of children
     */
    public getChildByType(classType: object): me.Renderable[];
    /**
     * returns the list of childs with the specified name<br>
     * as defined in Tiled (Name field of the Object Properties)<br>
     * note : avoid calling this function every frame since
     * it parses the whole object list each time
     * @name getChildByName
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {string|RegExp|number|boolean} name child name
     * @returns {me.Renderable[]} Array of children
     */
    public getChildByName(name: string | RegExp | number | boolean): me.Renderable[];
    /**
     * return the child corresponding to the specified GUID<br>
     * note : avoid calling this function every frame since
     * it parses the whole object list each time
     * @name getChildByGUID
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {string|RegExp|number|boolean} guid child GUID
     * @returns {me.Renderable} corresponding child or null
     */
    public getChildByGUID(guid: string | RegExp | number | boolean): me.Renderable;
    /**
     * return all child in this container
     * @name getChildren
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @returns {me.Renderable[]} an array of renderable object
     */
    public getChildren(): me.Renderable[];
    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberOf me.Renderable.prototype
     * @function
     * @returns {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds(forceUpdateChildBounds?: boolean): me.Bounds;
    /**
     * Checks if this container is root or if it's attached to the root container.
     * @private
     * @name isAttachedToRoot
     * @memberOf me.Container.prototype
     * @function
     * @returns {boolean}
     */
    private isAttachedToRoot;
    /**
     * update the cointainer's bounding rect (private)
     * @ignore
     * @name updateBoundsPos
     * @memberOf me.Container.prototype
     * @function
     */
    updateBoundsPos(newX: any, newY: any): any;
    /**
     * @ignore
     */
    onActivateEvent(): void;
    /**
     * Invokes the removeChildNow in a defer, to ensure the child is removed safely after the update & draw stack has completed
     * @name removeChild
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {me.Renderable} child
     * @param {boolean} [keepalive=False] True to prevent calling child.destroy()
     */
    public removeChild(child: me.Renderable, keepalive?: boolean): void;
    /**
     * Removes (and optionally destroys) a child from the container.<br>
     * (removal is immediate and unconditional)<br>
     * Never use keepalive=true with objects from {@link me.pool}. Doing so will create a memory leak.
     * @name removeChildNow
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {boolean} [keepalive=False] True to prevent calling child.destroy()
     */
    removeChildNow(child: me.Renderable, keepalive?: boolean): void;
    /**
     * Automatically set the specified property of all childs to the given value
     * @name setChildsProperty
     * @memberOf me.Container.prototype
     * @function
     * @param {string} prop property name
     * @param {object} value property value
     * @param {boolean} [recursive=false] recursively apply the value to child containers if true
     */
    setChildsProperty(prop: string, value: object, recursive?: boolean): void;
    /**
     * Move the child in the group one step forward (z depth).
     * @name moveUp
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveUp(child: me.Renderable): void;
    /**
     * Move the child in the group one step backward (z depth).
     * @name moveDown
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveDown(child: me.Renderable): void;
    /**
     * Move the specified child to the top(z depth).
     * @name moveToTop
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveToTop(child: me.Renderable): void;
    /**
     * Move the specified child the bottom (z depth).
     * @name moveToBottom
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveToBottom(child: me.Renderable): void;
    /**
     * Manually trigger the sort of all the childs in the container</p>
     * @name sort
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {boolean} [recursive=false] recursively sort all containers if true
     */
    public sort(recursive?: boolean): void;
    /**
     * @ignore
     */
    onDeactivateEvent(): void;
    /**
     * Z Sorting function
     * @ignore
     */
    _sortZ(a: any, b: any): number;
    /**
     * Reverse Z Sorting function
     * @ignore
     */
    _sortReverseZ(a: any, b: any): number;
    /**
     * X Sorting function
     * @ignore
     */
    _sortX(a: any, b: any): number;
    /**
     * Y Sorting function
     * @ignore
     */
    _sortY(a: any, b: any): number;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(...args: any[]): void;
    /**
     * container update function. <br>
     * automatically called by the game manager {@link me.game}
     * @name update
     * @memberOf me.Container.prototype
     * @function
     * @protected
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean} true if the Container is dirty
     */
    protected update(dt: number): boolean;
    /**
     * draw the container. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberOf me.Container.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {me.Rect|me.Bounds} [rect] the area or viewport to (re)draw
     */
    protected draw(renderer: me.CanvasRenderer | me.WebGLRenderer, rect?: me.Rect | me.Bounds): void;
}
/**
 * Used to make a game entity draggable
 * @class
 * @extends me.Entity
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinates of the entity object
 * @param {number} y the y coordinates of the entity object
 * @param {object} settings Entity properties (see {@link me.Entity})
 */
export class DraggableEntity {
    /**
     * Constructor
     * @name init
     * @memberOf me.DraggableEntity
     * @function
     * @param {number} x the x postion of the entity
     * @param {number} y the y postion of the entity
     * @param {object} settings the additional entity settings
     */
    constructor(x: number, y: number, settings: object);
    dragging: boolean;
    dragId: any;
    grabOffset: Vector2d;
    onPointerEvent: typeof registerPointerEvent;
    removePointerEvent: typeof releasePointerEvent;
    /**
     * Initializes the events the modules needs to listen to
     * It translates the pointer events to me.events
     * in order to make them pass through the system and to make
     * this module testable. Then we subscribe this module to the
     * transformed events.
     * @name initEvents
     * @memberOf me.DraggableEntity
     * @function
     */
    initEvents(): void;
    /**
     * @ignore
     */
    mouseDown: (e: any) => void;
    /**
     * @ignore
     */
    mouseUp: (e: any) => void;
    /**
     * Translates a pointer event to a me.event
     * @name translatePointerEvent
     * @memberOf me.DraggableEntity
     * @function
     * @param {object} e the pointer event you want to translate
     * @param {string} translation the me.event you want to translate the event to
     */
    translatePointerEvent(e: object, translation: string): void;
    /**
     * Gets called when the user starts dragging the entity
     * @name dragStart
     * @memberOf me.DraggableEntity
     * @function
     * @param {object} e the pointer event
     * @returns {boolean} false if the object is being dragged
     */
    dragStart(e: object): boolean;
    /**
     * Gets called when the user drags this entity around
     * @name dragMove
     * @memberOf me.DraggableEntity
     * @function
     * @param {object} e the pointer event
     */
    dragMove(e: object): void;
    /**
     * Gets called when the user stops dragging the entity
     * @name dragEnd
     * @memberOf me.DraggableEntity
     * @function
     * @returns {boolean} false if the object stopped being dragged
     */
    dragEnd(): boolean;
    /**
     * Destructor
     * @name destroy
     * @memberOf me.DraggableEntity
     * @function
     */
    destroy(): void;
}
/**
 * Used to make a game entity a droptarget
 * @class
 * @extends me.Entity
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinates of the entity object
 * @param {number} y the y coordinates of the entity object
 * @param {object} settings Entity properties (see {@link me.Entity})
 */
export class DroptargetEntity {
    /**
     * Constructor
     * @name init
     * @memberOf me.DroptargetEntity
     * @function
     * @param {number} x the x postion of the entity
     * @param {number} y the y postion of the entity
     * @param {object} settings the additional entity settings
     */
    constructor(x: number, y: number, settings: object);
    /**
     * constant for the overlaps method
     * @public
     * @constant
     * @type {string}
     * @name CHECKMETHOD_OVERLAP
     * @memberOf me.DroptargetEntity
     */
    public CHECKMETHOD_OVERLAP: string;
    /**
     * constant for the contains method
     * @public
     * @constant
     * @type {string}
     * @name CHECKMETHOD_CONTAINS
     * @memberOf me.DroptargetEntity
     */
    public CHECKMETHOD_CONTAINS: string;
    /**
     * the checkmethod we want to use
     * @public
     * @constant
     * @type {string}
     * @name checkMethod
     * @memberOf me.DroptargetEntity
     */
    public checkMethod: string;
    /**
     * Sets the collision method which is going to be used to check a valid drop
     * @name setCheckMethod
     * @memberOf me.DroptargetEntity
     * @function
     * @param {string} checkMethod the checkmethod (defaults to CHECKMETHOD_OVERLAP)
     */
    setCheckMethod(checkMethod: string): void;
    /**
     * Checks if a dropped entity is dropped on the current entity
     * @name checkOnMe
     * @memberOf me.DroptargetEntity
     * @function
     * @param {object} e the triggering event
     * @param {object} draggableEntity the draggable entity that is dropped
     */
    checkOnMe(e: object, draggableEntity: object): void;
    /**
     * Gets called when a draggable entity is dropped on the current entity
     * @name drop
     * @memberOf me.DroptargetEntity
     * @function
     * @param {object} draggableEntity the draggable entity that is dropped
     */
    drop(): void;
    /**
     * Destructor
     * @name destroy
     * @memberOf me.DroptargetEntity
     * @function
     */
    destroy(): void;
}
/**
 * @classdesc
 * an ellipse Object
 * @class Ellipse
 * @extends me.Object
 * @memberOf me
 * @constructor
 * @param {number} x the center x coordinate of the ellipse
 * @param {number} y the center y coordinate of the ellipse
 * @param {number} w width (diameter) of the ellipse
 * @param {number} h height (diameter) of the ellipse
 */
export class Ellipse {
    constructor(x: any, y: any, w: any, h: any);
    /**
     * the center coordinates of the ellipse
     * @public
     * @type {me.Vector2d}
     * @name pos
     * @memberOf me.Ellipse#
     */
    public pos: me.Vector2d;
    /**
     * The bounding rectangle for this shape
     * @private
     * @type {me.Bounds}
     * @name _bounds
     * @memberOf me.Ellipse#
     */
    private _bounds;
    /**
     * Maximum radius of the ellipse
     * @public
     * @type {number}
     * @name radius
     * @memberOf me.Ellipse
     */
    public radius: number;
    /**
     * Pre-scaled radius vector for ellipse
     * @public
     * @type {me.Vector2d}
     * @name radiusV
     * @memberOf me.Ellipse#
     */
    public radiusV: me.Vector2d;
    /**
     * Radius squared, for pythagorean theorom
     * @public
     * @type {me.Vector2d}
     * @name radiusSq
     * @memberOf me.Ellipse#
     */
    public radiusSq: me.Vector2d;
    /**
     * x/y scaling ratio for ellipse
     * @public
     * @type {me.Vector2d}
     * @name ratio
     * @memberOf me.Ellipse#
     */
    public ratio: me.Vector2d;
    shapeType: string;
    /** @ignore */
    onResetEvent(x: any, y: any, w: any, h: any): void;
    /**
     * set new value to the Ellipse shape
     * @name setShape
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {number} x the center x coordinate of the ellipse
     * @param {number} y the center y coordinate of the ellipse
     * @param {number} w width (diameter) of the ellipse
     * @param {number} h height (diameter) of the ellipse
     * @returns {me.Ellipse} this instance for objecf chaining
     */
    setShape(x: number, y: number, w: number, h: number): me.Ellipse;
    /**
     * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.Ellipse} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.Ellipse;
    /**
     * Scale this Ellipse by the specified scalar.
     * @name scale
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @returns {me.Ellipse} Reference to this object for method chaining
     */
    scale(x: number, y?: number): me.Ellipse;
    /**
     * Scale this Ellipse by the specified vector.
     * @name scale
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Ellipse} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d): me.Ellipse;
    /**
     * apply the given transformation matrix to this ellipse
     * @name transform
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {me.Matrix2d} matrix the transformation matrix
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    transform(): me.Polygon;
    /**
     * translate the circle/ellipse by the specified offset
     * @name translate
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {number} x x offset
     * @param {number} y y offset
     * @returns {me.Ellipse} this ellipse
     */
    /**
     * translate the circle/ellipse by the specified vector
     * @name translate
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {me.Vector2d} v vector offset
     * @returns {me.Ellipse} this ellipse
     */
    translate(...args: any[]): me.Ellipse;
    /**
     * check if this circle/ellipse contains the specified point
     * @name contains
     * @memberOf me.Ellipse.prototype
     * @function
     * @param  {me.Vector2d} point
     * @returns {boolean} true if contains
     */
    /**
     * check if this circle/ellipse contains the specified point
     * @name contains
     * @memberOf me.Ellipse.prototype
     * @function
     * @param  {number} x x coordinate
     * @param  {number} y y coordinate
     * @returns {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @name getBounds
     * @memberOf me.Ellipse.prototype
     * @function
     * @returns {me.Bounds} this shape bounding box Rectangle object
     */
    getBounds(): me.Bounds;
    /**
     * clone this Ellipse
     * @name clone
     * @memberOf me.Ellipse.prototype
     * @function
     * @returns {me.Ellipse} new Ellipse
     */
    clone(): me.Ellipse;
}
/**
 * a Generic Object Entity
 * @class Entity
 * @extends me.Renderable
 * @memberOf me
 * @see me.Renderable
 * @constructor
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
export class Entity {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    /**
     * The array of renderable children of this entity.
     * @ignore
     */
    children: any[];
    public set renderable(arg: me.Renderable);
    /**
     * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
     * @public
     * @type {me.Renderable}
     * @name renderable
     * @memberOf me.Entity
     */
    public get renderable(): me.Renderable;
    name: any;
    /**
     * object type (as defined in Tiled)
     * @public
     * @type {string}
     * @name type
     * @memberOf me.Entity
     */
    public type: string;
    /**
     * object unique ID (as defined in Tiled)
     * @public
     * @type {number}
     * @name id
     * @memberOf me.Entity
     */
    public id: number;
    /**
     * dead/living state of the entity<br>
     * default value : true
     * @public
     * @type {boolean}
     * @name alive
     * @memberOf me.Entity
     */
    public alive: boolean;
    body: Body;
    autoTransform: boolean;
    /** @ignore */
    update(dt: any): any;
    /**
     * update the bounds position when the body is modified
     * @ignore
     * @name onBodyUpdate
     * @memberOf me.Entity
     * @function
     * @param {me.Body} the body whose bounds to update
     */
    onBodyUpdate(body: any): void;
    preDraw(renderer: any): void;
    /**
     * object draw<br>
     * not to be called by the end user<br>
     * called by the game manager on each game loop
     * @name draw
     * @memberOf me.Entity
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {me.Rect} rect region to draw
     */
    protected draw(renderer: me.CanvasRenderer | me.WebGLRenderer, rect: me.Rect): void;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(...args: any[]): void;
    /**
     * onDeactivateEvent Notification function<br>
     * Called by engine before deleting the object
     * @name onDeactivateEvent
     * @memberOf me.Entity
     * @function
     */
    onDeactivateEvent(): void;
}
/**
 * @classdesc
 * a base GL Shader object
 * @class GLShader
 * @memberOf me
 * @param {WebGLRenderingContext} gl the current WebGL rendering context
 * @param {string} vertex a string containing the GLSL source code to set
 * @param {string} fragment a string containing the GLSL source code to set
 * @param {string} [precision=auto detected] float precision ('lowp', 'mediump' or 'highp').
 * @constructor
 * @see https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/GLSL_Shaders
 * @example
 * // create a basic shader
 * var myShader = new me.GLShader(
 *    // WebGL rendering context
 *    gl,
 *    // vertex shader
 *    [
 *        "void main() {",
 *        "    gl_Position = doMathToMakeClipspaceCoordinates;",
 *        "}"
 *    ].join("\n"),
 *    // fragment shader
 *    [
 *        "void main() {",
 *        "    gl_FragColor = doMathToMakeAColor;",
 *        "}"
 *    ].join("\n")
 *  )
 * // use the shader
 * myShader.bind();
 */
export class GLShader {
    constructor(gl: any, vertex: any, fragment: any, precision: any);
    /**
     * the active gl rendering context
     * @public
     * @type {WebGLRenderingContext}
     * @name gl
     * @memberOf me.GLShader
     */
    public gl: WebGLRenderingContext;
    /**
     * the vertex shader source code
     * @public
     * @type {string}
     * @name vertex
     * @memberOf me.GLShader
     */
    public vertex: string;
    /**
     * the fragment shader source code
     * @public
     * @type {string}
     * @name vertex
     * @memberOf me.GLShader
     */
    public fragment: string;
    /**
     * the location attributes of the shader
     * @public
     * @type {GLint[]}
     * @name attributes
     * @memberOf me.GLShader
     */
    public attributes: GLint[];
    /**
     * a reference to the shader program (once compiled)
     * @public
     * @type {WebGLProgram}
     * @name program
     * @memberOf me.GLShader
     */
    public program: WebGLProgram;
    /**
     * the uniforms of the shader
     * @public
     * @type {object}
     * @name uniforms
     * @memberOf me.GLShader
     */
    public uniforms: object;
    /**
     * Installs this shader program as part of current rendering state
     * @name bind
     * @memberOf me.GLShader
     * @function
     */
    bind(): void;
    /**
     * returns the location of an attribute variable in this shader program
     * @name getAttribLocation
     * @memberOf me.GLShader
     * @function
     * @param {string} name the name of the attribute variable whose location to get.
     * @returns {GLint} number indicating the location of the variable name if found. Returns -1 otherwise
     */
    getAttribLocation(name: string): GLint;
    /**
     * Set the uniform to the given value
     * @name setUniform
     * @memberOf me.GLShader
     * @function
     * @param {string} name the uniform name
     * @param {object|Float32Array} value the value to assign to that uniform
     * @example
     * myShader.setUniform("uProjectionMatrix", this.projectionMatrix);
     */
    setUniform(name: string, value: object | Float32Array): void;
    /**
     * destroy this shader objects resources (program, attributes, uniforms)
     * @name destroy
     * @memberOf me.GLShader
     * @function
     */
    destroy(): void;
}
/**
 * @classdesc
 * GUI Object<br>
 * A very basic object to manage GUI elements <br>
 * The object simply register on the "pointerdown" <br>
 * or "touchstart" event and call the onClick function"
 * @class GUI_Object
 * @extends me.Sprite
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinate of the GUI Object
 * @param {number} y the y coordinate of the GUI Object
 * @param {object} settings See {@link me.Sprite}
 * @example
 * // create a basic GUI Object
 * class myButton extends GUI_Object {
 *    constructor(x, y) {
 *       var settings = {}
 *       settings.image = "button";
 *       settings.framewidth = 100;
 *       settings.frameheight = 50;
 *       // super constructor
 *       super(x, y, settings);
 *       // define the object z order
 *       this.pos.z = 4;
 *    }
 *
 *    // output something in the console
 *    // when the object is clicked
 *    onClick:function (event) {
 *       console.log("clicked!");
 *       // don't propagate the event
 *       return false;
 *    }
 * });
 *
 * // add the object at pos (10,10)
 * me.game.world.addChild(new myButton(10,10));
 */
export class GUI_Object {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    /**
     * object can be clicked or not
     * @public
     * @type {boolean}
     * @default true
     * @name me.GUI_Object#isClickable
     */
    public isClickable: boolean;
    /**
     * Tap and hold threshold timeout in ms
     * @type {number}
     * @default 250
     * @name me.GUI_Object#holdThreshold
     */
    holdThreshold: number;
    /**
     * object can be tap and hold
     * @public
     * @type {boolean}
     * @default false
     * @name me.GUI_Object#isHoldable
     */
    public isHoldable: boolean;
    /**
     * true if the pointer is over the object
     * @public
     * @type {boolean}
     * @default false
     * @name me.GUI_Object#hover
     */
    public hover: boolean;
    holdTimeout: number;
    released: boolean;
    floating: boolean;
    isKinematic: boolean;
    /**
     * function callback for the pointerdown event
     * @ignore
     */
    clicked(event: any): boolean;
    dirty: boolean;
    /**
     * function called when the object is pressed (to be extended)
     * @name onClick
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @param {me.Pointer} event the event object
     * @returns {boolean} return false if we need to stop propagating the event
     */
    public onClick(): boolean;
    /**
     * function callback for the pointerEnter event
     * @ignore
     */
    enter(event: any): void;
    /**
     * function called when the pointer is over the object
     * @name onOver
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @param {me.Pointer} event the event object
     */
    public onOver(): void;
    /**
     * function callback for the pointerLeave event
     * @ignore
     */
    leave(event: any): void;
    /**
     * function called when the pointer is leaving the object area
     * @name onOut
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @param {me.Pointer} event the event object
     */
    public onOut(): void;
    /**
     * function callback for the pointerup event
     * @ignore
     */
    release(event: any): boolean;
    /**
     * function called when the object is pressed and released (to be extended)
     * @name onRelease
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @returns {boolean} return false if we need to stop propagating the event
     */
    public onRelease(): boolean;
    /**
     * function callback for the tap and hold timer event
     * @ignore
     */
    hold(): void;
    /**
     * function called when the object is pressed and held<br>
     * to be extended <br>
     * @name onHold
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     */
    public onHold(): void;
    /**
     * function called when added to the game world or a container
     * @ignore
     */
    onActivateEvent(): void;
    /**
     * function called when removed from the game world or a container
     * @ignore
     */
    onDeactivateEvent(): void;
}
/**
 * @classdesc
 * a generic Image Layer Object
 * @class ImageLayer
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {number} x x coordinate
 * @param {number} y y coordinate
 * @param {object} settings ImageLayer properties
 * @param {HTMLImageElement|HTMLCanvasElement|string} settings.image Image reference. See {@link me.loader.getImage}
 * @param {string} [settings.name="me.ImageLayer"] layer name
 * @param {number} [settings.z=0] z-index position
 * @param {number|me.Vector2d} [settings.ratio=1.0] Scrolling ratio to be applied. See {@link me.ImageLayer#ratio}
 * @param {string} [settings.repeat='repeat'] define if and how an Image Layer should be repeated (accepted values are 'repeat',
'repeat-x', 'repeat-y', 'no-repeat'). See {@link me.ImageLayer#repeat}
 * @param {number|me.Vector2d} [settings.anchorPoint=0.0] Image origin. See {@link me.ImageLayer#anchorPoint}
 * @example
 * // create a repetitive background pattern on the X axis using the citycloud image asset
 * me.game.world.addChild(new me.ImageLayer(0, 0, {
 *     image:"citycloud",
 *     repeat :"repeat-x"
 * }), 1);
 */
export class ImageLayer {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    floating: boolean;
    /**
     * Define the image scrolling ratio<br>
     * Scrolling speed is defined by multiplying the viewport delta position by the specified ratio.
     * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
     * To specify a value through Tiled, use one of the following format : <br>
     * - a number, to change the value for both axis <br>
     * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
     * @public
     * @type {me.Vector2d}
     * @default <1.0,1.0>
     * @name me.ImageLayer#ratio
     */
    public ratio: me.Vector2d;
    public set repeat(arg: string);
    /**
     * Define if and how an Image Layer should be repeated.<br>
     * By default, an Image Layer is repeated both vertically and horizontally.<br>
     * Acceptable values : <br>
     * - 'repeat' - The background image will be repeated both vertically and horizontally <br>
     * - 'repeat-x' - The background image will be repeated only horizontally.<br>
     * - 'repeat-y' - The background image will be repeated only vertically.<br>
     * - 'no-repeat' - The background-image will not be repeated.<br>
     * @public
     * @type {string}
     * @default 'repeat'
     * @name me.ImageLayer#repeat
     */
    public get repeat(): string;
    _repeat: string;
    repeatX: boolean;
    repeatY: boolean;
    onActivateEvent(): void;
    /**
     * resize the Image Layer to match the given size
     * @name resize
     * @memberOf me.ImageLayer.prototype
     * @function
     * @param {number} w new width
     * @param {number} h new height
     */
    resize(w: number, h: number): void;
    /**
     * createPattern function
     * @ignore
     * @function
     */
    createPattern(): void;
    _pattern: any;
    /**
     * updateLayer function
     * @ignore
     * @function
     */
    updateLayer(vpos: any): void;
    isDirty: boolean;
    /**
     * override the default predraw function
     * as repeat and anchor are managed directly in the draw method
     * @ignore
     */
    preDraw(renderer: any): void;
    /**
     * draw the ImageLayer. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberOf me.ImageLayer.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    protected draw(renderer: me.CanvasRenderer | me.WebGLRenderer): void;
    onDeactivateEvent(): void;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(): void;
}
/**
 * @classdesc
 * a line segment Object
 * @class Line
 * @extends me.Polygon
 * @memberOf me
 * @constructor
 * @param {number} x origin point of the Line
 * @param {number} y origin point of the Line
 * @param {me.Vector2d[]} points array of vectors defining the Line
 */
export class Line {
    /**
     * Returns true if the Line contains the given point
     * @name contains
     * @memberOf me.Line.prototype
     * @function
     * @param  {me.Vector2d} point
     * @returns {boolean} true if contains
     */
    /**
     * Returns true if the Line contains the given point
     * @name contains
     * @memberOf me.Line.prototype
     * @function
     * @param  {number} x x coordinate
     * @param  {number} y y coordinate
     * @returns {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * Computes the calculated collision edges and normals.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @name recalc
     * @memberOf me.Line.prototype
     * @function
     * @returns {me.Line} this instance for objecf chaining
     */
    recalc(): me.Line;
    /**
     * clone this line segment
     * @name clone
     * @memberOf me.Line.prototype
     * @function
     * @returns {me.Line} new Line
     */
    clone(): me.Line;
}
declare var math: Readonly<{
    __proto__: any;
    DEG_TO_RAD: number;
    RAD_TO_DEG: number;
    TAU: number;
    ETA: number;
    EPSILON: number;
    isPowerOfTwo: typeof isPowerOfTwo;
    nextPowerOfTwo: typeof nextPowerOfTwo;
    degToRad: typeof degToRad;
    radToDeg: typeof radToDeg;
    clamp: typeof clamp;
    random: typeof random$1;
    randomFloat: typeof randomFloat;
    weightedRandom: typeof weightedRandom$1;
    round: typeof round;
    toBeCloseTo: typeof toBeCloseTo;
}>;
/**
 * @classdesc
 * a Matrix2d Object.<br>
 * the identity matrix and parameters position : <br>
 * <img src="images/identity-matrix_2x.png"/>
 * @class Matrix2d
 * @memberOf me
 * @constructor
 * @param {me.Matrix2d} [mat2d] An instance of me.Matrix2d to copy from
 * @param {number[]} [arguments...] Matrix elements. See {@link me.Matrix2d.setTransform}
 */
export class Matrix2d {
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(...args: any[]): Matrix2d;
    val: Float32Array;
    /**
     * tx component of the matrix
     * @public
     * @type {number}
     * @readonly
     * @see me.Matrix2d.translate
     * @name tx
     * @memberOf me.Matrix2d
     */
    public readonly get tx(): number;
    /**
     * ty component of the matrix
     * @public
     * @type {number}
     * @readonly
     * @see me.Matrix2d.translate
     * @name ty
     * @memberOf me.Matrix2d
     */
    public readonly get ty(): number;
    /**
     * reset the transformation matrix to the identity matrix (no transformation).<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @name identity
     * @memberOf me.Matrix2d
     * @function
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    identity(): me.Matrix2d;
    /**
     * set the matrix to the specified value
     * @name setTransform
     * @memberOf me.Matrix2d
     * @function
     * @param {number} a
     * @param {number} b
     * @param {number} c
     * @param {number} d
     * @param {number} e
     * @param {number} f
     * @param {number} [g=0]
     * @param {number} [h=0]
     * @param {number} [i=1]
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    setTransform(...args: any[]): me.Matrix2d;
    /**
     * Copies over the values from another me.Matrix2d.
     * @name copy
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix2d} m the matrix object to copy from
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    copy(m: me.Matrix2d): me.Matrix2d;
    /**
     * Copies over the upper-left 3x3 values from the given me.Matrix3d
     * @name fromMat3d
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix3d} m the matrix object to copy from
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    fromMat3d(m: me.Matrix3d): me.Matrix2d;
    /**
     * multiply both matrix
     * @name multiply
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix2d} m the other matrix
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    multiply(m: me.Matrix2d): me.Matrix2d;
    /**
     * Transpose the value of this matrix.
     * @name transpose
     * @memberOf me.Matrix2d
     * @function
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    transpose(): me.Matrix2d;
    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @name invert
     * @memberOf me.Matrix2d
     * @function
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    invert(): me.Matrix2d;
    /**
     * apply the current transform to the given 2d vector
     * @name apply
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} v the vector object to be transformed
     * @returns {me.Vector2d} result vector object.
     */
    apply(v: me.Vector2d): me.Vector2d;
    /**
     * apply the inverted current transform to the given 2d vector
     * @name applyInverse
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} v the vector object to be transformed
     * @returns {me.Vector2d} result vector object.
     */
    applyInverse(v: me.Vector2d): me.Vector2d;
    /**
     * scale the matrix
     * @name scale
     * @memberOf me.Matrix2d
     * @function
     * @param {number} x a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] a number representing the ordinate of the scaling vector.
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number): me.Matrix2d;
    /**
     * adds a 2D scaling transformation.
     * @name scaleV
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} v scaling vector
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d): me.Matrix2d;
    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @name scaleX
     * @memberOf me.Matrix2d
     * @function
     * @param {number} x x scaling vector
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    scaleX(x: number): me.Matrix2d;
    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @name scaleY
     * @memberOf me.Matrix2d
     * @function
     * @param {number} y y scaling vector
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    scaleY(y: number): me.Matrix2d;
    /**
     * rotate the matrix (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Matrix2d
     * @function
     * @param {number} angle Rotation angle in radians.
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    rotate(angle: number): me.Matrix2d;
    /**
     * translate the matrix position on the horizontal and vertical axis
     * @name translate
     * @memberOf me.Matrix2d
     * @function
     * @param {number} x the x coordindates to translate the matrix by
     * @param {number} y the y coordindates to translate the matrix by
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    /**
     * translate the matrix by a vector on the horizontal and vertical axis
     * @name translateV
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} v the vector to translate the matrix by
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    translate(...args: any[]): me.Matrix2d;
    /**
     * returns true if the matrix is an identity matrix.
     * @name isIdentity
     * @memberOf me.Matrix2d
     * @function
     * @returns {boolean}
     */
    isIdentity(): boolean;
    /**
     * return true if the two matrices are identical
     * @name equals
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix2d} m the other matrix
     * @returns {boolean} true if both are equals
     */
    equals(m: me.Matrix2d): boolean;
    /**
     * Clone the Matrix
     * @name clone
     * @memberOf me.Matrix2d
     * @function
     * @returns {me.Matrix2d}
     */
    clone(): me.Matrix2d;
    /**
     * return an array representation of this Matrix
     * @name toArray
     * @memberOf me.Matrix2d
     * @function
     * @returns {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Matrix2d
     * @function
     * @returns {string}
     */
    toString(): string;
}
/**
 * @classdesc
 * a 4x4 Matrix3d Object<br>
 * @class Matrix3d
 * @memberOf me
 * @constructor
 * @param {me.Matrix3d} [mat3d] An instance of me.Matrix3d to copy from
 * @param {number[]} [arguments...] Matrix elements. See {@link me.Matrix3d.setTransform}
 */
export class Matrix3d {
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(...args: any[]): void;
    val: Float32Array;
    /**
     * tx component of the matrix
     * @public
     * @type {number}
     * @readonly
     * @name tx
     * @memberOf me.Matrix3d
     */
    public readonly get tx(): number;
    /**
     * ty component of the matrix
     * @public
     * @type {number}
     * @readonly
     * @name ty
     * @memberOf me.Matrix3d
     */
    public readonly get ty(): number;
    /**
     * ty component of the matrix
     * @public
     * @type {number}
     * @readonly
     * @name tz
     * @memberOf me.Matrix3d
     */
    public readonly get tz(): number;
    /**
     * reset the transformation matrix to the identity matrix (no transformation).<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @name identity
     * @memberOf me.Matrix3d
     * @function
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    identity(): me.Matrix3d;
    /**
     * set the matrix to the specified value
     * @name setTransform
     * @memberOf me.Matrix3d
     * @function
     * @param {number} m00
     * @param {number} m01
     * @param {number} m02
     * @param {number} m03
     * @param {number} m10
     * @param {number} m11
     * @param {number} m12
     * @param {number} m13
     * @param {number} m20
     * @param {number} m21
     * @param {number} m22
     * @param {number} m23
     * @param {number} m30
     * @param {number} m31
     * @param {number} m32
     * @param {number} m33
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    setTransform(m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number): me.Matrix3d;
    /**
     * Copies over the values from another me.Matrix3d.
     * @name copy
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix3d} m the matrix object to copy from
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    copy(m: me.Matrix3d): me.Matrix3d;
    /**
     * Copies over the upper-left 2x2 values from the given me.Matrix2d
     * @name fromMat2d
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix2d} m the matrix object to copy from
     * @returns {me.Matrix2d} Reference to this object for method chaining
     */
    fromMat2d(m: me.Matrix2d): me.Matrix2d;
    /**
     * multiply both matrix
     * @name multiply
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix3d} m Other matrix
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    multiply(m: me.Matrix3d): me.Matrix3d;
    /**
     * Transpose the value of this matrix.
     * @name transpose
     * @memberOf me.Matrix3d
     * @function
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    transpose(): me.Matrix3d;
    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @name invert
     * @memberOf me.Matrix3d
     * @function
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    invert(): me.Matrix3d;
    /**
     * apply the current transform to the given 2d or 3d vector
     * @name apply
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v the vector object to be transformed
     * @returns {me.Vector2d|me.Vector3d} result vector object.
     */
    apply(v: me.Vector2d | me.Vector3d): me.Vector2d | me.Vector3d;
    /**
     * apply the inverted current transform to the given 2d or 3d vector
     * @name applyInverse
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v the vector object to be transformed
     * @returns {me.Vector2d|me.Vector3d} result vector object.
     */
    applyInverse(v: me.Vector2d | me.Vector3d): me.Vector2d | me.Vector3d;
    /**
     * generate an orthogonal projection matrix, with the result replacing the current matrix
     * <img src="images/glOrtho.gif"/><br>
     * @name ortho
     * @memberOf me.Matrix3d
     * @function
     * @param {number} left farthest left on the x-axis
     * @param {number} right farthest right on the x-axis
     * @param {number} bottom farthest down on the y-axis
     * @param {number} top farthest up on the y-axis
     * @param {number} near distance to the near clipping plane along the -Z axis
     * @param {number} far distance to the far clipping plane along the -Z axis
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): me.Matrix3d;
    /**
     * scale the matrix
     * @name scale
     * @memberOf me.Matrix3d
     * @function
     * @param {number} x a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] a number representing the ordinate of the scaling vector.
     * @param {number} [z=0] a number representing the depth vector
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number, z?: number): me.Matrix3d;
    /**
     * adds a 2D scaling transformation.
     * @name scaleV
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v scaling vector
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d | me.Vector3d): me.Matrix3d;
    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @name scaleX
     * @memberOf me.Matrix3d
     * @function
     * @param {number} x x scaling vector
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    scaleX(x: number): me.Matrix3d;
    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @name scaleY
     * @memberOf me.Matrix3d
     * @function
     * @param {number} y y scaling vector
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    scaleY(y: number): me.Matrix3d;
    /**
     * rotate this matrix (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Matrix3d
     * @function
     * @param {number} angle Rotation angle in radians.
     * @param {me.Vector3d} v the axis to rotate around
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    rotate(angle: number, v: me.Vector3d): me.Matrix3d;
    /**
     * translate the matrix position using the given vector
     * @name translate
     * @memberOf me.Matrix3d
     * @function
     * @param {number} x a number representing the abscissa of the vector.
     * @param {number} [y=x] a number representing the ordinate of the vector.
     * @param {number} [z=0] a number representing the depth of the vector
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    /**
     * translate the matrix by a vector on the horizontal and vertical axis
     * @name translateV
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v the vector to translate the matrix by
     * @returns {me.Matrix3d} Reference to this object for method chaining
     */
    translate(...args: any[]): me.Matrix3d;
    /**
     * returns true if the matrix is an identity matrix.
     * @name isIdentity
     * @memberOf me.Matrix3d
     * @function
     * @returns {boolean}
     */
    isIdentity(): boolean;
    /**
     * return true if the two matrices are identical
     * @name equals
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix3d} m the other matrix
     * @returns {boolean} true if both are equals
     */
    equals(m: me.Matrix3d): boolean;
    /**
     * Clone the Matrix
     * @name clone
     * @memberOf me.Matrix3d
     * @function
     * @returns {me.Matrix3d}
     */
    clone(): me.Matrix3d;
    /**
     * return an array representation of this Matrix
     * @name toArray
     * @memberOf me.Matrix3d
     * @function
     * @returns {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Matrix3d
     * @function
     * @returns {string}
     */
    toString(): string;
}
/**
 * @classdesc
 * A NineSliceSprite is similar to a Sprite, but it uses 9-slice scaling to strech its inner area to fit the size of the Renderable,
 * by proportionally scaling a sprite by splitting it in a grid of nine parts (with only parts 1, 3, 7, 9 not being scaled). <br>
 * <img src="images/9-slice-scaling.png"/><br>
 * @see https://en.wikipedia.org/wiki/9-slice_scaling
 * @class NineSliceSprite
 * @extends me.Sprite
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinates of the sprite object
 * @param {number} y the y coordinates of the sprite object
 * @param {object} settings Configuration parameters for the Sprite object
 * @param {number} settings.width the width of the Renderable over which the sprite needs to be stretched
 * @param {number} settings.height the height of the Renderable over which the sprite needs to be stretched
 * @param {me.Renderer.Texture|HTMLImageElement|HTMLCanvasElement|string} settings.image reference to a texture, spritesheet image or to a texture atlas
 * @param {string} [settings.name=""] name of this object
 * @param {string} [settings.region] region name of a specific region to use when using a texture atlas, see {@link me.Renderer.Texture}
 * @param {number} [settings.framewidth] Width of a single frame within the spritesheet
 * @param {number} [settings.frameheight] Height of a single frame within the spritesheet
 * @param {string|me.Color} [settings.tint] a tint to be applied to this sprite
 * @param {number} [settings.flipX] flip the sprite on the horizontal axis
 * @param {number} [settings.flipY] flip the sprite on the vertical axis
 * @param {me.Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
 * @example
 * this.panelSprite = new me.NineSliceSprite(0, 0, {
 *     image : game.texture,
 *     region : "grey_panel",
 *     width : this.width,
 *     height : this.height
 * });
 */
export class NineSliceSprite {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    width: any;
    height: any;
    /**
     * @ignore
     */
    draw(renderer: any): void;
}
/**
 * @classdesc
 * A Vector2d object that provide notification by executing the given callback when the vector is changed.
 * @class ObservableVector2d
 * @extends me.Vector2d
 * @memberOf me
 * @constructor
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 * @param {object} settings additional required parameters
 * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
 * @param {Function} [settings.scope] the value to use as this when calling onUpdate
 */
export class ObservableVector2d {
    constructor(x: number, y: number, settings: any);
    /**
     * @ignore
     */
    onResetEvent(x: number, y: number, settings: any): ObservableVector2d;
    public set x(arg: number);
    /**
     * x value of the vector
     * @public
     * @type {number}
     * @name x
     * @memberOf me.ObservableVector2d
     */
    public get x(): number;
    _x: any;
    public set y(arg: number);
    /**
     * y value of the vector
     * @public
     * @type {number}
     * @name y
     * @memberOf me.ObservableVector2d
     */
    public get y(): number;
    _y: any;
    /** @ignore */
    _set(x: any, y: any): ObservableVector2d;
    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} x x value of the vector
     * @param {number} y y value of the vector
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    setMuted(x: number, y: number): me.ObservableVector2d;
    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Function} fn callback
     * @param {Function} [scope=null] scope
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    setCallback(fn: Function, scope?: Function): me.ObservableVector2d;
    onUpdate: Function;
    scope: Function;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    add(v: me.ObservableVector2d): me.ObservableVector2d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    sub(v: me.ObservableVector2d): me.ObservableVector2d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number): me.ObservableVector2d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    scaleV(v: me.ObservableVector2d): me.ObservableVector2d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    div(n: number): me.ObservableVector2d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    abs(): me.ObservableVector2d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    clamp(low: number, high: number): me.ObservableVector2d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): me.ObservableVector2d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    minV(v: me.ObservableVector2d): me.ObservableVector2d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    maxV(v: me.ObservableVector2d): me.ObservableVector2d;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    floor(): me.ObservableVector2d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    floorSelf(): me.ObservableVector2d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    ceil(): me.ObservableVector2d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    ceilSelf(): me.ObservableVector2d;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    negate(): me.ObservableVector2d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    negateSelf(): me.ObservableVector2d;
    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    copy(v: me.ObservableVector2d): me.ObservableVector2d;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {boolean}
     */
    equals(v: me.ObservableVector2d): boolean;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    perp(): me.ObservableVector2d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.ObservableVector2d;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @returns {number} The dot product.
     */
    dotProduct(v: me.Vector2d | me.ObservableVector2d): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    lerp(v: me.Vector2d | me.ObservableVector2d, alpha: number): me.ObservableVector2d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {number}
     */
    distance(v: me.ObservableVector2d): number;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    clone(): me.ObservableVector2d;
    /**
     * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
     * @name toVector2d
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    toVector2d(): me.Vector2d;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.ObservableVector2d
     * @function
     * @returns {string}
     */
    toString(): string;
}
/**
 * A Vector3d object that provide notification by executing the given callback when the vector is changed.
 * @classdesc
 * @class ObservableVector3d
 * @extends me.Vector3d
 * @memberOf me
 * @constructor
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 * @param {number} [z=0] z value of the vector
 * @param {object} settings additional required parameters
 * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
 * @param {object} [settings.scope] the value to use as this when calling onUpdate
 */
export class ObservableVector3d {
    constructor(x: number, y: number, z: number, settings: any);
    /**
     * @ignore
     */
    onResetEvent(x: number, y: number, z: number, settings: any): ObservableVector3d;
    public set x(arg: number);
    /**
     * x value of the vector
     * @public
     * @type {number}
     * @name x
     * @memberOf me.ObservableVector3d
     */
    public get x(): number;
    _x: any;
    public set y(arg: number);
    /**
     * y value of the vector
     * @public
     * @type {number}
     * @name y
     * @memberOf me.ObservableVector3d
     */
    public get y(): number;
    _y: any;
    public set z(arg: number);
    /**
     * z value of the vector
     * @public
     * @type {number}
     * @name z
     * @memberOf me.ObservableVector3d
     */
    public get z(): number;
    _z: any;
    /**
     * @ignore
     */
    _set(x: any, y: any, z: any): ObservableVector3d;
    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberOf me.ObservableVector3d
     * @function
     * @param {number} x x value of the vector
     * @param {number} y y value of the vector
     * @param {number} [z=0] z value of the vector
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    setMuted(x: number, y: number, z?: number): me.ObservableVector3d;
    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberOf me.ObservableVector3d
     * @function
     * @param {Function} fn callback
     * @param {Function} [scope=null] scope
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    setCallback(fn: Function, scope?: Function): me.ObservableVector3d;
    onUpdate: Function;
    scope: Function;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    add(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): me.ObservableVector3d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    sub(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): me.ObservableVector3d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.ObservableVector3d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @param {number} [z=1]
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number, z?: number): me.ObservableVector3d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): me.ObservableVector3d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.ObservableVector3d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    div(n: number): me.ObservableVector3d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    abs(): me.ObservableVector3d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.ObservableVector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    clamp(low: number, high: number): me.ObservableVector3d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): me.ObservableVector3d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    minV(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): me.ObservableVector3d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    maxV(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): me.ObservableVector3d;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    floor(): me.ObservableVector3d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    floorSelf(): me.ObservableVector3d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    ceil(): me.ObservableVector3d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    ceilSelf(): me.ObservableVector3d;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    negate(): me.ObservableVector3d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    negateSelf(): me.ObservableVector3d;
    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    copy(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): me.ObservableVector3d;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {boolean}
     */
    equals(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): boolean;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    perp(): me.ObservableVector3d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.ObservableVector3d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.ObservableVector3d;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {number} The dot product.
     */
    dotProduct(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector3d|me.ObservableVector3d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    lerp(v: me.Vector3d | me.ObservableVector3d, alpha: number): me.ObservableVector3d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {number}
     */
    distance(v: me.Vector2d | me.Vector3d | me.ObservableVector2d | me.ObservableVector3d): number;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    clone(): me.ObservableVector3d;
    /**
     * return a `me.Vector3d` copy of this `me.ObservableVector3d` object
     * @name toVector3d
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    toVector3d(): me.Vector3d;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.ObservableVector3d
     * @function
     * @returns {string}
     */
    toString(): string;
}
/**
 * @classdesc
 * Single Particle Object.
 * @class Particle
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {me.ParticleEmitter} particle emitter
 */
export class Particle {
    /**
     * @ignore
     */
    constructor(emitter: any);
    vel: Vector2d;
    onResetEvent(emitter: any, newInstance?: boolean): void;
    alwaysUpdate: boolean;
    image: any;
    life: any;
    startLife: any;
    startScale: number;
    endScale: number;
    gravity: any;
    wind: any;
    followTrajectory: any;
    onlyInViewport: any;
    _deltaInv: number;
    angle: number;
    /**
     * Update the Particle <br>
     * This is automatically called by the game manager {@link me.game}
     * @name update
     * @memberOf me.Particle
     * @function
     * @ignore
     * @param {number} dt time since the last update in milliseconds
     */
    update(dt: number): boolean;
    alpha: number;
    /**
     * @ignore
     */
    preDraw(renderer: any): void;
    /**
     * @ignore
     */
    draw(renderer: any): void;
}
/**
 * Particle Emitter Object.
 * @class
 * @extends Rect
 * @memberOf me
 * @constructor
 * @param {number} x x-position of the particle emitter
 * @param {number} y y-position of the particle emitter
 * @param {object} settings An object containing the settings for the particle emitter. See {@link me.ParticleEmitterSettings}
 * @example
 * // Create a basic emitter at position 100, 100
 * var emitter = new me.ParticleEmitter(100, 100);
 *
 * // Adjust the emitter properties
 * emitter.totalParticles = 200;
 * emitter.minLife = 1000;
 * emitter.maxLife = 3000;
 * emitter.z = 10;
 *
 * // Add the emitter to the game world
 * me.game.world.addChild(emitter);
 *
 * // Launch all particles one time and stop, like a explosion
 * emitter.burstParticles();
 *
 * // Launch constantly the particles, like a fountain
 * emitter.streamParticles();
 *
 * // At the end, remove emitter from the game world
 * // call this in onDestroyEvent function
 * me.game.world.removeChild(emitter);
 */
export class ParticleEmitter extends Rect {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    /** @ignore */
    _stream: boolean;
    /** @ignore */
    _frequencyTimer: number;
    /** @ignore */
    _durationTimer: number;
    /** @ignore */
    _enabled: boolean;
    alwaysUpdate: boolean;
    autoSort: boolean;
    container: ParticleContainer;
    /**
     * @ignore
     */
    onActivateEvent(): void;
    /**
     * @ignore
     */
    onDeactivateEvent(): void;
    /**
     * @ignore
     */
    destroy(): void;
    /**
     * returns a random point inside the bounds x axis of this emitter
     * @name getRandomPointX
     * @memberOf me.ParticleEmitter
     * @function
     * @returns {number}
     */
    getRandomPointX(): number;
    /**
     * returns a random point inside the bounds y axis of this emitter
     * @name getRandomPointY
     * @memberOf me.ParticleEmitter
     * @function
     * @returns {number}
     */
    getRandomPointY(): number;
    /**
     * Reset the emitter with default values.<br>
     * @function
     * @param {object} settings [optional] object with emitter settings. See {@link me.ParticleEmitterSettings}
     * @name reset
     * @memberOf me.ParticleEmitter
     */
    reset(settings: object): void;
    /** @ignore */
    addParticles(count: any): void;
    /**
     * Emitter is of type stream and is launching particles <br>
     * @function
     * @returns {boolean} Emitter is Stream and is launching particles
     * @name isRunning
     * @memberOf me.ParticleEmitter
     */
    isRunning(): boolean;
    /**
     * Launch particles from emitter constantly <br>
     * Particles example: Fountains
     * @param {number} duration [optional] time that the emitter releases particles in ms
     * @function
     * @name streamParticles
     * @memberOf me.ParticleEmitter
     */
    streamParticles(duration: number): void;
    frequency: any;
    /**
     * Stop the emitter from generating new particles (used only if emitter is Stream) <br>
     * @function
     * @name stopStream
     * @memberOf me.ParticleEmitter
     */
    stopStream(): void;
    /**
     * Launch all particles from emitter and stop <br>
     * Particles example: Explosions <br>
     * @param {number} total [optional] number of particles to launch
     * @function
     * @name burstParticles
     * @memberOf me.ParticleEmitter
     */
    burstParticles(total: number): void;
    /**
     * @ignore
     */
    update(dt: any): boolean;
}
export namespace ParticleEmitterSettings {
    export const width: number;
    export const height: number;
    export { pixel as image };
    export const totalParticles: number;
    export const angle: number;
    export const angleVariation: number;
    export const minLife: number;
    export const maxLife: number;
    export const speed: number;
    export const speedVariation: number;
    export const minRotation: number;
    export const maxRotation: number;
    export const minStartScale: number;
    export const maxStartScale: number;
    export const minEndScale: number;
    export const maxEndScale: number;
    export const gravity: number;
    export const wind: number;
    export const followTrajectory: boolean;
    export const textureAdditive: boolean;
    export const onlyInViewport: boolean;
    export const floating: boolean;
    export const maxParticles: number;
    export const frequency: number;
    export const duration: number;
    export const framesToSkip: number;
}
/**
 * @classdesc
 * a pointer object, representing a single finger on a touch enabled device.
 * @class Pointer
 * @extends me.Bounds
 * @memberOf me
 * @constructor
 */
export class Pointer {
    /**
     * @ignore
     */
    constructor(x?: number, y?: number, w?: number, h?: number);
    /**
     * constant for left button
     * @public
     * @type {number}
     * @name LEFT
     * @memberOf me.Pointer
     */
    public LEFT: number;
    /**
     * constant for middle button
     * @public
     * @type {number}
     * @name MIDDLE
     * @memberOf me.Pointer
     */
    public MIDDLE: number;
    /**
     * constant for right button
     * @public
     * @type {number}
     * @name RIGHT
     * @memberOf me.Pointer
     */
    public RIGHT: number;
    /**
     * the originating Event Object
     * @public
     * @type {PointerEvent|TouchEvent|MouseEvent}
     * @name event
     * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
     * @see https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
     * @memberOf me.Pointer
     */
    public event: PointerEvent | TouchEvent | MouseEvent;
    /**
     * a string containing the event's type.
     * @public
     * @type {string}
     * @name type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Event/type
     * @memberOf me.Pointer
     */
    public type: string;
    /**
     * the button property indicates which button was pressed on the mouse to trigger the event.
     * @public
     * @type {number}
     * @name button
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
     * @memberOf me.Pointer
     */
    public button: number;
    /**
     * indicates whether or not the pointer device that created the event is the primary pointer.
     * @public
     * @type {boolean}
     * @name isPrimary
     * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
     * @memberOf me.Pointer
     */
    public isPrimary: boolean;
    /**
     * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
     * @public
     * @type {number}
     * @name pageX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX
     * @memberOf me.Pointer
     */
    public pageX: number;
    /**
     * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
     * @public
     * @type {number}
     * @name pageY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY
     * @memberOf me.Pointer
     */
    public pageY: number;
    /**
     * the horizontal coordinate within the application's client area at which the event occurred
     * @public
     * @type {number}
     * @name clientX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
     * @memberOf me.Pointer
     */
    public clientX: number;
    /**
     * the vertical coordinate within the application's client area at which the event occurred
     * @public
     * @type {number}
     * @name clientY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
     * @memberOf me.Pointer
     */
    public clientY: number;
    /**
     * an unsigned long representing the unit of the delta values scroll amount
     * @public
     * @type {number}
     * @name deltaMode
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
     * @memberOf me.Pointer
     */
    public deltaMode: number;
    /**
     * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
     * @public
     * @type {number}
     * @name deltaX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX
     * @memberOf me.Pointer
     */
    public deltaX: number;
    /**
     * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
     * @public
     * @type {number}
     * @name deltaY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
     * @memberOf me.Pointer
     */
    public deltaY: number;
    /**
     * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
     * @public
     * @type {number}
     * @name deltaZ
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ
     * @memberOf me.Pointer
     */
    public deltaZ: number;
    /**
     * Event normalized X coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @public
     * @type {number}
     * @name gameX
     * @memberOf me.Pointer
     */
    public gameX: number;
    /**
     * Event normalized Y coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @public
     * @type {number}
     * @name gameY
     * @memberOf me.Pointer
     */
    public gameY: number;
    /**
     * Event X coordinate relative to the viewport
     * @public
     * @type {number}
     * @name gameScreenX
     * @memberOf me.Pointer
     */
    public gameScreenX: number;
    /**
     * Event Y coordinate relative to the viewport
     * @public
     * @type {number}
     * @name gameScreenY
     * @memberOf me.Pointer
     */
    public gameScreenY: number;
    /**
     * Event X coordinate relative to the map
     * @public
     * @type {number}
     * @name gameWorldX
     * @memberOf me.Pointer
     */
    public gameWorldX: number;
    /**
     * Event Y coordinate relative to the map
     * @public
     * @type {number}
     * @name gameWorldY
     * @memberOf me.Pointer
     */
    public gameWorldY: number;
    /**
     * Event X coordinate relative to the holding container
     * @public
     * @type {number}
     * @name gameLocalX
     * @memberOf me.Pointer
     */
    public gameLocalX: number;
    /**
     * Event Y coordinate relative to the holding container
     * @public
     * @type {number}
     * @name gameLocalY
     * @memberOf me.Pointer
     */
    public gameLocalY: number;
    /**
     * The unique identifier of the contact for a touch, mouse or pen
     * @public
     * @type {number}
     * @name pointerId
     * @memberOf me.Pointer
     * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
     */
    public pointerId: number;
    /**
     * true if not originally a pointer event
     * @public
     * @type {boolean}
     * @name isNormalized
     * @memberOf me.Pointer
     */
    public isNormalized: boolean;
    bind: number[];
    /**
     * initialize the Pointer object using the given Event Object
     * @name me.Pointer#set
     * @private
     * @function
     * @param {Event} event the original Event object
     * @param {number} [pageX=0] the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {number} [pageY=0] the vertical coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {number} [clientX=0] the horizontal coordinate within the application's client area at which the event occurred
     * @param {number} [clientY=0] the vertical coordinate within the application's client area at which the event occurred
     * @param {number} [pointerId=1] the Pointer, Touch or Mouse event Id (1)
     */
    private setEvent;
    x: any;
    y: any;
    width: any;
    height: any;
}
/**
 * @classdesc
 * a polygon Object.<br>
 * Please do note that melonJS implements a simple Axis-Aligned Boxes collision algorithm, which requires all polygons used for collision to be convex with all vertices defined with clockwise winding.
 * A polygon is convex when all line segments connecting two points in the interior do not cross any edge of the polygon
 * (which means that all angles are less than 180 degrees), as described here below : <br>
 * <center><img src="images/convex_polygon.png"/></center><br>
 * A polygon's `winding` is clockwise iff its vertices (points) are declared turning to the right. The image above shows COUNTERCLOCKWISE winding.
 * @class Polygon
 * @memberOf me
 * @constructor
 * @param {number} x origin point of the Polygon
 * @param {number} y origin point of the Polygon
 * @param {me.Vector2d[]} points array of vector defining the Polygon
 */
export class Polygon {
    constructor(x: any, y: any, points: any);
    /**
     * origin point of the Polygon
     * @public
     * @type {me.Vector2d}
     * @name pos
     * @memberof me.Polygon#
     */
    public pos: me.Vector2d;
    /**
     * The bounding rectangle for this shape
     * @ignore
     * @type {me.Bounds}
     * @name _bounds
     * @memberOf me.Polygon#
     */
    _bounds: me.Bounds;
    /**
     * Array of points defining the Polygon <br>
     * Note: If you manually change `points`, you **must** call `recalc`afterwards so that the changes get applied correctly.
     * @public
     * @type {me.Vector2d[]}
     * @name points
     * @memberOf me.Polygon#
     */
    public points: me.Vector2d[];
    /**
     * The edges here are the direction of the `n`th edge of the polygon, relative to
     * the `n`th point. If you want to draw a given edge from the edge value, you must
     * first translate to the position of the starting point.
     * @ignore
     */
    edges: any[];
    /**
     * a list of indices for all vertices composing this polygon (@see earcut)
     * @ignore
     */
    indices: any[];
    /**
     * The normals here are the direction of the normal for the `n`th edge of the polygon, relative
     * to the position of the `n`th point. If you want to draw an edge normal, you must first
     * translate to the position of the starting point.
     * @ignore
     */
    normals: any[];
    shapeType: string;
    /** @ignore */
    onResetEvent(x: any, y: any, points: any): void;
    /**
     * set new value to the Polygon
     * @name setShape
     * @memberOf me.Polygon.prototype
     * @function
     * @param {number} x position of the Polygon
     * @param {number} y position of the Polygon
     * @param {me.Vector2d[]|number[]} points array of vector or vertice defining the Polygon
     * @returns {me.Polygon} this instance for objecf chaining
     */
    setShape(x: number, y: number, points: me.Vector2d[] | number[]): me.Polygon;
    /**
     * set the vertices defining this Polygon
     * @name setVertices
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Vector2d[]} vertices array of vector or vertice defining the Polygon
     * @returns {me.Polygon} this instance for objecf chaining
     */
    setVertices(vertices: me.Vector2d[]): me.Polygon;
    /**
     * apply the given transformation matrix to this Polygon
     * @name transform
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Matrix2d} m the transformation matrix
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    transform(m: me.Matrix2d): me.Polygon;
    /**
     * apply an isometric projection to this shape
     * @name toIso
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    toIso(): me.Polygon;
    /**
     * apply a 2d projection to this shape
     * @name to2d
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    to2d(): me.Polygon;
    /**
     * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Polygon.prototype
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.Polygon;
    /**
     * Scale this Polygon by the given scalar.
     * @name scale
     * @memberOf me.Polygon.prototype
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    scale(x: number, y?: number): me.Polygon;
    /**
     * Scale this Polygon by the given vector
     * @name scaleV
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d): me.Polygon;
    /**
     * Computes the calculated collision polygon.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @name recalc
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    recalc(): me.Polygon;
    /**
     * returns a list of indices for all triangles defined in this polygon
     * @name getIndices
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {Array} an array of vertex indices for all triangles forming this polygon.
     */
    getIndices(): any[];
    /**
     * Returns true if the vertices composing this polygon form a convex shape (vertices must be in clockwise order).
     * @name isConvex
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {boolean} true if the vertices are convex, false if not, null if not computable
     */
    isConvex(): boolean;
    /**
     * translate the Polygon by the specified offset
     * @name translate
     * @memberOf me.Polygon.prototype
     * @function
     * @param {number} x x offset
     * @param {number} y y offset
     * @returns {me.Polygon} this Polygon
     */
    /**
     * translate the Polygon by the specified vector
     * @name translate
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Vector2d} v vector offset
     * @returns {me.Polygon} Reference to this object for method chaining
     */
    translate(...args: any[]): me.Polygon;
    /**
     * Shifts the Polygon to the given position vector.
     * @name shift
     * @memberOf me.Polygon
     * @function
     * @param {me.Vector2d} position
     */
    /**
     * Shifts the Polygon to the given x, y position.
     * @name shift
     * @memberOf me.Polygon
     * @function
     * @param {number} x
     * @param {number} y
     */
    shift(...args: any[]): void;
    /**
     * Returns true if the polygon contains the given point.
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @name contains
     * @memberOf me.Polygon.prototype
     * @function
     * @param  {me.Vector2d} point
     * @returns {boolean} true if contains
     */
    /**
     * Returns true if the polygon contains the given point. <br>
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @name contains
     * @memberOf me.Polygon.prototype
     * @function
     * @param  {number} x x coordinate
     * @param  {number} y y coordinate
     * @returns {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @name getBounds
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {me.Bounds} this shape bounding box Rectangle object
     */
    getBounds(): me.Bounds;
    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds(): me.Bounds;
    /**
     * clone this Polygon
     * @name clone
     * @memberOf me.Polygon.prototype
     * @function
     * @returns {me.Polygon} new Polygon
     */
    clone(): me.Polygon;
}
/**
 * @classdesc
 * a QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
 * @class
 * @name QuadTree
 * @memberOf me
 * @constructor
 * @see me.game.world.broadphase
 * @param {me.Bounds} bounds bounds of the node
 * @param {number} [max_objects=4] max objects a node can hold before splitting into 4 subnodes
 * @param {number} [max_levels=4] total max levels inside root Quadtree
 * @param {number} [level] deepth level, required for subnodes
 */
export class QuadTree {
    constructor(bounds: any, max_objects?: number, max_levels?: number, level?: number);
    max_objects: number;
    max_levels: number;
    level: number;
    bounds: any;
    objects: any[];
    nodes: any[];
    split(): void;
    getIndex(item: any): number;
    /**
     * Insert the given object container into the node.
     * @name insertContainer
     * @memberOf me.QuadTree
     * @function
     * @param {me.Container} container group of objects to be added
     */
    insertContainer(container: me.Container): void;
    /**
     * Insert the given object into the node. If the node
     * exceeds the capacity, it will split and add all
     * objects to their corresponding subnodes.
     * @name insert
     * @memberOf me.QuadTree
     * @function
     * @param {object} item object to be added
     */
    insert(item: object): void;
    /**
     * Return all objects that could collide with the given object
     * @name retrieve
     * @memberOf me.QuadTree
     * @function
     * @param {object} item object to be checked against
     * @param {object} [fn] a sorting function for the returned array
     * @returns {object[]} array with all detected objects
     */
    retrieve(item: object, fn?: object): object[];
    /**
     * Remove the given item from the quadtree.
     * (this function won't recalculate the impacted node)
     * @name remove
     * @memberOf me.QuadTree
     * @function
     * @param {object} item object to be removed
     * @returns {boolean} true if the item was found and removed.
     */
    remove(item: object): boolean;
    /**
     * return true if the node is prunable
     * @name isPrunable
     * @memberOf me.QuadTree
     * @function
     * @returns {boolean} true if the node is prunable
     */
    isPrunable(): boolean;
    /**
     * return true if the node has any children
     * @name hasChildren
     * @memberOf me.QuadTree
     * @function
     * @returns {boolean} true if the node has any children
     */
    hasChildren(): boolean;
    /**
     * clear the quadtree
     * @name clear
     * @memberOf me.QuadTree
     * @function
     * @param {me.Bounds} [bounds=this.bounds] the bounds to be cleared
     */
    clear(bounds?: me.Bounds): void;
}
/**
 * @classdesc
 * a rectangle Object
 * @class Rect
 * @extends me.Polygon
 * @memberOf me
 * @constructor
 * @param {number} x position of the Rectangle
 * @param {number} y position of the Rectangle
 * @param {number} w width of the rectangle
 * @param {number} h height of the rectangle
 */
export class Rect {
    constructor(x: any, y: any, w: any, h: any);
    shapeType: string;
    /** @ignore */
    onResetEvent(x: any, y: any, w: any, h: any): void;
    /**
     * set new value to the rectangle shape
     * @name setShape
     * @memberOf me.Rect.prototype
     * @function
     * @param {number} x position of the Rectangle
     * @param {number} y position of the Rectangle
     * @param {number|me.Vector2d[]} w width of the rectangle, or an array of vector defining the rectangle
     * @param {number} [h] height of the rectangle, if a numeral width parameter is specified
     * @returns {me.Rect} this rectangle
     */
    setShape(x: number, y: number, w: number | me.Vector2d[], h?: number, ...args: any[]): me.Rect;
    /**
     * left coordinate of the Rectangle
     * @public
     * @type {number}
     * @name left
     * @memberOf me.Rect
     */
    public get left(): number;
    /**
     * right coordinate of the Rectangle
     * @public
     * @type {number}
     * @name right
     * @memberOf me.Rect
     */
    public get right(): number;
    /**
     * top coordinate of the Rectangle
     * @public
     * @type {number}
     * @name top
     * @memberOf me.Rect
     */
    public get top(): number;
    /**
     * bottom coordinate of the Rectangle
     * @public
     * @type {number}
     * @name bottom
     * @memberOf me.Rect
     */
    public get bottom(): number;
    public set width(arg: number);
    /**
     * width of the Rectangle
     * @public
     * @type {number}
     * @name width
     * @memberOf me.Rect
     */
    public get width(): number;
    public set height(arg: number);
    /**
     * height of the Rectangle
     * @public
     * @type {number}
     * @name height
     * @memberOf me.Rect
     */
    public get height(): number;
    public set centerX(arg: number);
    /**
     * absolute center of this rectangle on the horizontal axis
     * @public
     * @type {number}
     * @name centerX
     * @memberOf me.Rect
     */
    public get centerX(): number;
    public set centerY(arg: number);
    /**
     * absolute center of this rectangle on the vertical axis
     * @public
     * @type {number}
     * @name centerY
     * @memberOf me.Rect
     */
    public get centerY(): number;
    /**
     * resize the rectangle
     * @name resize
     * @memberOf me.Rect.prototype
     * @function
     * @param {number} w new width of the rectangle
     * @param {number} h new height of the rectangle
     * @returns {me.Rect} this rectangle
     */
    resize(w: number, h: number): me.Rect;
    /**
     * scale the rectangle
     * @name scale
     * @memberOf me.Rect.prototype
     * @function
     * @param {number} x a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] a number representing the ordinate of the scaling vector.
     * @returns {me.Rect} this rectangle
     */
    scale(x: number, y?: number): me.Rect;
    /**
     * clone this rectangle
     * @name clone
     * @memberOf me.Rect.prototype
     * @function
     * @returns {me.Rect} new rectangle
     */
    clone(): me.Rect;
    /**
     * copy the position and size of the given rectangle into this one
     * @name copy
     * @memberOf me.Rect.prototype
     * @function
     * @param {me.Rect} rect Source rectangle
     * @returns {me.Rect} new rectangle
     */
    copy(rect: me.Rect): me.Rect;
    /**
     * merge this rectangle with another one
     * @name union
     * @memberOf me.Rect.prototype
     * @function
     * @param {me.Rect} rect other rectangle to union with
     * @returns {me.Rect} the union(ed) rectangle
     */
    union(rect: me.Rect): me.Rect;
    /**
     * check if this rectangle is intersecting with the specified one
     * @name overlaps
     * @memberOf me.Rect.prototype
     * @function
     * @param  {me.Rect} rect
     * @returns {boolean} true if overlaps
     */
    overlaps(rect: me.Rect): boolean;
    /**
     * Returns true if the rectangle contains the given rectangle
     * @name contains
     * @memberOf me.Rect.prototype
     * @function
     * @param {me.Rect} rect
     * @returns {boolean} true if contains
     */
    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberOf me.Rect.prototype
     * @function
     * @param  {number} x x coordinate
     * @param  {number} y y coordinate
     * @returns {boolean} true if contains
     */
    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberOf me.Rect
     * @function
     * @param {me.Vector2d} point
     * @returns {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * check if this rectangle is identical to the specified one
     * @name equals
     * @memberOf me.Rect.prototype
     * @function
     * @param  {me.Rect} rect
     * @returns {boolean} true if equals
     */
    equals(rect: me.Rect): boolean;
    /**
     * determines whether all coordinates of this rectangle are finite numbers.
     * @name isFinite
     * @memberOf me.Rect.prototype
     * @function
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite(): boolean;
    /**
     * Returns a polygon whose edges are the same as this box.
     * @name toPolygon
     * @memberOf me.Rect.prototype
     * @function
     * @returns {me.Polygon} a new Polygon that represents this rectangle.
     */
    toPolygon(): me.Polygon;
}
/**
 * @classdesc
 * A base class for renderable objects.
 * @class Renderable
 * @extends me.Rect
 * @memberOf me
 * @constructor
 * @param {number} x position of the renderable object (accessible through inherited pos.x property)
 * @param {number} y position of the renderable object (accessible through inherited pos.y property)
 * @param {number} width object width
 * @param {number} height object height
 */
export class Renderable {
    /**
     * @ignore
     */
    constructor(x: any, y: any, width: any, height: any);
    /**
     * to identify the object as a renderable object
     * @ignore
     */
    isRenderable: boolean;
    /**
     * If true then physic collision and input events will not impact this renderable
     * @public
     * @type {boolean}
     * @default true
     * @name isKinematic
     * @memberOf me.Renderable
     */
    public isKinematic: boolean;
    /**
     * the renderable physic body
     * @public
     * @type {me.Body}
     * @see me.Body
     * @name body
     * @memberOf me.Renderable#
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
    public body: me.Body;
    currentTransform: any;
    /**
     * (G)ame (U)nique (Id)entifier" <br>
     * a GUID will be allocated for any renderable object added <br>
     * to an object container (including the `me.game.world` container)
     * @public
     * @type {string}
     * @name GUID
     * @memberOf me.Renderable
     */
    public GUID: string;
    /**
     * an event handler that is called when the renderable leave or enter a camera viewport
     * @public
     * @type {Function}
     * @default undefined
     * @name onVisibilityChange
     * @memberOf me.Renderable#
     * @example
     * this.onVisibilityChange = function(inViewport) {
     *     if (inViewport === true) {
     *         console.log("object has entered the in a camera viewport!");
     *     }
     * };
     */
    public onVisibilityChange: Function;
    /**
     * Whether the renderable object will always update, even when outside of the viewport<br>
     * @public
     * @type {boolean}
     * @default false
     * @name alwaysUpdate
     * @memberOf me.Renderable
     */
    public alwaysUpdate: boolean;
    /**
     * Whether to update this object when the game is paused.
     * @public
     * @type {boolean}
     * @default false
     * @name updateWhenPaused
     * @memberOf me.Renderable
     */
    public updateWhenPaused: boolean;
    /**
     * make the renderable object persistent over level changes<br>
     * @public
     * @type {boolean}
     * @default false
     * @name isPersistent
     * @memberOf me.Renderable
     */
    public isPersistent: boolean;
    /**
     * If true, this renderable will be rendered using screen coordinates,
     * as opposed to world coordinates. Use this, for example, to define UI elements.
     * @public
     * @type {boolean}
     * @default false
     * @name floating
     * @memberOf me.Renderable
     */
    public floating: boolean;
    anchorPoint: any;
    /**
     * When enabled, an object container will automatically apply
     * any defined transformation before calling the child draw method.
     * @public
     * @type {boolean}
     * @default true
     * @name autoTransform
     * @memberOf me.Renderable
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
    public autoTransform: boolean;
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
    public alpha: number;
    /**
     * a reference to the parent object that contains this renderable
     * @public
     * @type {me.Container|me.Entity}
     * @default undefined
     * @name me.Renderable#ancestor
     */
    public ancestor: me.Container | me.Entity;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * @public
     * @type {me.Rect|me.Polygon|me.Line|me.Ellipse}
     * @name mask
     * @default undefined
     * @memberOf me.Renderable#
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
    public mask: me.Rect | me.Polygon | me.Line | me.Ellipse;
    /**
     * define a tint for this renderable. a (255, 255, 255) r, g, b value will remove the tint effect.
     * @public
     * @type {me.Color}
     * @name tint
     * @default (255, 255, 255)
     * @memberOf me.Renderable#
     * @example
     * // add a red tint to this renderable
     * this.tint.setColor(255, 128, 128);
     * // remove the tint
     * this.tint.setColor(255, 255, 255);
     */
    public tint: me.Color;
    /**
     * The name of the renderable
     * @public
     * @type {string}
     * @name name
     * @default ""
     * @memberOf me.Renderable
     */
    public name: string;
    pos: any;
    /**
     * when true the renderable will be redrawn during the next update cycle
     * @type {boolean}
     * @name isDirty
     * @default false
     * @memberOf me.Renderable#
     */
    isDirty: boolean;
    _flip: {
        x: boolean;
        y: boolean;
    };
    _inViewport: boolean;
    /**
     * Whether the renderable object is floating, or contained in a floating container
     * @public
     * @see me.Renderable#floating
     * @readonly
     * @type {boolean}
     * @name isFloating
     * @memberOf me.Renderable
     */
    public readonly get isFloating(): boolean;
    public readonly set inViewport(arg: boolean);
    /**
     * Whether the renderable object is visible and within the viewport
     * @public
     * @readonly
     * @type {boolean}
     * @default false
     * @name inViewport
     * @memberOf me.Renderable
     */
    public readonly get inViewport(): boolean;
    /**
     * returns true if this renderable is flipped on the horizontal axis
     * @public
     * @see me.Renderable#flipX
     * @type {boolean}
     * @name isFlippedX
     * @memberOf me.Renderable
     */
    public get isFlippedX(): boolean;
    /**
     * returns true if this renderable is flipped on the vertical axis
     * @public
     * @see me.Renderable#flipY
     * @type {boolean}
     * @name isFlippedY
     * @memberOf me.Renderable
     */
    public get isFlippedY(): boolean;
    /**
     * returns the bounding box for this renderable
     * @name getBounds
     * @memberOf me.Renderable.prototype
     * @function
     * @returns {me.Bounds} bounding box Rectangle object
     */
    getBounds(): me.Bounds;
    /**
     * get the renderable alpha channel value<br>
     * @name getOpacity
     * @memberOf me.Renderable.prototype
     * @function
     * @returns {number} current opacity value between 0 and 1
     */
    getOpacity(): number;
    /**
     * set the renderable alpha channel value<br>
     * @name setOpacity
     * @memberOf me.Renderable.prototype
     * @function
     * @param {number} alpha opacity value between 0.0 and 1.0
     */
    setOpacity(alpha: number): void;
    /**
     * flip the renderable on the horizontal axis (around the center of the renderable)
     * @see me.Matrix2d#scaleX
     * @name flipX
     * @memberOf me.Renderable.prototype
     * @function
     * @param {boolean} [flip=true] `true` to flip this renderable.
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    flipX(flip?: boolean): me.Renderable;
    /**
     * flip the renderable on the vertical axis (around the center of the renderable)
     * @see me.Matrix2d#scaleY
     * @name flipY
     * @memberOf me.Renderable.prototype
     * @function
     * @param {boolean} [flip=true] `true` to flip this renderable.
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    flipY(flip?: boolean): me.Renderable;
    /**
     * multiply the renderable currentTransform with the given matrix
     * @name transform
     * @memberOf me.Renderable.prototype
     * @see me.Renderable#currentTransform
     * @function
     * @param {me.Matrix2d} m the transformation matrix
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    transform(m: me.Matrix2d): me.Renderable;
    /**
     * return the angle to the specified target
     * @name angleTo
     * @memberOf me.Renderable
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target
     * @returns {number} angle in radians
     */
    angleTo(target: me.Renderable | me.Vector2d | me.Vector3d): number;
    /**
     * return the distance to the specified target
     * @name distanceTo
     * @memberOf me.Renderable
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target
     * @returns {number} distance
     */
    distanceTo(target: me.Renderable | me.Vector2d | me.Vector3d): number;
    /**
     * Rotate this renderable towards the given target.
     * @name lookAt
     * @memberOf me.Renderable.prototype
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target the renderable or position to look at
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    lookAt(target: me.Renderable | me.Vector2d | me.Vector3d): me.Renderable;
    /**
     * Rotate this renderable by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Renderable.prototype
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.Renderable;
    /**
     * scale the renderable around his anchor point.  Scaling actually applies changes
     * to the currentTransform member wich is used by the renderer to scale the object
     * when rendering.  It does not scale the object itself.  For example if the renderable
     * is an image, the image.width and image.height properties are unaltered but the currentTransform
     * member will be changed.
     * @name scale
     * @memberOf me.Renderable.prototype
     * @function
     * @param {number} x a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] a number representing the ordinate of the scaling vector.
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    scale(x: number, y?: number): me.Renderable;
    /**
     * scale the renderable around his anchor point
     * @name scaleV
     * @memberOf me.Renderable.prototype
     * @function
     * @param {me.Vector2d} v scaling vector
     * @returns {me.Renderable} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d): me.Renderable;
    /**
     * update function. <br>
     * automatically called by the game manager {@link me.game}
     * @name update
     * @memberOf me.Renderable.prototype
     * @function
     * @protected
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean} true if the renderable is dirty
     */
    protected update(): boolean;
    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberOf me.Renderable.prototype
     * @function
     * @returns {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds(): me.Bounds;
    /**
     * update the renderable's bounding rect (private)
     * @ignore
     * @name updateBoundsPos
     * @memberOf me.Renderable.prototype
     * @function
     */
    updateBoundsPos(newX: any, newY: any): void;
    /**
     * return the renderable absolute position in the game world
     * @name getAbsolutePosition
     * @memberOf me.Renderable.prototype
     * @function
     * @returns {me.Vector2d}
     */
    getAbsolutePosition(): me.Vector2d;
    _absPos: any;
    /**
     * called when the anchor point value is changed
     * @private
     * @name onAnchorUpdate
     * @memberOf me.Renderable.prototype
     * @function
     * @param {number} x the new X value to be set for the anchor
     * @param {number} y the new Y value to be set for the anchor
     */
    private onAnchorUpdate;
    /**
     * prepare the rendering context before drawing
     * (apply defined transforms, anchor point). <br>
     * automatically called by the game manager {@link me.game}
     * @name preDraw
     * @memberOf me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    protected preDraw(renderer: me.CanvasRenderer | me.WebGLRenderer): void;
    /**
     * object draw. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberOf me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    protected draw(): void;
    /**
     * restore the rendering context after drawing. <br>
     * automatically called by the game manager {@link me.game}
     * @name postDraw
     * @memberOf me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    protected postDraw(renderer: me.CanvasRenderer | me.WebGLRenderer): void;
    /**
     * onCollision callback, triggered in case of collision,
     * when this renderable body is colliding with another one
     * @name onCollision
     * @memberOf me.Renderable.prototype
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
    onCollision(): boolean;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(...args: any[]): void;
    _bounds: any;
    /**
     * OnDestroy Notification function<br>
     * Called by engine before deleting the object
     * @name onDestroyEvent
     * @memberOf me.Renderable
     * @function
     */
    onDestroyEvent(): void;
}
/**
 * @classdesc
 * a base renderer object
 * @class Renderer
 * @memberOf me
 * @constructor
 * @param {object} options The renderer parameters
 * @param {number} options.width The width of the canvas without scaling
 * @param {number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
 * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
 * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {boolean} [options.blendMode="normal"] the default blend mode to use ("normal", "multiply")
 * @param {boolean} [options.subPixel=false] Whether to enable subpixel rendering (performance hit when enabled)
 * @param {boolean} [options.verbose=false] Enable the verbose mode that provides additional details as to what the renderer is doing
 * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
 */
export class Renderer {
    constructor(options: any);
    /**
     * The given constructor options
     * @public
     * @name settings
     * @memberOf me.Renderer#
     * @enum {object}
     */
    public settings: any;
    /**
     * true if the current rendering context is valid
     * @name isContextValid
     * @memberOf me.Renderer
     * @default true
     * type {boolean}
     */
    isContextValid: boolean;
    /**
     * @ignore
     */
    currentScissor: Int32Array;
    /**
     * @ignore
     */
    currentBlendMode: string;
    canvas: any;
    backBufferCanvas: any;
    context: any;
    currentColor: Color;
    currentTint: Color;
    projectionMatrix: Matrix3d;
    uvOffset: number;
    Texture: typeof Texture;
    /**
     * prepare the framebuffer for drawing a new frame
     * @name clear
     * @memberOf me.Renderer.prototype
     * @function
     */
    clear(): void;
    /**
     * Reset context state
     * @name reset
     * @memberOf me.Renderer.prototype
     * @function
     */
    reset(): void;
    /**
     * return a reference to the system canvas
     * @name getCanvas
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {HTMLCanvasElement}
     */
    getCanvas(): HTMLCanvasElement;
    /**
     * return a reference to the screen canvas
     * @name getScreenCanvas
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {HTMLCanvasElement}
     */
    getScreenCanvas(): HTMLCanvasElement;
    /**
     * return a reference to the screen canvas corresponding 2d Context<br>
     * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
     * @name getScreenContext
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {CanvasRenderingContext2D}
     */
    getScreenContext(): CanvasRenderingContext2D;
    /**
     * returns the current blend mode for this renderer
     * @name getBlendMode
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {string} blend mode
     */
    getBlendMode(): string;
    /**
     * Returns the 2D Context object of the given Canvas<br>
     * Also configures anti-aliasing and blend modes based on constructor options.
     * @name getContext2d
     * @memberOf me.Renderer.prototype
     * @function
     * @param {HTMLCanvasElement} canvas
     * @param {boolean} [transparent=true] use false to disable transparency
     * @returns {CanvasRenderingContext2D}
     */
    getContext2d(canvas: HTMLCanvasElement, transparent?: boolean): CanvasRenderingContext2D;
    /**
     * return the width of the system Canvas
     * @name getWidth
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {number}
     */
    getWidth(): number;
    /**
     * return the height of the system Canvas
     * @name getHeight
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {number} height of the system Canvas
     */
    getHeight(): number;
    /**
     * get the current fill & stroke style color.
     * @name getColor
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {me.Color} current global color
     */
    getColor(): me.Color;
    /**
     * return the current global alpha
     * @name globalAlpha
     * @memberOf me.Renderer.prototype
     * @function
     * @returns {number}
     */
    globalAlpha(): number;
    /**
     * check if the given rect or bounds overlaps with the renderer screen coordinates
     * @name overlaps
     * @memberOf me.Renderer.prototype
     * @function
     * @param  {me.Rect|me.Bounds} bounds
     * @returns {boolean} true if overlaps
     */
    overlaps(bounds: me.Rect | me.Bounds): boolean;
    /**
     * resizes the system canvas
     * @name resize
     * @memberOf me.Renderer.prototype
     * @function
     * @param {number} width new width of the canvas
     * @param {number} height new height of the canvas
     */
    resize(width: number, height: number): void;
    /**
     * enable/disable image smoothing (scaling interpolation) for the given context
     * @name setAntiAlias
     * @memberOf me.Renderer.prototype
     * @function
     * @param {CanvasRenderingContext2D} context
     * @param {boolean} [enable=false]
     */
    setAntiAlias(context: CanvasRenderingContext2D, enable?: boolean): void;
    /**
     * set/change the current projection matrix (WebGL only)
     * @name setProjection
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Matrix3d} matrix
     */
    setProjection(matrix: me.Matrix3d): void;
    /**
     * stroke the given shape
     * @name stroke
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to stroke
     * @param {boolean} [fill=false] fill the shape with the current color if true
     */
    stroke(shape: me.Rect | me.Polygon | me.Line | me.Ellipse, fill?: boolean): void;
    /**
     * tint the given image or canvas using the given color
     * @name tint
     * @memberOf me.Renderer.prototype
     * @function
     * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} src the source image to be tinted
     * @param {me.Color|string} color the color that will be used to tint the image
     * @param {string} [mode="multiply"] the composition mode used to tint the image
     * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas element representing the tinted image
     */
    tint(src: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas, color: me.Color | string, mode?: string): HTMLCanvasElement | OffscreenCanvas;
    /**
     * fill the given shape
     * @name fill
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to fill
     */
    fill(shape: me.Rect | me.Polygon | me.Line | me.Ellipse): void;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @name setMask
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
     */
    setMask(mask?: me.Rect | me.Polygon | me.Line | me.Ellipse): void;
    /**
     * disable (remove) the rendering mask set through setMask.
     * @name clearMask
     * @see me.Renderer#setMask
     * @memberOf me.Renderer.prototype
     * @function
     */
    clearMask(): void;
    /**
     * set a coloring tint for sprite based renderables
     * @name setTint
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Color} tint the tint color
     * @param {number} [alpha] an alpha value to be applied to the tint
     */
    setTint(tint: me.Color, alpha?: number): void;
    /**
     * clear the rendering tint set through setTint.
     * @name clearTint
     * @see me.Renderer#setTint
     * @memberOf me.Renderer.prototype
     * @function
     */
    clearTint(): void;
    /**
     * @ignore
     */
    drawFont(): void;
}
/**
 * @classdesc
 * An object to display a fixed or animated sprite on screen.
 * @class Sprite
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinates of the sprite object
 * @param {number} y the y coordinates of the sprite object
 * @param {object} settings Configuration parameters for the Sprite object
 * @param {me.Renderer.Texture|HTMLImageElement|HTMLCanvasElement|string} settings.image reference to a texture, spritesheet image or to a texture atlas
 * @param {string} [settings.name=""] name of this object
 * @param {string} [settings.region] region name of a specific region to use when using a texture atlas, see {@link me.Renderer.Texture}
 * @param {number} [settings.framewidth] Width of a single frame within the spritesheet
 * @param {number} [settings.frameheight] Height of a single frame within the spritesheet
 * @param {string|me.Color} [settings.tint] a tint to be applied to this sprite
 * @param {number} [settings.flipX] flip the sprite on the horizontal axis
 * @param {number} [settings.flipY] flip the sprite on the vertical axis
 * @param {me.Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
 * @example
 * // create a single sprite from a standalone image, with anchor in the center
 * var sprite = new me.Sprite(0, 0, {
 *     image : "PlayerTexture",
 *     framewidth : 64,
 *     frameheight : 64,
 *     anchorPoint : new me.Vector2d(0.5, 0.5)
 * });
 *
 * // create a single sprite from a packed texture
 * game.texture = new me.video.renderer.Texture(
 *     me.loader.getJSON("texture"),
 *     me.loader.getImage("texture")
 * );
 * var sprite = new me.Sprite(0, 0, {
 *     image : game.texture,
 *     region : "npc2.png",
 * });
 */
export class Sprite {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    /**
     * pause and resume animation
     * @public
     * @type {boolean}
     * @default false
     * @name me.Sprite#animationpause
     */
    public animationpause: boolean;
    /**
     * animation cycling speed (delay between frame in ms)
     * @public
     * @type {number}
     * @default 100
     * @name me.Sprite#animationspeed
     */
    public animationspeed: number;
    /**
     * global offset for the position to draw from on the source image.
     * @public
     * @type {me.Vector2d}
     * @default <0.0,0.0>
     * @name offset
     * @memberOf me.Sprite#
     */
    public offset: me.Vector2d;
    /**
     * The source texture object this sprite object is using
     * @public
     * @type {me.Renderer.Texture}
     * @name source
     * @memberOf me.Sprite#
     */
    public source: me.Renderer.Texture;
    anim: {};
    resetAnim: any;
    current: {
        name: string;
        length: number;
        offset: Vector2d;
        width: number;
        height: number;
        angle: number;
        idx: number;
    };
    dt: number;
    _flicker: {
        isFlickering: boolean;
        duration: number;
        callback: any;
        state: boolean;
    };
    image: any;
    textureAtlas: any;
    atlasIndices: any;
    width: number;
    height: number;
    name: any;
    autoTransform: boolean;
    /**
     * return the flickering state of the object
     * @name isFlickering
     * @memberOf me.Sprite.prototype
     * @function
     * @returns {boolean}
     */
    isFlickering(): boolean;
    /**
     * make the object flicker
     * @name flicker
     * @memberOf me.Sprite.prototype
     * @function
     * @param {number} duration expressed in milliseconds
     * @param {Function} callback Function to call when flickering ends
     * @returns {me.Sprite} Reference to this object for method chaining
     * @example
     * // make the object flicker for 1 second
     * // and then remove it
     * this.flicker(1000, function () {
     *     me.game.world.removeChild(this);
     * });
     */
    flicker(duration: number, callback: Function): me.Sprite;
    /**
     * add an animation <br>
     * For fixed-sized cell sprite sheet, the index list must follow the
     * logic as per the following example :<br>
     * <img src="images/spritesheet_grid.png"/>
     * @name addAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {string} name animation id
     * @param {number[]|string[]|object[]} index list of sprite index or name
     * defining the animation. Can also use objects to specify delay for each frame, see below
     * @param {number} [animationspeed] cycling speed for animation in ms
     * @returns {number} frame amount of frame added to the animation (delay between each frame).
     * @see me.Sprite#animationspeed
     * @example
     * // walking animation
     * this.addAnimation("walk", [ 0, 1, 2, 3, 4, 5 ]);
     * // standing animation
     * this.addAnimation("stand", [ 11, 12 ]);
     * // eating animation
     * this.addAnimation("eat", [ 6, 6 ]);
     * // rolling animation
     * this.addAnimation("roll", [ 7, 8, 9, 10 ]);
     * // slower animation
     * this.addAnimation("roll", [ 7, 8, 9, 10 ], 200);
     * // or get more specific with delay for each frame. Good solution instead of repeating:
     * this.addAnimation("turn", [{ name: 0, delay: 200 }, { name: 1, delay: 100 }])
     * // can do this with atlas values as well:
     * this.addAnimation("turn", [{ name: "turnone", delay: 200 }, { name: "turntwo", delay: 100 }])
     * // define an dying animation that stop on the last frame
     * this.addAnimation("die", [{ name: 3, delay: 200 }, { name: 4, delay: 100 }, { name: 5, delay: Infinity }])
     * // set the standing animation as default
     * this.setCurrentAnimation("stand");
     */
    addAnimation(name: string, index: number[] | string[] | object[], animationspeed?: number): number;
    /**
     * set the current animation
     * this will always change the animation & set the frame to zero
     * @name setCurrentAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {string} name animation id
     * @param {string|Function} [resetAnim] animation id to switch to when complete, or callback
     * @param {boolean} [preserve_dt=false] if false will reset the elapsed time counter since last frame
     * @returns {me.Sprite} Reference to this object for method chaining
     * @example
     * // set "walk" animation
     * this.setCurrentAnimation("walk");
     *
     * // set "walk" animation if it is not the current animation
     * if (this.isCurrentAnimation("walk")) {
     *     this.setCurrentAnimation("walk");
     * }
     *
     * // set "eat" animation, and switch to "walk" when complete
     * this.setCurrentAnimation("eat", "walk");
     *
     * // set "die" animation, and remove the object when finished
     * this.setCurrentAnimation("die", (function () {
     *    me.game.world.removeChild(this);
     *    return false; // do not reset to first frame
     * }).bind(this));
     *
     * // set "attack" animation, and pause for a short duration
     * this.setCurrentAnimation("die", (function () {
     *    this.animationpause = true;
     *
     *    // back to "standing" animation after 1 second
     *    setTimeout(function () {
     *        this.setCurrentAnimation("standing");
     *    }, 1000);
     *
     *    return false; // do not reset to first frame
     * }).bind(this));
     */
    setCurrentAnimation(name: string, resetAnim?: string | Function, preserve_dt?: boolean): me.Sprite;
    isDirty: boolean;
    /**
     * reverse the given or current animation if none is specified
     * @name reverseAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {string} [name] animation id
     * @returns {me.Sprite} Reference to this object for method chaining
     * @see me.Sprite#animationspeed
     */
    reverseAnimation(name?: string): me.Sprite;
    /**
     * return true if the specified animation is the current one.
     * @name isCurrentAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {string} name animation id
     * @returns {boolean}
     * @example
     * if (!this.isCurrentAnimation("walk")) {
     *     // do something funny...
     * }
     */
    isCurrentAnimation(name: string): boolean;
    /**
     * change the current texture atlas region for this sprite
     * @see me.Texture.getRegion
     * @name setRegion
     * @memberOf me.Sprite.prototype
     * @function
     * @param {object} region typically returned through me.Texture.getRegion()
     * @returns {me.Sprite} Reference to this object for method chaining
     * @example
     * // change the sprite to "shadedDark13.png";
     * mySprite.setRegion(game.texture.getRegion("shadedDark13.png"));
     */
    setRegion(region: object): me.Sprite;
    /**
     * force the current animation frame index.
     * @name setAnimationFrame
     * @memberOf me.Sprite.prototype
     * @function
     * @param {number} [idx=0] animation frame index
     * @returns {me.Sprite} Reference to this object for method chaining
     * @example
     * // reset the current animation to the first frame
     * this.setAnimationFrame();
     */
    setAnimationFrame(idx?: number): me.Sprite;
    /**
     * return the current animation frame index.
     * @name getCurrentAnimationFrame
     * @memberOf me.Sprite.prototype
     * @function
     * @returns {number} current animation frame index
     */
    getCurrentAnimationFrame(): number;
    /**
     * Returns the frame object by the index.
     * @name getAnimationFrameObjectByIndex
     * @memberOf me.Sprite.prototype
     * @function
     * @ignore
     * @param {number} id the frame id
     * @returns {number} if using number indices. Returns {object} containing frame data if using texture atlas
     */
    getAnimationFrameObjectByIndex(id: number): number;
    /**
     * update function. <br>
     * automatically called by the game manager {@link me.game}
     * @name update
     * @memberOf me.Sprite.prototype
     * @function
     * @protected
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean} true if the Sprite is dirty
     */
    protected update(dt: number): boolean;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(): void;
    /**
     * sprite draw. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberOf me.Sprite.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    protected draw(renderer: me.CanvasRenderer | me.WebGLRenderer): void;
}
/**
 * @classdesc
 * a default "Stage" object.
 * every "stage" object (title screen, credits, ingame, etc...) to be managed
 * through the state manager must inherit from this base class.
 * @class Stage
 * @extends me.Object
 * @memberOf me
 * @constructor
 * @param {object} [options] The stage` parameters
 * @param {me.Camera2d[]} [options.cameras=[new me.Camera2d()]] a list of cameras (experimental)
 * @param {Function} [options.onResetEvent] called by the state manager when reseting the object
 * @param {Function} [options.onDestroyEvent] called by the state manager before switching to another state
 * @see me.state
 */
export class Stage {
    /**
     * @ignore
     */
    constructor(settings: any);
    /**
     * The list of active cameras in this stage.
     * Cameras will be renderered based on this order defined in this list.
     * Only the "default" camera will be resized when the window or canvas is resized.
     * @public
     * @type {Map}
     * @name cameras
     * @memberOf me.Stage
     */
    public cameras: Map<any, any>;
    /**
     * The given constructor options
     * @public
     * @name settings
     * @memberOf me.Stage
     * @type {object}
     */
    public settings: object;
    /**
     * Object reset function
     * @ignore
     */
    reset(...args: any[]): void;
    /**
     * update function
     * @name update
     * @memberOf me.Stage
     * @ignore
     * @function
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean}
     */
    update(dt: number): boolean;
    /**
     * draw the current stage
     * @name draw
     * @memberOf me.Stage
     * @ignore
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    draw(renderer: me.CanvasRenderer | me.WebGLRenderer): void;
    /**
     * destroy function
     * @ignore
     */
    destroy(...args: any[]): void;
    /**
     * onResetEvent function<br>
     * called by the state manager when reseting the object
     * this is typically where you will load a level, add renderables, etc...
     * @name onResetEvent
     * @memberOf me.Stage
     * @function
     * @param {object} [...arguments] optional arguments passed when switching state
     * @see me.state#change
     */
    onResetEvent(...args: any[]): void;
    /**
     * onDestroyEvent function<br>
     * called by the state manager before switching to another state
     * @name onDestroyEvent
     * @memberOf me.Stage
     * @function
     */
    onDestroyEvent(...args: any[]): void;
}
/**
 * @classdesc
 * an Hexagonal Map Renderder
 * @class TMXHexagonalRenderer
 * @memberOf me
 * @extends me.TMXRenderer
 * @constructor
 * @param {me.TMXTileMap} map the TMX map
 */
export class TMXHexagonalRenderer {
    constructor(map: any);
    hexsidelength: any;
    staggerX: boolean;
    staggerEven: boolean;
    sidelengthx: any;
    sidelengthy: any;
    sideoffsetx: number;
    sideoffsety: number;
    columnwidth: any;
    rowheight: any;
    centers: Vector2d[];
    /**
     * return true if the renderer can render the specified layer
     * @ignore
     */
    canRender(layer: any): any;
    /**
     * return the bounding rect for this map renderer
     * @name me.TMXHexagonalRenderer#getBounds
     * @public
     * @function
     * @param {me.TMXLayer} [layer] calculate the bounding rect for a specific layer (will return a new bounds object)
     * @returns {me.Bounds}
     */
    public getBounds(layer?: me.TMXLayer): me.Bounds;
    /**
     * @ignore
     */
    doStaggerX(x: any): number;
    /**
     * @ignore
     */
    doStaggerY(y: any): number;
    /**
     * @ignore
     */
    topLeft(x: any, y: any, v: any): any;
    /**
     * @ignore
     */
    topRight(x: any, y: any, v: any): any;
    /**
     * @ignore
     */
    bottomLeft(x: any, y: any, v: any): any;
    /**
     * @ignore
     */
    bottomRight(x: any, y: any, v: any): any;
    /**
     * return the tile position corresponding to the specified pixel
     * @ignore
     */
    pixelToTileCoords(x: any, y: any, v: any): any;
    /**
     * return the pixel position corresponding of the specified tile
     * @ignore
     */
    tileToPixelCoords(x: any, y: any, v: any): any;
    /**
     * fix the position of Objects to match
     * the way Tiled places them
     * @ignore
     */
    adjustPosition(obj: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTile(renderer: any, x: any, y: any, tmxTile: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTileLayer(renderer: any, layer: any, rect: any): void;
}
/**
 * @classdesc
 * an Isometric Map Renderder
 * @class TMXIsometricRenderer
 * @memberOf me
 * @extends me.TMXRenderer
 * @constructor
 * @param {me.TMXTileMap} map the TMX map
 */
export class TMXIsometricRenderer {
    constructor(map: any);
    hTilewidth: number;
    hTileheight: number;
    originX: number;
    /**
     * return true if the renderer can render the specified layer
     * @ignore
     */
    canRender(layer: any): any;
    /**
     * return the bounding rect for this map renderer
     * @name me.TMXIsometricRenderer#getBounds
     * @public
     * @function
     * @param {me.TMXLayer} [layer] calculate the bounding rect for a specific layer (will return a new bounds object)
     * @returns {me.Bounds}
     */
    public getBounds(layer?: me.TMXLayer): me.Bounds;
    /**
     * return the tile position corresponding to the specified pixel
     * @ignore
     */
    pixelToTileCoords(x: any, y: any, v: any): any;
    /**
     * return the pixel position corresponding of the specified tile
     * @ignore
     */
    tileToPixelCoords(x: any, y: any, v: any): any;
    /**
     * fix the position of Objects to match
     * the way Tiled places them
     * @ignore
     */
    adjustPosition(obj: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTile(renderer: any, x: any, y: any, tmxTile: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTileLayer(renderer: any, layer: any, rect: any): void;
}
/**
 * a TMX Tile Layer Object
 * Tiled QT 0.7.x format
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {object} map layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
 * @param {object} data layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
 * @param {number} tilewidth width of each tile in pixels
 * @param {number} tileheight height of each tile in pixels
 * @param {string} orientation "isometric" or "orthogonal"
 * @param {me.TMXTilesetGroup} tilesets tileset as defined in Tiled
 * @param {number} z z-index position
 */
export class TMXLayer {
    /**
     * @ignore
     */
    constructor(map: any, data: any, tilewidth: any, tileheight: any, orientation: any, tilesets: any, z: any);
    tilewidth: any;
    tileheight: any;
    orientation: any;
    /**
     * The Layer corresponding Tilesets
     * @public
     * @type {me.TMXTilesetGroup}
     * @name me.TMXLayer#tilesets
     */
    public tilesets: me.TMXTilesetGroup;
    tileset: any;
    maxTileSize: {
        width: number;
        height: number;
    };
    /**
     * All animated tilesets in this layer
     * @ignore
     * @type {me.TMXTileset[]}
     * @name me.TMXLayer#animatedTilesets
     */
    animatedTilesets: me.TMXTileset[];
    /**
     * Layer contains tileset animations
     * @public
     * @type {boolean}
     * @name me.TMXLayer#isAnimated
     */
    public isAnimated: boolean;
    /**
     * the order in which tiles on orthogonal tile layers are rendered.
     * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @public
     * @type {string}
     * @default "right-down"
     * @name me.TMXLayer#renderorder
     */
    public renderorder: string;
    name: any;
    cols: number;
    rows: number;
    width: number;
    height: number;
    preRender: any;
    onActivateEvent(): void;
    canvasRenderer: CanvasRenderer;
    onDeactivateEvent(): void;
    /**
     * Set the TMX renderer for this layer object
     * @name setRenderer
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {me.TMXRenderer} renderer
     * @example
     * // use the parent map default renderer
     * var layer = new me.TMXLayer(...);
     * layer.setRenderer(map.getRenderer());
     */
    public setRenderer(renderer: me.TMXRenderer): void;
    renderer: me.TMXRenderer;
    /**
     * Return the layer current renderer object
     * @name getRenderer
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @returns {me.TMXRenderer} renderer
     */
    public getRenderer(): me.TMXRenderer;
    /**
     * Return the TileId of the Tile at the specified position
     * @name getTileId
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {number} x X coordinate (in world/pixels coordinates)
     * @param {number} y Y coordinate (in world/pixels coordinates)
     * @returns {number} TileId or null if there is no Tile at the given position
     */
    public getTileId(x: number, y: number): number;
    /**
     * Return the Tile object at the specified position
     * @name getTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {number} x X coordinate (in world/pixels coordinates)
     * @param {number} y Y coordinate (in world/pixels coordinates)
     * @returns {me.Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
     * @example
     * // get the TMX Map Layer called "Front layer"
     * var layer = me.game.world.getChildByName("Front Layer")[0];
     * // get the tile object corresponding to the latest pointer position
     * var tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
     */
    public getTile(x: number, y: number): me.Tile;
    /**
     * assign the given Tile object to the specified position
     * @name getTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {me.Tile} tile the tile object to be assigned
     * @param {number} x x coordinate (in world/pixels coordinates)
     * @param {number} y y coordinate (in world/pixels coordinates)
     * @returns {me.Tile} the tile object
     */
    public setTile(tile: me.Tile, x: number, y: number): me.Tile;
    /**
     * return a new the Tile object corresponding to the given tile id
     * @name setTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {number} tileId tileId
     * @param {number} x X coordinate (in world/pixels coordinates)
     * @param {number} y Y coordinate (in world/pixels coordinates)
     * @returns {me.Tile} the tile object
     */
    public getTileById(tileId: number, x: number, y: number): me.Tile;
    /**
     * Return the Tile object at the specified tile coordinates
     * @name cellAt
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {number} x x position of the tile (in Tile unit)
     * @param {number} y x position of the tile (in Tile unit)
     * @param {number} [boundsCheck=true] check first if within the layer bounds
     * @returns {me.Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
     * @example
     * // return the first tile at offset 0, 0
     * var tile = layer.cellAt(0, 0);
     */
    public cellAt(x: number, y: number, boundsCheck?: number): me.Tile;
    /**
     * clear the tile at the specified position
     * @name clearTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {number} x X coordinate (in map coordinates: row/column)
     * @param {number} y Y coordinate (in map coordinates: row/column)
     * @example
     * me.game.world.getChildByType(me.TMXLayer).forEach(function(layer) {
     *     // clear all tiles at the given x,y coordinates
     *     layer.clearTile(x, y);
     * });
     */
    public clearTile(x: number, y: number): void;
    /**
     * update animations in a tileset layer
     * @ignore
     */
    update(dt: any): boolean;
    /**
     * draw a tileset layer
     * @ignore
     */
    draw(renderer: any, rect: any): void;
}
/**
 * @classdesc
 * an Orthogonal Map Renderder
 * @class TMXOrthogonalRenderer
 * @memberOf me
 * @extends me.TMXRenderer
 * @constructor
 * @param {me.TMXTileMap} map the TMX map
 */
export class TMXOrthogonalRenderer {
    constructor(map: any);
    /**
     * return true if the renderer can render the specified layer
     * @ignore
     */
    canRender(layer: any): any;
    /**
     * return the tile position corresponding to the specified pixel
     * @ignore
     */
    pixelToTileCoords(x: any, y: any, v: any): any;
    /**
     * return the pixel position corresponding of the specified tile
     * @ignore
     */
    tileToPixelCoords(x: any, y: any, v: any): any;
    /**
     * fix the position of Objects to match
     * the way Tiled places them
     * @ignore
     */
    adjustPosition(obj: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTile(renderer: any, x: any, y: any, tmxTile: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTileLayer(renderer: any, layer: any, rect: any): void;
}
/**
 * @classdesc
 * The map renderer base class
 * @class TMXRenderer
 * @memberOf me
 * @constructor
 * @param {number} cols width of the tilemap in tiles
 * @param {number} rows height of the tilemap in tiles
 * @param {number} tilewidth width of each tile in pixels
 * @param {number} tileheight height of each tile in pixels
 */
export class TMXRenderer {
    constructor(cols: any, rows: any, tilewidth: any, tileheight: any);
    cols: any;
    rows: any;
    tilewidth: any;
    tileheight: any;
    bounds: Bounds;
    /**
     * return true if the renderer can render the specified map or layer
     * @name me.TMXRenderer#canRender
     * @public
     * @function
     * @param {me.TMXTileMap|me.TMXLayer} component TMX Map or Layer
     * @returns {boolean}
     */
    public canRender(component: me.TMXTileMap | me.TMXLayer): boolean;
    /**
     * return the bounding rect for this map renderer
     * @name me.TMXRenderer#getBounds
     * @public
     * @function
     * @param {me.TMXLayer} [layer] calculate the bounding rect for a specific layer (will return a new bounds object)
     * @returns {me.Bounds}
     */
    public getBounds(layer?: me.TMXLayer): me.Bounds;
    /**
     * return the tile position corresponding to the specified pixel
     * @name me.TMXRenderer#pixelToTileCoords
     * @public
     * @function
     * @param {number} x X coordinate
     * @param {number} y Y coordinate
     * @param {me.Vector2d} [v] an optional vector object where to put the return values
     * @returns {me.Vector2d}
     */
    public pixelToTileCoords(x: number, y: number, v?: me.Vector2d): me.Vector2d;
    /**
     * return the pixel position corresponding of the specified tile
     * @name me.TMXRenderer#tileToPixelCoords
     * @public
     * @function
     * @param {number} col tile horizontal position
     * @param {number} row tile vertical position
     * @param {me.Vector2d} [v] an optional vector object where to put the return values
     * @returns {me.Vector2d}
     */
    public tileToPixelCoords(col: number, row: number, v?: me.Vector2d): me.Vector2d;
    /**
     * draw the given tile at the specified layer
     * @name me.TMXRenderer#drawTile
     * @public
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {number} x X coordinate where to draw the tile
     * @param {number} y Y coordinate where to draw the tile
     * @param {me.Tile} tile the tile object to draw
     */
    public drawTile(renderer: me.CanvasRenderer | me.WebGLRenderer, x: number, y: number, tile: me.Tile): void;
    /**
     * draw the given TMX Layer for the given area
     * @name me.TMXRenderer#drawTileLayer
     * @public
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {me.TMXLayer} layer a TMX Layer object
     * @param {me.Rect} rect the area of the layer to draw
     */
    public drawTileLayer(renderer: me.CanvasRenderer | me.WebGLRenderer, layer: me.TMXLayer, rect: me.Rect): void;
}
/**
 * @classdesc
 * a Staggered Map Renderder
 * @class TMXStaggeredRenderer
 * @memberOf me
 * @extends me.TMXHexagonalRenderer
 * @constructor
 * @param {me.TMXTileMap} map the TMX map
 */
export class TMXStaggeredRenderer {
    /**
     * return true if the renderer can render the specified layer
     * @ignore
     */
    canRender(layer: any): any;
    /**
     * return the tile position corresponding to the specified pixel
     * @ignore
     */
    pixelToTileCoords(x: any, y: any, v: any): any;
}
/**
 * @classdesc
 * a TMX Tile Map Object
 * Tiled QT +0.7.x format
 * @class TMXTileMap
 * @memberOf me
 * @constructor
 * @param {string} levelId name of TMX map
 * @param {object} data TMX map in JSON format
 * @example
 * // create a new level object based on the TMX JSON object
 * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
 * // add the level to the game world container
 * level.addTo(me.game.world, true);
 */
export class TMXTileMap {
    constructor(levelId: any, data: any);
    /**
     * the level data (JSON)
     * @ignore
     */
    data: any;
    /**
     * name of the tilemap
     * @public
     * @type {string}
     * @name me.TMXTileMap#name
     */
    public name: string;
    /**
     * width of the tilemap in tiles
     * @public
     * @type {number}
     * @name me.TMXTileMap#cols
     */
    public cols: number;
    /**
     * height of the tilemap in tiles
     * @public
     * @type {number}
     * @name me.TMXTileMap#rows
     */
    public rows: number;
    /**
     * Tile width
     * @public
     * @type {number}
     * @name me.TMXTileMap#tilewidth
     */
    public tilewidth: number;
    /**
     * Tile height
     * @public
     * @type {number}
     * @name me.TMXTileMap#tileheight
     */
    public tileheight: number;
    /**
     * is the map an infinite map
     * @public
     * @type {number}
     * @default 0
     * @name me.TMXTileMap#infinite
     */
    public infinite: number;
    /**
     * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered” and “hexagonal”.
     * @public
     * @type {string}
     * @default "orthogonal"
     * @name me.TMXTileMap#orientation
     */
    public orientation: string;
    /**
     * the order in which tiles on orthogonal tile layers are rendered.
     * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @public
     * @type {string}
     * @default "right-down"
     * @name me.TMXTileMap#renderorder
     */
    public renderorder: string;
    /**
     * the TMX format version
     * @public
     * @type {string}
     * @name me.TMXTileMap#version
     */
    public version: string;
    /**
     * The Tiled version used to save the file (since Tiled 1.0.1).
     * @public
     * @type {string}
     * @name me.TMXTileMap#tiledversion
     */
    public tiledversion: string;
    tilesets: TMXTilesetGroup;
    layers: any[];
    objectGroups: any[];
    isEditor: boolean;
    nextobjectid: number;
    hexsidelength: number;
    staggeraxis: any;
    staggerindex: any;
    bounds: any;
    width: any;
    height: any;
    backgroundcolor: any;
    initialized: boolean;
    /**
     * Return the map default renderer
     * @name getRenderer
     * @memberOf me.TMXTileMap
     * @public
     * @function
     * @returns {me.TMXRenderer} a TMX renderer
     */
    public getRenderer(): me.TMXRenderer;
    renderer: TMXOrthogonalRenderer | TMXIsometricRenderer | TMXHexagonalRenderer | TMXStaggeredRenderer;
    /**
     * return the map bounding rect
     * @name me.TMXRenderer#getBounds
     * @public
     * @function
     * @returns {me.Bounds}
     */
    public getBounds(): me.Bounds;
    /**
     * parse the map
     * @ignore
     */
    readMapObjects(data: any): void;
    /**
     * add all the map layers and objects to the given container.
     * note : this will not automatically update the camera viewport
     * @name me.TMXTileMap#addTo
     * @public
     * @function
     * @param {me.Container} container target container
     * @param {boolean} [flatten=true] if true, flatten all objects into the given container, else a `me.Container` object will be created for each corresponding groups
     * @param {boolean} [setViewportBounds=false] if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
     * @example
     * // create a new level object based on the TMX JSON object
     * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true, true);
     */
    public addTo(container: me.Container, flatten?: boolean, setViewportBounds?: boolean): void;
    /**
     * return an Array of instantiated objects, based on the map object definition
     * @name me.TMXTileMap#getObjects
     * @public
     * @function
     * @param {boolean} [flatten=true] if true, flatten all objects into the returned array.
     * when false, a `me.Container` object will be created for each corresponding groups
     * @returns {me.Renderable[]} Array of Objects
     */
    public getObjects(flatten?: boolean): me.Renderable[];
    /**
     * return all the existing layers
     * @name me.TMXTileMap#getLayers
     * @public
     * @function
     * @returns {me.TMXLayer[]} Array of Layers
     */
    public getLayers(): me.TMXLayer[];
    /**
     * destroy function, clean all allocated objects
     * @name me.TMXTileMap#destroy
     * @public
     * @function
     */
    public destroy(): void;
}
/**
 * @classdesc
 * a TMX Tile Set Object
 * @class TMXTileset
 * @memberOf me
 * @constructor
 * @param {object} tileset tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
 */
export class TMXTileset {
    constructor(tileset: any);
    TileProperties: any[];
    imageCollection: HTMLImageElement[];
    firstgid: number;
    lastgid: number;
    name: any;
    tilewidth: number;
    tileheight: number;
    spacing: number;
    margin: number;
    tileoffset: Vector2d;
    /**
     * Tileset contains animated tiles
     * @public
     * @type {boolean}
     * @name me.TMXTileset#isAnimated
     */
    public isAnimated: boolean;
    /**
     * true if the tileset is a "Collection of Image" Tileset
     * @public
     * @type {boolean}
     * @name me.TMXTileset#isCollection
     */
    public isCollection: boolean;
    /**
     * Tileset animations
     * @private
     * @type {Map}
     * @name me.TMXTileset#animations
     */
    private animations;
    /**
     * Remember the last update timestamp to prevent too many animation updates
     * @private
     * @type {Map}
     * @name me.TMXTileset#_lastUpdate
     */
    private _lastUpdate;
    image: HTMLImageElement;
    texture: any;
    atlas: any;
    /**
     * return the tile image from a "Collection of Image" tileset
     * @name me.TMXTileset#getTileImage
     * @public
     * @function
     * @param {number} gid
     * @returns {Image} corresponding image or undefined
     */
    public getTileImage(gid: number): new (width?: number, height?: number) => HTMLImageElement;
    /**
     * set the tile properties
     * @ignore
     * @function
     */
    setTileProperty(gid: any, prop: any): void;
    /**
     * return true if the gid belongs to the tileset
     * @name me.TMXTileset#contains
     * @public
     * @function
     * @param {number} gid
     * @returns {boolean}
     */
    public contains(gid: number): boolean;
    /**
     * Get the view (local) tile ID from a GID, with animations applied
     * @name me.TMXTileset#getViewTileId
     * @public
     * @function
     * @param {number} gid Global tile ID
     * @returns {number} View tile ID
     */
    public getViewTileId(gid: number): number;
    /**
     * return the properties of the specified tile
     * @name me.TMXTileset#getTileProperties
     * @public
     * @function
     * @param {number} tileId
     * @returns {object}
     */
    public getTileProperties(tileId: number): object;
    update(dt: any): boolean;
    drawTile(renderer: any, dx: any, dy: any, tmxTile: any): void;
}
/**
 * @classdesc
 * an object containing all tileset
 * @class TMXTilesetGroup
 * @memberOf me
 * @constructor
 */
export class TMXTilesetGroup {
    tilesets: any[];
    length: number;
    /**
     * add a tileset to the tileset group
     * @name me.TMXTilesetGroup#add
     * @public
     * @function
     * @param  {me.TMXTileset} tileset
     */
    public add(tileset: me.TMXTileset): void;
    /**
     * return the tileset at the specified index
     * @name me.TMXTilesetGroup#getTilesetByIndex
     * @public
     * @function
     * @param {number} i
     * @returns {me.TMXTileset} corresponding tileset
     */
    public getTilesetByIndex(i: number): me.TMXTileset;
    /**
     * return the tileset corresponding to the specified id <br>
     * will throw an exception if no matching tileset is found
     * @name me.TMXTilesetGroup#getTilesetByGid
     * @public
     * @function
     * @param {number} gid
     * @returns {me.TMXTileset} corresponding tileset
     */
    public getTilesetByGid(gid: number): me.TMXTileset;
}
/**
 * @classdesc
 * a generic system font object.
 * @class Text
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {number} x position of the text object
 * @param {number} y position of the text object
 * @param {object} settings the text configuration
 * @param {string} settings.font a CSS family font name
 * @param {number|string} settings.size size, or size + suffix (px, em, pt)
 * @param {me.Color|string} [settings.fillStyle="#000000"] a CSS color value
 * @param {me.Color|string} [settings.strokeStyle="#000000"] a CSS color value
 * @param {number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
 * @param {string} [settings.textAlign="left"] horizontal text alignment
 * @param {string} [settings.textBaseline="top"] the text baseline
 * @param {number} [settings.lineHeight=1.0] line spacing height
 * @param {me.Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
 * @param {boolean} [settings.offScreenCanvas=false] whether to draw the font to an individual "cache" texture first
 * @param {(string|string[])} [settings.text=""] a string, or an array of strings
 * @example
 * var font = new me.Text(0, 0, {font: "Arial", size: 8, fillStyle: this.color});
 */
export class Text {
    /** @ignore */
    constructor(x: any, y: any, settings: any);
    /** @ignore */
    onResetEvent(x: any, y: any, settings: any): void;
    fillStyle: any;
    strokeStyle: any;
    /**
     * sets the current line width, in pixels, when drawing stroke
     * @public
     * @type {number}
     * @default 1
     * @name me.Text#lineWidth
     */
    public lineWidth: number;
    /**
     * Set the default text alignment (or justification),<br>
     * possible values are "left", "right", and "center".<br>
     * @public
     * @type {string}
     * @default "left"
     * @name me.Text#textAlign
     */
    public textAlign: string;
    /**
     * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
     * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
     * @public
     * @type {string}
     * @default "top"
     * @name me.Text#textBaseline
     */
    public textBaseline: string;
    /**
     * Set the line spacing height (when displaying multi-line strings). <br>
     * Current font height will be multiplied with this value to set the line height.
     * @public
     * @type {number}
     * @default 1.0
     * @name me.Text#lineHeight
     */
    public lineHeight: number;
    /**
     * whether to draw the font to a indidividual offscreen canvas texture first <br>
     * Note: this will improve performances when using WebGL, but will impact
     * memory consumption as every text element will have its own canvas texture
     * @public
     * @type {boolean}
     * @default false
     * @name me.Text#offScreenCanvas
     */
    public offScreenCanvas: boolean;
    /**
     * the text to be displayed
     * @private
     * @type {string[]}
     * @name _text
     * @memberOf me.Text
     */
    private _text;
    /**
     * the font size (in px)
     * @public
     * @type {number}
     * @name fontSize
     * @default 10
     * @memberOf me.Text
     */
    public fontSize: number;
    floating: boolean;
    canvas: any;
    context: any;
    /** @ignore */
    onDeactivateEvent(): void;
    glTextureUnit: any;
    /**
     * make the font bold
     * @name bold
     * @memberOf me.Text.prototype
     * @function
     * @returns {me.Text} this object for chaining
     */
    bold(): me.Text;
    font: any;
    isDirty: boolean;
    /**
     * make the font italic
     * @name italic
     * @memberOf me.Text.prototype
     * @function
     * @returns {me.Text} this object for chaining
     */
    italic(): me.Text;
    /**
     * set the font family and size
     * @name setFont
     * @memberOf me.Text.prototype
     * @function
     * @param {string} font a CSS font name
     * @param {number|string} [size=10] size in px, or size + suffix (px, em, pt)
     * @returns {me.Text} this object for chaining
     * @example
     * font.setFont("Arial", 20);
     * font.setFont("Arial", "1.5em");
     */
    setFont(font: string, size?: number | string): me.Text;
    height: number;
    /**
     * change the text to be displayed
     * @name setText
     * @memberOf me.Text.prototype
     * @function
     * @param {number|string|string[]} value a string, or an array of strings
     * @returns {me.Text} this object for chaining
     */
    setText(value?: number | string | string[]): me.Text;
    /**
     * measure the given text size in pixels
     * @name measureText
     * @memberOf me.Text.prototype
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} [renderer] reference to the active renderer
     * @param {string} [text] the text to be measured
     * @param {me.Rect|me.Bounds} [ret] a object in which to store the text metrics
     * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
     */
    measureText(renderer?: me.CanvasRenderer | me.WebGLRenderer, text?: string, ret?: me.Rect | me.Bounds): TextMetrics;
    width: any;
    /**
     * @ignore
     */
    update(): boolean;
    /**
     * draw a text at the specified coord
     * @name draw
     * @memberOf me.Text.prototype
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
     * @param {string} [text]
     * @param {number} [x]
     * @param {number} [y]
     * @param {boolean} [stroke=false] draw stroke the the text if true
     */
    draw(renderer: me.CanvasRenderer | me.WebGLRenderer, text?: string, x?: number, y?: number, stroke?: boolean): void;
    /**
     * draw a stroke text at the specified coord, as defined <br>
     * by the `lineWidth` and `fillStroke` properties. <br>
     * Note : using drawStroke is not recommended for performance reasons
     * @name drawStroke
     * @memberOf me.Text.prototype
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
     * @param {string} text
     * @param {number} x
     * @param {number} y
     */
    drawStroke(renderer: me.CanvasRenderer | me.WebGLRenderer, text: string, x: number, y: number): void;
    /**
     * @ignore
     */
    _drawFont(context: any, text: any, x: any, y: any, stroke?: boolean): any;
    /**
     * Destroy function
     * @ignore
     */
    destroy(): void;
}
/**
 * a basic tile object
 * @class
 * @extends me.Bounds
 * @memberOf me
 * @constructor
 * @param {number} x x index of the Tile in the map
 * @param {number} y y index of the Tile in the map
 * @param {number} gid tile gid
 * @param {me.TMXTileset} tileset the corresponding tileset object
 */
export class Tile {
    constructor(x: any, y: any, gid: any, tileset: any);
    /**
     * tileset
     * @public
     * @type {me.TMXTileset}
     * @name me.Tile#tileset
     */
    public tileset: me.TMXTileset;
    /**
     * the tile transformation matrix (if defined)
     * @ignore
     */
    currentTransform: Matrix2d;
    col: any;
    row: any;
    /**
     * tileId
     * @public
     * @type {number}
     * @name me.Tile#tileId
     */
    public tileId: number;
    /**
     * True if the tile is flipped horizontally<br>
     * @public
     * @type {boolean}
     * @name me.Tile#flipX
     */
    public flippedX: boolean;
    /**
     * True if the tile is flipped vertically<br>
     * @public
     * @type {boolean}
     * @name me.Tile#flippedY
     */
    public flippedY: boolean;
    /**
     * True if the tile is flipped anti-diagonally<br>
     * @public
     * @type {boolean}
     * @name me.Tile#flippedAD
     */
    public flippedAD: boolean;
    /**
     * Global flag that indicates if the tile is flipped<br>
     * @public
     * @type {boolean}
     * @name me.Tile#flipped
     */
    public flipped: boolean;
    /**
     * set the transformation matrix for this tile
     * @ignore
     */
    setTileTransform(transform: any): void;
    /**
     * return a renderable object for this Tile object
     * @name me.Tile#getRenderable
     * @public
     * @function
     * @param {object} [settings] see {@link me.Sprite}
     * @returns {me.Renderable} a me.Sprite object
     */
    public getRenderable(settings?: object): me.Renderable;
}
/**
 * @classdesc
 * trigger an event when colliding with another object
 * @class Trigger
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinates of the trigger area
 * @param {number} y the y coordinates of the trigger area
 * @param {number} [settings.width] width of the trigger area
 * @param {number} [settings.height] height of the trigger area
 * @param {me.Rect[]|me.Polygon[]|me.Line[]|me.Ellipse[]} [settings.shapes] collision shape(s) that will trigger the event
 * @param {string} [settings.duration] Fade duration (in ms)
 * @param {string|me.Color} [settings.color] Fade color
 * @param {string} [settings.event="level"] the type of event to trigger (only "level" supported for now)
 * @param {string} [settings.to] level to load if level trigger
 * @param {string|me.Container} [settings.container] Target container. See {@link me.level.load}
 * @param {Function} [settings.onLoaded] Level loaded callback. See {@link me.level.load}
 * @param {boolean} [settings.flatten] Flatten all objects into the target container. See {@link me.level.load}
 * @param {boolean} [settings.setViewportBounds] Resize the viewport to match the level. See {@link me.level.load}
 * @example
 * me.game.world.addChild(new me.Trigger(
 *     x, y, {
 *         shapes: [new me.Rect(0, 0, 100, 100)],
 *         "duration" : 250,
 *         "color" : "#000",
 *         "to" : "mymap2"
 *     }
 * ));
 */
export class Trigger {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    fade: any;
    duration: any;
    fading: boolean;
    name: string;
    type: any;
    id: any;
    gotolevel: any;
    triggerSettings: {
        event: string;
    };
    body: Body;
    /**
     * @ignore
     */
    getTriggerSettings(): {
        event: string;
    };
    /**
     * @ignore
     */
    onFadeComplete(): void;
    /**
     * trigger this event
     * @name triggerEvent
     * @memberOf me.Trigger
     * @function
     * @protected
     */
    protected triggerEvent(): void;
    /** @ignore */
    onCollision(): boolean;
}
/**
 * Tween.js - Licensed under the MIT license
 * https://github.com/tweenjs/tween.js
 */
/**
 * @classdesc
 * Javascript Tweening Engine<p>
 * Super simple, fast and easy to use tweening engine which incorporates optimised Robert Penner's equation<p>
 * <a href="https://github.com/sole/Tween.js">https://github.com/sole/Tween.js</a><p>
 * author sole / http://soledadpenades.com<br>
 * author mr.doob / http://mrdoob.com<br>
 * author Robert Eisele / http://www.xarg.org<br>
 * author Philippe / http://philippe.elsass.me<br>
 * author Robert Penner / http://www.robertpenner.com/easing_terms_of_use.html<br>
 * author Paul Lewis / http://www.aerotwist.com/<br>
 * author lechecacharro<br>
 * author Josh Faul / http://jocafa.com/
 * @class Tween
 * @memberOf me
 * @constructor
 * @param {object} object object on which to apply the tween
 * @example
 * // add a tween to change the object pos.x and pos.y variable to 200 in 3 seconds
 * tween = new me.Tween(myObject.pos).to({
 *       x: 200,
 *       y: 200,
 *    }, {
 *       duration: 3000,
 *       easing: me.Tween.Easing.Bounce.Out,
 *       autoStart : true
 * }).onComplete(myFunc);
 */
export class Tween {
    static get Easing(): any;
    static get Interpolation(): any;
    constructor(object: any);
    /**
     * reset the tween object to default value
     * @ignore
     */
    onResetEvent(object: any): void;
    /**
     * @ignore
     */
    setProperties(object: any): void;
    _object: any;
    _valuesStart: {};
    _valuesEnd: any;
    _valuesStartRepeat: {};
    _duration: any;
    _repeat: number;
    _yoyo: boolean;
    _reversed: any;
    _delayTime: number;
    _startTime: any;
    _easingFunction: any;
    _interpolationFunction: any;
    _chainedTweens: IArguments | any[];
    _onStartCallback: Function;
    _onStartCallbackFired: boolean;
    _onUpdateCallback: Function;
    _onCompleteCallback: Function;
    _tweenTimeTracker: any;
    isPersistent: boolean;
    updateWhenPaused: boolean;
    isRenderable: boolean;
    /**
     * @ignore
     */
    _resumeCallback(elapsed: any): void;
    /**
     * subscribe to the resume event when added
     * @ignore
     */
    onActivateEvent(): void;
    /**
     * Unsubscribe when tween is removed
     * @ignore
     */
    onDeactivateEvent(): void;
    /**
     * object properties to be updated and duration
     * @name to
     * @memberOf me.Tween
     * @public
     * @function
     * @param {object} properties hash of properties
     * @param {object|number} [options] object of tween properties, or a duration if a numeric value is passed
     * @param {number} [options.duration] tween duration
     * @param {me.Tween.Easing} [options.easing] easing function
     * @param {number} [options.delay] delay amount expressed in milliseconds
     * @param {boolean} [options.yoyo] allows the tween to bounce back to their original value when finished. To be used together with repeat to create endless loops.
     * @param {number} [options.repeat] amount of times the tween should be repeated
     * @param {me.Tween.Interpolation} [options.interpolation] interpolation function
     * @param {boolean} [options.autoStart] allow this tween to start automatically. Otherwise call me.Tween.start().
     * @returns {me.Tween} this instance for object chaining
     */
    public to(properties: object, options?: object | number): me.Tween;
    /**
     * start the tween
     * @name start
     * @memberOf me.Tween
     * @public
     * @function
     * @param {number} [time] the current time when the tween was started
     * @returns {me.Tween} this instance for object chaining
     */
    public start(time?: number): me.Tween;
    /**
     * stop the tween
     * @name stop
     * @memberOf me.Tween
     * @public
     * @function
     * @returns {me.Tween} this instance for object chaining
     */
    public stop(): me.Tween;
    /**
     * delay the tween
     * @name delay
     * @memberOf me.Tween
     * @public
     * @function
     * @param {number} amount delay amount expressed in milliseconds
     * @returns {me.Tween} this instance for object chaining
     */
    public delay(amount: number): me.Tween;
    /**
     * Repeat the tween
     * @name repeat
     * @memberOf me.Tween
     * @public
     * @function
     * @param {number} times amount of times the tween should be repeated
     * @returns {me.Tween} this instance for object chaining
     */
    public repeat(times: number): me.Tween;
    /**
     * Allows the tween to bounce back to their original value when finished.
     * To be used together with repeat to create endless loops.
     * @name yoyo
     * @memberOf me.Tween
     * @public
     * @function
     * @see me.Tween#repeat
     * @param {boolean} yoyo
     * @returns {me.Tween} this instance for object chaining
     */
    public yoyo(yoyo: boolean): me.Tween;
    /**
     * set the easing function
     * @name easing
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween.Easing} easing easing function
     * @returns {me.Tween} this instance for object chaining
     */
    public easing(easing: me.Tween.Easing): me.Tween;
    /**
     * set the interpolation function
     * @name interpolation
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween.Interpolation} interpolation interpolation function
     * @returns {me.Tween} this instance for object chaining
     */
    public interpolation(interpolation: me.Tween.Interpolation): me.Tween;
    /**
     * chain the tween
     * @name chain
     * @memberOf me.Tween
     * @public
     * @function
     * @param {...me.Tween} chainedTween Tween(s) to be chained
     * @returns {me.Tween} this instance for object chaining
     */
    public chain(...args: me.Tween[]): me.Tween;
    /**
     * onStart callback
     * @name onStart
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onStartCallback callback
     * @returns {me.Tween} this instance for object chaining
     */
    public onStart(onStartCallback: Function): me.Tween;
    /**
     * onUpdate callback
     * @name onUpdate
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onUpdateCallback callback
     * @returns {me.Tween} this instance for object chaining
     */
    public onUpdate(onUpdateCallback: Function): me.Tween;
    /**
     * onComplete callback
     * @name onComplete
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onCompleteCallback callback
     * @returns {me.Tween} this instance for object chaining
     */
    public onComplete(onCompleteCallback: Function): me.Tween;
    /** @ignore */
    update(dt: any): boolean;
}
/**
 * @classdesc
 * a generic 2D Vector Object
 * @class Vector2d
 * @memberOf me
 * @constructor
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 */
export class Vector2d {
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(x?: number, y?: number): Vector2d;
    x: any;
    y: any;
    /**
     * @ignore
     */
    _set(x: any, y: any): Vector2d;
    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberOf me.Vector2d
     * @function
     * @param {number} x
     * @param {number} y
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    set(x: number, y: number): me.Vector2d;
    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    setZero(): me.Vector2d;
    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    setV(v: me.Vector2d): me.Vector2d;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    add(v: me.Vector2d): me.Vector2d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    sub(v: me.Vector2d): me.Vector2d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.Vector2d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number): me.Vector2d;
    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    toIso(): me.Vector2d;
    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    to2d(): me.Vector2d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d): me.Vector2d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.Vector2d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    div(n: number): me.Vector2d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    abs(): me.Vector2d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.Vector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector2d} new me.Vector2d
     */
    clamp(low: number, high: number): me.Vector2d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.Vector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): me.Vector2d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    minV(v: me.Vector2d): me.Vector2d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    maxV(v: me.Vector2d): me.Vector2d;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    floor(): me.Vector2d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    floorSelf(): me.Vector2d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    ceil(): me.Vector2d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    ceilSelf(): me.Vector2d;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    negate(): me.Vector2d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    negateSelf(): me.Vector2d;
    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    copy(v: me.Vector2d): me.Vector2d;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberOf me.Vector2d
     * @function
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    normalize(): me.Vector2d;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    perp(): me.Vector2d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Vector2d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.Vector2d;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {number} The dot product.
     */
    dotProduct(v: me.Vector2d): number;
    /**
     * return the square length of this vector
     * @name length2
     * @memberOf me.Vector2d
     * @function
     * @returns {number} The length^2 of this vector.
     */
    length2(): number;
    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberOf me.Vector2d
     * @function
     * @returns {number} the length of this vector
     */
    length(): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    lerp(v: me.Vector2d, alpha: number): me.Vector2d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {number}
     */
    distance(v: me.Vector2d): number;
    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {number} angle in radians
     */
    angle(v: me.Vector2d): number;
    /**
     * project this vector on to another vector.
     * @name project
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v The vector to project onto.
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    project(v: me.Vector2d): me.Vector2d;
    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v The unit vector to project onto.
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    projectN(v: me.Vector2d): me.Vector2d;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    clone(): me.Vector2d;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Vector2d
     * @function
     * @returns {string}
     */
    toString(): string;
}
/**
 * @classdesc
 * a generic 3D Vector Object
 * @class Vector3d
 * @memberOf me
 * @constructor
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 * @param {number} [z=0] z value of the vector
 */
export class Vector3d {
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(x?: number, y?: number, z?: number): Vector3d;
    x: any;
    y: any;
    z: number;
    /**
     * @ignore
     */
    _set(x: any, y: any, z?: number): Vector3d;
    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberOf me.Vector3d
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} [z=0]
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    set(x: number, y: number, z?: number): me.Vector3d;
    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    setZero(): me.Vector3d;
    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    setV(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    add(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    sub(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.Vector3d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @param {number} [z=1]
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number, z?: number): me.Vector3d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    scaleV(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    toIso(): me.Vector3d;
    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    to2d(): me.Vector3d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.Vector3d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    div(n: number): me.Vector3d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    abs(): me.Vector3d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.Vector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector3d} new me.Vector3d
     */
    clamp(low: number, high: number): me.Vector3d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.Vector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): me.Vector3d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    minV(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    maxV(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    floor(): me.Vector3d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    floorSelf(): me.Vector3d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    ceil(): me.Vector3d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    ceilSelf(): me.Vector3d;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    negate(): me.Vector3d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    negateSelf(): me.Vector3d;
    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    copy(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberOf me.Vector3d
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} [z]
     * @returns {boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    normalize(): me.Vector3d;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
     * @name perp
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    perp(): me.Vector3d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
     * @name rotate
     * @memberOf me.Vector3d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: me.Vector2d | me.ObservableVector2d): me.Vector3d;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {number} The dot product.
     */
    dotProduct(v: me.Vector2d | me.Vector3d): number;
    /**
     * return the square length of this vector
     * @name length2
     * @memberOf me.Vector3d
     * @function
     * @returns {number} The length^2 of this vector.
     */
    length2(): number;
    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberOf me.Vector3d
     * @function
     * @returns {number} the length of this vector
     */
    length(): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector3d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    lerp(v: me.Vector3d, alpha: number): me.Vector3d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {number}
     */
    distance(v: me.Vector2d | me.Vector3d): number;
    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {number} angle in radians
     */
    angle(v: me.Vector2d | me.Vector3d): number;
    /**
     * project this vector on to another vector.
     * @name project
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v The vector to project onto.
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    project(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v The unit vector to project onto.
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    projectN(v: me.Vector2d | me.Vector3d): me.Vector3d;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    clone(): me.Vector3d;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Vector3d
     * @function
     * @returns {string}
     */
    toString(): string;
}
/**
 * @classdesc
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @class WebGLCompositor
 * @memberOf me
 * @constructor
 * @param {me.WebGLRenderer} renderer the current WebGL renderer session
 */
export class WebGLCompositor {
    constructor(renderer: any);
    /**
     * Initialize the compositor
     * @ignore
     */
    init(renderer: any): void;
    currentTextureUnit: any;
    boundTextures: any[];
    renderer: any;
    gl: any;
    color: any;
    viewMatrix: any;
    /**
     * a reference to the active WebGL shader
     * @name activeShader
     * @memberOf me.WebGLCompositor
     * @type {me.GLShader}
     */
    activeShader: me.GLShader;
    /**
     * primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @name mode
     * @see me.WebGLCompositor
     * @memberOf me.WebGLCompositor
     * @default gl.TRIANGLES
     */
    mode: any;
    /**
     * an array of vertex attribute properties
     * @name attributes
     * @see me.WebGLCompositor.addAttribute
     * @memberOf me.WebGLCompositor
     */
    attributes: any[];
    /**
     * the size of a single vertex in bytes
     * (will automatically be calculated as attributes definitions are added)
     * @name vertexByteSize
     * @see me.WebGLCompositor.addAttribute
     * @memberOf me.WebGLCompositor
     */
    vertexByteSize: number;
    /**
     * the size of a single vertex in floats
     * (will automatically be calculated as attributes definitions are added)
     * @name vertexSize
     * @see me.WebGLCompositor.addAttribute
     * @memberOf me.WebGLCompositor
     */
    vertexSize: number;
    primitiveShader: GLShader;
    quadShader: GLShader;
    vertexBuffer: VertexArrayBuffer;
    /**
     * Reset compositor internal state
     * @ignore
     */
    reset(): void;
    /**
     * add vertex attribute property definition to the compositor
     * @name addAttribute
     * @memberOf me.WebGLCompositor
     * @function
     * @param {string} name name of the attribute in the vertex shader
     * @param {number} size number of components per vertex attribute. Must be 1, 2, 3, or 4.
     * @param {GLenum} type data type of each component in the array
     * @param {boolean} normalized whether integer data values should be normalized into a certain range when being cast to a float
     * @param {number} offset offset in bytes of the first component in the vertex attribute array
     */
    addAttribute(name: string, size: number, type: GLenum, normalized: boolean, offset: number): void;
    /**
     * Sets the viewport
     * @name setViewport
     * @memberOf me.WebGLCompositor
     * @function
     * @param {number} x x position of viewport
     * @param {number} y y position of viewport
     * @param {number} w width of viewport
     * @param {number} h height of viewport
     */
    setViewport(x: number, y: number, w: number, h: number): void;
    /**
     * Create a WebGL texture from an image
     * @name createTexture2D
     * @memberOf me.WebGLCompositor
     * @function
     * @param {number} unit Destination texture unit
     * @param {Image|HTMLCanvasElement|ImageData|Uint8Array[]|Float32Array[]} image Source image
     * @param {number} filter gl.LINEAR or gl.NEAREST
     * @param {string} [repeat="no-repeat"] Image repeat behavior (see {@link me.ImageLayer#repeat})
     * @param {number} [w] Source image width (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {number} [h] Source image height (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {boolean} [premultipliedAlpha=true] Multiplies the alpha channel into the other color channels
     * @param {boolean} [mipmap=true] Whether mipmap levels should be generated for this texture
     * @returns {WebGLTexture} a WebGL texture
     */
    createTexture2D(unit: number, image: (new (width?: number, height?: number) => HTMLImageElement) | HTMLCanvasElement | ImageData | Uint8Array[] | Float32Array[], filter: number, repeat?: string, w?: number, h?: number, b?: number, premultipliedAlpha?: boolean, mipmap?: boolean): WebGLTexture;
    /**
     * delete the given WebGL texture
     * @name bindTexture2D
     * @memberOf me.WebGLCompositor
     * @function
     * @param {WebGLTexture} [texture] a WebGL texture to delete
     * @param {number} [unit] Texture unit to delete
     */
    deleteTexture2D(texture?: WebGLTexture): void;
    /**
     * returns the WebGL texture associated to the given texture unit
     * @name bindTexture2D
     * @memberOf me.WebGLCompositor
     * @function
     * @param {number} unit Texture unit to which a texture is bound
     * @returns {WebGLTexture} texture a WebGL texture
     */
    getTexture2D(unit: number): WebGLTexture;
    /**
     * assign the given WebGL texture to the current batch
     * @name bindTexture2D
     * @memberOf me.WebGLCompositor
     * @function
     * @param {WebGLTexture} texture a WebGL texture
     * @param {number} unit Texture unit to which the given texture is bound
     */
    bindTexture2D(texture: WebGLTexture, unit: number): void;
    /**
     * unbind the given WebGL texture, forcing it to be reuploaded
     * @name unbindTexture2D
     * @memberOf me.WebGLCompositor
     * @function
     * @param {WebGLTexture} [texture] a WebGL texture
     * @param {number} [unit] a WebGL texture
     * @returns {number} unit the unit number that was associated with the given texture
     */
    unbindTexture2D(texture?: WebGLTexture, unit?: number): number;
    /**
     * @ignore
     */
    uploadTexture(texture: any, w: any, h: any, b: any, force?: boolean): any;
    /**
     * Select the shader to use for compositing
     * @name useShader
     * @see me.GLShader
     * @memberOf me.WebGLCompositor
     * @function
     * @param {me.GLShader} shader a reference to a GLShader instance
     */
    useShader(shader: me.GLShader): void;
    /**
     * Add a textured quad
     * @name addQuad
     * @memberOf me.WebGLCompositor
     * @function
     * @param {me.Renderer.Texture} texture Source texture
     * @param {number} x Destination x-coordinate
     * @param {number} y Destination y-coordinate
     * @param {number} w Destination width
     * @param {number} h Destination height
     * @param {number} u0 Texture UV (u0) value.
     * @param {number} v0 Texture UV (v0) value.
     * @param {number} u1 Texture UV (u1) value.
     * @param {number} v1 Texture UV (v1) value.
     * @param {number} tint tint color to be applied to the texture in UINT32 (argb) format
     */
    addQuad(texture: me.Renderer.Texture, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, tint: number): void;
    /**
     * Flush batched texture operations to the GPU
     * @param {number} [mode=gl.TRIANGLES] the GL drawing mode
     * @memberOf me.WebGLCompositor
     * @function
     */
    flush(mode?: number): void;
    /**
     * Draw an array of vertices
     * @name drawVertices
     * @memberOf me.WebGLCompositor
     * @function
     * @param {GLenum} mode primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @param {me.Vector2d[]} verts vertices
     * @param {number} [vertexCount=verts.length] amount of points defined in the points array
     */
    drawVertices(mode: GLenum, verts: me.Vector2d[], vertexCount?: number): void;
    /**
     * Specify the color values used when clearing color buffers. The values are clamped between 0 and 1.
     * @name clearColor
     * @memberOf me.WebGLCompositor
     * @function
     * @param {number} r - the red color value used when the color buffers are cleared
     * @param {number} g - the green color value used when the color buffers are cleared
     * @param {number} b - the blue color value used when the color buffers are cleared
     * @param {number} a - the alpha color value used when the color buffers are cleared
     */
    clearColor(r: number, g: number, b: number, a: number): void;
    /**
     * Clear the frame buffer
     * @name clear
     * @memberOf me.WebGLCompositor
     * @function
     */
    clear(): void;
}
/**
 * @classdesc
 * a WebGL renderer object
 * @class WebGLRenderer
 * @extends me.Renderer
 * @memberOf me
 * @constructor
 * @param {object} options The renderer parameters
 * @param {number} options.width The width of the canvas without scaling
 * @param {number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing
 * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
 * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
 * @param {boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
 * @param {string} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
 * @param {me.WebGLCompositor} [options.compositor] A class that implements the compositor API
 */
export class WebGLRenderer {
    constructor(options: any);
    /**
     * The WebGL version used by this renderer (1 or 2)
     * @name WebGLVersion
     * @memberOf me.WebGLRenderer
     * @type {number}
     * @default 1
     * @readonly
     */
    readonly WebGLVersion: number;
    /**
     * The vendor string of the underlying graphics driver.
     * @name GPUVendor
     * @memberOf me.WebGLRenderer
     * @type {string}
     * @default null
     * @readonly
     */
    readonly GPUVendor: string;
    /**
     * The renderer string of the underlying graphics driver.
     * @name GPURenderer
     * @memberOf me.WebGLRenderer
     * @type {string}
     * @default null
     * @readonly
     */
    readonly GPURenderer: string;
    /**
     * The WebGL context
     * @name gl
     * @memberOf me.WebGLRenderer
     * type {WebGLRenderingContext}
     */
    context: WebGLRenderingContext;
    gl: WebGLRenderingContext;
    /**
     * Maximum number of texture unit supported under the current context
     * @name maxTextures
     * @memberOf me.WebGLRenderer
     * @type {number}
     * @readonly
     */
    readonly maxTextures: number;
    /**
     * @ignore
     */
    _colorStack: any[];
    /**
     * @ignore
     */
    _matrixStack: any[];
    /**
     * @ignore
     */
    _scissorStack: any[];
    /**
     * @ignore
     */
    _glPoints: Vector2d[];
    /**
     * The current transformation matrix used for transformations on the overall scene
     * @name currentTransform
     * @type {me.Matrix2d}
     * @memberOf me.WebGLRenderer#
     */
    currentTransform: me.Matrix2d;
    /**
     * The current compositor used by the renderer
     * @name currentCompositor
     * @type {me.WebGLCompositor}
     * @memberOf me.WebGLRenderer#
     */
    currentCompositor: me.WebGLCompositor;
    /**
     * The list of active compositors
     * @name compositors
     * @type {Map}
     * @memberOf me.WebGLRenderer#
     */
    compositors: Map<any, any>;
    cache: TextureCache;
    isContextValid: boolean;
    /**
     * Reset context state
     * @name reset
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    reset(): void;
    /**
     * set the active compositor for this renderer
     * @name setCompositor
     * @function
     * @param {me.WebGLCompositor|string} compositor a compositor name or instance
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    setCompositor(compositor?: me.WebGLCompositor | string): void;
    /**
     * Reset the gl transform to identity
     * @name resetTransform
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    resetTransform(): void;
    /**
     * @ignore
     */
    createFontTexture(cache: any): void;
    /**
     * @ignore
     */
    fontContext2D: any;
    /**
     * @ignore
     */
    fontTexture: Texture;
    /**
     * Create a pattern with the specified repetition
     * @name createPattern
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Image} image Source image
     * @param {string} repeat Define how the pattern should be repeated
     * @returns {me.Renderer.Texture}
     * @see me.ImageLayer#repeat
     * @example
     * var tileable   = renderer.createPattern(image, "repeat");
     * var horizontal = renderer.createPattern(image, "repeat-x");
     * var vertical   = renderer.createPattern(image, "repeat-y");
     * var basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image: new (width?: number, height?: number) => HTMLImageElement, repeat: string): me.Renderer.Texture;
    /**
     * Flush the compositor to the frame buffer
     * @name flush
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    flush(): void;
    /**
     * Clears the gl context with the given color.
     * @name clearColor
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Color|string} color CSS color.
     * @param {boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(color: me.Color | string, opaque?: boolean): void;
    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @name clearRect
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x x axis of the coordinate for the rectangle starting point.
     * @param {number} y y axis of the coordinate for the rectangle starting point.
     * @param {number} width The rectangle's width.
     * @param {number} height The rectangle's height.
     */
    clearRect(x: number, y: number, width: number, height: number): void;
    /**
     * @ignore
     */
    drawFont(bounds: any): void;
    /**
     * Draw an image to the gl context
     * @name drawImage
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
     * @param {number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {number} sh The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dw The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {number} dh The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image: new (width?: number, height?: number) => HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
    /**
     * Draw a pattern within the given rectangle.
     * @name drawPattern
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Renderer.Texture} pattern Pattern object
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @see me.WebGLRenderer#createPattern
     */
    drawPattern(pattern: me.Renderer.Texture, x: number, y: number, width: number, height: number): void;
    /**
     * return a reference to the screen canvas corresponding WebGL Context
     * @name getScreenContext
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @returns {WebGLRenderingContext}
     */
    getScreenContext(): WebGLRenderingContext;
    /**
     * Returns the WebGL Context object of the given Canvas
     * @name getContextGL
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {HTMLCanvasElement} canvas
     * @param {boolean} [transparent=true] use false to disable transparency
     * @returns {WebGLRenderingContext}
     */
    getContextGL(canvas: HTMLCanvasElement, transparent?: boolean): WebGLRenderingContext;
    /**
     * Returns the WebGLContext instance for the renderer
     * return a reference to the system 2d Context
     * @name getContext
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @returns {WebGLRenderingContext}
     */
    getContext(): WebGLRenderingContext;
    /**
     * set a blend mode for the given context
     * @name setBlendMode
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {string} [mode="normal"] blend mode : "normal", "multiply"
     * @param {WebGLRenderingContext} [gl]
     */
    setBlendMode(mode?: string, gl?: WebGLRenderingContext): void;
    currentBlendMode: string;
    /**
     * return a reference to the font 2d Context
     * @ignore
     */
    getFontContext(): any;
    /**
     * restores the canvas context
     * @name restore
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    restore(): void;
    /**
     * saves the canvas context
     * @name save
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    save(): void;
    /**
     * rotates the uniform matrix
     * @name rotate
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} angle in radians
     */
    rotate(angle: number): void;
    /**
     * scales the uniform matrix
     * @name scale
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    scale(x: number, y: number): void;
    /**
     * not used by this renderer?
     * @ignore
     */
    setAntiAlias(context: any, enable: any): void;
    /**
     * Set the global alpha
     * @name setGlobalAlpha
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} alpha 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(alpha: number): void;
    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @name setColor
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Color|string} color css color string.
     */
    setColor(color: me.Color | string): void;
    /**
     * Set the line width
     * @name setLineWidth
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} width Line width
     */
    setLineWidth(width: number): void;
    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @name strokeArc
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     * @param {boolean} [fill=false]
     */
    strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean, fill?: boolean): void;
    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @name fillArc
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     */
    fillArc(x: number, y: number, radius: number, start: number, end: number): void;
    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @name strokeEllipse
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeEllipse(x: number, y: number, w: number, h: number, fill?: boolean): void;
    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @name fillEllipse
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     */
    fillEllipse(x: number, y: number, w: number, h: number): void;
    /**
     * Stroke a line of the given two points
     * @name strokeLine
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    strokeLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Fill a line of the given two points
     * @name fillLine
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    fillLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Stroke a me.Polygon on the screen with a specified color
     * @name strokePolygon
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokePolygon(poly: me.Polygon, fill?: boolean): void;
    /**
     * Fill a me.Polygon on the screen
     * @name fillPolygon
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     */
    fillPolygon(poly: me.Polygon): void;
    /**
     * Draw a stroke rectangle at the specified coordinates
     * @name strokeRect
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeRect(x: number, y: number, width: number, height: number, fill?: boolean): void;
    /**
     * Draw a filled rectangle at the specified coordinates
     * @name fillRect
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRect(x: number, y: number, width: number, height: number): void;
    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @name setTransform
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    setTransform(mat2d: me.Matrix2d): void;
    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @name transform
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    transform(mat2d: me.Matrix2d): void;
    /**
     * Translates the uniform matrix by the given coordinates
     * @name translate
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    translate(x: number, y: number): void;
    /**
     * clip the given region from the original canvas. Once a region is clipped,
     * all future drawing will be limited to the clipped region.
     * You can however save the current region using the save(),
     * and restore it (with the restore() method) any time in the future.
     * (<u>this is an experimental feature !</u>)
     * @name clipRect
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    clipRect(x: number, y: number, width: number, height: number): void;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @name setMask
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
     */
    setMask(mask?: me.Rect | me.Polygon | me.Line | me.Ellipse): void;
    /**
     * disable (remove) the rendering mask set through setMask.
     * @name clearMask
     * @see me.WebGLRenderer#setMask
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    clearMask(): void;
}
/**
 * @classdesc
 * an object representing the physic world, and responsible for managing and updating all childs and physics
 * @class World
 * @extends me.Container
 * @memberOf me
 * @constructor
 * @param {number} [x=0] position of the container (accessible via the inherited pos.x property)
 * @param {number} [y=0] position of the container (accessible via the inherited pos.y property)
 * @param {number} [w=me.game.viewport.width] width of the container
 * @param {number} [h=me.game.viewport.height] height of the container
 */
export class World {
    /**
     * @ignore
     */
    constructor(x?: number, y?: number, width?: number, height?: number);
    name: string;
    /**
     * the rate at which the game world is updated,
     * may be greater than or lower than the display fps
     * @public
     * @type {me.Vector2d}
     * @default 60
     * @name fps
     * @memberOf me.World
     * @see me.timer.maxfps
     */
    public fps: me.Vector2d;
    /**
     * world gravity
     * @public
     * @type {me.Vector2d}
     * @default <0,0.98>
     * @name gravity
     * @memberOf me.World
     */
    public gravity: me.Vector2d;
    /**
     * Specify the rendering method for tile layers. <br>
     * if false visible part of the layers are rendered dynamically,<br>
     * if true the entire layers are first rendered into an offscreen canvas.<br>
     * the "best" rendering method depends of your game
     * (amount of layer, layer size, amount of tiles per layer, etc.)<br>
     * note : rendering method is also configurable per layer by adding this
     * property to your layer (in Tiled).
     * @type {boolean}
     * @default false
     * @memberOf me.World
     */
    preRender: boolean;
    /**
     * the active physic bodies in this simulation
     * @name bodies
     * @memberOf me.World
     * @public
     * @type {Set}
     */
    public bodies: Set<any>;
    /**
     * the instance of the game world quadtree used for broadphase
     * @name broadphase
     * @memberOf me.World
     * @public
     * @type {me.QuadTree}
     */
    public broadphase: me.QuadTree;
    /**
     * reset the game world
     * @name reset
     * @memberOf me.World
     * @function
     */
    reset(): void;
    /**
     * Add a physic body to the game world
     * @name addBody
     * @memberOf me.World
     * @see me.Container.addChild
     * @function
     * @param {me.Body} body
     * @returns {me.World} this game world
     */
    addBody(body: me.Body): me.World;
    /**
     * Remove a physic body from the game world
     * @name removeBody
     * @memberOf me.World
     * @see me.Container.removeChild
     * @function
     * @param {me.Body} body
     * @returns {me.World} this game world
     */
    removeBody(body: me.Body): me.World;
    /**
     * update the game world
     * @name reset
     * @memberOf me.World
     * @function
     * @param {number} dt the time passed since the last frame update
     * @returns {boolean} true if the word is dirty
     */
    update(dt: number): boolean;
}
export var audio: Readonly<{
    __proto__: any;
    stopOnAudioError: boolean;
    init: typeof init$1;
    hasFormat: typeof hasFormat;
    hasAudio: typeof hasAudio;
    enable: typeof enable;
    disable: typeof disable;
    load: typeof load;
    play: typeof play;
    fade: typeof fade;
    seek: typeof seek;
    rate: typeof rate;
    stop: typeof stop;
    pause: typeof pause;
    resume: typeof resume;
    playTrack: typeof playTrack;
    stopTrack: typeof stopTrack;
    pauseTrack: typeof pauseTrack;
    resumeTrack: typeof resumeTrack;
    getCurrentTrack: typeof getCurrentTrack;
    setVolume: typeof setVolume;
    getVolume: typeof getVolume;
    mute: typeof mute;
    unmute: typeof unmute;
    muteAll: typeof muteAll;
    unmuteAll: typeof unmuteAll;
    muted: typeof muted;
    unload: typeof unload;
    unloadAll: typeof unloadAll;
}>;
/**
 * initialize the melonJS library.
 * this is automatically called unless me.skipAutoInit is set to true,
 * to allow asynchronous loaders to work.
 * @name boot
 * @memberOf me
 * @see me.skipAutoInit
 * @public
 * @function
 */
export function boot(): void;
export namespace collision {
    export const maxChildren: number;
    export const maxDepth: number;
    export namespace types {
        const NO_OBJECT: number;
        const PLAYER_OBJECT: number;
        const NPC_OBJECT: number;
        const ENEMY_OBJECT: number;
        const COLLECTABLE_OBJECT: number;
        const ACTION_OBJECT: number;
        const PROJECTILE_OBJECT: number;
        const WORLD_SHAPE: number;
        const USER: number;
        const ALL_OBJECT: number;
    }
    export { globalResponse as response };
    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Line} line line to be tested for collision
     * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
     * @returns {Array.<me.Renderable>} an array of intersecting physic objects
     * @example
     *    // define a line accross the viewport
     *    var ray = new me.Line(
     *        // absolute position of the line
     *        0, 0, [
     *        // starting point relative to the initial position
     *        new me.Vector2d(0, 0),
     *        // ending point
     *        new me.Vector2d(me.game.viewport.width, me.game.viewport.height)
     *    ]);
     *
     *    // check for collition
     *    result = me.collision.rayCast(ray);
     *
     *    if (result.length > 0) {
     *        // ...
     *    }
     */
    export function rayCast(line: me.Line, result?: me.Renderable[]): me.Renderable[];
    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Line} line line to be tested for collision
     * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
     * @returns {Array.<me.Renderable>} an array of intersecting physic objects
     * @example
     *    // define a line accross the viewport
     *    var ray = new me.Line(
     *        // absolute position of the line
     *        0, 0, [
     *        // starting point relative to the initial position
     *        new me.Vector2d(0, 0),
     *        // ending point
     *        new me.Vector2d(me.game.viewport.width, me.game.viewport.height)
     *    ]);
     *
     *    // check for collition
     *    result = me.collision.rayCast(ray);
     *
     *    if (result.length > 0) {
     *        // ...
     *    }
     */
    export function rayCast(line: me.Line, result?: me.Renderable[]): me.Renderable[];
}
export var deprecated: Readonly<{
    __proto__: any;
    warning: typeof warning;
    apply: typeof apply;
}>;
declare namespace device$1 {
    const ua: string;
    const localStorage: boolean;
    const hasAccelerometer: boolean;
    const hasDeviceOrientation: boolean;
    const ScreenOrientation: boolean;
    const hasFullscreenSupport: boolean;
    const hasPointerLockSupport: boolean;
    const hasWebAudio: boolean;
    const nativeBase64: boolean;
    const maxTouchPoints: number;
    const touch: boolean;
    const wheel: boolean;
    const isMobile: boolean;
    const iOS: boolean;
    const android: boolean;
    const android2: boolean;
    const linux: boolean;
    const ejecta: boolean;
    const isWeixin: boolean;
    const chromeOS: boolean;
    const wp: boolean;
    const BlackBerry: boolean;
    const Kindle: boolean;
    const accelerationX: number;
    const accelerationY: number;
    const accelerationZ: number;
    const gamma: number;
    const beta: number;
    const alpha: number;
    const language: string;
    const pauseOnBlur: boolean;
    const resumeOnFocus: boolean;
    const autoFocus: boolean;
    const stopOnBlur: boolean;
    const OffscreenCanvas: boolean;
    /**
     * specify a function to execute when the Device is fully loaded and ready
     * @function me.device.onReady
     * @param {Function} fn the function to be executed
     * @example
     * // small game skeleton
     * var game = {
     *    // called by the me.device.onReady function
     *    onload : function () {
     *       // init video
     *       if (!me.video.init('screen', 640, 480, true)) {
     *          alert("Sorry but your browser does not support html 5 canvas.");
     *          return;
     *       }
     *
     *       // initialize the "audio"
     *       me.audio.init("mp3,ogg");
     *
     *       // set callback for ressources loaded event
     *       me.loader.onload = this.loaded.bind(this);
     *
     *       // set all ressources to be loaded
     *       me.loader.preload(game.assets);
     *
     *       // load everything & display a loading screen
     *       me.state.change(me.state.LOADING);
     *    },
     *
     *    // callback when everything is loaded
     *    loaded : function () {
     *       // define stuff
     *       // ....
     *
     *       // change to the menu screen
     *       me.state.change(me.state.PLAY);
     *    }
     * }, // game
     *
     * // "bootstrap"
     * me.device.onReady(function () {
     *    game.onload();
     * });
     */
    function onReady(fn: Function): void;
    /**
     * specify a function to execute when the Device is fully loaded and ready
     * @function me.device.onReady
     * @param {Function} fn the function to be executed
     * @example
     * // small game skeleton
     * var game = {
     *    // called by the me.device.onReady function
     *    onload : function () {
     *       // init video
     *       if (!me.video.init('screen', 640, 480, true)) {
     *          alert("Sorry but your browser does not support html 5 canvas.");
     *          return;
     *       }
     *
     *       // initialize the "audio"
     *       me.audio.init("mp3,ogg");
     *
     *       // set callback for ressources loaded event
     *       me.loader.onload = this.loaded.bind(this);
     *
     *       // set all ressources to be loaded
     *       me.loader.preload(game.assets);
     *
     *       // load everything & display a loading screen
     *       me.state.change(me.state.LOADING);
     *    },
     *
     *    // callback when everything is loaded
     *    loaded : function () {
     *       // define stuff
     *       // ....
     *
     *       // change to the menu screen
     *       me.state.change(me.state.PLAY);
     *    }
     * }, // game
     *
     * // "bootstrap"
     * me.device.onReady(function () {
     *    game.onload();
     * });
     */
    function onReady(fn: Function): void;
    /**
     * enable/disable swipe on WebView.
     * @function me.device.enableSwipe
     * @param {boolean} [enable=true] enable or disable swipe.
     */
    function enableSwipe(enable?: boolean): void;
    /**
     * enable/disable swipe on WebView.
     * @function me.device.enableSwipe
     * @param {boolean} [enable=true] enable or disable swipe.
     */
    function enableSwipe(enable?: boolean): void;
    /**
     * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
     * @function me.device.requestFullscreen
     * @param {object} [element=default canvas object] the element to be set in full-screen mode.
     * @example
     * // add a keyboard shortcut to toggle Fullscreen mode on/off
     * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
     * me.event.on(me.event.KEYDOWN, function (action, keyCode, edge) {
     *    // toggle fullscreen on/off
     *    if (action === "toggleFullscreen") {
     *       if (!me.device.isFullscreen) {
     *          me.device.requestFullscreen();
     *       } else {
     *          me.device.exitFullscreen();
     *       }
     *    }
     * });
     */
    function requestFullscreen(element?: any): void;
    /**
     * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
     * @function me.device.requestFullscreen
     * @param {object} [element=default canvas object] the element to be set in full-screen mode.
     * @example
     * // add a keyboard shortcut to toggle Fullscreen mode on/off
     * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
     * me.event.on(me.event.KEYDOWN, function (action, keyCode, edge) {
     *    // toggle fullscreen on/off
     *    if (action === "toggleFullscreen") {
     *       if (!me.device.isFullscreen) {
     *          me.device.requestFullscreen();
     *       } else {
     *          me.device.exitFullscreen();
     *       }
     *    }
     * });
     */
    function requestFullscreen(element?: any): void;
    /**
     * Exit fullscreen mode. Requires fullscreen support from the browser/device.
     * @function me.device.exitFullscreen
     */
    function exitFullscreen(): void;
    /**
     * Exit fullscreen mode. Requires fullscreen support from the browser/device.
     * @function me.device.exitFullscreen
     */
    function exitFullscreen(): void;
    /**
     * Return a string representing the orientation of the device screen.
     * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
     * @function me.device.getScreenOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
     * @returns {string} the screen orientation
     */
    function getScreenOrientation(): string;
    /**
     * Return a string representing the orientation of the device screen.
     * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
     * @function me.device.getScreenOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
     * @returns {string} the screen orientation
     */
    function getScreenOrientation(): string;
    /**
     * locks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.lockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @param {string|string[]} orientation The orientation into which to lock the screen.
     * @returns {boolean} true if the orientation was unsuccessfully locked
     */
    function lockOrientation(orientation: string | string[]): boolean;
    /**
     * locks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.lockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @param {string|string[]} orientation The orientation into which to lock the screen.
     * @returns {boolean} true if the orientation was unsuccessfully locked
     */
    function lockOrientation(orientation: string | string[]): boolean;
    /**
     * unlocks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.unlockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @returns {boolean} true if the orientation was unsuccessfully unlocked
     */
    function unlockOrientation(): boolean;
    /**
     * unlocks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.unlockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @returns {boolean} true if the orientation was unsuccessfully unlocked
     */
    function unlockOrientation(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isPortrait
     * @returns {boolean}
     */
    function isPortrait(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isPortrait
     * @returns {boolean}
     */
    function isPortrait(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isLandscape
     * @returns {boolean}
     */
    function isLandscape(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isLandscape
     * @returns {boolean}
     */
    function isLandscape(): boolean;
    /**
     * return the device storage
     * @function me.device.getStorage
     * @see me.save
     * @param {string} [type="local"]
     * @returns {object} a reference to the device storage
     */
    function getStorage(type?: string): any;
    /**
     * return the device storage
     * @function me.device.getStorage
     * @see me.save
     * @param {string} [type="local"]
     * @returns {object} a reference to the device storage
     */
    function getStorage(type?: string): any;
    /**
     * return the parent DOM element for the given parent name or HTMLElement object
     * @function me.device.getParentElement
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the parent Element
     */
    function getParentElement(element: string | HTMLElement): HTMLElement;
    /**
     * return the parent DOM element for the given parent name or HTMLElement object
     * @function me.device.getParentElement
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the parent Element
     */
    function getParentElement(element: string | HTMLElement): HTMLElement;
    /**
     * return the DOM element for the given element name or HTMLElement object
     * @function me.device.getElement
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the corresponding DOM Element or null if not existing
     */
    function getElement(element: string | HTMLElement): HTMLElement;
    /**
     * return the DOM element for the given element name or HTMLElement object
     * @function me.device.getElement
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the corresponding DOM Element or null if not existing
     */
    function getElement(element: string | HTMLElement): HTMLElement;
    /**
     * returns the size of the given HTMLElement and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getElementBounds
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the element relatively to the viewport
     */
    function getElementBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns the size of the given HTMLElement and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getElementBounds
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the element relatively to the viewport
     */
    function getElementBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns the size of the given HTMLElement Parent and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getParentBounds
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the given element parent relative to the viewport
     */
    function getParentBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns the size of the given HTMLElement Parent and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getParentBounds
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the given element parent relative to the viewport
     */
    function getParentBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns true if the device supports WebGL
     * @function me.device.isWebGLSupported
     * @param {object} [options] context creation options
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @returns {boolean} true if WebGL is supported
     */
    function isWebGLSupported(options?: {
        failIfMajorPerformanceCaveat?: boolean;
    }): boolean;
    /**
     * returns true if the device supports WebGL
     * @function me.device.isWebGLSupported
     * @param {object} [options] context creation options
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @returns {boolean} true if WebGL is supported
     */
    function isWebGLSupported(options?: {
        failIfMajorPerformanceCaveat?: boolean;
    }): boolean;
    /**
     * return the highest precision format supported by this device for GL Shaders
     * @function me.device.getMaxShaderPrecision
     * @param {WebGLRenderingContext} gl
     * @returns {boolean} "lowp", "mediump", or "highp"
     */
    function getMaxShaderPrecision(gl: WebGLRenderingContext): boolean;
    /**
     * return the highest precision format supported by this device for GL Shaders
     * @function me.device.getMaxShaderPrecision
     * @param {WebGLRenderingContext} gl
     * @returns {boolean} "lowp", "mediump", or "highp"
     */
    function getMaxShaderPrecision(gl: WebGLRenderingContext): boolean;
    /**
     * Makes a request to bring this device window to the front.
     * @function me.device.focus
     * @example
     *  if (clicked) {
     *    me.device.focus();
     *  }
     */
    function focus(): void;
    /**
     * Makes a request to bring this device window to the front.
     * @function me.device.focus
     * @example
     *  if (clicked) {
     *    me.device.focus();
     *  }
     */
    function focus(): void;
    /**
     * event management (Accelerometer)
     * http://www.mobilexweb.com/samples/ball.html
     * http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5
     * @ignore
     */
    function onDeviceMotion(e: any): void;
    /**
     * event management (Accelerometer)
     * http://www.mobilexweb.com/samples/ball.html
     * http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5
     * @ignore
     */
    function onDeviceMotion(e: any): void;
    /**
     * event management (Accelerometer)
     * @ignore
     */
    function onDeviceRotate(e: any): void;
    /**
     * event management (Accelerometer)
     * @ignore
     */
    function onDeviceRotate(e: any): void;
    /**
     * Enters pointer lock, requesting it from the user first. Works on supported devices & browsers
     * Must be called in a click event or an event that requires user interaction.
     * If you need to run handle events for errors or change of the pointer lock, see below.
     * @function me.device.turnOnPointerLock
     * @example
     * document.addEventListener("pointerlockchange", pointerlockchange, false);
     * document.addEventListener("mozpointerlockchange", pointerlockchange, false);
     * document.addEventListener("webkitpointerlockchange", pointerlockchange, false);
     *
     * document.addEventListener("pointerlockerror", pointerlockerror, false);
     * document.addEventListener("mozpointerlockerror", pointerlockerror, false);
     * document.addEventListener("webkitpointerlockerror", pointerlockerror, false);
     */
    function turnOnPointerLock(): void;
    /**
     * Enters pointer lock, requesting it from the user first. Works on supported devices & browsers
     * Must be called in a click event or an event that requires user interaction.
     * If you need to run handle events for errors or change of the pointer lock, see below.
     * @function me.device.turnOnPointerLock
     * @example
     * document.addEventListener("pointerlockchange", pointerlockchange, false);
     * document.addEventListener("mozpointerlockchange", pointerlockchange, false);
     * document.addEventListener("webkitpointerlockchange", pointerlockchange, false);
     *
     * document.addEventListener("pointerlockerror", pointerlockerror, false);
     * document.addEventListener("mozpointerlockerror", pointerlockerror, false);
     * document.addEventListener("webkitpointerlockerror", pointerlockerror, false);
     */
    function turnOnPointerLock(): void;
    /**
     * Exits pointer lock. Works on supported devices & browsers
     * @function me.device.turnOffPointerLock
     * @function
     */
    function turnOffPointerLock(): void;
    /**
     * Exits pointer lock. Works on supported devices & browsers
     * @function me.device.turnOffPointerLock
     * @function
     */
    function turnOffPointerLock(): void;
    /**
     * Enable monitor of the device accelerator to detect the amount of physical force of acceleration the device is receiving.
     * (one some device a first user gesture will be required before calling this function)
     * @function me.device.watchAccelerometer
     * @see me.device.accelerationX
     * @see me.device.accelerationY
     * @see me.device.accelerationZ
     * @returns {boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device accelerometer event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchAccelerometer() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device accelerometer event
     *     }
     * });
     */
    function watchAccelerometer(): boolean;
    /**
     * Enable monitor of the device accelerator to detect the amount of physical force of acceleration the device is receiving.
     * (one some device a first user gesture will be required before calling this function)
     * @function me.device.watchAccelerometer
     * @see me.device.accelerationX
     * @see me.device.accelerationY
     * @see me.device.accelerationZ
     * @returns {boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device accelerometer event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchAccelerometer() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device accelerometer event
     *     }
     * });
     */
    function watchAccelerometer(): boolean;
    /**
     * unwatch Accelerometor event
     * @function me.device.unwatchAccelerometer
     */
    function unwatchAccelerometer(): void;
    /**
     * unwatch Accelerometor event
     * @function me.device.unwatchAccelerometer
     */
    function unwatchAccelerometer(): void;
    /**
     * Enable monitor of the device orientation to detect the current orientation of the device as compared to the Earth coordinate frame.
     * (one some device a first user gesture will be required before calling this function)
     * @function me.device.watchDeviceOrientation
     * @see me.device.alpha
     * @see me.device.beta
     * @see me.device.gamma
     * @returns {boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device orientation event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchDeviceOrientation() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device orientation event
     *     }
     * });
     */
    function watchDeviceOrientation(): boolean;
    /**
     * Enable monitor of the device orientation to detect the current orientation of the device as compared to the Earth coordinate frame.
     * (one some device a first user gesture will be required before calling this function)
     * @function me.device.watchDeviceOrientation
     * @see me.device.alpha
     * @see me.device.beta
     * @see me.device.gamma
     * @returns {boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device orientation event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchDeviceOrientation() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device orientation event
     *     }
     * });
     */
    function watchDeviceOrientation(): boolean;
    /**
     * unwatch Device orientation event
     * @function me.device.unwatchDeviceOrientation
     */
    function unwatchDeviceOrientation(): void;
    /**
     * unwatch Device orientation event
     * @function me.device.unwatchDeviceOrientation
     */
    function unwatchDeviceOrientation(): void;
    /**
     * the vibrate method pulses the vibration hardware on the device, <br>
     * If the device doesn't support vibration, this method has no effect. <br>
     * If a vibration pattern is already in progress when this method is called,
     * the previous pattern is halted and the new one begins instead.
     * @function me.device.vibrate
     * @param {number|number[]} pattern pattern of vibration and pause intervals
     * @example
     * // vibrate for 1000 ms
     * me.device.vibrate(1000);
     * // or alternatively
     * me.device.vibrate([1000]);
     * // vibrate for 50 ms, be still for 100 ms, and then vibrate for 150 ms:
     * me.device.vibrate([50, 100, 150]);
     * // cancel any existing vibrations
     * me.device.vibrate(0);
     */
    function vibrate(pattern: number | number[]): void;
    /**
     * the vibrate method pulses the vibration hardware on the device, <br>
     * If the device doesn't support vibration, this method has no effect. <br>
     * If a vibration pattern is already in progress when this method is called,
     * the previous pattern is halted and the new one begins instead.
     * @function me.device.vibrate
     * @param {number|number[]} pattern pattern of vibration and pause intervals
     * @example
     * // vibrate for 1000 ms
     * me.device.vibrate(1000);
     * // or alternatively
     * me.device.vibrate([1000]);
     * // vibrate for 50 ms, be still for 100 ms, and then vibrate for 150 ms:
     * me.device.vibrate([50, 100, 150]);
     * // cancel any existing vibrations
     * me.device.vibrate(0);
     */
    function vibrate(pattern: number | number[]): void;
}
export var event: Readonly<{
    __proto__: any;
    BOOT: string;
    STATE_PAUSE: string;
    STATE_RESUME: string;
    STATE_STOP: string;
    STATE_RESTART: string;
    VIDEO_INIT: string;
    GAME_INIT: string;
    GAME_RESET: string;
    GAME_BEFORE_UPDATE: string;
    GAME_AFTER_UPDATE: string;
    GAME_UPDATE: string;
    GAME_BEFORE_DRAW: string;
    GAME_AFTER_DRAW: string;
    LEVEL_LOADED: string;
    LOADER_COMPLETE: string;
    LOADER_PROGRESS: string;
    KEYDOWN: string;
    KEYUP: string;
    GAMEPAD_CONNECTED: string;
    GAMEPAD_DISCONNECTED: string;
    GAMEPAD_UPDATE: string;
    POINTERMOVE: string;
    DRAGSTART: string;
    DRAGEND: string;
    WINDOW_ONRESIZE: string;
    CANVAS_ONRESIZE: string;
    VIEWPORT_ONRESIZE: string;
    WINDOW_ONORIENTATION_CHANGE: string;
    WINDOW_ONSCROLL: string;
    VIEWPORT_ONCHANGE: string;
    WEBGL_ONCONTEXT_LOST: string;
    WEBGL_ONCONTEXT_RESTORED: string;
    emit: typeof emit;
    on: typeof on;
    once: typeof once;
    off: typeof off;
}>;
export var game: Readonly<{
    __proto__: any;
    readonly viewport: me.Camera2d;
    readonly world: me.World;
    mergeGroup: boolean;
    sortOn: string;
    readonly lastUpdate: number;
    onLevelLoaded: typeof onLevelLoaded;
    reset: typeof reset;
    updateFrameRate: typeof updateFrameRate;
    getParentContainer: typeof getParentContainer;
    repaint: typeof repaint;
    update: typeof update$1;
    draw: typeof draw;
}>;
/**
 * a flag indicating that melonJS is fully initialized
 * @type {boolean}
 * @default false
 * @readonly
 * @memberOf me
 */
export var initialized: boolean;
export var input: Readonly<{
    __proto__: any;
    preventDefault: boolean;
    readonly pointerEventTarget: EventTarget;
    pointer: me.Rect;
    readonly throttlingInterval: number;
    globalToLocal: typeof globalToLocal;
    setTouchAction: typeof setTouchAction;
    bindPointer: typeof bindPointer;
    unbindPointer: typeof unbindPointer;
    registerPointerEvent: typeof registerPointerEvent;
    releasePointerEvent: typeof releasePointerEvent;
    releaseAllPointerEvents: typeof releaseAllPointerEvents;
    readonly keyBoardEventTarget: EventTarget;
    KEY: {
        /** @memberOf me.input.KEY */
        BACKSPACE: number;
        /** @memberOf me.input.KEY */
        TAB: number;
        /** @memberOf me.input.KEY */
        ENTER: number;
        /** @memberOf me.input.KEY */
        SHIFT: number;
        /** @memberOf me.input.KEY */
        CTRL: number;
        /** @memberOf me.input.KEY */
        ALT: number;
        /** @memberOf me.input.KEY */
        PAUSE: number;
        /** @memberOf me.input.KEY */
        CAPS_LOCK: number;
        /** @memberOf me.input.KEY */
        ESC: number;
        /** @memberOf me.input.KEY */
        SPACE: number;
        /** @memberOf me.input.KEY */
        PAGE_UP: number;
        /** @memberOf me.input.KEY */
        PAGE_DOWN: number;
        /** @memberOf me.input.KEY */
        END: number;
        /** @memberOf me.input.KEY */
        HOME: number;
        /** @memberOf me.input.KEY */
        LEFT: number;
        /** @memberOf me.input.KEY */
        UP: number;
        /** @memberOf me.input.KEY */
        RIGHT: number;
        /** @memberOf me.input.KEY */
        DOWN: number;
        /** @memberOf me.input.KEY */
        PRINT_SCREEN: number;
        /** @memberOf me.input.KEY */
        INSERT: number;
        /** @memberOf me.input.KEY */
        DELETE: number;
        /** @memberOf me.input.KEY */
        NUM0: number;
        /** @memberOf me.input.KEY */
        NUM1: number;
        /** @memberOf me.input.KEY */
        NUM2: number;
        /** @memberOf me.input.KEY */
        NUM3: number;
        /** @memberOf me.input.KEY */
        NUM4: number;
        /** @memberOf me.input.KEY */
        NUM5: number;
        /** @memberOf me.input.KEY */
        NUM6: number;
        /** @memberOf me.input.KEY */
        NUM7: number;
        /** @memberOf me.input.KEY */
        NUM8: number;
        /** @memberOf me.input.KEY */
        NUM9: number;
        /** @memberOf me.input.KEY */
        A: number;
        /** @memberOf me.input.KEY */
        B: number;
        /** @memberOf me.input.KEY */
        C: number;
        /** @memberOf me.input.KEY */
        D: number;
        /** @memberOf me.input.KEY */
        E: number;
        /** @memberOf me.input.KEY */
        F: number;
        /** @memberOf me.input.KEY */
        G: number;
        /** @memberOf me.input.KEY */
        H: number;
        /** @memberOf me.input.KEY */
        I: number;
        /** @memberOf me.input.KEY */
        J: number;
        /** @memberOf me.input.KEY */
        K: number;
        /** @memberOf me.input.KEY */
        L: number;
        /** @memberOf me.input.KEY */
        M: number;
        /** @memberOf me.input.KEY */
        N: number;
        /** @memberOf me.input.KEY */
        O: number;
        /** @memberOf me.input.KEY */
        P: number;
        /** @memberOf me.input.KEY */
        Q: number;
        /** @memberOf me.input.KEY */
        R: number;
        /** @memberOf me.input.KEY */
        S: number;
        /** @memberOf me.input.KEY */
        T: number;
        /** @memberOf me.input.KEY */
        U: number;
        /** @memberOf me.input.KEY */
        V: number;
        /** @memberOf me.input.KEY */
        W: number;
        /** @memberOf me.input.KEY */
        X: number;
        /** @memberOf me.input.KEY */
        Y: number;
        /** @memberOf me.input.KEY */
        Z: number;
        /** @memberOf me.input.KEY */
        WINDOW_KEY: number;
        /** @memberOf me.input.KEY */
        NUMPAD0: number;
        /** @memberOf me.input.KEY */
        NUMPAD1: number;
        /** @memberOf me.input.KEY */
        NUMPAD2: number;
        /** @memberOf me.input.KEY */
        NUMPAD3: number;
        /** @memberOf me.input.KEY */
        NUMPAD4: number;
        /** @memberOf me.input.KEY */
        NUMPAD5: number;
        /** @memberOf me.input.KEY */
        NUMPAD6: number;
        /** @memberOf me.input.KEY */
        NUMPAD7: number;
        /** @memberOf me.input.KEY */
        NUMPAD8: number;
        /** @memberOf me.input.KEY */
        NUMPAD9: number;
        /** @memberOf me.input.KEY */
        MULTIPLY: number;
        /** @memberOf me.input.KEY */
        ADD: number;
        /** @memberOf me.input.KEY */
        SUBSTRACT: number;
        /** @memberOf me.input.KEY */
        DECIMAL: number;
        /** @memberOf me.input.KEY */
        DIVIDE: number;
        /** @memberOf me.input.KEY */
        F1: number;
        /** @memberOf me.input.KEY */
        F2: number;
        /** @memberOf me.input.KEY */
        F3: number;
        /** @memberOf me.input.KEY */
        F4: number;
        /** @memberOf me.input.KEY */
        F5: number;
        /** @memberOf me.input.KEY */
        F6: number;
        /** @memberOf me.input.KEY */
        F7: number;
        /** @memberOf me.input.KEY */
        F8: number;
        /** @memberOf me.input.KEY */
        F9: number;
        /** @memberOf me.input.KEY */
        F10: number;
        /** @memberOf me.input.KEY */
        F11: number;
        /** @memberOf me.input.KEY */
        F12: number;
        /** @memberOf me.input.KEY */
        TILDE: number;
        /** @memberOf me.input.KEY */
        NUM_LOCK: number;
        /** @memberOf me.input.KEY */
        SCROLL_LOCK: number;
        /** @memberOf me.input.KEY */
        SEMICOLON: number;
        /** @memberOf me.input.KEY */
        PLUS: number;
        /** @memberOf me.input.KEY */
        COMMA: number;
        /** @memberOf me.input.KEY */
        MINUS: number;
        /** @memberOf me.input.KEY */
        PERIOD: number;
        /** @memberOf me.input.KEY */
        FORWAND_SLASH: number;
        /** @memberOf me.input.KEY */
        GRAVE_ACCENT: number;
        /** @memberOf me.input.KEY */
        OPEN_BRACKET: number;
        /** @memberOf me.input.KEY */
        BACK_SLASH: number;
        /** @memberOf me.input.KEY */
        CLOSE_BRACKET: number;
        /** @memberOf me.input.KEY */
        SINGLE_QUOTE: number;
    };
    initKeyboardEvent: typeof initKeyboardEvent;
    isKeyPressed: typeof isKeyPressed;
    keyStatus: typeof keyStatus;
    triggerKeyEvent: typeof triggerKeyEvent;
    bindKey: typeof bindKey;
    getBindingKey: typeof getBindingKey;
    unlockKey: typeof unlockKey;
    unbindKey: typeof unbindKey;
    GAMEPAD: {
        /**
         * Standard gamepad mapping information for axes<br>
         * <ul>
         *   <li>Left control stick: <code>LX</code> (horizontal), <code>LY</code> (vertical)</li>
         *   <li>Right control stick: <code>RX</code> (horizontal), <code>RY</code> (vertical)</li>
         *   <li>Extras: <code>EXTRA_1</code>, <code>EXTRA_2</code>, <code>EXTRA_3</code>, <code>EXTRA_4</code></li>
         * </ul>
         * @public
         * @name AXES
         * @enum {number}
         * @memberOf me.input.GAMEPAD
         * @see https://w3c.github.io/gamepad/#remapping
         */
        AXES: {
            LX: number;
            LY: number;
            RX: number;
            RY: number;
            EXTRA_1: number;
            EXTRA_2: number;
            EXTRA_3: number;
            EXTRA_4: number;
        };
        /**
         * Standard gamepad mapping information for buttons<br>
         * <ul>
         *   <li>Face buttons: <code>FACE_1</code>, <code>FACE_2</code>, <code>FACE_3</code>, <code>FACE_4</code></li>
         *   <li>D-Pad: <code>UP</code>, <code>DOWN</code>, <code>LEFT</code>, <code>RIGHT</code></li>
         *   <li>Shoulder buttons: <code>L1</code>, <code>L2</code>, <code>R1</code>, <code>R2</code></li>
         *   <li>Analog stick (clicks): <code>L3</code>, <code>R3</code></li>
         *   <li>Navigation: <code>SELECT</code> (<code>BACK</code>), <code>START</code> (<code>FORWARD</code>), <code>HOME</code></li>
         *   <li>Extras: <code>EXTRA_1</code>, <code>EXTRA_2</code>, <code>EXTRA_3</code>, <code>EXTRA_4</code></li>
         * </ul>
         * @public
         * @name BUTTONS
         * @enum {number}
         * @memberOf me.input.GAMEPAD
         * @see https://w3c.github.io/gamepad/#remapping
         */
        BUTTONS: {
            FACE_1: number;
            FACE_2: number;
            FACE_3: number;
            FACE_4: number;
            L1: number;
            R1: number;
            L2: number;
            R2: number;
            SELECT: number;
            BACK: number;
            START: number;
            FORWARD: number;
            L3: number;
            R3: number;
            UP: number;
            DOWN: number;
            LEFT: number;
            RIGHT: number;
            HOME: number;
            EXTRA_1: number;
            EXTRA_2: number;
            EXTRA_3: number;
            EXTRA_4: number;
        };
    };
    bindGamepad: typeof bindGamepad;
    unbindGamepad: typeof unbindGamepad;
    setGamepadDeadzone: typeof setGamepadDeadzone;
    setGamepadMapping: typeof addMapping;
}>;
export namespace level {
    /**
     * add a level into the game manager (usually called by the preloader)
     * @name add
     * @memberOf me.level
     * @public
     * @function
     * @param {string} format level format (only "tmx" supported)
     * @param {string} levelId the level id (or name)
     * @param {Function} [callback] a function to be called once the level is loaded
     * @returns {boolean} true if the level was loaded
     */
    function add(format: string, levelId: string, callback?: Function): boolean;
    /**
     * add a level into the game manager (usually called by the preloader)
     * @name add
     * @memberOf me.level
     * @public
     * @function
     * @param {string} format level format (only "tmx" supported)
     * @param {string} levelId the level id (or name)
     * @param {Function} [callback] a function to be called once the level is loaded
     * @returns {boolean} true if the level was loaded
     */
    function add(format: string, levelId: string, callback?: Function): boolean;
    /**
     * load a level into the game manager<br>
     * (will also create all level defined entities, etc..)
     * @name load
     * @memberOf me.level
     * @public
     * @function
     * @param {string} levelId level id
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @param {boolean} [options.setViewportBounds=true] if true, set the viewport bounds to the map size
     * @returns {boolean} true if the level was successfully loaded
     * @example
     * // the game assets to be be preloaded
     * // TMX maps
     * var resources = [
     *     {name: "a4_level1",   type: "tmx",   src: "data/level/a4_level1.tmx"},
     *     {name: "a4_level2",   type: "tmx",   src: "data/level/a4_level2.tmx"},
     *     {name: "a4_level3",   type: "tmx",   src: "data/level/a4_level3.tmx"},
     *     // ...
     * ];
     *
     * // ...
     *
     * // load a level into the game world
     * me.level.load("a4_level1");
     * ...
     * ...
     * // load a level into a specific container
     * var levelContainer = new me.Container();
     * me.level.load("a4_level2", {container:levelContainer});
     * // add a simple transformation
     * levelContainer.currentTransform.translate(levelContainer.width / 2, levelContainer.height / 2 );
     * levelContainer.currentTransform.rotate(0.05);
     * levelContainer.currentTransform.translate(-levelContainer.width / 2, -levelContainer.height / 2 );
     * // add it to the game world
     * me.game.world.addChild(levelContainer);
     */
    function load(levelId: string, options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
        setViewportBounds?: boolean;
    }): boolean;
    /**
     * load a level into the game manager<br>
     * (will also create all level defined entities, etc..)
     * @name load
     * @memberOf me.level
     * @public
     * @function
     * @param {string} levelId level id
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @param {boolean} [options.setViewportBounds=true] if true, set the viewport bounds to the map size
     * @returns {boolean} true if the level was successfully loaded
     * @example
     * // the game assets to be be preloaded
     * // TMX maps
     * var resources = [
     *     {name: "a4_level1",   type: "tmx",   src: "data/level/a4_level1.tmx"},
     *     {name: "a4_level2",   type: "tmx",   src: "data/level/a4_level2.tmx"},
     *     {name: "a4_level3",   type: "tmx",   src: "data/level/a4_level3.tmx"},
     *     // ...
     * ];
     *
     * // ...
     *
     * // load a level into the game world
     * me.level.load("a4_level1");
     * ...
     * ...
     * // load a level into a specific container
     * var levelContainer = new me.Container();
     * me.level.load("a4_level2", {container:levelContainer});
     * // add a simple transformation
     * levelContainer.currentTransform.translate(levelContainer.width / 2, levelContainer.height / 2 );
     * levelContainer.currentTransform.rotate(0.05);
     * levelContainer.currentTransform.translate(-levelContainer.width / 2, -levelContainer.height / 2 );
     * // add it to the game world
     * me.game.world.addChild(levelContainer);
     */
    function load(levelId: string, options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
        setViewportBounds?: boolean;
    }): boolean;
    /**
     * return the current level id<br>
     * @name getCurrentLevelId
     * @memberOf me.level
     * @public
     * @function
     * @returns {string}
     */
    function getCurrentLevelId(): string;
    /**
     * return the current level id<br>
     * @name getCurrentLevelId
     * @memberOf me.level
     * @public
     * @function
     * @returns {string}
     */
    function getCurrentLevelId(): string;
    /**
     * return the current level definition.
     * for a reference to the live instantiated level,
     * rather use the container in which it was loaded (e.g. me.game.world)
     * @name getCurrentLevel
     * @memberOf me.level
     * @public
     * @function
     * @returns {me.TMXTileMap}
     */
    function getCurrentLevel(): me.TMXTileMap;
    /**
     * return the current level definition.
     * for a reference to the live instantiated level,
     * rather use the container in which it was loaded (e.g. me.game.world)
     * @name getCurrentLevel
     * @memberOf me.level
     * @public
     * @function
     * @returns {me.TMXTileMap}
     */
    function getCurrentLevel(): me.TMXTileMap;
    /**
     * reload the current level
     * @name reload
     * @memberOf me.level
     * @public
     * @function
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @returns {object} the current level
     */
    function reload(options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
    }): any;
    /**
     * reload the current level
     * @name reload
     * @memberOf me.level
     * @public
     * @function
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @returns {object} the current level
     */
    function reload(options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
    }): any;
    /**
     * load the next level
     * @name next
     * @memberOf me.level
     * @public
     * @function
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @returns {boolean} true if the next level was successfully loaded
     */
    function next(options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * load the next level
     * @name next
     * @memberOf me.level
     * @public
     * @function
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @returns {boolean} true if the next level was successfully loaded
     */
    function next(options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * load the previous level<br>
     * @name previous
     * @memberOf me.level
     * @public
     * @function
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @returns {boolean} true if the previous level was successfully loaded
     */
    function previous(options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * load the previous level<br>
     * @name previous
     * @memberOf me.level
     * @public
     * @function
     * @param {object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {Function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @returns {boolean} true if the previous level was successfully loaded
     */
    function previous(options?: {
        container?: me.Container;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * return the amount of level preloaded
     * @name levelCount
     * @memberOf me.level
     * @public
     * @function
     * @returns {number} the amount of level preloaded
     */
    function levelCount(): number;
    /**
     * return the amount of level preloaded
     * @name levelCount
     * @memberOf me.level
     * @public
     * @function
     * @returns {number} the amount of level preloaded
     */
    function levelCount(): number;
}
export namespace loader {
    const nocache: string;
    const onload: any;
    const onProgress: any;
    const crossOrigin: string;
    const withCredentials: boolean;
    /**
     * just increment the number of already loaded resources
     * @ignore
     */
    function onResourceLoaded(res: any): void;
    /**
     * just increment the number of already loaded resources
     * @ignore
     */
    function onResourceLoaded(res: any): void;
    /**
     * on error callback for image loading
     * @ignore
     */
    function onLoadingError(res: any): never;
    /**
     * on error callback for image loading
     * @ignore
     */
    function onLoadingError(res: any): never;
    /**
     * enable the nocache mechanism
     * @ignore
     */
    function setNocache(enable: any): void;
    /**
     * enable the nocache mechanism
     * @ignore
     */
    function setNocache(enable: any): void;
    /**
     * change the default baseURL for the given asset type.<br>
     * (this will prepend the asset URL and must finish with a '/')
     * @name setBaseURL
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} type  "*", "audio", binary", "image", "json", "js", "tmx", "tsx"
     * @param {string} [url="./"] default base URL
     * @example
     * // change the base URL relative address for audio assets
     * me.loader.setBaseURL("audio", "data/audio/");
     * // change the base URL absolute address for all object types
     * me.loader.setBaseURL("*", "http://myurl.com/")
     */
    function setBaseURL(type: string, url?: string): void;
    /**
     * change the default baseURL for the given asset type.<br>
     * (this will prepend the asset URL and must finish with a '/')
     * @name setBaseURL
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} type  "*", "audio", binary", "image", "json", "js", "tmx", "tsx"
     * @param {string} [url="./"] default base URL
     * @example
     * // change the base URL relative address for audio assets
     * me.loader.setBaseURL("audio", "data/audio/");
     * // change the base URL absolute address for all object types
     * me.loader.setBaseURL("*", "http://myurl.com/")
     */
    function setBaseURL(type: string, url?: string): void;
    /**
     * set all the specified game resources to be preloaded.
     * @name preload
     * @memberOf me.loader
     * @public
     * @function
     * @param {object[]} res
     * @param {string} res.name internal name of the resource
     * @param {string} res.type  "audio", binary", "image", "json","js", "tmx", "tsx", "fontface"
     * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {Function} [onload=me.loader.onload] function to be called when all resources are loaded
     * @param {boolean} [switchToLoadState=true] automatically switch to the loading screen
     * @example
     * game_resources = [
     *   // PNG tileset
     *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"},
     *   // PNG packed texture
     *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
     *   // TSX file
     *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"},
     *   // TMX level (XML & JSON)
     *   {name: "map1", type: "tmx", src: "data/map/map1.json"},
     *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"},
     *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}},
     *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}},
     *   // audio resources
     *   {name: "bgmusic", type: "audio",  src: "data/audio/"},
     *   {name: "cling",   type: "audio",  src: "data/audio/"},
     *   // binary file
     *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"},
     *   // JSON file (used for texturePacker)
     *   {name: "texture", type: "json", src: "data/gfx/texture.json"},
     *   // JavaScript file
     *   {name: "plugin", type: "js", src: "data/js/plugin.js"},
     *   // Font Face
     *   { name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')" }
     * ];
     * ...
     * // set all resources to be loaded
     * me.loader.preload(game.resources, this.loaded.bind(this));
     */
    function preload(res: {
        name: string;
        type: string;
        src: string;
        stream?: boolean;
    }[], onload?: Function, switchToLoadState?: boolean): void;
    /**
     * set all the specified game resources to be preloaded.
     * @name preload
     * @memberOf me.loader
     * @public
     * @function
     * @param {object[]} res
     * @param {string} res.name internal name of the resource
     * @param {string} res.type  "audio", binary", "image", "json","js", "tmx", "tsx", "fontface"
     * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {Function} [onload=me.loader.onload] function to be called when all resources are loaded
     * @param {boolean} [switchToLoadState=true] automatically switch to the loading screen
     * @example
     * game_resources = [
     *   // PNG tileset
     *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"},
     *   // PNG packed texture
     *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
     *   // TSX file
     *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"},
     *   // TMX level (XML & JSON)
     *   {name: "map1", type: "tmx", src: "data/map/map1.json"},
     *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"},
     *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}},
     *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}},
     *   // audio resources
     *   {name: "bgmusic", type: "audio",  src: "data/audio/"},
     *   {name: "cling",   type: "audio",  src: "data/audio/"},
     *   // binary file
     *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"},
     *   // JSON file (used for texturePacker)
     *   {name: "texture", type: "json", src: "data/gfx/texture.json"},
     *   // JavaScript file
     *   {name: "plugin", type: "js", src: "data/js/plugin.js"},
     *   // Font Face
     *   { name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')" }
     * ];
     * ...
     * // set all resources to be loaded
     * me.loader.preload(game.resources, this.loaded.bind(this));
     */
    function preload(res: {
        name: string;
        type: string;
        src: string;
        stream?: boolean;
    }[], onload?: Function, switchToLoadState?: boolean): void;
    /**
     * Load a single resource (to be used if you need to load additional resource during the game)
     * @name load
     * @memberOf me.loader
     * @public
     * @function
     * @param {object} res
     * @param {string} res.name internal name of the resource
     * @param {string} res.type  "audio", binary", "image", "json", "tmx", "tsx"
     * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {Function} onload function to be called when the resource is loaded
     * @param {Function} onerror function to be called in case of error
     * @returns {number} the amount of corresponding resource to be preloaded
     * @example
     * // load an image asset
     * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, this.onload.bind(this), this.onerror.bind(this));
     *
     * // start loading music
     * me.loader.load({
     *     name   : "bgmusic",
     *     type   : "audio",
     *     src    : "data/audio/"
     * }, function () {
     *     me.audio.play("bgmusic");
     * });
     */
    function load(res: {
        name: string;
        type: string;
        src: string;
        stream?: boolean;
    }, onload: Function, onerror: Function): number;
    /**
     * Load a single resource (to be used if you need to load additional resource during the game)
     * @name load
     * @memberOf me.loader
     * @public
     * @function
     * @param {object} res
     * @param {string} res.name internal name of the resource
     * @param {string} res.type  "audio", binary", "image", "json", "tmx", "tsx"
     * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {Function} onload function to be called when the resource is loaded
     * @param {Function} onerror function to be called in case of error
     * @returns {number} the amount of corresponding resource to be preloaded
     * @example
     * // load an image asset
     * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, this.onload.bind(this), this.onerror.bind(this));
     *
     * // start loading music
     * me.loader.load({
     *     name   : "bgmusic",
     *     type   : "audio",
     *     src    : "data/audio/"
     * }, function () {
     *     me.audio.play("bgmusic");
     * });
     */
    function load(res: {
        name: string;
        type: string;
        src: string;
        stream?: boolean;
    }, onload: Function, onerror: Function): number;
    /**
     * unload specified resource to free memory
     * @name unload
     * @memberOf me.loader
     * @public
     * @function
     * @param {object} res
     * @returns {boolean} true if unloaded
     * @example me.loader.unload({name: "avatar",  type:"image",  src: "data/avatar.png"});
     */
    function unload(res: any): boolean;
    /**
     * unload specified resource to free memory
     * @name unload
     * @memberOf me.loader
     * @public
     * @function
     * @param {object} res
     * @returns {boolean} true if unloaded
     * @example me.loader.unload({name: "avatar",  type:"image",  src: "data/avatar.png"});
     */
    function unload(res: any): boolean;
    /**
     * unload all resources to free memory
     * @name unloadAll
     * @memberOf me.loader
     * @public
     * @function
     * @example me.loader.unloadAll();
     */
    function unloadAll(): void;
    /**
     * unload all resources to free memory
     * @name unloadAll
     * @memberOf me.loader
     * @public
     * @function
     * @example me.loader.unloadAll();
     */
    function unloadAll(): void;
    /**
     * return the specified TMX/TSX object
     * @name getTMX
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} elt name of the tmx/tsx element ("map1");
     * @returns {object} requested element or null if not found
     */
    function getTMX(elt: string): any;
    /**
     * return the specified TMX/TSX object
     * @name getTMX
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} elt name of the tmx/tsx element ("map1");
     * @returns {object} requested element or null if not found
     */
    function getTMX(elt: string): any;
    /**
     * return the specified Binary object
     * @name getBinary
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} elt name of the binary object ("ymTrack");
     * @returns {object} requested element or null if not found
     */
    function getBinary(elt: string): any;
    /**
     * return the specified Binary object
     * @name getBinary
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} elt name of the binary object ("ymTrack");
     * @returns {object} requested element or null if not found
     */
    function getBinary(elt: string): any;
    /**
     * return the specified Image Object
     * @name getImage
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} image name of the Image element ("tileset-platformer");
     * @returns {HTMLImageElement} requested element or null if not found
     */
    function getImage(image: string): HTMLImageElement;
    /**
     * return the specified Image Object
     * @name getImage
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} image name of the Image element ("tileset-platformer");
     * @returns {HTMLImageElement} requested element or null if not found
     */
    function getImage(image: string): HTMLImageElement;
    /**
     * return the specified JSON Object
     * @name getJSON
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} elt name of the json file to load
     * @returns {object}
     */
    function getJSON(elt: string): any;
    /**
     * return the specified JSON Object
     * @name getJSON
     * @memberOf me.loader
     * @public
     * @function
     * @param {string} elt name of the json file to load
     * @returns {object}
     */
    function getJSON(elt: string): any;
}
export namespace plugin {
    export { BasePlugin as Base };
    export function patch(proto: any, name: string, fn: Function): void;
    export function register(pluginObj: me.plugin.Base, name: string, ...args: any[]): void;
}
/**
 * This namespace is a container for all registered plugins.
 * @see me.plugin.register
 * @namespace me.plugins
 * @memberOf me
 */
export var plugins: {};
export namespace pool {
    /**
     * register an object to the pool. <br>
     * Pooling must be set to true if more than one such objects will be created. <br>
     * (Note: for an object to be poolable, it must implements a `onResetEvent` method)
     * @function me.pool.register
     * @param {string} className as defined in the Name field of the Object Properties (in Tiled)
     * @param {object} classObj corresponding Class to be instantiated
     * @param {boolean} [recycling=false] enables object recycling for the specified class
     * @example
     * // implement CherryEntity
     * class CherryEntity extends Spritesheet {
     *    onResetEvent() {
     *        // reset object mutable properties
     *        this.lifeBar = 100;
     *    }
     * };
     * // add our users defined entities in the object pool and enable object recycling
     * me.pool.register("cherryentity", CherryEntity, true);
     */
    function register(className: string, classObj: any, recycling?: boolean): void;
    /**
     * register an object to the pool. <br>
     * Pooling must be set to true if more than one such objects will be created. <br>
     * (Note: for an object to be poolable, it must implements a `onResetEvent` method)
     * @function me.pool.register
     * @param {string} className as defined in the Name field of the Object Properties (in Tiled)
     * @param {object} classObj corresponding Class to be instantiated
     * @param {boolean} [recycling=false] enables object recycling for the specified class
     * @example
     * // implement CherryEntity
     * class CherryEntity extends Spritesheet {
     *    onResetEvent() {
     *        // reset object mutable properties
     *        this.lifeBar = 100;
     *    }
     * };
     * // add our users defined entities in the object pool and enable object recycling
     * me.pool.register("cherryentity", CherryEntity, true);
     */
    function register(className: string, classObj: any, recycling?: boolean): void;
    /**
     * Pull a new instance of the requested object (if added into the object pool)
     * @function me.pool.pull
     * @param {string} name as used in {@link me.pool.register}
     * @param {object} [...arguments] arguments to be passed when instantiating/reinitializing the object
     * @returns {object} the instance of the requested object
     * @example
     * me.pool.register("bullet", BulletEntity, true);
     * me.pool.register("enemy", EnemyEntity, true);
     * // ...
     * // when we need to manually create a new bullet:
     * var bullet = me.pool.pull("bullet", x, y, direction);
     * // ...
     * // params aren't a fixed number
     * // when we need new enemy we can add more params, that the object construct requires:
     * var enemy = me.pool.pull("enemy", x, y, direction, speed, power, life);
     * // ...
     * // when we want to destroy existing object, the remove
     * // function will ensure the object can then be reallocated later
     * me.game.world.removeChild(enemy);
     * me.game.world.removeChild(bullet);
     */
    function pull(name: string, ...args: any[]): any;
    /**
     * Pull a new instance of the requested object (if added into the object pool)
     * @function me.pool.pull
     * @param {string} name as used in {@link me.pool.register}
     * @param {object} [...arguments] arguments to be passed when instantiating/reinitializing the object
     * @returns {object} the instance of the requested object
     * @example
     * me.pool.register("bullet", BulletEntity, true);
     * me.pool.register("enemy", EnemyEntity, true);
     * // ...
     * // when we need to manually create a new bullet:
     * var bullet = me.pool.pull("bullet", x, y, direction);
     * // ...
     * // params aren't a fixed number
     * // when we need new enemy we can add more params, that the object construct requires:
     * var enemy = me.pool.pull("enemy", x, y, direction, speed, power, life);
     * // ...
     * // when we want to destroy existing object, the remove
     * // function will ensure the object can then be reallocated later
     * me.game.world.removeChild(enemy);
     * me.game.world.removeChild(bullet);
     */
    function pull(name: string, ...args: any[]): any;
    /**
     * purge the object pool from any inactive object <br>
     * Object pooling must be enabled for this function to work<br>
     * note: this will trigger the garbage collector
     * @function me.pool.purge
     */
    function purge(): void;
    /**
     * purge the object pool from any inactive object <br>
     * Object pooling must be enabled for this function to work<br>
     * note: this will trigger the garbage collector
     * @function me.pool.purge
     */
    function purge(): void;
    /**
     * Push back an object instance into the object pool <br>
     * Object pooling for the object class must be enabled,
     * and object must have been instantiated using {@link me.pool#pull},
     * otherwise this function won't work
     * @function me.pool.push
     * @throws will throw an error if the object cannot be recycled
     * @param {object} obj instance to be recycled
     * @param {boolean} [throwOnError=true] throw an exception if the object cannot be recycled
     * @returns {boolean} true if the object was successfully recycled in the object pool
     */
    function push(obj: any, throwOnError?: boolean): boolean;
    /**
     * Push back an object instance into the object pool <br>
     * Object pooling for the object class must be enabled,
     * and object must have been instantiated using {@link me.pool#pull},
     * otherwise this function won't work
     * @function me.pool.push
     * @throws will throw an error if the object cannot be recycled
     * @param {object} obj instance to be recycled
     * @param {boolean} [throwOnError=true] throw an exception if the object cannot be recycled
     * @returns {boolean} true if the object was successfully recycled in the object pool
     */
    function push(obj: any, throwOnError?: boolean): boolean;
    /**
     * Check if an object with the provided name is registered
     * @function me.pool.exists
     * @param {string} name of the registered object class
     * @returns {boolean} true if the classname is registered
     */
    function exists(name: string): boolean;
    /**
     * Check if an object with the provided name is registered
     * @function me.pool.exists
     * @param {string} name of the registered object class
     * @returns {boolean} true if the classname is registered
     */
    function exists(name: string): boolean;
    /**
     * Check if an object is poolable
     * (was properly registered with the recycling feature enable)
     * @function me.pool.poolable
     * @see me.pool.register
     * @param {object} obj object to be checked
     * @returns {boolean} true if the object is poolable
     * @example
     * if (!me.pool.poolable(myCherryEntity)) {
     *     // object was not properly registered
     * }
     */
    function poolable(obj: any): boolean;
    /**
     * Check if an object is poolable
     * (was properly registered with the recycling feature enable)
     * @function me.pool.poolable
     * @see me.pool.register
     * @param {object} obj object to be checked
     * @returns {boolean} true if the object is poolable
     * @example
     * if (!me.pool.poolable(myCherryEntity)) {
     *     // object was not properly registered
     * }
     */
    function poolable(obj: any): boolean;
    /**
     * returns the amount of object instance currently in the pool
     * @function me.pool.getInstanceCount
     * @returns {number} amount of object instance
     */
    function getInstanceCount(): number;
    /**
     * returns the amount of object instance currently in the pool
     * @function me.pool.getInstanceCount
     * @returns {number} amount of object instance
     */
    function getInstanceCount(): number;
}
export namespace save {
    /**
     * Add new keys to localStorage and set them to the given default values if they do not exist
     * @name add
     * @memberOf me.save
     * @function
     * @param {object} props key and corresponding values
     * @example
     * // Initialize "score" and "lives" with default values
     * me.save.add({ score : 0, lives : 3 });
     * // get or set the value through me.save
     * me.save.score = 1000;
     */
    function add(props: any): void;
    /**
     * Add new keys to localStorage and set them to the given default values if they do not exist
     * @name add
     * @memberOf me.save
     * @function
     * @param {object} props key and corresponding values
     * @example
     * // Initialize "score" and "lives" with default values
     * me.save.add({ score : 0, lives : 3 });
     * // get or set the value through me.save
     * me.save.score = 1000;
     */
    function add(props: any): void;
    /**
     * Remove a key from localStorage
     * @name remove
     * @memberOf me.save
     * @function
     * @param {string} key key to be removed
     * @example
     * // Remove the "score" key from localStorage
     * me.save.remove("score");
     */
    function remove(key: string): void;
    /**
     * Remove a key from localStorage
     * @name remove
     * @memberOf me.save
     * @function
     * @param {string} key key to be removed
     * @example
     * // Remove the "score" key from localStorage
     * me.save.remove("score");
     */
    function remove(key: string): void;
}
/**
 * disable melonJS auto-initialization
 * @type {boolean}
 * @default false
 * @see me.boot
 * @memberOf me
 */
export var skipAutoInit: boolean;
export namespace state {
    export const LOADING: number;
    export const MENU: number;
    export const READY: number;
    export const PLAY: number;
    export const GAMEOVER: number;
    export const GAME_END: number;
    export const SCORE: number;
    export const CREDITS: number;
    export const SETTINGS: number;
    export const DEFAULT: number;
    const USER_1: number;
    export { USER_1 as USER };
    /**
     * Stop the current screen object.
     * @name stop
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [pauseTrack=false] pause current track on screen stop.
     */
    export function stop(pauseTrack?: boolean): void;
    /**
     * Stop the current screen object.
     * @name stop
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [pauseTrack=false] pause current track on screen stop.
     */
    export function stop(pauseTrack?: boolean): void;
    /**
     * pause the current screen object
     * @name pause
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [music=false] pause current music track on screen pause
     */
    export function pause(music?: boolean): void;
    /**
     * pause the current screen object
     * @name pause
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [music=false] pause current music track on screen pause
     */
    export function pause(music?: boolean): void;
    /**
     * Restart the screen object from a full stop.
     * @name restart
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [music=false] resume current music track on screen resume
     */
    export function restart(music?: boolean): void;
    /**
     * Restart the screen object from a full stop.
     * @name restart
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [music=false] resume current music track on screen resume
     */
    export function restart(music?: boolean): void;
    /**
     * resume the screen object
     * @name resume
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [music=false] resume current music track on screen resume
     */
    export function resume(music?: boolean): void;
    /**
     * resume the screen object
     * @name resume
     * @memberOf me.state
     * @public
     * @function
     * @param {boolean} [music=false] resume current music track on screen resume
     */
    export function resume(music?: boolean): void;
    /**
     * return the running state of the state manager
     * @name isRunning
     * @memberOf me.state
     * @public
     * @function
     * @returns {boolean} true if a "process is running"
     */
    export function isRunning(): boolean;
    /**
     * return the running state of the state manager
     * @name isRunning
     * @memberOf me.state
     * @public
     * @function
     * @returns {boolean} true if a "process is running"
     */
    export function isRunning(): boolean;
    /**
     * Return the pause state of the state manager
     * @name isPaused
     * @memberOf me.state
     * @public
     * @function
     * @returns {boolean} true if the game is paused
     */
    export function isPaused(): boolean;
    /**
     * Return the pause state of the state manager
     * @name isPaused
     * @memberOf me.state
     * @public
     * @function
     * @returns {boolean} true if the game is paused
     */
    export function isPaused(): boolean;
    /**
     * associate the specified state with a Stage
     * @name set
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @param {me.Stage} stage Instantiated Stage to associate with state ID
     * @param {boolean} [start = false] if true the state will be changed immediately after adding it.
     * @example
     * class MenuButton extends me.GUI_Object {
     *     onClick() {
     *         // Change to the PLAY state when the button is clicked
     *         me.state.change(me.state.PLAY);
     *         return true;
     *     }
     * };
     *
     * class MenuScreen extends me.Stage {
     *     onResetEvent() {
     *         // Load background image
     *         me.game.world.addChild(
     *             new me.ImageLayer(0, 0, {
     *                 image : "bg",
     *                 z: 0 // z-index
     *             }
     *         );
     *
     *         // Add a button
     *         me.game.world.addChild(
     *             new MenuButton(350, 200, { "image" : "start" }),
     *             1 // z-index
     *         );
     *
     *         // Play music
     *         me.audio.playTrack("menu");
     *     }
     *
     *     onDestroyEvent() {
     *         // Stop music
     *         me.audio.stopTrack();
     *     }
     * };
     *
     * me.state.set(me.state.MENU, new MenuScreen());
     */
    export function set(state: number, stage: me.Stage, start?: boolean): void;
    /**
     * associate the specified state with a Stage
     * @name set
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @param {me.Stage} stage Instantiated Stage to associate with state ID
     * @param {boolean} [start = false] if true the state will be changed immediately after adding it.
     * @example
     * class MenuButton extends me.GUI_Object {
     *     onClick() {
     *         // Change to the PLAY state when the button is clicked
     *         me.state.change(me.state.PLAY);
     *         return true;
     *     }
     * };
     *
     * class MenuScreen extends me.Stage {
     *     onResetEvent() {
     *         // Load background image
     *         me.game.world.addChild(
     *             new me.ImageLayer(0, 0, {
     *                 image : "bg",
     *                 z: 0 // z-index
     *             }
     *         );
     *
     *         // Add a button
     *         me.game.world.addChild(
     *             new MenuButton(350, 200, { "image" : "start" }),
     *             1 // z-index
     *         );
     *
     *         // Play music
     *         me.audio.playTrack("menu");
     *     }
     *
     *     onDestroyEvent() {
     *         // Stop music
     *         me.audio.stopTrack();
     *     }
     * };
     *
     * me.state.set(me.state.MENU, new MenuScreen());
     */
    export function set(state: number, stage: me.Stage, start?: boolean): void;
    /**
     * return a reference to the current screen object<br>
     * useful to call a object specific method
     * @name current
     * @memberOf me.state
     * @public
     * @function
     * @returns {me.Stage}
     */
    export function current(): me.Stage;
    /**
     * return a reference to the current screen object<br>
     * useful to call a object specific method
     * @name current
     * @memberOf me.state
     * @public
     * @function
     * @returns {me.Stage}
     */
    export function current(): me.Stage;
    /**
     * specify a global transition effect
     * @name transition
     * @memberOf me.state
     * @public
     * @function
     * @param {string} effect (only "fade" is supported for now)
     * @param {me.Color|string} color a CSS color value
     * @param {number} [duration=1000] expressed in milliseconds
     */
    export function transition(effect: string, color: any, duration?: number): void;
    /**
     * specify a global transition effect
     * @name transition
     * @memberOf me.state
     * @public
     * @function
     * @param {string} effect (only "fade" is supported for now)
     * @param {me.Color|string} color a CSS color value
     * @param {number} [duration=1000] expressed in milliseconds
     */
    export function transition(effect: string, color: any, duration?: number): void;
    /**
     * enable/disable transition for a specific state (by default enabled for all)
     * @name setTransition
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @param {boolean} enable
     */
    export function setTransition(state: number, enable: boolean): void;
    /**
     * enable/disable transition for a specific state (by default enabled for all)
     * @name setTransition
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @param {boolean} enable
     */
    export function setTransition(state: number, enable: boolean): void;
    /**
     * change the game/app state
     * @name change
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @param {boolean} forceChange if true the state will be changed immediately
     * @param {object} [...arguments] extra arguments to be passed to the reset functions
     * @example
     * // The onResetEvent method on the play screen will receive two args:
     * // "level_1" and the number 3
     * me.state.change(me.state.PLAY, "level_1", 3);
     */
    export function change(state: number, forceChange: boolean, ...args: any[]): void;
    /**
     * change the game/app state
     * @name change
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @param {boolean} forceChange if true the state will be changed immediately
     * @param {object} [...arguments] extra arguments to be passed to the reset functions
     * @example
     * // The onResetEvent method on the play screen will receive two args:
     * // "level_1" and the number 3
     * me.state.change(me.state.PLAY, "level_1", 3);
     */
    export function change(state: number, forceChange: boolean, ...args: any[]): void;
    /**
     * return true if the specified state is the current one
     * @name isCurrent
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @returns {boolean} true if the specified state is the current one
     */
    export function isCurrent(state: number): boolean;
    /**
     * return true if the specified state is the current one
     * @name isCurrent
     * @memberOf me.state
     * @public
     * @function
     * @param {number} state State ID (see constants)
     * @returns {boolean} true if the specified state is the current one
     */
    export function isCurrent(state: number): boolean;
}
declare namespace timer$1 {
    const tick: number;
    const fps: number;
    const maxfps: number;
    const interpolation: boolean;
    /**
     * reset time (e.g. usefull in case of pause)
     * @name reset
     * @memberOf me.timer
     * @ignore
     * @function
     */
    function reset(): void;
    /**
     * reset time (e.g. usefull in case of pause)
     * @name reset
     * @memberOf me.timer
     * @ignore
     * @function
     */
    function reset(): void;
    /**
     * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
     * @name setTimeout
     * @memberOf me.timer
     * @param {Function} fn the function you want to execute after delay milliseconds.
     * @param {number} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
     * @param {boolean} [pauseable=true] respects the pause state of the engine.
     * @param {object} [args] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearTimeout().
     * @function
     * @example
     * // set a timer to call "myFunction" after 1000ms
     * me.timer.setTimeout(myFunction, 1000);
     * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
     */
    function setTimeout(fn: Function, delay: number, pauseable?: boolean, ...args?: any): number;
    /**
     * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
     * @name setTimeout
     * @memberOf me.timer
     * @param {Function} fn the function you want to execute after delay milliseconds.
     * @param {number} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
     * @param {boolean} [pauseable=true] respects the pause state of the engine.
     * @param {object} [args] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearTimeout().
     * @function
     * @example
     * // set a timer to call "myFunction" after 1000ms
     * me.timer.setTimeout(myFunction, 1000);
     * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
     */
    function setTimeout(fn: Function, delay: number, pauseable?: boolean, ...args?: any): number;
    /**
     * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
     * @name setInterval
     * @memberOf me.timer
     * @param {Function} fn the function to execute
     * @param {number} delay the number of milliseconds (thousandths of a second) on how often to execute the function
     * @param {boolean} [pauseable=true] respects the pause state of the engine.
     * @param {object} [args] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearInterval().
     * @function
     * @example
     * // set a timer to call "myFunction" every 1000ms
     * me.timer.setInterval(myFunction, 1000);
     * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setInterval(myFunction, 1000, true, param1, param2);
     */
    function setInterval(fn: Function, delay: number, pauseable?: boolean, ...args?: any): number;
    /**
     * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
     * @name setInterval
     * @memberOf me.timer
     * @param {Function} fn the function to execute
     * @param {number} delay the number of milliseconds (thousandths of a second) on how often to execute the function
     * @param {boolean} [pauseable=true] respects the pause state of the engine.
     * @param {object} [args] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearInterval().
     * @function
     * @example
     * // set a timer to call "myFunction" every 1000ms
     * me.timer.setInterval(myFunction, 1000);
     * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setInterval(myFunction, 1000, true, param1, param2);
     */
    function setInterval(fn: Function, delay: number, pauseable?: boolean, ...args?: any): number;
    /**
     * Clears the delay set by me.timer.setTimeout().
     * @name clearTimeout
     * @memberOf me.timer
     * @function
     * @param {number} timeoutID ID of the timeout to be cleared
     */
    function clearTimeout(timeoutID: number): void;
    /**
     * Clears the delay set by me.timer.setTimeout().
     * @name clearTimeout
     * @memberOf me.timer
     * @function
     * @param {number} timeoutID ID of the timeout to be cleared
     */
    function clearTimeout(timeoutID: number): void;
    /**
     * Clears the Interval set by me.timer.setInterval().
     * @name clearInterval
     * @memberOf me.timer
     * @function
     * @param {number} intervalID ID of the interval to be cleared
     */
    function clearInterval(intervalID: number): void;
    /**
     * Clears the Interval set by me.timer.setInterval().
     * @name clearInterval
     * @memberOf me.timer
     * @function
     * @param {number} intervalID ID of the interval to be cleared
     */
    function clearInterval(intervalID: number): void;
    /**
     * Return the current timestamp in milliseconds <br>
     * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
     * @name getTime
     * @memberOf me.timer
     * @returns {number}
     * @function
     */
    function getTime(): number;
    /**
     * Return the current timestamp in milliseconds <br>
     * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
     * @name getTime
     * @memberOf me.timer
     * @returns {number}
     * @function
     */
    function getTime(): number;
    /**
     * Return elapsed time in milliseconds since the last update
     * @name getDelta
     * @memberOf me.timer
     * @returns {number}
     * @function
     */
    function getDelta(): number;
    /**
     * Return elapsed time in milliseconds since the last update
     * @name getDelta
     * @memberOf me.timer
     * @returns {number}
     * @function
     */
    function getDelta(): number;
    /**
     * compute the actual frame time and fps rate
     * @name computeFPS
     * @ignore
     * @memberOf me.timer
     * @function
     */
    function countFPS(): void;
    /**
     * compute the actual frame time and fps rate
     * @name computeFPS
     * @ignore
     * @memberOf me.timer
     * @function
     */
    function countFPS(): void;
}
export namespace utils {
    export { agentUtils as agent };
    export { arrayUtils as array };
    export { fileUtils as file };
    export { stringUtils as string };
    export { fnUtils as function };
    export function getPixels(image: HTMLImageElement | HTMLCanvasElement): ImageData;
    export function checkVersion(first: string, second?: string): number;
    export function getUriFragment(url?: string): any;
    export function resetGUID(base: any, index?: number): void;
    export function createGUID(index?: number): string;
}
/**
 * (<b>m</b>)elonJS (<b>e</b>)ngine : All melonJS functions are defined inside this namespace.
 * You generally should not add new properties to this namespace as it may be overwritten in future versions.
 * @namespace me
 */
/**
 * current melonJS version
 * @static
 * @constant
 * @memberof me
 * @name version
 * @type {string}
 */
export const version: string;
export var video: Readonly<{
    __proto__: any;
    CANVAS: number;
    WEBGL: number;
    AUTO: number;
    readonly parent: HTMLElement;
    scaleRatio: me.Vector2d;
    readonly renderer: any;
    init: typeof init;
    createCanvas: typeof createCanvas;
    getParent: typeof getParent;
    scale: typeof scale;
}>;
/**
 * a basic texture cache object
 * @ignore
 */
declare class TextureCache {
    /**
     * @ignore
     */
    constructor(max_size: any);
    cache: Map<any, any>;
    tinted: Map<any, any>;
    units: Map<any, any>;
    max_size: any;
    /**
     * @ignore
     */
    clear(): void;
    length: number;
    /**
     * @ignore
     */
    validate(): void;
    /**
     * @ignore
     */
    get(image: any, atlas: any): any;
    /**
     * @ignore
     */
    delete(image: any): void;
    /**
     * @ignore
     */
    tint(src: any, color: any): any;
    /**
     * @ignore
     */
    set(image: any, texture: any): void;
    /**
     * @ignore
     */
    getUnit(texture: any): any;
}
/**
 * allows registration of event listeners on the object target. <br>
 * melonJS will pass a me.Pointer object to the defined callback.
 * @see me.Pointer
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @name registerPointerEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {string} eventType The event type for which the object is registering <br>
 * melonJS currently supports: <br>
 * <ul>
 *   <li><code>"pointermove"</code></li>
 *   <li><code>"pointerdown"</code></li>
 *   <li><code>"pointerup"</code></li>
 *   <li><code>"pointerenter"</code></li>
 *   <li><code>"pointerover"</code></li>
 *   <li><code>"pointerleave"</code></li>
 *   <li><code>"pointercancel"</code></li>
 *   <li><code>"wheel"</code></li>
 * </ul>
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region a shape representing the region to register on
 * @param {Function} callback methods to be called when the event occurs.
 * Returning `false` from the defined callback will prevent the event to be propagated to other objects
 * @example
 *  // onActivate function
 *  onActivateEvent: function () {
 *     // register on the 'pointerdown' event
 *     me.input.registerPointerEvent('pointerdown', this, this.pointerDown.bind(this));
 *  },
 *
 *  // pointerDown event callback
 *  pointerDown: function (pointer) {
 *    // do something
 *    ....
 *    // don"t propagate the event to other objects
 *    return false;
 *  },
 */
declare function registerPointerEvent(eventType: string, region: me.Rect | me.Polygon | me.Line | me.Ellipse, callback: Function): void;
/**
 * allows the removal of event listeners from the object target.
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @name releasePointerEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {string} eventType The event type for which the object was registered. See {@link me.input.registerPointerEvent}
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region the registered region to release for this event
 * @param {Function} [callback="all"] if specified unregister the event only for the specific callback
 * @example
 * // release the registered region on the 'pointerdown' event
 * me.input.releasePointerEvent('pointerdown', this);
 */
declare function releasePointerEvent(eventType: string, region: me.Rect | me.Polygon | me.Line | me.Ellipse, callback?: Function): void;
/**
 * returns true if the given value is a power of two
 * @public
 * @function
 * @memberOf me.Math
 * @name isPowerOfTwo
 * @param {number} val
 * @returns {boolean}
 */
declare function isPowerOfTwo(val: number): boolean;
/**
 * returns the next power of two for the given value
 * @public
 * @function
 * @memberOf me.Math
 * @name nextPowerOfTwo
 * @param {number} val
 * @returns {boolean}
 */
declare function nextPowerOfTwo(val: number): boolean;
/**
 * Converts an angle in degrees to an angle in radians
 * @public
 * @function
 * @memberOf me.Math
 * @name degToRad
 * @param {number} angle angle in degrees
 * @returns {number} corresponding angle in radians
 * @example
 * // convert a specific angle
 * me.Math.degToRad(60); // return 1.0471...
 */
declare function degToRad(angle: number): number;
/**
 * Converts an angle in radians to an angle in degrees.
 * @public
 * @function
 * @memberOf me.Math
 * @name radToDeg
 * @param {number} radians angle in radians
 * @returns {number} corresponding angle in degrees
 * @example
 * // convert a specific angle
 * me.Math.radToDeg(1.0471975511965976); // return 60
 */
declare function radToDeg(radians: number): number;
/**
 * clamp the given value
 * @public
 * @function
 * @memberOf me.Math
 * @name clamp
 * @param {number} val the value to clamp
 * @param {number} low lower limit
 * @param {number} high higher limit
 * @returns {number} clamped value
 */
declare function clamp(val: number, low: number, high: number): number;
/**
 * return a random integer between min (included) and max (excluded)
 * @public
 * @function
 * @memberOf me.Math
 * @name random
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.random(5, 10) );
 */
declare function random$1(min: number, max: number): number;
/**
 * return a random float between min, max (exclusive)
 * @public
 * @function
 * @memberOf me.Math
 * @name randomFloat
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.randomFloat(5, 10) );
 */
declare function randomFloat(min: number, max: number): number;
/**
 * return a weighted random between min, max (exclusive)
 * @public
 * @function
 * @memberOf me.Math
 * @name weightedRandom
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.weightedRandom(5, 10) );
 */
declare function weightedRandom$1(min: number, max: number): number;
/**
 * round a value to the specified number of digit
 * @public
 * @function
 * @memberOf me.Math
 * @name round
 * @param {number} num value to be rounded.
 * @param {number} [dec=0] number of decimal digit to be rounded to.
 * @returns {number} rounded value
 * @example
 * // round a specific value to 2 digits
 * me.Math.round(10.33333, 2); // return 10.33
 */
declare function round(num: number, dec?: number): number;
/**
 * check if the given value is close to the expected one
 * @public
 * @function
 * @memberOf me.Math
 * @name toBeCloseTo
 * @param {number} expected value to be compared with.
 * @param {number} actual actual value to compare
 * @param {number} [precision=2] float precision for the comparison
 * @returns {boolean} if close to
 * @example
 * // test if the given value is close to 10
 * if (me.Math.toBeCloseTo(10, value)) {
 *     // do something
 * }
 */
declare function toBeCloseTo(expected: number, actual: number, precision?: number): boolean;
/**
 * @classdesc
 * Particle Container Object.
 * @class ParticleContainer
 * @extends me.Container
 * @memberOf me
 * @constructor
 * @param {me.ParticleEmitter} emitter the emitter which owns this container
 */
declare class ParticleContainer {
    /**
     * @ignore
     */
    constructor(emitter: any);
    autoSort: boolean;
    _updateCount: number;
    _dt: number;
    _emitter: any;
    autoTransform: boolean;
    isKinematic: boolean;
    /**
     * @ignore
     */
    update(dt: any): boolean;
    /**
     * @ignore
     */
    draw(renderer: any, rect: any): void;
}
declare var pixel: any;
/**
 * @classdesc
 * A Texture atlas object, currently supports : <br>
 * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export (standard and multipack texture atlas) <br>
 * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
 * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
 * - [Free Texture Packer]{@link http://free-tex-packer.com/app/} : through JSON export (standard and multipack texture atlas) <br>
 * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx, anchorPoint:me.Vector2d} object
 * @class Texture
 * @memberOf me.Renderer
 * @constructor
 * @param {object|object[]} atlases atlas information. See {@link me.loader.getJSON}
 * @param {HTMLImageElement|HTMLCanvasElement|string|HTMLImageElement[]|HTMLCanvasElement[]|string[]} [src=atlas.meta.image] Image source
 * @param {boolean} [cache=false] Use true to skip caching this Texture
 * @example
 * // create a texture atlas from a JSON Object
 * game.texture = new me.video.renderer.Texture(
 *     me.loader.getJSON("texture")
 * );
 *
 * // create a texture atlas from a multipack JSON Object
 * game.texture = new me.video.renderer.Texture([
 *     me.loader.getJSON("texture-0"),
 *     me.loader.getJSON("texture-1"),
 *     me.loader.getJSON("texture-2")
 * ]);
 *
 * // create a texture atlas for a spritesheet with an anchorPoint in the center of each frame
 * game.texture = new me.video.renderer.Texture(
 *     {
 *         framewidth : 32,
 *         frameheight : 32,
 *         anchorPoint : new me.Vector2d(0.5, 0.5)
 *     },
 *     me.loader.getImage("spritesheet")
 * );
 */
declare class Texture {
    constructor(atlases: any, src: any, cache: any);
    /**
     * to identify the atlas format (e.g. texture packer)
     * @ignore
     */
    format: string;
    /**
     * the texture source(s) itself
     * @type {Map}
     * @ignore
     */
    sources: Map<any, any>;
    /**
     * the atlas dictionnaries
     * @type {Map}
     * @ignore
     */
    atlases: Map<any, any>;
    repeat: any;
    /**
     * build an atlas from the given data
     * @ignore
     */
    parse(data: any): {};
    /**
     * build an atlas from the given spritesheet
     * @ignore
     */
    parseFromSpriteSheet(data: any): {};
    /**
     * @ignore
     */
    addUvsMap(atlas: any, frame: any, w: any, h: any): any;
    /**
     * @ignore
     */
    addQuadRegion(name: any, x: any, y: any, w: any, h: any): any;
    /**
     * return the default or specified atlas dictionnary
     * @name getAtlas
     * @memberOf me.Renderer.Texture
     * @function
     * @param {string} [name] atlas name in case of multipack textures
     * @returns {object}
     */
    getAtlas(name?: string): object;
    /**
     * return the format of the atlas dictionnary
     * @name getFormat
     * @memberOf me.Renderer.Texture
     * @function
     * @returns {string} will return "texturepacker", or "ShoeBox", or "melonJS", or "Spritesheet (fixed cell size)"
     */
    getFormat(): string;
    /**
     * return the source texture for the given region (or default one if none specified)
     * @name getTexture
     * @memberOf me.Renderer.Texture
     * @function
     * @param {object} [region] region name in case of multipack textures
     * @returns {HTMLImageElement|HTMLCanvasElement}
     */
    getTexture(region?: object): HTMLImageElement | HTMLCanvasElement;
    /**
     * return a normalized region (or frame) information for the specified sprite name
     * @name getRegion
     * @memberOf me.Renderer.Texture
     * @function
     * @param {string} name name of the sprite
     * @param {string} [atlas] name of a specific atlas where to search for the region
     * @returns {object}
     */
    getRegion(name: string, atlas?: string): object;
    /**
     * return the uvs mapping for the given region
     * @name getUVs
     * @memberOf me.Renderer.Texture
     * @function
     * @param {object} name region (or frame) name
     * @returns {Float32Array} region Uvs
     */
    getUVs(name: object): Float32Array;
    /**
     * Create a sprite object using the first region found using the specified name
     * @name createSpriteFromName
     * @memberOf me.Renderer.Texture
     * @function
     * @param {string} name name of the sprite
     * @param {object} [settings] Additional settings passed to the {@link me.Sprite} contructor
     * @param {boolean} [nineSlice=false] if true returns a 9-slice sprite
     * @returns {me.Sprite|me.NineSliceSprite}
     * @example
     * // create a new texture object under the `game` namespace
     * game.texture = new me.video.renderer.Texture(
     *    me.loader.getJSON("texture"),
     *    me.loader.getImage("texture")
     * );
     * ...
     * ...
     * // create a new "coin" sprite
     * var sprite = game.texture.createSpriteFromName("coin.png");
     * // set the renderable position to bottom center
     * sprite.anchorPoint.set(0.5, 1.0);
     * ...
     * ...
     * // create a 9-slice sprite
     * var dialogPanel = game.texture.createSpriteFromName(
     *    "rpg_dialo.png",
     *    // width & height are mandatory for 9-slice sprites
     *    { width: this.width, height: this.height },
     *    true
     * );
     */
    createSpriteFromName(name: string, settings?: object, nineSlice?: boolean): me.Sprite | me.NineSliceSprite;
    /**
     * Create an animation object using the first region found using all specified names
     * @name createAnimationFromName
     * @memberOf me.Renderer.Texture
     * @function
     * @param {string[]|number[]} names list of names for each sprite
     * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
     * @param {object} [settings] Additional settings passed to the {@link me.Sprite} contructor
     * @returns {me.Sprite}
     * @example
     * // create a new texture object under the `game` namespace
     * game.texture = new me.video.renderer.Texture(
     *     me.loader.getJSON("texture"),
     *     me.loader.getImage("texture")
     * );
     *
     * // create a new Animated Sprite
     * var sprite = game.texture.createAnimationFromName([
     *     "walk0001.png", "walk0002.png", "walk0003.png",
     *     "walk0004.png", "walk0005.png", "walk0006.png",
     *     "walk0007.png", "walk0008.png", "walk0009.png",
     *     "walk0010.png", "walk0011.png"
     * ]);
     *
     * // define an additional basic walking animation
     * sprite.addAnimation ("simple_walk", [0,2,1]);
     * // you can also use frame name to define your animation
     * sprite.addAnimation ("speed_walk", ["walk0007.png", "walk0008.png", "walk0009.png", "walk0010.png"]);
     * // set the default animation
     * sprite.setCurrentAnimation("simple_walk");
     * // set the renderable position to bottom center
     * sprite.anchorPoint.set(0.5, 1.0);
     */
    createAnimationFromName(names: string[] | number[], settings?: object): me.Sprite;
}
/**
 * @classdesc
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 * @class Bounds
 * @memberOf me
 * @constructor
 * @memberOf me
 * @param {me.Vector2d[]} [vertices] an array of me.Vector2d points
 * @returns {me.Bounds} A new bounds object
 */
declare class Bounds {
    constructor(vertices: any);
    onResetEvent(vertices: any): void;
    min: {
        x: number;
        y: number;
    };
    max: {
        x: number;
        y: number;
    };
    _center: Vector2d;
    /**
     * reset the bound
     * @name clear
     * @memberOf me.Bounds
     * @function
     */
    clear(): void;
    /**
     * sets the bounds to the given min and max value
     * @name setMinMax
     * @memberOf me.Bounds
     * @function
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     */
    setMinMax(minX: number, minY: number, maxX: number, maxY: number): void;
    public set x(arg: number);
    /**
     * x position of the bound
     * @public
     * @type {number}
     * @name x
     * @memberOf me.Bounds
     */
    public get x(): number;
    public set y(arg: number);
    /**
     * y position of the bounds
     * @public
     * @type {number}
     * @name y
     * @memberOf me.Bounds
     */
    public get y(): number;
    public set width(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberOf me.Bounds
     */
    public get width(): number;
    public set height(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberOf me.Bounds
     */
    public get height(): number;
    /**
     * left coordinate of the bound
     * @public
     * @type {number}
     * @name left
     * @memberOf me.Bounds
     */
    public get left(): number;
    /**
     * right coordinate of the bound
     * @public
     * @type {number}
     * @name right
     * @memberOf me.Bounds
     */
    public get right(): number;
    /**
     * top coordinate of the bound
     * @public
     * @type {number}
     * @name top
     * @memberOf me.Bounds
     */
    public get top(): number;
    /**
     * bottom coordinate of the bound
     * @public
     * @type {number}
     * @name bottom
     * @memberOf me.Bounds
     */
    public get bottom(): number;
    /**
     * center position of the bound on the x axis
     * @public
     * @type {number}
     * @name centerX
     * @memberOf me.Bounds
     */
    public get centerX(): number;
    /**
     * center position of the bound on the y axis
     * @public
     * @type {number}
     * @name centerY
     * @memberOf me.Bounds
     */
    public get centerY(): number;
    /**
     * return the center position of the bound
     * @public
     * @type {me.Vector2d}
     * @name center
     * @memberOf me.Bounds
     */
    public get center(): me.Vector2d;
    /**
     * Updates bounds using the given vertices
     * @name update
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     */
    update(vertices: me.Vector2d[]): void;
    /**
     * add the given vertices to the bounds definition.
     * @name add
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    add(vertices: me.Vector2d[], clear?: boolean): void;
    /**
     * add the given bounds to the bounds definition.
     * @name addBounds
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds} bounds
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    addBounds(bounds: me.Bounds, clear?: boolean): void;
    /**
     * add the given point to the bounds definition.
     * @name addPoint
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} v
     * @param {me.Matrix2d} [m] an optional transform to apply to the given point
     */
    addPoint(v: me.Vector2d, m?: me.Matrix2d): void;
    /**
     * add the given quad coordinates to this bound definition, multiplied by the given matrix
     * @name addFrame
     * @memberOf me.Bounds
     * @function
     * @param {number} x0 - left X coordinates of the quad
     * @param {number} y0 - top Y coordinates of the quad
     * @param {number} x1 - right X coordinates of the quad
     * @param {number} y1 - bottom y coordinates of the quad
     * @param {me.Matrix2d} [m] an optional transform to apply to the given frame coordinates
     */
    addFrame(x0: number, y0: number, x1: number, y1: number, m?: me.Matrix2d): void;
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} point
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    contains(...args: any[]): boolean;
    /**
     * Returns true if the two bounds intersect.
     * @name overlaps
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds|me.Rect} bounds
     * @returns {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds: me.Bounds | me.Rect): boolean;
    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @name isFinite
     * @memberOf me.Bounds
     * @function
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite(): boolean;
    /**
     * Translates the bounds by the given vector.
     * @name translate
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} vector
     */
    /**
     * Translates the bounds by x on the x axis, and y on the y axis
     * @name translate
     * @memberOf me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     */
    translate(...args: any[]): void;
    /**
     * Shifts the bounds to the given position vector.
     * @name shift
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} position
     */
    /**
     * Shifts the bounds to the given x, y position.
     * @name shift
     * @memberOf me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     */
    shift(...args: any[]): void;
    /**
     * clone this bounds
     * @name clone
     * @memberOf me.Bounds
     * @function
     * @returns {me.Bounds}
     */
    clone(): me.Bounds;
    /**
     * Returns a polygon whose edges are the same as this bounds.
     * @name toPolygon
     * @memberOf me.Bounds
     * @function
     * @returns {me.Polygon} a new Polygon that represents this bounds.
     */
    toPolygon(): me.Polygon;
}
/**
 * @classdesc
 * a Vertex Buffer object
 * @class VertexArrayBuffer
 * @ignore
 */
declare class VertexArrayBuffer {
    constructor(vertex_size: any, vertex_per_quad: any);
    vertexSize: any;
    quadSize: any;
    maxVertex: number;
    vertexCount: number;
    buffer: ArrayBuffer;
    bufferF32: Float32Array;
    bufferU32: Uint32Array;
    /**
     * clear the vertex array buffer
     * @ignore
     */
    clear(): void;
    /**
     * return true if full
     * @ignore
     */
    isFull(vertex?: any): boolean;
    /**
     * resize the vertex buffer, retaining its original contents
     * @ignore
     */
    resize(): VertexArrayBuffer;
    /**
     * push a new vertex to the buffer
     * @ignore
     */
    push(x: any, y: any, u: any, v: any, tint: any): VertexArrayBuffer;
    /**
     * return a reference to the data in Float32 format
     * @ignore
     */
    toFloat32(begin: any, end: any): Float32Array;
    /**
     * return a reference to the data in Uint32 format
     * @ignore
     */
    toUint32(begin: any, end: any): Uint32Array;
    /**
     * return the size of the vertex in vertex
     * @ignore
     */
    length(): number;
    /**
     * return true if empty
     * @ignore
     */
    isEmpty(): boolean;
}
/**
 * Initialize and configure the audio support.<br>
 * melonJS supports a wide array of audio codecs that have varying browser support :
 * <i> ("mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac")</i>.<br>
 * For a maximum browser coverage the recommendation is to use at least two of them,
 * typically default to webm and then fallback to mp3 for the best balance of small filesize and high quality,
 * webm has nearly full browser coverage with a great combination of compression and quality, and mp3 will fallback gracefully for other browsers.
 * It is important to remember that melonJS selects the first compatible sound based on the list of extensions and given order passed here.
 * So if you want webm to be used before mp3, you need to put the audio format in that order.
 * @function me.audio.init
 * @param {string} [format="mp3"] audio format to prioritize
 * @returns {boolean} Indicates whether audio initialization was successful
 * @example
 * // initialize the "sound engine", giving "webm" as default desired audio format, and "mp3" as a fallback
 * if (!me.audio.init("webm,mp3")) {
 *     alert("Sorry but your browser does not support html 5 audio !");
 *     return;
 * }
 */
declare function init$1(format?: string): boolean;
/**
 * check if the given audio format is supported
 * @function me.audio.hasFormat
 * @param {string} codec audio format : "mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac"
 * @returns {boolean} return true if the given audio format is supported
 */
declare function hasFormat(codec: string): boolean;
/**
 * check if audio (HTML5 or WebAudio) is supported
 * @function me.audio.hasAudio
 * @returns {boolean} return true if audio (HTML5 or WebAudio) is supported
 */
declare function hasAudio(): boolean;
/**
 * enable audio output <br>
 * only useful if audio supported and previously disabled through
 * @function me.audio.enable
 * @see me.audio#disable
 */
declare function enable(): void;
/**
 * disable audio output
 * @function me.audio.disable
 */
declare function disable(): void;
/**
 * Load an audio file.<br>
 * <br>
 * sound item must contain the following fields :<br>
 * - name    : name of the sound<br>
 * - src     : source path<br>
 * @ignore
 */
declare function load(sound: any, html5: any, onload_cb: any, onerror_cb: any): number;
/**
 * play the specified sound
 * @function me.audio.play
 * @param {string} sound_name audio clip name - case sensitive
 * @param {boolean} [loop=false] loop audio
 * @param {Function} [onend] Function to call when sound instance ends playing.
 * @param {number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
 * @returns {number} the sound instance ID.
 * @example
 * // play the "cling" audio clip
 * me.audio.play("cling");
 * // play & repeat the "engine" audio clip
 * me.audio.play("engine", true);
 * // play the "gameover_sfx" audio clip and call myFunc when finished
 * me.audio.play("gameover_sfx", false, myFunc);
 * // play the "gameover_sfx" audio clip with a lower volume level
 * me.audio.play("gameover_sfx", false, null, 0.5);
 */
declare function play(sound_name: string, loop?: boolean, onend?: Function, volume?: number): number;
/**
 * Fade a currently playing sound between two volumee.
 * @function me.audio.fade
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} from Volume to fade from (0.0 to 1.0).
 * @param {number} to Volume to fade to (0.0 to 1.0).
 * @param {number} duration Time in milliseconds to fade.
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will fade.
 */
declare function fade(sound_name: string, from: number, to: number, duration: number, id?: number): void;
/**
 * get/set the position of playback for a sound.
 * @function me.audio.seek
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [seek]  The position to move current playback to (in seconds).
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will changed.
 * @returns {number} return the current seek position (if no extra parameters were given)
 * @example
 * // return the current position of the background music
 * var current_pos = me.audio.seek("dst-gameforest");
 * // set back the position of the background music to the beginning
 * me.audio.seek("dst-gameforest", 0);
 */
declare function seek(sound_name: string, ...args: any[]): number;
/**
 * get or set the rate of playback for a sound.
 * @function me.audio.rate
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [rate] playback rate : 0.5 to 4.0, with 1.0 being normal speed.
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will be changed.
 * @returns {number} return the current playback rate (if no extra parameters were given)
 * @example
 * // get the playback rate of the background music
 * var rate = me.audio.rate("dst-gameforest");
 * // speed up the playback of the background music
 * me.audio.rate("dst-gameforest", 2.0);
 */
declare function rate(sound_name: string, ...args: any[]): number;
/**
 * stop the specified sound on all channels
 * @function me.audio.stop
 * @param {string} [sound_name] audio clip name (case sensitive). If none is passed, all sounds are stopped.
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will stop.
 * @example
 * me.audio.stop("cling");
 */
declare function stop(sound_name?: string, id?: number): void;
/**
 * pause the specified sound on all channels<br>
 * this function does not reset the currentTime property
 * @function me.audio.pause
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will pause.
 * @example
 * me.audio.pause("cling");
 */
declare function pause(sound_name: string, id?: number): void;
/**
 * resume the specified sound on all channels<br>
 * @function me.audio.resume
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will resume.
 * @example
 * // play a audio clip
 * var id = me.audio.play("myClip");
 * ...
 * // pause it
 * me.audio.pause("myClip", id);
 * ...
 * // resume
 * me.audio.resume("myClip", id);
 */
declare function resume(sound_name: string, id?: number): void;
/**
 * play the specified audio track<br>
 * this function automatically set the loop property to true<br>
 * and keep track of the current sound being played.
 * @function me.audio.playTrack
 * @param {string} sound_name audio track name - case sensitive
 * @param {number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
 * @returns {number} the sound instance ID.
 * @example
 * me.audio.playTrack("awesome_music");
 */
declare function playTrack(sound_name: string, volume?: number): number;
/**
 * stop the current audio track
 * @function me.audio.stopTrack
 * @see me.audio#playTrack
 * @example
 * // play a awesome music
 * me.audio.playTrack("awesome_music");
 * // stop the current music
 * me.audio.stopTrack();
 */
declare function stopTrack(): void;
/**
 * pause the current audio track
 * @function me.audio.pauseTrack
 * @example
 * me.audio.pauseTrack();
 */
declare function pauseTrack(): void;
/**
 * resume the previously paused audio track
 * @function me.audio.resumeTrack
 * @example
 * // play an awesome music
 * me.audio.playTrack("awesome_music");
 * // pause the audio track
 * me.audio.pauseTrack();
 * // resume the music
 * me.audio.resumeTrack();
 */
declare function resumeTrack(): void;
/**
 * returns the current track Id
 * @function me.audio.getCurrentTrack
 * @returns {string} audio track name
 */
declare function getCurrentTrack(): string;
/**
 * set the default global volume
 * @function me.audio.setVolume
 * @param {number} volume Float specifying volume (0.0 - 1.0 values accepted).
 */
declare function setVolume(volume: number): void;
/**
 * get the default global volume
 * @function me.audio.getVolume
 * @returns {number} current volume value in Float [0.0 - 1.0] .
 */
declare function getVolume(): number;
/**
 * mute or unmute the specified sound, but does not pause the playback.
 * @function me.audio.mute
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will mute.
 * @param {boolean} [mute=true] True to mute and false to unmute
 * @example
 * // mute the background music
 * me.audio.mute("awesome_music");
 */
declare function mute(sound_name: string, id?: number, mute?: boolean): void;
/**
 * unmute the specified sound
 * @function me.audio.unmute
 * @param {string} sound_name audio clip name
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will unmute.
 */
declare function unmute(sound_name: string, id?: number): void;
/**
 * mute all audio
 * @function me.audio.muteAll
 */
declare function muteAll(): void;
/**
 * unmute all audio
 * @function me.audio.unmuteAll
 */
declare function unmuteAll(): void;
/**
 * Returns true if audio is muted globally.
 * @function me.audio.muted
 * @returns {boolean} true if audio is muted globally
 */
declare function muted(): boolean;
/**
 * unload specified audio track to free memory
 * @function me.audio.unload
 * @param {string} sound_name audio track name - case sensitive
 * @returns {boolean} true if unloaded
 * @example
 * me.audio.unload("awesome_music");
 */
declare function unload(sound_name: string): boolean;
/**
 * unload all audio to free memory
 * @function me.audio.unloadAll
 * @function
 * @example
 * me.audio.unloadAll();
 */
declare function unloadAll(): void;
declare var globalResponse: ResponseObject;
/**
 * placeholder for all deprecated classes and corresponding alias for backward compatibility
 * @namespace deprecated
 * @memberOf me
 */
/**
 * display a deprecation warning in the console
 * @public
 * @function
 * @memberOf me.deprecated
 * @name warning
 * @param {string} deprecated deprecated class,function or property name
 * @param {string} replacement the replacement class, function, or property name
 * @param {string} version the version since when the lass,function or property is deprecated
 */
declare function warning(deprecated: string, replacement: string, version: string): void;
/**
 * Backward compatibility for deprecated method or properties are automatically
 * applied when automatically generating an UMD bundle (which is the default since version 9.0).
 * @memberof me.deprecated
 * @function apply
 */
declare function apply(): void;
/**
 * calls each of the listeners registered for a given event.
 * @function me.event.emit
 * @param {string|symbol} eventName The event name.
 * @param {object} [...arguments] arguments to be passed to all listeners
 * @returns {boolean} true if the event had listeners, false otherwise.
 * @example
 * me.event.emit("event-name", a, b, c);
 */
declare function emit(eventName: string | symbol, ...args: any[]): boolean;
/**
 * Add a listener for a given event.
 * @function me.event.on
 * @param {string|symbol} eventName The event name.
 * @param {Function} listener The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.on("event-name", myFunction, this);
 */
declare function on(eventName: string | symbol, listener: Function, context?: any): {};
/**
 * Add a one-time listener for a given event.
 * @function me.event.once
 * @param {string|symbol} eventName The event name.
 * @param {Function} listener The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.once("event-name", myFunction, this);
 */
declare function once(eventName: string | symbol, listener: Function, context?: any): {};
/**
 * remove the given listener for a given event.
 * @function me.event.off
 * @param {string|symbol} eventName The event name.
 * @param {Function} listener The listener function.
 * @returns {EventEmitter} `this`.
 * @public
 * @example
 * me.event.off("event-name", myFunction);
 */
declare function off(eventName: string | symbol, listener: Function): {};
/**
 * Fired when a level is fully loaded and all entities instantiated. <br>
 * Additionnaly the level id will also be passed to the called function.
 * @function me.game.onLevelLoaded
 * @example
 * // call myFunction () everytime a level is loaded
 * me.game.onLevelLoaded = this.myFunction.bind(this);
 */
declare function onLevelLoaded(): void;
/**
 * reset the game Object manager<br>
 * destroy all current objects
 * @function me.game.reset
 */
declare function reset(): void;
/**
 * Update the renderer framerate using the system config variables.
 * @function me.game.updateFrameRate
 * @see me.timer.maxfps
 * @see me.World.fps
 */
declare function updateFrameRate(): void;
/**
 * Returns the parent container of the specified Child in the game world
 * @function me.game.getParentContainer
 * @param {me.Renderable} child
 * @returns {me.Container}
 */
declare function getParentContainer(child: me.Renderable): me.Container;
/**
 * force the redraw (not update) of all objects
 * @function me.game.repaint
 */
declare function repaint(): void;
/**
 * update all objects of the game manager
 * @ignore
 * @function me.game.update
 * @param {number} time current timestamp as provided by the RAF callback
 * @param {me.Stage} stage the current stage
 */
declare function update$1(time: number, stage: me.Stage): void;
/**
 * draw the current scene/stage
 * @function me.game.draw
 * @ignore
 * @param {me.Stage} stage the current stage
 */
declare function draw(stage: me.Stage): void;
/**
 * Translate the specified x and y values from the global (absolute)
 * coordinate to local (viewport) relative coordinate.
 * @name globalToLocal
 * @memberOf me.input
 * @public
 * @function
 * @param {number} x the global x coordinate to be translated.
 * @param {number} y the global y coordinate to be translated.
 * @param {me.Vector2d} [v] an optional vector object where to set the translated coordinates
 * @returns {me.Vector2d} A vector object with the corresponding translated coordinates
 * @example
 * onMouseEvent : function (pointer) {
 *    // convert the given into local (viewport) relative coordinates
 *    var pos = me.input.globalToLocal(pointer.clientX, pointer.clientY);
 *    // do something with pos !
 * };
 */
declare function globalToLocal(x: number, y: number, v?: me.Vector2d): me.Vector2d;
/**
 * enable/disable all gestures on the given element.<br>
 * by default melonJS will disable browser handling of all panning and zooming gestures.
 * @name setTouchAction
 * @memberOf me.input
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
 * @public
 * @function
 * @param {HTMLCanvasElement} element
 * @param {string} [value="none"]
 */
declare function setTouchAction(element: HTMLCanvasElement, value?: string): void;
/**
 * Associate a pointer event to a keycode<br>
 * Left button – 0
 * Middle button – 1
 * Right button – 2
 * @name bindPointer
 * @memberOf me.input
 * @public
 * @function
 * @param {number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
 * @param {me.input.KEY} keyCode
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.X, "shoot");
 * // map the left button click on the X key (default if the button is not specified)
 * me.input.bindPointer(me.input.KEY.X);
 * // map the right button click on the X key
 * me.input.bindPointer(me.input.pointer.RIGHT, me.input.KEY.X);
 */
declare function bindPointer(...args: any[]): void;
/**
 * unbind the defined keycode
 * @name unbindPointer
 * @memberOf me.input
 * @public
 * @function
 * @param {number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
 * @example
 * me.input.unbindPointer(me.input.pointer.LEFT);
 */
declare function unbindPointer(button?: number): void;
/**
 * allows the removal of all registered event listeners from the object target.
 * @name releaseAllPointerEvents
 * @memberOf me.input
 * @public
 * @function
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region the registered region to release event from
 * @example
 * // release all registered event on the
 * me.input.releaseAllPointerEvents(this);
 */
declare function releaseAllPointerEvents(region: me.Rect | me.Polygon | me.Line | me.Ellipse): void;
/**
 * enable keyboard event
 * @ignore
 */
declare function initKeyboardEvent(): void;
/**
 * return the key press status of the specified action
 * @name isKeyPressed
 * @memberOf me.input
 * @public
 * @function
 * @param {string} action user defined corresponding action
 * @returns {boolean} true if pressed
 * @example
 * if (me.input.isKeyPressed('left')) {
 *    //do something
 * }
 * else if (me.input.isKeyPressed('right')) {
 *    //do something else...
 * }
 */
declare function isKeyPressed(action: string): boolean;
/**
 * return the key status of the specified action
 * @name keyStatus
 * @memberOf me.input
 * @public
 * @function
 * @param {string} action user defined corresponding action
 * @returns {boolean} down (true) or up(false)
 */
declare function keyStatus(action: string): boolean;
/**
 * trigger the specified key (simulated) event <br>
 * @name triggerKeyEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {boolean} [status=false] true to trigger a key down event, or false for key up event
 * @param {number} [mouseButton] the mouse button to trigger
 * @example
 * // trigger a key press
 * me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
 */
declare function triggerKeyEvent(keycode: me.input.KEY, status?: boolean, mouseButton?: number): void;
/**
 * associate a user defined action to a keycode
 * @name bindKey
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {string} action user defined corresponding action
 * @param {boolean} [lock=false] cancel the keypress event once read
 * @param {boolean} [preventDefault=me.input.preventDefault] prevent default browser action
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.LEFT,  "left");
 * me.input.bindKey(me.input.KEY.RIGHT, "right");
 * me.input.bindKey(me.input.KEY.X,     "jump", true);
 * me.input.bindKey(me.input.KEY.F1,    "options", true, true);
 */
declare function bindKey(keycode: me.input.KEY, action: string, lock?: boolean, preventDefault$1?: boolean): void;
/**
 * return the action associated with the given keycode
 * @name getBindingKey
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @returns {string} user defined associated action
 */
declare function getBindingKey(keycode: me.input.KEY): string;
/**
 * unlock a key manually
 * @name unlockKey
 * @memberOf me.input
 * @public
 * @function
 * @param {string} action user defined corresponding action
 * @example
 * // Unlock jump when touching the ground
 * if (!this.falling && !this.jumping) {
 *     me.input.unlockKey("jump");
 * }
 */
declare function unlockKey(action: string): void;
/**
 * unbind the defined keycode
 * @name unbindKey
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @example
 * me.input.unbindKey(me.input.KEY.LEFT);
 */
declare function unbindKey(keycode: me.input.KEY): void;
/**
 * Associate a gamepad event to a keycode
 * @name bindGamepad
 * @memberOf me.input
 * @public
 * @function
 * @param {number} index Gamepad index
 * @param {object} button Button/Axis definition
 * @param {string} button.type "buttons" or "axes"
 * @param {me.input.GAMEPAD.BUTTONS|me.input.GAMEPAD.AXES} button.code button or axis code id
 * @param {number} [button.threshold=1] value indicating when the axis should trigger the keycode (e.g. -0.5 or 0.5)
 * @param {me.input.KEY} keyCode
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.X, "shoot");
 * ...
 * // map the lower face button on the first gamepad to the X key
 * me.input.bindGamepad(0, {type:"buttons", code: me.input.GAMEPAD.BUTTONS.FACE_1}, me.input.KEY.X);
 * // map the left axis value on the first gamepad to the LEFT key
 * me.input.bindGamepad(0, {type:"axes", code: me.input.GAMEPAD.AXES.LX, threshold: -0.5}, me.input.KEY.LEFT);
 */
declare function bindGamepad(index: number, button: {
    type: string;
    code: me.input.GAMEPAD.BUTTONS | me.input.GAMEPAD.AXES;
    threshold?: number;
}, keyCode: me.input.KEY): void;
/**
 * unbind the defined keycode
 * @name unbindGamepad
 * @memberOf me.input
 * @public
 * @function
 * @param {number} index Gamepad index
 * @param {me.input.GAMEPAD.BUTTONS} button
 * @example
 * me.input.unbindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1);
 */
declare function unbindGamepad(index: number, button: me.input.GAMEPAD.BUTTONS): void;
/**
 * Set deadzone for analog gamepad inputs<br>
 * The default deadzone is 0.1 (10%) Analog values less than this will be ignored
 * @name setGamepadDeadzone
 * @memberOf me.input
 * @public
 * @function
 * @param {number} value Deadzone value
 */
declare function setGamepadDeadzone(value: number): void;
/**
 * Firefox reports different ids for gamepads depending on the platform:
 * - Windows: vendor and product codes contain leading zeroes
 * - Mac: vendor and product codes are sparse (no leading zeroes)
 *
 * This function normalizes the id to support both formats
 * @ignore
 */
declare function addMapping(id: any, mapping: any): void;
declare class BasePlugin {
    /**
     * define the minimum required version of melonJS<br>
     * this can be overridden by the plugin
     * @public
     * @type {string}
     * @default "10.3.0"
     * @name me.plugin.Base#version
     */
    public version: string;
}
declare var agentUtils: Readonly<{
    __proto__: any;
    prefixed: typeof prefixed;
    setPrefixed: typeof setPrefixed;
}>;
declare var arrayUtils: Readonly<{
    __proto__: any;
    remove: typeof remove;
    random: typeof random;
    weightedRandom: typeof weightedRandom;
}>;
declare var fileUtils: Readonly<{
    __proto__: any;
    getBasename: typeof getBasename;
    getExtension: typeof getExtension;
}>;
declare var stringUtils: Readonly<{
    __proto__: any;
    capitalize: typeof capitalize;
    trimLeft: typeof trimLeft;
    trimRight: typeof trimRight;
    isNumeric: typeof isNumeric;
    isBoolean: typeof isBoolean;
    toHex: typeof toHex$1;
}>;
declare var fnUtils: Readonly<{
    __proto__: any;
    defer: typeof defer;
    throttle: typeof throttle;
}>;
/**
 * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer). <br>
 * melonJS support various scaling mode, that can be enabled <u>once the scale option is set to <b>`auto`</b></u> : <br>
 *  - <i><b>`fit`</b></i> : Letterboxed; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fit.png"/></center><br>
 *  - <i><b>`fill-min`</b></i> : Canvas is resized to fit minimum design resolution; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fill-min.png"/></center><br>
 *  - <i><b>`fill-max`</b></i> : Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fill-max.png"/></center><br>
 *  - <i><b>`flex`</b><</i> : Canvas width & height is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex.png"/></center><br>
 *  - <i><b>`flex-width`</b></i> : Canvas width is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex-width.png"/></center><br>
 *  - <i><b>`flex-height`</b></i> : Canvas height is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex-height.png"/></center><br>
 *  - <i><b>`stretch`</b></i> : Canvas is resized to fit; content is scaled to screen aspect ratio
 * <center><img src="images/scale-stretch.png"/></center><br>
 * @function me.video.init
 * @param {number} width The width of the canvas viewport
 * @param {number} height The height of the canvas viewport
 * @param {object} [options] The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
 * @param {string|HTMLElement} [options.parent=document.body] the DOM parent element to hold the canvas in the HTML file
 * @param {number} [options.renderer=me.video.AUTO] renderer to use (me.video.CANVAS, me.video.WEBGL, me.video.AUTO)
 * @param {boolean} [options.doubleBuffering=false] enable/disable double buffering
 * @param {number|string} [options.scale=1.0] enable scaling of the canvas ('auto' for automatic scaling)
 * @param {string} [options.scaleMethod="fit"] screen scaling modes ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch')
 * @param {boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
 * @param {string} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @param {boolean} [options.transparent=false] whether to allow transparent pixels in the front buffer (screen).
 * @param {boolean} [options.antiAlias=false] whether to enable or not video scaling interpolation
 * @param {boolean} [options.consoleHeader=true] whether to display melonJS version and basic device information in the console
 * @returns {boolean} false if initialization failed (canvas not supported)
 * @example
 * // init the video with a 640x480 canvas
 * me.video.init(640, 480, {
 *     parent : "screen",
 *     renderer : me.video.AUTO,
 *     scale : "auto",
 *     scaleMethod : "fit",
 *     doubleBuffering : true
 * });
 */
declare function init(width: number, height: number, options?: {
    parent?: string | HTMLElement;
    renderer?: number;
    doubleBuffering?: boolean;
    scale?: number | string;
    scaleMethod?: string;
    preferWebGL1?: boolean;
    powerPreference?: string;
    transparent?: boolean;
    antiAlias?: boolean;
    consoleHeader?: boolean;
}): boolean;
/**
 * Create and return a new Canvas element
 * @function me.video.createCanvas
 * @param {number} width width
 * @param {number} height height
 * @param {boolean} [offscreen=false] will returns an OffscreenCanvas if supported
 * @returns {HTMLCanvasElement|OffscreenCanvas}
 */
declare function createCanvas(width: number, height: number, offscreen?: boolean): HTMLCanvasElement | OffscreenCanvas;
/**
 * return a reference to the parent DOM element holding the main canvas
 * @function me.video.getParent
 * @returns {HTMLElement}
 */
declare function getParent(): HTMLElement;
/**
 * scale the "displayed" canvas by the given scalar.
 * this will modify the size of canvas element directly.
 * Only use this if you are not using the automatic scaling feature.
 * @function me.video.scale
 * @see me.video.init
 * @param {number} x x scaling multiplier
 * @param {number} y y scaling multiplier
 */
declare function scale(x: number, y: number): void;
/**
 * @classdesc
 * An object representing the result of an intersection.
 * @property {me.Renderable} a The first object participating in the intersection
 * @property {me.Renderable} b The second object participating in the intersection
 * @property {number} overlap Magnitude of the overlap on the shortest colliding axis
 * @property {me.Vector2d} overlapV The overlap vector (i.e. `overlapN.scale(overlap, overlap)`). If this vector is subtracted from the position of a, a and b will no longer be colliding
 * @property {me.Vector2d} overlapN The shortest colliding axis (unit-vector)
 * @property {boolean} aInB Whether the first object is entirely inside the second
 * @property {boolean} bInA Whether the second object is entirely inside the first
 * @property {number} indexShapeA The index of the colliding shape for the object a body
 * @property {number} indexShapeB The index of the colliding shape for the object b body
 * @name ResponseObject
 * @memberOf me.collision
 * @public
 */
declare class ResponseObject {
    a: any;
    b: any;
    overlapN: Vector2d;
    overlapV: Vector2d;
    aInB: boolean;
    bInA: boolean;
    indexShapeA: number;
    indexShapeB: number;
    overlap: number;
    /**
     * Set some values of the response back to their defaults. <br>
     * Call this between tests if you are going to reuse a single <br>
     * Response object for multiple intersection tests <br>
     * (recommended as it will avoid allocating extra memory) <br>
     * @name clear
     * @memberOf me.collision.ResponseObject
     * @public
     * @function
     * @returns {object} this object for chaining
     */
    public clear(): object;
}
/**
 * Get a vendor-prefixed property
 * @public
 * @name prefixed
 * @function
 * @param {string} name Property name
 * @param {object} [obj=window] Object or element reference to access
 * @returns {string} Value of property
 * @memberOf me.utils.agent
 */
declare function prefixed(name: string, obj?: object): string;
/**
 * Set a vendor-prefixed property
 * @public
 * @name setPrefixed
 * @function
 * @param {string} name Property name
 * @param {string} value Property value
 * @param {object} [obj=window] Object or element reference to access
 * @returns {boolean} true if one of the vendor-prefixed property was found
 * @memberOf me.utils.agent
 */
declare function setPrefixed(name: string, value: string, obj?: object): boolean;
/**
 * a collection of array utility functions
 * @namespace me.utils.array
 * @memberOf me
 */
/**
 * Remove the specified object from the given Array
 * @public
 * @function
 * @memberOf me.utils.array
 * @name remove
 * @param {Array} arr array from which to remove an object
 * @param {object} obj to be removed
 * @returns {Array} the modified Array
 * var arr = [ "foo", "bar", "baz" ];
 * // remove "foo" from the array
 * me.utils.array.remove(arr, "foo");
 */
declare function remove(arr: any[], obj: object): any[];
/**
 * return a random array element
 * @public
 * @function
 * @memberOf me.utils.array
 * @name random
 * @param {Array} arr array to pick a element
 * @returns {any} random member of array
 * @example
 * // Select a random array element
 * var arr = [ "foo", "bar", "baz" ];
 * console.log(me.utils.array.random(arr));
 */
declare function random(arr: any[]): any;
/**
 * return a weighted random array element, favoring the earlier entries
 * @public
 * @function
 * @memberOf me.utils.array
 * @name weightedRandom
 * @param {Array} arr array to pick a element
 * @returns {any} random member of array
 */
declare function weightedRandom(arr: any[]): any;
/**
 * return the base name of the file without path info
 * @public
 * @function
 * @memberOf me.utils.file
 * @name getBasename
 * @param  {string} path path containing the filename
 * @returns {string} the base name without path information.
 */
declare function getBasename(path: string): string;
/**
 * return the extension of the file in the given path
 * @public
 * @function
 * @memberOf me.utils.file
 * @name getExtension
 * @param  {string} path path containing the filename
 * @returns {string} filename extension.
 */
declare function getExtension(path: string): string;
/**
 * a collection of string utility functions
 * @namespace me.utils.string
 * @memberOf me
 */
/**
 * converts the first character of the given string to uppercase
 * @public
 * @function
 * @memberOf me.utils.string
 * @name capitalize
 * @param {string} str the string to be capitalized
 * @returns {string} the capitalized string
 */
declare function capitalize(str: string): string;
/**
 * returns the string stripped of whitespace from the left.
 * @public
 * @function
 * @memberOf me.utils.string
 * @name trimLeft
 * @param {string} str the string to be trimmed
 * @returns {string} trimmed string
 */
declare function trimLeft(str: string): string;
/**
 * returns the string stripped of whitespace from the right.
 * @public
 * @function
 * @memberOf me.utils.string
 * @name trimRight
 * @param {string} str the string to be trimmed
 * @returns {string} trimmed string
 */
declare function trimRight(str: string): string;
/**
 * returns true if the given string contains a numeric integer or float value
 * @public
 * @function
 * @memberOf me.utils.string
 * @name isNumeric
 * @param {string} str the string to be tested
 * @returns {boolean} true if string contains only digits
 */
declare function isNumeric(str: string): boolean;
/**
 * returns true if the given string contains a true or false
 * @public
 * @function
 * @memberOf me.utils.string
 * @name isBoolean
 * @param {string} str the string to be tested
 * @returns {boolean} true if the string is either true or false
 */
declare function isBoolean(str: string): boolean;
/**
 * convert a string to the corresponding hexadecimal value
 * @public
 * @function
 * @memberOf me.utils.string
 * @name toHex
 * @param {string} str the string to be converted
 * @returns {string} the converted hexadecimal value
 */
declare function toHex$1(str: string): string;
/**
 * a collection of utility functions
 * @namespace me.utils.function
 * @memberOf me
 */
/**
 * Executes a function as soon as the interpreter is idle (stack empty).
 * @public
 * @function
 * @memberOf me.utils.function
 * @name defer
 * @param {Function} func The function to be deferred.
 * @param {object} thisArg The value to be passed as the this parameter to the target function when the deferred function is called
 * @param {...*} [args] Optional additional arguments to carry for the function.
 * @returns {number} id that can be used to clear the deferred function using
 * clearTimeout
 * @example
 * // execute myFunc() when the stack is empty,
 * // with the current context and [1, 2, 3] as parameter
 * me.utils.function.defer(myFunc, this, 1, 2, 3);
 */
declare function defer(func: Function, thisArg: object, ...args?: any[]): number;
/**
 * returns a function that, when invoked will only be triggered at most
 * once during a given window of time
 * @public
 * @function
 * @memberOf me.utils.function
 * @name throttle
 * @param {Function} fn the function to be throttled.
 * @param {number} delay The delay in ms
 * @param {no_trailing} no_trailing disable the execution on the trailing edge
 * @returns {Function} the function that will be throttled
 */
declare function throttle(fn: Function, delay: number, no_trailing: any): Function;
export { Bounds$1 as Bounds, math as Math, device$1 as device, timer$1 as timer };
