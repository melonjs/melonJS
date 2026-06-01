import { Sphere } from "../../geometries/sphere.ts";
import { Vector2d } from "../../math/vector2d.ts";
import type World from "../world.js";
import { AABB3d } from "./aabb3d.ts";
import type { Broadphase } from "./broadphase.ts";

/**
 * Scratch reused by `getIndex` to read viewport-localToWorld for
 * floating items without allocating. Mirrors QuadTree's `QT_VECTOR`
 * — only one query runs at a time, single-instance is safe.
 * @ignore
 */
const OT_VECTOR = new Vector2d();

/**
 * 8-octant spatial subdivision for `Camera3d` workloads. Sibling to
 * {@link QuadTree}: same public surface (`insert`, `remove`,
 * `retrieve`, `insertContainer`, `removeContainer`, `clear`,
 * `getIndex`, `isPrunable`, `hasChildren`), plus 3D-specific
 * region queries (`queryAABB`, `querySphere`). Selected
 * automatically by {@link World} when `world.sortOn === "depth"`
 * (which `Camera3d.defaultSortOn` sets on stage reset).
 *
 * Implementation notes:
 * - Bounding primitive is {@link AABB3d}; subnode bounds are POJOs
 *   with the same shape so node split is allocation-free apart from
 *   the eight literal objects (recycled via the global node pool).
 * - Per-frame clear/insert reuses both an octree-node pool
 *   (`OT_ARRAY`) and a result scratch (`_retrieveScratch`), so the
 *   steady state allocates nothing.
 * - Item z is read via `getAbsolutePosition()` — same convention as
 *   `Camera3d.isVisible` and the container depth sort, so the
 *   broadphase agrees with the renderer on which octant an item
 *   lives in even under nested transforms.
 */

/**
 * Minimal axis-aligned box shape consumed by `Octree`. Both
 * {@link AABB3d} and the POJOs emitted by `split` satisfy it
 * structurally.
 */
export interface OctRect {
	left: number;
	top: number;
	front: number;
	width: number;
	height: number;
	depth: number;
}

/**
 * Structural shape for an item inserted into the `Octree`. Same
 * shape as {@link QuadTree}'s item, with the addition that
 * `getAbsolutePosition()` is consulted for z (so nested transforms
 * still classify into the right octant).
 */
export interface OctreeItem {
	getBounds(): { left: number; top: number; width: number; height: number };
	getAbsolutePosition?(): { x: number; y: number; z: number };
	/**
	 * 2D items expose Vector2d here (no z); 3D items expose Vector3d.
	 * `getAbsolutePosition()` is the preferred path; this fallback
	 * applies only to test doubles that skip `getAbsolutePosition`.
	 */
	pos?: { x: number; y: number; z?: number };
	isFloating?: boolean;
	isKinematic?: boolean;
	name?: string;
}

export type OctreeSortFn = (a: OctreeItem, b: OctreeItem) => number;

/**
 * Structural shape consumed by {@link Octree.queryFrustum} —
 * matches the shape exposed by `Frustum#planes` (see
 * `camera/frustum.ts`). Each plane satisfies `nx·x + ny·y + nz·z + d = 0`;
 * positive side is the interior of the frustum.
 */
export interface FrustumPlane {
	nx: number;
	ny: number;
	nz: number;
	d: number;
}

/**
 * Node pool. Same shape as the QuadTree's QT_ARRAY — split allocates
 * from this, clear/collapse returns to it. Keeps steady-state
 * allocations at zero across the per-frame world rebuild.
 * @ignore
 */
const OT_ARRAY: Octree[] = [];

function OT_ARRAY_POP(
	world: World,
	bounds: OctRect,
	max_objects = 4,
	max_levels = 4,
	level = 0,
): Octree {
	if (OT_ARRAY.length > 0) {
		const _ot = OT_ARRAY.pop()!;
		_ot.world = world;
		_ot.bounds = bounds;
		_ot.max_objects = max_objects;
		_ot.max_levels = max_levels;
		_ot.level = level;
		return _ot;
	}
	return new Octree(world, bounds, max_objects, max_levels, level);
}

