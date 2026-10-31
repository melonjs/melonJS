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
import type { UIJuiceSettings } from "./uibaseelement.ts";
import UIBaseElement, { END_EVENTS, endsPointer } from "./uibaseelement.ts";
import type { UILabel } from "./uilabel.ts";
import { createLabel } from "./uilabel.ts";
import type { UISkin } from "./uiskin.ts";
import { SkinDrawer } from "./uiskin.ts";
import UITextButton from "./uitextbutton.ts";

/**
 * The art of a skinned {@link UIPanel}: one atlas region, drawn as a
 * nine-slice over the whole panel and stretched with it.
 * @category UI
 * @example
 * const panel = new UIPanel(100, 80, {
 *     width: 320,
 *     height: 240,
 *     skin: { atlas, region: "panel_blue", insetx: 16, insety: 16 },
 * });
 */
export interface UIPanelSkin extends UISkin {
	/** the name of the atlas region drawn as the background */
	region: string;
}

/**
 * How a {@link UIPanel} places its children.
 *
 * - `"none"`: each child stays where you put it
 * - `"column"`: one above the other, top to bottom
 * - `"row"`: side by side, left to right
 * - `"grid"`: in rows of {@link UIPanelSettings.columns} equal-width cells
 *
 * Children are placed in the order they were added.
 * @category UI
 */
export type UIPanelLayout = "none" | "column" | "row" | "grid";

/**
 * Where a {@link UIPanel} lines its children up across the layout.
 *
 * - `"start"`: the left of a column, the top of a row, the top left of a grid cell
 * - `"center"`: the middle
 * - `"end"`: the right of a column, the bottom of a row
 * - `"stretch"`: resize each child to the full width of a column, the full
 *   height of a row, or the width of a grid cell. Only a {@link UITextButton}
 *   or a {@link UIPanel} is resized; any other child keeps its size and lines
 *   up at the start.
 * @category UI
 */
export type UIPanelAlign = "start" | "center" | "end" | "stretch";

/**
 * Which ways a {@link UIPanel} scrolls when its content does not fit.
 * @category UI
 */
export type UIPanelScroll = "none" | "vertical" | "horizontal" | "both";

/**
 * The settings a {@link UIPanel} takes. Only `width` and `height` are
 * required; with nothing else the panel is an invisible, blocking box that
 * holds children.
 * @category UI
 */
