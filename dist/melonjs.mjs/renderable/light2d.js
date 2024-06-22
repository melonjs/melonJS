/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import pool from '../system/pooling.js';
import Renderable from './renderable.js';

/**
 * additional import for TypeScript
 * @import Color from "./../math/color.js";
 * @import Ellipse from "./../geometries/ellipse.js";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 */


/** @ignore */
function createGradient(light) {
    let context = light.texture.context;

    let x1 = light.texture.width / 2,
        y1 = light.texture.height / 2;

    let radiusX = light.radiusX,
        radiusY = light.radiusY;

    let scaleX, scaleY, invScaleX, invScaleY;
    let gradient;


    light.texture.clear();

    if (radiusX >= radiusY) {
        scaleX = 1;
        invScaleX = 1;
        scaleY = radiusY / radiusX;
        invScaleY = radiusX / radiusY;
        gradient = context.createRadialGradient(x1, y1 * invScaleY, 0, x1, radiusY * invScaleY, radiusX);
    }
    else {
        scaleY = 1;
        invScaleY = 1;
        scaleX = radiusX / radiusY;
        invScaleX = radiusY / radiusX;
        gradient = context.createRadialGradient(x1 * invScaleX, y1, 0, x1 * invScaleX, y1, radiusY);
    }

    gradient.addColorStop(0, light.color.toRGBA(light.intensity));
    gradient.addColorStop(1, light.color.toRGBA(0.0));

    context.fillStyle = gradient;

    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.fillRect(0, 0, light.texture.width * invScaleX, light.texture.height * invScaleY);
}

/**
 * @classdesc
 * A 2D point light.
 * Note: this is a very experimental and work in progress feature, that provides a simple spot light effect.
 * The light effect is best rendered in WebGL, as they are few limitations when using the Canvas Renderer
 * (multiple lights are not supported, alpha component of the ambient light is ignored)
 * @see stage.lights
 */
class Light2d extends Renderable {
    /**
    * @param {number} x - The horizontal position of the light.
    * @param {number} y - The vertical position of the light.
    * @param {number} radiusX - The horizontal radius of the light.
    * @param {number} [radiusY=radiusX] - The vertical radius of the light.
    * @param {Color|string} [color="#FFF"] - the color of the light
    * @param {number} [intensity=0.7] - The intensity of the light.
    */
    constructor(x, y, radiusX, radiusY = radiusX, color = "#FFF", intensity = 0.7) {
        // call the parent constructor
        super(x, y, radiusX * 2, radiusY * 2);

        /**
         * the color of the light
         * @type {Color}
         * @default "#FFF"
         */
        this.color = pool.pull("Color").parseCSS(color);

        /**
         * The horizontal radius of the light
         * @type {number}
         */
        this.radiusX = radiusX;

        /**
         * The vertical radius of the light
         * @type {number}
         */
        this.radiusY = radiusY;

        /**
         * The intensity of the light
         * @type {number}
         * @default 0.7
         */
        this.intensity = intensity;

        /**
         * the default blend mode to be applied when rendering this light
         * @type {string}
         * @default "lighter"
         * @see CanvasRenderer#setBlendMode
         * @see WebGLRenderer#setBlendMode
         */
        this.blendMode = "lighter";

        /** @ignore */
        this.visibleArea = pool.pull("Ellipse", this.centerX, this.centerY, this.width, this.height);

        /** @ignore */
        this.texture = pool.pull("CanvasRenderTarget", this.width, this.height, { offscreenCanvas: false });

        this.anchorPoint.set(0, 0);

        createGradient(this);
    }

    /**
     * returns a geometry representing the visible area of this light
     * @name getVisibleArea
     * @memberof Light2d
     * @returns {Ellipse} the light visible mask
     */
    getVisibleArea() {
        return this.visibleArea.setShape(this.getBounds().centerX, this.getBounds().centerY, this.width, this.height);
    }

    /**
     * update function
     * @param {number} dt - time since the last update in milliseconds.
     * @returns {boolean} true if dirty
     */
    update(dt) { // eslint-disable-line no-unused-vars
        return true;
    }

    /**
     * draw this Light2d (automatically called by melonJS)
     * @name draw
     * @memberof Light2d
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    draw(renderer, viewport) {   // eslint-disable-line no-unused-vars
        renderer.drawImage(this.texture.canvas, this.getBounds().x, this.getBounds().y);
    }

    /**
     * Destroy function<br>
     * @ignore
     */
    destroy() {
        pool.push(this.color);
        this.color = undefined;
        pool.push(this.texture);
        this.texture = undefined;
        pool.push(this.visibleArea);
        this.visibleArea = undefined;
        super.destroy();
    }
}

export { Light2d as default };
