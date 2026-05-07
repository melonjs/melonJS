import { colorPool } from "../math/color.ts";
import Body from "../physics/body.js";
import state from "../state/state.ts";
import { CANVAS_ONRESIZE, on } from "../system/event.ts";
import pool from "../system/legacy_pool.js";
import { defer } from "../utils/function";
import { createGUID } from "../utils/utils";
import Renderable from "./renderable.js";

/**
 * Private function to re-use for object removal in a defer
 * @ignore
 */
function deferredRemove(child, keepalive) {
	this.removeChildNow(child, keepalive);
}

let globalFloatingCounter = 0;

/**
 * additional import for TypeScript
 * @import {Color} from "./../math/color.ts";
 * @import Entity from "./entity/entity.js";
 * @import Sprite from "./sprite.js";
 * @import Collectable from "./collectable.js";
 * @import Trigger from "./trigger.js";
 * @import { Draggable } from "./draggable.js";
 * @import { DropTarget } from "./dragndrop.js";
 * @import NineSliceSprite from "./nineslicesprite.js";
 * @import ImageLayer from "./imagelayer.js";
 * @import ColorLayer from "./colorlayer.js";
 * @import Light2d from "./light2d.js";
 * @import UIBaseElement from "./ui/uibaseelement.ts";
 * @import UISpriteElement from "./ui/uispriteelement.ts";
 * @import UITextButton from "./ui/uitextbutton.ts";
 * @import Text from "./text/text.js";
 * @import BitmapText from "./text/bitmaptext.js";
 * @import {Bounds} from "./../physics/bounds.ts";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 */

/**
 * Container represents a collection of child objects.
 * When no explicit dimensions are given, width and height default to Infinity,
 * meaning the container has no intrinsic size, no clipping, and acts as a pure
 * grouping/transform node.
 * In this case, anchorPoint is treated as (0, 0) since there is no meaningful
 * center for an infinite area. Bounds are then derived entirely from children
 * when {@link Container#enableChildBoundsUpdate} is enabled.
 * @category Container
 */
export default class Container extends Renderable {
	/**
	 * @param {number} [x=0] - position of the container (accessible via the inherited pos.x property)
	 * @param {number} [y=0] - position of the container (accessible via the inherited pos.y property)
	 * @param {number} [width=Infinity] - width of the container. Defaults to Infinity (no intrinsic size, no clipping).
	 * @param {number} [height=Infinity] - height of the container. Defaults to Infinity (no intrinsic size, no clipping).
	 * @param {boolean} [root=false] - internal flag, true for the world root container
	 * @ignore root
	 */
	constructor(x = 0, y = 0, width = Infinity, height = Infinity, root = false) {
		// call the super constructor
		super(x, y, width, height);

		/**
		 * keep track of pending sort
		 * @ignore
		 */
		this.pendingSort = null;

		/**
		 * whether the container is the root of the scene
		 * @type {boolean}
		 * @default false
		 */
		this.root = root;

		/**
		 * The array of children of this container.
		 * @ignore
		 */
		this.children = undefined;

		/**
		 * The property of the child object that should be used to sort on this container
		 * value : "x", "y", "z"
		 * @type {string}
		 * @default "z"
		 */
		this._sortOn = "z";
		this._comparator = this._sortZ;

		/**
		 * Specify if the children list should be automatically sorted when adding a new child
		 * @type {boolean}
		 * @default true
		 */
		this.autoSort = true;

		/**
		 * Specify if the children z index should automatically be managed by the parent container
		 * @type {boolean}
		 * @default true
		 */
		this.autoDepth = true;

		/**
		 * Specify if the container draw operation should clip its children to its own bounds
		 * @type {boolean}
		 * @default false
		 */
		this.clipping = false;

		/**
		 * a callback to be extended, triggered after a child has been added or removed
		 * @param {number} index - added or removed child index
		 */
		this.onChildChange = function () {
			// to be extended
		};

		/**
		 * Specify if the container bounds should automatically take in account
		 * all child bounds when updated (this is expensive and disabled by default,
		 * only enable if necessary)
		 * @type {boolean}
		 * @default false
		 */
		this.enableChildBoundsUpdate = false;

		/**
		 * define a background color for this container
		 * @type {Color}
		 * @default (0, 0, 0, 0.0)
		 * @example
		 * // add a red background color to this container
		 * this.backgroundColor.setColor(255, 0, 0);
		 */
		this.backgroundColor = colorPool.get(0, 0, 0, 0.0);

		/**
		 * Used by the debug panel plugin
		 * @ignore
		 */
		this.drawCount = 0;

		// container self apply any defined transformation
		this.autoTransform = true;

		// enable collision and event detection
		this.isKinematic = false;

		// container anchorPoint is always (0, 0) — children position from
		// the container's origin (top-left). This also avoids
		// Infinity * 0.5 = Infinity issues when the container has no
		// explicit size.
		this.anchorPoint.set(0, 0);

		// subscribe on the canvas resize event
		if (this.root === true) {
			// Workaround for not updating container child-bounds automatically (it's expensive!)
			on(CANVAS_ONRESIZE, () => {
				// temporarly enable the enableChildBoundsUpdate flag
				// this.enableChildBoundsUpdate === true;
				// update bounds
				this.updateBounds();
				// this.enableChildBoundsUpdate === false;
			});
		}
	}

