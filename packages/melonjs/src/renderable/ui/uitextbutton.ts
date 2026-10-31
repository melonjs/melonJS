import type Camera2d from "../../camera/camera2d.ts";
import { RoundRect } from "../../geometries/roundrect.ts";
import type Pointer from "../../input/pointer.ts";
import type { Bounds } from "../../physics/bounds.ts";
import { BLUR, KEYDOWN, KEYUP, off, on } from "../../system/event.ts";
import type Renderer from "../../video/renderer.js";
import BitmapText from "../text/bitmaptext.js";
import Text from "../text/text.js";
import UIBaseElement, { isPointerUp } from "./uibaseelement.ts";
import type { UILabel } from "./uilabel.ts";
import { isBitmapFont } from "./uilabel.ts";
import type { UISkin } from "./uiskin.ts";
import { SkinDrawer } from "./uiskin.ts";

/**
 * The art of a skinned {@link UITextButton}: one atlas region per state.
 *
 * Each region is drawn as a nine-slice, so the button can be any size.
 * @category UI
 */
export interface UITextButtonSkin extends UISkin {
	/** the button at rest */
	normal: string;
	/**
	 * The button held down. When it is shorter than `normal`, as pressed art
	 * usually is, it is drawn lowered by the difference and the label moves
	 * down with it.
	 */
	pressed?: string;
	/** the button under the pointer; `normal` if left out */
	hover?: string;
	/** the button while disabled; `normal` at half opacity if left out */
	disabled?: string;
}

/**
 * Everything {@link UITextButton} takes.
 * @category UI
 */
export interface UITextButtonSettings {
	/**
	 * The font: the name of a loaded bitmap font, or a CSS font family. A
	 * name with both a font image and font data in the loader is drawn
	 * through {@link BitmapText}, anything else through {@link Text}.
	 * @default "sans-serif"
	 */
	font?: string;
	/**
	 * With a bitmap font, a scale of its authored size; with a CSS font, the
	 * height in pixels.
	 */
	size?: number;
	/** the label */
	text?: string;
	/** the label's colour; a bitmap font is tinted with it */
	fillStyle?: string;
	/** see {@link UITextButton.bindKey} */
	bindKey?: string | number;
	/**
	 * Called once per completed click: pressed and released on the button,
	 * or its {@link UITextButton.bindKey} pressed and released. A press
	 * dragged off the button, cancelled, or turned into a scroll by a
	 * {@link UIPanel} does not call it. Nor does a disabled button.
	 */
	onClick?: (button: UITextButton) => void;
	/**
	 * whether the button answers input
	 * @default true
	 */
	enabled?: boolean;
	/** draw the button from atlas regions instead of a rounded rectangle */
	skin?: UITextButtonSkin;
	/** background colour at rest (drawn look) */
	hoverOffColor?: string;
	/** background colour under the pointer (drawn look) */
	hoverOnColor?: string;
	/** background colour while held down (drawn look) */
	pressedColor?: string;
	/** outline colour (drawn look) */
	borderStrokeColor?: string;
	textAlign?: string;
	textBaseline?: string;
	/** the button's width; the label's width plus 16 by default, or the skin's */
	borderWidth?: number;
	/** the button's height; the label's height plus 16 by default, or the skin's */
	borderHeight?: number;
	[key: string]: any;
}

/**
 * A button with a label, drawn as a rounded rectangle, or from atlas art
 * through a {@link UITextButtonSkin}.
 *
 * Give it an `onClick` for what it does. That is called on a COMPLETED
 * click, so a press can still be taken back by dragging off the button, and
 * a drag that starts on it inside a scrolling {@link UIPanel} scrolls the
 * panel instead.
 *
 * The {@link UIBaseElement#onClick} and {@link UIBaseElement#onRelease}
 * methods are still there for a subclass, and are called on the press and
 * on the release as before.
 * @category UI
 * @example
 * // drawn, with no assets
 * const play = new UITextButton(100, 200, {
 *     text: "Play",
 *     size: 24,
 *     onClick: () => state.change(state.PLAY),
 * });
 *
 * // skinned from an atlas, any width
 * const accept = new UITextButton(30, 250, {
 *     font: "kenpixel",
 *     size: 12,
 *     text: "Accept",
 *     borderWidth: 160,
 *     skin: { atlas, normal: "green_button04", pressed: "green_button05" },
 *     onClick: () => saveSettings(),
 * });
 */