function OT_ARRAY_PUSH(ot: Octree) {
	OT_ARRAY.push(ot);
}

/**
 * Read the z component used to classify an item into octants. Uses
 * `getAbsolutePosition()` so items inside a transformed container
 * land in the same octant the renderer draws them in. Falls back to
 * `pos.z` if the item doesn't expose `getAbsolutePosition` (test
 * doubles do this), and finally `0` for items with no pos at all.
 * @ignore
 */
function itemZ(item: OctreeItem): number {
	if (typeof item.getAbsolutePosition === "function") {
		return item.getAbsolutePosition().z;
	}
	return item.pos?.z ?? 0;
}

/**
 * an Octree implementation for 3D broadphase / spatial queries
 * under `Camera3d`.
 * @category Physics
 * @see World.broadphase
 */
export default class Octree implements Broadphase<OctreeItem> {
	world: World;
	bounds: OctRect | AABB3d;
	max_objects: number;
	max_levels: number;
	level: number;
	objects: OctreeItem[];
	nodes: Octree[];

	/**
	 * see {@link QuadTree._subtreeCount} — same invariant.
	 * @ignore
	 */
	_subtreeCount: number;

	/**
	 * see {@link QuadTree._retrieveScratch} — same contract.
	 * @ignore
	 */
	_retrieveScratch: OctreeItem[] | null;

	/**
	 * @param world - the physic world this Octree belongs to
	 * @param bounds - bounds of the node
	 * @param [max_objects=4] - max objects a node can hold before splitting into 8 subnodes
	 * @param [max_levels=4] - total max levels inside root Octree
	 * @param [level] - depth level, required for subnodes
	 */
	constructor(
		world: World,
		bounds: OctRect | AABB3d,
		max_objects = 4,
		max_levels = 4,
		level = 0,
	) {
		this.world = world;
		this.bounds = bounds;
		this.max_objects = max_objects;
		this.max_levels = max_levels;
		this.level = level;
		this.objects = [];
		this.nodes = [];
		this._subtreeCount = 0;
		this._retrieveScratch = level === 0 ? [] : null;
	}

	/**
	 * Split this node into 8 octants. The naming mirrors the
	 * QuadTree's `top` / `bottom` / `left` / `right` ordering, with
	 * `near` (smaller z) before `far` (larger z) — matches the
	 * Y-down + +Z forward convention from {@link Camera3d}.
	 *
	 * Octant index layout (used by `getIndex`):
	 * ```
	 *   near (lower z)        far (higher z)
	 *   0: TR-near  1: TL-near   4: TR-far  5: TL-far
	 *   3: BR-near  2: BL-near   7: BR-far  6: BL-far
	 * ```
	 */
	split() {
		const nextLevel = this.level + 1;
		const subWidth = this.bounds.width / 2;
		const subHeight = this.bounds.height / 2;
		const subDepth = this.bounds.depth / 2;
		const left = this.bounds.left;
		const top = this.bounds.top;
		const front = this.bounds.front;

		for (let octant = 0; octant < 8; octant++) {
			const isFar = octant >= 4;
			const localIdx = octant & 3;
			const isRight = localIdx === 0 || localIdx === 3;
			const isBottom = localIdx === 2 || localIdx === 3;
			this.nodes[octant] = OT_ARRAY_POP(
				this.world,
				{
					left: isRight ? left + subWidth : left,
					top: isBottom ? top + subHeight : top,
					front: isFar ? front + subDepth : front,
					width: subWidth,
					height: subHeight,
					depth: subDepth,
				},
				this.max_objects,
				this.max_levels,
				nextLevel,
			);
		}
	}

