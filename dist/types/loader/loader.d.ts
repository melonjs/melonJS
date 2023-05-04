/**
 * an asset definition to be used with the loader
 * @typedef {object} loader.Asset
 * @property {string} name - name of the asset
 * @property {string} type  - the type of the asset : "audio", binary", "image", "json", "js", "tmx", "tmj", "tsx", "tsj", "fontface"
 * @property {string} [src]  - path and/or file name of the resource (for audio assets only the path is required)
 * @property {string} [data]  - TMX data if not provided through a src url
 * @property {boolean} [stream] - Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
 * @see loader.preload
 * @see loader.load
 */
/**
 * set all the specified game assets to be preloaded.
 * @memberof loader
 * @param {loader.Asset[]} assets - list of assets to load
 * @param {Function} [onloadcb=loader.onload] - function to be called when all resources are loaded
 * @param {boolean} [switchToLoadState=true] - automatically switch to the loading screen
 * @example
 * game.assets = [
 *   // PNG tileset
 *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"},
 *   // PNG packed texture
 *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
 *   // PNG base64 encoded image
 *   {name: "texture", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."}
 *   // TSX file
 *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"},
 *   // TMX level (XML & JSON)
 *   {name: "map1", type: "tmx", src: "data/map/map1.json"},
 *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"},
 *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}},
 *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}},
 *   // audio resources
 *   {name: "bgmusic", type: "audio",  src: "data/audio/"},
 *   {name: "cling",   type: "audio",  src: "data/audio/"},
 *   // base64 encoded audio resources
 *   {name: "band",   type: "audio",  src: "data:audio/wav;base64,..."},
 *   // binary file
 *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"},
 *   // JSON file (used for texturePacker)
 *   {name: "texture", type: "json", src: "data/gfx/texture.json"},
 *   // JavaScript file
 *   {name: "plugin", type: "js", src: "data/js/plugin.js"},
 *   // Font Face
 *   { name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')" }
 * ];
 * ...
 * // set all resources to be loaded
 * me.loader.preload(game.assets, () => this.loaded());
 */
export function preload(assets: loader.Asset[], onloadcb?: Function | undefined, switchToLoadState?: boolean | undefined): void;
/**
 * Load a single asset (to be used if you need to load additional asset(s) during the game)
 * @memberof loader
 * @param {loader.Asset} asset
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource to be preloaded
 * @example
 * // load an image asset
 * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, () => this.onload(), () => this.onerror());
 * // load a base64 image asset
 *  me.loader.load({name: "avatar", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."};
 * // start loading music
 * me.loader.load({
 *     name   : "bgmusic",
 *     type   : "audio",
 *     src    : "data/audio/"
 * }, function () {
 *     me.audio.play("bgmusic");
 * });
 */
export function load(asset: loader.Asset, onload?: Function | undefined, onerror?: Function | undefined): number;
/**
 * unload the specified asset to free memory
 * @memberof loader
 * @param {loader.Asset} asset
 * @returns {boolean} true if unloaded
 * @example me.loader.unload({name: "avatar",  type:"image"});
 */
export function unload(asset: loader.Asset): boolean;
/**
 * unload all resources to free memory
 * @memberof loader
 * @example me.loader.unloadAll();
 */
export function unloadAll(): void;
/**
 * return the specified TMX/TSX object
 * @memberof loader
 * @param {string} elt - name of the tmx/tsx element ("map1");
 * @returns {object} requested element or null if not found
 */
export function getTMX(elt: string): object;
/**
 * return the specified Binary object
 * @memberof loader
 * @param {string} elt - name of the binary object ("ymTrack");
 * @returns {object} requested element or null if not found
 */
export function getBinary(elt: string): object;
/**
 * return the specified Image Object
 * @memberof loader
 * @param {string} image - name of the Image element ("tileset-platformer");
 * @returns {HTMLImageElement} requested element or null if not found
 */
export function getImage(image: string): HTMLImageElement;
/**
 * return the specified JSON Object
 * @memberof loader
 * @param {string} elt - name of the json file to load
 * @returns {object}
 */
export function getJSON(elt: string): object;
export * from "./settings.js";
/**
 * onload callback
 * @default undefined
 * @memberof loader
 * @type {function}
 * @example
 * // set a callback when everything is loaded
 * me.loader.onload = this.loaded.bind(this);
 */
export let onload: Function;
/**
 * onProgress callback<br>
 * each time a resource is loaded, the loader will fire the specified function,
 * giving the actual progress [0 ... 1], as argument, and an object describing the resource loaded
 * @default undefined
 * @memberof loader
 * @type {function}
 * @example
 * // set a callback for progress notification
 * me.loader.onProgress = this.updateProgress.bind(this);
 */
export let onProgress: Function;
export namespace loader {
    /**
     * an asset definition to be used with the loader
     */
    type Asset = {
        /**
         * - name of the asset
         */
        name: string;
        /**
         * - the type of the asset : "audio", binary", "image", "json", "js", "tmx", "tmj", "tsx", "tsj", "fontface"
         */
        type: string;
        /**
         * - path and/or file name of the resource (for audio assets only the path is required)
         */
        src?: string | undefined;
        /**
         * - TMX data if not provided through a src url
         */
        data?: string | undefined;
        /**
         * - Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
         */
        stream?: boolean | undefined;
    };
}
