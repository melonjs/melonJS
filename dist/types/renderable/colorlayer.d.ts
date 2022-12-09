/**
 * @classdesc
 * a generic Color Layer Object.  Fills the entire Canvas with the color not just the container the object belongs to.
 * @augments Renderable
 */
export default class ColorLayer extends Renderable {
    /**
     * @param {string} name - Layer name
     * @param {Color|string} color - CSS color
     * @param {number} [z = 0] - z-index position
     */
    constructor(name: string, color: Color | string, z?: number | undefined);
    /**
     * the layer color component
     * @public
     * @type {Color}
     * @name color
     * @memberof ColorLayer#
     */
    public color: Color;
    onResetEvent(name: any, color: any, z?: number): void;
    /**
     * Destroy function
     * @ignore
     */
    destroy(): void;
}
import Renderable from "./renderable.js";
