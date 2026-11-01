import { clamp } from "../../math/math.ts";
import { off, on } from "../../system/event.ts";
import type Renderer from "../../video/renderer.js";
import Renderable from "../renderable.js";
import Text from "../text/text.js";
import type { Paint } from "./panelpaint.ts";
import { PanelPainter } from "./panelpaint.ts";

/**
 * The name of any event the engine knows about.
 *
 * Derived from `on` rather than naming the `Events` map, which is internal to
 * the event module; this gets the same set without widening that surface.
 */
type EventName = Parameters<typeof on>[0];

/**
 * Which edge a {@link ProgressBar}'s fill grows from: `"left-to-right"`
 * and `"right-to-left"` for a horizontal bar, `"top-to-bottom"` and
 * `"bottom-to-top"` for a vertical one.
 * @category UI
 */
export type ProgressBarDirection =
	| "left-to-right"
	| "right-to-left"
	| "top-to-bottom"
	| "bottom-to-top";

/**
 * The settings a {@link ProgressBar} takes. Only `width` and `height` are
 * required.
 * @category UI
 */
export interface ProgressBarSettings {
	/** the bar's full width, in pixels */
	width: number;
	/** the bar's full height, in pixels */
	height: number;
	/**
	 * the value that shows as empty
	 * @default 0
	 */
	min?: number;
	/**
	 * the value that shows as full
	 * @default 1
	 */
	max?: number;
	/**
	 * the starting value, clamped between `min` and `max`; `min` if not given
	 */
	value?: number;
	/**
	 * which edge the fill grows from; see {@link ProgressBarDirection}
	 * @default "left-to-right"
	 */
	direction?: ProgressBarDirection;
	/**
	 * the colour behind the fill; `null` leaves it hollow, showing whatever
	 * is behind the bar
	 * @default null
	 */
	trackColor?: Paint | null;
	/**
	 * The colour of the fill. A {@link Color} is read again every frame, so
	 * changing the one you passed changes the bar.
	 * @default "#ffffff"
	 */
	fillColor?: Paint;
	/**
	 * the colour of the border drawn around the bar; `null` for none
	 * @default null
	 */
	borderColor?: Paint | null;
	/**
	 * the border's thickness, in pixels, drawn inside the bar's edge
	 * @default 1
	 */
	borderWidth?: number;
	/**
	 * the gap between the track's edge and the fill on each side, in pixels
	 * @default 0
	 */
	padding?: number;
	/**
	 * the corner radius, in pixels; `0` is square. The fill's corners are
	 * reduced by `padding`, so they stay parallel to the track's.
	 * @default 0
	 */
	radius?: number;
	/**
	 * The colour of a drop shadow under the bar; `null` for none. Its alpha
	 * sets how dark the shadow is, e.g. `"#00000066"`.
	 * @default null
	 */
	shadowColor?: Paint | null;
	/**
	 * how far right the shadow falls, in pixels; negative goes left
	 * @default 0
	 */
	shadowOffsetX?: number;
	/**
	 * how far down the shadow falls, in pixels; negative goes up
	 * @default 4
	 */
	shadowOffsetY?: number;
	/**
	 * how far the shadow's soft edge spreads, in pixels; `0` is a sharp edge
	 * @default 8
	 */
	shadowBlur?: number;
	/**
	 * Called each time the value changes, with the new value, the same as a
	 * `0..1` fraction of the way from `min` to `max`, and the bar. Not called
	 * when the value is set to what it already is.
	 */
	onChange?: (value: number, ratio: number, bar: ProgressBar) => void;
	/**
	 * draw a text label centred over the bar
	 * @default false
	 */
	showLabel?: boolean;
	/**
	 * the label's CSS font family
	 * @default "sans-serif"
	 */
	font?: string;
	/**
	 * the label's text height, in pixels; 70% of the bar's height (at least
	 * 8), rounded, if not given
	 */
	fontSize?: number;
	/**
	 * the label's colour
	 * @default "#ffffff"
	 */
	labelFillStyle?: Paint;
	/**
	 * What the label says, given the value and its `0..1` fraction. The
	 * default shows a rounded percentage, such as `"75%"`.
	 */
	labelFormat?: (value: number, ratio: number) => string;
	/**
	 * An event to take the value from, instead of setting it by hand: each
	 * time the event fires, its first argument becomes the value. The bar
	 * stops listening when it is destroyed.
	 */
	bindEvent?: EventName;
}