	/**
	 * Classify an item into an octant.
	 *
	 * Returns -1 (keep at this level) when the item straddles ANY
	 * midpoint OR sits outside this node's bounds entirely. The
	 * out-of-bounds guard matters for `querySphere`: a sphere walks
	 * subnodes by AABB overlap, so an item assigned to a subnode
	 * whose bounds don't actually contain it would be invisible to
	 * any query whose sphere doesn't overlap that subnode's AABB.
	 * Items outside the root live at `root.objects` and are visited
	 * by every query unconditionally — they degrade to a linear scan
	 * but stay findable.
	 * @param item - the object to classify
	 * @returns octant index (0-7) or -1
	 */
	getIndex(item: OctreeItem): number {
		const bounds = item.getBounds();
		let rx: number;
		let ry: number;
		// Floating items live in viewport-local space; the broadphase
		// classifies in world space, so we localToWorld their bounds
		// before reading the corner. Mirrors the QuadTree branch —
		// without this, a HUD overlay at viewport `(10, 10)` ends up
		// classified by viewport-local coords and disagrees with the
		// renderer about which octant it's in.
		if (item.isFloating === true) {
			const pos = this.world.app.viewport.localToWorld(
				bounds.left,
				bounds.top,
				OT_VECTOR,
			);
			rx = pos.x;
			ry = pos.y;
		} else {
			rx = bounds.left;
			ry = bounds.top;
		}
		const rw = bounds.width;
		const rh = bounds.height;
		const rz = itemZ(item);
		// items are point-z in the broadphase — bounds is 2D, so the
		// item occupies a single z plane in 3D space. This matches
		// how the renderer sorts (depth comes from pos.z, not from a
		// 3D AABB on the renderable).
		const nodeLeft = this.bounds.left;
		const nodeTop = this.bounds.top;
		const nodeFront = this.bounds.front;
		const nodeRight = nodeLeft + this.bounds.width;
		const nodeBottom = nodeTop + this.bounds.height;
		const nodeBack = nodeFront + this.bounds.depth;

		// Out-of-bounds guard — keep at parent's `objects` so the
		// spatial pruning in `querySphere` / `queryAABB` stays
		// correct for the items that ARE in-bounds.
		if (
			rx < nodeLeft ||
			rx + rw > nodeRight ||
			ry < nodeTop ||
			ry + rh > nodeBottom ||
			rz < nodeFront ||
			rz > nodeBack
		) {
			return -1;
		}

		const verticalMidpoint = nodeLeft + this.bounds.width / 2;
		const horizontalMidpoint = nodeTop + this.bounds.height / 2;
		const depthMidpoint = nodeFront + this.bounds.depth / 2;

		const nearOctant = rz < depthMidpoint;
		const farOctant = rz > depthMidpoint;
		const topQuadrant = ry < horizontalMidpoint && ry + rh < horizontalMidpoint;
		const bottomQuadrant = ry > horizontalMidpoint;
		const leftQuadrant = rx < verticalMidpoint && rx + rw < verticalMidpoint;
		const rightQuadrant = rx > verticalMidpoint;

		if (!(nearOctant || farOctant)) {
			return -1;
		}
		const farOffset = farOctant ? 4 : 0;
		if (leftQuadrant) {
			if (topQuadrant) return 1 + farOffset;
			if (bottomQuadrant) return 2 + farOffset;
		} else if (rightQuadrant) {
			if (topQuadrant) return 0 + farOffset;
			if (bottomQuadrant) return 3 + farOffset;
		}
		return -1;
	}

	/**
	 * Insert the given object container into the node — recursively
	 * walks `Container.getChildren()` and inserts each non-kinematic
	 * leaf. Mirrors `QuadTree.insertContainer`.
	 * @param container - group of objects to be added
	 */
	insertContainer(container: ContainerLike) {
		const children = container.getChildren();
		const childrenLength = children.length;
		for (
			let i = childrenLength, child: ContainerOrChild;
			i--, (child = children[i]);
		) {
			if (child.isKinematic !== true) {
				if (typeof child.addChild === "function" && hasGetChildren(child)) {
					if (child.name !== "rootContainer") {
						this.insert(child);
					}
					// `child` narrowed by `hasGetChildren` — no assertion.
					this.insertContainer(child);
				} else if (typeof child.getBounds === "function") {
					this.insert(child);
				}
			}
		}
	}

