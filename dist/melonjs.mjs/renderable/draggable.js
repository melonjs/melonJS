/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import Vector2d from '../math/vector2.js';
import { emit, DRAGSTART, DRAGEND, on, POINTERMOVE, off } from '../system/event.js';
import Renderable from './renderable.js';
import { registerPointerEvent, releasePointerEvent } from '../input/pointerevent.js';

/**
 * @classdesc
 * A Draggable base object
 * @see DropTarget
 * @augments Renderable
 */
class Draggable extends Renderable {
    /**
     * @param {number} x - the x coordinates of the draggable object
     * @param {number} y - the y coordinates of the draggable object
     * @param {number} width - draggable object width
     * @param {number} height - draggable object height
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
        registerPointerEvent("pointerdown", this, (e) => emit(DRAGSTART, e, this));
        registerPointerEvent("pointerup", this,  (e) => emit(DRAGEND, e, this));
        registerPointerEvent("pointercancel", this, (e) => emit(DRAGEND, e, this));
        on(POINTERMOVE, (e) => this.dragMove(e));
        on(DRAGSTART, (e, draggable) => {
            if (draggable === this) {
                this.dragStart(e);
            }
        });
        on(DRAGEND, (e, draggable) => {
            if (draggable === this) {
                this.dragEnd(e);
            }
        });
    }

    /**
     * Gets called when the user starts dragging the entity
     * @name dragStart
     * @memberof Draggable
     * @param {object} e - the pointer event
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
     * @param {object} e - the pointer event
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
        off(POINTERMOVE, this.dragMove);
        off(DRAGSTART, this.dragStart);
        off(DRAGEND, this.dragEnd);
        releasePointerEvent("pointerdown", this);
        releasePointerEvent("pointerup", this);
        releasePointerEvent("pointercancel", this);
        super.destroy();
    }
}

export { Draggable };
