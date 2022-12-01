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
     * @public
     * @type {object[]}
     * @name points
     * @memberof TMXObject
     */
    public points: object[];
    /**
     * object name
     * @public
     * @type {string}
     * @name name
     * @memberof TMXObject
     */
    public name: string;
    /**
     * object x position
     * @public
     * @type {number}
     * @name x
     * @memberof TMXObject
     */
    public x: number;
    /**
     * object y position
     * @public
     * @type {number}
     * @name y
     * @memberof TMXObject
     */
    public y: number;
    /**
     * object z order
     * @public
     * @type {number}
     * @name z
     * @memberof TMXObject
     */
    public z: number;
    /**
     * object width
     * @public
     * @type {number}
     * @name width
     * @memberof TMXObject
     */
    public width: number;
    /**
     * object height
     * @public
     * @type {number}
     * @name height
     * @memberof TMXObject
     */
    public height: number;
    /**
     * object gid value
     * when defined the object is a tiled object
     * @public
     * @type {number}
     * @name gid
     * @memberof TMXObject
     */
    public gid: number;
    /**
     * tint color
     * @public
     * @type {string}
     * @name tintcolor
     * @memberof TMXObject
     */
    public tintcolor: string;
    /**
     * object type
     * @public
     * @type {string}
     * @deprecated since Tiled 1.9
     * @see https://docs.mapeditor.org/en/stable/reference/tmx-changelog/#tiled-1-9
     * @name type
     * @memberof TMXObject
     */
    public type: string;
    /**
     * the object class
     * @public
     * @type {string}
     * @name class
     * @memberof TMXObject
     */
    public class: string;
    /**
     * object text
     * @public
     * @type {object}
     * @see http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#text
     * @name text
     * @memberof TMXObject
     */
    public text: object;
    /**
     * The rotation of the object in radians clockwise (defaults to 0)
     * @public
     * @type {number}
     * @name rotation
     * @memberof TMXObject
     */
    public rotation: number;
    /**
     * object unique identifier per level (Tiled 0.11.x+)
     * @public
     * @type {number}
     * @name id
     * @memberof TMXObject
     */
    public id: number;
    /**
     * object orientation (orthogonal or isometric)
     * @public
     * @type {string}
     * @name orientation
     * @memberof TMXObject
     */
    public orientation: string;
    /**
     * the collision shapes defined for this object
     * @public
     * @type {object[]}
     * @name shapes
     * @memberof TMXObject
     */
    public shapes: object[];
    /**
     * if true, the object is an Ellipse
     * @public
     * @type {boolean}
     * @name isEllipse
     * @memberof TMXObject
     */
    public isEllipse: boolean;
    /**
     * if true, the object is a Point
     * @public
     * @type {boolean}
     * @name isPoint
     * @memberof TMXObject
     */
    public isPoint: boolean;
    /**
     * if true, the object is a Polygon
     * @public
     * @type {boolean}
     * @name isPolygon
     * @memberof TMXObject
     */
    public isPolygon: boolean;
    /**
     * if true, the object is a PolyLine
     * @public
     * @type {boolean}
     * @name isPolyLine
     * @memberof TMXObject
     */
    public isPolyLine: boolean;
    /**
     * set the object image (for Tiled Object)
     * @ignore
     */
    setTile(tilesets: any): void;
    framewidth: any;
    frameheight: any;
    tile: Tile;
    /**
     * parses the TMX shape definition and returns a corresponding array of me.Shape object
     * @name parseTMXShapes
     * @memberof TMXObject
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
