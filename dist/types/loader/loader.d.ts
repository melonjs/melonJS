/**
 * set all the specified game resources to be preloaded.
 * @name preload
 * @memberof loader
 * @public
 * @param {object[]} res
 * @param {string} res.name - internal name of the resource
 * @param {string} res.type  - "audio", binary", "image", "json","js", "tmx", "tsx", "fontface"
 * @param {string} res.src  - path and/or file name of the resource (for audio assets only the path is required)
 * @param {boolean} [res.stream] - Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
 * @param {Function} [onload=loader.onload] - function to be called when all resources are loaded
 * @param {boolean} [switchToLoadState=true] - automatically switch to the loading screen
 * @example
 * game_resources = [
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
 * me.loader.preload(game.resources, () => this.loaded());
 */
export function preload(res: {
    name: string;
    type: string;
    src: string;
    stream?: boolean;
}, onloadcb: any, switchToLoadState?: boolean | undefined): void;
/**
 * Load a single resource (to be used if you need to load additional resource during the game)
 * @name load
 * @memberof loader
 * @public
 * @param {object} res
 * @param {string} res.name - internal name of the resource
 * @param {string} res.type  - "audio", binary", "image", "json", "tmx", "tsx"
 * @param {string} res.src  - path and/or file name of the resource (for audio assets only the path is required)
 * @param {boolean} [res.stream] - Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
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
export function load(res: {
    name: string;
    type: string;
    src: string;
    stream?: boolean | undefined;
}, onload?: Function | undefined, onerror?: Function | undefined): number;
/**
 * unload specified resource to free memory
 * @name unload
 * @memberof loader
 * @public
 * @param {object} res
 * @param {string} res.name - internal name of the resource
 * @param {string} res.type  - "audio", binary", "image", "json", "tmx", "tsx"
 * @returns {boolean} true if unloaded
 * @example me.loader.unload({name: "avatar",  type:"image"});
 */
export function unload(res: {
    name: string;
    type: string;
}): boolean;
/**
 * unload all resources to free memory
 * @name unloadAll
 * @memberof loader
 * @public
 * @example me.loader.unloadAll();
 */
export function unloadAll(): void;
/**
 * return the specified TMX/TSX object
 * @name getTMX
 * @memberof loader
 * @public
 * @param {string} elt - name of the tmx/tsx element ("map1");
 * @returns {object} requested element or null if not found
 */
export function getTMX(elt: string): object;
/**
 * return the specified Binary object
 * @name getBinary
 * @memberof loader
 * @public
 * @param {string} elt - name of the binary object ("ymTrack");
 * @returns {object} requested element or null if not found
 */
export function getBinary(elt: string): object;
/**
 * return the specified Image Object
 * @name getImage
 * @memberof loader
 * @public
 * @param {string} image - name of the Image element ("tileset-platformer");
 * @returns {HTMLImageElement} requested element or null if not found
 */
export function getImage(image: string): HTMLImageElement;
/**
 * return the specified JSON Object
 * @name getJSON
 * @memberof loader
 * @public
 * @param {string} elt - name of the json file to load
 * @returns {object}
 */
export function getJSON(elt: string): object;
export * from "./settings.js";
/**
 * onload callback
 * @name onload
 * @default undefined
 * @memberof loader
 * @example
 * // set a callback when everything is loaded
 * me.loader.onload = this.loaded.bind(this);
 */
export let onload: any;
/**
 * onProgress callback<br>
 * each time a resource is loaded, the loader will fire the specified function,
 * giving the actual progress [0 ... 1], as argument, and an object describing the resource loaded
 * @name onProgress
 * @default undefined
 * @memberof loader
 * @example
 * // set a callback for progress notification
 * me.loader.onProgress = this.updateProgress.bind(this);
 */
export let onProgress: any;
