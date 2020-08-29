import Vector2d from "./../math/vector2.js";
import * as input from "./../input/input.js";
import event from "./../system/event.js";
import Entity from "./entity.js";

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
var DraggableEntity = Entity.extend({
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
        this.grabOffset = new Vector2d(0, 0);
        this.onPointerEvent = input.registerPointerEvent;
        this.removePointerEvent = input.releasePointerEvent;
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
        event.subscribe(event.POINTERMOVE, this.dragMove.bind(this));
        event.subscribe(event.DRAGSTART, function (e, draggable) {
            if (draggable === self) {
                self.dragStart(e);
            }
        });
        event.subscribe(event.DRAGEND, function (e, draggable) {
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
        event.publish(translation, [e, this]);
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
            this.pos.set(e.gameX, e.gameY, this.pos.z); //TODO : z ?
            this.pos.sub(this.grabOffset);
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
        event.unsubscribe(event.POINTERMOVE, this.dragMove);
        event.unsubscribe(event.DRAGSTART, this.dragStart);
        event.unsubscribe(event.DRAGEND, this.dragEnd);
        this.removePointerEvent("pointerdown", this);
        this.removePointerEvent("pointerup", this);
    }
});
export default DraggableEntity;
