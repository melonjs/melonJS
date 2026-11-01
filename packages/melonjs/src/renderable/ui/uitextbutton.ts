import type Camera2d from "../../camera/camera2d.ts";
import { RoundRect } from "../../geometries/roundrect.ts";
import type Pointer from "../../input/pointer.ts";
import { getImage } from "../../loader/loader.js";
import type { Bounds } from "../../physics/bounds.ts";
import { BLUR, KEYDOWN, KEYUP, off, on } from "../../system/event.ts";
import type Renderer from "../../video/renderer.js";
import BitmapText from "../text/bitmaptext.js";
import Text from "../text/text.js";
import type { Paint } from "./panelpaint.ts";
import type { UIJuiceSettings } from "./uibaseelement.ts";
import UIBaseElement, { isPointerUp } from "./uibaseelement.ts";
import { focusOwner, isAcceptKey, ringVisible } from "./uifocus.ts";
import type { UILabel } from "./uilabel.ts";
import type { UISkin } from "./uiskin.ts";
import { SkinDrawer } from "./uiskin.ts";

/**
 * The art of a skinned {@link UITextButton}: one atlas region name per
 * state, plus the `atlas` and optional nine-slice insets from
 * {@link UISkin}.
 *
 * Each region is drawn as a nine-slice, so the button can be any size.
 * Every region named is looked up when the button is built, so a typo
 * throws there.
 * @category UI
 * @example
 * const skin = {
 *     atlas,
 *     normal: "green_button04",
 *     pressed: "green_button05",
 *     disabled: "grey_button04",
 * };
 */
export interface UITextButtonSkin extends UISkin {
	/** the region drawn at rest; also sets the button's default size */
	normal: string;
	/**
	 * The region drawn while held down; `normal` if left out. When it is
	 * shorter than `normal`, as pressed art usually is, it is drawn lowered
	 * by the difference and the label moves down with it.
	 */
	pressed?: string;
	/** the region drawn under the pointer; `normal` if left out */
	hover?: string;
	/** the region drawn while disabled; `normal` at half opacity if left out */
	disabled?: string;
}

/**
 * Everything {@link UITextButton} takes. Every field is optional. The
 * object is only read, so one style object can be spread into several
 * buttons.
 * @category UI
 */
export interface UITextButtonSettings extends UIJuiceSettings {
	/**
	 * The font: the name of a loaded bitmap font, or a CSS font family. A
	 * name with a font image in the loader, or a `fontData` setting, is drawn
	 * as a {@link BitmapText}; anything else as a {@link Text} with that CSS
	 * font.
	 * @default "sans-serif"
	 */
	font?: string;
	/**
	 * the loader name of the bitmap font data, when it differs from `font`
	 */
	fontData?: string;
	/**
	 * The label's height in pixels, for a bitmap font as for a CSS font. A
	 * bitmap font is scaled to it. Left out: 16 for a CSS font, the authored
	 * size for a bitmap font. Wins over `size`.
	 */
	fontSize?: number;
	/**
	 * Older form of `fontSize`, still accepted. With a CSS font it is the
	 * height in pixels; with a bitmap font it is a scale of the authored
	 * size (`2` is double), not pixels.
	 */
	size?: number;
	/**
	 * the label's text
	 * @default ""
	 */
	text?: string;
	/**
	 * The label's colour. A bitmap font is tinted with it; left out, a
	 * bitmap font keeps its own colours and a CSS font is black.
	 */
	labelFillStyle?: string;
	/** older name of `labelFillStyle`, still accepted */
	fillStyle?: string;
	/**
	 * A keyboard shortcut that clicks the button: an `input.KEY` key code,
	 * or the name of an action bound with `input.bindKey`. `-1` for none.
	 * See {@link UITextButton#bindKey}.
	 * @default -1
	 */
	bindKey?: string | number;
	/**
	 * What the button does. Called once per completed click: pressed and
	 * released on the button, Enter / Space / A pressed and released with
	 * the focus on it, or its `bindKey` pressed and released. A press dragged
	 * off the button, called off, or turned into a scroll by a
	 * {@link UIPanel} does not call it. Nor does a disabled button.
	 */
	onClick?: (button: UITextButton) => void;
	/**
	 * whether the button answers input; see {@link UIBaseElement#enabled}
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * Draw the button from atlas regions instead of a rounded rectangle.
	 * The colour settings below are then not used.
	 */
	skin?: UITextButtonSkin;
	/**
	 * background colour at rest, drawn look only
	 * @default "#00aa0080"
	 */
	hoverOffColor?: Paint;
	/**
	 * background colour under the pointer, drawn look only
	 * @default "#00ff00ff"
	 */
	hoverOnColor?: Paint;
	/**
	 * Background colour while held down, drawn look only. Left out, a held
	 * button shows `hoverOnColor`.
	 */
	pressedColor?: Paint;
	/**
	 * outline colour, drawn look only
	 * @default "#000000"
	 */
	borderColor?: Paint;
	/** older name of `borderColor`, still accepted */
	borderStrokeColor?: Paint;
	/**
	 * The label's horizontal alignment about the centre of the button:
	 * `"left"` starts the text at the centre, `"right"` ends it there.
	 * @default "center"
	 */
	textAlign?: string;
	/**
	 * the label's baseline about the vertical middle of the button
	 * @default "middle"
	 */
	textBaseline?: string;
	/**
	 * The button's width in pixels. Left out: the skin's `normal` region
	 * width, or else the label's width plus 16.
	 */
	width?: number;
	/**
	 * The button's height in pixels. Left out: the skin's `normal` region
	 * height, or else the label's height plus 16.
	 */
	height?: number;
	/**
	 * Older name of `width`, still accepted. It is the button's width, not an
	 * outline thickness as `borderWidth` is on the other widgets.
	 */
	borderWidth?: number;
	/** older name of `height`, still accepted */
	borderHeight?: number;
	/**
	 * Anything else is passed on to the {@link BitmapText} of a bitmap font
	 * label, such as `lineHeight`.
	 */
	[key: string]: any;
}

