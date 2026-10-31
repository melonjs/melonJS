import {
	registerPointerEvent,
	releasePointerEvent,
} from "./../../input/input.ts";
import type Pointer from "./../../input/pointer.ts";
import type { Vector2d } from "../../math/vector2d.ts";
import { vector2dPool } from "../../math/vector2d.ts";
import * as device from "../../system/device.ts";
import { off, on, POINTERMOVE } from "../../system/event.ts";
import timer from "../../system/timer.ts";
import type Renderer from "../../video/renderer.js";
import Container from "../container.js";
import { PanelPainter } from "./panelpaint.ts";
import type { UINavAction } from "./uifocus.ts";
import {
	focusOwner,
	ringVisible,
	setFocus,
	trackElement,
	untrackElement,
} from "./uifocus.ts";

/** draws the focus ring of whichever element has the focus */
const ringPainter = new PanelPainter();

/**
 * The bounce settings every UI widget takes: see
 * {@link UIBaseElement#hoverScale}.
 * @category UI
 */
export interface UIJuiceSettings {
	/**
	 * the scale the widget grows to under the pointer or with the focus;
	 * `1`, the default, is still
	 */
	hoverScale?: number;
	/** the scale it shrinks to while held down; `1`, the default, is still */
	pressScale?: number;
}

/** the bounce's time constant, in milliseconds: about 0.2 s there */
const JUICE_TIME = 60;

/**
 * Whether a pointer event is the pointer coming up, rather than leaving or
 * being cancelled. The dispatcher only delivers it to a region under the
 * pointer, so for a widget it means a press completed over it.
 * @param event - the event a widget's `release` was called with
 * @returns true for a pointer, mouse or touch up
 * @ignore
 * @internal
 */
export function isPointerUp(event: Pointer | undefined): boolean {
	const type = event?.type;
	return type === "pointerup" || type === "mouseup" || type === "touchend";
}

/**
 * The DOM events that end a drag, listened for on the window so a drag ends
 * wherever the pointer is let go: the same family the engine itself listens
 * to, pointer events where the browser has them, mouse and touch otherwise.
 * Listening to both would let a second finger, which also fires touch
 * events, end a drag it has nothing to do with.
 * @ignore
 * @internal
 */
export const END_EVENTS: readonly string[] = device.pointerEvent
	? ["pointerup", "pointercancel"]
	: ["mouseup", "touchend", "touchcancel"];

/**
 * Whether a DOM event ends the drag of a given pointer.
 * @param event - one of {@link END_EVENTS}
 * @param pointerId - the pointer the drag follows: a pointer id, a touch
 * identifier, or 1 for the mouse
 * @returns true for that pointer's release only
 * @ignore
 * @internal
 */
export function endsPointer(event: Event, pointerId: number | undefined) {
	if (
		typeof globalThis.PointerEvent !== "undefined" &&
		event instanceof globalThis.PointerEvent
	) {
		return event.pointerId === pointerId;
	}
	const touches = (event as TouchEvent).changedTouches as TouchList | undefined;
	if (touches !== undefined) {
		for (let i = 0; i < touches.length; i++) {
			if (touches[i].identifier === pointerId) {
				return true;
			}
		}
		return false;
	}
	// a mouse: its main button
	return (event as MouseEvent).button === 0;
}

/**
 * Hand a press to the nearest scrolling panel above an element, if any, so
 * that a drag starting on the element can still scroll the panel.
 *
 * Found by the method rather than by class, as `UIPanel` extends this class
 * and could not be imported here without a cycle.
 * @param element - the element pressed
 * @param event - the pointer-down
 * @ignore
 * @internal
 */
