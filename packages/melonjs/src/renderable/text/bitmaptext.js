import { getBinary, getImage } from "../../loader/loader.js";
import { Color } from "../../math/color.ts";
import { vector2dPool } from "../../math/vector2d.ts";
import { resolveAnchorPoint } from "../anchorPoint.ts";
import Renderable from "../renderable.js";
import { bitmapTextDataPool } from "./bitmaptextdata.ts";
import TextMetrics from "./textmetrics.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../../video/canvas/canvas_renderer.js";
 * @import {Vector2d} from "../../math/vector2d.ts";
 * @import WebGLRenderer from "../../video/webgl/webgl_renderer.js";
 * @import {Bounds} from "../../physics/bounds.ts";
 * @import Renderer from "../../video/renderer.js";
 * @import {GlyphEffect, GlyphEffectContext, GlyphEffectOutput} from "./glypheffect.ts";
 */
/**
 * a bitmap font object.
 *
 * The font descriptor uses the AngelCode BMFont format and may be supplied in
 * either flavour — the **text** (`.fnt`) or the **XML** form — the
 * serialisation is auto-detected, so packs that ship an `.xml` descriptor load
 * as-is, with no conversion step. Load the descriptor as a `binary` asset and
 * its page image as an `image` asset, then reference both by the same name.
 * @category Text
 */
