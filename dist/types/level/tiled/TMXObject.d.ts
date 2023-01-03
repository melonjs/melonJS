/**
 * @classdesc
 * a TMX Object defintion, as defined in Tiled
 * (Object definition is translated into the virtual `me.game.world` using `me.Renderable`)
 * @ignore
 */
export default class TMXObject {
    constructor(map: any, settings: any, z: any);
    /**
     * point list in JSON format
     * @type {object[]}
     */
    points: object[];
    /**
     * object name
     * @type {string}
     */
    name: string;
    /**
     * object x position
     * @type {number}
     */
    x: number;
    /**
     * object y position
     * @type {number}
     */
    y: number;
    /**
     * object z order
     * @type {number}
     */
    z: number;
    /**
     * object width
     * @type {number}
     */
    width: number;
    /**
     * object height
     * @type {number}
     */
    height: number;
    /**
     * object gid value
     * when defined the object is a tiled object
     * @type {number}
     */
    gid: number;
    /**
     * tint color
     * @type {string}
     */
    tintcolor: string;
    /**
     * object type
     * @type {string}
     * @deprecated since Tiled 1.9
     * @see https://docs.mapeditor.org/en/stable/reference/tmx-changelog/#tiled-1-9
     */
    type: string;
    /**
     * the object class
     * @type {string}
     */
    class: string;
    /**
     * object text
     * @type {object}
     * @see http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#text
     */
    text: object;
    /**
     * The rotation of the object in radians clockwise (defaults to 0)
     * @type {number}
     */
    rotation: number;
    /**
     * object unique identifier per level (Tiled 0.11.x+)
     * @type {number}
     */
    id: number;
    /**
     * object orientation (orthogonal or isometric)
     * @type {string}
     */
    orientation: string;
    /**
     * the collision shapes defined for this object
     * @type {object[]}
     */
    shapes: object[];
    /**
     * if true, the object is an Ellipse
     * @type {boolean}
     */
    isEllipse: boolean;
    /**
     * if true, the object is a Point
     * @type {boolean}
     */
    isPoint: boolean;
    /**
     * if true, the object is a Polygon
     * @type {boolean}
     */
    isPolygon: boolean;
    /**
     * if true, the object is a PolyLine
     * @type {boolean}
     */
    isPolyLine: boolean;
    /**
     * set the object image (for Tiled Object)
     * @ignore
     */
    setTile(tilesets: any): void;
    framewidth: any;
    frameheight: any;
    tile: Tile | undefined;
    /**
     * parses the TMX shape definition and returns a corresponding array of me.Shape object
     * @private
     * @returns {Polygon[]|Line[]|Ellipse[]} an array of shape objects
     */
    private parseTMXShapes;
    /**
     * getObjectPropertyByName
     * @ignore
     */
    getObjectPropertyByName(name: any): any;
}
import Tile from "./TMXTile.js";
