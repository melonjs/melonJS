import {
	registerPointerEvent,
	releasePointerEvent,
} from "./../../input/input.ts";
import type Pointer from "./../../input/pointer.ts";
import timer from "./../../system/timer.ts";
import Sprite from "./../sprite.js";

/**
 * A {@link Sprite} that takes clicks: use it for an image-only button or a
 * clickable icon, such as a pause or a sound toggle, with no label.
 *
 * It takes the same settings as a {@link Sprite}: a single image, a frame
 * of a spritesheet, or a region of a {@link TextureAtlas}. Like a sprite it
 * is centred on its position by default (`anchorPoint` 0.5, 0.5), and the
 * pointer hits its bounds. It uses screen coordinates (`floating` is `true`).
 *
 * Override the callbacks in a subclass: {@link UISpriteElement#onClick} when
 * the pointer goes down on it, {@link UISpriteElement#onRelease} when the
 * press ends, {@link UISpriteElement#onOver} / {@link UISpriteElement#onOut}
 * for hover (`hover` is `true` in between), and
 * {@link UISpriteElement#onHold} with `isHoldable`. Unlike
 * {@link UIBaseElement}, `onClick` and `onRelease` stop the event by default
 * (they return `false`), so an element below does not get it too.
 *
 * It is a lighter element than {@link UIBaseElement}: it has no `enabled`,
 * no keyboard and gamepad focus, no bounce and no dragging. For those, use
 * a {@link UITextButton} with a `skin` (its `text` can be empty) or a
 * {@link UIBaseElement} subclass holding a sprite.
 * @category UI
 * @example
 * // a sound toggle icon from an atlas, swapping its region on each click
 * import { UISpriteElement, audio } from "melonjs";
 *
 * class SoundIcon extends UISpriteElement {
 *     constructor(x, y) {
 *         super(x, y, { image: atlas, region: "sound_on" });
 *         this.muted = false;
 *     }
 *     onClick() {
 *         this.muted = !this.muted;
 *         if (this.muted) {
 *             audio.muteAll();
 *         } else {
 *             audio.unmuteAll();
 *         }
 *         this.setRegion(atlas.getRegion(this.muted ? "sound_off" : "sound_on"));
 *         return false;
 *     }
 * }
 *
 * app.world.addChild(new SoundIcon(40, 40));
 * @example
 * // a pause button from a spritesheet: frame 0 at rest, frame 1 under the pointer
 * import { UISpriteElement, state } from "melonjs";
 *
 * class PauseButton extends UISpriteElement {
 *     constructor(x, y) {
 *         super(x, y, { image: "pause_button", framewidth: 64, frameheight: 64 });
 *         this.addAnimation("idle", [0]);
 *         this.addAnimation("over", [1]);
 *         this.setCurrentAnimation("idle");
 *     }
 *     onOver() {
 *         this.setCurrentAnimation("over");
 *     }
 *     onOut() {
 *         this.setCurrentAnimation("idle");
 *     }
 *     onRelease() {
 *         state.pause();
 *         return false;
 *     }
 * }
 */
export default class UISpriteElement extends Sprite {
	/**
	 * Whether the element uses screen coordinates, so it stays put when the
	 * camera moves. Set it to `false` when adding the element to a floating
	 * parent, such as a {@link UIPanel}.
	 * @see Renderable.floating
	 * @default true
	 */
	override floating = true;

	/**
	 * Whether the pointer can press the element. Set it to `false` to turn
	 * the element off (it does not change the look).
	 * @default true
	 */
	isClickable: boolean;

	/**
	 * How long a press must be held before {@link UISpriteElement#onHold}
	 * runs, in milliseconds. Needs `isHoldable`.
	 * @default 250
	 */
	holdThreshold: number;

	/**
	 * Whether a press held for `holdThreshold` ms calls
	 * {@link UISpriteElement#onHold}.
	 * @default false
	 */
	isHoldable: boolean;

	/**
	 * `true` while the pointer is over the element
	 * @default false
	 */
	hover: boolean;

	/**
	 * the tap-and-hold timer of a press in progress, or -1
	 * @ignore
	 */
	holdTimeout: number;

	/**
	 * `false` while the element is held down, `true` otherwise
	 * @default true
	 */
	released: boolean;

	/**
	 * @param x - the x position of the element (its centre by default), in
	 * screen pixels
	 * @param y - the y position of the element (its centre by default), in
	 * screen pixels
	 * @param settings - the {@link Sprite} settings
	 * @param settings.image - the image: a loader key, an image, or a
	 * {@link TextureAtlas} (with `region`)
	 * @example
	 * // a button image loaded as "button", logging each press
	 * class MyButton extends UISpriteElement {
	 *     constructor(x, y) {
	 *         super(x, y, { image: "button" });
	 *     }
	 *     onClick() {
	 *         console.log("clicked!");
	 *         return false;
	 *     }
	 * }
	 *
	 * app.world.addChild(new MyButton(100, 50));
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
			return this.onClick(event);
		}
	}

	/**
	 * Called when the pointer goes down on the element. Override it in a
	 * subclass. This is the press, not a completed click.
	 * @param _event - the pointer event
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
		return this.onOver(event);
	}

	/**
	 * Called when the pointer comes over the element. Override it in a
	 * subclass.
	 *
	 * Fires once, on the frame the pointer crosses into the element. To stay
	 * opaque to hover for as long as the pointer rests on it, also register a
	 * `"pointermove"` callback through {@link input.registerPointerEvent}
	 * that returns `false`.
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
	 * Unlike {@link UISpriteElement#onOver} it cannot stop the event: an
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
	 * of a press, not proof of a completed click.
	 * @param _event - the pointer event
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
	}
}
