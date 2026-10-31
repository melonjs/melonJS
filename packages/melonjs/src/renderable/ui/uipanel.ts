import type Camera2d from "../../camera/camera2d.ts";
import {
	registerPointerEvent,
	releasePointerEvent,
} from "../../input/input.ts";
import type Pointer from "../../input/pointer.ts";
import { clamp } from "../../math/math.ts";
import type { Matrix3d } from "../../math/matrix3d.ts";
import type { Vector3d } from "../../math/vector3d.ts";
import { off, on, POINTERMOVE } from "../../system/event.ts";
import type Renderer from "../../video/renderer.js";
import Container from "../container.js";
import type Renderable from "../renderable.js";
import type { Paint } from "./panelpaint.ts";
import { PanelPainter } from "./panelpaint.ts";
import UIBaseElement, { END_EVENTS, endsPointer } from "./uibaseelement.ts";
import type { UILabel } from "./uilabel.ts";
import { createLabel } from "./uilabel.ts";
import type { UISkin } from "./uiskin.ts";
import { SkinDrawer } from "./uiskin.ts";
import UITextButton from "./uitextbutton.ts";

/**
 * The art of a skinned {@link UIPanel}: one atlas region, drawn as a
 * nine-slice over the whole panel and resized with it.
 * @category UI
 */
export interface UIPanelSkin extends UISkin {
	/** the background */
	region: string;
}

/**
 * How a {@link UIPanel} places its children.
 *
 * - `"none"`: where they are put
 * - `"column"`: one above the other
 * - `"row"`: side by side
 * - `"grid"`: in rows of {@link UIPanelSettings.columns} equal cells
 * @category UI
 */
export type UIPanelLayout = "none" | "column" | "row" | "grid";

/**
 * Where a {@link UIPanel} lines its children up across the layout: the
 * left, middle or right of a column, the top, middle or bottom of a row.
 * `"stretch"` resizes each child to the full width of a column, the full
 * height of a row, or the width of a grid cell.
 * @category UI
 */
export type UIPanelAlign = "start" | "center" | "end" | "stretch";

/**
 * Which ways a {@link UIPanel} scrolls.
 * @category UI
 */
export type UIPanelScroll = "none" | "vertical" | "horizontal" | "both";

/**
 * Everything {@link UIPanel} takes.
 * @category UI
 */
export interface UIPanelSettings {
	/** the panel's width, in pixels */
	width: number;
	/** the panel's height, in pixels */
	height: number;
	/**
	 * The fill behind the children; `null` leaves it transparent.
	 *
	 * NOT `backgroundColor`, which a `Container` already has and which does
	 * something else entirely: that one is handed to `clearColor` and wipes
	 * the whole render target, so a panel setting it would repaint the
	 * screen. The name here matches {@link ProgressBarSettings} instead.
	 */
	fillColor?: Paint | null;
	/** drawn around the edge; `null` for none */
	borderColor?: Paint | null;
	/** how thick that border is */
	borderWidth?: number;
	/** corner radius; `0` is square */
	radius?: number;
	/**
	 * How far the panel drifts up and down, in pixels. `0`, the default,
	 * leaves it still.
	 *
	 * See {@link UIPanel#bobAmplitude}.
	 */
	bobAmplitude?: number;
	/**
	 * How long one full up and down cycle takes, in milliseconds.
	 *
	 * See {@link UIPanel#bobPeriod}.
	 */
	bobPeriod?: number;
	/**
	 * Whether the panel swallows pointer events aimed at what is behind it.
	 *
	 * `true` by default, which is what a dialog wants: a click on the panel,
	 * or on the dimmed scene it covers, must not reach the game underneath.
	 * Children are unaffected either way, because the dispatcher asks a child
	 * before the container holding it.
	 *
	 * Set `false` for a panel that is only a backdrop, such as a HUD frame
	 * drawn over a playfield that still has to receive clicks.
	 */
	blocking?: boolean;
	/** draw the background from an atlas region, as a nine-slice */
	skin?: UIPanelSkin;
	/** a title, centred at the top; the content starts below it */
	title?: string;
	/**
	 * the title's font: a CSS font family, or the name of a loaded bitmap font
	 * @default "sans-serif"
	 */
	titleFont?: string;
	/**
	 * the title's height, in pixels
	 * @default 20
	 */
	titleFontSize?: number;
	/**
	 * the title's colour
	 * @default "#ffffff"
	 */
	titleFillStyle?: string;
	/**
	 * Let the user move the panel by dragging it. A scrolling panel is moved
	 * by its title and its frame, as a drag on the content scrolls it.
	 * @default false
	 */
	draggable?: boolean;
	/**
	 * how the children are placed; see {@link UIPanelLayout}
	 * @default "none"
	 */
	layout?: UIPanelLayout;
	/**
	 * the number of cells in a row of a `"grid"` layout
	 * @default 2
	 */
	columns?: number;
	/**
	 * The space between the content and the panel's frame, in pixels: inside
	 * the border, or inside the skin's insets, and below the title.
	 * @default 0
	 */
	padding?: number;
	/**
	 * the space between children in a layout, in pixels
	 * @default 8
	 */
	gap?: number;
	/**
	 * where children line up across the layout; see {@link UIPanelAlign}
	 * @default "start"
	 */
	align?: UIPanelAlign;
	/**
	 * Resize the panel to its laid out content: the height of a column or a
	 * grid, the width of a row, and across a column or a row too unless the
	 * children are stretched. Ignored by a scrolling panel.
	 * @default false
	 */
	autoSize?: boolean;
	/**
	 * Which ways the content scrolls when it does not fit: with the wheel
	 * over the panel, and by dragging it, with momentum.
	 * @default "none"
	 */
	scroll?: UIPanelScroll;
	/** called when the content scrolls, with the new offsets */
	onScroll?: (scrollX: number, scrollY: number, panel: UIPanel) => void;
	/**
	 * the scrollbar, shown while the content does not fit
	 * @default "#00000059"
	 */
	scrollbarColor?: Paint;
}

/** a child's placement box, in the panel's coordinates */
interface ChildBox {
	child: Renderable;
	/** the box's left and top edges, less the child's position */
	ox: number;
	oy: number;
	w: number;
	h: number;
}

