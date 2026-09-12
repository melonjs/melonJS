import { game } from "../../application/application.ts";
import { Color, colorPool } from "../../math/color.ts";
import { Gradient } from "../../video/gradient.js";

import CanvasRenderTarget from "../../video/rendertarget/canvasrendertarget.js";
import { resolveAnchorPoint } from "../anchorPoint.ts";
import Renderable from "../renderable.js";
import TextMetrics from "./textmetrics.js";
import setContextStyle from "./textstyle.js";

/*
 * ASCII Table
 * http://www.asciitable.com/
 * [ !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz]
 *
 * -> first char " " 32d (0x20);
 */

const runits = ["ex", "em", "pt", "px"];
const toPX = [12, 24, 0.75, 1];

// CSS generic font families must NOT be quoted: quoting a generic keyword turns
// it into a (nonexistent) specific family name, so the browser silently falls
// back to its default serif. These are kept unquoted by setFont().
const genericFontFamilies = new Set([
	"serif",
	"sans-serif",
	"monospace",
	"cursive",
	"fantasy",
	"system-ui",
	"ui-serif",
	"ui-sans-serif",
	"ui-monospace",
	"ui-rounded",
	"math",
	"emoji",
	"fangsong",
]);

/**
 * a Text object: draws a string using a system or web font.
 *
 * The text is rasterised to a cached texture, so it draws as fast as a sprite
 * while staying fully styleable — `fillStyle`, `strokeStyle` + `lineWidth`, and
 * per-object opacity — with multi-line text (embedded `\n`), optional
 * `wordWrapWidth` word-wrapping, and chainable {@link Text#bold} /
 * {@link Text#italic}. `font` accepts any CSS family, including the generic
 * keywords (`sans-serif`, `monospace`, …); a web font loaded through the
 * `fontface` loader is referenced by its family name.
 *
 * For a crisp, tintable, retro look — or large amounts of mostly-static text —
 * consider {@link BitmapText} instead.
 * @category Text
 */
export default class Text extends Renderable {
	/**
	 * @param {number} x - position of the text object
	 * @param {number} y - position of the text object
	 * @param {object} settings - the text configuration
	 * @param {string} settings.font - a CSS font family: a specific name (`"Arial"`), a generic keyword (`"sans-serif"`, `"monospace"`, …), or a web font loaded via the `fontface` loader (referenced by its family name)
	 * @param {number|string} settings.size - the font size: a number in pixels, or a CSS size string with a unit (`"24px"` / `"1.5em"` / `"18pt"`)
	 * @param {Color|Gradient|string} [settings.fillStyle="#000000"] - a CSS color value used to fill the glyphs, or a {@link Gradient} to ramp them
	 * @param {boolean} [settings.gradientPerLine=true] - restart a gradient fill on every line; `false` spans one ramp across the whole block, as a plain canvas does
	 * @param {Color|string} [settings.strokeStyle="#000000"] - a CSS color value used for the glyph outline (drawn when `lineWidth` > 0)
	 * @param {number} [settings.lineWidth=0] - outline width in pixels (0 = no stroke)
	 * @param {string} [settings.textAlign="left"] - horizontal text alignment ("left", "center", "right")
	 * @param {string} [settings.textBaseline="top"] - the text baseline ("top", "hanging", "middle", "alphabetic", "ideographic", "bottom")
	 * @param {number} [settings.lineHeight=1.0] - line spacing height
	 * @param {string|Vector2d|{x:number,y:number}} [settings.anchorPoint={x:0.0, y:0.0}] - anchor point to draw the text at. Also accepts the named presets `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`.
	 * @param {number} [settings.wordWrapWidth] - the maximum length in CSS pixels of a line before it wraps
	 * @param {(string|string[])} [settings.text=""] - a string, or an array of strings
	 * @example
	 * // a styled, word-wrapped, multi-line label using a generic system font
	 * const label = new Text(8, 8, {
	 *     font: "sans-serif",          // any CSS family (generic keywords work too)
	 *     size: 24,                    // number (px) or a "1.5em" / "18pt" string
	 *     fillStyle: "#ffffff",
	 *     strokeStyle: "#202020",
	 *     lineWidth: 2,                // outline the glyphs
	 *     textAlign: "left",
	 *     textBaseline: "top",
	 *     wordWrapWidth: 200,          // wrap lines longer than 200px
	 *     text: "Hello melonJS!\nStyled, wrapped, multi-line text.",
	 * });
	 * label.bold();                    // bold() / italic() are chainable
	 * label.setOpacity(0.8);           // per-object transparency
	 * app.world.addChild(label);
	 * @example
	 * // a web font (loaded via the fontface loader) is used by its family name
	 * loader.preload(
	 *     [{ name: "kenpixel", type: "fontface", src: "data/font/kenvector.woff2" }],
	 *     () => {
	 *         app.world.addChild(
	 *             new Text(0, 0, { font: "kenpixel", size: 32, text: "Web font" }),
	 *         );
	 *     },
	 * );
	 */
	constructor(x, y, settings) {
		// call the parent constructor
		super(x, y, settings.width || 0, settings.height || 0);

		/**
		 * defines the color used to draw the font.
		 * @type {Color}
		 * @default black
		 */
		this.fillStyle = colorPool.get(0, 0, 0);

		/**
		 * defines the color used to draw the font stroke.<br>
		 * @type {Color}
		 * @default black
		 */
		this.strokeStyle = colorPool.get(0, 0, 0);

		/**
		 * sets the current line width, in pixels, when drawing stroke
		 * @type {number}
		 * @default 0
		 */
		this.lineWidth = 0;

		/**
		 * Set the default text alignment (or justification),<br>
		 * possible values are "left", "right", and "center".<br>
		 * @type {string}
		 * @default "left"
		 */
		this.textAlign = "left";

		/**
		 * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
		 * possible values are "top", "hanging", "middle", "alphabetic", "ideographic", "bottom"<br>
		 * @type {string}
		 * @default "top"
		 */
		this.textBaseline = "top";

		/**
		 * Set the line spacing height (when displaying multi-line strings). <br>
		 * Current font height will be multiplied with this value to set the line height.
		 * @type {number}
		 * @default 1.0
		 */
		this.lineHeight = 1.0;

		/**
		 * the maximum length in CSS pixel for a single segment of text.
		 * (use -1 to disable word wrapping)
		 * @type {number}
		 * @default -1
		 */
		this.wordWrapWidth = -1;

		/**
		 * the font size (in px)
		 * @type {number}
		 * @default 10
		 */
		this.fontSize = 10;

		/**
		 * the text to be displayed
		 * @private
		 * @ignore
		 * @internal
		 */
		this._text = [];

		// initialize the object based on the given settings
		this.onResetEvent(x, y, settings);
	}