	/**
	 * Insert the given object into the node. If this node exceeds
	 * `max_objects`, it splits and redistributes existing items into
	 * subnodes. Mirrors `QuadTree.insert` — same subtree-count
	 * accounting (bump on insert, no bump on redistribution).
	 * @param item - object to be added
	 */
	insert(item: OctreeItem) {
		this._subtreeCount++;

		if (this.nodes.length > 0) {
			const index = this.getIndex(item);
			if (index !== -1) {
				this.nodes[index].insert(item);
				return;
			}
		}

		this.objects.push(item);

		if (
			this.objects.length > this.max_objects &&
			this.level < this.max_levels
		) {
			if (this.nodes.length === 0) {
				this.split();
			}

			let writeIdx = 0;
			for (let i = 0, len = this.objects.length; i < len; i++) {
				const subIndex = this.getIndex(this.objects[i]);
				if (subIndex !== -1) {
					this.nodes[subIndex].insert(this.objects[i]);
				} else {
					this.objects[writeIdx++] = this.objects[i];
				}
			}
			this.objects.length = writeIdx;
		}
	}

	/**
	 * Recursively remove the given container and its descendants from
	 * the octree. Mirror of `QuadTree.removeContainer`.
	 * @param container - group of objects to be removed
	 */
	removeContainer(container: ContainerLikeOptional) {
		const children = container.getChildren?.();
		if (!children) {
			return;
		}
		const childrenLength = children.length;
		for (
			let i = childrenLength, child: ContainerOrChild;
			i--, (child = children[i]);
		) {
			if (child.isKinematic !== true) {
				if (typeof child.addChild === "function") {
					if (child.name !== "rootContainer") {
						this.remove(child);
					}
					this.removeContainer(child);
				} else if (typeof child.getBounds === "function") {
					this.remove(child);
				}
			}
		}
	}

	/**
	 * Return every object that could collide with the given item.
	 * Re-entrancy contract identical to {@link QuadTree.retrieve}: the
	 * default (scratch) path is allocation-free but cannot be safely
	 * re-entered while iterating; pass an explicit `result` for safe
	 * re-entry.
	 * @param item - object to be checked against
	 * @param [fn] - sorter applied to the returned array (root only)
	 * @param [result] - caller-supplied result array (re-entrancy-safe)
	 * @returns the collected candidates
	 */
	retrieve(
		item: OctreeItem,
		fn?: OctreeSortFn,
		result?: OctreeItem[],
	): OctreeItem[] {
		const isRoot = typeof result === "undefined";
		let out: OctreeItem[];
		if (isRoot) {
			out = this._retrieveScratch!;
			out.length = 0;
		} else {
			out = result;
		}

		const objects = this.objects;
		for (let i = 0, len = objects.length; i < len; i++) {
			out.push(objects[i]);
		}

		if (this.nodes.length > 0) {
			const index = this.getIndex(item);
			if (index !== -1) {
				this.nodes[index].retrieve(item, undefined, out);
			} else {
				for (let i = 0; i < this.nodes.length; i++) {
					this.nodes[i].retrieve(item, undefined, out);
				}
			}
		}

		if (isRoot && typeof fn === "function") {
			out.sort(fn);
		}

		return out;
	}

