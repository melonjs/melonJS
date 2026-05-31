import { collision } from "../collision.js";
import type World from "../world.js";
import { AABB3d } from "./aabb3d.ts";
import type { Broadphase } from "./broadphase.ts";
import Octree from "./octree.ts";
import QuadTree from "./quadtree.ts";

/**
 * Build the spatial broadphase that matches `world.sortOn`. Called
 * by `World` on construction and on every 2D↔3D sortOn flip; not
 * part of the user-facing surface.
 *
 * - `sortOn === "depth"` → {@link Octree} rooted at an origin-
 *   centred ±10000 box. Camera3d games conventionally centre the
 *   play area on the world origin (items at e.g.
 *   `x ∈ [-PLAY_BOUND_X, PLAY_BOUND_X]`); `world.getBounds()` returns
 *   the 2D viewport rect `(0..w, 0..h)` which doesn't contain those
 *   items. Using viewport bounds as the octree root would
 *   misclassify negative-coord items into octants whose AABBs don't
 *   contain them, breaking `querySphere`'s spatial pruning. ±10000
 *   covers arcade-3D scales (AfterBurner ≈ ±350 xy, ±1000 z); items
 *   outside still work — `getIndex` keeps them at `root.objects` so
 *   queries walk them via the root-level pass, just without the
 *   spatial-partition win.
 * - any other sortOn → {@link QuadTree} rooted at
 *   `world.getBounds().clone()` (the viewport rect).
 *
 * Lives in `physics/broadphase/` (not on `World`) so the World class
 * doesn't need to know which concrete tree class implements the
 * spatial index, or what bounds shape each class wants — those are
 * broadphase concerns.
 * @param world - the world this broadphase will index
 */
export function createBroadphase(world: World): Broadphase {
	if (world.sortOn === "depth") {
		const aabb = new AABB3d();
		aabb.setMinMax(-10000, -10000, -10000, 10000, 10000, 10000);
		return new Octree(world, aabb, collision.maxChildren, collision.maxDepth);
	}
	return new QuadTree(
		world,
		world.getBounds().clone(),
		collision.maxChildren,
		collision.maxDepth,
	);
}