	/**
	 * The property of the child object that should be used to sort on this container.
	 * Accepted values: "x", "y", "z"
	 * @type {string}
	 * @default "z"
	 */
	get sortOn() {
		return this._sortOn;
	}
	set sortOn(value) {
		const v = value.toLowerCase();
		if (v !== "x" && v !== "y" && v !== "z") {
			throw new Error(
				`Invalid sortOn value: "${value}" (expected "x", "y", or "z")`,
			);
		}
		this._sortOn = v;
		this._comparator = this["_sort" + v.toUpperCase()];
	}

	/**
	 * reset the container, removing all children, and resetting transforms.
	 */
	reset() {
		// cancel any sort operation
		if (this.pendingSort) {
			clearTimeout(this.pendingSort);
			this.pendingSort = null;
		}

		// delete all children
		const children = this.getChildren();
		for (let i = children.length, child; i >= 0; child = children[--i]) {
			// don't remove it if a persistent object
			if (child && child.isPersistent !== true) {
				this.removeChildNow(child);
			}
		}

		this.currentTransform.identity();

		this.backgroundColor.setColor(0, 0, 0, 0.0);
	}

	/**
	 * Add a child to the container <br>
	 * if auto-sort is disabled, the object will be appended at the bottom of the list.
	 * Adding a child to the container will automatically remove it from its other container.
	 * Meaning a child can only have one parent. This is important if you add a renderable
	 * to a container then add it to the World container it will move it out of the
	 * original container. Then when the World container reset() method is called the renderable
	 * will not be in any container. <br>
	 * if the given child implements an onActivateEvent method, that method will be called
	 * once the child is added to this container.
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be added
	 * @param {number} [z] - forces the z index of the child to the specified value
	 * @returns {Renderable} the added child
	 */
	addChild(child, z) {
		if (!(child instanceof Renderable)) {
			throw new Error(`${String(child)} is not an instance of Renderable`);
		}
		if (child.ancestor instanceof Container) {
			child.ancestor.removeChildNow(child);
		} else {
			// only allocate a GUID if the object has no previous ancestor
			// (e.g. move one child from one container to another)
			child.GUID = createGUID(child.id);
		}

		// add the new child
		child.ancestor = this;
		this.getChildren().push(child);

		// update child bounds to reflect the new ancestor
		if (this.isFloating === true) {
			// only parent container can be floating
			child.floating = false;
		}
		child.updateBounds();

		// set the child z value if required
		if (typeof z === "number") {
			child.pos.z = z;
		} else if (this.autoDepth === true) {
			child.pos.z = this.getChildren().length;
		}

		if (this.autoSort === true) {
			this.sort();
		}

		if (
			typeof child.onActivateEvent === "function" &&
			this.isAttachedToRoot()
		) {
			child.onActivateEvent();
		}

		// force container bounds update if required
		if (this.enableChildBoundsUpdate === true) {
			this.updateBounds();
		}

		// add a physic body(ies) to the game world
		if (this.isAttachedToRoot()) {
			const worldContainer = this.getRootAncestor();
			if (child.body instanceof Body) {
				worldContainer.addBody(child.body);
			}
			// if the child is a container
			if (child instanceof Container) {
				// add all container child bodies
				child.forEach((cchild) => {
					if (cchild.body instanceof Body) {
						worldContainer.addBody(cchild.body);
					}
				});
			}
		}

		// mark the container for repaint
		this.isDirty = true;

		// triggered callback if defined
		this.onChildChange.call(this, this.getChildren().length - 1);

		return child;
	}

