import { Vector2d } from "../../math/vector2d.ts";
import type { Bounds } from "../bounds.ts";
import type World from "../world.js";
import type { Broadphase } from "./broadphase.ts";

// Moved from `physics/builtin/quadtree.js` in 19.7.0 alongside the
// addition of `Octree`. Lives next to `Octree` and `AABB3d` under
// `physics/broadphase/` because none of the three are built-in-physics
// specific — pointer-event picking and any third-party adapter that
// reads `world.broadphase` use the same surface.

/*
 * A QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
 * Based on the QuadTree Library by Timo Hausmann and released under the MIT license
 * https://github.com/timohausmann/quadtree-js/
 */

/**
 * Minimal axis-aligned rectangle shape consumed by `QuadTree` — the
 * full {@link Bounds} class satisfies it structurally, so do the
 * `{ left, top, width, height }` POJOs `split` allocates for
 * subnodes. Kept as an exported interface so any subclass / adapter
 * that constructs its own root bounds doesn't have to import
 * `Bounds`.
 */
export interface QuadRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Structural shape for an item inserted into the `QuadTree`. Every
 * Renderable satisfies it; `getBounds()` is the only required
 * member. `isFloating` triggers the viewport-localToWorld coord
 * remap; `isKinematic` / `name` / `addChild` are consulted only by
 * `insertContainer` / `removeContainer` when walking a subtree.
 */
export interface QuadTreeItem {
	getBounds(): QuadRect;
	isFloating?: boolean;
	isKinematic?: boolean;
	name?: string;
}

/**
 * Optional comparator passed to {@link QuadTree.retrieve} — invoked
 * once on the assembled candidate array, only when `retrieve` was
 * called in root mode (no caller-supplied `result`).
 */
export type QuadTreeSortFn = (a: QuadTreeItem, b: QuadTreeItem) => number;

/**
 * a pool of `QuadTree` objects
 * @ignore
 */
const QT_ARRAY: QuadTree[] = [];

/**
 * will pop a quadtree object from the array
 * or create a new one if the array is empty
 * @ignore
 */
function QT_ARRAY_POP(
	world: World,
	bounds: QuadRect,
	max_objects = 4,
	max_levels = 4,
	level = 0,
): QuadTree {
	if (QT_ARRAY.length > 0) {
		const _qt = QT_ARRAY.pop()!;
		_qt.world = world;
		_qt.bounds = bounds;
		_qt.max_objects = max_objects;
		_qt.max_levels = max_levels;
		_qt.level = level;
		return _qt;
	} else {
		return new QuadTree(world, bounds, max_objects, max_levels, level);
	}
}

/**
 * Push back a quadtree back into the array
 * @ignore
 */
function QT_ARRAY_PUSH(qt: QuadTree) {
	QT_ARRAY.push(qt);
}

/**
 * a temporary vector object to be reused
 * @ignore
 */
const QT_VECTOR = new Vector2d();

/**
 * a QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
 * @category Physics
 * @see World.broadphase
 */
export default class QuadTree implements Broadphase<QuadTreeItem> {
	world: World;
	bounds: QuadRect | Bounds;
	max_objects: number;
	max_levels: number;
	level: number;
	objects: QuadTreeItem[];
	nodes: QuadTree[];

	/**
	 * Total number of objects in this subtree (this node's own
	 * `objects` plus every descendant's). Maintained by `insert`
	 * and `remove` so `isPrunable` / `hasChildren` are O(1) reads
	 * instead of O(tree-size) walks. Reset to 0 in `clear`.
	 * @ignore
	 */
	_subtreeCount: number;

	/**
	 * Root-only scratch array reused across `retrieve` calls to
	 * avoid allocating a fresh array per pointer event / per
	 * narrow-phase query. Only the root allocates one; recursive
	 * subnode calls receive the array via the `result` arg.
	 * @ignore
	 */
	_retrieveScratch: QuadTreeItem[] | null;

