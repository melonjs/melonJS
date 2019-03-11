(function () {

    /**
     * @class
     * @extends me.Entity
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinates of the entity object
     * @param {Number} y the y coordinates of the entity object
     * @param {Object} settings See {@link me.Entity}
     */
    me.CollectableEntity = me.Entity.extend({
        /**
         * @ignore
         */
        init : function (x, y, settings) {
            // call the super constructor
            this._super(me.Entity, "init", [x, y, settings]);
            this.body.collisionType = me.collision.types.COLLECTABLE_OBJECT;
        }
    });
})();
