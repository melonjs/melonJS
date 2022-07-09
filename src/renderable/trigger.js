import Renderable from "./renderable.js";
import collision from "./../physics/collision.js";
import Body from "./../physics/body.js";
import level from "./../level/level.js";
import game from "./../game.js";
import pool from "./../system/pooling.js";

/**
 * @classdesc
 * trigger an event when colliding with another object
 * @augments Renderable
 */
class Trigger extends Renderable {
    /**
     * @param {number} x the x coordinates of the trigger area
     * @param {number} y the y coordinates of the trigger area
     * @param {number} [settings.width] width of the trigger area
     * @param {number} [settings.height] height of the trigger area
     * @param {Rect[]|Polygon[]|Line[]|Ellipse[]} [settings.shapes] collision shape(s) that will trigger the event
     * @param {string} [settings.duration] Fade duration (in ms)
     * @param {string|Color} [settings.color] Fade color
     * @param {string} [settings.event="level"] the type of event to trigger (only "level" supported for now)
     * @param {string} [settings.to] level to load if level trigger
     * @param {string|Container} [settings.container] Target container. See {@link level.load}
     * @param {Function} [settings.onLoaded] Level loaded callback. See {@link level.load}
     * @param {boolean} [settings.flatten] Flatten all objects into the target container. See {@link level.load}
     * @param {boolean} [settings.setViewportBounds] Resize the viewport to match the level. See {@link level.load}
     * @example
     * me.game.world.addChild(new me.Trigger(
     *     x, y, {
     *         shapes: [new me.Rect(0, 0, 100, 100)],
     *         "duration" : 250,
     *         "color" : "#000",
     *         "to" : "mymap2"
     *     }
     * ));
     */
    constructor(x, y, settings) {
        // call the parent constructor
        super(x, y, settings.width || 0, settings.height || 0);

        // for backward compatibility
        this.anchorPoint.set(0, 0);

        this.fade = settings.fade;
        this.duration = settings.duration;
        this.fading = false;

        // Tiled Settings
        this.name = "Trigger";
        this.type = settings.type;
        this.id = settings.id;

        // a temp variable
        this.gotolevel = settings.to;

        // Collect the defined trigger settings
        this.triggerSettings = {
            // the default (and only for now) action
            event: "level"
        };

        [ "type", "container", "onLoaded", "flatten", "setViewportBounds", "to" ].forEach(function(property) {
            if (typeof settings[property] !== "undefined") {
                this.triggerSettings[property] = settings[property];
            }
        }.bind(this));

        // add and configure the physic body
        var shape = settings.shapes;
        if (typeof shape === "undefined") {
            shape = pool.pull("Polygon", 0, 0, [
                pool.pull("Vector2d", 0,          0),
                pool.pull("Vector2d", this.width, 0),
                pool.pull("Vector2d", this.width, this.height)
            ]);
        }
        this.body = new Body(this, shape);
        this.body.collisionType = collision.types.ACTION_OBJECT;
        // by default only collides with PLAYER_OBJECT
        this.body.setCollisionMask(collision.types.PLAYER_OBJECT);
        this.body.setStatic(true);
        this.resize(this.body.getBounds().width, this.body.getBounds().height);
    }

    /**
     * @ignore
     */
     getTriggerSettings() {
         // Lookup for the container instance
         if (typeof(this.triggerSettings.container) === "string") {
             this.triggerSettings.container = game.world.getChildByName(this.triggerSettings.container)[0];
         }
         return this.triggerSettings;
     }

    /**
     * @ignore
     */
    onFadeComplete() {
        level.load(this.gotolevel, this.getTriggerSettings());
        game.viewport.fadeOut(this.fade, this.duration);
    }

    /**
     * trigger this event
     * @name triggerEvent
     * @memberof Trigger
     * @protected
     */
    triggerEvent() {
        var triggerSettings = this.getTriggerSettings();

        if (triggerSettings.event === "level") {
            this.gotolevel = triggerSettings.to;
            // load a level
            //console.log("going to : ", to);
            if (this.fade && this.duration) {
                if (!this.fading) {
                    this.fading = true;
                    game.viewport.fadeIn(this.fade, this.duration,
                            this.onFadeComplete.bind(this));
                }
            } else {
                level.load(this.gotolevel, triggerSettings);
            }
        } else {
            throw new Error("Trigger invalid type");
        }
    }

    /**
     * onCollision callback, triggered in case of collision with this trigger
     * @name onCollision
     * @memberof Trigger
     * @param {ResponseObject} response the collision response object
     * @param {Renderable} other the other renderable touching this one (a reference to response.a or response.b)
     * @returns {boolean} true if the object should respond to the collision (its position and velocity will be corrected)
     */
    onCollision(response, other) { // eslint-disable-line no-unused-vars
        if (this.name === "Trigger") {
            this.triggerEvent.apply(this);
        }
        return false;
    }

};

export default Trigger;
