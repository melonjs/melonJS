/**
 * Class for storing relevant data from the font file.
 * @ignore
 */
export default class BitmapTextData {
    /**
     * @param {string} data - The bitmap font data pulled from the resource loader using me.loader.getBinary()
     */
    constructor(data: string);
    /**
     * @ignore
     */
    onResetEvent(data: any): void;
    padTop: number;
    padRight: number;
    padBottom: number;
    padLeft: number;
    lineHeight: number;
    capHeight: any;
    descent: any;
    /**
     * The map of glyphs, each key is a char code.
     * @name glyphs
     * @type {object}
     * @memberof BitmapTextData
     */
    glyphs: object;
    /**
     * This parses the font data text and builds a map of glyphs containing the data for each character
     * @name parse
     * @memberof BitmapTextData
     * @param {string} fontData
     */
    parse(fontData: string): void;
}
