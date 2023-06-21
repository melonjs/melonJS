/**
 * @classdesc
 * This is a basic clickable and draggable container which you can use in your game UI.
 * Use this for example if you want to display a panel that contains text, images or other UI elements.
 * @augments Container
 */
export default class UIBaseElement extends Container {
    /**
     *
     * @param {number} x - The x position of the container
     * @param {number} y - The y position of the container
     * @param {number} w - width of the container
     * @param {number} h - height of the container
     */
    constructor(x: number, y: number, w: number, h: number);
    /**
     * object can be clicked or not
     * @type {boolean}
     * @default true
     */
    isClickable: boolean;
    /**
     * object can be clicked or not
     * @type {boolean}
     * @default false
     */
    isDraggable: boolean;
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
    /**
     * false if the pointer is down, or true when the pointer status is up
     * @type {boolean}
     * @default false
     */
    released: boolean;
    holdTimeout: number;
    /**
     * function callback for the pointerdown event
     * @ignore
     */
    clicked(event: any): boolean | undefined;
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
    grabOffset: object | undefined;
    /**
     * pointermove function
     * @ignore
     */
    pointerMove(event: any): void;
    /**
     * function called when the pointer is moved over the object
     * @param {Pointer} event - the event object
     */
    onMove(event: Pointer): void;
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
    release(event: any): boolean | undefined;
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
}
import Container from "../container.js";