	/**
	 * Add a child to the container at the specified index<br>
	 * (the list won't be sorted after insertion)
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be added
	 * @param {number} index - The index at which to insert the child
	 * @returns {Renderable} the added child
	 */
	addChildAt(child, index) {
		if (!(child instanceof Renderable)) {
			throw new Error(`${String(child)} is not an instance of Renderable`);
		}
		if (index >= 0 && index <= this.getChildren().length) {
			if (child.ancestor instanceof Container) {
				child.ancestor.removeChildNow(child);
			} else {
				// only allocate a GUID if the object has no previous ancestor
				// (e.g. move one child from one container to another)
				child.GUID = createGUID();
			}

			// add the new child
			child.ancestor = this;
			this.getChildren().splice(index, 0, child);

			// update child bounds to reflect the new ancestor
			if (this.isFloating === true) {
				// only parent container can be floating
				child.floating = false;
			}
			child.updateBounds();

			if (
				typeof child.onActivateEvent === "function" &&
				this.isAttachedToRoot()
			) {
				child.onActivateEvent();
			}

			// force container bounds update if required
			if (this.enableChildBoundsUpdate === true) {
				this.updateBounds();
			}

			// add a physic body(ies) to the game world
			if (this.isAttachedToRoot()) {
				const worldContainer = this.getRootAncestor();
				if (child.body instanceof Body) {
					worldContainer.addBody(child.body);
				}
				// if the child is a container
				if (child instanceof Container) {
					// add all container child bodies
					child.forEach((cchild) => {
						if (cchild.body instanceof Body) {
							worldContainer.addBody(cchild.body);
						}
					});
				}
			}

			// mark the container for repaint
			this.isDirty = true;

			// triggered callback if defined
			this.onChildChange.call(this, index);

			return child;
		} else {
			throw new Error("Index (" + index + ") Out Of Bounds for addChildAt()");
		}
	}

	/**
	 * The forEach() method executes a provided function once per child element. <br>
	 * the callback function is invoked with three arguments: <br>
	 *    - The current element being processed in the array <br>
	 *    - The index of element in the array. <br>
	 *    - The array forEach() was called upon. <br>
	 * @param {Function} callback - function to execute on each element
	 * @param {object} [thisArg] - value to use as this(i.e reference Object) when executing callback.
	 * @example
	 * // iterate through all children of this container
	 * container.forEach((child) => {
	 *    // do something with the child
	 *    child.doSomething();
	 * });
	 * container.forEach((child, index) => { ... });
	 * container.forEach((child, index, array) => { ... });
	 * container.forEach((child, index, array) => { ... }, thisArg);
	 */
	forEach(callback, thisArg) {
		let i = 0;
		const children = this.getChildren();

		const len = children.length;

		if (typeof callback !== "function") {
			throw new Error(callback + " is not a function");
		}

		while (i < len) {
			callback.call(thisArg ?? this, children[i], i, children);
			i++;
		}
	}

