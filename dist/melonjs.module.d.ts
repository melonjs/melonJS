/**
 * a bitmap font object
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} [scale=1.0]
 * @param {Object} settings the text configuration
 * @param {String|Image} settings.font a font name to identify the corresponing source image
 * @param {String} [settings.fontData=settings.font] the bitmap font data corresponding name, or the bitmap font data itself
 * @param {Number} [settings.size] size a scaling ratio
 * @param {me.Color|String} [settings.fillStyle] a CSS color value used to tint the bitmapText (@see me.BitmapText.tint)
 * @param {Number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
 * @param {String} [settings.textAlign="left"] horizontal text alignment
 * @param {String} [settings.textBaseline="top"] the text baseline
 * @param {Number} [settings.lineHeight=1.0] line spacing height
 * @param {me.Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
 * @param {(String|String[])} [settings.text] a string, or an array of strings
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
     * @type String
     * @default "left"
     * @name textAlign
     * @memberOf me.BitmapText
     */
    public textAlign: string;
    /**
     * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
     * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
     * @public
     * @type String
     * @default "top"
     * @name textBaseline
     * @memberOf me.BitmapText
     */
    public textBaseline: string;
    /**
     * Set the line spacing height (when displaying multi-line strings). <br>
     * Current font height will be multiplied with this value to set the line height.
     * @public
     * @type Number
     * @default 1.0
     * @name lineHeight
     * @memberOf me.BitmapText
     */
    public lineHeight: number;
    /**
     * the text to be displayed
     * @private
     * @type {String[]}
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
     * @param {String} textAlign ("left", "center", "right")
     * @param {Number} [scale]
     * @return this object for chaining
     */
    set(textAlign: string, scale?: number): BitmapText;
    isDirty: boolean;
    /**
     * change the text to be displayed
     * @name setText
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {Number|String|String[]} value a string, or an array of strings
     * @return this object for chaining
     */
    setText(value: number | string | string[]): BitmapText;
    /**
     * @ignore
     */
    set fillStyle(arg: any);
    /**
     * defines the color used to tint the bitmap text
     * @public
     * @type {me.Color}
     * @name fillStyle
     * @see me.Renderable#tint
     * @memberOf me.BitmapText
     */
    /**
     * @ignore
     */
    get fillStyle(): any;
    tint: any;
    /**
     * change the font display size
     * @name resize
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {Number} scale ratio
     * @return this object for chaining
     */
    resize(scale: number): BitmapText;
    /**
     * measure the given text size in pixels
     * @name measureText
     * @memberOf me.BitmapText.prototype
     * @function
     * @param {String} [text]
     * @param {me.Rect} [ret] a object in which to store the text metrics
     * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
     */
    measureText(text?: string, ret?: any): TextMetrics;
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
     * @param {String} [text]
     * @param {Number} [x]
     * @param {Number} [y]
     */
    draw(renderer: any | any, text?: string, x?: number, y?: number): void;
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
 * @param data {String} - The bitmap font data pulled from the resource loader using me.loader.getBinary()
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
     * @type {Object}
     * @memberOf me.BitmapTextData
     */
    glyphs: any;
    /**
     * This parses the font data text and builds a map of glyphs containing the data for each character
     * @name parse
     * @memberOf me.BitmapTextData
     * @function
     * @param {String} fontData
     */
    parse(fontData: string): void;
}
/**
 * a Generic Body Object with some physic properties and behavior functionality<br>
 The body object is attached as a member of a Renderable.  The Body object can handle movements of the parent with
 the body.update call.  It is important to know that when body.update is called there are several things that happen related to
 the movement and positioning of the parent renderable object.  1) The force/gravity/friction parameters are used
 to calculate a new velocity and 2) the parent position is updated by adding this to the parent.pos (position me.Vector2d)
 value. Thus Affecting the movement of the parent.  Look at the source code for /src/physics/body.js:update (me.Body.update) for
 a better understanding.
 * @class Body
 * @memberOf me
 * @constructor
 * @param {me.Renderable} ancestor the parent object this body is attached to
 * @param {me.Rect|me.Rect[]|me.Polygon|me.Polygon[]|me.Line|me.Line[]|me.Ellipse|me.Ellipse[]|me.Bounds|me.Bounds[]|Object} [shapes] a initial shape, list of shapes, or JSON object defining the body
 * @param {Function} [onBodyUpdate] callback for when the body is updated (e.g. add/remove shapes)
 */
