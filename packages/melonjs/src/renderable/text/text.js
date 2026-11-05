import { game } from "../../application/application.ts";
import { Color, colorPool } from "../../math/color.ts";
import { createPool, registerPool } from "../../system/pool.ts";
import { Gradient } from "../../video/gradient.js";

import CanvasRenderTarget from "../../video/rendertarget/canvasrendertarget.js";
import { resolveAnchorPoint } from "../anchorPoint.ts";
import Renderable, { resetRenderableState } from "../renderable.js";
import TextMetrics from "./textmetrics.js";
import setContextStyle from "./textstyle.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../../video/canvas/canvas_renderer.js";
 * @import {Vector2d} from "../../math/vector2d.ts";
 * @import WebGLRenderer from "../../video/webgl/webgl_renderer.js";
 * @import {Bounds} from "../../physics/bounds.ts";
 * @import Renderer from "../../video/renderer.js";
 */
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
 * while staying fully styleable — `fillStyle`, `strokeStyle` + `lineWidth`
 * (with the outline behind or over the glyphs by `paintOrder`, and its corners
 * set by `lineJoin` / `miterLimit`), and
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
	 * @param {"round"|"bevel"|"miter"} [settings.lineJoin="round"] - the shape of the outline's corners: "round", "bevel" or "miter" (pointed, as a plain canvas draws them)
	 * @param {number} [settings.miterLimit=10] - with a "miter" join, how far a corner may point, in half line widths, before it is cut flat
	 * @param {"stroke"|"fill"} [settings.paintOrder="stroke"] - what is painted first: "stroke" puts the outline behind the glyphs, so it shows only around them; "fill" puts it over them, where its inner half covers the glyph
	 * @param {string} [settings.textAlign="left"] - horizontal text alignment ("left", "center", "right")
	 * @param {string} [settings.textBaseline="top"] - the text baseline ("top", "hanging", "middle", "alphabetic", "ideographic", "bottom")
	 * @param {number} [settings.lineHeight=1.0] - line spacing height
	 * @param {string|Vector2d|{x:number,y:number}} [settings.anchorPoint={x:0.0, y:0.0}] - anchor point to draw the text at. Also accepts the named presets `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`.
	 * @param {number} [settings.wordWrapWidth] - the maximum length in CSS pixels of a line before it wraps
	 * @param {boolean} [settings.bold=false] - render the face bold, as {@link Text#bold} does
	 * @param {boolean} [settings.italic=false] - render the face italic, as {@link Text#italic} does
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
	 * // a gradient fill: `fillStyle` takes a Gradient as well as a colour.
	 * // Its coordinates are the label's OWN bake, so (0, 0) is the top-left of
	 * // the render box and the ramp below runs down exactly one line.
	 * const ramp = app.renderer.createLinearGradient(0, 0, 0, 32);
	 * ramp.addColorStop(0, "#fffdf0");
	 * ramp.addColorStop(1, "#ffa71d");
	 *
	 * app.world.addChild(new Text(8, 8, {
	 *     font: "sans-serif",
	 *     size: 32,
	 *     fillStyle: ramp,             // ramps the glyphs...
	 *     strokeStyle: "#000000",      // ...while the outline keeps its own colour
	 *     lineWidth: 1,
	 *     text: "GAME\nOVER",          // every line restarts the ramp by default
	 *     // gradientPerLine: false,   // ...or span ONE ramp across both lines
	 * }));
	 * @example
	 * // outlined text and its corners: the outline is centred on the glyph
	 * // edge and drawn behind it (see `paintOrder`), and its corners are set
	 * // by `lineJoin`
	 * const outline = {
	 *     font: "sans-serif",
	 *     size: 48,
	 *     fillStyle: "#ffffff",
	 *     strokeStyle: "#1d3557",
	 *     lineWidth: 6,
	 * };
	 *
	 * // "round" (the default): the outline is the same width all around
	 * app.world.addChild(new Text(10, 10, { ...outline, text: "ROUND" }));
	 *
	 * // "bevel": corners cut flat
	 * app.world.addChild(new Text(10, 70, { ...outline, lineJoin: "bevel", text: "BEVEL" }));
	 *
	 * // "miter": pointed corners, as a plain canvas strokes text. At the
	 * // canvas's default limit of 10 a sharp glyph ("A", "V", "M") grows a
	 * // long spike...
	 * app.world.addChild(new Text(10, 130, { ...outline, lineJoin: "miter", text: "MITER" }));
	 *
	 * // ...which `miterLimit` caps: a corner that would point further than
	 * // this many half line widths is cut flat instead
	 * app.world.addChild(new Text(10, 190, { ...outline, lineJoin: "miter", miterLimit: 3, text: "MITER 3" }));
	 *
	 * // whichever is set, the whole outline is drawn: the label's texture
	 * // grows to hold it, while its position and bounds stay the same
	 * @example
	 * // the outline behind the glyphs, or over them, with `paintOrder`
	 * const label = {
	 *     font: "sans-serif",
	 *     size: 48,
	 *     fillStyle: "#ffd23f",
	 *     strokeStyle: "#1b1b1b",
	 *     lineWidth: 6,
	 * };
	 *
	 * // "stroke" (the default): the outline is painted first, behind the
	 * // glyphs, so they stay whole and it shows only around them
	 * app.world.addChild(new Text(10, 10, { ...label, text: "BEHIND" }));
	 *
	 * // "fill": the glyphs first and the outline over them, centred on their
	 * // edge, so its inner half covers them: a thick one hides them
	 * app.world.addChild(new Text(10, 70, { ...label, paintOrder: "fill", text: "OVER" }));
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
		 * The shape of the outline's corners, where the stroke turns on a
		 * glyph: "round", "bevel" (cut flat) or "miter" (pointed). The
		 * canvas's own default is "miter", which on a thick outline grows
		 * long spikes from sharp glyphs such as "A", "V" or "M"; "round"
		 * keeps the outline the same width all around, as most game text
		 * outlines are.
		 *
		 * The text is baked with room for whichever is set, so no corner is
		 * cut: "miter" takes more, up to {@link Text#miterLimit} half line
		 * widths around the text.
		 *
		 * Like the other style properties, a change shows from the next
		 * {@link Text#setText}.
		 * @type {"round"|"bevel"|"miter"}
		 * @default "round"
		 * @example
		 * // sharp, pointed corners, as a plain canvas strokes them
		 * const title = new Text(0, 0, {
		 *     font: "sans-serif",
		 *     size: 48,
		 *     fillStyle: "#ffffff",
		 *     strokeStyle: "#000000",
		 *     lineWidth: 6,
		 *     lineJoin: "miter",
		 *     miterLimit: 3,              // and no spike past 3 half widths
		 *     text: "VICTORY",
		 * });
		 */
		this.lineJoin = "round";

		/**
		 * With a "miter" {@link Text#lineJoin}: how far a corner of the
		 * outline may point, in half line widths, before it is cut flat
		 * instead. The canvas's default, 10, lets sharp glyphs grow long
		 * spikes; 2 to 4 keeps most corners pointed and the spikes short.
		 * Has no effect with "round" or "bevel" joins. A value the canvas
		 * would refuse (zero, negative, infinite or NaN) draws with 10.
		 *
		 * Like the other style properties, a change shows from the next
		 * {@link Text#setText}.
		 * @type {number}
		 * @default 10
		 * @example
		 * // pointed corners with short spikes
		 * label.lineJoin = "miter";
		 * label.miterLimit = 2;
		 * label.setText("VICTORY"); // re-bakes with the new corners
		 */
		this.miterLimit = 10;

		/**
		 * What is painted first, the outline ("stroke") or the glyphs
		 * ("fill"), as the CSS and SVG `paint-order` property says it.
		 *
		 * The outline is centred on the glyph's edge, so half of it lies
		 * inside the glyph. With "stroke", the default, the outline is
		 * painted first and the glyphs over it: they stay whole, and the
		 * outline shows only around them, at half its `lineWidth`. With
		 * "fill", the glyphs are painted first and the outline over them,
		 * as a plain canvas does with `fillText` then `strokeText`: its inner
		 * half covers the glyph, so a thick outline, or a thin face, hides
		 * the letters.
		 *
		 * Either way the outline reaches as far out, and the label's size and
		 * bounds are the same. Like the other style properties, a change
		 * shows from the next {@link Text#setText}.
		 * @type {"stroke"|"fill"}
		 * @default "stroke"
		 * @example
		 * // the outline over the glyphs, as melonJS drew it before 20.13
		 * const label = new Text(0, 0, {
		 *     font: "sans-serif",
		 *     size: 32,
		 *     fillStyle: "#ffffff",
		 *     strokeStyle: "#000000",
		 *     lineWidth: 2,
		 *     paintOrder: "fill",
		 *     text: "SCORE",
		 * });
		 */
		this.paintOrder = "stroke";

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
		 * A multi-line text is placed as one block: its top, middle or bottom is at
		 * `pos.y` ("alphabetic" and "ideographic" place it like "bottom").
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
		 * Each `\n`-separated line is wrapped on its own, so explicit line breaks
		 * are kept; a word wider than this gets a line of its own.
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
		// Everything inherited from `Renderable` first, before the settings
		// below write over whatever they name. A pooled label handed back
		// still carries the previous one's alpha, tint, blend mode and
		// transform, and the settings do not mention any of them.
		if (typeof this.currentTransform !== "undefined") {
			resetRenderableState(this);
			// And the position its own two arguments name. They were accepted
			// and then written nowhere, so a label from `getPool("text")`
			// came back sitting wherever the PREVIOUS one was left: a damage
			// number asked for at the kill appeared at the last one's resting
			// place and flew from there. `ColorLayer#onResetEvent` honours its
			// `z` argument for the same reason.
			//
			// Guarded with the reset above rather than written unconditionally
			// because the constructor has already placed the renderable by the
			// time it calls this, and only a recycle needs moving.
			//
			// `z` goes to 0 with them: a freshly constructed `Renderable`
			// starts there, so a recycled one has to, and `get()` has no third
			// argument to say otherwise. `addChild(child, z)` is what a caller
			// that wants another one uses.
			this.pos.set(x, y, 0);
		}

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
		} else {
			// back to black. Without this a RECYCLED label keeps the previous
			// one's colour, because the pool hands the same instance back and
			// only the settings that were given are written.
			this.fillStyle.setColor(0, 0, 0, 1);
		}

		if (typeof settings.strokeStyle !== "undefined") {
			if (settings.strokeStyle instanceof Color) {
				this.strokeStyle.copy(settings.strokeStyle);
			} else {
				// string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
				this.strokeStyle.parseCSS(settings.strokeStyle);
			}
		} else {
			// as above: a recycled label must not inherit an outline colour
			this.strokeStyle.setColor(0, 0, 0, 1);
		}

		if (typeof settings.gradientPerLine === "boolean") {
			this.gradientPerLine = settings.gradientPerLine;
		}

		this.lineWidth = settings.lineWidth || 0;
		// set every time, for a recycled label not to keep the last one's
		this.lineJoin = settings.lineJoin ?? "round";
		this.miterLimit = settings.miterLimit ?? 10;
		this.paintOrder = settings.paintOrder ?? "stroke";
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
		} else {
			// `Renderable`'s default, restated so a recycled label does not
			// stay pinned to the viewport because an earlier one was
			this.floating = false;
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
		//
		// Kept across a recycle, which is most of what makes a pooled label
		// worth pooling. A fresh one per reset also LEAKED the previous
		// canvas and its GL texture, since only `destroy()` frees those, so a
		// label reused often enough walked through a texture unit per reuse.
		if (typeof this.canvasTexture === "undefined") {
			this.canvasTexture = new CanvasRenderTarget(2, 2, {
				offscreenCanvas: false,
			});
		}

		/**
		 * @ignore
		 * @internal
		 */
		this._visibleCharacters = -1;

		// instance to text metrics functions. Kept across a recycle too: it
		// closes over this label and is re-measured by `setText` below.
		if (typeof this.metrics === "undefined") {
			this.metrics = new TextMetrics(this);
		}

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

		// calculcate the text size, and the bounds from it the same way every
		// later recompute does — taking them straight from `metrics` here
		// gave a box in the parent's space, not the world's, that the next
		// `updateBounds()` replaced
		this.metrics.measureText(this._text, this.canvasTexture.context);
		this.updateBounds();

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
		// At least one bucket: a blank string measures 0 wide, and a canvas with
		// a zero side cannot be uploaded (WebGPU throws).
		const width =
			Math.max(
				1,
				Math.ceil(
					(this.metrics.width +
						this.metrics.inkPadLeft +
						this.metrics.inkPadRight) /
						32,
				),
			) * 32;
		const height =
			Math.max(
				1,
				Math.ceil(
					(this.metrics.height +
						this.metrics.inkPadTop +
						this.metrics.inkPadBottom) /
						32,
				),
			) * 32;

		const renderer = this.parentApp?.renderer ?? game.renderer;

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
			this.pos.y - this.metrics.y,
		);

		// Invalidate LAST, so the renderer re-uploads the canvas at the size
		// and with the content it ends up with. Invalidating first told the
		// renderer to refresh against the dimensions the canvas had BEFORE the
		// resize above — harmless on WebGL, which re-specifies texture storage
		// on every upload, but a WebGPU texture is immutable-sized, so the
		// refreshed copy kept the old height and the bottom of the label was
		// sampled from outside it. Visible as glyph tops shorn off on Safari.
		this.canvasTexture.invalidate(renderer);

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
	 * Setting this automatically updates {@link Text#visibleCharacters}.
	 *
	 * This is the one to tween: it is independent of how many characters the
	 * label holds, so a reveal takes the same time whatever the string is.
	 * @public
	 * @type {number}
	 * @default 1.0
	 * @see Text#visibleCharacters
	 * @example
	 * // reveal over two seconds, regardless of length
	 * label.visibleRatio = 0;
	 * new Tween(label).to({ visibleRatio: 1.0 }, { duration: 2000 }).start();
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
		if (typeof this.metrics !== "undefined") {
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

			// the baseline places the whole block (see `TextMetrics#blockShift`),
			// exactly as the draw does
			const ay = h * this.metrics.blockShift();

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
	 * @example
	 * // size a panel around a label
	 * const size = label.measureText();
	 * panel.resize(size.width + 16, size.height + 16);
	 *
	 * // or measure a string the label does not currently hold, to reserve
	 * // room for the widest state a counter will reach
	 * const widest = label.measureText("00:00").width;
	 */
	measureText(text = this._text) {
		return this.metrics.measureText(text, this.canvasTexture.context);
	}

	/**
	 * draw a text at the specified coord
	 * @param {Renderer} renderer - Reference to the destination renderer instance
	 */
	draw(renderer) {
		// Re-anchor the box to where the label is NOW.
		//
		// `metrics.x/y` is derived from `pos`, but the rest of `measureText` is
		// not, so it used to refresh only when the STRING changed. Move a label
		// without re-setting its text and the bake offset (`pos - metrics`) grew
		// by the whole distance moved while the canvas stayed the size it was —
		// the glyphs slid off their own canvas and were clipped, and the blit
		// still went to where the label used to be. Refreshing the origin is
		// cheap: it reads `pos` and the already-measured width, and measures no
		// glyphs.
		this.metrics.updateOrigin();

		// re-render the canvas texture when dirty (e.g. visibleCharacters changed)
		if (this.isDirty) {
			this.canvasTexture.clear();
			this._drawFont(
				this.canvasTexture.context,
				this._text,
				this.pos.x - this.metrics.x,
				this.pos.y - this.metrics.y,
			);
			// after the repaint, not before it — see `setText`
			this.canvasTexture.invalidate(renderer);
		}

		// adjust x,y position based on the bounding box. The blit moves back
		// by the same padding the glyphs were drawn in by, so they land in
		// exactly the pixels they always did and only the clipped ink is
		// recovered.
		const x = this.metrics.x - this.metrics.inkPadLeft;
		const y = this.metrics.y - this.metrics.inkPadTop;

		// draw the text (on whole pixels unless `subPixel` is set, where it
		// lands, as any image is)
		renderer.drawImage(this.canvasTexture.canvas, x, y);
	}

	/**
	 * @ignore
	 * @internal
	 */
	_drawFont(context, text, x, y) {
		// The bake canvas carries `inkPadTop` of headroom above the layout box,
		// and `inkPadLeft` of room to its left.
		// Translating INTO that headroom — rather than adding it to every draw
		// position — keeps bake space equal to METRICS space, which is the
		// space a caller authored their gradient coordinates in. Add the pad to
		// the positions instead and the glyphs slide down the ramp while the
		// ramp stays put, so the fill changes colour with the padding, and the
		// padding differs per browser. The translate is a whole number of
		// pixels, so glyph rasterization is untouched.
		context.save();
		context.translate(this.metrics.inkPadLeft, this.metrics.inkPadTop);

		const fill = setContextStyle(context, this);

		const fills = this.fillStyle.alpha > 0;
		const strokes = this.lineWidth > 0 && this.strokeStyle.alpha > 0;

		// A gradient fill is painted THROUGH the glyphs rather than handed to
		// `fillText`.
		//
		// WebKit rasterizes gradient-filled text by drawing the glyphs into a
		// mask it sizes from the FONT's layout box, then filling that mask —
		// so ink rising above the declared ascent, which display faces do
		// routinely, never enters the mask and comes out fully transparent.
		// The stroke is a flat colour and takes a different path, which leaves
		// an outlined but hollow glyph. Filling flat and re-colouring through
		// `source-in` puts the glyphs through the same rasterizer every browser
		// uses for ordinary text, so all of them agree.
		//
		// Measured on a plain canvas with no engine involved, 34px display
		// face: with a FLAT fill both engines paint 7px above the top alignment
		// point; with a GRADIENT, WebKit stops at 0 — precisely the ascent it
		// reports for the face. Everything above that is absent, not faint.
		// The mask path is `drawTextUnchecked` in WebCore's
		// `CanvasRenderingContext2DBase`, under `USE(CG)`.
		//
		// Done unconditionally, not behind a browser check: one rasterization
		// path is worth more than saving a `fillRect` on the engines that would
		// have been fine either way.
		//
		// The trade is that fill and stroke now interleave per BLOCK rather
		// than per line, observable only where lines overlap.
		//
		// DO NOT collapse this back into a single `fillText` with the gradient
		// as `fillStyle`. The second pass reads as a redundant `fillRect` and
		// is not one — it is the only reason the glyph tops survive on Safari.
		const masked = fills && this.fillGradient !== undefined;

		/**
		 * Walk the visible lines, handing each to `paint`.
		 * @param {(line: string, x: number, y: number) => void} paint - per line
		 */
		const eachLine = (paint) => {
			let remaining = this.visibleCharacters;
			// `y` is where `pos` lands, which the baseline puts somewhere on
			// the BLOCK (see `TextMetrics#updateOrigin`). Each line is handed
			// to the canvas at its own alignment point instead — the same
			// share of its own line box — so the first one starts that much
			// higher, and the block fills the box from its top.
			let lineY =
				y -
				(this.metrics.height - this.metrics.lineHeight()) *
					this.metrics.blockShift();

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

				paint(string, x, lineY);
				// add leading space
				lineY += this.metrics.lineHeight();
			}
		};

		if (fills) {
			if (masked === true) {
				// any opaque colour: only the alpha it leaves behind survives
				context.fillStyle = "#000000";
			}
			eachLine((line, lineX, lineY) => {
				context.fillText(line, lineX, lineY);
			});
		}

		if (masked === true) {
			// Re-colour the silhouette under the SAME transform the glyphs were
			// drawn with, so the gradient travels with them. The rect only has
			// to cover the canvas — a gradient's colours come from its own
			// coordinates, not from the rect it is painted into.
			const canvas = context.canvas;
			context.globalCompositeOperation = "source-in";
			context.fillStyle = fill;
			context.fillRect(
				-this.metrics.inkPadLeft - 1,
				-this.metrics.inkPadTop - 1,
				canvas.width + 2,
				canvas.height + 2,
			);
			// back before the stroke: the outline is a flat colour and must not
			// be masked by the fill it sits on
			context.globalCompositeOperation = "source-over";
		}

		if (strokes) {
			// "stroke" first: painted UNDER the glyphs already there rather
			// than before them, so it is never re-coloured by the gradient
			// pass above, and the result is what drawing it first gives
			if (this.paintOrder !== "fill") {
				context.globalCompositeOperation = "destination-over";
			}
			eachLine((line, lineX, lineY) => {
				context.strokeText(line, lineX, lineY);
			});
			context.globalCompositeOperation = "source-over";
		}

		context.restore();
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

/**
 * A pool of reusable {@link Text} instances.
 *
 * Text is worth recycling: each one owns a canvas-backed measurement cache and
 * a colour, so a scene that spawns damage numbers or score popups churns
 * meaningfully without one. Reachable as `getPool("text")`.
 *
 * `release` it yourself when the text is finished, as the particle and tween
 * pools require. A label this pool built is the exception: it carries the pool
 * it came from, so removing it from a container releases it back rather than
 * destroying it. Pass `keepalive` to `removeChild()` to keep holding one.
 * @example
 * const label = getPool("text").get(x, y, { font: "Arial", size: 12, text: "+10" });
 * // ... later
 * getPool("text").release(label);
 */
export const textPool = createPool((x, y, settings) => {
	const instance = new Text(x, y, settings);
	return {
		instance,
		reset(x, y, settings) {
			instance.onResetEvent(x, y, settings);
		},
	};
});

registerPool("text", textPool);
