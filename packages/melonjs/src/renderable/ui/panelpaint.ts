import type { RoundRect } from "../../geometries/roundrect.ts";
import { roundedRectanglePool } from "../../geometries/roundrect.ts";
import { Color, colorPool } from "../../math/color.ts";
import type { Gradient } from "../../video/gradient.js";
import type Renderer from "../../video/renderer.js";

/** anything {@link Renderer#setColor} will take */
export type Paint = Color | string | Gradient;

/**
 * The shape and colour plumbing behind the widgets that draw a filled,
 * optionally bordered rectangle.
 *
 * Internal, and deliberately not a renderable: {@link ProgressBar} extends
 * `Renderable` while {@link UIPanel} extends `Container` through
 * `UIBaseElement`, so there is no class the two could share. They share this
 * instead, as a field.
 *
 * Both of them had their own copy of all three methods below, which is how the
 * border ended up drawn two different ways in two widgets that look the same.
 * @ignore
 * @internal
 */
export class PanelPainter {
	/**
	 * The last CSS string parsed, and what it parsed to.
	 *
	 * Cached because a widget's colours almost never change between frames and
	 * parsing a string per shape per frame is pure waste.
	 */
	private _css: Color | undefined;
	private _lastCss = "";
	/**
	 * The rounded rectangle borrowed to draw through, kept for the owner's
	 * lifetime and given back in {@link PanelPainter.dispose}.
	 *
	 * Not fetched and released per draw: `get` and `release` are a handful of
	 * Set and Map operations each, and this runs for up to three shapes every
	 * frame a widget is up.
	 */
	private _round: RoundRect | undefined;

	/**
	 * Set the draw colour, with its own alpha folded into the cascaded one.
	 *
	 * Not simply `setColor` then `setGlobalAlpha(cascade)`: that discards
	 * whatever alpha the colour asked for, so a background given `#00000033`
	 * comes out solid. Nor `setColor` then reading the alpha back, which is
	 * worse: a renderer keeps ONE current colour, and parsing a six digit hex
	 * into it leaves the alpha from the colour before, so a translucent
	 * background silently leaks into the border drawn after it.
	 * @param renderer - the renderer to set the colour on
	 * @param color - what to paint with
	 * @param cascade - the alpha the owning renderable inherited
	 */
	paint(renderer: Renderer, color: Paint, cascade: number) {
		if (typeof color === "string") {
			// Borrowed on FIRST use, not in the constructor: a widget handed
			// `Color` instances never needs one at all, and a widget that is
			// built and thrown away without drawing never touches the pool.
			let css = this._css;
			if (css === undefined) {
				css = colorPool.get();
				this._css = css;
			}
			if (color !== this._lastCss) {
				css.parseCSS(color);
				this._lastCss = color;
			}
			renderer.setColor(css);
			renderer.setGlobalAlpha(css.alpha * cascade);
		} else if (color instanceof Color) {
			renderer.setColor(color);
			renderer.setGlobalAlpha(color.alpha * cascade);
		} else {
			renderer.setColor(color);
			renderer.setGlobalAlpha(cascade);
		}
	}

	/**
	 * Fill or stroke a rectangle, rounded if it has a radius.
	 * @param renderer - the renderer to draw with
	 * @param x - left edge
	 * @param y - top edge
	 * @param w - width
	 * @param h - height
	 * @param radius - corner radius; `0` is square
	 * @param stroke - outline it instead of filling it
	 */
	rect(
		renderer: Renderer,
		x: number,
		y: number,
		w: number,
		h: number,
		radius = 0,
		stroke = false,
	) {
		if (w <= 0 || h <= 0) {
			return;
		}
		if (radius > 0) {
			// through the shape dispatch, which is the only portable route to
			// a rounded rectangle: `fillRoundRect` is on the concrete
			// renderers and not on the base class
			if (this._round === undefined) {
				this._round = roundedRectanglePool.get(x, y, w, h, radius);
			} else {
				this._round.pos.set(x, y);
				this._round.setSize(w, h);
				this._round.radius = radius;
			}
			if (stroke) {
				renderer.stroke(this._round);
			} else {
				renderer.fill(this._round);
			}
		} else if (stroke) {
			renderer.strokeRect(x, y, w, h);
		} else {
			renderer.fillRect(x, y, w, h);
		}
	}