	/**
	 * Swaps the position (z-index) of 2 children
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be added
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child2 - Child to be added
	 */
	swapChildren(child, child2) {
		const index = this.getChildIndex(child);
		const index2 = this.getChildIndex(child2);

		if (index !== -1 && index2 !== -1) {
			// swap z index
			const _z = child.pos.z;
			child.pos.z = child2.pos.z;
			child2.pos.z = _z;
			// swap the positions..
			this.getChildren()[index] = child2;
			this.getChildren()[index2] = child;
			// mark the container as dirty
			this.isDirty = true;
		} else {
			throw new Error(
				child +
					" Both the supplied children must be a child of the caller " +
					this,
			);
		}
	}

	/**
	 * Returns the Child at the specified index
	 * @param {number} index - The index of the child
	 * @returns {Renderable} the child at the specified index
	 */
	getChildAt(index) {
		if (index >= 0 && index < this.getChildren().length) {
			return this.getChildren()[index];
		} else {
			throw new Error("Index (" + index + ") Out Of Bounds for getChildAt()");
		}
	}

	/**
	 * Returns the index of the given Child
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - The child object
	 * @returns {number} index
	 */
	getChildIndex(child) {
		return this.getChildren().indexOf(child);
	}

	/**
	 * Returns the next child within the container or undefined if none
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - The child object
	 * @returns {Renderable} child
	 */
	getNextChild(child) {
		const index = this.getChildren().indexOf(child) + 1;
		if (index >= 0 && index < this.getChildren().length) {
			return this.getChildAt(index);
		}
		return undefined;
	}

	/**
	 * Returns true if contains the specified Child
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - The child object
	 * @returns {boolean}
	 */
	hasChild(child) {
		return this === child.ancestor;
	}

	/**
	 * return the child corresponding to the given property and value.<br>
	 * note : avoid calling this function every frame since
	 * it parses the whole object tree each time
	 * @param {string} prop - Property name
	 * @param {string|RegExp|number|boolean} value - Value of the property
	 * @returns {Renderable[]} Array of children
	 * @example
	 * // get the first child object called "mainPlayer" in a specific container :
	 * let ent = myContainer.getChildByProp("name", "mainPlayer");
	 *
	 * // or query the whole world :
	 * let ent = container.getChildByProp("name", "mainPlayer");
	 *
	 * // partial property matches are also allowed by using a RegExp.
	 * // the following matches "redCOIN", "bluecoin", "bagOfCoins", etc :
	 * let allCoins = container.getChildByProp("name", /coin/i);
	 *
	 * // searching for numbers or other data types :
	 * let zIndex10 = container.getChildByProp("z", 10);
	 * let inViewport = container.getChildByProp("inViewport", true);
	 */
	getChildByProp(prop, value, objList = []) {
		this.forEach((child) => {
			const v = child[prop];
			if (value instanceof RegExp && typeof v === "string") {
				if (value.test(v)) {
					objList.push(child);
				}
			} else if (v === value) {
				objList.push(child);
			}
			if (child instanceof Container) {
				child.getChildByProp(prop, value, objList);
			}
		});

		return objList;
	}

	/**
	 * returns the list of children with the specified class type
	 * @param {object} classType - Class type
	 * @returns {Renderable[]} Array of children
	 */
	getChildByType(classType, objList = []) {
		this.forEach((child) => {
			if (child instanceof classType) {
				objList.push(child);
			}
			if (child instanceof Container) {
				child.getChildByType(classType, objList);
			}
		});

		return objList;
	}

	/**
	 * returns the list of children with the specified name<br>
	 * as defined in Tiled (Name field of the Object Properties)<br>
	 * note : avoid calling this function every frame since
	 * it parses the whole object list each time
	 * @param {string|RegExp|number|boolean} name - child name
	 * @returns {Renderable[]} Array of children
	 */
	getChildByName(name) {
		return this.getChildByProp("name", name);
	}

	/**
	 * return the child corresponding to the specified GUID<br>
	 * note : avoid calling this function every frame since
	 * it parses the whole object list each time
	 * @param {string|RegExp|number|boolean} guid - child GUID
	 * @returns {Renderable} corresponding child or null
	 */
	getChildByGUID(guid) {
		const obj = this.getChildByProp("GUID", guid);
		return obj.length > 0 ? obj[0] : null;
	}

