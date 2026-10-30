import { warnOnce } from "../../lang/console.js";
import { imgList } from "../../loader/cache.js";
import { colorPool } from "../../math/color.ts";
import { decode, decodeBase64Image } from "../../utils/decode.ts";
import { xmlToObject } from "../../utils/xml.ts";
import { createCanvas } from "../../video/canvas_factory.js";

// counter for generating unique cache keys for embedded images
let embeddedImageId = 0;

/**
 * Decode an embedded base64 image, cache it in imgList, and return
 * a generated filename (with extension) suitable for getImage().
 * Works for both XML-parsed data (base64 string) and JSON data.
 * @ignore
 * @internal
 * @param {string} base64 - raw base64-encoded image data
 * @param {string} [format="png"] - image format
 * @param {number} [width] - image width hint
 * @param {number} [height] - image height hint
 * @returns {string} generated filename (e.g. "__embedded_0.png")
 */
export function cacheEmbeddedImage(base64, format = "png", width, height) {
	const name = `__embedded_${embeddedImageId++}`;
	imgList[name] = decodeBase64Image(base64, format, width, height);
	return `${name}.${format}`;
}

/**
 * If the given data object has an embedded base64 image (JSON `imagedata`
 * property), decode it, cache it, and replace with a generated filename.
 * @ignore
 * @internal
 * @param {object} data - tileset, tile, or layer data
 */
export function resolveEmbeddedImage(data) {
	if (data.imagedata) {
		const format = data.imageformat || "png";
		data.image = cacheEmbeddedImage(
			data.imagedata,
			format,
			data.imagewidth ? +data.imagewidth : undefined,
			data.imageheight ? +data.imageheight : undefined,
		);
		delete data.imagedata;
		delete data.imageformat;
	}
}

/**
 * Convert a Tiled blend mode name to a canonical melonJS blend mode.
 * Tiled uses "add" for additive blending; melonJS renderers accept
 * "add", "additive", and "lighter" as equivalent. This helper normalizes
 * the Tiled "add" value to "lighter" for internal consistency.
 * Returns "normal" when the mode is undefined or explicitly "normal";
 * all other values are passed through to the renderer (which will fall
 * back to "normal" for unsupported modes).
 * @param {string} [mode] - the Tiled blend mode
 * @returns {string} the melonJS blend mode name
 */
export function tiledBlendMode(mode) {
	if (typeof mode === "undefined" || mode === "normal") {
		return "normal";
	}
	return mode === "add" ? "lighter" : mode;
}

/**
 * Apply an opacity multiplier to a renderable and its child renderable (if any).
 * @ignore
 * @internal
 * @param {Renderable} obj - the renderable to apply to
 * @param {number} opacity - the opacity multiplier
 */
export function applyObjectOpacity(obj, opacity) {
	obj.setOpacity(obj.getOpacity() * opacity);
	if (
		typeof obj.renderable !== "undefined" &&
		obj.renderable.isRenderable === true
	) {
		obj.renderable.setOpacity(obj.renderable.getOpacity() * opacity);
	}
}

/**
 * Propagate a blend mode to a renderable and its child renderable (if any).
 * Only applies when the object still has the default "normal" blend mode.
 * @ignore
 * @internal
 * @param {Renderable} obj - the renderable to apply to
 * @param {string} blendMode - the blend mode to propagate
 */
export function propagateBlendMode(obj, blendMode) {
	if (
		blendMode !== "normal" &&
		obj.isRenderable === true &&
		obj.blendMode === "normal"
	) {
		obj.blendMode = blendMode;
		if (
			typeof obj.renderable !== "undefined" &&
			obj.renderable.isRenderable === true &&
			obj.renderable.blendMode === "normal"
		) {
			obj.renderable.blendMode = blendMode;
		}
	}
}

/**
 * Parse a Tiled tint color hex string into a melonJS Color object.
 * @ignore
 * @internal
 * @param {string} tintcolor - hex color string from Tiled (e.g. "#ff0000")
 * @returns {Color|undefined} parsed Color, or undefined if no tint
 */
export function parseTintColor(tintcolor) {
	if (typeof tintcolor !== "undefined") {
		return colorPool.get().parseHex(tintcolor, true);
	}
	return undefined;
}

// the images a transparent color was applied to: per image, the result
// for each color, so tilesets sharing an image share one copy
const keyedImages = new WeakMap();

