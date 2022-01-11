import pool from "./../system/pooling.js";
import { viewport } from "./../game.js";
import Renderable from "./renderable.js";


/**
 * @classdesc
 * a generic Color Layer Object.  Fills the entire Canvas with the color not just the container the object belongs to.
 * @class ColorLayer
 * @augments me.Renderable
 * @memberof me
 * @param {string} name Layer name
 * @param {me.Color|string} color CSS color
 * @param {number} [z = 0] z-index position
 */
class ColorLayer extends Renderable {

    /**
     * @ignore
     */
    constructor(name, color, z) {
        // parent constructor
        super(0, 0, Infinity, Infinity);

        /**
         * the layer color component
         * @public
         * @type {me.Color}
         * @name color
         * @memberof me.ColorLayer#
         */
         this.color = pool.pull("Color").parseCSS(color);

         this.onResetEvent(name, color, z);

    }

    onResetEvent(name, color, z = 0) {
        // apply given parameters
        this.name = name;
        this.pos.z = z;
        this.floating = true;
        // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
        this.color.parseCSS(color);
    }

    /**
     * draw the color layer
     * @ignore
     */
    draw(renderer, rect) {
        var vpos = viewport.pos;
        renderer.save();
        renderer.clipRect(
            rect.left - vpos.x, rect.top - vpos.y,
            rect.width, rect.height
        );
        renderer.clearColor(this.color);
        renderer.restore();
    }

    /**
     * Destroy function
     * @ignore
     */
    destroy() {
        pool.push(this.color);
        this.color = undefined;
        super.destroy();
    }

};

export default ColorLayer;
