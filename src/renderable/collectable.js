import Sprite from "./sprite.js";
import Body from "./../physics/body.js";
import Rect from "./../geometries/rectangle.js";
import collision from "./../physics/collision.js";

/**
 * @classdesc
 * a basic collectable helper class for immovable object (e.g. a coin)
 * @class Collectable
 * @augments me.Sprite
 * @memberof me
 * @param {number} x the x coordinates of the collectable
 * @param {number} y the y coordinates of the collectable
 * @param {object} settings See {@link me.Sprite}
 */

class Collectable extends Sprite {
    /**
     * @ignore
     */
    constructor(x, y, settings) {

        // call the super constructor
        super(x, y, settings);

        this.name = settings.name;
        this.type = settings.type;
        this.id = settings.id;

        // add and configure the physic body
        this.body = new Body(this, settings.shapes || new Rect(0, 0, this.width, this.height));
        this.body.collisionType = collision.types.COLLECTABLE_OBJECT;
        // by default only collides with PLAYER_OBJECT
        this.body.setCollisionMask(collision.types.PLAYER_OBJECT);
        this.body.setStatic(true);

        // Update anchorPoint
        if (settings.anchorPoint) {
            this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
        } else {
            // for backward compatibility
            this.anchorPoint.set(0, 0);
        }

    }

};

export default Collectable;
