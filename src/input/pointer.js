import Vector2d from "./../math/vector2.js";
import device from "./../system/device.js";
import Bounds from "./../physics/bounds.js";
import { viewport } from "./../game.js";
import { globalToLocal } from "./input.js";
import { locked } from "./pointerevent.js";


/**
 * a temporary vector object
 * @ignore
 */
var tmpVec = new Vector2d();

/**
 * @classdesc
 * a pointer object, representing a single finger on a touch enabled device.
 * @class Pointer
 * @augments me.Bounds
 * @memberof me
 */
class Pointer extends Bounds {

    /**
     * @ignore
     */
    constructor(x = 0, y = 0, w = 1, h = 1) {

        // parent constructor
        super();

        // initial coordinates/size
        this.setMinMax(x, y, x + w, y + h);

        /**
         * constant for left button
         * @public
         * @type {number}
         * @name LEFT
         * @memberof me.Pointer
         */
        this.LEFT = 0;

        /**
         * constant for middle button
         * @public
         * @type {number}
         * @name MIDDLE
         * @memberof me.Pointer
         */
        this.MIDDLE = 1;

        /**
         * constant for right button
         * @public
         * @type {number}
         * @name RIGHT
         * @memberof me.Pointer
         */
        this.RIGHT = 2;

        /**
         * the originating Event Object
         * @public
         * @type {PointerEvent|TouchEvent|MouseEvent}
         * @name event
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
         * @see https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
         * @memberof me.Pointer
         */
        this.event = undefined;

        /**
         * a string containing the event's type.
         * @public
         * @type {string}
         * @name type
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Event/type
         * @memberof me.Pointer
         */
        this.type = undefined;


        /**
         * the button property indicates which button was pressed on the mouse to trigger the event.
         * @public
         * @type {number}
         * @name button
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
         * @memberof me.Pointer
         */
        this.button = 0;

        /**
         * indicates whether or not the pointer device that created the event is the primary pointer.
         * @public
         * @type {boolean}
         * @name isPrimary
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
         * @memberof me.Pointer
         */
        this.isPrimary = false;

        /**
         * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
         * @public
         * @type {number}
         * @name pageX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX
         * @memberof me.Pointer
         */
        this.pageX = 0;

        /**
         * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
         * @public
         * @type {number}
         * @name pageY
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY
         * @memberof me.Pointer
         */
        this.pageY = 0;

        /**
         * the horizontal coordinate within the application's client area at which the event occurred
         * @public
         * @type {number}
         * @name clientX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
         * @memberof me.Pointer
         */
        this.clientX = 0;

       /**
        * the vertical coordinate within the application's client area at which the event occurred
        * @public
        * @type {number}
        * @name clientY
        * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
        * @memberof me.Pointer
        */
        this.clientY = 0;

        /**
         * the difference in the X coordinate of the pointer since the previous move event
         * @public
         * @type {number}
         * @name movementX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX
         * @memberof me.Pointer
         */
        this.movementX = 0;

       /**
        * the difference in the Y coordinate of the pointer since the previous move event
        * @public
        * @type {number}
        * @name movementY
        * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementY
        * @memberof me.Pointer
        */
        this.movementY = 0;

        /**
         * an unsigned long representing the unit of the delta values scroll amount
         * @public
         * @type {number}
         * @name deltaMode
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
         * @memberof me.Pointer
         */
        this.deltaMode = 0;

        /**
         * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
         * @public
         * @type {number}
         * @name deltaX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX
         * @memberof me.Pointer
         */
        this.deltaX = 0;

        /**
         * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
         * @public
         * @type {number}
         * @name deltaY
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
         * @memberof me.Pointer
         */
        this.deltaY = 0;

        /**
         * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
         * @public
         * @type {number}
         * @name deltaZ
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ
         * @memberof me.Pointer
         */
        this.deltaZ = 0;

        /**
         * Event normalized X coordinate within the game canvas itself<br>
         * <img src="images/event_coord.png"/>
         * @public
         * @type {number}
         * @name gameX
         * @memberof me.Pointer
         */
        this.gameX = 0;

        /**
         * Event normalized Y coordinate within the game canvas itself<br>
         * <img src="images/event_coord.png"/>
         * @public
         * @type {number}
         * @name gameY
         * @memberof me.Pointer
         */
        this.gameY = 0;

        /**
         * Event X coordinate relative to the viewport
         * @public
         * @type {number}
         * @name gameScreenX
         * @memberof me.Pointer
         */
        this.gameScreenX = 0;

        /**
         * Event Y coordinate relative to the viewport
         * @public
         * @type {number}
         * @name gameScreenY
         * @memberof me.Pointer
         */
        this.gameScreenY = 0;

        /**
         * Event X coordinate relative to the map
         * @public
         * @type {number}
         * @name gameWorldX
         * @memberof me.Pointer
         */
        this.gameWorldX = 0;

        /**
         * Event Y coordinate relative to the map
         * @public
         * @type {number}
         * @name gameWorldY
         * @memberof me.Pointer
         */
        this.gameWorldY = 0;

        /**
         * Event X coordinate relative to the holding container
         * @public
         * @type {number}
         * @name gameLocalX
         * @memberof me.Pointer
         */
        this.gameLocalX = 0;

        /**
         * Event Y coordinate relative to the holding container
         * @public
         * @type {number}
         * @name gameLocalY
         * @memberof me.Pointer
         */
        this.gameLocalY = 0;

       /**
        * The unique identifier of the contact for a touch, mouse or pen
        * @public
        * @type {number}
        * @name pointerId
        * @memberof me.Pointer
        * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
        */
        this.pointerId = undefined;

        /**
         * true if not originally a pointer event
         * @public
         * @type {boolean}
         * @name isNormalized
         * @memberof me.Pointer
         */
        this.isNormalized = false;

        /**
         * true if the pointer is currently locked
         * @public
         * @type {boolean}
         * @name locked
         * @memberof me.Pointer
         */
        this.locked = false;

        // bind list for mouse buttons
        this.bind = [ 0, 0, 0 ];
    }

