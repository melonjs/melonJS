/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { on, DRAGEND, off } from '../system/event.js';
import Renderable from './renderable.js';

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
class DropTarget extends Renderable {
    /**
     * @param {number} x - the x coordinates of the drop target
     * @param {number} y - the y coordinates of the drop target
     * @param {number} width - drop target width
     * @param {number} height - drop target height
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

        on(DRAGEND, this.checkOnMe, this);

    }

    /**
     * Sets the collision method which is going to be used to check a valid drop
     * @name setCheckMethod
     * @memberof DropTarget
     * @param {string} checkMethod - the checkmethod (defaults to CHECKMETHOD_OVERLAP)
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
     * @param {object} e - the triggering event
     * @param {Draggable} draggable - the draggable object that is dropped
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
     * @param {Draggable} draggable - the draggable object that is dropped
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
        off(DRAGEND, this.checkOnMe);
        super.destroy();
    }
}

export { DropTarget };
