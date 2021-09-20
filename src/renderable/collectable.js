import Sprite from "./sprite.js";
import Body from "./../physics/body.js";
import Rect from "./../shapes/rectangle.js";
import collision from "./../physics/collision.js";

/**
 * a basic collectable helper class for immovable object (e.g. a coin)
 * @class
 * @extends me.Sprite
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the collectable
 * @param {Number} y the y coordinates of the collectable
 * @param {Object} settings See {@link me.Sprite}
 */
var Collectable = Sprite.extend({
    /**
     * @ignore
     */
    init : function (x, y, settings) {
        // call the super constructor
        this._super(Sprite, "init", [x, y, settings]);

        this.name = settings.name;
        this.type = settings.type;
        this.id = settings.id;

        // add and configure the physic body
        this.body = new Body(this, settings.shapes || new Rect(0, 0, this.width, this.height));
        this.body.collisionType = collision.types.COLLECTABLE_OBJECT;

        // Update anchorPoint
        if (settings.anchorPoint) {
            this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
        } else {
            // for backward compatibility
            this.anchorPoint.set(0, 0);
        }

    }
});

export default Collectable;
