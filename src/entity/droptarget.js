/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 * @desc Used to make a game entity a droptarget
 */
me.DroptargetEntity = (function (Event, Rectangle) {
    'use strict';
    // - cross instance private members -

    /**
     * Constructor
     * @name init
     * @memberOf me.DroptargetEntity
     * @function
     * @param {Object} obj: the entity object
     */
    return function (obj) {
        // - per instance private members -
            /**
             * the checkmethod we want to use
             * @public
             * @constant
             * @type String
             * @name checkMethod
             */
        var checkMethod = null,
            /**
             * Gets called when a draggable entity is dropped on the current entity
             * @name drop
             * @memberOf me.DroptargetEntity
             * @function
             * @param {Object} draggableEntity: the draggable entity that is dropped
             */
            drop = function (draggableEntity) {
                // could be used to fire default drop logic
            },
            /**
             * Checks if a dropped entity is dropped on the current entity
             * @name checkOnMe
             * @memberOf me.DroptargetEntity
             * @function
             * @param {Object} e: the drag event
             * @param {Object} draggableEntity: the draggable entity that is dropped
             */
            checkOnMe = function (e, draggableEntity) {
                // the check if the draggable entity is this entity should work after
                // a total refactoring to the module pattern
                if (draggableEntity && draggableEntity !== obj &&
                    obj[checkMethod](draggableEntity.collisionBox)) {
                        // call the drop method on the current entity
                        drop(draggableEntity);
                        if (obj.drop) {
                            obj.drop(e);
                        }
                }
            };

        // - external interface -
        obj.mix({
            /**
             * constant for the overlaps method
             * @public
             * @constant
             * @type String
             * @name CHECKMETHOD_OVERLAPS
             */
            CHECKMETHOD_OVERLAPS: "overlaps",
            /**
             * constant for the contains method
             * @public
             * @constant
             * @type String
             * @name CHECKMETHOD_CONTAINS
             */
            CHECKMETHOD_CONTAINS: "contains",
            /**
             * Sets the collision method which is going to be used to check a valid drop
             * @name setCheckMethod
             * @memberOf me.DroptargetEntity
             * @function
             * @param {Constant} checkMethod: the checkmethod (defaults to CHECKMETHOD_OVERLAP)
             */
            setCheckMethod: function (value) {
                if (this[value] !== undefined) {
                    checkMethod = value;
                }
            },
            /**
             * Destructor
             * @name destroy
             * @memberOf me.DroptargetEntity
             * @function
             */
            destroy: function () {
                Event.unsubscribe(Event.DRAGEND, checkOnMe);
            },
            /**
             * Updates the entity per cycle, can be overwritten
             * @name update
             * @memberOf me.DroptargetEntity
             * @function
             */
            update: function () {
                return true;
            },
            /**
             * Draws the entity per cycle, can be overwritten
             * @name draw
             * @memberOf me.DroptargetEntity
             * @function
             */
            draw: function () {

            }
        });

        // - initialisation logic -
        Event.subscribe(Event.DRAGEND, checkOnMe.bind(obj));
        checkMethod = obj.CHECKMETHOD_OVERLAPS;
        
        // - return external interface -
        return obj;
    };
}(me.event, me.Rect));
