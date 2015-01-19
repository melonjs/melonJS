/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier Biot, Jason Oster
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * Private function to re-use for object removal in a defer
     * @ignore
     */
    var deferredRemove = function (child, keepalive) {
        if (child.ancestor) {
            child.ancestor.removeChildNow(child, keepalive);
        }
    };

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
             * the container default transformation matrix
             * @public
             * @type me.Matrix2d
             * @name transform
             * @memberOf me.Container
             */
            this.transform = new me.Matrix2d();
            // call the _super constructor
            this._super(me.Renderable,
                "init",
                [x, y,
                width || Infinity,
                height || Infinity]
            );
            // init the bounds to an empty rect

            /**
             * Container bounds
             * @ignore
             */
            this.bounds = undefined;

            /**
             * The array of children of this container.
             * @ignore
             */
            this.children = [];
            // by default reuse the global me.game.setting
            /**
             * The property of the child object that should be used to sort on <br>
             * value : "x", "y", "z" (default: me.game.sortOn)
             * @public
             * @type String
             * @name sortOn
             * @memberOf me.Container
             */
            this.sortOn = me.game.sortOn;
            /**
             * Specify if the children list should be automatically sorted when adding a new child
             * @public
             * @type Boolean
             * @name autoSort
             * @memberOf me.Container
             */

            this.autoSort = true;
            this.transform.identity();

            /**
             * Used by the debug panel plugin
             * @ignore
             */
            this.drawCount = 0;
            this.translationStack = new me.TranslationStack();
        },


        /**
         * Add a child to the container <br>
         * if auto-sort is disable, the object will be appended at the bottom of the list
         * @name addChild
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         * @param {number} [zIndex] forces the z index of the child to the specified value.
         * @return {me.Renderable} the added child
         */
        addChild : function (child, zIndex) {
            if (typeof(child.ancestor) !== "undefined") {
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

            // change the child z-index if one is specified
            if (typeof(zIndex) === "number") {
                child.z = zIndex;
            }

            // specify a z property to infinity if not defined
            if ((typeof child.z === "undefined") || (child.z !== child.z)) {
                child.z = this.children.length;
            }

            child.ancestor = this;
            this.children.push(child);
            if (this.autoSort === true) {
                this.sort();
            }

            if (typeof child.onActivateEvent === "function") {
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
                if (typeof(child.ancestor) !== "undefined") {
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

                if (typeof child.onActivateEvent === "function") {
                    child.onActivateEvent();
                }

                return child;
            }
            else {
                throw new me.Container.Error("Index (" + index + ") Out Of Bounds for addChildAt()");
            }
        },

        /**
         * Swaps the position (z depth) of 2 childs
         * @name swapChildren
         * @memberOf me.Container
         * @function
         * @param {me.Renderable} child
         * @param {me.Renderable} child
         */
        swapChildren : function (child, child2) {
            var index = this.getChildIndex(child);
            var index2 = this.getChildIndex(child2);

            if ((index !== -1) && (index2 !== -1)) {
                // swap z index
                var _z = child.z;
                child.z = child2.z;
                child2.z = _z;
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
         * @param {String|RegExp|Number} value Value of the property
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
         * returns the list of childs with the specified name<br>
         * as defined in Tiled (Name field of the Object Properties)<br>
         * note : avoid calling this function every frame since
         * it parses the whole object list each time
         * @name getChildByName
         * @memberOf me.Container
         * @public
         * @function
         * @param {String|RegExp|Number} name entity name
         * @return {me.Renderable[]} Array of childs
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
         * @param {String|RegExp|Number} GUID entity GUID
         * @return {me.Renderable} corresponding child or null
         */
        getChildByGUID : function (guid) {
            var obj = this.getChildByProp("GUID", guid);
            return (obj.length > 0) ? obj[0] : null;
        },

        /**
         * returns the bounding box for this container, the smallest rectangle object completely containing all childrens
         * @name getBounds
         * @memberOf me.Container
         * @function
         * @param {me.Rect} [rect] an optional rectangle object to use when returning the bounding rect(else returns a new object)
         * @return {me.Rect} new rectangle
         */
        getBounds : function () {
            if (!this.bounds) {
                this.bounds = new me.Rect(Infinity, Infinity, -Infinity, -Infinity);
            } else {
                // reset the rect with default values
                this.bounds.pos.set(Infinity, Infinity);
                this.bounds.resize(-Infinity, -Infinity);
            }
            var childBounds;
            for (var i = this.children.length, child; i--, (child = this.children[i]);) {
                if (child.isRenderable) {
                    childBounds = child.getBounds();
                    // TODO : returns an "empty" rect instead of null (e.g. EntityObject)
                    // TODO : getBounds should always return something anyway
                    if (childBounds !== null) {
                        this.bounds.union(childBounds);
                    }
                }
            }
            // TODO : cache the value until any childs are modified? (next frame?)
            return this.bounds;
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
            if (child.ancestor) {
                deferredRemove.defer(this, child, keepalive);
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
            if  (this.hasChild(child)) {

                child.ancestor = undefined;

                if (typeof child.onDeactivateEvent === "function") {
                    child.onDeactivateEvent();
                }

                if (!keepalive) {
                    if (typeof (child.destroy) === "function") {
                        child.destroy();
                    }

                    me.pool.push(child);
                }

                this.children.splice(this.getChildIndex(child), 1);

            }
            else {
                throw new me.Container.Error(child + " The supplied child must be a child of the caller " + this);
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
            if (childIndex + 1 < this.children.length) {
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
                child.z = this.children[1].z + 1;
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
            if (childIndex < (this.children.length - 1)) {
                // note : we use an inverted loop
                this.children.splice((this.children.length - 1), 0, this.children.splice(childIndex, 1)[0]);
                // increment our child z value based on the next child depth
                child.z = this.children[(this.children.length - 2)].z - 1;
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
            if (this.pendingSort === null) {
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
         * Z Sorting function
         * @ignore
         */
        _sortZ : function (a, b) {
            return (b.z) - (a.z);
        },

        /**
         * X Sorting function
         * @ignore
         */
        _sortX : function (a, b) {
            /* ? */
            var result = (b.z - a.z);
            return (result ? result : ((b.pos && b.pos.x) - (a.pos && a.pos.x)) || 0);
        },

        /**
         * Y Sorting function
         * @ignore
         */
        _sortY : function (a, b) {
            var result = (b.z - a.z);
            return (result ? result : ((b.pos && b.pos.y) - (a.pos && a.pos.y)) || 0);
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
            for (var i = this.children.length, obj; i--, (obj = this.children[i]);) {
                // don't remove it if a persistent object
                if (!obj.isPersistent) {
                    this.removeChildNow(obj);
                }
            }

            // reset the transformation matrix
            this.transform.identity();
        },

        /**
         * @ignore
         */
        update : function (dt) {
            var isDirty = false;
            var isFloating = false;
            var isPaused = me.state.isPaused();
            var viewport = me.game.viewport;
            var translationStack = this.translationStack;
            translationStack.reset();

            for (var i = this.children.length, obj; i--, (obj = this.children[i]);) {
                if (isPaused && (!obj.updateWhenPaused)) {
                    // skip this object
                    continue;
                }

                if (obj.isRenderable) {
                    isFloating = (translationStack.globalFloatingCounter > 0 || obj.floating);
                    translationStack.translate(isFloating, obj);
                    // check if object is visible
                    obj.inViewport = isFloating || viewport.isVisible(translationStack.rect);

                    // update our object
                    isDirty = ((obj.inViewport || obj.alwaysUpdate) && obj.update(dt)) || isDirty;

                    // Undo global context translation
                    translationStack.undoTranslation();
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
            var viewport = me.game.viewport;
            var isFloating = false;

            this.drawCount = 0;

            var restore = false;
            if (!this.transform.isIdentity()) {
                restore = true;

                // save context
                renderer.save();

                // apply the container current transform
                renderer.transform(this.transform);
            }

            // apply the group opacity
            var alpha = renderer.globalAlpha();
            renderer.setGlobalAlpha(alpha * this.getOpacity());

            // translate to the container position
            renderer.translate(this.pos.x, this.pos.y);

            for (var i = this.children.length, obj; i--, (obj = this.children[i]);) {
                isFloating = obj.floating;
                if ((obj.inViewport || isFloating) && obj.isRenderable) {
                    if (isFloating === true) {
                        // translate to object
                        renderer.translate(
                            viewport.screenX - this.pos.x,
                            viewport.screenY - this.pos.y
                        );
                    }

                    // draw the object
                    obj.draw(renderer, rect);

                    if (isFloating === true) {
                        // translate back to viewport
                        renderer.translate(
                            this.pos.x - viewport.screenX,
                            this.pos.y - viewport.screenY
                        );
                    }

                    this.drawCount++;
                }
            }

            // restore the group opacity
            renderer.setGlobalAlpha(alpha);

            // restore the container position
            renderer.translate(-this.pos.x, -this.pos.y);

            if (restore) {
                // restore context
                renderer.restore();
            }
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
        init : function (msg) {
            this._super(me.Renderable.Error, "init", [ msg ]);
            this.name = "me.Container.Error";
        }
    });
})();