	/**
	 * return all child in this container
	 * @returns {Renderable[]} an array of renderable object
	 */
	getChildren() {
		if (typeof this.children === "undefined") {
			this.children = [];
		}
		return this.children;
	}

	/**
	 * update the bounding box for this container.
	 * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
	 * @returns {Bounds} this container bounding box Rectangle object
	 */
	updateBounds(absolute = true) {
		const bounds = this.getBounds();

		if (this.isFinite()) {
			// call parent method only when container has finite dimensions
			super.updateBounds(absolute);
		} else if (this.enableChildBoundsUpdate === true) {
			// clear bounds so child aggregation starts fresh
			bounds.clear();
		}

		if (this.enableChildBoundsUpdate === true) {
			this.forEach((child) => {
				const childBounds = child.updateBounds(absolute);
				if (childBounds.isFinite()) {
					bounds.addBounds(childBounds);
				}
			});
		}

		return bounds;
	}

	/**
	 * Checks if this container is root or if it's attached to the root container.
	 * @returns {boolean} true if this container is root or if it's attached to the root container
	 */
	isAttachedToRoot() {
		if (this.root === true) {
			return true;
		} else {
			let ancestor = this.ancestor;
			while (ancestor) {
				if (ancestor.root === true) {
					return true;
				}
				ancestor = ancestor.ancestor;
			}
			return false;
		}
	}

	/**
	 * Returns the instance of the root container (i.e. the current application World container).
	 * @returns {Container} root container
	 */
	getRootAncestor() {
		if (this.root === true) {
			return this;
		} else {
			let ancestor = this.ancestor;
			while (ancestor) {
				if (ancestor.root === true) {
					break;
				}
				ancestor = ancestor.ancestor;
			}
			return ancestor;
		}
	}

	/**
	 * @ignore
	 */
	onActivateEvent() {
		this.forEach((child) => {
			if (typeof child.onActivateEvent === "function") {
				child.onActivateEvent();
			}
		});
	}

	/**
	 * Invokes the removeChildNow in a defer, to ensure the child is removed safely after the update & draw stack has completed. <br>
	 * if the given child implements an onDeactivateEvent() method, that method will be called once the child is removed from this container.
	 * @param {Renderable|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be removed
	 * @param {boolean} [keepalive=false] - true to prevent calling child.destroy()
	 */
	removeChild(child, keepalive) {
		if (this.hasChild(child)) {
			defer(deferredRemove, this, child, keepalive);
		} else {
			throw new Error("Child is not mine.");
		}
	}

	/**
	 * Removes (and optionally destroys) a child from the container.<br>
	 * (removal is immediate and unconditional)<br>
	 * Never use keepalive=true with objects from {@link pool}. Doing so will create a memory leak.
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be removed
	 * @param {boolean} [keepalive=False] - True to prevent calling child.destroy()
	 */
	removeChildNow(child, keepalive) {
		if (this.hasChild(child) && this.getChildIndex(child) >= 0) {
			if (typeof child.onDeactivateEvent === "function") {
				child.onDeactivateEvent();
			}

			// remove the body first to avoid a condition where a body can be detached
			// from its parent, before the body is removed from the game world
			if (child.body instanceof Body) {
				const root = this.getRootAncestor();
				if (root) {
					root.removeBody(child.body);
				}
			}

			if (!keepalive) {
				// attempt at recycling the object
				if (pool.push(child, false) === false) {
					//  else just destroy it
					if (typeof child.destroy === "function") {
						child.destroy();
					}
				}
			}

			// Don't cache the child index; another element might have been removed
			// by the child's `onDeactivateEvent` or `destroy` methods
			const childIndex = this.getChildIndex(child);
			if (childIndex >= 0) {
				this.getChildren().splice(childIndex, 1);
				child.ancestor = undefined;
			}

			// force bounds update if required
			if (this.enableChildBoundsUpdate === true) {
				this.updateBounds();
			}

			// mark the container for repaint
			this.isDirty = true;

			// triggered callback if defined
			this.onChildChange.call(this, childIndex);
		}
	}