    /**
     * initialize the Pointer object using the given Event Object
     * @name me.Pointer#set
     * @private
     * @function
     * @param {Event} event the original Event object
     * @param {number} [pageX=0] the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {number} [pageY=0] the vertical coordinate at which the event occurred, relative to the left edge of the entire document
     * @param {number} [clientX=0] the horizontal coordinate within the application's client area at which the event occurred
     * @param {number} [clientY=0] the vertical coordinate within the application's client area at which the event occurred
     * @param {number} [pointerId=1] the Pointer, Touch or Mouse event Id (1)
     */
    setEvent(event, pageX = 0, pageY = 0, clientX = 0, clientY = 0, pointerId = 1) {
        // the original event object
        this.event = event;

        this.pageX = pageX;
        this.pageY = pageY;
        this.clientX = clientX;
        this.clientY = clientY;

        // translate to local coordinates
        globalToLocal(this.pageX, this.pageY, tmpVec);
        this.gameScreenX = this.x = tmpVec.x;
        this.gameScreenY = this.y = tmpVec.y;

        // true if not originally a pointer event
        this.isNormalized = !device.PointerEvent || (device.PointerEvent && !(event instanceof window.PointerEvent));

        this.locked = locked;
        this.movementX = event.movementX || 0;
        this.movementY = event.movementY || 0;

        if (event.type === "wheel") {
            this.deltaMode = event.deltaMode || 0;
            this.deltaX = event.deltaX || 0;
            this.deltaY = event.deltaY || 0;
            this.deltaZ = event.deltaZ || 0;
        } else {
            this.deltaMode = 0;
            this.deltaX = 0;
            this.deltaY = 0;
            this.deltaZ = 0;
        }

        this.pointerId = pointerId;

        this.isPrimary = (typeof event.isPrimary !== "undefined") ? event.isPrimary : true;

        // in case of touch events, button is not defined
        this.button = event.button || 0;

        this.type = event.type;

        // get the current screen to game world offset
        if (typeof viewport !== "undefined") {
            viewport.localToWorld(this.gameScreenX, this.gameScreenY, tmpVec);
        }

        /* Initialize the two coordinate space properties. */
        this.gameWorldX = tmpVec.x;
        this.gameWorldY = tmpVec.y;

        // get the pointer size
        if (this.isNormalized === false) {
            // native PointerEvent
            this.width = event.width || 1;
            this.height = event.height || 1;
        } else if (typeof(event.radiusX) === "number") {
            // TouchEvent
            this.width = (event.radiusX * 2) || 1;
            this.height = (event.radiusY * 2) || 1;
        } else {
            this.width = this.height = 1;
        }
    }
};

export default Pointer;
