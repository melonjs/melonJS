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
     * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true);
     */
    constructor(levelId: string, data: object);
    /**
     * the level data (JSON)
     * @ignore
     */
    data: object;
    /**
     * name of the tilemap
     * @public
     * @type {string}
     * @name TMXTileMap#name
     */
    public name: string;
    /**
     * width of the tilemap in tiles
     * @public
     * @type {number}
     * @name TMXTileMap#cols
     */
    public cols: number;
    /**
     * height of the tilemap in tiles
     * @public
     * @type {number}
     * @name TMXTileMap#rows
     */
    public rows: number;
    /**
     * Tile width
     * @public
     * @type {number}
     * @name TMXTileMap#tilewidth
     */
    public tilewidth: number;
    /**
     * Tile height
     * @public
     * @type {number}
     * @name TMXTileMap#tileheight
     */
    public tileheight: number;
    /**
     * is the map an infinite map
     * @public
     * @type {number}
     * @default 0
     * @name TMXTileMap#infinite
     */
    public infinite: number;
    /**
     * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered” and “hexagonal”.
     * @public
     * @type {string}
     * @default "orthogonal"
     * @name TMXTileMap#orientation
     */
    public orientation: string;
    /**
     * the order in which tiles on orthogonal tile layers are rendered.
     * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @public
     * @type {string}
     * @default "right-down"
     * @name TMXTileMap#renderorder
     */
    public renderorder: string;
    /**
     * the TMX format version
     * @public
     * @type {string}
     * @name TMXTileMap#version
     */
    public version: string;
    /**
     * The Tiled version used to save the file (since Tiled 1.0.1).
     * @public
     * @type {string}
     * @name TMXTileMap#tiledversion
     */
    public tiledversion: string;
    /**
     * The map class.
     * @public
     * @type {string}
     * @name TMXTileMap#class
     */
    public class: string;
    tilesets: TMXTilesetGroup | null | undefined;
    layers: any[];
    objectGroups: any[];
    isEditor: boolean;
    nextobjectid: number | undefined;
    hexsidelength: number;
    staggeraxis: any;
    staggerindex: any;
    bounds: any;
    width: any;
    height: any;
    backgroundcolor: any;
    initialized: boolean;
    /**
     * Return the map default renderer
     * @name getRenderer
     * @memberof TMXTileMap
     * @public
     * @returns {TMXRenderer} a TMX renderer
     */
    public getRenderer(): TMXRenderer;
    renderer: TMXOrthogonalRenderer | TMXIsometricRenderer | TMXHexagonalRenderer | undefined;
    /**
     * return the map bounding rect
     * @name TMXRenderer#getBounds
     * @public
     * @returns {Bounds}
     */
    public getBounds(): Bounds;
    /**
     * parse the map
     * @ignore
     */
    readMapObjects(data: any): void;
    /**
     * add all the map layers and objects to the given container.
     * note : this will not automatically update the camera viewport
     * @name TMXTileMap#addTo
     * @public
     * @param {Container} container - target container
     * @param {boolean} [flatten=true] - if true, flatten all objects into the given container, else a `me.Container` object will be created for each corresponding groups
     * @param {boolean} [setViewportBounds=false] - if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
     * @example
     * // create a new level object based on the TMX JSON object
     * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true, true);
     */
    public addTo(container: Container, flatten?: boolean | undefined, setViewportBounds?: boolean | undefined): void;
    /**
     * return an Array of instantiated objects, based on the map object definition
     * @name TMXTileMap#getObjects
     * @public
     * @param {boolean} [flatten=true] - if true, flatten all objects into the returned array.
     * when false, a `me.Container` object will be created for each corresponding groups
     * @returns {Renderable[]} Array of Objects
     */
    public getObjects(flatten?: boolean | undefined): Renderable[];
    /**
     * return all the existing layers
     * @name TMXTileMap#getLayers
     * @public
     * @returns {TMXLayer[]} Array of Layers
     */
    public getLayers(): TMXLayer[];
    /**
     * destroy function, clean all allocated objects
     * @name TMXTileMap#destroy
     * @public
     */
    public destroy(): void;
}
import TMXTilesetGroup from "./TMXTilesetGroup.js";
import TMXOrthogonalRenderer from "./renderer/TMXOrthogonalRenderer.js";
import TMXIsometricRenderer from "./renderer/TMXIsometricRenderer.js";
import TMXHexagonalRenderer from "./renderer/TMXHexagonalRenderer.js";
import Container from "./../../renderable/container.js";
import TMXLayer from "./TMXLayer.js";