	/**
	 * Draw a border around the rectangle, entirely INSIDE it.
	 *
	 * Inside is the whole point, and it is not what a stroke does on its own.
	 * Every backend expands a line symmetrically about its path, WebGPU
	 * literally so (`primitive.wgsl`: `aVertex.xy + aNormal * lineWidth *
	 * 0.5`), so a plain `strokeRect` on the widget's own rectangle puts half
	 * the border outside it. A widget would then paint `borderWidth / 2` past
	 * the `width` and `height` it was given, over whatever sits next to it, and
	 * `getBounds()` would not know about those pixels. That matters beyond
	 * looks for a {@link UIPanel}, whose bounds are what the pointer
	 * dispatcher hit-tests.
	 *
	 * The two cases get there differently:
	 *
	 * - **Square** corners are drawn as four fills that tile the frame exactly.
	 *   They land where they are put at any width, and have no joins to miss:
	 *   `strokeRect` only generates corner joins ABOVE a line width of one
	 *   (`webgl_renderer.js`, `primitive_batcher.js`), so at exactly 1, the
	 *   common case for a HUD frame, a stroked square border comes up short at
	 *   all four corners.
	 * - **Rounded** corners have no four-rect form, so they are stroked. The
	 *   path is inset by half the border width, with the radius pulled in to
	 *   match, which puts the centred stroke inside the rectangle after all.
	 *
	 * The four fills do not overlap, which the insets on the left and right
	 * pieces are there for. Four full-length pieces would also cover the
	 * frame, but {@link PanelPainter.paint} puts a colour's own alpha into
	 * `globalAlpha`, so a translucent border would blend twice where they
	 * crossed and the corners would come out darker than the sides.
	 * @param renderer - the renderer to draw with
	 * @param x - left edge of the rectangle being bordered
	 * @param y - top edge
	 * @param w - width
	 * @param h - height
	 * @param radius - corner radius; `0` is square
	 * @param borderWidth - how thick, clamped so it cannot cross itself
	 */
	border(
		renderer: Renderer,
		x: number,
		y: number,
		w: number,
		h: number,
		radius: number,
		borderWidth: number,
	) {
		if (w <= 0 || h <= 0) {
			return;
		}
		// Clamped so a border thicker than the widget is half of cannot run
		// past the far edge, which would leave the pieces overlapping and, on
		// the rounded path, invert the inset rectangle.
		const bw = Math.min(borderWidth, w / 2, h / 2);
		if (bw <= 0) {
			return;
		}
		if (radius > 0) {
			// Put `lineWidth` back afterwards, because `RenderState.save()`
			// does not stack it: it keeps colour, tint, transform, scissor,
			// gradient, line DASH, blend mode, shader and depth, and
			// `lineWidth` is a plain field on the renderers. Left alone, a
			// widget with a 2px border makes everything stroked after it in
			// the frame 2px too.
			const previousWidth = renderer.lineWidth;
			renderer.lineWidth = bw;
			this.rect(
				renderer,
				x + bw / 2,
				y + bw / 2,
				w - bw,
				h - bw,
				Math.max(0, radius - bw / 2),
				true,
			);
			renderer.lineWidth = previousWidth;
		} else {
			renderer.fillRect(x, y, w, bw); // top
			renderer.fillRect(x, y + h - bw, w, bw); // bottom
			renderer.fillRect(x, y + bw, bw, h - bw * 2); // left
			renderer.fillRect(x + w - bw, y + bw, bw, h - bw * 2); // right
		}
	}

	/**
	 * Hand back everything borrowed. Call from the owner's `onDestroyEvent`.
	 *
	 * Safe to call twice, which is not a nicety: `Pool#release` THROWS on a
	 * double release, and a renderable's `destroy` is reached more than once
	 * often enough that it cannot be treated as a bug in the caller. Each
	 * handle is cleared as it goes back, so a second call has nothing to give.
	 */
	dispose() {
		if (this._round !== undefined) {
			roundedRectanglePool.release(this._round);
			this._round = undefined;
		}
		if (this._css !== undefined) {
			colorPool.release(this._css);
			this._css = undefined;
			// so a redraw after a dispose re-parses into the fresh instance
			// rather than trusting a cache that outlived its colour
			this._lastCss = "";
		}
	}
}
