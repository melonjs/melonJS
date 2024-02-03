/**
 * @classdesc
 * A color manipulation object.
 */
export default class Color {
    /**
     * @param {number} [r=0] - red component [0 .. 255]
     * @param {number} [g=0] - green component [0 .. 255]
     * @param {number} [b=0] - blue component [0 .. 255]
     * @param {number} [alpha=1.0] - alpha value [0.0 .. 1.0]
     */
    constructor(r?: number | undefined, g?: number | undefined, b?: number | undefined, alpha?: number | undefined);
    /**
     * @ignore
     */
    onResetEvent(r?: number, g?: number, b?: number, alpha?: number): void;
    glArray: Float32Array | undefined;
    set r(value: number);
    /**
     * Color Red Component [0 .. 255]
     * @type {number}
     */
    get r(): number;
    set g(value: number);
    /**
     * Color Green Component [0 .. 255]
     * @type {number}
     */
    get g(): number;
    set b(value: number);
    /**
     * Color Blue Component [0 .. 255]
     * @type {number}
     */
    get b(): number;
    set alpha(value: number);
    /**
     * Color Alpha Component [0.0 .. 1.0]
     * @type {number}
     */
    get alpha(): number;
    /**
     * Set this color to the specified value.
     * @param {number} r - red component [0 .. 255]
     * @param {number} g - green component [0 .. 255]
     * @param {number} b - blue component [0 .. 255]
     * @param {number} [alpha=1.0] - alpha value [0.0 .. 1.0]
     * @returns {Color} Reference to this object for method chaining
     */
    setColor(r: number, g: number, b: number, alpha?: number | undefined): Color;
    /**
     * set this color to the specified normalized float values
     * @param {number} r - red component [0.0 .. 1.0]
     * @param {number} g - green component [0.0 .. 1.0]
     * @param {number} b - blue component [0.0 .. 1.0]
     * @param {number} [alpha=1.0] - alpha value [0.0 .. 1.0]
     * @returns {Color} Reference to this object for method chaining
     */
    setFloat(r: number, g: number, b: number, alpha?: number | undefined): Color;
    /**
     * set this color to the specified HSV value
     * @param {number} h - hue (a value from 0 to 1)
     * @param {number} s - saturation (a value from 0 to 1)
     * @param {number} v - value (a value from 0 to 1)
     * @returns {Color} Reference to this object for method chaining
     */
    setHSV(h: number, s: number, v: number): Color;
    /**
     * set this color to the specified HSL value
     * @param {number} h - hue (a value from 0 to 1)
     * @param {number} s - saturation (a value from 0 to 1)
     * @param {number} l - lightness (a value from 0 to 1)
     * @returns {Color} Reference to this object for method chaining
     */
    setHSL(h: number, s: number, l: number): Color;
    /**
     * Create a new copy of this color object.
     * @returns {Color} Reference to the newly cloned object
     */
    clone(): Color;
    /**
     * Copy a color object or CSS color into this one.
     * @param {Color|string} color
     * @returns {Color} Reference to this object for method chaining
     */
    copy(color: Color | string): Color;
    /**
     * Blend this color with the given one using addition.
     * @param {Color} color
     * @returns {Color} Reference to this object for method chaining
     */
    add(color: Color): Color;
    /**
     * Darken this color value by 0..1
     * @param {number} scale
     * @returns {Color} Reference to this object for method chaining
     */
    darken(scale: number): Color;
    /**
     * Linearly interpolate between this color and the given one.
     * @param {Color} color
     * @param {number} alpha - with alpha = 0 being this color, and alpha = 1 being the given one.
     * @returns {Color} Reference to this object for method chaining
     */
    lerp(color: Color, alpha: number): Color;
    /**
     * Lighten this color value by 0..1
     * @param {number} scale
     * @returns {Color} Reference to this object for method chaining
     */
    lighten(scale: number): Color;
    /**
     * Generate random r,g,b values for this color object
     * @param {number} [min=0] - minimum value for the random range
     * @param {number} [max=255] - maxmium value for the random range
     * @returns {Color} Reference to this object for method chaining
     */
    random(min?: number | undefined, max?: number | undefined): Color;
    /**
     * Return true if the r,g,b,a values of this color are equal with the
     * given one.
     * @param {Color} color
     * @returns {boolean}
     */
    equals(color: Color): boolean;
    /**
     * Parse a CSS color string and set this color to the corresponding
     * r,g,b values
     * @param {string} cssColor
     * @returns {Color} Reference to this object for method chaining
     */
    parseCSS(cssColor: string): Color;
    /**
     * Parse an RGB or RGBA CSS color string
     * @param {string} rgbColor
     * @returns {Color} Reference to this object for method chaining
     */
    parseRGB(rgbColor: string): Color;
    /**
     * Parse a Hex color ("#RGB", "#RGBA" or "#RRGGBB", "#RRGGBBAA" format) and set this color to
     * the corresponding r,g,b,a values
     * @param {string} hexColor
     * @param {boolean} [argb = false] - true if format is #ARGB, or #AARRGGBB (as opposed to #RGBA or #RGGBBAA)
     * @returns {Color} Reference to this object for method chaining
     */
    parseHex(hexColor: string, argb?: boolean | undefined): Color;
    /**
     * Pack this color RGB components into a Uint32 ARGB representation
     * @param {number} [alpha=1.0] - alpha value [0.0 .. 1.0]
     * @returns {number}
     */
    toUint32(alpha?: number | undefined): number;
    /**
     * return an Float Array representation of this object
     * @returns {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * return the color in "#RRGGBB" format
     * @returns {string}
     */
    toHex(): string;
    /**
     * Get the color in "#RRGGBBAA" format
     * @returns {string}
     */
    toHex8(alpha?: number): string;
    /**
     * Get the color in "rgb(R,G,B)" format
     * @returns {string}
     */
    toRGB(): string;
    /**
     * Get the color in "rgba(R,G,B,A)" format
     * @param {number} [alpha=1.0] - alpha value [0.0 .. 1.0]
     * @returns {string}
     */
    toRGBA(alpha?: number | undefined): string;
}
