import { colorPool } from "../math/color.ts";
import Body from "../physics/builtin/body.js";
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

/**
 * Module-level cache of the camera position used by `_sortDepth`.
 * Captured once per sort (in `sort` / `sortNow`) so the comparator —
 * which runs O(N log N) times — doesn't pay a `state.current()` lookup
 * per comparison. Safe to be module-scoped: JS is single-threaded and
 * sort is synchronous within each container.
 * @ignore
 */
let _depthCamX = 0;
let _depthCamY = 0;
let _depthCamZ = 0;

/**
 * Refresh the cached camera position from the active stage. Falls back
 * to (0, 0, 0) when no camera exists yet (e.g. early init, before any
 * stage has been set). Called just-in-time before `sortOn === "depth"`
 * runs its sort. The camera is a `Renderable` (Camera2d/Camera3d), so
 * `pos.z` is guaranteed by `ObservableVector3d` — no per-field guard.
 *
 * `Stage.cameras` is a `Map`, not an array — we read the `"default"`
 * key (every Stage seeds this in `reset`). For split-screen setups the
 * world sorts once per frame against the primary camera; the secondary
 * camera sees slightly-imperfect order which is the standard
 * compromise for split-screen rendering.
 * @ignore
 */
function captureDepthCamera() {
	const stage = state.current();
	const cam = stage?.cameras?.get("default");
	if (cam) {
		_depthCamX = cam.pos.x;
		_depthCamY = cam.pos.y;
		_depthCamZ = cam.pos.z;
	} else {
		_depthCamX = 0;
		_depthCamY = 0;
		_depthCamZ = 0;
	}
}

/**
 * Register a child's physics body with the root world container when the
 * child is added to the tree. Two paths coexist:
 *  - `child.bodyDef`: declarative {@link BodyDefinition}, routed through
 *    `world.adapter.addBody(child, child.bodyDef)`. Engine-portable.
 *    Wins whenever set — even on re-registration of a previously-built
 *    body — so pool-recycled renderables get their def fields re-applied
 *    each time (collisionType, maxVelocity, etc. restored to the def's
 *    values regardless of any in-game mutation).
 *  - `child.body instanceof Body`: pre-constructed legacy {@link Body}
 *    with no `bodyDef`, routed through `world.addBody(child.body)`.
 *    BuiltinAdapter-only.
 * @ignore
 */