	/**
	 * @param world - the physic world this QuadTree belongs to
	 * @param bounds - bounds of the node
	 * @param [max_objects=4] - max objects a node can hold before splitting into 4 subnodes
	 * @param [max_levels=4] - total max levels inside root QuadTree
	 * @param [level] - depth level, required for subnodes
	 */
	constructor(
		world: World,
		bounds: QuadRect | Bounds,
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

	/*
	 * Split the node into 4 subnodes
	 */
	split() {
		const nextLevel = this.level + 1;
		const subWidth = this.bounds.width / 2;
		const subHeight = this.bounds.height / 2;
		const left = this.bounds.left;
		const top = this.bounds.top;

		//top right node
		this.nodes[0] = QT_ARRAY_POP(
			this.world,
			{
				left: left + subWidth,
				top: top,
				width: subWidth,
				height: subHeight,
			},
			this.max_objects,
			this.max_levels,
			nextLevel,
		);

		//top left node
		this.nodes[1] = QT_ARRAY_POP(
			this.world,
			{
				left: left,
				top: top,
				width: subWidth,
				height: subHeight,
			},
			this.max_objects,
			this.max_levels,
			nextLevel,
		);

		//bottom left node
		this.nodes[2] = QT_ARRAY_POP(
			this.world,
			{
				left: left,
				top: top + subHeight,
				width: subWidth,
				height: subHeight,
			},
			this.max_objects,
			this.max_levels,
			nextLevel,
		);

		//bottom right node
		this.nodes[3] = QT_ARRAY_POP(
			this.world,
			{
				left: left + subWidth,
				top: top + subHeight,
				width: subWidth,
				height: subHeight,
			},
			this.max_objects,
			this.max_levels,
			nextLevel,
		);
	}

	/*
	 * Determine which node the object belongs to
	 * @param item - the object to be classified
	 * @returns integer index of the subnode (0-3), or -1 if the item
	 * cannot completely fit within a subnode and is part of the
	 * parent node
	 */
	getIndex(item: QuadTreeItem): number {
		const bounds = item.getBounds();

		let rx: number;
		let ry: number;

		// use game world coordinates for floating items
		if (item.isFloating === true) {
			const pos = this.world.app.viewport.localToWorld(
				bounds.left,
				bounds.top,
				QT_VECTOR,
			);
			rx = pos.x;
			ry = pos.y;
		} else {
			rx = bounds.left;
			ry = bounds.top;
		}

		let index = -1;
		const rw = bounds.width;
		const rh = bounds.height;
		const verticalMidpoint = this.bounds.left + this.bounds.width / 2;
		const horizontalMidpoint = this.bounds.top + this.bounds.height / 2;
		//rect can completely fit within the top quadrants
		const topQuadrant = ry < horizontalMidpoint && ry + rh < horizontalMidpoint;
		//rect can completely fit within the bottom quadrants
		const bottomQuadrant = ry > horizontalMidpoint;

		//rect can completely fit within the left quadrants
		if (rx < verticalMidpoint && rx + rw < verticalMidpoint) {
			if (topQuadrant) {
				index = 1;
			} else if (bottomQuadrant) {
				index = 2;
			}
		} else if (rx > verticalMidpoint) {
			//rect can completely fit within the right quadrants
			if (topQuadrant) {
				index = 0;
			} else if (bottomQuadrant) {
				index = 3;
			}
		}

		return index;
	}

	/**
	 * Insert the given object container into the node.
	 *
	 * Typed against the structural duck shape (`getChildren() →
	 * ContainerOrChild[]`) rather than the concrete `Container` class
	 * so the recursive call below — where `child` is the structural
	 * `ContainerOrChild` shape from `getChildren()`, not a `Container`
	 * instance — type-checks without an `as unknown as Container` cast.
	 * `Container` itself satisfies the shape (its `getChildren()`
	 * returns `Renderable[]`, which matches the looser structural
	 * `ContainerOrChild[]`).
	 * @param container - group of objects to be added
	 */
	insertContainer(container: ContainerLike) {
		// use getChildren() to lazily initialise an empty array — Container
		// stores `children` as `undefined` until first access, which would
		// otherwise crash here for a freshly-constructed world.
		const children = container.getChildren();
		const childrenLength = children.length;
		for (
			let i = childrenLength, child: ContainerOrChild;
			i--, (child = children[i]);
		) {
			if (child.isKinematic !== true) {
				if (typeof child.addChild === "function" && hasGetChildren(child)) {
					// `rootContainer` is the world itself — it owns the
					// quadtree, it isn't an item inside it.
					if (child.name !== "rootContainer") {
						this.insert(child);
					}
					// `child` narrowed by `hasGetChildren` — no assertion.
					this.insertContainer(child);
				} else {
					// only insert object with a bounding box
					// Probably redundant with `isKinematic`
					if (typeof child.getBounds === "function") {
						this.insert(child);
					}
				}
			}
		}
	}

	/**
	 * Insert the given object into the node. If the node
	 * exceeds the capacity, it will split and add all
	 * objects to their corresponding subnodes.
	 * @param item - object to be added
	 */
	insert(item: QuadTreeItem) {
		// Subtree count: this insert adds one object SOMEWHERE in
		// this subtree (either to `this.objects` or, by recursion,
		// to a descendant's subtree). Bumping at every level entered
		// gives every ancestor a correct running total.
		this._subtreeCount++;

		//if we have subnodes ...
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
			//split if we don't already have subnodes
			if (this.nodes.length === 0) {
				this.split();
			}

			//add all objects to their corresponding subnodes
			let writeIdx = 0;
			for (let i = 0, len = this.objects.length; i < len; i++) {
				const subIndex = this.getIndex(this.objects[i]);
				if (subIndex !== -1) {
					// Redistribution: the item is being MOVED from
					// `this.objects` into a subnode. The total in this
					// subtree is unchanged, so we DON'T touch
					// `this._subtreeCount`. The subnode's `insert`
					// will increment its own count for the moved item.
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
	 * the quadtree. Mirrors `insertContainer` so the broadphase can be
	 * kept in sync when a subtree is detached via
	 * `Container.removeChildNow` between two `world.update()` rebuilds
	 * (pointer events fire async in that window and would otherwise
	 * hit destroyed renderables).
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
					// `rootContainer` is the world itself — it owns the
					// quadtree, it isn't an item inside it. Mirrors the
					// `insertContainer` guard above.
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
	 * Return all objects that could collide with the given object.
	 *
	 * **Re-entrancy contract:** when called with no explicit `result`
	 * argument, this method reuses a single root-level scratch array to
	 * avoid per-frame allocations. The returned reference is therefore
	 * **not safe to retain** past the next `retrieve()` call, AND it is
	 * **not safe to issue another scratch-mode `retrieve()` while iterating
	 * the previous result** — the second call clears the scratch and
	 * refills it, corrupting the outer iteration. In-engine callers
	 * (`pointerevent.ts`, `detector.js`) iterate synchronously and never
	 * recurse into `retrieve()`, so they're fine. User-facing portable
	 * APIs (`adapter.queryAABB`, `adapter.raycast`) pass their own array
	 * via the `result` parameter, which bypasses the scratch entirely
	 * and is safe to call from inside collision handlers.
	 * @param item - object to be checked against
	 * @param [fn] - a sorting function for the returned array
	 * @param [result] - optional caller-supplied result array. Pass an
	 *   explicit (typically empty) array to sidestep the shared scratch —
	 *   required for re-entrancy safety.
	 * @returns array with all detected objects
	 */
	retrieve(
		item: QuadTreeItem,
		fn?: QuadTreeSortFn,
		result?: QuadTreeItem[],
	): QuadTreeItem[] {
		// Reuse the root's scratch array across calls. Pointer events
		// fire on every mouse move and each one used to allocate a
		// fresh `[]`; resetting the existing array's length to 0 is
		// allocation-free. See the JSDoc above for the re-entrancy
		// contract that this optimization implies.
		const isRoot = typeof result === "undefined";
		let out: QuadTreeItem[];
		if (isRoot) {
			out = this._retrieveScratch!;
			out.length = 0;
		} else {
			out = result;
		}

		// add objects at this level
		const objects = this.objects;
		for (let i = 0, len = objects.length; i < len; i++) {
			out.push(objects[i]);
		}

		//if we have subnodes ...
		if (this.nodes.length > 0) {
			const index = this.getIndex(item);

			//if rect fits into a subnode ..
			if (index !== -1) {
				this.nodes[index].retrieve(item, undefined, out);
			} else {
				//if rect does not fit into a subnode, check it against all subnodes
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
	 * Remove the given item from the quadtree.
	 * (this function won't recalculate the impacted node)
	 * @param item - object to be removed
	 * @returns true if the item was found and removed.
	 */
	remove(item: QuadTreeItem): boolean {
		let found = false;

		if (typeof item.getBounds === "undefined") {
			// ignore object that cannot be added in the first place
			return false;
		}

		//if we have subnodes ...
		if (this.nodes.length > 0) {
			// determine which subnode the item's CURRENT bounds maps
			// to. If the item moved between insert and remove, this
			// might point to a different subnode than where the item
			// actually lives — the fallback walk below handles that.
			const index = this.getIndex(item);

			if (index !== -1) {
				found = this.nodes[index].remove(item);
			}
		}

		if (!found) {
			// try and remove the item from the list of items in this node
			const idx = this.objects.indexOf(item);
			if (idx !== -1) {
				this.objects.splice(idx, 1);
				found = true;
			}
		}

		// Stale-bounds fallback: the item didn't fit in the expected
		// subnode and wasn't at this level either. The item's bounds
		// may have changed since insert (the broadphase wasn't
		// rebuilt in between). Walk every subnode as a last resort.
		// Costs O(subtree) in the worst case, but only fires on the
		// stale-position path; happy path stays O(log n).
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

			// Collapse: if this subtree is now fully empty (no own
			// objects, all subnodes are empty), recycle the subnodes
			// back to the global `QT_ARRAY` pool and drop them. Keeps
			// the tree compact across the deferred-destroy churn that
			// `Container.removeChildNow` produces, and lets the pool
			// reuse the QuadTree instances on the next split.
			if (
				this.nodes.length > 0 &&
				this.objects.length === 0 &&
				this._subtreeCount === 0
			) {
				for (let i = 0; i < this.nodes.length; i++) {
					this.nodes[i].clear();
					QT_ARRAY_PUSH(this.nodes[i]);
				}
				this.nodes.length = 0;
			}
		}

		return found;
	}

	/**
	 * return true if the node is prunable
	 * @returns true if the node is prunable
	 */
	isPrunable(): boolean {
		// O(1) thanks to the cached subtree count maintained by
		// insert/remove. Previously a recursive `hasChildren()` walk.
		return this._subtreeCount === 0;
	}

	/**
	 * return true if the node has any children
	 * @returns true if the node has any children
	 */
	hasChildren(): boolean {
		// Descendant content exists iff total subtree count exceeds
		// our own object count (anything counted at this level beyond
		// `objects` must live in a subnode).
		return this._subtreeCount > this.objects.length;
	}

	/**
	 * clear the quadtree
	 * @param [bounds] - the bounds to be cleared
	 */
	clear(bounds?: Bounds) {
		this.objects.length = 0;

		for (let i = 0; i < this.nodes.length; i++) {
			this.nodes[i].clear();
			// recycle the quadTree object
			QT_ARRAY_PUSH(this.nodes[i]);
		}
		// empty the array
		this.nodes.length = 0;

		this._subtreeCount = 0;

		// resize the root bounds if required
		if (typeof bounds !== "undefined") {
			(this.bounds as Bounds).setMinMax(
				bounds.min.x,
				bounds.min.y,
				bounds.max.x,
				bounds.max.y,
			);
		}
	}
}

/**
 * Structural shape consumed by `insertContainer` / `removeContainer`
 * when walking a Container's `getChildren()`. Captures only the
 * fields the walk inspects — keeps the conversion strict-mode clean
 * without leaking `any`.
 *
 * `getChildren` is optional because leaf renderables don't have it;
 * the recursive `insertContainer` narrows via {@link hasGetChildren}.
 * @ignore
 */
interface ContainerOrChild extends QuadTreeItem {
	addChild?: (...args: unknown[]) => unknown;
	getChildren?: () => ContainerOrChild[];
}

/**
 * Structural shape used as the `insertContainer` /
 * `removeContainer` parameter type. Named (rather than inline) so the
 * JSDoc-aware lint doesn't require nested `@param container.getChildren`
 * documentation at every call site. `Container` itself satisfies this
 * shape; the optional variant covers the case where the World's lazy
 * `children` accessor returns `undefined`.
 * @ignore
 */
type ContainerLike = { getChildren(): ContainerOrChild[] };
/** @ignore */
type ContainerLikeOptional = { getChildren?(): ContainerOrChild[] };

/**
 * Type predicate: narrows a `ContainerOrChild` to one whose
 * `getChildren` is definitely a function. Lets the recursive
 * `insertContainer(child)` call pass without an
 * `as Required<Pick<..., "getChildren">>` assertion.
 * @param c - the candidate to test
 * @returns true if `c` has a callable `getChildren`
 */
function hasGetChildren(
	c: ContainerOrChild,
): c is ContainerOrChild & ContainerLike {
	return typeof c.getChildren === "function";
}
