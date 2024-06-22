/**
 * additional import for TypeScript
 * @import { Draggable } from "./draggable.js";
 */
/**
 * @classdesc
 * a base drop target object
 * @see Draggable
 * @augments Renderable
 */
export class DropTarget extends Renderable {
    /**
     * constant for the overlaps method
     * @public
     * @constant
     * @type {string}
     * @name CHECKMETHOD_OVERLAP
     * @memberof DropTarget
     */
    public CHECKMETHOD_OVERLAP: string;
    /**
     * constant for the contains method
     * @public
     * @constant
     * @type {string}
     * @name CHECKMETHOD_CONTAINS
     * @memberof DropTarget
     */
    public CHECKMETHOD_CONTAINS: string;
    /**
     * the checkmethod we want to use
     * @public
     * @constant
     * @type {string}
     * @name checkMethod
     * @default "overlaps"
     * @memberof DropTarget
     */
    public checkMethod: string;
    /**
     * Sets the collision method which is going to be used to check a valid drop
     * @name setCheckMethod
     * @memberof DropTarget
     * @param {string} checkMethod - the checkmethod (defaults to CHECKMETHOD_OVERLAP)
     */
    setCheckMethod(checkMethod: string): void;
    /**
     * Checks if a dropped entity is dropped on the current entity
     * @name checkOnMe
     * @memberof DropTarget
     * @param {object} e - the triggering event
     * @param {Draggable} draggable - the draggable object that is dropped
     */
    checkOnMe(e: object, draggable: Draggable): void;
    /**
     * Gets called when a draggable entity is dropped on the current entity
     * @name drop
     * @memberof DropTarget
     * @param {Draggable} draggable - the draggable object that is dropped
     */
    drop(draggable: Draggable): void;
    /**
     * Destructor
     * @name destroy
     * @memberof DropTarget
     * @ignore
     */
    destroy(): void;
}
import Renderable from "./../renderable/renderable.js";
import type { Draggable } from "./draggable.js";