/**
 * An image with Tiled's transparent color applied: every pixel of exactly
 * that color made transparent, as Tiled draws it (the `trans` attribute of
 * an `<image>`, `transparentcolor` in JSON). Done once, on a copy of the
 * image, cached per image and color; the image itself is left untouched.
 * An image that cannot be read back, a compressed texture or one from
 * another origin loaded without CORS, is returned as it is, with a warning.
 * @ignore
 * @internal
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image - the image
 * @param {string} [color] - the color, `"#ff00ff"` or `"ff00ff"`
 * @returns {HTMLImageElement|HTMLCanvasElement|ImageBitmap} the image with
 *   that color transparent, or the image itself when there is no color
 */
export function applyTransparentColor(image, color) {
	if (typeof color !== "string" || color === "" || !image) {
		return image;
	}
	// #RRGGBB, or #AARRGGBB whose alpha says nothing here
	const hex = color.replace(/^#/, "").slice(-6).toLowerCase();
	if (!/^[\da-f]{6}$/.test(hex)) {
		return image;
	}
	let byColor = keyedImages.get(image);
	if (byColor === undefined) {
		byColor = new Map();
		keyedImages.set(image, byColor);
	}
	let keyed = byColor.get(hex);
	if (keyed !== undefined) {
		return keyed;
	}
	const width = image.naturalWidth || image.width;
	const height = image.naturalHeight || image.height;
	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d", { willReadFrequently: true });
	let pixels;
	try {
		// a compressed texture cannot be drawn on a canvas, and an image
		// from another origin cannot be read back without CORS
		context.drawImage(image, 0, 0);
		pixels = context.getImageData(0, 0, width, height);
	} catch {
		warnOnce(
			'melonJS: a Tiled transparent color could not be applied to an image that cannot be read back (a compressed texture, or an image from another origin: load it with `loader.setOptions({ crossOrigin: "anonymous" })` from a server sending CORS headers); it is drawn as it is',
		);
		byColor.set(hex, image);
		return image;
	}
	const r = parseInt(hex.slice(0, 2), 16);
	const g = parseInt(hex.slice(2, 4), 16);
	const b = parseInt(hex.slice(4, 6), 16);
	const data = pixels.data;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i] === r && data[i + 1] === g && data[i + 2] === b) {
			data[i + 3] = 0;
		}
	}
	context.putImageData(pixels, 0, 0);
	keyed = canvas;
	byColor.set(hex, keyed);
	return keyed;
}

// pre-compiled regex for #ARGB → #RGBA color conversion
// matches #ARGB (5 chars) or #AARRGGBB (9 chars)
const SHORT_ARGB = /^#([\da-fA-F])([\da-fA-F]{3})$/;
const LONG_ARGB = /^#([\da-fA-F]{2})([\da-fA-F]{6})$/;

/**
 * Coerce a raw TMX property string into its typed JS value.
 * Handles int, float, bool, json:, eval:, #ARGB colors,
 * and auto-detection for untyped properties.
 * @ignore
 * @internal
 * @param {string} name - property name (used for ratio/anchorPoint normalization)
 * @param {string} type - declared Tiled type ("int","float","bool","string", etc.)
 * @param {*} raw - raw value (string from XML, or already-typed from JSON)
 * @returns {*} coerced value
 */