/**
 * The pointer-downs a scrolling panel has taken, so a panel around it does
 * not take the same one and scroll with it.
 */
const takenPresses = new WeakSet<Event>();

/** how far a press has to move before it scrolls instead, in pixels */
const SCROLL_THRESHOLD = 8;
/** how much speed a fling keeps per 60th of a second */
const FRICTION = 0.95;
/** below this speed, in pixels per millisecond, a fling stops */
const MIN_SPEED = 0.02;

/**
 * A rectangular surface with a background, an optional border and children.
 *
 * The thing every menu, dialog and HUD frame starts by writing: a rounded
 * rectangle, a fill, an outline, and some labels on top. One example in this
 * repository had three of them, each repeating the same half dozen renderer
 * calls, and each repeating the same correction for the way `setColor` folds
 * the global alpha in. That correction is the reason this is a widget rather
 * than a snippet: it is easy to leave out, and leaving it out does not fail,
 * it just renders a panel at the wrong opacity.
 *
 * It is a {@link UIBaseElement}, so it is a container that carries pointer
 * events, and children added to it are drawn over its background and are
 * asked about a click before it is.
 *
 * It is floating, as every UI element is, and where it lands in the paint
 * order is the depth it is added at. In a world sorted on `"depth"`, which
 * is every `Camera3d` scene, that depth is read the other way round from
 * the 2D habit: a floating child is ranked by `|pos.z|` there and the
 * SMALLER magnitude draws on top, so a panel added at 9000 to sit above
 * everything sits behind everything instead, and a dialog there wants a
 * small depth, 0 or 1.
 * @example
 * import { UIPanel, Text } from "melonjs";
 *
 * const panel = new UIPanel(cx - 200, cy - 120, {
 *     width: 400,
 *     height: 240,
 *     fillColor: "#0a1526",
 *     borderColor: "rgba(130, 200, 240, 0.55)",
 *     borderWidth: 2,
 *     radius: 14,
 * });
 * // positioned relative to the panel, not to the screen
 * panel.addChild(new Text(200, 24, { text: "PAUSED", textAlign: "center" }));
 * app.world.addChild(panel);
 * @category UI
 */
export default class UIPanel extends UIBaseElement {
	/** the fill behind the children; `null` leaves it transparent */
	fillColor: Paint | null;
	/** drawn around the edge; `null` for none */
	borderColor: Paint | null;
	/** how thick that border is */
	borderWidth: number;
	/** corner radius; `0` is square */
	radius: number;
	/** whether it swallows pointer events aimed at what is behind it */
	blocking: boolean;
	/**
	 * How far the panel drifts up and down, in pixels. `0`, the default,
	 * leaves it still.
	 *
	 * The slow float an idle dialogue or pause panel has in a lot of games,
	 * which is there so a screen waiting for input does not look frozen. It
	 * is a sine, so this is the distance to either extreme and the panel
	 * covers twice it over a cycle; 2 to 4 is the usual range, and it starts
	 * by rising rather than sinking.
	 *
	 * Do not go much below 2. The offset is a whole number of pixels, so an
	 * amplitude of 1 has three positions to move between and the panel
	 * twitches rather than drifts.
	 *
	 * The panel is CLICKABLE where it is drawn: the offset goes into
	 * {@link UIPanel#getAbsolutePosition}, which is what the bounds pipeline
	 * reads, so the hit area of the panel and of every widget inside it
	 * follows the float at any depth. `pos` is deliberately left alone, so a
	 * caller still reads and writes the resting place rather than a value
	 * that moves under them.
	 *
	 * The bounds are rebuilt only on the frames the offset actually changes,
	 * so a panel with no bob costs nothing.
	 * @default 0
	 */
	bobAmplitude: number;
	/**
	 * How long one full up and down cycle takes, in milliseconds.
	 *
	 * Anything at or below zero turns the bob off rather than dividing by it.
	 * That is not politeness: the offset would be `NaN`, and one `translate`
	 * by `NaN` writes it into the transform, where every batched vertex under
	 * it inherits the poison and the GPU clips the lot away. A panel that
	 * silently vanished would be a long way from an obviously bad period.
	 * @default 2000
	 */
	bobPeriod: number;

	/** the background art, when the panel is skinned */
	readonly skin: UIPanelSkin | undefined;
	/** the title, drawn at the top, when there is one */
	readonly title: UILabel | undefined;
	/** how the children are placed; see {@link UIPanelLayout} */
	layout: UIPanelLayout;
	/** the number of cells in a row of a `"grid"` layout */
	columns: number;
	/** the space between the content and the frame, in pixels */
	padding: number;
	/** the space between children in a layout, in pixels */
	gap: number;
	/** where children line up across the layout */
	align: UIPanelAlign;
	/** resize the panel to its laid out content */
	autoSize: boolean;
	/** which ways the content scrolls */
	scroll: UIPanelScroll;
	/** called when the content scrolls, with the new offsets */
	onScroll:
		| ((scrollX: number, scrollY: number, panel: UIPanel) => void)
		| undefined;
	/** the scrollbar, shown while the content does not fit */
	scrollbarColor: Paint;

	/** @ignore */
	private readonly _skin: SkinDrawer | undefined;
	/** the title band's height, in pixels */
	private readonly _titleHeight: number;
	/** how far the content is scrolled */
	private _scrollX = 0;
	private _scrollY = 0;
	/** how far it can be */
	private _maxScrollX = 0;
	private _maxScrollY = 0;
	/** set while a layout pass runs, so the resize it makes does not start another */
	private _layingOut = false;
	/** a press on the content that may become a scroll */
	private _press:
		| {
				dom: Event | undefined;
				pointerId: number | undefined;
				x: number;
				y: number;
				scrollX: number;
				scrollY: number;
				element: UIBaseElement | undefined;
				scrolling: boolean;
				lastX: number;
				lastY: number;
				lastTime: number;
		  }
		| undefined;
	/** the fling speed, in pixels per millisecond */
	private _velocityX = 0;
	private _velocityY = 0;
	/** whether the current press moves the panel */
	private _moving = false;

