/**
 * a glyph representing a single character in a font
 * @ignore
 */
export default class Glyph {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    u: number;
    v: number;
    u2: number;
    v2: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    fixedWidth: boolean;
    /**
     * @ignore
     */
    getKerning(ch: any): any;
    /**
     * @ignore
     */
    setKerning(ch: any, value: any): void;
    kerning: {} | undefined;
}
