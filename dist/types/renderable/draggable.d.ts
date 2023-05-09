/**
 * @classdesc
 * A Draggable base object
 * @see DropTarget
 * @augments Renderable
 */
export class Draggable extends Renderable {
    dragging: boolean;
    dragId: any;
    grabOffset: Vector2d;
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
    private initEvents;
    /**
     * Gets called when the user starts dragging the entity
     * @name dragStart
     * @memberof Draggable
     * @param {object} e - the pointer event
     * @returns {boolean} false if the object is being dragged
     */
    dragStart(e: object): boolean;
    /**
     * Gets called when the user drags this entity around
     * @name dragMove
     * @memberof Draggable
     * @param {object} e - the pointer event
     */
    dragMove(e: object): void;
    /**
     * Gets called when the user stops dragging the entity
     * @name dragEnd
     * @memberof Draggable
     * @returns {boolean} false if the object stopped being dragged
     */
    dragEnd(): boolean;
    /**
     * Destructor
     * @name destroy
     * @memberof Draggable
     * @ignore
     */
    destroy(): void;
}
import Renderable from "./../renderable/renderable.js";
import Vector2d from "./../math/vector2.js";
