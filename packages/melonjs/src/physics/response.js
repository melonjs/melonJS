import { Vector2d } from "../math/vector2d.ts";

/**
 * additional import for TypeScript
 * @import Renderable from "../renderable/renderable.js";
 */
/**
 * An object representing the result of an intersection.
 */
class ResponseObject {
	constructor() {
		/**
		 * The first object participating in the intersection
		 * @type {Renderable|null}
		 */
		this.a = null;
		/**
		 * The second object participating in the intersection
		 * @type {Renderable|null}
		 */
		this.b = null;
		/**
		 * The shortest colliding axis (unit-vector)
		 * @type {Vector2d}
		 */
		this.overlapN = new Vector2d();
		/**
		 * The overlap vector (i.e. `overlapN.scale(overlap, overlap)`). If
		 * this vector is subtracted from the position of a, a and b will no
		 * longer be colliding
		 * @type {Vector2d}
		 */
		this.overlapV = new Vector2d();
		/**
		 * Z half of the minimum translation axis.
		 *
		 * Z arrives as **scalars beside** `overlapN` / `overlapV` rather than
		 * by widening them to {@link Vector3d}, because `Vector3d` is not a
		 * subclass of {@link Vector2d} — retyping them would break every
		 * existing consumer of a 2D collision response.
		 *
		 * The 2D invariant `overlapV = overlapN * overlap` extends unchanged
		 * as `overlapZ = overlapNZ * overlap`, and `overlapN` together with
		 * `overlapNZ` is always a 3D unit vector.
		 *
		 * How that vector is SHAPED depends on which 3D shapes met:
		 *
		 * - A {@link Box3d} pair separates along one world axis, so exactly
		 *   one of `overlapN.x`, `overlapN.y` and `overlapNZ` is non-zero and
		 *   that one is `-1` or `1`. A contact resolved along Z leaves
		 *   `overlapN` / `overlapV` at zero, so a legacy 2D handler reading
		 *   them applies no push, which is correct — there is no 2D push to
		 *   apply.
		 * - A {@link Sphere} against anything separates along the line
		 *   between the two closest points, which is generally DIAGONAL: all
		 *   three components can be non-zero at once, and each is any value
		 *   in `[-1, 1]`. A handler that branches on `overlapNZ !== 0` and
		 *   then ignores `overlapV` drops the planar half of such a contact.
		 *   Subtract both halves, or read `overlap` along the full normal.
		 *
		 * Both are `0` for every planar shape pair, so nothing about a 2D
		 * collision changed.
		 */
		this.overlapNZ = 0;
		/**
		 * The Z component of the overlap vector (i.e. `overlapNZ * overlap`).
		 * Always `0` for a collision between planar shapes
		 * @type {number}
		 */
		this.overlapZ = 0;
		/** Whether the first object is entirely inside the second */
		this.aInB = true;
		/** Whether the second object is entirely inside the first */
		this.bInA = true;
		/** The index of the colliding shape for the object a body */
		this.indexShapeA = -1;
		/** The index of the colliding shape for the object b body */
		this.indexShapeB = -1;
		this.isTriggerContact = false;
		/** Magnitude of the overlap on the shortest colliding axis */
		this.overlap = Number.MAX_VALUE;
	}

	/**
	 * Set some values of the response back to their defaults. <br>
	 * Call this between tests if you are going to reuse a single <br>
	 * Response object for multiple intersection tests <br>
	 * (recommended as it will avoid allocating extra memory) <br>
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
