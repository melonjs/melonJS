import Vector2d from "./../math/vector2.js";
import ObservableVector2d from "./../math/observable_vector2.js";
import Rect from "./../shapes/rectangle.js";
import Ellipse from "./../shapes/ellipse.js";
import Polygon from "./../shapes/poly.js";
import Bounds from "./bounds.js";
import collision from "./collision.js";
import utils from "./../utils/utils.js";
import timer from "./../system/timer.js";
import { clamp } from "./../math/math.js";
import game from "./../game.js";


/**
 * a Generic Body Object with some physic properties and behavior functionality<br>
 The body object is offten attached as a member of an Entity.  The Body object can handle movements of the parent with
 the body.update call.  It important to know that when body.update is called there are several things that happen related to
 the movement and positioning of the parent entity (assuming its an Entity).  1) The force/gravity/friction parameters are used
 to calcuate a new velocity and 2) the parent position is updated by adding this to the parent.pos (position me.Vector2d)
 value. Thus Affecting the movement of the parent.  Look at the source code for /src/physics/body.js:update (me.Body.update) for
 a better understanding.
 * @class Body
 * @memberOf me
 * @constructor
 * @param {me.Renderable} ancestor the parent object this body is attached to
 * @param {me.Rect|me.Rect[]|me.Polygon|me.Polygon[]|me.Line|me.Line[]|me.Ellipse|me.Ellipse[]|Object} [shapes] a initial shape, list of shapes, or JSON object defining the body
 * @param {Function} [onBodyUpdate] callback for when the body is updated (e.g. add/remove shapes)
 */
class Body {

    constructor(parent, shapes, onBodyUpdate) {

        /**
         * a reference to the parent object that contains this body,
         * or undefined if it has not been added to one.
         * @public
         * @type me.Renderable
         * @default undefined
         * @name me.Body#ancestor
         */
        this.ancestor = parent;

        /**
         * The AABB bounds box reprensenting this body
         * @public
         * @type {me.Bounds}
         * @name bounds
         * @memberOf me.Body
         */
        if (typeof this.bounds === "undefined") {
            this.bounds = new Bounds();
        }

        /**
         * The collision shapes of the body
         * @ignore
         * @type {me.Polygon[]|me.Line[]|me.Ellipse[]}
         * @name shapes
         * @memberOf me.Body
         */
        if (typeof this.shapes === "undefined") {
            this.shapes = [];
        }

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
        this.collisionMask = collision.types.ALL_OBJECT;

        /**
         * define the collision type of the body for collision filtering
         * @public
         * @type Number
         * @default me.collision.types.ENEMY_OBJECT
         * @name collisionType
         * @see me.collision.types
         * @memberOf me.Body
         * @example
         * // set the body collision type
         * myEntity.body.collisionType = me.collision.types.PLAYER_OBJECT;
         */
        this.collisionType = collision.types.ENEMY_OBJECT;

        /**
         * body velocity<br>
         *
         * @public
         * @type me.Vector2d
         * @default <0,0>
         * @name vel
         * @memberOf me.Body
         */
        if (typeof this.vel === "undefined") {
            this.vel = new Vector2d();
        }
        this.vel.set(0, 0);

        /**
         * body acceleration <br>
         * Not fully implemented yet.  At this time accel is used to set the MaximumVelocity allowed.
         * @public
         * @type me.Vector2d
         * @default <0,0>
         * @name accel
         * @deprecated
         * @see me.Body.force
         * @memberOf me.Body
         */
        if (typeof this.accel === "undefined") {
            this.accel = new Vector2d();
        }
        this.accel.set(0, 0);

        /**
         * body force or acceleration (automatically) applied to the body.
         * when defining a force, user should also define a max velocity
         * @public
         * @type me.Vector2d
         * @default <0,0>
         * @name force
         * @see me.Body.setMaxVelocity
         * @memberOf me.Body
         * @example
         * // define a default maximum acceleration, initial force and friction
         * this.body.force.set(0, 0);
         * this.body.friction.set(0.4, 0);
         * this.body.setMaxVelocity(3, 15);
         *
         * // apply a postive or negative force when pressing left of right key
         * update(dt) {
         *     if (me.input.isKeyPressed("left"))    {
         *          this.body.force.x = -this.body.maxVel.x;
         *      } else if (me.input.isKeyPressed("right")) {
         *         this.body.force.x = this.body.maxVel.x;
         *     } else {
         *         this.body.force.x = 0;
         *     }
         * }
         */
        if (typeof this.force === "undefined") {
            this.force = new Vector2d();
        }
        this.force.set(0, 0);


        /**
         * body friction
         * @public
         * @type me.Vector2d
         * @default <0,0>
         * @name friction
         * @memberOf me.Body
         */
        if (typeof this.friction === "undefined") {
            this.friction = new Vector2d();
        }
        this.friction.set(0, 0);

        /**
         * the body bouciness level when colliding with other solid bodies :
         * a value of 0 will not bounce, a value of 1 will fully rebound.
         * @public
         * @type {Number}
         * @default 0
         * @name bounce
         * @memberOf me.Body
         */
        this.bounce = 0;

        /**
         * the body mass
         * @public
         * @type {Number}
         * @default 1
         * @name mass
         * @memberOf me.Body
         */
        this.mass = 1;

        /**
         * max velocity (to limit body velocity)
         * @public
         * @type me.Vector2d
         * @default <490,490>
         * @name maxVel
         * @memberOf me.Body
         */
        if (typeof this.maxVel === "undefined") {
            this.maxVel = new Vector2d();
        }
        // cap by default to half the default gravity force
        this.maxVel.set(490, 490);

        /**
         * Default gravity value for this body.
         * To be set to to < 0, 0 > for RPG, shooter, etc...<br>
         * @public
         * @see me.Body.gravityScale
         * @type me.Vector2d
         * @default <0,0.98>
         * @deprecated since 8.0.0
         * @name gravity
         * @memberOf me.Body
         */
        if (typeof this.gravity === "undefined") {
            var self = this;
            this.gravity = new ObservableVector2d(0, 0, { onUpdate : function(x, y) {
                // disable gravity or apply a scale if y gravity is different from 0
                if (typeof y === "number") {
                    self.gravityScale = y / game.world.gravity.y;
                }
                // deprecation // WARNING:
                console.log(
                    "me.Body.gravity is deprecated, " +
                    "please see me.Body.gravityScale " +
                    "to modify gravity for a specific body"
                );
            }});
        }

        /**
         * The degree to which this body is affected by the world gravity
         * @public
         * @see me.World.gravity
         * @type Number
         * @default 1.0
         * @name gravityScale
         * @memberOf me.Body
         */
        this.gravityScale = 1.0;

        /**
         * If true this body won't be affected by the world gravity
         * @public
         * @see me.World.gravity
         * @type Boolean
         * @default false
         * @name ignoreGravity
         * @memberOf me.Body
         */
        this.ignoreGravity = false;

        /**
         * falling state of the body<br>
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
         * jumping state of the body<br>
         * equal true if the body is jumping<br>
         * @readonly
         * @public
         * @type Boolean
         * @default false
         * @name jumping
         * @memberOf me.Body
         */
        this.jumping = false;


        if (typeof onBodyUpdate === "function") {
            this.onBodyUpdate = onBodyUpdate;
        }


        this.bounds.clear();

        // parses the given shapes array and add them
        if (typeof shapes !== "undefined") {
            if (Array.isArray(shapes)) {
                for (var s = 0; s < shapes.length; s++) {
                    this.addShape(shapes[s]);
                }
            } else {
                this.addShape(shapes);
            }
        }

        // automatically enable physic when a body is added to a renderable
        this.ancestor.isKinematic = false;
    }