	/**
	 * Return every object whose subtree overlaps the given AABB.
	 * Walks only octants whose bounds overlap the query — same
	 * pruning shape as `retrieve(item)`, just driven by an explicit
	 * region instead of an item's own bounds.
	 *
	 * Re-entrancy: same contract as {@link Octree.retrieve}. Pass an
	 * explicit `result` for safe re-entry.
	 * @param aabb - the AABB region to query
	 * @param [result] - caller-supplied result array (re-entrancy-safe)
	 * @returns the collected candidates
	 */
	queryAABB(aabb: AABB3d, result?: OctreeItem[]): OctreeItem[] {
		const isRoot = typeof result === "undefined";
		let out: OctreeItem[];
		if (isRoot) {
			out = this._retrieveScratch!;
			out.length = 0;
		} else {
			out = result;
		}

		// short-circuit: if this node's bounds don't overlap the
		// query AABB, the whole subtree is irrelevant. The root is
		// always relevant by construction.
		if (this.level > 0 && !this._overlapsAABB(aabb)) {
			return out;
		}

		// fold every object at this level whose bounds overlap
		const objects = this.objects;
		for (let i = 0, len = objects.length; i < len; i++) {
			out.push(objects[i]);
		}

		if (this.nodes.length > 0) {
			for (let i = 0; i < this.nodes.length; i++) {
				this.nodes[i].queryAABB(aabb, out);
			}
		}

		return out;
	}

	/**
	 * Return every object whose containing octant overlaps the given
	 * sphere. Replaces the hand-rolled O(n²) sphere-vs-sphere loops
	 * common in arcade 3D code with a broadphase that scales.
	 *
	 * Two call shapes — both forms route to the same internal walk:
	 * - `querySphere(cx, cy, cz, r, result?)` — loose floats
	 * - `querySphere(sphere, result?)` — packaged {@link Sphere}
	 *
	 * Re-entrancy: same contract as {@link Octree.retrieve}.
	 */
	querySphere(sphere: Sphere, result?: OctreeItem[]): OctreeItem[];
	/**
	 * @param cx - sphere center x
	 * @param cy - sphere center y
	 * @param cz - sphere center z
	 * @param r - sphere radius (must be ≥ 0; r=0 becomes a point query)
	 * @param [result] - caller-supplied result array (re-entrancy-safe)
	 * @returns the collected candidates
	 */
	querySphere(
		cx: number,
		cy: number,
		cz: number,
		r: number,
		result?: OctreeItem[],
	): OctreeItem[];
	querySphere(
		sphereOrCx: Sphere | number,
		cyOrResult?: number | OctreeItem[],
		cz?: number,
		r?: number,
		result?: OctreeItem[],
	): OctreeItem[] {
		if (sphereOrCx instanceof Sphere) {
			return this._querySphereInternal(
				sphereOrCx.pos.x,
				sphereOrCx.pos.y,
				sphereOrCx.pos.z,
				sphereOrCx.radius,
				cyOrResult as OctreeItem[] | undefined,
			);
		}
		return this._querySphereInternal(
			sphereOrCx,
			cyOrResult as number,
			cz!,
			r!,
			result,
		);
	}

	/**
	 * Loose-floats implementation. Recursive subnode walks call this
	 * directly to bypass the Sphere/floats dispatch on every node.
	 * @ignore
	 */
	_querySphereInternal(
		cx: number,
		cy: number,
		cz: number,
		r: number,
		result?: OctreeItem[],
	): OctreeItem[] {
		const isRoot = typeof result === "undefined";
		let out: OctreeItem[];
		if (isRoot) {
			out = this._retrieveScratch!;
			out.length = 0;
		} else {
			out = result;
		}

		if (this.level > 0 && !this._overlapsSphere(cx, cy, cz, r)) {
			return out;
		}

		const objects = this.objects;
		for (let i = 0, len = objects.length; i < len; i++) {
			out.push(objects[i]);
		}

		if (this.nodes.length > 0) {
			for (let i = 0; i < this.nodes.length; i++) {
				this.nodes[i]._querySphereInternal(cx, cy, cz, r, out);
			}
		}

		return out;
	}

