/**
 * @classdesc
 * Used to make a game entity draggable
 * @augments Entity
 * @deprecated since 10.5.0
 * @see Draggable
 */
export class DraggableEntity {
    /**
     * @param {number} x - the x coordinates of the draggable object
     * @param {number} y - the y coordinates of the draggable object
     * @param {object} settings - Entity properties (see {@link Entity})
     */
    constructor(x: number, y: number, settings: object);
}
/**
 * @classdesc
 * Used to make a game entity a droptarget
 * @augments Entity
 * @deprecated since 10.5.0
 * @see DropTarget
 */
export class DroptargetEntity {
    /**
     * @param {number} x - the x coordinates of the draggable object
     * @param {number} y - the y coordinates of the draggable object
     * @param {object} settings - Entity properties (see {@link Entity})
     */
    constructor(x: number, y: number, settings: object);
}
/**
 * @classdesc
 * A very basic object to manage GUI elements
 * @augments Sprite
 * @deprecated since 14.0.0
 * @see UISpriteElement
 */
export class GUI_Object {
    /**
     * @param {number} x - the x coordinate of the GUI Object
     * @param {number} y - the y coordinate of the GUI Object
     * @param {object} settings - See {@link Sprite}
     */
    constructor(x: number, y: number, settings: object);
}
/**
 * @classdesc
 * @deprecated since 17.1.0
 * @see CanvasRenderTarget
 */
export class CanvasTexture extends CanvasRenderTarget {
    /**
     * @param {number} width - the desired width of the canvas
     * @param {number} height - the desired height of the canvas
     * @param {object} attributes - The attributes to create both the canvas and context
     * @param {boolean} [attributes.context="2d"] - the context type to be created ("2d", "webgl", "webgl2")
     * @param {boolean} [attributes.offscreenCanvas=false] - will create an offscreenCanvas if true instead of a standard canvas
     * @param {boolean} [attributes.willReadFrequently=false] - Indicates whether or not a lot of read-back operations are planned
     * @param {boolean} [attributes.antiAlias=false] - Whether to enable anti-aliasing, use false (default) for a pixelated effect.
     */
    constructor(width: number, height: number, attributes: {
        context?: boolean | undefined;
        offscreenCanvas?: boolean | undefined;
        willReadFrequently?: boolean | undefined;
        antiAlias?: boolean | undefined;
    });
}
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";
