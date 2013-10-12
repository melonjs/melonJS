/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 * @desc Used to make a game entity draggable
 */
me.DraggableEntity = (function (Entity, Input, Event, Vector) {
    return Entity.extend({
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
            var self = this;
            this.parent(x, y, settings);
            this.dragging = false;
            this.dragId = null;
            this.grabOffset = new Vector(0,0);
            this.onPointerEvent = Input.registerPointerEvent;
            this.removePointerEvent = Input.releasePointerEvent;
            // we translate the pointer events to me.events
            // in order to make them pass through the system and to make
            // this module testable
            this.onPointerEvent('mousedown', this, function (e) {
                self.translatePointerEvent(e, Event.DRAGSTART);
            });
            this.onPointerEvent('mouseup', this, function (e) {
                self.translatePointerEvent(e, Event.DRAGEND);
            });
            // subscribe to the mousemove event
            Event.subscribe(Event.MOUSEMOVE, this.dragMove.bind(this));
            // subscribe to the transformed events
            Event.subscribe(Event.DRAGSTART, this.dragStart.bind(this));
            Event.subscribe(Event.DRAGEND, this.dragEnd.bind(this));
        },
        /**
         * Translates a pointer event to a me.event
         * @name init
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
                    this.pos.set(e.gameX, e.gameY);
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
        dragEnd: function (e) {
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
            Event.unsubscribe('mousemove', this.dragMove);
            this.removePointerEvent('mousedown', this);
            this.removePointerEvent('mouseup', this);
        }
    });
}(me.ObjectEntity, me.input, me.event, me.Vector2d));