/**
 * A button with a text label. Use it for menu entries, dialog choices and
 * any action the player clicks, taps, or selects with the keyboard or a pad.
 *
 * ## Drawn or skinned
 * With no assets, it is drawn as a rounded rectangle in `hoverOffColor`,
 * `hoverOnColor` under the pointer and `pressedColor` while held (which
 * follows `hoverOnColor` when left out), with a `borderColor` outline. Give
 * it a `skin` ({@link UITextButtonSkin}) to draw it from atlas regions
 * instead, stretched as a nine-slice to any `width` and `height`.
 *
 * ## What it does
 * Pass an `onClick` setting. It is called on a COMPLETED click only: a press
 * dragged off the button is taken back, and a drag that starts on it inside
 * a scrolling {@link UIPanel} scrolls the panel instead. Enter, Space or A
 * with the focus, and the `bindKey` shortcut, click it too.
 *
 * A subclass can still override {@link UIBaseElement#onClick} and
 * {@link UIBaseElement#onRelease}; they run on the press and on the
 * release, before the `onClick` setting.
 *
 * ## Text
 * `font` is the name of a loaded bitmap font or, failing that, a CSS font
 * family (`"sans-serif"` by default). `fontSize` is the label height in
 * pixels for both kinds. `labelFillStyle` colours it.
 *
 * ## Turning it off
 * `enabled: false` (or setting {@link UIBaseElement#enabled} later) stops
 * clicks, the shortcut and the focus, and draws it with its `disabled` skin
 * region or at half opacity.
 *
 * ## Older setting names
 * Still accepted, as aliases: `borderWidth` / `borderHeight` for `width` /
 * `height`, `size` for `fontSize` (a scale with a bitmap font),
 * `fillStyle` for `labelFillStyle`, and `borderStrokeColor` for
 * `borderColor`.
 *
 * Focus, bounce (`hoverScale`, `pressScale`) and the rest come from
 * {@link UIBaseElement}.
 * @category UI
 * @example
 * // drawn, with no assets
 * import { UITextButton, state } from "melonjs";
 *
 * const play = new UITextButton(100, 200, {
 *     text: "Play",
 *     fontSize: 24,
 *     onClick: () => state.change(state.PLAY),
 * });
 * app.world.addChild(play);
 * @example
 * // skinned from an atlas, with a bitmap font 12 pixels high
 * const accept = new UITextButton(30, 250, {
 *     font: "kenpixel",
 *     fontSize: 12,
 *     text: "Accept",
 *     width: 160,
 *     skin: { atlas, normal: "green_button04", pressed: "green_button05" },
 *     onClick: () => saveSettings(),
 * });
 * @example
 * // a keyboard shortcut: Escape clicks "Back"
 * import { UITextButton, input } from "melonjs";
 *
 * const back = new UITextButton(20, 20, {
 *     text: "Back",
 *     bindKey: input.KEY.ESC,
 *     onClick: () => closeMenu(),
 * });
 * @example
 * // disabled until something happens
 * const start = new UITextButton(100, 300, {
 *     text: "Start",
 *     enabled: false,
 *     onClick: () => startGame(),
 * });
 * // ... once the player has picked a character
 * start.enabled = true;
 * @example
 * // one style shared by several buttons
 * const style = {
 *     font: "Arial",
 *     fontSize: 20,
 *     width: 200,
 *     labelFillStyle: "#ffffff",
 *     hoverOffColor: "#224488",
 *     hoverOnColor: "#3366cc",
 *     pressedColor: "#112244",
 *     borderColor: "#ffffff",
 *     hoverScale: 1.05,
 * };
 * const resume = new UITextButton(100, 150, { ...style, text: "Resume", onClick: resumeGame });
 * const quit = new UITextButton(100, 210, { ...style, text: "Quit", onClick: quitGame });
 */
