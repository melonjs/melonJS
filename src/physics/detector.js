import * as SAT from "./sat.js";
import Vector2d from "./../math/vector2.js";
import { world } from "./../game.js";

// a dummy object when using Line for raycasting
var dummyObj = {
    pos : new Vector2d(0, 0),
    ancestor : {
        _absPos : new Vector2d(0, 0),
        getAbsolutePosition : function () {
            return this._absPos;
        }
    }
};

/**
 * a function used to determine if two objects should collide (based on both respective objects collision mask and type).<br>
 * you can redefine this function if you need any specific rules over what should collide with what.
 * @name shouldCollide
 * @memberof me.collision
 * @ignore
 * @function
 * @param {me.Renderable} a a reference to the object A.
 * @param {me.Renderable} b a reference to the object B.
 * @returns {boolean} true if they should collide, false otherwise
 */
function shouldCollide(a, b) {
    return (
        a.isKinematic !== true && b.isKinematic !== true &&
        a.body && b.body &&
        (a.body.collisionMask & b.body.collisionType) !== 0 &&
        (a.body.collisionType & b.body.collisionMask) !== 0
    );
};

/**
 * @classdesc
 * An object representing the result of an intersection.
 * @property {me.Renderable} a The first object participating in the intersection
 * @property {me.Renderable} b The second object participating in the intersection
 * @property {number} overlap Magnitude of the overlap on the shortest colliding axis
 * @property {me.Vector2d} overlapV The overlap vector (i.e. `overlapN.scale(overlap, overlap)`). If this vector is subtracted from the position of a, a and b will no longer be colliding
 * @property {me.Vector2d} overlapN The shortest colliding axis (unit-vector)
 * @property {boolean} aInB Whether the first object is entirely inside the second
 * @property {boolean} bInA Whether the second object is entirely inside the first
 * @property {number} indexShapeA The index of the colliding shape for the object a body
 * @property {number} indexShapeB The index of the colliding shape for the object b body
 * @name ResponseObject
 * @memberof me.collision
 * @public
 */
class ResponseObject {
    constructor() {
        this.a = null;
        this.b = null;
        this.overlapN = new Vector2d();
        this.overlapV = new Vector2d();
        this.aInB = true;
        this.bInA = true;
        this.indexShapeA = -1;
        this.indexShapeB = -1;
        this.overlap = Number.MAX_VALUE;
    }

    /**
     * Set some values of the response back to their defaults. <br>
     * Call this between tests if you are going to reuse a single <br>
     * Response object for multiple intersection tests <br>
     * (recommended as it will avoid allocating extra memory) <br>
     * @name clear
     * @memberof me.collision.ResponseObject
     * @public
     * @function
     * @returns {object} this object for chaining
     */
    clear () {
        this.aInB = true;
        this.bInA = true;
        this.overlap = Number.MAX_VALUE;
        this.indexShapeA = -1;
        this.indexShapeB = -1;
        return this;
    }
}

// @ignore
export var globalResponse = new ResponseObject();

/**
 * find all the collisions for the specified object
 * @name collisionCheck
 * @ignore
 * @function
 * @param {me.Renderable} objA object to be tested for collision
 * @param {me.collision.ResponseObject} [response=me.collision.response] a user defined response object that will be populated if they intersect.
 * @returns {boolean} in case of collision, false otherwise
 */
export function collisionCheck(objA, response = globalResponse) {
    var collisionCounter = 0;
    // retreive a list of potential colliding objects from the game world
    var candidates = world.broadphase.retrieve(objA);

    for (var i = candidates.length, objB; i--, (objB = candidates[i]);) {

        // check if both objects "should" collide
        if ((objB !== objA) && shouldCollide(objA, objB) &&
            // fast AABB check if both bounding boxes are overlaping
            objA.body.getBounds().overlaps(objB.body.getBounds())) {

            // go trough all defined shapes in A
            var aLen = objA.body.shapes.length;
            var bLen = objB.body.shapes.length;
            if (aLen === 0 || bLen === 0) {
                continue;
            }

            var indexA = 0;
            do {
                var shapeA = objA.body.getShape(indexA);
                // go through all defined shapes in B
                var indexB = 0;
                do {
                    var shapeB = objB.body.getShape(indexB);

                    // full SAT collision check
                    if (SAT["test" + shapeA.shapeType + shapeB.shapeType]
                        .call(
                            this,
                            objA, // a reference to the object A
                            shapeA,
                            objB,  // a reference to the object B
                            shapeB,
                             // clear response object before reusing
                            response.clear()) === true
                    ) {
                        // we touched something !
                        collisionCounter++;

                        // set the shape index
                        response.indexShapeA = indexA;
                        response.indexShapeB = indexB;

                        // execute the onCollision callback
                        if (objA.onCollision && objA.onCollision(response, objB) !== false) {
                            objA.body.respondToCollision.call(objA.body, response);
                        }
                        if (objB.onCollision && objB.onCollision(response, objA) !== false) {
                            objB.body.respondToCollision.call(objB.body, response);
                        }
                    }
                    indexB++;
                } while (indexB < bLen);
                indexA++;
            } while (indexA < aLen);
        }
    }
    // we could return the amount of objects we collided with ?
    return collisionCounter > 0;
};

/**
 * Checks for object colliding with the given line
 * @name rayCast
 * @ignore
 * @function
 * @param {me.Line} line line to be tested for collision
 * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
 * @returns {Array.<me.Renderable>} an array of intersecting physic objects
 * @example
 *    // define a line accross the viewport
 *    var ray = new me.Line(
 *        // absolute position of the line
 *        0, 0, [
 *        // starting point relative to the initial position
 *        new me.Vector2d(0, 0),
 *        // ending point
 *        new me.Vector2d(me.game.viewport.width, me.game.viewport.height)
 *    ]);
 *
 *    // check for collition
 *    result = me.collision.rayCast(ray);
 *
 *    if (result.length > 0) {
 *        // ...
 *    }
 */
export function rayCast(line, result = []) {
    var collisionCounter = 0;

    // retrieve a list of potential colliding objects from the game world
    var candidates = world.broadphase.retrieve(line);

    for (var i = candidates.length, objB; i--, (objB = candidates[i]);) {

        // fast AABB check if both bounding boxes are overlaping
        if (objB.body && line.getBounds().overlaps(objB.getBounds())) {

            // go trough all defined shapes in B (if any)
            var bLen = objB.body.shapes.length;
            if ( objB.body.shapes.length === 0) {
                continue;
            }

            var shapeA = line;

            // go through all defined shapes in B
            var indexB = 0;
            do {
                var shapeB = objB.body.getShape(indexB);

                // full SAT collision check
                if (SAT["test" + shapeA.shapeType + shapeB.shapeType]
                    .call(
                        this,
                        dummyObj, // a reference to the object A
                        shapeA,
                        objB,  // a reference to the object B
                        shapeB
                )) {
                    // we touched something !
                    result[collisionCounter] = objB;
                    collisionCounter++;
                }
                indexB++;
            } while (indexB < bLen);
        }
    }

    // cap result in case it was not empty
    result.length = collisionCounter;

    // return the list of colliding objects
    return result;
};
