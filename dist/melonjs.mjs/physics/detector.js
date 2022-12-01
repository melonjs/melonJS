/*!
 * melonJS Game Engine - v14.1.2
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
import * as sat from './sat.js';
import ResponseObject from './response.js';
import Vector2d from '../math/vector2.js';
import game from '../game.js';
import Bounds from './bounds.js';

// a dummy object when using Line for raycasting
let dummyObj = {
    pos : new Vector2d(0, 0),
    ancestor : {
        _absPos : new Vector2d(0, 0),
        getAbsolutePosition : function () {
            return this._absPos;
        }
    }
};

let boundsA = new Bounds();
let boundsB = new Bounds();

// the global response object used for collisions
let globalResponse = new ResponseObject();

/**
 * a function used to determine if two objects should collide (based on both respective objects collision mask and type).<br>
 * you can redefine this function if you need any specific rules over what should collide with what.
 * @ignore
 * @param {Renderable} a - a reference to the object A.
 * @param {Renderable} b - a reference to the object B.
 * @returns {boolean} true if they should collide, false otherwise
 */
function shouldCollide(a, b) {
    var bodyA = a.body,
        bodyB = b.body;
    return (
        a !== b &&
        a.isKinematic !== true && b.isKinematic !== true &&
        typeof bodyA === "object" && typeof bodyB === "object" &&
        bodyA.shapes.length > 0 && bodyB.shapes.length > 0 &&
        !(bodyA.isStatic === true && bodyB.isStatic === true) &&
        (bodyA.collisionMask & bodyB.collisionType) !== 0 &&
        (bodyA.collisionType & bodyB.collisionMask) !== 0
    );
}



/**
 * find all the collisions for the specified object
 * @ignore
 * @param {Renderable} objA - object to be tested for collision
 * @param {ResponseObject} [response] - a user defined response object that will be populated if they intersect.
 * @returns {boolean} in case of collision, false otherwise
 */
function collisionCheck(objA, response = globalResponse) {
    var collisionCounter = 0;
    // retreive a list of potential colliding objects from the game world
    var candidates = game.world.broadphase.retrieve(objA);

    boundsA.addBounds(objA.getBounds(), true);
    boundsA.addBounds(objA.body.getBounds());

    candidates.forEach((objB) => {
        // check if both objects "should" collide
        if (shouldCollide(objA, objB)) {

            boundsB.addBounds(objB.getBounds(), true);
            boundsB.addBounds(objB.body.getBounds());

            // fast AABB check if both bounding boxes are overlaping
            if (boundsA.overlaps(boundsB)) {
                // for each shape in body A
                objA.body.shapes.forEach((shapeA, indexA) => {
                    // for each shape in body B
                    objB.body.shapes.forEach((shapeB, indexB) => {
                        // full SAT collision check
                        if (sat["test" + shapeA.shapeType + shapeB.shapeType].call(
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
                            if (objA.onCollision && objA.onCollision(response, objB) !== false && objA.body.isStatic === false) {
                                objA.body.respondToCollision.call(objA.body, response);
                            }
                            if (objB.onCollision && objB.onCollision(response, objA) !== false && objB.body.isStatic === false) {
                                objB.body.respondToCollision.call(objB.body, response);
                            }
                        }
                    });
                });
            }
        }
    });
    // we could return the amount of objects we collided with ?
    return collisionCounter > 0;
}

/**
 * Checks for object colliding with the given line
 * @ignore
 * @param {Line} line - line to be tested for collision
 * @param {Array.<Renderable>} [result] - a user defined array that will be populated with intersecting physic objects.
 * @returns {Array.<Renderable>} an array of intersecting physic objects
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
function rayCast(line, result = []) {
    var collisionCounter = 0;

    // retrieve a list of potential colliding objects from the game world
    var candidates = game.world.broadphase.retrieve(line);

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
                if (sat["test" + shapeA.shapeType + shapeB.shapeType]
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
}

export { collisionCheck, rayCast };