    /**
     * add a collision shape to this body <br>
     * (note: me.Rect objects will be converted to me.Polygon before being added)
     * @name addShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse|Object} shape a shape or JSON object
     * @param {Boolean} batchInsert if true the body bounds won't be updated after adding a shape
     * @return {Number} the shape array length
     * @example
     * // add a rectangle shape
     * this.body.addShape(new me.Rect(0, 0, image.width, image.height));
     * // add a shape from a JSON object
     * this.body.addShape(me.loader.getJSON("shapesdef").banana);
     */
    addShape(shape) {
        if (shape instanceof Rect) {
            var poly = shape.toPolygon();
            this.shapes.push(poly);
            // update the body bounds
            this.bounds.add(poly.points);
            this.bounds.translate(shape.pos);
        } else if (shape instanceof Ellipse) {
            if (!this.shapes.includes(shape)) {
                // see removeShape
                this.shapes.push(shape);
            }
            // update the body bounds
            this.bounds.add(shape.getBounds().points);
            this.bounds.translate(shape.pos);
        } else if (shape instanceof Polygon) {
            if (!this.shapes.includes(shape)) {
                // see removeShape
                this.shapes.push(shape);
            }
            // update the body bounds
            this.bounds.add(shape.points);
            this.bounds.translate(shape.pos);
        } else {
            // JSON object
            this.fromJSON(shape);
        }

        if (typeof this.onBodyUpdate === "function") {
            this.onBodyUpdate(this);
        }

        // return the length of the shape list
        return this.shapes.length;
    }

