/**
 * @classdesc
 * a basic collectable helper class for immovable object (e.g. a coin)
 * @augments Sprite
 */
export default class Collectable extends Sprite {
    /**
     * @param {number} x - the x coordinates of the collectable
     * @param {number} y - the y coordinates of the collectable
     * @param {object} settings - See {@link Sprite}
     */
    constructor(x: number, y: number, settings: object);
    name: any;
    type: any;
    id: any;
}
import Sprite from "./sprite.js";