export default class UITextButton extends UIBaseElement {
	/**
	 * Keyboard shortcut: an input.KEY keycode or an existing input action name.
	 * A press calls onClick() and its matching release calls onRelease(), both
	 * without a pointer event, then the `onClick` setting. Shortcuts are active
	 * only while the button is activated and never change global key bindings.
	 * The first input to press owns the button until released; shortcuts do
	 * not start pointer dragging or tap-and-hold.
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

	/**
	 * What the button does: see {@link UITextButtonSettings.onClick}.
	 */
	clickCallback: ((button: UITextButton) => void) | undefined;

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
		this.completeClick();
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
	 * The css value of the background while the button is held down
	 * @default "#008800ff"
	 */
	pressedColor: string;

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
	 * The label: a {@link BitmapText} for a loaded bitmap font, a
	 * {@link Text} otherwise.
	 */
	label: UILabel;

	/**
	 * the measured text dimensions
	 */
	dimensions: Bounds;

	/**
	 * the round rect border
	 */
	border: RoundRect;

	/** the art, when the button is skinned */
	readonly skin: UITextButtonSkin | undefined;

	/** @ignore */
	private _skin: SkinDrawer | undefined;
	/** @ignore */
	private _enabled = true;
	/** how far the label is lowered right now, for the pressed art */
	private _labelDrop = 0;

	/**
	 * A Bitmap Text Button with an outlined background border, filled with background color.
	 * It uses a RoundRect as background and changes the background color on hovering over.
	 * The background will be drawn with 0.5 opacity, so that the background of the button is
	 * slightly shining through.
	 * @param x - x pos of the button
	 * @param y - y pos of the button
	 * @param settings - see {@link UITextButtonSettings}
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
		this.clickCallback = settings.onClick;

		this.hoverOffColor = settings.hoverOffColor || "#00aa0080";
		this.hoverOnColor = settings.hoverOnColor || "#00ff00ff";
		this.pressedColor = settings.pressedColor || "#008800ff";

		this.borderStrokeColor = settings.borderStrokeColor || "#000000";

		this.textAlign = settings.textAlign = settings.textAlign || "center";

		this.textBaseline = settings.textBaseline =
			settings.textBaseline || "middle";

		const font = settings.font ?? "sans-serif";
		if (isBitmapFont(font)) {
			this.label = new BitmapText(0, 0, settings as any);
		} else {
			this.label = new Text(0, 0, {
				font,
				size: settings.size ?? 16,
				fillStyle: settings.fillStyle ?? "#000000",
				textAlign: this.textAlign,
				textBaseline: this.textBaseline,
				text: settings.text ?? "",
			});
		}

		this.skin = settings.skin;
		let width = settings.borderWidth;
		let height = settings.borderHeight;
		if (this.skin !== undefined) {
			this._skin = new SkinDrawer(this.skin);
			// every region named is checked now, so a typo fails here
			const normal = this._skin.size(this.skin.normal);
			for (const state of ["pressed", "hover", "disabled"] as const) {
				const region = this.skin[state];
				if (region !== undefined) {
					this._skin.size(region);
				}
			}
			width ||= normal.width;
			height ||= normal.height;
		}

		// "detect" the button size
		this.dimensions = this.label.measureText();
		width ||= this.dimensions.width + 16;
		height ||= this.dimensions.height + 16;
		settings.borderWidth = width;
		settings.borderHeight = height;

		// create the round rect button
		this.border = new RoundRect(x, y, width, height);

		// resize the container accordingly
		this.resize(width, height);

		// add the label to the UI container
		this.addChild(this.label);

		this.enabled = settings.enabled ?? true;
	}

	/**
	 * the label, under its original name
	 * @deprecated since 20.13.0, use {@link UITextButton#label}, which is a
	 * {@link Text} when the font is not a bitmap font
	 */
	get bitmapText(): UILabel {
		return this.label;
	}

