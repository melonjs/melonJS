import type Camera2d from "../../camera/camera2d.ts";
import {
	registerPointerEvent,
	releasePointerEvent,
} from "../../input/input.ts";
import type Pointer from "../../input/pointer.ts";
import { clamp } from "../../math/math.ts";
import { off, on, POINTERMOVE } from "../../system/event.ts";
import type Renderer from "../../video/renderer.js";
import type { Paint } from "./panelpaint.ts";
import { PanelPainter } from "./panelpaint.ts";
import type { UIJuiceSettings } from "./uibaseelement.ts";
import UIBaseElement, {
	END_EVENTS,
	endsPointer,
	isPointerUp,
} from "./uibaseelement.ts";
import type { UINavAction } from "./uifocus.ts";
import type { UILabel } from "./uilabel.ts";
import { createLabel } from "./uilabel.ts";
import type { UISkin } from "./uiskin.ts";
import { SkinDrawer } from "./uiskin.ts";

/**
 * The art of a skinned {@link UISlider}: atlas regions for the track, the
 * filled part of the track and the thumb.
 *
 * The track and the fill are stretched as nine-slices along the slider's
 * {@link UISliderSettings#length}, and keep the region's thickness across
 * it unless `trackThickness` is set. The thumb is drawn at its region's
 * size. A disabled slider is drawn at half opacity. Every region named is
 * looked up when the slider is built, so a misspelt name throws there.
 * @category UI
 * @example
 * // a track and a thumb; no fill
 * const skin = { atlas, track: "grey_sliderHorizontal", thumb: "blue_sliderDown" };
 */
export interface UISliderSkin extends UISkin {
	/** the region for the whole track */
	track: string;
	/**
	 * the region for the part of the track from the low end to the thumb;
	 * not drawn if left out
	 */
	fill?: string;
	/** the region for the thumb */
	thumb: string;
	/**
	 * the region for the thumb under the pointer or while dragged; `thumb`
	 * if left out
	 */
	thumbHover?: string;
}

/**
 * The settings {@link UISlider} takes. All are optional.
 *
 * The colour settings are for the drawn look and are ignored when a `skin`
 * is given.
 * @category UI
 */
export interface UISliderSettings extends UIJuiceSettings {
	/**
	 * the lowest value; `min` and `max` are swapped if given the wrong way
	 * round
	 * @default 0
	 */
	min?: number;
	/**
	 * the highest value
	 * @default 1
	 */
	max?: number;
	/**
	 * the interval values snap to, counted from `min`; `0` for no snapping
	 * @default 0
	 */
	step?: number;
	/**
	 * the starting value, snapped to `step` and clamped to the range; `min`
	 * by default
	 */
	value?: number;
	/**
	 * which way it slides; a vertical slider has its highest value at the
	 * top. Fixed once built.
	 * @default "horizontal"
	 */
	orientation?: "horizontal" | "vertical";
	/**
	 * the length of the track, in pixels: its width on a horizontal slider,
	 * its height on a vertical one
	 * @default 200
	 */
	length?: number;
	/**
	 * the thickness of the track, in pixels; with a skin, the track region's
	 * thickness by default
	 * @default 6
	 */
	trackThickness?: number;
	/**
	 * the diameter of the round thumb, in pixels (drawn look; a skin's thumb
	 * keeps its region's size)
	 * @default 20
	 */
	thumbSize?: number;
	/**
	 * Called with the new value on every change the user makes, while
	 * dragging too. Never called when `value` is set from code. See
	 * {@link UISlider#onChange}.
	 */
	onChange?: (value: number, slider: UISlider) => void;
	/**
	 * Called with the final value once the user lets go, and after each
	 * wheel or key step. Never called when `value` is set from code. See
	 * {@link UISlider#onChangeEnd}.
	 */
	onChangeEnd?: (value: number, slider: UISlider) => void;
	/**
	 * whether it answers input; a disabled slider is drawn at half opacity
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * a caption drawn above the track: at the left on a horizontal slider,
	 * centred on a vertical one
	 */
	label?: string;
	/**
	 * show the value as text: at the right end of the caption row on a
	 * horizontal slider, below the track on a vertical one
	 * @default false
	 */
	showValue?: boolean;
	/**
	 * How the value text is written, given the value and the ratio (where
	 * the value is between `min` and `max`, 0 to 1). By default, the value
	 * with as many decimals as `step` has, or 2 decimals with no step.
	 * @example
	 * valueFormat: (value, ratio) => `${Math.round(ratio * 100)}%`
	 */
	valueFormat?: (value: number, ratio: number) => string;
	/**
	 * a CSS font family, or the name of a loaded bitmap font
	 * @default "sans-serif"
	 */
	font?: string;
	/**
	 * the text height of the caption and the value, in pixels
	 * @default 16
	 */
	fontSize?: number;
	/**
	 * the colour of the caption and the value
	 * @default "#000000"
	 */
	labelFillStyle?: string;
	/**
	 * the track (drawn look)
	 * @default "#00000033"
	 */
	trackColor?: Paint;
	/**
	 * the part of the track from the low end to the thumb (drawn look)
	 * @default "#2a7de1"
	 */
	fillColor?: Paint;
	/**
	 * the thumb (drawn look)
	 * @default "#ffffff"
	 */
	thumbColor?: Paint;
	/**
	 * the thumb under the pointer or while dragged (drawn look)
	 * @default "#e4eefb"
	 */
	thumbHoverColor?: Paint;
	/**
	 * the thumb's outline (drawn look)
	 * @default "#2a7de1"
	 */
	thumbBorderColor?: Paint;
	/**
	 * the thickness of the thumb's outline, in pixels (drawn look); `0` for
	 * none
	 * @default 2
	 */
	thumbBorderWidth?: number;
	/** draw it from atlas regions instead of the drawn look */
	skin?: UISliderSkin;
}

