import { Bounds } from "../../physics/bounds.ts";
import Text from "./text.js";
import setContextStyle from "./textstyle.js";

/**
 * One pixel of slack on top of the reported ink extent.
 *
 * `actualBoundingBox*` describes the OUTLINE, and the rasterizer paints past
 * it: antialiasing and pixel snapping both put ink outside what the metrics
 * promise. Measured against two engines, the painted ink reached a full pixel
 * beyond the reported bound — enough to shear the top row off a stroke. Over-
 * padding costs nothing but invisible canvas headroom.
 * @ignore
 * @internal
 */
const INK_SLACK = 1;

/**
 * The share of the em to pad by when the ink extent cannot be measured at all.
 * Covers the overshoot of the display faces measured here without depending on
 * a metric the browser may not report.
 * @ignore
 * @internal
 */
const INK_GUESS = 0.25;

/**
 * a Text Metrics object that contains helper for text manipulation
 */
class TextMetrics extends Bounds {
	/**
	 * @param {Text|BitmapText} ancestor - the parent object that contains this TextMetrics object
	 */
	constructor(ancestor) {
		// parent constructor
		super();

		/**
		 * a reference to the parent object that contains this TextMetrics object
		 * @type {Renderable}
		 * @default undefined
		 */
		this.ancestor = ancestor;

		this.setMinMax(0, 0, 0, 0);
	}

	/**
	 * Returns the height of a segment of inline text in CSS pixels.
	 * @returns {number} the height of a segment of inline text in CSS pixels.
	 */
	lineHeight() {
		if (this.ancestor instanceof Text) {
			return this.ancestor.fontSize * this.ancestor.lineHeight;
		} else {
			// it's a BitmapText
			return (
				this.ancestor.fontData.capHeight *
				this.ancestor.lineHeight *
				this.ancestor.fontScale.y
			);
		}
	}

	/**
	 * Returns the width of the given segment of inline text in CSS pixels.
	 * @param {string} text - the text to be measured
	 * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
	 * @returns {number} the width of the given segment of inline text in CSS pixels.
	 */
	lineWidth(text, context) {
		if (this.ancestor instanceof Text) {
			return context.measureText(text).width;
		} else {
			// it's a BitmapText
			const characters = text.split("");
			const charactersLength = characters.length;
			let width = 0;
			let lastGlyph = null;
			for (let i = 0; i < charactersLength; i++) {
				const ch = characters[i].charCodeAt(0);
				const glyph = this.ancestor.fontData.glyphs[ch];
				if (typeof glyph !== "undefined") {
					const kerning =
						lastGlyph && lastGlyph.kerning ? lastGlyph.getKerning(ch) : 0;
					// for the last glyph, use the visual extent if it exceeds xadvance
					const advance =
						i < charactersLength - 1
							? glyph.xadvance
							: Math.max(glyph.xadvance, glyph.xoffset + glyph.width);
					width += (advance + kerning) * this.ancestor.fontScale.x;
					lastGlyph = glyph;
				}
			}
			return width;
		}
	}

