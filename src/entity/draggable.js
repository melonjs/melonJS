/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/**
 * Used to make a game entity draggable
 * @class
 * @extends me.Entity
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the entity object
 * @param {Number} y the y coordinates of the entity object
 * @param {Object} settings Entity properties (see {@link me.Entity})
 */
me.DraggableEntity = (function (Entity, Input, Event, Vector) {
    "use strict";

    return Entity.extend(
    /** @scope me.DraggableEntity.prototype */
    {
        /**
         * Constructor
         * @name init
         * @memberOf me.DraggableEntity
         * @function
         * @param {Number} x the x postion of the entity
         * @param {Number} y the y postion of the entity
         * @param {Object} settings the additional entity settings
         */
        init: function (x, y, settings) {
            this._super(Entity, "init", [x, y, settings]);
            this.dragging = false;
            this.dragId = null;
            this.grabOffset = new Vector(0, 0);
            this.onPointerEvent = Input.registerPointerEvent;
            this.removePointerEvent = Input.releasePointerEvent;
            this.initEvents();
        },

        /**
         * Initializes the events the modules needs to listen to
         * It translates the pointer events to me.events
         * in order to make them pass through the system and to make
         * this module testable. Then we subscribe this module to the
         * transformed events.
         * @name initEvents
         * @memberOf me.DraggableEntity
         * @function
         */
        initEvents: function () {
            var self = this;
            /**
             * @ignore
             */
            this.mouseDown = function (e) {
                this.translatePointerEvent(e, Event.DRAGSTART);
            };
            /**
             * @ignore
             */
            this.mouseUp = function (e) {
                this.translatePointerEvent(e, Event.DRAGEND);
            };
            this.onPointerEvent("pointerdown", this, this.mouseDown.bind(this));
            this.onPointerEvent("pointerup", this, this.mouseUp.bind(this));
            Event.subscribe(Event.POINTERMOVE, this.dragMove.bind(this));
            Event.subscribe(Event.DRAGSTART, function (e, draggable) {
                if (draggable === self) {
                    self.dragStart(e);
                }
            });
            Event.subscribe(Event.DRAGEND, function (e, draggable) {
                if (draggable === self) {
                    self.dragEnd(e);
                }
            });
        },

        /**
         * Translates a pointer event to a me.event
         * @name translatePointerEvent
         * @memberOf me.DraggableEntity
         * @function
         * @param {Object} e the pointer event you want to translate
         * @param {String} translation the me.event you want to translate
         * the event to
         */
        translatePointerEvent: function (e, translation) {
            Event.publish(translation, [e, this]);
        },

        /**
         * Gets called when the user starts dragging the entity
         * @name dragStart
         * @memberOf me.DraggableEntity
         * @function
         * @param {Object} x the pointer event
         */
        dragStart: function (e) {
            if (this.dragging === false) {
                this.dragging = true;
                this.dragId = e.pointerId;
                this.grabOffset.set(e.gameX, e.gameY);
                this.grabOffset.sub(this.pos);
                return false;
            }
        },

        /**
         * Gets called when the user drags this entity around
         * @name dragMove
         * @memberOf me.DraggableEntity
         * @function
         * @param {Object} x the pointer event
         */
        dragMove: function (e) {
            if (this.dragging === true) {
                if (this.dragId === e.pointerId) {
                    this.pos.set(e.gameX, e.gameY, this.pos.z); //TODO : z ?
                    this.pos.sub(this.grabOffset);
                }
            }
        },

        /**
         * Gets called when the user stops dragging the entity
         * @name dragEnd
         * @memberOf me.DraggableEntity
         * @function
         * @param {Object} x the pointer event
         */
        dragEnd: function () {
            if (this.dragging === true) {
                this.pointerId = undefined;
                this.dragging = false;
                return false;
            }
        },

        /**
         * Destructor
         * @name destroy
         * @memberOf me.DraggableEntity
         * @function
         */
        destroy: function () {
            Event.unsubscribe(Event.POINTERMOVE, this.dragMove);
            Event.unsubscribe(Event.DRAGSTART, this.dragStart);
            Event.unsubscribe(Event.DRAGEND, this.dragEnd);
            this.removePointerEvent("pointerdown", this);
            this.removePointerEvent("pointerup", this);
        }
    });
}(me.Entity, me.input, me.event, me.Vector2d));
