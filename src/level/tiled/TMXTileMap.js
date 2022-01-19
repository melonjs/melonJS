import pool from "./../../system/pooling.js";
import * as event from "./../../system/event.js";
import { viewport } from "./../../game.js";
import collision from "./../../physics/collision.js";
import Body from "./../../physics/body.js";
import TMXOrthogonalRenderer from "./renderer/TMXOrthogonalRenderer.js";
import TMXIsometricRenderer from "./renderer/TMXIsometricRenderer.js";
import TMXHexagonalRenderer from "./renderer/TMXHexagonalRenderer.js";
import TMXStaggeredRenderer from "./renderer/TMXStaggeredRenderer.js";
import TMXTileset from "./TMXTileset.js";
import TMXTilesetGroup from "./TMXTilesetGroup.js";
import TMXGroup from "./TMXGroup.js";
import TMXLayer from "./TMXLayer.js";
import { applyTMXProperties } from "./TMXUtils.js";
import Renderable from "./../../renderable/renderable.js";
import Container from "./../../renderable/container.js";
import Rect from "./../../geometries/rectangle.js";

// constant to identify the collision object layer
var COLLISION_GROUP = "collision";

/**
 * set a compatible renderer object
 * for the specified map
 * @ignore
 */
function getNewDefaultRenderer(map) {
    switch (map.orientation) {
        case "orthogonal":
            return new TMXOrthogonalRenderer(map);

        case "isometric":
            return new TMXIsometricRenderer(map);

        case "hexagonal":
            return new TMXHexagonalRenderer(map);

        case "staggered":
            return new TMXStaggeredRenderer(map);

        // if none found, throw an exception
        default:
            throw new Error(map.orientation + " type TMX Tile Map not supported!");
    }
}

/**
 * read the layer Data
 * @ignore
 */
function readLayer(map, data, z) {
    return new TMXLayer(map, data, map.tilewidth, map.tileheight, map.orientation, map.tilesets, z);
}

/**
 * read the Image Layer Data
 * @ignore
 */
function readImageLayer(map, data, z) {
    // Normalize properties
    applyTMXProperties(data.properties, data);

    // create the layer
    var imageLayer = pool.pull("ImageLayer",
        // x/y is deprecated since 0.15 and replace by offsetx/y
        +data.offsetx || +data.x || 0,
        +data.offsety || +data.y || 0,
        Object.assign({
            name: data.name,
            image: data.image,
            ratio : pool.pull("Vector2d", +data.parallaxx || 1.0, +data.parallaxy || 1.0),
            // convert to melonJS color format (note: this should be done earlier when parsing data)
            tint : typeof (data.tintcolor) !== "undefined" ? (pool.pull("Color")).parseHex(data.tintcolor, true) : undefined,
            z: z
        }, data.properties)
    );


    // set some additional flags
    var visible = typeof(data.visible) !== "undefined" ? data.visible : true;
    imageLayer.setOpacity(visible ? +data.opacity : 0);

    return imageLayer;
}

/**
 * read the tileset Data
 * @ignore
 */
function readTileset(data) {
    return (new TMXTileset(data));
}

/**
 * read the object group Data
 * @ignore
 */
function readObjectGroup(map, data, z) {
    return (new TMXGroup(map, data, z));
}

/**
 * @classdesc
 * a TMX Tile Map Object
 * Tiled QT +0.7.x format
 * @class TMXTileMap
 * @memberof me
 * @param {string} levelId name of TMX map
 * @param {object} data TMX map in JSON format
 * @example
 * // create a new level object based on the TMX JSON object
 * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
 * // add the level to the game world container
 * level.addTo(me.game.world, true);
 */
export default class TMXTileMap {

