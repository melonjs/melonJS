import Vector2d from "./../math/vector2.js";
import * as input from "./../input/input.js";
import * as event from "./../system/event.js";
import Entity from "./entity.js";

/**
 * @classdesc
 * Used to make a game entity draggable
 * @class DraggableEntity
 * @augments me.Entity
 * @memberof me
 * @param {number} x the x coordinates of the entity object
 * @param {number} y the y coordinates of the entity object
 * @param {object} settings Entity properties (see {@link me.Entity})
 */
class DraggableEntity extends Entity {

    constructor(x, y, settings) {
        super(x, y, settings);
        this.dragging = false;
        this.dragId = null;
        this.grabOffset = new Vector2d(0, 0);
        this.onPointerEvent = input.registerPointerEvent;
        this.removePointerEvent = input.releasePointerEvent;
        this.initEvents();
    }

    /**
     * Initializes the events the modules needs to listen to
     * It translates the pointer events to me.events
     * in order to make them pass through the system and to make
     * this module testable. Then we subscribe this module to the
     * transformed events.
     * @name initEvents
     * @memberof me.DraggableEntity
     * @function
     */
    initEvents() {
        /**
         * @ignore
         */
        this.mouseDown = function (e) {
            this.translatePointerEvent(e, event.DRAGSTART);
        };
        /**
         * @ignore
         */
        this.mouseUp = function (e) {
            this.translatePointerEvent(e, event.DRAGEND);
        };
        this.onPointerEvent("pointerdown", this, this.mouseDown.bind(this));
        this.onPointerEvent("pointerup", this, this.mouseUp.bind(this));
        this.onPointerEvent("pointercancel", this, this.mouseUp.bind(this));
        event.on(event.POINTERMOVE, this.dragMove, this);
        event.on(event.DRAGSTART, this.dragStart, this);
        event.on(event.DRAGEND, this.dragEnd, this);
    }

    /**
     * Translates a pointer event to a me.event
     * @name translatePointerEvent
     * @memberof me.DraggableEntity
     * @function
     * @param {object} e the pointer event you want to translate
     * @param {string} translation the me.event you want to translate the event to
     */
    translatePointerEvent(e, translation) {
        event.emit(translation, e);
    }

    /**
     * Gets called when the user starts dragging the entity
     * @name dragStart
     * @memberof me.DraggableEntity
     * @function
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
     * @memberof me.DraggableEntity
     * @function
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
     * @memberof me.DraggableEntity
     * @function
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
     * @memberof me.DraggableEntity
     * @function
     */
    destroy() {
        event.off(event.POINTERMOVE, this.dragMove);
        event.off(event.DRAGSTART, this.dragStart);
        event.off(event.DRAGEND, this.dragEnd);
        this.removePointerEvent("pointerdown", this);
        this.removePointerEvent("pointerup", this);
    }
};
export default DraggableEntity;
