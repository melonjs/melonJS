/**
 * @classdesc
 *  This is a basic sprite based button which you can use in your Game UI.
 * @augments Sprite
 */
export default class UISpriteElement extends Sprite {
    /**
     * @param {number} x - the x coordinate of the GUI Object
     * @param {number} y - the y coordinate of the GUI Object
     * @param {object} settings - See {@link Sprite}
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
    constructor(x: number, y: number, settings: object);
    /**
     * object can be clicked or not
     * @type {boolean}
     * @default true
     */
    isClickable: boolean;
    /**
     * Tap and hold threshold timeout in ms
     * @type {number}
     * @default 250
     */
    holdThreshold: number;
    /**
     * object can be tap and hold
     * @type {boolean}
     * @default false
     */
    isHoldable: boolean;
    /**
     * true if the pointer is over the object
     * @type {boolean}
     * @default false
     */
    hover: boolean;
    holdTimeout: number;
    released: boolean;
    /**
     * function callback for the pointerdown event
     * @ignore
     */
    clicked(event: any): boolean;
    dirty: boolean;
    /**
     * function called when the object is pressed (to be extended)
     * @param {Pointer} event - the event object
     * @returns {boolean} return false if we need to stop propagating the event
     */
    onClick(event: Pointer): boolean;
    /**
     * function callback for the pointerEnter event
     * @ignore
     */
    enter(event: any): void;
    /**
     * function called when the pointer is over the object
     * @param {Pointer} event - the event object
     */
    onOver(event: Pointer): void;
    /**
     * function callback for the pointerLeave event
     * @ignore
     */
    leave(event: any): void;
    /**
     * function called when the pointer is leaving the object area
     * @param {Pointer} event - the event object
     */
    onOut(event: Pointer): void;
    /**
     * function callback for the pointerup event
     * @ignore
     */
    release(event: any): boolean;
    /**
     * function called when the object is pressed and released (to be extended)
     * @returns {boolean} return false if we need to stop propagating the event
     */
    onRelease(): boolean;
    /**
     * function callback for the tap and hold timer event
     * @ignore
     */
    hold(): void;
    /**
     * function called when the object is pressed and held<br>
     * to be extended <br>
     */
    onHold(): void;
    /**
     * function called when added to the game world or a container
     * @ignore
     */
    onActivateEvent(): void;
    /**
     * function called when removed from the game world or a container
     * @ignore
     */
    onDeactivateEvent(): void;
}
import Sprite from "./../sprite.js";
