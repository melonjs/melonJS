import pool from "./../../system/pooling.js";
import * as event from "./../../system/event.js";
import { game } from "../../index.js";
import { checkVersion } from "./../../utils/utils.js";
import collision from "./../../physics/collision.js";
import Body from "./../../physics/body.js";
import TMXTileset from "./TMXTileset.js";
import TMXTilesetGroup from "./TMXTilesetGroup.js";
import TMXGroup from "./TMXGroup.js";
import TMXLayer from "./TMXLayer.js";
import { applyTMXProperties } from "./TMXUtils.js";
import Container from "../../renderable/container.js";
import { COLLISION_GROUP } from "./constants.js";
import { getNewTMXRenderer } from "./renderer/autodetect.js";
import { warning } from "../../lang/console.js";

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
    let imageLayer = pool.pull("ImageLayer",
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
    let visible = typeof(data.visible) !== "undefined" ? data.visible : true;
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
 */
export default class TMXTileMap {
    /**
     * @param {string} levelId - name of TMX map
     * @param {object} data - TMX map in JSON format
     * @example
     * // create a new level object based on the TMX JSON object
     * let level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true);
     */
    constructor(levelId, data) {

        /**
         * the level data (JSON)
         * @ignore
         */
        this.data = data;

        /**
         * name of the tilemap
         * @type {string}
         */
        this.name = levelId;

        /**
         * width of the tilemap in tiles
         * @type {number}
         */
        this.cols = +data.width;

        /**
         * height of the tilemap in tiles
         * @type {number}
         */
        this.rows = +data.height;

        /**
         * Tile width
         * @type {number}
         */
        this.tilewidth = +data.tilewidth;

        /**
         * Tile height
         * @type {number}
         */
        this.tileheight = +data.tileheight;

        /**
         * is the map an infinite map
         * @type {number}
         * @default 0
         */
        this.infinite = +data.infinite || 0;

        /**
         * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered” and “hexagonal”.
         * @type {string}
         * @default "orthogonal"
         */
        this.orientation = data.orientation;

        /**
         * the order in which tiles on orthogonal tile layers are rendered.
         * (valid values are "left-down", "left-up", "right-down", "right-up")
         * @type {string}
         * @default "right-down"
         */
        this.renderorder = data.renderorder || "right-down";

        /**
         * the TMX format version
         * @type {string}
         */
        this.version = "" + data.version;

        /**
         * The Tiled version used to save the file (since Tiled 1.0.1).
         * @type {string}
         */
        this.tiledversion = "" + data.tiledversion;

        /**
         * The map class.
         * @type {string}
         */
        this.class = data.class;

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

        // if version is undefined or empty it usually means the map was not created with Tiled
        if (this.version !== "undefined" && this.version !== "") {
            // deprecation warning if map tiled version is older than 1.5
            if (checkVersion(this.version, "1.5") < 0) {
                warning("(" + this.name + ") Tiled Map format version 1.4 and below", "format 1.5 or higher", "10.4.4");
            }
        }


        // set additional map properties (if any)
        applyTMXProperties(this, data);

        // internal flag
        this.initialized = false;
    }

    /**
     * Return the map default renderer
     * @returns {TMXRenderer} a TMX renderer
     */
    getRenderer() {
        if ((typeof(this.renderer) === "undefined") || (!this.renderer.canRender(this))) {
            this.renderer = getNewTMXRenderer(this);
        }
        return this.renderer;
    }

    /**
     * return the map bounding rect
     * @returns {Bounds}
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
        let zOrder = 0;

        // Tileset information
        if (!this.tilesets) {
            // make sure we have a TilesetGroup Object
            this.tilesets = new TMXTilesetGroup();
        }

        // parse all tileset objects
        if (typeof (data.tilesets) !== "undefined") {
            let tilesets = data.tilesets;
            tilesets.forEach((tileset) => {
                // add the new tileset
                this.tilesets.add(readTileset(tileset));
            });
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
     * @param {Container} container - target container
     * @param {boolean} [flatten=true] - if true, flatten all objects into the given container, else a `me.Container` object will be created for each corresponding groups
     * @param {boolean} [setViewportBounds=false] - if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
     * @example
     * // create a new level object based on the TMX JSON object
     * let level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true, true);
     */
    addTo(container, flatten, setViewportBounds) {
        let _sort = container.autoSort;
        let _depth = container.autoDepth;

        let levelBounds = this.getBounds();

        // disable auto-sort and auto-depth
        container.autoSort = false;
        container.autoDepth = false;

        if (this.backgroundcolor) {
            container.backgroundColor.parseCSS(this.backgroundcolor);
        }

        // add all layers instances
        this.getLayers().forEach((layer) => {
            container.addChild(layer);
        });

        // add all Object instances
        this.getObjects(flatten).forEach((object) => {
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
            game.viewport.setBounds(
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
            _setBounds(game.viewport.width, game.viewport.height);
            // Replace the resize handler
            event.on(event.VIEWPORT_ONRESIZE, _setBounds, this);
        }

        //  set back auto-sort and auto-depth
        container.autoSort = _sort;
        container.autoDepth = _depth;
    }

    /**
     * return an Array of instantiated objects, based on the map object definition
     * @param {boolean} [flatten=true] - if true, flatten all objects into the returned array.
     * when false, a `me.Container` object will be created for each corresponding groups
     * @returns {Renderable[]} Array of Objects
     */
    getObjects(flatten) {
        let objects = [];
        let isCollisionGroup = false;
        let targetContainer;

        // parse the map for objects
        this.readMapObjects(this.data);

        for (let g = 0; g < this.objectGroups.length; g++) {
            let group = this.objectGroups[g];

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
            for (let o = 0; o < group.objects.length; o++) {
                // TMX object settings
                let settings = group.objects[o];
                // reference to the instantiated object
                let obj;
                // a reference to the default shape
                let shape;

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
                    // create a default shape if none is specified
                    shape = settings.shapes;
                    if (typeof shape === "undefined") {
                        shape = pool.pull("Polygon", 0, 0, [
                            pool.pull("Vector2d", 0,          0),
                            pool.pull("Vector2d", this.width, 0),
                            pool.pull("Vector2d", this.width, this.height)
                        ]);
                    }
                    // check if a me.Tile object is embedded
                    obj = settings.tile.getRenderable(settings);
                    obj.body = new Body(obj, shape);
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
                        // create a default shape if none is specified
                        shape = settings.shapes;
                        if (typeof shape === "undefined") {
                            shape = pool.pull("Polygon", 0, 0, [
                                pool.pull("Vector2d", 0,          0),
                                pool.pull("Vector2d", this.width, 0),
                                pool.pull("Vector2d", this.width, this.height)
                            ]);
                        }
                        obj.anchorPoint.set(0, 0);
                        obj.name = settings.name;
                        obj.type = settings.type;
                        // for backward compatibility
                        obj.class = settings.class || settings.type;
                        obj.id = settings.id;
                        obj.body = new Body(obj, shape);
                        obj.body.setStatic(true);
                        obj.resize(obj.body.getBounds().width, obj.body.getBounds().height);
                    }
                    // set the obj z order
                    obj.pos.z = settings.z;
                }

                if (isCollisionGroup && !settings.name && obj.body) {
                    // configure the body accordingly
                    obj.body.collisionType = collision.types.WORLD_SHAPE;
                    // mark collision shapes as static
                    obj.body.isStatic = true;
                }

                //apply group opacity value to the child objects if group are merged
                if (flatten !== false) {
                    if (obj.isRenderable === true) {
                        obj.setOpacity(obj.getOpacity() * group.opacity);
                        // and to child renderables if any
                        if (typeof obj.renderable !== "undefined" && obj.renderable.isRenderable === true) {
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
     * @returns {TMXLayer[]} Array of Layers
     */
    getLayers() {
        // parse the map for objects
        this.readMapObjects(this.data);
        return this.layers;
    }

    /**
     * destroy function, clean all allocated objects
     */
    destroy() {
        this.tilesets = undefined;
        this.layers.length = 0;
        this.objectGroups.length = 0;
        this.initialized = false;
    }
}

