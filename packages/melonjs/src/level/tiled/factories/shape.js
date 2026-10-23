import { boundsPool } from "../../../physics/bounds.ts";
import Renderable from "../../../renderable/renderable.js";
import { getDefaultShape } from "../TMXObjectFactory.js";

/**
 * create an unnamed shape object (Renderable with a static adapter-managed body)
 * @param {object} settings - TMX object settings
 * @returns {Renderable} the created shape object
 * @ignore
 * @internal
 */
export function createShapeObject(settings) {
	const shape = getDefaultShape(settings);
	if (!shape || (Array.isArray(shape) && shape.length === 0)) {
		// Bail out loudly instead of poisoning `bodyDef.shapes` with
		// `[undefined]` and letting downstream `addShapes` / adapter
		// `addBody` blow up with an unhelpful "cannot read shape" later.
		throw new Error(
			`melonJS: TMX object (id=${settings.id}, name=${settings.name ?? ""}, type=${settings.type ?? ""}) has no usable collision shape. Check the object's geometry in Tiled.`,
		);
	}
	const shapes = Array.isArray(shape) ? shape : [shape];

	// Size from the union of all shapes' bounds — the body isn't built
	// until adapter auto-registration, so we can't read body.getBounds().
	const bounds = boundsPool.get();
	bounds.addShapes(shapes, true);
	const { left, top, width, height } = bounds;
	boundsPool.release(bounds);

	// The object's bounds start at its pos, and the broadphase files it by
	// them, but the shapes can start anywhere: every rectangle on an
	// isometric map reaches left of its origin once projected, and so does
	// a polygon drawn up or left from its first point. Start the object
	// where the shapes start, and move the shapes back by as much, so they
	// stay where they are. A point has no extent, and keeps its position.
	let x = settings.x;
	let y = settings.y;
	if ((width > 0 || height > 0) && (left !== 0 || top !== 0)) {
		x += left;
		y += top;
		for (const s of shapes) {
			s.translate(-left, -top);
		}
	}

	const obj = new Renderable(x, y, width, height);
	obj.anchorPoint.set(0, 0);
	obj.name = settings.name;
	obj.type = settings.type;
	obj.class = settings.class || settings.type;
	obj.id = settings.id;
	// declarative body — adapter-portable, auto-registered on addChild
	obj.bodyDef = {
		type: "static",
		shapes,
	};
	obj.pos.z = settings.z;
	return obj;
}
