import game from "../game";
import Container from "./container";
import timer  from "../system/timer";
import input  from "../input/input";

/**
 * @classdesc
 * This is a basic clickable container which you can use in your game UI.
 * Use this for example if you want to display a button which contains
 * text and images.
 *
 * @augments Container

 */
export default class BaseClickableContainer extends Container {
    /**
     *
     * @param {number} x The x position of the container
     * @param {number} y The y position of the container
     * @param {number} w width of the container (default: viewport width)
     * @param {number} h height of the container (default: viewport height)
     */
    constructor(x, y, w = game.viewport.width, h = game.viewport.height) {
        super(x, y, w, h);
        /**
         * object can be clicked or not
         * @public
         * @type {boolean}
         * @default true
         * @name BaseClickableContainer#isClickable
         */
        this.isClickable = true;

        /**
         * Tap and hold threshold timeout in ms
         * @type {number}
         * @default 250
         * @name BaseClickableContainer#holdThreshold
         */
        this.holdThreshold = 250;

        /**
         * object can be tap and hold
         * @public
         * @type {boolean}
         * @default false
         * @name BaseClickableContainer#isHoldable
         */
        this.isHoldable = false;

        /**
         * true if the pointer is over the object
         * @public
         * @type {boolean}
         * @default false
         * @name BaseClickableContainer#hover
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
                this.holdTimeout = timer.setTimeout(
                    this.hold.bind(this),
                    this.holdThreshold,
                    false
                );
                this.released = false;
            }
            return this.onClick(event);
        }
    }

    /**
     * function called when the object is pressed (to be extended)
     * @name onClick
     * @memberof BaseClickableContainer
     * @public
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
     * @name onOver
     * @memberof BaseClickableContainer
     * @public
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
     * @name onOut
     * @memberof BaseClickableContainer
     * @public
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
     * @name onRelease
     * @memberof BaseClickableContainer
     * @public
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
     * @name onHold
     * @memberof BaseClickableContainer
     * @public
     */
    onHold() {}

    /**
     * function called when added to the game world or a container
     * @ignore
     */
    onActivateEvent() {
        // register pointer events
        input.registerPointerEvent(
            "pointerdown",
            this,
            this.clicked.bind(this)
        );
        input.registerPointerEvent("pointerup", this, this.release.bind(this));
        input.registerPointerEvent(
            "pointercancel",
            this,
            this.release.bind(this)
        );
        input.registerPointerEvent("pointerenter", this, this.enter.bind(this));
        input.registerPointerEvent("pointerleave", this, this.leave.bind(this));
    }

    /**
     * function called when removed from the game world or a container
     * @ignore
     */
    onDeactivateEvent() {
        // release pointer events
        input.releasePointerEvent("pointerdown", this.hitbox);
        input.releasePointerEvent("pointerup", this);
        input.releasePointerEvent("pointercancel", this);
        input.releasePointerEvent("pointerenter", this);
        input.releasePointerEvent("pointerleave", this);
        timer.clearTimeout(this.holdTimeout);
    }
}
