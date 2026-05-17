import { polygonPool } from "../geometries/polygon.ts";
import { vector2dPool } from "../math/vector2d.ts";
import { collision } from "./../physics/collision.js";
import Sprite from "./sprite.js";

/**
 * a basic collectable helper class for immovable object (e.g. a coin)
 * @category Game Objects
 */
export default class Collectable extends Sprite {
	/**
	 * @param {number} x - the x coordinates of the collectable
	 * @param {number} y - the y coordinates of the collectable
	 * @param {object} settings - See {@link Sprite}
	 */
	constructor(x, y, settings) {
		// call the super constructor
		super(x, y, settings);

		this.name = settings.name;
		this.type = settings.type;
		this.id = settings.id;

		// add and configure the physic body
		let shape = settings.shapes;
		if (typeof shape === "undefined") {
			shape = polygonPool.get(0, 0, [
				vector2dPool.get(0, 0),
				vector2dPool.get(this.width, 0),
				vector2dPool.get(this.width, this.height),
			]);
		}
		// declarative body — adapter-portable, auto-registered on addChild.
		// `isSensor: true` matches the documented intent ("immovable
		// object, picked up on overlap"): collision events still fire so
		// the pickup callback runs, but the solver does not physically
		// push the player away. Under the builtin adapter this is a
		// no-op for Collectable subclasses that don't define
		// `onCollision` (the SAT detector already skipped push-out);
		// under Matter it is required — matter's solver always resolves
		// contacts unless a body is flagged as a sensor.
		this.bodyDef = {
			type: "static",
			shapes: Array.isArray(shape) ? shape : [shape],
			collisionType: collision.types.COLLECTABLE_OBJECT,
			// by default only collides with PLAYER_OBJECT
			collisionMask: collision.types.PLAYER_OBJECT,
			isSensor: true,
		};

		// Update anchorPoint
		if (settings.anchorPoint) {
			this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
		} else {
			// for backward compatibility
			this.anchorPoint.set(0, 0);
		}
	}
}
