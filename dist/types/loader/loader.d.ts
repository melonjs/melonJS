/**
 * enable the nocache mechanism
 * @ignore
 */
export function setNocache(enable?: boolean): void;
/**
 * Sets the options for the loader.
 * @memberof loader
 * @param {Object} options - The options to set.
 * @param {string} [options.crossOrigin] - The crossOrigin attribute to configure the CORS requests for Image and Video data element.
 * @param {boolean} [options.nocache] - Enable or disable the nocache mechanism.
 * @param {boolean} [options.withCredentials] - Indicates whether or not cross-site Access-Control requests should be made using credentials.
 * @example
 * // Set the crossOrigin attribute to "anonymous"
 * me.loader.setOptions({ crossOrigin: "anonymous" });
 *
 * // Enable the nocache mechanism
 * me.loader.setOptions({ nocache: true });
 *
 * // Enable withCredentials
 * me.loader.setOptions({ withCredentials: true });
 */
export function setOptions(options: {
    crossOrigin?: string | undefined;
    nocache?: boolean | undefined;
    withCredentials?: boolean | undefined;
}): void;
/**
 * change the default baseURL for the given asset type.<br>
 * (this will prepend the asset URL and must finish with a '/')
 * @name setBaseURL
 * @memberof loader
 * @public
 * @param {string} type  - "*", "audio", "video", "binary", "image", "json", "js", "tmx", "tsx"
 * @param {string} [url="./"] - default base URL
 * @example
 * // change the base URL relative address for audio assets
 * me.loader.setBaseURL("audio", "data/audio/");
 * // change the base URL absolute address for all object types
 * me.loader.setBaseURL("*", "http://myurl.com/")
 */
export function setBaseURL(type: string, url?: string | undefined): void;
/**
 * an asset definition to be used with the loader
 * @typedef {object} Asset
 * @memberof loader
 * @property {string} name - name of the asset
 * @property {string} type  - the type of the asset ("audio"|"binary"|"image"|"json"|"js"|"tmx"|"tmj"|"tsx"|"tsj"|"fontface"|"video")
 * @property {string} [src]  - path and/or file name of the resource (for audio assets only the path is required)
 * @property {string} [data]  - TMX data if not provided through a src url
 * @property {boolean} [stream=false] - Set to true to not to wait for large audio or video file to be downloaded before playing.
 * @property {boolean} [autoplay=false] - Set to true to automatically start playing audio or video when loaded or added to a scene (using autoplay might require user iteraction to enable it)
 * @property {boolean} [loop=false] - Set to true to automatically loop the audio or video when playing
 * @see loader.preload
 * @see loader.load
 * @example
 *   // PNG tileset
 *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"}
 *   // PNG packed texture
 *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
 *   // PNG base64 encoded image
 *   {name: "texture", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."}
 *   // TSX file
 *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"}
 *   // TMX level (XML & JSON)
 *   {name: "map1", type: "tmx", src: "data/map/map1.json"}
 *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"}
 *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}}
 *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}}
 *   // audio resources
 *   {name: "bgmusic", type: "audio",  src: "data/audio/"}
 *   {name: "cling",   type: "audio",  src: "data/audio/"}
 *   // base64 encoded audio resources
 *   {name: "band",   type: "audio",  src: "data:audio/wav;base64,..."}
 *   // binary file
 *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"}
 *   // JSON file (used for texturePacker)
 *   {name: "texture", type: "json", src: "data/gfx/texture.json"}
 *   // JavaScript file
 *   {name: "plugin", type: "js", src: "data/js/plugin.js"}
 *   // Font Face
 *   { name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')" }
 *   // video resources
 *   {name: "intro", type: "video",  src: "data/video/"}
 */
/**
 * specify a parser/preload function for the given asset type
 * @memberof loader
 * @param {string} type - asset type
 * @param {function} parserFn - parser function
 * @see Asset.type
 * @example
 * // specify a custom function for "abc" format
 * function customAbcParser(data, onload, onerror) {
 *    // preload and do something with the data
 *    let parsedData = doSomething(data);
 *    // when done, call the onload callback with the parsed data
 *    onload(parsedData);
 *    // in case of error, call the onerror callback
 *    onerror();
 *    // return the amount of asset parsed
 *    return 1
 * }
 * // set the parser for the custom format
 * loader.setParser("abc", customAbcParser);
 */