	/**
	 * Return every object whose containing octant lies on the
	 * positive side of all six frustum planes — i.e. every potential
	 * candidate the frustum can see. Uses Gribb–Hartmann positive-
	 * vertex pruning at each node: a subtree is skipped iff its
	 * octant's most-positive corner along a plane normal is on that
	 * plane's negative side (i.e. wholly outside the frustum).
	 *
	 * Mirrors {@link Frustum#intersectsSphere} on the renderer side —
	 * use this as the broadphase pass before per-item narrow-phase
	 * checks (sphere / OBB / etc.).
	 *
	 * Re-entrancy: same contract as {@link Octree.retrieve}. Pass an
	 * explicit `result` for safe re-entry.
	 * @param planes - 6 frustum planes (left, right, bottom, top, near, far) — `Frustum#planes` shape
	 * @param [result] - caller-supplied result array (re-entrancy-safe)
	 * @returns the collected candidates
	 */
	queryFrustum(planes: FrustumPlane[], result?: OctreeItem[]): OctreeItem[] {
		const isRoot = typeof result === "undefined";
		let out: OctreeItem[];
		if (isRoot) {
			out = this._retrieveScratch!;
			out.length = 0;
		} else {
			out = result;
		}

		// Subtree-bounds vs frustum prune at level>0. Root is always
		// walked so out-of-bounds items at root.objects stay findable.
		if (this.level > 0 && this._outsideFrustum(planes)) {
			return out;
		}

		const objects = this.objects;
		for (let i = 0, len = objects.length; i < len; i++) {
			out.push(objects[i]);
		}

		if (this.nodes.length > 0) {
			for (let i = 0; i < this.nodes.length; i++) {
				this.nodes[i].queryFrustum(planes, out);
			}
		}

		return out;
	}

	/**
	 * Return every object whose containing octant the ray segment
	 * `from + t·dir`, `t ∈ [0, tMax]`, crosses. Slab AABB test prunes
	 * subtrees the ray misses entirely — much tighter than enclosing
	 * the segment in a single AABB and walking `queryAABB`. The
	 * candidates aren't sorted by hit-distance (front-to-back walk
	 * would require a per-octant DDA step); callers that need
	 * nearest-hit sort the narrow-phase results themselves.
	 *
	 * Re-entrancy: same contract as {@link Octree.retrieve}.
	 * @param fromX - ray origin x
	 * @param fromY - ray origin y
	 * @param fromZ - ray origin z
	 * @param dirX - ray direction x (`to - from`; not unit-length)
	 * @param dirY - ray direction y
	 * @param dirZ - ray direction z
	 * @param tMax - maximum t along the ray (usually `1` if `dir = to - from`)
	 * @param [result] - caller-supplied result array (re-entrancy-safe)
	 * @returns the collected candidates
	 */
	queryRay(
		fromX: number,
		fromY: number,
		fromZ: number,
		dirX: number,
		dirY: number,
		dirZ: number,
		tMax: number,
		result?: OctreeItem[],
	): OctreeItem[] {
		const isRoot = typeof result === "undefined";
		let out: OctreeItem[];
		if (isRoot) {
			out = this._retrieveScratch!;
			out.length = 0;
		} else {
			out = result;
		}

		if (
			this.level > 0 &&
			!this._overlapsRay(fromX, fromY, fromZ, dirX, dirY, dirZ, tMax)
		) {
			return out;
		}

		const objects = this.objects;
		for (let i = 0, len = objects.length; i < len; i++) {
			out.push(objects[i]);
		}

		if (this.nodes.length > 0) {
			for (let i = 0; i < this.nodes.length; i++) {
				this.nodes[i].queryRay(
					fromX,
					fromY,
					fromZ,
					dirX,
					dirY,
					dirZ,
					tMax,
					out,
				);
			}
		}

		return out;
	}

