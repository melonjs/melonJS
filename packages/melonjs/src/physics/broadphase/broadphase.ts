import type Container from "../../renderable/container.js";

/**
 * Common surface shared by every broadphase implementation in
 * melonJS. Selected at runtime by {@link World.broadphase} based on
 * `world.sortOn`:
 *   - 2D (`sortOn` ∈ `"x"` / `"y"` / `"z"`) → {@link QuadTree}
 *   - 3D (`sortOn === "depth"`)             → {@link Octree}
 *
 * Internal contract — not exported from the package entry. The
 * documented user-facing 3D spatial-query surface is
 * `world.adapter.queryAABB(rect)`, `world.adapter.querySphere(sphere)`,
 * `world.adapter.raycast(from, to)`, `world.adapter.raycast3d?(from, to)`.
 * `world.broadphase` is reachable for engine internals and tooling
 * (e.g. `@melonjs/debug-plugin` reads it to draw the spatial overlay),
 * but user game code shouldn't need it directly.
 *
 * The generic `TItem` lets each implementation narrow to its own
 * item shape (`QuadTreeItem` / `OctreeItem`) without losing the
 * shared contract. The 3D `Octree`-only region queries
 * (`queryAABB`, `querySphere`, `queryFrustum`, `queryRay`) are NOT
 * part of this interface — they live on `Octree` directly because
 * `QuadTree` has no equivalent.
 */
export interface Broadphase<TItem = unknown> {
	/** depth in the tree; 0 at the root. */
	readonly level: number;
	/** node-capacity threshold; exceeding it triggers a split. */
	max_objects: number;
	/** maximum subdivision depth; the root won't split past this. */
	max_levels: number;
	/** items held at this node level (not in subnodes). */
	objects: TItem[];
	/** subnodes (empty until {@link Broadphase.split} fires). */
	nodes: Broadphase<TItem>[];
	/**
	 * Total items in this subtree (own `objects` + descendants).
	 * Maintained by `insert` / `remove` so {@link Broadphase.isPrunable}
	 * and {@link Broadphase.hasChildren} are O(1) reads.
	 * @ignore
	 */
	_subtreeCount: number;

	/** Insert one item. Splits + redistributes if `max_objects` is exceeded. */
	insert(item: TItem): void;
	/**
	 * Remove one item. Returns `true` if the item was found.
	 * Includes a stale-bounds fallback walk for items that moved
	 * between insert and remove without a rebuild in between.
	 */
	remove(item: TItem): boolean;
	/**
	 * Return every item that could collide with `item`. Re-entrancy
	 * contract: the no-`result` form reuses a shared scratch array;
	 * pass an explicit `result` to be re-entrancy-safe.
	 */
	retrieve(
		item: TItem,
		fn?: (a: TItem, b: TItem) => number,
		result?: TItem[],
	): TItem[];
	/** Recursively insert every non-kinematic child of `container`. */
	insertContainer(container: Container): void;
	/** Inverse of {@link Broadphase.insertContainer}. */
	removeContainer(container: Container): void;
	/** Empty this node + every subnode; optionally resize the root bounds. */
	clear(bounds?: unknown): void;
	/** True if this subtree holds no items at any level. */
	isPrunable(): boolean;
	/** True if this node has any descendants (items in subnodes). */
	hasChildren(): boolean;
	/**
	 * Classify `item` into a subnode index, or `-1` if it spans a
	 * midpoint / sits outside the node's bounds.
	 */
	getIndex(item: TItem): number;
	/** Subdivide this node into its subnodes (4 for 2D, 8 for 3D). */
	split(): void;
}