	/**
	 * @ignore
	 * @internal
	 */
	onResetEvent(x, y, settings) {
		if (typeof this.fillStyle === "undefined") {
			this.fillStyle = colorPool.get(0, 0, 0);
		}

		/**
		 * The gradient to fill the glyphs with, when one was given instead of a
		 * colour. Built by {@link Renderer#createLinearGradient} /
		 * {@link Renderer#createRadialGradient}, and its coordinates are this
		 * label's own bake — `(0, 0)` is the top-left of the render box.
		 *
		 * Set it through `fillStyle`, the way `Renderer#setColor` takes one;
		 * this field is where it lands so the pooled `fillStyle` `Color` keeps
		 * its type, its alpha and its pooling.
		 * @type {Gradient|undefined}
		 * @default undefined
		 * @example
		 * const ramp = renderer.createLinearGradient(0, 0, 0, 24);
		 * ramp.addColorStop(0, "#fffdf0");
		 * ramp.addColorStop(1, "#f0a020");
		 * const label = new Text(x, y, { font: "Arial", size: 24, fillStyle: ramp });
		 */
		this.fillGradient = undefined;

		/**
		 * Whether a gradient fill restarts on every line.
		 *
		 * `true` (the default) re-anchors the ramp to each line, so a
		 * multi-line label reads like one `Text` per line — which is how a HUD
		 * is usually built, and means the ramp does not have to be authored
		 * over the block height to look right.
		 *
		 * `false` spans one ramp across the whole block, which is what a plain
		 * canvas does: a `CanvasGradient` lives in the current transform's
		 * space, so lines further down sample further along it. Use it for a
		 * deliberate fade across a multi-line title.
		 * @type {boolean}
		 * @default true
		 */
		this.gradientPerLine = true;

		if (typeof this.strokeStyle === "undefined") {
			this.strokeStyle = colorPool.get(0, 0, 0);
		}

		// A `Gradient` is a fill style like any other — `Renderer#setColor`
		// already takes one, and this is the same branch one level down: the
		// gradient goes in its own field and the pooled `Color` is left alone,
		// still holding the alpha that gates the fill and still owned by the
		// pool. Widening what the setting ACCEPTS is not widening what
		// `fillStyle` HOLDS.
		this.fillGradient = undefined;
		if (typeof settings.fillStyle !== "undefined") {
			if (settings.fillStyle instanceof Gradient) {
				this.fillGradient = settings.fillStyle;
			} else if (settings.fillStyle instanceof Color) {
				this.fillStyle.copy(settings.fillStyle);
			} else {
				// string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
				this.fillStyle.parseCSS(settings.fillStyle);
			}
		}

		if (typeof settings.strokeStyle !== "undefined") {
			if (settings.strokeStyle instanceof Color) {
				this.strokeStyle.copy(settings.strokeStyle);
			} else {
				// string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
				this.strokeStyle.parseCSS(settings.strokeStyle);
			}
		}

		if (typeof settings.gradientPerLine === "boolean") {
			this.gradientPerLine = settings.gradientPerLine;
		}

		this.lineWidth = settings.lineWidth || 0;
		this.textAlign = settings.textAlign || "left";
		this.textBaseline = settings.textBaseline || "top";
		this.lineHeight = settings.lineHeight || 1.0;
		this.wordWrapWidth = settings.wordWrapWidth || -1;
		this.fontSize = 10;

		// anchor point
		if (typeof settings.anchorPoint !== "undefined") {
			const anchor = resolveAnchorPoint(settings.anchorPoint, "Text", {
				x: 0,
				y: 0,
			});
			this.anchorPoint.set(anchor.x, anchor.y);
		} else {
			this.anchorPoint.set(0, 0);
		}

		// if floating was specified through settings
		if (typeof settings.floating !== "undefined") {
			this.floating = !!settings.floating;
		}

		// font name and type
		this.setFont(settings.font, settings.size);

		// additional font styles
		if (settings.bold === true) {
			this.bold();
		}
		if (settings.italic === true) {
			this.italic();
		}

		// the canvas Texture used to render this text
		// offscreenCanvas is currently disabled for text rendering due to issue in WebGL mode
		// see https://github.com/melonjs/melonJS/issues/1180
		this.canvasTexture = new CanvasRenderTarget(2, 2, {
			offscreenCanvas: false,
		});

		/**
		 * @ignore
		 * @internal
		 */
		this._visibleCharacters = -1;

		// instance to text metrics functions
		this.metrics = new TextMetrics(this);

		// set the text
		this.setText(settings.text);
	}