	/**
	 * The shape and colour plumbing, shared with {@link ProgressBar}.
	 *
	 * A field and not a base class: that widget extends `Renderable` while
	 * this one is a `Container` through {@link UIBaseElement}, so there is no
	 * class the two could share.
	 * @ignore
	 * @internal
	 */
	private _painter = new PanelPainter();
	/**
	 * How far through the bob cycle the panel is, in milliseconds.
	 *
	 * Fed from `update(dt)` and not from a wall clock, so the bob obeys the
	 * same pause every other animation does. A panel that should keep moving
	 * while the game is paused, which is exactly what a pause menu is, sets
	 * `updateWhenPaused` and gets it for the whole subtree.
	 * @ignore
	 * @internal
	 */
	private _bobTime = 0;
	/**
	 * The offset the bounds were last rebuilt with.
	 *
	 * The bounds walk is gated on this CHANGING rather than on the bob being
	 * on, which buys two things: a still panel pays nothing at all, and a
	 * panel whose bob is switched off mid-cycle gets one last walk instead of
	 * leaving its hit area parked wherever the sine happened to stop.
	 * @ignore
	 * @internal
	 */
	private _bobApplied = 0;

	/**
	 * @param x - position of the panel's left edge
	 * @param y - position of the panel's top edge
	 * @param settings - see {@link UIPanelSettings}
	 */
	constructor(x: number, y: number, settings: UIPanelSettings) {
		super(x, y, settings.width, settings.height);
		this.fillColor = settings.fillColor ?? null;
		this.borderColor = settings.borderColor ?? null;
		this.borderWidth = settings.borderWidth ?? 1;
		this.radius = settings.radius ?? 0;
		this.blocking = settings.blocking ?? true;
		this.bobAmplitude = settings.bobAmplitude ?? 0;
		this.bobPeriod = settings.bobPeriod ?? 2000;
		this.layout = settings.layout ?? "none";
		this.columns = Math.max(1, Math.floor(settings.columns ?? 2));
		this.padding = settings.padding ?? 0;
		this.gap = settings.gap ?? 8;
		this.align = settings.align ?? "start";
		this.autoSize = settings.autoSize ?? false;
		this.scroll = settings.scroll ?? "none";
		this.onScroll = settings.onScroll;
		this.scrollbarColor = settings.scrollbarColor ?? "#00000059";
		this.isDraggable = settings.draggable ?? false;

		this.skin = settings.skin;
		if (this.skin !== undefined) {
			this._skin = new SkinDrawer(this.skin);
			// checked now, so a typo fails where it was written
			this._skin.size(this.skin.region);
		}
		if (settings.title !== undefined) {
			const size = settings.titleFontSize ?? 20;
			this.title = createLabel({
				text: settings.title,
				font: settings.titleFont ?? "sans-serif",
				fontSize: size,
				fillStyle: settings.titleFillStyle ?? "#ffffff",
				textAlign: "center",
				textBaseline: "middle",
			});
			this._titleHeight = Math.ceil(size * 1.6);
		} else {
			this._titleHeight = 0;
		}
		// A panel draws with PRIMITIVES, which go through a batcher that
		// never reads `customShader`, so a post effect on one would silently
		// do nothing on the fast path. This asks for the capture instead.
		this.postEffectNeedsCapture = true;
		// A panel's size is given, so its bounds are known and must not be
		// grown by what is inside it. `getBounds()` is what the pointer
		// dispatcher hit-tests, so with this left on, a label overhanging the
		// edge makes a blocking panel swallow clicks OUTSIDE the rectangle it
		// drew. `UITextButton` wants the opposite, because its label defines
		// it.
		//
		// Turning it off also took away the refresh of the CHILDREN's own
		// bounds, which they are not the same job despite sharing this flag;
		// `updateBounds` below puts that half back.
		this.enableChildBoundsUpdate = false;
		// No `anchorPoint` to set: `Container` already pins it to (0, 0) and
		// positions children from the top left, which is what a panel wants.
		// {@link ProgressBar} has to set it, but only because it extends
		// `Renderable`, where the default is centred and `preDraw` applies the
		// anchor without ever translating to `pos`.
	}

	/**
	 * Where the bob has the panel this frame, in pixels down from its
	 * position.
	 *
	 * Negative first: the panel RISES out of its resting place and comes
	 * back, which is what reads as floating. Starting with a sink reads as
	 * the panel dropping.
	 * @returns the vertical offset, `0` when the bob is off
	 * @ignore
	 * @internal
	 */
	private _bobOffset(): number {
		if (this.bobAmplitude === 0 || this.bobPeriod <= 0) {
			return 0;
		}
		// ROUNDED, and it is not a detail. Truncated, as the renderers used
		// to snap, a small bob lost its travel (`trunc(3 * sin)` only reaches
		// 3 at the single instant `sin` is exactly 1, so an amplitude of 3
		// moved 4px and not 6) and piled its dwell at the extremes, which
		// reads as a jerk rather than a float. Rounded, it steps evenly over
		// its full amplitude, and the renderer's own snap leaves it as it is.
		//
		// It also makes the drawn position and the hit area agree EXACTLY
		// rather than to within a pixel, since `getAbsolutePosition()` reads
		// this same value and is not snapped by anything.
		return Math.round(
			-Math.sin((this._bobTime / this.bobPeriod) * Math.PI * 2) *
				this.bobAmplitude,
		);
	}

	/**
	 * Advance the bob.
	 * @param dt - time since the last frame, in milliseconds
	 * @returns whether the panel needs redrawing
	 */
	override update(dt: number): boolean {
		const moving = this.bobAmplitude !== 0 && this.bobPeriod > 0;
		if (moving) {
			// Wrapped rather than left to grow. A sine does not care, but a
			// clock that only ever climbs loses precision on a long session
			// and there is nothing to gain by keeping the whole of it.
			this._bobTime = (this._bobTime + dt) % this.bobPeriod;
		}
		const flinging = this.fling(dt);
		// `super.update` is what steps the children, so it is called either
		// way; the bob only ever adds a reason to redraw.
		const dirty = super.update(dt);
		const offset = this._bobOffset();
		if (offset !== this._bobApplied) {
			this._bobApplied = offset;
			this.updateBounds();
		}
		return dirty || moving || flinging;
	}

