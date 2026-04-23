import { game } from "../../application/application.ts";
import { Color, colorPool } from "../../math/color.ts";
import { nextPowerOfTwo } from "../../math/math.ts";
import CanvasRenderTarget from "../../video/rendertarget/canvasrendertarget.js";
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

/**
 * a generic system font object.
 * @category Text
 */
export default class Text extends Renderable {
	/**
	 * @param {number} x - position of the text object
	 * @param {number} y - position of the text object
	 * @param {object} settings - the text configuration
	 * @param {string} settings.font - a CSS family font name
	 * @param {number|string} settings.size - size, or size + suffix (px, em, pt)
	 * @param {Color|string} [settings.fillStyle="#000000"] - a CSS color value
	 * @param {Color|string} [settings.strokeStyle="#000000"] - a CSS color value
	 * @param {number} [settings.lineWidth=0] - line width, in pixels, when drawing stroke
	 * @param {string} [settings.textAlign="left"] - horizontal text alignment
	 * @param {string} [settings.textBaseline="top"] - the text baseline
	 * @param {number} [settings.lineHeight=1.0] - line spacing height
	 * @param {Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] - anchor point to draw the text at
	 * @param {number} [settings.wordWrapWidth] - the maximum length in CSS pixel for a single segment of text
	 * @param {(string|string[])} [settings.text=""] - a string, or an array of strings
	 * @example
	 * let font = new Text(0, 0, {font: "Arial", size: 8, fillStyle: this.color});
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
		 */
		this._text = [];

		// initialize the object based on the given settings
		this.onResetEvent(x, y, settings);
	}

	/** @ignore */
	onResetEvent(x, y, settings) {
		if (typeof this.fillStyle === "undefined") {
			this.fillStyle = colorPool.get(0, 0, 0);
		}

		if (typeof this.strokeStyle === "undefined") {
			this.strokeStyle = colorPool.get(0, 0, 0);
		}

		if (typeof settings.fillStyle !== "undefined") {
			if (settings.fillStyle instanceof Color) {
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

		this.lineWidth = settings.lineWidth || 0;
		this.textAlign = settings.textAlign || "left";
		this.textBaseline = settings.textBaseline || "top";
		this.lineHeight = settings.lineHeight || 1.0;
		this.wordWrapWidth = settings.wordWrapWidth || -1;
		this.fontSize = 10;

		// anchor point
		if (typeof settings.anchorPoint !== "undefined") {
			this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
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
		this.visibleCharacters = -1;

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
			return !/(^".*"$)|(^'.*'$)/.test(value) ? '"' + value + '"' : value;
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
				this._text = value;
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

		// round the offscreen canvas size to the next power of two
		// (required for WebGL1, harmless for WebGL2/Canvas)
		const width = nextPowerOfTwo(this.metrics.width);
		const height = nextPowerOfTwo(this.metrics.height);

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
			this.pos.y - this.metrics.y,
		);

		this.isDirty = true;

		return this;
	}

	/**
	 * the ratio of visible characters (0.0 to 1.0).
	 * Setting this automatically updates {@link visibleCharacters}.
	 * @public
	 * @type {number}
	 */
	get visibleRatio() {
		if (this.visibleCharacters === -1) {
			return 1.0;
		}
		const total = this._text.reduce((sum, line) => {
			return sum + line.length;
		}, 0);
		return total > 0 ? this.visibleCharacters / total : 1.0;
	}

	set visibleRatio(value) {
		if (value >= 1.0) {
			this.visibleCharacters = -1;
		} else {
			const total = this._text.reduce((sum, line) => {
				return sum + line.length;
			}, 0);
			this.visibleCharacters = Math.floor(value * total);
		}
		this.isDirty = true;
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
		// re-render the canvas texture when visibleCharacters changes
		if (this.isDirty && this.visibleCharacters !== -1) {
			this.canvasTexture.invalidate(renderer);
			this.canvasTexture.clear();
			this._drawFont(
				this.canvasTexture.context,
				this._text,
				this.pos.x - this.metrics.x,
				this.pos.y - this.metrics.y,
			);
		}

		// adjust x,y position based on the bounding box
		let x = this.metrics.x;
		let y = this.metrics.y;

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
	 */
	_drawFont(context, text, x, y) {
		setContextStyle(context, this);

		let remaining = this.visibleCharacters;

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

			// draw the string
			if (this.fillStyle.alpha > 0) {
				context.fillText(string, x, y);
			}
			// stroke the text
			if (this.lineWidth > 0 && this.strokeStyle.alpha > 0) {
				context.strokeText(string, x, y);
			}
			// add leading space
			y += this.metrics.lineHeight();
		}
		return this.metrics;
	}

	/**
	 * Destroy function
	 * @ignore
	 */
	destroy() {
		const renderer = this.parentApp?.renderer ?? game.renderer;
		this.canvasTexture.destroy(renderer);
		this.canvasTexture = undefined;
		colorPool.release(this.fillStyle);
		colorPool.release(this.strokeStyle);
		this.fillStyle = this.strokeStyle = undefined;
		this.metrics = undefined;
		this._text.length = 0;
		super.destroy();
	}
}
