import Renderable from "./renderable.js";
import collision from "./../physics/collision.js";
import Body from "./../physics/body.js";
import Rect from "./../geometries/rectangle.js";
import level from "./../level/level.js";
import { world, viewport } from "./../game.js";

/**
 * @classdesc
 * trigger an event when colliding with another object
 * @class Trigger
 * @augments me.Renderable
 * @memberof me
 * @param {number} x the x coordinates of the trigger area
 * @param {number} y the y coordinates of the trigger area
 * @param {number} [settings.width] width of the trigger area
 * @param {number} [settings.height] height of the trigger area
 * @param {me.Rect[]|me.Polygon[]|me.Line[]|me.Ellipse[]} [settings.shapes] collision shape(s) that will trigger the event
 * @param {string} [settings.duration] Fade duration (in ms)
 * @param {string|me.Color} [settings.color] Fade color
 * @param {string} [settings.event="level"] the type of event to trigger (only "level" supported for now)
 * @param {string} [settings.to] level to load if level trigger
 * @param {string|me.Container} [settings.container] Target container. See {@link me.level.load}
 * @param {Function} [settings.onLoaded] Level loaded callback. See {@link me.level.load}
 * @param {boolean} [settings.flatten] Flatten all objects into the target container. See {@link me.level.load}
 * @param {boolean} [settings.setViewportBounds] Resize the viewport to match the level. See {@link me.level.load}
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

class Trigger extends Renderable {

    /**
     * @ignore
     */
    constructor(x, y, settings) {

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


        // physic body to check for collision against
        this.body = new Body(this, settings.shapes || new Rect(0, 0, this.width, this.height));
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
             this.triggerSettings.container = world.getChildByName(this.triggerSettings.container)[0];
         }
         return this.triggerSettings;
     }

    /**
     * @ignore
     */
    onFadeComplete() {
        level.load(this.gotolevel, this.getTriggerSettings());
        viewport.fadeOut(this.fade, this.duration);
    }

    /**
     * trigger this event
     * @name triggerEvent
     * @memberof me.Trigger
     * @function
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
                    viewport.fadeIn(this.fade, this.duration,
                            this.onFadeComplete.bind(this));
                }
            } else {
                level.load(this.gotolevel, triggerSettings);
            }
        } else {
            throw new Error("Trigger invalid type");
        }
    }

    /** @ignore */
    onCollision() {
        if (this.name === "Trigger") {
            this.triggerEvent.apply(this);
        }
        return false;
    }

};

export default Trigger;
