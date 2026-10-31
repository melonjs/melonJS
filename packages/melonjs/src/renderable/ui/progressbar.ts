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
 * which way the fill grows
 * @category UI
 */
export type ProgressBarDirection =
	| "left-to-right"
	| "right-to-left"
	| "top-to-bottom"
	| "bottom-to-top";

/**
 * Everything {@link ProgressBar} takes.
 * @category UI
 */
export interface ProgressBarSettings {
	/** the bar's full width, in pixels */
	width: number;
	/** the bar's full height, in pixels */
	height: number;
	/** the value that reads as empty */
	min?: number;
	/** the value that reads as full */
	max?: number;
	/** where to start */
	value?: number;
	/** which edge the fill grows from */
	direction?: ProgressBarDirection;
	/** behind the fill; `null` leaves it hollow, showing whatever is behind */
	trackColor?: Paint | null;
	/**
	 * the fill itself. A {@link Color} is re-read every frame, so mutating the
	 * one you passed animates the bar
	 */
	fillColor?: Paint;
	/** drawn around the track; `null` for none */
	borderColor?: Paint | null;
	/** how thick that border is */
	borderWidth?: number;
	/** how far the fill sits inside the track, per side */
	padding?: number;
	/** corner radius; `0` is square */
	radius?: number;
	/** called whenever the value actually moves */
	onChange?: (value: number, ratio: number, bar: ProgressBar) => void;
	/** draw a label over the bar */
	showLabel?: boolean;
	/** the label's font family */
	font?: string;
	/** the label's font size, in pixels */
	fontSize?: number;
	/** the label's colour */
	labelFillStyle?: Paint;
	/** what the label says; the default is a rounded percentage */
	labelFormat?: (value: number, ratio: number) => string;
	/**
	 * an event to take the value from, instead of setting it by hand.
	 *
	 * The bar subscribes for as long as it exists and unsubscribes when it is
	 * destroyed, which is the point: a subscription that outlives what it
	 * drives is a listener writing into a freed object.
	 */
	bindEvent?: EventName;
}

/**
 * A bar that shows one value between two bounds.
 *
 * A health bar, a shield gauge, a cooldown, a loading bar: all the same
 * object, and the engine's own loading screen is built on this one. Set
 * {@link ProgressBar#value} and it redraws.
 *
 * It draws the track, the fill, the border and the label itself, in that
 * order, which is the point of it being ONE renderable rather than a track
 * sprite with a fill sprite on top. Two renderables at the same place have to
 * be told which is in front, and that question has to be answered again every
 * time either one moves.
 *
 * ## The colour can follow the value
 *
 * `fillColor` is read at draw time rather than copied, so passing a
 * {@link Color} you keep hold of and mutating it is all a value-driven colour
 * takes. That is deliberately not built in, because every game wants a
 * different rule and most want the colour somewhere else too, next to a shader
 * uniform or a glow:
 *
 * ```js
 * const full = new Color().parseCSS("#7fe0ff");
 * const empty = new Color().parseCSS("#ff2a1e");
 * const mixed = new Color();
 *
 * const shield = new ProgressBar(x, y, {
 *     width: 190, height: 13,
 *     trackColor: null,                          // a hollow frame
 *     borderColor: "rgba(122, 190, 235, 0.8)",
 *     padding: 2,
 *     fillColor: mixed,                          // kept, not copied
 * });
 *
 * // each frame
 * mixed.copy(empty).lerp(full, hp);
 * shield.value = hp;
 * ```
 *
 * Blinking is the same story: {@link Renderable#setOpacity} already does it,
 * on whatever clock the game is already keeping.
 * @category UI
 * @example
 * // a loading bar
 * const bar = new ProgressBar(0, 100, {
 *     width: renderer.width, height: 4,
 *     trackColor: "black", fillColor: "#55aa00",
 * });
 * event.on(event.LOADER_PROGRESS, (progress) => { bar.value = progress; });
 * @example
 * // a label, and a value that is not a fraction
 * const hp = new ProgressBar(20, 20, {
 *     width: 200, height: 24,
 *     min: 0, max: 100, value: 100,
 *     fillColor: "#c0392b", radius: 6,
 *     showLabel: true,
 *     labelFormat: (v) => `${Math.round(v)} HP`,
 * });
 */
export default class ProgressBar extends Renderable {
	/** the value that reads as empty */
	min: number;
	/** the value that reads as full */
	max: number;
	/** which edge the fill grows from */
	direction: ProgressBarDirection;
	/** behind the fill; `null` leaves it hollow */
	trackColor: Paint | null;
	/** the fill. A {@link Color} here is re-read every frame */
	fillColor: Paint;
	/** drawn around the track; `null` for none */
	borderColor: Paint | null;
	/** how thick that border is */
	borderWidth: number;
	/** how far the fill sits inside the track, per side */
	padding: number;
	/** corner radius; `0` is square */
	radius: number;
	/** called whenever the value actually moves */
	onChange?:
		| ((value: number, ratio: number, bar: ProgressBar) => void)
		| undefined;
	/** what the label says */
	labelFormat: (value: number, ratio: number) => string;
	/** the label, when `showLabel` was asked for */
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
	 * Where the bar is now, between {@link ProgressBar#min} and
	 * {@link ProgressBar#max}.
	 *
	 * Writing a value outside that range clamps rather than throwing, since
	 * the usual source is a health or a timer that has just gone past its own
	 * limit. Writing the value it already has does nothing at all, so
	 * `onChange` means the value MOVED.
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
	 * The value as a fraction, `0` at `min` and `1` at `max`.
	 *
	 * This is what the fill is drawn from, and what a caller usually wants for
	 * anything else keyed to the same number. Read only; set
	 * {@link ProgressBar#value}.
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
