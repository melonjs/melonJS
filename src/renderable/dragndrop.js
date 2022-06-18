import Vector2d from "./../math/vector2.js";
import * as input from "./../input/input.js";
import * as event from "./../system/event.js";
import Renderable from "./../renderable/renderable.js";

/**
 * @classdesc
 * A Draggable base object
 * @see DropTarget
 * @augments Renderable
 */
export class Draggable extends Renderable {
    /**
     * @param {number} x the x coordinates of the draggable object
     * @param {number} y the y coordinates of the draggable object
     * @param {number} width draggable object width
     * @param {number} height draggable object height
     */
    constructor(x, y, width, height) {
        super(x, y, width, height);
        this.isKinematic = false;
        this.dragging = false;
        this.dragId = null;
        this.grabOffset = new Vector2d(0, 0);
        this.initEvents();
    }

    /**
     * Initializes the events the modules needs to listen to
     * It translates the pointer events to me.events
     * in order to make them pass through the system and to make
     * this module testable. Then we subscribe this module to the
     * transformed events.
     * @name initEvents
     * @memberof Draggable
     * @private
     */
    initEvents() {
        input.registerPointerEvent("pointerdown", this, (e) => { event.emit(event.DRAGSTART, e, this); });
        input.registerPointerEvent("pointerup", this,  (e) => { event.emit(event.DRAGEND, e, this); });
        input.registerPointerEvent("pointercancel", this, (e) => { event.emit(event.DRAGEND, e, this); });
        event.on(event.POINTERMOVE, this.dragMove.bind(this));
        event.on(event.DRAGSTART, (e, draggable) => {
            if (draggable === this) {
                this.dragStart(e);
            }
        });
        event.on(event.DRAGEND, (e, draggable) => {
            if (draggable === this) {
                this.dragEnd(e);
            }
        });
    }

    /**
     * Gets called when the user starts dragging the entity
     * @name dragStart
     * @memberof Draggable
     * @param {object} e the pointer event
     * @returns {boolean} false if the object is being dragged
     */
    dragStart(e) {
        if (this.dragging === false) {
            this.dragging = true;
            this.grabOffset.set(e.gameX, e.gameY);
            this.grabOffset.sub(this.pos);
            return false;
        }
    }

    /**
     * Gets called when the user drags this entity around
     * @name dragMove
     * @memberof Draggable
     * @param {object} e the pointer event
     */
    dragMove(e) {
        if (this.dragging === true) {
            this.pos.set(e.gameX, e.gameY, this.pos.z); //TODO : z ?
            this.pos.sub(this.grabOffset);
        }
    }

    /**
     * Gets called when the user stops dragging the entity
     * @name dragEnd
     * @memberof Draggable
     * @returns {boolean} false if the object stopped being dragged
     */
    dragEnd() {
        if (this.dragging === true) {
            this.dragging = false;
            return false;
        }
    }

    /**
     * Destructor
     * @name destroy
     * @memberof Draggable
     * @ignore
     */
    destroy() {
        event.off(event.POINTERMOVE, this.dragMove);
        event.off(event.DRAGSTART, this.dragStart);
        event.off(event.DRAGEND, this.dragEnd);
        input.releasePointerEvent("pointerdown", this);
        input.releasePointerEvent("pointerup", this);
        input.releasePointerEvent("pointercancel", this);
        super.destroy();
    }
};

/**
 * @classdesc
 * a base drop target object
 * @see Draggable
 * @augments Renderable
 */
export class DropTarget extends Renderable {
    /**
     * @param {number} x the x coordinates of the drop target
     * @param {number} y the y coordinates of the drop target
     * @param {number} width drop target width
     * @param {number} height drop target height
     */
    constructor(x, y, width, height) {
        super(x, y, width, height);

        this.isKinematic = false;

        /**
         * constant for the overlaps method
         * @public
         * @constant
         * @type {string}
         * @name CHECKMETHOD_OVERLAP
         * @memberof DropTarget
         */
        this.CHECKMETHOD_OVERLAP = "overlaps";

        /**
         * constant for the contains method
         * @public
         * @constant
         * @type {string}
         * @name CHECKMETHOD_CONTAINS
         * @memberof DropTarget
         */
        this.CHECKMETHOD_CONTAINS = "contains";

        /**
         * the checkmethod we want to use
         * @public
         * @constant
         * @type {string}
         * @name checkMethod
         * @default "overlaps"
         * @memberof DropTarget
         */
        this.checkMethod = this.CHECKMETHOD_OVERLAP;

        event.on(event.DRAGEND, this.checkOnMe, this);

    }

    /**
     * Sets the collision method which is going to be used to check a valid drop
     * @name setCheckMethod
     * @memberof DropTarget
     * @param {string} checkMethod the checkmethod (defaults to CHECKMETHOD_OVERLAP)
     */
    setCheckMethod(checkMethod) {
        //  We can improve this check,
        //  because now you can use every method in theory
        if (typeof(this.getBounds()[this.checkMethod]) === "function") {
            this.checkMethod = checkMethod;
        }
    }

    /**
     * Checks if a dropped entity is dropped on the current entity
     * @name checkOnMe
     * @memberof DropTarget
     * @param {object} e the triggering event
     * @param {Draggable} draggable the draggable object that is dropped
     */
    checkOnMe(e, draggable) {
        if (draggable && this.getBounds()[this.checkMethod](draggable.getBounds())) {
            // call the drop method on the current entity
            this.drop(draggable);
        }
    }

    /**
     * Gets called when a draggable entity is dropped on the current entity
     * @name drop
     * @memberof DropTarget
     * @param {Draggable} draggable the draggable object that is dropped
     */
    drop(draggable) {  // eslint-disable-line no-unused-vars

    }

    /**
     * Destructor
     * @name destroy
     * @memberof DropTarget
     * @ignore
     */
    destroy() {
        event.off(event.DRAGEND, this.checkOnMe);
        super.destroy();
    }
};