export interface UIPanelSettings extends UIJuiceSettings {
	/** the panel's width, in pixels */
	width: number;
	/** the panel's height, in pixels */
	height: number;
	/**
	 * The background colour; `null` leaves it transparent.
	 *
	 * Use this, not `backgroundColor`: a `Container`'s `backgroundColor`
	 * clears the whole screen to that colour.
	 * @default null
	 */
	fillColor?: Paint | null;
	/**
	 * the colour of the border drawn around the edge; `null` for none
	 * @default null
	 */
	borderColor?: Paint | null;
	/**
	 * the border's thickness, in pixels, drawn inside the edge
	 * @default 1
	 */
	borderWidth?: number;
	/**
	 * the corner radius, in pixels; `0` is square. The fill, the border and
	 * the shadow all follow it.
	 * @default 0
	 */
	radius?: number;
	/**
	 * The colour of a drop shadow under the panel; `null` for none. Its
	 * alpha sets how dark the shadow is, e.g. `"#00000066"`.
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
	 * How far the panel floats up and down, in pixels; `0` leaves it still.
	 * See {@link UIPanel#bobAmplitude}.
	 * @default 0
	 */
	bobAmplitude?: number;
	/**
	 * How long one full up and down float takes, in milliseconds.
	 * See {@link UIPanel#bobPeriod}.
	 * @default 2000
	 */
	bobPeriod?: number;
	/**
	 * Whether the panel stops pointer events from reaching what is behind
	 * it: clicks, releases and hover on the panel itself, and the wheel over a
	 * scrolling panel. Widgets inside the panel still get their events.
	 *
	 * Keep it `true` for a dialog. Set it `false` for a frame that only
	 * decorates, such as a HUD box over a playfield that still takes clicks.
	 * @default true
	 */
	blocking?: boolean;
	/**
	 * draw the background from an atlas region, as a nine-slice; a
	 * `fillColor` set as well is drawn over it
	 */
	skin?: UIPanelSkin;
	/** a title, centred in a band at the top; the content starts below it */
	title?: string;
	/**
	 * the title's font: a CSS font family, or the name of a loaded bitmap font
	 * @default "sans-serif"
	 */
	titleFont?: string;
	/**
	 * the title's text height, in pixels; the title band is 1.6 times this
	 * @default 20
	 */
	titleFontSize?: number;
	/**
	 * the title's colour
	 * @default "#ffffff"
	 */
	titleFillStyle?: string;
	/**
	 * Let the player move the panel by dragging it. It is moved by its title
	 * or its background, never through a widget on it; a scrolling panel is
	 * moved by its title and frame only, as a drag on its content scrolls.
	 * The panel comes to the front of its container when pressed.
	 * @default false
	 */
	draggable?: boolean;
	/**
	 * how the children are placed; see {@link UIPanelLayout}
	 * @default "none"
	 */
	layout?: UIPanelLayout;
	/**
	 * the number of cells in each row of a `"grid"` layout
	 * @default 2
	 */
	columns?: number;
	/**
	 * The space between the content and the panel's frame, in pixels: inside
	 * the border or the skin's insets, and below the title.
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
	 * Resize the panel to fit its laid out content: the height of a column or
	 * a grid, the width of a row, and the other side of a column or a row too
	 * unless `align` is `"stretch"`. Ignored by a scrolling panel.
	 * @default false
	 */
	autoSize?: boolean;
	/**
	 * Which ways the content scrolls when it does not fit: with the mouse
	 * wheel over the panel, and by dragging the content, with momentum.
	 * @default "none"
	 */
	scroll?: UIPanelScroll;
	/** called each time the content scrolls, with the new offsets in pixels */
	onScroll?: (scrollX: number, scrollY: number, panel: UIPanel) => void;
	/**
	 * the colour of the scrollbar, shown while the content does not fit
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
 * A rectangular frame that holds other widgets: the base of a menu, a
 * dialog, a pause screen or a HUD box. Add children to it with `addChild`;
 * they are positioned relative to the panel's top left corner, drawn over its
 * background, and move with it.
 *
 * ## Background
 * Draw one with no assets: `fillColor`, `borderColor`, `borderWidth` and
 * `radius` for rounded corners. Or give a nine-slice `skin` from an atlas,
 * which stretches to any size with its corners kept sharp. With neither, the
 * panel is invisible but still holds and lays out its children.
 *
 * ## Title
 * `title` draws a line of text centred in a band at the top, styled with
 * `titleFont`, `titleFontSize` and `titleFillStyle`. The content area starts
 * below the band.
 *
 * ## Dragging
 * With `draggable`, the player moves the panel by dragging its title or its
 * background, never through a widget on it (a drag on the content of a
 * scrolling panel scrolls it instead). A pressed panel comes to the front of
 * its container, so the window last touched is on top.
 *
 * ## Blocking
 * By default (`blocking: true`) the panel stops clicks, releases and hover
 * on it from reaching whatever is behind it, and so does the wheel over a
 * scrolling panel. Widgets inside it still get their events. Set
 * `blocking: false` for a frame that only decorates.
 *
 * ## Layout
 * `layout` places the children for you, in the order they were added:
 * `"column"`, `"row"` or `"grid"` (with `columns` per row). `padding` is the
 * space inside the frame, `gap` the space between children, and `align`
 * lines them up across the layout (`"start"`, `"center"`, `"end"`, or
 * `"stretch"`, which resizes buttons and panels to fill the width of a column
 * or a cell, or the height of a row; other children keep their size).
 * `autoSize` resizes the panel to fit what it holds. The layout runs again
 * when a child is added or removed and when the panel is resized; call
 * {@link UIPanel#relayout} after changing a child's size.
 *
 * ## Scrolling
 * `scroll` (`"vertical"`, `"horizontal"` or `"both"`) crops the children to
 * the content area and lets the player scroll whatever does not fit: with
 * the mouse wheel, or by dragging the content, which carries on with
 * momentum. A scrollbar shows how far along the content is.
 * - From code: {@link UIPanel#scrollTo}, {@link UIPanel#scrollToChild}, or
 *   set {@link UIPanel#scrollX} and {@link UIPanel#scrollY}.
 *   {@link UIPanel#maxScrollX} and {@link UIPanel#maxScrollY} say how far it
 *   goes, and `onScroll` is called on every change.
 * - A drag that starts on a button scrolls the panel and calls off the
 *   button's press, so it is not clicked on release. A slider keeps its own
 *   drag. A scrolling panel inside another scrolls on its own.
 * - A widget given the keyboard or gamepad focus is scrolled into view.
 * - {@link UIPanel#clearChildren} empties the panel and scrolls back to the
 *   start, ready to be filled again.
 *
 * With `layout: "none"`, place children at their position in the content, as
 * if it were not scrolled, and call `relayout()` after moving one by hand.
 *
 * ## Drop shadow
 * `shadowColor` draws a soft shadow under the panel; its alpha sets how dark
 * it is. `shadowOffsetX` and `shadowOffsetY` move it, `shadowBlur` softens
 * its edge, and it follows `radius`. The shadow is drawn outside the panel's
 * bounds and never takes the pointer.
 *
 * ## Idle float
 * `bobAmplitude` and `bobPeriod` make the panel drift slowly up and down,
 * so a screen waiting for input does not look frozen. Its widgets stay
 * clickable where they are drawn.
 *
 * ## Things to know
 * - Like every UI element, a panel is floating: it is drawn in screen
 *   coordinates, over the scene. With a `Camera3d`, floating children are
 *   sorted the other way round: the SMALLER depth draws on top, so add a
 *   dialog at a depth of 0 or 1, not 9000.
 * - On WebGL and WebGPU, a scrolling panel inside another clipping container
 *   (such as another scrolling panel) is cropped to its own area only, not
 *   to the outer container's.
 * @category UI
 * @example
 * // a drawn dialog, with no assets
 * import { UIPanel, Text } from "melonjs";
 *
 * const dialog = new UIPanel(220, 140, {
 *     width: 400,
 *     height: 240,
 *     fillColor: "#0a1526",
 *     borderColor: "rgba(130, 200, 240, 0.55)",
 *     borderWidth: 2,
 *     radius: 14,
 * });
 * // relative to the panel's top left corner, not to the screen
 * dialog.addChild(new Text(200, 24, {
 *     font: "sans-serif",
 *     size: 32,
 *     text: "PAUSED",
 *     textAlign: "center",
 * }));
 * app.world.addChild(dialog);
 * @example
 * // a skinned options menu: a column of widgets, sized to fit
 * import { UIPanel, UISlider, UICheckbox, UITextButton } from "melonjs";
 *
 * const menu = new UIPanel(240, 100, {
 *     width: 320,
 *     height: 100, // autoSize sets the height
 *     skin: { atlas, region: "panel_brown" },
 *     title: "Options",
 *     layout: "column",
 *     padding: 16,
 *     gap: 12,
 *     align: "stretch",
 *     autoSize: true,
 * });
 * menu.addChild(new UISlider(0, 0, {
 *     label: "Music",
 *     value: 0.8,
 *     onChange: (value) => { musicVolume = value; },
 * }));
 * menu.addChild(new UICheckbox(0, 0, {
 *     label: "Show hints",
 *     checked: true,
 *     onChange: (checked) => { showHints = checked; },
 * }));
 * // stretched to the full width of the column
 * menu.addChild(new UITextButton(0, 0, {
 *     text: "Back",
 *     skin: { atlas, normal: "button", pressed: "button_pressed" },
 *     onClick: () => { app.world.removeChild(menu); },
 * }));
 * app.world.addChild(menu);
 * @example
 * // a scrolling grid of level buttons
 * const levels = new UIPanel(160, 60, {
 *     width: 480,
 *     height: 360,
 *     fillColor: "#1b2333",
 *     radius: 10,
 *     title: "Select a level",
 *     layout: "grid",
 *     columns: 4,
 *     padding: 12,
 *     gap: 10,
 *     align: "stretch",
 *     scroll: "vertical",
 * });
 * const buttons = [];
 * for (let i = 1; i <= 40; i++) {
 *     const button = new UITextButton(0, 0, {
 *         text: String(i),
 *         height: 64,
 *         onClick: () => { startLevel(i); },
 *     });
 *     buttons.push(button);
 *     levels.addChild(button);
 * }
 * app.world.addChild(levels);
 * // open on the last level unlocked, with 8 pixels to spare around it
 * levels.scrollToChild(buttons[lastUnlocked - 1], 8);
 * @example
 * // a draggable window with a title
 * const inventory = new UIPanel(40, 40, {
 *     width: 260,
 *     height: 180,
 *     fillColor: "#2b2f3a",
 *     borderColor: "#8899aa",
 *     radius: 6,
 *     title: "Inventory",
 *     titleFontSize: 18,
 *     layout: "column",
 *     padding: 10,
 *     draggable: true,
 * });
 * inventory.addChild(new Text(0, 0, { font: "sans-serif", size: 16, text: "3 potions" }));
 * app.world.addChild(inventory);
 * @example
 * // a drop shadow, soft and a little below
 * const card = new UIPanel(300, 200, {
 *     width: 200,
 *     height: 120,
 *     fillColor: "#ffffff",
 *     radius: 12,
 *     shadowColor: "#00000066", // the alpha sets how dark
 *     shadowOffsetX: 2,
 *     shadowOffsetY: 6,
 *     shadowBlur: 12,
 * });
 * @example
 * // a HUD frame that lets clicks through to the game behind it
 * const hud = new UIPanel(8, 8, {
 *     width: 220,
 *     height: 48,
 *     fillColor: "#00000080",
 *     radius: 8,
 *     blocking: false,
 * });
 */
export default class UIPanel extends UIBaseElement {
	/** the background colour; `null` leaves it transparent */
	fillColor: Paint | null;
	/** the colour of the border around the edge; `null` for none */
	borderColor: Paint | null;
	/** the border's thickness, in pixels */
	borderWidth: number;
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
	 * Whether the panel stops pointer events on it from reaching what is
	 * behind it. Widgets inside still get theirs.
	 * @default true
	 */
	blocking: boolean;
	/**
	 * How far the panel floats up and down, in pixels; `0` leaves it still.
	 *
	 * A slow float keeps a dialog waiting for input from looking frozen. The
	 * panel rises this far above its position and sinks this far below it;
	 * 2 to 4 works well, as smaller values step a pixel at a time and look
	 * jerky. The panel, and every widget in it, is clickable where it is
	 * drawn, while `pos` keeps its resting place.
	 * @default 0
	 * @example
	 * dialog.bobAmplitude = 3;
	 * dialog.bobPeriod = 2500;
	 */
	bobAmplitude: number;
	/**
	 * How long one full up and down float takes, in milliseconds. `0` or
	 * less turns the float off.
	 * @default 2000
	 */
	bobPeriod: number;

