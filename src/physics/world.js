import Vector2d from "./../math/vector2.js";
import * as event from "./../system/event.js";
import QuadTree from "./quadtree.js";
import Container from "./../renderable/container.js";
import collision from "./collision.js";
import { collisionCheck } from "./detector.js";
import state from "./../state/state.js";

/**
 * @classdesc
 * an object representing the physic world, and responsible for managing and updating all childs and physics
 * @augments Container
 */
class World extends Container {
    /**
     * @param {number} [x=0] position of the container (accessible via the inherited pos.x property)
     * @param {number} [y=0] position of the container (accessible via the inherited pos.y property)
     * @param {number} [width=game.viewport.width] width of the container
     * @param {number} [height=game.viewport.height] height of the container
     */
    constructor(x = 0, y = 0, width = Infinity, height = Infinity) {
        // call the super constructor
        super(x, y, width, height, true);

        // world is the root container
        this.name = "rootContainer";

        // to mimic the previous behavior
        this.anchorPoint.set(0, 0);

        /**
         * the application (game) this physic world belong to
         * @public
         * @type {Application}
         */
        this.app = null;

        /**
         * the rate at which the game world is updated,
         * may be greater than or lower than the display fps
         * @public
         * @type {Vector2d}
         * @default 60
         * @name fps
         * @memberof World
         * @see timer.maxfps
         */
        this.fps = 60;

        /**
         * world gravity
         * @public
         * @type {Vector2d}
         * @default <0,0.98>
         * @name gravity
         * @memberof World
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
         * @type {boolean}
         * @default false
         * @memberof World
         */
        this.preRender = false;

        /**
         * the active physic bodies in this simulation
         * @name bodies
         * @memberof World
         * @public
         * @type {Set<Body>}
         */
        this.bodies = new Set();

        /**
         * the instance of the game world quadtree used for broadphase
         * @name broadphase
         * @memberof World
         * @public
         * @type {QuadTree}
         */
        this.broadphase = new QuadTree(this, this.getBounds().clone(), collision.maxChildren, collision.maxDepth);

        // reset the world container on the game reset signal
        event.on(event.GAME_RESET, this.reset, this);

        // update the broadband world bounds if a new level is loaded
        event.on(event.LEVEL_LOADED, () => {
            // reset the quadtree
            this.broadphase.clear(this.getBounds());
        });
    }

    /**
     * reset the game world
     * @name reset
     * @memberof World
     */
    reset() {
        // clear the quadtree
        this.broadphase.clear();

        // reset the anchorPoint
        this.anchorPoint.set(0, 0);

        // call the parent method
        super.reset();

        // empty the list of active physic bodies
        // Note: this should be empty already when calling the parent method
        this.bodies.clear();
    }

    /**
     * Add a physic body to the game world
     * @name addBody
     * @memberof World
     * @see Container.addChild
     * @param {Body} body
     * @returns {World} this game world
     */
    addBody(body) {
        //add it to the list of active body
        this.bodies.add(body);
        return this;
    }

    /**
     * Remove a physic body from the game world
     * @name removeBody
     * @memberof World
     * @see Container.removeChild
     * @param {Body} body
     * @returns {World} this game world
     */
    removeBody(body) {
        //remove from the list of active body
        this.bodies.delete(body);
        return this;
    }

    /**
     * Apply gravity to the given body
     * @name bodyApplyVelocity
     * @memberof World
     * @private
     * @param {Body} body
     */
    bodyApplyGravity(body) {
        // apply gravity to the current velocity
        if (!body.ignoreGravity && body.gravityScale !== 0) {
            var gravity = this.gravity;

            // apply gravity if defined
            body.force.x += (body.mass * gravity.x) * body.gravityScale;
            body.force.y += (body.mass * gravity.y) * body.gravityScale;
        }
    }

    /**
     * update the game world
     * @name reset
     * @memberof World
     * @param {number} dt the time passed since the last frame update
     * @returns {boolean} true if the word is dirty
     */
    update(dt) {
        var isPaused = state.isPaused();

        // clear the quadtree
        this.broadphase.clear();

        // insert the world container (children) into the quadtree
        this.broadphase.insertContainer(this);

        // iterate through all bodies
        this.bodies.forEach((body) => {
            if (!body.isStatic) {
                var ancestor = body.ancestor;
                // if the game is not paused, and ancestor can be updated
                if (!(isPaused && (!ancestor.updateWhenPaused)) &&
                   (ancestor.inViewport || ancestor.alwaysUpdate)) {
                    // apply gravity to this body
                    this.bodyApplyGravity(body);
                    // body update function (this moves it)
                    if (body.update(dt) === true) {
                        // mark ancestor as dirty
                        ancestor.isDirty = true;
                    };
                    // handle collisions against other objects
                    collisionCheck(ancestor);
                    // clear body force
                    body.force.set(0, 0);
                }
            }
        });

        // call the super constructor
        return super.update(dt);
    }

};

export default World;