function registerChildBody(child, worldContainer) {
	if (child.bodyDef) {
		// adapter.addBody handles both cases: builds a fresh Body when
		// none exists, or re-applies def fields onto the existing one
		// (legacy-bridge path) — see BuiltinAdapter.addBody.
		worldContainer.adapter.addBody(child, child.bodyDef);
	} else if (child.body instanceof Body) {
		worldContainer.addBody(child.body);
	}
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
	 * The property of the child object that should be used to sort on
	 * this container.
	 *
	 * - `"x"` / `"y"` — 2D scroll-order, descending on both axes
	 *   (higher pos.z first; tied z, higher pos.x or pos.y first).
	 *   Suited to side-scrollers and top-down games.
	 * - `"z"` — descending pos.z (higher z draws on top). Default for
	 *   `Camera2d` — matches the painter's-algorithm 2D layering model
	 *   where pos.z is "layer index".
	 * - `"depth"` — **Camera3d-only.** Ascending squared distance from
	 *   the active camera (closest first in the array → far drawn first
	 *   → close drawn on top under `Container.draw`'s reverse-iteration
	 *   walk). This is the only correct sort for alpha-blended sprites
	 *   under perspective projection, where neither pos.z nor pos.x/y
	 *   layering produces correct occlusion (the closer/farther
	 *   relationship flips as the camera orbits). Set automatically
	 *   when an `Application` or `Stage` is constructed with
	 *   `cameraClass: Camera3d`. Has no useful effect under `Camera2d`
	 *   (ortho projection doesn't need camera-distance ordering) and
	 *   pays an O(N log N) sort per frame, so don't enable it manually
	 *   in 2D-only games.
	 * @type {"x"|"y"|"z"|"depth"}
	 * @default "z"
	 */
	get sortOn() {
		return this._sortOn;
	}
	set sortOn(value) {
		const v = value.toLowerCase();
		if (v !== "x" && v !== "y" && v !== "z" && v !== "depth") {
			throw new Error(
				`Invalid sortOn value: "${value}" (expected "x", "y", "z", or "depth")`,
			);
		}
		this._sortOn = v;
		if (v === "depth") {
			this._comparator = this._sortDepth;
		} else {
			this._comparator = this["_sort" + v.toUpperCase()];
		}
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
			// Reparenting: detach from the previous ancestor WITHOUT
			// destroying the child. The default `removeChildNow` path
			// runs `destroy()` for any child not registered with the
			// legacy `pool.push` registry (Particle pool-recycled
			// instances are a real-world example) — which nulls
			// `child.pos` and crashes the very next `updateBounds`
			// call below. We're moving the child, not disposing of it.
			child.ancestor.removeChildNow(child, true);
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

		// Register physics bodies BEFORE firing onActivateEvent so that
		// `child.body` is available inside the hook for both legacy
		// (pre-built `new Body(...)`) AND declarative (`bodyDef`) users.
		// Legacy users are unaffected — their body was already set in
		// the constructor; the order swap only matters for bodyDef.
		if (this.isAttachedToRoot()) {
			const worldContainer = this.getRootAncestor();
			registerChildBody(child, worldContainer);
			// if the child is a container
			if (child instanceof Container) {
				// add all container child bodies
				child.forEach((cchild) => {
					registerChildBody(cchild, worldContainer);
				});
			}
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
				// Reparenting — see Container.addChild for why
				// `keepalive=true` is required here.
				child.ancestor.removeChildNow(child, true);
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

			// Register physics bodies BEFORE firing onActivateEvent so
			// `child.body` is available in the hook for both legacy
			// (pre-built `new Body(...)`) AND declarative (`bodyDef`)
			// users. See addChild for the rationale.
			if (this.isAttachedToRoot()) {
				const worldContainer = this.getRootAncestor();
				registerChildBody(child, worldContainer);
				// if the child is a container
				if (child instanceof Container) {
					// add all container child bodies
					child.forEach((cchild) => {
						registerChildBody(cchild, worldContainer);
					});
				}
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
	 * @param {...*} _args - reserved; widens the signature so subclass
	 *   overrides like `onActivateEvent(app)` remain structurally
	 *   assignable to the base Container/Renderable type.
	 */
	onActivateEvent(..._args) {
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

			const root = this.getRootAncestor();

			// Evict the child (and any descendants if it's a container)
			// from the broadphase quadtree. The broadphase is rebuilt
			// each `world.update()`, but pointer events and narrow-phase
			// queries can fire between the deferred `removeChildNow` and
			// the next rebuild — a stale reference there would return a
			// destroyed renderable and crash any caller that read its
			// `pos` (e.g. `_sortReverseZ`).
			if (root?.broadphase) {
				if (typeof child.addChild === "function") {
					root.broadphase.removeContainer(child);
				}
				root.broadphase.remove(child);
			}

			// Remove the body first to avoid a condition where a body can
			// be detached from its parent before it's removed from the
			// game world. `child.body` may be a melonJS `Body` (legacy /
			// builtin adapter) or an adapter-specific handle (e.g.
			// `Matter.Body` under the matter adapter); either way the
			// adapter knows how to clean it up by renderable identity.
			if (child.body) {
				/** @type {{ adapter?: { removeBody?: (r: object) => void } }} */
				const world = root;
				if (world?.adapter?.removeBody) {
					world.adapter.removeBody(child);
				} else if (child.body instanceof Body) {
					// Container detached from the world tree — fall back to
					// the legacy `world.removeBody(body)` path if available.
					// This only handles a legacy `Body`; an adapter-specific
					// handle reaching this branch silently leaks (warn so it
					// surfaces in development).
					root?.removeBody?.(child.body);
				} else {
					console.warn(
						"melonJS: removeChildNow could not clean up an adapter-specific body — the container is not attached to a world with an adapter. The body remains in the physics engine.",
					);
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
				// refresh the cached camera position so `_sortDepth`
				// sees the current view — no-op for x/y/z modes
				if (this._sortOn === "depth") {
					captureDepthCamera();
				}
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
	 * Synchronous variant of {@link Container#sort}. Sorts immediately
	 * — no defer — using the current `_comparator`. Intended for
	 * per-frame callers that need the order to be valid for the very
	 * next render (e.g. `Camera3d` refreshing the `"depth"` sort after
	 * the camera has moved, where waiting for the deferred sort tick
	 * would render a stale frame).
	 * @param {boolean} [recursive=false] - recursively sort sub-containers
	 */
	sortNow(recursive) {
		if (this._sortOn === "depth") {
			captureDepthCamera();
		}
		const children = this.getChildren();
		if (children.length > 1) {
			children.sort(this._comparator);
			this.isDirty = true;
		}
		if (recursive === true) {
			for (let i = 0; i < children.length; i++) {
				const c = children[i];
				if (c instanceof Container) {
					c.sortNow(true);
				}
			}
		}
	}

	/**
	 * @ignore
	 * @param {...*} _args - reserved; widens the signature so subclass
	 *   overrides like `onDeactivateEvent(app)` remain structurally
	 *   assignable to the base Container/Renderable type.
	 */
	onDeactivateEvent(..._args) {
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
	 * Camera-distance sorting function used by `sortOn = "depth"`.
	 * Orders children by ascending squared distance from the cached
	 * camera position — closest first in the array, so
	 * {@link Container#draw}'s reverse-iteration walk paints far→near
	 * (correct painter's algorithm for alpha-blended sprites under
	 * perspective). The cached position is refreshed by
	 * {@link captureDepthCamera} just before each sort runs; this
	 * comparator stays tight (zero allocation, six subtracts + three
	 * mul-adds per pair) for the hot O(N log N) path.
	 *
	 * Container children are `Renderable` instances with an
	 * `ObservableVector3d` pos — `pos.z` is always defined, no guard
	 * needed here.
	 * @ignore
	 */
	_sortDepth(a, b) {
		const ax = a.pos.x - _depthCamX;
		const ay = a.pos.y - _depthCamY;
		const az = a.pos.z - _depthCamZ;
		const bx = b.pos.x - _depthCamX;
		const by = b.pos.y - _depthCamY;
		const bz = b.pos.z - _depthCamZ;
		return ax * ax + ay * ay + az * az - (bx * bx + by * by + bz * bz);
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
					// Floating renderables draw in screen space — swap to
					// the camera's flat screen ortho regardless of whether
					// we're on the default camera. Under Camera2d this is
					// a no-op (its `screenProjection` mirrors
					// `projectionMatrix`); under Camera3d this is the only
					// way to render floating Text / HUD / overlays without
					// the perspective projection NaN-ing them via
					// `w = 0` perspective divide on world-z=0 points.
					renderer.setProjection(viewport.screenProjection);
				}

				obj.preDraw(renderer);
				obj.draw(renderer, viewport);
				obj.postDraw(renderer);

				if (isFloating) {
					// Restore the projection the camera had installed for
					// this draw pass — non-default cameras use a separate
					// `worldProjection`; the default camera just uses
					// `projectionMatrix` directly.
					renderer.setProjection(
						isNonDefaultCamera
							? viewport.worldProjection
							: viewport.projectionMatrix,
					);
					renderer.restore();
				}
			}
		}
	}
}
