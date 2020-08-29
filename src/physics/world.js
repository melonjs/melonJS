import Vector2d from "./../math/vector2.js";
import game from "./../game.js";
import event from "./../system/event.js";
import QuadTree from "./quadtree.js";
import Container from "./../renderable/container.js";
import collision from "./collision.js";

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
var World = Container.extend({
    /**
     * @ignore
     */
    init : function (x, y, width, height) {
        // call the _super constructor
        this._super(Container, "init", [
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
         * the rate at which the game world is updated,
         * may be greater than or lower than the display fps
         * @public
         * @type me.Vector2d
         * @default 60
         * @name fps
         * @memberOf me.World
         * @see me.timer.maxfps
         */
        this.fps = 60;

        /**
         * world gravity
         * @public
         * @type me.Vector2d
         * @default <0,0.98>
         * @name gravity
         * @memberOf me.World
         */
        this.gravity = new Vector2d(0, 0.98);

        /**
         * Specify the rendering method for tile layers. <br>
         * if false visible part of the layers are rendered dynamically,<br>
         * if true the entire layers are first rendered into an offscreen canvas.<br>
         * the "best" rendering method depends of your game
         * (amount of layer, layer size, amount of tiles per layer, etc.)<br>
         * note : rendering method is also configurable per layer by adding this
         * property to your layer (in Tiled).
         * @type {Boolean}
         * @default false
         * @memberOf me.World
         */
        this.preRender = false;

        /**
         * the instance of the game world quadtree used for broadphase
         * @name broadphase
         * @memberOf me.World
         * @public
         * @type {me.QuadTree}
         */
        this.broadphase = new QuadTree(this.getBounds().clone(), collision.maxChildren, collision.maxDepth);

        // reset the world container on the game reset signal
        event.subscribe(event.GAME_RESET, this.reset.bind(this));

        // update the broadband world bounds if a new level is loaded
        event.subscribe(event.LEVEL_LOADED, function () {
            // reset the quadtree
            game.world.broadphase.clear(game.world.getBounds());
        });
    },

    /**
     * reset the game world
     * @name reset
     * @memberOf me.World
     * @function
     */
    reset : function () {
        // clear the quadtree
        this.broadphase.clear();

        // reset the anchorPoint
        this.anchorPoint.set(0, 0);

        // call the _super constructor
        this._super(Container, "reset");
    },

    /**
     * update the game world
     * @name reset
     * @memberOf me.World
     * @function
     */
    update : function (dt) {
        // clear the quadtree
        this.broadphase.clear();

        // insert the world container (children) into the quadtree
        this.broadphase.insertContainer(this);

        // call the _super constructor
        return this._super(Container, "update", [dt]);
    }
});

export default World;
