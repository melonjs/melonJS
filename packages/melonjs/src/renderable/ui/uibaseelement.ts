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
 * The bounce settings every built-in widget takes in its settings object:
 * a small grow under the pointer and a squash while held. Only the drawing
 * scales; the hit area and the layout stay as they are. See
 * {@link UIBaseElement#hoverScale}.
 * @category UI
 * @example
 * // a button that grows 5% under the pointer and squashes while held
 * const play = new UITextButton(100, 200, {
 *     text: "Play",
 *     hoverScale: 1.05,
 *     pressScale: 0.92,
 * });
 */
export interface UIJuiceSettings {
	/**
	 * The scale the widget is drawn at under the pointer, or while it has
	 * the keyboard and gamepad focus, such as `1.05`. `1` turns it off.
	 * @default 1
	 */
	hoverScale?: number;
	/**
	 * The scale the widget is drawn at while held down, such as `0.92`.
	 * `1` turns it off.
	 * @default 1
	 */
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
 * A clickable, draggable container: the base every UI widget builds on
 * ({@link UITextButton}, {@link UICheckbox}, {@link UISlider},
 * {@link UIPanel}). Extend it to make a widget of your own; it can hold
 * other renderables as children.
 *
 * It uses screen coordinates (`floating` is `true`), so it stays put when
 * the camera moves. Children added to it should keep `floating` at `false`.
 *
 * ## Pointer callbacks
 * Override these in a subclass:
 * - {@link UIBaseElement#onClick}: the pointer went DOWN on the element
 *   (or Enter / A with the focus here). It is a press, not a completed click.
 * - {@link UIBaseElement#onRelease}: the press ended: the pointer came up,
 *   left the element while held, or the browser cancelled it.
 * - {@link UIBaseElement#onOver} / {@link UIBaseElement#onOut}: the pointer
 *   came in / went out. `hover` is `true` in between.
 * - {@link UIBaseElement#onHold}: held for `holdThreshold` ms, when
 *   `isHoldable` is set.
 * - {@link UIBaseElement#onCancel}: the press was called off without a
 *   release (see {@link UIBaseElement#cancelPress}).
 *
 * Elements under the pointer are asked topmost first, and the event carries
 * on to the ones below until a handler returns `false`. `onClick` and
 * `onRelease` return `false` by default, so a press on a UI element stops
 * there: a button over the game does not also click the world behind it.
 * Return `true` from them to let the press through as well. Hover is not
 * stopped by default: return `false` from `onOver` for that.
 *
 * ## Turning it off
 * Set {@link UIBaseElement#enabled} to `false`: it stops answering the
 * pointer, the keys and the pad, and a press in progress is called off.
 *
 * ## Dragging
 * Set {@link UIBaseElement#isDraggable}: the element then follows the
 * pointer while held. `onClick` is the pick-up, {@link UIBaseElement#onMove}
 * runs on each move, and `onRelease` is the drop. Inside a scrolling
 * {@link UIPanel}, a drag that starts on a widget scrolls the panel instead;
 * set {@link UIBaseElement#keepsDrag} on a widget that is dragged itself.
 *
 * ## Bounce
 * {@link UIBaseElement#hoverScale} and {@link UIBaseElement#pressScale}
 * scale the drawing under the pointer and while held, easing there and back.
 * The hit area and the layout do not change.
 *
 * ## Keyboard and gamepad focus
 * For a game played without a mouse or a touch screen. Nothing listens until
 * a widget takes the focus with {@link UIBaseElement#focus}; until then the
 * arrow keys and the pad are left to the game. With a widget focused:
 * - the arrow keys or the D-pad move the focus to the nearest
 *   {@link UIBaseElement#focusable} widget that way, measured edge to edge;
 * - Enter, Space or the pad's A button press the focused widget, as a click
 *   does;
 * - a ring in {@link UIBaseElement.focusRingColor} shows the focus while the
 *   keyboard or a pad is used, and hides when the mouse moves;
 * - a focused widget inside a scrolling {@link UIPanel} is scrolled into view;
 * - {@link UIBaseElement#blur}, or removing the widget, gives the keys and
 *   the pad back to the game.
 *
 * The built-in widgets are focusable. A widget of your own sets `focusable`
 * and can override {@link UIBaseElement#onNavigate} to use the arrows itself.
 * @category UI
 * @example
 * // a widget of your own: draws itself, bounces, and acts on release
 * import { UIBaseElement } from "melonjs";
 *
 * class Card extends UIBaseElement {
 *     constructor(x, y) {
 *         super(x, y, 120, 160);
 *         this.focusable = true; // reachable with the arrow keys and the pad
 *         this.hoverScale = 1.05;
 *         this.pressScale = 0.95;
 *     }
 *     draw(renderer, viewport) {
 *         renderer.setColor(this.hover ? "#ffffff" : "#cccccc");
 *         renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
 *         super.draw(renderer, viewport); // draws the children
 *     }
 *     onRelease() {
 *         console.log("card picked");
 *         return false; // stop the event here (the default)
 *     }
 * }
 *
 * app.world.addChild(new Card(50, 50));
 * @example
 * // a token dragged around and snapped to a 32 pixel grid when dropped
 * import { UIBaseElement, Sprite } from "melonjs";
 *
 * class Token extends UIBaseElement {
 *     constructor(x, y) {
 *         super(x, y, 64, 64);
 *         this.isDraggable = true;
 *         // a sprite is centred on its position by default
 *         this.addChild(new Sprite(32, 32, { image: "token" }));
 *     }
 *     onMove() {
 *         // runs on each move while dragged: this.pos follows the pointer
 *     }
 *     onRelease() {
 *         this.pos.x = Math.round(this.pos.x / 32) * 32;
 *         this.pos.y = Math.round(this.pos.y / 32) * 32;
 *         return false;
 *     }
 * }
 * @example
 * // a menu played with the keyboard or a pad: start on the first button
 * import { UITextButton, state } from "melonjs";
 *
 * const play = new UITextButton(100, 200, {
 *     text: "Play",
 *     onClick: () => state.change(state.PLAY),
 * });
 * const quit = new UITextButton(100, 260, {
 *     text: "Quit",
 *     onClick: () => state.change(state.MENU),
 * });
 * app.world.addChild(play);
 * app.world.addChild(quit);
 * // the arrows / D-pad now move between them, Enter / Space / A press;
 * // the mouse still works as before
 * play.focus();
 * @example
 * // a panel that is opaque to hover too, and comes to the front when picked
 * // (UIPanel does this with its `blocking` setting)
 * import { UIBaseElement, input } from "melonjs";
 *
 * class Dialog extends UIBaseElement {
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
 *         input.registerPointerEvent("pointermove", this, () => false);
 *     }
 *     onDeactivateEvent() {
 *         input.releasePointerEvent("pointermove", this);
 *         super.onDeactivateEvent();
 *     }
 * }
 */
export default class UIBaseElement extends Container {
	/**
	 * UI elements use screen coordinates by default, so they stay put when
	 * the camera moves. Children added to a UIBaseElement should keep their
	 * own `floating` at `false`.
	 * @see Renderable.floating
	 * @default true
	 */
	override floating = true;

	/**
	 * Whether the pointer can press the element. The low-level flag under
	 * {@link UIBaseElement#enabled}: prefer `enabled`, which also calls off a
	 * press in progress, blocks the keys and the pad, and draws a built-in
	 * widget disabled.
	 * @default true
	 */
	isClickable: boolean;

	/**
	 * Whether the element follows the pointer while held. `onClick` runs on
	 * the pick-up, {@link UIBaseElement#onMove} on each move and `onRelease`
	 * on the drop.
	 * @default false
	 */
	isDraggable: boolean;

	/**
	 * How long a press must be held before {@link UIBaseElement#onHold}
	 * runs, in milliseconds. Needs `isHoldable`.
	 * @default 250
	 */
	holdThreshold: number;

	/**
	 * Whether a press held for `holdThreshold` ms calls
	 * {@link UIBaseElement#onHold}.
	 * @default false
	 */
	isHoldable: boolean;

	/**
	 * `true` while the pointer is over the element. A tap on a touch screen
	 * does not set it.
	 * @default false
	 */
	hover: boolean;

	/**
	 * `false` while the element is held down (by the pointer, or by Enter /
	 * A with the focus), `true` otherwise.
	 * @default true
	 */
	released: boolean;

	/**
	 * the tap-and-hold timer of a press in progress, or -1
	 * @ignore
	 */
	holdTimeout: number;

	/**
	 * While dragged: where the element was grabbed, relative to its
	 * position. `undefined` otherwise.
	 */
	grabOffset: Vector2d | undefined;

	/**
	 * @param x - the x position of the element, in screen pixels
	 * @param y - the y position of the element, in screen pixels
	 * @param w - the width of the element, in pixels
	 * @param h - the height of the element, in pixels
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
	 * When `false`, a drag that starts on the element inside a scrolling
	 * {@link UIPanel} scrolls the panel and calls off the press. Set it on a
	 * widget that handles its own drags, such as a knob or a colour picker,
	 * as {@link UISlider} does. An `isDraggable` element keeps its drags
	 * anyway.
	 * @default false
	 * @example
	 * // a colour wheel that reads drags itself, inside a scrolling panel
	 * class ColourWheel extends UIBaseElement {
	 *     constructor(x, y) {
	 *         super(x, y, 128, 128);
	 *         this.keepsDrag = true;
	 *     }
	 * }
	 */
	keepsDrag = false;

	/** @ignore */
	protected _enabled = true;

	/**
	 * The scale the widget is drawn at under the pointer, or while it shows
	 * the focus ring: a little bounce, such as `1.05`. `1` turns it off.
	 *
	 * Only the drawing scales, about the widget's centre. Its hit area and
	 * its place in a layout stay the same, so the widgets around it do not
	 * move. The scale eases there and back by itself (about 0.2 s). A
	 * disabled widget does not grow.
	 * @default 1
	 * @example
	 * button.hoverScale = 1.05;
	 * button.pressScale = 0.92;
	 */
	hoverScale = 1;

	/**
	 * The scale the widget is drawn at while held down, such as `0.92`.
	 * `1` turns it off. Drawing only, as {@link UIBaseElement#hoverScale}.
	 * @default 1
	 */
	pressScale = 1;

	/** the scale drawn now, easing toward the one wanted */
	private _juice = 1;

	/**
	 * Whether this element can take the keyboard and gamepad focus: see
	 * {@link UIBaseElement#focus}. The built-in buttons, checkboxes and
	 * sliders set it; set it on a widget of your own to make it reachable.
	 * A disabled or hidden element is skipped.
	 * @default false
	 */
	focusable = false;

	/**
	 * The colour of the ring drawn around the element with the focus, for
	 * every element. Any CSS colour.
	 * @default "#ffcc33"
	 * @example
	 * UIBaseElement.focusRingColor = "#00e0ff";
	 */
	static focusRingColor = "#ffcc33";

	/**
	 * The element with the keyboard and gamepad focus, or `undefined` when
	 * none has it.
	 * @example
	 * // give the focus back to the menu if nothing has it
	 * if (UIBaseElement.focusOwner === undefined) {
	 *     playButton.focus();
	 * }
	 */
	static get focusOwner(): UIBaseElement | undefined {
		return focusOwner();
	}

	/** `true` while this element has the keyboard and gamepad focus */
	get focused(): boolean {
		return focusOwner() === this;
	}

	/**
	 * Take the keyboard and gamepad focus, for a game played without a mouse
	 * or a touch screen. Call it once the element is in the scene.
	 *
	 * Nothing has the focus until a game gives it to an element, and until
	 * then the arrow keys and the pad are left to the game. From then on:
	 * the arrows or the D-pad move the focus to the nearest focusable element
	 * that way; Enter, Space or the pad's A button press the focused one as a
	 * click does (a slider steps on left and right instead). The focus ring
	 * shows, and hides again while the mouse is used. A focused element in a
	 * scrolling panel is scrolled into view.
	 *
	 * Does nothing on an element that is not `focusable`.
	 * @example
	 * // a menu played with the keyboard or a pad: start on Play
	 * app.world.addChild(playButton);
	 * app.world.addChild(optionsButton);
	 * playButton.focus();
	 * @example
	 * // a pause menu in a panel: focus its first button when it opens
	 * panel.addChild(resumeButton);
	 * panel.addChild(quitButton);
	 * app.world.addChild(panel);
	 * resumeButton.focus();
	 */
	focus(): void {
		if (this.focusable) {
			setFocus(this);
		}
	}

	/**
	 * Give up the focus, if this element has it. With nothing focused, the
	 * arrow keys and the pad go back to the game. Removing the element from
	 * the scene does the same.
	 * @example
	 * // leaving the menu for the game: the arrows move the player again
	 * UIBaseElement.focusOwner?.blur();
	 */
	blur(): void {
		if (this.focused) {
			setFocus(undefined);
		}
	}

	/**
	 * Called for an arrow key or a D-pad direction while this element has
	 * the focus. Return `true` to handle it yourself (the focus stays here),
	 * as a slider does to step. Return `false`, the default, to move the
	 * focus to the nearest widget that way.
	 *
	 * Enter, Space and A do not come here: they press the widget through
	 * {@link UIBaseElement#focusPress} and {@link UIBaseElement#focusRelease}.
	 * @param _action - which way: `"up"`, `"down"`, `"left"` or `"right"`
	 * @returns `true` when handled
	 * @example
	 * // a picker: left and right change the choice, up and down move on
	 * class Picker extends UIBaseElement {
	 *     constructor(x, y, choices) {
	 *         super(x, y, 160, 32);
	 *         this.focusable = true;
	 *         this.choices = choices;
	 *         this.index = 0;
	 *     }
	 *     onNavigate(action) {
	 *         if (action === "left" || action === "right") {
	 *             const step = action === "right" ? 1 : -1;
	 *             const n = this.choices.length;
	 *             this.index = (this.index + step + n) % n;
	 *             this.isDirty = true;
	 *             return true;
	 *         }
	 *         return false;
	 *     }
	 * }
	 */
	onNavigate(_action: UINavAction): boolean {
		return false;
	}

	/**
	 * Called when Enter, Space or A is pressed with the focus here: the
	 * widget goes down, as under the pointer, and `onClick` runs with no
	 * event. Override it only to change what accept does.
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
	 * Called when Enter, Space or A is let go after
	 * {@link UIBaseElement#focusPress}: the widget comes back up and
	 * `onRelease` runs with no event. The built-in widgets complete their
	 * action here, as on a click: a button calls its `onClick` setting, a
	 * checkbox toggles.
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
	 * Turning it off clears `isClickable`, calls off a press in progress
	 * (see {@link UIBaseElement#cancelPress}), and skips it in keyboard and
	 * gamepad navigation. The built-in widgets draw themselves disabled:
	 * their `disabled` skin region, or at half opacity. A widget of your own
	 * reads `enabled` in its `draw`.
	 *
	 * `isClickable` is the low-level flag underneath; setting it alone does
	 * not change `enabled` or the look.
	 * @default true
	 * @example
	 * // greyed out until a save exists
	 * continueButton.enabled = false;
	 * // ... later
	 * continueButton.enabled = true;
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
	 * Call off a press in progress, without calling `onRelease`:
	 * {@link UIBaseElement#onCancel} runs instead.
	 *
	 * The element goes back to its released look, and the pointer-up that
	 * follows does nothing. A scrolling {@link UIPanel} calls this when a drag
	 * that started on the element turns out to be a scroll, so a button
	 * dragged to scroll its list is not clicked. Setting `enabled` to `false`
	 * and losing the focus while Enter or A is held call it too.
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
	 * Called when a press is called off rather than completed: see
	 * {@link UIBaseElement#cancelPress}. Override it to undo what `onClick`
	 * started, such as a charge-up effect.
	 */
	onCancel(): void {
		// to be extended
	}

	/**
	 * Called when the element is pressed: the pointer went down on it, or
	 * Enter / Space / A with the focus here (then with no event). Override it
	 * in a subclass.
	 *
	 * This is the press, not a completed click: see
	 * {@link UIBaseElement#onRelease} for the end of it.
	 * @param _event - the pointer event, or `undefined` from the keyboard or
	 * the pad
	 * @returns `false`, the default, to stop the event here; `true` to let
	 * elements below get it too
	 */

	onClick(_event?: Pointer): boolean {
		return false;
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
	 * Called on each pointer move while the element is dragged (see
	 * {@link UIBaseElement#isDraggable}), after `pos` has followed the
	 * pointer. Override it in a subclass.
	 * @param _event - the pointer event
	 */

	onMove(_event?: Pointer): void {
		// to be extended
	}

	/**
	 * Called when the pointer comes over the element. Override it in a
	 * subclass.
	 *
	 * Fires once, on the frame the pointer crosses into the element. To stay
	 * opaque to hover for as long as the pointer rests on it, also register a
	 * `"pointermove"` callback through {@link input.registerPointerEvent}
	 * that returns `false` (see the class example).
	 * @param _event - the pointer event
	 * @returns `false` to stop the event here, so an element covered by this
	 * one does not also light up
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
	 * Called when the pointer leaves the element. Override it in a subclass.
	 *
	 * Also fires when the pointer is still inside but something drawn above
	 * has stopped the move, since the pointer is then over that instead. A
	 * press in progress ends first, through `onRelease`.
	 *
	 * Unlike {@link UIBaseElement#onOver} it cannot stop the event: an
	 * element that skipped its own leave would stay lit after the pointer
	 * had gone.
	 * @param _event - the pointer event
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
	 * Called when a press ends. Override it in a subclass.
	 *
	 * It runs when the pointer comes up, but also when the pointer leaves the
	 * element while held, or the browser cancels the press: it is the end
	 * of a press, not proof of a completed click. (For a click that only
	 * counts when completed, use a {@link UITextButton} and its `onClick`
	 * setting.) A press called off by {@link UIBaseElement#cancelPress} does
	 * not come here.
	 * @param _event - the pointer event, or `undefined` from the keyboard or
	 * the pad
	 * @returns `false`, the default, to stop the event here; `true` to let
	 * elements below get it too
	 */

	onRelease(_event?: Pointer): boolean {
		return false;
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
	 * Called once a press has been held for `holdThreshold` milliseconds,
	 * when `isHoldable` is set. Override it in a subclass.
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