	/**
	 * make the font bold
	 * @returns {Text} this object for chaining
	 */
	bold() {
		if (
			!this.font.startsWith("bold ") &&
			!this.font.startsWith("italic bold ")
		) {
			this.font = "bold " + this.font;
			this.isDirty = true;
		}
		return this;
	}

	/**
	 * make the font italic
	 * @returns {Text} this object for chaining
	 */
	italic() {
		if (
			!this.font.startsWith("italic ") &&
			!this.font.startsWith("bold italic ")
		) {
			this.font = "italic " + this.font;
			this.isDirty = true;
		}
		return this;
	}

	/**
	 * set the font family and size
	 * @param {string} font - a CSS font name
	 * @param {number|string} [size=10] - size in px, or size + suffix (px, em, pt)
	 * @returns {Text} this object for chaining
	 * @example
	 * font.setFont("Arial", 20);
	 * font.setFont("Arial", "1.5em");
	 */
	setFont(font, size = 10) {
		// font name and type
		const font_names = font.split(",").map((value) => {
			value = value.trim();
			// leave already-quoted names and CSS generic families untouched
			if (
				/(^".*"$)|(^'.*'$)/.test(value) ||
				genericFontFamilies.has(value.toLowerCase())
			) {
				return value;
			}
			return `"${value}"`;
		});

		// font size
		if (typeof size === "number") {
			this.fontSize = size;
			size += "px";
		} /* string */ else {
			// extract the units and convert if necessary
			const CSSval = size.match(/([-+]?[\d.]*)(.*)/);
			this.fontSize = parseFloat(CSSval[1]);
			if (CSSval[2]) {
				this.fontSize *= toPX[runits.indexOf(CSSval[2])];
			} else {
				// no unit define, assume px
				size += "px";
			}
		}
		this.height = this.fontSize;
		this.font = size + " " + font_names.join(",");

		this.isDirty = true;

		return this;
	}