    /**
     * set the body vertices to the given one
     * @name setVertices
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {Number} [index=0] the shape object for which to set the vertices
     * @param {boolean} [clear=true] either to reset the body definition before adding the new vertices
     */
    setVertices(vertices, index = 0, clear = true) {
        var polygon = this.getShape(index);
        if (polygon instanceof Polygon) {
            polygon.setShape(0, 0, vertices);
        } else {
            // this will replace any other non polygon shape type if defined
            this.shapes[index] = new Polygon(0, 0, vertices);
        }

        // update the body bounds to take in account the new vertices
        this.bounds.add(this.shapes[index].points, clear);

        if (typeof this.onBodyUpdate === "function") {
            this.onBodyUpdate(this);
        }
    }

    /**
     * add the given vertices to the body shape
     * @name addVertices
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {Number} [index=0] the shape object for which to set the vertices
     */
    addVertices(vertices, index = 0) {
        this.setVertices(vertices, index, false);
    }

    /**
     * add collision mesh based on a JSON object
     * (this will also apply any physic properties defined in the given JSON file)
     * @name fromJSON
     * @memberOf me.Body
     * @public
     * @function
     * @param {Object} json a JSON object as exported from a Physics Editor tool
     * @param {String} [id] an optional shape identifier within the given the json object
     * @see https://www.codeandweb.com/physicseditor
     * @return {Number} how many shapes were added to the body
     * @example
     * // define the body based on the banana shape
     * this.body.fromJSON(me.loader.getJSON("shapesdef").banana);
     * // or ...
     * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
     */
    fromJSON(json, id) {
        var data = json;

        if (typeof id !== "undefined" ) {
            json[id];
        }

        // Physic Editor Format (https://www.codeandweb.com/physicseditor)
        if (typeof data === "undefined") {
            throw new Error("Identifier (" + id + ") undefined for the given JSON object)");
        }

        if (data.length) {
            // go through all shapes and add them to the body
            for (var i = 0; i < data.length; i++) {
                this.addVertices(data[i].shape, i);
            }
            // apply density, friction and bounce properties from the first shape
            // Note : how to manage different mass or friction for all different shapes?
            this.mass = data[0].density || 0;
            this.friction.set(data[0].friction || 0, data[0].friction || 0);
            this.bounce = data[0].bounce || 0;
        }

        // return the amount of shapes added to the body
        return data.length;
    }

    /**
     * return the collision shape at the given index
     * @name getShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {Number} [index=0] the shape object at the specified index
     * @return {me.Polygon|me.Line|me.Ellipse} shape a shape object if defined
     */
    getShape(index) {
        return this.shapes[index || 0];
    }

    /**
     * returns the AABB bounding box for this body
     * @name getBounds
     * @memberOf me.Body
     * @function
     * @return {me.Bounds} bounding box Rectangle object
     */
    getBounds() {
        return this.bounds;
    }

    /**
     * remove the specified shape from the body shape list
     * @name removeShape
     * @memberOf me.Body
     * @public
     * @function
     * @param {me.Polygon|me.Line|me.Ellipse} shape a shape object
     * @return {Number} the shape array length
     */
    removeShape(shape) {
        // clear the current bounds
        this.bounds.clear();
        // remove the shape from shape list
        utils.array.remove(this.shapes, shape);
        // add everything left back
        for (var s = 0; s < this.shapes.length; s++) {
            this.addShape(this.shapes[s]);
        }
        // return the length of the shape list
        return this.shapes.length;
    }

    /**
     * remove the shape at the given index from the body shape list
     * @name removeShapeAt
     * @memberOf me.Body
     * @public
     * @function
     * @param {Number} index the shape object at the specified index
     * @return {Number} the shape array length
     */
    removeShapeAt(index) {
        return this.removeShape(this.getShape(index));
    }

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
    setCollisionMask(bitmask) {
        this.collisionMask = bitmask;
    }

    /**
     * the built-in function to solve the collision response
     * @protected
     * @name respondToCollision
     * @memberOf me.Body
     * @function
     * @param {me.collision.ResponseObject} response the collision response object
     */
    respondToCollision(response) {
        // the overlap vector
        var overlap = response.overlapV;

        // FIXME: Respond proportionally to object mass

        // Move out of the other object shape
        this.ancestor.pos.sub(overlap);

        // adjust velocity
        if (overlap.x !== 0) {
            this.vel.x = ~~(0.5 + this.vel.x - overlap.x) || 0;
            if (this.bounce > 0) {
                this.vel.x *= -this.bounce;
            }
        }
        if (overlap.y !== 0) {
            this.vel.y = ~~(0.5 + this.vel.y - overlap.y) || 0;
            if (this.bounce > 0) {
                this.vel.y *= -this.bounce;
            }

            // cancel the falling an jumping flags if necessary
            var dir = Math.sign(game.world.gravity.y * this.gravityScale) || 1;
            this.falling = overlap.y >= dir;
            this.jumping = overlap.y <= -dir;
        }
    }

