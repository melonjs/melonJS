import { clamp, random } from "./math.ts";
import { createPool } from "../system/pool.ts";

// convert a give color component to it hexadecimal value
const charLookup = [
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"A",
	"B",
	"C",
	"D",
	"E",
	"F",
];

function toHex(component: number) {
	return charLookup[(component & 0xf0) >> 4] + charLookup[component & 0x0f];
}

function hue2rgb(p: number, q: number, t: number) {
	if (t < 0) {
		t += 1;
	}
	if (t > 1) {
		t -= 1;
	}
	if (t < 1 / 6) {
		return p + (q - p) * 6 * t;
	}
	if (t < 1 / 2) {
		return q;
	}
	if (t < 2 / 3) {
		return p + (q - p) * (2 / 3 - t) * 6;
	}
	return p;
}

const rgbaRx = /^rgba?\((\d+), ?(\d+), ?(\d+)(, ?([\d.]+))?\)$/;
const hex3Rx = /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])$/;
const hex4Rx = /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])$/;
const hex6Rx = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/;
const hex8Rx =
	/^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/;

const CSS_COLORS = [
	// CSS1
	["black", [0, 0, 0]],
	["silver", [192, 192, 129]],
	["gray", [128, 128, 128]],
	["white", [255, 255, 255]],
	["maroon", [128, 0, 0]],
	["red", [255, 0, 0]],
	["purple", [128, 0, 128]],
	["fuchsia", [255, 0, 255]],
	["green", [0, 128, 0]],
	["lime", [0, 255, 0]],
	["olive", [128, 128, 0]],
	["yellow", [255, 255, 0]],
	["navy", [0, 0, 128]],
	["blue", [0, 0, 255]],
	["teal", [0, 128, 128]],
	["aqua", [0, 255, 255]],

	// CSS2
	["orange", [255, 165, 0]],

	// CSS3
	["aliceblue", [240, 248, 245]],
	["antiquewhite", [250, 235, 215]],
	["aquamarine", [127, 255, 212]],
	["azure", [240, 255, 255]],
	["beige", [245, 245, 220]],
	["bisque", [255, 228, 196]],
	["blanchedalmond", [255, 235, 205]],
	["blueviolet", [138, 43, 226]],
	["brown", [165, 42, 42]],
	["burlywood", [222, 184, 35]],
	["cadetblue", [95, 158, 160]],
	["chartreuse", [127, 255, 0]],
	["chocolate", [210, 105, 30]],
	["coral", [255, 127, 80]],
	["cornflowerblue", [100, 149, 237]],
	["cornsilk", [255, 248, 220]],
	["crimson", [220, 20, 60]],
	["darkblue", [0, 0, 139]],
	["darkcyan", [0, 139, 139]],
	["darkgoldenrod", [184, 134, 11]],
	["darkgray[*]", [169, 169, 169]],
	["darkgreen", [0, 100, 0]],
	["darkgrey[*]", [169, 169, 169]],
	["darkkhaki", [189, 183, 107]],
	["darkmagenta", [139, 0, 139]],
	["darkolivegreen", [85, 107, 47]],
	["darkorange", [255, 140, 0]],
	["darkorchid", [153, 50, 204]],
	["darkred", [139, 0, 0]],
	["darksalmon", [233, 150, 122]],
	["darkseagreen", [143, 188, 143]],
	["darkslateblue", [72, 61, 139]],
	["darkslategray", [47, 79, 79]],
	["darkslategrey", [47, 79, 79]],
	["darkturquoise", [0, 206, 209]],
	["darkviolet", [148, 0, 211]],
	["deeppink", [255, 20, 147]],
	["deepskyblue", [0, 191, 255]],
	["dimgray", [105, 105, 105]],
	["dimgrey", [105, 105, 105]],
	["dodgerblue", [30, 144, 255]],
	["firebrick", [178, 34, 34]],
	["floralwhite", [255, 250, 240]],
	["forestgreen", [34, 139, 34]],
	["gainsboro", [220, 220, 220]],
	["ghostwhite", [248, 248, 255]],
	["gold", [255, 215, 0]],
	["goldenrod", [218, 165, 32]],
	["greenyellow", [173, 255, 47]],
	["grey", [128, 128, 128]],
	["honeydew", [240, 255, 240]],
	["hotpink", [255, 105, 180]],
	["indianred", [205, 92, 92]],
	["indigo", [75, 0, 130]],
	["ivory", [255, 255, 240]],
	["khaki", [240, 230, 140]],
	["lavender", [230, 230, 250]],
	["lavenderblush", [255, 240, 245]],
	["lawngreen", [124, 252, 0]],
	["lemonchiffon", [255, 250, 205]],
	["lightblue", [173, 216, 230]],
	["lightcoral", [240, 128, 128]],
	["lightcyan", [224, 255, 255]],
	["lightgoldenrodyellow", [250, 250, 210]],
	["lightgray", [211, 211, 211]],
	["lightgreen", [144, 238, 144]],
	["lightgrey", [211, 211, 211]],
	["lightpink", [255, 182, 193]],
	["lightsalmon", [255, 160, 122]],
	["lightseagreen", [32, 178, 170]],
	["lightskyblue", [135, 206, 250]],
	["lightslategray", [119, 136, 153]],
	["lightslategrey", [119, 136, 153]],
	["lightsteelblue", [176, 196, 222]],
	["lightyellow", [255, 255, 224]],
	["limegreen", [50, 205, 50]],
	["linen", [250, 240, 230]],
	["mediumaquamarine", [102, 205, 170]],
	["mediumblue", [0, 0, 205]],
	["mediumorchid", [186, 85, 211]],
	["mediumpurple", [147, 112, 219]],
	["mediumseagreen", [60, 179, 113]],
	["mediumslateblue", [123, 104, 238]],
	["mediumspringgreen", [0, 250, 154]],
	["mediumturquoise", [72, 209, 204]],
	["mediumvioletred", [199, 21, 133]],
	["midnightblue", [25, 25, 112]],
	["mintcream", [245, 255, 250]],
	["mistyrose", [255, 228, 225]],
	["moccasin", [255, 228, 181]],
	["navajowhite", [255, 222, 173]],
	["oldlace", [253, 245, 230]],
	["olivedrab", [107, 142, 35]],
	["orangered", [255, 69, 0]],
	["orchid", [218, 112, 214]],
	["palegoldenrod", [238, 232, 170]],
	["palegreen", [152, 251, 152]],
	["paleturquoise", [175, 238, 238]],
	["palevioletred", [219, 112, 147]],
	["papayawhip", [255, 239, 213]],
	["peachpuff", [255, 218, 185]],
	["peru", [205, 133, 63]],
	["pink", [255, 192, 203]],
	["plum", [221, 160, 221]],
	["powderblue", [176, 224, 230]],
	["rosybrown", [188, 143, 143]],
	["royalblue", [65, 105, 225]],
	["saddlebrown", [139, 69, 19]],
	["salmon", [250, 128, 114]],
	["sandybrown", [244, 164, 96]],
	["seagreen", [46, 139, 87]],
	["seashell", [255, 245, 238]],
	["sienna", [160, 82, 45]],
	["skyblue", [135, 206, 235]],
	["slateblue", [106, 90, 205]],
	["slategray", [112, 128, 144]],
	["slategrey", [112, 128, 144]],
	["snow", [255, 250, 250]],
	["springgreen", [0, 255, 127]],
	["steelblue", [70, 130, 180]],
	["tan", [210, 180, 140]],
	["thistle", [216, 191, 216]],
	["tomato", [255, 99, 71]],
	["turquoise", [64, 224, 208]],
	["violet", [238, 130, 238]],
	["wheat", [245, 222, 179]],
	["whitesmoke", [245, 245, 245]],
	["yellowgreen", [154, 205, 50]],
] as const;

