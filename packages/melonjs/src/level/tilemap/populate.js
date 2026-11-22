import { bindViewportToLevel } from "./viewport.js";

/**
 * additional import for TypeScript
 * @import Container from "../../renderable/container.js";
 * @import { Bounds } from "../../physics/bounds.ts";
 */

/**
 * Add many children to a container at once, in their draw order when it
 * returns: auto-sort and auto-depth are off while they are added (each
 * child's `z` is its own, and one sort is enough), and the sort is done now.
 *
 * Not on a timer, as `container.sort()` does it: until the timer fires the
 * children are in the order they were added, bottom-most first, which a
 * container draws back to front. A frame drawn in between shows the level
 * upside down, its background over everything.
 * @param {Container} container - the container
 * @param {Function} add - adds the children
 * @ignore
 */
export function populateContainer(container, add) {
	const sort = container.autoSort;
	const depth = container.autoDepth;
	container.autoSort = false;
	container.autoDepth = false;
	try {
		add();
		container.sortNow(true);
	} finally {
		container.autoSort = sort;
		container.autoDepth = depth;
	}
}

/**
 * Add a level to a container, the way every level format does: its
 * background color, its children in their draw order, the container sized to
 * the level, and the viewport following the level's area when asked.
 * @param {Container} container - the container, emptied
 * @param {object} level - what the level is
 * @param {Function} level.add - adds the level's layers and objects to the container
 * @param {string} [level.backgroundColor] - the level's background color, as a CSS color
 * @param {number} level.width - the level's width, in pixels
 * @param {number} level.height - the level's height, in pixels
 * @param {Bounds} [level.bounds] - the area the viewport is to follow; without it the viewport is left alone
 * @returns {Function|undefined} what follows the viewport, for `releaseViewport`
 * @ignore
 */
export function addLevelToContainer(container, level) {
	let follow;
	if (level.backgroundColor) {
		container.backgroundColor.parseCSS(level.backgroundColor);
	}
	populateContainer(container, () => {
		level.add();
		// resize the container accordingly
		container.resize(level.width, level.height);
	});
	// the viewport takes the level's bounds, now and when it is resized
	if (level.bounds !== undefined) {
		follow = bindViewportToLevel(container, level.bounds);
	}
	return follow;
}