export default class BitmapText extends Renderable {
	/**
	 * @param {number} x - position of the text object
	 * @param {number} y - position of the text object
	 * @param {object} settings - the text configuration
	 * @param {string|Image} settings.font - a font name to identify the corresponding source image
	 * @param {string} [settings.fontData=settings.font] - the bitmap font data corresponding name, or the bitmap font data itself (AngelCode BMFont, `.fnt` text or `.xml`)
	 * @param {number} [settings.size=1.0] - a scaling RATIO applied to the font's authored size, not a pixel size: `2` draws it at double. ({@link Text} takes pixels here; this one does not.)
	 * @param {Color|string} [settings.fillStyle] - a CSS color value used to tint the glyphs, see {@link Renderable#tint}
	 * @param {string} [settings.textAlign="left"] - horizontal text alignment
	 * @param {string} [settings.textBaseline="top"] - the text baseline
	 * @param {number} [settings.lineHeight=1.0] - line spacing height
	 * @param {string|Vector2d|{x:number,y:number}} [settings.anchorPoint={x:0.0, y:0.0}] - anchor point to draw the text at. Also accepts the named presets `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`.
	 * @param {number} [settings.wordWrapWidth] - the maximum length in CSS pixel for a single segment of text
	 * @param {GlyphEffect|null} [settings.glyphEffect=null] - a per-glyph offset and tint callback
	 * @param {(string|string[])} [settings.text] - a string, or an array of strings
	 * @example
	 * // Load the BMFont descriptor as a "binary" asset and its page as an "image".
	 * // Both the text (.fnt) and XML (.xml) BMFont flavours are accepted and
	 * // auto-detected, so an .xml descriptor can be used directly:
	 * loader.preload([
	 *     // text (.fnt) BMFont
	 *     { name: "arial", type: "binary", src: "data/font/arial.fnt" },
	 *     { name: "arial", type: "image",  src: "data/font/arial.png" },
	 *     // XML BMFont (exported by many bitmap-font tools) — loaded as-is
	 *     { name: "pixel", type: "binary", src: "data/font/pixel.xml" },
	 *     { name: "pixel", type: "image",  src: "data/font/pixel.png" },
	 * ])
	 * // Then create an instance of your bitmap font:
	 * let myFont = new BitmapText(x, y, { font: "arial", text: "Hello" });
	 * // add it to the world container
	 * app.world.addChild(myFont);
	 */
	constructor(x, y, settings) {
		// call the parent constructor
		super(x, y, settings.width || 0, settings.height || 0);

		/**
		 * Set the default text alignment (or justification),<br>
		 * possible values are "left", "right", and "center".
		 * @public
		 * @type {string}
		 * @default "left"
		 */
		this.textAlign = settings.textAlign || "left";

		/**
		 * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
		 * possible values are "top", "hanging", "middle", "alphabetic", "ideographic", "bottom"<br>
		 * @public
		 * @type {string}
		 * @default "top"
		 */
		this.textBaseline = settings.textBaseline || "top";

		/**
		 * Set the line spacing height (when displaying multi-line strings). <br>
		 * Current font height will be multiplied with this value to set the line height.
		 * @public
		 * @type {number}
		 * @default 1.0
		 */
		this.lineHeight = settings.lineHeight || 1.0;

		/**
		 * the maximum length in CSS pixel for a single segment of text.
		 * (use -1 to disable word wrapping)
		 * @public
		 * @type {number}
		 * @default -1
		 */
		this.wordWrapWidth = settings.wordWrapWidth || -1;

		/**
		 * the text to be displayed
		 * @private
		 * @ignore
		 * @internal
		 */
		this._text = [];

		/**
		 * scaled font size
		 * @private
		 */
		this.fontScale = vector2dPool.get(1.0, 1.0);

		/**
		 * font image
		 * @private
		 */
		this.fontImage =
			typeof settings.font === "object"
				? settings.font
				: getImage(settings.font);

		if (typeof settings.fontData !== "string") {
			/**
			 * font data
			 * @private
			 */
			// use settings.font to retrieve the data from the loader
			this.fontData = bitmapTextDataPool.get(getBinary(settings.font));
		} else {
			this.fontData = bitmapTextDataPool.get(
				// if starting/includes "info face" the whole data string was passed as parameter
				settings.fontData.includes("info face")
					? settings.fontData
					: getBinary(settings.fontData),
			);
		}

		// if floating was specified through settings
		if (typeof settings.floating !== "undefined") {
			this.floating = !!settings.floating;
		}

		// apply given fillstyle
		if (typeof settings.fillStyle !== "undefined") {
			this.fillStyle = settings.fillStyle;
		}

		// update anchorPoint if provided
		if (typeof settings.anchorPoint !== "undefined") {
			const anchor = resolveAnchorPoint(settings.anchorPoint, "BitmapText", {
				x: 0,
				y: 0,
			});
			this.anchorPoint.set(anchor.x, anchor.y);
		} else {
			this.anchorPoint.set(0, 0);
		}

		/**
		 * @ignore
		 * @internal
		 */
		this._visibleCharacters = -1;

		// instance to text metrics functions
		this.metrics = new TextMetrics(this);

		// resize if necessary
		if (typeof settings.size === "number" && settings.size !== 1.0) {
			this.resize(settings.size);
		}

		/** @private @type {GlyphEffect|null} */
		this._glyphEffect = null;
		/** @private */
		this._glyphEffectTime = 0;
		/**
		 * Lazily allocated; plain bitmap text needs no effect scratch objects.
		 * @private
		 * @type {{out: GlyphEffectOutput, context: GlyphEffectContext, tint: Color}|undefined}
		 */
		this._glyphEffectState = undefined;

		// set the text
		this.setText(settings.text);
		this.glyphEffect = settings.glyphEffect;
	}

	/**
	 * change the font settings
	 * @param {string} textAlign - ("left", "center", "right")
	 * @param {number} [scale] - a scaling ratio, applied through {@link BitmapText#resize} when given
	 * @returns {BitmapText} this object for chaining
	 */
	set(textAlign, scale) {
		this.textAlign = textAlign;
		// updated scaled Size
		if (scale) {
			this.resize(scale);
		}
		this.isDirty = true;

		return this;
	}