export class Body {
    constructor(parent: any, shapes: any, onBodyUpdate: any);
    /**
     * a reference to the parent object that contains this body,
     * or undefined if it has not been added to one.
     * @public
     * @type me.Renderable
     * @default undefined
     * @name me.Body#ancestor
     */
    public ancestor: any;
    bounds: Bounds$1;
    shapes: any[];
    /**
     * The body collision mask, that defines what should collide with what.<br>
     * (by default will collide with all entities)
     * @ignore
     * @type Number
     * @default me.collision.types.ALL_OBJECT
     * @name collisionMask
     * @see me.collision.types
     * @memberOf me.Body
     */
    collisionMask: number;
    /**
     * define the collision type of the body for collision filtering
     * @public
     * @type Number
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
     * @type {Number}
     * @default 0
     * @name bounce
     * @memberOf me.Body
     */
    public bounce: number;
    /**
     * the body mass
     * @public
     * @type {Number}
     * @default 1
     * @name mass
     * @memberOf me.Body
     */
    public mass: number;
    maxVel: Vector2d;
    /**
     * The degree to which this body is affected by the world gravity
     * @public
     * @see me.World.gravity
     * @type Number
     * @default 1.0
     * @name gravityScale
     * @memberOf me.Body
     */
    public gravityScale: number;
    /**
     * If true this body won't be affected by the world gravity
     * @public
     * @see me.World.gravity
     * @type Boolean
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
     * @type Boolean
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
     * @type Boolean
     * @default false
     * @name jumping
     * @memberOf me.Body
     */
    public readonly jumping: boolean;
    onBodyUpdate: any;
    /**
     * add a collision shape to this body <br>
     * (note: me.Rect objects will be converted to me.Polygon before being added)
     * @name addShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse|me.Bounds|Object} shape a shape or JSON object
     * @return {Number} the shape array length
     * @example
     * // add a rectangle shape
     * this.body.addShape(new me.Rect(0, 0, image.width, image.height));
     * // add a shape from a JSON object
     * this.body.addShape(me.loader.getJSON("shapesdef").banana);
     */
    public addShape(shape: any | any | any | any | any | any): number;
    /**
     * set the body vertices to the given one
     * @name setVertices
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {Number} [index=0] the shape object for which to set the vertices
     * @param {boolean} [clear=true] either to reset the body definition before adding the new vertices
     */
    public setVertices(vertices: any[], index?: number, clear?: boolean): void;
    /**
     * add the given vertices to the body shape
     * @name addVertices
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {Number} [index=0] the shape object for which to set the vertices
     */
    public addVertices(vertices: any[], index?: number): void;
    /**
     * add collision mesh based on a JSON object
     * (this will also apply any physic properties defined in the given JSON file)
     * @name fromJSON
     * @memberOf me.Body
     * @public
     * @function
     * @param {Object} json a JSON object as exported from a Physics Editor tool
     * @param {String} [id] an optional shape identifier within the given the json object
     * @see https://www.codeandweb.com/physicseditor
     * @return {Number} how many shapes were added to the body
     * @example
     * // define the body based on the banana shape
     * this.body.fromJSON(me.loader.getJSON("shapesdef").banana);
     * // or ...
     * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
     */
    public fromJSON(json: any, id?: string): number;
    /**
     * return the collision shape at the given index
     * @name getShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {Number} [index=0] the shape object at the specified index
     * @return {me.Polygon|me.Line|me.Ellipse} shape a shape object if defined
     */
    public getShape(index?: number): any | any | any;
    /**
     * returns the AABB bounding box for this body
     * @name getBounds
     * @memberOf me.Body
     * @function
     * @return {me.Bounds} bounding box Rectangle object
     */
    getBounds(): any;
    /**
     * remove the specified shape from the body shape list
     * @name removeShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Polygon|me.Line|me.Ellipse} shape a shape object
     * @return {Number} the shape array length
     */
    public removeShape(shape: any | any | any): number;
    /**
     * remove the shape at the given index from the body shape list
     * @name removeShapeAt
     * @memberOf me.Body
     * @public
     * @function
     * @param {Number} index the shape object at the specified index
     * @return {Number} the shape array length
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
     * @param {Number} [bitmask = me.collision.types.ALL_OBJECT] the collision mask
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
     * @param {Number} type the collision type
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
    protected respondToCollision(response: any): void;
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
     * @param {Object} [thisArg] value to use as this(i.e reference Object) when executing callback.
     * @example
     * // iterate through all shapes of the physic body
     * mySprite.body.forEach((shape) => {
     *    shape.doSomething();
     * });
     * mySprite.body.forEach((shape, index) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... }, thisArg);
     */
    forEach(callback: Function, thisArg?: any, ...args: any[]): void;
    /**
     * Returns true if the any of the shape composing the body contains the given point.
     * @name contains
     * @memberOf me.Body
     * @function
     * @param  {me.Vector2d} point
     * @return {boolean} true if contains
     */
    /**
     * Returns true if the any of the shape composing the body contains the given point.
     * @name contains
     * @memberOf me.Body
     * @function
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * Rotate this body (counter-clockwise) by the specified angle (in radians).
     * Unless specified the body will be rotated around its center point
     * @name rotate
     * @memberOf me.Body
     * @function
     * @param {Number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v=me.Body.getBounds().center] an optional point to rotate around
     * @return {me.Body} Reference to this object for method chaining
     */
    rotate(angle: number, v?: any | any): any;
    /**
     * cap the body velocity (body.maxVel property) to the specified value<br>
     * @name setMaxVelocity
     * @memberOf me.Body
     * @function
     * @param {Number} x max velocity on x axis
     * @param {Number} y max velocity on y axis
     * @protected
     */
    protected setMaxVelocity(x: number, y: number): void;
    /**
     * set the body default friction
     * @name setFriction
     * @memberOf me.Body
     * @function
     * @param {Number} x horizontal friction
     * @param {Number} y vertical friction
     * @protected
     */
    protected setFriction(x: number, y: number): void;
    /**
     * apply friction to a vector
     * @ignore
     */
    applyFriction(vel: any): void;
    /**
     * compute the new velocity value
     * @ignore
     */
    computeVelocity(vel: any): void;
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
     * At this time a call to Body.Update does not call the onBodyUpdate callback that is listed in the init: function.
     * @name update
     * @memberOf me.Body
     * @function
     * @return {boolean} true if resulting velocity is different than 0
     * @see source code for me.Body.computeVelocity (private member)
     */
    update(): boolean;
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
 * @return {me.Bounds} A new bounds object
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
     * @param {Number} minX
     * @param {Number} minY
     * @param {Number} maxX
     * @param {Number} maxY
     */
    setMinMax(minX: number, minY: number, maxX: number, maxY: number): void;
    public set x(arg: number);
    /**
     * x position of the bound
     * @public
     * @type {Number}
     * @name x
     * @memberOf me.Bounds
     */
    public get x(): number;
    public set y(arg: number);
    /**
     * y position of the bounds
     * @public
     * @type {Number}
     * @name y
     * @memberOf me.Bounds
     */
    public get y(): number;
    public set width(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Bounds
     */
    public get width(): number;
    public set height(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Bounds
     */
    public get height(): number;
    /**
     * left coordinate of the bound
     * @public
     * @type {Number}
     * @name left
     * @memberOf me.Bounds
     */
    public get left(): number;
    /**
     * right coordinate of the bound
     * @public
     * @type {Number}
     * @name right
     * @memberOf me.Bounds
     */
    public get right(): number;
    /**
     * top coordinate of the bound
     * @public
     * @type {Number}
     * @name top
     * @memberOf me.Bounds
     */
    public get top(): number;
    /**
     * bottom coordinate of the bound
     * @public
     * @type {Number}
     * @name bottom
     * @memberOf me.Bounds
     */
    public get bottom(): number;
    /**
     * center position of the bound on the x axis
     * @public
     * @type {Number}
     * @name centerX
     * @memberOf me.Bounds
     */
    public get centerX(): number;
    /**
     * center position of the bound on the y axis
     * @public
     * @type {Number}
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
    public get center(): any;
    /**
     * Updates bounds using the given vertices
     * @name update
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     */
    update(vertices: any[]): void;
    /**
     * add the given vertices to the bounds definition.
     * @name add
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    add(vertices: any[], clear?: boolean): void;
    /**
     * add the given bounds to the bounds definition.
     * @name addBounds
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds} bounds
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    addBounds(bounds: any, clear?: boolean): void;
    /**
     * add the given point to the bounds definition.
     * @name addPoint
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} vector
     * @param {me.Matrix2d} [matrix] an optional transform to apply to the given point
     */
    addPoint(v: any, m: any): void;
    /**
     * add the given quad coordinates to this bound definition, multiplied by the given matrix
     * @name addFrame
     * @memberOf me.Bounds
     * @function
     * @param {Number} x0 - left X coordinates of the quad
     * @param {Number} y0 - top Y coordinates of the quad
     * @param {Number} x1 - right X coordinates of the quad
     * @param {Number} y1 - bottom y coordinates of the quad
     * @param {me.Matrix2d} [matrix] an optional transform to apply to the given frame coordinates
     */
    addFrame(x0: number, y0: number, x1: number, y1: number, m: any): void;
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} point
     * @return {boolean} True if the bounds contain the point, otherwise false
     */
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {Number} x
     * @param {Number} y
     * @return {boolean} True if the bounds contain the point, otherwise false
     */
    contains(...args: any[]): boolean;
    /**
     * Returns true if the two bounds intersect.
     * @name overlaps
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds|me.Rect} bounds
     * @return {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds: any | any): boolean;
    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @name isFinite
     * @memberOf me.Bounds
     * @function
     * @return {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
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
     * @param {Number} x
     * @param {Number} y
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
     * @param {Number} x
     * @param {Number} y
     */
    shift(...args: any[]): void;
    /**
     * clone this bounds
     * @name clone
     * @memberOf me.Bounds
     * @function
     * @return {me.Bounds}
     */
    clone(): any;
    /**
     * Returns a polygon whose edges are the same as this bounds.
     * @name toPolygon
     * @memberOf me.Bounds
     * @function
     * @return {me.Polygon} a new Polygon that represents this bounds.
     */
    toPolygon(): any;
}
/**
 * @classdesc
 * a 2D orthographic camera
 * @class Camera2d
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} minX start x offset
 * @param {Number} minY start y offset
 * @param {Number} maxX end x offset
 * @param {Number} maxY end y offset
 */
export class Camera2d {
    /**
     * @ignore
     */
    constructor(minX: any, minY: any, maxX: any, maxY: any);
    /**
     * Axis definition
     * @property NONE
     * @property HORIZONTAL
     * @property VERTICAL
     * @property BOTH
     * @public
     * @constant
     * @enum {Number}
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
     * @type me.Bounds
     * @name bounds
     * @memberOf me.Camera2d
     */
    public bounds: any;
    /**
     * [IMTERNAL] enable or disable damping
     * @private
     * @type {Boolean}
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
     * @type {Number}
     * @name damping
     * @default 1.0
     * @memberOf me.Camera2d
     */
    public damping: number;
    /**
     * the closest point relative to the camera
     * @public
     * @type {Number}
     * @name near
     * @default -1000
     * @memberOf me.Camera2d
     */
    public near: number;
    /**
     * the furthest point relative to the camera.
     * @public
     * @type {Number}
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
    public projectionMatrix: any;
    /**
     * the invert camera transform used to unproject points
     * @ignore
     * @type {me.Matrix2d}
     * @name invCurrentTransform
     * @memberOf me.Camera2d
     */
    invCurrentTransform: any;
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
     * @param {Number} [x=0]
     * @param {Number} [y=0]
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
     * @param {Number} w deadzone width
     * @param {Number} h deadzone height
     */
    setDeadzone(w: number, h: number): void;
    deadzone: Rect;
    /**
     * resize the camera
     * @name resize
     * @memberOf me.Camera2d
     * @function
     * @param {Number} w new width of the camera
     * @param {Number} h new height of the camera
     * @return {me.Camera2d} this camera
    */
    resize(w: number, h: number): any;
    /**
     * set the camera boundaries (set to the world limit by default).
     * the camera is bound to the given coordinates and cannot move/be scrolled outside of it.
     * @name setBounds
     * @memberOf me.Camera2d
     * @function
     * @param {Number} x world left limit
     * @param {Number} y world top limit
     * @param {Number} w world width limit
     * @param {Number} h world height limit
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
     * @param {Number} [damping=1] default damping value
     * @example
     * // set the camera to follow this renderable on both axis, and enable damping
     * me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH, 0.1);
     */
    follow(target: any | any, axis?: any, damping?: number): void;
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
     * @param {Number} x
     * @param {Number} y
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
     * @param {Number} x
     * @param {Number} y
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
     * @param {Number} intensity maximum offset that the screen can be moved
     * while shaking
     * @param {Number} duration expressed in milliseconds
     * @param {me.Camera2d.AXIS} [axis=this.AXIS.BOTH] specify on which axis you
     *   want the shake effect
     * @param {Function} [onComplete] callback once shaking effect is over
     * @param {Boolean} [force] if true this will override the current effect
     * @example
     * // shake it baby !
     * me.game.viewport.shake(10, 500, me.game.viewport.AXIS.BOTH);
     */
    shake(intensity: number, duration: number, axis?: any, onComplete?: Function, force?: boolean): void;
    /**
     * fadeOut(flash) effect<p>
     * screen is filled with the specified color and slowly goes back to normal
     * @name fadeOut
     * @memberOf me.Camera2d
     * @function
     * @param {me.Color|String} color a CSS color value
     * @param {Number} [duration=1000] expressed in milliseconds
     * @param {Function} [onComplete] callback once effect is over
     * @example
     * // fade the camera to white upon dying, reload the level, and then fade out back
     * me.game.viewport.fadeIn("#fff", 150, function() {
     *     me.audio.play("die", false);
     *     me.level.reload();
     *     me.game.viewport.fadeOut("#fff", 150);
     * });
     */
    fadeOut(color: any | string, duration?: number, onComplete?: Function): void;
    /**
     * fadeIn effect <p>
     * fade to the specified color
     * @name fadeIn
     * @memberOf me.Camera2d
     * @function
     * @param {me.Color|String} color a CSS color value
     * @param {Number} [duration=1000] expressed in milliseconds
     * @param {Function} [onComplete] callback once effect is over
     * @example
     * // flash the camera to white for 75ms
     * me.game.viewport.fadeIn("#FFFFFF", 75);
     */
    fadeIn(color: any | string, duration?: number, onComplete?: Function): void;
    /**
     * return the camera width
     * @name getWidth
     * @memberOf me.Camera2d
     * @function
     * @return {Number}
     */
    getWidth(): number;
    /**
     * return the camera height
     * @name getHeight
     * @memberOf me.Camera2d
     * @function
     * @return {Number}
     */
    getHeight(): number;
    /**
     * set the camera position around the specified object
     * @name focusOn
     * @memberOf me.Camera2d
     * @function
     * @param {me.Renderable}
     */
    focusOn(target: any): void;
    /**
     * check if the specified renderable is in the camera
     * @name isVisible
     * @memberOf me.Camera2d
     * @function
     * @param {me.Renderable} object
     * @param {Boolean} [floating===object.floating] if visibility check should be done against screen coordinates
     * @return {Boolean}
     */
    isVisible(obj: any, floating?: boolean): boolean;
    /**
     * convert the given "local" (screen) coordinates into world coordinates
     * @name localToWorld
     * @memberOf me.Camera2d
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} [v] an optional vector object where to set the
     * converted value
     * @return {me.Vector2d}
     */
    localToWorld(x: number, y: number, v?: number): any;
    /**
     * convert the given world coordinates into "local" (screen) coordinates
     * @name worldToLocal
     * @memberOf me.Camera2d
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} [v] an optional vector object where to set the
     * converted value
     * @return {me.Vector2d}
     */
    worldToLocal(x: number, y: number, v?: number): any;
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
 * @param {Object} options The renderer parameters
 * @param {Number} options.width The width of the canvas without scaling
 * @param {Number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {Boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {Boolean} [options.antiAlias=false] Whether to enable anti-aliasing
 * @param {Boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {Boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
 * @param {Boolean} [options.textureSeamFix=true] enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
 * @param {Number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {Number} [options.zoomY=height] The actual height of the canvas with scaling applied
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
     * @param {String} [mode="normal"] blend mode : "normal", "multiply"
     * @param {Context2d} [context]
     */
    setBlendMode(mode?: string, context?: any): void;
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
     * @param {me.Color|String} color CSS color.
     * @param {Boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(col: any, opaque?: boolean): void;
    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @name clearRect
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x x axis of the coordinate for the rectangle starting point.
     * @param {Number} y y axis of the coordinate for the rectangle starting point.
     * @param {Number} width The rectangle's width.
     * @param {Number} height The rectangle's height.
     */
    clearRect(x: number, y: number, width: number, height: number): void;
    /**
     * Create a pattern with the specified repetition
     * @name createPattern
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {image} image Source image
     * @param {String} repeat Define how the pattern should be repeated
     * @return {CanvasPattern}
     * @see me.ImageLayer#repeat
     * @example
     * var tileable   = renderer.createPattern(image, "repeat");
     * var horizontal = renderer.createPattern(image, "repeat-x");
     * var vertical   = renderer.createPattern(image, "repeat-y");
     * var basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image: any, repeat: string): CanvasPattern;
    /**
     * Draw an image onto the main using the canvas api
     * @name drawImage
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
     * @param {Number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {Number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {Number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {Number} sh The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {Number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {Number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {Number} dWidth The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {Number} dHeight The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image: new (width?: number, height?: number) => HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: any, dh: any): void;
    /**
     * Draw a pattern within the given rectangle.
     * @name drawPattern
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {CanvasPattern} pattern Pattern object
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
     * @see me.CanvasRenderer#createPattern
     */
    drawPattern(pattern: CanvasPattern, x: number, y: number, width: number, height: number): void;
    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @name strokeArc
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x arc center point x-axis
     * @param {Number} y arc center point y-axis
     * @param {Number} radius
     * @param {Number} start start angle in radians
     * @param {Number} end end angle in radians
     * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
     * @param {Boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean, fill?: boolean): void;
    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @name fillArc
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x arc center point x-axis
     * @param {Number} y arc center point y-axis
     * @param {Number} radius
     * @param {Number} start start angle in radians
     * @param {Number} end end angle in radians
     * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
     */
    fillArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean): void;
    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @name strokeEllipse
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x ellipse center point x-axis
     * @param {Number} y ellipse center point y-axis
     * @param {Number} w horizontal radius of the ellipse
     * @param {Number} h vertical radius of the ellipse
     * @param {Boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeEllipse(x: number, y: number, w: number, h: number, fill?: boolean): void;
    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @name fillEllipse
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x ellipse center point x-axis
     * @param {Number} y ellipse center point y-axis
     * @param {Number} w horizontal radius of the ellipse
     * @param {Number} h vertical radius of the ellipse
     */
    fillEllipse(x: number, y: number, w: number, h: number): void;
    /**
     * Stroke a line of the given two points
     * @name strokeLine
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} startX the start x coordinate
     * @param {Number} startY the start y coordinate
     * @param {Number} endX the end x coordinate
     * @param {Number} endY the end y coordinate
     */
    strokeLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Fill a line of the given two points
     * @name fillLine
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} startX the start x coordinate
     * @param {Number} startY the start y coordinate
     * @param {Number} endX the end x coordinate
     * @param {Number} endY the end y coordinate
     */
    fillLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Stroke the given me.Polygon on the screen
     * @name strokePolygon
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     * @param {Boolean} [fill=false] also fill the shape with the current color if true
     */
    strokePolygon(poly: any, fill?: boolean): void;
    /**
     * Fill the given me.Polygon on the screen
     * @name fillPolygon
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     */
    fillPolygon(poly: any): void;
    /**
     * Stroke a rectangle at the specified coordinates
     * @name strokeRect
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
     * @param {Boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeRect(x: number, y: number, width: number, height: number, fill?: boolean): void;
    /**
     * Draw a filled rectangle at the specified coordinates
     * @name fillRect
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
     */
    fillRect(x: number, y: number, width: number, height: number): void;
    /**
     * return a reference to the system 2d Context
     * @name getContext
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @return {CanvasRenderingContext2D}
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
     * @param {Number} angle in radians
     */
    rotate(angle: number): void;
    /**
     * scales the canvas context
     * @name scale
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
     */
    scale(x: number, y: number): void;
    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @name setColor
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Color|String} color css color value
     */
    setColor(color: Color | string): void;
    /**
     * Set the global alpha on the canvas context
     * @name setGlobalAlpha
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} alpha 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(a: any): void;
    /**
     * Set the line width on the context
     * @name setLineWidth
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} width Line width
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
    setTransform(mat2d: any): void;
    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @name transform
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    transform(mat2d: any): void;
    /**
     * Translates the context to the given position
     * @name translate
     * @memberOf me.CanvasRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
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
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
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
    setMask(mask?: any | any | any | any): void;
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
 * @class
 * @extends me.Sprite
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the collectable
 * @param {Number} y the y coordinates of the collectable
 * @param {Object} settings See {@link me.Sprite}
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
 * @param {Number|Float32Array} [r=0] red component or array of color components
 * @param {Number} [g=0] green component
 * @param {Number} [b=0] blue component
 * @param {Number} [alpha=1.0] alpha value
 */
export class Color {
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(r?: number, g?: number, b?: number, alpha?: number): any;
    glArray: Float32Array;
    /**
     * @ignore
     */
    set r(arg: number);
    /**
     * Color Red Component
     * @type Number
     * @name r
     * @readonly
     * @memberOf me.Color
     */
    /**
     * @ignore
     */
    get r(): number;
    /**
     * @ignore
     */
    set g(arg: number);
    /**
     * Color Green Component
     * @type Number
     * @name g
     * @readonly
     * @memberOf me.Color
     */
    /**
     * @ignore
     */
    get g(): number;
    /**
     * @ignore
     */
    set b(arg: number);
    /**
     * Color Blue Component
     * @type Number
     * @name b
     * @readonly
     * @memberOf me.Color
     */
    /**
     * @ignore
     */
    get b(): number;
    /**
     * @ignore
     */
    set alpha(arg: number);
    /**
     * Color Alpha Component
     * @type Number
     * @name alpha
     * @readonly
     * @memberOf me.Color
     */
    /**
     * @ignore
     */
    get alpha(): number;
    /**
     * Set this color to the specified value.
     * @name setColor
     * @memberOf me.Color
     * @function
     * @param {Number} r red component [0 .. 255]
     * @param {Number} g green component [0 .. 255]
     * @param {Number} b blue component [0 .. 255]
     * @param {Number} [alpha=1.0] alpha value [0.0 .. 1.0]
     * @return {me.Color} Reference to this object for method chaining
     */
    setColor(r: number, g: number, b: number, alpha?: number): any;
    /**
     * Create a new copy of this color object.
     * @name clone
     * @memberOf me.Color
     * @function
     * @return {me.Color} Reference to the newly cloned object
     */
    clone(): any;
    /**
     * Copy a color object or CSS color into this one.
     * @name copy
     * @memberOf me.Color
     * @function
     * @param {me.Color|String} color
     * @return {me.Color} Reference to this object for method chaining
     */
    copy(color: any | string): any;
    /**
     * Blend this color with the given one using addition.
     * @name add
     * @memberOf me.Color
     * @function
     * @param {me.Color} color
     * @return {me.Color} Reference to this object for method chaining
     */
    add(color: any): any;
    /**
     * Darken this color value by 0..1
     * @name darken
     * @memberOf me.Color
     * @function
     * @param {Number} scale
     * @return {me.Color} Reference to this object for method chaining
     */
    darken(scale: number): any;
    /**
     * Linearly interpolate between this color and the given one.
     * @name lerp
     * @memberOf me.Color
     * @function
     * @param {me.Color} color
     * @param {Number} alpha with alpha = 0 being this color, and alpha = 1 being the given one.
     * @return {me.Color} Reference to this object for method chaining
     */
    lerp(color: any, alpha: number): any;
    /**
     * Lighten this color value by 0..1
     * @name lighten
     * @memberOf me.Color
     * @function
     * @param {Number} scale
     * @return {me.Color} Reference to this object for method chaining
     */
    lighten(scale: number): any;
    /**
     * Generate random r,g,b values for this color object
     * @name random
     * @memberOf me.Color
     * @function
     * @param {Number} [min=0] minimum value for the random range
     * @param {Number} [max=255] maxmium value for the random range
     * @return {me.Color} Reference to this object for method chaining
     */
    random(min?: number, max?: number): any;
    /**
     * Return true if the r,g,b,a values of this color are equal with the
     * given one.
     * @name equals
     * @memberOf me.Color
     * @function
     * @param {me.Color} color
     * @return {Boolean}
     */
    equals(color: any): boolean;
    /**
     * Parse a CSS color string and set this color to the corresponding
     * r,g,b values
     * @name parseCSS
     * @memberOf me.Color
     * @function
     * @param {String} color
     * @return {me.Color} Reference to this object for method chaining
     */
    parseCSS(cssColor: any): any;
    /**
     * Parse an RGB or RGBA CSS color string
     * @name parseRGB
     * @memberOf me.Color
     * @function
     * @param {String} color
     * @return {me.Color} Reference to this object for method chaining
     */
    parseRGB(rgbColor: any): any;
    /**
     * Parse a Hex color ("#RGB", "#RGBA" or "#RRGGBB", "#RRGGBBAA" format) and set this color to
     * the corresponding r,g,b,a values
     * @name parseHex
     * @memberOf me.Color
     * @function
     * @param {String} color
     * @param {boolean} [argb = false] true if format is #ARGB, or #AARRGGBB (as opposed to #RGBA or #RGGBBAA)
     * @return {me.Color} Reference to this object for method chaining
     */
    parseHex(hexColor: any, argb?: boolean): any;
    /**
     * return an array representation of this object
     * @name toArray
     * @memberOf me.Color
     * @function
     * @return {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * Get the color in "#RRGGBB" format
     * @name toHex
     * @memberOf me.Color
     * @function
     * @return {String}
     */
    toHex(): string;
    /**
     * Get the color in "#RRGGBBAA" format
     * @name toHex8
     * @memberOf me.Color
     * @function
     * @return {String}
     */
    toHex8(): string;
    /**
     * Get the color in "rgb(R,G,B)" format
     * @name toRGB
     * @memberOf me.Color
     * @function
     * @return {String}
     */
    toRGB(): string;
    /**
     * Get the color in "rgba(R,G,B,A)" format
     * @name toRGBA
     * @memberOf me.Color
     * @function
     * @return {String}
     */
    toRGBA(): string;
}
/**
 * @classdesc
 * a generic Color Layer Object.  Fills the entire Canvas with the color not just the container the object belongs to.
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {String} name Layer name
 * @param {me.Color|String} color CSS color
 * @param {Number} z z-index position
 */
export class ColorLayer {
    /**
     * @ignore
     */
    constructor(name: any, color: any, z: any);
    /**
     * the layer color component
     * @public
     * @type me.Color
     * @name color
     * @memberOf me.ColorLayer#
     */
    public color: any;
    onResetEvent(name: any, color: any, z: any): void;
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
 * me.Container represents a collection of child objects
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} [x=0] position of the container (accessible via the inherited pos.x property)
 * @param {Number} [y=0] position of the container (accessible via the inherited pos.y property)
 * @param {Number} [w=me.game.viewport.width] width of the container
 * @param {Number} [h=me.game.viewport.height] height of the container
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
    pendingSort: number;
    /**
     * whether the container is the root of the scene
     * @public
     * @type Boolean
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
     * @type String
     * @default me.game.sortOn
     * @name sortOn
     * @memberOf me.Container
     */
    public sortOn: string;
    /**
     * Specify if the children list should be automatically sorted when adding a new child
     * @public
     * @type Boolean
     * @default true
     * @name autoSort
     * @memberOf me.Container
     */
    public autoSort: boolean;
    /**
     * Specify if the children z index should automatically be managed by the parent container
     * @public
     * @type Boolean
     * @default true
     * @name autoDepth
     * @memberOf me.Container
     */
    public autoDepth: boolean;
    /**
     * Specify if the container draw operation should clip his children to its own bounds
     * @public
     * @type Boolean
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
     * @param {Number} index added or removed child index
     */
    onChildChange: () => void;
    /**
     * Specify if the container bounds should automatically take in account
     * all child bounds when updated (this is expensive and disabled by default,
     * only enable if necessary)
     * @public
     * @type Boolean
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
     * @return {me.Renderable} the added child
     */
    addChild(child: any, z?: number): any;
    /**
     * Add a child to the container at the specified index<br>
     * (the list won't be sorted after insertion)
     * @name addChildAt
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {Number} index
     * @return {me.Renderable} the added child
     */
    addChildAt(child: any, index: number): any;
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
     * @param {Object} [thisArg] value to use as this(i.e reference Object) when executing callback.
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
    forEach(callback: Function, thisArg?: any, ...args: any[]): void;
    /**
     * Swaps the position (z-index) of 2 children
     * @name swapChildren
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {me.Renderable} child2
     */
    swapChildren(child: any, child2: any): void;
    /**
     * Returns the Child at the specified index
     * @name getChildAt
     * @memberOf me.Container.prototype
     * @function
     * @param {Number} index
     */
    getChildAt(index: number): any;
    /**
     * Returns the index of the given Child
     * @name getChildIndex
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    getChildIndex(child: any): number;
    /**
     * Returns the next child within the container or undefined if none
     * @name getNextChild
     * @memberOf me.Container
     * @function
     * @param {me.Renderable} child
     */
    getNextChild(child: any): any;
    /**
     * Returns true if contains the specified Child
     * @name hasChild
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @return {Boolean}
     */
    hasChild(child: any): boolean;
    /**
     * return the child corresponding to the given property and value.<br>
     * note : avoid calling this function every frame since
     * it parses the whole object tree each time
     * @name getChildByProp
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {String} prop Property name
     * @param {String|RegExp|Number|Boolean} value Value of the property
     * @return {me.Renderable[]} Array of childs
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
    public getChildByProp(prop: string, value: string | RegExp | number | boolean): any[];
    /**
     * returns the list of childs with the specified class type
     * @name getChildByType
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {Object} class type
     * @return {me.Renderable[]} Array of children
     */
    public getChildByType(_class: any): any[];
    /**
     * returns the list of childs with the specified name<br>
     * as defined in Tiled (Name field of the Object Properties)<br>
     * note : avoid calling this function every frame since
     * it parses the whole object list each time
     * @name getChildByName
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {String|RegExp|Number|Boolean} name child name
     * @return {me.Renderable[]} Array of children
     */
    public getChildByName(name: string | RegExp | number | boolean): any[];
    /**
     * return the child corresponding to the specified GUID<br>
     * note : avoid calling this function every frame since
     * it parses the whole object list each time
     * @name getChildByGUID
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {String|RegExp|Number|Boolean} GUID child GUID
     * @return {me.Renderable} corresponding child or null
     */
    public getChildByGUID(guid: any): any;
    /**
     * return all child in this container

     * @name getChildren
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @return {me.Renderable[]} an array of renderable object
     */
    public getChildren(): any[];
    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberOf me.Renderable.prototype
     * @function
     * @return {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds(forceUpdateChildBounds?: boolean): any;
    /**
     * Checks if this container is root or if it's attached to the root container.
     * @private
     * @name isAttachedToRoot
     * @memberOf me.Container.prototype
     * @function
     * @returns Boolean
     */
    private isAttachedToRoot;
    /**
     * update the cointainer's bounding rect (private)
     * @private
     * @name updateBoundsPos
     * @memberOf me.Container.prototype
     * @function
     */
    private updateBoundsPos;
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
     * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
     */
    public removeChild(child: any, keepalive?: boolean): void;
    /**
     * Removes (and optionally destroys) a child from the container.<br>
     * (removal is immediate and unconditional)<br>
     * Never use keepalive=true with objects from {@link me.pool}. Doing so will create a memory leak.
     * @name removeChildNow
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
     */
    removeChildNow(child: any, keepalive?: boolean): void;
    /**
     * Automatically set the specified property of all childs to the given value
     * @name setChildsProperty
     * @memberOf me.Container.prototype
     * @function
     * @param {String} property property name
     * @param {Object} value property value
     * @param {Boolean} [recursive=false] recursively apply the value to child containers if true
     */
    setChildsProperty(prop: any, val: any, recursive?: boolean): void;
    /**
     * Move the child in the group one step forward (z depth).
     * @name moveUp
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveUp(child: any): void;
    /**
     * Move the child in the group one step backward (z depth).
     * @name moveDown
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveDown(child: any): void;
    /**
     * Move the specified child to the top(z depth).
     * @name moveToTop
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveToTop(child: any): void;
    /**
     * Move the specified child the bottom (z depth).
     * @name moveToBottom
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveToBottom(child: any): void;
    /**
     * Manually trigger the sort of all the childs in the container</p>
     * @name sort
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {Boolean} [recursive=false] recursively sort all containers if true
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
     * @ignore
     */
    update(dt: any): boolean;
    /**
     * @ignore
     */
    draw(renderer: any, rect: any): void;
}
/**
* Used to make a game entity draggable
* @class
* @extends me.Entity
* @memberOf me
* @constructor
* @param {Number} x the x coordinates of the entity object
* @param {Number} y the y coordinates of the entity object
* @param {Object} settings Entity properties (see {@link me.Entity})
*/
export class DraggableEntity {
    /**
     * Constructor
     * @name init
     * @memberOf me.DraggableEntity
     * @function
     * @param {Number} x the x postion of the entity
     * @param {Number} y the y postion of the entity
     * @param {Object} settings the additional entity settings
     */
    constructor(x: number, y: number, settings: any);
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
     * @param {Object} e the pointer event you want to translate
     * @param {String} translation the me.event you want to translate
     * the event to
     */
    translatePointerEvent(e: any, translation: string): void;
    /**
     * Gets called when the user starts dragging the entity
     * @name dragStart
     * @memberOf me.DraggableEntity
     * @function
     * @param {Object} x the pointer event
     */
    dragStart(e: any): boolean;
    /**
     * Gets called when the user drags this entity around
     * @name dragMove
     * @memberOf me.DraggableEntity
     * @function
     * @param {Object} x the pointer event
     */
    dragMove(e: any): void;
    /**
     * Gets called when the user stops dragging the entity
     * @name dragEnd
     * @memberOf me.DraggableEntity
     * @function
     * @param {Object} x the pointer event
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
* @param {Number} x the x coordinates of the entity object
* @param {Number} y the y coordinates of the entity object
* @param {Object} settings Entity properties (see {@link me.Entity})
*/
export class DroptargetEntity {
    /**
     * Constructor
     * @name init
     * @memberOf me.DroptargetEntity
     * @function
     * @param {Number} x the x postion of the entity
     * @param {Number} y the y postion of the entity
     * @param {Object} settings the additional entity settings
     */
    constructor(x: number, y: number, settings: any);
    /**
     * constant for the overlaps method
     * @public
     * @constant
     * @type String
     * @name CHECKMETHOD_OVERLAP
     * @memberOf me.DroptargetEntity
     */
    public CHECKMETHOD_OVERLAP: string;
    /**
     * constant for the contains method
     * @public
     * @constant
     * @type String
     * @name CHECKMETHOD_CONTAINS
     * @memberOf me.DroptargetEntity
     */
    public CHECKMETHOD_CONTAINS: string;
    /**
     * the checkmethod we want to use
     * @public
     * @constant
     * @type String
     * @name checkMethod
     * @memberOf me.DroptargetEntity
     */
    public checkMethod: string;
    /**
     * Sets the collision method which is going to be used to check a valid drop
     * @name setCheckMethod
     * @memberOf me.DroptargetEntity
     * @function
     * @param {Constant} checkMethod the checkmethod (defaults to CHECKMETHOD_OVERLAP)
     */
    setCheckMethod(checkMethod: any): void;
    /**
     * Checks if a dropped entity is dropped on the current entity
     * @name checkOnMe
     * @memberOf me.DroptargetEntity
     * @function
     * @param {Object} draggableEntity the draggable entity that is dropped
     */
    checkOnMe(e: any, draggableEntity: any): void;
    /**
     * Gets called when a draggable entity is dropped on the current entity
     * @name drop
     * @memberOf me.DroptargetEntity
     * @function
     * @param {Object} draggableEntity the draggable entity that is dropped
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
 * @class
 * @extends me.Object
 * @memberOf me
 * @constructor
 * @param {Number} x the center x coordinate of the ellipse
 * @param {Number} y the center y coordinate of the ellipse
 * @param {Number} w width (diameter) of the ellipse
 * @param {Number} h height (diameter) of the ellipse
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
    public pos: any;
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
     * @type {Number}
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
    public radiusV: any;
    /**
     * Radius squared, for pythagorean theorom
     * @public
     * @type {me.Vector2d}
     * @name radiusSq
     * @memberOf me.Ellipse#
     */
    public radiusSq: any;
    /**
     * x/y scaling ratio for ellipse
     * @public
     * @type {me.Vector2d}
     * @name ratio
     * @memberOf me.Ellipse#
     */
    public ratio: any;
    shapeType: string;
    /** @ignore */
    onResetEvent(x: any, y: any, w: any, h: any): void;
    /**
     * set new value to the Ellipse shape
     * @name setShape
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {Number} x the center x coordinate of the ellipse
     * @param {Number} y the center y coordinate of the ellipse
     * @param {Number} w width (diameter) of the ellipse
     * @param {Number} h height (diameter) of the ellipse
     */
    setShape(x: number, y: number, w: number, h: number): Ellipse;
    /**
     * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {Number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @return {me.Ellipse} Reference to this object for method chaining
     */
    rotate(angle: number, v?: any | any): any;
    /**
     * Scale this Ellipse by the specified scalar.
     * @name scale
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {Number} x
     * @param {Number} [y=x]
     * @return {me.Ellipse} Reference to this object for method chaining
     */
    scale(x: number, y?: number): any;
    /**
     * Scale this Ellipse by the specified vector.
     * @name scale
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {me.Vector2d} v
     * @return {me.Ellipse} Reference to this object for method chaining
     */
    scaleV(v: any): any;
    /**
     * apply the given transformation matrix to this ellipse
     * @name transform
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {me.Matrix2d} matrix the transformation matrix
     * @return {me.Polygon} Reference to this object for method chaining
     */
    transform(): any;
    /**
     * translate the circle/ellipse by the specified offset
     * @name translate
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {Number} x x offset
     * @param {Number} y y offset
     * @return {me.Ellipse} this ellipse
     */
    /**
     * translate the circle/ellipse by the specified vector
     * @name translate
     * @memberOf me.Ellipse.prototype
     * @function
     * @param {me.Vector2d} v vector offset
     * @return {me.Ellipse} this ellipse
     */
    translate(...args: any[]): any;
    /**
     * check if this circle/ellipse contains the specified point
     * @name contains
     * @memberOf me.Ellipse.prototype
     * @function
     * @param  {me.Vector2d} point
     * @return {boolean} true if contains
     */
    /**
     * check if this circle/ellipse contains the specified point
     * @name contains
     * @memberOf me.Ellipse.prototype
     * @function
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    contains(x: number, y: number, ...args: any[]): boolean;
    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @name getBounds
     * @memberOf me.Ellipse.prototype
     * @function
     * @return {me.Bounds} this shape bounding box Rectangle object
     */
    getBounds(): any;
    /**
     * clone this Ellipse
     * @name clone
     * @memberOf me.Ellipse.prototype
     * @function
     * @return {me.Ellipse} new Ellipse
     */
    clone(): any;
}
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
    /**
     * @ignore
     */
    set renderable(arg: any);
    /**
     * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
     * @public
     * @type me.Renderable
     * @name renderable
     * @memberOf me.Entity
     */
    /**
     * @ignore
     */
    get renderable(): any;
    name: any;
    /**
     * object type (as defined in Tiled)
     * @public
     * @type String
     * @name type
     * @memberOf me.Entity
     */
    public type: string;
    /**
     * object unique ID (as defined in Tiled)
     * @public
     * @type Number
     * @name id
     * @memberOf me.Entity
     */
    public id: number;
    /**
     * dead/living state of the entity<br>
     * default value : true
     * @public
     * @type Boolean
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
     * @private
     * @name onBodyUpdate
     * @memberOf me.Entity
     * @function
     */
    private onBodyUpdate;
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
     * @param {me.Rect} region to draw
     **/
    protected draw(renderer: any | any, rect: any): void;
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
    onCollision(): boolean;
}
/**
 * @classdesc
 * a base GL Shader object
 * @class GLShader
 * @memberOf me
 * @param {WebGLRenderingContext} gl the current WebGL rendering context
 * @param {String} vertex a string containing the GLSL source code to set
 * @param {String} fragment a string containing the GLSL source code to set
 * @param {String} [precision=auto detected] float precision ('lowp', 'mediump' or 'highp').
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
     * @type {String}
     * @name vertex
     * @memberOf me.GLShader
     */
    public vertex: string;
    /**
     * the fragment shader source code
     * @public
     * @type {String}
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
     * @type {Object}
     * @name uniforms
     * @memberOf me.GLShader
     */
    public uniforms: any;
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
     * @param {String} name the name of the attribute variable whose location to get.
     * @return {GLint} number indicating the location of the variable name if found. Returns -1 otherwise
     */
    getAttribLocation(name: string): GLint;
    /**
     * Set the uniform to the given value
     * @name setUniform
     * @memberOf me.GLShader
     * @function
     * @param {String} name the uniform name
     * @param {Object|Float32Array} value the value to assign to that uniform
     * @example
     * myShader.setUniform("uProjectionMatrix", this.projectionMatrix);
     */
    setUniform(name: string, value: any | Float32Array): void;
    /**
     * destroy this shader objects resources (program, attributes, uniforms)
     * @name destroy
     * @memberOf me.GLShader
     * @function
     */
    destroy(): void;
}
/**
 * GUI Object<br>
 * A very basic object to manage GUI elements <br>
 * The object simply register on the "pointerdown" <br>
 * or "touchstart" event and call the onClick function"
 * @class
 * @extends me.Sprite
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinate of the GUI Object
 * @param {Number} y the y coordinate of the GUI Object
 * @param {Object} settings See {@link me.Sprite}
 * @example
 *
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
 *
 */
export class GUI_Object {
    /**
     * @ignore
     */
    constructor(x: any, y: any, settings: any);
    /**
     * object can be clicked or not
     * @public
     * @type boolean
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
     * @type boolean
     * @default false
     * @name me.GUI_Object#isHoldable
     */
    public isHoldable: boolean;
    /**
     * true if the pointer is over the object
     * @public
     * @type boolean
     * @default false
     * @name me.GUI_Object#hover
     */
    public hover: boolean;
    holdTimeout: number;
    updated: boolean;
    released: boolean;
    floating: boolean;
    isKinematic: boolean;
    /**
     * return true if the object has been clicked
     * @ignore
     */
    update(dt: any): any;
    /**
     * function callback for the pointerdown event
     * @ignore
     */
    clicked(event: any): any;
    /**
     * function called when the object is pressed <br>
     * to be extended <br>
     * return false if we need to stop propagating the event
     * @name onClick
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @param {Event} event the event object
     */
    public onClick(): boolean;
    /**
     * function callback for the pointerEnter event
     * @ignore
     */
    enter(event: any): any;
    /**
     * function called when the pointer is over the object
     * @name onOver
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @param {Event} event the event object
     */
    public onOver(): void;
    /**
     * function callback for the pointerLeave event
     * @ignore
     */
    leave(event: any): any;
    /**
     * function called when the pointer is leaving the object area
     * @name onOut
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @param {Event} event the event object
     */
    public onOut(): void;
    /**
     * function callback for the pointerup event
     * @ignore
     */
    release(event: any): any;
    /**
     * function called when the object is pressed and released <br>
     * to be extended <br>
     * return false if we need to stop propagating the event
     * @name onRelease
     * @memberOf me.GUI_Object.prototype
     * @public
     * @function
     * @param {Event} event the event object
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
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} x x coordinate
 * @param {Number} y y coordinate
 * @param {Object} settings ImageLayer properties
 * @param {HTMLImageElement|HTMLCanvasElement|String} settings.image Image reference. See {@link me.loader.getImage}
 * @param {String} [settings.name="me.ImageLayer"] layer name
 * @param {Number} [settings.z=0] z-index position
 * @param {Number|me.Vector2d} [settings.ratio=1.0] Scrolling ratio to be applied. See {@link me.ImageLayer#ratio}
 * @param {String} [settings.repeat='repeat'] define if and how an Image Layer should be repeated (accepted values are 'repeat',
'repeat-x', 'repeat-y', 'no-repeat'). See {@link me.ImageLayer#repeat}
 * @param {Number|me.Vector2d} [settings.anchorPoint=0.0] Image origin. See {@link me.ImageLayer#anchorPoint}
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
     * @type me.Vector2d
     * @default <1.0,1.0>
     * @name me.ImageLayer#ratio
     */
    public ratio: any;
    /**
     * @ignore
     */
    set repeat(arg: any);
    /**
     * Define if and how an Image Layer should be repeated.<br>
     * By default, an Image Layer is repeated both vertically and horizontally.<br>
     * Acceptable values : <br>
     * * 'repeat' - The background image will be repeated both vertically and horizontally <br>
     * * 'repeat-x' - The background image will be repeated only horizontally.<br>
     * * 'repeat-y' - The background image will be repeated only vertically.<br>
     * * 'no-repeat' - The background-image will not be repeated.<br>
     * @public
     * @type String
     * @default 'repeat'
     * @name me.ImageLayer#repeat
     */
    /**
     * @ignore
     */
    get repeat(): any;
    _repeat: any;
    repeatX: boolean;
    repeatY: boolean;
    onActivateEvent(): void;
    vpChangeHdlr: any;
    vpResizeHdlr: any;
    vpLoadedHdlr: any;
    /**
     * resize the Image Layer to match the given size
     * @name resize
     * @memberOf me.ImageLayer.prototype
     * @function
     * @param {Number} w new width
     * @param {Number} h new height
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
    preDraw(renderer: any): void;
    /**
     * draw the image layer
     * @ignore
     */
    draw(renderer: any): void;
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
 * @class
 * @extends me.Polygon
 * @memberOf me
 * @constructor
 * @param {Number} x origin point of the Line
 * @param {Number} y origin point of the Line
 * @param {me.Vector2d[]} points array of vectors defining the Line
 */
export class Line {
    /**
     * Returns true if the Line contains the given point
     * @name contains
     * @memberOf me.Line.prototype
     * @function
     * @param  {me.Vector2d} point
     * @return {boolean} true if contains
     */
    /**
     * Returns true if the Line contains the given point
     * @name contains
     * @memberOf me.Line.prototype
     * @function
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * Computes the calculated collision edges and normals.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @name recalc
     * @memberOf me.Line.prototype
     * @function
     */
    recalc(): Line;
    /**
     * clone this line segment
     * @name clone
     * @memberOf me.Line.prototype
     * @function
     * @return {me.Line} new Line
     */
    clone(): any;
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
 * @param {Number[]} [arguments...] Matrix elements. See {@link me.Matrix2d.setTransform}
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
     * @type {Number}
     * @readonly
     * @see me.Matrix2d.translate
     * @name tx
     * @memberOf me.Matrix2d
     */
    public readonly get tx(): number;
    /**
     * ty component of the matrix
     * @public
     * @type {Number}
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
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    identity(): any;
    /**
     * set the matrix to the specified value
     * @name setTransform
     * @memberOf me.Matrix2d
     * @function
     * @param {Number} a
     * @param {Number} b
     * @param {Number} c
     * @param {Number} d
     * @param {Number} e
     * @param {Number} f
     * @param {Number} [g=0]
     * @param {Number} [h=0]
     * @param {Number} [i=1]
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    setTransform(...args: any[]): any;
    /**
     * Copies over the values from another me.Matrix2d.
     * @name copy
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix2d} m the matrix object to copy from
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    copy(b: any): any;
    /**
     * Copies over the upper-left 3x3 values from the given me.Matrix3d
     * @name fromMat3d
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix3d} m the matrix object to copy from
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    fromMat3d(m: any): any;
    /**
     * multiply both matrix
     * @name multiply
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix2d} m the other matrix
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    multiply(m: any): any;
    /**
     * Transpose the value of this matrix.
     * @name transpose
     * @memberOf me.Matrix2d
     * @function
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    transpose(): any;
    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @name invert
     * @memberOf me.Matrix2d
     * @function
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    invert(): any;
    /**
     * apply the current transform to the given 2d vector
     * @name apply
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} vector the vector object to be transformed
     * @return {me.Vector2d} result vector object.
     */
    apply(v: any): any;
    /**
     * apply the inverted current transform to the given 2d vector
     * @name applyInverse
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} vector the vector object to be transformed
     * @return {me.Vector2d} result vector object.
     */
    applyInverse(v: any): any;
    /**
     * scale the matrix
     * @name scale
     * @memberOf me.Matrix2d
     * @function
     * @param {Number} x a number representing the abscissa of the scaling vector.
     * @param {Number} [y=x] a number representing the ordinate of the scaling vector.
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number): any;
    /**
     * adds a 2D scaling transformation.
     * @name scaleV
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} vector scaling vector
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    scaleV(v: any): any;
    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @name scaleX
     * @memberOf me.Matrix2d
     * @function
     * @param {Number} x x scaling vector
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    scaleX(x: number): any;
    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @name scaleY
     * @memberOf me.Matrix2d
     * @function
     * @param {Number} y y scaling vector
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    scaleY(y: number): any;
    /**
     * rotate the matrix (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Matrix2d
     * @function
     * @param {Number} angle Rotation angle in radians.
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    rotate(angle: number): any;
    /**
     * translate the matrix position on the horizontal and vertical axis
     * @name translate
     * @memberOf me.Matrix2d
     * @function
     * @param {Number} x the x coordindates to translate the matrix by
     * @param {Number} y the y coordindates to translate the matrix by
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    /**
     * translate the matrix by a vector on the horizontal and vertical axis
     * @name translateV
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Vector2d} v the vector to translate the matrix by
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    translate(...args: any[]): any;
    /**
     * returns true if the matrix is an identity matrix.
     * @name isIdentity
     * @memberOf me.Matrix2d
     * @function
     * @return {Boolean}
     **/
    isIdentity(): boolean;
    /**
     * return true if the two matrices are identical
     * @name equals
     * @memberOf me.Matrix2d
     * @function
     * @param {me.Matrix2d} m the other matrix
     * @return {Boolean} true if both are equals
     */
    equals(m: any): boolean;
    /**
     * Clone the Matrix
     * @name clone
     * @memberOf me.Matrix2d
     * @function
     * @return {me.Matrix2d}
     */
    clone(): any;
    /**
     * return an array representation of this Matrix
     * @name toArray
     * @memberOf me.Matrix2d
     * @function
     * @return {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Matrix2d
     * @function
     * @return {String}
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
 * @param {Number[]} [arguments...] Matrix elements. See {@link me.Matrix3d.setTransform}
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
     * @type {Number}
     * @readonly
     * @name tx
     * @memberOf me.Matrix3d
     */
    public readonly get tx(): number;
    /**
     * ty component of the matrix
     * @public
     * @type {Number}
     * @readonly
     * @name ty
     * @memberOf me.Matrix3d
     */
    public readonly get ty(): number;
    /**
     * ty component of the matrix
     * @public
     * @type {Number}
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
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    identity(): any;
    /**
     * set the matrix to the specified value
     * @name setTransform
     * @memberOf me.Matrix3d
     * @function
     * @param {Number} m00
     * @param {Number} m01
     * @param {Number} m02
     * @param {Number} m03
     * @param {Number} m10
     * @param {Number} m11
     * @param {Number} m12
     * @param {Number} m13
     * @param {Number} m20
     * @param {Number} m21
     * @param {Number} m22
     * @param {Number} m23
     * @param {Number} m30
     * @param {Number} m31
     * @param {Number} m32
     * @param {Number} m33
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    setTransform(m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number): any;
    /**
     * Copies over the values from another me.Matrix3d.
     * @name copy
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix3d} m the matrix object to copy from
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    copy(b: any): any;
    /**
     * Copies over the upper-left 2x2 values from the given me.Matrix2d
     * @name fromMat2d
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix2d} m the matrix object to copy from
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    fromMat2d(m: any): any;
    /**
     * multiply both matrix
     * @name multiply
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix3d} m Other matrix
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    multiply(m: any): any;
    /**
     * Transpose the value of this matrix.
     * @name transpose
     * @memberOf me.Matrix3d
     * @function
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    transpose(): any;
    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @name invert
     * @memberOf me.Matrix3d
     * @function
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    invert(): any;
    /**
     * apply the current transform to the given 2d or 3d vector
     * @name apply
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} vector the vector object to be transformed
     * @return {me.Vector2d|me.Vector3d} result vector object.
     */
    apply(v: any): any | any;
    /**
     * apply the inverted current transform to the given 2d or 3d vector
     * @name applyInverse
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} vector the vector object to be transformed
     * @return {me.Vector2d|me.Vector3d} result vector object.
     */
    applyInverse(v: any): any | any;
    /**
     * generate an orthogonal projection matrix, with the result replacing the current matrix
     * <img src="images/glOrtho.gif"/><br>
     * @name ortho
     * @memberOf me.Matrix3d
     * @function
     * @param {Number} left farthest left on the x-axis
     * @param {Number} right farthest right on the x-axis
     * @param {Number} bottom farthest down on the y-axis
     * @param {Number} top farthest up on the y-axis
     * @param {Number} near distance to the near clipping plane along the -Z axis
     * @param {Number} far distance to the far clipping plane along the -Z axis
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): any;
    /**
     * scale the matrix
     * @name scale
     * @memberOf me.Matrix3d
     * @function
     * @param {Number} x a number representing the abscissa of the scaling vector.
     * @param {Number} [y=x] a number representing the ordinate of the scaling vector.
     * @param {Number} [z=0] a number representing the depth vector
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number, z?: number): any;
    /**
     * adds a 2D scaling transformation.
     * @name scaleV
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} vector scaling vector
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    scaleV(v: any): any;
    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @name scaleX
     * @memberOf me.Matrix3d
     * @function
     * @param {Number} x x scaling vector
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    scaleX(x: number): any;
    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @name scaleY
     * @memberOf me.Matrix3d
     * @function
     * @param {Number} y y scaling vector
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    scaleY(y: number): any;
    /**
     * rotate this matrix (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Matrix3d
     * @function
     * @param {Number} angle Rotation angle in radians.
     * @param {me.Vector3d} axis the axis to rotate around
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    rotate(angle: number, v: any): any;
    /**
     * translate the matrix position using the given vector
     * @name translate
     * @memberOf me.Matrix3d
     * @function
     * @param {Number} x a number representing the abscissa of the vector.
     * @param {Number} [y=x] a number representing the ordinate of the vector.
     * @param {Number} [z=0] a number representing the depth of the vector
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    /**
     * translate the matrix by a vector on the horizontal and vertical axis
     * @name translateV
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v the vector to translate the matrix by
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    translate(x: any, y: any, z: any, ...args: any[]): any;
    /**
     * returns true if the matrix is an identity matrix.
     * @name isIdentity
     * @memberOf me.Matrix3d
     * @function
     * @return {Boolean}
     **/
    isIdentity(): boolean;
    /**
     * return true if the two matrices are identical
     * @name equals
     * @memberOf me.Matrix3d
     * @function
     * @param {me.Matrix3d} m the other matrix
     * @return {Boolean} true if both are equals
     */
    equals(m: any): boolean;
    /**
     * Clone the Matrix
     * @name clone
     * @memberOf me.Matrix3d
     * @function
     * @return {me.Matrix3d}
     */
    clone(): any;
    /**
     * return an array representation of this Matrix
     * @name toArray
     * @memberOf me.Matrix3d
     * @function
     * @return {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Matrix3d
     * @function
     * @return {String}
     */
    toString(): string;
}
/**
 * @classdesc
 * A Vector2d object that provide notification by executing the given callback when the vector is changed.
 * @class ObservableVector2d
 * @extends me.Vector2d
 * @memberOf me
 * @constructor
 * @param {Number} [x=0] x value of the vector
 * @param {Number} [y=0] y value of the vector
 * @param {Object} settings additional required parameters
 * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
 * @param {Function} [settings.scope] the value to use as this when calling onUpdate
 */
export class ObservableVector2d {
    constructor(x: number, y: number, settings: any);
    /**
     * @ignore
     */
    onResetEvent(x: number, y: number, settings: any): ObservableVector2d;
    /**
     * @ignore
     */
    set x(arg: any);
    /**
     * x value of the vector
     * @public
     * @type Number
     * @name x
     * @memberOf me.ObservableVector2d
     */
    /**
     * @ignore
     */
    get x(): any;
    _x: any;
    /**
     * @ignore
     */
    set y(arg: any);
    /**
     * y value of the vector
     * @public
     * @type Number
     * @name y
     * @memberOf me.ObservableVector2d
     */
    /**
     * @ignore
     */
    get y(): any;
    _y: any;
    /** @ignore */
    _set(x: any, y: any): ObservableVector2d;
    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} x x value of the vector
     * @param {Number} y y value of the vector
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    setMuted(x: number, y: number): any;
    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberOf me.ObservableVector2d
     * @function
     * @param {function} onUpdate callback
     * @param {function} [scope=null] scope
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    setCallback(fn: any, scope?: Function): any;
    onUpdate: any;
    scope: Function;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    add(v: any): any;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    sub(v: any): any;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} x
     * @param {Number} [y=x]
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number): any;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    scaleV(v: any): any;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} value
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    div(n: any): any;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    abs(): any;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    clamp(low: number, high: number): any;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): any;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    minV(v: any): any;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    maxV(v: any): any;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    floor(): any;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    floorSelf(): any;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    ceil(): any;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    ceilSelf(): any;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    negate(): any;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    negateSelf(): any;
    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    copy(v: any): any;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {Boolean}
     */
    equals(v: any): boolean;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    perp(): any;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: any | any): any;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @return {Number} The dot product.
     */
    dotProduct(v: any | any): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @param {Number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    lerp(v: any | any, alpha: number): any;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {Number}
     */
    distance(v: any): number;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    clone(): any;
    /**
     * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
     * @name toVector2d
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.Vector2d} new me.Vector2d
     */
    toVector2d(): any;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.ObservableVector2d
     * @function
     * @return {String}
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
 * @param {Number} [x=0] x value of the vector
 * @param {Number} [y=0] y value of the vector
 * @param {Number} [z=0] z value of the vector
 * @param {Object} settings additional required parameters
 * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
 * @param {Object} [settings.scope] the value to use as this when calling onUpdate
 */
export class ObservableVector3d {
    constructor(x: number, y: number, z: number, settings: any);
    /**
     * @ignore
     */
    onResetEvent(x: number, y: number, z: number, settings: any): ObservableVector3d;
    /**
     * @ignore
     */
    set x(arg: any);
    /**
     * x value of the vector
     * @public
     * @type Number
     * @name x
     * @memberOf me.ObservableVector3d
     */
    /**
     * @ignore
     */
    get x(): any;
    _x: any;
    /**
     * @ignore
     */
    set y(arg: any);
    /**
     * y value of the vector
     * @public
     * @type Number
     * @name y
     * @memberOf me.ObservableVector3d
     */
    /**
     * @ignore
     */
    get y(): any;
    _y: any;
    /**
     * @ignore
     */
    set z(arg: any);
    /**
     * z value of the vector
     * @public
     * @type Number
     * @name z
     * @memberOf me.ObservableVector3d
     */
    /**
     * @ignore
     */
    get z(): any;
    _z: any;
    /**
     * @ignore */
    _set(x: any, y: any, z: any): ObservableVector3d;
    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberOf me.ObservableVector3d
     * @function
     * @param {Number} x x value of the vector
     * @param {Number} y y value of the vector
     * @param {Number} [z=0] z value of the vector
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    setMuted(x: number, y: number, z?: number): any;
    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberOf me.ObservableVector3d
     * @function
     * @param {function} onUpdate callback
     * @param {function} [scope=null] scope
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    setCallback(fn: any, scope?: Function): any;
    onUpdate: any;
    scope: Function;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    add(v: any | any | any | any): any;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    sub(v: any | any | any | any): any;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.ObservableVector3d
     * @function
     * @param {Number} x
     * @param {Number} [y=x]
     * @param {Number} [z=1]
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number, z?: number): any;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    scaleV(v: any | any | any | any): any;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.ObservableVector3d
     * @function
     * @param {Number} value
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    div(n: any): any;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    abs(): any;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.ObservableVector3d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.ObservableVector3d} new me.ObservableVector3d
     */
    clamp(low: number, high: number): any;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): any;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    minV(v: any | any | any | any): any;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    maxV(v: any | any | any | any): any;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} new me.ObservableVector3d
     */
    floor(): any;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    floorSelf(): any;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} new me.ObservableVector3d
     */
    ceil(): any;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    ceilSelf(): any;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} new me.ObservableVector3d
     */
    negate(): any;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    negateSelf(): any;
    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    copy(v: any | any | any | any): any;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {Boolean}
     */
    equals(v: any | any | any | any): boolean;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    perp(): any;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.ObservableVector3d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: any | any): any;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {Number} The dot product.
     */
    dotProduct(v: any | any | any | any): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector3d|me.ObservableVector3d} v
     * @param {Number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @return {me.ObservableVector3d} Reference to this object for method chaining
     */
    lerp(v: any | any, alpha: number): any;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @return {Number}
     */
    distance(v: any | any | any | any): number;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.ObservableVector3d} new me.ObservableVector3d
     */
    clone(): any;
    /**
     * return a `me.Vector3d` copy of this `me.ObservableVector3d` object
     * @name toVector3d
     * @memberOf me.ObservableVector3d
     * @function
     * @return {me.Vector3d} new me.Vector3d
     */
    toVector3d(): any;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.ObservableVector3d
     * @function
     * @return {String}
     */
    toString(): string;
}
/**
 * Single Particle Object.
 * @class
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
     * @param {Number} dt time since the last update in milliseconds
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
 * @param {Number} x x-position of the particle emitter
 * @param {Number} y y-position of the particle emitter
 * @param {object} settings An object containing the settings for the particle emitter. See {@link me.ParticleEmitterSettings}
 * @example
 *
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
 *
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
     * @return {Number}
     */
    getRandomPointX(): number;
    /**
     * returns a random point inside the bounds y axis of this emitter
     * @name getRandomPointY
     * @memberOf me.ParticleEmitter
     * @function
     * @return {Number}
     */
    getRandomPointY(): number;
    /**
     * Reset the emitter with default values.<br>
     * @function
     * @param {Object} settings [optional] object with emitter settings. See {@link me.ParticleEmitterSettings}
     * @name reset
     * @memberOf me.ParticleEmitter
     */
    reset(settings: any): void;
    /** @ignore */
    addParticles(count: any): void;
    /**
     * Emitter is of type stream and is launching particles <br>
     * @function
     * @returns {Boolean} Emitter is Stream and is launching particles
     * @name isRunning
     * @memberOf me.ParticleEmitter
     */
    isRunning(): boolean;
    /**
     * Launch particles from emitter constantly <br>
     * Particles example: Fountains
     * @param {Number} duration [optional] time that the emitter releases particles in ms
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
     * @param {Number} total [optional] number of particles to launch
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
/**
 * @classdesc
 * a pointer object, representing a single finger on a touch enabled device.
 * @class
 * @extends me.Rect
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
     * @type {Number}
     * @name LEFT
     * @memberOf me.Pointer
     */
    public LEFT: number;
    /**
     * constant for middle button
     * @public
     * @type {Number}
     * @name MIDDLE
     * @memberOf me.Pointer
     */
    public MIDDLE: number;
    /**
     * constant for right button
     * @public
     * @type {Number}
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
     * @type {String}
     * @name type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Event/type
     * @memberOf me.Pointer
     */
    public type: string;
    /**
     * the button property indicates which button was pressed on the mouse to trigger the event.
     * @public
     * @type {Number}
     * @name button
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
     * @memberOf me.Pointer
     */
    public button: number;
    /**
     * indicates whether or not the pointer device that created the event is the primary pointer.
     * @public
     * @type {Boolean}
     * @name isPrimary
     * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
     * @memberOf me.Pointer
     */
    public isPrimary: boolean;
    /**
     * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
     * @public
     * @type {Number}
     * @name pageX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX
     * @memberOf me.Pointer
     */
    public pageX: number;
    /**
     * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
     * @public
     * @type {Number}
     * @name pageY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY
     * @memberOf me.Pointer
     */
    public pageY: number;
    /**
     * the horizontal coordinate within the application's client area at which the event occurred
     * @public
     * @type {Number}
     * @name clientX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
     * @memberOf me.Pointer
     */
    public clientX: number;
    /**
     * the vertical coordinate within the application's client area at which the event occurred
     * @public
     * @type {Number}
     * @name clientY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
     * @memberOf me.Pointer
     */
    public clientY: number;
    /**
     * an unsigned long representing the unit of the delta values scroll amount
     * @public
     * @type {Number}
     * @name deltaMode
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
     * @memberOf me.Pointer
     */
    public deltaMode: number;
    /**
     * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
     * @public
     * @type {Number}
     * @name deltaX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX
     * @memberOf me.Pointer
     */
    public deltaX: number;
    /**
     * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
     * @public
     * @type {Number}
     * @name deltaY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
     * @memberOf me.Pointer
     */
    public deltaY: number;
    /**
     * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
     * @public
     * @type {Number}
     * @name deltaZ
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ
     * @memberOf me.Pointer
     */
    public deltaZ: number;
    /**
     * Event normalized X coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @public
     * @type {Number}
     * @name gameX
     * @memberOf me.Pointer
     */
    public gameX: number;
    /**
     * Event normalized Y coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @public
     * @type {Number}
     * @name gameY
     * @memberOf me.Pointer
     */
    public gameY: number;
    /**
     * Event X coordinate relative to the viewport
     * @public
     * @type {Number}
     * @name gameScreenX
     * @memberOf me.Pointer
     */
    public gameScreenX: number;
    /**
     * Event Y coordinate relative to the viewport
     * @public
     * @type {Number}
     * @name gameScreenY
     * @memberOf me.Pointer
     */
    public gameScreenY: number;
    /**
     * Event X coordinate relative to the map
     * @public
     * @type {Number}
     * @name gameWorldX
     * @memberOf me.Pointer
     */
    public gameWorldX: number;
    /**
     * Event Y coordinate relative to the map
     * @public
     * @type {Number}
     * @name gameWorldY
     * @memberOf me.Pointer
     */
    public gameWorldY: number;
    /**
     * Event X coordinate relative to the holding container
     * @public
     * @type {Number}
     * @name gameLocalX
     * @memberOf me.Pointer
     */
    public gameLocalX: number;
    /**
     * Event Y coordinate relative to the holding container
     * @public
     * @type {Number}
     * @name gameLocalY
     * @memberOf me.Pointer
     */
    public gameLocalY: number;
    /**
      * The unique identifier of the contact for a touch, mouse or pen
      * @public
      * @type {Number}
      * @name pointerId
      * @memberOf me.Pointer
      * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
      */
    public pointerId: number;
    bind: number[];
    /**
     * initialize the Pointer object using the given Event Object
     * @name me.Pointer#set
     * @private
     * @function
     * @param {Event} event the original Event object
     * @param {Number} [pageX=0] the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {Number} [pageY=0] the vertical coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {Number} [clientX=0] the horizontal coordinate within the application's client area at which the event occurred
     * @param {Number} [clientX=0] the vertical coordinate within the application's client area at which the event occurred
     * @param {Number} [pointedId=1] the Pointer, Touch or Mouse event Id (1)
     */
    private setEvent;
    isNormalized: boolean;
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
 * @param {Number} x origin point of the Polygon
 * @param {Number} y origin point of the Polygon
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
    public pos: any;
    /**
     * The bounding rectangle for this shape
     * @ignore
     * @type {me.Bounds}
     * @name _bounds
     * @memberOf me.Polygon#
     */
    _bounds: any;
    /**
     * Array of points defining the Polygon <br>
     * Note: If you manually change `points`, you **must** call `recalc`afterwards so that the changes get applied correctly.
     * @public
     * @type {me.Vector2d[]}
     * @name points
     * @memberOf me.Polygon#
     */
    public points: any[];
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
     * @param {Number} x position of the Polygon
     * @param {Number} y position of the Polygon
     * @param {me.Vector2d[]|Number[]} points array of vector or vertice defining the Polygon
     */
    setShape(x: number, y: number, points: any[] | number[]): Polygon;
    /**
     * set the vertices defining this Polygon
     * @name setVertices
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Vector2d[]} points array of vector or vertice defining the Polygon
     */
    setVertices(vertices: any): Polygon;
    /**
     * apply the given transformation matrix to this Polygon
     * @name transform
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Matrix2d} matrix the transformation matrix
     * @return {me.Polygon} Reference to this object for method chaining
     */
    transform(m: any): any;
    /**
     * apply an isometric projection to this shape
     * @name toIso
     * @memberOf me.Polygon.prototype
     * @function
     * @return {me.Polygon} Reference to this object for method chaining
     */
    toIso(): any;
    /**
     * apply a 2d projection to this shape
     * @name to2d
     * @memberOf me.Polygon.prototype
     * @function
     * @return {me.Polygon} Reference to this object for method chaining
     */
    to2d(): any;
    /**
     * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Polygon.prototype
     * @function
     * @param {Number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @return {me.Polygon} Reference to this object for method chaining
     */
    rotate(angle: number, v?: any | any): any;
    /**
     * Scale this Polygon by the given scalar.
     * @name scale
     * @memberOf me.Polygon.prototype
     * @function
     * @param {Number} x
     * @param {Number} [y=x]
     * @return {me.Polygon} Reference to this object for method chaining
     */
    scale(x: number, y?: number): any;
    /**
     * Scale this Polygon by the given vector
     * @name scaleV
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Vector2d} v
     * @return {me.Polygon} Reference to this object for method chaining
     */
    scaleV(v: any): any;
    /**
     * Computes the calculated collision polygon.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @name recalc
     * @memberOf me.Polygon.prototype
     * @function
     * @return {me.Polygon} Reference to this object for method chaining
     */
    recalc(): any;
    /**
     * returns a list of indices for all triangles defined in this polygon
     * @name getIndices
     * @memberOf me.Polygon.prototype
     * @function
     * @param {Vector2d[]} a list of vector
     * @return {me.Polygon} this Polygon
     */
    getIndices(x: any, y: any): any;
    /**
     * translate the Polygon by the specified offset
     * @name translate
     * @memberOf me.Polygon.prototype
     * @function
     * @param {Number} x x offset
     * @param {Number} y y offset
     * @return {me.Polygon} this Polygon
     */
    /**
     * translate the Polygon by the specified vector
     * @name translate
     * @memberOf me.Polygon.prototype
     * @function
     * @param {me.Vector2d} v vector offset
     * @return {me.Polygon} Reference to this object for method chaining
     */
    translate(...args: any[]): any;
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
     * @param {Number} x
     * @param {Number} y
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
     * @return {boolean} true if contains
     */
    /**
     * Returns true if the polygon contains the given point. <br>
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @name contains
     * @memberOf me.Polygon.prototype
     * @function
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @name getBounds
     * @memberOf me.Polygon.prototype
     * @function
     * @return {me.Bounds} this shape bounding box Rectangle object
     */
    getBounds(): any;
    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberOf me.Polygon.prototype
     * @function
     * @return {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds(): any;
    /**
     * clone this Polygon
     * @name clone
     * @memberOf me.Polygon.prototype
     * @function
     * @return {me.Polygon} new Polygon
     */
    clone(): any;
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
 * @param {Number} [max_objects=4] max objects a node can hold before splitting into 4 subnodes
 * @param {Number} [max_levels=4] total max levels inside root Quadtree
 * @param {Number} [level] deepth level, required for subnodes
 */
export class QuadTree {
    constructor(bounds: any, max_objects: any, max_levels: any, level: any);
    max_objects: any;
    max_levels: any;
    level: any;
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
    insertContainer(container: any): void;
    /**
     * Insert the given object into the node. If the node
     * exceeds the capacity, it will split and add all
     * objects to their corresponding subnodes.
     * @name insert
     * @memberOf me.QuadTree
     * @function
     * @param {Object} item object to be added
     */
    insert(item: any): void;
    /**
     * Return all objects that could collide with the given object
     * @name retrieve
     * @memberOf me.QuadTree
     * @function
     * @param {Object} object object to be checked against
     * @param {Object} [function] a sorting function for the returned array
     * @return {Object[]} array with all detected objects
     */
    retrieve(item: any, fn: any): any[];
    /**
     * Remove the given item from the quadtree.
     * (this function won't recalculate the impacted node)
     * @name remove
     * @memberOf me.QuadTree
     * @function
     * @param {Object} object object to be removed
     * @return true if the item was found and removed.
     */
    remove(item: any): boolean;
    /**
     * return true if the node is prunable
     * @name isPrunable
     * @memberOf me.QuadTree
     * @function
     * @return true if the node is prunable
     */
    isPrunable(): boolean;
    /**
     * return true if the node has any children
     * @name hasChildren
     * @memberOf me.QuadTree
     * @function
     * @return true if the node has any children
     */
    hasChildren(): boolean;
    /**
     * clear the quadtree
     * @name clear
     * @memberOf me.QuadTree
     * @function
     */
    clear(bounds: any): void;
}
/**
 * @classdesc
 * a rectangle Object
 * @class
 * @extends me.Polygon
 * @memberOf me
 * @constructor
 * @param {Number} x position of the Rectangle
 * @param {Number} y position of the Rectangle
 * @param {Number} w width of the rectangle
 * @param {Number} h height of the rectangle
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
     * @param {Number} x position of the Rectangle
     * @param {Number} y position of the Rectangle
     * @param {Number|Array} w|points width of the rectangle, or an array of vector defining the rectangle
     * @param {Number} [h] height of the rectangle, if a numeral width parameter is specified
     * @return {me.Rect} this rectangle
     */
    setShape(x: number, y: number, w: number | any[], h?: number, ...args: any[]): any;
    /**
     * left coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name left
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get left(): any;
    /**
     * right coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name right
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get right(): any;
    /**
     * top coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name top
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get top(): any;
    /**
     * bottom coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name bottom
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get bottom(): any;
    /**
     * @ignore
     */
    set width(arg: any);
    /**
     * width of the Rectangle
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get width(): any;
    /**
     * @ignore
     */
    set height(arg: any);
    /**
     * height of the Rectangle
     * @public
     * @type {Number}
     * @name height
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get height(): any;
    /**
     * @ignore
     */
    set centerX(arg: any);
    /**
     * absolute center of this rectangle on the horizontal axis
     * @public
     * @type {Number}
     * @name centerX
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get centerX(): any;
    /**
     * @ignore
     */
    set centerY(arg: any);
    /**
     * absolute center of this rectangle on the vertical axis
     * @public
     * @type {Number}
     * @name centerY
     * @memberOf me.Rect
     */
    /**
     * @ignore
     */
    get centerY(): any;
    /**
     * resize the rectangle
     * @name resize
     * @memberOf me.Rect.prototype
     * @function
     * @param {Number} w new width of the rectangle
     * @param {Number} h new height of the rectangle
     * @return {me.Rect} this rectangle
     */
    resize(w: number, h: number): any;
    /**
     * scale the rectangle
     * @name scale
     * @memberOf me.Rect.prototype
     * @function
     * @param {Number} x a number representing the abscissa of the scaling vector.
     * @param {Number} [y=x] a number representing the ordinate of the scaling vector.
     * @return {me.Rect} this rectangle
     */
    scale(x: number, y?: number): any;
    /**
     * clone this rectangle
     * @name clone
     * @memberOf me.Rect.prototype
     * @function
     * @return {me.Rect} new rectangle
     */
    clone(): any;
    /**
     * copy the position and size of the given rectangle into this one
     * @name copy
     * @memberOf me.Rect.prototype
     * @function
     * @param {me.Rect} rect Source rectangle
     * @return {me.Rect} new rectangle
     */
    copy(rect: any): any;
    /**
     * merge this rectangle with another one
     * @name union
     * @memberOf me.Rect.prototype
     * @function
     * @param {me.Rect} rect other rectangle to union with
     * @return {me.Rect} the union(ed) rectangle
     */
    union(r: any): any;
    /**
     * check if this rectangle is intersecting with the specified one
     * @name overlaps
     * @memberOf me.Rect.prototype
     * @function
     * @param  {me.Rect} rect
     * @return {boolean} true if overlaps
     */
    overlaps(r: any): boolean;
    /**
     * Returns true if the rectangle contains the given rectangle
     * @name contains
     * @memberOf me.Rect.prototype
     * @function
     * @param {me.Rect} rect
     * @return {boolean} true if contains
     */
    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberOf me.Rect.prototype
     * @function
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberOf me.Rect
     * @function
     * @param {me.Vector2d} point
     * @return {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * check if this rectangle is identical to the specified one
     * @name equals
     * @memberOf me.Rect.prototype
     * @function
     * @param  {me.Rect} rect
     * @return {boolean} true if equals
     */
    equals(r: any): boolean;
    /**
     * determines whether all coordinates of this rectangle are finite numbers.
     * @name isFinite
     * @memberOf me.Rect.prototype
     * @function
     * @return {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite(): boolean;
    /**
     * Returns a polygon whose edges are the same as this box.
     * @name toPolygon
     * @memberOf me.Rect.prototype
     * @function
     * @return {me.Polygon} a new Polygon that represents this rectangle.
     */
    toPolygon(): any;
}
/**
 * A base class for renderable objects.
 * @class
 * @extends me.Rect
 * @memberOf me
 * @constructor
 * @param {Number} x position of the renderable object (accessible through inherited pos.x property)
 * @param {Number} y position of the renderable object (accessible through inherited pos.y property)
 * @param {Number} width object width
 * @param {Number} height object height
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
     * @type Boolean
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
     * @see me.collision#check
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
     *          // configure max speed and friction
     *          this.body.setMaxVelocity(3, 15);
     *          this.body.setFriction(0.4, 0);
     *
     *          // set the display to follow our position on both axis
     *          me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);
     *      }
     *
     *      ...
     *
     * }
     */
    public body: any;
    currentTransform: any;
    /**
     * (G)ame (U)nique (Id)entifier" <br>
     * a GUID will be allocated for any renderable object added <br>
     * to an object container (including the `me.game.world` container)
     * @public
     * @type String
     * @name GUID
     * @memberOf me.Renderable
     */
    public GUID: string;
    /**
     * an event handler that is called when the renderable leave or enter a camera viewport
     * @public
     * @type function
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
     * @type Boolean
     * @default false
     * @name alwaysUpdate
     * @memberOf me.Renderable
     */
    public alwaysUpdate: boolean;
    /**
     * Whether to update this object when the game is paused.
     * @public
     * @type Boolean
     * @default false
     * @name updateWhenPaused
     * @memberOf me.Renderable
     */
    public updateWhenPaused: boolean;
    /**
     * make the renderable object persistent over level changes<br>
     * @public
     * @type Boolean
     * @default false
     * @name isPersistent
     * @memberOf me.Renderable
     */
    public isPersistent: boolean;
    /**
     * If true, this renderable will be rendered using screen coordinates,
     * as opposed to world coordinates. Use this, for example, to define UI elements.
     * @public
     * @type Boolean
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
     * @type Boolean
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
     * @type Number
     * @default 1.0
     * @name me.Renderable#alpha
     */
    public alpha: number;
    /**
     * a reference to the parent object that contains this renderable
     * @public
     * @type me.Container|me.Entity
     * @default undefined
     * @name me.Renderable#ancestor
     */
    public ancestor: any | any;
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
    public mask: any | any | any | any;
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
    public tint: any;
    /**
     * The name of the renderable
     * @public
     * @type {String}
     * @name name
     * @default ""
     * @memberOf me.Renderable
     */
    public name: string;
    pos: any;
    /**
     * when true the renderable will be redrawn during the next update cycle
     * @type {Boolean}
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
     * @ignore
     */
    set inViewport(arg: boolean);
    /**
     * Whether the renderable object is visible and within the viewport
     * @public
     * @readonly
     * @type Boolean
     * @default false
     * @name inViewport
     * @memberOf me.Renderable
     */
    /**
     * @ignore
     */
    get inViewport(): boolean;
    /**
     * returns true if this renderable is flipped on the horizontal axis
     * @public
     * @see me.Renderable#flipX
     * @type {Boolean}
     * @name isFlippedX
     * @memberOf me.Renderable
     */
    /**
     * @ignore
     */
    get isFlippedX(): boolean;
    /**
     * returns true if this renderable is flipped on the vertical axis
     * @public
     * @see me.Renderable#flipY
     * @type {Boolean}
     * @name isFlippedY
     * @memberOf me.Renderable
     */
    /**
     * @ignore
     */
    get isFlippedY(): boolean;
    /**
     * returns the bounding box for this renderable
     * @name getBounds
     * @memberOf me.Renderable.prototype
     * @function
     * @return {me.Bounds} bounding box Rectangle object
     */
    getBounds(): any;
    /**
     * get the renderable alpha channel value<br>
     * @name getOpacity
     * @memberOf me.Renderable.prototype
     * @function
     * @return {Number} current opacity value between 0 and 1
     */
    getOpacity(): number;
    /**
     * set the renderable alpha channel value<br>
     * @name setOpacity
     * @memberOf me.Renderable.prototype
     * @function
     * @param {Number} alpha opacity value between 0.0 and 1.0
     */
    setOpacity(alpha: number): void;
    /**
     * flip the renderable on the horizontal axis (around the center of the renderable)
     * @see me.Matrix2d#scaleX
     * @name flipX
     * @memberOf me.Renderable.prototype
     * @function
     * @param {Boolean} [flip=false] `true` to flip this renderable.
     * @return {me.Renderable} Reference to this object for method chaining
     */
    flipX(flip?: boolean): any;
    /**
     * flip the renderable on the vertical axis (around the center of the renderable)
     * @see me.Matrix2d#scaleY
     * @name flipY
     * @memberOf me.Renderable.prototype
     * @function
     * @param {Boolean} [flip=false] `true` to flip this renderable.
     * @return {me.Renderable} Reference to this object for method chaining
     */
    flipY(flip?: boolean): any;
    /**
     * multiply the renderable currentTransform with the given matrix
     * @name transform
     * @memberOf me.Renderable.prototype
     * @see me.Renderable#currentTransform
     * @function
     * @param {me.Matrix2d} matrix the transformation matrix
     * @return {me.Renderable} Reference to this object for method chaining
     */
    transform(m: any): any;
    /**
     * return the angle to the specified target
     * @name angleTo
     * @memberOf me.Renderable
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target
     * @return {Number} angle in radians
     */
    angleTo(target: any | any | any): number;
    /**
     * return the distance to the specified target
     * @name distanceTo
     * @memberOf me.Renderable
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target
     * @return {Number} distance
     */
    distanceTo(target: any | any | any): number;
    /**
     * Rotate this renderable towards the given target.
     * @name lookAt
     * @memberOf me.Renderable.prototype
     * @function
     * @param {me.Renderable|me.Vector2d|me.Vector3d} target the renderable or position to look at
     * @return {me.Renderable} Reference to this object for method chaining
     */
    lookAt(target: any | any | any): any;
    /**
     * Rotate this renderable by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Renderable.prototype
     * @function
     * @param {Number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @return {me.Renderable} Reference to this object for method chaining
     */
    rotate(angle: number): any;
    /**
     * scale the renderable around his anchor point.  Scaling actually applies changes
     * to the currentTransform member wich is used by the renderer to scale the object
     * when rendering.  It does not scale the object itself.  For example if the renderable
     * is an image, the image.width and image.height properties are unaltered but the currentTransform
     * member will be changed.
     * @name scale
     * @memberOf me.Renderable.prototype
     * @function
     * @param {Number} x a number representing the abscissa of the scaling vector.
     * @param {Number} [y=x] a number representing the ordinate of the scaling vector.
     * @return {me.Renderable} Reference to this object for method chaining
     */
    scale(x: number, y?: number): any;
    /**
     * scale the renderable around his anchor point
     * @name scaleV
     * @memberOf me.Renderable.prototype
     * @function
     * @param {me.Vector2d} vector scaling vector
     * @return {me.Renderable} Reference to this object for method chaining
     */
    scaleV(v: any): any;
    /**
     * update function. <br>
     * automatically called by the game manager {@link me.game}
     * @name update
     * @memberOf me.Renderable.prototype
     * @function
     * @protected
     * @param {Number} dt time since the last update in milliseconds.
     * @return false
     **/
    protected update(): boolean;
    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberOf me.Renderable.prototype
     * @function
     * @return {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds(): any;
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
     * @return {me.Vector2d}
     */
    getAbsolutePosition(): any;
    _absPos: any;
    /**
     * called when the anchor point value is changed
     * @private
     * @name onAnchorUpdate
     * @memberOf me.Renderable.prototype
     * @function
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
     **/
    protected preDraw(renderer: any | any): void;
    /**
     * object draw. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberOf me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     **/
    protected draw(): void;
    /**
     * restore the rendering context after drawing. <br>
     * automatically called by the game manager {@link me.game}
     * @name postDraw
     * @memberOf me.Renderable.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     **/
    protected postDraw(renderer: any | any): void;
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
 * @param {Object} options The renderer parameters
 * @param {Number} options.width The width of the canvas without scaling
 * @param {Number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {Boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {Boolean} [options.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
 * @param {Boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
 * @param {Boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {Boolean} [options.blendMode="normal"] the default blend mode to use ("normal", "multiply")
 * @param {Boolean} [options.subPixel=false] Whether to enable subpixel rendering (performance hit when enabled)
 * @param {Boolean} [options.verbose=false] Enable the verbose mode that provides additional details as to what the renderer is doing
 * @param {Number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {Number} [options.zoomY=height] The actual height of the canvas with scaling applied
 */
export class Renderer {
    constructor(options: any);
    /**
     * The given constructor options
     * @public
     * @name settings
     * @memberOf me.Renderer#
     * @enum {Object}
     */
    public settings: any;
    /**
     * true if the current rendering context is valid
     * @name isContextValid
     * @memberOf me.Renderer
     * @default true
     * type {Boolean}
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
     * @return {HTMLCanvasElement}
     */
    getCanvas(): HTMLCanvasElement;
    /**
     * return a reference to the screen canvas
     * @name getScreenCanvas
     * @memberOf me.Renderer.prototype
     * @function
     * @return {HTMLCanvasElement}
     */
    getScreenCanvas(): HTMLCanvasElement;
    /**
     * return a reference to the screen canvas corresponding 2d Context<br>
     * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
     * @name getScreenContext
     * @memberOf me.Renderer.prototype
     * @function
     * @return {Context2d}
     */
    getScreenContext(): any;
    /**
     * returns the current blend mode for this renderer
     * @name getBlendMode
     * @memberOf me.Renderer.prototype
     * @function
     * @return {String} blend mode
     */
    getBlendMode(): string;
    /**
     * Returns the 2D Context object of the given Canvas<br>
     * Also configures anti-aliasing and blend modes based on constructor options.
     * @name getContext2d
     * @memberOf me.Renderer.prototype
     * @function
     * @param {HTMLCanvasElement} canvas
     * @param {Boolean} [transparent=true] use false to disable transparency
     * @return {Context2d}
     */
    getContext2d(c: any, transparent?: boolean): any;
    /**
     * return the width of the system Canvas
     * @name getWidth
     * @memberOf me.Renderer.prototype
     * @function
     * @return {Number}
     */
    getWidth(): number;
    /**
     * return the height of the system Canvas
     * @name getHeight
     * @memberOf me.Renderer.prototype
     * @function
     * @return {Number}
     */
    getHeight(): number;
    /**
     * get the current fill & stroke style color.
     * @name getColor
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Color} current global color
     */
    getColor(): Color;
    /**
     * return the current global alpha
     * @name globalAlpha
     * @memberOf me.Renderer.prototype
     * @function
     * @return {Number}
     */
    globalAlpha(): number;
    /**
     * check if the given rect or bounds overlaps with the renderer screen coordinates
     * @name overlaps
     * @memberOf me.Renderer.prototype
     * @function
     * @param  {me.Rect|me.Bounds} bounds
     * @return {boolean} true if overlaps
     */
    overlaps(bounds: any | any): boolean;
    /**
     * resizes the system canvas
     * @name resize
     * @memberOf me.Renderer.prototype
     * @function
     * @param {Number} width new width of the canvas
     * @param {Number} height new height of the canvas
     */
    resize(width: number, height: number): void;
    /**
     * enable/disable image smoothing (scaling interpolation) for the given context
     * @name setAntiAlias
     * @memberOf me.Renderer.prototype
     * @function
     * @param {Context2d} context
     * @param {Boolean} [enable=false]
     */
    setAntiAlias(context: any, enable?: boolean): void;
    /**
     * set/change the current projection matrix (WebGL only)
     * @name setProjection
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Matrix3d} matrix
     */
    setProjection(matrix: any): void;
    /**
     * stroke the given shape
     * @name stroke
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to stroke
     */
    stroke(shape: any | any | any | any, fill: any): void;
    /**
     * tint the given image or canvas using the given color
     * @name tint
     * @memberOf me.Renderer.prototype
     * @function
     * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} image the source image to be tinted
     * @param {me.Color|String} color the color that will be used to tint the image
     * @param {String} [mode="multiply"] the composition mode used to tint the image
     * @return {HTMLCanvasElement|OffscreenCanvas} a new canvas element representing the tinted image
     */
    tint(src: any, color: any | string, mode?: string): HTMLCanvasElement | any;
    /**
     * fill the given shape
     * @name fill
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to fill
     */
    fill(shape: any | any | any | any): void;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @name setMask
     * @memberOf me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
     */
    setMask(mask?: any | any | any | any): void;
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
     * @param {me.Color} [tint] the tint color
     */
    setTint(tint?: any): void;
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
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the sprite object
 * @param {Number} y the y coordinates of the sprite object
 * @param {Object} settings Configuration parameters for the Sprite object
 * @param {me.Renderer.Texture|HTMLImageElement|HTMLCanvasElement|String} settings.image reference to a texture, spritesheet image or to a texture atlas
 * @param {String} [settings.name=""] name of this object
 * @param {String} [settings.region] region name of a specific region to use when using a texture atlas, see {@link me.Renderer.Texture}
 * @param {Number} [settings.framewidth] Width of a single frame within the spritesheet
 * @param {Number} [settings.frameheight] Height of a single frame within the spritesheet
 * @param {String|Color} [settings.tint] a tint to be applied to this sprite
 * @param {Number} [settings.flipX] flip the sprite on the horizontal axis
 * @param {Number} [settings.flipY] flip the sprite on the vertical axis
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
     * @type Boolean
     * @default false
     * @name me.Sprite#animationpause
     */
    public animationpause: boolean;
    /**
     * animation cycling speed (delay between frame in ms)
     * @public
     * @type Number
     * @default 100
     * @name me.Sprite#animationspeed
     */
    public animationspeed: number;
    /**
     * global offset for the position to draw from on the source image.
     * @public
     * @type me.Vector2d
     * @default <0.0,0.0>
     * @name offset
     * @memberOf me.Sprite#
     */
    public offset: any;
    /**
     * The source texture object this sprite object is using
     * @public
     * @type me.Renderer.Texture
     * @name source
     * @memberOf me.Sprite#
     */
    public source: any;
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
     * @return {Boolean}
     */
    isFlickering(): boolean;
    /**
     * make the object flicker
     * @name flicker
     * @memberOf me.Sprite.prototype
     * @function
     * @param {Number} duration expressed in milliseconds
     * @param {Function} callback Function to call when flickering ends
     * @return {me.Sprite} Reference to this object for method chaining
     * @example
     * // make the object flicker for 1 second
     * // and then remove it
     * this.flicker(1000, function () {
     *     me.game.world.removeChild(this);
     * });
     */
    flicker(duration: number, callback: Function): any;
    /**
     * add an animation <br>
     * For fixed-sized cell sprite sheet, the index list must follow the
     * logic as per the following example :<br>
     * <img src="images/spritesheet_grid.png"/>
     * @name addAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {String} name animation id
     * @param {Number[]|String[]|Object[]} index list of sprite index or name
     * defining the animation. Can also use objects to specify delay for each frame, see below
     * @param {Number} [animationspeed] cycling speed for animation in ms
     * @return {Number} frame amount of frame added to the animation (delay between each frame).
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
    addAnimation(name: string, index: number[] | string[] | any[], animationspeed?: number): number;
    /**
     * set the current animation
     * this will always change the animation & set the frame to zero
     * @name setCurrentAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {String} name animation id
     * @param {String|Function} [onComplete] animation id to switch to when complete, or callback
     * @return {me.Sprite} Reference to this object for method chaining
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
     **/
    setCurrentAnimation(name: string, resetAnim: any, _preserve_dt: any): any;
    isDirty: boolean;
    /**
     * reverse the given or current animation if none is specified
     * @name reverseAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {String} [name] animation id
     * @return {me.Sprite} Reference to this object for method chaining
     * @see me.Sprite#animationspeed
     */
    reverseAnimation(name?: string): any;
    /**
     * return true if the specified animation is the current one.
     * @name isCurrentAnimation
     * @memberOf me.Sprite.prototype
     * @function
     * @param {String} name animation id
     * @return {Boolean}
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
     * @param {Object} region typically returned through me.Texture.getRegion()
     * @return {me.Sprite} Reference to this object for method chaining
     * @example
     * // change the sprite to "shadedDark13.png";
     * mySprite.setRegion(game.texture.getRegion("shadedDark13.png"));
     */
    setRegion(region: any): any;
    /**
     * force the current animation frame index.
     * @name setAnimationFrame
     * @memberOf me.Sprite.prototype
     * @function
     * @param {Number} [index=0] animation frame index
     * @return {me.Sprite} Reference to this object for method chaining
     * @example
     * // reset the current animation to the first frame
     * this.setAnimationFrame();
     */
    setAnimationFrame(idx: any): any;
    /**
     * return the current animation frame index.
     * @name getCurrentAnimationFrame
     * @memberOf me.Sprite.prototype
     * @function
     * @return {Number} current animation frame index
     */
    getCurrentAnimationFrame(): number;
    /**
     * Returns the frame object by the index.
     * @name getAnimationFrameObjectByIndex
     * @memberOf me.Sprite.prototype
     * @function
     * @private
     * @return {Number} if using number indices. Returns {Object} containing frame data if using texture atlas
     */
    private getAnimationFrameObjectByIndex;
    /**
     * @ignore
     */
    update(dt: any): boolean;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(): void;
    /**
     * @ignore
     */
    draw(renderer: any): void;
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
 * @param {Object} [options] The stage` parameters
 * @param {Boolean} [options.cameras=[new me.Camera2d()]] a list of cameras (experimental)
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
     * @enum {Object}
     */
    public settings: any;
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
     * @param {Number} dt time since the last update in milliseconds.
     * @return false
     **/
    update(dt: number): any;
    /**
     * draw the current stage
     * @name draw
     * @memberOf me.Stage
     * @ignore
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    draw(renderer: any | any): void;
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
     * @param {} [arguments...] optional arguments passed when switching state
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
     * @return {me.Bounds}
     */
    public getBounds(layer?: any): any;
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
     * @return {me.Bounds}
     */
    public getBounds(layer?: any): any;
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
 * @param {Object} map layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
 * @param {Object} data layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
 * @param {Number} tilewidth width of each tile in pixels
 * @param {Number} tileheight height of each tile in pixels
 * @param {String} orientation "isometric" or "orthogonal"
 * @param {me.TMXTilesetGroup} tilesets tileset as defined in Tiled
 * @param {Number} z z-index position
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
     * @type me.TMXTilesetGroup
     * @name me.TMXLayer#tilesets
     */
    public tilesets: any;
    tileset: any;
    maxTileSize: {
        width: number;
        height: number;
    };
    /**
     * All animated tilesets in this layer
     * @ignore
     * @type Array
     * @name me.TMXLayer#animatedTilesets
     */
    animatedTilesets: any[];
    /**
     * Layer contains tileset animations
     * @public
     * @type Boolean
     * @name me.TMXLayer#isAnimated
     */
    public isAnimated: boolean;
    /**
     * the order in which tiles on orthogonal tile layers are rendered.
     * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @public
     * @type {String}
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
    public setRenderer(renderer: any): void;
    renderer: any;
    /**
     * Return the layer current renderer object
     * @name getRenderer
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @return {me.TMXRenderer} renderer
     */
    public getRenderer(): any;
    /**
     * Return the TileId of the Tile at the specified position
     * @name getTileId
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {Number} x X coordinate (in world/pixels coordinates)
     * @param {Number} y Y coordinate (in world/pixels coordinates)
     * @return {Number} TileId or null if there is no Tile at the given position
     */
    public getTileId(x: number, y: number): number;
    /**
     * Return the Tile object at the specified position
     * @name getTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {Number} x X coordinate (in world/pixels coordinates)
     * @param {Number} y Y coordinate (in world/pixels coordinates)
     * @return {me.Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
     * @example
     * // get the TMX Map Layer called "Front layer"
     * var layer = me.game.world.getChildByName("Front Layer")[0];
     * // get the tile object corresponding to the latest pointer position
     * var tile = layer.getTile(me.input.pointer.pos.x, me.input.pointer.pos.y);
     */
    public getTile(x: number, y: number): any;
    /**
     * assign the given Tile object to the specified position
     * @name getTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @return {me.Tile} a Tile object
     * @param {Number} x X coordinate (in world/pixels coordinates)
     * @param {Number} y Y coordinate (in world/pixels coordinates)
     * @return {me.Tile} the tile object
     */
    public setTile(tile: any, x: number, y: number): any;
    /**
     * return a new the Tile object corresponding to the given tile id
     * @name setTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {Number} tileId tileId
     * @param {Number} x X coordinate (in world/pixels coordinates)
     * @param {Number} y Y coordinate (in world/pixels coordinates)
     * @return {me.Tile} the tile object
     */
    public getTileById(tileId: number, x: number, y: number): any;
    /**
     * Return the Tile object at the specified tile coordinates
     * @name cellAt
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {Number} x x position of the tile (in Tile unit)
     * @param {Number} y x position of the tile (in Tile unit)
     * @param {Number} [boundsCheck=true] check first if within the layer bounds
     * @return {me.Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
     * @example
     * // return the first tile at offset 0, 0
     * var tile = layer.cellAt(0, 0);
     */
    public cellAt(x: number, y: number, boundsCheck?: number): any;
    /**
     * clear the tile at the specified position
     * @name clearTile
     * @memberOf me.TMXLayer
     * @public
     * @function
     * @param {Number} x X coordinate (in map coordinates: row/column)
     * @param {Number} y Y coordinate (in map coordinates: row/column)
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
 * @param {Number} cols width of the tilemap in tiles
 * @param {Number} rows height of the tilemap in tiles
 * @param {Number} tilewidth width of each tile in pixels
 * @param {Number} tileheight height of each tile in pixels
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
     * @return {boolean}
     */
    public canRender(component: any | any): boolean;
    /**
     * return the bounding rect for this map renderer
     * @name me.TMXRenderer#getBounds
     * @public
     * @function
     * @param {me.TMXLayer} [layer] calculate the bounding rect for a specific layer (will return a new bounds object)
     * @return {me.Bounds}
     */
    public getBounds(layer?: any): any;
    /**
     * return the tile position corresponding to the specified pixel
     * @name me.TMXRenderer#pixelToTileCoords
     * @public
     * @function
     * @param {Number} x X coordinate
     * @param {Number} y Y coordinate
     * @param {me.Vector2d} [vector] an optional vector object where to put the return values
     * @return {me.Vector2d}
     */
    public pixelToTileCoords(x: number, y: number, v: any): any;
    /**
     * return the pixel position corresponding of the specified tile
     * @name me.TMXRenderer#tileToPixelCoords
     * @public
     * @function
     * @param {Number} col tile horizontal position
     * @param {Number} row tile vertical position
     * @param {me.Vector2d} [vector] an optional vector object where to put the return values
     * @return {me.Vector2d}
     */
    public tileToPixelCoords(x: any, y: any, v: any): any;
    /**
     * draw the given tile at the specified layer
     * @name me.TMXRenderer#drawTile
     * @public
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {Number} x X coordinate where to draw the tile
     * @param {Number} y Y coordinate where to draw the tile
     * @param {me.Tile} tile the tile object to draw
     */
    public drawTile(renderer: any | any, x: number, y: number, tile: any): void;
    /**
     * draw the given TMX Layer for the given area
     * @name me.TMXRenderer#drawTileLayer
     * @public
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     * @param {me.TMXLayer} layer a TMX Layer object
     * @param {me.Rect} rect the area of the layer to draw
     */
    public drawTileLayer(renderer: any | any, layer: any, rect: any): void;
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
 * @param {String} levelId name of TMX map
 * @param {Object} data TMX map in JSON format
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
     * @type {String}
     * @name me.TMXTileMap#name
     */
    public name: string;
    /**
     * width of the tilemap in tiles
     * @public
     * @type {Number}
     * @name me.TMXTileMap#cols
     */
    public cols: number;
    /**
     * height of the tilemap in tiles
     * @public
     * @type {Number}
     * @name me.TMXTileMap#rows
     */
    public rows: number;
    /**
     * Tile width
     * @public
     * @type {Number}
     * @name me.TMXTileMap#tilewidth
     */
    public tilewidth: number;
    /**
     * Tile height
     * @public
     * @type {Number}
     * @name me.TMXTileMap#tileheight
     */
    public tileheight: number;
    /**
     * is the map an infinite map
     * @public
     * @type {Number}
     * @default 0
     * @name me.TMXTileMap#infinite
     */
    public infinite: number;
    /**
     * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered” and “hexagonal”.
     * @public
     * @type {String}
     * @default "orthogonal"
     * @name me.TMXTileMap#orientation
     */
    public orientation: string;
    /**
    * the order in which tiles on orthogonal tile layers are rendered.
    * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @public
     * @type {String}
     * @default "right-down"
     * @name me.TMXTileMap#renderorder
     */
    public renderorder: string;
    /**
     * the TMX format version
     * @public
     * @type {String}
     * @name me.TMXTileMap#version
     */
    public version: string;
    /**
     * The Tiled version used to save the file (since Tiled 1.0.1).
     * @public
     * @type {String}
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
     * @return {me.TMXRenderer} a TMX renderer
     */
    public getRenderer(): any;
    renderer: TMXOrthogonalRenderer | TMXIsometricRenderer | TMXHexagonalRenderer | TMXStaggeredRenderer;
    /**
     * return the map bounding rect
     * @name me.TMXRenderer#getBounds
     * @public
     * @function
     * @return {me.Bounds}
     */
    public getBounds(): any;
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
     * @param {me.Container} target container
     * @param {boolean} [flatten=true] if true, flatten all objects into the given container, else a `me.Container` object will be created for each corresponding groups
     * @param {boolean} [setViewportBounds=false] if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
     * @example
     * // create a new level object based on the TMX JSON object
     * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true, true);
     */
    public addTo(container: any, flatten?: boolean, setViewportBounds?: boolean): void;
    /**
     * return an Array of instantiated objects, based on the map object definition
     * @name me.TMXTileMap#getObjects
     * @public
     * @function
     * @param {boolean} [flatten=true] if true, flatten all objects into the returned array.
     * when false, a `me.Container` object will be created for each corresponding groups
     * @return {me.Renderable[]} Array of Objects
     */
    public getObjects(flatten?: boolean): any[];
    /**
     * return all the existing layers
     * @name me.TMXTileMap#getLayers
     * @public
     * @function
     * @return {me.TMXLayer[]} Array of Layers
     */
    public getLayers(): any[];
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
 * @param {Object} tileset tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
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
     * @type Boolean
     * @name me.TMXTileset#isAnimated
     */
    public isAnimated: boolean;
    /**
     * true if the tileset is a "Collection of Image" Tileset
     * @public
     * @type Boolean
     * @name me.TMXTileset#isCollection
     */
    public isCollection: boolean;
    /**
     * Tileset animations
     * @private
     * @type Map
     * @name me.TMXTileset#animations
     */
    private animations;
    /**
     * Remember the last update timestamp to prevent too many animation updates
     * @private
     * @type Map
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
     * @param {Number} gid
     * @return {Image} corresponding image or undefined
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
     * @param {Number} gid
     * @return {Boolean}
     */
    public contains(gid: number): boolean;
    /**
     * Get the view (local) tile ID from a GID, with animations applied
     * @name me.TMXTileset#getViewTileId
     * @public
     * @function
     * @param {Number} gid Global tile ID
     * @return {Number} View tile ID
     */
    public getViewTileId(gid: number): number;
    /**
     * return the properties of the specified tile
     * @name me.TMXTileset#getTileProperties
     * @public
     * @function
     * @param {Number} tileId
     * @return {Object}
     */
    public getTileProperties(tileId: number): any;
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
    public add(tileset: any): void;
    /**
     * return the tileset at the specified index
     * @name me.TMXTilesetGroup#getTilesetByIndex
     * @public
     * @function
     * @param {Number} i
     * @return {me.TMXTileset} corresponding tileset
     */
    public getTilesetByIndex(i: number): any;
    /**
     * return the tileset corresponding to the specified id <br>
     * will throw an exception if no matching tileset is found
     * @name me.TMXTilesetGroup#getTilesetByGid
     * @public
     * @function
     * @param {Number} gid
     * @return {me.TMXTileset} corresponding tileset
     */
    public getTilesetByGid(gid: number): any;
}
/**
 * a generic system font object.
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} x position of the text object
 * @param {Number} y position of the text object
 * @param {Object} settings the text configuration
 * @param {String} settings.font a CSS family font name
 * @param {Number|String} settings.size size, or size + suffix (px, em, pt)
 * @param {me.Color|String} [settings.fillStyle="#000000"] a CSS color value
 * @param {me.Color|String} [settings.strokeStyle="#000000"] a CSS color value
 * @param {Number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
 * @param {String} [settings.textAlign="left"] horizontal text alignment
 * @param {String} [settings.textBaseline="top"] the text baseline
 * @param {Number} [settings.lineHeight=1.0] line spacing height
 * @param {me.Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
 * @param {(String|String[])} [settings.text] a string, or an array of strings
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
     * @type Number
     * @default 1
     * @name me.Text#lineWidth
     */
    public lineWidth: number;
    /**
     * Set the default text alignment (or justification),<br>
     * possible values are "left", "right", and "center".<br>
     * @public
     * @type String
     * @default "left"
     * @name me.Text#textAlign
     */
    public textAlign: string;
    /**
     * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
     * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
     * @public
     * @type String
     * @default "top"
     * @name me.Text#textBaseline
     */
    public textBaseline: string;
    /**
     * Set the line spacing height (when displaying multi-line strings). <br>
     * Current font height will be multiplied with this value to set the line height.
     * @public
     * @type Number
     * @default 1.0
     * @name me.Text#lineHeight
     */
    public lineHeight: number;
    /**
     * the text to be displayed
     * @private
     * @type {String[]}
     * @name _text
     * @memberOf me.Text
     */
    private _text;
    /**
     * the font size (in px)
     * @public
     * @type {Number}
     * @name fontSize
     * @default 10
     * @memberOf me.Text
    */
    public fontSize: number;
    floating: boolean;
    /**
     * make the font bold
     * @name bold
     * @memberOf me.Text.prototype
     * @function
     * @return this object for chaining
     */
    bold(): Text;
    font: any;
    isDirty: boolean;
    /**
     * make the font italic
     * @name italic
     * @memberOf me.Text.prototype
     * @function
     * @return this object for chaining
     */
    italic(): Text;
    /**
     * set the font family and size
     * @name setFont
     * @memberOf me.Text.prototype
     * @function
     * @param {String} font a CSS font name
     * @param {Number|String} [size=10] size in px, or size + suffix (px, em, pt)
     * @return this object for chaining
     * @example
     * font.setFont("Arial", 20);
     * font.setFont("Arial", "1.5em");
     */
    setFont(font: string, size?: number | string): Text;
    height: number;
    /**
     * change the text to be displayed
     * @name setText
     * @memberOf me.Text.prototype
     * @function
     * @param {Number|String|String[]} value a string, or an array of strings
     * @return this object for chaining
     */
    setText(value: number | string | string[]): Text;
    /**
     * measure the given text size in pixels
     * @name measureText
     * @memberOf me.Text.prototype
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} [renderer] reference a renderer instance
     * @param {String} [text] the text to be measured
     * @param {me.Rect|me.Bounds} [ret] a object in which to store the text metrics
     * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
     */
    measureText(_renderer: any, text?: string, ret?: any | any): TextMetrics;
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
     * @param {String} [text]
     * @param {Number} [x]
     * @param {Number} [y]
     */
    draw(renderer: any | any, text?: string, x?: number, y?: number, stroke: any): void;
    /**
     * draw a stroke text at the specified coord, as defined <br>
     * by the `lineWidth` and `fillStroke` properties. <br>
     * Note : using drawStroke is not recommended for performance reasons
     * @name drawStroke
     * @memberOf me.Text.prototype
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
     * @param {String} text
     * @param {Number} x
     * @param {Number} y
     */
    drawStroke(renderer: any | any, text: string, x: number, y: number): void;
    /**
     * @ignore
     */
    _drawFont(context: any, text: any, x: any, y: any, stroke: any): any;
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
 * @param {Number} x x index of the Tile in the map
 * @param {Number} y y index of the Tile in the map
 * @param {Number} gid tile gid
 * @param {me.TMXTileset} tileset the corresponding tileset object
 */
export class Tile {
    constructor(x: any, y: any, gid: any, tileset: any);
    /**
     * tileset
     * @public
     * @type me.TMXTileset
     * @name me.Tile#tileset
     */
    public tileset: any;
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
     * @type Number
     * @name me.Tile#tileId
     */
    public tileId: number;
    /**
     * True if the tile is flipped horizontally<br>
     * @public
     * @type Boolean
     * @name me.Tile#flipX
     */
    public flippedX: boolean;
    /**
     * True if the tile is flipped vertically<br>
     * @public
     * @type Boolean
     * @name me.Tile#flippedY
     */
    public flippedY: boolean;
    /**
     * True if the tile is flipped anti-diagonally<br>
     * @public
     * @type Boolean
     * @name me.Tile#flippedAD
     */
    public flippedAD: boolean;
    /**
     * Global flag that indicates if the tile is flipped<br>
     * @public
     * @type Boolean
     * @name me.Tile#flipped
     */
    public flipped: boolean;
    /**
     * set the transformation matrix for this tile
     * @return {me.Matrix2d) a transformation matrix
     * @ignore
     */
    setTileTransform(transform: any): any;
    /**
     * return a renderable object for this Tile object
     * @name me.Tile#getRenderable
     * @public
     * @function
     * @param {Object} [settings] see {@link me.Sprite}
     * @return {me.Renderable} a me.Sprite object
     */
    public getRenderable(settings?: any): any;
}
/**
 * classdesc
 * trigger an event when colliding with another object
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the trigger area
 * @param {Number} y the y coordinates of the trigger area
 * @param {Number} [settings.width] width of the trigger area
 * @param {Number} [settings.height] height of the trigger area
 * @param {me.Rect[]|me.Polygon[]|me.Line[]|me.Ellipse[]} [settings.shapes] collision shape(s) that will trigger the event
 * @param {String} [settings.duration] Fade duration (in ms)
 * @param {String|me.Color} [settings.color] Fade color
 * @param {String} [settings.event="level"] the type of event to trigger (only "level" supported for now)
 * @param {String} [settings.to] level to load if level trigger
 * @param {String|me.Container} [settings.container] Target container. See {@link me.level.load}
 * @param {Function} [settings.onLoaded] Level loaded callback. See {@link me.level.load}
 * @param {Boolean} [settings.flatten] Flatten all objects into the target container. See {@link me.level.load}
 * @param {Boolean} [settings.setViewportBounds] Resize the viewport to match the level. See {@link me.level.load}
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
     * go to the specified level
     * @name goTo
     * @memberOf me.LevelEntity
     * @function
     * @param {String} [level=this.nextlevel] name of the level to load
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
 * @param {Object} object object on which to apply the tween
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
    object: any;
    valuesStart: any;
    valuesEnd: any;
    valuesStartRepeat: any;
    duration: any;
    /**
     * Repeat the tween
     * @name repeat
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Number} times amount of times the tween should be repeated
     */
    public repeat(times: number): Tween;
    /**
     * Allows the tween to bounce back to their original value when finished.
     * To be used together with repeat to create endless loops.
     * @name yoyo
     * @memberOf me.Tween
     * @public
     * @function
     * @see me.Tween#repeat
     * @param {Boolean} yoyo
     */
    public yoyo(yoyo: boolean): Tween;
    reversed: any;
    delayTime: any;
    startTime: any;
    easingFunction: any;
    interpolationFunction: any;
    chainedTweens: any;
    onStartCallback: any;
    onStartCallbackFired: any;
    onUpdateCallback: any;
    onCompleteCallback: any;
    tweenTimeTracker: any;
    isRenderable: boolean;
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
    _onStartCallback: any;
    _onStartCallbackFired: boolean;
    _onUpdateCallback: any;
    _onCompleteCallback: any;
    _tweenTimeTracker: any;
    isPersistent: boolean;
    updateWhenPaused: boolean;
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
     * @param {Object} properties hash of properties
     * @param {Object|Number} [options] object of tween properties, or a duration if a numeric value is passed
     * @param {Number} [options.duration] tween duration
     * @param {me.Tween.Easing} [options.easing] easing function
     * @param {Number} [options.delay] delay amount expressed in milliseconds
     * @param {Boolean} [options.yoyo] allows the tween to bounce back to their original value when finished. To be used together with repeat to create endless loops.
     * @param {Number} [options.repeat] amount of times the tween should be repeated
     * @param {me.Tween.Interpolation} [options.interpolation] interpolation function
     * @param {Boolean} [options.autoStart] allow this tween to start automatically. Otherwise call me.Tween.start().
     */
    public to(properties: any, options?: any | number): Tween;
    /**
     * start the tween
     * @name start
     * @memberOf me.Tween
     * @public
     * @function
     */
    public start(time?: number): Tween;
    /**
     * stop the tween
     * @name stop
     * @memberOf me.Tween
     * @public
     * @function
     */
    public stop(): Tween;
    /**
     * delay the tween
     * @name delay
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Number} amount delay amount expressed in milliseconds
     */
    public delay(amount: number): Tween;
    /**
     * set the easing function
     * @name easing
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween.Easing} fn easing function
     */
    public easing(easing: any): Tween;
    /**
     * set the interpolation function
     * @name interpolation
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween.Interpolation} fn interpolation function
     */
    public interpolation(interpolation: any): Tween;
    /**
     * chain the tween
     * @name chain
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween} chainedTween Tween to be chained
     */
    public chain(...args: any[]): Tween;
    /**
     * onStart callback
     * @name onStart
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onStartCallback callback
     */
    public onStart(callback: any): Tween;
    /**
     * onUpdate callback
     * @name onUpdate
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onUpdateCallback callback
     */
    public onUpdate(callback: any): Tween;
    /**
     * onComplete callback
     * @name onComplete
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onCompleteCallback callback
     */
    public onComplete(callback: any): Tween;
    /** @ignore */
    update(dt: any): boolean;
}
/**
 * @classdesc
 * a generic 2D Vector Object
 * @class Vector2d
 * @memberOf me
 * @constructor
 * @param {Number} [x=0] x value of the vector
 * @param {Number} [y=0] y value of the vector
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
     * @ignore */
    _set(x: any, y: any): Vector2d;
    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberOf me.Vector2d
     * @function
     * @param {Number} x
     * @param {Number} y
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    set(x: number, y: number): any;
    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    setZero(): any;
    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    setV(v: any): any;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    add(v: any): any;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    sub(v: any): any;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.Vector2d
     * @function
     * @param {Number} x
     * @param {Number} [y=x]
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number): any;
    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    toIso(): any;
    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    to2d(): any;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    scaleV(v: any): any;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.Vector2d
     * @function
     * @param {Number} value
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    div(n: any): any;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    abs(): any;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.Vector2d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.Vector2d} new me.Vector2d
     */
    clamp(low: number, high: number): any;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.Vector2d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): any;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    minV(v: any): any;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    maxV(v: any): any;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} new me.Vector2d
     */
    floor(): any;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    floorSelf(): any;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} new me.Vector2d
     */
    ceil(): any;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    ceilSelf(): any;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} new me.Vector2d
     */
    negate(): any;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    negateSelf(): any;
    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    copy(v: any): any;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {Boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberOf me.Vector2d
     * @function
     * @param {Number} x
     * @param {Number} y
     * @return {Boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    normalize(): any;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    perp(): any;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.Vector2d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: any | any): any;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {Number} The dot product.
     */
    dotProduct(v: any): number;
    /**
      * return the square length of this vector
      * @name length2
      * @memberOf me.Vector2d
      * @function
      * @return {Number} The length^2 of this vector.
      */
    length2(): number;
    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberOf me.Vector2d
     * @function
     * @return {Number} the length of this vector
     */
    length(): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @param {Number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    lerp(v: any, alpha: number): any;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {Number}
     */
    distance(v: any): number;
    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @return {Number} angle in radians
     */
    angle(v: any): number;
    /**
     * project this vector on to another vector.
     * @name project
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v The vector to project onto.
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    project(v: any): any;
    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberOf me.Vector2d
     * @function
     * @param {me.Vector2d} v The unit vector to project onto.
     * @return {me.Vector2d} Reference to this object for method chaining
     */
    projectN(v: any): any;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.Vector2d
     * @function
     * @return {me.Vector2d} new me.Vector2d
     */
    clone(): any;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Vector2d
     * @function
     * @return {String}
     */
    toString(): string;
}
/**
 * @classdesc
 * a generic 3D Vector Object
 * @class Vector3d
 * @memberOf me
 * @constructor
 * @param {Number} [x=0] x value of the vector
 * @param {Number} [y=0] y value of the vector
 * @param {Number} [z=0] z value of the vector
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
     * @ignore */
    _set(x: any, y: any, z?: number): Vector3d;
    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberOf me.Vector3d
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} [z=0]
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    set(x: number, y: number, z?: number): any;
    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    setZero(): any;
    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    setV(v: any | any): any;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    add(v: any | any): any;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    sub(v: any | any): any;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.Vector3d
     * @function
     * @param {Number} x
     * @param {Number} [y=x]
     * @param {Number} [z=1]
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number, z?: number): any;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    scaleV(v: any | any): any;
    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    toIso(): any;
    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    to2d(): any;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.Vector3d
     * @function
     * @param {Number} value
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    div(n: any): any;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    abs(): any;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.Vector3d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.Vector3d} new me.Vector3d
     */
    clamp(low: number, high: number): any;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.Vector3d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): any;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    minV(v: any | any): any;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    maxV(v: any | any): any;
    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} new me.Vector3d
     */
    floor(): any;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    floorSelf(): any;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} new me.Vector3d
     */
    ceil(): any;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    ceilSelf(): any;
    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} new me.Vector3d
     */
    negate(): any;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    negateSelf(): any;
    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    copy(v: any | any): any;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {Boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberOf me.Vector3d
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} [z]
     * @return {Boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    normalize(): any;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
     * @name perp
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    perp(): any;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
     * @name rotate
     * @memberOf me.Vector3d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: any | any): any;
    /**
     * return the dot product of this vector and the passed one
     * @name dotProduct
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {Number} The dot product.
     */
    dotProduct(v: any | any): number;
    /**
      * return the square length of this vector
      * @name length2
      * @memberOf me.Vector3d
      * @function
      * @return {Number} The length^2 of this vector.
      */
    length2(): number;
    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberOf me.Vector3d
     * @function
     * @return {Number} the length of this vector
     */
    length(): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector3d} v
     * @param {Number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    lerp(v: any, alpha: number): any;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {Number}
     */
    distance(v: any | any): number;
    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @return {Number} angle in radians
     */
    angle(v: any | any): number;
    /**
     * project this vector on to another vector.
     * @name project
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v The vector to project onto.
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    project(v: any | any): any;
    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberOf me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v The unit vector to project onto.
     * @return {me.Vector3d} Reference to this object for method chaining
     */
    projectN(v: any | any): any;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.Vector3d
     * @function
     * @return {me.Vector3d} new me.Vector3d
     */
    clone(): any;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.Vector3d
     * @function
     * @return {String}
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
    /**
     * The number of quads held in the batch
     * @name length
     * @memberOf me.WebGLCompositor
     * @type Number
     * @readonly
     */
    readonly length: number;
    currentTextureUnit: any;
    boundTextures: any[];
    v: Vector2d[];
    renderer: any;
    gl: any;
    color: any;
    tint: any;
    viewMatrix: any;
    /**
     * a reference to the active WebGL shader
     * @name activeShader
     * @memberOf me.WebGLCompositor
     * @type {me.GLShader}
     */
    activeShader: any;
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
    primitiveShader: GLShader;
    quadShader: GLShader;
    sbSize: number;
    sbIndex: number;
    stream: Float32Array;
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
     * @param {String} name name of the attribute in the vertex shader
     * @param {Number} size number of components per vertex attribute. Must be 1, 2, 3, or 4.
     * @param {GLenum} type data type of each component in the array
     * @param {Boolean} normalized whether integer data values should be normalized into a certain
     * @param {Number} offset offset in bytes of the first component in the vertex attribute array
     */
    addAttribute(name: string, size: number, type: GLenum, normalized: boolean, offset: number): void;
    /**
     * Sets the viewport
     * @name setViewport
     * @memberOf me.WebGLCompositor
     * @function
     * @param {Number} x x position of viewport
     * @param {Number} y y position of viewport
     * @param {Number} width width of viewport
     * @param {Number} height height of viewport
     */
    setViewport(x: number, y: number, w: any, h: any): void;
    /**
     * Create a WebGL texture from an image
     * @name createTexture2D
     * @memberOf me.WebGLCompositor
     * @function
     * @param {Number} unit Destination texture unit
     * @param {Image|Canvas|ImageData|UInt8Array[]|Float32Array[]} image Source image
     * @param {Number} filter gl.LINEAR or gl.NEAREST
     * @param {String} [repeat="no-repeat"] Image repeat behavior (see {@link me.ImageLayer#repeat})
     * @param {Number} [w] Source image width (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {Number} [h] Source image height (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {Number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {Number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {Boolean} [premultipliedAlpha=true] Multiplies the alpha channel into the other color channels
     * @param {Boolean} [mipmap=true] Whether mipmap levels should be generated for this texture
     * @return {WebGLTexture} a WebGL texture
     */
    createTexture2D(unit: number, image: (new (width?: number, height?: number) => HTMLImageElement) | any | ImageData | any[] | Float32Array[], filter: number, repeat?: string, w?: number, h?: number, b?: number, premultipliedAlpha?: boolean, mipmap?: boolean): WebGLTexture;
    /**
     * assign the given WebGL texture to the current batch
     * @name setTexture2D
     * @memberOf me.WebGLCompositor
     * @function
     * @param {WebGLTexture} a WebGL texture
     * @param {Number} unit Texture unit to which the given texture is bound
     */
    setTexture2D(texture: any, unit: number): void;
    /**
     * @ignore
     */
    uploadTexture(texture: any, w: any, h: any, b: any, force: any): any;
    /**
     * Create a full index buffer for the element array
     * @ignore
     */
    createIB(): Uint16Array;
    /**
     * Resize the stream buffer, retaining its original contents
     * @ignore
     */
    resizeSB(): void;
    /**
     * Select the shader to use for compositing
     * @name useShader
     * @see me.GLShader
     * @memberOf me.WebGLCompositor
     * @function
     * @param {me.GLShader} shader a reference to a GLShader instance
     */
    useShader(shader: any): void;
    /**
     * Add a textured quad
     * @name addQuad
     * @memberOf me.WebGLCompositor
     * @function
     * @param {me.Renderer.Texture} texture Source texture
     * @param {String} key Source texture region name
     * @param {Number} x Destination x-coordinate
     * @param {Number} y Destination y-coordinate
     * @param {Number} w Destination width
     * @param {Number} h Destination height
     */
    addQuad(texture: any, key: string, x: number, y: number, w: number, h: number): void;
    /**
     * Flush batched texture operations to the GPU
     * @param
     * @memberOf me.WebGLCompositor
     * @function
     */
    flush(): void;
    /**
     * Draw an array of vertices
     * @name drawVertices
     * @memberOf me.WebGLCompositor
     * @function
     * @param {GLENUM} [mode=gl.TRIANGLES] primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @param {me.Vector2d[]} [verts=[]] vertices
     * @param {Number} [vertexCount=verts.length] amount of points defined in the points array
     */
    drawVertices(mode?: any, verts?: any[], vertexCount?: number): void;
    /**
     * Specify the color values used when clearing color buffers. The values are clamped between 0 and 1.
     * @name clearColor
     * @memberOf me.WebGLCompositor
     * @function
     * @param {Number} r - the red color value used when the color buffers are cleared
     * @param {Number} g - the green color value used when the color buffers are cleared
     * @param {Number} b - the blue color value used when the color buffers are cleared
     * @param {Number} a - the alpha color value used when the color buffers are cleared
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
 * @param {Object} options The renderer parameters
 * @param {Number} options.width The width of the canvas without scaling
 * @param {Number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {Boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {Boolean} [options.antiAlias=false] Whether to enable anti-aliasing
 * @param {Boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
 * @param {Boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {Boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
 * @param {Boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
 * @param {String} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @param {Number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {Number} [options.zoomY=height] The actual height of the canvas with scaling applied
 * @param {me.WebGLCompositor} [options.compositor] A class that implements the compositor API
 */
export class WebGLRenderer {
    constructor(options: any);
    /**
     * The WebGL context
     * @name gl
     * @memberOf me.WebGLRenderer
     * type {WebGLRenderingContext}
     */
    context: WebGLRenderingContext;
    gl: WebGLRenderingContext;
    /**
     * The WebGL version used by this renderer (1 or 2)
     * @name WebGLVersion
     * @memberOf me.WebGLRenderer
     * @type {Number}
     * @default 1
     * @readonly
     */
    readonly webGLVersion: number;
    /**
     * The vendor string of the underlying graphics driver.
     * @name GPUVendor
     * @memberOf me.WebGLRenderer
     * @type {String}
     * @default null
     * @readonly
     */
    readonly GPUVendor: string;
    /**
     * The renderer string of the underlying graphics driver.
     * @name GPURenderer
     * @memberOf me.WebGLRenderer
     * @type {String}
     * @default null
     * @readonly
     */
    readonly GPURenderer: string;
    /**
     * Maximum number of texture unit supported under the current context
     * @name maxTextures
     * @memberOf me.WebGLRenderer
     * @type {Number}
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
     * @type me.Matrix2d
     * @memberOf me.WebGLRenderer#
     */
    currentTransform: any;
    /**
     * The current compositor used by the renderer
     * @name currentCompositor
     * @type me.WebGLCompositor
     * @memberOf me.WebGLRenderer#
     */
    currentCompositor: any;
    cache: TextureCache;
    /**
     * Reset context state
     * @name reset
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    reset(): void;
    /**
     * assign a compositor to this renderer
     * @name setCompositor
     * @function
     * @param {WebGLCompositor} compositor a compositor instance
     * @memberOf me.WebGLRenderer.prototype
     * @function
     */
    setCompositor(compositor: WebGLCompositor): void;
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
     * @param {image} image Source image
     * @param {String} repeat Define how the pattern should be repeated
     * @return {me.Renderer.Texture}
     * @see me.ImageLayer#repeat
     * @example
     * var tileable   = renderer.createPattern(image, "repeat");
     * var horizontal = renderer.createPattern(image, "repeat-x");
     * var vertical   = renderer.createPattern(image, "repeat-y");
     * var basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image: any, repeat: string): any;
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
     * @param {me.Color|String} [color] CSS color.
     * @param {Boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(col: any, opaque?: boolean): void;
    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @name clearRect
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x x axis of the coordinate for the rectangle starting point.
     * @param {Number} y y axis of the coordinate for the rectangle starting point.
     * @param {Number} width The rectangle's width.
     * @param {Number} height The rectangle's height.
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
     * @param {Number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {Number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {Number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {Number} sh The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {Number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {Number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {Number} dWidth The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {Number} dHeight The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image: new (width?: number, height?: number) => HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: any, dh: any): void;
    /**
     * Draw a pattern within the given rectangle.
     * @name drawPattern
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Renderer.Texture} pattern Pattern object
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
     * @see me.WebGLRenderer#createPattern
     */
    drawPattern(pattern: any, x: number, y: number, width: number, height: number): void;
    /**
     * return a reference to the screen canvas corresponding WebGL Context
     * @name getScreenContext
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @return {WebGLRenderingContext}
     */
    getScreenContext(): WebGLRenderingContext;
    /**
     * Returns the WebGL Context object of the given Canvas
     * @name getContextGL
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Canvas} canvas
     * @param {Boolean} [transparent=true] use false to disable transparency
     * @return {WebGLRenderingContext}
     */
    getContextGL(canvas: any, transparent?: boolean): WebGLRenderingContext;
    WebGLVersion: number;
    /**
     * Returns the WebGLContext instance for the renderer
     * return a reference to the system 2d Context
     * @name getContext
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @return {WebGLRenderingContext}
     */
    getContext(): WebGLRenderingContext;
    /**
     * set a blend mode for the given context
     * @name setBlendMode
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {String} [mode="normal"] blend mode : "normal", "multiply"
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
     * @param {Number} angle in radians
     */
    rotate(angle: number): void;
    /**
     * scales the uniform matrix
     * @name scale
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
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
     * @param {Number} alpha 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(a: any): void;
    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @name setColor
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Color|String} color css color string.
     */
    setColor(color: any | string): void;
    /**
     * Set the line width
     * @name setLineWidth
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} width Line width
     */
    setLineWidth(width: number): void;
    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @name strokeArc
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x arc center point x-axis
     * @param {Number} y arc center point y-axis
     * @param {Number} radius
     * @param {Number} start start angle in radians
     * @param {Number} end end angle in radians
     * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
     * @param {Boolean} [fill=false]
     */
    strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean, fill?: boolean): void;
    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @name fillArc
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x arc center point x-axis
     * @param {Number} y arc center point y-axis
     * @param {Number} radius
     * @param {Number} start start angle in radians
     * @param {Number} end end angle in radians
     * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
     */
    fillArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean): void;
    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @name strokeEllipse
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x ellipse center point x-axis
     * @param {Number} y ellipse center point y-axis
     * @param {Number} w horizontal radius of the ellipse
     * @param {Number} h vertical radius of the ellipse
     * @param {Boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeEllipse(x: number, y: number, w: number, h: number, fill?: boolean): void;
    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @name fillEllipse
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x ellipse center point x-axis
     * @param {Number} y ellipse center point y-axis
     * @param {Number} w horizontal radius of the ellipse
     * @param {Number} h vertical radius of the ellipse
     */
    fillEllipse(x: number, y: number, w: number, h: number): void;
    /**
     * Stroke a line of the given two points
     * @name strokeLine
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} startX the start x coordinate
     * @param {Number} startY the start y coordinate
     * @param {Number} endX the end x coordinate
     * @param {Number} endY the end y coordinate
     */
    strokeLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Fill a line of the given two points
     * @name fillLine
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} startX the start x coordinate
     * @param {Number} startY the start y coordinate
     * @param {Number} endX the end x coordinate
     * @param {Number} endY the end y coordinate
     */
    fillLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Stroke a me.Polygon on the screen with a specified color
     * @name strokePolygon
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     * @param {Boolean} [fill=false] also fill the shape with the current color if true
     */
    strokePolygon(poly: any, fill?: boolean): void;
    /**
     * Fill a me.Polygon on the screen
     * @name fillPolygon
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
    */
    fillPolygon(poly: any): void;
    /**
     * Draw a stroke rectangle at the specified coordinates
     * @name strokeRect
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
     * @param {Boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeRect(x: number, y: number, width: number, height: number, fill?: boolean): void;
    /**
     * Draw a filled rectangle at the specified coordinates
     * @name fillRect
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
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
    setTransform(mat2d: any): void;
    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @name transform
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    transform(mat2d: any): void;
    /**
     * Translates the uniform matrix by the given coordinates
     * @name translate
     * @memberOf me.WebGLRenderer.prototype
     * @function
     * @param {Number} x
     * @param {Number} y
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
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
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
    setMask(mask?: any | any | any | any): void;
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
 * an object representing the physic world, and responsible for managing and updating all childs and physics
 * @class
 * @extends me.Container
 * @memberOf me
 * @constructor
 * @param {Number} [x=0] position of the container (accessible via the inherited pos.x property)
 * @param {Number} [y=0] position of the container (accessible via the inherited pos.y property)
 * @param {Number} [w=me.game.viewport.width] width of the container
 * @param {Number} [h=me.game.viewport.height] height of the container
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
     * @type me.Vector2d
     * @default 60
     * @name fps
     * @memberOf me.World
     * @see me.timer.maxfps
     */
    public fps: any;
    /**
     * world gravity
     * @public
     * @type me.Vector2d
     * @default <0,0.98>
     * @name gravity
     * @memberOf me.World
     */
    public gravity: any;
    /**
     * Specify the rendering method for tile layers. <br>
     * if false visible part of the layers are rendered dynamically,<br>
     * if true the entire layers are first rendered into an offscreen canvas.<br>
     * the "best" rendering method depends of your game
     * (amount of layer, layer size, amount of tiles per layer, etc.)<br>
     * note : rendering method is also configurable per layer by adding this
     * property to your layer (in Tiled).
     * @type {Boolean}
     * @default false
     * @memberOf me.World
     */
    preRender: boolean;
    /**
     * the instance of the game world quadtree used for broadphase
     * @name broadphase
     * @memberOf me.World
     * @public
     * @type {me.QuadTree}
     */
    public broadphase: any;
    /**
     * reset the game world
     * @name reset
     * @memberOf me.World
     * @function
     */
    reset(): void;
    /**
     * update the game world
     * @name reset
     * @memberOf me.World
     * @function
     */
    update(dt: any): any;
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
    const maxChildren: number;
    const maxDepth: number;
    namespace types {
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
    const response: any;
    /**
     * a callback used to determine if two objects should collide (based on both respective objects collision mask and type).<br>
     * you can redefine this function if you need any specific rules over what should collide with what.
     * @name shouldCollide
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Renderable} a a reference to the object A.
     * @param {me.Renderable} b a reference to the object B.
     * @return {Boolean} true if they should collide, false otherwise
     */
    function shouldCollide(a: any, b: any): boolean;
    /**
     * a callback used to determine if two objects should collide (based on both respective objects collision mask and type).<br>
     * you can redefine this function if you need any specific rules over what should collide with what.
     * @name shouldCollide
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Renderable} a a reference to the object A.
     * @param {me.Renderable} b a reference to the object B.
     * @return {Boolean} true if they should collide, false otherwise
     */
    function shouldCollide(a: any, b: any): boolean;
    /**
     * Checks if the specified object collides with others
     * @name check
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Renderable} obj object to be tested for collision
     * @param {me.collision.ResponseObject} [respObj=me.collision.response] a user defined response object that will be populated if they intersect.
     * @return {Boolean} in case of collision, false otherwise
     * @example
     * update : function (dt) {
     *    // ...
     *
     *    // handle collisions against other shapes
     *    me.collision.check(this);
     *
     *    // ...
     * },
     *
     * // colision handler
     * onCollision : function (response) {
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
    function check(objA: any, responseObject: any): boolean;
    /**
     * Checks if the specified object collides with others
     * @name check
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Renderable} obj object to be tested for collision
     * @param {me.collision.ResponseObject} [respObj=me.collision.response] a user defined response object that will be populated if they intersect.
     * @return {Boolean} in case of collision, false otherwise
     * @example
     * update : function (dt) {
     *    // ...
     *
     *    // handle collisions against other shapes
     *    me.collision.check(this);
     *
     *    // ...
     * },
     *
     * // colision handler
     * onCollision : function (response) {
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
    function check(objA: any, responseObject: any): boolean;
    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Line} line line to be tested for collision
     * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
     * @return {Array.<me.Renderable>} an array of intersecting physic objects
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
    function rayCast(line: any, resultArray: any): any[];
    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Line} line line to be tested for collision
     * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
     * @return {Array.<me.Renderable>} an array of intersecting physic objects
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
    function rayCast(line: any, resultArray: any): any[];
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
     * @param {Boolean} [enable=true] enable or disable swipe.
     */
    function enableSwipe(enable?: boolean): void;
    /**
     * enable/disable swipe on WebView.
     * @function me.device.enableSwipe
     * @param {Boolean} [enable=true] enable or disable swipe.
     */
    function enableSwipe(enable?: boolean): void;
    /**
     * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
     * @function me.device.requestFullscreen
     * @param {Object} [element=default canvas object] the element to be set in full-screen mode.
     * @example
     * // add a keyboard shortcut to toggle Fullscreen mode on/off
     * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
     * me.event.subscribe(me.event.KEYDOWN, function (action, keyCode, edge) {
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
     * @param {Object} [element=default canvas object] the element to be set in full-screen mode.
     * @example
     * // add a keyboard shortcut to toggle Fullscreen mode on/off
     * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
     * me.event.subscribe(me.event.KEYDOWN, function (action, keyCode, edge) {
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
     * @return {String} the screen orientation
     */
    function getScreenOrientation(): string;
    /**
     * Return a string representing the orientation of the device screen.
     * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
     * @function me.device.getScreenOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
     * @return {String} the screen orientation
     */
    function getScreenOrientation(): string;
    /**
     * locks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.lockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @return {Boolean} true if the orientation was unsuccessfully locked
     */
    function lockOrientation(orientation: any): boolean;
    /**
     * locks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.lockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @return {Boolean} true if the orientation was unsuccessfully locked
     */
    function lockOrientation(orientation: any): boolean;
    /**
     * unlocks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.unlockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @return {Boolean} true if the orientation was unsuccessfully unlocked
     */
    function unlockOrientation(orientation: any): boolean;
    /**
     * unlocks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.unlockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @return {Boolean} true if the orientation was unsuccessfully unlocked
     */
    function unlockOrientation(orientation: any): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isPortrait
     * @return {Boolean}
     */
    function isPortrait(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isPortrait
     * @return {Boolean}
     */
    function isPortrait(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isLandscape
     * @return {Boolean}
     */
    function isLandscape(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isLandscape
     * @return {Boolean}
     */
    function isLandscape(): boolean;
    /**
     * return the device storage
     * @function me.device.getStorage
     * @see me.save
     * @param {String} [type="local"]
     * @return {Object} a reference to the device storage
     */
    function getStorage(type?: string): any;
    /**
     * return the device storage
     * @function me.device.getStorage
     * @see me.save
     * @param {String} [type="local"]
     * @return {Object} a reference to the device storage
     */
    function getStorage(type?: string): any;
    /**
     * return the parent DOM element for the given parent name or HTMLElement object
     * @function me.device.getParentElement
     * @param {String|HTMLElement} element the parent element name or a HTMLElement object
     * @return {HTMLElement} the parent Element
     */
    function getParentElement(element: string | HTMLElement): HTMLElement;
    /**
     * return the parent DOM element for the given parent name or HTMLElement object
     * @function me.device.getParentElement
     * @param {String|HTMLElement} element the parent element name or a HTMLElement object
     * @return {HTMLElement} the parent Element
     */
    function getParentElement(element: string | HTMLElement): HTMLElement;
    /**
     * return the DOM element for the given element name or HTMLElement object
     * @function me.device.getElement
     * @param {String|HTMLElement} element the parent element name or a HTMLElement object
     * @return {HTMLElement} the corresponding DOM Element or null if not existing
     */
    function getElement(element: string | HTMLElement): HTMLElement;
    /**
     * return the DOM element for the given element name or HTMLElement object
     * @function me.device.getElement
     * @param {String|HTMLElement} element the parent element name or a HTMLElement object
     * @return {HTMLElement} the corresponding DOM Element or null if not existing
     */
    function getElement(element: string | HTMLElement): HTMLElement;
    /**
     * returns the size of the given HTMLElement and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getElementBounds
     * @param {String|HTMLElement} element an HTMLElement object
     * @return {DOMRect} the size and position of the element relatively to the viewport
     */
    function getElementBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns the size of the given HTMLElement and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getElementBounds
     * @param {String|HTMLElement} element an HTMLElement object
     * @return {DOMRect} the size and position of the element relatively to the viewport
     */
    function getElementBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns the size of the given HTMLElement Parent and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getParentBounds
     * @param {String|HTMLElement} element an HTMLElement object
     * @return {DOMRect} the size and position of the given element parent relative to the viewport
     */
    function getParentBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns the size of the given HTMLElement Parent and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getParentBounds
     * @param {String|HTMLElement} element an HTMLElement object
     * @return {DOMRect} the size and position of the given element parent relative to the viewport
     */
    function getParentBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns true if the device supports WebGL
     * @function me.device.isWebGLSupported
     * @param {Object} [options] context creation options
     * @param {Boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @return {Boolean} true if WebGL is supported
     */
    function isWebGLSupported(options?: {
        failIfMajorPerformanceCaveat?: boolean;
    }): boolean;
    /**
     * returns true if the device supports WebGL
     * @function me.device.isWebGLSupported
     * @param {Object} [options] context creation options
     * @param {Boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @return {Boolean} true if WebGL is supported
     */
    function isWebGLSupported(options?: {
        failIfMajorPerformanceCaveat?: boolean;
    }): boolean;
    /**
     * return the highest precision format supported by this device for GL Shaders
     * @function me.device.getMaxShaderPrecision
     * @param {WebGLRenderingContext} gl
     * @return {Boolean} "lowp", "mediump", or "highp"
     */
    function getMaxShaderPrecision(gl: WebGLRenderingContext): boolean;
    /**
     * return the highest precision format supported by this device for GL Shaders
     * @function me.device.getMaxShaderPrecision
     * @param {WebGLRenderingContext} gl
     * @return {Boolean} "lowp", "mediump", or "highp"
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
     * @return {Boolean} false if not supported or permission not granted by the user
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
     * @return {Boolean} false if not supported or permission not granted by the user
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
     * @return {Boolean} false if not supported or permission not granted by the user
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
     * @return {Boolean} false if not supported or permission not granted by the user
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
     * @param {Number|Number[]} pattern pattern of vibration and pause intervals
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
     * @param {Number|Number[]} pattern pattern of vibration and pause intervals
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
    GAME_UPDATE: string;
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
    publish: typeof publish;
    subscribe: typeof subscribe;
    unsubscribe: typeof unsubscribe;
}>;
export var game: Readonly<{
    __proto__: any;
    readonly viewport: any;
    readonly world: any;
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
* @type {Boolean}
* @default false
* @readonly
* @memberOf me
*/
export var initialized: boolean;
export var input: Readonly<{
    __proto__: any;
    preventDefault: boolean;
    readonly pointerEventTarget: EventTarget;
    readonly pointer: any;
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
         * @enum {Number}
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
         * @enum {Number}
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
     * @param {String} format level format (only "tmx" supported)
     * @param {String} levelId the level id (or name)
     * @param {Function} [callback] a function to be called once the level is loaded
     * @return {Boolean} true if the level was loaded
     */
    function add(format: string, levelId: string, callback?: Function): boolean;
    /**
     * add a level into the game manager (usually called by the preloader)
     * @name add
     * @memberOf me.level
     * @public
     * @function
     * @param {String} format level format (only "tmx" supported)
     * @param {String} levelId the level id (or name)
     * @param {Function} [callback] a function to be called once the level is loaded
     * @return {Boolean} true if the level was loaded
     */
    function add(format: string, levelId: string, callback?: Function): boolean;
    /**
     * load a level into the game manager<br>
     * (will also create all level defined entities, etc..)
     * @name load
     * @memberOf me.level
     * @public
     * @function
     * @param {String} level level id
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @param {boolean} [options.setViewportBounds=true] if true, set the viewport bounds to the map size
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
    function load(levelId: any, options?: {
        container?: any;
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
     * @param {String} level level id
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @param {boolean} [options.setViewportBounds=true] if true, set the viewport bounds to the map size
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
    function load(levelId: any, options?: {
        container?: any;
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
     * @return {String}
     */
    function getCurrentLevelId(): string;
    /**
     * return the current level id<br>
     * @name getCurrentLevelId
     * @memberOf me.level
     * @public
     * @function
     * @return {String}
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
     * @return {me.TMXTileMap}
     */
    function getCurrentLevel(): any;
    /**
     * return the current level definition.
     * for a reference to the live instantiated level,
     * rather use the container in which it was loaded (e.g. me.game.world)
     * @name getCurrentLevel
     * @memberOf me.level
     * @public
     * @function
     * @return {me.TMXTileMap}
     */
    function getCurrentLevel(): any;
    /**
     * reload the current level
     * @name reload
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     */
    function reload(options?: {
        container?: any;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * reload the current level
     * @name reload
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     */
    function reload(options?: {
        container?: any;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * load the next level
     * @name next
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     */
    function next(options?: {
        container?: any;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * load the next level
     * @name next
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     */
    function next(options?: {
        container?: any;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * load the previous level<br>
     * @name previous
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     */
    function previous(options?: {
        container?: any;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * load the previous level<br>
     * @name previous
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     */
    function previous(options?: {
        container?: any;
        onLoaded?: Function;
        flatten?: boolean;
    }): boolean;
    /**
     * return the amount of level preloaded
     * @name levelCount
     * @memberOf me.level
     * @public
     * @function
     */
    function levelCount(): number;
    /**
     * return the amount of level preloaded
     * @name levelCount
     * @memberOf me.level
     * @public
     * @function
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
     * @param {String} type  "*", "audio", binary", "image", "json", "js", "tmx", "tsx"
     * @param {String} [url="./"] default base URL
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
     * @param {String} type  "*", "audio", binary", "image", "json", "js", "tmx", "tsx"
     * @param {String} [url="./"] default base URL
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
     * @param {Object[]} resources
     * @param {String} resources.name internal name of the resource
     * @param {String} resources.type  "audio", binary", "image", "json","js", "tmx", "tsx", "fontface"
     * @param {String} resources.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {Boolean} [resources.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {function} [onload=me.loader.onload] function to be called when all resources are loaded
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
    function preload(res: any, onload?: Function, switchToLoadState?: boolean): void;
    /**
     * set all the specified game resources to be preloaded.
     * @name preload
     * @memberOf me.loader
     * @public
     * @function
     * @param {Object[]} resources
     * @param {String} resources.name internal name of the resource
     * @param {String} resources.type  "audio", binary", "image", "json","js", "tmx", "tsx", "fontface"
     * @param {String} resources.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {Boolean} [resources.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {function} [onload=me.loader.onload] function to be called when all resources are loaded
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
    function preload(res: any, onload?: Function, switchToLoadState?: boolean): void;
    /**
     * Load a single resource (to be used if you need to load additional resource during the game)
     * @name load
     * @memberOf me.loader
     * @public
     * @function
     * @param {Object} resource
     * @param {String} resource.name internal name of the resource
     * @param {String} resource.type  "audio", binary", "image", "json", "tmx", "tsx"
     * @param {String} resource.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {Boolean} [resource.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {Function} onload function to be called when the resource is loaded
     * @param {Function} onerror function to be called in case of error
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
    function load(res: any, onload: Function, onerror: Function): number;
    /**
     * Load a single resource (to be used if you need to load additional resource during the game)
     * @name load
     * @memberOf me.loader
     * @public
     * @function
     * @param {Object} resource
     * @param {String} resource.name internal name of the resource
     * @param {String} resource.type  "audio", binary", "image", "json", "tmx", "tsx"
     * @param {String} resource.src  path and/or file name of the resource (for audio assets only the path is required)
     * @param {Boolean} [resource.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
     * @param {Function} onload function to be called when the resource is loaded
     * @param {Function} onerror function to be called in case of error
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
    function load(res: any, onload: Function, onerror: Function): number;
    /**
     * unload specified resource to free memory
     * @name unload
     * @memberOf me.loader
     * @public
     * @function
     * @param {Object} resource
     * @return {Boolean} true if unloaded
     * @example me.loader.unload({name: "avatar",  type:"image",  src: "data/avatar.png"});
     */
    function unload(res: any): boolean;
    /**
     * unload specified resource to free memory
     * @name unload
     * @memberOf me.loader
     * @public
     * @function
     * @param {Object} resource
     * @return {Boolean} true if unloaded
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
     * @param {String} tmx name of the tmx/tsx element ("map1");
     * @return {XML|Object} requested element or null if not found
     */
    function getTMX(elt: any): any;
    /**
     * return the specified TMX/TSX object
     * @name getTMX
     * @memberOf me.loader
     * @public
     * @function
     * @param {String} tmx name of the tmx/tsx element ("map1");
     * @return {XML|Object} requested element or null if not found
     */
    function getTMX(elt: any): any;
    /**
     * return the specified Binary object
     * @name getBinary
     * @memberOf me.loader
     * @public
     * @function
     * @param {String} name of the binary object ("ymTrack");
     * @return {Object} requested element or null if not found
     */
    function getBinary(elt: any): any;
    /**
     * return the specified Binary object
     * @name getBinary
     * @memberOf me.loader
     * @public
     * @function
     * @param {String} name of the binary object ("ymTrack");
     * @return {Object} requested element or null if not found
     */
    function getBinary(elt: any): any;
    /**
     * return the specified Image Object
     * @name getImage
     * @memberOf me.loader
     * @public
     * @function
     * @param {String} image name of the Image element ("tileset-platformer");
     * @return {HTMLImageElement} requested element or null if not found
     */
    function getImage(image: string): HTMLImageElement;
    /**
     * return the specified Image Object
     * @name getImage
     * @memberOf me.loader
     * @public
     * @function
     * @param {String} image name of the Image element ("tileset-platformer");
     * @return {HTMLImageElement} requested element or null if not found
     */
    function getImage(image: string): HTMLImageElement;
    /**
     * return the specified JSON Object
     * @name getJSON
     * @memberOf me.loader
     * @public
     * @function
     * @param {String} Name for the json file to load
     * @return {Object}
     */
    function getJSON(elt: any): any;
    /**
     * return the specified JSON Object
     * @name getJSON
     * @memberOf me.loader
     * @public
     * @function
     * @param {String} Name for the json file to load
     * @return {Object}
     */
    function getJSON(elt: any): any;
}
export namespace plugin {
    export { BasePlugin as Base };
    export function patch(proto: any, name: string, fn: Function): void;
    export function register(pluginObj: any, name: string, ...args: any[]): void;
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
     * See examples in {@link me.pool#pull}
     * @name register
     * @memberOf me.pool
     * @public
     * @function
     * @param {String} className as defined in the Name field of the Object Properties (in Tiled)
     * @param {Object} class corresponding Class to be instantiated
     * @param {Boolean} [recycling=false] enables object recycling for the specified class
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
     * See examples in {@link me.pool#pull}
     * @name register
     * @memberOf me.pool
     * @public
     * @function
     * @param {String} className as defined in the Name field of the Object Properties (in Tiled)
     * @param {Object} class corresponding Class to be instantiated
     * @param {Boolean} [recycling=false] enables object recycling for the specified class
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
     * @name pull
     * @memberOf me.pool
     * @public
     * @function
     * @param {String} className as used in {@link me.pool.register}
     * @param {} [arguments...] arguments to be passed when instantiating/reinitializing the object
     * @return {Object} the instance of the requested object
     * @example
     * me.pool.register("player", PlayerEntity);
     * var player = me.pool.pull("player");
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
    function pull(name: any, ...args: any[]): any;
    /**
     * Pull a new instance of the requested object (if added into the object pool)
     * @name pull
     * @memberOf me.pool
     * @public
     * @function
     * @param {String} className as used in {@link me.pool.register}
     * @param {} [arguments...] arguments to be passed when instantiating/reinitializing the object
     * @return {Object} the instance of the requested object
     * @example
     * me.pool.register("player", PlayerEntity);
     * var player = me.pool.pull("player");
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
    function pull(name: any, ...args: any[]): any;
    /**
     * purge the object pool from any inactive object <br>
     * Object pooling must be enabled for this function to work<br>
     * note: this will trigger the garbage collector
     * @name purge
     * @memberOf me.pool
     * @public
     * @function
     */
    function purge(): void;
    /**
     * purge the object pool from any inactive object <br>
     * Object pooling must be enabled for this function to work<br>
     * note: this will trigger the garbage collector
     * @name purge
     * @memberOf me.pool
     * @public
     * @function
     */
    function purge(): void;
    /**
     * Push back an object instance into the object pool <br>
     * Object pooling for the object class must be enabled,
     * and object must have been instantiated using {@link me.pool#pull},
     * otherwise this function won't work
     * @name push
     * @memberOf me.pool
     * @public
     * @function
     * @param {Object} instance to be recycled
     */
    function push(obj: any): void;
    /**
     * Push back an object instance into the object pool <br>
     * Object pooling for the object class must be enabled,
     * and object must have been instantiated using {@link me.pool#pull},
     * otherwise this function won't work
     * @name push
     * @memberOf me.pool
     * @public
     * @function
     * @param {Object} instance to be recycled
     */
    function push(obj: any): void;
    /**
     * Check if an object with the provided name is registered
     * @name exists
     * @memberOf me.pool
     * @public
     * @function
     * @param {String} name of the registered object class
     * @return {Boolean} true if the classname is registered
     */
    function exists(name: string): boolean;
    /**
     * Check if an object with the provided name is registered
     * @name exists
     * @memberOf me.pool
     * @public
     * @function
     * @param {String} name of the registered object class
     * @return {Boolean} true if the classname is registered
     */
    function exists(name: string): boolean;
    /**
     * Check if an object with the provided name is poolable
     * (was properly registered with the recycling feature enable)
     * @name poolable
     * @memberOf me.pool
     * @public
     * @see me.pool.register
     * @function
     * @param {String} name of the registered object class
     * @return {Boolean} true if the classname is poolable
     * @example
     * if (!me.pool.poolable("CherryEntity")) {
     *     // object was not properly registered
     * }
     */
    function poolable(name: string): boolean;
    /**
     * Check if an object with the provided name is poolable
     * (was properly registered with the recycling feature enable)
     * @name poolable
     * @memberOf me.pool
     * @public
     * @see me.pool.register
     * @function
     * @param {String} name of the registered object class
     * @return {Boolean} true if the classname is poolable
     * @example
     * if (!me.pool.poolable("CherryEntity")) {
     *     // object was not properly registered
     * }
     */
    function poolable(name: string): boolean;
    /**
     * returns the amount of object instance currently in the pool
     * @name getInstanceCount
     * @memberOf me.pool
     * @public
     * @function
     * @return {Number} amount of object instance
     */
    function getInstanceCount(name: any): number;
    /**
     * returns the amount of object instance currently in the pool
     * @name getInstanceCount
     * @memberOf me.pool
     * @public
     * @function
     * @return {Number} amount of object instance
     */
    function getInstanceCount(name: any): number;
}
export namespace save {
    /**
     * Add new keys to localStorage and set them to the given default values if they do not exist
     * @name add
     * @memberOf me.save
     * @function
     * @param {Object} props key and corresponding values
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
     * @param {Object} props key and corresponding values
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
     * @param {String} key key to be removed
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
     * @param {String} key key to be removed
     * @example
     * // Remove the "score" key from localStorage
     * me.save.remove("score");
     */
    function remove(key: string): void;
}
/**
 * disable melonJS auto-initialization
 * @type {Boolean}
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
    export const onPause: any;
    export const onResume: any;
    export const onStop: any;
    export const onRestart: any;
    /**
     * Stop the current screen object.
     * @name stop
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} pauseTrack pause current track on screen stop.
     */
    export function stop(music: any): void;
    /**
     * Stop the current screen object.
     * @name stop
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} pauseTrack pause current track on screen stop.
     */
    export function stop(music: any): void;
    /**
     * pause the current screen object
     * @name pause
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} pauseTrack pause current track on screen pause
     */
    export function pause(music: any): void;
    /**
     * pause the current screen object
     * @name pause
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} pauseTrack pause current track on screen pause
     */
    export function pause(music: any): void;
    /**
     * Restart the screen object from a full stop.
     * @name restart
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} resumeTrack resume current track on screen resume
     */
    export function restart(music: any): void;
    /**
     * Restart the screen object from a full stop.
     * @name restart
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} resumeTrack resume current track on screen resume
     */
    export function restart(music: any): void;
    /**
     * resume the screen object
     * @name resume
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} resumeTrack resume current track on screen resume
     */
    export function resume(music: any): void;
    /**
     * resume the screen object
     * @name resume
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} resumeTrack resume current track on screen resume
     */
    export function resume(music: any): void;
    /**
     * return the running state of the state manager
     * @name isRunning
     * @memberOf me.state
     * @public
     * @function
     * @return {Boolean} true if a "process is running"
     */
    export function isRunning(): boolean;
    /**
     * return the running state of the state manager
     * @name isRunning
     * @memberOf me.state
     * @public
     * @function
     * @return {Boolean} true if a "process is running"
     */
    export function isRunning(): boolean;
    /**
     * Return the pause state of the state manager
     * @name isPaused
     * @memberOf me.state
     * @public
     * @function
     * @return {Boolean} true if the game is paused
     */
    export function isPaused(): boolean;
    /**
     * Return the pause state of the state manager
     * @name isPaused
     * @memberOf me.state
     * @public
     * @function
     * @return {Boolean} true if the game is paused
     */
    export function isPaused(): boolean;
    /**
     * associate the specified state with a Stage
     * @name set
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {me.Stage} stage Instantiated Stage to associate with state ID
     * @param {Boolean} [start = false] if true the state will be changed immediately after adding it.
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
    export function set(state: number, stage: any, start?: boolean): void;
    /**
     * associate the specified state with a Stage
     * @name set
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {me.Stage} stage Instantiated Stage to associate with state ID
     * @param {Boolean} [start = false] if true the state will be changed immediately after adding it.
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
    export function set(state: number, stage: any, start?: boolean): void;
    /**
     * return a reference to the current screen object<br>
     * useful to call a object specific method
     * @name current
     * @memberOf me.state
     * @public
     * @function
     * @return {me.Stage}
     */
    export function current(): any;
    /**
     * return a reference to the current screen object<br>
     * useful to call a object specific method
     * @name current
     * @memberOf me.state
     * @public
     * @function
     * @return {me.Stage}
     */
    export function current(): any;
    /**
     * specify a global transition effect
     * @name transition
     * @memberOf me.state
     * @public
     * @function
     * @param {String} effect (only "fade" is supported for now)
     * @param {me.Color|String} color a CSS color value
     * @param {Number} [duration=1000] expressed in milliseconds
     */
    export function transition(effect: string, color: any, duration?: number): void;
    /**
     * specify a global transition effect
     * @name transition
     * @memberOf me.state
     * @public
     * @function
     * @param {String} effect (only "fade" is supported for now)
     * @param {me.Color|String} color a CSS color value
     * @param {Number} [duration=1000] expressed in milliseconds
     */
    export function transition(effect: string, color: any, duration?: number): void;
    /**
     * enable/disable transition for a specific state (by default enabled for all)
     * @name setTransition
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {Boolean} enable
     */
    export function setTransition(state: number, enable: boolean): void;
    /**
     * enable/disable transition for a specific state (by default enabled for all)
     * @name setTransition
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {Boolean} enable
     */
    export function setTransition(state: number, enable: boolean): void;
    /**
     * change the game/app state
     * @name change
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {Boolean} forceChange if true the state will be changed immediately
     * @param {} [arguments...] extra arguments to be passed to the reset functions
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
     * @param {Number} state State ID (see constants)
     * @param {Boolean} forceChange if true the state will be changed immediately
     * @param {} [arguments...] extra arguments to be passed to the reset functions
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
     * @param {Number} state State ID (see constants)
     */
    export function isCurrent(state: number): boolean;
    /**
     * return true if the specified state is the current one
     * @name isCurrent
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
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
     * @param {Number} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
     * @param {Boolean} [pauseable=true] respects the pause state of the engine.
     * @param {...*} [param] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @return {Number} The numerical ID of the timer, which can be used later with me.timer.clearTimeout().
     * @function
     * @example
     * // set a timer to call "myFunction" after 1000ms
     * me.timer.setTimeout(myFunction, 1000);
     * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
     */
    function setTimeout(fn: Function, delay: number, pauseable?: boolean, ...args: any[]): number;
    /**
     * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
     * @name setTimeout
     * @memberOf me.timer
     * @param {Function} fn the function you want to execute after delay milliseconds.
     * @param {Number} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
     * @param {Boolean} [pauseable=true] respects the pause state of the engine.
     * @param {...*} [param] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @return {Number} The numerical ID of the timer, which can be used later with me.timer.clearTimeout().
     * @function
     * @example
     * // set a timer to call "myFunction" after 1000ms
     * me.timer.setTimeout(myFunction, 1000);
     * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
     */
    function setTimeout(fn: Function, delay: number, pauseable?: boolean, ...args: any[]): number;
    /**
     * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
     * @name setInterval
     * @memberOf me.timer
     * @param {Function} fn the function to execute
     * @param {Number} delay the number of milliseconds (thousandths of a second) on how often to execute the function
     * @param {Boolean} [pauseable=true] respects the pause state of the engine.
     * @param {...*} [param] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @return {Number} The numerical ID of the timer, which can be used later with me.timer.clearInterval().
     * @function
     * @example
     * // set a timer to call "myFunction" every 1000ms
     * me.timer.setInterval(myFunction, 1000);
     * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setInterval(myFunction, 1000, true, param1, param2);
     */
    function setInterval(fn: Function, delay: number, pauseable?: boolean, ...args: any[]): number;
    /**
     * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
     * @name setInterval
     * @memberOf me.timer
     * @param {Function} fn the function to execute
     * @param {Number} delay the number of milliseconds (thousandths of a second) on how often to execute the function
     * @param {Boolean} [pauseable=true] respects the pause state of the engine.
     * @param {...*} [param] optional parameters which are passed through to the function specified by fn once the timer expires.
     * @return {Number} The numerical ID of the timer, which can be used later with me.timer.clearInterval().
     * @function
     * @example
     * // set a timer to call "myFunction" every 1000ms
     * me.timer.setInterval(myFunction, 1000);
     * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setInterval(myFunction, 1000, true, param1, param2);
     */
    function setInterval(fn: Function, delay: number, pauseable?: boolean, ...args: any[]): number;
    /**
     * Clears the delay set by me.timer.setTimeout().
     * @name clearTimeout
     * @memberOf me.timer
     * @function
     * @param {Number} timeoutID ID of the timeout to be cleared
     */
    function clearTimeout(timeoutID: number): void;
    /**
     * Clears the delay set by me.timer.setTimeout().
     * @name clearTimeout
     * @memberOf me.timer
     * @function
     * @param {Number} timeoutID ID of the timeout to be cleared
     */
    function clearTimeout(timeoutID: number): void;
    /**
     * Clears the Interval set by me.timer.setInterval().
     * @name clearInterval
     * @memberOf me.timer
     * @function
     * @param {Number} intervalID ID of the interval to be cleared
     */
    function clearInterval(intervalID: number): void;
    /**
     * Clears the Interval set by me.timer.setInterval().
     * @name clearInterval
     * @memberOf me.timer
     * @function
     * @param {Number} intervalID ID of the interval to be cleared
     */
    function clearInterval(intervalID: number): void;
    /**
     * Return the current timestamp in milliseconds <br>
     * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
     * @name getTime
     * @memberOf me.timer
     * @return {Number}
     * @function
     */
    function getTime(): number;
    /**
     * Return the current timestamp in milliseconds <br>
     * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
     * @name getTime
     * @memberOf me.timer
     * @return {Number}
     * @function
     */
    function getTime(): number;
    /**
     * Return elapsed time in milliseconds since the last update
     * @name getDelta
     * @memberOf me.timer
     * @return {Number}
     * @function
     */
    function getDelta(): number;
    /**
     * Return elapsed time in milliseconds since the last update
     * @name getDelta
     * @memberOf me.timer
     * @return {Number}
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
declare namespace utils$1 {
    export { agentUtils as agent };
    export { arrayUtils as array };
    export { fileUtils as file };
    export { stringUtils as string };
    export { fnUtils as function };
    export function getPixels(arg: any): ImageData;
    export function checkVersion(first: string, second?: string): number;
    export function getUriFragment(url: any): {};
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
    scaleRatio: any;
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
 * @param {String} eventType The event type for which the object is registering <br>
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
declare function registerPointerEvent(eventType: string, region: any | any | any | any, callback: Function): void;
/**
 * allows the removal of event listeners from the object target.
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @name releasePointerEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {String} eventType The event type for which the object was registered. See {@link me.input.registerPointerEvent}
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region the registered region to release for this event
 * @param {Function} [callback="all"] if specified unregister the event only for the specific callback
 * @example
 * // release the registered region on the 'pointerdown' event
 * me.input.releasePointerEvent('pointerdown', this);
 */
declare function releasePointerEvent(eventType: string, region: any | any | any | any, callback?: Function): void;
/**
 * returns true if the given value is a power of two
 * @public
 * @function
 * @memberOf me.Math
 * @name isPowerOfTwo
 * @param {Number} val
 * @return {boolean}
 */
declare function isPowerOfTwo(val: number): boolean;
/**
 * returns the next power of two for the given value
 * @public
 * @function
 * @memberOf me.Math
 * @name nextPowerOfTwo
 * @param {Number} val
 * @return {boolean}
 */
declare function nextPowerOfTwo(val: number): boolean;
/**
 * Converts an angle in degrees to an angle in radians
 * @public
 * @function
 * @memberOf me.Math
 * @name degToRad
 * @param {number} angle angle in degrees
 * @return {number} corresponding angle in radians
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
 * @return {number} corresponding angle in degrees
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
 * @return {number} clamped value
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
 * @return {number} random value
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
 * @return {number} random value
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
 * @return {number} random value
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
 * @return {number} rounded value
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
 * @return {boolean} if close to
 * @example
 * // test if the given value is close to 10
 * if (me.Math.toBeCloseTo(10, value)) {
 *     // do something
 * }
 */
declare function toBeCloseTo(expected: number, actual: number, precision?: number): boolean;
/**
 * Particle Container Object.
 * @class
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
declare class Texture {
    constructor(atlases: any, src: any, cache: any);
    /**
     * to identify the atlas format (e.g. texture packer)
     * @ignore
     */
    format: string;
    /**
     * the texture source(s) itself
     * @type Map
     * @ignore
     */
    sources: Map<any, any>;
    /**
     * the atlas dictionnaries
     * @type Map
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
     * @param {String} [name] atlas name in case of multipack textures
     * @return {Object}
     */
    getAtlas(key: any): any;
    /**
     * return the format of the atlas dictionnary
     * @name getFormat
     * @memberOf me.Renderer.Texture
     * @function
     * @return {String} will return "texturepacker", or "ShoeBox", or "melonJS", or "Spritesheet (fixed cell size)"
     */
    getFormat(): string;
    /**
     * return the source texture for the given region (or default one if none specified)
     * @name getTexture
     * @memberOf me.Renderer.Texture
     * @function
     * @param {Object} [region] region name in case of multipack textures
     * @return {HTMLImageElement|HTMLCanvasElement}
     */
    getTexture(region?: any): HTMLImageElement | HTMLCanvasElement;
    /**
     * return a normalized region (or frame) information for the specified sprite name
     * @name getRegion
     * @memberOf me.Renderer.Texture
     * @function
     * @param {String} name name of the sprite
     * @param {String} [atlas] name of a specific atlas where to search for the region
     * @return {Object}
     */
    getRegion(name: string, atlas?: string): any;
    /**
     * return the uvs mapping for the given region
     * @name getUVs
     * @memberOf me.Renderer.Texture
     * @function
     * @param {Object} region region (or frame) name
     * @return {Float32Array} region Uvs
     */
    getUVs(name: any): Float32Array;
    /**
     * Create a sprite object using the first region found using the specified name
     * @name createSpriteFromName
     * @memberOf me.Renderer.Texture
     * @function
     * @param {String} name name of the sprite
     * @param {Object} [settings] Additional settings passed to the {@link me.Sprite} contructor
     * @return {me.Sprite}
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
     */
    createSpriteFromName(name: string, settings?: any): any;
    /**
     * Create an animation object using the first region found using all specified names
     * @name createAnimationFromName
     * @memberOf me.Renderer.Texture
     * @function
     * @param {String[]|Number[]} names list of names for each sprite
     * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
     * @param {Object} [settings] Additional settings passed to the {@link me.Sprite} contructor
     * @return {me.Sprite}
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
    createAnimationFromName(names: string[] | number[], settings?: any): any;
}
/**
 * @classdesc
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 * @class Bounds
 * @memberOf me
 * @constructor
 * @memberOf me
 * @param {me.Vector2d[]} [vertices] an array of me.Vector2d points
 * @return {me.Bounds} A new bounds object
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
     * @param {Number} minX
     * @param {Number} minY
     * @param {Number} maxX
     * @param {Number} maxY
     */
    setMinMax(minX: number, minY: number, maxX: number, maxY: number): void;
    public set x(arg: number);
    /**
     * x position of the bound
     * @public
     * @type {Number}
     * @name x
     * @memberOf me.Bounds
     */
    public get x(): number;
    public set y(arg: number);
    /**
     * y position of the bounds
     * @public
     * @type {Number}
     * @name y
     * @memberOf me.Bounds
     */
    public get y(): number;
    public set width(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Bounds
     */
    public get width(): number;
    public set height(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Bounds
     */
    public get height(): number;
    /**
     * left coordinate of the bound
     * @public
     * @type {Number}
     * @name left
     * @memberOf me.Bounds
     */
    public get left(): number;
    /**
     * right coordinate of the bound
     * @public
     * @type {Number}
     * @name right
     * @memberOf me.Bounds
     */
    public get right(): number;
    /**
     * top coordinate of the bound
     * @public
     * @type {Number}
     * @name top
     * @memberOf me.Bounds
     */
    public get top(): number;
    /**
     * bottom coordinate of the bound
     * @public
     * @type {Number}
     * @name bottom
     * @memberOf me.Bounds
     */
    public get bottom(): number;
    /**
     * center position of the bound on the x axis
     * @public
     * @type {Number}
     * @name centerX
     * @memberOf me.Bounds
     */
    public get centerX(): number;
    /**
     * center position of the bound on the y axis
     * @public
     * @type {Number}
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
    public get center(): any;
    /**
     * Updates bounds using the given vertices
     * @name update
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     */
    update(vertices: any[]): void;
    /**
     * add the given vertices to the bounds definition.
     * @name add
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    add(vertices: any[], clear?: boolean): void;
    /**
     * add the given bounds to the bounds definition.
     * @name addBounds
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds} bounds
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    addBounds(bounds: any, clear?: boolean): void;
    /**
     * add the given point to the bounds definition.
     * @name addPoint
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} vector
     * @param {me.Matrix2d} [matrix] an optional transform to apply to the given point
     */
    addPoint(v: any, m: any): void;
    /**
     * add the given quad coordinates to this bound definition, multiplied by the given matrix
     * @name addFrame
     * @memberOf me.Bounds
     * @function
     * @param {Number} x0 - left X coordinates of the quad
     * @param {Number} y0 - top Y coordinates of the quad
     * @param {Number} x1 - right X coordinates of the quad
     * @param {Number} y1 - bottom y coordinates of the quad
     * @param {me.Matrix2d} [matrix] an optional transform to apply to the given frame coordinates
     */
    addFrame(x0: number, y0: number, x1: number, y1: number, m: any): void;
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} point
     * @return {boolean} True if the bounds contain the point, otherwise false
     */
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {Number} x
     * @param {Number} y
     * @return {boolean} True if the bounds contain the point, otherwise false
     */
    contains(...args: any[]): boolean;
    /**
     * Returns true if the two bounds intersect.
     * @name overlaps
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds|me.Rect} bounds
     * @return {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds: any | any): boolean;
    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @name isFinite
     * @memberOf me.Bounds
     * @function
     * @return {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
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
     * @param {Number} x
     * @param {Number} y
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
     * @param {Number} x
     * @param {Number} y
     */
    shift(...args: any[]): void;
    /**
     * clone this bounds
     * @name clone
     * @memberOf me.Bounds
     * @function
     * @return {me.Bounds}
     */
    clone(): any;
    /**
     * Returns a polygon whose edges are the same as this bounds.
     * @name toPolygon
     * @memberOf me.Bounds
     * @function
     * @return {me.Polygon} a new Polygon that represents this bounds.
     */
    toPolygon(): any;
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
 * @param {String} [format="mp3"] audio format to prioritize
 * @returns {Boolean} Indicates whether audio initialization was successful
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
 * @param {String} format audio format : "mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac"
 * @returns {Boolean} return true if the given audio format is supported
 */
declare function hasFormat(codec: any): boolean;
/**
 * check if audio (HTML5 or WebAudio) is supported
 * @function me.audio.hasAudio
 * @returns {Boolean} return true if audio (HTML5 or WebAudio) is supported
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
 * @param {String} sound_name audio clip name - case sensitive
 * @param {Boolean} [loop=false] loop audio
 * @param {Function} [onend] Function to call when sound instance ends playing.
 * @param {Number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
 * @return {Number} the sound instance ID.
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
 * @param {String} sound_name audio clip name - case sensitive
 * @param {Number} from Volume to fade from (0.0 to 1.0).
 * @param {Number} to Volume to fade to (0.0 to 1.0).
 * @param {Number} duration Time in milliseconds to fade.
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will fade.
 */
declare function fade(sound_name: string, from: number, to: number, duration: number, id?: number): void;
/**
 * get/set the position of playback for a sound.
 * @function me.audio.seek
 * @param {String} sound_name audio clip name - case sensitive
 * @param {Number} [seek]  The position to move current playback to (in seconds).
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will changed.
 * @return return the current seek position (if no extra parameters were given)
 * @example
 * // return the current position of the background music
 * var current_pos = me.audio.seek("dst-gameforest");
 * // set back the position of the background music to the beginning
 * me.audio.seek("dst-gameforest", 0);
 */
declare function seek(sound_name: string, seek?: number, id?: number, ...args: any[]): any;
/**
 * get or set the rate of playback for a sound.
 * @function me.audio.rate
 * @param {String} sound_name audio clip name - case sensitive
 * @param {Number} [rate] playback rate : 0.5 to 4.0, with 1.0 being normal speed.
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will be changed.
 * @return return the current playback rate (if no extra parameters were given)
 * @example
 * // get the playback rate of the background music
 * var rate = me.audio.rate("dst-gameforest");
 * // speed up the playback of the background music
 * me.audio.rate("dst-gameforest", 2.0);
 */
declare function rate(sound_name: string, rate?: number, id?: number, ...args: any[]): any;
/**
 * stop the specified sound on all channels
 * @function me.audio.stop
 * @param {String} [sound_name] audio clip name (case sensitive). If none is passed, all sounds are stopped.
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will stop.
 * @example
 * me.audio.stop("cling");
 */
declare function stop(sound_name?: string, id?: number): void;
/**
 * pause the specified sound on all channels<br>
 * this function does not reset the currentTime property
 * @function me.audio.pause
 * @param {String} sound_name audio clip name - case sensitive
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will pause.
 * @example
 * me.audio.pause("cling");
 */
declare function pause(sound_name: string, id?: number): void;
/**
 * resume the specified sound on all channels<br>
 * @function me.audio.resume
 * @param {String} sound_name audio clip name - case sensitive
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will resume.
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
 * @param {String} sound_name audio track name - case sensitive
 * @param {Number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
 * @return {Number} the sound instance ID.
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
 * @return {String} audio track name
 */
declare function getCurrentTrack(): string;
/**
 * set the default global volume
 * @function me.audio.setVolume
 * @param {Number} volume Float specifying volume (0.0 - 1.0 values accepted).
 */
declare function setVolume(volume: number): void;
/**
 * get the default global volume
 * @function me.audio.getVolume
 * @returns {Number} current volume value in Float [0.0 - 1.0] .
 */
declare function getVolume(): number;
/**
 * mute or unmute the specified sound, but does not pause the playback.
 * @function me.audio.mute
 * @param {String} sound_name audio clip name - case sensitive
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will mute.
 * @param {Boolean} [mute=true] True to mute and false to unmute
 * @example
 * // mute the background music
 * me.audio.mute("awesome_music");
 */
declare function mute(sound_name: string, id?: number, mute?: boolean): void;
/**
 * unmute the specified sound
 * @function me.audio.unmute
 * @param {String} sound_name audio clip name
 * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will unmute.
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
 * @return {Boolean} true if audio is muted globally
 */
declare function muted(): boolean;
/**
 * unload specified audio track to free memory
 * @function me.audio.unload
 * @param {String} sound_name audio track name - case sensitive
 * @return {Boolean} true if unloaded
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
 * @param {String} deprecated deprecated class,function or property name
 * @param {String} replacement the replacement class, function, or property name
 * @param {String} version the version since when the lass,function or property is deprecated
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
 * Publish some data on a channel
 * @function me.event.publish
 * @param {String} channel The channel to publish on
 * @param {Array} arguments The data to publish
 * @example
 * // Publish stuff on '/some/channel'.
 * // Anything subscribed will be called with a function
 * // signature like: function (a,b,c){ ... }
 * me.event.publish("/some/channel", ["a","b","c"]);
 */
declare function publish(channel: string, data: any): void;
/**
 * Register a callback on a named channel.
 * @function me.event.subscribe
 * @param {String} channel The channel to subscribe to
 * @param {Function} callback The event handler, any time something is
 * published on a subscribed channel, the callback will be called
 * with the published array as ordered arguments
 * @return {handle} A handle which can be used to unsubscribe this
 * particular subscription
 * @example
 * me.event.subscribe("/some/channel", function (a, b, c){ doSomething(); });
 */
declare function subscribe(channel: string, callback: Function): any;
/**
 * Disconnect a subscribed function for a channel.
 * @function me.event.unsubscribe
 * @param {Array|String} handle The return value from a subscribe call or the
 * name of a channel as a String
 * @param {Function} [callback] The callback to be unsubscribed.
 * @example
 * var handle = me.event.subscribe("/some/channel", function (){});
 * me.event.unsubscribe(handle);
 *
 * // Or alternatively ...
 *
 * var callback = function (){};
 * me.event.subscribe("/some/channel", callback);
 * me.event.unsubscribe("/some/channel", callback);
 */
declare function unsubscribe(handle: any[] | string, callback?: Function): void;
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
 * @see me.game.world.fps
 */
declare function updateFrameRate(): void;
/**
 * Returns the parent container of the specified Child in the game world
 * @function me.game.getParentContainer
 * @param {me.Renderable} child
 * @return {me.Container}
 */
declare function getParentContainer(child: any): any;
/**
 * force the redraw (not update) of all objects
 * @function me.game.repaint
 */
declare function repaint(): void;
/**
 * update all objects of the game manager
 * @ignore
 * @function me.game.update
 * @param {Number} time current timestamp as provided by the RAF callback
 * @param {me.Stage} stage the current stage
 */
declare function update$1(time: number, stage: any): void;
/**
 * draw the current scene/stage
 * @function me.game.draw
 * @ignore
 * @param {me.Stage} stage the current stage
 */
declare function draw(stage: any): void;
/**
 * Translate the specified x and y values from the global (absolute)
 * coordinate to local (viewport) relative coordinate.
 * @name globalToLocal
 * @memberOf me.input
 * @public
 * @function
 * @param {Number} x the global x coordinate to be translated.
 * @param {Number} y the global y coordinate to be translated.
 * @param {Number} [v] an optional vector object where to set the
 * @return {me.Vector2d} A vector object with the corresponding translated coordinates.
 * @example
 * onMouseEvent : function (pointer) {
 *    // convert the given into local (viewport) relative coordinates
 *    var pos = me.input.globalToLocal(pointer.clientX, pointer.clientY);
 *    // do something with pos !
 * };
 */
declare function globalToLocal(x: number, y: number, v?: number): any;
/**
 * enable/disable all gestures on the given element.<br>
 * by default melonJS will disable browser handling of all panning and zooming gestures.
 * @name setTouchAction
 * @memberOf me.input
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
 * @public
 * @function
 * @param {HTMLCanvasElement} element
 * @param {String} [value="none"]
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
 * @param {Number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
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
 * @param {Number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
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
declare function releaseAllPointerEvents(region: any | any | any | any): void;
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
 * @param {String} action user defined corresponding action
 * @return {Boolean} true if pressed
 * @example
 * if (me.input.isKeyPressed('left'))
 * {
 *    //do something
 * }
 * else if (me.input.isKeyPressed('right'))
 * {
 *    //do something else...
 * }
 *
 */
declare function isKeyPressed(action: string): boolean;
/**
 * return the key status of the specified action
 * @name keyStatus
 * @memberOf me.input
 * @public
 * @function
 * @param {String} action user defined corresponding action
 * @return {Boolean} down (true) or up(false)
 */
declare function keyStatus(action: string): boolean;
/**
 * trigger the specified key (simulated) event <br>
 * @name triggerKeyEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {Boolean} [status=false] true to trigger a key down event, or false for key up event
 * @example
 * // trigger a key press
 * me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
 */
declare function triggerKeyEvent(keycode: any, status?: boolean, mouseButton: any): void;
/**
 * associate a user defined action to a keycode
 * @name bindKey
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {String} action user defined corresponding action
 * @param {Boolean} [lock=false] cancel the keypress event once read
 * @param {Boolean} [preventDefault=me.input.preventDefault] prevent default browser action
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.LEFT,  "left");
 * me.input.bindKey(me.input.KEY.RIGHT, "right");
 * me.input.bindKey(me.input.KEY.X,     "jump", true);
 * me.input.bindKey(me.input.KEY.F1,    "options", true, true);
 */
declare function bindKey(keycode: any, action: string, lock?: boolean, preventDefault$1?: boolean): void;
/**
 * return the action associated with the given keycode
 * @name getBindingKey
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @return {String} user defined associated action
 */
declare function getBindingKey(keycode: any): string;
/**
 * unlock a key manually
 * @name unlockKey
 * @memberOf me.input
 * @public
 * @function
 * @param {String} action user defined corresponding action
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
declare function unbindKey(keycode: any): void;
/**
 * Associate a gamepad event to a keycode
 * @name bindGamepad
 * @memberOf me.input
 * @public
 * @function
 * @param {Number} index Gamepad index
 * @param {Object} button Button/Axis definition
 * @param {String} button.type "buttons" or "axes"
 * @param {me.input.GAMEPAD.BUTTONS|me.input.GAMEPAD.AXES} button.code button or axis code id
 * @param {Number} [button.threshold=1] value indicating when the axis should trigger the keycode (e.g. -0.5 or 0.5)
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
    code: any | any;
    threshold?: number;
}, keyCode: any): void;
/**
 * unbind the defined keycode
 * @name unbindGamepad
 * @memberOf me.input
 * @public
 * @function
 * @param {Number} index Gamepad index
 * @param {me.input.GAMEPAD.BUTTONS} button
 * @example
 * me.input.unbindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1);
 */
declare function unbindGamepad(index: number, button: any): void;
/**
 * Set deadzone for analog gamepad inputs<br>
 * The default deadzone is 0.1 (10%) Analog values less than this will be ignored
 * @name setGamepadDeadzone
 * @memberOf me.input
 * @public
 * @function
 * @param {Number} value Deadzone value
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
     * @type String
     * @default "10.0.0"
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
 * @param {Number} width The width of the canvas viewport
 * @param {Number} height The height of the canvas viewport
 * @param {Object} [options] The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
 * @param {String|HTMLElement} [options.parent=document.body] the DOM parent element to hold the canvas in the HTML file
 * @param {Number} [options.renderer=me.video.AUTO] renderer to use (me.video.CANVAS, me.video.WEBGL, me.video.AUTO)
 * @param {Boolean} [options.doubleBuffering=false] enable/disable double buffering
 * @param {Number|String} [options.scale=1.0] enable scaling of the canvas ('auto' for automatic scaling)
 * @param {String} [options.scaleMethod="fit"] screen scaling modes ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch')
 * @param {Boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
 * @param {String} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @param {Boolean} [options.transparent=false] whether to allow transparent pixels in the front buffer (screen).
 * @param {Boolean} [options.antiAlias=false] whether to enable or not video scaling interpolation
 * @param {Boolean} [options.consoleHeader=true] whether to display melonJS version and basic device information in the console
 * @return {Boolean} false if initialization failed (canvas not supported)
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
declare function init(game_width: any, game_height: any, options?: {
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
 * @param {Number} width width
 * @param {Number} height height
 * @param {Boolean} [offscreen=false] will returns an OffscreenCanvas if supported
 * @return {HTMLCanvasElement|OffscreenCanvas}
 */
declare function createCanvas(width: number, height: number, offscreen?: boolean): HTMLCanvasElement | any;
/**
 * return a reference to the parent DOM element holding the main canvas
 * @function me.video.getParent
 * @return {HTMLElement}
 */
declare function getParent(): HTMLElement;
/**
 * scale the "displayed" canvas by the given scalar.
 * this will modify the size of canvas element directly.
 * Only use this if you are not using the automatic scaling feature.
 * @function me.video.scale
 * @see me.video.init
 * @param {Number} x x scaling multiplier
 * @param {Number} y y scaling multiplier
 */
declare function scale(x: number, y: number): void;
/**
 * Get a vendor-prefixed property
 * @public
 * @name prefixed
 * @function
 * @param {String} name Property name
 * @param {Object} [obj=window] Object or element reference to access
 * @return {Mixed} Value of property
 * @memberOf me.utils.agent
 */
declare function prefixed(name: string, obj?: any): any;
/**
 * Set a vendor-prefixed property
 * @public
 * @name setPrefixed
 * @function
 * @param {String} name Property name
 * @param {Mixed} value Property value
 * @param {Object} [obj=window] Object or element reference to access
 * @return true if one of the vendor-prefixed property was found
 * @memberOf me.utils.agent
 */
declare function setPrefixed(name: string, value: any, obj?: any): void;
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
 * @param {Object} object to be removed
 * @return {Array} the modified Array
 * var arr = [ "foo", "bar", "baz" ];
 * // remove "foo" from the array
 * me.utils.array.remove(arr, "foo");
 */
declare function remove(arr: any[], obj: any): any[];
/**
 * return a random array element
 * @public
 * @function
 * @memberOf me.utils.array
 * @name random
 * @param {Array} arr array to pick a element
 * @return {any} random member of array
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
 * @return {any} random member of array
 */
declare function weightedRandom(arr: any[]): any;
/**
 * return the base name of the file without path info
 * @public
 * @function
 * @memberOf me.utils.file
 * @name getBasename
 * @param  {String} path path containing the filename
 * @return {String} the base name without path information.
 */
declare function getBasename(path: string): string;
/**
 * return the extension of the file in the given path
 * @public
 * @function
 * @memberOf me.utils.file
 * @name getExtension
 * @param  {String} path path containing the filename
 * @return {String} filename extension.
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
 * @param {String} string the string to be capitalized
 * @return {string} the capitalized string
 */
declare function capitalize(str: any): string;
/**
 * returns the string stripped of whitespace from the left.
 * @public
 * @function
 * @memberOf me.utils.string
 * @name trimLeft
 * @param {String} string the string to be trimmed
 * @return {string} trimmed string
 */
declare function trimLeft(str: any): string;
/**
 * returns the string stripped of whitespace from the right.
 * @public
 * @function
 * @memberOf me.utils.string
 * @name trimRight
 * @param {String} string the string to be trimmed
 * @return {string} trimmed string
 */
declare function trimRight(str: any): string;
/**
 * returns true if the given string contains a numeric integer or float value
 * @public
 * @function
 * @memberOf me.utils.string
 * @name isNumeric
 * @param {String} string the string to be tested
 * @return {Boolean} true if string contains only digits
 */
declare function isNumeric(str: any): boolean;
/**
 * returns true if the given string contains a true or false
 * @public
 * @function
 * @memberOf me.utils.string
 * @name isBoolean
 * @param {String} string the string to be tested
 * @return {Boolean} true if the string is either true or false
 */
declare function isBoolean(str: any): boolean;
/**
 * convert a string to the corresponding hexadecimal value
 * @public
 * @function
 * @memberOf me.utils.string
 * @name toHex
 * @param {String} string the string to be converted
 * @return {String}
 */
declare function toHex$1(str: any): string;
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
 * @param {Function} fn The function to be deferred.
 * @param {Object} scope The execution scope of the deferred function.
 * @param {} [arguments...] Optional additional arguments to carry for the
 * function.
 * @return {Number} id that can be used to clear the deferred function using
 * clearTimeout
 * @example
 * // execute myFunc() when the stack is empty,
 * // with the current context and 'myArgument' as parameter
 * me.utils.function.defer(fn, this, 'myArgument');
 */
declare function defer(fn: Function, scope: any, ...args: any[]): number;
/**
 * returns a function that, when invoked will only be triggered at most
 * once during a given window of time
 * @public
 * @function
 * @memberOf me.utils.function
 * @name throttle
 * @param {Function} fn the function to be throttled.
 * @param {Number} delay The delay in ms
 * @param {no_trailing} no_trailing disable the execution on the trailing edge
 */
declare function throttle(fn: Function, delay: number, no_trailing: any): (...args: any[]) => any;
export { Bounds$1 as Bounds, math as Math, device$1 as device, timer$1 as timer, utils$1 as utils };
