import {
	registerPointerEvent,
	releasePointerEvent,
} from "./../../input/input.ts";
import type Pointer from "./../../input/pointer.ts";
import type { Vector2d } from "../../math/vector2d.ts";
import { vector2dPool } from "../../math/vector2d.ts";
import { off, on, POINTERMOVE } from "../../system/event.ts";
import timer from "../../system/timer.ts";
import Container from "../container.js";

/**
 * This is a basic clickable and draggable container which you can use in your game UI.
 * Use this for example if you want to display a panel that contains text, images or other UI elements.
 *
 * Regions under the pointer are asked in the order they are drawn, topmost
 * first, and the walk carries on downwards until a handler returns `false`. An
 * element that can overlap another one is therefore not opaque until it says
 * so: by default a widget it covers still answers clicks and still lights up on
 * hover. {@link UIBaseElement#onClick}, {@link UIBaseElement#onRelease} and
 * {@link UIBaseElement#onOver} each consume by returning `false`.
 * @category UI
 * @example
 * // a panel that is opaque to the pointer and comes to the front when picked
 * class Panel extends UIBaseElement {
 *     onClick() {
 *         this.ancestor.moveToTop(this);
 *         return false;
 *     }
 *     // the frame the pointer crosses in
 *     onOver() {
 *         return false;
 *     }
 *     // and every frame after that, when the pointer is already inside and
 *     // `onOver` no longer fires
 *     onActivateEvent() {
 *         super.onActivateEvent();
 *         me.input.registerPointerEvent("pointermove", this, () => false);
 *     }
 *     onDeactivateEvent() {
 *         me.input.releasePointerEvent("pointermove", this);
 *         super.onDeactivateEvent();
 *     }
 * }
 */
export default class UIBaseElement extends Container {
	/**
	 * UI base elements use screen coordinates by default
	 * (Note: any child elements added to a UIBaseElement should have their floating property to false)
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
	 * object can be dragged or not
	 * @default false
	 */
	isDraggable: boolean;

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

	/**
	 * false if the pointer is down, or true when the pointer status is up
	 * @default true
	 */
	released: boolean;

	// object has been updated (clicked,etc..)
	holdTimeout: number;

	// grab offset for dragging
	grabOffset: Vector2d | undefined;

	/**
	 * @param x - The x position of the container
	 * @param y - The y position of the container
	 * @param w - width of the container
	 * @param h - height of the container
	 */
	constructor(x: number, y: number, w?: number, h?: number) {
		super(x, y, w, h);

		this.isClickable = true;
		this.isDraggable = false;
		this.holdThreshold = 250;
		this.isHoldable = false;
		this.hover = false;
		this.released = true;
		this.holdTimeout = -1;

		// enable event detection
		this.isKinematic = false;

		// update container and children bounds automatically
		this.enableChildBoundsUpdate = true;
	}

	/**
	 * function callback for the pointerdown event
	 * @ignore
	 * @internal
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
			if (this.isDraggable) {
				this.grabOffset!.set(event.gameX, event.gameY);
				this.grabOffset!.sub(this.pos);
			}
			return this.onClick(event);
		}
	}

	/**
	 * function called when the object is pressed (to be extended)
	 * @param _event - the event object
	 * @returns return false if we need to stop propagating the event
	 */

	onClick(_event?: Pointer): boolean {
		return true;
	}

	/**
	 * function callback for the pointerEnter event
	 * @ignore
	 * @internal
	 */
	enter(event: Pointer): boolean | void {
		this.hover = true;
		this.isDirty = true;
		if (this.isDraggable) {
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(POINTERMOVE, this.pointerMove, this);
			// to memorize where we grab the object
			this.grabOffset = vector2dPool.get(0, 0);
		}
		return this.onOver(event);
	}

	/**
	 * pointermove function
	 * @ignore
	 * @internal
	 */
	pointerMove(event: Pointer): void {
		if (this.hover && !this.released) {
			// follow the pointer
			// pos is ObservableVector3d at runtime but typed as Vector2d in Renderable
			(this.pos as any).set(event.gameX, event.gameY, (this.pos as any).z);
			(this.pos as any).sub(this.grabOffset!);
			// mark the container for redraw
			this.isDirty = true;
			this.onMove(event);
			return;
		}
	}

	/**
	 * function called when the pointer is moved over the object
	 * @param _event - the event object
	 */

	onMove(_event?: Pointer): void {
		// to be extended
	}

	/**
	 * function called when the pointer is over the object.
	 *
	 * Fires once, on the frame the pointer crosses into the element. To stay
	 * opaque for as long as the pointer rests on it, an element also wants a
	 * `"pointermove"` callback registered through
	 * {@link input.registerPointerEvent} returning `false`, since by then the
	 * pointer is already inside and this no longer runs.
	 * @param _event - the event object
	 * @returns return false if we need to stop propagating the event, so that an
	 * element covered by this one does not also light up on hover
	 */

	onOver(_event?: Pointer): boolean | void {
		// to be extended
	}

	/**
	 * function callback for the pointerLeave event
	 * @ignore
	 * @internal
	 */
	leave(event: Pointer): void {
		this.hover = false;
		this.isDirty = true;
		if (this.isDraggable) {
			// unregister on the global pointermove event
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(POINTERMOVE, this.pointerMove, this);
			vector2dPool.release(this.grabOffset!);
			this.grabOffset = undefined;
		}
		this.release(event);
		this.onOut(event);
	}

	/**
	 * function called when the pointer is leaving the object area.
	 *
	 * Fires when the pointer leaves the element's bounds, and also when it is
	 * still inside them but something drawn above has consumed the move, since
	 * the pointer is then over that instead.
	 *
	 * Unlike {@link UIBaseElement#onOver} this one cannot consume the event, on
	 * purpose: an element that suppressed its own leave would stay in its hover
	 * state after the pointer had gone.
	 * @param _event - the event object
	 */

	onOut(_event?: Pointer): void {
		// to be extended
	}

	/**
	 * function callback for the pointerup event
	 * @ignore
	 * @internal
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

	onRelease(_event?: Pointer): boolean {
		return true;
	}

	/**
	 * function callback for the tap and hold timer event
	 * @ignore
	 * @internal
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
	 * @internal
	 */
	override onActivateEvent(): void {
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
			return this.enter(e);
		});
		registerPointerEvent("pointerleave", this, (e) => {
			this.leave(e);
		});

		// call the parent function
		super.onActivateEvent();
	}

	/**
	 * function called when removed from the game world or a container
	 * @ignore
	 * @internal
	 */
	override onDeactivateEvent(): void {
		// release pointer events
		releasePointerEvent("pointerdown", this);
		releasePointerEvent("pointerup", this);
		releasePointerEvent("pointercancel", this);
		releasePointerEvent("pointerenter", this);
		releasePointerEvent("pointerleave", this);
		timer.clearTimer(this.holdTimeout);
		this.holdTimeout = -1;

		// unregister on the global pointermove event
		// note: this is just a precaution, in case
		// the object is being remove from his parent
		// container before the leave function is called
		if (this.isDraggable) {
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(POINTERMOVE, this.pointerMove, this);
			if (typeof this.grabOffset !== "undefined") {
				vector2dPool.release(this.grabOffset);
				this.grabOffset = undefined;
			}
		}

		// call the parent function
		super.onDeactivateEvent();
	}
}