/**
 * A bar that shows one value between a minimum and a maximum: a health
 * bar, a shield or stamina gauge, a cooldown, a loading bar. Set
 * {@link ProgressBar#value} and it redraws. The engine's own loading screen
 * uses one.
 *
 * It draws its track, fill, border and optional label itself, as one
 * renderable, so there is nothing to keep in step.
 *
 * ## Look
 * `trackColor` is behind the fill (`null` for a hollow frame), `fillColor`
 * is the fill, `borderColor` and `borderWidth` draw an outline, `padding`
 * insets the fill, and `radius` rounds the corners. `direction` sets which
 * edge the fill grows from, horizontal or vertical.
 *
 * ## Value
 * `min` and `max` set the range (`0` to `1` by default). A value outside it
 * is clamped. {@link ProgressBar#ratio} gives the value as a `0..1`
 * fraction. `onChange(value, ratio, bar)` is called whenever the value
 * changes, and `bindEvent` takes the value from an event.
 *
 * ## Label
 * `showLabel` draws text over the bar, a percentage by default; `labelFormat`
 * changes what it says, and `font`, `fontSize` and `labelFillStyle` how it
 * looks.
 *
 * ## Drop shadow
 * `shadowColor` draws a soft shadow under the bar; its alpha sets how dark
 * it is. `shadowOffsetX` and `shadowOffsetY` move it and `shadowBlur`
 * softens its edge.
 *
 * ## Colour that follows the value
 * `fillColor` is read every frame, not copied, so pass a {@link Color} you
 * keep and change it as the value changes. To make the bar blink, use
 * {@link Renderable#setOpacity}.
 * @category UI
 * @example
 * // a loading bar, fed by the loader
 * import { ProgressBar, event } from "melonjs";
 *
 * const loading = new ProgressBar(0, 300, {
 *     width: 800,
 *     height: 4,
 *     trackColor: "black",
 *     fillColor: "#55aa00",
 *     bindEvent: event.LOADER_PROGRESS,
 * });
 * app.world.addChild(loading);
 * @example
 * // a health bar with a label, and a range that is not 0 to 1
 * const hp = new ProgressBar(20, 20, {
 *     width: 200,
 *     height: 24,
 *     min: 0,
 *     max: 100,
 *     value: 100,
 *     trackColor: "#3a1010",
 *     fillColor: "#c0392b",
 *     radius: 6,
 *     showLabel: true,
 *     labelFormat: (value) => `${Math.round(value)} HP`,
 * });
 * // when the player is hit
 * hp.value -= 15;
 * @example
 * // a colour that follows the value, from red when empty to blue when full
 * import { ProgressBar, Color } from "melonjs";
 *
 * const full = new Color().parseCSS("#7fe0ff");
 * const empty = new Color().parseCSS("#ff2a1e");
 * const mixed = full.clone();
 * const shield = new ProgressBar(20, 52, {
 *     width: 190,
 *     height: 13,
 *     value: 1,
 *     trackColor: null, // a hollow frame
 *     borderColor: "rgba(122, 190, 235, 0.8)",
 *     padding: 2,
 *     radius: 4,
 *     fillColor: mixed, // kept, not copied
 *     onChange: (value, ratio) => {
 *         mixed.copy(empty).lerp(full, ratio);
 *     },
 * });
 * @example
 * // a vertical bar that fills from the bottom
 * const power = new ProgressBar(740, 200, {
 *     width: 16,
 *     height: 120,
 *     direction: "bottom-to-top",
 *     trackColor: "#222222",
 *     fillColor: "#f1c40f",
 *     borderColor: "#ffffff",
 *     borderWidth: 2,
 *     padding: 3,
 * });
 * @example
 * // a drop shadow under the bar
 * const xp = new ProgressBar(20, 80, {
 *     width: 240,
 *     height: 16,
 *     trackColor: "#1e1e2e",
 *     fillColor: "#9b59b6",
 *     radius: 8,
 *     shadowColor: "#00000080", // the alpha sets how dark
 *     shadowOffsetY: 3,
 *     shadowBlur: 6,
 * });
 * @example
 * // react when the bar is emptied
 * const timer = new ProgressBar(20, 110, {
 *     width: 200,
 *     height: 8,
 *     value: 1,
 *     fillColor: "#2ecc71",
 *     onChange: (value, ratio, bar) => {
 *         if (ratio === 0) {
 *             bar.setOpacity(0.5);
 *             onTimeUp();
 *         }
 *     },
 * });
 */
