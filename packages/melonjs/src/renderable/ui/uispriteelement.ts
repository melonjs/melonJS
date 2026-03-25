import {
	registerPointerEvent,
	releasePointerEvent,
} from "./../../input/input.ts";
import type Pointer from "./../../input/pointer.ts";
import timer from "./../../system/timer.ts";
import Sprite from "./../sprite.js";

/**
 * This is a basic sprite based button which you can use in your Game UI.
 * @category UI
 */
export default class UISpriteElement extends Sprite {
	/**
	 * if this UISpriteElement should use screen coordinates or local coordinates
	 * (Note: any UISpriteElement elements added to a floating parent container should have their floating property to false)
	 * @see Renderable.floating
	 * @default true
	 */
	override floating = true;

	/**
	 * object can be clicked or not
	 * @default true
	 */
	isClickable: boolean;

	/**
	 * Tap and hold threshold timeout in ms
	 * @default 250
	 */
	holdThreshold: number;

	/**
	 * object can be tap and hold
	 * @default false
	 */
	isHoldable: boolean;

	/**
	 * true if the pointer is over the object
	 * @default false
	 */
	hover: boolean;

	// object has been updated (clicked,etc..)
	holdTimeout: number;
	released: boolean;

	/**
	 * @param x - the x coordinate of the UISpriteElement Object
	 * @param y - the y coordinate of the UISpriteElement Object
	 * @param settings - See {@link Sprite}
	 * @param settings.image - the image to use for the sprite
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
	constructor(
		x: number,
		y: number,
		settings: { image: any; [key: string]: any },
	) {
		// call the parent constructor
		super(x, y, settings);

		this.isClickable = true;
		this.holdThreshold = 250;
		this.isHoldable = false;
		this.hover = false;
		this.holdTimeout = -1;
		this.released = true;

		// enable event detection
		this.isKinematic = false;
	}

	/**
	 * function callback for the pointerdown event
	 * @ignore
	 */
	clicked(event: Pointer): boolean | void {
		// Check if left mouse button is pressed
		if (event.button === 0 && this.isClickable) {
			this.isDirty = true;
			this.released = false;
			if (this.isHoldable) {
				timer.clearTimer(this.holdTimeout);
				this.holdTimeout = timer.setTimeout(
					() => {
						this.hold();
					},
					this.holdThreshold,
					false,
				);
				this.released = false;
			}
			return this.onClick(event);
		}
	}

	/**
	 * function called when the object is pressed (to be extended)
	 * @param _event - the event object
	 * @returns return false if we need to stop propagating the event
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onClick(_event?: Pointer): boolean {
		return false;
	}

	/**
	 * function callback for the pointerEnter event
	 * @ignore
	 */
	enter(event: Pointer): void {
		this.hover = true;
		this.isDirty = true;
		this.onOver(event);
	}

	/**
	 * function called when the pointer is over the object
	 * @param _event - the event object
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onOver(_event?: Pointer): void {
		// to be extended
	}

	/**
	 * function callback for the pointerLeave event
	 * @ignore
	 */
	leave(event: Pointer): void {
		this.hover = false;
		this.isDirty = true;
		this.release(event);
		this.onOut(event);
	}

	/**
	 * function called when the pointer is leaving the object area
	 * @param _event - the event object
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onOut(_event?: Pointer): void {
		// to be extended
	}

	/**
	 * function callback for the pointerup event
	 * @ignore
	 */
	release(event: Pointer): boolean | void {
		if (!this.released) {
			this.released = true;
			this.isDirty = true;
			timer.clearTimer(this.holdTimeout);
			this.holdTimeout = -1;
			return this.onRelease(event);
		}
	}

	/**
	 * function called when the object is pressed and released (to be extended)
	 * @param _event - the event object
	 * @returns return false if we need to stop propagating the event
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onRelease(_event?: Pointer): boolean {
		return false;
	}

	/**
	 * function callback for the tap and hold timer event
	 * @ignore
	 */
	hold(): void {
		timer.clearTimer(this.holdTimeout);
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
	onHold(): void {}

	/**
	 * function called when added to the game world or a container
	 * @ignore
	 */
	onActivateEvent(): void {
		// register pointer events
		registerPointerEvent("pointerdown", this, (e) => {
			return this.clicked(e);
		});
		registerPointerEvent("pointerup", this, (e) => {
			return this.release(e);
		});
		registerPointerEvent("pointercancel", this, (e) => {
			return this.release(e);
		});
		registerPointerEvent("pointerenter", this, (e) => {
			this.enter(e);
		});
		registerPointerEvent("pointerleave", this, (e) => {
			this.leave(e);
		});
	}

	/**
	 * function called when removed from the game world or a container
	 * @ignore
	 */
	onDeactivateEvent(): void {
		// release pointer events
		releasePointerEvent("pointerdown", this);
		releasePointerEvent("pointerup", this);
		releasePointerEvent("pointercancel", this);
		releasePointerEvent("pointerenter", this);
		releasePointerEvent("pointerleave", this);
		timer.clearTimer(this.holdTimeout);
		this.holdTimeout = -1;
	}
}