	/**
	 * Remove the given item from the octree. Mirror of
	 * `QuadTree.remove` — same stale-bounds fallback walk, same
	 * collapse-on-removal pool recycling.
	 * @param item - object to be removed
	 * @returns true if the item was found and removed.
	 */
	remove(item: OctreeItem): boolean {
		let found = false;

		if (typeof item.getBounds === "undefined") {
			return false;
		}

		if (this.nodes.length > 0) {
			const index = this.getIndex(item);
			if (index !== -1) {
				found = this.nodes[index].remove(item);
			}
		}

		if (!found) {
			const idx = this.objects.indexOf(item);
			if (idx !== -1) {
				this.objects.splice(idx, 1);
				found = true;
			}
		}

		// Stale-bounds fallback — item's position may have moved
		// since insert.
		if (!found && this.nodes.length > 0) {
			for (let i = 0; i < this.nodes.length; i++) {
				if (this.nodes[i].remove(item)) {
					found = true;
					break;
				}
			}
		}

		if (found) {
			this._subtreeCount--;
			if (
				this.nodes.length > 0 &&
				this.objects.length === 0 &&
				this._subtreeCount === 0
			) {
				for (let i = 0; i < this.nodes.length; i++) {
					this.nodes[i].clear();
					OT_ARRAY_PUSH(this.nodes[i]);
				}
				this.nodes.length = 0;
			}
		}

		return found;
	}

	/**
	 * @returns true if this subtree holds no items at any level.
	 */
	isPrunable(): boolean {
		return this._subtreeCount === 0;
	}

	/**
	 * @returns true if this node has any descendants (items in
	 * subnodes, not at this level).
	 */
	hasChildren(): boolean {
		return this._subtreeCount > this.objects.length;
	}

	/**
	 * Empty this octree and recycle every subnode back to the pool.
	 * If `bounds` is supplied, resizes the root bounds to match —
	 * called by `World` on `LEVEL_LOADED` so the broadphase tracks
	 * level boundary changes.
	 * @param [bounds] - the new root bounds (resize on clear)
	 */
	clear(bounds?: AABB3d) {
		this.objects.length = 0;
		for (let i = 0; i < this.nodes.length; i++) {
			this.nodes[i].clear();
			OT_ARRAY_PUSH(this.nodes[i]);
		}
		this.nodes.length = 0;
		this._subtreeCount = 0;
		if (typeof bounds !== "undefined") {
			(this.bounds as AABB3d).setMinMax(
				bounds.min.x,
				bounds.min.y,
				bounds.min.z,
				bounds.max.x,
				bounds.max.y,
				bounds.max.z,
			);
		}
	}

