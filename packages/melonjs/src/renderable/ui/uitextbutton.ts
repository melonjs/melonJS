import type Camera2d from "../../camera/camera2d.ts";
import { RoundRect } from "../../geometries/roundrect.ts";
import type Pointer from "../../input/pointer.ts";
import type { Bounds } from "../../physics/bounds.ts";
import { BLUR, KEYDOWN, KEYUP, off, on } from "../../system/event.ts";
import type Renderer from "../../video/renderer.js";
import BitmapText from "../text/bitmaptext.js";
import UIBaseElement from "./uibaseelement.ts";

interface UITextButtonSettings {
	font?: string;
	size?: number;
	text?: string;
	/** see {@link UITextButton.bindKey} */
	bindKey?: string | number;
	hoverOffColor?: string;
	hoverOnColor?: string;
	borderStrokeColor?: string;
	fillStyle?: string;
	textAlign?: string;
	textBaseline?: string;
	borderWidth?: number;
	borderHeight?: number;
	[key: string]: any;
}

/**
 * This is a basic base text button which you can use in your Game UI.
 * @category UI
 */
export default class UITextButton extends UIBaseElement {
	/**
	 * Keyboard shortcut: an input.KEY keycode or an existing input action name.
	 * A press calls onClick() and its matching release calls onRelease(), both
	 * without a pointer event. Shortcuts are active only while the button is
	 * activated and never change global key bindings. The first input to press
	 * owns the button until released; shortcuts do not start pointer dragging
	 * or tap-and-hold.
	 *
	 * `isClickable` gates the PRESS, not the release: a button disabled while
	 * its key is held still releases when that key comes up, so it cannot be
	 * left stuck down.
	 *
	 * **Losing focus or being removed cancels a held press WITHOUT calling
	 * `onRelease()`.** The press was abandoned rather than completed, so the
	 * button returns to its released state silently. Code that treats the pair
	 * as press and depress, firing a weapon on click and stopping on release,
	 * needs to stop on {@link event.BLUR} too or it will still be firing when
	 * the window comes back.
	 * @default -1
	 */
	bindKey: string | number;

	private keyboardKey: number | undefined;
	private keyboardActive = false;

	private readonly keyDown = (action: string | undefined, keyCode: number) => {
		const matches =
			typeof this.bindKey === "number"
				? this.bindKey >= 0 && this.bindKey === keyCode
				: this.bindKey.length > 0 && this.bindKey === action;
		if (
			!this.keyboardActive ||
			!matches ||
			!this.isClickable ||
			!this.released ||
			this.keyboardKey !== undefined
		) {
			return;
		}
		this.keyboardKey = keyCode;
		this.released = false;
		this.isDirty = true;
		this.onClick();
	};

	private readonly keyUp = (_action: string | undefined, keyCode: number) => {
		if (!this.keyboardActive || this.keyboardKey !== keyCode) {
			return;
		}
		this.keyboardKey = undefined;
		this.released = true;
		this.isDirty = true;
		this.onRelease();
	};

	private readonly cancelKeyboardPress = () => {
		if (this.keyboardKey !== undefined) {
			this.keyboardKey = undefined;
			this.released = true;
			this.isDirty = true;
		}
	};

	/**
	 * The css value of a color to be used if the pointer is not hovering over the button
	 */
	hoverOffColor: string;

	/**
	 * The css value of a color to be used if the pointer hovers over the button
	 */
	hoverOnColor: string;

	/**
	 * The css value of a color to be used to draw the border
	 */
	borderStrokeColor: string;

	/**
	 * Set the default text alignment (or justification),<br>
	 * possible values are "left", "right", and "center".
	 * @default "center"
	 */
	textAlign: string;

	/**
	 * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
	 * possible values are "top", "hanging", "middle", "alphabetic", "ideographic", "bottom"<br>
	 * @default "middle"
	 */
	textBaseline: string;

