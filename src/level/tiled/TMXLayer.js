import { createCanvas } from "./../../video/video.js";
import pool from "./../../system/pooling.js";
import * as TMXUtils from "./TMXUtils.js";
import Tile from "./TMXTile.js";
import Renderable from "./../../renderable/renderable.js";
import CanvasRenderer from "./../../video/canvas/canvas_renderer";

/**
 * Create required arrays for the given layer object
 * @ignore
 */
function initArray(rows, cols) {
    // initialize the array
    let array = new Array(cols);
    for (let col = 0; col < cols; col++) {
        array[col] = new Array(rows);
        for (let row = 0; row < rows; row++) {
            array[col][row] = null;
        }
    }
    return array;
}

/**
 * Set a tiled layer Data
 * @ignore
 */
function setLayerData(layer, bounds, data) {
    let idx = 0;
    let width, height;

    // layer provide rows and cols, chunk width and height
    if (typeof bounds.rows === "undefined") {
        width = bounds.width;
        height = bounds.height;
    } else {
        width = bounds.cols;
        height = bounds.rows;
    }
    // set everything
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // get the value of the gid
            const gid = data[idx++];
            // fill the array
            if (gid !== 0) {
                // add a new tile to the layer
                layer.layerData[x + bounds.x][y + bounds.y] = layer.getTileById(gid, x + bounds.x, y + bounds.y);
            }
        }
    }
}

/**
 * @classdesc
 * a TMX Tile Layer Object
 * Tiled QT 0.7.x format
 * @augments Renderable
 */
export default class TMXLayer extends Renderable {
    /**
     * @param {object} map - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
     * @param {object} data - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
     * @param {number} tilewidth - width of each tile in pixels
     * @param {number} tileheight - height of each tile in pixels
     * @param {string} orientation - "isometric" or "orthogonal"
     * @param {TMXTilesetGroup} tilesets - tileset as defined in Tiled
     * @param {number} z - z-index position
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
         * Horizontal layer offset in tiles
         * @default 0
         * @type {number}
         */
        this.x = 0;

        /**
         * Vertical layer offset in tiles
         * @default 0
         * @type {number}
         */
        this.y = 0;

        /**
         * The Layer corresponding Tilesets
         * @type {TMXTilesetGroup}
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
        for (let i = 0; i < this.tilesets.length; i++) {
            const tileset = this.tilesets.getTilesetByIndex(i);
            this.maxTileSize.width = Math.max(this.maxTileSize.width, tileset.tilewidth);
            this.maxTileSize.height = Math.max(this.maxTileSize.height, tileset.tileheight);
        }

        /**
         * All animated tilesets in this layer
         * @type {TMXTileset[]}
         */
        this.animatedTilesets = [];

        /**
         * Layer contains tileset animations
         * @type {boolean}
         */
        this.isAnimated = false;

        /**
         * the order in which tiles on orthogonal tile layers are rendered.
         * (valid values are "left-down", "left-up", "right-down", "right-up")
         * @type {string}
         * @default "right-down"
         */
        this.renderorder = data.renderorder || "right-down";

        /**
         * the layer class
         * @type {string}
         */
        this.class = data.class;

        // for displaying order
        this.pos.z = z;

        // tiled default coordinates are top-left
        this.anchorPoint.set(0, 0);

        // additional TMX flags
        this.name = data.name;
        this.cols = +data.width;
        this.rows = +data.height;

        // layer opacity
        let visible = typeof(data.visible) !== "undefined" ? +data.visible : 1;
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

        // set a renderer
        this.setRenderer(map.getRenderer());


        // initialize the data array
        this.layerData = initArray(this.rows, this.cols);

