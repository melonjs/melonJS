import { getDefaultShape } from "../TMXObjectFactory.js";

/**
 * create a renderable from an embedded tile object
 * @param {object} settings - TMX object settings
 * @returns {Renderable} the created tile object
 * @ignore
 */
export function createTileObject(settings) {
	const shape = getDefaultShape(settings);
	const obj = settings.tile.getRenderable(settings);
	// declarative body — auto-registered with the active adapter when
	// the renderable is added to the world tree. `getDefaultShape` may
	// return either a single shape or an array (parseTMXShapes returns
	// an array for polygon/polyline/ellipse types), so normalize.
	obj.bodyDef = {
		type: "static",
		shapes: Array.isArray(shape) ? shape : [shape],
	};
	obj.pos.setMuted(settings.x, settings.y, settings.z);
	return obj;
}
