import { TextureAtlas } from "./../video/texture/atlas.js";
import Renderer from "./../video/renderer.js";
import { Draggable } from "./../renderable/draggable.js";
import { DropTarget } from "./../renderable/dragndrop.js";
import UISpriteElement from "./../renderable/ui/uispriteelement.js";
import { warning } from "./console.js";
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";
import CanvasRenderer from "../video/canvas/canvas_renderer.js";
import WebGLRenderer from "../video/webgl/webgl_renderer.js";

/*
 * placeholder for all deprecated classes and corresponding alias for backward compatibility
 */

/**
 * Alias of {@link TextureAtlas}
 * @public
 * @name Texture
 * @class
 * @memberof Renderer#
 * @deprecated since 10.4.0
 * @see TextureAtlas
 */
Object.defineProperty(Renderer.prototype, "Texture", {
    /**
     * @ignore
     */
    get : function () {
        warning("me.video.renderer.Texture", "me.TextureAtlas", "10.4.0");
        return TextureAtlas;
    }
});

/**
 * @classdesc
 * Used to make a game entity draggable
 * @augments Entity
 * @deprecated since 10.5.0
 * @see Draggable
 */
export class DraggableEntity extends Draggable {
    /**
     * @param {number} x - the x coordinates of the draggable object
     * @param {number} y - the y coordinates of the draggable object
     * @param {object} settings - Entity properties (see {@link Entity})
     */
    constructor(x, y, settings) {
        warning("DraggableEntity", "Draggable", "10.5.0");
        super(x, y, settings.width, settings.height);
    }
}

/**
 * @classdesc
 * Used to make a game entity a droptarget
 * @augments Entity
 * @deprecated since 10.5.0
 * @see DropTarget
 */
export class DroptargetEntity extends DropTarget {
    /**
     * @param {number} x - the x coordinates of the draggable object
     * @param {number} y - the y coordinates of the draggable object
     * @param {object} settings - Entity properties (see {@link Entity})
     */
    constructor(x, y, settings) {
        warning("DroptargetEntity", "DropTarget", "10.5.0");
        super(x, y, settings.width, settings.height);
    }
}

/**
 * return a reference to the screen canvas
 * @name getScreenCanvas
 * @memberof Renderer
 * @returns {HTMLCanvasElement}
 * @deprecated since 13.1.0
 * @see getCanvas();
 */
Renderer.prototype.getScreenCanvas = function() {
    warning("getScreenCanvas", "getCanvas", "13.1.0");
    return this.getCanvas();
};

/**
 * return a reference to the screen canvas corresponding 2d Context<br>
 * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
 * @name getScreenContext
 * @memberof Renderer
 * @returns {CanvasRenderingContext2D}
 * @deprecated since 13.1.0
 * @see getContext();
 */
Renderer.prototype.getScreenContext = function()  {
    warning("getScreenContext", "getContext", "13.1.0");
    return this.getContext();
};

/**
 * @classdesc
 * A very basic object to manage GUI elements
 * @augments Sprite
 * @deprecated since 14.0.0
 * @see UISpriteElement
 */
export class GUI_Object extends UISpriteElement {
    /**
     * @param {number} x - the x coordinate of the GUI Object
     * @param {number} y - the y coordinate of the GUI Object
     * @param {object} settings - See {@link Sprite}
     */
    constructor(x, y, settings) {
        warning("GUI_Object", "UISpriteElement or UITextButton", "14.0.0");
        super(x, y, settings);
    }
}


/**
 * return the width of the system Canvas
 * @public
 * @name getWidth
 * @class
 * @memberof Renderer#
 * @deprecated since 15.12.0
 * @see width
 */
Renderer.prototype.getWidth = function()  {
    warning("getWidth", "width", "15.12.0");
    return this.width;
};

/**
 * return the height of the system Canvas
 * @public
 * @name getHeight
 * @memberof Renderer#
 * @deprecated since 15.12.0
 * @see height
 */
Renderer.prototype.getHeight = function()  {
    warning("getHeight", "height", "15.12.0");
    return this.height;
};

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
    constructor(width, height, attributes) {
        warning("CanvasTexture", "CanvasRenderTarget", "17.1.0");
        super(width, height, attributes);
    }
}

/**
 * return the height of the system Canvas
 * @public
 * @name setLineWidth
 * @memberof CanvasRenderer#
 * @deprecated since 17.3.0
 * @see lineWidth
 */
CanvasRenderer.prototype.setLineWidth = function(width)  {
    warning("setLineWidth", "lineWidth", "17.3.0");
    this.lineWidth = width;
};

/**
 * return the height of the system Canvas
 * @public
 * @name setLineWidth
 * @memberof WebGLRenderer#
 * @deprecated since 17.3.0
 * @see lineWidth
 */
WebGLRenderer.prototype.setLineWidth = function(width)  {
    warning("setLineWidth", "lineWidth", "17.3.0");
    this.lineWidth = width;
};

