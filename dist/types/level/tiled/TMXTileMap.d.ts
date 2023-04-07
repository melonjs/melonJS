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
    constructor(levelId: string, data: object);
    /**
     * the level data (JSON)
     * @ignore
     */
    data: object;
    /**
     * name of the tilemap
     * @type {string}
     */
    name: string;
    /**
     * width of the tilemap in tiles
     * @type {number}
     */
    cols: number;
    /**
     * height of the tilemap in tiles
     * @type {number}
     */
    rows: number;
    /**
     * Tile width
     * @type {number}
     */
    tilewidth: number;
    /**
     * Tile height
     * @type {number}
     */
    tileheight: number;
    /**
     * is the map an infinite map
     * @type {number}
     * @default 0
     */
    infinite: number;
    /**
     * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered” and “hexagonal”.
     * @type {string}
     * @default "orthogonal"
     */
    orientation: string;
    /**
     * the order in which tiles on orthogonal tile layers are rendered.
     * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @type {string}
     * @default "right-down"
     */
    renderorder: string;
    /**
     * the TMX format version
     * @type {string}
     */
    version: string;
    /**
     * The Tiled version used to save the file (since Tiled 1.0.1).
     * @type {string}
     */
    tiledversion: string;
    /**
     * The map class.
     * @type {string}
     */
    class: string;
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
     * @returns {TMXRenderer} a TMX renderer
     */
    getRenderer(): TMXRenderer;
    renderer: import("./renderer/TMXOrthogonalRenderer.js").default | import("./renderer/TMXIsometricRenderer.js").default | import("./renderer/TMXHexagonalRenderer.js").default | undefined;
    /**
     * return the map bounding rect
     * @returns {Bounds}
     */
    getBounds(): Bounds;
    /**
     * parse the map
     * @ignore
     */
    readMapObjects(data: any): void;
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
    addTo(container: Container, flatten?: boolean | undefined, setViewportBounds?: boolean | undefined): void;
    /**
     * return an Array of instantiated objects, based on the map object definition
     * @param {boolean} [flatten=true] - if true, flatten all objects into the returned array.
     * when false, a `me.Container` object will be created for each corresponding groups
     * @returns {Renderable[]} Array of Objects
     */
    getObjects(flatten?: boolean | undefined): Renderable[];
    /**
     * return all the existing layers
     * @returns {TMXLayer[]} Array of Layers
     */
    getLayers(): TMXLayer[];
    /**
     * destroy function, clean all allocated objects
     */
    destroy(): void;
}
import TMXTilesetGroup from "./TMXTilesetGroup.js";
import Container from "../../renderable/container.js";
import TMXLayer from "./TMXLayer.js";
