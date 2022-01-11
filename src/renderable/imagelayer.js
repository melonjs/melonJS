import { renderer } from "./../video/video.js";
import * as event from "./../system/event.js";
import pool from "./../system/pooling.js";
import { viewport } from "./../game.js";
import Sprite from "./sprite.js";
import * as stringUtil from "./../utils/string.js";


/**
 * @classdesc
 * a generic Image Layer Object
 * @class ImageLayer
 * @augments me.Renderable
 * @memberof me
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

class ImageLayer extends Sprite {

    /**
     * @ignore
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
         * @public
         * @type {me.Vector2d}
         * @default <1.0,1.0>
         * @name me.ImageLayer#ratio
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
            /**
             * Define how the image is anchored to the viewport bounds<br>
             * By default, its upper-left corner is anchored to the viewport bounds upper left corner.<br>
             * The anchorPoint is a unit vector where each component falls in range [0.0,1.0].<br>
             * Some common examples:<br>
             * - &lt;0.0,0.0&gt; : (Default) Anchor image to the upper-left corner of viewport bounds
             * - &lt;0.5,0.5&gt; : Center the image within viewport bounds
             * - &lt;1.0,1.0&gt; : Anchor image to the lower-right corner of viewport bounds
             * To specify a value through Tiled, use one of the following format : <br>
             * - a number, to change the value for both axis <br>
             * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
             * @public
             * @type {me.Vector2d}
             * @default <0.0,0.0>
             * @name me.ImageLayer#anchorPoint
             */
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
        event.on(event.WEBGL_ONCONTEXT_RESTORED, this.createPattern, this);
    }

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
        this.resize(viewport.width, viewport.height);
        this.createPattern();
    }


    // called when the layer is added to the game world or a container
    onActivateEvent() {
        // register to the viewport change notification
        event.on(event.VIEWPORT_ONCHANGE, this.updateLayer, this);
        event.on(event.VIEWPORT_ONRESIZE, this.resize, this);
        // force a first refresh when the level is loaded
        event.once(event.LEVEL_LOADED, () => {
            this.updateLayer(viewport.pos);
        });
        // in case the level is not added to the root container,
        // the onActivateEvent call happens after the LEVEL_LOADED event
        // so we need to force a first update
        if (this.ancestor.root !== true) {
            this.updateLayer(viewport.pos);
        }
    }

    /**
     * resize the Image Layer to match the given size
     * @name resize
     * @memberof me.ImageLayer.prototype
     * @function
     * @param {number} w new width
     * @param {number} h new height
     */
    resize(w, h) {
        super.resize(
            this.repeatX ? Infinity : w,
            this.repeatY ? Infinity : h
        );
    }

    /**
     * createPattern function
     * @ignore
     * @function
     */
    createPattern() {
        this._pattern = renderer.createPattern(this.image, this._repeat);
    }

    /**
     * updateLayer function
     * @ignore
     * @function
     */
    updateLayer(vpos) {
        var rx = this.ratio.x,
            ry = this.ratio.y;

        if (rx === 0 && ry === 0) {
            // static image
            return;
        }

        var width = this.width,
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
            x = ax * (rx - 1) * (bw - viewport.width) + this.offset.x - rx * vpos.x,
            y = ay * (ry - 1) * (bh - viewport.height) + this.offset.y - ry * vpos.y;


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
    }

    /**
     * draw the ImageLayer. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberof me.ImageLayer.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    draw(renderer) {
        var width = this.width,
            height = this.height,
            bw = viewport.bounds.width,
            bh = viewport.bounds.height,
            ax = this.anchorPoint.x,
            ay = this.anchorPoint.y,
            x = this.pos.x,
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
    }

    /**
     * Destroy function<br>
     * @ignore
     */
    destroy() {
        pool.push(this.ratio);
        this.ratio = undefined;
        event.off(event.WEBGL_ONCONTEXT_RESTORED, this.createPattern);
        super.destroy();
    }

};

export default ImageLayer;