function offerPressToScroller(element: UIBaseElement, event: Pointer) {
	for (let node: any = element.ancestor; node != null; node = node.ancestor) {
		// a panel that does not scroll answers false and the search goes on,
		// so a plain panel inside a scrolling one does not stop it
		if (
			typeof node._capturePress === "function" &&
			node._capturePress(event, element) === true
		) {
			return;
		}
	}
}

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
				// a tap on a touch screen comes with no hover before it, so
				// `enter` never set the drag up
				this.listenForDrag();
				this.grabOffset!.set(event.gameX, event.gameY);
				this.grabOffset!.sub(this.pos);
			} else if (!this.keepsDrag) {
				offerPressToScroller(this, event);
			}
			return this.onClick(event);
		}
	}

	/**
	 * Whether a drag that starts on this element belongs to it.
	 *
	 * `false` by default: inside a scrolling {@link UIPanel}, a drag that
	 * starts on a button scrolls the panel and cancels the press. Set it on a
	 * widget that is dragged itself, such as a knob or a colour picker, as
	 * {@link UISlider} does. Anything `isDraggable` keeps its drags anyway.
	 * @default false
	 */
	keepsDrag = false;

	/** @ignore */
	protected _enabled = true;

	/**
	 * The scale the widget is drawn at under the pointer, or with the focus:
	 * a little bounce, such as `1.05`. `1` leaves it still.
	 *
	 * Only the drawing scales, about the widget's centre: its hit area and
	 * its place in a layout stay as they are, so nothing jitters or moves
	 * the widgets around it. The scale eases there and back by itself.
	 * @default 1
	 */
	hoverScale = 1;

	/**
	 * The scale the widget is drawn at while held down, such as `0.92`.
	 * `1` leaves it still. See {@link UIBaseElement#hoverScale}.
	 * @default 1
	 */
	pressScale = 1;

	/** the scale drawn now, easing toward the one wanted */
	private _juice = 1;

	/**
	 * Whether this element can take the keyboard and gamepad focus: see
	 * {@link UIBaseElement#focus}. Buttons, checkboxes and sliders set it.
	 * @default false
	 */
	focusable = false;

	/**
	 * The colour of the ring drawn around the element with the focus.
	 * @default "#ffcc33"
	 */
	static focusRingColor = "#ffcc33";

	/**
	 * The element with the keyboard and gamepad focus, if any.
	 */
	static get focusOwner(): UIBaseElement | undefined {
		return focusOwner();
	}

	/** whether this element has the keyboard and gamepad focus */
	get focused(): boolean {
		return focusOwner() === this;
	}

	/**
	 * Take the keyboard and gamepad focus, for a game played without a mouse
	 * or a touch screen.
	 *
	 * Nothing has the focus until a game gives it to an element, and until
	 * then the arrow keys and the pad are left alone. From then on the arrows
	 * or a pad's D-pad move the focus to the nearest focusable element that
	 * way, and Enter, Space or the pad's A press the focused one as a click
	 * does; a slider steps on left and right instead. A ring shows the focus,
	 * and hides while the mouse is used. A focused element in a scrolling
	 * panel is scrolled into view.
	 *
	 * Does nothing on an element that is not `focusable`.
	 * @example
	 * // a menu played with the keyboard or a pad: start on Play
	 * playButton.focus();
	 */
	focus(): void {
		if (this.focusable) {
			setFocus(this);
		}
	}

	/**
	 * Give up the focus, if this element has it. With nothing focused, the
	 * arrow keys and the pad are left to the game again.
	 */
	blur(): void {
		if (this.focused) {
			setFocus(undefined);
		}
	}

	/**
	 * An arrow key or a D-pad direction while this element has the focus:
	 * return `true` to say it was handled, as a slider does to step, and the
	 * focus stays. Unhandled, it moves the focus to the nearest widget that
	 * way. Enter or A presses the widget instead, as a click does, through
	 * {@link UIBaseElement#focusPress} and {@link UIBaseElement#focusRelease}.
	 * @param _action - which way
	 * @returns true when handled
	 */
	onNavigate(_action: UINavAction): boolean {
		return false;
	}

	/**
	 * Accept was pressed with the focus here: the widget goes down, as under
	 * a pointer, and `onClick` runs with no event.
	 * @returns whether it went down: not when disabled, or already held
	 */
	focusPress(): boolean {
		// not while the pointer already holds it: its release is the
		// pointer's, and accept letting go must not complete that press
		if (this._enabled && this.released) {
			this.released = false;
			this.isDirty = true;
			this.onClick();
			return true;
		}
		return false;
	}

	/**
	 * Accept was let go: the widget comes back up and `onRelease` runs. A
	 * widget completes its action here, as on a click: a button calls its
	 * `onClick` setting, a checkbox toggles.
	 */
	focusRelease(): void {
		if (!this.released) {
			this.released = true;
			this.isDirty = true;
			this.onRelease();
		}
	}

	/**
	 * Ease the bounce.
	 * @param dt - time since the last frame, in milliseconds
	 * @returns whether it needs redrawing
	 */
	override update(dt: number): boolean {
		const dirty = super.update(dt);
		let target = 1;
		if (!this.released && this.pressScale !== 1) {
			target = this.pressScale;
		} else if (
			(this.hover || (this.focused && ringVisible())) &&
			this._enabled
		) {
			target = this.hoverScale;
		}
		if (this._juice === target) {
			return dirty;
		}
		const step = 1 - Math.exp(-dt / JUICE_TIME);
		this._juice += (target - this._juice) * step;
		if (Math.abs(target - this._juice) < 0.001) {
			this._juice = target;
		}
		return true;
	}

	/**
	 * Apply the bounce, and draw the focus ring, behind the widget.
	 *
	 * Here and not in `draw`: a container translates to its own position in
	 * `draw`, so from `preDraw` on, the widget and the ring share the
	 * parent's coordinates, whatever the widget does in its own `draw`.
	 * @param renderer - the renderer to draw with
	 */
	override preDraw(renderer: Renderer): void {
		super.preDraw(renderer);
		if (this._juice !== 1) {
			const cx = this.pos.x + this.width / 2;
			const cy = this.pos.y + this.height / 2;
			renderer.translate(cx, cy);
			renderer.scale(this._juice, this._juice);
			renderer.translate(-cx, -cy);
		}
		if (ringVisible() && focusOwner() === this) {
			// 3 pixels wide, 3 pixels out from the widget
			const pad = 6;
			const alpha = renderer.globalAlpha();
			ringPainter.paint(renderer, UIBaseElement.focusRingColor, alpha);
			ringPainter.border(
				renderer,
				this.pos.x - pad,
				this.pos.y - pad,
				this.width + pad * 2,
				this.height + pad * 2,
				6,
				3,
			);
			renderer.setGlobalAlpha(alpha);
		}
	}

	/**
	 * Whether the widget answers input: the switch to turn a widget off.
	 *
	 * Turning it off sets `isClickable`, calls off a press in progress
	 * without a release, and draws the widget disabled: its `disabled` skin
	 * region, or at half opacity. `isClickable` is the low-level flag
	 * underneath, and setting it alone changes neither the look nor this.
	 * @default true
	 */
	get enabled(): boolean {
		return this._enabled;
	}

	set enabled(value: boolean) {
		this._enabled = value;
		this.isClickable = value;
		if (!value) {
			this.cancelPress();
		}
		this.isDirty = true;
	}

	/** whether the drag listener is on */
	private _dragListening = false;

	/**
	 * Follow the pointer for a drag: once, however it is reached.
	 * @ignore
	 * @internal
	 */
	private listenForDrag(): void {
		if (!this._dragListening) {
			this._dragListening = true;
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(POINTERMOVE, this.pointerMove, this);
		}
		// to memorize where we grab the object
		this.grabOffset ??= vector2dPool.get(0, 0);
	}

	/**
	 * Stop following the pointer, and give the grab offset back.
	 * @ignore
	 * @internal
	 */
	private stopListeningForDrag(): void {
		if (this._dragListening) {
			this._dragListening = false;
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(POINTERMOVE, this.pointerMove, this);
		}
		if (this.grabOffset !== undefined) {
			vector2dPool.release(this.grabOffset);
			this.grabOffset = undefined;
		}
	}

	/**
	 * Abandon a press in progress, without calling `onRelease`.
	 *
	 * The element goes back to its released look, and the pointer-up that
	 * follows does nothing. A scrolling {@link UIPanel} calls this when a drag
	 * that started on the element turns out to be a scroll, so a button
	 * dragged to scroll its list is not clicked.
	 */
	cancelPress(): void {
		if (!this.released) {
			this.released = true;
			this.isDirty = true;
			timer.clearTimer(this.holdTimeout);
			this.holdTimeout = -1;
			this.onCancel();
		}
	}

	/**
	 * Called when a press is abandoned rather than completed: see
	 * {@link UIBaseElement#cancelPress}. To be extended.
	 */
	onCancel(): void {
		// to be extended
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
			this.listenForDrag();
		}
		return this.onOver(event);
	}

	/**
	 * pointermove function
	 * @ignore
	 * @internal
	 */
	pointerMove(event: Pointer): void {
		// not gated on `hover`: a drag by touch never had one
		if (!this.released) {
			// follow the pointer
			// pos is ObservableVector3d at runtime but typed as Vector2d in Renderable
			// the global move carries screen coordinates; a press on an
			// element in the world was measured in world ones
			const x = this.isFloating ? event.gameScreenX : event.gameWorldX;
			const y = this.isFloating ? event.gameScreenY : event.gameWorldY;
			(this.pos as any).set(x, y, (this.pos as any).z);
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
		this.stopListeningForDrag();
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

		// every element, so one made focusable later takes part too
		trackElement(this);

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
		this.stopListeningForDrag();
		untrackElement(this);

		// call the parent function
		super.onDeactivateEvent();
	}
}