	/**
	 * change the text to be displayed
	 * @param {number|string|string[]} value - a string, or an array of strings
	 * @returns {BitmapText} this object for chaining
	 */
	setText(value = "") {
		if (this._text.toString() !== value.toString()) {
			if (!Array.isArray(value)) {
				this._text = ("" + value).split("\n");
			} else {
				// copy — storing the caller's array by reference would let
				// destroy() (`_text.length = 0`) wipe it, and external
				// mutation would change the rendered text without isDirty
				this._text = value.slice();
			}
			this.isDirty = true;
		}

		if (this._text.length > 0 && this.wordWrapWidth > 0) {
			this._text = this.metrics.wordWrap(this._text, this.wordWrapWidth);
		}

		// measure text dimensions (cached for updateBounds)
		this.metrics.measureText(this._text);
		this.updateBounds();

		return this;
	}

	/**
	 * A per-glyph offset and multiplicative tint callback, or `null` to disable.
	 * The output and context are reused: do not retain them. Offsets start at
	 * zero and tint at opaque white on each call. Time advances through update,
	 * so drawing through multiple cameras does not advance the animation.
	 * Effects change drawing only: metrics, wrapping and bounds stay unchanged.
	 * Keep the measured text in view: effects do not extend the culling bounds.
	 * WebGL and WebGPU retain batching: the tint rides the per-vertex colour,
	 * so a whole animated line is still one draw call. Canvas realizes each
	 * DISTINCT tint as a cached, tinted copy of the entire font page, and that
	 * cache is unbounded for the life of the renderer, so a colour driven by
	 * `ctx.time` costs a font-page canvas per frame there. On Canvas, keep the
	 * palette finite or vary only the offsets.
	 *
	 * While an effect is set the renderable reports itself as changed every
	 * frame, since whether the callback reads `ctx.time` cannot be known.
	 * @type {GlyphEffect|null}
	 * @example
	 * text.glyphEffect = (out, ctx) => {
	 *     out.offsetY = Math.sin(ctx.time * 0.008 + ctx.index * 0.6) * 6;
	 *     out.tint.setColor(255, 128, 128);
	 * };
	 */
	get glyphEffect() {
		return this._glyphEffect;
	}

	set glyphEffect(effect) {
		// Normalized, as the constructor's `settings.glyphEffect || null`
		// already was. `undefined` is how an unset option arrives and how a
		// caller spells "turn it off", and storing it left the draw path's
		// `!== null` test true with nothing callable behind it: a
		// `TypeError: effect is not a function` out of `draw()`, i.e. from
		// inside the frame loop.
		const next = effect || null;
		if (this._glyphEffect !== next) {
			this._glyphEffect = next;
			if (next !== null) {
				this._glyphEffectState ??= {
					out: { offsetX: 0, offsetY: 0, tint: new Color(255, 255, 255) },
					context: { index: 0, char: "", code: 0, time: 0, x: 0, y: 0 },
					tint: new Color(255, 255, 255),
				};
			}
			this.isDirty = true;
		}
	}

	/** @inheritdoc */
	update(dt) {
		if (this._glyphEffect !== null) {
			this._glyphEffectTime += dt;
			return true;
		}
		return super.update(dt);
	}

	/**
	 * the number of characters to display (use -1 to show all).
	 * Useful for typewriter effects combined with Tween.
	 * @public
	 * @type {number}
	 * @default -1
	 * @see BitmapText#visibleRatio
	 * @example
	 * // show only the first 5 characters
	 * bitmapText.visibleCharacters = 5;
	 * // typewriter effect
	 * bitmapText.visibleCharacters = 0;
	 * new Tween(bitmapText).to({ visibleRatio: 1.0 }, { duration: 2000 }).start();
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
	 * update the bounding box for this Bitmap Text.
	 * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
	 * @returns {Bounds} this Bitmap Text bounding box Rectangle object
	 */
	updateBounds(absolute = true) {
		const bounds = this.getBounds();

		bounds.clear();

		if (typeof this.metrics !== "undefined") {
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

			// baseline shift based on total text height (matching draw code)
			const gy = this.metrics.glyphYOffset || 0;
			let ay = 0;
			switch (this.textBaseline) {
				case "middle":
					ay = gy + h * 0.5;
					break;
				case "ideographic":
				case "alphabetic":
				case "bottom":
					ay = gy + h;
					break;
			}

			bounds.addFrame(-ax, -ay + gy, w - ax, -ay + gy + h);
		}

		if (absolute === true) {
			const absPos = this.getAbsolutePosition();
			bounds.centerOn(
				absPos.x + bounds.x + bounds.width / 2,
				absPos.y + bounds.y + bounds.height / 2,
			);
		}

		return bounds;
	}

