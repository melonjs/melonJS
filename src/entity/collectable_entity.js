import Entity from "./entity.js";
import collision from "./../physics/collision.js";

/**
 * @class
 * @extends me.Entity
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the entity object
 * @param {Number} y the y coordinates of the entity object
 * @param {Object} settings See {@link me.Entity}
 */
var CollectableEntity = Entity.extend({
    /**
     * @ignore
     */
    init : function (x, y, settings) {
        // call the super constructor
        this._super(Entity, "init", [x, y, settings]);
        this.body.collisionType = collision.types.COLLECTABLE_OBJECT;
    }
});

export default CollectableEntity;
