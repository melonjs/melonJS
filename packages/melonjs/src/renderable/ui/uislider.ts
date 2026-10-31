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
import UIBaseElement, {
	END_EVENTS,
	endsPointer,
	isPointerUp,
} from "./uibaseelement.ts";
import type { UILabel } from "./uilabel.ts";
import { createLabel } from "./uilabel.ts";
import type { UISkin } from "./uiskin.ts";
import { SkinDrawer } from "./uiskin.ts";

/**
 * The art of a skinned {@link UISlider}.
 *
 * The track and the fill are drawn as nine-slices along the slider's length;
 * the thumb at its own size.
 * @category UI
 */
export interface UISliderSkin extends UISkin {
	/** the whole track */
	track: string;
	/** the part of the track up to the thumb; left out, it is not drawn */
	fill?: string;
	/** the thumb */
	thumb: string;
	/** the thumb under the pointer or while dragged; `thumb` if left out */
	thumbHover?: string;
}

/**
 * Everything {@link UISlider} takes.
 * @category UI
 */
export interface UISliderSettings {
	/**
	 * the lowest value
	 * @default 0
	 */
	min?: number;
	/**
	 * the highest value
	 * @default 1
	 */
	max?: number;
	/**
	 * The step values snap to; `0` for none.
	 * @default 0
	 */
	step?: number;
	/** the starting value; `min` by default */
	value?: number;
	/**
	 * which way it slides; a vertical slider has its highest value at the top
	 * @default "horizontal"
	 */
	orientation?: "horizontal" | "vertical";
	/**
	 * the length of the track, in pixels
	 * @default 200
	 */
	length?: number;
	/**
	 * the thickness of the track, in pixels (drawn look; a skin uses its
	 * track region's)
	 * @default 6
	 */
	trackThickness?: number;
	/**
	 * the diameter of the thumb, in pixels (drawn look; a skin uses its
	 * thumb region's size)
	 * @default 20
	 */
	thumbSize?: number;
	/** called on every change the user makes; see {@link UISlider#onChange} */
	onChange?: (value: number, slider: UISlider) => void;
	/** called once when the user lets go; see {@link UISlider#onChangeEnd} */
	onChangeEnd?: (value: number, slider: UISlider) => void;
	/**
	 * whether it answers input
	 * @default true
	 */
	enabled?: boolean;
	/** a caption, drawn above the track */
	label?: string;
	/**
	 * show the value as text: right of the caption on a horizontal slider,
	 * below the track on a vertical one
	 * @default false
	 */
	showValue?: boolean;
	/** how the value is written, e.g. `(v) => Math.round(v * 100) + "%"` */
	format?: (value: number) => string;
	/**
	 * a CSS font family, or the name of a loaded bitmap font
	 * @default "sans-serif"
	 */
	font?: string;
	/**
	 * the text height, in pixels
	 * @default 16
	 */
	fontSize?: number;
	/**
	 * the text colour
	 * @default "#000000"
	 */
	labelFillStyle?: string;
	/**
	 * the track (drawn look)
	 * @default "#00000033"
	 */
	trackColor?: Paint;
	/**
	 * the track up to the thumb (drawn look)
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
	hoverOnColor?: Paint;
	/**
	 * the thumb's outline (drawn look)
	 * @default "#2a7de1"
	 */
	borderColor?: Paint;
	/** draw it from atlas regions instead */
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
 * A value picked by sliding a thumb along a track: volume, sensitivity,
 * brightness.
 *
 * Drag the thumb, or click or tap the track to jump there. The drag keeps
 * following the pointer once it leaves the track. The mouse wheel over the
 * slider moves it a step. Drawn with primitives by default, or from atlas
 * regions through a {@link UISliderSkin}.
 *
 * Its value is {@link UISlider#value}. `onChange` hears every change the
 * user makes, while dragging too, and `onChangeEnd` once when they let go,
 * which is where to save settings or play a test sound. Neither is called
 * when `value` is set from code.
 *
 * Inside a scrolling {@link UIPanel}, dragging the thumb moves the slider,
 * not the panel.
 * @category UI
 * @example
 * const volume = new UISlider(40, 80, {
 *     label: "Music",
 *     showValue: true,
 *     format: (v) => Math.round(v * 100) + "%",
 *     value: audio.getVolume(),
 *     onChange: (v) => audio.setVolume(v),
 *     onChangeEnd: () => saveSettings(),
 * });
 * panel.addChild(volume);
 */
export default class UISlider extends UIBaseElement {
	/**
	 * Called with the new value on every change the user makes: each drag
	 * step, a click on the track, a wheel step. Not when
	 * {@link UISlider#value} is set from code.
	 */
	onChange: ((value: number, slider: UISlider) => void) | undefined;

	/**
	 * Called once when the user lets go after changing the value, and after
	 * each wheel step. For work that should not run on every drag step:
	 * saving settings, playing a test sound.
	 */
	onChangeEnd: ((value: number, slider: UISlider) => void) | undefined;

	/** how the value is written */
	format: (value: number) => string;

	/** the track (drawn look) */
	trackColor: Paint;
	/** the track up to the thumb (drawn look) */
	fillColor: Paint;
	/** the thumb (drawn look) */
	thumbColor: Paint;
	/** the thumb under the pointer or while dragged (drawn look) */
	hoverOnColor: Paint;
	/** the thumb's outline (drawn look) */
	borderColor: Paint;

	/** which way it slides */
	readonly orientation: "horizontal" | "vertical";
	/** the art, when it is skinned */
	readonly skin: UISliderSkin | undefined;
	/** the caption, if any */
	readonly label: UILabel | undefined;
	/** the value text, when `showValue` is set */
	readonly valueText: UILabel | undefined;

	/** @ignore */
	private _min: number;
	/** @ignore */
	private _max: number;
	/** @ignore */
	private _step: number;
	/** @ignore */
	private _value: number;
	/** @ignore */
	private _enabled = true;
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
		this.format = settings.format ?? defaultFormat(this._step);

		this.trackColor = settings.trackColor ?? "#00000033";
		this.fillColor = settings.fillColor ?? "#2a7de1";
		this.thumbColor = settings.thumbColor ?? "#ffffff";
		this.hoverOnColor = settings.hoverOnColor ?? "#e4eefb";
		this.borderColor = settings.borderColor ?? "#2a7de1";

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
				text: this.format(this._max),
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
		this.valueText?.setText(this.format(this._value));
		this.enabled = settings.enabled ?? true;
	}

	/** the lowest value */
	get min(): number {
		return this._min;
	}

	/** the highest value */
	get max(): number {
		return this._max;
	}

	/** the step values snap to; `0` for none */
	get step(): number {
		return this._step;
	}

	/**
	 * The current value, between {@link UISlider#min} and
	 * {@link UISlider#max}.
	 *
	 * Setting it snaps it to the step and clamps it, and does NOT call
	 * `onChange` or `onChangeEnd`, so restoring saved settings does not
	 * trigger what a user's change would.
	 */
	get value(): number {
		return this._value;
	}

	set value(v: number) {
		const next = this.snap(v);
		if (next !== this._value) {
			this._value = next;
			this.valueText?.setText(this.format(next));
			this.isDirty = true;
		}
	}

	/**
	 * Whether it answers input.
	 *
	 * A disabled slider is drawn at half opacity and ignores the pointer and
	 * the wheel; disabling it mid-drag ends the drag.
	 * @default true
	 */
	get enabled(): boolean {
		return this._enabled;
	}

	set enabled(value: boolean) {
		this._enabled = value;
		this.isClickable = value;
		if (!value) {
			this.endDrag(false);
			this.cancelPress();
		}
		this.isDirty = true;
	}

	/**
	 * Whether the thumb is being dragged.
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
			// 0.1 + 0.2: keep the digits the step has, and no stray ones
			out = Number(out.toFixed(decimals(this._step)));
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
		const span = this._max - this._min;
		const ratio = span > 0 ? (this._value - this._min) / span : 0;
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
			painter.paint(renderer, lit ? this.hoverOnColor : this.thumbColor, a);
			renderer.fillEllipse(tx + tw / 2, ty + th / 2, r, r);
			const previous = renderer.lineWidth;
			renderer.lineWidth = 2;
			painter.paint(renderer, this.borderColor, a);
			renderer.strokeEllipse(tx + tw / 2, ty + th / 2, r - 1, r - 1);
			renderer.lineWidth = previous;
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
	const text = String(step);
	const dot = text.indexOf(".");
	return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * The default value text: whole numbers for a whole step, two decimals
 * otherwise.
 * @ignore
 * @internal
 */
function defaultFormat(step: number): (value: number) => string {
	const digits = step > 0 ? decimals(step) : 2;
	return (value: number) => value.toFixed(digits);
}