export default class UITextButton extends UIBaseElement {
	/**
	 * A keyboard shortcut that clicks the button: an `input.KEY` key code, or
	 * the name of an action bound with `input.bindKey` (so every key bound to
	 * it works). `-1`, or an empty string, for none.
	 *
	 * The key going down presses the button (the `onClick` method runs, with
	 * no event); the same key coming up releases it (`onRelease`), then the
	 * `onClick` setting runs. The shortcut works only while the button is in
	 * the scene and enabled, and it does not change any global key binding.
	 * Whichever input presses first, key or pointer, owns the press until it
	 * is released.
	 *
	 * When another button shows the focus ring, Enter and Space belong to that
	 * button: an "OK" bound to Enter does not fire while "Cancel" is focused.
	 *
	 * Setting `enabled` to `false` while the key is held calls the press off.
	 * Clearing only `isClickable` blocks new presses but still lets a held key
	 * release, so the button is not left stuck down.
	 *
	 * The window losing focus, or the button being removed, calls a held key
	 * press off: `onCancel()` is called instead of `onRelease()`, and there
	 * is no click. Code that starts something on the press, such as firing a
	 * weapon, stops it in both `onRelease()` and `onCancel()`.
	 * @default -1
	 * @example
	 * // Escape clicks the button
	 * backButton.bindKey = input.KEY.ESC;
	 * @example
	 * // every key bound to the "pause" action clicks the button
	 * input.bindKey(input.KEY.P, "pause");
	 * pauseButton.bindKey = "pause";
	 */
	bindKey: string | number;

