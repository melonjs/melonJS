import pool from "./../../system/pooling.js";
import { applyTMXProperties } from "./TMXUtils.js";
import Tile from "./TMXTile.js";
import { degToRad } from "./../../math/math.js";

/**
 * @classdesc
 * a TMX Object defintion, as defined in Tiled
 * (Object definition is translated into the virtual `me.game.world` using `me.Renderable`)
 * @ignore
 */
export default class TMXObject {

    constructor(map, settings, z) {

        /**
         * point list in JSON format
         * @type {object[]}
         */
        this.points = undefined;

        /**
         * object name
         * @type {string}
         */
        this.name = settings.name;

        /**
         * object x position
         * @type {number}
         */
        this.x = +settings.x;

        /**
         * object y position
         * @type {number}
         */
        this.y = +settings.y;

        /**
         * object z order
         * @type {number}
         */
        this.z = +z;

        /**
         * object width
         * @type {number}
         */
        this.width = +settings.width || 0;

        /**
         * object height
         * @type {number}
         */
        this.height = +settings.height || 0;

        /**
         * object gid value
         * when defined the object is a tiled object
         * @type {number}
         */
        this.gid = +settings.gid || null;

        /**
         * tint color
         * @type {string}
         */
        this.tintcolor = settings.tintcolor;

        /**
         * object type
         * @type {string}
         * @deprecated since Tiled 1.9
         * @see https://docs.mapeditor.org/en/stable/reference/tmx-changelog/#tiled-1-9
         */
        this.type = settings.type;

        /**
         * the object class
         * @type {string}
         */
        this.class = typeof settings.class !== "undefined" ? settings.class : settings.type;

        /**
         * object text
         * @type {object}
         * @see http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#text
         */
        this.text = undefined;

        /**
         * The rotation of the object in radians clockwise (defaults to 0)
         * @type {number}
         */
        this.rotation = degToRad(+settings.rotation || 0);

        /**
         * object unique identifier per level (Tiled 0.11.x+)
         * @type {number}
         */
        this.id = +settings.id || undefined;

        /**
         * object orientation (orthogonal or isometric)
         * @type {string}
         */
        this.orientation = map.orientation;

        /**
         * the collision shapes defined for this object
         * @type {object[]}
         */
        this.shapes = undefined;

        /**
         * if true, the object is an Ellipse
         * @type {boolean}
         */
        this.isEllipse = false;

        /**
         * if true, the object is a Point
         * @type {boolean}
         */
        this.isPoint = false;

        /**
         * if true, the object is a Polygon
         * @type {boolean}
         */
        this.isPolygon = false;

        /**
         * if true, the object is a PolyLine
         * @type {boolean}
         */
        this.isPolyLine = false;

        // check if the object has an associated gid
        if (typeof this.gid === "number") {
            this.setTile(map.tilesets);
        }
        else {
            if (typeof settings.ellipse !== "undefined") {
                this.isEllipse = true;
            } else if (typeof settings.point !== "undefined") {
                this.isPoint = true;
            } else if (typeof settings.polygon !== "undefined") {
                this.points = settings.polygon;
                this.isPolygon = true;
            } else if (typeof settings.polyline !== "undefined") {
                this.points = settings.polyline;
                this.isPolyLine = true;
            }
        }

        // check for text information
        if (typeof settings.text !== "undefined") {
            // a text object
            this.text = settings.text;
            // normalize field name and default value the melonjs way
            this.text.font = settings.text.fontfamily || "sans-serif";
            this.text.size = settings.text.pixelsize || 16;
            this.text.fillStyle = settings.text.color || "#000000";
            this.text.textAlign = settings.text.halign || "left";
            this.text.textBaseline = settings.text.valign || "top";
            this.text.width = this.width;
            this.text.height = this.height;
            // set the object properties
            applyTMXProperties(this.text, settings);
        } else {
            // set the object properties
            applyTMXProperties(this, settings);
            // a standard object
            if (!this.shapes) {
                // else define the object shapes if required
                this.shapes = this.parseTMXShapes();
            }
        }

        // Adjust the Position to match Tiled
        if (!map.isEditor) {
            map.getRenderer().adjustPosition(this);
        }
    }

    /**
     * set the object image (for Tiled Object)
     * @ignore
     */
    setTile(tilesets) {
        // get the corresponding tileset
        let tileset = tilesets.getTilesetByGid(this.gid);

        if (tileset.isCollection === false) {
            // set width and height equal to tile size
            this.width = this.framewidth = tileset.tilewidth;
            this.height = this.frameheight = tileset.tileheight;
        }

        // the object corresponding tile object
        this.tile = new Tile(this.x, this.y, this.gid, tileset);
    }

    /**
     * parses the TMX shape definition and returns a corresponding array of me.Shape object
     * @private
     * @returns {Polygon[]|Line[]|Ellipse[]} an array of shape objects
     */
    parseTMXShapes() {
        let shapes = [];

        // add an ellipse shape
        if (this.isEllipse === true) {
            // ellipse coordinates are the center position, so set default to the corresonding radius
            shapes.push((pool.pull("Ellipse",
                this.width / 2,
                this.height / 2,
                this.width,
                this.height
            )).rotate(this.rotation));
        } else if (this.isPoint === true) {
            shapes.push(pool.pull("Point", this.x, this.y));
        } else {
            // add a polygon
            if (this.isPolygon === true) {
                let _polygon = pool.pull("Polygon", 0, 0, this.points);
                let isConvex = _polygon.isConvex();
                // make sure it's a convex polygon
                if (isConvex === false) {
                    throw new Error("collision polygones in Tiled should be defined as Convex");
                } else if (isConvex === null) {
                    throw new Error("invalid polygone");
                }
                shapes.push(_polygon.rotate(this.rotation));

            } else if (this.isPolyLine === true) {
                let p = this.points;
                let p1, p2;
                let segments = p.length - 1;
                for (let i = 0; i < segments; i++) {
                    // clone the value before, as [i + 1]
                    // is reused later by the next segment
                    p1 = pool.pull("Vector2d", p[i].x, p[i].y);
                    p2 = pool.pull("Vector2d", p[i + 1].x, p[i + 1].y);
                    if (this.rotation !== 0) {
                        p1 = p1.rotate(this.rotation);
                        p2 = p2.rotate(this.rotation);
                    }
                    shapes.push(pool.pull("Line", 0, 0, [ p1, p2 ]));
                }
            }

            // it's a rectangle, returns a polygon object anyway
            else {
                shapes.push((pool.pull("Polygon",
                    0, 0, [
                        pool.pull("Vector2d"),  pool.pull("Vector2d", this.width, 0),
                        pool.pull("Vector2d", this.width, this.height), pool.pull("Vector2d", 0, this.height)
                    ]
                )).rotate(this.rotation));
            }

        }

        // Apply isometric projection
        if (this.orientation === "isometric") {
            for (let i = 0; i < shapes.length; i++) {
                if (typeof shapes[i].toIso === "function") {
                    shapes[i].toIso();
                }
            }
        }

        return shapes;
    }

    /**
     * getObjectPropertyByName
     * @ignore
     */
    getObjectPropertyByName(name) {
        return this[name];
    }
}