	/**
	 * Carry a fling on, slowing it down.
	 * @param dt - time since the last frame, in milliseconds
	 * @returns whether the content is still moving
	 * @ignore
	 * @internal
	 */
	private fling(dt: number): boolean {
		// the finger is still on it: the drag moves the content, not this
		if (this._press !== undefined) {
			return false;
		}
		if (this._velocityX === 0 && this._velocityY === 0) {
			return false;
		}
		const beforeX = this._scrollX;
		const beforeY = this._scrollY;
		this.scrollTo(
			this._scrollX - this._velocityX * dt,
			this._scrollY - this._velocityY * dt,
		);
		const keep = FRICTION ** (dt / (1000 / 60));
		// stopped by an edge, or slowed to nothing
		this._velocityX =
			this._scrollX === beforeX || Math.abs(this._velocityX * keep) < MIN_SPEED
				? 0
				: this._velocityX * keep;
		this._velocityY =
			this._scrollY === beforeY || Math.abs(this._velocityY * keep) < MIN_SPEED
				? 0
				: this._velocityY * keep;
		return true;
	}

	/**
	 * Draw the fill, the border, and then the children over both.
	 * @param renderer - the renderer to draw with
	 * @param viewport - the camera being drawn through, passed to the children
	 */
	override draw(renderer: Renderer, viewport?: Camera2d) {
		// The cascaded alpha this renderable arrived with. `globalAlpha()` and
		// not `getGlobalAlpha()`: the latter is only on the concrete
		// renderers, while this is on the base class. Read BEFORE the first
		// `setColor`, while it still holds what `preDraw` put there.
		// The bob, applied to EVERYTHING: the background below, and the
		// children through `super.draw`, which translates again on top of
		// this one. `preDraw` has already saved the transform and `postDraw`
		// restores it, so this is not put back by hand.
		const bob = this._bobOffset();
		if (bob !== 0) {
			renderer.translate(0, bob);
		}

		const alpha = renderer.globalAlpha();
		if (this._skin !== undefined) {
			this._skin.draw(
				renderer,
				this.skin!.region,
				this.pos.x,
				this.pos.y,
				this.width,
				this.height,
			);
		}
		if (this.fillColor !== null) {
			this._painter.paint(renderer, this.fillColor, alpha);
			this._painter.rect(
				renderer,
				this.pos.x,
				this.pos.y,
				this.width,
				this.height,
				this.radius,
			);
		}
		if (this.borderColor !== null && this.borderWidth > 0) {
			this._painter.paint(renderer, this.borderColor, alpha);
			this._painter.border(
				renderer,
				this.pos.x,
				this.pos.y,
				this.width,
				this.height,
				this.radius,
				this.borderWidth,
			);
		}
		// put back what the children inherit, so a translucent background
		// does not fade the labels sitting on it
		renderer.setGlobalAlpha(alpha);

		const fy = this.frameInsets()[1];
		if (this.title !== undefined) {
			const tx = this.pos.x + this.width / 2;
			const ty = this.pos.y + fy + this._titleHeight / 2;
			if (this.title.pos.x !== tx || this.title.pos.y !== ty) {
				this.title.setPosition(tx, ty);
			}
			this.title.preDraw(renderer);
			this.title.draw(renderer);
			this.title.postDraw(renderer);
			renderer.setGlobalAlpha(alpha);
		}

		if (this.scroll === "none") {
			super.draw(renderer, viewport);
			return;
		}

		// the children, cropped to the content area. `save` and `restore`
		// put back the clip and the translation `super.draw` adds.
		const [vx, vy, vw, vh] = this.viewRect();
		renderer.save();
		renderer.clipRect(this.pos.x + vx, this.pos.y + vy, vw, vh);
		super.draw(renderer, viewport);
		renderer.restore();
		renderer.setGlobalAlpha(alpha);

		// the scrollbars, over the content, while it does not fit
		const bar = 4;
		const inset = 3;
		if (this._maxScrollY > 0 && vh > 0) {
			const length = Math.max(16, (vh * vh) / (vh + this._maxScrollY));
			const at = (vh - length) * (this._scrollY / this._maxScrollY);
			this._painter.paint(renderer, this.scrollbarColor, alpha);
			this._painter.rect(
				renderer,
				this.pos.x + vx + vw - bar - inset,
				this.pos.y + vy + at,
				bar,
				length,
				bar / 2,
			);
		}
		if (this._maxScrollX > 0 && vw > 0) {
			const length = Math.max(16, (vw * vw) / (vw + this._maxScrollX));
			const at = (vw - length) * (this._scrollX / this._maxScrollX);
			this._painter.paint(renderer, this.scrollbarColor, alpha);
			this._painter.rect(
				renderer,
				this.pos.x + vx + at,
				this.pos.y + vy + vh - bar - inset,
				length,
				bar,
				bar / 2,
			);
		}
		renderer.setGlobalAlpha(alpha);
	}

	/**
	 * Where the panel IS, bob included.
	 *
	 * THE hook that makes a floating panel honest. Both bounds paths funnel
	 * through this one method, and a child's absolute position is the sum of
	 * the chain above it, so adding the offset here reaches the panel's own
	 * hit area and every descendant's, at any depth, without any of them
	 * knowing a bob exists.
	 *
	 * Not `currentTransform`, which was the obvious guess: that reaches a
	 * renderable's OWN bounds and not its children's, so a bobbing panel's
	 * swallow rectangle would drift off the widgets sitting in it. And not a
	 * write to `pos`, which would reach everything correctly but silently
	 * overwrite a caller's own write on the very next frame.
	 *
	 * {@link Particle} overrides this method for the same reason, its
	 * placement not being in its `pos` chain either.
	 * @returns the absolute position, offset by the bob
	 */
	override getAbsolutePosition(): Vector3d {
		const absolute = super.getAbsolutePosition();
		absolute.y += this._bobOffset();
		return absolute;
	}