	/**
	 * measure the given text size in CSS pixels
	 * @param {string} text - the text to be measured
	 * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
	 * @returns {TextMetrics} this
	 */
	measureText(text, context) {
		let strings;

		if (!Array.isArray(text)) {
			strings = ("" + text).split("\n");
		} else {
			strings = text;
		}

		if (typeof context !== "undefined") {
			// save the previous context
			context.save();

			// apply the style font
			setContextStyle(context, this.ancestor);
		}

		// compute the bounding box size
		this.width = this.height = 0;

		const isBitmapText = !(this.ancestor instanceof Text);

		for (let i = 0; i < strings.length; i++) {
			this.width = Math.max(
				this.lineWidth(strings[i].trimEnd(), context),
				this.width,
			);
			this.height += this.lineHeight();
		}

		// glyph vertical extents (BitmapText only) — use font-wide
		// precomputed values from BitmapTextData instead of per-line iteration
		this.glyphYOffset = 0;
		this.glyphMaxBottom = 0;

		if (isBitmapText && strings.length > 0) {
			const fontData = this.ancestor.fontData;
			const scaleY = this.ancestor.fontScale.y;
			const visualLineH =
				(fontData.glyphMaxBottom - fontData.glyphMinTop) * scaleY;
			// replace the last capHeight-based line with the actual visual height
			this.height += visualLineH - this.lineHeight();
			this.glyphYOffset = fontData.glyphMinTop * scaleY;
			this.glyphMaxBottom = fontData.glyphMaxBottom * scaleY;
		}

		// How far the INK escapes the nominal line box, top and bottom.
		//
		// Everything above measures the box the font DECLARES —
		// `fontSize × lineHeight` per line — which says nothing about where the
		// glyphs actually land. A display face can carry glyphs that rise above
		// the em box, and a STROKE is centred on the glyph outline, so half of
		// `lineWidth` sits outside it in every direction and no metric reports
		// that at all. Either way the ink runs past the offscreen canvas and is
		// clipped.
		//
		// These are PADDING for the bake only: they are deliberately not folded
		// into `width`/`height`, because those are the layout box that
		// `Text#updateBounds` reports and moving it would shift every existing
		// label. `Text#setText` grows the canvas by them, draws that much lower,
		// and blits back up by the same amount — so the glyphs keep their exact
		// screen position and only the clipped pixels are recovered.
		//
		// `actualBoundingBox*` is measured from the alignment point, so the
		// values already account for whichever `textBaseline` is in force.
		// They describe the outline, though, not the pixels — see `INK_SLACK` —
		// and where they are unavailable the padding falls back to `INK_GUESS`
		// rather than to nothing.
		this.inkPadTop = 0;
		this.inkPadBottom = 0;
		if (!isBitmapText && strings.length > 0 && typeof context !== "undefined") {
			const style = this.ancestor;
			const stroke =
				style.lineWidth > 0 && style.strokeStyle.alpha > 0
					? style.lineWidth / 2
					: 0;
			const first = context.measureText(strings[0].trimEnd());
			const last =
				strings.length === 1
					? first
					: context.measureText(strings[strings.length - 1].trimEnd());
			const above = first.actualBoundingBoxAscent;
			const below = last.actualBoundingBoxDescent;
			// A face that cannot report its ink falls back to a share of the em
			// rather than to nothing: a guess that covers most faces clips less
			// than a zero that covers none.
			const measured = Number.isFinite(above) && Number.isFinite(below);
			const top = measured ? above : style.fontSize * INK_GUESS;
			const bottom = measured ? below : style.fontSize * INK_GUESS;

			this.inkPadTop = Math.max(0, Math.ceil(top + stroke) + INK_SLACK);
			// the last line starts one line box short of the bottom, so only
			// what reaches past that needs room
			this.inkPadBottom = Math.max(
				0,
				Math.ceil(this.inkPadTop + bottom + stroke - this.lineHeight()) +
					INK_SLACK,
			);
		}

		this.width = Math.ceil(this.width);
		this.height = Math.ceil(this.height);

		this.updateOrigin();

		if (typeof context !== "undefined") {
			// restore the context
			context.restore();
		}

		return this;
	}

	/**
	 * Recompute the box's position from the ancestor's CURRENT `pos`.
	 *
	 * Split out of `measureText` because it depends on `pos` while everything
	 * else there depends only on the string and the font. A label that moves
	 * needs this refreshed — and nothing else — so the draw path can call it
	 * per frame without re-measuring a single glyph.
	 *
	 * The `Math.floor` is what puts the canvas on a whole pixel. The remainder
	 * it drops is not lost: `Text` bakes its glyphs at `pos - metrics`, so the
	 * sub-pixel part lands in the rasterization, where the font rasterizer can
	 * antialias it, instead of resampling the whole texture.
	 * @returns {TextMetrics} this instance for chaining
	 * @ignore
	 * @internal
	 */
	updateOrigin() {
		this.x = Math.floor(
			this.ancestor.textAlign === "right"
				? this.ancestor.pos.x - this.width
				: this.ancestor.textAlign === "center"
					? this.ancestor.pos.x - this.width / 2
					: this.ancestor.pos.x,
		);
		this.y = Math.floor(
			this.ancestor.textBaseline.search(/^(top|hanging)$/) === 0
				? this.ancestor.pos.y
				: this.ancestor.textBaseline === "middle"
					? this.ancestor.pos.y - this.lineHeight() / 2
					: this.ancestor.pos.y - this.lineHeight(),
		);
		return this;
	}

	/**
	 * wrap the given text based on the given width
	 * @param {string|string[]} text - the text to be wrapped
	 * @param {number} width - maximum width of one segment of text in css pixel
	 * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
	 * @returns {string[]} an array of string representing wrapped text
	 */
	wordWrap(text, width, context) {
		let currentLine = "";
		const output = [];

		if (Array.isArray(text)) {
			// join into a single string
			text = text.join(" ");
		}
		// word splitting to be improved as it replaces \n by space if present
		const words = text.replace(/[\r\n]+/g, " ").split(" ");

		if (typeof context !== "undefined") {
			// save the previous context
			context.save();

			// apply the style font
			setContextStyle(context, this.ancestor);
		}

		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			const lineWidth = this.lineWidth(currentLine + word + " ", context);
			if (lineWidth < width) {
				// add the word to the current line
				currentLine += word + " ";
			} else {
				output.push(currentLine + "\n");
				currentLine = word + " ";
			}
		}
		// last line
		output.push(currentLine);

		if (typeof context !== "undefined") {
			// restore the context
			context.restore();
		}

		return output;
	}
}
export default TextMetrics;
