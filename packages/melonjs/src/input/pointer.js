import { Vector2d } from "../math/vector2d.ts";
import { Bounds } from "./../physics/bounds.ts";
import { game } from "../index.js";
import { globalToLocal } from "./input.js";
import { locked } from "./pointerevent.js";

/**
 * a temporary vector object
 * @ignore
 */
const tmpVec = new Vector2d();

/**
 * a pointer object, representing a single finger on a touch enabled device.
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
		 */
		this.LEFT = 0;

		/**
		 * constant for middle button
		 * @public
		 * @type {number}
		 */
		this.MIDDLE = 1;

		/**
		 * constant for right button
		 * @public
		 * @type {number}
		 */
		this.RIGHT = 2;

		/**
		 * the originating Event Object
		 * @type {PointerEvent|TouchEvent|MouseEvent}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent}
		 */
		this.event = undefined;

		/**
		 * a string containing the event's type.
		 * @type {string}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Event/type}
		 */
		this.type = undefined;

		/**
		 * the button property indicates which button was pressed on the mouse to trigger the event.
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button}
		 */
		this.button = 0;

		/**
		 * indicates whether or not the pointer device that created the event is the primary pointer.
		 * @type {boolean}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary}
		 */
		this.isPrimary = false;

		/**
		 * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX}
		 */
		this.pageX = 0;

		/**
		 * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY}
		 */
		this.pageY = 0;

		/**
		 * the horizontal coordinate within the application's client area at which the event occurred
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX}
		 */
		this.clientX = 0;

		/**
		 * the vertical coordinate within the application's client area at which the event occurred
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY}
		 */
		this.clientY = 0;

		/**
		 * the difference in the X coordinate of the pointer since the previous move event
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX}
		 */
		this.movementX = 0;

		/**
		 * the difference in the Y coordinate of the pointer since the previous move event
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementY}
		 */
		this.movementY = 0;

		/**
		 * an unsigned long representing the unit of the delta values scroll amount
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode}
		 */
		this.deltaMode = 0;

		/**
		 * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX}
		 */
		this.deltaX = 0;

		/**
		 * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY}
		 */
		this.deltaY = 0;

		/**
		 * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ}
		 */
		this.deltaZ = 0;

		/**
		 * Event normalized X coordinate within the game canvas itself<br>
		 * <img src="images/event_coord.png"/>
		 * @type {number}
		 */
		this.gameX = 0;

		/**
		 * Event normalized Y coordinate within the game canvas itself<br>
		 * <img src="images/event_coord.png"/>
		 * @type {number}
		 */
		this.gameY = 0;

		/**
		 * Event X coordinate relative to the viewport
		 * @type {number}
		 */
		this.gameScreenX = 0;

		/**
		 * Event Y coordinate relative to the viewport
		 * @type {number}
		 */
		this.gameScreenY = 0;

		/**
		 * Event X coordinate relative to the map
		 * @type {number}
		 */
		this.gameWorldX = 0;

		/**
		 * Event Y coordinate relative to the map
		 * @type {number}
		 */
		this.gameWorldY = 0;

		/**
		 * Event X coordinate relative to the holding container
		 * @type {number}
		 */
		this.gameLocalX = 0;

		/**
		 * Event Y coordinate relative to the holding container
		 * @type {number}
		 */
		this.gameLocalY = 0;

		/**
		 * The unique identifier of the contact for a touch, mouse or pen
		 * @type {number}
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId}
		 */
		this.pointerId = undefined;

		/**
		 * true if not originally a pointer event
		 * @type {boolean}
		 */
		this.isNormalized = false;

		/**
		 * true if the pointer is currently locked
		 * @type {boolean}
		 */
		this.locked = false;

		// bind list for mouse buttons
		this.bind = [0, 0, 0];
	}

	/**
	 * initialize the Pointer object using the given Event Object
	 * @private
	 * @param {Event} event - the original Event object
	 * @param {number} [pageX=0] - the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
	 * @param {number} [pageY=0] - the vertical coordinate at which the event occurred, relative to the left edge of the entire document
	 * @param {number} [clientX=0] - the horizontal coordinate within the application's client area at which the event occurred
	 * @param {number} [clientY=0] - the vertical coordinate within the application's client area at which the event occurred
	 * @param {number} [pointerId=1] - the Pointer, Touch or Mouse event Id (1)
	 */
	setEvent(
		event,
		pageX = 0,
		pageY = 0,
		clientX = 0,
		clientY = 0,
		pointerId = 1,
	) {
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
		this.isNormalized =
			typeof globalThis.PointerEvent !== "undefined" &&
			!(event instanceof globalThis.PointerEvent);

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

		this.isPrimary =
			typeof event.isPrimary !== "undefined" ? event.isPrimary : true;

		// in case of touch events, button is not defined
		this.button = event.button || 0;

		this.type = event.type;

		// get the current screen to game world offset
		if (typeof game.viewport !== "undefined") {
			game.viewport.localToWorld(this.gameScreenX, this.gameScreenY, tmpVec);
		}

		/* Initialize the two coordinate space properties. */
		this.gameWorldX = tmpVec.x;
		this.gameWorldY = tmpVec.y;

		// get the pointer size
		if (this.isNormalized === false) {
			// native PointerEvent
			this.width = event.width || 1;
			this.height = event.height || 1;
		} else if (typeof event.radiusX === "number") {
			// TouchEvent
			this.width = event.radiusX * 2 || 1;
			this.height = event.radiusY * 2 || 1;
		} else {
			this.width = this.height = 1;
		}
	}
}

export default Pointer;