	/**
	 * The matrix form of the same offset.
	 *
	 * Without it `getWorldTransform()` and `getAbsolutePosition()` disagree
	 * about a bobbing panel, and the contract on those two says that for a
	 * `Container` they coincide.
	 * @param out - matrix to write into
	 * @returns `out`, for chaining
	 */
	protected override getLocalTransform(out: Matrix3d): Matrix3d {
		super.getLocalTransform(out);
		const offset = this._bobOffset();
		if (offset !== 0) {
			out.translate(0, offset);
		}
		return out;
	}

	/**
	 * Resize this panel's bounds, and refresh its children's.
	 *
	 * `Container` does those two jobs in ONE loop, both gated on
	 * `enableChildBoundsUpdate`, and a panel wants exactly one of them. The
	 * flag is off here so that a label overhanging the edge cannot grow the
	 * rectangle a blocking panel swallows clicks inside, and turning it off
	 * took the other job with it: a child's bounds are absolute, worked out
	 * once through `getAbsolutePosition()` and then cached, so moving the
	 * panel left every child's HIT AREA behind at the old place while the
	 * whole panel drew at the new one. A dialog slid or snapped into position
	 * after it was built had buttons that only answered where they used to
	 * be.
	 *
	 * This costs nothing per frame: `pos` calls `updateBounds` when it is
	 * written, so the walk happens when the panel actually moves.
	 * @param absolute - update in world absolute coordinates
	 * @returns this panel's bounds
	 */
	override updateBounds(absolute = true) {
		const bounds = super.updateBounds(absolute);
		this.forEach((child: Renderable) => {
			child.updateBounds(absolute);
		});
		return bounds;
	}

	/**
	 * How far in from the edges the frame is: the skin's insets, or the
	 * border.
	 * @returns the horizontal and the vertical inset
	 * @ignore
	 * @internal
	 */
	private frameInsets(): [number, number] {
		if (this.skin !== undefined) {
			const region = this._skin!.size(this.skin.region);
			return [
				// `||` as `NineSliceSprite` reads them, so a 0 means the
				// default for the art and the layout alike
				this.skin.insetx || region.width / 4,
				this.skin.insety || region.height / 4,
			];
		}
		const border = this.borderColor !== null ? this.borderWidth : 0;
		return [border, border];
	}

	/**
	 * The area the children show in: inside the frame and below the title.
	 * A scrolling panel crops them to it.
	 * @returns x, y, width and height, in the panel's coordinates
	 * @ignore
	 * @internal
	 */
	private viewRect(): [number, number, number, number] {
		const [fx, fy] = this.frameInsets();
		return [
			fx,
			fy + this._titleHeight,
			Math.max(0, this.width - fx * 2),
			Math.max(0, this.height - fy * 2 - this._titleHeight),
		];
	}

	/**
	 * The area a layout fills: the view, less the padding.
	 * @returns x, y, width and height, in the panel's coordinates
	 * @ignore
	 * @internal
	 */
	private contentRect(): [number, number, number, number] {
		const [vx, vy, vw, vh] = this.viewRect();
		const p = this.padding;
		return [vx + p, vy + p, Math.max(0, vw - p * 2), Math.max(0, vh - p * 2)];
	}

	/**
	 * The children in the order they were added, which is the order a layout
	 * places them in.
	 * @ignore
	 * @internal
	 */
	private orderedChildren(): Renderable[] {
		return [...this.getChildren()].sort((a, b) => {
			return a.depth - b.depth;
		});
	}

	/**
	 * Where a child's box is, relative to its position, and how big it is.
	 *
	 * Read from its bounds rather than worked out from `anchorPoint`, because
	 * a `Text` places itself by its alignment instead.
	 * @ignore
	 * @internal
	 */
	private measure(child: Renderable): ChildBox {
		const bounds = child.updateBounds(true);
		const origin = child.getAbsolutePosition();
		return {
			child,
			ox: bounds.left - origin.x,
			oy: bounds.top - origin.y,
			w: bounds.width,
			h: bounds.height,
		};
	}

	/**
	 * Stretch a child, if it can be resized.
	 * @ignore
	 * @internal
	 */
	private stretch(child: Renderable, w: number, h: number) {
		// only what lays itself out again at a new size: a `BitmapText`'s
		// `resize` takes a SCALE, and a checkbox or a slider would only widen
		// its hit area
		if (
			(child instanceof UITextButton || child instanceof UIPanel) &&
			(child.width !== w || child.height !== h)
		) {
			child.resize(w, h);
		}
	}

	/**
	 * Place the children again, and work out how far the content scrolls.
	 *
	 * Runs by itself when a child is added or removed and when the panel is
	 * resized, not every frame. Call it when a child changes size, or after
	 * moving children by hand in a scrolling panel.
	 * @returns this panel
	 */
	relayout(): this {
		if (this._layingOut) {
			return this;
		}
		this._layingOut = true;
		try {
			if (this.layout !== "none") {
				this.placeChildren();
			}
			this.measureScroll();
		} finally {
			this._layingOut = false;
		}
		return this;
	}

