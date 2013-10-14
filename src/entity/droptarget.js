/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 * @desc Used to make a game entity a droptarget
 */
me.DroptargetEntity = (function (Entity, Event, Rect) {
    'use strict';
    return Entity.extend({
        /**
         * constant for the overlaps method
         * @public
         * @constant
         * @type String
         * @name CHECKMETHOD_OVERLAP
         */
        CHECKMETHOD_OVERLAP: "overlaps",
        /**
         * constant for the contains method
         * @public
         * @constant
         * @type String
         * @name CHECKMETHOD_CONTAINS
         */
        CHECKMETHOD_CONTAINS: "contains",
        /**
         * the checkmethod we want to use
         * @public
         * @constant
         * @type String
         * @name checkMethod
         */
        checkMethod: null,
        /**
         * Constructor
         * @name init
         * @memberOf me.DroptargetEntity
         * @function
         * @param {Number} x the x postion of the entity
         * @param {Number} y the y postion of the entity
         * @param {Object} settings the additional entity settings
         */
        init: function (x, y, settings) {
            this.parent(x, y, settings);
            Event.subscribe(Event.DRAGEND, this.checkOnMe.bind(this));
            this.checkMethod = this[this.CHECKMETHOD_OVERLAP];
        },
        /**
         * Sets the collision method which is going to be used to check a valid drop
         * @name setCheckMethod
         * @memberOf me.DroptargetEntity
         * @function
         * @param {Constant} checkMethod the checkmethod (defaults to CHECKMETHOD_OVERLAP)
         */
        setCheckMethod: function (checkMethod) {
            //  We can improve this check,
            //  because now you can use every method in theory
            if (this[checkMethod] !== undefined) {
                this.checkMethod = this[checkMethod];
            }
        },
        /**
         * Checks if a dropped entity is dropped on the current entity
         * @name checkOnMe
         * @memberOf me.DroptargetEntity
         * @function
         * @param {Object} draggableEntity the draggable entity that is dropped
         */
        checkOnMe: function (e, draggableEntity) {
            if (draggableEntity && this.checkMethod(draggableEntity.collisionBox)) {
                // call the drop method on the current entity
                this.drop(draggableEntity);
            }
        },
        /**
         * Gets called when a draggable entity is dropped on the current entity
         * @name drop
         * @memberOf me.DroptargetEntity
         * @function
         * @param {Object} draggableEntity the draggable entity that is dropped
         */
        drop: function (draggableEntity) {
            //  Could be used to fire default drop logic
        },
        /**
         * Destructor
         * @name destroy
         * @memberOf me.DroptargetEntity
         * @function
         */
        destroy: function () {
            Event.unsubscribe(Event.DRAGEND, this.checkOnMe);
        }
    });
}(me.ObjectEntity, me.event, me.Rect));