function coerceTMXValue(name, type, raw) {
	if (typeof raw !== "string" && type !== "list") {
		// already typed (e.g. JSON maps with native bool/number values)
		return raw;
	}

	switch (type) {
		case "int":
		case "float":
			return Number(raw);

		case "bool":
			return raw === "true";

		case "list":
			// JSON list property: value is an array of { type, value } objects
			if (Array.isArray(raw)) {
				return raw.map((item) => {
					// use "" as name to avoid name-dependent coercions (e.g. ratio/anchorPoint)
					return coerceTMXValue("", item.type || "string", item.value);
				});
			}
			// XML list: items already collected as array by normalizeTMX
			return raw;

		default:
			break;
	}

	// --- untyped / "string" type: auto-detect ---

	// empty string → true (legacy TMX flag behavior)
	if (raw === "") {
		return true;
	}

	// boolean strings
	if (raw === "true" || raw === "false") {
		return raw === "true";
	}

	// numeric strings — inline check avoids function-call overhead
	// matches: optional sign, digits with optional decimal, or leading decimal
	if (
		raw === raw.trim() &&
		raw !== "" &&
		!Number.isNaN(+raw) &&
		/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(raw)
	) {
		const num = Number(raw);
		// ratio and anchorPoint are expanded to {x, y} vectors
		if (name === "ratio" || name === "anchorPoint") {
			return { x: num, y: num };
		}
		return num;
	}

	// json: prefix (case-insensitive)
	if ((raw.length > 5 && raw[0] === "j") || raw[0] === "J") {
		const lower = raw.slice(0, 5).toLowerCase();
		if (lower === "json:") {
			const body = raw.slice(5);
			try {
				return JSON.parse(body);
			} catch {
				throw new Error(`Unable to parse JSON: ${body}`);
			}
		}
	}

	// eval: prefix (case-insensitive)
	if (raw.length > 5 && (raw[0] === "e" || raw[0] === "E")) {
		const lower = raw.slice(0, 5).toLowerCase();
		if (lower === "eval:") {
			const expr = raw.slice(5);
			try {
				// eslint-disable-next-line
				return Function(`'use strict';return (${expr})`)();
			} catch {
				throw new Error(`Unable to evaluate: ${expr}`);
			}
		}
	}

	// #ARGB → #RGBA color conversion (Tiled stores alpha first)
	let colorMatch;
	if (
		raw[0] === "#" &&
		((colorMatch = SHORT_ARGB.exec(raw)) || (colorMatch = LONG_ARGB.exec(raw)))
	) {
		return `#${colorMatch[2]}${colorMatch[1]}`;
	}

	// plain string — return as-is
	return raw;
}

/**
 * Keep the transparent color of an `<image>` (its `trans` attribute, as
 * `RRGGBB`) on the object it belongs to, under the key the JSON format uses
 * @ignore
 * @internal
 */
function keepTransparentColor(obj) {
	const trans = obj.image.trans;
	if (typeof trans === "string" && trans !== "") {
		obj.transparentcolor = trans.startsWith("#") ? trans : `#${trans}`;
	}
}

/**
 * Flatten image child object into parent (used by tile and tileset).
 * Moves source → image, width → imagewidth, height → imageheight.
 * For embedded images (no source, has data), decodes and caches the image.
 * @ignore
 * @internal
 */
function flattenImage(obj) {
	if (obj.image) {
		obj.imagewidth = obj.image.width;
		obj.imageheight = obj.image.height;
		keepTransparentColor(obj);
		if (obj.image.source) {
			obj.image = obj.image.source;
		} else if (obj.image.data) {
			// embedded XML image: <data encoding="base64">...</data>
			const format = obj.image.format || "png";
			const base64 = obj.image.data.text || obj.image.data;
			obj.image = cacheEmbeddedImage(
				base64,
				format,
				obj.image.width ? +obj.image.width : undefined,
				obj.image.height ? +obj.image.height : undefined,
			);
		} else {
			obj.image = obj.image.source;
		}
	}
}

/**
 * Normalizer callback for xmlToObject — converts TMX XML into Tiled JSON format.
 * @ignore
 * @internal
 */
