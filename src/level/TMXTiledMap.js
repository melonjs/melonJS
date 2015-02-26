/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {
    /**
     * a TMX Tile Map Object
     * Tiled QT 0.7.x format
     * @class
     * @memberOf me
     * @constructor
     * @param {String} levelId name of TMX map
     */
    me.TMXTileMap = me.Renderable.extend({
        // constructor
        init: function (levelId) {
            // map id
            this.levelId = levelId;

            // map default z order
            this.z = 0;

            /**
             * name of the tilemap
             * @public
             * @type String
             * @name me.TMXTileMap#name
             */
            this.name = null;

            /**
             * width of the tilemap in tiles
             * @public
             * @type Int
             * @name me.TMXTileMap#cols
             */
            this.cols = 0;

            /**
             * height of the tilemap in tiles
             * @public
             * @type Int
             * @name me.TMXTileMap#rows
             */
            this.rows = 0;

            /**
             * Tile width
             * @public
             * @type Int
             * @name me.TMXTileMap#tilewidth
             */
            this.tilewidth = 0;

            /**
             * Tile height
             * @public
             * @type Int
             * @name me.TMXTileMap#tileheight
             */
            this.tileheight = 0;

            // corresponding tileset for this map
            this.tilesets = null;

            // map layers
            this.mapLayers = [];

            // map Object
            this.objectGroups = [];

            // tilemap version
            this.version = "";

            // map type (orthogonal or isometric)
            this.orientation = "";

            // tileset(s)
            this.tilesets = null;

            // loading flag
            this.initialized = false;

            this._super(me.Renderable, "init", [0, 0, 0, 0]);
        },

        /**
         * Center the map on the viewport
         * @name me.TMXTileMap#moveToCenter
         * @public
         * @function
         */
        moveToCenter: function () {
            // center the map if smaller than the current viewport
            var width = me.game.viewport.width,
                height = me.game.viewport.height;
            if ((this.width < width) || (this.height < height)) {
                var shiftX =  ~~((width - this.width) / 2);
                var shiftY =  ~~((height - this.height) / 2);
                // update the map default position
                this.pos.set(
                    shiftX > 0 ? shiftX : 0,
                    shiftY > 0 ? shiftY : 0
                );
            }
        },

        /**
         * return the corresponding object group definition
         * @name me.TMXTileMap#getObjectGroupByName
         * @public
         * @function
         * @return {me.TMXObjectGroup} group
         */
        getObjectGroupByName : function (name) {
            var objectGroup = null;
            for (var i = this.objectGroups.length; i--;) {
                if (this.objectGroups[i].name === name) {
                    objectGroup = this.objectGroups[i];
                    break;
                }
            }
            return objectGroup;
        },

        /**
         * return all the existing object group definition
         * @name me.TMXTileMap#getObjectGroups
         * @public
         * @function
         * @return {me.TMXObjectGroup[]} Array of Groups
         */
        getObjectGroups : function () {
            return this.objectGroups;
        },

        /**
         * return all the existing layers
         * @name me.TMXTileMap#getLayers
         * @public
         * @function
         * @return {me.TMXLayer[]} Array of Layers
         */
        getLayers : function () {
            return this.mapLayers;
        },

        /**
         * return the specified layer object
         * @name me.TMXTileMap#getLayerByName
         * @public
         * @function
         * @param {String} name Layer Name
         * @return {me.TMXLayer} Layer Object
         */
        getLayerByName : function (name) {
            var layer = null;
            for (var i = this.mapLayers.length; i--;) {
                if (this.mapLayers[i].name === name) {
                    layer = this.mapLayers[i];
                    break;
                }
            }

            return layer;
        },

        /**
         * clear the tile at the specified position from all layers
         * @name me.TMXTileMap#clearTile
         * @public
         * @function
         * @param {Number} x x position
         * @param {Number} y y position
         */
        clearTile : function (x, y) {
            // add all layers
            for (var i = this.mapLayers.length; i--;) {
                // that are visible
                if (this.mapLayers[i] instanceof me.TMXLayer) {
                    this.mapLayers[i].clearTile(x, y);
                }
            }
        },

        /**
         * destroy function, clean all allocated objects
         * @ignore
         */
        destroy : function () {
            var i;

            if (this.initialized === true) {
                // reset/clear all layers
                for (i = this.mapLayers.length; i--;) {
                    this.mapLayers[i] = null;
                }
                // reset object groups
                for (i = this.objectGroups.length; i--;) {
                    // objectGroups is not added to the game world
                    // so we call the destroy function manually
                    this.objectGroups[i].destroy();
                    this.objectGroups[i] = null;
                }
                // call parent reset function
                this.tilesets = null;
                this.mapLayers.length = 0;
                this.objectGroups.length = 0;
                this.pos.set(0, 0);
                this.initialized = false;
            }
        }
    });
})();
