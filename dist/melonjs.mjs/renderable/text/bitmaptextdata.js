/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import Glyph from './glyph.js';

// bitmap constants
const capChars = ["M", "N", "B", "D", "C", "E", "F", "K", "A", "G", "H", "I", "J", "L", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

/**
 * Gets the value from a string of pairs.
 * @ignore
 */
function getValueFromPair(string, pattern) {
    let value = string.match(pattern);
    if (!value) {
        throw new Error("Could not find pattern " + pattern + " in string: " + string);
    }

    return value[0].split("=")[1];
}

/**
 * Gets the first glyph in the map that is not a space character
 * @ignore
 * @name _getFirstGlyph
 * @memberof BitmapTextData
 * @param {object} glyphs - the map of glyphs, each key is a char code
 * @returns {Glyph}
 */
function getFirstGlyph(glyphs) {
    let keys = Object.keys(glyphs);
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] > 32) {
            return glyphs[keys[i]];
        }
    }
    return null;
}

/**
 * Creates a glyph to use for the space character
 * @ignore
 * @name createSpaceGlyph
 * @memberof BitmapTextData
 * @param {object} glyphs - the map of glyphs, each key is a char code
 */
function createSpaceGlyph(glyphs) {
    let spaceCharCode = " ".charCodeAt(0);
    let glyph = glyphs[spaceCharCode];
    if (!glyph) {
        glyph = new Glyph();
        glyph.id = spaceCharCode;
        glyph.xadvance = getFirstGlyph(glyphs).xadvance;
        glyphs[spaceCharCode] = glyph;
    }
}

/**
 * Class for storing relevant data from the font file.
 * @ignore
 */
class BitmapTextData {

    /**
    * @param {string} data - The bitmap font data pulled from the resource loader using me.loader.getBinary()
    */
    constructor(data) {
        this.onResetEvent(data);
    }

    /**
     * @ignore
     */
    onResetEvent(data) {
        this.padTop = 0;
        this.padRight = 0;
        this.padBottom = 0;
        this.padLeft = 0;
        this.lineHeight = 0;
        // The distance from the top of most uppercase characters to the baseline. Since the drawing position is the cap height of
        // the first line, the cap height can be used to get the location of the baseline.
        this.capHeight = 1;
        // The distance from the bottom of the glyph that extends the lowest to the baseline. This number is negative.
        this.descent = 0;

        /**
         * The map of glyphs, each key is a char code.
         * @name glyphs
         * @type {object}
         * @memberof BitmapTextData
         */
        this.glyphs = {};

        // parse the data
        this.parse(data);
    }

    /**
     * This parses the font data text and builds a map of glyphs containing the data for each character
     * @name parse
     * @memberof BitmapTextData
     * @param {string} fontData
     */
    parse(fontData) {
        if (!fontData) {
            throw new Error("File containing font data was empty, cannot load the bitmap font.");
        }
        let lines = fontData.split(/\r\n|\n/);
        let padding = fontData.match(/padding\=\d+,\d+,\d+,\d+/g);
        if (!padding) {
            throw new Error("Padding not found in first line");
        }
        let paddingValues = padding[0].split("=")[1].split(",");
        this.padTop = parseFloat(paddingValues[0]);
        this.padLeft = parseFloat(paddingValues[1]);
        this.padBottom = parseFloat(paddingValues[2]);
        this.padRight = parseFloat(paddingValues[3]);

        this.lineHeight = parseFloat(getValueFromPair(lines[1], /lineHeight\=\d+/g));

        let baseLine = parseFloat(getValueFromPair(lines[1], /base\=\d+/g));
        let padY = this.padTop + this.padBottom;
        let glyph = null;


        for (let i = 4; i < lines.length; i++) {
            let line = lines[i];
            let characterValues = line.split(/=|\s+/);
            if (!line || /^kernings/.test(line)) {
                continue;
            }
            if (/^kerning\s/.test(line)) {
                let first = parseFloat(characterValues[2]);
                let second = parseFloat(characterValues[4]);
                let amount = parseFloat(characterValues[6]);

                glyph = this.glyphs[first];
                if (glyph !== null && typeof glyph !== "undefined") {
                    glyph.setKerning(second, amount);
                }
            } else {
                glyph = new Glyph();

                let ch = parseFloat(characterValues[2]);
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

        let capGlyph = null;
        for (let i = 0; i < capChars.length; i++) {
            let capChar = capChars[i];
            capGlyph = this.glyphs[capChar.charCodeAt(0)];
            if (capGlyph) {
                break;
            }
        }
        if (!capGlyph) {
            for (let charCode in this.glyphs) {
                if (this.glyphs.hasOwnProperty(charCode)) {
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

export { BitmapTextData as default };
