import pool from "./../system/pooling.js";
import Renderable from "./renderable.js";

/** @ignore */
function createGradient(light) {
    var context = light.texture.context;
    var x1 = light.texture.width / 2;
    var y1 = light.texture.height / 2;
    var gradient = context.createRadialGradient(x1, y1, 0, x1, y1, light.radius);

    light.texture.clear();

    gradient.addColorStop( 0, light.color.toRGBA(light.intensity));
    gradient.addColorStop( 1, light.color.toRGBA(0.0));

    context.beginPath();
    context.fillStyle = gradient;
    context.arc(x1, y1, light.radius, 0, Math.PI * 2, false);
    context.fill();
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
    * @param {number} radius - The radius of the light.
    * @param {Color|string} [color="#FFF"] the color of the light
    * @param {number} [intensity=0.7] - The intensity of the light.
    */
    constructor(x, y, radius, color = "#FFF", intensity = 0.7) {
        // call the parent constructor
        super(x, y, radius * 2, radius * 2);

        /**
         * the color of the light
         * @type {Color}
         * @default "#FFF"
         */
        this.color = pool.pull("Color").parseCSS(color);

        /**
         * The radius of the light
         * @type {number}
         */
        this.radius = radius;

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
        this.texture = pool.pull("CanvasTexture", this.width, this.height, { offscreenCanvas: false });

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
     * object draw (Called internally by the engine).
     * @ignore
     */
    draw(renderer) {
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
};
export default Light2d;
