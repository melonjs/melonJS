import Vector2d from "./../math/vector2.js";
import Rect from "./../geometries/rectangle.js";
import Ellipse from "./../geometries/ellipse.js";
import Polygon from "./../geometries/poly.js";
import Bounds from "./bounds.js";
import collision from "./collision.js";
import * as arrayUtil from "./../utils/array.js";
import timer from "./../system/timer.js";
import { clamp } from "./../math/math.js";
import { world } from "./../game.js";


/**
 * a Generic Physic Body Object with some physic properties and behavior functionality, to as a member of a Renderable.
 * @class Body
 * @memberof me
 * @param {me.Renderable} ancestor the parent object this body is attached to
 * @param {me.Rect|me.Rect[]|me.Polygon|me.Polygon[]|me.Line|me.Line[]|me.Ellipse|me.Ellipse[]|me.Bounds|me.Bounds[]|object} [shapes] a initial shape, list of shapes, or JSON object defining the body
 * @param {Function} [onBodyUpdate] callback for when the body is updated (e.g. add/remove shapes)
 */
class Body {

    constructor(parent, shapes, onBodyUpdate) {

        /**
         * a reference to the parent object that contains this body,
         * or undefined if it has not been added to one.
         * @public
         * @type {me.Renderable}
         * @default undefined
         * @name me.Body#ancestor
         */
        this.ancestor = parent;

        /**
         * The AABB bounds box reprensenting this body
         * @public
         * @type {me.Bounds}
         * @name bounds
         * @memberof me.Body
         */
        if (typeof this.bounds === "undefined") {
            this.bounds = new Bounds();
        }

        /**
         * The collision shapes of the body
         * @ignore
         * @type {me.Polygon[]|me.Line[]|me.Ellipse[]}
         * @name shapes
         * @memberof me.Body
         */
        if (typeof this.shapes === "undefined") {
            this.shapes = [];
        }

        /**
         * The body collision mask, that defines what should collide with what.<br>
         * (by default will collide with all entities)
         * @ignore
         * @type {number}
         * @default me.collision.types.ALL_OBJECT
         * @name collisionMask
         * @see me.collision.types
         * @memberof me.Body
         */
        this.collisionMask = collision.types.ALL_OBJECT;

        /**
         * define the collision type of the body for collision filtering
         * @public
         * @type {number}
         * @default me.collision.types.ENEMY_OBJECT
         * @name collisionType
         * @see me.collision.types
         * @memberof me.Body
         * @example
         * // set the body collision type
         * myEntity.body.collisionType = me.collision.types.PLAYER_OBJECT;
         */
        this.collisionType = collision.types.ENEMY_OBJECT;

        /**
         * body velocity
         * @public
         * @type {me.Vector2d}
         * @default <0,0>
         * @name vel
         * @memberof me.Body
         */
        if (typeof this.vel === "undefined") {
            this.vel = new Vector2d();
        }
        this.vel.set(0, 0);

        /**
         * body force or acceleration (automatically) applied to the body.
         * when defining a force, user should also define a max velocity
         * @public
         * @type {me.Vector2d}
         * @default <0,0>
         * @name force
         * @see me.Body.setMaxVelocity
         * @memberof me.Body
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
         * @type {me.Vector2d}
         * @default <0,0>
         * @name friction
         * @memberof me.Body
         */
        if (typeof this.friction === "undefined") {
            this.friction = new Vector2d();
        }
        this.friction.set(0, 0);

        /**
         * the body bouciness level when colliding with other solid bodies :
         * a value of 0 will not bounce, a value of 1 will fully rebound.
         * @public
         * @type {number}
         * @default 0
         * @name bounce
         * @memberof me.Body
         */
        this.bounce = 0;

        /**
         * the body mass
         * @public
         * @type {number}
         * @default 1
         * @name mass
         * @memberof me.Body
         */
        this.mass = 1;

        /**
         * max velocity (to limit body velocity)
         * @public
         * @type {me.Vector2d}
         * @default <490,490>
         * @name maxVel
         * @memberof me.Body
         */
        if (typeof this.maxVel === "undefined") {
            this.maxVel = new Vector2d();
        }
        // cap by default to half the default gravity force
        this.maxVel.set(490, 490);


        /**
         * either this body is a static body or not
         * @readonly
         * @public
         * @type {boolean}
         * @default false
         * @name isStatic
         * @memberof me.Body
         */
        this.isStatic = false;


        /**
         * The degree to which this body is affected by the world gravity
         * @public
         * @see me.World.gravity
         * @type {number}
         * @default 1.0
         * @name gravityScale
         * @memberof me.Body
         */
        this.gravityScale = 1.0;

        /**
         * If true this body won't be affected by the world gravity
         * @public
         * @see me.World.gravity
         * @type {boolean}
         * @default false
         * @name ignoreGravity
         * @memberof me.Body
         */
        this.ignoreGravity = false;

        /**
         * falling state of the body<br>
         * true if the object is falling<br>
         * false if the object is standing on something<br>
         * @readonly
         * @public
         * @type {boolean}
         * @default false
         * @name falling
         * @memberof me.Body
         */
        this.falling = false;

        /**
         * jumping state of the body<br>
         * equal true if the body is jumping<br>
         * @readonly
         * @public
         * @type {boolean}
         * @default false
         * @name jumping
         * @memberof me.Body
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
     * set the body as a static body
     * static body do not move automatically and do not check againt collision with others
     * @name setStatic
     * @memberof me.Body
     * @public
     * @function
     * @param {boolean} [isStatic=true]
     */
    setStatic(isStatic = true) {
        this.isStatic = isStatic === true;
    }

    /**
     * add a collision shape to this body <br>
     * (note: me.Rect objects will be converted to me.Polygon before being added)
     * @name addShape
     * @memberof me.Body
     * @public
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse|me.Bounds|object} shape a shape or JSON object
     * @returns {number} the shape array length
     * @example
     * // add a rectangle shape
     * this.body.addShape(new me.Rect(0, 0, image.width, image.height));
     * // add a shape from a JSON object
     * this.body.addShape(me.loader.getJSON("shapesdef").banana);
     */
    addShape(shape) {
        if (shape instanceof Rect || shape instanceof Bounds) {
            var poly = shape.toPolygon();
            this.shapes.push(poly);
            // update the body bounds
            this.bounds.add(poly.points);
            this.bounds.translate(poly.pos);
        } else if (shape instanceof Ellipse) {
            if (!this.shapes.includes(shape)) {
                // see removeShape
                this.shapes.push(shape);
            }
            // update the body bounds
            this.bounds.addBounds(shape.getBounds());
            // use bounds position as ellipse position is center
            this.bounds.translate(
                shape.getBounds().x,
                shape.getBounds().y
            );
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
     * @memberof me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {number} [index=0] the shape object for which to set the vertices
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
     * @memberof me.Body
     * @public
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
     * @param {number} [index=0] the shape object for which to set the vertices
     */
    addVertices(vertices, index = 0) {
        this.setVertices(vertices, index, false);
    }

    /**
     * add collision mesh based on a JSON object
     * (this will also apply any physic properties defined in the given JSON file)
     * @name fromJSON
     * @memberof me.Body
     * @public
     * @function
     * @param {object} json a JSON object as exported from a Physics Editor tool
     * @param {string} [id] an optional shape identifier within the given the json object
     * @see https://www.codeandweb.com/physicseditor
     * @returns {number} how many shapes were added to the body
     * @example
     * // define the body based on the banana shape
     * this.body.fromJSON(me.loader.getJSON("shapesdef").banana);
     * // or ...
     * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
     */
    fromJSON(json, id) {
        var data = json;

        if (typeof id !== "undefined" ) {
            data = json[id];
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
     * @memberof me.Body
     * @public
     * @function
     * @param {number} [index=0] the shape object at the specified index
     * @returns {me.Polygon|me.Line|me.Ellipse} shape a shape object if defined
     */
    getShape(index) {
        return this.shapes[index || 0];
    }

    /**
     * returns the AABB bounding box for this body
     * @name getBounds
     * @memberof me.Body
     * @function
     * @returns {me.Bounds} bounding box Rectangle object
     */
    getBounds() {
        return this.bounds;
    }

    /**
     * remove the specified shape from the body shape list
     * @name removeShape
     * @memberof me.Body
     * @public
     * @function
     * @param {me.Polygon|me.Line|me.Ellipse} shape a shape object
     * @returns {number} the shape array length
     */
    removeShape(shape) {
        // clear the current bounds
        this.bounds.clear();
        // remove the shape from shape list
        arrayUtil.remove(this.shapes, shape);
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
     * @memberof me.Body
     * @public
     * @function
     * @param {number} index the shape object at the specified index
     * @returns {number} the shape array length
     */
    removeShapeAt(index) {
        return this.removeShape(this.getShape(index));
    }

    /**
     * By default all entities are able to collide with all other entities, <br>
     * but it's also possible to specify 'collision filters' to provide a finer <br>
     * control over which entities can collide with each other.
     * @name setCollisionMask
     * @memberof me.Body
     * @public
     * @function
     * @see me.collision.types
     * @param {number} [bitmask = me.collision.types.ALL_OBJECT] the collision mask
     * @example
     * // filter collision detection with collision shapes, enemies and collectables
     * myEntity.body.setCollisionMask(me.collision.types.WORLD_SHAPE | me.collision.types.ENEMY_OBJECT | me.collision.types.COLLECTABLE_OBJECT);
     * ...
     * // disable collision detection with all other objects
     * myEntity.body.setCollisionMask(me.collision.types.NO_OBJECT);
     */
    setCollisionMask(bitmask = collision.types.ALL_OBJECT) {
        this.collisionMask = bitmask;
    }

    /**
     * define the collision type of the body for collision filtering
     * @name setCollisionType
     * @memberof me.Body
     * @public
     * @function
     * @see me.collision.types
     * @param {number} type the collision type
     * @example
     * // set the body collision type
     * myEntity.body.collisionType = me.collision.types.PLAYER_OBJECT;
     */
    setCollisionType(type) {
        if (typeof type !== "undefined") {
            if (typeof collision.types[type] !== "undefined") {
                this.collisionType = collision.types[type];
            } else {
                throw new Error("Invalid value for the collisionType property");
            }
        }
    }

    /**
     * the built-in function to solve the collision response
     * @protected
     * @name respondToCollision
     * @memberof me.Body
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
            var dir = Math.sign(world.gravity.y * this.gravityScale) || 1;
            this.falling = overlap.y >= dir;
            this.jumping = overlap.y <= -dir;
        }
    }

    /**
     * The forEach() method executes a provided function once per body shape element. <br>
     * the callback function is invoked with three arguments: <br>
     *    - The current element being processed in the array <br>
     *    - The index of element in the array. <br>
     *    - The array forEach() was called upon. <br>
     * @name forEach
     * @memberof me.Body.prototype
     * @function
     * @param {Function} callback fnction to execute on each element
     * @param {object} [thisArg] value to use as this(i.e reference Object) when executing callback.
     * @example
     * // iterate through all shapes of the physic body
     * mySprite.body.forEach((shape) => {
     *    shape.doSomething();
     * });
     * mySprite.body.forEach((shape, index) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... }, thisArg);
     */
    forEach(callback, thisArg) {
        var context = this, i = 0;
        var shapes = this.shapes;

        var len = shapes.length;

        if (typeof callback !== "function") {
            throw new Error(callback + " is not a function");
        }

        if (arguments.length > 1) {
            context = thisArg;
        }

        while (i < len) {
            callback.call(context, shapes[i], i, shapes);
            i++;
        }
    }


    /**
     * Returns true if the any of the shape composing the body contains the given point.
     * @name contains
     * @memberof me.Body
     * @function
     * @param  {me.Vector2d} point
     * @returns {boolean} true if contains
     */

    /**
     * Returns true if the any of the shape composing the body contains the given point.
     * @name contains
     * @memberof me.Body
     * @function
     * @param  {number} x x coordinate
     * @param  {number} y y coordinate
     * @returns {boolean} true if contains
     */
    contains() {
        var _x, _y;

        if (arguments.length === 2) {
          // x, y
          _x = arguments[0];
          _y = arguments[1];
        } else {
          // vector
          _x = arguments[0].x;
          _y = arguments[0].y;
        }

        if (this.getBounds().contains(_x, _y)) {
             // cannot use forEach here as cannot break out with a return
             for (var i = this.shapes.length, shape; i--, (shape = this.shapes[i]);) {
                if (shape.contains(_x, _y)) {
                    return true;
                }
            };
        }
        return false;
    }

    /**
     * Rotate this body (counter-clockwise) by the specified angle (in radians).
     * Unless specified the body will be rotated around its center point
     * @name rotate
     * @memberof me.Body
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v=me.Body.getBounds().center] an optional point to rotate around
     * @returns {me.Body} Reference to this object for method chaining
     */
    rotate(angle, v = this.getBounds().center) {
        this.bounds.clear();
        this.forEach((shape) => {
            shape.rotate(angle, v);
            this.bounds.addBounds(shape.getBounds());
            if (shape instanceof Ellipse) {
                // use bounds position as ellipse position is center
                this.bounds.translate(
                    shape.getBounds().x,
                    shape.getBounds().y
                );
            } else {
                this.bounds.translate(shape.pos);
            }
        });
        return this;
    }

    /**
     * cap the body velocity (body.maxVel property) to the specified value<br>
     * @name setMaxVelocity
     * @memberof me.Body
     * @function
     * @param {number} x max velocity on x axis
     * @param {number} y max velocity on y axis
     * @protected
     */
    setMaxVelocity(x, y) {
        this.maxVel.x = x;
        this.maxVel.y = y;
    }

    /**
     * set the body default friction
     * @name setFriction
     * @memberof me.Body
     * @function
     * @param {number} x horizontal friction
     * @param {number} y vertical friction
     * @protected
     */
    setFriction(x = 0, y = 0) {
        this.friction.x = x;
        this.friction.y = y;
    }

    /**
     * compute the new velocity value
     * @ignore
     */
    computeVelocity(/* dt */) {
        // apply timer.tick to delta time for linear interpolation (when enabled)
        // #761 add delta time in body update
        var deltaTime = /* dt * */ timer.tick;

        // apply gravity to the current velocity
        if (!this.ignoreGravity) {
            var worldGravity = world.gravity;

            // apply gravity if defined
            this.vel.x += worldGravity.x * this.gravityScale * deltaTime;
            this.vel.y += worldGravity.y * this.gravityScale * deltaTime;

            // check if falling / jumping
            this.falling = (this.vel.y * Math.sign(worldGravity.y * this.gravityScale)) > 0;
            this.jumping = (this.falling ? false : this.jumping);
        }

        // apply force if defined
        if (this.force.x !== 0) {
            this.vel.x += this.force.x * deltaTime;
        }
        if (this.force.y !== 0) {
            this.vel.y += this.force.y * deltaTime;
        }

        // apply friction if defined
        if (this.friction.x > 0) {
            var fx = this.friction.x * deltaTime,
                nx = this.vel.x + fx,
                x = this.vel.x - fx;

            this.vel.x = (
                (nx < 0) ? nx :
                ( x > 0) ? x  : 0
            );
        }
        if (this.friction.y > 0) {
            var fy = this.friction.y * deltaTime,
                ny = this.vel.y + fy,
                y = this.vel.y - fy;

            this.vel.y = (
                (ny < 0) ? ny :
                ( y > 0) ? y  : 0
            );
        }

        // cap velocity
        if (this.vel.y !== 0) {
            this.vel.y = clamp(this.vel.y, -this.maxVel.y, this.maxVel.y);
        }
        if (this.vel.x !== 0) {
            this.vel.x = clamp(this.vel.x, -this.maxVel.x, this.maxVel.x);
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
     * At this time a call to Body.Update does not call the onBodyUpdate callback that is listed in the constructor arguments.
     * @name update
     * @ignore
     * @memberof me.Body
     * @function
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean} true if resulting velocity is different than 0
     */
    update(dt) {
        // update the velocity
        this.computeVelocity(dt);

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
        this.bounds = undefined;
        this.setStatic(false);
        this.shapes.length = 0;
    }
};

export default Body;
