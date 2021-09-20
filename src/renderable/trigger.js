import Renderable from "./renderable.js";
import collision from "./../physics/collision.js";
import Body from "./../physics/body.js";
import Rect from "./../shapes/rectangle.js";
import level from "./../level/level.js";
import game from "./../game.js";

/**
 * trigger an event when colliding with another object
 * @class
 * @extends me.Renderable
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the trigger area
 * @param {Number} y the y coordinates of the trigger area
 * @param {Number} [settings.width] width of the trigger area
 * @param {Number} [settings.height] height of the trigger area
 * @param {me.Rect[]|me.Polygon[]|me.Line[]|me.Ellipse[]} [settings.shapes] collision shape(s) that will trigger the event
 * @param {String} [settings.duration] Fade duration (in ms)
 * @param {String|me.Color} [settings.color] Fade color
 * @param {String} [settings.event="level"] the type of event to trigger (only "level" supported for now)
 * @param {String} [settings.to] level to load if level trigger
 * @param {String|me.Container} [settings.container] Target container. See {@link me.level.load}
 * @param {Function} [settings.onLoaded] Level loaded callback. See {@link me.level.load}
 * @param {Boolean} [settings.flatten] Flatten all objects into the target container. See {@link me.level.load}
 * @param {Boolean} [settings.setViewportBounds] Resize the viewport to match the level. See {@link me.level.load}
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
var Trigger = Renderable.extend({
    /**
     * @ignore
     */
    init : function (x, y, settings) {
        this._super(Renderable, "init", [x, y, settings.width || 0, settings.height || 0]);

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
        this.resize(this.body.getBounds().width, this.body.getBounds().height);

    },

    /**
     * @ignore
     */
     getTriggerSettings : function () {
         // Lookup for the container instance
         if (typeof(this.triggerSettings.container) === "string") {
             this.triggerSettings.container = game.world.getChildByName(this.triggerSettings.container)[0];
         }
         return this.triggerSettings;
     },

    /**
     * @ignore
     */
    onFadeComplete : function () {
        level.load(this.gotolevel, this.getTriggerSettings());
        game.viewport.fadeOut(this.fade, this.duration);
    },

    /**
     * go to the specified level
     * @name goTo
     * @memberOf me.LevelEntity
     * @function
     * @param {String} [level=this.nextlevel] name of the level to load
     * @protected
     */
    triggerEvent : function () {
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
    },

    /** @ignore */
    onCollision : function () {
        if (this.name === "Trigger") {
            this.triggerEvent.apply(this);
        }
        return false;
    }
});

export default Trigger;