	/**
	 * the bitmapText used by the UITextButton class
	 */
	bitmapText: BitmapText;

	/**
	 * the measured text dimensions
	 */
	dimensions: Bounds;

	/**
	 * the round rect border
	 */
	border: RoundRect;

	/**
	 * A Bitmap Text Button with an outlined background border, filled with background color.
	 * It uses a RoundRect as background and changes the background color on hovering over.
	 * The background will be drawn with 0.5 opacity, so that the background of the button is
	 * slightly shining through.
	 * @param x - x pos of the button
	 * @param y - y pos of the button
	 * @param settings - settings object
	 * @example
	 * // Create a new Button
	 * class PlayButton extends UITextButton {
	 *      constructor(x,y) {
	 *          super(x,y, {
	 *              font: 'my-font',
	 *              text: 'Play',
	 *              // if you omit the next two, size is calculated by the size of the text
	 *              borderWidth: 200,
	 *              borderHeight: 20,
	 *              hoverOffColor: '#00aa0080',
	 *              hoverOnColor: '#00ff00ff'
	 *          });
	 *      }
	 *
	 *      onClick(){
	 *          state.change(state.PLAY);
	 *      }
	 * }
	 *
	 * world.addChild(new PlayButton(15,200));
	 */
	constructor(x: number, y: number, settings: UITextButtonSettings) {
		super(x, y);

		this.bindKey = settings.bindKey ?? -1;

		this.hoverOffColor = settings.hoverOffColor || "#00aa0080";
		this.hoverOnColor = settings.hoverOnColor || "#00ff00ff";

		this.borderStrokeColor = settings.borderStrokeColor || "#000000";

		this.textAlign = settings.textAlign = settings.textAlign || "center";

		this.textBaseline = settings.textBaseline =
			settings.textBaseline || "middle";

		this.bitmapText = new BitmapText(0, 0, settings as any);

		// "detect" the button size
		this.dimensions = this.bitmapText.measureText();
		settings.borderWidth = settings.borderWidth || this.dimensions.width + 16;
		settings.borderHeight =
			settings.borderHeight || this.dimensions.height + 16;

		// create the round rect button
		this.border = new RoundRect(
			x,
			y,
			settings.borderWidth,
			settings.borderHeight,
		);

		// resize the container accordingly
		this.resize(this.border.getBounds().width, this.border.getBounds().height);

		// adjust size position
		this.bitmapText.pos.set(this.width / 2, this.height / 2);

		// add bitmapText to the UI container
		this.addChild(this.bitmapText);
	}

	override onActivateEvent(): void {
		super.onActivateEvent();
		if (this.keyboardActive) {
			return;
		}
		this.keyboardActive = true;
		on(KEYDOWN, this.keyDown);
		on(KEYUP, this.keyUp);
		on(BLUR, this.cancelKeyboardPress);
	}

	override onDeactivateEvent(): void {
		this.keyboardActive = false;
		off(KEYDOWN, this.keyDown);
		off(KEYUP, this.keyUp);
		off(BLUR, this.cancelKeyboardPress);
		this.cancelKeyboardPress();
		super.onDeactivateEvent();
	}

	override clicked(event: Pointer): boolean | void {
		if (this.keyboardKey !== undefined) {
			return false;
		}
		return super.clicked(event);
	}

	override release(event: Pointer): boolean | void {
		if (this.keyboardKey !== undefined) {
			return false;
		}
		return super.release(event);
	}

	override pointerMove(event: Pointer): void {
		if (this.keyboardKey === undefined) {
			super.pointerMove(event);
		}
	}

	override draw(renderer: Renderer, viewport?: Camera2d): void {
		const r = renderer as any;
		if (this.hover) {
			r.setColor(this.hoverOnColor);
		} else {
			r.setColor(this.hoverOffColor);
		}
		r.fill(this.border);
		r.setColor(this.borderStrokeColor);
		r.stroke(this.border);
		super.draw(renderer, viewport);
	}
}