    // constructor
    constructor(levelId, data) {

        /**
         * the level data (JSON)
         * @ignore
         */
        this.data = data;

        /**
         * name of the tilemap
         * @public
         * @type {string}
         * @name me.TMXTileMap#name
         */
        this.name = levelId;

        /**
         * width of the tilemap in tiles
         * @public
         * @type {number}
         * @name me.TMXTileMap#cols
         */
        this.cols = +data.width;
        /**
         * height of the tilemap in tiles
         * @public
         * @type {number}
         * @name me.TMXTileMap#rows
         */
        this.rows = +data.height;

        /**
         * Tile width
         * @public
         * @type {number}
         * @name me.TMXTileMap#tilewidth
         */
        this.tilewidth = +data.tilewidth;

        /**
         * Tile height
         * @public
         * @type {number}
         * @name me.TMXTileMap#tileheight
         */
        this.tileheight = +data.tileheight;

        /**
         * is the map an infinite map
         * @public
         * @type {number}
         * @default 0
         * @name me.TMXTileMap#infinite
         */
        this.infinite = +data.infinite;

        /**
         * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered” and “hexagonal”.
         * @public
         * @type {string}
         * @default "orthogonal"
         * @name me.TMXTileMap#orientation
         */
        this.orientation = data.orientation;

        /**
         * the order in which tiles on orthogonal tile layers are rendered.
         * (valid values are "left-down", "left-up", "right-down", "right-up")
         * @public
         * @type {string}
         * @default "right-down"
         * @name me.TMXTileMap#renderorder
         */
        this.renderorder = data.renderorder || "right-down";

        /**
         * the TMX format version
         * @public
         * @type {string}
         * @name me.TMXTileMap#version
         */
        this.version = data.version;

        /**
         * The Tiled version used to save the file (since Tiled 1.0.1).
         * @public
         * @type {string}
         * @name me.TMXTileMap#tiledversion
         */
        this.tiledversion = data.tiledversion;

        // tilesets for this map
        this.tilesets = null;

        // layers
        if (typeof this.layers === "undefined") {
            this.layers = [];
        }
        // group objects
        if (typeof this.objectGroups === "undefined") {
            this.objectGroups = [];
        }

        // Check if map is from melon editor
        this.isEditor = data.editor === "melon-editor";


        // object id
        this.nextobjectid = +data.nextobjectid || undefined;

        // hex/iso properties
        this.hexsidelength = +data.hexsidelength;
        this.staggeraxis = data.staggeraxis;
        this.staggerindex = data.staggerindex;

        // calculate the map bounding rect
        this.bounds = this.getRenderer().getBounds().clone();

        // map "real" size
        this.width = this.bounds.width;
        this.height = this.bounds.height;

        // background color
        this.backgroundcolor = data.backgroundcolor;

        // set additional map properties (if any)
        applyTMXProperties(this, data);

        // internal flag
        this.initialized = false;

        if (this.infinite === 1) {
            // #956 Support for Infinite map
            // see as well in me.TMXUtils
            throw new Error("Tiled Infinite Map not supported!");
        }
    }

    /**
     * Return the map default renderer
     * @name getRenderer
     * @memberof me.TMXTileMap
     * @public
     * @function
     * @returns {me.TMXRenderer} a TMX renderer
     */
    getRenderer() {
        if ((typeof(this.renderer) === "undefined") || (!this.renderer.canRender(this))) {
            this.renderer = getNewDefaultRenderer(this);
        };
        return this.renderer;
    }

    /**
     * return the map bounding rect
     * @name me.TMXRenderer#getBounds
     * @public
     * @function
     * @returns {me.Bounds}
     */
    getBounds() {
        // calculated in the constructor
        return this.bounds;
    }

    /**
     * parse the map
     * @ignore
     */
    readMapObjects(data) {

        if (this.initialized === true) {
            return;
        }

        // to automatically increment z index
        var zOrder = 0;

        // Tileset information
        if (!this.tilesets) {
            // make sure we have a TilesetGroup Object
            this.tilesets = new TMXTilesetGroup();
        }

        // parse all tileset objects
        if (typeof (data.tilesets) !== "undefined") {
            var tilesets = data.tilesets;
            tilesets.forEach((tileset) => {
                // add the new tileset
                this.tilesets.add(readTileset(tileset));
            });
        }

        // check if a user-defined background color is defined
        if (this.backgroundcolor) {
            this.layers.push(
                pool.pull("ColorLayer",
                    "background_color",
                    this.backgroundcolor,
                    zOrder++
                )
            );
        }

        // check if a background image is defined
        if (this.background_image) {
            // add a new image layer
            this.layers.push(
                pool.pull("ImageLayer",
                    0, 0, {
                        name : "background_image",
                        image : this.background_image,
                        z : zOrder++
                    }
            ));
        }

        data.layers.forEach((layer) => {
            switch (layer.type) {
                case "imagelayer":
                    this.layers.push(readImageLayer(this, layer, zOrder++));
                    break;

                case "tilelayer":
                    this.layers.push(readLayer(this, layer, zOrder++));
                    break;

                // get the object groups information
                case "objectgroup":
                    this.objectGroups.push(readObjectGroup(this, layer, zOrder++));
                    break;

                // get the object groups information
                case "group":
                    this.objectGroups.push(readObjectGroup(this, layer, zOrder++));
                    break;

                default:
                    break;
            }
        });

        this.initialized = true;
    }


