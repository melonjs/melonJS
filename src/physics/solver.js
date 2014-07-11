/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Separating Axis Theorem implementation, based on the SAT.js library by Jim Riecken <jimr@jimr.ca>
 * Available under the MIT License - https://github.com/jriecken/sat-js
 */

(function () {

     /**
     * An object representing the result of an intersection. Contains:
     *  - The two objects participating in the intersection
     *  - The vector representing the minimum change necessary to extract the first object
     *    from the second one (as well as a unit vector in that direction and the magnitude
     *    of the overlap)
     *  - Whether the first object is entirely inside the second, and vice versa.
     * @ignore
     */
    function Response() {
        this.a = null;
        this.b = null;
        this.overlapN = new me.Vector2d();
        this.overlapV = new me.Vector2d();
        this.clear();
    }

    /**
     * Set some values of the response back to their defaults.
     * Call this between tests if you are going to reuse a single
     * Response object for multiple intersection tests
     * (recommented as it will avoid allcating extra memory)
     * @ignore
     */
    Response.prototype.clear = function () {
        this.aInB = true;
        this.bInA = true;
        // --- for backward compatilibity (temporary)
        this.x = 0;
        this.y = 0;
        // ----
        this.overlap = Number.MAX_VALUE;
        return this;
    };

    // ## Object Pools
    // TODO : USE OUR POOL SYSTEM ? or do we dedicate these ones to collision solving ?

    /**
     * A pool of `Vector` objects that are used in calculations to avoid allocating memory.
     * @type {Array.<Vector>}
     */
    var T_VECTORS = [];
    for (var v = 0; v < 10; v++) { T_VECTORS.push(new me.Vector2d()); }

    /**
     * A pool of arrays of numbers used in calculations to avoid allocating memory.
     * @type {Array.<Array.<number>>}
     */
    var T_ARRAYS = [];
    for (var a = 0; a < 5; a++) { T_ARRAYS.push([]); }

    /**
     * Temporary response used for polygon hit detection
     * @type {Response}
     */
    var T_RESPONSE = new Response();

    // ## Helper Functions


    /**
     * Flattens the specified array of points onto a unit vector axis,
     * resulting in a one dimensional range of the minimum and
     * maximum value on that axis.
     * @param {Array.<Vector>} points The points to flatten.
     * @param {Vector} normal The unit vector axis to flatten on.
     * @param {Array.<number>} result An array.  After calling this function,
     *   result[0] will be the minimum value,
     *   result[1] will be the maximum value.
    */
    function flattenPointsOn(points, normal, result) {
        var min = Number.MAX_VALUE;
        var max = -Number.MAX_VALUE;
        var len = points.length;
        for (var i = 0; i < len; i++) {
            // The magnitude of the projection of the point onto the normal
            var dot = points[i].dotProduct(normal);
            if (dot < min) { min = dot; }
            if (dot > max) { max = dot; }
        }
        result[0] = min;
        result[1] = max;
    }

    /**
     * Check whether two convex polygons are separated by the specified
     * axis (must be a unit vector).
     * @param {Vector} aPos The position of the first polygon.
     * @param {Vector} bPos The position of the second polygon.
     * @param {Array.<Vector>} aPoints The points in the first polygon.
     * @param {Array.<Vector>} bPoints The points in the second polygon.
     * @param {Vector} axis The axis (unit sized) to test against.  The points of both polygons
     *   will be projected onto this axis.
     * @param {Response=} response A Response object (optional) which will be populated
     *   if the axis is not a separating axis.
     * @return {boolean} true if it is a separating axis, false otherwise.  If false,
     *   and a response is passed in, information about how much overlap and
     *   the direction of the overlap will be populated.
     */
    function isSeparatingAxis(aPos, bPos, aPoints, bPoints, axis, response) {
        var rangeA = T_ARRAYS.pop();
        var rangeB = T_ARRAYS.pop();
        // The magnitude of the offset between the two polygons
        var offsetV = T_VECTORS.pop().copy(bPos).sub(aPos);
        var projectedOffset = offsetV.dotProduct(axis);

        // Project the polygons onto the axis.
        flattenPointsOn(aPoints, axis, rangeA);
        flattenPointsOn(bPoints, axis, rangeB);
        // Move B's range to its position relative to A.
        rangeB[0] += projectedOffset;
        rangeB[1] += projectedOffset;
        // Check if there is a gap. If there is, this is a separating axis and we can stop
        if (rangeA[0] > rangeB[1] || rangeB[0] > rangeA[1]) {
            T_VECTORS.push(offsetV);
            T_ARRAYS.push(rangeA);
            T_ARRAYS.push(rangeB);
            return true;
        }

        // This is not a separating axis. If we're calculating a response, calculate the overlap.
        if (response) {
            var overlap = 0;
            // A starts further left than B
            if (rangeA[0] < rangeB[0]) {
                response.aInB = false;
                // A ends before B does. We have to pull A out of B
                if (rangeA[1] < rangeB[1]) {
                    overlap = rangeA[1] - rangeB[0];
                    response.bInA = false;
                // B is fully inside A.  Pick the shortest way out.
                } else {
                    var option1 = rangeA[1] - rangeB[0];
                    var option2 = rangeB[1] - rangeA[0];
                    overlap = option1 < option2 ? option1 : -option2;
                }
            // B starts further left than A
            } else {
                response.bInA = false;
                // B ends before A ends. We have to push A out of B
                if (rangeA[1] > rangeB[1]) {
                    overlap = rangeA[0] - rangeB[1];
                    response.aInB = false;
                // A is fully inside B.  Pick the shortest way out.
                } else {
                    var option11 = rangeA[1] - rangeB[0];
                    var option22 = rangeB[1] - rangeA[0];
                    overlap = option11 < option22 ? option11 : -option22;
                }
            }

            // If this is the smallest amount of overlap we've seen so far, set it as the minimum overlap.
            var absOverlap = Math.abs(overlap);
            if (absOverlap < response.overlap) {
                response.overlap = absOverlap;
                response.overlapN.copy(axis);
                if (overlap < 0) {
                    response.overlapN.reverse();
                }
            }
        }
        T_VECTORS.push(offsetV);
        T_ARRAYS.push(rangeA);
        T_ARRAYS.push(rangeB);
        return false;
    }

    // ## collision Solver class

    /**
     * a collision solver object <br>
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     */
    me.Solver = Object.extend(
    /** @scope me.Solver.prototype */
    {
        /** @ignore */
        init : function () {

        },

        /**
         * Checks if the specified child collides with others childs in this container
         * @name collide
         * @memberOf me.Solver
         * @public
         * @function
         * @param {me.Renderable} obj Object to be tested for collision
         * @param {Boolean} [multiple=false] check for multiple collision
         * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision)
         * @example
         * // check for collision between this object and others
         * res = me.game.solver.collide(this);
         *
         * // check if we collide with an enemy :
         * if (res && (res.obj.type == game.constants.ENEMY_OBJECT)) {
         *     if (res.x != 0) {
         *         // x axis
         *         if (res.x < 0) {
         *             console.log("x axis : left side !");
         *         }
         *         else {
         *             console.log("x axis : right side !");
         *         }
         *     }
         *     else {
         *         // y axis
         *         if (res.y < 0) {
         *             console.log("y axis : top side !");
         *         }
         *         else {
         *             console.log("y axis : bottom side !");
         *         }
         *     }
         * }
         */
        collide : function (objA, multiple) {
            return this.collideType(objA, null, multiple);
        },

        /**
         * Checks if the specified child collides with others childs in this container
         * @name collideType
         * @memberOf me.Solver
         * @public
         * @function
         * @param {me.Renderable} obj Object to be tested for collision
         * @param {String} [type=undefined] child type to be tested for collision
         * @param {Boolean} [multiple=false] check for multiple collision
         * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision)
         */
        collideType : function (objA, type, multiple) {
            var res, mres;
            // make sure we have a boolean
            multiple = (multiple === true ? true : false);
            if (multiple === true) {
                mres = [];
            }

            // this should be replace by a list of the 4 adjacent cell around the object requesting collision
            for (var i = me.game.world.children.length, obj; i--, (obj = me.game.world.children[i]);) {
                if ((obj.inViewport || obj.alwaysUpdate) && obj.collidable) {
                    // recursivly check through
                    if (obj instanceof me.ObjectContainer) {
                        res = obj.collideType(objA, type, multiple);
                        if (multiple) {
                            mres.concat(res);
                        }
                        else if (res) {
                            // the child container returned collision information
                            return res;
                        }

                    }
                    else if ((obj !== objA) && (!type || (obj.type === type))) {

                        // fast AABB check if both bounding boxes are overlaping
                        if (objA.getBounds().overlaps(obj.getBounds())) {
                            
                            // collision response
                            res = multiple ? new Response() : T_RESPONSE;
                            
                            // calculate the collision vector
                            // TODO: add the test[*][*] function for other shape type
                            if (this["test" + obj.body.getShape().shapeType + objA.body.getShape().shapeType].call(
                                this, objA.body, obj.body, res)) {

                                if (typeof obj.body.onCollision === "function") {
                                    // notify the object
                                    obj.body.onCollision.call(obj.body, res, objA);
                                }
                                // return the type (deprecated)
                                res.type = obj.type;
                                // return a reference of the colliding object
                                res.obj = obj;
                                // stop here if we don't look for multiple collision detection
                                if (!multiple) {
                                    return res;
                                }
                                mres.push(res);
                            }
                        }
                    }
                }
            }
            return (multiple ? mres : null);
        },
           
        /**
         * Checks whether polygons collide.
         * @param {Polygon} a The first polygon.
         * @param {Polygon} b The second polygon.
         * @param {Response=} response Response object (optional) that will be populated if they intersect.
         * @return {boolean} true if they intersect, false if they don't.
        */
        testPolyShapePolyShape : function (a, b, response) {
            // specific point for 
            var aPoints = a.getShape().points;
            var aLen = aPoints.length;
            var bPoints = b.getShape().points;
            var bLen = bPoints.length;
            var i;
            
            // If any of the edge normals of A is a separating axis, no intersection.
            for (i = 0; i < aLen; i++) {
                if (isSeparatingAxis(a.pos, b.pos, aPoints, bPoints, a.getShape().normals[i], response)) {
                    return false;
                }
            }
            
            // If any of the edge normals of B is a separating axis, no intersection.
            for (i = 0;i < bLen; i++) {
                if (isSeparatingAxis(a.pos, b.pos, aPoints, bPoints, b.getShape().normals[i], response)) {
                    return false;
                }
            }
            
            // Since none of the edge normals of A or B are a separating axis, there is an intersection
            // and we've already calculated the smallest overlap (in isSeparatingAxis).  Calculate the
            // final overlap vector.
            if (response) {
                response.a = a;
                response.b = b;
                response.overlapV.copy(response.overlapN).scale(response.overlap);
                // for backward compatiblity
                response.x = response.overlapV.x;
                response.y = response.overlapV.y;
            }
            return true;
        }
    });
})();