	/** the background art, when the panel is skinned */
	readonly skin: UIPanelSkin | undefined;
	/** the title's text object, when the panel has a title */
	readonly title: UILabel | undefined;
	/** how the children are placed; see {@link UIPanelLayout}. Call {@link UIPanel#relayout} after changing it. */
	layout: UIPanelLayout;
	/** the number of cells in each row of a `"grid"` layout */
	columns: number;
	/** the space between the content and the frame, in pixels */
	padding: number;
	/** the space between children in a layout, in pixels */
	gap: number;
	/** where children line up across the layout; see {@link UIPanelAlign} */
	align: UIPanelAlign;
	/** whether the panel resizes to fit its laid out content */
	autoSize: boolean;
	/** which ways the content scrolls; see {@link UIPanelScroll} */
	scroll: UIPanelScroll;
	/**
	 * Called each time the content scrolls, with the new offsets in pixels.
	 * @example
	 * // fade an arrow out once the list is scrolled to the bottom
	 * list.onScroll = (scrollX, scrollY, panel) => {
	 *     moreArrow.setOpacity(scrollY < panel.maxScrollY ? 1 : 0);
	 * };
	 */
	onScroll:
		| ((scrollX: number, scrollY: number, panel: UIPanel) => void)
		| undefined;
	/** the colour of the scrollbar, shown while the content does not fit */
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
		this.shadowColor = settings.shadowColor ?? null;
		this.shadowOffsetX = settings.shadowOffsetX ?? 0;
		this.shadowOffsetY = settings.shadowOffsetY ?? 4;
		this.shadowBlur = settings.shadowBlur ?? 8;
		this.blocking = settings.blocking ?? true;
		this.bobAmplitude = settings.bobAmplitude ?? 0;
		this.bobPeriod = settings.bobPeriod ?? 2000;
		this.hoverScale = settings.hoverScale ?? 1;
		this.pressScale = settings.pressScale ?? 1;

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
		// drawn outside the panel's bounds, so it never takes the pointer
		if (this.shadowColor !== null) {
			this._painter.shadow(
				renderer,
				this.shadowColor,
				alpha,
				this.pos.x,
				this.pos.y,
				this.width,
				this.height,
				this.radius,
				this.shadowOffsetX,
				this.shadowOffsetY,
				this.shadowBlur,
			);
		}
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
	 * The panel's absolute position, including the idle float, so the hit
	 * areas of the panel and of every widget in it follow the float.
	 * @returns the absolute position, offset by the float
	 */
	override getAbsolutePosition(): Vector3d {
		const absolute = super.getAbsolutePosition();
		absolute.y += this._bobOffset();
		return absolute;
	}

