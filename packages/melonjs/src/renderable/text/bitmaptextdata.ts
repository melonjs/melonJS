import { createPool } from "../../system/pool.ts";
import Glyph from "./glyph.ts";

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
		throw new Error(`Could not find pattern ${pattern} in string: ${string}`);
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

/**
 * a bitmap font data object — parses the AngelCode BMFont format in both its
 * text (`.fnt`) and XML serialisations (the flavour is auto-detected).
 * @category Text
 */
export default class BitmapTextData {
	padTop: number = 0;
	padRight: number = 0;
	padBottom: number = 0;
	padLeft: number = 0;
	lineHeight: number = 0;
	capHeight: number = 1;
	descent: number = 0;
	glyphMinTop: number = 0;
	glyphMaxBottom: number = 0;
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

		this.capHeight = 1;
		this.descent = 0;
		this.glyphMinTop = Infinity;
		this.glyphMaxBottom = 0;
		this.glyphs = {};

		// AngelCode BMFont ships in a text (.fnt) and an XML flavour — same data,
		// different serialisation. Detect which and dispatch.
		if (fontData.trimStart().startsWith("<")) {
			this.parseXML(fontData);
		} else {
			this.parseText(fontData);
		}

		if (this.glyphMinTop === Infinity) {
			this.glyphMinTop = 0;
		}

		this.descent += this.padBottom;

		createSpaceGlyph(this.glyphs);

		let capGlyph: Glyph | undefined;
		for (let i = 0; i < capChars.length; i++) {
			const capChar = capChars[i];
			capGlyph = this.glyphFor(capChar.charCodeAt(0));
			if (capGlyph) {
				break;
			}
		}
		if (!capGlyph) {
			for (const charCode in this.glyphs) {
				if (Object.prototype.hasOwnProperty.call(this.glyphs, charCode)) {
					const glyph = this.glyphs[charCode];
					if (glyph.height === 0 || glyph.width === 0) {
						continue;
					}
					this.capHeight = Math.max(this.capHeight, glyph.height);
				}
			}
		} else {
			this.capHeight = capGlyph.height;
		}
		this.capHeight -= this.padTop + this.padBottom;
	}

	/**
	 * Record a parsed glyph and fold it into the font's vertical metrics.
	 * @ignore
	 */
	recordGlyph(glyph: Glyph, baseLine: number) {
		if (glyph.width > 0 && glyph.height > 0) {
			this.descent = Math.min(baseLine + glyph.yoffset, this.descent);
			this.glyphMinTop = Math.min(this.glyphMinTop, glyph.yoffset);
			this.glyphMaxBottom = Math.max(
				this.glyphMaxBottom,
				glyph.yoffset + glyph.height,
			);
		}
		this.glyphs[glyph.id] = glyph;
	}

	/**
	 * Look up a glyph by char code, honestly typed as possibly missing (the
	 * glyph map's index signature otherwise hides that a lookup can be absent).
	 * @ignore
	 */
	glyphFor(id: number): Glyph | undefined {
		return this.glyphs[id];
	}

	/**
	 * Parse the AngelCode BMFont text (.fnt) format.
	 * @ignore
	 */
	parseText(fontData: string) {
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
		const baseLine = parseFloat(getValueFromPair(lines[1], /base=\d+/g));

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

				const glyph = this.glyphFor(first);
				if (glyph) {
					glyph.setKerning(second, amount);
				}
			} else {
				const glyph = new Glyph();
				glyph.id = parseFloat(characterValues[2]);
				glyph.x = parseFloat(characterValues[4]);
				glyph.y = parseFloat(characterValues[6]);
				glyph.width = parseFloat(characterValues[8]);
				glyph.height = parseFloat(characterValues[10]);
				glyph.xoffset = parseFloat(characterValues[12]);
				glyph.yoffset = parseFloat(characterValues[14]);
				glyph.xadvance = parseFloat(characterValues[16]);
				this.recordGlyph(glyph, baseLine);
			}
		}
	}

	/**
	 * Parse the AngelCode BMFont XML format (same data as the .fnt text form).
	 * Padding is optional in XML exports (e.g. frostyfreeze) and defaults to 0.
	 * @ignore
	 */
	parseXML(fontData: string) {
		// Parsed with simple regex rather than DOMParser, so it also works where
		// no DOM is available (Node / SSR / headless). BMFont XML is a flat,
		// attributes-only format, which makes this safe and dependency-free.
		const attrs = (tag: string) => {
			const out = new Map<string, string>();
			// bounded name/whitespace repetition keeps this strictly linear (no
			// polynomial backtracking) on arbitrary font data; BMFont attribute
			// names and the surrounding spacing are always short
			for (const m of tag.matchAll(/(\w{1,64})\s{0,8}=\s{0,8}"([^"]*)"/g)) {
				out.set(m[1], m[2]);
			}
			return out;
		};
		const num = (o: Map<string, string>, name: string) => {
			return parseFloat(o.get(name) ?? "0");
		};

		const commonTag = fontData.match(/<common\b[^>]*>/);
		if (commonTag === null) {
			throw new Error("Invalid BMFont XML: missing <common> element.");
		}
		const infoTag = fontData.match(/<info\b[^>]*>/);
		const info = infoTag ? attrs(infoTag[0]) : new Map<string, string>();
		const common = attrs(commonTag[0]);

		// padding is optional in XML exports (e.g. frostyfreeze) → default to 0
		const pad = (info.get("padding") ?? "0,0,0,0").split(",");
		this.padTop = parseFloat(pad[0]);
		this.padLeft = parseFloat(pad[1]);
		this.padBottom = parseFloat(pad[2]);
		this.padRight = parseFloat(pad[3]);
		this.lineHeight = num(common, "lineHeight");
		const baseLine = num(common, "base");

		for (const m of fontData.matchAll(/<char\b[^>]*>/g)) {
			const a = attrs(m[0]);
			const glyph = new Glyph();
			glyph.id = num(a, "id");
			glyph.x = num(a, "x");
			glyph.y = num(a, "y");
			glyph.width = num(a, "width");
			glyph.height = num(a, "height");
			glyph.xoffset = num(a, "xoffset");
			glyph.yoffset = num(a, "yoffset");
			glyph.xadvance = num(a, "xadvance");
			this.recordGlyph(glyph, baseLine);
		}
		for (const m of fontData.matchAll(/<kerning\b[^>]*>/g)) {
			const a = attrs(m[0]);
			const glyph = this.glyphFor(num(a, "first"));
			if (glyph) {
				glyph.setKerning(num(a, "second"), num(a, "amount"));
			}
		}
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
