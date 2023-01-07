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
