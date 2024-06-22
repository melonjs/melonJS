/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import Renderable from './renderable.js';
import { createGUID } from '../utils/utils.js';
import { defer } from '../utils/function.js';
import { game } from '../index.js';
import { on, CANVAS_ONRESIZE } from '../system/event.js';
import pool from '../system/pooling.js';
import state from '../state/state.js';
import Body from '../physics/body.js';

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
 * @import Color from "./../math/color.js";
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
 * @import UIBaseElement from "./ui/uibaseelement.js";
 * @import UISpriteElement from "./ui/uispriteelement.js";
 * @import UITextButton from "./ui/uitextbutton.js";
 * @import Text from "./text/text.js";
 * @import BitmapText from "./text/bitmaptext.js";
 * @import Bounds from "./../physics/bounds.js";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 */

/**
 * @classdesc
 * Container represents a collection of child objects
 * @augments Renderable
 */
class Container extends Renderable {
    /**
     * @param {number} [x=0] - position of the container (accessible via the inherited pos.x property)
     * @param {number} [y=0] - position of the container (accessible via the inherited pos.y property)
     * @param {number} [width=game.viewport.width] - width of the container
     * @param {number} [height=game.viewport.height] - height of the container
     */
    constructor(x = 0, y = 0, width, height, root = false) {

        // call the super constructor
        super(
            x, y,
            typeof width === "undefined" ? (typeof game.viewport !== "undefined" ? game.viewport.width : Infinity) : width,
            typeof height === "undefined" ? (typeof game.viewport !== "undefined" ? game.viewport.height : Infinity) : height
        );

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
        this.sortOn = "z";

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
         * Specify if the container draw operation should clip his children to its own bounds
         * @type {boolean}
         * @default false
         */
        this.clipping = false;

        /**
         * a callback to be extended, triggered after a child has been added or removed
         * @param {number} index - added or removed child index
         */
        this.onChildChange = function (index) {   // eslint-disable-line no-unused-vars
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
        this.backgroundColor = pool.pull("Color", 0, 0, 0, 0.0);

        /**
         * Used by the debug panel plugin
         * @ignore
         */
        this.drawCount = 0;

        // container self apply any defined transformation
        this.autoTransform = true;

        // enable collision and event detection
        this.isKinematic = false;

        this.anchorPoint.set(0, 0);

        // subscribe on the canvas resize event
        if (this.root === true) {
            // Workaround for not updating container child-bounds automatically (it's expensive!)
            on(CANVAS_ONRESIZE, () => {
                // temporarly enable the enableChildBoundsUpdate flag
                this.enableChildBoundsUpdate === true;
                // update bounds
                this.updateBounds();
                this.enableChildBoundsUpdate === false;
            });
        }
    }

    /**
     * reset the container, removing all childrens, and reseting transforms.
     */
    reset() {
        // cancel any sort operation
        if (this.pendingSort) {
            clearTimeout(this.pendingSort);
            this.pendingSort = null;
        }

        // delete all children
        let children = this.getChildren();
        for (let i = children.length, child; i >= 0; (child = children[--i])) {
            // don't remove it if a persistent object
            if (child && child.isPersistent !== true) {
                this.removeChildNow(child);
            }
        }

        if (typeof this.currentTransform !== "undefined") {
            // just reset some variables
            this.currentTransform.identity();
        }

        this.backgroundColor.setColor(0, 0, 0, 0.0);
    }

    /**
     * Add a child to the container <br>
     * if auto-sort is disable, the object will be appended at the bottom of the list.
     * Adding a child to the container will automatically remove it from its other container.
     * Meaning a child can only have one parent. This is important if you add a renderable
     * to a container then add it to the World container it will move it out of the
     * orginal container. Then when the World container reset() method is called the renderable
     * will not be in any container. <br>
     * if the given child implements a onActivateEvent method, that method will be called
     * once the child is added to this container.
     * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be added
     * @param {number} [z] - forces the z index of the child to the specified value
     * @returns {Renderable} the added child
     */
    addChild(child, z) {
        if (child.ancestor instanceof Container) {
            child.ancestor.removeChildNow(child);
        }
        else {
            // only allocate a GUID if the object has no previous ancestor
            // (e.g. move one child from one container to another)
            if (child.isRenderable) {
                // allocated a GUID value (use child.id as based index if defined)
                child.GUID = createGUID(child.id);
            }
        }

        // add the new child
        child.ancestor = this;
        this.getChildren().push(child);

        // update child bounds to reflect the new ancestor
        if (typeof child.updateBounds === "function") {
            if (this.isFloating === true) {
                // only parent container can be floating
                child.floating = false;
            }
            child.updateBounds();
        }

        // set the child z value if required
        if (typeof(child.pos) !== "undefined") {
            if (typeof(z) === "number") {
                child.pos.z = z;
            } else if (this.autoDepth === true) {
                child.pos.z = this.getChildren().length;
            }
        }

        if (this.autoSort === true) {
            this.sort();
        }

        if (typeof child.onActivateEvent === "function" && this.isAttachedToRoot()) {
            child.onActivateEvent();
        }

        // force container bounds update if required
        if (this.enableChildBoundsUpdate === true) {
            this.updateBounds();
        }

        // if a physic body(ies) to the game world
        if (this.isAttachedToRoot()) {
            let worldContainer = this.getRootAncestor();
            if (child.body instanceof Body) {
                worldContainer.addBody(child.body);
            }
            // if the child is a container
            if (child instanceof Container) {
                // add all container child bodies
                // TODO: make it recursive ?
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
        if (index >= 0 && index < this.getChildren().length) {
            if (child.ancestor instanceof Container) {
                child.ancestor.removeChildNow(child);
            }
            else {
                // only allocate a GUID if the object has no previous ancestor
                // (e.g. move one child from one container to another)
                if (child.isRenderable) {
                    // allocated a GUID value
                    child.GUID = createGUID();
                }
            }

            // add the new child
            child.ancestor = this;
            this.getChildren().splice(index, 0, child);

            // update child bounds to reflect the new ancestor
            if (typeof child.updateBounds === "function") {
                if (this.isFloating === true) {
                    // only parent container can be floating
                    child.floating = false;
                }
                child.updateBounds();
            }

            if (typeof child.onActivateEvent === "function" && this.isAttachedToRoot()) {
                child.onActivateEvent();
            }

            // force container bounds update if required
            if (this.enableChildBoundsUpdate === true) {
                this.updateBounds();
            }

            // if a physic body(ies) to the game world
            if (this.isAttachedToRoot()) {
                let worldContainer = this.getRootAncestor();
                if (child.body instanceof Body) {
                    worldContainer.addBody(child.body);
                }
                // if the child is a container
                if (child instanceof Container) {
                    // add all container child bodies
                    // TODO: make it recursive ?
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
        }
        else {
            throw new Error("Index (" + index + ") Out Of Bounds for addChildAt()");
        }
    }

    /**
     * The forEach() method executes a provided function once per child element. <br>
     * the callback function is invoked with three arguments: <br>
     *    - The current element being processed in the array <br>
     *    - The index of element in the array. <br>
     *    - The array forEach() was called upon. <br>
     * @param {Function} callback - fnction to execute on each element
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
        let context = this, i = 0;
        let children = this.getChildren();

        let len = children.length;

        if (typeof callback !== "function") {
            throw new Error(callback + " is not a function");
        }

        if (arguments.length > 1) {
            context = thisArg;
        }

        while (i < len) {
            callback.call(context, children[i], i, children);
            i++;
        }
    }

    /**
     * Swaps the position (z-index) of 2 children
     * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be added
     * @param {Renderable|Entity|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child2 - Child to be added
     */
    swapChildren(child, child2) {
        let index = this.getChildIndex(child);
        let index2 = this.getChildIndex(child2);

        if ((index !== -1) && (index2 !== -1)) {
            // swap z index
            let _z = child.pos.z;
            child.pos.z = child2.pos.z;
            child2.pos.z = _z;
            // swap the positions..
            this.getChildren()[index] = child2;
            this.getChildren()[index2] = child;
            // mark the container as dirty
            this.isDirty = true;
        }
        else {
            throw new Error(child + " Both the supplied childs must be a child of the caller " + this);
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
        }
        else {
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
        let index = this.getChildren().indexOf(child) - 1;
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
     * @returns {Renderable[]} Array of childs
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
    getChildByProp(prop, value)    {
        let objList = [];

        /**
         * @ignore
         */
        function compare(obj, prop) {
            let v = obj[prop];
            if (value instanceof RegExp && typeof(v) === "string") {
                if (value.test(v)) {
                    objList.push(obj);
                }
            }
            else if (v === value) {
                objList.push(obj);
            }
        }

        this.forEach((child) => {
            compare(child, prop);
            if (child instanceof Container) {
                objList = objList.concat(child.getChildByProp(prop, value));
            }
        });

        return objList;
    }

    /**
     * returns the list of childs with the specified class type
     * @param {object} classType - Class type
     * @returns {Renderable[]} Array of children
     */
    getChildByType(classType) {
        let objList = [];

        this.forEach((child) => {
            if (child instanceof classType) {
                objList.push(child);
            }
            if (child instanceof Container) {
                objList = objList.concat(child.getChildByType(classType));
            }
        });

        return objList;
    }

    /**
     * returns the list of childs with the specified name<br>
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
        let obj = this.getChildByProp("GUID", guid);
        return (obj.length > 0) ? obj[0] : null;
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
        let bounds = this.getBounds();

        // call parent method
        super.updateBounds(absolute);

        if (this.enableChildBoundsUpdate === true) {
            this.forEach((child) => {
                if (child.isRenderable) {
                    let childBounds = child.updateBounds(true);
                    if (childBounds.isFinite()) {
                        bounds.addBounds(childBounds);
                    }
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
     * update the cointainer's bounding rect (private)
     * @ignore
     */
    updateBoundsPos(newX = this.pos.x, newY = this.pos.y) {
        // call the parent method
        super.updateBoundsPos(newX, newY);

        // Notify children that the parent's position has changed
        this.forEach((child) => {
            if (child.isRenderable) {
                child.updateBoundsPos(
                    child.pos.x + newX - this.pos.x,
                    child.pos.y + newY - this.pos.y
                );
            }
        });
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
     * if the given child implements a onDeactivateEvent() method, that method will be called once the child is removed from this container.
     * @param {Renderable|Sprite|Collectable|Trigger|Draggable|DropTarget|NineSliceSprite|ImageLayer|ColorLayer|Light2d|UIBaseElement|UISpriteElement|UITextButton|Text|BitmapText} child - Child to be removed
     * @param {boolean} [keepalive=false] - true to prevent calling child.destroy()
     */
    removeChild(child, keepalive) {
        if (this.hasChild(child)) {
            defer(deferredRemove, this, child, keepalive);
        }
        else {
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
        if (this.hasChild(child) && (this.getChildIndex(child) >= 0)) {
            if (typeof child.onDeactivateEvent === "function") {
                child.onDeactivateEvent();
            }

            // remove the body first to avoid a condition where a body can be detached
            // from its parent, before the body is removed from the game world
            if (child.body instanceof Body) {
                this.getRootAncestor().removeBody(child.body);
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
            let childIndex = this.getChildIndex(child);
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
            if ((recursive === true) && (child instanceof Container)) {
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
        let childIndex = this.getChildIndex(child);
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
        let childIndex = this.getChildIndex(child);
        if (childIndex >= 0 && (childIndex + 1) < this.getChildren().length) {
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
        let childIndex = this.getChildIndex(child);
        if (childIndex > 0) {
            let children = this.getChildren();
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
        let childIndex = this.getChildIndex(child);
        let children = this.getChildren();
        if (childIndex >= 0 && childIndex < (children.length - 1)) {
            // note : we use an inverted loop
            children.splice((children.length - 1), 0, children.splice(childIndex, 1)[0]);
            // increment our child z value based on the next child depth
            child.pos.z = children[(children.length - 2)].pos.z - 1;
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
                        // note : this will generate one defered sorting function
                        // for each existing containe
                        child.sort(recursive);
                    }
                });
            }
            /** @ignore */
            this.pendingSort = defer(function () {
                // sort everything in this container
                this.getChildren().sort(this["_sort" + this.sortOn.toUpperCase()]);
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
        return (b.pos && a.pos) ? (b.pos.z - a.pos.z) : (a.pos ? -Infinity : Infinity);
    }

    /**
     * Reverse Z Sorting function
     * @ignore
     */
    _sortReverseZ(a, b) {
        return (a.pos && b.pos) ? (a.pos.z - b.pos.z) : (a.pos ? Infinity : -Infinity);
    }

    /**
     * X Sorting function
     * @ignore
     */
    _sortX(a, b) {
        if (!b.pos || !a.pos) {
            return (a.pos ? -Infinity : Infinity);
        }
        let result = b.pos.z - a.pos.z;
        return (result ? result : (b.pos.x - a.pos.x));
    }

    /**
     * Y Sorting function
     * @ignore
     */
    _sortY(a, b) {
        if (!b.pos || !a.pos) {
            return (a.pos ? -Infinity : Infinity);
        }
        let result = b.pos.z - a.pos.z;
        return (result ? result : (b.pos.y - a.pos.y));
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
        let isPaused = state.isPaused();
        let children = this.getChildren();
        const childrenLength = children.length;

        for (let i = childrenLength, obj; i--, (obj = children[i]);) {
            if (isPaused && (!obj.updateWhenPaused)) {
                // skip this object
                continue;
            }

            if (obj.isRenderable) {
                isFloating = (globalFloatingCounter > 0 || obj.floating);
                if (isFloating) {
                    globalFloatingCounter++;
                }

                // check if object is in any active cameras
                obj.inViewport = false;
                // iterate through all cameras
                state.current().cameras.forEach((camera) => {
                    if (camera.isVisible(obj, isFloating)) {
                        obj.inViewport = true;
                    }
                });

                // update our object
                this.isDirty |= ((obj.inViewport || obj.alwaysUpdate) && obj.update(dt));

                if (globalFloatingCounter > 0) {
                    globalFloatingCounter--;
                }
            }
            else {
                // just directly call update() for non renderable object
                this.isDirty |= obj.update(dt);
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
        let isFloating = false;
        let bounds = this.getBounds();

        this.drawCount = 0;

        // clip the containter children to the container bounds
        if (this.root === false && this.clipping === true && bounds.isFinite() === true) {
            renderer.clipRect(
                bounds.left,
                bounds.top,
                bounds.width,
                bounds.height
            );
        }

        // adjust position if required (e.g. canvas/window centering)
        renderer.translate(this.pos.x, this.pos.y);

        // color background if defined
        if (this.backgroundColor.alpha > 1 / 255) {
            renderer.clearColor(this.backgroundColor);
        }

        let children = this.getChildren();
        for (let i = children.length, obj; i--, (obj = children[i]);) {
            if (obj.isRenderable) {

                isFloating = obj.floating === true;

                if ((obj.inViewport || isFloating)) {

                    if (isFloating) {
                        // translate to screen coordinates
                        renderer.save();
                        renderer.resetTransform();
                    }

                    // predraw (apply transforms)
                    obj.preDraw(renderer);

                    // draw the object
                    obj.draw(renderer, viewport);

                    // postdraw (clean-up);
                    obj.postDraw(renderer);

                    // restore the previous "state"
                    if (isFloating) {
                        renderer.restore();
                    }

                    this.drawCount++;
                }
            }
        }
    }
}

export { Container as default };
