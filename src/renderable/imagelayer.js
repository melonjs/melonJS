import { renderer } from "./../video/video.js";
import * as event from "./../system/event.js";
import pool from "./../system/pooling.js";
import { game } from "../index.js";
import Sprite from "./sprite.js";
import * as stringUtil from "./../utils/string.js";

/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 */

/**
 * @classdesc
 * a generic Image Layer Object
 * @augments Sprite
 */
export default class ImageLayer extends Sprite {
    /**
     * @param {number} x - x coordinate
     * @param {number} y - y coordinate
     * @param {object} settings - ImageLayer properties
     * @param {HTMLImageElement|HTMLCanvasElement|string} settings.image - Image reference. See {@link loader.getImage}
     * @param {string} [settings.name="me.ImageLayer"] - layer name
     * @param {number} [settings.z=0] - z-index position
     * @param {number|Vector2d} [settings.ratio=1.0] - Scrolling ratio to be applied. See {@link ImageLayer#ratio}
     * @param {"repeat"|"repeat-x"|"repeat-y"|"no-repeat"} [settings.repeat="repeat"] - define if and how an Image Layer should be repeated. See {@link ImageLayer#repeat}
     * @param {number|Vector2d} [settings.anchorPoint=<0.0,0.0>] - Define how the image is anchored to the viewport bound. By default, its upper-left corner is anchored to the viewport bounds upper left corner.
     * @example
     * // create a repetitive background pattern on the X axis using the citycloud image asset
     * me.game.world.addChild(new me.ImageLayer(0, 0, {
     *     image:"citycloud",
     *     repeat :"repeat-x"
     * }), 1);
     */
    constructor(x, y, settings) {
        // call the constructor
        super(x, y, settings);

        // render in screen coordinates
        this.floating = true;

        // image drawing offset
        this.offset.set(x, y);

        /**
         * Define the image scrolling ratio<br>
         * Scrolling speed is defined by multiplying the viewport delta position by the specified ratio.
         * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
         * To specify a value through Tiled, use one of the following format : <br>
         * - a number, to change the value for both axis <br>
         * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
         * @type {Vector2d}
         * @default <1.0,1.0>
         */
        this.ratio = pool.pull("Vector2d", 1.0, 1.0);

        if (typeof(settings.ratio) !== "undefined") {
            // little hack for backward compatiblity
            if (stringUtil.isNumeric(settings.ratio)) {
                this.ratio.set(settings.ratio, +settings.ratio);
            } else /* vector */ {
                this.ratio.setV(settings.ratio);
            }
        }

        if (typeof(settings.anchorPoint) === "undefined") {
            this.anchorPoint.set(0, 0);
        }
        else {
            if (typeof(settings.anchorPoint) === "number") {
                this.anchorPoint.set(settings.anchorPoint, settings.anchorPoint);
            }
            else /* vector */ {
                this.anchorPoint.setV(settings.anchorPoint);
            }
        }

        this.repeat = settings.repeat || "repeat";

        // on context lost, all previous textures are destroyed
        event.on(event.ONCONTEXT_RESTORED, this.createPattern, this);
    }

    /**
     * Define if and how an Image Layer should be repeated.<br>
     * By default, an Image Layer is repeated both vertically and horizontally.<br>
     * Acceptable values : <br>
     * - 'repeat' - The background image will be repeated both vertically and horizontally <br>
     * - 'repeat-x' - The background image will be repeated only horizontally.<br>
     * - 'repeat-y' - The background image will be repeated only vertically.<br>
     * - 'no-repeat' - The background-image will not be repeated.<br>
     * @type {string}
     * @default 'repeat'
     */
    get repeat() {
        return this._repeat;
    }

    set repeat(value) {
        this._repeat = value;
        switch (this._repeat) {
            case "no-repeat" :
                this.repeatX = false;
                this.repeatY = false;
                break;
            case "repeat-x" :
                this.repeatX = true;
                this.repeatY = false;
                break;
            case "repeat-y" :
                this.repeatX = false;
                this.repeatY = true;
                break;
            default : // "repeat"
                this.repeatX = true;
                this.repeatY = true;
                break;
        }
        this.resize(game.viewport.width, game.viewport.height);
        this.createPattern();
    }