type ColorName = (typeof CSS_COLORS)[number][0];

const cssToRGB = new Map<ColorName, readonly [number, number, number]>();
for (const [name, rgb] of CSS_COLORS) {
	cssToRGB.set(name, rgb);
}

/**
 * A color manipulation object.
 */
export class Color {
	private glArray: Float32Array;

	/**
	 * Creates a new Color instance.
	 * @param r - A Color object or the red component [0 .. 255]. Defaults to 0.
	 * @param g - The green component [0 .. 255]. Defaults to 0.
	 * @param b - The blue component [0 .. 255]. Defaults to 0.
	 * @param alpha - The alpha value [0.0 .. 1.0]. Defaults to 1.
	 */
	constructor(r: Color | string | number = 0, g = 0, b = 0, alpha = 1.0) {
		if (typeof r === "number") {
			this.glArray = new Float32Array([0, 0, 0, 1]);
			this.setColor(r, g, b, alpha);
		} else if (typeof r === "string") {
			this.glArray = new Float32Array([0, 0, 0, 1]);
			this.parseCSS(r as ColorName);
		} else if (typeof r === "object") {
			this.glArray = r.glArray.slice();
		} else {
			throw new Error("Color: invalid parameter");
		}
	}

	/**
	 * Gets the red component of the color.
	 * @returns The red component [0 .. 255].
	 */
	get r() {
		return ~~(this.glArray[0] * 255);
	}

