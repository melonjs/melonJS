/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import Container from '../container.js';
import timer from '../../system/timer.js';
import { on, POINTERMOVE, off } from '../../system/event.js';
import pool from '../../system/pooling.js';
import { registerPointerEvent, releasePointerEvent } from '../../input/pointerevent.js';

/**
 * @classdesc
 * This is a basic clickable and draggable container which you can use in your game UI.
 * Use this for example if you want to display a panel that contains text, images or other UI elements.
 * @augments Container
 */
class UIBaseElement extends Container {
    /**
     *
     * @param {number} x - The x position of the container
     * @param {number} y - The y position of the container
     * @param {number} w - width of the container
     * @param {number} h - height of the container
     */
    constructor(x, y, w, h) {
        super(x, y, w, h);
        /**
         * object can be clicked or not
         * @type {boolean}
         * @default true
         */
        this.isClickable = true;

        /**
         * object can be clicked or not
         * @type {boolean}
         * @default false
         */
        this.isDraggable = false;

        /**
         * Tap and hold threshold timeout in ms
         * @type {number}
         * @default 250
         */
        this.holdThreshold = 250;

        /**
         * object can be tap and hold
         * @type {boolean}
         * @default false
         */
        this.isHoldable = false;

        /**
         * true if the pointer is over the object
         * @type {boolean}
         * @default false
         */
        this.hover = false;

        /**
         * false if the pointer is down, or true when the pointer status is up
         * @type {boolean}
         * @default false
         */
        this.released = true;

        /**
         * UI base elements use screen coordinates by default
         * (Note: any child elements added to a UIBaseElement should have their floating property to false)
         * @see Renderable.floating
         * @type {boolean}
         * @default true
         */
        this.floating = true;

        // object has been updated (clicked,etc..)
        this.holdTimeout = -1;

        // enable event detection
        this.isKinematic = false;

        // update container and children bounds automatically
        this.enableChildBoundsUpdate = true;
    }

    /**
     * function callback for the pointerdown event
     * @ignore
     */
    clicked(event) {
        // Check if left mouse button is pressed
        if (event.button === 0 && this.isClickable) {
            this.isDirty = true;
            this.released = false;
            if (this.isHoldable) {
                timer.clearTimeout(this.holdTimeout);
                this.holdTimeout = timer.setTimeout(
                    () => this.hold(),
                    this.holdThreshold,
                    false
                );
                this.released = false;
            }
            if (this.isDraggable) {
                this.grabOffset.set(event.gameX, event.gameY);
                this.grabOffset.sub(this.pos);
            }
            return this.onClick(event);
        }
    }

    /**
     * function called when the object is pressed (to be extended)
     * @param {Pointer} event - the event object
     * @returns {boolean} return false if we need to stop propagating the event
     */
    onClick(event) { // eslint-disable-line no-unused-vars
        return true;
    }

    /**
     * function callback for the pointerEnter event
     * @ignore
     */
    enter(event) {
        this.hover = true;
        this.isDirty = true;
        if (this.isDraggable === true) {
            on(POINTERMOVE, this.pointerMove, this);
            // to memorize where we grab the object
            this.grabOffset = pool.pull("Vector2d", 0, 0);
        }
        return this.onOver(event);
    }

    /**
     * pointermove function
     * @ignore
     */
    pointerMove(event) {
        if (this.hover === true && this.released === false) {
            // follow the pointer
            this.pos.set(event.gameX, event.gameY, this.pos.z);
            this.pos.sub(this.grabOffset);
            // mark the container for redraw
            this.isDirty = true;
            return this.onMove(event);
        }
    }

    /**
     * function called when the pointer is moved over the object
     * @param {Pointer} event - the event object
     */
    onMove(event) { // eslint-disable-line no-unused-vars
        // to be extended
    }

    /**
     * function called when the pointer is over the object
     * @param {Pointer} event - the event object
     */
    onOver(event) { // eslint-disable-line no-unused-vars
        // to be extended
    }

    /**
     * function callback for the pointerLeave event
     * @ignore
     */
    leave(event) {
        this.hover = false;
        this.isDirty = true;
        if (this.isDraggable === true) {
            // unregister on the global pointermove event
            off(POINTERMOVE, this.pointerMove);
            pool.push(this.grabOffset);
            this.grabOffset = undefined;
        }
        this.release(event);
        return this.onOut(event);
    }

    /**
     * function called when the pointer is leaving the object area
     * @param {Pointer} event - the event object
     */
    onOut(event) { // eslint-disable-line no-unused-vars
        // to be extended
    }

    /**
     * function callback for the pointerup event
     * @ignore
     */
    release(event) {
        if (this.released === false) {
            this.released = true;
            this.isDirty = true;
            timer.clearTimeout(this.holdTimeout);
            this.holdTimeout = -1;
            return this.onRelease(event);
        }
    }

    /**
     * function called when the object is pressed and released (to be extended)
     * @returns {boolean} return false if we need to stop propagating the event
     */
    onRelease() {
        return true;
    }

    /**
     * function callback for the tap and hold timer event
     * @ignore
     */
    hold() {
        timer.clearTimeout(this.holdTimeout);
        this.holdTimeout = -1;
        this.isDirty = true;
        if (!this.released) {
            this.onHold();
        }
    }

    /**
     * function called when the object is pressed and held<br>
     * to be extended <br>
     */
    onHold() {}

    /**
     * function called when added to the game world or a container
     * @ignore
     */
    onActivateEvent() {
        // register pointer events
        registerPointerEvent("pointerdown", this, (e) => this.clicked(e));
        registerPointerEvent("pointerup", this, (e) => this.release(e));
        registerPointerEvent("pointercancel", this, (e) => this.release(e));
        registerPointerEvent("pointerenter", this, (e) => this.enter(e));
        registerPointerEvent("pointerleave", this, (e) => this.leave(e));

        // call the parent function
        super.onActivateEvent();
    }

    /**
     * function called when removed from the game world or a container
     * @ignore
     */
    onDeactivateEvent() {
        // release pointer events
        releasePointerEvent("pointerdown", this);
        releasePointerEvent("pointerup", this);
        releasePointerEvent("pointercancel", this);
        releasePointerEvent("pointerenter", this);
        releasePointerEvent("pointerleave", this);
        timer.clearTimeout(this.holdTimeout);
        this.holdTimeout = -1;

        // unregister on the global pointermove event
        // note: this is just a precaution, in case
        // the object is being remove from his parent
        // container before the leave function is called
        if (this.isDraggable === true) {
            off(POINTERMOVE, this.pointerMove);
            if (typeof this.grabOffset !== "undefined") {
                pool.push(this.grabOffset);
                this.grabOffset = undefined;
            }
        }

        // call the parent function
        super.onDeactivateEvent();
    }
}

export { UIBaseElement as default };
