/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 * @import Vector3d from "./../math/vector3.js";
 * @import Matrix2d from "./../math/matrix2.js";
 * @import Entity from "./entity/entity.js";
 * @import Container from "./container.js";
 * @import Line from "./../geometries/line.js";
 * @import Ellipse from "./../geometries/ellipse.js";
 * @import Polygon from "./../geometries/poly.js";
 * @import RoundRect from "./../geometries/roundrect.js";
 * @import Application from "./../application/application.js";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 * @import ResponseObject from "./../physics/response.js";
 **/
/**
 * @classdesc
 * A base class for renderable objects.
 * @augments Rect
 */
export default class Renderable extends Rect {
    /**
     * The anchor point is used for attachment behavior, and/or when applying transformations.<br>
     * The coordinate system places the origin at the top left corner of the frame (0, 0) and (1, 1) means the bottom-right corner<br>
     * <img src="images/anchor_point.png"/><br>
     * a Renderable's anchor point defaults to (0.5,0.5), which corresponds to the center position.<br>
     * <br>
     * <i><b>Note:</b> Object created through Tiled will have their anchorPoint set to (0, 0) to match Tiled Level editor implementation.
     * To specify a value through Tiled, use a json expression like `json:{"x":0.5,"y":0.5}`. </i>
     * @type {ObservableVector2d}
     * @default <0.5,0.5>
     */
    anchorPoint: ObservableVector2d;
    /**
     * the renderable default transformation matrix
     * @type {Matrix2d}
     */
    currentTransform: Matrix2d;
    /**
     * the renderable physic body
     * @type {Body}
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
     *          this.isKinematic = false;
     *
     *          // set the display to follow our position on both axis
     *          me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);
     *      }
     *
     *      ...
     *
     * }
     */
    body: Body;
    /**
    * (G)ame (U)nique (Id)entifier" <br>
    * a GUID will be allocated for any renderable object added <br>
    * to an object container (including the `me.game.world` container)
    * @type {string}
    */
    GUID: string;
    /**
     * an event handler that is called when the renderable leave or enter a camera viewport
     * @type {Function}
     * @default undefined
     * @example
     * this.onVisibilityChange = function(inViewport) {
     *     if (inViewport === true) {
     *         console.log("object has entered the in a camera viewport!");
     *     }
     * };
     */
    onVisibilityChange: Function;
    /**
     * Whether the renderable object will always update, even when outside of the viewport<br>
     * @type {boolean}
     * @default false
     */
    alwaysUpdate: boolean;
    /**
     * Whether to update this object when the game is paused.
     * @type {boolean}
     * @default false
     */
    updateWhenPaused: boolean;
    /**
     * make the renderable object persistent over level changes<br>
     * @type {boolean}
     * @default false
     */
    isPersistent: boolean;
    /**
     * If true, this renderable will be rendered using screen coordinates,
     * as opposed to world coordinates. Use this, for example, to define UI elements.
     * @type {boolean}
     * @default false
     */
    floating: boolean;
    /**
     * When enabled, an object container will automatically apply
     * any defined transformation before calling the child draw method.
     * @type {boolean}
     * @default true
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
    autoTransform: boolean;
    /**
     * Define the renderable opacity<br>
     * Set to zero if you do not wish an object to be drawn
     * @see Renderable#setOpacity
     * @see Renderable#getOpacity
     * @type {number}
     * @default 1.0
     */
    alpha: number;
    /**
     * a reference to the parent object that contains this renderable
     * @type {Container|Entity}
     * @default undefined
     */
    ancestor: Container | Entity;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * @type {Rect|RoundRect|Polygon|Line|Ellipse}
     * @default undefined
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
    mask: Rect | RoundRect | Polygon | Line | Ellipse;
    /**
      * (Experimental) an optional shader, to be used instead of the default built-in one, when drawing this renderable (WebGL only)
      * @type {GLShader}
      * @default undefined
    */
    shader: GLShader;
    /**
     * the blend mode to be applied to this renderable (see renderer setBlendMode for available blend mode)
     * @type {string}
     * @default "normal"
     * @see CanvasRenderer#setBlendMode
     * @see WebGLRenderer#setBlendMode
     */
    blendMode: string;
    /**
     * The name of the renderable
     * @type {string}
     * @default ""
     */
    name: string;
    /**
     * to identify the object as a renderable object
     * @ignore
     */
    isRenderable: boolean;
    /**
     * If true then physic collision and input events will not impact this renderable
     * @type {boolean}
     * @default true
     */
    isKinematic: boolean;
    /**
     * when true the renderable will be redrawn during the next update cycle
     * @type {boolean}
     * @default true
     */
    isDirty: boolean;
    _flip: {
        x: boolean;
        y: boolean;
    };
    _inViewport: boolean;
    _parentApp: any;
    _tint: object;
    /**
     * returns the parent application (or game) to which this renderable is attached to
     * @return {Application} the parent application or undefined if not attached to any container/app
     */
    get parentApp(): Application;
    /**
     * Whether the renderable object is floating (i.e. used screen coordinates), or contained in a floating parent container
     * @see Renderable#floating
     * @type {boolean}
     */
    get isFloating(): boolean;
    set tint(value: Color);
    /**
     * define a tint for this renderable. a (255, 255, 255) r, g, b value will remove the tint effect.
     * @type {Color}
     * @default (255, 255, 255)
     * @example
     * // add a red tint to this renderable
     * this.tint.setColor(255, 128, 128);
     * // remove the tint
     * this.tint.setColor(255, 255, 255);
     */
    get tint(): Color;
    set depth(value: number);
    /**
     * the depth of this renderable on the z axis
     * @type {number}
     */
    get depth(): number;
    set inViewport(value: boolean);
    /**
     * Whether the renderable object is visible and within the viewport
     * @type {boolean}
     * @default false
     */
    get inViewport(): boolean;
    /**
     * returns true if this renderable is flipped on the horizontal axis
     * @public
     * @see Renderable#flipX
     * @type {boolean}
     */
    public get isFlippedX(): boolean;
    /**
     * returns true if this renderable is flipped on the vertical axis
     * @public
     * @see Renderable#flipY
     * @type {boolean}
     */
    public get isFlippedY(): boolean;
    /**
     * get the renderable alpha channel value<br>
     * @returns {number} current opacity value between 0 and 1
     */
    getOpacity(): number;
    /**
     * set the renderable alpha channel value<br>
     * @param {number} alpha - opacity value between 0.0 and 1.0
     */
    setOpacity(alpha: number): void;
    /**
     * flip the renderable on the horizontal axis (around the center of the renderable)
     * @see Matrix2d#scaleX
     * @param {boolean} [flip=true] - `true` to flip this renderable.
     * @returns {Renderable} Reference to this object for method chaining
     */
    flipX(flip?: boolean | undefined): Renderable;
    /**
     * flip the renderable on the vertical axis (around the center of the renderable)
     * @see Matrix2d#scaleY
     * @param {boolean} [flip=true] - `true` to flip this renderable.
     * @returns {Renderable} Reference to this object for method chaining
     */
    flipY(flip?: boolean | undefined): Renderable;
    /**
     * multiply the renderable currentTransform with the given matrix
     * @see Renderable#currentTransform
     * @param {Matrix2d} m - the transformation matrix
     * @returns {Renderable} Reference to this object for method chaining
     */
    transform(m: Matrix2d): Renderable;
    /**
     * return the angle to the specified target
     * @param {Renderable|Vector2d|Vector3d} target
     * @returns {number} angle in radians
     */
    angleTo(target: Renderable | Vector2d | Vector3d): number;
    /**
     * return the distance to the specified target
     * @param {Renderable|Vector2d|Vector3d} target
     * @returns {number} distance
     */
    distanceTo(target: Renderable | Vector2d | Vector3d): number;
    /**
     * Rotate this renderable towards the given target.
     * @param {Renderable|Vector2d|Vector3d} target - the renderable or position to look at
     * @returns {Renderable} Reference to this object for method chaining
     */
    lookAt(target: Renderable | Vector2d | Vector3d): Renderable;
    /**
     * Rotate this renderable by the specified angle (in radians).
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {Renderable} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d | undefined): Renderable;
    /**
     * scale the renderable around his anchor point.  Scaling actually applies changes
     * to the currentTransform member wich is used by the renderer to scale the object
     * when rendering.  It does not scale the object itself.  For example if the renderable
     * is an image, the image.width and image.height properties are unaltered but the currentTransform
     * member will be changed.
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @returns {Renderable} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Renderable;
    /**
     * scale the renderable around his anchor point
     * @param {Vector2d} v - scaling vector
     * @returns {Renderable} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Renderable;
    /**
     * update function (automatically called by melonJS).
     * @param {number} dt - time since the last update in milliseconds.
     * @returns {boolean} true if the renderable is dirty
     */
    update(dt: number): boolean;
    /**
     * update the bounding box for this shape.
     * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    updateBounds(absolute?: boolean | undefined): Bounds;
    /**
     * update the renderable's bounding rect (private)
     * @ignore
     */
    updateBoundsPos(newX?: number | undefined, newY?: number | undefined): void;
    /**
      * return the renderable absolute position in the game world
      * @returns {Vector2d}
      */
    getAbsolutePosition(): Vector2d;
    _absPos: object | undefined;
    /**
     * called when the anchor point value is changed
     * @private
     * @param {number} x - the new X value to be set for the anchor
     * @param {number} y - the new Y value to be set for the anchor
     */
    private onAnchorUpdate;
    /**
     * Prepare the rendering context before drawing (automatically called by melonJS).
     * This will apply any defined transforms, anchor point, tint or blend mode and translate the context accordingly to this renderable position.
     * @see Renderable#draw
     * @see Renderable#postDraw
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer object
     */
    preDraw(renderer: CanvasRenderer | WebGLRenderer): void;
    /**
     * Draw this renderable (automatically called by melonJS).
     * All draw operations for renderable are made respectively
     * to the position or transforms set or applied by the preDraw method.
     * The main draw loop will first call preDraw() to prepare the context for drawing the renderable,
     * then draw() to draw the renderable, and finally postDraw() to clear the context.
     * If you override this method, be mindful about the drawing logic; for example if you draw a shape
     * from the draw method, you should make sure that your draw it at the 0, 0 coordinates.
     * @see Renderable#preDraw
     * @see Renderable#postDraw
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    draw(renderer: CanvasRenderer | WebGLRenderer, viewport?: any): void;
    /**
     * restore the rendering context after drawing (automatically called by melonJS).
     * @see Renderable#preDraw
     * @see Renderable#draw
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer object
     */
    postDraw(renderer: CanvasRenderer | WebGLRenderer): void;
    /**
     * onCollision callback, triggered in case of collision,
     * when this renderable body is colliding with another one
     * @param {ResponseObject} response - the collision response object
     * @param {Renderable} other - the other renderable touching this one (a reference to response.a or response.b)
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
    onCollision(response: ResponseObject, other: Renderable): boolean;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(...args: any[]): void;
    /**
     * OnDestroy Notification function<br>
     * Called by engine before deleting the object
     */
    onDestroyEvent(): void;
}
import Rect from "./../geometries/rectangle.js";
import ObservableVector2d from "./../math/observable_vector2.js";
import type Matrix2d from "./../math/matrix2.js";
import Body from "./../physics/body.js";
import type Container from "./container.js";
import type Entity from "./entity/entity.js";
import type RoundRect from "./../geometries/roundrect.js";
import type Polygon from "./../geometries/poly.js";
import type Line from "./../geometries/line.js";
import type Ellipse from "./../geometries/ellipse.js";
import GLShader from "./../video/webgl/glshader.js";
import type Application from "./../application/application.js";
import Color from "./../math/color.js";
import type Vector2d from "./../math/vector2.js";
import type Vector3d from "./../math/vector3.js";
import Bounds from "./../physics/bounds.js";
import type CanvasRenderer from "./../video/canvas/canvas_renderer.js";
import type WebGLRenderer from "./../video/webgl/webgl_renderer.js";
import type ResponseObject from "./../physics/response.js";
