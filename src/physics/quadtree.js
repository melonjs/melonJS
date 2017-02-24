/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * A QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
 * Based on the QuadTree Library by Timo Hausmann and released under the MIT license
 * https://github.com/timohausmann/quadtree-js/
**/

(function () {


    /**
     * a pool of `QuadTree` objects
     */
    var QT_ARRAY = [];

    /**
     * will pop a quadtree object from the array
     * or create a new one if the array is empty
     */
    var QT_ARRAY_POP = function (bounds, max_objects, max_levels, level) {
        if (QT_ARRAY.length > 0) {
            var _qt =  QT_ARRAY.pop();
            _qt.bounds = bounds;
            _qt.max_objects = max_objects || 4;
            _qt.max_levels  = max_levels || 4;
            _qt.level = level || 0;
            return _qt;
        } else {
            return new me.QuadTree(bounds, max_objects, max_levels, level);
        }
    };

    /**
     * Push back a quadtree back into the array
     */
    var QT_ARRAY_PUSH = function (qt) {
        QT_ARRAY.push(qt);
    };

    /**
     * a temporary vector object to be reused
     */
    var QT_VECTOR = new me.Vector2d();


    /**
     * Quadtree Constructor <br>
     * note: the global quadtree instance is available through `me.collision.quadTree`
     * @class
     * @name QuadTree
     * @extends Object
     * @memberOf me
     * @constructor
     * @see me.collision.quadTree
     * @param {me.Rect} bounds bounds of the node
     * @param {Number} [max_objects=4] max objects a node can hold before splitting into 4 subnodes
     * @param {Number} [max_levels=4] total max levels inside root Quadtree
     * @param {Number} [level] deepth level, required for subnodes
     */
    function Quadtree(bounds, max_objects, max_levels, level) {
        this.max_objects = max_objects || 4;
        this.max_levels  = max_levels || 4;

        this.level = level || 0;
        this.bounds = bounds;

        this.objects = [];
        this.nodes = [];
    }


    /*
     * Split the node into 4 subnodes
     */
    Quadtree.prototype.split = function () {

        var nextLevel = this.level + 1,
            subWidth  = ~~(0.5 + this.bounds.width / 2),
            subHeight = ~~(0.5 + this.bounds.height / 2),
            x = ~~(0.5 + this.bounds.pos.x),
            y = ~~(0.5 + this.bounds.pos.y);

         //top right node
        this.nodes[0] = QT_ARRAY_POP({
            pos : {
                x : x + subWidth,
                y : y
            },
            width : subWidth,
            height : subHeight
        }, this.max_objects, this.max_levels, nextLevel);

        //top left node
        this.nodes[1] = QT_ARRAY_POP({
            pos : {
                x : x,
                y : y
            },
            width : subWidth,
            height : subHeight
        }, this.max_objects, this.max_levels, nextLevel);

        //bottom left node
        this.nodes[2] = QT_ARRAY_POP({
            pos : {
                x : x,
                y : y + subHeight
            },
            width : subWidth,
            height : subHeight
        }, this.max_objects, this.max_levels, nextLevel);

        //bottom right node
        this.nodes[3] = QT_ARRAY_POP({
            pos : {
                x : x + subWidth,
                y : y + subHeight
            },
            width : subWidth,
            height : subHeight
        }, this.max_objects, this.max_levels, nextLevel);
    };


    /*
     * Determine which node the object belongs to
     * @param {me.Rect} rect bounds of the area to be checked
     * @return Integer index of the subnode (0-3), or -1 if rect cannot completely fit within a subnode and is part of the parent node
     */
    Quadtree.prototype.getIndex = function (item) {

        var rect = item.getBounds(),
            pos = rect.pos;

        // use world coordinates for floating items
        if (item.floating || (item.ancestor && item.ancestor.floating)) {
            pos = me.game.viewport.localToWorld(pos.x, pos.y, QT_VECTOR);
        }

        var index = -1,
            rx = pos.x,
            ry = pos.y,
            rw = rect.width,
            rh = rect.height,
            verticalMidpoint = this.bounds.pos.x + (this.bounds.width / 2),
            horizontalMidpoint = this.bounds.pos.y + (this.bounds.height / 2),
            //rect can completely fit within the top quadrants
            topQuadrant = (ry < horizontalMidpoint && ry + rh < horizontalMidpoint),
            //rect can completely fit within the bottom quadrants
            bottomQuadrant = (ry > horizontalMidpoint);

        //rect can completely fit within the left quadrants
        if (rx < verticalMidpoint && rx + rw < verticalMidpoint) {
            if (topQuadrant) {
                index = 1;
            } else if (bottomQuadrant) {
                index = 2;
            }
        } else if (rx > verticalMidpoint) {
            //rect can completely fit within the right quadrants
            if (topQuadrant) {
                index = 0;
            } else if (bottomQuadrant) {
                index = 3;
            }
        }

        return index;
    };

    /**
     * Insert the given object container into the node.
     * @name insertContainer
     * @memberOf me.QuadTree
     * @function
     * @param {me.Container} container group of objects to be added
     */
    Quadtree.prototype.insertContainer = function (container) {

        for (var i = container.children.length, child; i--, (child = container.children[i]);) {
            if (child instanceof me.Container && !(child instanceof me.ParticleContainer)) {
                if (child.name !== "rootContainer") {
                    this.insert(child);
                }
                // recursivly insert all childs
                this.insertContainer(child);
            } else {
                // only insert object with a bounding box
                if (typeof (child.getBounds) === "function") {
                    this.insert(child);
                }
            }
        }
    };

    /**
     * Insert the given object into the node. If the node
     * exceeds the capacity, it will split and add all
     * objects to their corresponding subnodes.
     * @name insert
     * @memberOf me.QuadTree
     * @function
     * @param {Object} item object to be added
     */
    Quadtree.prototype.insert = function (item) {

        var index = -1;

        //if we have subnodes ...
        if (this.nodes.length > 0) {
            index = this.getIndex(item);

            if (index !== -1) {
                this.nodes[index].insert(item);
                return;
            }
        }

        this.objects.push(item);

        if (this.objects.length > this.max_objects && this.level < this.max_levels) {

            //split if we don't already have subnodes
            if (this.nodes.length === 0) {
                this.split();
            }

            var i = 0;

            //add all objects to there corresponding subnodes
            while (i < this.objects.length) {

                index = this.getIndex(this.objects[i]);

                if (index !== -1) {
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i = i + 1;
                }
            }
        }
    };

    /**
     * Return all objects that could collide with the given object
     * @name retrieve
     * @memberOf me.QuadTree
     * @function
     * @param {Object} object object to be checked against
     * @param {Object} [function] a sorting function for the returned array
     * @return {Object[]} array with all detected objects
     */
    Quadtree.prototype.retrieve = function (item, fn) {

        var returnObjects = this.objects;

        //if we have subnodes ...
        if (this.nodes.length > 0) {

            var index = this.getIndex(item);

            //if rect fits into a subnode ..
            if (index !== -1) {
                returnObjects = returnObjects.concat(this.nodes[index].retrieve(item));
            } else {
                 //if rect does not fit into a subnode, check it against all subnodes
                for (var i = 0; i < this.nodes.length; i = i + 1) {
                    returnObjects = returnObjects.concat(this.nodes[i].retrieve(item));
                }
            }
        }

        if (typeof(fn) === "function") {
            returnObjects.sort(fn);
        }

        return returnObjects;
    };

    /**
     * Remove the given item from the quadtree.
     * (this function won't recalculate the impacted node)
     * @name remove
     * @memberOf me.QuadTree
     * @function
     * @param {Object} object object to be removed
     * @return true if the item was found and removed.
     */
     Quadtree.prototype.remove = function (item) {
        var found = false;

        if (typeof (item.getBounds) === "undefined") {
            // ignore object that cannot be added in the first place
            return false;
        }

        //if we have subnodes ...
        if (this.nodes.length > 0) {
            // determine to which node the item belongs to
            var index = this.getIndex(item);

            if (index !== -1) {
                found = this.nodes[index].remove(item);
                // trim node if empty
                if (found && this.nodes[index].isPrunable()) {
                    this.nodes.splice(index, 1);
                }
            }
        }

        if (found === false) {
            // try and remove the item from the list of items in this node
            if (this.objects.indexOf(item) !== -1) {
                this.objects.remove(item);
                found = true;
            }
        }

        return found;
    };

    /**
     * return true if the node is prunable
     * @name isPrunable
     * @memberOf me.QuadTree
     * @function
     * @return true if the node is prunable
     */
    Quadtree.prototype.isPrunable = function () {
        return !(this.hasChildren() || (this.objects.length > 0));
    };

    /**
     * return true if the node has any children
     * @name hasChildren
     * @memberOf me.QuadTree
     * @function
     * @return true if the node has any children
     */
    Quadtree.prototype.hasChildren = function () {
        for (var i = 0; i < this.nodes.length; i = i + 1) {
            var subnode = this.nodes[i];
            if (subnode.length > 0 || subnode.objects.length > 0) {
                return true;
            }
        }
        return false;
    };

    /**
     * clear the quadtree
     * @name clear
     * @memberOf me.QuadTree
     * @function
     */
    Quadtree.prototype.clear = function (bounds) {

        this.objects.length = 0;

        for (var i = 0; i < this.nodes.length; i = i + 1) {
            this.nodes[i].clear();
            // recycle the quadTree object
            QT_ARRAY_PUSH(this.nodes[i]);
        }
        // empty the array
        this.nodes = [];

        // resize the root bounds if required
        if (typeof bounds !== "undefined") {
            this.bounds.setShape(bounds.pos.x, bounds.pos.y, bounds.width, bounds.height);
        }
    };

    //make Quadtree available in the me namespace
    me.QuadTree = Quadtree;

})();
