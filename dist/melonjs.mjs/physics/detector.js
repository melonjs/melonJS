/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import * as sat from './sat.js';
import ResponseObject from './response.js';
import Vector2d from '../math/vector2.js';
import Bounds from './bounds.js';

/**
 * @import Entity from "./../renderable/entity/entity.js";
 * @import Container from "./../renderable/container.js";
 * @import Renderable from "./../renderable/renderable.js";
 * @import Sprite from "./../renderable/sprite.js";
 * @import NineSliceSprite from "./../renderable/nineslicesprite.js";
 * @import Line from "./../geometries/line.js";
 */

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

// some cache bounds object used for collision detection
let boundsA = new Bounds();
let boundsB = new Bounds();

/**
 * the Detector class contains methods for detecting collisions between bodies using a broadphase algorithm.
 */
class Detector {
    /**
     * @param {Container} world - the physic world this detector is bind to
     */
    constructor(world) {
        // @ignore
        this.world = world;

        /**
         * the default response object used for collisions
         * (will be automatically populated by the collides functions)
         * @type {ResponseObject}
         */
        this.response = new ResponseObject();
    }

    /**
     * determine if two objects should collide (based on both respective objects body collision mask and type).<br>
     * you can redefine this function if you need any specific rules over what should collide with what.
     * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} a - a reference to the object A.
     * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} b - a reference to the object B.
     * @returns {boolean} true if they should collide, false otherwise
     */
    shouldCollide(a, b) {
        let bodyA = a.body,
            bodyB = b.body;
        return (
            (typeof bodyA === "object" && typeof bodyB === "object") &&
            a !== b &&
            a.isKinematic !== true && b.isKinematic !== true &&
            bodyA.shapes.length > 0 && bodyB.shapes.length > 0 &&
            !(bodyA.isStatic === true && bodyB.isStatic === true) &&
            (bodyA.collisionMask & bodyB.collisionType) !== 0 &&
            (bodyA.collisionType & bodyB.collisionMask) !== 0
        );
    }

    /**
     * detect collision between two bodies.
     * @param {Body} bodyA - a reference to body A.
     * @param {Body} bodyB - a reference to body B.
     * @returns {boolean} true if colliding
     */
    collides(bodyA, bodyB, response = this.response) {
        // for each shape in body A
        for (let indexA = bodyA.shapes.length, shapeA; indexA--, (shapeA = bodyA.shapes[indexA]);) {
            // for each shape in body B
            for (let indexB = bodyB.shapes.length, shapeB; indexB--, (shapeB = bodyB.shapes[indexB]);) {
                // full SAT collision check
                if (sat["test" + shapeA.type + shapeB.type].call(
                    this,
                    bodyA.ancestor, // a reference to the object A
                    shapeA,
                    bodyB.ancestor,  // a reference to the object B
                    shapeB,
                    // clear response object before reusing
                    response.clear()) === true
                ) {

                    // set the shape index
                    response.indexShapeA = indexA;
                    response.indexShapeB = indexB;

                    return true;
                }
            }
        }
        return false;
    }

    /**
     * find all the collisions for the specified object using a broadphase algorithm
     * @ignore
     * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} objA - object to be tested for collision
     * @returns {boolean} in case of collision, false otherwise
     */
    collisions(objA) {
        let collisionCounter = 0;
        // retreive a list of potential colliding objects from the game world
        let candidates = this.world.broadphase.retrieve(objA);

        boundsA.addBounds(objA.getBounds(), true);
        boundsA.addBounds(objA.body.getBounds());

        candidates.forEach((objB) => {
            // check if both objects "should" collide
            if (this.shouldCollide(objA, objB)) {

                boundsB.addBounds(objB.getBounds(), true);
                boundsB.addBounds(objB.body.getBounds());

                // fast AABB check if both bounding boxes are overlaping
                if (boundsA.overlaps(boundsB)) {

                    if (this.collides(objA.body, objB.body)) {
                        // we touched something !
                        collisionCounter++;

                        // execute the onCollision callback
                        if (objA.onCollision && objA.onCollision(this.response, objB) !== false && objA.body.isStatic === false) {
                            objA.body.respondToCollision.call(objA.body, this.response);
                        }
                        if (objB.onCollision && objB.onCollision(this.response, objA) !== false && objB.body.isStatic === false) {
                            objB.body.respondToCollision.call(objB.body, this.response);
                        }
                    }
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
     *    let ray = new me.Line(
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
    rayCast(line, result = []) {
        let collisionCounter = 0;

        // retrieve a list of potential colliding objects from the game world
        let candidates = this.world.broadphase.retrieve(line);

        for (let i = candidates.length, objB; i--, (objB = candidates[i]);) {

            // fast AABB check if both bounding boxes are overlaping
            if (objB.body && line.getBounds().overlaps(objB.getBounds())) {

                // go trough all defined shapes in B (if any)
                const bLen = objB.body.shapes.length;
                if (objB.body.shapes.length === 0) {
                    continue;
                }

                let shapeA = line;

                // go through all defined shapes in B
                let indexB = 0;
                do {
                    let shapeB = objB.body.getShape(indexB);

                    // full SAT collision check
                    if (sat["test" + shapeA.type + shapeB.type]
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
}

export { Detector as default };