	/**
	 * The layout pass.
	 * @ignore
	 * @internal
	 */
	private placeChildren() {
		const children = this.orderedChildren();
		const gap = this.gap;
		const align = this.align;
		let [cx, cy, cw, ch] = this.contentRect();
		const cellWidth =
			(cw - gap * (this.columns - 1)) / Math.max(1, this.columns);

		if (align === "stretch") {
			for (const child of children) {
				if (this.layout === "column") {
					this.stretch(child, cw, child.height);
				} else if (this.layout === "row") {
					this.stretch(child, child.width, ch);
				} else {
					this.stretch(child, cellWidth, child.height);
				}
			}
		}
		const boxes = children.map((child) => {
			return this.measure(child);
		});

		// how big the laid out content is
		let contentW = 0;
		let contentH = 0;
		const rowHeights: number[] = [];
		if (this.layout === "column") {
			for (const box of boxes) {
				contentW = Math.max(contentW, box.w);
				contentH += box.h;
			}
			contentH += gap * Math.max(0, boxes.length - 1);
		} else if (this.layout === "row") {
			for (const box of boxes) {
				contentH = Math.max(contentH, box.h);
				contentW += box.w;
			}
			contentW += gap * Math.max(0, boxes.length - 1);
		} else {
			for (let i = 0; i < boxes.length; i++) {
				const row = Math.floor(i / this.columns);
				rowHeights[row] = Math.max(rowHeights[row] ?? 0, boxes[i].h);
			}
			for (const h of rowHeights) {
				contentH += h;
			}
			contentH += gap * Math.max(0, rowHeights.length - 1);
			contentW = cw;
		}

		if (this.autoSize && this.scroll === "none") {
			// from the insets, not from the view: that is clamped at 0, so a
			// panel started at height 0 would leave the title out
			const [fx, fy] = this.frameInsets();
			const frameW = fx * 2;
			const frameH = fy * 2 + this._titleHeight;
			const pad = this.padding * 2;
			let width = this.width;
			let height = this.height;
			if (this.layout === "column" || this.layout === "grid") {
				height = frameH + pad + contentH;
			}
			if (this.layout === "row") {
				width = frameW + pad + contentW;
			}
			if (align !== "stretch") {
				if (this.layout === "column") {
					width = frameW + pad + contentW;
				} else if (this.layout === "row") {
					height = frameH + pad + contentH;
				}
			}
			if (width !== this.width || height !== this.height) {
				this.resize(Math.ceil(width), Math.ceil(height));
				[cx, cy, cw, ch] = this.contentRect();
			}
		}

		/**
		 * where a box goes across a span, by the alignment
		 * @param start - the span's start
		 * @param span - the span's length
		 * @param size - the box's size along it
		 * @returns the box's start
		 */
		const across = (start: number, span: number, size: number) => {
			if (align === "center") {
				return start + (span - size) / 2;
			}
			if (align === "end") {
				return start + span - size;
			}
			return start;
		};
		const place = (box: ChildBox, x: number, y: number) => {
			const px = x - box.ox - this._scrollX;
			const py = y - box.oy - this._scrollY;
			if (box.child.pos.x !== px || box.child.pos.y !== py) {
				box.child.setPosition(px, py);
			}
		};

		if (this.layout === "column") {
			let y = cy;
			for (const box of boxes) {
				place(box, across(cx, cw, box.w), y);
				y += box.h + gap;
			}
		} else if (this.layout === "row") {
			let x = cx;
			for (const box of boxes) {
				place(box, x, across(cy, ch, box.h));
				x += box.w + gap;
			}
		} else {
			let y = cy;
			for (let row = 0; row < rowHeights.length; row++) {
				for (let col = 0; col < this.columns; col++) {
					const box = boxes[row * this.columns + col];
					if (box === undefined) {
						break;
					}
					const x = cx + col * (cellWidth + gap);
					place(
						box,
						across(x, cellWidth, box.w),
						across(y, rowHeights[row], box.h),
					);
				}
				y += rowHeights[row] + gap;
			}
		}
	}

	/**
	 * Work out how far the content can scroll, from where the children are.
	 * @ignore
	 * @internal
	 */
	private measureScroll() {
		if (this.scroll === "none") {
			this._maxScrollX = this._maxScrollY = 0;
			return;
		}
		const [vx, vy, vw, vh] = this.viewRect();
		let right = 0;
		let bottom = 0;
		for (const child of this.getChildren()) {
			const box = this.measure(child);
			// where it is with the content not scrolled
			right = Math.max(right, child.pos.x + box.ox + box.w + this._scrollX);
			bottom = Math.max(bottom, child.pos.y + box.oy + box.h + this._scrollY);
		}
		const horizontal = this.scroll === "horizontal" || this.scroll === "both";
		const vertical = this.scroll === "vertical" || this.scroll === "both";
		this._maxScrollX = horizontal
			? Math.max(0, right + this.padding - (vx + vw))
			: 0;
		this._maxScrollY = vertical
			? Math.max(0, bottom + this.padding - (vy + vh))
			: 0;
		// the content may have shrunk under the current offset
		this.scrollTo(this._scrollX, this._scrollY);
	}

	/**
	 * How far the content is scrolled to the right, in pixels.
	 * @default 0
	 */
	get scrollX(): number {
		return this._scrollX;
	}

	set scrollX(value: number) {
		this.scrollTo(value, this._scrollY);
	}

	/**
	 * How far the content is scrolled down, in pixels.
	 * @default 0
	 */
	get scrollY(): number {
		return this._scrollY;
	}

	set scrollY(value: number) {
		this.scrollTo(this._scrollX, value);
	}

	/**
	 * How far the content can scroll to the right, in pixels; 0 when it fits.
	 */
	get maxScrollX(): number {
		return this._maxScrollX;
	}

	/**
	 * How far the content can scroll down, in pixels; 0 when it fits.
	 */
	get maxScrollY(): number {
		return this._maxScrollY;
	}

	/**
	 * Scroll the content to an offset, clamped to how far it goes.
	 *
	 * Scrolling moves the children: their positions are where they are drawn.
	 * @param x - the horizontal offset, in pixels
	 * @param y - the vertical offset, in pixels
	 * @returns this panel
	 */
	scrollTo(x: number, y: number): this {
		const nx = clamp(Number.isFinite(x) ? x : 0, 0, this._maxScrollX);
		const ny = clamp(Number.isFinite(y) ? y : 0, 0, this._maxScrollY);
		const dx = nx - this._scrollX;
		const dy = ny - this._scrollY;
		if (dx === 0 && dy === 0) {
			return this;
		}
		this._scrollX = nx;
		this._scrollY = ny;
		for (const child of this.getChildren()) {
			child.setPosition(child.pos.x - dx, child.pos.y - dy);
		}
		this.isDirty = true;
		this.onScroll?.(nx, ny, this);
		return this;
	}

	/**
	 * Scroll just enough to bring a child fully into view.
	 * @param child - one of this panel's children
	 * @returns this panel
	 */
	scrollToChild(child: Renderable): this {
		if (child.ancestor !== this) {
			return this;
		}
		const [vx, vy, vw, vh] = this.viewRect();
		const box = this.measure(child);
		const left = child.pos.x + box.ox;
		const top = child.pos.y + box.oy;
		let x = this._scrollX;
		let y = this._scrollY;
		if (left < vx) {
			x -= vx - left;
		} else if (left + box.w > vx + vw) {
			x += Math.min(left - vx, left + box.w - (vx + vw));
		}
		if (top < vy) {
			y -= vy - top;
		} else if (top + box.h > vy + vh) {
			y += Math.min(top - vy, top + box.h - (vy + vh));
		}
		return this.scrollTo(x, y);
	}

