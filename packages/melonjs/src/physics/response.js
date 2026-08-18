import { Vector2d } from "../math/vector2d.ts";

/**
 * An object representing the result of an intersection.
 * @typedef {object} ResponseObject
 * @property {Renderable} a The first object participating in the intersection
 * @property {Renderable} b The second object participating in the intersection
 * @property {number} overlap Magnitude of the overlap on the shortest colliding axis
 * @property {Vector2d} overlapV The overlap vector (i.e. `overlapN.scale(overlap, overlap)`). If this vector is subtracted from the position of a, a and b will no longer be colliding
 * @property {Vector2d} overlapN The shortest colliding axis (unit-vector)
 * @property {number} overlapNZ The Z component of the shortest colliding axis, as a unit scalar (`-1`, `0` or `1`). Always `0` for a collision between planar shapes
 * @property {number} overlapZ The Z component of the overlap vector (i.e. `overlapNZ * overlap`). Always `0` for a collision between planar shapes
 * @property {boolean} aInB Whether the first object is entirely inside the second
 * @property {boolean} bInA Whether the second object is entirely inside the first
 * @property {number} indexShapeA The index of the colliding shape for the object a body
 * @property {number} indexShapeB The index of the colliding shape for the object b body
 */
class ResponseObject {
	constructor() {
		this.a = null;
		this.b = null;
		this.overlapN = new Vector2d();
		this.overlapV = new Vector2d();
		/**
		 * Z half of the minimum translation axis.
		 *
		 * Z arrives as **scalars beside** `overlapN` / `overlapV` rather than
		 * by widening them to {@link Vector3d}, because `Vector3d` is not a
		 * subclass of {@link Vector2d} — retyping them would break every
		 * existing consumer of a 2D collision response.
		 *
		 * The minimum translation axis is a single axis, so at most one of
		 * `overlapN.x`, `overlapN.y` and `overlapNZ` is ever non-zero. The 2D
		 * invariant `overlapV = overlapN * overlap` therefore extends
		 * unchanged as `overlapZ = overlapNZ * overlap`, and a collision
		 * resolved along Z leaves `overlapN` / `overlapV` at zero — a legacy
		 * 2D handler reading them applies no push, which is correct, because
		 * there is no 2D push to apply.
		 *
		 * Only ever non-zero when both shapes are a {@link Box3d}; every
		 * planar shape pair leaves these at `0`.
		 */
		this.overlapNZ = 0;
		this.overlapZ = 0;
		this.aInB = true;
		this.bInA = true;
		this.indexShapeA = -1;
		this.indexShapeB = -1;
		this.isTriggerContact = false;
		this.overlap = Number.MAX_VALUE;
	}

	/**
	 * Set some values of the response back to their defaults. <br>
	 * Call this between tests if you are going to reuse a single <br>
	 * Response object for multiple intersection tests <br>
	 * (recommended as it will avoid allocating extra memory) <br>
	 * @name clear
	 * @public
	 * @returns {object} this object for chaining
	 */
	clear() {
		this.aInB = true;
		this.bInA = true;
		this.overlap = Number.MAX_VALUE;
		this.indexShapeA = -1;
		this.indexShapeB = -1;
		this.isTriggerContact = false;
		// Reset alongside `overlap`, so a Box3d pair resolved along Z cannot
		// leak its Z push into the next test — which, for a planar pair, would
		// be a Z push that no shape in the test has any depth to justify.
		this.overlapNZ = 0;
		this.overlapZ = 0;
		return this;
	}
}

export default ResponseObject;