	/**
	 * What the button does, from the `onClick` setting: called once per
	 * completed click, with the button. Can be set or replaced later. See
	 * {@link UITextButtonSettings.onClick}.
	 * @example
	 * // switch what the button does once the level is loaded
	 * startButton.onClickCallback = () => state.change(state.PLAY);
	 */
	onClickCallback: ((button: UITextButton) => void) | undefined;

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
		// Enter on another button that shows the focus is that button's: an
		// OK bound to Enter does not fire with a focused Cancel
		if (
			ringVisible() &&
			focusOwner() !== undefined &&
			focusOwner() !== this &&
			isAcceptKey(keyCode)
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
			// called off, as a pointer press can be: no release, no click
			this.onCancel();
		}
	};

	/**
	 * The background colour at rest, drawn look only.
	 * @default "#00aa0080"
	 */
	hoverOffColor: Paint;

	/**
	 * The background colour under the pointer, drawn look only. Also the
	 * colour while held, when `pressedColor` is undefined.
	 * @default "#00ff00ff"
	 */
	hoverOnColor: Paint;

	/**
	 * The background colour while held down, drawn look only. Left
	 * undefined, the button shows {@link UITextButton#hoverOnColor},
	 * following it if it changes.
	 */
	pressedColor: Paint | undefined;

	/**
	 * The outline colour, drawn look only: the `borderColor` setting (or its
	 * older name `borderStrokeColor`).
	 * @default "#000000"
	 */
	borderStrokeColor: Paint;

	/**
	 * The label's horizontal alignment about the centre of the button:
	 * `"left"`, `"right"` or `"center"`. Read when the button is built.
	 * @default "center"
	 */
	textAlign: string;

	/**
	 * The label's baseline about the vertical middle of the button: `"top"`,
	 * `"hanging"`, `"middle"`, `"alphabetic"`, `"ideographic"` or
	 * `"bottom"`. Read when the button is built.
	 * @default "middle"
	 */
	textBaseline: string;

	/**
	 * The label: a {@link BitmapText} for a loaded bitmap font, a
	 * {@link Text} otherwise.
	 * @example
	 * // change the text later (the button keeps its size)
	 * scoreButton.label.setText("Score: 120");
	 */
	label: UILabel;

	/**
	 * the label's size as measured when the button was built
	 */
	dimensions: Bounds;

	/**
	 * the rounded rectangle the drawn look fills and outlines
	 */
	border: RoundRect;

	/** the `skin` setting, or `undefined` for the drawn look */
	readonly skin: UITextButtonSkin | undefined;

	/** @ignore */
	private _skin: SkinDrawer | undefined;
	/** how far the label is lowered right now, for the pressed art */
	private _labelDrop = 0;

	/**
	 * @param x - the x position of the button's top-left corner, in screen pixels
	 * @param y - the y position of the button's top-left corner, in screen pixels
	 * @param settings - see {@link UITextButtonSettings}
	 * @example
	 * // as a subclass, acting on the press rather than the completed click
	 * class FireButton extends UITextButton {
	 *     constructor(x, y) {
	 *         super(x, y, { text: "Fire", width: 120, height: 48 });
	 *     }
	 *     onClick() {
	 *         startFiring();
	 *         return false;
	 *     }
	 *     onRelease() {
	 *         stopFiring();
	 *         return false;
	 *     }
	 *     onCancel() {
	 *         stopFiring();
	 *     }
	 * }
	 */
	constructor(x: number, y: number, settings: UITextButtonSettings = {}) {
		super(x, y);

		// the settings are read, never written back: one object can make
		// several buttons
		this.bindKey = settings.bindKey ?? -1;
		this.onClickCallback = settings.onClick;

		this.hoverOffColor = settings.hoverOffColor || "#00aa0080";
		this.hoverOnColor = settings.hoverOnColor || "#00ff00ff";
		// left undefined, a held button shows the hover colour as it did
		// before it had a colour of its own, and follows it if it changes
		this.pressedColor = settings.pressedColor;

		this.borderStrokeColor =
			settings.borderColor || settings.borderStrokeColor || "#000000";

		this.textAlign = settings.textAlign || "center";
		this.textBaseline = settings.textBaseline || "middle";
		const fillStyle = settings.labelFillStyle ?? settings.fillStyle;

		const font = settings.font ?? "sans-serif";
		// a bitmap font as before: by name, by data given under another
		// name, or as an image
		if (
			settings.fontData !== undefined ||
			typeof font !== "string" ||
			getImage(font) != null
		) {
			const label = new BitmapText(0, 0, {
				...settings,
				...(fillStyle !== undefined ? { fillStyle } : {}),
				textAlign: this.textAlign,
				textBaseline: this.textBaseline,
			} as any);
			if (settings.fontSize !== undefined) {
				// at its authored scale, one line measures its line height
				label.resize(1);
				const lineHeight = label.measureText("Ag").height;
				if (lineHeight > 0) {
					label.resize(settings.fontSize / lineHeight);
				}
			}
			this.label = label;
		} else {
			this.label = new Text(0, 0, {
				font,
				size: settings.fontSize ?? settings.size ?? 16,
				fillStyle: fillStyle ?? "#000000",
				textAlign: this.textAlign,
				textBaseline: this.textBaseline,
				text: settings.text ?? "",
			});
		}

		this.skin = settings.skin;
		let width = settings.width ?? settings.borderWidth;
		let height = settings.height ?? settings.borderHeight;
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

		// create the round rect button
		this.border = new RoundRect(x, y, width, height);

		// resize the container accordingly
		this.resize(width, height);

		// add the label to the UI container
		this.addChild(this.label);

		this.focusable = true;
		this.hoverScale = settings.hoverScale ?? 1;
		this.pressScale = settings.pressScale ?? 1;
		this.enabled = settings.enabled ?? true;
	}

	/**
	 * The label, under its original name and type, for code written when it
	 * was always a {@link BitmapText}. With a CSS font it is a {@link Text}
	 * all the same.
	 * @deprecated since 20.13.0, use {@link UITextButton#label}
	 */
	get bitmapText(): BitmapText {
		return this.label as BitmapText;
	}

	set bitmapText(value: BitmapText) {
		this.label = value;
	}

	/**
	 * Called when Enter, Space or A is let go with the focus here: a
	 * completed click, so the `onClick` setting runs.
	 */
	override focusRelease(): void {
		const pressed = !this.released;
		super.focusRelease();
		if (pressed) {
			this.completeClick();
		}
	}

	/**
	 * Call off a press, from the pointer or from the `bindKey`, without a
	 * click. See {@link UIBaseElement#cancelPress}.
	 */
	override cancelPress(): void {
		this.cancelKeyboardPress();
		super.cancelPress();
	}

	/**
	 * Resize the button; the background and the centred label follow.
	 *
	 * A {@link UIPanel} calls this to stretch a button to its column.
	 * @param w - the new width, in pixels
	 * @param h - the new height, in pixels
	 * @returns this button
	 * @example
	 * button.resize(240, 48);
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
		if (this._enabled && this.onClickCallback !== undefined) {
			this.onClickCallback(this);
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
				r.setColor(this.pressedColor ?? this.hoverOnColor);
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