	/**
	 * defines the color used to tint the bitmap text.
	 *
	 * This is {@link Renderable#tint} under another name, so the same rule
	 * applies: white — `(255, 255, 255)` — is the absence of a tint, and any
	 * other colour tints away from there. A page image authored in white
	 * therefore keeps every colour available to it.
	 * @public
	 * @type {Color}
	 * @see Renderable#tint
	 * @example
	 * // tint at construction...
	 * const score = new BitmapText(8, 8, {
	 *     font: "arial",
	 *     text: "1000",
	 *     fillStyle: "#ffd700",        // gold
	 * });
	 * app.world.addChild(score);
	 *
	 * // ...or at any point after it, from a CSS string or a Color
	 * score.fillStyle = "#ff4040";                  // flash red on damage
	 * score.fillStyle = new Color(255, 255, 255);   // back to untinted
	 */
	get fillStyle() {
		return this.tint;
	}
	set fillStyle(value) {
		if (value instanceof Color) {
			this.tint.copy(value);
		} else {
			// string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
			this.tint.parseCSS(value);
		}
	}

	/**
	 * change the font display size
	 * @param {number} scale - a ratio against the font's authored size, NOT a
	 * pixel size: `1` is the page image at its native scale, `2` is double
	 * @returns {this} this object for chaining
	 * @example
	 * // a bitmap font is pixel art — whole-number ratios stay crisp, and
	 * // fractional ones resample the page image
	 * title.resize(3);                 // three times its authored size
	 * title.set("center", 2);          // align and rescale in one call
	 */
	resize(scale) {
		this.fontScale.set(scale, scale);

		// remeasure with new scale (cached for updateBounds)
		this.metrics.measureText(this._text);
		this.updateBounds();

		this.isDirty = true;

		return this;
	}

	/**
	 * measure the given text size in pixels
	 * @param {string} [text]
	 * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
	 * @example
	 * // size a panel around a label, at the label's CURRENT scale
	 * const size = label.measureText();
	 * panel.resize(size.width + 16, size.height + 16);
	 */
	measureText(text = this._text) {
		return this.metrics.measureText(text);
	}