export default class ProgressBar extends Renderable {
	/** the value that shows as empty */
	min: number;
	/** the value that shows as full */
	max: number;
	/** which edge the fill grows from; see {@link ProgressBarDirection} */
	direction: ProgressBarDirection;
	/** the colour behind the fill; `null` leaves it hollow */
	trackColor: Paint | null;
	/** the colour of the fill; a {@link Color} here is read every frame */
	fillColor: Paint;
	/** the colour of the border; `null` for none */
	borderColor: Paint | null;
	/** the border's thickness, in pixels */
	borderWidth: number;
	/** the gap between the track's edge and the fill on each side, in pixels */
	padding: number;
	/** the corner radius, in pixels; `0` is square */
	radius: number;
	/** the colour of the drop shadow, its alpha setting how dark; `null` for none */
	shadowColor: Paint | null;
	/** how far right the shadow falls, in pixels */
	shadowOffsetX: number;
	/** how far down the shadow falls, in pixels */
	shadowOffsetY: number;
	/** how far the shadow's soft edge spreads, in pixels */
	shadowBlur: number;
	/**
	 * Called each time the value changes, with the new value, its `0..1`
	 * fraction from `min` to `max`, and the bar.
	 * @example
	 * bar.onChange = (value, ratio, bar) => {
	 *     bar.setOpacity(ratio < 0.25 ? 0.6 : 1);
	 * };
	 */
	onChange?:
		| ((value: number, ratio: number, bar: ProgressBar) => void)
		| undefined;
	/** builds the label's text from the value and its `0..1` fraction */
	labelFormat: (value: number, ratio: number) => string;
	/** the label's text object, when `showLabel` was set */
	label?: Text | undefined;
	/** the event the value is taken from, if any */
	readonly bindEvent?: EventName | undefined;

	private _value: number;
	/**
	 * The shape and colour plumbing, shared with {@link UIPanel}.
	 *
	 * A field and not a base class: this widget extends `Renderable` to stay
	 * cheap, while a panel is a `Container`, so there is no class the two
	 * could share.
	 * @ignore
	 * @internal
	 */
	private _painter = new PanelPainter();

	/**
	 * @param x - position of the bar's left edge
	 * @param y - position of its top edge
	 * @param settings - see {@link ProgressBarSettings}
	 */
	constructor(x: number, y: number, settings: ProgressBarSettings) {
		super(x, y, settings.width, settings.height);

		this.min = settings.min ?? 0;
		this.max = settings.max ?? 1;
		this.direction = settings.direction ?? "left-to-right";
		this.trackColor = settings.trackColor ?? null;
		this.fillColor = settings.fillColor ?? "#ffffff";
		this.borderColor = settings.borderColor ?? null;
		this.borderWidth = settings.borderWidth ?? 1;
		this.padding = settings.padding ?? 0;
		this.radius = settings.radius ?? 0;
		this.shadowColor = settings.shadowColor ?? null;
		this.shadowOffsetX = settings.shadowOffsetX ?? 0;
		this.shadowOffsetY = settings.shadowOffsetY ?? 4;
		this.shadowBlur = settings.shadowBlur ?? 8;
		this.onChange = settings.onChange;
		this.labelFormat =
			settings.labelFormat ?? ((_v, ratio) => `${Math.round(ratio * 100)}%`);

		this._value = clamp(settings.value ?? this.min, this.min, this.max);

		// the bar draws itself from `pos`, and `preDraw` applies the anchor
		// without translating to `pos`, so a centred anchor would offset
		// everything by half the bar
		this.anchorPoint.set(0, 0);

		// Drawn with primitives rather than as a textured quad, so a single
		// post effect has to capture rather than take the shader-swap path:
		// the primitive batcher never reads that shader and the effect would
		// silently do nothing.
		this.postEffectNeedsCapture = true;

		// Bound for exactly as long as this bar exists. Tying the two together
		// is what stops the listener outliving the thing it writes into: a
		// subscription held somewhere else goes on firing after the bar is
		// destroyed, and lands on a renderable whose `pos` has already been
		// released.
		this.bindEvent = settings.bindEvent;
		if (this.bindEvent !== undefined) {
			on(this.bindEvent, this._onBound, this);
		}

		if (settings.showLabel === true) {
			this.label = new Text(0, 0, {
				font: settings.font ?? "sans-serif",
				// Rounded, because the default is derived: a 24 tall bar gives
				// 16.799999999999997, which reads back out of `label.font` as
				// that, and a fractional size renders softer than a whole one.
				// Only the DEFAULT is rounded; an explicit `fontSize` is used
				// exactly as given, fraction and all.
				size:
					settings.fontSize ?? Math.round(Math.max(8, settings.height * 0.7)),
				fillStyle: settings.labelFillStyle ?? "#ffffff",
				textAlign: "center",
				textBaseline: "middle",
				text: this.labelFormat(this._value, this.ratio),
			});
		}
	}

	/**
	 * The current value, between {@link ProgressBar#min} and
	 * {@link ProgressBar#max}. Setting it redraws the bar and updates the
	 * label. A value outside the range is clamped, and setting the value it
	 * already has does nothing, so `onChange` only fires on a real change.
	 * @example
	 * // a cooldown that refills over 3 seconds
	 * cooldown.value = Math.min(1, elapsed / 3000);
	 */
	get value() {
		return this._value;
	}