	/**
	 * Whether the button answers input.
	 *
	 * A disabled button is drawn with its `disabled` skin region, or at half
	 * opacity, ignores the pointer and its key, and never calls `onClick`.
	 * Disabling it while it is held lets the press go without a click.
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
			this.cancelKeyboardPress();
		}
		this.isDirty = true;
	}

	/**
	 * Resize the button, and keep its background and label in step.
	 *
	 * A {@link UIPanel} calls this to stretch a button to its column.
	 * @param w - the new width
	 * @param h - the new height
	 * @returns this button
	 */
	override resize(w: number, h: number) {
		super.resize(w, h);
		// the border is created after the first resize in the constructor
		// would run, so it may not be there yet
		if (this.border !== undefined) {
			this.border.setSize(w, h);
		}
		this.placeLabel();
		return this;
	}

	/**
	 * Centre the label, lowered with the pressed art.
	 * @ignore
	 * @internal
	 */
	private placeLabel() {
		if (this.label === undefined) {
			return;
		}
		const x = this.width / 2;
		const y = this.height / 2 + this._labelDrop;
		if (this.label.pos.x !== x || this.label.pos.y !== y) {
			this.label.setPosition(x, y);
		}
	}

	/**
	 * Run the `onClick` setting, if the button may.
	 * @ignore
	 * @internal
	 */
	private completeClick() {
		if (this._enabled && this.clickCallback !== undefined) {
			this.clickCallback(this);
		}
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
		// Completed only when the press is still on and this is the pointer
		// coming up, which only reaches the button over it. A press that left
		// the button arrives here from `leave` with a move instead, and a
		// cancelled one with a cancel. `hover` is no guide: a tap on a touch
		// screen never sets it.
		const completed = !this.released && isPointerUp(event);
		const result = super.release(event);
		if (completed) {
			this.completeClick();
		}
		return result;
	}

	override pointerMove(event: Pointer): void {
		if (this.keyboardKey === undefined) {
			super.pointerMove(event);
		}
	}

	/**
	 * The skin region for the current state, and how far it is lowered.
	 * @returns the region name and its drop
	 * @ignore
	 * @internal
	 */
	private skinState(): [string, number] {
		const skin = this.skin!;
		if (!this._enabled) {
			return [skin.disabled ?? skin.normal, 0];
		}
		if (!this.released && skin.pressed !== undefined) {
			const drop = Math.max(
				0,
				this._skin!.size(skin.normal).height -
					this._skin!.size(skin.pressed).height,
			);
			return [skin.pressed, drop];
		}
		if (this.hover && skin.hover !== undefined) {
			return [skin.hover, 0];
		}
		return [skin.normal, 0];
	}

	override draw(renderer: Renderer, viewport?: Camera2d): void {
		const r = renderer as any;
		const alpha = renderer.globalAlpha();
		let drop = 0;
		if (this._skin !== undefined) {
			const [region, regionDrop] = this.skinState();
			drop = regionDrop;
			if (!this._enabled && this.skin!.disabled === undefined) {
				renderer.setGlobalAlpha(alpha * 0.5);
			}
			this._skin.draw(
				renderer,
				region,
				this.pos.x,
				this.pos.y + drop,
				this.width,
				this.height - drop,
			);
		} else {
			if (!this._enabled) {
				renderer.setGlobalAlpha(alpha * 0.5);
			}
			// kept on the button: a button placed by a panel, or moved after
			// it was built, would otherwise draw its background where it was
			// first put
			if (
				this.border.pos.x !== this.pos.x ||
				this.border.pos.y !== this.pos.y
			) {
				this.border.pos.set(this.pos.x, this.pos.y);
			}
			if (!this.released) {
				r.setColor(this.pressedColor);
			} else if (this.hover && this._enabled) {
				r.setColor(this.hoverOnColor);
			} else {
				r.setColor(this.hoverOffColor);
			}
			r.fill(this.border);
			r.setColor(this.borderStrokeColor);
			r.stroke(this.border);
		}
		if (drop !== this._labelDrop) {
			this._labelDrop = drop;
			this.placeLabel();
		}
		super.draw(renderer, viewport);
		renderer.setGlobalAlpha(alpha);
	}

	/**
	 * Free the skin's sprite.
	 * @ignore
	 */
	override onDestroyEvent() {
		this._skin?.dispose();
		super.onDestroyEvent();
	}
}
