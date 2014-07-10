/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {

    /**
      * An object representing the result of an intersection
      * (only a Vector Object for now)
      * @ignore
      */
    function Response() {
        /*
        this.a = null;
        this.b = null;
        this.overlapN = new me.Vector2d();
        this.overlapV = new me.Vector2d();
        this.aInB = false;
        this.bInA = false;
        this.overlap = 0;
        */
        return new me.Vector2d(0, 0);
    }

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
            // a reusable response object
            this.response = new Response();
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
                        // quick reference to both object bounding box
                        var _boundsA = objA.getBounds();
                        var _boundsB = obj.getBounds();

                        // check if both bounding boxes are overlaping
                        if (_boundsA.overlaps(_boundsB)) {
                            // calculate the collision vector
                            // TODO: add the test[*][*] function for other shape type
                            res = this["test" + _boundsB.shapeType + _boundsA.shapeType].call(
                                this,
                                _boundsB,
                                _boundsA,
                                /* the reusable response object*/
                                multiple ? undefined : this.response
                            );

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
            return (multiple ? mres : null);
        },

        /**
         * test for collision between two rectangles<p>
         * If there was a collision, the return vector will contains the following values:
         * @example
         * if (v.x != 0 || v.y != 0) {
         *     if (v.x != 0) {
         *         // x axis
         *         if (v.x < 0) {
         *             console.log("x axis : left side !");
         *         }
         *         else {
         *             console.log("x axis : right side !");
         *         }
         *     }
         *     else {
         *         // y axis
         *         if (v.y < 0) {
         *             console.log("y axis : top side !");
         *         }
         *         else {
         *             console.log("y axis : bottom side !");
         *         }
         *     }
         * }
         * @ignore
         * @param {me.Rect} a The first rect.
         * @param {me.Rect} b The second rect
         * @param {Reponse} response Response object (optional) that will be populated if both rect intersects.
         * @return Response object
         */
        testRectangleRectangle : function (a, b, response) {
            // response object
            response = response || new Response();

            // compute delta between a & b
            var dx = a.left + a.hWidth  - b.left - b.hWidth;
            var dy = a.top  + a.hHeight - b.top  - b.hHeight;

            // compute penetration depth for both axis
            response.x = (b.hWidth  + a.hWidth)  - (dx < 0 ? -dx : dx); // - Math.abs(dx);
            response.y = (b.hHeight + a.hHeight) - (dy < 0 ? -dy : dy); // - Math.abs(dy);

            // check and "normalize" axis
            if (response.x < response.y) {
                response.y = 0;
                response.x = dx < 0 ? -response.x : response.x;
            } else {
                response.x = 0;
                response.y = dy < 0 ? -response.y : response.y;
            }

            return response;
        },
    });
})();