	set value(v: number) {
		const next = clamp(v, this.min, this.max);
		if (next === this._value) {
			return;
		}
		this._value = next;
		this.isDirty = true;
		if (this.label !== undefined) {
			this.label.setText(this.labelFormat(next, this.ratio));
		}
		this.onChange?.(next, this.ratio, this);
	}

	/**
	 * The value as a fraction, `0` at `min` and `1` at `max`; how full the
	 * bar is drawn. Read only: set {@link ProgressBar#value} instead.
	 */
	get ratio() {
		const span = this.max - this.min;
		return span === 0 ? 0 : (this._value - this.min) / span;
	}

	/**
	 * Take the value from the bound event.
	 * @param value - whatever that event reports
	 * @ignore
	 * @internal
	 */
	private _onBound = (value: number) => {
		this.value = value;
	};

	/**
	 * Set the value, for chaining.
	 * @param v - the new value, clamped to the bar's bounds
	 * @returns this bar
	 */
	setValue(v: number) {
		this.value = v;
		return this;
	}

	/**
	 * Draw the track, the fill, the border and the label, in that order.
	 * @param renderer - the renderer to draw with
	 */
	override draw(renderer: Renderer) {
		const x = this.pos.x;
		const y = this.pos.y;
		const w = this.width;
		const h = this.height;

		// The cascaded alpha this renderable arrived with. `globalAlpha()` and
		// not `getGlobalAlpha()`: the latter is only on the concrete
		// renderers, while this is on the base class. Read BEFORE the first
		// `setColor`, while it still holds what `preDraw` put there.
		const alpha = renderer.globalAlpha();

		if (this.shadowColor !== null) {
			this._painter.shadow(
				renderer,
				this.shadowColor,
				alpha,
				x,
				y,
				w,
				h,
				this.radius,
				this.shadowOffsetX,
				this.shadowOffsetY,
				this.shadowBlur,
			);
		}
		if (this.trackColor !== null) {
			this._painter.paint(renderer, this.trackColor, alpha);
			this._painter.rect(renderer, x, y, w, h, this.radius);
		}

		// the fill grows from one edge, inside the padding
		const p = this.padding;
		const iw = w - p * 2;
		const ih = h - p * 2;
		const ratio = this.ratio;
		if (ratio > 0 && iw > 0 && ih > 0) {
			const fw = this.horizontal ? iw * ratio : iw;
			const fh = this.horizontal ? ih : ih * ratio;
			// right-to-left and bottom-to-top keep the far edge pinned, so the
			// fill retreats toward the edge it grew from
			const fx = this.direction === "right-to-left" ? x + p + iw - fw : x + p;
			const fy = this.direction === "bottom-to-top" ? y + p + ih - fh : y + p;
			this._painter.paint(renderer, this.fillColor, alpha);
			// Concentric with the track, not the same radius as it. A shape
			// inset by `padding` has to lose `padding` from its corner radius
			// too, or it comes out proportionally rounder than the thing it
			// sits inside: at a radius of 4 with 2 of padding, a 13 tall bar
			// got a 9 tall fill that was very nearly a capsule inside a frame
			// that plainly was not.
			this._painter.rect(
				renderer,
				fx,
				fy,
				fw,
				fh,
				Math.max(0, this.radius - p),
			);
		}

		if (this.borderColor !== null && this.borderWidth > 0) {
			this._painter.paint(renderer, this.borderColor, alpha);
			// Drawn INSIDE the bar: four fills when square, an inset stroke
			// when rounded. See {@link PanelPainter.border} for why neither
			// one is a plain `strokeRect`.
			this._painter.border(renderer, x, y, w, h, this.radius, this.borderWidth);
		}

		if (this.label !== undefined) {
			// `setPosition` rather than `pos.set(x, y)`, which would write a
			// zero depth: `pos` is a 3D vector typed as a 2D one. Guarded,
			// because every write to that observable recomputes the label's
			// bounds and a bar that has not moved asks for the same point
			// every frame.
			const cx = x + w / 2;
			const cy = y + h / 2;
			if (this.label.pos.x !== cx || this.label.pos.y !== cy) {
				this.label.setPosition(cx, cy);
			}
			renderer.setGlobalAlpha(alpha);
			this.label.preDraw(renderer);
			this.label.draw(renderer);
			this.label.postDraw(renderer);
		}
	}

	/**
	 * Whether the fill grows along x.
	 * @ignore
	 * @internal
	 */
	private get horizontal() {
		return (
			this.direction === "left-to-right" || this.direction === "right-to-left"
		);
	}

	/**
	 * Release the label, if there is one.
	 * @ignore
	 * @internal
	 */
	override onDestroyEvent() {
		if (this.bindEvent !== undefined) {
			off(this.bindEvent, this._onBound, this);
		}
		this.label?.destroy();
		this.label = undefined;
		this._painter.dispose();
	}
}
