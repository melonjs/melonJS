/**
 * additional import for TypeScript
 * @import Color from "./../math/color.js";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 * @import Camera2d from "./../camera/camera2d.js";
 */
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
     * draw this color layer (automatically called by melonJS)
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    draw(renderer: CanvasRenderer | WebGLRenderer, viewport?: Camera2d | undefined): void;
    /**
     * Destroy function
     * @ignore
     */
    destroy(): void;
}
import Renderable from "./renderable.js";
import type Color from "./../math/color.js";
import type CanvasRenderer from "./../video/canvas/canvas_renderer.js";
import type WebGLRenderer from "./../video/webgl/webgl_renderer.js";
import type Camera2d from "./../camera/camera2d.js";