	/**
	 * Sets the red component of the color.
	 * @param value - The red component [0 .. 255].
	 */
	set r(value) {
		this.glArray[0] = clamp(value, 0, 255) / 255.0;
	}

	/**
	 * Gets the green component of the color.
	 * @returns The green component [0 .. 255].
	 */
	get g() {
		return ~~(this.glArray[1] * 255);
	}

	/**
	 * Sets the green component of the color.
	 * @param value - The green component [0 .. 255].
	 */
	set g(value) {
		this.glArray[1] = clamp(value, 0, 255) / 255.0;
	}

	/**
	 * Gets the blue component of the color.
	 * @returns The blue component [0 .. 255].
	 */
	get b() {
		return ~~(this.glArray[2] * 255);
	}

	/**
	 * Sets the blue component of the color.
	 * @param value - The blue component [0 .. 255].
	 */
	set b(value) {
		this.glArray[2] = clamp(value, 0, 255) / 255.0;
	}

	/**
	 * Gets the alpha component of the color.
	 * @returns The alpha component [0.0 .. 1.0].
	 */
	get alpha() {
		return this.glArray[3];
	}

	/**
	 * Sets the alpha component of the color.
	 * @param value - The alpha component [0.0 .. 1.0].
	 */
	set alpha(value) {
		this.glArray[3] = clamp(value, 0, 1.0);
	}

	/**
	 * Sets the color to the specified values.
	 * @param r - The red component [0 .. 255].
	 * @param g - The green component [0 .. 255].
	 * @param b - The blue component [0 .. 255].
	 * @param [alpha] - The alpha value [0.0 .. 1.0]. Defaults to 1.
	 * @returns Reference to this object for method chaining.
	 */
	setColor(r: number = 0, g: number = 0, b: number = 0, alpha = 1.0) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.alpha = alpha;

