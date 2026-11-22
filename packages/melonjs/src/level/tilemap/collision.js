import { collision } from "../../physics/collision.js";
import { COLLISION_GROUP } from "../tiled/constants.js";

/**
 * additional import for TypeScript
 * @import Renderable from "../../renderable/renderable.js";
 */

/**
 * Whether a layer is a level's collision layer, by its name: it contains
 * "collision", in any case ("collision", "Collisions", "world collision").
 * The convention of every level format: an object layer of a Tiled map, an
 * IntGrid layer of an LDtk level.
 * @param {string} name - the layer's name
 * @returns {boolean} true if it is
 * @ignore
 */
export function isCollisionLayerName(name) {
	return name.toLowerCase().includes(COLLISION_GROUP);
}

/**
 * Make an object a wall of the world: static, of collision type
 * `WORLD_SHAPE`. What an unnamed object of a collision layer becomes.
 *
 * An object built by a factory carries a `bodyDef` (declarative, the same
 * under every physics adapter), which the world makes a body of when the
 * object is added: the definition is what changes. An object that still
 * carries a body made by hand is changed in place.
 * @param {Renderable} obj - the object
 * @ignore
 */
export function markWorldShape(obj) {
	if (obj.bodyDef) {
		obj.bodyDef.collisionType = collision.types.WORLD_SHAPE;
		obj.bodyDef.type = "static";
	} else if (obj.body) {
		obj.body.collisionType = collision.types.WORLD_SHAPE;
		obj.body.isStatic = true;
	}
}
