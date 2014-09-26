/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {

    /**
     * a Generic Body Object <br>
     * @class
     * @extends me.Rect
     * @memberOf me
     * @constructor
     * @param {me.Entity} entity the parent entity
     */
    me.Body = me.Rect.extend(
    /** @scope me.Body.prototype */
    {
        /** @ignore */
        init : function (entity) {
          
            // reference to the parent entity
            this.entity = entity;

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
             * onCollision callback<br>
             * triggered in case of collision, when this entity body is being "touched" by another one<br>
             * @name onCollision
             * @memberOf me.Body
             * @function
             * @param {me.collision.ResponseObject} response the collision response object
             * @param {me.Entity} other the other entity touching this one (reference to response.a)
             * @return false, if the collision response is to be ignored (for custom collision response)
             * @protected
             */
            this.onCollision = undefined;
            
            /**
             * The body collision mask, that defines what should collide with what.<br>
             * (by default will collide with all entities)
             * @ignore
             * @type Number
             * @name collisionMask
             * @see me.collision.types
             * @memberOf me.Body
             */
            this.collisionMask = me.collision.types.ALL_OBJECT;
            
            /**
             * define the collision type of the body for collision filtering
             * @public
             * @type Number
             * @name collisionType
             * @see me.collision.types
             * @memberOf me.Body
             * @example
             * // set the entity body collision type
             * myEntity.body.setCollisionType = me.collision.types.PLAYER_OBJECT;
             */
            this.collisionType = me.collision.types.ENEMY_OBJECT;
            
            /**
             * defined if a body is fully solid or not.<br>
             * @public
             * @type Boolean
             * @name falling
             * @memberOf me.Body
             */
            this.isSolid = true;

            /**
             * Whether this body is "heavy" and can't be moved by other objects.
             * @public
             * @type Boolean
             * @name falling
             * @memberOf me.Body
             */
            this.isHeavy = true;
            
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
          
          
            // call the super constructor
            this._super(
                me.Rect,
                // bounds the body by default 
                // to the parent entity
                "init", [
                    0,
                    0,
                    entity.width,
                    entity.height
                ]
            );
        },

        /**
         * add a collision shape to this entity <br>
         * (note: me.Rect objects will be converted to me.PolyShape before being added)
         * @name addShape
         * @memberOf me.Body
         * @public
         * @function
         * @param {me.Rect|me.PolyShape|me.Ellipse} shape a shape object
         */
        addShape : function (shape) {
            if (shape.shapeType === "Rectangle") {
                // ensure that rect shape are managed as polygon
                this.shapes.push(shape.toPolygon());
            } else {
                // else polygon or circle
                this.shapes.push(shape);
            }
            // make sure to enable at least the first added shape
            if (this.shapes.length === 1) {
                this.setShape(0);
            }
        },

        /**
         * return the current collision shape for this entity
         * @name getShape
         * @memberOf me.Body
         * @public
         * @function
         * @return {me.PolyShape|me.Ellipse} shape a shape object
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
                // update the body bounds based on the active shape
                this.updateBounds();
                return;
            }
            throw new me.Body.Error("Shape (" + index + ") not defined");
        },
        
        /**
         * By default all entities are able to collide with all other entities, <br>
         * but it's also possible to specificy 'collision filters' to provide a finer <br>
         * control over which entities can collide with each other.
         * @name setCollisionMask
         * @memberOf me.Body
         * @public
         * @function
         * @see me.collision.types
         * @param {Number} bitmask the collision mask
         * @example
         * // filter collision detection with collision shapes, enemies and collectables
         * myEntity.body.setCollisionMask(me.collision.types.WORLD_SHAPE | me.collision.types.ENEMY_OBJECT | me.collision.types.COLLECTABLE_OBJECT);
         * ...
         * // disable collision detection with all other objects
         * myEntity.body.setCollisionMask(me.collision.types.NO_OBJECT);
         */
        setCollisionMask : function (bitmask) {
            this.collisionMask = bitmask;
        },
 
        /**
         * @protected
         * @name respondToCollision
         * @memberOf me.Body
         * @function
         */
        respondToCollision: function (response, other) {
            // execute the callback if defined
            if (typeof this.onCollision === "function") {
                if (this.onCollision.call(this, response, other) === false) {
                    // stop here if collision response is to be ignored
                    return;
                }
            }
            
            // some shortcut reference to a & b
            var a = response.a;
            var b = response.b;
            
            // Collisions between "ghostly" objects don't matter, and
            // two "heavy" objects will just remain where they are.
            if (a.body.isSolid || b.body.isSolid) {
                // the overlap vector
                var overlap = response.overlapV;
                if (a.body.isHeavy && b.body.isHeavy) {
                    // Move equally out of each other
                    overlap.scale(0.5);
                    a.pos.sub(overlap);
                    b.pos.add(overlap);
                    // update the entity bounds
                    a.updateBounds();
                    b.updateBounds();
                } else if (a.body.isHeavy) {
                    // Move the other object out of us
                    b.pos.add(overlap);
                    // update the entity bounds
                    b.updateBounds();
                } else if (b.body.isHeavy) {
                    // Move us out of the other object
                    a.pos.sub(overlap);
                    // update the entity bounds
                    a.updateBounds();
                }
            }
        },
        
        /**
         * update the body bounding rect (private)
         * the body rect size is here used to cache the total bounding rect
         * @protected
         * @name updateBounds
         * @memberOf me.Body
         * @function
         */
        updateBounds : function (rect) {
            // TODO : go through all defined shapes
            var _bounds = rect || this.getShape().getBounds();
            // reset the body position and size;
            this.pos.setV(_bounds.pos);
            this.resize(_bounds.width, _bounds.height);

            // update the parent entity bounds
            this.entity.updateBounds();
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
         * compute the new velocity value
         * @ignore
         */
        computeVelocity : function (vel) {

            // apply gravity (if any)
            if (this.gravity) {
                // apply a constant gravity (if not on a ladder)
                vel.y += this.gravity * me.timer.tick;

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
         * update the body position
         * @name update
         * @memberOf me.Body
         * @function
         * @return {boolean} true if resulting velocity is different than 0
         */
        update : function (/* dt */) {
            // update the velocity
            this.computeVelocity(this.vel);

            // update player entity position
            this.entity.pos.add(this.vel);

            // update the entity and body bounds
            this.updateBounds();

            // returns true if vel is different from 0
            return (this.vel.x !== 0 || this.vel.y !== 0);

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
     * @class
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