    /**
     * add all the map layers and objects to the given container.
     * note : this will not automatically update the camera viewport
     * @name me.TMXTileMap#addTo
     * @public
     * @function
     * @param {me.Container} container target container
     * @param {boolean} [flatten=true] if true, flatten all objects into the given container, else a `me.Container` object will be created for each corresponding groups
     * @param {boolean} [setViewportBounds=false] if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
     * @example
     * // create a new level object based on the TMX JSON object
     * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true, true);
     */
    addTo(container, flatten, setViewportBounds) {
        var _sort = container.autoSort;
        var _depth = container.autoDepth;

        var levelBounds = this.getBounds();

        // disable auto-sort and auto-depth
        container.autoSort = false;
        container.autoDepth = false;

        // add all layers instances
        this.getLayers().forEach(function (layer) {
            container.addChild(layer);
        });

        // add all Object instances
        this.getObjects(flatten).forEach(function (object) {
            container.addChild(object);
        });

        // resize the container accordingly
        container.resize(this.bounds.width, this.bounds.height);

        // sort everything (recursively)
        container.sort(true);

        /**
         * callback funtion for the viewport resize event
         * @ignore
         */
        function _setBounds(width, height) {
            // adjust the viewport bounds if level is smaller
            viewport.setBounds(
                0, 0,
                Math.max(levelBounds.width, width),
                Math.max(levelBounds.height, height)
            );
            // center the map if smaller than the current viewport
            container.pos.set(
                Math.max(0, ~~((width - levelBounds.width) / 2)),
                Math.max(0, ~~((height - levelBounds.height) / 2)),
                // don't change the container z position if defined
                container.pos.z
            );
        }

        if (setViewportBounds === true) {
            event.off(event.VIEWPORT_ONRESIZE, _setBounds);
            // force viewport bounds update
            _setBounds(viewport.width, viewport.height);
            // Replace the resize handler
            event.on(event.VIEWPORT_ONRESIZE, _setBounds, this);
        }

        //  set back auto-sort and auto-depth
        container.autoSort = _sort;
        container.autoDepth = _depth;
    }