	/**
	 * Automatically set the specified property of all childs to the given value
	 * @param {string} prop - property name
	 * @param {object} value - property value
	 * @param {boolean} [recursive=false] - recursively apply the value to child containers if true
	 */
	setChildsProperty(prop, value, recursive) {
		this.forEach((child) => {
			if (recursive === true && child instanceof Container) {
				child.setChildsProperty(prop, value, recursive);
			}
			child[prop] = value;
		});
	}

	/**
	 * Move the child in the group one step forward (z depth).
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child -  Child to be moved
	 */
	moveUp(child) {
		const childIndex = this.getChildIndex(child);
		if (childIndex - 1 >= 0) {
			// note : we use an inverted loop
			this.swapChildren(child, this.getChildAt(childIndex - 1));
			// mark the container as dirty
			this.isDirty = true;
		}
	}

	/**
	 * Move the child in the group one step backward (z depth).
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be moved
	 */
	moveDown(child) {
		const childIndex = this.getChildIndex(child);
		if (childIndex >= 0 && childIndex + 1 < this.getChildren().length) {
			// note : we use an inverted loop
			this.swapChildren(child, this.getChildAt(childIndex + 1));
			// mark the container as dirty
			this.isDirty = true;
		}
	}

	/**
	 * Move the specified child to the top(z depth).
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be moved
	 */
	moveToTop(child) {
		const childIndex = this.getChildIndex(child);
		if (childIndex > 0) {
			const children = this.getChildren();
			// note : we use an inverted loop
			children.splice(0, 0, children.splice(childIndex, 1)[0]);
			// increment our child z value based on the previous child depth
			child.pos.z = children[1].pos.z + 1;
			// mark the container as dirty
			this.isDirty = true;
		}
	}

	/**
	 * Move the specified child the bottom (z depth).
	 * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be moved
	 */
	moveToBottom(child) {
		const childIndex = this.getChildIndex(child);
		const children = this.getChildren();
		if (childIndex >= 0 && childIndex < children.length - 1) {
			// note : we use an inverted loop
			children.splice(
				children.length - 1,
				0,
				children.splice(childIndex, 1)[0],
			);
			// increment our child z value based on the next child depth
			child.pos.z = children[children.length - 2].pos.z - 1;
			// mark the container as dirty
			this.isDirty = true;
		}
	}

	/**
	 * Manually trigger the sort of all the childs in the container
	 * @param {boolean} [recursive=false] - recursively sort all containers if true
	 */
	sort(recursive) {
		// do nothing if there is already a pending sort
		if (!this.pendingSort) {
			if (recursive === true) {
				this.forEach((child) => {
					if (child instanceof Container) {
						// note : this will generate one deferred sorting function
						// for each existing containe
						child.sort(recursive);
					}
				});
			}
			this.pendingSort = defer(function () {
				// sort everything in this container
				this.getChildren().sort(this._comparator);
				// clear the defer id
				this.pendingSort = null;
				// make sure we redraw everything
				this.isDirty = true;
			}, this);
		}
	}

	/**
	 * @ignore
	 */
	onDeactivateEvent() {
		this.forEach((child) => {
			if (typeof child.onDeactivateEvent === "function") {
				child.onDeactivateEvent();
			}
		});
	}

	/**
	 * Z Sorting function
	 * @ignore
	 */
	_sortZ(a, b) {
		return b.pos.z - a.pos.z;
	}

	/**
	 * Reverse Z Sorting function
	 * @ignore
	 */
	_sortReverseZ(a, b) {
		return a.pos.z - b.pos.z;
	}

	/**
	 * X Sorting function
	 * @ignore
	 */
	_sortX(a, b) {
		return b.pos.z - a.pos.z || b.pos.x - a.pos.x;
	}

	/**
	 * Y Sorting function
	 * @ignore
	 */
	_sortY(a, b) {
		return b.pos.z - a.pos.z || b.pos.y - a.pos.y;
	}

