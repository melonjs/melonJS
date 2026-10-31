import { getBinary, getImage } from "../../loader/loader.js";
import BitmapText from "../text/bitmaptext.js";
import Text from "../text/text.js";

/**
 * The text a widget draws: a CSS font through {@link Text}, or a loaded
 * bitmap font through {@link BitmapText}.
 * @category UI
 */
export type UILabel = Text | BitmapText;

/** how a widget's label is drawn */
export interface UILabelOptions {
	/** what it says */
	text: string;
	/**
	 * A CSS font family, or the name of a loaded bitmap font. A name with
	 * both a font image and font data in the loader is drawn as a bitmap
	 * font; anything else is a CSS font.
	 */
	font: string;
	/**
	 * the height of the text, in pixels; a bitmap font is scaled to it from
	 * its own line height
	 */
	fontSize: number;
	/** the text colour; a bitmap font is tinted with it */
	fillStyle: string;
	/** horizontal alignment about the label's position */
	textAlign: string;
	/** vertical alignment about the label's position */
	textBaseline: string;
}

/**
 * Whether a font name names a loaded bitmap font.
 * @param font - the font name
 * @returns true when its image and its data are both loaded
 * @ignore
 * @internal
 */
export function isBitmapFont(font: string): boolean {
	return getImage(font) != null && getBinary(font) != null;
}

/**
 * Make a widget's label.
 * @param options - see {@link UILabelOptions}
 * @returns a `BitmapText` for a loaded bitmap font, a `Text` otherwise
 * @ignore
 * @internal
 */
export function createLabel(options: UILabelOptions): UILabel {
	if (isBitmapFont(options.font)) {
		const label = new BitmapText(0, 0, {
			font: options.font,
			fillStyle: options.fillStyle,
			textAlign: options.textAlign,
			textBaseline: options.textBaseline,
			text: options.text,
		});
		// at its authored scale, one line measures the font's line height
		const lineHeight = label.measureText("Ag").height;
		if (lineHeight > 0) {
			label.resize(options.fontSize / lineHeight);
		}
		return label;
	}
	return new Text(0, 0, {
		font: options.font,
		size: options.fontSize,
		fillStyle: options.fillStyle,
		textAlign: options.textAlign,
		textBaseline: options.textBaseline,
		text: options.text,
	});
}
