import Container from "../../renderable/container.js";
import { off, on, VIEWPORT_ONRESIZE } from "../../system/event.ts";

/**
 * additional import for TypeScript
 * @import { Bounds } from "../../physics/bounds.ts";
 */

/**
 * the resize handler of the level each application's viewport follows: one
 * per application, replaced when another level is bound
 * @ignore
 */
const handlers = new WeakMap();

/**
 * Recursively recompute absolute bounds for a container and all its
 * descendants. Used when the container's pos changes (centering on a wider
 * viewport): children cache their absolute bounds at addChild time, and
 * those caches are stale until each child happens to call updateBounds on
 * its own (which only happens organically when its own pos changes).
 * @param {Container} container - the container to refresh
 * @ignore
 * @internal
 */
function refreshAbsoluteBounds(container) {
	container.forEach((child) => {
		child.updateBounds(true);
		if (child instanceof Container) {
			refreshAbsoluteBounds(child);
		}
	});
}

/**
 * Have the viewport of a container's application follow a level: its bounds
 * are the level's (or the viewport's own size where the level is smaller),
 * and a level smaller than the viewport is centred in it. Both are applied
 * now and again each time the viewport is resized.
 *
 * A viewport follows one level: binding another replaces the first, and
 * {@link releaseViewport} ends it when the level goes.
 * @param {Container} container - the container the level was added to
 * @param {Bounds} levelBounds - the level's bounds, in the container
 * @returns {Function} the handler, to give to {@link releaseViewport}
 * @ignore
 */
export function bindViewportToLevel(container, levelBounds) {
	const app = container.getRootAncestor().app;

	const follow = (width, height) => {
		// adjust the viewport bounds if level is smaller
		// (an infinite map's level can start left of or above 0)
		app.viewport.setBounds(
			levelBounds.left,
			levelBounds.top,
			Math.max(levelBounds.width, width),
			Math.max(levelBounds.height, height),
		);
		// center the map if smaller than the current viewport
		const newX = Math.max(0, ~~((width - levelBounds.width) / 2));
		const newY = Math.max(0, ~~((height - levelBounds.height) / 2));
		if (container.pos.x !== newX || container.pos.y !== newY) {
			container.pos.set(newX, newY, container.pos.z);
			// A child caches its absolute bounds (centered around
			// ancestor.absPos at the time of the last `updateBounds`).
			// When the parent's pos changes, descendants that don't
			// move on their own (tile layers, static collision
			// objects, triggers) keep stale absolute bounds, so
			// anything that reads them (debug overlay, viewport
			// culling) sees the pre-centering position. Walk the
			// tree once after a real move and refresh.
			refreshAbsoluteBounds(container);
		}
	};

	// the level bound before, if any, is followed no longer: its handler
	// would set its own bounds back on every resize, and keep it alive
	const previous = handlers.get(app);
	if (previous !== undefined) {
		off(VIEWPORT_ONRESIZE, previous);
	}
	handlers.set(app, follow);

	// force viewport bounds update
	follow(app.viewport.width, app.viewport.height);
	on(VIEWPORT_ONRESIZE, follow);

	return follow;
}

/**
 * Stop a viewport following a level, when the level is destroyed. Does
 * nothing for a handler another level has replaced since.
 * @param {Function} [follow] - what {@link bindViewportToLevel} returned
 * @ignore
 */
export function releaseViewport(follow) {
	if (follow === undefined) {
		return;
	}
	off(VIEWPORT_ONRESIZE, follow);
}
