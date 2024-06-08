/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import timer from '../../system/timer.js';
import Sprite from '../sprite.js';
import { registerPointerEvent, releasePointerEvent } from '../../input/pointerevent.js';

/**
 * @classdesc
 * This is a basic sprite based button which you can use in your Game UI.
 * @augments Sprite
 */
class UISpriteElement extends Sprite {
    /**
     * @param {number} x - the x coordinate of the UISpriteElement Object
     * @param {number} y - the y coordinate of the UISpriteElement Object
     * @param {object} settings - See {@link Sprite}
     * @example
     * // create a basic GUI Object
     * class myButton extends UISpriteElement {
     *    constructor(x, y) {
     *       // call the UISpriteElement parent constructor
     *       super(x, y, {
     *          image: "button",
     *          framewidth: 100,
     *          frameheight: 50
     *       });
     *    }
     *
     *    // output something in the console
     *    // when the object is clicked
     *    onClick(event) {
     *       console.log("clicked!");
     *       // don't propagate the event
     *       return false;
     *    }
     * });
     *
     * // add the object at pos (10,10)
     * world.addChild(new myButton(10,10));
     */
    constructor(x, y, settings) {

        // call the parent constructor
        super(x, y, settings);

        /**
         * object can be clicked or not
         * @type {boolean}
         * @default true
         */
        this.isClickable = true;

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

        // object has been updated (clicked,etc..)
        this.holdTimeout = -1;
        this.released = true;

        /**
         * if this UISpriteElement should use screen coordinates or local coordinates
         * (Note: any UISpriteElement elements added to a floating parent container should have their floating property to false)
         * @see Renderable.floating
         * @type {boolean}
         * @default true
         */
        this.floating = true;

        // enable event detection
        this.isKinematic = false;
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
                this.holdTimeout = timer.setTimeout(() => this.hold(), this.holdThreshold, false);
                this.released = false;
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
        return false;
    }

    /**
     * function callback for the pointerEnter event
     * @ignore
     */
    enter(event) {
        this.hover = true;
        this.isDirty = true;
        return this.onOver(event);
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
        return false;
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
    onHold() {
    }

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
    }
}

export { UISpriteElement as default };
