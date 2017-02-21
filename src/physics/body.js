/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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
     * @param {me.Rect[]|me.Polygon[]|me.Line[]|me.Ellipse[]} [shapes] the initial list of shapes
     */
    me.Body = me.Rect.extend(
    /** @scope me.Body.prototype */
    {
        /** @ignore */
        init : function (entity, shapes) {

            /**
             * reference to the parent entity
             * @ignore
             */
            this.entity = entity;

            /**
             * The collision shapes of the entity <br>
             * @ignore
             * @type {me.Polygon[]|me.Line[]|me.Ellipse[]}
             * @name shapes
             * @memberOf me.Body
             */
            this.shapes = [];

            /**
             * The body collision mask, that defines what should collide with what.<br>
             * (by default will collide with all entities)
             * @ignore
             * @type Number
             * @default me.collision.types.ALL_OBJECT
             * @name collisionMask
             * @see me.collision.types
             * @memberOf me.Body
             */
            this.collisionMask = me.collision.types.ALL_OBJECT;

            /**
             * define the collision type of the body for collision filtering
             * @public
             * @type Number
             * @default me.collision.types.ENEMY_OBJECT
             * @name collisionType
             * @see me.collision.types
             * @memberOf me.Body
             * @example
             * // set the entity body collision type
             * myEntity.body.collisionType = me.collision.types.PLAYER_OBJECT;
             */
            this.collisionType = me.collision.types.ENEMY_OBJECT;

            /**
             * entity current velocity<br>
             * @public
             * @type me.Vector2d
             * @default <0,0>
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
             * @default <0,0>
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
             * @type me.Vector2d
             * @default <0,0>
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
             * @default <1000,1000>
             * @name maxVel
             * @memberOf me.Body
             */
            if (typeof(this.maxVel) === "undefined") {
                this.maxVel = new me.Vector2d();
            }
            this.maxVel.set(1000, 1000);

            /**
             * Default gravity value of the entity<br>
             * to be set to 0 for RPG, shooter, etc...<br>
             * Note: Gravity can also globally be defined through me.sys.gravity
             * @public
             * @see me.sys.gravity
             * @type Number
             * @default 0.98
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
             * @default false
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
             * @default false
             * @name jumping
             * @memberOf me.Body
             */
            this.jumping = false;

            // call the super constructor
            this._super(
                me.Rect,
                "init", [
                    0,
                    0,
                    entity.width,
                    entity.height
                ]
            );

            // parses the given shapes array and add them
            for (var s = 0; s < shapes.length; s++) {
                this.addShape(shapes[s].clone(), true);
            }
        },

        /**
         * add a collision shape to this entity <br>
         * (note: me.Rect objects will be converted to me.Polygon before being added)
         * @name addShape
         * @memberOf me.Body
         * @public
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object
         * @return {Number} the shape array length
         */
        addShape : function (shape, batchInsert) {
            if (shape instanceof me.Rect) {
                this.shapes.push(shape.toPolygon());
            } else {
                // else polygon or circle
                this.shapes.push(shape);
            }

            if (batchInsert !== true) {
                // update the body bounds to take in account the added shape
                this.updateBounds();
            }

            // return the length of the shape list
            return this.shapes.length;
        },

        /**
         * add collision shapes based on the given PhysicsEditor JSON object
         * @name addShapesFromJSON
         * @memberOf me.Body
         * @public
         * @function
         * @param {Object} json a JSON object as exported from the PhysicsEditor tool
         * @param {String} id the shape identifier within the given the json object
         * @param {String} [scale=1] the desired scale of the body (physic-body-editor only)
         * @see https://www.codeandweb.com/physicseditor
         * @return {Number} the shape array length
         */
        addShapesFromJSON : function (json, id, scale) {
            var data;
            scale = scale || 1;

            // identify the json format
            if (typeof(json.rigidBodies) === "undefined") {
                // Physic Editor Format (https://www.codeandweb.com/physicseditor)
                data = json[id];

                if (typeof(data) === "undefined") {
                    throw new me.Body.Error("Identifier (" + id + ") undefined for the given PhysicsEditor JSON object)");
                }

                // go through all shapes and add them to the body
                for (var i = 0; i < data.length; i++) {
                    var points = [];
                    for (var s = 0; s < data[i].shape.length; s += 2) {
                        points.push(new me.Vector2d(data[i].shape[s], data[i].shape[s + 1]));
                    }
                    this.addShape(new me.Polygon(0, 0, points), true);
                }
            } else {
                // Physic Body Editor Format (http://www.aurelienribon.com/blog/projects/physics-body-editor/)
                json.rigidBodies.forEach(function (shape) {
                    if (shape.name === id) {
                        data = shape;
                        // how to stop a forEach loop?
                    }
                });

                if (typeof(data) === "undefined") {
                    throw new me.Body.Error("Identifier (" + id + ") undefined for the given PhysicsEditor JSON object)");
                }

                // shapes origin point
                // top-left origin in the editor is (0,1)
                this.pos.set(data.origin.x, 1.0 - data.origin.y).scale(scale);

                var self = this;
                // parse all polygons
                data.polygons.forEach(function (poly) {
                    var points = [];
                    poly.forEach(function (point) {
                        // top-left origin in the editor is (0,1)
                        points.push(new me.Vector2d(point.x, 1.0 - point.y).scale(scale));
                    });
                    self.addShape(new me.Polygon(0, 0, points), true);
                });
                // parse all circles
                data.circles.forEach(function (circle) {
                    self.addShape(new me.Ellipse(
                        circle.cx * scale,
                        (1.0 - circle.cy) * scale,
                        circle.r * 2 * scale,
                        circle.r * 2 * scale
                    ), true);
                });
            }

            // update the body bounds to take in account the added shapes
            this.updateBounds();

            // return the length of the shape list
            return this.shapes.length;
        },

        /**
         * return the collision shape at the given index
         * @name getShape
         * @memberOf me.Body
         * @public
         * @function
         * @param {Number} [index=0] the shape object at the specified index
         * @return {me.Polygon|me.Line|me.Ellipse} shape a shape object if defined
         */
        getShape : function (index) {
            return this.shapes[index || 0];
        },

        /**
         * remove the specified shape from the body shape list
         * @name removeShape
         * @memberOf me.Body
         * @public
         * @function
         * @param {me.Polygon|me.Line|me.Ellipse} shape a shape object
         * @return {Number} the shape array length
         */
        removeShape : function (shape) {
            this.shapes.remove(shape);

            // update the body bounds to take in account the removed shape
            this.updateBounds();

            // return the length of the shape list
            return this.shapes.length;
        },

        /**
         * remove the shape at the given index from the body shape list
         * @name removeShapeAt
         * @memberOf me.Body
         * @public
         * @function
         * @param {Number} index the shape object at the specified index
         * @return {Number} the shape array length
         */
        removeShapeAt : function (index) {
            return this.removeShape(this.getShape(index));
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
         * the built-in function to solve the collision response
         * @protected
         * @name respondToCollision
         * @memberOf me.Body
         * @function
         * @param {me.collision.ResponseObject} response the collision response object
         */
        respondToCollision: function (response) {
            // the overlap vector
            var overlap = response.overlapV;

            // FIXME: Respond proportionally to object mass

            // Move out of the other object shape
            this.entity.pos.sub(overlap);

            // adjust velocity
            if (overlap.x !== 0) {
                this.vel.x = ~~(0.5 + this.vel.x - overlap.x) || 0;
            }
            if (overlap.y !== 0) {
                this.vel.y = ~~(0.5 + this.vel.y - overlap.y) || 0;

                // cancel the falling an jumping flags if necessary
                var dir = Math.sign(this.gravity) || 1;
                this.falling = overlap.y >= dir;
                this.jumping = overlap.y <= -dir;
            }
        },

        /**
         * update the body bounding rect (private)
         * the body rect size is here used to cache the total bounding rect
         * @private
         * @name updateBounds
         * @memberOf me.Body
         * @function
         */
        updateBounds : function () {
            if (this.shapes.length > 0) {
                // reset the rect with default values
                var _bounds = this.shapes[0].getBounds();
                this.pos.setV(_bounds.pos);
                this.resize(_bounds.width, _bounds.height);

                for (var i = 1; i < this.shapes.length; i++) {
                    this.union(this.shapes[i].getBounds());
                }
            }

            // update the parent entity bounds
            this.entity.onBodyUpdate(this.pos, this.width, this.height);

            return this;
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
         * apply friction to a vector
         * @ignore
         */
        applyFriction : function (vel) {
            var fx = this.friction.x * me.timer.tick,
                nx = vel.x + fx,
                x = vel.x - fx,
                fy = this.friction.y * me.timer.tick,
                ny = vel.y + fy,
                y = vel.y - fy;

            vel.x = (
                (nx < 0) ? nx :
                ( x > 0) ? x  : 0
            );
            vel.y = (
                (ny < 0) ? ny :
                ( y > 0) ? y  : 0
            );
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
                this.falling = (vel.y * Math.sign(this.gravity)) > 0;
                this.jumping = (this.falling ? false : this.jumping);
            }

            // apply friction
            if (this.friction.x || this.friction.y) {
                this.applyFriction(vel);
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
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Body.Error";
        }
    });
})();