		return this;
	}

	/**
	 * Sets the color to the specified normalized float values.
	 * @param r - The red component [0.0 .. 1.0].
	 * @param g - The green component [0.0 .. 1.0].
	 * @param b - The blue component [0.0 .. 1.0].
	 * @param [alpha=1.0] - The alpha value [0.0 .. 1.0]. Defaults to 1.
	 * @returns Reference to this object for method chaining.
	 */
	setFloat(r: number, g: number, b: number, alpha = 1.0) {
		const a = this.glArray;
		a[0] = clamp(+r, 0, 1.0);
		a[1] = clamp(+g, 0, 1.0);
		a[2] = clamp(+b, 0, 1.0);
		a[3] = clamp(+alpha, 0, 1.0);
		return this;
	}

	/**
	 * Sets the color to the specified HSV values.
	 * @param h - The hue [0 .. 1].
	 * @param s - The saturation [0 .. 1].
	 * @param v - The value [0 .. 1].
	 * @returns Reference to this object for method chaining.
	 */
	setHSV(h: number, s: number, v: number) {
		let r: number;
		let g: number;
		let b: number;

		const i = Math.floor(h * 6);
		const f = h * 6 - i;
		const p = v * (1 - s);
		const q = v * (1 - f * s);
		const t = v * (1 - (1 - f) * s);

		switch ((i % 6) as 0 | 1 | 2 | 3 | 4 | 5) {
			case 0:
				r = v;
				g = t;
				b = p;
				break;
			case 1:
				r = q;
				g = v;
				b = p;
				break;
			case 2:
				r = p;
				g = v;
				b = t;
				break;
			case 3:
				r = p;
				g = q;
				b = v;
				break;
			case 4:
				r = t;
				g = p;
				b = v;
				break;
			case 5:
				r = v;
				g = p;
				b = q;
				break;
		}
		return this.setColor(r * 255, g * 255, b * 255);
	}

	/**
	 * Sets the color to the specified HSL values.
	 * @param h - The hue [0 .. 1].
	 * @param s - The saturation [0 .. 1].
	 * @param l - The lightness [0 .. 1].
	 * @returns Reference to this object for method chaining.
	 */
	setHSL(h: number, s: number, l: number) {
		let r;
		let g;
		let b;

		if (s === 0) {
			r = g = b = l; // achromatic
		} else {
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;

			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}

		return this.setColor(r * 255, g * 255, b * 255);
	}

	/**
	 * Creates a new copy of this color object.
	 * @returns Reference to the newly cloned object.
	 */
	clone() {
		return colorPool.get(this as Color);
	}

	/**
	 * Copies a color object or CSS color into this one.
	 * @param color - The color to copy.
	 * @returns Reference to this object for method chaining.
	 */
	copy(color: Color | string) {
		if (typeof color === "string") {
			return this.parseCSS(color as ColorName);
		} else {
			this.glArray.set(color.glArray);
			return this;
		}
	}

	/**
	 * Blends this color with the given one using addition.
	 * @param color - The color to blend with.
	 * @returns Reference to this object for method chaining.
	 */
	add(color: Color) {
		this.glArray[0] = clamp(this.glArray[0] + color.glArray[0], 0, 1);
		this.glArray[1] = clamp(this.glArray[1] + color.glArray[1], 0, 1);
		this.glArray[2] = clamp(this.glArray[2] + color.glArray[2], 0, 1);
		this.glArray[3] = (this.glArray[3] + color.glArray[3]) / 2;

		return this;
	}

	/**
	 * Darkens this color value by a given scale.
	 * @param scale - The scale to darken the color by [0 .. 1].
	 * @returns Reference to this object for method chaining.
	 */
	darken(scale: number) {
		scale = clamp(scale, 0, 1);
		this.glArray[0] *= scale;
		this.glArray[1] *= scale;
		this.glArray[2] *= scale;

		return this;
	}

	/**
	 * Linearly interpolates between this color and the given one.
	 * @param color - The color to interpolate with.
	 * @param alpha - The interpolation factor, with alpha = 0 being this color, and alpha = 1 being the given one.
	 * @returns Reference to this object for method chaining.
	 */
	lerp(color: Color, alpha: number) {
		alpha = clamp(alpha, 0, 1);
		this.glArray[0] += (color.glArray[0] - this.glArray[0]) * alpha;
		this.glArray[1] += (color.glArray[1] - this.glArray[1]) * alpha;
		this.glArray[2] += (color.glArray[2] - this.glArray[2]) * alpha;

		return this;
	}

	/**
	 * Lightens this color value by a given scale
	 * @param scale - The scale to lighten the color by [0 .. 1].
	 * @returns Reference to this object for method chaining.
	 */
	lighten(scale: number) {
		scale = clamp(scale, 0, 1);
		this.glArray[0] = clamp(
			this.glArray[0] + (1 - this.glArray[0]) * scale,
			0,
			1,
		);
		this.glArray[1] = clamp(
			this.glArray[1] + (1 - this.glArray[1]) * scale,
			0,
			1,
		);
		this.glArray[2] = clamp(
			this.glArray[2] + (1 - this.glArray[2]) * scale,
			0,
			1,
		);

		return this;
	}

	/**
	 * Generate random r,g,b values for this color object
	 * @param [min] - minimum value for the random range
	 * @param [max] - maxmium value for the random range
	 * @returns Reference to this object for method chaining
	 */
	random(min = 0, max = 255) {
		if (min < 0) {
			min = 0;
		}
		if (max > 255) {
			max = 255;
		}

		return this.setColor(
			random(min, max),
			random(min, max),
			random(min, max),
			this.alpha,
		);
	}

	/**
	 * Checks if this color is equal to another.
	 * @param color - The color to compare with.
	 * @returns True if the colors are equal, otherwise false.
	 */
	equals(color: Color) {
		return (
			this.glArray[0] === color.glArray[0] &&
			this.glArray[1] === color.glArray[1] &&
			this.glArray[2] === color.glArray[2] &&
			this.glArray[3] === color.glArray[3]
		);
	}

	/**
	 * Parse a CSS color name and set this color to the corresponding r,g,b values
	 * @param cssColor - The CSS color name
	 * @returns Reference to this object for method chaining
	 */
	parseCSS(cssColor: string) {
		const rgb = cssToRGB.get(cssColor as ColorName);
		if (!rgb) {
			return this.parseRGB(cssColor);
		}
		return this.setColor(...rgb);
	}

	/**
	 * Parse an RGB or RGBA CSS color string
	 * @param rgbColor - The RGB or RGBA color string to parse
	 * @returns Reference to this object for method chaining
	 */
	parseRGB(rgbColor: string) {
		// TODO : Memoize this function by caching its input

		const match = rgbaRx.exec(rgbColor);
		if (!match) {
			return this.parseHex(rgbColor as `#${string}`);
		}
		return this.setColor(
			+match[1],
			+match[2],
			+match[3],
			typeof match[5] !== "undefined" ? +match[5] : 1,
		);
	}

	/**
	 * Parse a Hex color ("#RGB", "#RGBA" or "#RRGGBB", "#RRGGBBAA" format) and set this color to
	 * the corresponding r,g,b,a values
	 * @param hexColor - The Hex color string to parse
	 * @param [argb] - true if format is #ARGB, or #AARRGGBB (as opposed to #RGBA or #RGGBBAA)
	 * @returns Reference to this object for method chaining
	 */
	parseHex(hexColor: `#${string}`, argb = false) {
		// TODO : Memoize this function by caching its input

		let match: RegExpExecArray | null;
		if ((match = hex8Rx.exec(hexColor))) {
			// #AARRGGBB or #RRGGBBAA
			return this.setColor(
				parseInt(match[!argb ? 1 : 2], 16), // r
				parseInt(match[!argb ? 2 : 3], 16), // g
				parseInt(match[!argb ? 3 : 4], 16), // b
				Number(
					(clamp(parseInt(match[!argb ? 4 : 1], 16), 0, 255) / 255.0).toFixed(
						1,
					),
				), // a
			);
		}

		if ((match = hex6Rx.exec(hexColor))) {
			// #RRGGBB
			return this.setColor(
				parseInt(match[1], 16),
				parseInt(match[2], 16),
				parseInt(match[3], 16),
			);
		}

		if ((match = hex4Rx.exec(hexColor))) {
			// #ARGB or #RGBA
			const r = match[!argb ? 1 : 2];
			const g = match[!argb ? 2 : 3];
			const b = match[!argb ? 3 : 4];
			const a = match[!argb ? 4 : 1];
			return this.setColor(
				parseInt(r + r, 16), // r
				parseInt(g + g, 16), // g
				parseInt(b + b, 16), // b
				Number((clamp(parseInt(a + a, 16), 0, 255) / 255.0).toFixed(1)), // a
			);
		}

		if ((match = hex3Rx.exec(hexColor))) {
			// #RGB
			return this.setColor(
				parseInt(match[1] + match[1], 16),
				parseInt(match[2] + match[2], 16),
				parseInt(match[3] + match[3], 16),
			);
		}

		throw new Error(`invalid parameter: ${hexColor}`);
	}

	/**
	 * Pack this color RGB components into a Uint32 ARGB representation
	 * @param [alpha] - alpha value [0.0 .. 1.0]
	 * @returns A Uint32 ARGB representation of this color
	 */
	toUint32(alpha = 1.0) {
		const a = this.glArray;

		const ur = (a[0] * 255) >> 0;
		const ug = (a[1] * 255) >> 0;
		const ub = (a[2] * 255) >> 0;

		return (((alpha * 255) >> 0) << 24) | (ur << 16) | (ug << 8) | ub;
	}

	/**
	 * return an Float Array representation of this object
	 * @returns A Float Array representation of this color
	 */
	toArray() {
		return this.glArray;
	}

	/**
	 * return the color in "#RRGGBB" format
	 * @returns The color in "#RRGGBB" format
	 */
	toHex() {
		// TODO : Memoize this function by caching its result until any of
		// the r,g,b,a values are changed

		return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}`;
	}

	/**
	 * Get the color in "#RRGGBBAA" format
	 * @param alpha - The alpha value [0.0 .. 1.0] to use in the output string.
	 * @returns The color in "#RRGGBBAA" format
	 */
	toHex8(alpha = this.alpha) {
		// TODO : Memoize this function by caching its result until any of
		// the r,g,b,a values are changed

		return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}${toHex(alpha * 255)}`;
	}

	/**
	 * Get the color in "rgb(R,G,B)" format
	 * @returns The color in "rgb(R,G,B)" format
	 */
	toRGB() {
		// TODO : Memoize this function by caching its result until any of
		// the r,g,b,a values are changed

		return `rgb(${this.r},${this.g},${this.b})` as const;
	}

	/**
	 * Get the color in "rgba(R,G,B,A)" format
	 * @param [alpha] - alpha value [0.0 .. 1.0]
	 * @returns The color in "rgba(R,G,B,A)" format
	 */
	toRGBA(alpha = this.alpha) {
		// TODO : Memoize this function by caching its result until any of
		// the r,g,b,a values are changed

		return `rgba(${this.r},${this.g},${this.b},${alpha})` as const;
	}
}

export const colorPool = createPool<
	Color,
	[
		r?: number | string | Color | undefined,
		g?: number | undefined,
		b?: number | undefined,
		alpha?: number | undefined,
	]
>((r, g, b, alpha) => {
	const color = new Color(r, g, b, alpha);
	return {
		instance: color,
		reset(r, g, b, alpha) {
			if (arguments.length === 0) {
				color.setColor();
			} else {
				if (typeof r === "number") {
					color.setColor(r, g, b, alpha);
				} else {
					color.copy(r as Color | string);
				}
			}
		},
	};
});
