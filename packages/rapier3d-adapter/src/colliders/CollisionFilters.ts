/**
 * melonJS collision types and masks on Rapier colliders.
 *
 * Rapier's own collision groups hold 16 bits of membership and 16 of filter,
 * where melonJS types and masks are 32 bits: a collider whose values do not
 * fit is filtered by Rapier's `filterContactPair` / `filterIntersectionPair`
 * hooks instead, on the full 32 bits.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import { collision } from "melonjs";

/** a collider's melonJS collision type and mask */
export interface Filter {
	category: number;
	mask: number;
}

// what a collider with no type or mask of its own has
const DEFAULT_CATEGORY = 0x0001;

export class CollisionFilters {
	/** The hooks Rapier calls for a pair that needs the full 32 bits. */
	readonly hooks: RAPIER.PhysicsHooks;
	private readonly rapier: typeof RAPIER;
	/** collider handle -> its type and mask */
	private readonly filters = new Map<number, Filter>();

	/**
	 * @param rapier - the Rapier module
	 */
	constructor(rapier: typeof RAPIER) {
		this.rapier = rapier;
		const computeImpulse = rapier.SolverFlags.COMPUTE_IMPULSE;
		this.hooks = {
			filterContactPair: (c1, c2) => {
				return this.passes(c1, c2) ? computeImpulse : null;
			},
			filterIntersectionPair: (c1, c2) => {
				return this.passes(c1, c2);
			},
		};
	}

	/**
	 * A collider's type and mask.
	 * @param handle - the collider handle
	 * @returns its filter, if it has one
	 */
	get(handle: number): Filter | undefined {
		return this.filters.get(handle);
	}

	/**
	 * Give a collider its melonJS collision type and mask.
	 * @param collider - the collider to configure
	 * @param category - its collision type
	 * @param mask - the collision types it collides with
	 */
	apply(collider: RAPIER.Collider, category: number, mask: number): void {
		this.filters.set(collider.handle, { category, mask });
		const { ActiveHooks } = this.rapier;
		const needsHooks =
			category >>> 16 !== 0 || (mask >>> 16 !== 0 && (mask & 0xffff) === 0);
		if (needsHooks) {
			collider.setCollisionGroups(0xffffffff);
			collider.setActiveHooks(
				ActiveHooks.FILTER_CONTACT_PAIRS |
					ActiveHooks.FILTER_INTERSECTION_PAIRS,
			);
		} else {
			collider.setCollisionGroups(
				(((category & 0xffff) << 16) | (mask & 0xffff)) >>> 0,
			);
			collider.setActiveHooks(ActiveHooks.NONE);
		}
	}

	/**
	 * Change the type and/or the mask of several colliders.
	 * @param colliders - the colliders
	 * @param category - the new type, or undefined to keep each collider's
	 * @param mask - the new mask, or undefined to keep each collider's
	 */
	update(
		colliders: RAPIER.Collider[],
		category: number | undefined,
		mask: number | undefined,
	): void {
		for (const collider of colliders) {
			const current = this.filters.get(collider.handle);
			this.apply(
				collider,
				category ?? current?.category ?? DEFAULT_CATEGORY,
				mask ?? current?.mask ?? collision.types.ALL_OBJECT,
			);
		}
	}

	/**
	 * Forget a collider that left the world.
	 * @param handle - its handle
	 */
	forget(handle: number): void {
		this.filters.delete(handle);
	}

	/** Forget every collider. */
	clear(): void {
		this.filters.clear();
	}

	/**
	 * Whether two colliders collide, by their full 32-bit types and masks.
	 * @param c1 - a collider handle
	 * @param c2 - the other
	 * @returns true when each one's mask includes the other's type
	 */
	private passes(c1: number, c2: number): boolean {
		const f1 = this.filters.get(c1);
		const f2 = this.filters.get(c2);
		if (f1 === undefined || f2 === undefined) {
			return true;
		}
		return (f1.mask & f2.category) !== 0 && (f2.mask & f1.category) !== 0;
	}
}
