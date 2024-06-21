/**
 * @classdesc
 * a 2D orthographic camera
 * @augments Renderable
 */
export default class Camera2d extends Renderable {
    /**
     * Axis definition
     * @enum {number}
     * @property {number} NONE no axis
     * @property {number} HORIZONTAL horizontal axis only
     * @property {number} VERTICAL vertical axis only
     * @property {number} BOTH both axis
     * @readonly
     * @name AXIS
     * @memberof Camera2d
     */
    readonly AXIS: {
        NONE: number;
        HORIZONTAL: number;
        VERTICAL: number;
        BOTH: number;
    };
    /**
     * Camera bounds
     * @public
     * @type {Bounds}
     * @name bounds
     * @memberof Camera2d
     */
    public bounds: Bounds;
    /**
     * enable or disable damping
     * @private
     * @default true
     */
    private smoothFollow;
    /**
     * Camera damping for smooth transition [0 .. 1].
     * 1 being the maximum value and will snap the camera to the target position
     * @public
     * @type {number}
     * @name damping
     * @default 1.0
     * @memberof Camera2d
     */
    public damping: number;
    /**
     * the closest point relative to the camera
     * @public
     * @type {number}
     * @name near
     * @default -1000
     * @memberof Camera2d
     */
    public near: number;
    /**
     * the furthest point relative to the camera.
     * @public
     * @type {number}
     * @name far
     * @default 1000
     * @memberof Camera2d
     */
    public far: number;
    /**
     * the default camera projection matrix
     * (2d cameras use an orthographic projection by default).
     * @public
     * @type {Matrix3d}
     * @name projectionMatrix
     * @memberof Camera2d
     */
    public projectionMatrix: Matrix3d;
    /**
     * the invert camera transform used to unproject points
     * @ignore
     * @type {Matrix2d}
     * @name invCurrentTransform
     * @memberof Camera2d
     */
    invCurrentTransform: Matrix2d;
    offset: Vector2d;
    target: Vector2d | null;
    follow_axis: number;
    _shake: {
        intensity: number;
        duration: number;
        axis: number;
        onComplete: null;
    };
    _fadeOut: {
        color: null;
        tween: null;
    };
    _fadeIn: {
        color: null;
        tween: null;
    };
    /** @ignore */
    _updateProjectionMatrix(): void;
    /** @ignore */
    _followH(target: any): number | undefined;
    /** @ignore */
    _followV(target: any): number | undefined;
    /**
     * reset the camera position to specified coordinates
     * @name reset
     * @memberof Camera2d
     * @param {number} [x=0] - initial position of the camera on the x axis
     * @param {number} [y=0] - initial position of the camera on the y axis
     */
    reset(x?: number | undefined, y?: number | undefined): void;
    /**
     * change the deadzone settings.
     * the "deadzone" defines an area within the current camera in which
     * the followed renderable can move without scrolling the camera.
     * @name setDeadzone
     * @see Camera2d.follow
     * @memberof Camera2d
     * @param {number} w - deadzone width
     * @param {number} h - deadzone height
     */
    setDeadzone(w: number, h: number): void;
    deadzone: Rect | undefined;
    /**
     * resize the camera
     * @name resize
     * @memberof Camera2d
     * @param {number} w - new width of the camera
     * @param {number} h - new height of the camera
     * @returns {Camera2d} this camera
     */
    resize(w: number, h: number): Camera2d;
    /**
     * set the camera boundaries (set to the world limit by default).
     * the camera is bound to the given coordinates and cannot move/be scrolled outside of it.
     * @name setBounds
     * @memberof Camera2d
     * @param {number} x - world left limit
     * @param {number} y - world top limit
     * @param {number} w - world width limit
     * @param {number} h - world height limit
     */
    setBounds(x: number, y: number, w: number, h: number): void;
    /**
     * set the camera to follow the specified renderable. <br>
     * (this will put the camera center around the given target)
     * @name follow
     * @memberof Camera2d
     * @param {Renderable|Vector2d} target - renderable or position vector to follow
     * @param {number} [axis=me.game.viewport.AXIS.BOTH] - Which axis to follow (see {@link Camera2d.AXIS})
     * @param {number} [damping=1] - default damping value
     * @example
     * // set the camera to follow this renderable on both axis, and enable damping
     * me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH, 0.1);
     */
    follow(target: Renderable | Vector2d, axis?: number | undefined, damping?: number | undefined): void;
    /**
     * unfollow the current target
     * @name unfollow
     * @memberof Camera2d
     */
    unfollow(): void;
    /**
     * move the camera upper-left position by the specified offset.
     * @name move
     * @memberof Camera2d
     * @see Camera2d.focusOn
     * @param {number} x - horizontal offset
     * @param {number} y - vertical offset
     * @example
     * // Move the camera up by four pixels
     * me.game.viewport.move(0, -4);
     */
    move(x: number, y: number): void;
    /**
     * move the camera upper-left position to the specified coordinates
     * @name moveTo
     * @memberof Camera2d
     * @see Camera2d.focusOn
     * @param {number} x
     * @param {number} y
     */
    moveTo(x: number, y: number): void;
    /** @ignore */
    updateTarget(): void;
    /** @ignore */
    update(dt: any): boolean;
    /**
     * shake the camera
     * @name shake
     * @memberof Camera2d
     * @param {number} intensity - maximum offset that the screen can be moved
     * while shaking
     * @param {number} duration - expressed in milliseconds
     * @param {number} [axis=me.game.viewport.AXIS.BOTH] - specify on which axis to apply the shake effect (see {@link Camera2d.AXIS})
     * @param {Function} [onComplete] - callback once shaking effect is over
     * @param {boolean} [force] - if true this will override the current effect
     * @example
     * // shake it baby !
     * me.game.viewport.shake(10, 500, me.game.viewport.AXIS.BOTH);
     */
    shake(intensity: number, duration: number, axis?: number | undefined, onComplete?: Function | undefined, force?: boolean | undefined): void;
    /**
     * fadeOut(flash) effect<p>
     * screen is filled with the specified color and slowly goes back to normal
     * @name fadeOut
     * @memberof Camera2d
     * @param {Color|string} color - a CSS color value
     * @param {number} [duration=1000] - expressed in milliseconds
     * @param {Function} [onComplete] - callback once effect is over
     * @example
     * // fade the camera to white upon dying, reload the level, and then fade out back
     * me.game.viewport.fadeIn("#fff", 150, function() {
     *     me.audio.play("die", false);
     *     me.level.reload();
     *     me.game.viewport.fadeOut("#fff", 150);
     * });
     */
    fadeOut(color: Color | string, duration?: number | undefined, onComplete?: Function | undefined): void;
    /**
     * fadeIn effect <p>
     * fade to the specified color
     * @name fadeIn
     * @memberof Camera2d
     * @param {Color|string} color - a CSS color value
     * @param {number} [duration=1000] - expressed in milliseconds
     * @param {Function} [onComplete] - callback once effect is over
     * @example
     * // flash the camera to white for 75ms
     * me.game.viewport.fadeIn("#FFFFFF", 75);
     */
    fadeIn(color: Color | string, duration?: number | undefined, onComplete?: Function | undefined): void;
    /**
     * set the camera position around the specified object
     * @name focusOn
     * @memberof Camera2d
     * @param {Renderable|Entity|Sprite|NineSliceSprite} target - the renderable to focus the camera on
     */
    focusOn(target: Renderable | Entity | Sprite | NineSliceSprite): void;
    /**
     * check if the specified renderable is in the camera
     * @name isVisible
     * @memberof Camera2d
     * @param {Renderable|Entity|Sprite|NineSliceSprite} obj - to be checked against
     * @param {boolean} [floating = obj.floating] - if visibility check should be done against screen coordinates
     * @returns {boolean} true if within the viewport
     */
    isVisible(obj: Renderable | Entity | Sprite | NineSliceSprite, floating?: boolean | undefined): boolean;
    /**
     * convert the given "local" (screen) coordinates into world coordinates
     * @name localToWorld
     * @memberof Camera2d
     * @param {number} x - the x coordinate of the local point to be converted
     * @param {number} y - the y coordinate of the local point to be converted
     * @param {number} [v] - an optional vector object where to set the converted value
     * @returns {Vector2d}
     */
    localToWorld(x: number, y: number, v?: number | undefined): Vector2d;
    /**
     * convert the given world coordinates into "local" (screen) coordinates
     * @name worldToLocal
     * @memberof Camera2d
     * @param {number} x
     * @param {number} y
     * @param {number} [v] - an optional vector object where to set the converted value
     * @returns {Vector2d} a vector with the converted local coordinates
     */
    worldToLocal(x: number, y: number, v?: number | undefined): Vector2d;
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
import Renderable from "./../renderable/renderable.js";
import type Bounds from "./../physics/bounds.js";
import Matrix3d from "./../math/matrix3.js";
import Matrix2d from "./../math/matrix2.js";
import Vector2d from "./../math/vector2.js";
import Rect from "./../geometries/rectangle.js";
import type Color from "./../math/color.js";
import type Entity from "./../renderable/entity/entity.js";
import type Sprite from "./../renderable/sprite.js";
import type NineSliceSprite from "./../renderable/nineslicesprite.js";
