import { createCanvas } from "./../../video/video.js";
import pool from "./../../system/pooling.js";
import * as TMXUtils from "./TMXUtils.js";
import Tile from "./TMXTile.js";
import Renderable from "./../../renderable/renderable.js";
import CanvasRenderer from "./../../video/canvas/canvas_renderer";
import { world } from "./../../game.js";

/**
 * Create required arrays for the given layer object
 * @ignore
 */
function initArray(layer) {
    // initialize the array
    layer.layerData = new Array(layer.cols);
    for (var x = 0; x < layer.cols; x++) {
        layer.layerData[x] = new Array(layer.rows);
        for (var y = 0; y < layer.rows; y++) {
            layer.layerData[x][y] = null;
        }
    }
}

/**
 * Set a tiled layer Data
 * @ignore
 */
function setLayerData(layer, data) {
    var idx = 0;
    // initialize the data array
    initArray(layer);
    // set everything
    for (var y = 0; y < layer.rows; y++) {
        for (var x = 0; x < layer.cols; x++) {
            // get the value of the gid
            var gid = data[idx++];
            // fill the array
            if (gid !== 0) {
                // add a new tile to the layer
                layer.layerData[x][y] = layer.getTileById(gid, x, y);
            }
        }
    }
}

/**
 * preRender a tile layer using the given renderer
 * @ignore
 */
function preRenderLayer(layer, renderer) {
    // set everything
    for (var y = 0; y < layer.rows; y++) {
        for (var x = 0; x < layer.cols; x++) {
            // get the value of the gid
            var tile = layer.layerData[x][y];
            // draw the tile if defined
            if (tile instanceof Tile) {
                // add a new tile to the layer
                layer.getRenderer().drawTile(renderer, x, y, tile);
            }
        }
    }
}

/**
 * a TMX Tile Layer Object
 * Tiled QT 0.7.x format
 * @class
 * @augments me.Renderable
 * @memberof me
 * @param {object} map layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
 * @param {object} data layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
 * @param {number} tilewidth width of each tile in pixels
 * @param {number} tileheight height of each tile in pixels
 * @param {string} orientation "isometric" or "orthogonal"
 * @param {me.TMXTilesetGroup} tilesets tileset as defined in Tiled
 * @param {number} z z-index position
 */
class TMXLayer extends Renderable {
    /**
     * @ignore
     */
    constructor(map, data, tilewidth, tileheight, orientation, tilesets, z) {
        // super constructor
        super(0, 0, 0, 0);

        // tile width & height
        this.tilewidth = data.tilewidth || tilewidth;
        this.tileheight = data.tileheight || tileheight;

        // layer orientation
        this.orientation = orientation;

        /**
         * The Layer corresponding Tilesets
         * @public
         * @type {me.TMXTilesetGroup}
         * @name me.TMXLayer#tilesets
         */
        this.tilesets = tilesets;

        // the default tileset
        // XXX: Is this even used?
        this.tileset = (this.tilesets ? this.tilesets.getTilesetByIndex(0) : null);

        // Biggest tile size to draw
        this.maxTileSize = {
            "width" : 0,
            "height" : 0
        };
        for (var i = 0; i < this.tilesets.length; i++) {
            var tileset = this.tilesets.getTilesetByIndex(i);
            this.maxTileSize.width = Math.max(this.maxTileSize.width, tileset.tilewidth);
            this.maxTileSize.height = Math.max(this.maxTileSize.height, tileset.tileheight);
        }

        /**
         * All animated tilesets in this layer
         * @ignore
         * @type {me.TMXTileset[]}
         * @name me.TMXLayer#animatedTilesets
         */
        this.animatedTilesets = [];

        /**
         * Layer contains tileset animations
         * @public
         * @type {boolean}
         * @name me.TMXLayer#isAnimated
         */
        this.isAnimated = false;

        /**
         * the order in which tiles on orthogonal tile layers are rendered.
         * (valid values are "left-down", "left-up", "right-down", "right-up")
         * @public
         * @type {string}
         * @default "right-down"
         * @name me.TMXLayer#renderorder
         */
        this.renderorder = data.renderorder || "right-down";

        // for displaying order
        this.pos.z = z;

        // tiled default coordinates are top-left
        this.anchorPoint.set(0, 0);

        // additional TMX flags
        this.name = data.name;
        this.cols = +data.width;
        this.rows = +data.height;

        // layer opacity
        var visible = typeof(data.visible) !== "undefined" ? +data.visible : 1;
        this.setOpacity(visible ? +data.opacity : 0);

        // layer tint
        if (typeof data.tintcolor === "string") {
            // Tiled provides #RRGGBB or #AARRGGBB
            this.tint.parseHex(data.tintcolor, true);
        }

        // layer "real" size
        if (this.orientation === "isometric") {
            this.width = (this.cols + this.rows) * (this.tilewidth / 2);
            this.height = (this.cols + this.rows) * (this.tileheight / 2);
        } else {
            this.width = this.cols * this.tilewidth;
            this.height = this.rows * this.tileheight;
        }

        // check if we have any user-defined properties
        TMXUtils.applyTMXProperties(this, data);

        // check for the correct rendering method
        if (typeof (this.preRender) === "undefined") {
            this.preRender = world.preRender;
        }

        // set a renderer
        this.setRenderer(map.getRenderer());


        // initialize and set the layer data
        setLayerData(this,
            TMXUtils.decode(
                data.data,
                data.encoding,
                data.compression
            )
        );
    }


