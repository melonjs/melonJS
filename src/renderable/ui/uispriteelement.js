import timer from "./../../system/timer.js";
import Sprite from "./../sprite.js";
import { registerPointerEvent, releasePointerEvent} from "./../../input/input.js";

/**
 * @classdesc
 *  This is a basic sprite based button which you can use in your Game UI.
 * @augments Sprite
 */
class UISpriteElement extends Sprite {
    /**
     * @param {number} x the x coordinate of the GUI Object
     * @param {number} y the y coordinate of the GUI Object
     * @param {object} settings See {@link Sprite}
     * @example
     * // create a basic GUI Object
     * class myButton extends UISpriteElement {
     *    constructor(x, y) {
     *       var settings = {}
     *       settings.image = "button";
     *       settings.framewidth = 100;
     *       settings.frameheight = 50;
     *       // super constructor
     *       super(x, y, settings);
     *       // define the object z order
     *       this.pos.z = 4;
     *    }
     *
     *    // output something in the console
     *    // when the object is clicked
     *    onClick:function (event) {
     *       console.log("clicked!");
     *       // don't propagate the event
     *       return false;
     *    }
     * });
     *
     * // add the object at pos (10,10)
     * me.game.world.addChild(new myButton(10,10));
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
        this.holdTimeout = null;
        this.released = true;

        // GUI items use screen coordinates
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
            this.dirty = true;
            this.released = false;
            if (this.isHoldable) {
                if (this.holdTimeout !== null) {
                    timer.clearTimeout(this.holdTimeout);
                }
                this.holdTimeout = timer.setTimeout(this.hold.bind(this), this.holdThreshold, false);
                this.released = false;
            }
            return this.onClick(event);
        }
    }

    /**
     * function called when the object is pressed (to be extended)
     * @param {Pointer} event the event object
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
        this.dirty = true;
        return this.onOver(event);
    }

    /**
     * function called when the pointer is over the object
     * @param {Pointer} event the event object
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
        this.dirty = true;
        this.release(event);
        return this.onOut(event);
    }

    /**
     * function called when the pointer is leaving the object area
     * @param {Pointer} event the event object
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
            this.dirty = true;
            timer.clearTimeout(this.holdTimeout);
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
        this.dirty = true;
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
        registerPointerEvent("pointerdown", this, this.clicked.bind(this));
        registerPointerEvent("pointerup", this, this.release.bind(this));
        registerPointerEvent("pointercancel", this, this.release.bind(this));
        registerPointerEvent("pointerenter", this, this.enter.bind(this));
        registerPointerEvent("pointerleave", this, this.leave.bind(this));
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
    }
}
export default UISpriteElement;
