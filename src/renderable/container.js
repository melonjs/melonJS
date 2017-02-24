/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
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
     * @param {Number} [x=0] position of the container
     * @param {Number} [y=0] position of the container
     * @param {Number} [w=me.game.viewport.width] width of the container
     * @param {number} [h=me.game.viewport.height] height of the container
     */
    me.Container = me.Renderable.extend(
    /** @scope me.Container.prototype */
    {
        /**
         * constructor
         * @ignore
         */
        init : function (x, y, width, height) {
            /**
             * keep track of pending sort
             * @ignore
             */
            this.pendingSort = null;

            // TODO; container do not have a physic body
            // ADD child container child one by one to the quadtree?

            /**
             * whether the container is the root of the scene
             * @private
             * @ignore
             */
            this._root = false;

            // call the _super constructor
            this._super(me.Renderable,
                "init",
                [x || 0, y || 0,
                width || Infinity,
                height || Infinity]
            );

            /**
             * The array of children of this container.
             * @ignore
             */
            this.children = [];

            /**
             * The property of the child object that should be used to sort on <br>
             * value : "x", "y", "z"
             * @public
             * @type String
             * @default me.game.sortOn
             * @name sortOn
             * @memberOf me.Container
             */
            this.sortOn = me.game.sortOn;

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
             * Used by the debug panel plugin
             * @ignore
             */
            this.drawCount = 0;

            /**
             * The bounds that contains all its children
             * @public
             * @type me.Rect
             * @name childBounds
             * @memberOf me.Container
             */
            this.childBounds = this.getBounds().clone();

            // container self apply any defined transformation
            this.autoTransform = false;
        },


        /**
         * Add a child to the container <br>
         * if auto-sort is disable, the object will be appended at the bottom of the list
         * @name addChild
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         * @param {number} [z] forces the z index of the child to the specified value
         * @return {me.Renderable} the added child
         */
        addChild : function (child, z) {
            if (child.ancestor instanceof me.Container) {
                child.ancestor.removeChildNow(child);
            }
            else {
                // only allocate a GUID if the object has no previous ancestor
                // (e.g. move one child from one container to another)
                if (child.isRenderable) {
                    // allocated a GUID value (use child.id as based index if defined)
                    child.GUID = me.utils.createGUID(child.id);
                }
            }

            child.ancestor = this;
            this.children.push(child);

            // set the child z value if required
            if (typeof(child.pos) !== "undefined") {
                if (typeof(z) === "number") {
                        child.pos.z = z;
                } else if (this.autoDepth === true) {
                    child.pos.z = this.children.length;
                }
            }

            if (this.autoSort === true) {
                this.sort();
            }

            if (typeof child.onActivateEvent === "function" && this.isAttachedToRoot()) {
                child.onActivateEvent();
            }

            return child;
        },

        /**
         * Add a child to the container at the specified index<br>
         * (the list won't be sorted after insertion)
         * @name addChildAt
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         * @param {Number} index
         * @return {me.Renderable} the added child
         */
        addChildAt : function (child, index) {
            if (index >= 0 && index < this.children.length) {
                if (child.ancestor instanceof me.Container) {
                    child.ancestor.removeChildNow(child);
                }
                else {
                    // only allocate a GUID if the object has no previous ancestor
                    // (e.g. move one child from one container to another)
                    if (child.isRenderable) {
                        // allocated a GUID value
                        child.GUID = me.utils.createGUID();
                    }
                }
                child.ancestor = this;

                this.children.splice(index, 0, child);

                if (typeof child.onActivateEvent === "function" && this.isAttachedToRoot()) {
                    child.onActivateEvent();
                }

                return child;
            }
            else {
                throw new me.Container.Error("Index (" + index + ") Out Of Bounds for addChildAt()");
            }
        },

        /**
         * The forEach() method executes a provided function once per child element. <br>
         * callback is invoked with three arguments: <br>
         *    - the element value <br>
         *    - the element index <br>
         *    - the array being traversed <br>
         * @name forEach
         * @memberOf me.Container
         * @function
         * @param {Function} callback
         * @param {Object} [thisArg] value to use as this(i.e reference Object) when executing callback.
         * @example
         * // iterate through all children of the root container
         * me.game.world.forEach(function (child) {
         *    // do something with the child
         * });
         */
        forEach : function (callback, thisArg) {
            var context = this, i = 0;

            var len = this.children.length;

            if (typeof callback !== "function") {
                throw new me.Container.Error(callback + " is not a function");
            }

            if (arguments.length > 1) {
                context = thisArg;
            }

            while (i < len) {
                callback.call(context, this.children[i], i, this.children);
                i++;
            }
        },

        /**
         * Swaps the position (z-index) of 2 children
         * @name swapChildren
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         * @param {me.Renderable} child2
         */
        swapChildren : function (child, child2) {
            var index = this.getChildIndex(child);
            var index2 = this.getChildIndex(child2);

            if ((index !== -1) && (index2 !== -1)) {
                // swap z index
                var _z = child.pos.z;
                child.pos.z = child2.pos.z;
                child2.pos.z = _z;
                // swap the positions..
                this.children[index] = child2;
                this.children[index2] = child;
            }
            else {
                throw new me.Container.Error(child + " Both the supplied childs must be a child of the caller " + this);
            }
        },

        /**
         * Returns the Child at the specified index
         * @name getChildAt
         * @memberOf me.Container
         * @function
         * @param {Number} index
         */
        getChildAt : function (index) {
            if (index >= 0 && index < this.children.length) {
                return this.children[index];
            }
            else {
                throw new me.Container.Error("Index (" + index + ") Out Of Bounds for getChildAt()");
            }
        },

        /**
         * Returns the index of the Child
         * @name getChildAt
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         */
        getChildIndex : function (child) {
            return this.children.indexOf(child);
        },

        /**
         * Returns true if contains the specified Child
         * @name hasChild
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         * @return {Boolean}
         */
        hasChild : function (child) {
            return this === child.ancestor;
        },

        /**
         * return the child corresponding to the given property and value.<br>
         * note : avoid calling this function every frame since
         * it parses the whole object tree each time
         * @name getChildByProp
         * @memberOf me.Container
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
        getChildByProp : function (prop, value)    {
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

            for (var i = this.children.length - 1; i >= 0; i--) {
                var obj = this.children[i];
                compare(obj, prop);
                if (obj instanceof me.Container) {
                    objList = objList.concat(obj.getChildByProp(prop, value));
                }
            }
            return objList;
        },

        /**
         * returns the list of childs with the specified class type
         * @name getChildByType
         * @memberOf me.Container
         * @public
         * @function
         * @param {Object} class type
         * @return {me.Renderable[]} Array of children
         */
        getChildByType : function (_class) {
            var objList = [];

            for (var i = this.children.length - 1; i >= 0; i--) {
                var obj = this.children[i];
                if (obj instanceof _class) {
                    objList.push(obj);
                }
                if (obj instanceof me.Container) {
                    objList = objList.concat(obj.getChildByType(_class));
                }
            }
            return objList;
        },

        /**
         * returns the list of childs with the specified name<br>
         * as defined in Tiled (Name field of the Object Properties)<br>
         * note : avoid calling this function every frame since
         * it parses the whole object list each time
         * @name getChildByName
         * @memberOf me.Container
         * @public
         * @function
         * @param {String|RegExp|Number|Boolean} name entity name
         * @return {me.Renderable[]} Array of children
         */
        getChildByName : function (name) {
            return this.getChildByProp("name", name);
        },

        /**
         * return the child corresponding to the specified GUID<br>
         * note : avoid calling this function every frame since
         * it parses the whole object list each time
         * @name getChildByGUID
         * @memberOf me.Container
         * @public
         * @function
         * @param {String|RegExp|Number|Boolean} GUID entity GUID
         * @return {me.Renderable} corresponding child or null
         */
        getChildByGUID : function (guid) {
            var obj = this.getChildByProp("GUID", guid);
            return (obj.length > 0) ? obj[0] : null;
        },

        /**
         * resizes the child bounds rectangle, based on children bounds.
         * @name updateChildBounds
         * @memberOf me.Container
         * @function
         * @return {me.Rect} updated child bounds
         */
        updateChildBounds : function () {
            this.childBounds.pos.set(Infinity, Infinity);
            this.childBounds.resize(-Infinity, -Infinity);
            var childBounds;
            for (var i = this.children.length, child; i--, (child = this.children[i]);) {
                if (child.isRenderable) {
                    if (child instanceof me.Container) {
                        childBounds = child.childBounds;
                    }
                    else {
                        childBounds = child.getBounds();
                    }
                    // TODO : returns an "empty" rect instead of null (e.g. EntityObject)
                    // TODO : getBounds should always return something anyway
                    if (childBounds !== null) {
                        this.childBounds.union(childBounds);
                    }
                }
            }
            return this.childBounds;
        },

        /**
         * Checks if this container is root or if ti's attached to the root container.
         * @private
         * @name isAttachedToRoot
         * @memberOf me.Container
         * @function
         * @returns Boolean
         */
        isAttachedToRoot : function () {
            if (this._root) {
                return true;
            } else {
                var ancestor = this.ancestor;
                while (ancestor) {
                    if (ancestor._root === true) {
                        return true;
                    }
                    ancestor = ancestor.ancestor;
                }
                return false;
            }
        },

        /**
         * update the renderable's bounding rect (private)
         * @private
         * @name updateBoundsPos
         * @memberOf me.Container
         * @function
         */
        updateBoundsPos : function (newX, newY) {
            this._super(me.Renderable, "updateBoundsPos", [ newX, newY ]);

            // Update container's absolute position
            this._absPos.set(newX, newY);
            if (this.ancestor) {
                this._absPos.add(this.ancestor._absPos);
            }

            // Notify children that the parent's position has changed
            for (var i = this.children.length, child; i--, (child = this.children[i]);) {
                if (child.isRenderable) {
                    child.updateBoundsPos(child.pos.x, child.pos.y);
                }
            }

            return this.getBounds();
        },

        /**
         * @ignore
         */
        onActivateEvent : function () {
          for (var i = this.children.length, child; i--, (child = this.children[i]);) {
              if (typeof child.onActivateEvent === "function") {
                  child.onActivateEvent();
              }
          }
        },

        /**
         * Invokes the removeChildNow in a defer, to ensure the child is removed safely after the update & draw stack has completed
         * @name removeChild
         * @memberOf me.Container
         * @public
         * @function
         * @param {me.Renderable} child
         * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
         */
        removeChild : function (child, keepalive) {
            if (this.hasChild(child)) {
                deferredRemove.defer(this, child, keepalive);
            }
            else {
                throw new me.Container.Error("Child is not mine.");
            }
        },


        /**
         * Removes (and optionally destroys) a child from the container.<br>
         * (removal is immediate and unconditional)<br>
         * Never use keepalive=true with objects from {@link me.pool}. Doing so will create a memory leak.
         * @name removeChildNow
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
         */
        removeChildNow : function (child, keepalive) {
            if (this.hasChild(child) && (this.getChildIndex(child) >= 0)) {
                if (typeof child.onDeactivateEvent === "function") {
                    child.onDeactivateEvent();
                }

                if (!keepalive) {
                    if (typeof (child.destroy) === "function") {
                        child.destroy();
                    }

                    me.pool.push(child);
                }

                // Don't cache the child index; another element might have been removed
                // by the child's `onDeactivateEvent` or `destroy` methods
                var childIndex = this.getChildIndex(child);
                if (childIndex >= 0) {
                    this.children.splice(childIndex, 1);
                    child.ancestor = undefined;
                }
            }
        },

        /**
         * Automatically set the specified property of all childs to the given value
         * @name setChildsProperty
         * @memberOf me.Container
         * @function
         * @param {String} property property name
         * @param {Object} value property value
         * @param {Boolean} [recursive=false] recursively apply the value to child containers if true
         */
        setChildsProperty : function (prop, val, recursive) {
            for (var i = this.children.length; i >= 0; i--) {
                var obj = this.children[i];
                if ((recursive === true) && (obj instanceof me.Container)) {
                    obj.setChildsProperty(prop, val, recursive);
                }
                obj[prop] = val;
            }
        },

        /**
         * Move the child in the group one step forward (z depth).
         * @name moveUp
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         */
        moveUp : function (child) {
            var childIndex = this.getChildIndex(child);
            if (childIndex - 1 >= 0) {
                // note : we use an inverted loop
                this.swapChildren(child, this.getChildAt(childIndex - 1));
            }
        },

        /**
         * Move the child in the group one step backward (z depth).
         * @name moveDown
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         */
        moveDown : function (child) {
            var childIndex = this.getChildIndex(child);
            if (childIndex >= 0 && (childIndex + 1) < this.children.length) {
                // note : we use an inverted loop
                this.swapChildren(child, this.getChildAt(childIndex + 1));
            }
        },

        /**
         * Move the specified child to the top(z depth).
         * @name moveToTop
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         */
        moveToTop : function (child) {
            var childIndex = this.getChildIndex(child);
            if (childIndex > 0) {
                // note : we use an inverted loop
                this.children.splice(0, 0, this.children.splice(childIndex, 1)[0]);
                // increment our child z value based on the previous child depth
                child.pos.z = this.children[1].pos.z + 1;
            }
        },

        /**
         * Move the specified child the bottom (z depth).
         * @name moveToBottom
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         */
        moveToBottom : function (child) {
            var childIndex = this.getChildIndex(child);
            if (childIndex >= 0 && childIndex < (this.children.length - 1)) {
                // note : we use an inverted loop
                this.children.splice((this.children.length - 1), 0, this.children.splice(childIndex, 1)[0]);
                // increment our child z value based on the next child depth
                child.pos.z = this.children[(this.children.length - 2)].pos.z - 1;
            }
        },

        /**
         * Manually trigger the sort of all the childs in the container</p>
         * @name sort
         * @memberOf me.Container
         * @public
         * @function
         * @param {Boolean} [recursive=false] recursively sort all containers if true
         */
        sort : function (recursive) {
            // do nothing if there is already a pending sort
            if (!this.pendingSort) {
                if (recursive === true) {
                    // trigger other child container sort function (if any)
                    for (var i = this.children.length, obj; i--, (obj = this.children[i]);) {
                        if (obj instanceof me.Container) {
                            // note : this will generate one defered sorting function
                            // for each existing containe
                            obj.sort(recursive);
                        }
                    }
                }
                /** @ignore */
                this.pendingSort = function (self) {
                    // sort everything in this container
                    self.children.sort(self["_sort" + self.sortOn.toUpperCase()]);
                    // clear the defer id
                    self.pendingSort = null;
                    // make sure we redraw everything
                    me.game.repaint();
                }.defer(this, this);
            }
        },

        /**
         * @ignore
         */
        onDeactivateEvent : function () {
            for (var i = this.children.length, child; i--, (child = this.children[i]);) {
                if (typeof child.onDeactivateEvent === "function") {
                    child.onDeactivateEvent();
                }
            }
        },

        /**
         * Z Sorting function
         * @ignore
         */
        _sortZ : function (a, b) {
            return (b.pos && a.pos) ? (b.pos.z - a.pos.z) : (a.pos ? -Infinity : Infinity);
        },

        /**
         * Reverse Z Sorting function
         * @ignore
         */
        _sortReverseZ : function (a, b) {
            return (a.pos && b.pos) ? (a.pos.z - b.pos.z) : (a.pos ? Infinity : -Infinity);
        },

        /**
         * X Sorting function
         * @ignore
         */
        _sortX : function (a, b) {
            if (!b.pos || !a.pos) {
                return (a.pos ? -Infinity : Infinity);
            }
            var result = b.pos.z - a.pos.z;
            return (result ? result : (b.pos.x - a.pos.x));
        },

        /**
         * Y Sorting function
         * @ignore
         */
        _sortY : function (a, b) {
            if (!b.pos || !a.pos) {
                return (a.pos ? -Infinity : Infinity);
            }
            var result = b.pos.z - a.pos.z;
            return (result ? result : (b.pos.y - a.pos.y));
        },

        /**
         * Destroy function<br>
         * @ignore
         */
        destroy : function () {
            // cancel any sort operation
            if (this.pendingSort) {
                clearTimeout(this.pendingSort);
                this.pendingSort = null;
            }

            // delete all children
            for (var i = this.children.length, obj; i >= 0; (obj = this.children[--i])) {
                // don't remove it if a persistent object
                if (obj && !obj.isPersistent) {
                    this.removeChildNow(obj);
                }
            }

            // reset the transformation matrix
            this.currentTransform.identity();
        },

        /**
         * @ignore
         */
        update : function (dt) {
            this._super(me.Renderable, "update", [dt]);
            var isDirty = false;
            var isFloating = false;
            var isPaused = me.state.isPaused();
            var viewport = me.game.viewport;

            // Update container's absolute position
            this._absPos.setV(this.pos);
            if (this.ancestor) {
                this._absPos.add(this.ancestor._absPos);
            }

            for (var i = this.children.length, obj; i--, (obj = this.children[i]);) {
                if (isPaused && (!obj.updateWhenPaused)) {
                    // skip this object
                    continue;
                }

                if (obj.isRenderable) {
                    isFloating = (globalFloatingCounter > 0 || obj.floating);
                    if (isFloating) {
                        globalFloatingCounter++;
                    }
                    // check if object is visible
                    obj.inViewport = isFloating || viewport.isVisible(obj.getBounds());

                    // update our object
                    isDirty = ((obj.inViewport || obj.alwaysUpdate) && obj.update(dt)) || isDirty;

                    // Update child's absolute position
                    obj._absPos.setV(this._absPos).add(obj.pos);

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
        },

        /**
         * @ignore
         */
        draw : function (renderer, rect) {
            var isFloating = false,
                hasTransform = false,
                x = 0,
                y = 0;

            this.drawCount = 0;

            // save the global context
            renderer.save();

            // adjust position if required (e.g. canvas/window centering)
            renderer.translate(this.pos.x, this.pos.y);

            // apply the renderable transformation matrix
            if (!this.currentTransform.isIdentity()) {
                renderer.transform(this.currentTransform);
            }

            // apply the group opacity
            renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

            for (var i = this.children.length, obj; i--, (obj = this.children[i]);) {
                isFloating = obj.floating === true;

                if ((obj.inViewport || isFloating) && obj.isRenderable) {

                    hasTransform = !obj.currentTransform.isIdentity();

                    if (isFloating) {
                        // translate to screen coordinates
                        renderer.save();
                        renderer.resetTransform();
                    } else if (obj.autoTransform === true) {

                        // calculate the anchor point
                        var bounds = obj.getBounds();
                        var anchor = obj.anchorPoint;
                        x = bounds.width * anchor.x;
                        y = bounds.height * anchor.y;

                        if (hasTransform) {
                            renderer.save();
                            obj.currentTransform.translate(x, y);
                            // apply the object transformation
                            renderer.transform(obj.currentTransform);
                        } else {
                            renderer.translate(x, y);
                        }
                    }

                    // draw the object
                    obj.draw(renderer, rect);

                    // restore the previous "state"
                    if (isFloating) {
                        renderer.restore();
                    } else  if (obj.autoTransform === true) {
                        if (hasTransform) {
                            // restore the save context/global matric
                            obj.currentTransform.translate(-x, -y);
                            renderer.restore();
                        } else {
                            // translate back
                            renderer.translate(-x, -y);
                        }
                    }

                    this.drawCount++;
                }
            }
            // restore the global context
            renderer.restore();
        }
    });

    /**
     * Base class for ObjectContainer exception handling.
     * @name Error
     * @class
     * @memberOf me.Container
     * @constructor
     * @param {String} msg Error message.
     */
    me.Container.Error = me.Renderable.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Renderable.Error, "init", [ msg ]);
            this.name = "me.Container.Error";
        }
    });
})();
