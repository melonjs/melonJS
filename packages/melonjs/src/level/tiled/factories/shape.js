import { boundsPool } from "../../../physics/bounds.ts";
import Renderable from "../../../renderable/renderable.js";
import { getDefaultShape } from "../TMXObjectFactory.js";

/**
 * create an unnamed shape object (Renderable with a static adapter-managed body)
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
	if (!shape || (Array.isArray(shape) && shape.length === 0)) {
		// Bail out loudly instead of poisoning `bodyDef.shapes` with
		// `[undefined]` and letting downstream `addShapes` / adapter
		// `addBody` blow up with an unhelpful "cannot read shape" later.
		throw new Error(
			`melonJS: TMX object (id=${settings.id}, name=${settings.name ?? ""}, type=${settings.type ?? ""}) has no usable collision shape. Check the object's geometry in Tiled.`,
		);
	}
	obj.anchorPoint.set(0, 0);
	obj.name = settings.name;
	obj.type = settings.type;
	obj.class = settings.class || settings.type;
	obj.id = settings.id;
	// declarative body — adapter-portable, auto-registered on addChild
	obj.bodyDef = {
		type: "static",
		shapes: Array.isArray(shape) ? shape : [shape],
	};
	// Size from the union of all shapes' bounds — the body isn't built
	// until adapter auto-registration, so we can't read body.getBounds().
	const bounds = boundsPool.get();
	bounds.addShapes(obj.bodyDef.shapes, true);
	obj.resize(bounds.width, bounds.height);
	boundsPool.release(bounds);
	obj.pos.z = settings.z;
	return obj;
}
