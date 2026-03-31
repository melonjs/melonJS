import Body from "../../../physics/body.js";
import Renderable from "../../../renderable/renderable.js";
import { getDefaultShape } from "../TMXObjectFactory.js";

/**
 * create an unnamed shape object (Renderable with a static Body)
 * @param {object} settings - TMX object settings
 * @returns {Renderable} the created shape object
 * @ignore
 */
export function createShapeObject(settings) {
	const obj = new Renderable(
		settings.x,
		settings.y,
		settings.width,
		settings.height,
	);
	const shape = getDefaultShape(settings);
	obj.anchorPoint.set(0, 0);
	obj.name = settings.name;
	obj.type = settings.type;
	obj.class = settings.class || settings.type;
	obj.id = settings.id;
	obj.body = new Body(obj, shape);
	obj.body.setStatic(true);
	obj.resize(obj.body.getBounds().width, obj.body.getBounds().height);
	obj.pos.z = settings.z;
	return obj;
}
