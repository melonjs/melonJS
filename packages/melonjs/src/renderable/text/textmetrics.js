import { Bounds } from "../../physics/bounds.ts";
import Text from "./text.js";
import setContextStyle, { strokeReach } from "./textstyle.js";

/**
 * additional import for TypeScript
 * @import BitmapText from "./bitmaptext.js";
 * @import Renderable from "../renderable.js";
 */
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
 * The lines a `setText` value stands for: a string (or a number) split on
 * `\n`, or an array's entries, each as a string, in a new array.
 * @param {number|string|string[]|null} [value] - the text, as `setText` takes it
 * @returns {string[]} one entry per line
 * @ignore
 * @internal
 */
export function toLines(value) {
	if (Array.isArray(value)) {
		return value.map((line) => {
			return "" + line;
		});
	}
	return ("" + (value ?? "")).split("\n");
}

/**
 * Whether two line arrays hold the same text, line for line. No lines at all
 * (a label created empty) and one empty line are the same: nothing.
 * @param {string[]} a - lines
 * @param {string[]} b - lines
 * @returns {boolean} true when they are the same text
 * @ignore
 * @internal
 */
export function sameLines(a, b) {
	if (a.length !== b.length) {
		return isBlank(a) && isBlank(b);
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

/**
 * no lines, or a single empty one
 * @param {string[]} lines - lines
 * @returns {boolean} true when there is no text
 * @ignore
 * @internal
 */
function isBlank(lines) {
	return lines.length === 0 || (lines.length === 1 && lines[0] === "");
}

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
		//
		// The same goes across: `width` is the advance of the longest line,
		// and a glyph's ink can start before its line's alignment point (an
		// "A" whose foot leans out, an italic) or end past its advance, the
		// stroke adding its reach on both sides. `inkPadLeft` and
		// `inkPadRight` are that overshoot, kept out of `width` the same way.
		this.inkPadTop = 0;
		this.inkPadBottom = 0;
		this.inkPadLeft = 0;
		this.inkPadRight = 0;
		if (!isBitmapText && strings.length > 0 && typeof context !== "undefined") {
			const style = this.ancestor;
			// half the line width past the outline, or for a "miter" join as
			// far as its corners can point
			const stroke = strokeReach(style);
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

			// across, line by line: each sits at its own alignment point in
			// the box, and its ink box is measured from that point
			const align = style.textAlign;
			const anchor =
				align === "right"
					? this.width
					: align === "center"
						? this.width / 2
						: 0;
			let left = 0;
			let right = 0;
			for (let i = 0; i < strings.length; i++) {
				const line =
					i === 0
						? first
						: i === strings.length - 1
							? last
							: context.measureText(strings[i].trimEnd());
				const inkLeft = line.actualBoundingBoxLeft;
				const inkRight = line.actualBoundingBoxRight;
				if (Number.isFinite(inkLeft) && Number.isFinite(inkRight)) {
					left = Math.max(left, inkLeft - anchor);
					right = Math.max(right, anchor + inkRight - this.width);
				}
			}
			this.inkPadLeft = Math.max(0, Math.ceil(left + stroke) + INK_SLACK);
			// plus a pixel: the box sits on a whole pixel and the glyphs are
			// baked at what that leaves over (see `updateOrigin`), so they can
			// land up to a pixel right of where they were measured
			this.inkPadRight = Math.max(0, Math.ceil(right + stroke + 1) + INK_SLACK);
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
	 *
	 * The baseline places the WHOLE block, as `BitmapText` does and as the
	 * bounds say: its top at `pos.y` for "top" / "hanging", its middle for
	 * "middle", its bottom for the rest. It used to move the box by one line
	 * only, so a second line of a "bottom" label was drawn below `pos.y`,
	 * outside the bounds `updateBounds` reported for it.
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
		this.y = Math.floor(this.ancestor.pos.y - this.height * this.blockShift());
		return this;
	}

	/**
	 * The share of the block that sits above `pos.y` for the ancestor's
	 * `textBaseline`: 0 for "top" and "hanging", 0.5 for "middle", 1 for
	 * "alphabetic", "ideographic" and "bottom".
	 *
	 * The same share of ONE line is how far below the top of its own line box
	 * each line's alignment point is, which is where `Text` hands it to the
	 * canvas.
	 * @returns {number} 0, 0.5 or 1
	 * @ignore
	 * @internal
	 */
	blockShift() {
		switch (this.ancestor.textBaseline) {
			case "top":
			case "hanging":
				return 0;
			case "middle":
				return 0.5;
			default:
				return 1;
		}
	}

	/**
	 * wrap the given text based on the given width.
	 *
	 * Each `\n`-separated line (each entry, for an array) is wrapped on its
	 * own, so wrapping only ever adds line breaks: the explicit ones are kept,
	 * blank lines included. A line breaks between words, never inside one: a
	 * word wider than `width` is put on a line of its own and overflows it.
	 * @param {string|string[]} text - the text to be wrapped
	 * @param {number} width - maximum width of one segment of text in css pixel
	 * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
	 * @returns {string[]} an array of string representing wrapped text, one entry per line
	 */
	wordWrap(text, width, context) {
		const output = [];
		const paragraphs = [];

		for (const entry of Array.isArray(text) ? text : [text]) {
			paragraphs.push(...("" + entry).split(/\r?\n/));
		}

		if (typeof context !== "undefined") {
			// save the previous context
			context.save();

			// apply the style font
			setContextStyle(context, this.ancestor);
		}

		for (const paragraph of paragraphs) {
			const words = paragraph.split(" ");
			// a line always takes its first word, however wide: closing the
			// line first is what used to leave a blank one before it
			let line = words[0];
			let broken = false;
			for (let i = 1; i < words.length; i++) {
				const word = words[i];
				if (broken && line === "") {
					// spaces at a break are swallowed by it, not carried over
					line = word;
				} else if (this.lineWidth(line + " " + word + " ", context) < width) {
					line += " " + word;
				} else {
					output.push(line.trimEnd());
					line = word;
					broken = true;
				}
			}
			output.push(line.trimEnd());
		}

		if (typeof context !== "undefined") {
			// restore the context
			context.restore();
		}

		return output;
	}
}
export default TextMetrics;