/** a rectangle in the slider's own coordinates */
interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * A slider: the player picks a number by moving a thumb along a track. Use
 * it for settings with a range, such as volume, mouse sensitivity or
 * brightness.
 *
 * ## Range and value
 * The value is {@link UISlider#value}, between {@link UISlider#min} and
 * {@link UISlider#max} (0 and 1 by default). With a {@link UISlider#step}
 * it snaps to that interval; `step: 1` gives whole numbers. `min`, `max`
 * and `step` can be changed later: the value is clamped and snapped again,
 * silently. {@link UISlider#ratio} is where the value is in the range, from
 * 0 to 1.
 *
 * ## Input
 * - Drag the thumb. The drag keeps following the pointer when it leaves
 *   the slider, until the button or finger is released.
 * - Click or tap the track: the thumb jumps there, and can be dragged on.
 * - The mouse wheel over the slider moves it one step (a hundredth of the
 *   range with no `step`).
 * - With the focus ({@link UIBaseElement#focus}), the arrow keys or the
 *   D-pad step it: left and right on a horizontal slider, up and down on a
 *   vertical one. A step is `step`, or a twentieth of the range without
 *   one.
 *
 * ## onChange and onChangeEnd
 * `onChange` is called on every change the user makes, many times during a
 * drag: use it for live feedback, such as setting the volume. `onChangeEnd`
 * is called once when the user lets go, and after each wheel or key step:
 * use it for work that should not run on every frame of a drag, such as
 * saving settings or playing a test sound. Neither is called when `value`
 * is set from code, so restoring saved settings does not trigger them.
 *
 * ## Text
 * `label` is a caption drawn above the track. `showValue` adds the value as
 * text, written by `valueFormat(value, ratio)`. The default format shows
 * as many decimals as `step` has: `step: 1` shows "7", `step: 0.1` shows
 * "0.7", and no step shows "0.70".
 *
 * ## Look
 * Drawn with shapes by default: a rounded track, a filled part up to the
 * thumb, and a round thumb, coloured by `trackColor`, `fillColor`,
 * `thumbColor`, `thumbHoverColor` and `thumbBorderColor`. Or pass a
 * {@link UISliderSkin} of atlas regions (`track`, `fill`, `thumb`,
 * `thumbHover`).
 *
 * ## In a scrolling panel
 * Inside a scrolling {@link UIPanel}, a drag that starts on the slider
 * moves the slider, not the panel.
 * @category UI
 * @example
 * // a volume slider wired to the audio, saved when the user lets go
 * save.add({ volume: 1 });
 * const volume = new UISlider(40, 80, {
 *     label: "Volume",
 *     value: save.volume,
 *     onChange: (v) => audio.setVolume(v),
 *     onChangeEnd: (v) => {
 *         save.volume = v;
 *     },
 * });
 * panel.addChild(volume);
 * @example
 * // a whole number from 1 to 10, shown as "1" ... "10"
 * const sensitivity = new UISlider(40, 140, {
 *     label: "Sensitivity",
 *     min: 1,
 *     max: 10,
 *     step: 1,
 *     value: 5,
 *     showValue: true,
 * });
 * @example
 * // vertical: highest value at the top
 * const brightness = new UISlider(300, 40, {
 *     orientation: "vertical",
 *     length: 150,
 *     label: "Light",
 *     showValue: true,
 *     value: 0.8,
 * });
 * @example
 * // skinned from an atlas
 * const music = new UISlider(40, 200, {
 *     length: 320,
 *     skin: { atlas, track: "grey_sliderHorizontal", thumb: "blue_sliderDown" },
 * });
 * @example
 * // the value shown as a percentage
 * const sfx = new UISlider(40, 260, {
 *     label: "Effects",
 *     showValue: true,
 *     valueFormat: (value, ratio) => `${Math.round(ratio * 100)}%`,
 * });
 * @example
 * // in a scrolling panel: dragging the thumb does not scroll the panel
 * const options = new UIPanel(20, 20, {
 *     width: 360,
 *     height: 200,
 *     layout: "column",
 *     padding: 12,
 *     scroll: "vertical",
 * });
 * options.addChild(new UISlider(0, 0, { label: "Music", length: 300 }));
 * options.addChild(new UISlider(0, 0, { label: "Effects", length: 300 }));
 */
export default class UISlider extends UIBaseElement {
	/**
	 * Called with the new value on every change the user makes: each move
	 * of a drag, a click on the track, a wheel or key step. Use it for live
	 * feedback. Not called when {@link UISlider#value} is set from code, nor
	 * when a move leaves the value unchanged.
	 * @example
	 * volume.onChange = (v) => audio.setVolume(v);
	 */
	onChange: ((value: number, slider: UISlider) => void) | undefined;

	/**
	 * Called with the final value once the user lets go after changing it,
	 * and after each wheel or key step. Use it for work that should not run
	 * on every move of a drag: saving settings, playing a test sound. Not
	 * called when {@link UISlider#value} is set from code, nor when a drag
	 * ends where it began.
	 * @example
	 * sfx.onChangeEnd = (v) => {
	 *     save.sfxVolume = v;
	 *     audio.play("coin", { volume: v });
	 * };
	 */
	onChangeEnd: ((value: number, slider: UISlider) => void) | undefined;

	/** the track (drawn look) */
	trackColor: Paint;
	/** the part of the track from the low end to the thumb (drawn look) */
	fillColor: Paint;
	/** the thumb (drawn look) */
	thumbColor: Paint;
	/** the thumb under the pointer or while dragged (drawn look) */
	thumbHoverColor: Paint;
	/** the thumb's outline (drawn look) */
	thumbBorderColor: Paint;
	/** the thickness of the thumb's outline, in pixels (drawn look) */
	thumbBorderWidth: number;

	/** which way it slides; set when it is built */
	readonly orientation: "horizontal" | "vertical";
	/** the atlas regions it is drawn from, or `undefined` for the drawn look */
	readonly skin: UISliderSkin | undefined;
	/** the caption's text object, or `undefined` without a `label` */
	readonly label: UILabel | undefined;
	/**
	 * the value's text object, or `undefined` without `showValue`; kept up
	 * to date by the slider
	 */
	readonly valueText: UILabel | undefined;

	/** @ignore */
	private _valueFormat: (value: number, ratio: number) => string;
	/** whether the format is the default one, which follows the step */
	private _defaultFormat: boolean;
	/** @ignore */
	private _min: number;
	/** @ignore */
	private _max: number;
	/** @ignore */
	private _step: number;
	/** @ignore */
	private _value: number;
	/** @ignore */
	private readonly _painter = new PanelPainter();
	/** @ignore */
	private readonly _skin: SkinDrawer | undefined;
	/** the track, in the slider's coordinates */
	private readonly _track: Box;
	/** where the thumb's centre can go, along the slider */
	private readonly _travelStart: number;
	private readonly _travelLength: number;
	/** the thumb's size across and along the slider */
	private readonly _thumbW: number;
	private readonly _thumbH: number;
	/** where the value text and the caption go, in the slider's coordinates */
	private readonly _valueAt: [number, number] = [0, 0];
	private readonly _labelAt: [number, number] = [0, 0];

	/** whether a drag is going on */
	private _dragging = false;
	/** the pointer's distance from the thumb's centre when it was grabbed */
	private _grab = 0;
	/** the value when the drag began */
	private _dragFrom = 0;
	/** the pointer the drag follows */
	private _dragPointer: number | undefined;

	private readonly _onDragMove = (pointer: Pointer) => {
		if (this._dragging && pointer.pointerId === this._dragPointer) {
			this.setFromUser(this.valueAt(pointer) - this._grab);
		}
	};

	private readonly _onDragEnd = (event: Event) => {
		if (this._dragging && endsPointer(event, this._dragPointer)) {
			this.endDrag(true);
		}
	};

	private readonly _onWheel = (pointer: Pointer) => {
		if (!this._enabled) {
			return;
		}
		// wheel up, or to the right, raises the value: up is a NEGATIVE
		// deltaY, right a positive deltaX
		const direction =
			Math.abs(pointer.deltaY) >= Math.abs(pointer.deltaX)
				? -Math.sign(pointer.deltaY)
				: Math.sign(pointer.deltaX);
		if (direction === 0) {
			return;
		}
		const step = this._step > 0 ? this._step : (this._max - this._min) / 100;
		if (this.setFromUser(this._value + direction * step)) {
			this.onChangeEnd?.(this._value, this);
		}
		// consumed, so a scrolling panel under it does not scroll too
		return false;
	};

	/**
	 * @param x - left edge
	 * @param y - top edge
	 * @param settings - see {@link UISliderSettings}
	 */
	constructor(x: number, y: number, settings: UISliderSettings = {}) {
		super(x, y, 1, 1);

		// a drag on the slider is the slider's, even in a scrolling panel
		this.keepsDrag = true;

		this._min = settings.min ?? 0;
		this._max = settings.max ?? 1;
		if (this._max < this._min) {
			[this._min, this._max] = [this._max, this._min];
		}
		this._step = Math.max(0, settings.step ?? 0);
		this.orientation = settings.orientation ?? "horizontal";
		this.onChange = settings.onChange;
		this.onChangeEnd = settings.onChangeEnd;
		this._valueFormat = settings.valueFormat ?? defaultFormat(this._step);
		this._defaultFormat = settings.valueFormat === undefined;

		this.trackColor = settings.trackColor ?? "#00000033";
		this.fillColor = settings.fillColor ?? "#2a7de1";
		this.thumbColor = settings.thumbColor ?? "#ffffff";
		this.thumbHoverColor = settings.thumbHoverColor ?? "#e4eefb";
		this.thumbBorderColor = settings.thumbBorderColor ?? "#2a7de1";
		this.thumbBorderWidth = settings.thumbBorderWidth ?? 2;

		const horizontal = this.orientation === "horizontal";
		const length = settings.length ?? 200;
		let thickness = settings.trackThickness ?? 6;
		let thumbW = settings.thumbSize ?? 20;
		let thumbH = thumbW;

		this.skin = settings.skin;
		if (this.skin !== undefined) {
			this._skin = new SkinDrawer(this.skin);
			const track = this._skin.size(this.skin.track);
			const thumb = this._skin.size(this.skin.thumb);
			if (this.skin.fill !== undefined) {
				this._skin.size(this.skin.fill);
			}
			if (this.skin.thumbHover !== undefined) {
				this._skin.size(this.skin.thumbHover);
			}
			// across the slider, the art keeps its own size
			thickness =
				settings.trackThickness ?? (horizontal ? track.height : track.width);
			// the thumb's size along and across the slider
			thumbW = horizontal ? thumb.width : thumb.height;
			thumbH = horizontal ? thumb.height : thumb.width;
		}
		this._thumbW = thumbW;
		this._thumbH = thumbH;

		const textStyle = {
			font: settings.font ?? "sans-serif",
			fontSize: settings.fontSize ?? 16,
			fillStyle: settings.labelFillStyle ?? "#000000",
			textBaseline: "middle",
		};
		if (settings.label !== undefined) {
			this.label = createLabel({
				...textStyle,
				text: settings.label,
				textAlign: horizontal ? "left" : "center",
			});
		}
		if (settings.showValue === true) {
			this.valueText = createLabel({
				...textStyle,
				text: this._valueFormat(this._max, 1),
				textAlign: horizontal ? "right" : "center",
			});
		}
		const rowHeight =
			this.label !== undefined || this.valueText !== undefined
				? Math.ceil(textStyle.fontSize * 1.4)
				: 0;

		// the band the thumb slides in: as thick as the thumb or the track
		const band = Math.max(thumbH, thickness);
		if (horizontal) {
			const top = rowHeight;
			this._track = {
				x: 0,
				y: top + (band - thickness) / 2,
				w: length,
				h: thickness,
			};
			this._travelStart = thumbW / 2;
			this._valueAt[0] = length;
			this._valueAt[1] = rowHeight / 2;
			this._labelAt[1] = rowHeight / 2;
			this.resize(length, top + band);
		} else {
			const textWidth = Math.max(
				this.label?.measureText().width ?? 0,
				this.valueText?.measureText().width ?? 0,
			);
			const width = Math.ceil(Math.max(band, textWidth));
			const top = this.label !== undefined ? rowHeight : 0;
			this._track = {
				x: (width - thickness) / 2,
				y: top,
				w: thickness,
				h: length,
			};
			this._travelStart = top + thumbW / 2;
			this._valueAt[0] = width / 2;
			this._valueAt[1] = top + length + rowHeight / 2;
			this._labelAt[0] = width / 2;
			this._labelAt[1] = rowHeight / 2;
			this.resize(width, top + length + (this.valueText ? rowHeight : 0));
		}
		this._travelLength = Math.max(0, length - thumbW);

		this._value = this.snap(settings.value ?? this._min);
		this.refreshValueText();
		this.focusable = true;
		this.hoverScale = settings.hoverScale ?? 1;
		this.pressScale = settings.pressScale ?? 1;
		this.enabled = settings.enabled ?? true;
	}

	/**
	 * The lowest value. Setting it clamps and snaps the value into the new
	 * range without calling `onChange`; a `min` above `max` raises `max` to
	 * it.
	 */
	get min(): number {
		return this._min;
	}

	set min(v: number) {
		this._min = v;
		this._max = Math.max(this._max, v);
		this.resnap();
	}

	/**
	 * The highest value. Setting it clamps and snaps the value into the new
	 * range without calling `onChange`; a `max` below `min` lowers `min` to
	 * it.
	 * @example
	 * // unlock more levels: the value keeps its place
	 * levelSelect.max = unlockedLevels;
	 */
	get max(): number {
		return this._max;
	}

	set max(v: number) {
		this._max = v;
		this._min = Math.min(this._min, v);
		this.resnap();
	}

	/**
	 * The interval values snap to, counted from `min`; `0` for none.
	 * Setting it snaps the value to it without calling `onChange`, and, with
	 * the default `valueFormat`, changes the decimals shown to match.
	 */
	get step(): number {
		return this._step;
	}

	set step(v: number) {
		this._step = Math.max(0, v);
		if (this._defaultFormat) {
			// the default shows as many decimals as the step has
			this._valueFormat = defaultFormat(this._step);
		}
		this.resnap();
	}

	/**
	 * Where the value is between {@link UISlider#min} and
	 * {@link UISlider#max}, from 0 to 1 (0 when the range is empty).
	 * Read only.
	 * @example
	 * // a 50..150 slider at 125 has a ratio of 0.75
	 * const percent = Math.round(slider.ratio * 100);
	 */
	get ratio(): number {
		const span = this._max - this._min;
		return span > 0 ? (this._value - this._min) / span : 0;
	}

	/**
	 * How the value text is written, given the value and the ratio (0 to
	 * 1). Setting it rewrites the value text straight away. The space for
	 * the text on a vertical slider is measured when it is built, so a much
	 * longer format set later may not fit.
	 * @example
	 * slider.valueFormat = (value) => `${value} px`;
	 */
	get valueFormat(): (value: number, ratio: number) => string {
		return this._valueFormat;
	}

	set valueFormat(format: (value: number, ratio: number) => string) {
		this._valueFormat = format;
		this._defaultFormat = false;
		this.refreshValueText();
	}

	/**
	 * Snap and clamp the value again after the range or the step changed.
	 * @ignore
	 * @internal
	 */
	private resnap() {
		this._value = this.snap(this._value);
		this.refreshValueText();
		this.isDirty = true;
	}

	/**
	 * Write the current value into the value text.
	 * @ignore
	 * @internal
	 */
	private refreshValueText() {
		this.valueText?.setText(this._valueFormat(this._value, this.ratio));
	}

	/**
	 * The current value, between {@link UISlider#min} and
	 * {@link UISlider#max}.
	 *
	 * Setting it snaps it to the step and clamps it to the range, and does
	 * NOT call `onChange` or `onChangeEnd`: restoring saved settings does not
	 * run the code a user's change would. A value that is not a finite
	 * number is ignored.
	 * @example
	 * // show the saved volume when the menu opens
	 * volume.value = save.volume;
	 */
	get value(): number {
		return this._value;
	}

	set value(v: number) {
		const next = this.snap(v);
		if (next !== this._value) {
			this._value = next;
			this.refreshValueText();
			this.isDirty = true;
		}
	}

	/**
	 * Step with the arrow keys or the D-pad while it has the focus: left and
	 * right on a horizontal slider, up and down on a vertical one. A step is
	 * `step`, or a twentieth of the range without one, and calls `onChange`
	 * and `onChangeEnd`. The other two directions move the focus away.
	 * @param action - the direction pressed
	 * @returns true for the directions along the slider
	 */
	override onNavigate(action: UINavAction): boolean {
		const horizontal = this.orientation === "horizontal";
		const sign =
			action === (horizontal ? "right" : "up")
				? 1
				: action === (horizontal ? "left" : "down")
					? -1
					: 0;
		if (sign === 0) {
			return false;
		}
		if (this._enabled) {
			const step = this._step > 0 ? this._step : (this._max - this._min) / 20;
			if (this.setFromUser(this._value + sign * step)) {
				this.onChangeEnd?.(this._value, this);
			}
		}
		return true;
	}

	/**
	 * Call off a press, and a drag in progress, without calling
	 * `onChangeEnd`. The value stays where the drag left it.
	 */
	override cancelPress(): void {
		this.endDrag(false);
		super.cancelPress();
	}

	/**
	 * Whether the thumb is being dragged right now.
	 */
	get dragging(): boolean {
		return this._dragging;
	}

	/**
	 * Snap a value to the step and clamp it to the range.
	 * @param v - the value
	 * @returns the value it becomes
	 * @ignore
	 * @internal
	 */
	private snap(v: number): number {
		if (!Number.isFinite(v)) {
			return this._value ?? this._min;
		}
		let out = v;
		if (this._step > 0) {
			out = this._min + Math.round((out - this._min) / this._step) * this._step;
			// a range that is not a whole number of steps: past the end,
			// take the last step inside rather than clamping off the grid
			if (out > this._max) {
				out -= this._step;
			}
			// 0.1 + 0.2: keep the digits the step has, and no stray ones
			out = Number(
				out.toFixed(Math.max(decimals(this._step), decimals(this._min))),
			);
		}
		return clamp(out, this._min, this._max);
	}

	/**
	 * Set the value as the user, calling `onChange` if it changed.
	 * @param v - the value
	 * @returns whether it changed
	 * @ignore
	 * @internal
	 */
	private setFromUser(v: number): boolean {
		const before = this._value;
		this.value = v;
		if (this._value !== before) {
			this.onChange?.(this._value, this);
			return true;
		}
		return false;
	}

	/** where the thumb's centre is, along the slider, in its coordinates */
	private thumbCenter(): number {
		const ratio = this.ratio;
		return this.orientation === "horizontal"
			? this._travelStart + ratio * this._travelLength
			: this._travelStart + (1 - ratio) * this._travelLength;
	}

	/**
	 * The pointer's position in the slider's coordinates.
	 * @ignore
	 * @internal
	 */
	private localPoint(pointer: Pointer): [number, number] {
		let px = pointer.gameScreenX;
		let py = pointer.gameScreenY;
		if (!this.isFloating) {
			const offset = this.parentApp?.world.pos;
			px = pointer.gameWorldX + (offset?.x ?? 0);
			py = pointer.gameWorldY + (offset?.y ?? 0);
		}
		const origin = this.getAbsolutePosition();
		return [px - origin.x, py - origin.y];
	}

	/**
	 * The value under the pointer.
	 * @ignore
	 * @internal
	 */
	private valueAt(pointer: Pointer): number {
		const [lx, ly] = this.localPoint(pointer);
		const along = this.orientation === "horizontal" ? lx : ly;
		const ratio =
			this._travelLength > 0
				? clamp((along - this._travelStart) / this._travelLength, 0, 1)
				: 0;
		const r = this.orientation === "horizontal" ? ratio : 1 - ratio;
		return this._min + r * (this._max - this._min);
	}

	/**
	 * Start a drag on a press on the track or the thumb; a press on the
	 * caption is let through.
	 * @ignore
	 * @internal
	 */
	override clicked(event: Pointer): boolean | void {
		if (event.button !== 0 || !this.isClickable || this._dragging) {
			return;
		}
		const [lx, ly] = this.localPoint(event);
		const horizontal = this.orientation === "horizontal";
		const along = horizontal ? lx : ly;
		const across = horizontal ? ly : lx;
		const t = this._track;
		const bandCenter = horizontal ? t.y + t.h / 2 : t.x + t.w / 2;
		const half = Math.max(this._thumbH, horizontal ? t.h : t.w) / 2;
		const start = horizontal ? t.x : t.y;
		const end = start + (horizontal ? t.w : t.h);
		if (Math.abs(across - bandCenter) > half || along < start || along > end) {
			return;
		}

		const center = this.thumbCenter();
		const onThumb = Math.abs(along - center) <= this._thumbW / 2;
		this._dragging = true;
		this._dragPointer = event.pointerId;
		this._dragFrom = this._value;
		this.released = false;
		this.isDirty = true;
		on(POINTERMOVE, this._onDragMove);
		for (const type of END_EVENTS) {
			globalThis.addEventListener?.(type, this._onDragEnd);
		}

		if (onThumb) {
			// grabbed where it was: the thumb does not jump under the pointer
			this._grab = this.valueAt(event) - this._value;
		} else {
			this._grab = 0;
			this.setFromUser(this.valueAt(event));
		}
		this.onClick(event);
		// consumed: what is under the slider does not get the press
		return false;
	}

	/**
	 * Stop dragging.
	 * @param notify - call `onChangeEnd` if the value moved
	 * @ignore
	 * @internal
	 */
	private endDrag(notify: boolean) {
		if (!this._dragging) {
			return;
		}
		this._dragging = false;
		this._dragPointer = undefined;
		this.released = true;
		this.isDirty = true;
		off(POINTERMOVE, this._onDragMove);
		for (const type of END_EVENTS) {
			globalThis.removeEventListener?.(type, this._onDragEnd);
		}
		if (notify && this._value !== this._dragFrom) {
			this.onChangeEnd?.(this._value, this);
		}
	}

	/**
	 * The pointer leaving does not end a drag; letting go does.
	 * @ignore
	 */
	override release(event: Pointer): boolean | void {
		if (this._dragging) {
			// let go over the slider: the window may not have heard it, in a
			// frame whose pointer-up the page never sees
			if (isPointerUp(event)) {
				this.endDrag(true);
			}
			return false;
		}
		return super.release(event);
	}

	/**
	 * Listen to the wheel while in the scene.
	 * @ignore
	 */
	override onActivateEvent(): void {
		super.onActivateEvent();
		registerPointerEvent("wheel", this, this._onWheel);
	}

	/**
	 * Stop listening, and drop a drag in progress.
	 * @ignore
	 */
	override onDeactivateEvent(): void {
		releasePointerEvent("wheel", this);
		this.endDrag(false);
		super.onDeactivateEvent();
	}

	/**
	 * Draw the track, the fill, the thumb, then the text.
	 * @param renderer - the renderer to draw with
	 * @param viewport - the camera being drawn through
	 */
	override draw(renderer: Renderer, viewport?: Camera2d) {
		const alpha = renderer.globalAlpha();
		const a = this._enabled ? alpha : alpha * 0.5;
		const horizontal = this.orientation === "horizontal";
		const x = this.pos.x;
		const y = this.pos.y;
		const t = this._track;
		const center = this.thumbCenter();
		const lit = this._enabled && (this._dragging || this.hover);

		// the filled part: from the low end to the thumb
		const fx = x + t.x;
		const fy = horizontal ? y + t.y : y + center;
		const fw = horizontal ? center - t.x : t.w;
		const fh = horizontal ? t.h : t.y + t.h - center;
		// the thumb, centred on its place
		const tw = horizontal ? this._thumbW : this._thumbH;
		const th = horizontal ? this._thumbH : this._thumbW;
		const tx = horizontal ? x + center - tw / 2 : x + t.x + t.w / 2 - tw / 2;
		const ty = horizontal ? y + t.y + t.h / 2 - th / 2 : y + center - th / 2;

		if (this._skin !== undefined) {
			const skin = this.skin!;
			renderer.setGlobalAlpha(a);
			this._skin.draw(renderer, skin.track, x + t.x, y + t.y, t.w, t.h);
			if (skin.fill !== undefined) {
				this._skin.draw(renderer, skin.fill, fx, fy, fw, fh);
			}
			const thumb =
				lit && skin.thumbHover !== undefined ? skin.thumbHover : skin.thumb;
			this._skin.draw(renderer, thumb, tx, ty, tw, th);
		} else {
			const painter = this._painter;
			const radius = Math.min(t.w, t.h) / 2;
			painter.paint(renderer, this.trackColor, a);
			painter.rect(renderer, x + t.x, y + t.y, t.w, t.h, radius);
			painter.paint(renderer, this.fillColor, a);
			painter.rect(renderer, fx, fy, fw, fh, radius);
			const r = this._thumbW / 2;
			painter.paint(renderer, lit ? this.thumbHoverColor : this.thumbColor, a);
			renderer.fillEllipse(tx + tw / 2, ty + th / 2, r, r);
			const bw = Math.min(this.thumbBorderWidth, r);
			if (bw > 0) {
				const previous = renderer.lineWidth;
				renderer.lineWidth = bw;
				painter.paint(renderer, this.thumbBorderColor, a);
				// inset by half the width, so the outline lands inside the thumb
				renderer.strokeEllipse(
					tx + tw / 2,
					ty + th / 2,
					r - bw / 2,
					r - bw / 2,
				);
				renderer.lineWidth = previous;
			}
		}

		renderer.setGlobalAlpha(a);
		if (this.label !== undefined) {
			drawText(
				renderer,
				this.label,
				x + this._labelAt[0],
				y + this._labelAt[1],
			);
		}
		if (this.valueText !== undefined) {
			drawText(
				renderer,
				this.valueText,
				x + this._valueAt[0],
				y + this._valueAt[1],
			);
		}
		renderer.setGlobalAlpha(alpha);
		super.draw(renderer, viewport);
	}

	/**
	 * Hand back what it borrowed.
	 * @ignore
	 */
	override onDestroyEvent() {
		this.endDrag(false);
		this._painter.dispose();
		this._skin?.dispose();
		this.label?.destroy();
		this.valueText?.destroy();
		super.onDestroyEvent();
	}
}

/**
 * Draw a label at a point, which its alignment is about.
 * @ignore
 * @internal
 */
function drawText(renderer: Renderer, text: UILabel, x: number, y: number) {
	if (text.pos.x !== x || text.pos.y !== y) {
		text.setPosition(x, y);
	}
	text.preDraw(renderer);
	text.draw(renderer);
	text.postDraw(renderer);
}

/**
 * How many decimals a step has.
 * @ignore
 * @internal
 */
function decimals(step: number): number {
	// `String(1e-7)` is "1e-7": count the exponent too
	const [mantissa, exponent] = String(step).split("e");
	const dot = mantissa.indexOf(".");
	const digits = dot === -1 ? 0 : mantissa.length - dot - 1;
	return Math.min(20, Math.max(0, digits - Number(exponent ?? 0)));
}

/**
 * The default value text: whole numbers for a whole step, two decimals
 * otherwise.
 * @ignore
 * @internal
 */
function defaultFormat(step: number): (value: number, ratio: number) => string {
	const digits = step > 0 ? decimals(step) : 2;
	return (value: number) => value.toFixed(digits);
}
