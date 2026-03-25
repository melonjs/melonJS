import { game } from "../index.js";
import { Vector2d } from "../math/vector2d.ts";
import { Bounds } from "./../physics/bounds.ts";
import { globalToLocal } from "./input.ts";
import { locked } from "./pointerevent.ts";

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
	 * constant for left button
	 */
	LEFT: number;

	/**
	 * constant for middle button
	 */
	MIDDLE: number;

	/**
	 * constant for right button
	 */
	RIGHT: number;

	/**
	 * the originating Event Object
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent}
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent}
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent}
	 */
	event: PointerEvent | TouchEvent | MouseEvent | undefined;

	/**
	 * a string containing the event's type.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Event/type}
	 */
	override type: string = "";

	/**
	 * the button property indicates which button was pressed on the mouse to trigger the event.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button}
	 */
	button: number;

	/**
	 * indicates whether or not the pointer device that created the event is the primary pointer.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary}
	 */
	isPrimary: boolean;

	/**
	 * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX}
	 */
	pageX: number;

	/**
	 * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY}
	 */
	pageY: number;

	/**
	 * the horizontal coordinate within the application's client area at which the event occurred
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX}
	 */
	clientX: number;

	/**
	 * the vertical coordinate within the application's client area at which the event occurred
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY}
	 */
	clientY: number;

	/**
	 * the difference in the X coordinate of the pointer since the previous move event
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX}
	 */
	movementX: number;

	/**
	 * the difference in the Y coordinate of the pointer since the previous move event
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementY}
	 */
	movementY: number;

	/**
	 * an unsigned long representing the unit of the delta values scroll amount
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode}
	 */
	deltaMode: number;

	/**
	 * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX}
	 */
	deltaX: number;

	/**
	 * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY}
	 */
	deltaY: number;

	/**
	 * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ}
	 */
	deltaZ: number;

	/**
	 * Event normalized X coordinate within the game canvas itself<br>
	 * <img src="images/event_coord.png"/>
	 */
	gameX: number;

	/**
	 * Event normalized Y coordinate within the game canvas itself<br>
	 * <img src="images/event_coord.png"/>
	 */
	gameY: number;

	/**
	 * Event X coordinate relative to the viewport
	 */
	gameScreenX: number;

	/**
	 * Event Y coordinate relative to the viewport
	 */
	gameScreenY: number;

	/**
	 * Event X coordinate relative to the map
	 */
	gameWorldX: number;

	/**
	 * Event Y coordinate relative to the map
	 */
	gameWorldY: number;

	/**
	 * Event X coordinate relative to the holding container
	 */
	gameLocalX: number;

	/**
	 * Event Y coordinate relative to the holding container
	 */
	gameLocalY: number;

	/**
	 * The unique identifier of the contact for a touch, mouse or pen
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId}
	 */
	pointerId: number | undefined;

	/**
	 * true if not originally a pointer event
	 */
	isNormalized: boolean;

	/**
	 * true if the pointer is currently locked
	 */
	locked: boolean;

	// bind list for mouse buttons
	bind: (number | null)[];

	/**
	 * @ignore
	 */
	constructor(x: number = 0, y: number = 0, w: number = 1, h: number = 1) {
		// parent constructor
		super();

		// initial coordinates/size
		this.setMinMax(x, y, x + w, y + h);

		this.LEFT = 0;
		this.MIDDLE = 1;
		this.RIGHT = 2;

		this.event = undefined;
		this.type = "";
		this.button = 0;
		this.isPrimary = false;
		this.pageX = 0;
		this.pageY = 0;
		this.clientX = 0;
		this.clientY = 0;
		this.movementX = 0;
		this.movementY = 0;
		this.deltaMode = 0;
		this.deltaX = 0;
		this.deltaY = 0;
		this.deltaZ = 0;
		this.gameX = 0;
		this.gameY = 0;
		this.gameScreenX = 0;
		this.gameScreenY = 0;
		this.gameWorldX = 0;
		this.gameWorldY = 0;
		this.gameLocalX = 0;
		this.gameLocalY = 0;
		this.pointerId = undefined;
		this.isNormalized = false;
		this.locked = false;

		// bind list for mouse buttons
		this.bind = [0, 0, 0];
	}

	/**
	 * initialize the Pointer object using the given Event Object
	 * @param event - the original Event object
	 * @param pageX - the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
	 * @param pageY - the vertical coordinate at which the event occurred, relative to the left edge of the entire document
	 * @param clientX - the horizontal coordinate within the application's client area at which the event occurred
	 * @param clientY - the vertical coordinate within the application's client area at which the event occurred
	 * @param pointerId - the Pointer, Touch or Mouse event Id (1)
	 */
	setEvent(
		event: Event,
		pageX: number = 0,
		pageY: number = 0,
		clientX: number = 0,
		clientY: number = 0,
		pointerId: number = 1,
	): void {
		// the original event object
		this.event = event as PointerEvent | TouchEvent | MouseEvent;

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
		this.movementX = (event as any).movementX || 0;
		this.movementY = (event as any).movementY || 0;

		if (event.type === "wheel") {
			this.deltaMode = (event as any).deltaMode || 0;
			this.deltaX = (event as any).deltaX || 0;
			this.deltaY = (event as any).deltaY || 0;
			this.deltaZ = (event as any).deltaZ || 0;
		} else {
			this.deltaMode = 0;
			this.deltaX = 0;
			this.deltaY = 0;
			this.deltaZ = 0;
		}

		this.pointerId = pointerId;

		this.isPrimary =
			typeof (event as any).isPrimary !== "undefined"
				? (event as any).isPrimary
				: true;

		// in case of touch events, button is not defined
		this.button = (event as any).button || 0;

		this.type = event.type;

		// get the current screen to game world offset
		if (typeof game.viewport !== "undefined") {
			game.viewport.localToWorld(this.gameScreenX, this.gameScreenY, tmpVec);
		}

		/* Initialize the two coordinate space properties. */
		this.gameWorldX = tmpVec.x;
		this.gameWorldY = tmpVec.y;

		// get the pointer size
		if (!this.isNormalized) {
			// native PointerEvent
			this.width = (event as any).width || 1;
			this.height = (event as any).height || 1;
		} else if (typeof (event as any).radiusX === "number") {
			// TouchEvent
			this.width = (event as any).radiusX * 2 || 1;
			this.height = (event as any).radiusY * 2 || 1;
		} else {
			this.width = this.height = 1;
		}
	}
}

export default Pointer;
