/**
 * find all the collisions for the specified object
 * @ignore
 * @param {Renderable} objA - object to be tested for collision
 * @param {ResponseObject} [response] - a user defined response object that will be populated if they intersect.
 * @returns {boolean} in case of collision, false otherwise
 */
export function collisionCheck(objA: Renderable, response?: ResponseObject): boolean;
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
export function rayCast(line: Line, result?: Array<Renderable>): Array<Renderable>;
import ResponseObject from "./response.js";