	/**
	 * Destroy function<br>
	 * @ignore
	 */
	destroy() {
		// empty the container
		this.reset();
		// call the parent destroy method
		super.destroy(arguments);

		colorPool.release(this.backgroundColor);
	}

	/**
	 * container update function. <br>
	 * automatically called by the application update loop {@link Application}
	 * @protected
	 * @param {number} dt - time since the last update in milliseconds.
	 * @returns {boolean} true if the Container is dirty
	 */
	update(dt) {
		let isFloating = false;
		const isPaused = state.isPaused();
		const children = this.getChildren();
		const childrenLength = children.length;
		const cameras = state.current().cameras;

		for (let i = childrenLength, obj; i--, (obj = children[i]); ) {
			if (isPaused && !obj.updateWhenPaused) {
				// skip this object
				continue;
			}

			isFloating = globalFloatingCounter > 0 || obj.floating;
			if (isFloating) {
				globalFloatingCounter++;
			}

			// check if object is in any active cameras
			obj.inViewport = false;
			// iterate through all cameras
			cameras.forEach((camera) => {
				if (camera.isVisible(obj, isFloating)) {
					obj.inViewport = true;
				}
			});

			// update our object
			this.isDirty |= (obj.inViewport || obj.alwaysUpdate) && obj.update(dt);

			if (globalFloatingCounter > 0) {
				globalFloatingCounter--;
			}
		}

		// call the parent method
		return super.update(dt);
	}

	/**
	 * draw this renderable (automatically called by melonJS)
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the viewport to (re)draw
	 */
	draw(renderer, viewport) {
		const bounds = this.getBounds();

		this.drawCount = 0;

		// adjust position before clipping so the renderer's currentTransform
		// sits at this container's local origin. `clipRect` then operates
		// in container-local coords and any scale/rotation accumulated in
		// the matrix is honored when the renderer converts to screen space.
		// (Issue #1349 — passing world-space `bounds.left/top` to the
		// previous local-space-expecting `clipRect` double-counted the
		// translation when the container was nested inside a translated
		// parent.)
		renderer.translate(this.pos.x, this.pos.y);

		// clip the container children to the container bounds.
		// Container's anchorPoint is forced to (0, 0), so the local rect
		// is (0, 0, width, height). `bounds.isFinite()` covers the
		// aggregate (self + children) — a container may have a finite
		// child bounds while its own `width/height` are `Infinity`
		// (e.g., the world container or any `enableChildBoundsUpdate`
		// container with a finite child but no intrinsic size). Passing
		// `Infinity` to `clipRect` would NaN-poison the WebGL scissor
		// math, so guard on the size we actually pass too.
		if (
			this.root === false &&
			this.clipping === true &&
			bounds.isFinite() === true &&
			Number.isFinite(this.width) === true &&
			Number.isFinite(this.height) === true
		) {
			renderer.clipRect(0, 0, this.width, this.height);
		}

		// color background if defined
		if (this.backgroundColor.alpha > 1 / 255) {
			renderer.clearColor(this.backgroundColor);
		}

		const isNonDefaultCamera = !viewport.isDefault;

		const children = this.getChildren();
		for (let i = children.length, obj; i--, (obj = children[i]); ) {
			const isFloating = obj.floating === true;

			if (obj.inViewport || isFloating) {
				// skip UI-only floating elements on non-default cameras
				if (isFloating && isNonDefaultCamera && !obj.visibleInAllCameras) {
					continue;
				}

				if (isFloating) {
					renderer.save();
					renderer.resetTransform();
					if (isNonDefaultCamera) {
						renderer.setProjection(viewport.screenProjection);
					}
				}

				obj.preDraw(renderer);
				obj.draw(renderer, viewport);
				obj.postDraw(renderer);

				if (isFloating) {
					if (isNonDefaultCamera) {
						renderer.setProjection(viewport.worldProjection);
					}
					renderer.restore();
				}

				this.drawCount++;
			}
		}
	}
}