    // called when the layer is added to the game world or a container
    onActivateEvent() {
        // register to the viewport change notification
        event.on(event.VIEWPORT_ONCHANGE, this.updateLayer, this);
        event.on(event.VIEWPORT_ONRESIZE, this.resize, this);
        // force a first refresh when the level is loaded
        event.on(event.LEVEL_LOADED, this.updateLayer, this);
        // in case the level is not added to the root container,
        // the onActivateEvent call happens after the LEVEL_LOADED event
        // so we need to force a first update
        if (this.ancestor.root !== true) {
            this.updateLayer();
        }
    }

    /**
     * resize the Image Layer to match the given size
     * @param {number} w - new width
     * @param {number} h - new height
     */
    resize(w, h) {
        return super.resize(
            this.repeatX ? Infinity : w,
            this.repeatY ? Infinity : h
        );
    }

    /**
     * createPattern function
     * @ignore
     */
    createPattern() {
        this._pattern = renderer.createPattern(this.image, this._repeat);
    }

    /**
     * updateLayer function
     * @ignore
     */
    updateLayer() {
        const rx = this.ratio.x,
            ry = this.ratio.y;

        const viewport = game.viewport;

        if (rx === 0 && ry === 0) {
            // static image
            return;
        }

        const width = this.width,
            height = this.height,
            bw = viewport.bounds.width,
            bh = viewport.bounds.height,
            ax = this.anchorPoint.x,
            ay = this.anchorPoint.y,

            /*
             * Automatic positioning
             *
             * See https://github.com/melonjs/melonJS/issues/741#issuecomment-138431532
             * for a thorough description of how this works.
             */
            x = ax * (rx - 1) * (bw - viewport.width) + this.offset.x - rx * viewport.pos.x,
            y = ay * (ry - 1) * (bh - viewport.height) + this.offset.y - ry * viewport.pos.y;


        // Repeat horizontally; start drawing from left boundary
        if (this.repeatX) {
            this.pos.x = x % width;
        }
        else {
            this.pos.x = x;
        }

        // Repeat vertically; start drawing from top boundary
        if (this.repeatY) {
            this.pos.y = y % height;
        }
        else {
            this.pos.y = y;
        }

        this.isDirty = true;
    }

    /**
    * override the default predraw function
    * as repeat and anchor are managed directly in the draw method
    * @ignore
    */
    preDraw(renderer) {
        // save the context
        renderer.save();

        // apply the defined alpha value
        renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

        // apply the defined tint, if any
        renderer.setTint(this.tint);

        // apply blending if different from "normal"
        if (this.blendMode !== renderer.getBlendMode()) {
            renderer.setBlendMode(this.blendMode);
        }
    }

    /**
     * draw this ImageLayer (automatically called by melonJS)
     * @protected
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    draw(renderer, viewport) {
        const width = this.width,
            height = this.height,
            bw = viewport.bounds.width,
            bh = viewport.bounds.height,
            ax = this.anchorPoint.x,
            ay = this.anchorPoint.y;

        let x = this.pos.x,
            y = this.pos.y;

        if (this.ratio.x === 0 && this.ratio.y === 0) {
            // static image
            x = x + ax * (bw - width);
            y = y + ay * (bh - height);
        }

        renderer.translate(x, y);
        renderer.drawPattern(
            this._pattern,
            0,
            0,
            viewport.width * 2,
            viewport.height * 2
        );
    }

    // called when the layer is removed from the game world or a container
    onDeactivateEvent() {
        // cancel all event subscriptions
        event.off(event.VIEWPORT_ONCHANGE, this.updateLayer);
        event.off(event.VIEWPORT_ONRESIZE, this.resize);
        event.off(event.LEVEL_LOADED, this.updateLayer);
    }

    /**
     * Destroy function
     * @ignore
     */
    destroy() {
        pool.push(this.ratio);
        this.ratio = undefined;
        event.off(event.ONCONTEXT_RESTORED, this.createPattern);
        super.destroy();
    }

}