	/**
	 * change the text to be displayed
	 * @param {number|string|string[]} value - a string, or an array of strings
	 * @returns {Text} this object for chaining
	 */
	setText(value = "") {
		const bounds = this.getBounds();

		// set the next text
		if (this._text.toString() !== value.toString()) {
			if (!Array.isArray(value)) {
				this._text = ("" + value).split("\n");
			} else {
				// copy — storing the caller's array by reference would let
				// destroy() (`_text.length = 0`) wipe it, and external
				// mutation would change the rendered text without isDirty
				this._text = value.slice();
			}
		}

		// word wrap if necessary
		if (this._text.length > 0 && this.wordWrapWidth > 0) {
			this._text = this.metrics.wordWrap(
				this._text,
				this.wordWrapWidth,
				this.canvasTexture.context,
			);
		}

		// calculcate the text size and update the bounds accordingly
		bounds.addBounds(
			this.metrics.measureText(this._text, this.canvasTexture.context),
			true,
		);

		// Quantize the offscreen canvas size to 32-pixel buckets: small
		// metric changes (a score ticking, typewriter text) land on the
		// SAME canvas dimensions, so the re-bake stays a same-size texture
		// update — the cheap path on every backend (a size change means
		// respecifying GL storage / retiring the WebGPU texture). Coarser
		// than exact sizing on purpose (hysteresis), far tighter than the
		// old power-of-two rounding (waste is bounded at 31px per axis
		// instead of up to 2× each).
		// The canvas is the layout box PLUS whatever the ink escapes it by. The
		// padding never reaches `metrics`, so the reported bounds are unmoved —
		// see `TextMetrics#inkPadTop`.
		const width = Math.ceil(this.metrics.width / 32) * 32;
		const height =
			Math.ceil(
				(this.metrics.height +
					this.metrics.inkPadTop +
					this.metrics.inkPadBottom) /
					32,
			) * 32;

		// invalidate the texture
		const renderer = this.parentApp?.renderer ?? game.renderer;
		this.canvasTexture.invalidate(renderer);

		// resize the cache canvas if necessary
		if (
			this.canvasTexture.width < width ||
			this.canvasTexture.height < height
		) {
			this.canvasTexture.resize(width, height);
		}

		this.canvasTexture.clear();
		this._drawFont(
			this.canvasTexture.context,
			this._text,
			this.pos.x - this.metrics.x,
			this.pos.y - this.metrics.y + this.metrics.inkPadTop,
		);

		this.isDirty = true;

		return this;
	}

	/**
	 * the number of characters to display (use -1 to show all).
	 * Useful for typewriter effects combined with Tween.
	 * @public
	 * @type {number}
	 * @default -1
	 * @see Text#visibleRatio
	 * @example
	 * // typewriter effect
	 * text.visibleCharacters = 0;
	 * new Tween(text).to({ visibleRatio: 1.0 }, { duration: 2000 }).start();
	 */
	get visibleCharacters() {
		return this._visibleCharacters;
	}

	set visibleCharacters(value) {
		if (this._visibleCharacters !== value) {
			this._visibleCharacters = value;
			this.isDirty = true;
		}
	}

	/**
	 * the ratio of visible characters (0.0 to 1.0).
	 * Setting this automatically updates {@link visibleCharacters}.
	 * @public
	 * @type {number}
	 */
	get visibleRatio() {
		if (this._visibleCharacters === -1) {
			return 1.0;
		}
		const total = this._text.reduce((sum, line) => {
			return sum + line.length;
		}, 0);
		return total > 0 ? this._visibleCharacters / total : 1.0;
	}

	set visibleRatio(value) {
		const clamped = Math.max(0, Math.min(1, isFinite(value) ? value : 1));
		if (clamped >= 1.0) {
			this.visibleCharacters = -1;
		} else {
			const total = this._text.reduce((sum, line) => {
				return sum + line.length;
			}, 0);
			this.visibleCharacters = Math.floor(clamped * total);
		}
	}