    /**
     * return an Array of instantiated objects, based on the map object definition
     * @name me.TMXTileMap#getObjects
     * @public
     * @function
     * @param {boolean} [flatten=true] if true, flatten all objects into the returned array.
     * when false, a `me.Container` object will be created for each corresponding groups
     * @returns {me.Renderable[]} Array of Objects
     */
    getObjects(flatten) {
        var objects = [];
        var isCollisionGroup = false;
        var targetContainer;

        // parse the map for objects
        this.readMapObjects(this.data);

        for (var g = 0; g < this.objectGroups.length; g++) {
            var group = this.objectGroups[g];

            // check if this is the collision shape group
            isCollisionGroup = group.name.toLowerCase().includes(COLLISION_GROUP);

            if (flatten === false) {
                // create a new container
                targetContainer = new Container(0, 0, this.width, this.height);

                // tiled uses 0,0 by default
                targetContainer.anchorPoint.set(0, 0);

                // set additional properties
                targetContainer.name = group.name;
                targetContainer.pos.z = group.z;
                targetContainer.setOpacity(group.opacity);

                // disable auto-sort and auto-depth
                targetContainer.autoSort = false;
                targetContainer.autoDepth = false;
            }

            // iterate through the group and add all object into their
            // corresponding target Container
            for (var o = 0; o < group.objects.length; o++) {
                // TMX object settings
                var settings = group.objects[o];
                // reference to the instantiated object
                var obj;

                // Tiled uses 0,0 by default
                if (typeof (settings.anchorPoint) === "undefined") {
                    settings.anchorPoint = {x : 0, y : 0};
                }
                // convert to melonJS renderable argument name
                if (typeof (settings.tintcolor) !== "undefined") {
                    settings.tint = pool.pull("Color");
                    settings.tint.parseHex(settings.tintcolor, true);
                }

                /// XXX Clean/rewrite all this part to remove object
                /// specific instantiation logic/details from here

                // groups can contains either text, objects or layers
                if (settings instanceof TMXLayer) {
                    // layers are already instantiated & initialized
                    obj = settings;
                    // z value set already
                } else if (typeof settings.text === "object") {
                    // Tiled uses 0,0 by default
                    if (typeof (settings.text.anchorPoint) === "undefined") {
                        settings.text.anchorPoint = settings.anchorPoint;
                    }
                    if (settings.text.bitmap === true) {
                        obj = pool.pull("BitmapText", settings.x, settings.y, settings.text);
                    } else {
                        obj = pool.pull("Text", settings.x, settings.y, settings.text);
                    }
                    // set the obj z order
                    obj.pos.z = settings.z;
                } else if (typeof settings.tile === "object") {
                    // check if a me.Tile object is embedded
                    obj = settings.tile.getRenderable(settings);
                    obj.body = new Body(obj, settings.shapes || new Rect(0, 0, this.width, this.height));
                    obj.body.setStatic(true);
                    // set the obj z order
                    obj.pos.setMuted(settings.x, settings.y, settings.z);
                } else {
                    // pull the corresponding object from the object pool
                    if (typeof settings.name !== "undefined" && settings.name !== "") {
                        obj = pool.pull(
                            settings.name,
                            settings.x, settings.y,
                            settings
                        );
                    } else {
                        // unnamed shape object
                        obj = pool.pull(
                            "Renderable",
                            settings.x, settings.y,
                            settings.width, settings.height
                        );
                        obj.anchorPoint.set(0, 0);
                        obj.name = settings.name;
                        obj.type = settings.type;
                        obj.id = settings.id;
                        obj.body = new Body(obj, settings.shapes || new Rect(0, 0, obj.width, obj.height));
                        obj.body.setStatic(true);
                        obj.resize(obj.body.getBounds().width, obj.body.getBounds().height);
                    }
                    // set the obj z order
                    obj.pos.z = settings.z;
                }

                if (isCollisionGroup && !settings.name && obj.body) {
                    // configure the body accordingly
                    obj.body.collisionType = collision.types.WORLD_SHAPE;
                }

                //apply group opacity value to the child objects if group are merged
                if (flatten !== false) {
                    if (obj.isRenderable === true) {
                        obj.setOpacity(obj.getOpacity() * group.opacity);
                        // and to child renderables if any
                        if (obj.renderable instanceof Renderable) {
                            obj.renderable.setOpacity(obj.renderable.getOpacity() * group.opacity);
                        }
                    }
                    // directly add the obj into the objects array
                    objects.push(obj);
                } else /* false*/ {
                    // add it to the new container
                    targetContainer.addChild(obj);
                }

            }

            // if we created a new container
            if ((flatten === false) && (targetContainer.children.length > 0)) {

                // re-enable auto-sort and auto-depth
                targetContainer.autoSort = true;
                targetContainer.autoDepth = true;

                // add our container to the world
                objects.push(targetContainer);
            }
        }
        return objects;
    }

    /**
     * return all the existing layers
     * @name me.TMXTileMap#getLayers
     * @public
     * @function
     * @returns {me.TMXLayer[]} Array of Layers
     */
    getLayers() {
        // parse the map for objects
        this.readMapObjects(this.data);
        return this.layers;
    }

    /**
     * destroy function, clean all allocated objects
     * @name me.TMXTileMap#destroy
     * @public
     * @function
     */
    destroy() {
        this.tilesets = undefined;
        this.layers.length = 0;
        this.objectGroups.length = 0;
        this.initialized = false;
    }
};
