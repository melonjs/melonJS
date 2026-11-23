import { bindViewportToLevel } from "./viewport.js";

/**
 * additional import for TypeScript
 * @import Container from "../../renderable/container.js";
 * @import { Bounds } from "../../physics/bounds.ts";
 */

/**
 * Whether a level builds an object, by the `objects` option of `level.load`:
 * all of them by default, none when it is `false`, and the ones a function
 * says, given the object's settings as its class would be.
 * @param {boolean|Function} [wanted] - the option
 * @param {object} settings - the object's settings
 * @returns {boolean} true if the object is to be built
 * @ignore
 */
export function isObjectWanted(wanted, settings) {
	if (wanted === false) {
		return false;
	}
	return typeof wanted !== "function" || Boolean(wanted(settings));
}

/**
 * Add many children to a container at once, in their draw order when it
 * returns: auto-sort and auto-depth are off while they are added (each
 * child's `z` is its own, and one sort is enough), and the sort is done now.
 *
 * Not on a timer, as `container.sort()` does it: until the timer fires the
 * children are in the order they were added, bottom-most first, which a
 * container draws back to front. A frame drawn in between shows the level
 * upside down, its background over everything.
 *
 * Only this container is sorted, unless `recursive`: the containers it
 * already holds are the game's (a HUD kept in an order of its own), and a
 * level added while the game runs has no business with them.
 * @param {Container} container - the container
 * @param {Function} add - adds the children
 * @param {boolean} [recursive=false] - sort the containers it holds as well: for a container the level alone fills
 * @ignore
 */
export function populateContainer(container, add, recursive = false) {
	const sort = container.autoSort;
	const depth = container.autoDepth;
	container.autoSort = false;
	container.autoDepth = false;
	try {
		add();
		container.sortNow(recursive);
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
	// the container was emptied for the level: what it holds is the level's,
	// the groups a map keeps in containers of their own included
	populateContainer(
		container,
		() => {
			level.add();
			// resize the container accordingly
			container.resize(level.width, level.height);
		},
		true,
	);
	// the viewport takes the level's bounds, now and when it is resized
	if (level.bounds !== undefined) {
		follow = bindViewportToLevel(container, level.bounds);
	}
	return follow;
}

/**
 * Apply an opacity multiplier to a renderable and its child renderable (if any).
 * @ignore
 * @param {Renderable} obj - the renderable to apply to
 * @param {number} opacity - the opacity multiplier
 */
export function applyObjectOpacity(obj, opacity) {
	obj.setOpacity(obj.getOpacity() * opacity);
	if (
		typeof obj.renderable !== "undefined" &&
		obj.renderable.isRenderable === true
	) {
		obj.renderable.setOpacity(obj.renderable.getOpacity() * opacity);
	}
}
