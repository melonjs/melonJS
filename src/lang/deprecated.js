import { TextureAtlas } from "./../video/texture/atlas.js";
import Renderer from "./../video/renderer.js";
import { Draggable } from "./../renderable/draggable.js";
import { DropTarget } from "./../renderable/dragndrop.js";
import UISpriteElement from "./../renderable/ui/uispriteelement.js";
import { warning } from "./console.js";

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