    // called when the layer is added to the game world or a container
    onActivateEvent() {

        if (this.animatedTilesets === undefined) {
            this.animatedTilesets = [];
        }

        if (this.tilesets) {
            var tileset = this.tilesets.tilesets;
            for (var i = 0; i < tileset.length; i++) {
                if (tileset[i].isAnimated) {
                    this.animatedTilesets.push(tileset[i]);
                }
            }
        }

        this.isAnimated = this.animatedTilesets.length > 0;

        // Force pre-render off when tileset animation is used
        if (this.isAnimated) {
            this.preRender = false;
        }

        // Resize the bounding rect
        this.getBounds().addBounds(this.getRenderer().getBounds(), true);
        this.getBounds().shift(this.pos);

        // if pre-rendering method is use, create an offline canvas/renderer
        if ((this.preRender === true) && (!this.canvasRenderer)) {
            this.canvasRenderer = new CanvasRenderer({
                canvas : createCanvas(this.width, this.height),
                widht : this.width,
                heigth : this.height,
                transparent : true
            });
            preRenderLayer(this, this.canvasRenderer);
        }
    }

    // called when the layer is removed from the game world or a container
    onDeactivateEvent() {
        // clear all allocated objects
        //this.layerData = undefined;
        this.animatedTilesets = undefined;
    }

    /**
     * Set the TMX renderer for this layer object
     * @name setRenderer
     * @memberof me.TMXLayer
     * @public
     * @function
     * @param {me.TMXRenderer} renderer
     * @example
     * // use the parent map default renderer
     * var layer = new me.TMXLayer(...);
     * layer.setRenderer(map.getRenderer());
     */
    setRenderer(renderer) {
        this.renderer = renderer;
    }

    /**
     * Return the layer current renderer object
     * @name getRenderer
     * @memberof me.TMXLayer
     * @public
     * @function
     * @returns {me.TMXRenderer} renderer
     */
    getRenderer() {
        return this.renderer;
    }


    /**
     * Return the TileId of the Tile at the specified position
     * @name getTileId
     * @memberof me.TMXLayer
     * @public
     * @function
     * @param {number} x X coordinate (in world/pixels coordinates)
     * @param {number} y Y coordinate (in world/pixels coordinates)
     * @returns {number} TileId or null if there is no Tile at the given position
     */
    getTileId(x, y) {
        var tile = this.getTile(x, y);
        return (tile ? tile.tileId : null);
    }

    /**
     * Return the Tile object at the specified position
     * @name getTile
     * @memberof me.TMXLayer
     * @public
     * @function
     * @param {number} x X coordinate (in world/pixels coordinates)
     * @param {number} y Y coordinate (in world/pixels coordinates)
     * @returns {me.Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
     * @example
     * // get the TMX Map Layer called "Front layer"
     * var layer = me.game.world.getChildByName("Front Layer")[0];
     * // get the tile object corresponding to the latest pointer position
     * var tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
     */
    getTile(x, y) {
        var tile = null;

        if (this.contains(x, y)) {
            var coord = this.getRenderer().pixelToTileCoords(x, y, pool.pull("Vector2d"));
            tile = this.cellAt(coord.x, coord.y);
            pool.push(coord);
        }
        return tile;
    }

