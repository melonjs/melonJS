export default Pointer;
/**
 * @classdesc
 * a pointer object, representing a single finger on a touch enabled device.
 * @class Pointer
 * @augments Bounds
 */
declare class Pointer extends Bounds {
    /**
     * @ignore
     */
    constructor(x?: number, y?: number, w?: number, h?: number);
    /**
     * constant for left button
     * @public
     * @type {number}
     * @name LEFT
     * @memberof Pointer
     */
    public LEFT: number;
    /**
     * constant for middle button
     * @public
     * @type {number}
     * @name MIDDLE
     * @memberof Pointer
     */
    public MIDDLE: number;
    /**
     * constant for right button
     * @public
     * @type {number}
     * @name RIGHT
     * @memberof Pointer
     */
    public RIGHT: number;
    /**
     * the originating Event Object
     * @public
     * @type {PointerEvent|TouchEvent|MouseEvent}
     * @name event
     * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
     * @see https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
     * @memberof Pointer
     */
    public event: PointerEvent | TouchEvent | MouseEvent;
    /**
     * the button property indicates which button was pressed on the mouse to trigger the event.
     * @public
     * @type {number}
     * @name button
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
     * @memberof Pointer
     */
    public button: number;
    /**
     * indicates whether or not the pointer device that created the event is the primary pointer.
     * @public
     * @type {boolean}
     * @name isPrimary
     * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
     * @memberof Pointer
     */
    public isPrimary: boolean;
    /**
     * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
     * @public
     * @type {number}
     * @name pageX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX
     * @memberof Pointer
     */
    public pageX: number;
    /**
     * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
     * @public
     * @type {number}
     * @name pageY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY
     * @memberof Pointer
     */
    public pageY: number;
    /**
     * the horizontal coordinate within the application's client area at which the event occurred
     * @public
     * @type {number}
     * @name clientX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
     * @memberof Pointer
     */
    public clientX: number;
    /**
    * the vertical coordinate within the application's client area at which the event occurred
    * @public
    * @type {number}
    * @name clientY
    * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
    * @memberof Pointer
    */
    public clientY: number;
    /**
     * the difference in the X coordinate of the pointer since the previous move event
     * @public
     * @type {number}
     * @name movementX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX
     * @memberof Pointer
     */
    public movementX: number;
    /**
    * the difference in the Y coordinate of the pointer since the previous move event
    * @public
    * @type {number}
    * @name movementY
    * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementY
    * @memberof Pointer
    */
    public movementY: number;
    /**
     * an unsigned long representing the unit of the delta values scroll amount
     * @public
     * @type {number}
     * @name deltaMode
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
     * @memberof Pointer
     */
    public deltaMode: number;
    /**
     * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
     * @public
     * @type {number}
     * @name deltaX
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX
     * @memberof Pointer
     */
    public deltaX: number;
    /**
     * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
     * @public
     * @type {number}
     * @name deltaY
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
     * @memberof Pointer
     */
    public deltaY: number;
    /**
     * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
     * @public
     * @type {number}
     * @name deltaZ
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ
     * @memberof Pointer
     */
    public deltaZ: number;
    /**
     * Event normalized X coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @public
     * @type {number}
     * @name gameX
     * @memberof Pointer
     */
    public gameX: number;
    /**
     * Event normalized Y coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @public
     * @type {number}
     * @name gameY
     * @memberof Pointer
     */
    public gameY: number;
    /**
     * Event X coordinate relative to the viewport
     * @public
     * @type {number}
     * @name gameScreenX
     * @memberof Pointer
     */
    public gameScreenX: number;
    /**
     * Event Y coordinate relative to the viewport
     * @public
     * @type {number}
     * @name gameScreenY
     * @memberof Pointer
     */
    public gameScreenY: number;
    /**
     * Event X coordinate relative to the map
     * @public
     * @type {number}
     * @name gameWorldX
     * @memberof Pointer
     */
    public gameWorldX: number;
    /**
     * Event Y coordinate relative to the map
     * @public
     * @type {number}
     * @name gameWorldY
     * @memberof Pointer
     */
    public gameWorldY: number;
    /**
     * Event X coordinate relative to the holding container
     * @public
     * @type {number}
     * @name gameLocalX
     * @memberof Pointer
     */
    public gameLocalX: number;
    /**
     * Event Y coordinate relative to the holding container
     * @public
     * @type {number}
     * @name gameLocalY
     * @memberof Pointer
     */
    public gameLocalY: number;
    /**
    * The unique identifier of the contact for a touch, mouse or pen
    * @public
    * @type {number}
    * @name pointerId
    * @memberof Pointer
    * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
    */
    public pointerId: number;
    /**
     * true if not originally a pointer event
     * @public
     * @type {boolean}
     * @name isNormalized
     * @memberof Pointer
     */
    public isNormalized: boolean;
    /**
     * true if the pointer is currently locked
     * @public
     * @type {boolean}
     * @name locked
     * @memberof Pointer
     */
    public locked: boolean;
    bind: number[];
    /**
     * initialize the Pointer object using the given Event Object
     * @name Pointer#set
     * @private
     * @param {Event} event - the original Event object
     * @param {number} [pageX=0] - the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {number} [pageY=0] - the vertical coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {number} [clientX=0] - the horizontal coordinate within the application's client area at which the event occurred
     * @param {number} [clientY=0] - the vertical coordinate within the application's client area at which the event occurred
     * @param {number} [pointerId=1] - the Pointer, Touch or Mouse event Id (1)
     */
    private setEvent;
}
import Bounds from "./../physics/bounds.js";
