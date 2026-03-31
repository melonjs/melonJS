import Body from "../../../physics/body.js";
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
	obj.body = new Body(obj, shape);
	obj.body.setStatic(true);
	obj.pos.setMuted(settings.x, settings.y, settings.z);
	return obj;
}
