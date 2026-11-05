import type { RoundRect } from "../../geometries/roundrect.ts";
import { roundedRectanglePool } from "../../geometries/roundrect.ts";
import { Color, colorPool } from "../../math/color.ts";
import type { Gradient } from "../../video/gradient.js";
import type Renderer from "../../video/renderer.js";

/**
 * A colour a widget is painted with: a CSS string, a {@link Color} (kept
 * and read every frame, so changing it animates the widget), or a gradient.
 * @category UI
 */
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
	 * Set the draw colour, and the cascaded alpha as the global alpha.
	 *
	 * Every renderer draws a fill at the colour's own alpha times the global
	 * alpha, so a background given `#00000033` is drawn at a fifth of the
	 * cascade, and the colour's alpha must NOT be folded into the global
	 * alpha as well, or it counts twice.
	 * @param renderer - the renderer to set the colour on
	 * @param color - what to paint with
	 * @param cascade - the alpha the owning renderable inherited
	 * @returns the colour's own alpha (`1` for a gradient)
	 */
	paint(renderer: Renderer, color: Paint, cascade: number): number {
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
			renderer.setGlobalAlpha(cascade);
			return css.alpha;
		}
		renderer.setColor(color);
		renderer.setGlobalAlpha(cascade);
		return color instanceof Color ? color.alpha : 1;
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
			// Put `lineWidth` back afterwards: restore() only does it at the
			// end of the widget's draw, and whatever the widget strokes after
			// its border (a check mark, a thumb outline) has its own width.
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
	 * Draw a drop shadow under a rectangle: offset, and softened by `blur`.
	 *
	 * Not a real blur, which primitives cannot do the same on every backend:
	 * a few translucent rounded rectangles, from `blur` pixels larger down to
	 * the rectangle itself, stacked so the middle reaches the shadow's own
	 * alpha and the edge fades out. It costs a handful of fills, and looks
	 * the same on Canvas, WebGL and WebGPU.
	 * @param renderer - the renderer to draw with
	 * @param color - the shadow's colour; its alpha is how dark it gets
	 * @param cascade - the alpha the owning renderable inherited
	 * @param x - left edge of the rectangle casting it
	 * @param y - top edge
	 * @param w - width
	 * @param h - height
	 * @param radius - the rectangle's corner radius
	 * @param offsetX - how far right the shadow falls
	 * @param offsetY - how far down the shadow falls
	 * @param blur - how far the soft edge spreads, in pixels; `0` is sharp
	 */
	shadow(
		renderer: Renderer,
		color: Paint,
		cascade: number,
		x: number,
		y: number,
		w: number,
		h: number,
		radius: number,
		offsetX: number,
		offsetY: number,
		blur: number,
	) {
		if (w <= 0 || h <= 0) {
			return;
		}
		const spread = Math.max(0, blur);
		// one layer per two pixels of spread, enough for a smooth edge
		const layers = spread > 0 ? Math.min(8, Math.ceil(spread / 2) + 1) : 1;
		// layers of alpha `a` stacked n deep reach 1 - (1 - a)^n; solve for
		// the colour's own alpha in the middle, where they all overlap
		// the colour's own alpha, a string's included: `paint` parses it
		const target = this.paint(renderer, color, 1);
		const each = 1 - (1 - Math.min(target, 0.999)) ** (1 / layers);
		const scale = target > 0 ? each / target : 0;
		for (let i = 0; i < layers; i++) {
			const grow = layers > 1 ? spread * (1 - i / (layers - 1)) : 0;
			this.paint(renderer, color, cascade * scale);
			this.rect(
				renderer,
				x + offsetX - grow,
				y + offsetY - grow,
				w + grow * 2,
				h + grow * 2,
				radius + grow,
			);
		}
		// put the cascade back: what is drawn next, a skin above all, takes
		// the global alpha as it finds it
		renderer.setGlobalAlpha(cascade);
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
