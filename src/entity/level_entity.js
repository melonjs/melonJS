/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {

    /**
     * @class
     * @extends me.Entity
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinates of the object
     * @param {Number} y the y coordinates of the object
     * @param {Object} settings See {@link me.Entity}
     * @param {String} [settings.duration] Fade duration (in ms)
     * @param {String|me.Color} [settings.color] Fade color
     * @param {String} [settings.to] TMX level to load
     * @param {String|me.Container} [settings.container] Target container. See {@link me.levelDirector.loadLevel}
     * @param {Function} [settings.onLoaded] Level loaded callback. See {@link me.levelDirector.loadLevel}
     * @param {Boolean} [settings.flatten] Flatten all objects into the target container. See {@link me.levelDirector.loadLevel}
     * @param {Boolean} [settings.setViewportBounds] Resize the viewport to match the level. See {@link me.levelDirector.loadLevel}
     * @example
     * me.game.world.addChild(new me.LevelEntity(
     *     x, y, {
     *         "duration" : 250,
     *         "color" : "#000",
     *         "to" : "mymap2"
     *     }
     * ));
     */
    me.LevelEntity = me.Entity.extend(
    /** @scope me.LevelEntity.prototype */
    {
        /** @ignore */
        init : function (x, y, settings) {
            this._super(me.Entity, "init", [x, y, settings]);

            this.nextlevel = settings.to;

            this.fade = settings.fade;
            this.duration = settings.duration;
            this.fading = false;

            this.name = "levelEntity";

            // a temp variable
            this.gotolevel = settings.to;

            // Collect the defined level settings
            this.loadLevelSettings = {};
            [ "container", "onLoaded", "flatten", "setViewportBounds" ].forEach(function (v) {
                if (typeof(settings[v]) !== "undefined") {
                    this.loadLevelSettings[v] = settings[v];
                }
            }.bind(this));

            this.body.collisionType = me.collision.types.ACTION_OBJECT;
        },

        /**
         * @ignore
         */
         getlevelSettings : function () {
             // Lookup for the container instance
             if (typeof(this.loadLevelSettings.container) === "string") {
                 this.loadLevelSettings.container = me.game.world.getChildByName(this.loadLevelSettings.container)[0];
             }
             return this.loadLevelSettings;
         },

        /**
         * @ignore
         */
        onFadeComplete : function () {

            me.levelDirector.loadLevel(this.gotolevel, this.getlevelSettings());
            me.game.viewport.fadeOut(this.fade, this.duration);
        },

        /**
         * go to the specified level
         * @name goTo
         * @memberOf me.LevelEntity
         * @function
         * @param {String} [level=this.nextlevel] name of the level to load
         * @protected
         */
        goTo : function (level) {
            this.gotolevel = level || this.nextlevel;
            // load a level
            //console.log("going to : ", to);
            if (this.fade && this.duration) {
                if (!this.fading) {
                    this.fading = true;
                    me.game.viewport.fadeIn(this.fade, this.duration,
                            this.onFadeComplete.bind(this));
                }
            } else {
                me.levelDirector.loadLevel(this.gotolevel, this.getlevelSettings());
            }
        },

        /** @ignore */
        onCollision : function () {
            if (this.name === "levelEntity") {
                this.goTo.apply(this);
            }
            return false;
        }
    });
})();