	/**
	 * Whether the panel shows its children at a point: anywhere for a panel
	 * that does not scroll, only in its content area for one that does.
	 * @param x - the point, in screen pixels for a floating panel
	 * @param y - the point
	 * @returns false where the children are cropped away
	 */
	override clipContains(x: number, y: number): boolean {
		if (this.scroll === "none") {
			return super.clipContains(x, y);
		}
		const origin = this.getAbsolutePosition();
		const [vx, vy, vw, vh] = this.viewRect();
		return (
			x >= origin.x + vx &&
			x < origin.x + vx + vw &&
			y >= origin.y + vy &&
			y < origin.y + vy + vh
		);
	}

	/**
	 * A pointer's position in the panel's coordinates.
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
	 * Whether a point, in the panel's coordinates, is in the content area.
	 * @ignore
	 * @internal
	 */
	private inView(x: number, y: number): boolean {
		const [vx, vy, vw, vh] = this.viewRect();
		return x >= vx && x < vx + vw && y >= vy && y < vy + vh;
	}

	/**
	 * Watch a press that may turn into a scroll.
	 *
	 * Called for a press on the content, and by a widget inside the panel
	 * for a press on it: see {@link UIBaseElement#cancelPress}.
	 * @param event - the pointer-down
	 * @param element - the widget pressed, if any
	 * @returns whether the panel took it; false when it does not scroll
	 * @ignore
	 * @internal
	 */
	_capturePress(event: Pointer, element?: UIBaseElement): boolean {
		if (this.scroll === "none") {
			return false;
		}
		const dom = event.event;
		if (this._press !== undefined) {
			if (
				this._press.pointerId === event.pointerId &&
				this._press.dom === dom
			) {
				// the same press, offered again by the panel's own handler
				return true;
			}
			// a press whose release was never heard: drop it
			this.endPress();
		}
		if (dom !== undefined && takenPresses.has(dom)) {
			// a scrolling panel inside this one has it
			return true;
		}
		if (dom !== undefined) {
			takenPresses.add(dom);
		}
		const [x, y] = this.localPoint(event);
		this._velocityX = this._velocityY = 0;
		this._press = {
			dom,
			pointerId: event.pointerId,
			x,
			y,
			scrollX: this._scrollX,
			scrollY: this._scrollY,
			element,
			scrolling: false,
			lastX: x,
			lastY: y,
			lastTime: globalThis.performance?.now() ?? Date.now(),
		};
		on(POINTERMOVE, this._onPressMove);
		for (const type of END_EVENTS) {
			globalThis.addEventListener?.(type, this._onPressEnd);
		}
		return true;
	}

	private readonly _onPressMove = (pointer: Pointer) => {
		const press = this._press;
		if (press === undefined || pointer.pointerId !== press.pointerId) {
			return;
		}
		const [x, y] = this.localPoint(pointer);
		const horizontal = this._maxScrollX > 0;
		const vertical = this._maxScrollY > 0;
		const dx = horizontal ? x - press.x : 0;
		const dy = vertical ? y - press.y : 0;
		if (!press.scrolling) {
			if (Math.hypot(dx, dy) < SCROLL_THRESHOLD) {
				return;
			}
			// a scroll after all: the press on the widget is called off
			press.scrolling = true;
			press.element?.cancelPress();
		}
		this.scrollTo(press.scrollX - dx, press.scrollY - dy);
		const now = globalThis.performance?.now() ?? Date.now();
		const elapsed = now - press.lastTime;
		if (elapsed > 0) {
			// smoothed, so one jittery sample does not decide the fling
			const vx = horizontal ? (x - press.lastX) / elapsed : 0;
			const vy = vertical ? (y - press.lastY) / elapsed : 0;
			this._velocityX = this._velocityX * 0.2 + vx * 0.8;
			this._velocityY = this._velocityY * 0.2 + vy * 0.8;
		}
		press.lastX = x;
		press.lastY = y;
		press.lastTime = now;
	};

	private readonly _onPressEnd = (event: Event) => {
		const press = this._press;
		if (press === undefined || !endsPointer(event, press.pointerId)) {
			return;
		}
		const now = globalThis.performance?.now() ?? Date.now();
		// a press that held still before letting go does not fling
		if (!press.scrolling || now - press.lastTime > 100) {
			this._velocityX = this._velocityY = 0;
		}
		this.endPress();
	};

	/**
	 * Stop watching the press.
	 * @ignore
	 * @internal
	 */
	private endPress() {
		this._press = undefined;
		off(POINTERMOVE, this._onPressMove);
		for (const type of END_EVENTS) {
			globalThis.removeEventListener?.(type, this._onPressEnd);
		}
	}

	private readonly _onWheel = (pointer: Pointer) => {
		if (this.scroll === "none") {
			return;
		}
		const vh = this.viewRect()[3];
		// lines and pages, as some mice and settings report, into pixels
		const unit =
			pointer.deltaMode === 1 ? 16 : pointer.deltaMode === 2 ? vh : 1;
		let dx = pointer.deltaX * unit;
		let dy = pointer.deltaY * unit;
		// a plain wheel scrolls a panel that only goes sideways
		if (this._maxScrollY === 0 && dx === 0) {
			dx = dy;
			dy = 0;
		}
		const beforeX = this._scrollX;
		const beforeY = this._scrollY;
		this._velocityX = this._velocityY = 0;
		this.scrollTo(this._scrollX + dx, this._scrollY + dy);
		if (this._scrollX !== beforeX || this._scrollY !== beforeY) {
			return false;
		}
		return this.blocking ? false : undefined;
	};