    /**
     * Rotate this body (counter-clockwise) by the specified angle (in radians).
     * Unless specified the body will be rotated around its center point
     * @name rotate
     * @memberOf me.Body
     * @function
     * @param {Number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @return {me.Body} Reference to this object for method chaining
     */
    rotate(angle, v) {
        v = v || this.center;

        this.bounds.clear();

        for (var i = 0; i < this.shapes.length; i++) {
            var shape = this.shapes[i];
            shape.rotate(angle, v);
            this.bounds.add(shape.points);
            this.bounds.translate(shape.pos);
        }

        return this;
    }

    /**
     * Sets accel to Velocity if x or y is not 0.  Net effect is to set the maxVel.x/y to the passed values for x/y<br>
     * note: This does not set the vel member of the body object. This is identical to the setMaxVelocity call except that the
     * accel property is updated to match the passed x and y.
     * setMaxVelocity if needed<br>
     * @name setVelocity
     * @memberOf me.Body
     * @function
     * @param {Number} x velocity on x axis
     * @param {Number} y velocity on y axis
     * @protected
     * @deprecated
     * @see me.Body.force
     */
    setVelocity(x, y) {
        this.accel.x = x !== 0 ? x : this.accel.x;
        this.accel.y = y !== 0 ? y : this.accel.y;

        // limit by default to the same max value
        this.setMaxVelocity(x, y);
    }

    /**
     * cap the body velocity (body.maxVel property) to the specified value<br>
     * @name setMaxVelocity
     * @memberOf me.Body
     * @function
     * @param {Number} x max velocity on x axis
     * @param {Number} y max velocity on y axis
     * @protected
     */
    setMaxVelocity(x, y) {
        this.maxVel.x = x;
        this.maxVel.y = y;
    }

    /**
     * set the body default friction
     * @name setFriction
     * @memberOf me.Body
     * @function
     * @param {Number} x horizontal friction
     * @param {Number} y vertical friction
     * @protected
     */
    setFriction(x, y) {
        this.friction.x = x || 0;
        this.friction.y = y || 0;
    }

    /**
     * apply friction to a vector
     * @ignore
     */
    applyFriction(vel) {
        var fx = this.friction.x * timer.tick,
            nx = vel.x + fx,
            x = vel.x - fx,
            fy = this.friction.y * timer.tick,
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
    }

    /**
     * compute the new velocity value
     * @ignore
     */
    computeVelocity(vel) {
        // apply fore if defined
        if (this.force.x) {
            vel.x += this.force.x * timer.tick;
        }
        if (this.force.y) {
            vel.y += this.force.y * timer.tick;
        }

        // apply friction
        if (this.friction.x || this.friction.y) {
            this.applyFriction(vel);
        }

        if (!this.ignoreGravity) {
            var worldGravity = game.world.gravity;
            // apply gravity if defined
            vel.x += worldGravity.x * this.gravityScale * this.mass * timer.tick;
            vel.y += worldGravity.y * this.gravityScale * this.mass * timer.tick;
            // check if falling / jumping
            this.falling = (vel.y * Math.sign(worldGravity.y * this.gravityScale)) > 0;
            this.jumping = (this.falling ? false : this.jumping);
        }

        // cap velocity
        if (vel.y !== 0) {
            vel.y = clamp(vel.y, -this.maxVel.y, this.maxVel.y);
        }
        if (vel.x !== 0) {
            vel.x = clamp(vel.x, -this.maxVel.x, this.maxVel.x);
        }

    }

    /**
     * Updates the parent's position as well as computes the new body's velocity based
     * on the values of force/friction/gravity.  Velocity chages are proportional to the
     * me.timer.tick value (which can be used to scale velocities).  The approach to moving the
     * parent Entity is to compute new values of the Body.vel property then add them to
     * the parent.pos value thus changing the postion the amount of Body.vel each time the
     * update call is made. <br>
     * Updates to Body.vel are bounded by maxVel (which defaults to viewport size if not set) <br>
     *
     * In addition, when the gravity calcuation is made, if the Body.vel.y > 0 then the Body.falling
     * property is set to true and Body.jumping is set to !Body.falling.
     *
     * At this time a call to Body.Update does not call the onBodyUpdate callback that is listed in the init: function.
     * @name update
     * @memberOf me.Body
     * @function
     * @return {boolean} true if resulting velocity is different than 0
     * @see source code for me.Body.computeVelocity (private member)
     */
    update(/* dt */) {
        // update the velocity
        this.computeVelocity(this.vel);

        // update the body ancestor position
        this.ancestor.pos.add(this.vel);

        // returns true if vel is different from 0
        return (this.vel.x !== 0 || this.vel.y !== 0);
    }

    /**
     * Destroy function<br>
     * @ignore
     */
    destroy() {
        this.onBodyUpdate = undefined;
        this.ancestor = undefined;
        this.shapes.length = 0;
    }
};

export default Body;