export function setParser(type: string, parserFn: Function): void;
/**
 * set all the specified game assets to be preloaded.
 * @memberof loader
 * @param {Asset[]} assets - list of assets to load
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
 *   {name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')"},
 *   // video resources
 *   {name: "intro", type: "video",  src: "data/video/"},
 *   // base64 encoded video asset
 *   me.loader.load({name: "avatar", type:"video", src: "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZ..."};
 * ];
 * ...
 * // set all resources to be loaded
 * me.loader.preload(game.assets, () => this.loaded());
 */
export function preload(assets: Asset[], onloadcb?: Function | undefined, switchToLoadState?: boolean | undefined): void;
/**
 * retry loading assets after a loading failure
 * @memberof loader
 * @param {string} src - src of asset to reload
 * @example
 *  event.on(
 *      event.LOADER_ERROR,
 *      (res) => {
 *          // custom function
 *          showErrorNotification({
 *              text: `Error during loading content: ${res.name}`,
 *              done: loader.reload(res.src);
 *          })
 *      }
 *  );
**/
export function reload(src: string): void;
/**
 * Load a single asset (to be used if you need to load additional asset(s) during the game)
 * @memberof loader
 * @param {Asset} asset
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource to be preloaded
 * @example
 * // load an image asset
 * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, () => this.onload(), () => this.onerror());
 * // load a base64 image asset
 *  me.loader.load({name: "avatar", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."};
 *  // load a base64 video asset
 *  me.loader.load({
 *     name: "avatar",
 *     type:"video",
 *     src: "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZ.."
 *  };
 * // start loading music
 * me.loader.load({
 *     name   : "bgmusic",
 *     type   : "audio",
 *     src    : "data/audio/"
 * }, function () {
 *     me.audio.play("bgmusic");
 * });
 */
export function load(asset: Asset, onload?: Function | undefined, onerror?: Function | undefined): number;
/**
 * unload the specified asset to free memory
 * @memberof loader
 * @param {Asset} asset
 * @returns {boolean} true if unloaded
 * @example me.loader.unload({name: "avatar",  type:"image"});
 */
export function unload(asset: Asset): boolean;
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
 * @param {string} elt - name of the json file
 * @returns {JSON}
 */
export function getJSON(elt: string): JSON;
/**
 * return the specified Video Object
 * @memberof loader
 * @param {string} elt - name of the video file
 * @returns {HTMLVideoElement}
 */
export function getVideo(elt: string): HTMLVideoElement;
/**
 * return the specified FontFace Object
 * @memberof loader
 * @param {string} elt - name of the font file
 * @returns {FontFace}
 */
export function getFont(elt: string): FontFace;
/**
 * a small class to manage loading of stuff and manage resources
 * @namespace loader
 */
export let nocache: string;
export let baseURL: {};
/**
 * crossOrigin attribute to configure the CORS requests for Image and Video data element.
 * By default (that is, when the attribute is not specified), CORS is not used at all.
 * The "anonymous" keyword means that there will be no exchange of user credentials via cookies,
 * client-side SSL certificates or HTTP authentication as described in the Terminology section of the CORS specification.<br>
 * @type {string}
 * @name crossOrigin
 * @default undefined
 * @see loader.setOptions
 * @memberof loader
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes
 * @example
 *  // allow for cross-origin texture loading
 * me.loader.crossOrigin = "anonymous";
 *
 * // set all ressources to be loaded
 * me.loader.preload(game.resources, () => this.loaded());
 */
export let crossOrigin: string;
/**
 * indicates whether or not cross-site Access-Control requests should be made using credentials such as cookies,
 * authorization headers or TLS client certificates. Setting withCredentials has no effect on same-site requests.
 * @public
 * @type {boolean}
 * @name withCredentials
 * @see loader.setOptions
 * @default false
 * @memberof loader
 * @see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials
 * @example
 *  // enable withCredentials
 * me.loader.withCredentials = true;
 *
 * // set all ressources to be loaded
 * me.loader.preload(game.resources, () => this.loaded());
 */
export let withCredentials: boolean;
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
/**
 * onError callback<br>
 * each time a resource loading is failed, the loader will fire the specified function giving the actual asset as argument.
 * @default undefined
 * @memberof loader
 * @type {function}
 * @example
 * // set a callback for error notification
 * me.loader.onError = this.loaderError.bind(this);
 */
export let onError: Function;
/**
 * an asset definition to be used with the loader
 */
export type Asset = object;