	/**
	 * Bring a draggable panel to the front when it is grabbed, and start
	 * watching a press on the content of a scrolling one.
	 * @ignore
	 */
	override clicked(event: Pointer): boolean | void {
		if (event.button !== 0 || !this.isClickable) {
			return super.clicked(event);
		}
		const [x, y] = this.localPoint(event);
		const onContent = this.scroll !== "none" && this.inView(x, y);
		// Grabbed by its title or its frame, not through a widget on it: a
		// button pressed to drag the panel would move with it, stay under
		// the pointer, and be clicked on the release.
		this._moving = this.isDraggable && !onContent && !this.widgetPressed();
		if (this.isDraggable && this.ancestor instanceof Container) {
			this.ancestor.moveToTop(this);
		}
		let captured = false;
		if (onContent) {
			captured = this._capturePress(event);
		}
		// a press this panel scrolls with is not offered to one around it,
		// or one drag would scroll both
		const keeps = this.keepsDrag;
		this.keepsDrag = keeps || captured;
		try {
			return super.clicked(event);
		} finally {
			this.keepsDrag = keeps;
		}
	}

	/**
	 * Whether this press is on a widget inside the panel, at any depth.
	 *
	 * Children are asked about a press before the container holding them, so
	 * a widget it landed on is already pressed by the time the panel hears
	 * of it.
	 * @returns true when a widget inside is held down
	 * @ignore
	 * @internal
	 */
	private widgetPressed(): boolean {
		const pressed = (container: Container): boolean => {
			for (const child of container.getChildren()) {
				if (child instanceof UIBaseElement && !child.released) {
					return true;
				}
				if (child instanceof Container && pressed(child)) {
					return true;
				}
			}
			return false;
		};
		return pressed(this);
	}

	/**
	 * Move a draggable panel, unless the press began on the content of a
	 * scrolling one.
	 * @ignore
	 */
	override pointerMove(event: Pointer): void {
		if (this._moving) {
			super.pointerMove(event);
		}
	}

	/** set while the panel is emptied, so it does not lay out each step */
	private _clearing = false;

	/**
	 * Remove every child, without laying out after each one.
	 * @ignore
	 */
	override clearChildren(): void {
		this._clearing = true;
		try {
			super.clearChildren();
		} finally {
			this._clearing = false;
		}
		this._scrollX = this._scrollY = 0;
		this._maxScrollX = this._maxScrollY = 0;
	}

	/**
	 * Lay a new child out with the others.
	 * @ignore
	 */
	override addChild(child: Renderable, z?: number): Renderable {
		const added = super.addChild(child, z);
		this.adopt(child);
		return added;
	}

	/**
	 * Lay a new child out with the others.
	 * @ignore
	 */
	override addChildAt(child: Renderable, index: number): Renderable {
		const added = super.addChildAt(child, index);
		this.adopt(child);
		return added;
	}

	/**
	 * Let the layout close the gap.
	 * @ignore
	 */
	override removeChildNow(child: Renderable, keepalive?: boolean): void {
		const scrolled =
			this.layout === "none" && (this._scrollX !== 0 || this._scrollY !== 0);
		if (scrolled && child.ancestor === this) {
			// back to where it is in the content, not where the scroll put it
			child.setPosition(
				child.pos.x + this._scrollX,
				child.pos.y + this._scrollY,
			);
		}
		super.removeChildNow(child, keepalive);
		if (!this._clearing && (this.layout !== "none" || this.scroll !== "none")) {
			this.relayout();
		}
	}

	/**
	 * Place a child just added.
	 * @ignore
	 * @internal
	 */
	private adopt(child: Renderable) {
		if (
			this.layout === "none" &&
			(this._scrollX !== 0 || this._scrollY !== 0)
		) {
			// placed in content coordinates: shown where the scroll has the
			// content now
			child.setPosition(
				child.pos.x - this._scrollX,
				child.pos.y - this._scrollY,
			);
		}
		if (this.layout !== "none" || this.scroll !== "none") {
			this.relayout();
		}
	}

	/**
	 * Resize the panel, and lay the children out again.
	 * @param w - the new width
	 * @param h - the new height
	 * @returns this panel
	 */
	override resize(w: number, h: number) {
		super.resize(w, h);
		// the constructor resizes before any setting is read
		if (this.layout !== undefined && !this._layingOut) {
			this.relayout();
		}
		return this;
	}

	/**
	 * Listen for the wheel, and for hover a blocking panel swallows.
	 * @ignore
	 */
	override onActivateEvent(): void {
		super.onActivateEvent();
		registerPointerEvent("wheel", this, this._onWheel);
		// `onOver` only fires on the frame the pointer crosses in; this keeps
		// a blocking panel opaque to hover for as long as the pointer is on it
		registerPointerEvent("pointermove", this, () => {
			return !this.blocking;
		});
	}

	/**
	 * Stop listening, and drop a press or a fling in progress.
	 * @ignore
	 */
	override onDeactivateEvent(): void {
		releasePointerEvent("wheel", this);
		releasePointerEvent("pointermove", this);
		this.endPress();
		this._velocityX = this._velocityY = 0;
		super.onDeactivateEvent();
	}

	/**
	 * Consume a click on the panel itself, unless told not to.
	 *
	 * Returning `false` is how {@link UIBaseElement} consumes. A child is
	 * asked before the container holding it, so this only ever sees a click
	 * that missed every one of them, which for a dialog means a click on its
	 * own background and should go no further.
	 * @returns false while {@link UIPanel#blocking}
	 */
	override onClick(): boolean {
		return !this.blocking;
	}

	/**
	 * Consume the release that follows a click on the panel, unless told not
	 * to.
	 *
	 * The three handlers consume independently. Taking the press and leaving
	 * the release is half a block: the pointer-up still reaches whatever is
	 * under the dialog, so a button there completes an interaction it never
	 * began.
	 * @returns false while {@link UIPanel#blocking}
	 */
	override onRelease(): boolean {
		return !this.blocking;
	}

	/**
	 * Consume a hover on the panel itself, unless told not to.
	 *
	 * Without this a widget UNDER a dialog keeps lighting up as the pointer
	 * crosses the panel covering it.
	 * @returns false while {@link UIPanel#blocking}
	 */
	override onOver(): boolean {
		return !this.blocking;
	}

	/**
	 * Hand back what the painter borrowed.
	 * @ignore
	 */
	override onDestroyEvent() {
		this.endPress();
		this._painter.dispose();
		this._skin?.dispose();
		this.title?.destroy();
		super.onDestroyEvent();
	}
}
