import * as SAT from "./sat.js";
import Vector2d from "./../math/vector2.js";
import { world } from "./../game.js";
import collision from "./collision.js";


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
 * @memberOf me.collision
 * @ignore
 * @function
 * @param {me.Renderable} a a reference to the object A.
 * @param {me.Renderable} b a reference to the object B.
 * @return {Boolean} true if they should collide, false otherwise
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
 * find all the collisions for the specified object
 * @name collisionCheck
 * @memberOf me.collision
 * @ignore
 * @function
 * @param {me.Renderable} obj object to be tested for collision
 * @param {me.collision.ResponseObject} [response=me.collision.response] a user defined response object that will be populated if they intersect.
 * @return {Boolean} in case of collision, false otherwise
 */
export function collisionCheck(objA, response = collision.response) {
    var collision = 0;

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
                        collision++;

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
    return collision > 0;
};

/**
 * Checks for object colliding with the given line
 * @name rayCast
 * @memberOf me.collision
 * @ignore
 * @function
 * @param {me.Line} line line to be tested for collision
 * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
 * @return {Array.<me.Renderable>} an array of intersecting physic objects
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
export function rayCast(line, resultArray) {
    var collision = 0;
    var result = resultArray || [];

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
                    result[collision] = objB;
                    collision++;
                }
                indexB++;
            } while (indexB < bLen);
        }
    }

    // cap result in case it was not empty
    result.length = collision;

    // return the list of colliding objects
    return result;
};
