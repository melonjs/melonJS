/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {

    /*
     * A body object
     */

    /**
     * a Generic Body Object <br>
     * @class
     * @extends me.Rect
     * @memberOf me
     * @constructor
     * @param {me.Entity} entity the parent entity
     * @param {Object} settings object dictionary with shape definition
     */
    me.Body = me.Rect.extend(
    /** @scope me.Body.prototype */
    {
        /** @ignore */
        init : function (entity, settings) {

            // reference to the parent entity
            this.entity = entity;

            /**
             * flag to enable collision detection for this object<br>
             * default value : true<br>
             * @public
             * @type Boolean
             * @name collidable
             * @memberOf me.Body
             */
            this.collidable = true;

            /**
             * The collision shapes of the entity <br>
             * (note: only shape at index 0 is used in melonJS 1.0.x)
             * @type {me.Rect[]|me.PolyShape[]|me.Ellipse[]}
             * @name shapes
             * @memberOf me.Body
             */
            this.shapes = [];

            /**
             * The current shape index
             * @ignore
             * @type Number
             * @name shapeIndex
             * @memberOf me.Body
             */
            this.shapeIndex = 0;


            /**
             * entity current velocity<br>
             * @public
             * @type me.Vector2d
             * @name vel
             * @memberOf me.Body
             */
            if (typeof(this.vel) === "undefined") {
                this.vel = new me.Vector2d();
            }
            this.vel.set(0, 0);

            /**
             * entity current acceleration<br>
             * @public
             * @type me.Vector2d
             * @name accel
             * @memberOf me.Body
             */
            if (typeof(this.accel) === "undefined") {
                this.accel = new me.Vector2d();
            }
            this.accel.set(0, 0);

            /**
             * entity current friction<br>
             * @public
             * @name friction
             * @memberOf me.Body
             */
            if (typeof(this.friction) === "undefined") {
                this.friction = new me.Vector2d();
            }
            this.friction.set(0, 0);

            /**
             * max velocity (to limit entity velocity)<br>
             * @public
             * @type me.Vector2d
             * @name maxVel
             * @memberOf me.Body
             */
            if (typeof(this.maxVel) === "undefined") {
                this.maxVel = new me.Vector2d();
            }
            this.maxVel.set(1000, 1000);

            // some default contants
            /**
             * Default gravity value of the entity<br>
             * default value : 0.98 (earth gravity)<br>
             * to be set to 0 for RPG, shooter, etc...<br>
             * Note: Gravity can also globally be defined through me.sys.gravity
             * @public
             * @see me.sys.gravity
             * @type Number
             * @name gravity
             * @memberOf me.Body
             */
            this.gravity = typeof(me.sys.gravity) !== "undefined" ? me.sys.gravity : 0.98;


            /**
             * falling state of the object<br>
             * true if the object is falling<br>
             * false if the object is standing on something<br>
             * @readonly
             * @public
             * @type Boolean
             * @name falling
             * @memberOf me.Body
             */
            this.falling = false;

            /**
             * jumping state of the object<br>
             * equal true if the entity is jumping<br>
             * @readonly
             * @public
             * @type Boolean
             * @name jumping
             * @memberOf me.Body
             */
            this.jumping = true;

            // some usefull slope variable
            this.slopeY = 0;

            /**
             * equal true if the entity is standing on a slope<br>
             * @readonly
             * @public
             * @type Boolean
             * @name onslope
             * @memberOf me.Body
             */
            this.onslope = false;

            /**
             * equal true if the entity is on a ladder<br>
             * @readonly
             * @public
             * @type Boolean
             * @name onladder
             * @memberOf me.Body
             */
            this.onladder = false;

            /**
             * equal true if the entity can go down on a ladder<br>
             * @readonly
             * @public
             * @type Boolean
             * @name disableTopLadderCollision
             * @memberOf me.Body
             */
            this.disableTopLadderCollision = false;

            /**
             * Define if an entity can go through breakable tiles<br>
             * default value : false<br>
             * @public
             * @type Boolean
             * @name canBreakTile
             * @memberOf me.Body
             */
            this.canBreakTile = false;

            /**
             * a callback when an entity break a tile<br>
             * @public
             * @callback
             * @name onTileBreak
             * @memberOf me.Body
             */
            this.onTileBreak = null;

            // to enable collision detection
            this.collidable = (
                typeof(settings.collidable) !== "undefined" ?
                settings.collidable : true
            );

            // ref to the collision map
            this.collisionMap = me.game.collisionMap;

            // call the super constructor
			var zeroPoint = me.pool.pull("me.Vector2d");
            this._super(
                me.Rect,
                "init", [
                    zeroPoint,
                    entity.width,
                    entity.height
                ]
            );
			me.pool.push(zeroPoint);

            // add collision shape to the object if defined
            if (typeof (settings.getShape) === "function") {
                this.addShape(settings.getShape());
            }
        },

        /**
         * add a collision shape to this entity
         * @name addShape
         * @memberOf me.Body
         * @public
         * @function
         * @param {me.Rect|me.PolyShape|me.Ellipse} shape a shape object
         */
        addShape : function (shape) {
            this.shapes.push(shape);
            this.updateBounds();
        },

        /**
         * return the current collision shape for this entity
         * @name getShape
         * @memberOf me.Body
         * @public
         * @function
         * @return {me.Rect|me.PolyShape|me.Ellipse} shape a shape object
         */
        getShape : function () {
            return this.shapes[this.shapeIndex];
        },

        /**
         * change the current collision shape for this entity
         * @name setShape
         * @memberOf me.Body
         * @public
         * @function
         * @param {Number} index shape index
         */
        setShape : function (index) {
            if (typeof(this.shapes[index]) !== "undefined") {
                this.shapeIndex = index;
                return;
            }
            throw new me.Body.Error("Shape (" + index + ") not defined");
        },

        /**
         * update the body bounding rect (private)
         * the body rect size is here used to cache the total bounding rect
         * @protected
         * @name updateBounds
         * @memberOf me.Body
         * @function
         */
        updateBounds : function () {
            // TODO : take in account multiple shape
            var _bounds = this.getShape().getBounds;
            // adjust the body bounding rect
            this.pos.setV(_bounds.pos);
            this.resize(_bounds.width, _bounds.height);
        },


        /**
         * onCollision Event function<br>
         * called by the game manager when the object collide with shtg<br>
         * by default, if the object type is Collectable, the destroy function
         * is called
         * @name onCollision
         * @memberOf me.Body
         * @function
         * @param {me.Vector2d} res collision vector
         * @param {me.Body} obj the other object that hit this object
         * @protected
         */
        onCollision : function () {
            // destroy the object if collectable
            if (this.collidable && (this.type === me.game.COLLECTABLE_OBJECT)) {
                me.game.world.removeChild(this);
            }
        },

        /**
         * set the entity default velocity<br>
         * note : velocity is by default limited to the same value, see
         * setMaxVelocity if needed<br>
         * @name setVelocity
         * @memberOf me.Body
         * @function
         * @param {Number} x velocity on x axis
         * @param {Number} y velocity on y axis
         * @protected
         */

        setVelocity : function (x, y) {
            this.accel.x = x !== 0 ? x : this.accel.x;
            this.accel.y = y !== 0 ? y : this.accel.y;

            // limit by default to the same max value
            this.setMaxVelocity(x, y);
        },

        /**
         * cap the entity velocity to the specified value<br>
         * @name setMaxVelocity
         * @memberOf me.Body
         * @function
         * @param {Number} x max velocity on x axis
         * @param {Number} y max velocity on y axis
         * @protected
         */
        setMaxVelocity : function (x, y) {
            this.maxVel.x = x;
            this.maxVel.y = y;
        },

        /**
         * set the entity default friction<br>
         * @name setFriction
         * @memberOf me.Body
         * @function
         * @param {Number} x horizontal friction
         * @param {Number} y vertical friction
         * @protected
         */
        setFriction : function (x, y) {
            this.friction.x = x || 0;
            this.friction.y = y || 0;
        },

        /**
         * Flip the body on horizontal axis
         * @name flipX
         * @memberOf me.body
         * @function
         * @param {Boolean} flip enable/disable flip
         */
        flipX : function (flip) {
            if (flip !== this.lastflipX) {
                if (this.shapes.length && (typeof this.getShape().flipX === "function")) {
                    this.getShape().flipX(this.width);
                }
            }
        },

        /**
         * Flip the body on vertical axis
         * @name flipY
         * @memberOf me.body
         * @function
         * @param {Boolean} flip enable/disable flip
         */
        flipY : function (flip) {
            if (flip !== this.lastflipY) {
                // flip the collision box
                if (this.shapes.length && (typeof this.getShape().flipY === "function")) {
                    this.getShape().flipY(this.height);
                }
            }
        },

       /**
         * adjust the given rect to the given slope tile
         * @ignore
         */
        checkSlope : function (rect, tile, left) {

            // first make the object stick to the tile
            rect.pos.y = tile.pos.y - rect.height;

            // normally the check should be on the object center point,
            // but since the collision check is done on corner, we must do the
            // same thing here
            if (left) {
                this.slopeY = tile.height - (
                    rect.right + this.vel.x - tile.pos.x
                );
            }
            else {
                this.slopeY = (rect.left + this.vel.x - tile.pos.x);
            }

            // cancel y vel
            this.vel.y = 0;
            // set player position (+ workaround when entering/exiting slopes tile)
            rect.pos.y += this.slopeY.clamp(0, tile.height);

        },

        /**
         * compute the new velocity value
         * @ignore
         */
        computeVelocity : function (vel) {

            // apply gravity (if any)
            if (this.gravity) {
                // apply a constant gravity (if not on a ladder)
                vel.y += !this.onladder ? (this.gravity * me.timer.tick) : 0;

                // check if falling / jumping
                this.falling = (vel.y > 0);
                this.jumping = (this.falling ? false : this.jumping);
            }

            // apply friction
            if (this.friction.x) {
                vel.x = me.utils.applyFriction(vel.x, this.friction.x);
            }
            if (this.friction.y) {
                vel.y = me.utils.applyFriction(vel.y, this.friction.y);
            }

            // cap velocity
            if (vel.y !== 0) {
                vel.y = vel.y.clamp(-this.maxVel.y, this.maxVel.y);
            }
            if (vel.x !== 0) {
                vel.x = vel.x.clamp(-this.maxVel.x, this.maxVel.x);
            }
        },

        /**
         * handle the player movement, "trying" to update his position<br>
         * @name update
         * @memberOf me.Body
         * @function
         * @return {me.Vector2d} a collision vector
         * @example
         * // make the player move
         * if (me.input.isKeyPressed('left'))
         * {
         *     this.vel.x -= this.accel.x * me.timer.tick;
         * }
         * else if (me.input.isKeyPressed('right'))
         * {
         *     this.vel.x += this.accel.x * me.timer.tick;
         * }
         * // update player position
         * var res = this.updateMovement();
         *
         * // check for collision result with the environment
         * if (res.x != 0)
         * {
         *   // x axis
         *   if (res.x<0)
         *      console.log("x axis : left side !");
         *   else
         *      console.log("x axis : right side !");
         * }
         * else if (res.y != 0)
         * {
         *    // y axis
         *    if (res.y<0)
         *       console.log("y axis : top side !");
         *    else
         *       console.log("y axis : bottom side !");
         *
         *    // display the tile type
         *    console.log(res.yprop.type)
         * }
         *
         * // check player status after collision check
         * var updated = (this.vel.x!=0 || this.vel.y!=0);
         */
        update : function () {
            this.computeVelocity(this.vel);

            // Adjust position only on collidable object
            var collision;
            if (this.collidable) {
                // save the collision box offset
                var offsetX = this.pos.x;
                var offsetY = this.pos.y;
                //translate the body pos to real coordinates
                this.translateV(entity.pos);

                // check for collision
                collision = this.collisionMap.checkCollision(this, this.vel);

                // update some flags
                this.onslope  = collision.yprop.isSlope || collision.xprop.isSlope;
                // clear the ladder flag
                this.onladder = false;
                var prop = collision.yprop;
                var tile = collision.ytile;

                // y collision
                if (collision.y) {
                    // going down, collision with the floor
                    this.onladder = prop.isLadder || prop.isTopLadder;

                    if (collision.y > 0) {
                        if (prop.isSolid ||
                            (prop.isPlatform && (this.bottom - 1 <= tile.pos.y)) ||
                            (prop.isTopLadder && !this.disableTopLadderCollision)) {

                            // adjust position to the corresponding tile
                            this.pos.y = ~~this.pos.y;
                            this.vel.y = (
                                this.falling ?
                                tile.pos.y - this.bottom : 0
                            );
                            this.falling = false;
                        }
                        else if (prop.isSlope && !this.jumping) {
                            // we stop falling
                            this.checkSlope(
                                this,
                                tile,
                                prop.isLeftSlope
                            );
                            this.falling = false;
                        }
                        else if (prop.isBreakable) {
                            if  (this.canBreakTile) {
                                // remove the tile
                                me.game.currentLevel.clearTile(
                                    tile.col,
                                    tile.row
                                );
                                if (this.onTileBreak) {
                                    this.onTileBreak();
                                }
                            }
                            else {
                                // adjust position to the corresponding tile
                                this.pos.y = ~~this.pos.y;
                                this.vel.y = (
                                    this.falling ?
                                    tile.pos.y - this.bottom : 0
                                );
                                this.falling = false;
                            }
                        }
                    }
                    // going up, collision with ceiling
                    else if (collision.y < 0) {
                        if (!prop.isPlatform && !prop.isLadder && !prop.isTopLadder) {
                            if (this.gravity) {
                                this.falling = true;
                            }
                            // cancel the y velocity
                            this.vel.y = 0;
                        }
                    }
                }
                prop = collision.xprop;
                tile = collision.xtile;

                // x collision
                if (collision.x) {
                    this.onladder = prop.isLadder || prop.isTopLadder;

                    if (prop.isSlope && !this.jumping) {
                        this.checkSlope(this., tile, prop.isLeftSlope);
                        this.falling = false;
                    }
                    else {
                        // can walk through the platform & ladder
                        if (!prop.isPlatform && !prop.isLadder && !prop.isTopLadder) {
                            if (prop.isBreakable && this.canBreakTile) {
                                // remove the tile
                                me.game.currentLevel.clearTile(tile.col, tile.row);
                                if (this.onTileBreak) {
                                    this.onTileBreak();
                                }
                            } else {
                                this.vel.x = 0;
                            }
                        }
                    }
                }

                // translate back to set the body relative to the entity
                this.pos.set(
                    this.entity.pos.x - offsetX,
                    this.entity.pos.y - offsetY
                );
            }

            // update player entity position
            this.entity.pos.add(this.vel);

            // returns the collision "vector"
            return collision;

        },


        /**
         * Destroy function<br>
         * @ignore
         */
        destroy : function () {
            this.entity = null;
            this.shapes = [];
            this.shapeIndex = 0;
        }
    });

    /**
     * Base class for Body exception handling.
     * @name Error
     * @memberOf me.Body
     * @constructor
     * @param {String} msg Error message.
     */
    me.Body.Error = me.Error.extend({
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Body.Error";
        }
    });
})();
