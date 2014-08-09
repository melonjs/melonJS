/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * A QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
 * Based on the QuadTree Library by Timo Hausmann and released under the MIT license
 * https://github.com/timohausmann/quadtree-js/
**/

(function (window, Math) {

     /*
      * Quadtree Constructor
      * @param {me.Rect} bounds bounds of the node
      * @param Integer max_objects (optional) max objects a node can hold before splitting into 4 subnodes (default: 8)
      * @param Integer max_levels (optional) total max levels inside root Quadtree (default: 4)
      * @param Integer level (optional) deepth level, required for subnodes
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
            subWidth  = Math.round(this.bounds.width / 2),
            subHeight = Math.round(this.bounds.height / 2),
            x = Math.round(this.bounds.pos.x),
            y = Math.round(this.bounds.pos.y);

         //top right node
        this.nodes[0] = new Quadtree({
            pos : {
                x : x + subWidth,
                y : y
            },
            width : subWidth,
            height : subHeight
        }, this.max_objects, this.max_levels, nextLevel);

        //top left node
        this.nodes[1] = new Quadtree({
            pos : {
                x : x,
                y : y
            },
            width : subWidth,
            height : subHeight
        }, this.max_objects, this.max_levels, nextLevel);

        //bottom left node
        this.nodes[2] = new Quadtree({
            pos : {
                x : x,
                y : y + subHeight
            },
            width : subWidth,
            height : subHeight
        }, this.max_objects, this.max_levels, nextLevel);

        //bottom right node
        this.nodes[3] = new Quadtree({
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
    Quadtree.prototype.getIndex = function (rect) {

        var index = -1,
            verticalMidpoint = this.bounds.pos.x + (this.bounds.width / 2),
            horizontalMidpoint = this.bounds.pos.y + (this.bounds.height / 2),
            //rect can completely fit within the top quadrants
            topQuadrant = (rect.pos.y < horizontalMidpoint && rect.pos.y + rect.height < horizontalMidpoint),
            //rect can completely fit within the bottom quadrants
            bottomQuadrant = (rect.pos.y > horizontalMidpoint);

        //rect can completely fit within the left quadrants
        if (rect.pos.x < verticalMidpoint && rect.pos.x + rect.width < verticalMidpoint) {
            if (topQuadrant) {
                index = 1;
            } else if (bottomQuadrant) {
                index = 2;
            }

        //rect can completely fit within the right quadrants
        } else if (rect.pos.x > verticalMidpoint) {
            if (topQuadrant) {
                index = 0;
            } else if (bottomQuadrant) {
                index = 3;
            }
        }

        return index;
    };


    /*
     * Insert the object into the node. If the node
     * exceeds the capacity, it will split and add all
     * objects to their corresponding subnodes.
     * @param me rect bounds of the object to be added, with x, y, width, height
     */
    Quadtree.prototype.insert = function (item) {

        var i = 0,
            index,
            rect = item.getBounds();
        

        //if we have subnodes ...
        if (typeof this.nodes[0] !== "undefined") {
            index = this.getIndex(rect);

            if (index !== -1) {
                this.nodes[index].insert(item);
                return;
            }
        }

        this.objects.push(item);

        if (this.objects.length > this.max_objects && this.level < this.max_levels) {

            //split if we don't already have subnodes
            if (typeof this.nodes[0] === "undefined") {
                this.split();
            }

            //add all objects to there corresponding subnodes
            while (i < this.objects.length) {

                index = this.getIndex(this.objects[i].getBounds());

                if (index !== -1) {
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i = i + 1;
                }
            }
        }
    };


    /*
     * Return all objects that could collide with the given object
     * @param Object rect bounds of the object to be checked, with x, y, width, height
     * @Return Array array with all detected objects
     */
    Quadtree.prototype.retrieve = function (item) {

        var rect = item.getBounds(),
            index = this.getIndex(rect),
            returnObjects = this.objects;

        //if we have subnodes ...
        if (typeof this.nodes[0] !== "undefined") {

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

        return returnObjects;
    };


    /*
     * Clear the quadtree
     */
    Quadtree.prototype.clear = function (bounds) {

        this.objects = [];

        for (var i = 0; i < this.nodes.length; i = i + 1) {
            if (typeof this.nodes[i] !== "undefined") {
                this.nodes[i].clear();
                // TODO : recycle quadTree object to avoid GC
                delete this.nodes[i];
            }
        }
        
        // resize the root bounds if required
        if (typeof bounds !== "undefined") {
            this.bounds.pos.x = bounds.pos.x;
            this.bounds.pos.y = bounds.pos.y;
            this.bounds.width = bounds.width;
            this.bounds.height = bounds.height;
        }
        
    };

    //make Quadtree available in the me namespace
    me.QuadTree = Quadtree;

})(window, Math);