import type Camera2d from "../../camera/camera2d.ts";
import type { Matrix3d } from "../../math/matrix3d.ts";
import type { Vector3d } from "../../math/vector3d.ts";
import type Renderer from "../../video/renderer.js";
import type Renderable from "../renderable.js";
import type { Paint } from "./panelpaint.ts";
import { PanelPainter } from "./panelpaint.ts";
import UIBaseElement from "./uibaseelement.ts";

/**
 * Everything {@link UIPanel} takes.
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
}

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
		// `super.update` is what steps the children, so it is called either
		// way; the bob only ever adds a reason to redraw.
		const dirty = super.update(dt);
		const offset = this._bobOffset();
		if (offset !== this._bobApplied) {
			this._bobApplied = offset;
			this.updateBounds();
		}
		return dirty || moving;
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

		super.draw(renderer, viewport);
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
		this._painter.dispose();
		super.onDestroyEvent();
	}
}
