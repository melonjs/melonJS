import { getImage } from "../../loader/loader.js";
import { vector2dPool } from "../../math/vector2d.ts";
import ImageLayer from "../../renderable/imagelayer.js";
import {
	applyTMXProperties,
	applyTransparentColor,
	parseTintColor,
	resolveEmbeddedImage,
	tiledBlendMode,
	tiledParallaxFactor,
} from "./TMXUtils.js";

/**
 * @import TileMap from "./TileMap.js";
 */

/**
 * Build the image layer a Tiled map describes: at the map's top level, or
 * inside a group layer (which then gives it its own offset, parallax factor
 * and tint on top: see TMXGroup).
 * @param {TileMap} map - the map
 * @param {object} data - the layer, as Tiled saves it
 * @param {number} z - the layer's depth
 * @returns {ImageLayer} the layer
 * @ignore
 * @internal
 */
export function readImageLayer(map, data, z) {
	// resolve embedded JSON image data if present
	resolveEmbeddedImage(data);

	// the layer's custom values, read into an object of their own: the
	// map's data is left as it is, to be read again on the next load
	const properties = {};
	applyTMXProperties(properties, data);

	// derive repeat mode: legacy custom "repeat" property takes precedence
	// (for backward compatibility), then Tiled 1.8+ native repeatx/repeaty
	const repX = data.repeatx === true || data.repeatx === "1";
	const repY = data.repeaty === true || data.repeaty === "1";
	let repeat = properties.repeat;
	if (typeof repeat === "undefined" && (repX || repY)) {
		if (repX && repY) {
			repeat = "repeat";
		} else if (repX) {
			repeat = "repeat-x";
		} else {
			repeat = "repeat-y";
		}
	}

	// Tiled 1.8+ parallax origin (map-level, baked into layer offset)
	const pox = +(map.data.parallaxoriginx ?? 0);
	const poy = +(map.data.parallaxoriginy ?? 0);
	const ratioX = tiledParallaxFactor(data.parallaxx);
	const ratioY = tiledParallaxFactor(data.parallaxy);
	const ox = +(data.offsetx ?? data.x ?? 0) + pox * ratioX;
	const oy = +(data.offsety ?? data.y ?? 0) + poy * ratioY;

	// create the layer
	const imageLayer = new ImageLayer(
		ox,
		oy,
		Object.assign(
			{
				name: data.name,
				// its transparent color applied, when Tiled gives one
				image:
					typeof data.transparentcolor === "string"
						? (applyTransparentColor(
								getImage(data.image),
								data.transparentcolor,
							) ?? data.image)
						: data.image,
				ratio: vector2dPool.get(ratioX, ratioY),
				tint: parseTintColor(data.tintcolor),
				z: z,
				repeat: repeat,
			},
			properties,
		),
	);

	// set some additional flags
	const visible = data.visible ?? true;
	imageLayer.setOpacity(visible ? +data.opacity : 0);

	// layer blend mode (Tiled 1.12+)
	imageLayer.blendMode = tiledBlendMode(data.mode);

	return imageLayer;
}
