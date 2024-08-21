import Glyph from "./glyph.ts";
import { createPool } from "../../pool.ts";

// bitmap constants
const capChars: string[] = [
	"M",
	"N",
	"B",
	"D",
	"C",
	"E",
	"F",
	"K",
	"A",
	"G",
	"H",
	"I",
	"J",
	"L",
	"O",
	"P",
	"Q",
	"R",
	"S",
	"T",
	"U",
	"V",
	"W",
	"X",
	"Y",
	"Z",
];

/**
 * Gets the value from a string of pairs.
 * @ignore
 */
function getValueFromPair(string: string, pattern: RegExp): string {
	const value = string.match(pattern);
	if (!value) {
		throw new Error(
			`${`Could not find pattern ${pattern}` as string} in string: ${string}`,
		);
	}

	return value[0].split("=")[1];
}

/**
 * Gets the first glyph in the map that is not a space character
 * @ignore
 * @param glyphs - the map of glyphs, each key is a char code
 * @returns the first glyph that is not a space character
 */
function getFirstGlyph(glyphs: any): Glyph | null {
	const keys = Object.keys(glyphs);
	for (let i = 0; i < keys.length; i++) {
		if (parseInt(keys[i]) > 32) {
			return glyphs[keys[i]];
		}
	}
	return null;
}

/**
 * Creates a glyph to use for the space character
 * @ignore
 * @param glyphs - the map of glyphs, each key is a char code
 */
function createSpaceGlyph(glyphs: any) {
	const spaceCharCode = " ".charCodeAt(0);
	let glyph = glyphs[spaceCharCode];
	if (!glyph) {
		glyph = new Glyph();
		glyph.id = spaceCharCode;
		const firstGlyph = getFirstGlyph(glyphs);
		glyph.xadvance = firstGlyph !== null ? firstGlyph.xadvance : 0;
		glyphs[spaceCharCode] = glyph;
	}
}

export default class BitmapTextData {
	padTop: number = 0;
	padRight: number = 0;
	padBottom: number = 0;
	padLeft: number = 0;
	lineHeight: number = 0;
	capHeight: number = 1;
	descent: number = 0;
	glyphs: { [key: number]: Glyph } = {};

	constructor(data: string) {
		this.parse(data);
	}

	parse(fontData: string) {
		if (!fontData) {
			throw new Error(
				"File containing font data was empty, cannot load the bitmap font.",
			);
		}

		const lines = fontData.split(/\r\n|\n/);
		const padding = fontData.match(/padding=\d+,\d+,\d+,\d+/g);
		if (!padding) {
			throw new Error("Padding not found in first line");
		}
		const paddingValues = padding[0].split("=")[1].split(",");

		this.padTop = parseFloat(paddingValues[0]);
		this.padLeft = parseFloat(paddingValues[1]);
		this.padBottom = parseFloat(paddingValues[2]);
		this.padRight = parseFloat(paddingValues[3]);
		this.lineHeight = parseFloat(getValueFromPair(lines[1], /lineHeight=\d+/g));

		this.capHeight = 1;
		this.descent = 0;
		this.glyphs = {};

		const baseLine = parseFloat(getValueFromPair(lines[1], /base=\d+/g));
		const padY = this.padTop + this.padBottom;

		let glyph: Glyph | null = null;

		for (let i = 4; i < lines.length; i++) {
			const line = lines[i];
			const characterValues = line.split(/=|\s+/);
			if (!line || /^kernings/.test(line)) {
				continue;
			}
			if (/^kerning\s/.test(line)) {
				const first = parseFloat(characterValues[2]);
				const second = parseFloat(characterValues[4]);
				const amount = parseFloat(characterValues[6]);

				glyph = this.glyphs[first];
				if (glyph !== null && typeof glyph !== "undefined") {
					glyph.setKerning(second, amount);
				}
			} else {
				glyph = new Glyph();

				const ch = parseFloat(characterValues[2]);
				glyph.id = ch;
				glyph.x = parseFloat(characterValues[4]);
				glyph.y = parseFloat(characterValues[6]);
				glyph.width = parseFloat(characterValues[8]);
				glyph.height = parseFloat(characterValues[10]);
				glyph.xoffset = parseFloat(characterValues[12]);
				glyph.yoffset = parseFloat(characterValues[14]);
				glyph.xadvance = parseFloat(characterValues[16]);

				if (glyph.width > 0 && glyph.height > 0) {
					this.descent = Math.min(baseLine + glyph.yoffset, this.descent);
				}

				this.glyphs[ch] = glyph;
			}
		}

		this.descent += this.padBottom;

		createSpaceGlyph(this.glyphs);

		let capGlyph: Glyph | null = null;
		for (let i = 0; i < capChars.length; i++) {
			const capChar = capChars[i];
			capGlyph = this.glyphs[capChar.charCodeAt(0)];
			if (capGlyph) {
				break;
			}
		}
		if (!capGlyph) {
			for (const charCode in this.glyphs) {
				if (Object.prototype.hasOwnProperty.call(this.glyphs, charCode)) {
					glyph = this.glyphs[charCode];
					if (glyph.height === 0 || glyph.width === 0) {
						continue;
					}
					this.capHeight = Math.max(this.capHeight, glyph.height);
				}
			}
		} else {
			this.capHeight = capGlyph.height;
		}
		this.capHeight -= padY;
	}
}

export const bitmapTextDataPool = createPool<
	BitmapTextData,
	[fontData: string]
>((fontData: string) => {
	const instance = new BitmapTextData(fontData);

	return {
		instance,
		reset(fontData) {
			instance.parse(fontData);
		},
	};
});
