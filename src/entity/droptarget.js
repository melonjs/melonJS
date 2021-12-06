import * as event from "./../system/event.js";
import Entity from "./entity.js";

/**
 * Used to make a game entity a droptarget
 * @class
 * @extends me.Entity
 * @memberOf me
 * @constructor
 * @param {number} x the x coordinates of the entity object
 * @param {number} y the y coordinates of the entity object
 * @param {object} settings Entity properties (see {@link me.Entity})
 */

class DroptargetEntity extends Entity {
    /**
     * Constructor
     * @name init
     * @memberOf me.DroptargetEntity
     * @function
     * @param {number} x the x postion of the entity
     * @param {number} y the y postion of the entity
     * @param {object} settings the additional entity settings
     */
    constructor(x, y, settings) {
        super(x, y, settings);
        /**
         * constant for the overlaps method
         * @public
         * @constant
         * @type {string}
         * @name CHECKMETHOD_OVERLAP
         * @memberOf me.DroptargetEntity
         */
        this.CHECKMETHOD_OVERLAP = "overlaps";
        /**
         * constant for the contains method
         * @public
         * @constant
         * @type {string}
         * @name CHECKMETHOD_CONTAINS
         * @memberOf me.DroptargetEntity
         */
        this.CHECKMETHOD_CONTAINS = "contains";
        /**
         * the checkmethod we want to use
         * @public
         * @constant
         * @type {string}
         * @name checkMethod
         * @memberOf me.DroptargetEntity
         */
        this.checkMethod = null;
        event.on(event.DRAGEND, this.checkOnMe, this);
        this.checkMethod = this[this.CHECKMETHOD_OVERLAP];
    }

    /**
     * Sets the collision method which is going to be used to check a valid drop
     * @name setCheckMethod
     * @memberOf me.DroptargetEntity
     * @function
     * @param {string} checkMethod the checkmethod (defaults to CHECKMETHOD_OVERLAP)
     */
    setCheckMethod(checkMethod) {
        //  We can improve this check,
        //  because now you can use every method in theory
        if (typeof(this[checkMethod]) !== "undefined") {
            this.checkMethod = this[checkMethod];
        }
    }

    /**
     * Checks if a dropped entity is dropped on the current entity
     * @name checkOnMe
     * @memberOf me.DroptargetEntity
     * @function
     * @param {object} e the triggering event
     * @param {object} draggableEntity the draggable entity that is dropped
     */
    checkOnMe(e, draggableEntity) {
        if (draggableEntity && this.checkMethod(draggableEntity.getBounds())) {
            // call the drop method on the current entity
            this.drop(draggableEntity);
        }
    }

    /**
     * Gets called when a draggable entity is dropped on the current entity
     * @name drop
     * @memberOf me.DroptargetEntity
     * @function
     * @param {object} draggableEntity the draggable entity that is dropped
     */
    drop() {

    }

    /**
     * Destructor
     * @name destroy
     * @memberOf me.DroptargetEntity
     * @function
     */
    destroy() {
        event.off(event.DRAGEND, this.checkOnMe);
    }
};
export default DroptargetEntity;