        if (map.infinite === 0) {
            // initialize and set the layer data
            setLayerData(
                this,
                this,
                TMXUtils.decode(
                    data.data,
                    data.encoding,
                    data.compression
                )
            );
        } else if (map.infinite === 1) {
            // infinite map, initialize per chunk
            data.chunks.forEach((chunk) => {
                // initialize and set the layer data
                setLayerData(
                    this,
                    chunk,
                    TMXUtils.decode(
                        chunk.data,
                        data.encoding,
                        data.compression
                    )
                );
            });
        }

    }

    // called when the layer is added to the game world or a container
    onActivateEvent() {

        if (this.animatedTilesets === undefined) {
            this.animatedTilesets = [];
        }

        if (this.tilesets) {
            let tileset = this.tilesets.tilesets;
            for (let i = 0; i < tileset.length; i++) {
                if (tileset[i].isAnimated) {
                    this.animatedTilesets.push(tileset[i]);
                }
            }
        }

        this.isAnimated = this.animatedTilesets.length > 0;

        // check for the correct rendering method
        if (typeof this.preRender === "undefined" && this.isAnimated === false) {
            this.preRender = this.ancestor.getRootAncestor().preRender;
        } else {
            // Force pre-render off when tileset animation is used
            this.preRender = false;
        }

        // if pre-rendering method is use, create an offline canvas/renderer
        if ((this.preRender === true) && (!this.canvasRenderer)) {
            this.canvasRenderer = new CanvasRenderer({
                canvas : createCanvas(this.width, this.height),
                width : this.width,
                heigth : this.height,
                transparent : true
            });
            // pre render the layer on the canvas
            this.getRenderer().drawTileLayer(this.canvasRenderer, this, this);
        }

        this.isDirty = true;
    }

    // called when the layer is removed from the game world or a container
    onDeactivateEvent() {
        // clear all allocated objects
        //this.layerData = undefined;
        this.animatedTilesets = undefined;
    }

    /**
     * Set the TMX renderer for this layer object
     * @param {TMXRenderer} renderer
     * @example
     * // use the parent map default renderer
     * let layer = new me.TMXLayer(...);
     * layer.setRenderer(map.getRenderer());
     */
    setRenderer(renderer) {
        this.renderer = renderer;
        this.isDirty = true;
    }

    /**
     * Return the layer current renderer object
     * @returns {TMXRenderer} renderer
     */
    getRenderer() {
        return this.renderer;
    }

    /**
     * Return the TileId of the Tile at the specified position
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {number} TileId or null if there is no Tile at the given position
     */
    getTileId(x, y) {
        let tile = this.getTile(x, y);
        return (tile ? tile.tileId : null);
    }

    /**
     * Return the Tile object at the specified position
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
     * @example
     * // get the TMX Map Layer called "Front layer"
     * let layer = me.game.world.getChildByName("Front Layer")[0];
     * // get the tile object corresponding to the latest pointer position
     * let tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
     */
    getTile(x, y) {
        let tile = null;

        if (this.contains(x, y)) {
            let coord = this.getRenderer().pixelToTileCoords(x, y, pool.pull("Vector2d"));
            tile = this.cellAt(coord.x, coord.y);
            pool.push(coord);
        }
        return tile;
    }

    /**
     * assign the given Tile object to the specified position
     * @param {Tile} tile - the tile object to be assigned
     * @param {number} x - x coordinate (in world/pixels coordinates)
     * @param {number} y - y coordinate (in world/pixels coordinates)
     * @returns {Tile} the tile object
     */
    setTile(tile, x, y) {
        this.layerData[x][y] = tile;
        this.isDirty = true;
        return tile;
    }

    /**
     * return a new the Tile object corresponding to the given tile id
     * @param {number} tileId - tileId
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {Tile} the tile object
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
     * @param {number} x - x position of the tile (in Tile unit)
     * @param {number} y - x position of the tile (in Tile unit)
     * @param {number} [boundsCheck=true] - check first if within the layer bounds
     * @returns {Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
     * @example
     * // return the first tile at offset 0, 0
     * let tile = layer.cellAt(0, 0);
     */
    cellAt(x, y, boundsCheck) {
        let _x = ~~x;
        let _y = ~~y;

        let renderer = this.getRenderer();
        // boundsCheck only used internally by the tiled renderer, when the layer bound check was already done
        if (boundsCheck === false || (_x >= 0 && _x < renderer.cols && _y >= 0 && _y < renderer.rows)) {
            return this.layerData[_x][_y];
        } else {
            return null;
        }
    }

    /**
     * clear the tile at the specified position
     * @param {number} x - X coordinate (in map coordinates: row/column)
     * @param {number} y - Y coordinate (in map coordinates: row/column)
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
        this.isDirty = true;
    }

    /**
     * update animations in a tileset layer
     * @ignore
     */
    update(dt) {
        let result = this.isDirty;
        if (this.isAnimated) {
            for (let i = 0; i < this.animatedTilesets.length; i++) {
                result = this.animatedTilesets[i].update(dt) || result;
            }
        }
        return result;
    }

    /**
     * draw a tileset layer
     * @ignore
     */
    draw(renderer, rect) {
        // use the offscreen canvas
        if (this.preRender) {
            const width = Math.min(rect.width, this.width);
            const height = Math.min(rect.height, this.height);

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
}

