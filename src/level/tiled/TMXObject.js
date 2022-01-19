import Vector2d from "./../../math/vector2.js";
import { applyTMXProperties } from "./TMXUtils.js";
import Tile from "./TMXTile.js";
import Ellipse from "./../../geometries/ellipse.js";
import Polygon from "./../../geometries/poly.js";
import Line from "./../../geometries/line.js";
import { degToRad } from "./../../math/math.js";

/**
 * a TMX Object defintion, as defined in Tiled
 * (Object definition is translated into the virtual `me.game.world` using `me.Renderable`)
 * @class TMXObject
 * @ignore
 */
export default class TMXObject {

    constructor(map, settings, z) {

        /**
         * point list in JSON format
         * @public
         * @type {object[]}
         * @name points
         * @memberof me.TMXObject
         */
        this.points = undefined;

        /**
         * object name
         * @public
         * @type {string}
         * @name name
         * @memberof me.TMXObject
         */
        this.name = settings.name;

        /**
         * object x position
         * @public
         * @type {number}
         * @name x
         * @memberof me.TMXObject
         */
        this.x = +settings.x;

        /**
         * object y position
         * @public
         * @type {number}
         * @name y
         * @memberof me.TMXObject
         */
        this.y = +settings.y;

        /**
         * object z order
         * @public
         * @type {number}
         * @name z
         * @memberof me.TMXObject
         */
        this.z = +z;

        /**
         * object width
         * @public
         * @type {number}
         * @name width
         * @memberof me.TMXObject
         */
        this.width = +settings.width || 0;

        /**
         * object height
         * @public
         * @type {number}
         * @name height
         * @memberof me.TMXObject
         */
        this.height = +settings.height || 0;

        /**
         * object gid value
         * when defined the object is a tiled object
         * @public
         * @type {number}
         * @name gid
         * @memberof me.TMXObject
         */
        this.gid = +settings.gid || null;

        /**
         * tint color
         * @public
         * @type {string}
         * @name tintcolor
         * @memberof me.TMXObject
         */
        this.tintcolor = settings.tintcolor;

        /**
         * object type
         * @public
         * @type {string}
         * @name type
         * @memberof me.TMXObject
         */
        this.type = settings.type;

        /**
         * object text
         * @public
         * @type {object}
         * @see http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#text
         * @name type
         * @memberof me.TMXObject
         */
        this.type = settings.type;

        /**
         * The rotation of the object in radians clockwise (defaults to 0)
         * @public
         * @type {number}
         * @name rotation
         * @memberof me.TMXObject
         */
        this.rotation = degToRad(+settings.rotation || 0);

        /**
         * object unique identifier per level (Tiled 0.11.x+)
         * @public
         * @type {number}
         * @name id
         * @memberof me.TMXObject
         */
        this.id = +settings.id || undefined;

        /**
         * object orientation (orthogonal or isometric)
         * @public
         * @type {string}
         * @name orientation
         * @memberof me.TMXObject
         */
        this.orientation = map.orientation;

        /**
         * the collision shapes defined for this object
         * @public
         * @type {object[]}
         * @name shapes
         * @memberof me.TMXObject
         */
        this.shapes = undefined;

        /**
         * if true, the object is an Ellipse
         * @public
         * @type {boolean}
         * @name isEllipse
         * @memberof me.TMXObject
         */
        this.isEllipse = false;

        /**
         * if true, the object is a Polygon
         * @public
         * @type {boolean}
         * @name isPolygon
         * @memberof me.TMXObject
         */
        this.isPolygon = false;

        /**
         * if true, the object is a PolyLine
         * @public
         * @type {boolean}
         * @name isPolyLine
         * @memberof me.TMXObject
         */
        this.isPolyLine = false;

        // check if the object has an associated gid
        if (typeof this.gid === "number") {
            this.setTile(map.tilesets);
        }
        else {
            if (typeof(settings.ellipse) !== "undefined") {
                this.isEllipse = true;
            } else if (typeof(settings.polygon) !== "undefined") {
                this.points = settings.polygon;
                this.isPolygon = true;
            } else if (typeof(settings.polyline) !== "undefined") {
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
     * @function
     */
    setTile(tilesets) {
        // get the corresponding tileset
        var tileset = tilesets.getTilesetByGid(this.gid);

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
     * @name parseTMXShapes
     * @memberof me.TMXObject
     * @private
     * @function
     * @returns {me.Polygon[]|me.Line[]|me.Ellipse[]} an array of shape objects
     */
    parseTMXShapes() {
        var i = 0;
        var shapes = [];

        // add an ellipse shape
        if (this.isEllipse === true) {
            // ellipse coordinates are the center position, so set default to the corresonding radius
            shapes.push((new Ellipse(
                this.width / 2,
                this.height / 2,
                this.width,
                this.height
            )).rotate(this.rotation));
        } else {

            // add a polygon
            if (this.isPolygon === true) {
                var _polygon = new Polygon(0, 0, this.points);
                // make sure it's a convex polygon
                if (_polygon.isConvex() === false ) {
                    throw new Error("collision polygones in Tiled should be defined as Convex");
                }
                shapes.push(_polygon.rotate(this.rotation));
            }

            // add a polyline
            else if (this.isPolyLine === true) {
                var p = this.points;
                var p1, p2;
                var segments = p.length - 1;
                for (i = 0; i < segments; i++) {
                    // clone the value before, as [i + 1]
                    // is reused later by the next segment
                    p1 = new Vector2d(p[i].x, p[i].y);
                    p2 = new Vector2d(p[i + 1].x, p[i + 1].y);
                    if (this.rotation !== 0) {
                        p1 = p1.rotate(this.rotation);
                        p2 = p2.rotate(this.rotation);
                    }
                    shapes.push(new Line(0, 0, [ p1, p2 ]));
                }
            }

            // it's a rectangle, returns a polygon object anyway
            else {
                shapes.push((new Polygon(
                    0, 0, [
                        new Vector2d(), new Vector2d(this.width, 0),
                        new Vector2d(this.width, this.height), new Vector2d(0, this.height)
                    ]
                )).rotate(this.rotation));
            }

        }

        // Apply isometric projection
        if (this.orientation === "isometric") {
            for (i = 0; i < shapes.length; i++) {
                shapes[i].toIso();
            }
        }

        return shapes;
    }

    /**
     * getObjectPropertyByName
     * @ignore
     * @function
     */
    getObjectPropertyByName(name) {
        return this[name];
    }
}
