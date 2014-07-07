/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {

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
         * @memberOf me.ObjectContainer
         * @public
         * @function
         * @param {me.Renderable} obj Object to be tested for collision
         * @param {Boolean} [multiple=false] check for multiple collision
         * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
         * @example
         * // check for collision between this object and others
         * res = me.game.world.collide(this);
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
         * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
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

                        res = _boundsB["collideWith" + _boundsA.shapeType].call(
                            _boundsB,
                            _boundsA
                        );

                        if (res.x !== 0 || res.y !== 0) {
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
        }
    });
})();