	/**
	 * draw the bitmap font
	 * @param {Renderer} renderer - Reference to the destination renderer instance
	 */
	draw(renderer) {
		let x = this.pos.x;
		let y = this.pos.y;

		const lX = x;
		const stringHeight = this.metrics.lineHeight();
		const gy = this.metrics.glyphYOffset || 0;
		const h = this.metrics.height;

		// apply baseline shift once for the entire text block
		switch (this.textBaseline) {
			case "middle":
				y -= gy + h * 0.5;
				break;

			case "ideographic":
			case "alphabetic":
			case "bottom":
				y -= gy + h;
				break;

			default:
				break;
		}

		// running character counter for visibleCharacters
		let charCount = 0;
		const maxChars = this.visibleCharacters;

		for (let i = 0; i < this._text.length; i++) {
			x = lX;
			const string = this._text[i].trimEnd();
			// adjust x pos based on alignment value
			const stringWidth = this.metrics.lineWidth(string);
			switch (this.textAlign) {
				case "right":
					x -= stringWidth;
					break;

				case "center":
					x -= stringWidth * 0.5;
					break;

				default:
					break;
			}

			// draw the string
			let lastGlyph = null;
			for (let c = 0, len = string.length; c < len; c++) {
				// stop drawing when visibleCharacters limit is reached
				if (maxChars !== -1 && charCount >= maxChars) {
					return;
				}

				// calculate the char index
				const ch = string.charCodeAt(c);
				const glyph = this.fontData.glyphs[ch];

				if (typeof glyph !== "undefined") {
					const glyphWidth = glyph.width;
					const glyphHeight = glyph.height;
					const kerning =
						lastGlyph && lastGlyph.kerning ? lastGlyph.getKerning(ch) : 0;
					const scaleX = this.fontScale.x;
					const scaleY = this.fontScale.y;

					// draw it
					if (this._glyphEffect !== null) {
						this._drawGlyphEffect(
							renderer,
							glyph,
							charCount,
							ch,
							string.charAt(c),
							x + glyph.xoffset * scaleX,
							y + glyph.yoffset * scaleY,
						);
					} else if (glyphWidth !== 0 && glyphHeight !== 0) {
						// some browser throw an exception when drawing a 0 width or height image
						renderer.drawImage(
							this.fontImage,
							glyph.x,
							glyph.y,
							glyphWidth,
							glyphHeight,
							x + glyph.xoffset * scaleX,
							y + glyph.yoffset * scaleY,
							glyphWidth * scaleX,
							glyphHeight * scaleY,
						);
					}

					// increment position
					x += (glyph.xadvance + kerning) * scaleX;
					lastGlyph = glyph;
				} else {
					console.warn(
						"BitmapText: no defined Glyph in for " + String.fromCharCode(ch),
					);
				}

				charCount++;
			}
			// increment line
			y += stringHeight;
		}
	}

	/**
	 * Draw a glyph without changing the pen advance or renderer state.
	 * @private
	 * @param {Renderer} renderer
	 * @param {import("./glyph.ts").default} glyph
	 * @param {number} index
	 * @param {number} code
	 * @param {string} char
	 * @param {number} x
	 * @param {number} y
	 */
	_drawGlyphEffect(renderer, glyph, index, code, char, x, y) {
		const { out, context, tint } = this._glyphEffectState;
		out.offsetX = out.offsetY = 0;
		out.tint.setFloat(1, 1, 1, 1);
		context.index = index;
		context.char = char;
		context.code = code;
		context.time = this._glyphEffectTime;
		context.x = x;
		context.y = y;
		tint.copy(renderer.currentTint);
		const alpha = renderer.getGlobalAlpha();
		try {
			const effect = this._glyphEffect;
			effect(out, context);
			const base = tint.toArray();
			const color = out.tint.toArray();
			renderer.currentTint.setFloat(
				base[0] * color[0],
				base[1] * color[1],
				base[2] * color[2],
				base[3],
			);
			// Global alpha is shared by Canvas and both GPU backends.
			renderer.setGlobalAlpha(alpha * color[3]);
			if (glyph.width !== 0 && glyph.height !== 0) {
				renderer.drawImage(
					this.fontImage,
					glyph.x,
					glyph.y,
					glyph.width,
					glyph.height,
					x + out.offsetX,
					y + out.offsetY,
					glyph.width * this.fontScale.x,
					glyph.height * this.fontScale.y,
				);
			}
		} finally {
			renderer.currentTint.copy(tint);
			renderer.setGlobalAlpha(alpha);
		}
	}

	/**
	 * Destroy function
	 * @ignore
	 * @internal
	 */
	destroy() {
		this._glyphEffect = null;
		this._glyphEffectState = undefined;
		vector2dPool.release(this.fontScale);
		this.fontScale = undefined;
		bitmapTextDataPool.release(this.fontData);
		this.fontData = undefined;
		this._text.length = 0;
		this.metrics = undefined;
		super.destroy();
	}
}