	/**
	 * update the bounding box for this Text, accounting for textAlign and textBaseline.
	 * @param {boolean} [absolute=true] - update in absolute coordinates
	 * @returns {Bounds} this renderable's bounding box
	 */
	updateBounds(absolute = true) {
		if (typeof this.metrics !== "undefined" && this._text.length > 0) {
			const bounds = this.getBounds();
			bounds.clear();

			const w = this.metrics.width;
			const h = this.metrics.height;

			// compute x offset based on textAlign
			let ax = 0;
			switch (this.textAlign) {
				case "right":
					ax = w;
					break;
				case "center":
					ax = w / 2;
					break;
			}

			// compute y offset based on textBaseline
			let ay = 0;
			switch (this.textBaseline) {
				case "middle":
					ay = h / 2;
					break;
				case "ideographic":
				case "alphabetic":
				case "bottom":
					ay = h;
					break;
			}

			bounds.addFrame(-ax, -ay, w - ax, h - ay);

			if (absolute === true) {
				const absPos = this.getAbsolutePosition();
				bounds.centerOn(
					absPos.x + bounds.x + bounds.width / 2,
					absPos.y + bounds.y + bounds.height / 2,
				);
			}
			return bounds;
		}
		return super.updateBounds(absolute);
	}

	/**
	 * measure the given text size in pixels
	 * @param {string} [text] - the text to be measured
	 * @returns {TextMetrics} a TextMetrics object defining the dimensions of the given piece of text
	 */
	measureText(text = this._text) {
		return this.metrics.measureText(text, this.canvasTexture.context);
	}

	/**
	 * draw a text at the specified coord
	 * @param {CanvasRenderer|WebGLRenderer} renderer - Reference to the destination renderer instance
	 */
	draw(renderer) {
		// re-render the canvas texture when dirty (e.g. visibleCharacters changed)
		if (this.isDirty) {
			this.canvasTexture.invalidate(renderer);
			this.canvasTexture.clear();
			this._drawFont(
				this.canvasTexture.context,
				this._text,
				this.pos.x - this.metrics.x,
				this.pos.y - this.metrics.y + this.metrics.inkPadTop,
			);
		}

		// adjust x,y position based on the bounding box. The blit rises by the
		// same padding the glyphs were drawn down by, so they land in exactly
		// the pixels they always did and only the clipped ink is recovered.
		let x = this.metrics.x;
		let y = this.metrics.y - this.metrics.inkPadTop;

		// clamp to pixel grid if required
		if (renderer.settings.subPixel === false) {
			x = ~~x;
			y = ~~y;
		}

		// draw the text
		renderer.drawImage(this.canvasTexture.canvas, x, y);
	}

	/**
	 * @ignore
	 * @internal
	 */
	_drawFont(context, text, x, y) {
		setContextStyle(context, this);

		let remaining = this.visibleCharacters;

		// A gradient is re-anchored to EACH LINE, so every line of a multi-line
		// label carries the same ramp — what you would get from one `Text` per
		// line, which is how a HUD is usually built.
		//
		// The canvas would otherwise spread one ramp across the whole block:
		// a `CanvasGradient` lives in the current transform's space, so lines
		// drawn further down sample further along it, and every line after the
		// first comes out flat unless the caller happens to have authored the
		// ramp over the exact block height. That is silent and easy to get
		// wrong. Translating per line instead keeps the gradient with the text.
		//
		// The trade is that a ramp spanning a whole two-line title is no longer
		// expressible; compose that from one `Text` per line.
		const perLine =
			this.gradientPerLine === true &&
			this.fillGradient !== undefined &&
			text.length > 1;
		const firstY = y;

		for (let i = 0; i < text.length; i++) {
			let string = text[i].trimEnd();

			// limit visible characters if needed
			if (remaining !== -1) {
				if (remaining <= 0) {
					break;
				}
				string = string.substring(0, remaining);
				remaining -= string.length;
			}

			// Shift the whole space down to this line rather than the draw
			// position, so the gradient travels with it and each line is
			// painted from the ramp's start.
			if (perLine) {
				context.save();
				context.translate(0, y - firstY);
			}
			const lineY = perLine ? firstY : y;

			// draw the string
			if (this.fillStyle.alpha > 0) {
				context.fillText(string, x, lineY);
			}
			// stroke the text
			if (this.lineWidth > 0 && this.strokeStyle.alpha > 0) {
				context.strokeText(string, x, lineY);
			}

			if (perLine) {
				context.restore();
			}
			// add leading space
			y += this.metrics.lineHeight();
		}
		return this.metrics;
	}

	/**
	 * Destroy function
	 * @ignore
	 * @internal
	 */
	destroy() {
		const renderer = this.parentApp?.renderer ?? game.renderer;
		this.canvasTexture.destroy(renderer);
		this.canvasTexture = undefined;
		this.fillGradient = undefined;
		colorPool.release(this.fillStyle);
		colorPool.release(this.strokeStyle);
		this.fillStyle = this.strokeStyle = undefined;
		this.metrics = undefined;
		this._text.length = 0;
		super.destroy();
	}
}
