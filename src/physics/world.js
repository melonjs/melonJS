(function () {

    /**
     * an object representing the physic world, and responsible for managing and updating all childs and physics
     * @class
     * @extends me.Container
     * @memberOf me
     * @constructor
     * @param {Number} [x=0] position of the container (accessible via the inherited pos.x property)
     * @param {Number} [y=0] position of the container (accessible via the inherited pos.y property)
     * @param {Number} [w=me.game.viewport.width] width of the container
     * @param {Number} [h=me.game.viewport.height] height of the container
     */
    me.World = me.Container.extend({
        /**
         * @ignore
         */
        init : function (x, y, width, height) {
            // call the _super constructor
            this._super(me.Container, "init", [
                x || 0, y || 0,
                width || Infinity,
                height || Infinity,
                true
            ]);

            // world is the root container
            this.name = "rootContainer";

            // to mimic the previous behavior
            this.anchorPoint.set(0, 0);

            /**
             * world gravity
             * @public
             * @type me.Vector2d
             * @default <0,0.98>
             * @name gravity
             * @memberOf me.World
             */
            this.gravity = new me.Vector2d(0, 0.98);

            // initialize the collision system (the quadTree mostly)
            me.collision.init(this.getBounds());

            // reset the world container on the game reset signal
            me.event.subscribe(me.event.GAME_RESET, this.reset.bind(this));

        },

        /**
         * reset the game world
         * @name reset
         * @memberOf me.World
         * @function
         */
        reset : function () {
            // clear the quadtree
            me.collision.quadTree.clear();

            // reset the anchorPoint
            this.anchorPoint.set(0, 0);

            // call the _super constructor
            this._super(me.Container, "reset");
        },

        /**
         * update the game world
         * @name reset
         * @memberOf me.World
         * @function
         */
        update : function (dt) {
            // clear the quadtree
            me.collision.quadTree.clear();

            // insert the world container (children) into the quadtree
            me.collision.quadTree.insertContainer(this);

            // call the _super constructor
            return this._super(me.Container, "update", [dt]);
        }
    });
})();
