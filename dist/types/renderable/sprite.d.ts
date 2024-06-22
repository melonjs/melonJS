/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 */
/**
 * @classdesc
 * An object to display a fixed or animated sprite on screen.
 * @augments Renderable
 */
export default class Sprite extends Renderable {
    /**
     * @param {number} x - the x coordinates of the sprite object
     * @param {number} y - the y coordinates of the sprite object
     * @param {object} settings - Configuration parameters for the Sprite object
     * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|TextureAtlas|string} settings.image - reference to spritesheet image, a texture atlas, a video element, or to a texture atlas
     * @param {string} [settings.name=""] - name of this object
     * @param {string} [settings.region] - region name of a specific region to use when using a texture atlas, see {@link TextureAtlas}
     * @param {number} [settings.framewidth] - Width of a single frame within the spritesheet
     * @param {number} [settings.frameheight] - Height of a single frame within the spritesheet
     * @param {string|Color} [settings.tint] - a tint to be applied to this sprite
     * @param {number} [settings.flipX] - flip the sprite on the horizontal axis
     * @param {number} [settings.flipY] - flip the sprite on the vertical axis
     * @param {Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] - Anchor point to draw the frame at (defaults to the center of the frame).
     * @example
     * // create a single sprite from a standalone image, with anchor in the center
     * let sprite = new me.Sprite(0, 0, {
     *     image : "PlayerTexture",
     *     framewidth : 64,
     *     frameheight : 64,
     *     anchorPoint : new me.Vector2d(0.5, 0.5)
     * });
     *
     * // create a single sprite from a packed texture
     * mytexture = new me.TextureAtlas(
     *     me.loader.getJSON("texture"),
     *     me.loader.getImage("texture")
     * );
     * let sprite = new me.Sprite(0, 0, {
     *     image : mytexture,
     *     region : "npc2.png",
     * });
     *
     * // create a video sprite
     * let videoSprite = new me.Sprite(0, 0, {
     *     image : me.loader.getVideo("bigbunny"),
     *     anchorPoint : new me.Vector2d(0.5, 0.5)
     * });
     * // scale the video sprite
     * videoSprite.currentTransform.scale(2);
     * // start playing the video (if video is preloaded with `autoplay` set to false)
     * videoSprite.play();
     */
    constructor(x: number, y: number, settings: {
        image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | TextureAtlas | string;
        name?: string | undefined;
        region?: string | undefined;
        framewidth?: number | undefined;
        frameheight?: number | undefined;
        tint?: string | Color | undefined;
        flipX?: number | undefined;
        flipY?: number | undefined;
        anchorPoint?: Vector2d | undefined;
    });
    /**
     * @type {boolean}
     * @default false
     */
    animationpause: boolean;
    /**
     * animation cycling speed (delay between frame in ms)
     * @type {number}
     * @default 100
     */
    animationspeed: number;
    /**
     * global offset for the position to draw from on the source image.
     * @type {Vector2d}
     * @default <0.0,0.0>
     */
    offset: Vector2d;
    /**
     * true if this is a video sprite (e.g. a HTMLVideoElement was passed as as source)
     * @type {boolean}
     * @default false
     */
    isVideo: boolean;
    /**
     * a callback fired when the end of a video or current animation was reached
     * @type {Function}
     * @default undefined
     */
    onended: Function;
    /**
     * The source texture object this sprite object is using
     * @type {TextureAtlas}
     */
    source: TextureAtlas;
    anim: {};
    resetAnim: Function | (() => Sprite) | undefined;
    current: {
        name: undefined;
        length: number;
        offset: object;
        width: number;
        height: number;
        angle: number;
        idx: number;
    };
    dt: number;
    _flicker: {
        isFlickering: boolean;
        duration: number;
        callback: null;
        state: boolean;
    };
    image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;
    textureAtlas: any;
    width: any;
    height: any;
    _onBlurFn: (() => void) | undefined;
    atlasIndices: any;
    /**
     * return the flickering state of the object
     * @returns {boolean}
     */
    isFlickering(): boolean;
    /**
     * play or resume the current animation or video
     */
    play(): void;
    /**
     * play or resume the current animation or video
     */
    pause(): void;
    /**
     * make the object flicker
     * @param {number} duration - expressed in milliseconds
     * @param {Function} callback - Function to call when flickering ends
     * @returns {Sprite} Reference to this object for method chaining
     * @example
     * // make the object flicker for 1 second
     * // and then remove it
     * this.flicker(1000, function () {
     *     world.removeChild(this);
     * });
     */
    flicker(duration: number, callback: Function): Sprite;
    /**
     * add an animation <br>
     * For fixed-sized cell sprite sheet, the index list must follow the
     * logic as per the following example :<br>
     * <img src="images/spritesheet_grid.png"/>
     * @param {string} name - animation id
     * @param {number[]|string[]|object[]} index - list of sprite index or name defining the animation. Can also use objects to specify delay for each frame, see below
     * @param {number} [animationspeed] - cycling speed for animation in ms
     * @returns {number} frame amount of frame added to the animation (delay between each frame).
     * @see Sprite#animationspeed
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
    addAnimation(name: string, index: number[] | string[] | object[], animationspeed?: number | undefined): number;
    /**
     * set the current animation
     * this will always change the animation & set the frame to zero
     * @param {string} name - animation id
     * @param {string|Function} [resetAnim] - animation id to switch to when complete, or callback
     * @param {boolean} [preserve_dt=false] - if false will reset the elapsed time counter since last frame
     * @returns {Sprite} Reference to this object for method chaining
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
     * this.setCurrentAnimation("die", () => {
     *    world.removeChild(this);
     *    return false; // do not reset to first frame
     * });
     *
     * // set "attack" animation, and pause for a short duration
     * this.setCurrentAnimation("die", () => {
     *    this.animationpause = true;
     *
     *    // back to "standing" animation after 1 second
     *    setTimeout(function () {
     *        this.setCurrentAnimation("standing");
     *    }, 1000);
     *
     *    return false; // do not reset to first frame
     * });
     */
    setCurrentAnimation(name: string, resetAnim?: string | Function | undefined, preserve_dt?: boolean | undefined): Sprite;
    /**
     * reverse the given or current animation if none is specified
     * @param {string} [name] - animation id
     * @returns {Sprite} Reference to this object for method chaining
     * @see Sprite#animationspeed
     */
    reverseAnimation(name?: string | undefined): Sprite;
    /**
     * return true if the specified animation is the current one.
     * @param {string} name - animation id
     * @returns {boolean}
     * @example
     * if (!this.isCurrentAnimation("walk")) {
     *     // do something funny...
     * }
     */
    isCurrentAnimation(name: string): boolean;
    /**
     * change the current texture atlas region for this sprite
     * @see Texture.getRegion
     * @param {object} region - typically returned through me.Texture.getRegion()
     * @returns {Sprite} Reference to this object for method chaining
     * @example
     * // change the sprite to "shadedDark13.png";
     * mySprite.setRegion(mytexture.getRegion("shadedDark13.png"));
     */
    setRegion(region: object): Sprite;
    /**
     * force the current animation frame index.
     * @param {number} [index=0] - animation frame index
     * @returns {Sprite} Reference to this object for method chaining
     * @example
     * // reset the current animation to the first frame
     * this.setAnimationFrame();
     */
    setAnimationFrame(index?: number | undefined): Sprite;
    /**
     * return the current animation frame index.
     * @returns {number} current animation frame index
     */
    getCurrentAnimationFrame(): number;
    /**
     * Returns the frame object by the index.
     * @ignore
     * @param {number} id - the frame id
     * @returns {number} if using number indices. Returns {object} containing frame data if using texture atlas
     */
    getAnimationFrameObjectByIndex(id: number): number;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(): void;
}
import Renderable from "./renderable.js";
import type Vector2d from "./../math/vector2.js";
import { TextureAtlas } from "./../video/texture/atlas.js";
import Color from "../math/color.js";