	/**
	 * The panel's local transform, including the idle float, so it agrees
	 * with {@link UIPanel#getAbsolutePosition}.
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
	 * Update this panel's bounds, and its children's, so their hit areas
	 * follow the panel when it moves. The panel's own bounds are its size,
	 * never grown by a child hanging over the edge.
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
	 * It runs by itself when a child is added or removed and when the panel
	 * is resized, not every frame. Call it after a child changes size, after
	 * changing `layout`, `columns`, `padding`, `gap` or `align`, or after
	 * moving children by hand in a scrolling panel.
	 * @returns this panel
	 * @example
	 * menu.gap = 4;
	 * menu.relayout();
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
	 * How far the content is scrolled to the right, in pixels, from `0` to
	 * {@link UIPanel#maxScrollX}. Setting it scrolls, clamped to that range.
	 * @default 0
	 */
	get scrollX(): number {
		return this._scrollX;
	}

	set scrollX(value: number) {
		this.scrollTo(value, this._scrollY);
	}

	/**
	 * How far the content is scrolled down, in pixels, from `0` to
	 * {@link UIPanel#maxScrollY}. Setting it scrolls, clamped to that range.
	 * @default 0
	 * @example
	 * // back to the top
	 * list.scrollY = 0;
	 */
	get scrollY(): number {
		return this._scrollY;
	}