function normalizeTMX(obj, item, parse) {
	const nodeName = item.nodeName;

	switch (nodeName) {
		case "data": {
			const data = parse(item);
			const encoding = data.encoding || "xml";
			const compression = data.compression;

			// infinite maps: decode each chunk
			if (data.chunks !== undefined) {
				const srcChunks = data.chunks;
				const chunks = obj.chunks || (obj.chunks = []);
				for (let i = 0, len = srcChunks.length; i < len; i++) {
					const c = srcChunks[i];
					chunks.push({
						x: +c.x,
						y: +c.y,
						width: +c.width,
						height: +c.height,
						data: decode(c.text, encoding, compression),
					});
				}
				obj.encoding = "none";
			}

			// finite maps (guard: data.text can exist alongside chunks)
			if (data.text !== undefined && obj.chunks === undefined) {
				obj.data = decode(data.text, encoding, compression);
				obj.encoding = "none";
			}
			break;
		}

		case "chunk": {
			const chunks = obj.chunks || (obj.chunks = []);
			chunks.push(parse(item));
			break;
		}

		case "imagelayer":
		case "layer":
		case "objectgroup":
		case "group": {
			const layer = parse(item);
			layer.type = nodeName === "layer" ? "tilelayer" : nodeName;
			if (layer.image) {
				// flattenImage equivalent for image layers
				keepTransparentColor(layer);
				if (layer.image.source) {
					layer.image = layer.image.source;
				} else if (layer.image.data) {
					const format = layer.image.format || "png";
					const base64 = layer.image.data.text || layer.image.data;
					layer.image = cacheEmbeddedImage(
						base64,
						format,
						layer.image.width ? +layer.image.width : undefined,
						layer.image.height ? +layer.image.height : undefined,
					);
				}
			}
			const layers = obj.layers || (obj.layers = []);
			layers.push(layer);
			break;
		}

		case "animation":
			obj.animation = parse(item).frames;
			break;

		case "frame":
		case "object": {
			const key = nodeName + "s";
			const arr = obj[key] || (obj[key] = []);
			arr.push(parse(item));
			break;
		}

		case "tile": {
			const tile = parse(item);
			flattenImage(tile);
			const tiles = obj.tiles || (obj.tiles = {});
			tiles[tile.id] = tile;
			break;
		}

		case "tileset": {
			const tileset = parse(item);
			flattenImage(tileset);
			const tilesets = obj.tilesets || (obj.tilesets = []);
			tilesets.push(tileset);
			break;
		}

		case "polygon":
		case "polyline": {
			const raw = parse(item).points;
			const pairs = raw.split(" ");
			const points = new Array(pairs.length);
			for (let i = 0, len = pairs.length; i < len; i++) {
				const sep = pairs[i].indexOf(",");
				points[i] = {
					x: +pairs[i].slice(0, sep),
					y: +pairs[i].slice(sep + 1),
				};
			}
			obj[nodeName] = points;
			break;
		}

		case "properties":
			obj.properties = parse(item);
			break;

		case "item": {
			// list item: coerce and append to the parent's items array
			const itemData = parse(item);
			const items = obj.items || (obj.items = []);
			items.push(
				coerceTMXValue(
					"",
					itemData.type || "string",
					itemData.value !== undefined ? itemData.value : itemData.text,
				),
			);
			break;
		}

		case "property": {
			const prop = parse(item);
			if (prop.type === "class") {
				// class properties have nested <properties> with member values
				obj[prop.name] = prop.properties || {};
			} else if (prop.type === "list") {
				// list properties: items collected via "item" case above
				obj[prop.name] = prop.items || [];
			} else {
				obj[prop.name] = coerceTMXValue(
					prop.name,
					// in XML, type is undefined for "string" values
					prop.type || "string",
					prop.value !== undefined ? prop.value : prop.text,
				);
			}
			break;
		}

		case "image":
			// parse <image> without the TMX normalizer so that a <data> child
			// (embedded base64 image) is not mistakenly decoded as tile layer data
			obj.image = xmlToObject(item);
			break;

		default:
			obj[nodeName] = parse(item);
			break;
	}
}

/**
 * a collection of utility functions for parsing TMX maps
 * @namespace TMXUtils
 */

// re-export generic decode utilities so existing consumers of TMXUtils can still access them
export { decode, setInflateFunction } from "../../utils/decode.ts";

/**
 * Parse a XML TMX object and returns the corresponding javascript object
 * @param {Document} xml - XML TMX object
 * @returns {object} Javascript object
 */
export function parse(xml) {
	return xmlToObject(xml, normalizeTMX);
}

/**
 * Apply TMX Properties to the given object
 * @param {object} obj - object to apply the properties to
 * @param {object} data - TMX data object
 */
export function applyTMXProperties(obj, data) {
	const properties = data.properties;
	if (properties === undefined) {
		return;
	}

	// new Tiled JSON format: array of { name, type, value }
	if (Array.isArray(properties)) {
		for (let i = 0, len = properties.length; i < len; i++) {
			const prop = properties[i];
			obj[prop.name] = coerceTMXValue(
				prop.name,
				prop.type || "string",
				prop.value,
			);
		}
		return;
	}

	// old JSON format: flat { key: value } with optional separate propertytypes
	const types = data.propertytypes;
	const keys = Object.keys(properties);
	for (let i = 0, len = keys.length; i < len; i++) {
		const key = keys[i];
		const prop = properties[key];

		// old "new" format: { 0: { name, type, value }, 1: ... }
		// require numeric key + name + type to avoid matching class property values
		if (
			prop !== null &&
			typeof prop === "object" &&
			!isNaN(key) &&
			prop.name !== undefined &&
			prop.type !== undefined
		) {
			obj[prop.name] = coerceTMXValue(
				prop.name,
				prop.type || "string",
				prop.value !== undefined ? prop.value : prop,
			);
		} else {
			// flat key-value pair
			const type = types !== undefined ? types[key] : "string";
			obj[key] = coerceTMXValue(key, type, prop);
		}
	}
}
