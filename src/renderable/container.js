import utils from "./../utils/utils.js";
import game from "./../game.js";
import event from "./../system/event.js";
import pool from "./../system/pooling.js";
import state from "./../state/state.js";
import Renderable from "./renderable.js";

/**
 * Private function to re-use for object removal in a defer
 * @ignore
 */
var deferredRemove = function (child, keepalive) {
    this.removeChildNow(child, keepalive);
};

var globalFloatingCounter = 0;

/**
 * me.Container represents a collection of child objects
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} [x=0] position of the container (accessible via the inherited pos.x property)
 * @param {Number} [y=0] position of the container (accessible via the inherited pos.y property)
 * @param {Number} [w=me.game.viewport.width] width of the container
 * @param {Number} [h=me.game.viewport.height] height of the container
 */

class Container extends Renderable {

    /**
     * @ignore
     */
    constructor(x = 0, y = 0, width = game.viewport.width, height = game.viewport.height, root = false) {

        // call the super constructor
        super(x, y, width, height);

        /**
         * keep track of pending sort
         * @ignore
         */
        this.pendingSort = null;

        /**
         * whether the container is the root of the scene
         * @public
         * @type Boolean
         * @default false
         * @name root
         * @memberOf me.Container
         */
        this.root = root;

        /**
         * The array of children of this container.
         * @ignore
         */
        this.children = undefined;

        /**
         * The property of the child object that should be used to sort on <br>
         * value : "x", "y", "z"
         * @public
         * @type String
         * @default me.game.sortOn
         * @name sortOn
         * @memberOf me.Container
         */
        this.sortOn = game.sortOn;

        /**
         * Specify if the children list should be automatically sorted when adding a new child
         * @public
         * @type Boolean
         * @default true
         * @name autoSort
         * @memberOf me.Container
         */
        this.autoSort = true;

        /**
         * Specify if the children z index should automatically be managed by the parent container
         * @public
         * @type Boolean
         * @default true
         * @name autoDepth
         * @memberOf me.Container
         */
        this.autoDepth = true;

        /**
         * Specify if the container draw operation should clip his children to its own bounds
         * @public
         * @type Boolean
         * @default false
         * @name clipping
         * @memberOf me.Container
         */
        this.clipping = false;

        /**
         * a callback to be extended, triggered after a child has been added or removed
         * @name onChildChange
         * @memberOf me.Container#
         * @function
         * @param {Number} index added or removed child index
         */
        this.onChildChange = function (/* index */) {
            // to be extended
        };

        /**
         * Specify if the container bounds should automatically take in account
         * all child bounds when updated (this is expensive and disabled by default,
         * only enable if necessary)
         * @public
         * @type Boolean
         * @default false
         * @name enableChildBoundsUpdate
         * @memberOf me.Container
         */
        this.enableChildBoundsUpdate = false;

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
            event.subscribe(event.CANVAS_ONRESIZE, this.updateBounds.bind(this, true));
        }
    }

    /**
     * reset the container, removing all childrens, and reseting transforms.
     * @name reset
     * @memberOf me.Container
     * @function
     */
    reset() {
        // cancel any sort operation
        if (this.pendingSort) {
            clearTimeout(this.pendingSort);
            this.pendingSort = null;
        }

        // delete all children
        var children = this.getChildren();
        for (var i = children.length, child; i >= 0; (child = children[--i])) {
            // don't remove it if a persistent object
            if (child && child.isPersistent !== true) {
                this.removeChildNow(child);
            }
        };

        if (typeof this.currentTransform !== "undefined") {
            // just reset some variables
            this.currentTransform.identity();
        }
    }

    /**
     * Add a child to the container <br>
     * if auto-sort is disable, the object will be appended at the bottom of the list.
     * Adding a child to the container will automatically remove it from its other container.
     * Meaning a child can only have one parent.  This is important if you add a renderable
     * to a container then add it to the me.game.world container it will move it out of the
     * orginal container.  Then when the me.game.world.reset() is called the renderable
     * will not be in any container.
     * @name addChild
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {number} [z] forces the z index of the child to the specified value
     * @return {me.Renderable} the added child
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
                child.GUID = utils.createGUID(child.id);
            }
        }

        child.ancestor = this;
        this.getChildren().push(child);

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

        // force repaint in case this is a static non-animated object
        if (this.isAttachedToRoot() === true) {
            game.repaint();
        }

        // force bounds update if required
        if (this.enableChildBoundsUpdate) {
            this.updateBounds(true);
        }
        // triggered callback if defined
        this.onChildChange.call(this, this.getChildren().length - 1);

        return child;
    }

    /**
     * Add a child to the container at the specified index<br>
     * (the list won't be sorted after insertion)
     * @name addChildAt
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {Number} index
     * @return {me.Renderable} the added child
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
                    child.GUID = utils.createGUID();
                }
            }
            child.ancestor = this;

            this.getChildren().splice(index, 0, child);

            if (typeof child.onActivateEvent === "function" && this.isAttachedToRoot()) {
                child.onActivateEvent();
            }

            // force repaint in case this is a static non-animated object
            if (this.isAttachedToRoot() === true) {
                game.repaint();
            }

            // force bounds update if required
            if (this.enableChildBoundsUpdate) {
                this.updateBounds(true);
            }
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
     * @name forEach
     * @memberOf me.Container.prototype
     * @function
     * @param {Function} callback fnction to execute on each element
     * @param {Object} [thisArg] value to use as this(i.e reference Object) when executing callback.
     * @example
     * // iterate through all children of the root container
     * me.game.world.forEach((child) => {
     *    // do something with the child
     *    child.doSomething();
     * });
     * me.game.world.forEach((child, index) => { ... });
     * me.game.world.forEach((child, index, array) => { ... });
     * me.game.world.forEach((child, index, array) => { ... }, thisArg);
     */
    forEach(callback, thisArg) {
        var context = this, i = 0;
        var children = this.getChildren();

        var len = children.length;

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
     * @name swapChildren
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {me.Renderable} child2
     */
    swapChildren(child, child2) {
        var index = this.getChildIndex(child);
        var index2 = this.getChildIndex(child2);

        if ((index !== -1) && (index2 !== -1)) {
            // swap z index
            var _z = child.pos.z;
            child.pos.z = child2.pos.z;
            child2.pos.z = _z;
            // swap the positions..
            this.getChildren()[index] = child2;
            this.getChildren()[index2] = child;
        }
        else {
            throw new Error(child + " Both the supplied childs must be a child of the caller " + this);
        }
    }

    /**
     * Returns the Child at the specified index
     * @name getChildAt
     * @memberOf me.Container.prototype
     * @function
     * @param {Number} index
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
     * @name getChildIndex
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    getChildIndex(child) {
        return this.getChildren().indexOf(child);
    }

    /**
     * Returns the next child within the container or undefined if none
     * @name getNextChild
     * @memberOf me.Container
     * @function
     * @param {me.Renderable} child
     */
    getNextChild(child) {
        var index = this.getChildren().indexOf(child) - 1;
        if (index >= 0 && index < this.getChildren().length) {
            return this.getChildAt(index);
        }
        return undefined;
    }

    /**
     * Returns true if contains the specified Child
     * @name hasChild
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @return {Boolean}
     */
    hasChild(child) {
        return this === child.ancestor;
    }

    /**
     * return the child corresponding to the given property and value.<br>
     * note : avoid calling this function every frame since
     * it parses the whole object tree each time
     * @name getChildByProp
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {String} prop Property name
     * @param {String|RegExp|Number|Boolean} value Value of the property
     * @return {me.Renderable[]} Array of childs
     * @example
     * // get the first child object called "mainPlayer" in a specific container :
     * var ent = myContainer.getChildByProp("name", "mainPlayer");
     *
     * // or query the whole world :
     * var ent = me.game.world.getChildByProp("name", "mainPlayer");
     *
     * // partial property matches are also allowed by using a RegExp.
     * // the following matches "redCOIN", "bluecoin", "bagOfCoins", etc :
     * var allCoins = me.game.world.getChildByProp("name", /coin/i);
     *
     * // searching for numbers or other data types :
     * var zIndex10 = me.game.world.getChildByProp("z", 10);
     * var inViewport = me.game.world.getChildByProp("inViewport", true);
     */
    getChildByProp(prop, value)    {
        var objList = [];

        function compare(obj, prop) {
            var v = obj[prop];
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
     * @name getChildByType
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {Object} class type
     * @return {me.Renderable[]} Array of children
     */
    getChildByType(_class) {
        var objList = [];

        this.forEach((child) => {
            if (child instanceof _class) {
                objList.push(child);
            }
            if (child instanceof Container) {
                objList = objList.concat(child.getChildByType(_class));
            }
        });

        return objList;
    }

    /**
     * returns the list of childs with the specified name<br>
     * as defined in Tiled (Name field of the Object Properties)<br>
     * note : avoid calling this function every frame since
     * it parses the whole object list each time
     * @name getChildByName
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {String|RegExp|Number|Boolean} name child name
     * @return {me.Renderable[]} Array of children
     */
    getChildByName(name) {
        return this.getChildByProp("name", name);
    }

    /**
     * return the child corresponding to the specified GUID<br>
     * note : avoid calling this function every frame since
     * it parses the whole object list each time
     * @name getChildByGUID
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {String|RegExp|Number|Boolean} GUID child GUID
     * @return {me.Renderable} corresponding child or null
     */
    getChildByGUID(guid) {
        var obj = this.getChildByProp("GUID", guid);
        return (obj.length > 0) ? obj[0] : null;
    }


    /**
     * return all child in this container

     * @name getChildren
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @return {me.Renderable[]} an array of renderable object
     */
    getChildren() {
        if (typeof this.children === "undefined") {
            this.children = [];
        }
        return this.children;
    }

    /**
     * update the bounding box for this shape.
     * @ignore
     * @name updateBounds
     * @memberOf me.Renderable.prototype
     * @function
     * @return {me.Bounds} this shape bounding box Rectangle object
     */
    updateBounds(forceUpdateChildBounds = false) {

        // call parent method
        super.updateBounds();

        var bounds = this.getBounds();

        if (forceUpdateChildBounds === true || this.enableChildBoundsUpdate === true) {
            this.forEach((child) => {
                if (child.isRenderable) {
                    var childBounds = child.getBounds();
                    if (childBounds.isFinite()) {
                        bounds.addBounds(child.getBounds());
                    }
                }
            });
        }

        return bounds;
    }

    /**
     * Checks if this container is root or if it's attached to the root container.
     * @private
     * @name isAttachedToRoot
     * @memberOf me.Container.prototype
     * @function
     * @returns Boolean
     */
    isAttachedToRoot() {
        if (this.root === true) {
            return true;
        } else {
            var ancestor = this.ancestor;
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
     * update the cointainer's bounding rect (private)
     * @private
     * @name updateBoundsPos
     * @memberOf me.Container.prototype
     * @function
     */
    updateBoundsPos(newX, newY) {
        // call the parent method
        super.updateBoundsPos(newX, newY);

        // Notify children that the parent's position has changed
        this.forEach((child) => {
            if (child.isRenderable) {
                child.updateBoundsPos(
                    // workaround on this.pos being updated after
                    // the callback being triggered
                    child.pos.x + newX - this.pos.x,
                    child.pos.y + newY - this.pos.y
                );
            }
        });
        return this.getBounds();
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
     * Invokes the removeChildNow in a defer, to ensure the child is removed safely after the update & draw stack has completed
     * @name removeChild
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {me.Renderable} child
     * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
     */
    removeChild(child, keepalive) {
        if (this.hasChild(child)) {
            utils.function.defer(deferredRemove, this, child, keepalive);
        }
        else {
            throw new Error("Child is not mine.");
        }
    }

    /**
     * Removes (and optionally destroys) a child from the container.<br>
     * (removal is immediate and unconditional)<br>
     * Never use keepalive=true with objects from {@link me.pool}. Doing so will create a memory leak.
     * @name removeChildNow
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
     */
    removeChildNow(child, keepalive) {
        if (this.hasChild(child) && (this.getChildIndex(child) >= 0)) {
            if (typeof child.onDeactivateEvent === "function") {
                child.onDeactivateEvent();
            }

            if (!keepalive) {
                // only push back in the pool if implementing "onResetEvent";
                if (typeof child.onResetEvent === "function") {
                    pool.push(child);
                } else if (typeof child.destroy === "function") {
                    child.destroy();
                }
            }

            // Don't cache the child index; another element might have been removed
            // by the child's `onDeactivateEvent` or `destroy` methods
            var childIndex = this.getChildIndex(child);
            if (childIndex >= 0) {
                this.getChildren().splice(childIndex, 1);
                child.ancestor = undefined;
            }

            // force repaint in case this is a static non-animated object
            if (this.isAttachedToRoot() === true) {
                game.repaint();
            }

            // force bounds update if required
            if (this.enableChildBoundsUpdate) {
                this.updateBounds(true);
            }
            // triggered callback if defined
            this.onChildChange.call(this, childIndex);
        }
    }

    /**
     * Automatically set the specified property of all childs to the given value
     * @name setChildsProperty
     * @memberOf me.Container.prototype
     * @function
     * @param {String} property property name
     * @param {Object} value property value
     * @param {Boolean} [recursive=false] recursively apply the value to child containers if true
     */
    setChildsProperty(prop, val, recursive) {
        this.forEach((child) => {
            if ((recursive === true) && (child instanceof Container)) {
                child.setChildsProperty(prop, val, recursive);
            }
            child[prop] = val;
        });
    }

    /**
     * Move the child in the group one step forward (z depth).
     * @name moveUp
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveUp(child) {
        var childIndex = this.getChildIndex(child);
        if (childIndex - 1 >= 0) {
            // note : we use an inverted loop
            this.swapChildren(child, this.getChildAt(childIndex - 1));
        }
    }

    /**
     * Move the child in the group one step backward (z depth).
     * @name moveDown
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveDown(child) {
        var childIndex = this.getChildIndex(child);
        if (childIndex >= 0 && (childIndex + 1) < this.getChildren().length) {
            // note : we use an inverted loop
            this.swapChildren(child, this.getChildAt(childIndex + 1));
        }
    }

    /**
     * Move the specified child to the top(z depth).
     * @name moveToTop
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveToTop(child) {
        var childIndex = this.getChildIndex(child);
        if (childIndex > 0) {
            var children = this.getChildren();
            // note : we use an inverted loop
            children.splice(0, 0, children.splice(childIndex, 1)[0]);
            // increment our child z value based on the previous child depth
            child.pos.z = children[1].pos.z + 1;
        }
    }

    /**
     * Move the specified child the bottom (z depth).
     * @name moveToBottom
     * @memberOf me.Container.prototype
     * @function
     * @param {me.Renderable} child
     */
    moveToBottom(child) {
        var childIndex = this.getChildIndex(child);
        var children = this.getChildren();
        if (childIndex >= 0 && childIndex < (children.length - 1)) {
            // note : we use an inverted loop
            children.splice((children.length - 1), 0, children.splice(childIndex, 1)[0]);
            // increment our child z value based on the next child depth
            child.pos.z = children[(children.length - 2)].pos.z - 1;
        }
    }

    /**
     * Manually trigger the sort of all the childs in the container</p>
     * @name sort
     * @memberOf me.Container.prototype
     * @public
     * @function
     * @param {Boolean} [recursive=false] recursively sort all containers if true
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
            this.pendingSort = utils.function.defer(function (self) {
                // sort everything in this container
                self.getChildren().sort(self["_sort" + self.sortOn.toUpperCase()]);
                // clear the defer id
                self.pendingSort = null;
                // make sure we redraw everything
                game.repaint();
            }, this, this);
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
        var result = b.pos.z - a.pos.z;
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
        var result = b.pos.z - a.pos.z;
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
     * @ignore
     */
    update(dt) {
        // call the parent method
        super.update(dt);

        var isDirty = false;
        var isFloating = false;
        var isPaused = state.isPaused();

        var children = this.getChildren();
        for (var i = children.length, obj; i--, (obj = children[i]);) {
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
                state.current().cameras.forEach(function(camera) {
                    if (camera.isVisible(obj, isFloating)) {
                        obj.inViewport = true;
                    };
                });

                // update our object
                isDirty = ((obj.inViewport || obj.alwaysUpdate) && obj.update(dt)) || isDirty;

                if (globalFloatingCounter > 0) {
                    globalFloatingCounter--;
                }
            }
            else {
                // just directly call update() for non renderable object
                isDirty = obj.update(dt) || isDirty;
            }
        }

        return isDirty;
    }

    /**
     * @ignore
     */
    draw(renderer, rect) {
        var isFloating = false;
        var bounds = this.getBounds();

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

        var children = this.getChildren();
        for (var i = children.length, obj; i--, (obj = children[i]);) {
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
                    obj.draw(renderer, rect);

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
};

export default Container;