	/**
	 * Conservative outside-frustum test using the positive-vertex
	 * method (Gribb–Hartmann). Returns true iff the octant is
	 * provably outside ANY one plane, i.e. wholly outside the
	 * frustum.
	 * @ignore
	 */
	_outsideFrustum(planes: FrustumPlane[]): boolean {
		const b = this.bounds;
		const minX = b.left;
		const maxX = b.left + b.width;
		const minY = b.top;
		const maxY = b.top + b.height;
		const minZ = b.front;
		const maxZ = b.front + b.depth;
		for (let i = 0; i < planes.length; i++) {
			const p = planes[i];
			// positive vertex: the corner of the AABB furthest along
			// the plane normal. Signed distance from that corner to
			// the plane = nx*px + ny*py + nz*pz + d. If negative, the
			// entire AABB is on the plane's negative side.
			const px = p.nx > 0 ? maxX : minX;
			const py = p.ny > 0 ? maxY : minY;
			const pz = p.nz > 0 ? maxZ : minZ;
			if (p.nx * px + p.ny * py + p.nz * pz + p.d < 0) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Slab method for ray–AABB intersection. Returns true iff the
	 * segment `from + t·dir`, `t ∈ [0, tMax]`, intersects this
	 * node's octant. dir components may be zero; the axis with zero
	 * direction degenerates to a point-in-slab test.
	 * @ignore
	 */
	_overlapsRay(
		fromX: number,
		fromY: number,
		fromZ: number,
		dirX: number,
		dirY: number,
		dirZ: number,
		tMax: number,
	): boolean {
		const b = this.bounds;
		const minX = b.left;
		const maxX = b.left + b.width;
		const minY = b.top;
		const maxY = b.top + b.height;
		const minZ = b.front;
		const maxZ = b.front + b.depth;

		let tEnter = 0;
		let tExit = tMax;

		// x axis
		if (dirX === 0) {
			if (fromX < minX || fromX > maxX) return false;
		} else {
			const invD = 1 / dirX;
			const t1 = (minX - fromX) * invD;
			const t2 = (maxX - fromX) * invD;
			const tMin = t1 < t2 ? t1 : t2;
			const tMaxLocal = t1 < t2 ? t2 : t1;
			if (tMin > tEnter) tEnter = tMin;
			if (tMaxLocal < tExit) tExit = tMaxLocal;
			if (tEnter > tExit) return false;
		}

		// y axis
		if (dirY === 0) {
			if (fromY < minY || fromY > maxY) return false;
		} else {
			const invD = 1 / dirY;
			const t1 = (minY - fromY) * invD;
			const t2 = (maxY - fromY) * invD;
			const tMin = t1 < t2 ? t1 : t2;
			const tMaxLocal = t1 < t2 ? t2 : t1;
			if (tMin > tEnter) tEnter = tMin;
			if (tMaxLocal < tExit) tExit = tMaxLocal;
			if (tEnter > tExit) return false;
		}

		// z axis
		if (dirZ === 0) {
			if (fromZ < minZ || fromZ > maxZ) return false;
		} else {
			const invD = 1 / dirZ;
			const t1 = (minZ - fromZ) * invD;
			const t2 = (maxZ - fromZ) * invD;
			const tMin = t1 < t2 ? t1 : t2;
			const tMaxLocal = t1 < t2 ? t2 : t1;
			if (tMin > tEnter) tEnter = tMin;
			if (tMaxLocal < tExit) tExit = tMaxLocal;
			if (tEnter > tExit) return false;
		}

		return true;
	}

	/** @ignore */
	_overlapsAABB(aabb: AABB3d): boolean {
		const b = this.bounds;
		const right = b.left + b.width;
		const bottom = b.top + b.height;
		const back = b.front + b.depth;
		return !(
			right < aabb.min.x ||
			b.left > aabb.max.x ||
			bottom < aabb.min.y ||
			b.top > aabb.max.y ||
			back < aabb.min.z ||
			b.front > aabb.max.z
		);
	}

	/** @ignore */
	_overlapsSphere(cx: number, cy: number, cz: number, r: number): boolean {
		const b = this.bounds;
		const minX = b.left;
		const maxX = b.left + b.width;
		const minY = b.top;
		const maxY = b.top + b.height;
		const minZ = b.front;
		const maxZ = b.front + b.depth;
		const dx = cx < minX ? minX - cx : cx > maxX ? cx - maxX : 0;
		const dy = cy < minY ? minY - cy : cy > maxY ? cy - maxY : 0;
		const dz = cz < minZ ? minZ - cz : cz > maxZ ? cz - maxZ : 0;
		return dx * dx + dy * dy + dz * dz <= r * r;
	}
}

/**
 * Structural shape consumed by `insertContainer` / `removeContainer`
 * — captures only the fields the walk inspects. Same approach as
 * QuadTree. `getChildren` is optional because leaf renderables don't
 * have it; the recursive walk narrows via {@link hasGetChildren}.
 * @ignore
 */
interface ContainerOrChild extends OctreeItem {
	addChild?: (...args: unknown[]) => unknown;
	getChildren?: () => ContainerOrChild[];
}

/** @ignore */
type ContainerLike = { getChildren(): ContainerOrChild[] };
/** @ignore */
type ContainerLikeOptional = { getChildren?(): ContainerOrChild[] };

/**
 * Type predicate mirror of QuadTree's. Narrows a `ContainerOrChild`
 * to one whose `getChildren` is definitely a function, letting the
 * recursive `insertContainer(child)` call pass without an assertion.
 * @param c - the candidate to test
 * @returns true if `c` has a callable `getChildren`
 */
function hasGetChildren(
	c: ContainerOrChild,
): c is ContainerOrChild & ContainerLike {
	return typeof c.getChildren === "function";
}