	set scrollY(value: number) {
		this.scrollTo(this._scrollX, value);
	}

	/**
	 * How far the content can scroll to the right, in pixels; `0` when it
	 * fits or the panel does not scroll that way. Read only.
	 */
	get maxScrollX(): number {
		return this._maxScrollX;
	}

	/**
	 * How far the content can scroll down, in pixels; `0` when it fits or
	 * the panel does not scroll that way. Read only.
	 */
	get maxScrollY(): number {
		return this._maxScrollY;
	}

	/**
	 * Scroll the content to an offset, clamped to `0` up to
	 * {@link UIPanel#maxScrollX} and {@link UIPanel#maxScrollY}, with no
	 * animation.
	 *
	 * Scrolling moves the children, so a child's `pos` is where it is drawn.
	 * @param x - the horizontal offset, in pixels
	 * @param y - the vertical offset, in pixels
	 * @returns this panel
	 * @example
	 * // jump to the end of a chat log
	 * log.scrollTo(0, log.maxScrollY);
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
	 * Scroll just enough to bring a child fully into view; nothing moves if
	 * it already is. A widget that is not a direct child of this panel is
	 * ignored.
	 * @param child - one of this panel's children
	 * @param margin - room to leave around it, in pixels, such as for a
	 * focus ring
	 * @returns this panel
	 * @example
	 * // show the selected save slot, with 8 pixels to spare
	 * slots.scrollToChild(selectedSlot, 8);
	 */
	scrollToChild(child: Renderable, margin = 0): this {
		if (child.ancestor !== this) {
			return this;
		}
		const [vx, vy, vw, vh] = this.viewRect();
		const box = this.measure(child);
		const left = child.pos.x + box.ox - margin;
		const top = child.pos.y + box.oy - margin;
		const w = box.w + margin * 2;
		const h = box.h + margin * 2;
		let x = this._scrollX;
		let y = this._scrollY;
		if (left < vx) {
			x -= vx - left;
		} else if (left + w > vx + vw) {
			x += Math.min(left - vx, left + w - (vx + vw));
		}
		if (top < vy) {
			y -= vy - top;
		} else if (top + h > vy + vh) {
			y += Math.min(top - vy, top + h - (vy + vh));
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
	 * Remove every child and scroll back to the start, ready to fill the
	 * panel again.
	 * @example
	 * // refill a scrolling list
	 * list.clearChildren();
	 * for (const name of names) {
	 *     list.addChild(new Text(0, 0, { font: "sans-serif", size: 16, text: name }));
	 * }
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