    /**
     * assign the given Tile object to the specified position
     * @name getTile
     * @memberof me.TMXLayer
     * @public
     * @function
     * @param {me.Tile} tile the tile object to be assigned
     * @param {number} x x coordinate (in world/pixels coordinates)
     * @param {number} y y coordinate (in world/pixels coordinates)
     * @returns {me.Tile} the tile object
     */
    setTile(tile, x, y) {
        this.layerData[x][y] = tile;
        return tile;
    }

    /**
     * return a new the Tile object corresponding to the given tile id
     * @name setTile
     * @memberof me.TMXLayer
     * @public
     * @function
     * @param {number} tileId tileId
     * @param {number} x X coordinate (in world/pixels coordinates)
     * @param {number} y Y coordinate (in world/pixels coordinates)
     * @returns {me.Tile} the tile object
     */
    getTileById(tileId, x, y) {
        if (!this.tileset.contains(tileId)) {
            // look for the corresponding tileset
            this.tileset = this.tilesets.getTilesetByGid(tileId);
        }
        return new Tile(x, y, tileId, this.tileset);
    }

    /**
     * Return the Tile object at the specified tile coordinates
     * @name cellAt
     * @memberof me.TMXLayer
     * @public
     * @function
     * @param {number} x x position of the tile (in Tile unit)
     * @param {number} y x position of the tile (in Tile unit)
     * @param {number} [boundsCheck=true] check first if within the layer bounds
     * @returns {me.Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
     * @example
     * // return the first tile at offset 0, 0
     * var tile = layer.cellAt(0, 0);
     */
    cellAt(x, y, boundsCheck) {
        var _x = ~~x;
        var _y = ~~y;

        var renderer = this.getRenderer();
        // boundsCheck only used internally by the tiled renderer, when the layer bound check was already done
        if (boundsCheck === false || (_x >= 0 && _x < renderer.cols && _y >= 0 && _y < renderer.rows)) {
            return this.layerData[_x][_y];
        } else {
            return null;
        }
    }

    /**
     * clear the tile at the specified position
     * @name clearTile
     * @memberof me.TMXLayer
     * @public
     * @function
     * @param {number} x X coordinate (in map coordinates: row/column)
     * @param {number} y Y coordinate (in map coordinates: row/column)
     * @example
     * me.game.world.getChildByType(me.TMXLayer).forEach(function(layer) {
     *     // clear all tiles at the given x,y coordinates
     *     layer.clearTile(x, y);
     * });
     */
    clearTile(x, y) {
        // clearing tile
        this.layerData[x][y] = null;
        // erase the corresponding area in the canvas
        if (this.preRender) {
            this.canvasRenderer.clearRect(x * this.tilewidth, y * this.tileheight, this.tilewidth, this.tileheight);
        }
    }

    /**
     * update animations in a tileset layer
     * @ignore
     */
    update(dt) {
        if (this.isAnimated) {
            var result = false;
            for (var i = 0; i < this.animatedTilesets.length; i++) {
                result = this.animatedTilesets[i].update(dt) || result;
            }
            return result;
        }

        return false;
    }

    /**
     * draw a tileset layer
     * @ignore
     */
    draw(renderer, rect) {
        // use the offscreen canvas
        if (this.preRender) {
            var width = Math.min(rect.width, this.width);
            var height = Math.min(rect.height, this.height);

            // draw using the cached canvas
            renderer.drawImage(
                this.canvasRenderer.getCanvas(),
                rect.pos.x, rect.pos.y, // sx,sy
                width, height,          // sw,sh
                rect.pos.x, rect.pos.y, // dx,dy
                width, height           // dw,dh
            );
        }
        // dynamically render the layer
        else {
            // draw the layer
            this.getRenderer().drawTileLayer(renderer, this, rect);
        }
    }
};

export default TMXLayer;
