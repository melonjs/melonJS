/**
 * What was set on every collider of a body at run time (`setSensor`,
 * `setCollisionType`, `setCollisionMask`, `setBounce`), so that the colliders
 * `updateShape()` makes get it too.
 */
import type { Renderable } from "melonjs";
import type { ColliderOverrides } from "../colliders/types";

export class RuntimeOverrides extends Map<Renderable, ColliderOverrides> {
	/**
	 * A body's record, to write to.
	 * @param renderable - the body's renderable
	 * @returns its record, made when there is none
	 */
	of(renderable: Renderable): ColliderOverrides {
		let over = this.get(renderable);
		if (over === undefined) {
			over = {};
			this.set(renderable, over);
		}
		return over;
	}
}
