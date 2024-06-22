/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { getBasename } from '../utils/file.js';
import { emit, LOADER_COMPLETE, LOADER_PROGRESS, LOADER_ERROR } from '../system/event.js';
import { unload as unload$1, unloadAll as unloadAll$1, load as load$1 } from '../audio/audio.js';
import state from '../state/state.js';
import { videoList, tmxList, fontList, jsonList, imgList, binList } from './cache.js';
import { preloadImage } from './parsers/image.js';
import { preloadFontFace } from './parsers/fontface.js';
import { preloadTMX } from './parsers/tmx.js';
import { preloadJSON } from './parsers/json.js';
import { preloadBinary } from './parsers/binary.js';
import { preloadJavascript } from './parsers/script.js';
import { preloadVideo } from './parsers/video.js';
import { warning } from '../lang/console.js';

/**
 * a small class to manage loading of stuff and manage resources
 * @namespace loader
 */


//  to enable/disable caching
let nocache = "";

// baseURL
let baseURL = {};

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
let crossOrigin;

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
let withCredentials = false;

/**
 * enable the nocache mechanism
 * @ignore
 */
function setNocache(enable = false) {
    nocache = enable ? "?" + ~~(Math.random() * 10000000) : "";
}

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
function setOptions(options) {
    if (options.crossOrigin !== undefined) {
        crossOrigin = options.crossOrigin;
    }
    if (options.nocache !== undefined) {
        setNocache(options.nocache);
    }
    if (options.withCredentials !== undefined) {
        withCredentials = options.withCredentials;
    }
}

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
function setBaseURL(type, url) {
    if (type !== "*") {
        baseURL[type] = url;
    } else {
        // "wildcards"
        baseURL["audio"] = url;
        baseURL["video"] = url;
        baseURL["binary"] = url;
        baseURL["image"] = url;
        baseURL["json"] = url;
        baseURL["js"] = url;
        baseURL["tmx"] = url;
        baseURL["tsx"] = url;
        // XXX ?
        //baseURL["fontface"] = url;
    }
}

/**
 * onload callback
 * @default undefined
 * @memberof loader
 * @type {function}
 * @example
 * // set a callback when everything is loaded
 * me.loader.onload = this.loaded.bind(this);
 */
let onload;

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
let onProgress;

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
let onError;

/**
 * list of parser function for supported format type
 */
let parsers = new Map();

/**
 * keep track if parsers were registered
 */
let parserInitialized = false;

// flag to check loading status
let resourceCount = 0;
let loadCount = 0;
let timerId = 0;

/**
 * Assets uploaded with an error
 */
const failureLoadedAssets = {};

/**
 * init all supported parsers
 * @ignore
 */
function initParsers() {
    setParser("binary", preloadBinary);
    setParser("image", preloadImage);
    setParser("json", preloadJSON);
    setParser("js", preloadJavascript);
    setParser("tmx", preloadTMX);
    setParser("tsx", preloadTMX);
    setParser("audio", load$1);
    setParser("fontface", preloadFontFace);
    setParser("video", preloadVideo);
    parserInitialized = true;
}

/**
 * check the loading status
 * @ignore
 */
function checkLoadStatus(onloadcb) {
    if (loadCount === resourceCount) {
        // wait 1/2s and execute callback (cheap workaround to ensure everything is loaded)
        if (typeof onloadcb === "function" || onload) {
            // make sure we clear the timer
            clearTimeout(timerId);
            // trigger the onload callback
            // we call either the supplied callback (which takes precedence) or the global one
            let callback = onloadcb || onload;
            setTimeout(() => {
                callback();
                emit(LOADER_COMPLETE);
            }, 300);
        }
        else {
            throw new Error("no load callback defined");
        }
    }
    else {
        timerId = setTimeout(() => {
            checkLoadStatus(onloadcb);
        }, 100);
    }
}

/**
 * just increment the number of already loaded resources
 * @ignore
 */
function onResourceLoaded(res) {
    delete failureLoadedAssets[res.src];
    // increment the loading counter
    loadCount++;

    // currrent progress
    let progress = loadCount / resourceCount;
    emit(LOADER_PROGRESS, progress, res);
}

/**
 * on error callback for image loading
 * @param {Asset} asset - asset that loaded with failure
 * @ignore
 */
function onLoadingError(res) {
    failureLoadedAssets[res.src] = res;
    if (this.onError) {
        this.onError(res);
    }
    emit(LOADER_ERROR, res);
    throw new Error("Failed loading resource " + res.src);
}

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
function setParser(type, parserFn) {
    if (typeof parserFn !== "function") {
        throw new Error("invalid parser function for " + type);
    }

    if (typeof parsers.get(type) !== "undefined") {
        warning("overriding parser for " + type + " format");
    }

    parsers.set(type, parserFn);
}

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
function preload(assets, onloadcb, switchToLoadState = true) {
    // parse the resources
    for (let i = 0; i < assets.length; i++) {
        resourceCount += load(
            assets[i],
            onResourceLoaded.bind(this, assets[i]),
            onLoadingError.bind(this, assets[i])
        );
    }
    // set the onload callback if defined
    if (typeof(onloadcb) !== "undefined") {
        onload = onloadcb;
    }

    if (switchToLoadState === true) {
        // swith to the loading screen
        state.change(state.LOADING);
    }

    // check load status
    checkLoadStatus(onload);
}

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
function reload(src) {
    const assetToReload = failureLoadedAssets[src];
    this.unload(assetToReload);
    resourceCount -= 1;
    resourceCount += this.load(
        assetToReload,
        this.onResourceLoaded.bind(this, assetToReload),
        this.onLoadingError.bind(this, assetToReload)
    );
    // check load status
    checkLoadStatus(this.onload);
}

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
function load(asset, onload, onerror) {

    // make sure all parsers have been initialized
    if (parserInitialized === false) {
        initParsers();
    }

    // transform the url if necessary
    if (typeof (baseURL[asset.type]) !== "undefined") {
        asset.src = baseURL[asset.type] + asset.src;
    }

    let parser = parsers.get(asset.type);

    if (typeof parser === "undefined") {
        throw new Error("load : unknown or invalid resource type : " + asset.type);
    }

    // parser returns the amount of asset to be loaded (usually 1 unless an asset is splitted into several ones)
    return parser.call(this, asset, onload, onerror, {
        nocache: nocache,
        crossOrigin: crossOrigin,
        withCredentials: withCredentials
    });
}

/**
 * unload the specified asset to free memory
 * @memberof loader
 * @param {Asset} asset
 * @returns {boolean} true if unloaded
 * @example me.loader.unload({name: "avatar",  type:"image"});
 */
function unload(asset) {
    switch (asset.type) {
        case "binary":
            if (!(asset.name in binList)) {
                return false;
            }

            delete binList[asset.name];
            return true;

        case "image":
            if (!(asset.name in imgList)) {
                return false;
            }
            delete imgList[asset.name];
            return true;

        case "json":
            if (!(asset.name in jsonList)) {
                return false;
            }

            delete jsonList[asset.name];
            return true;

        case "js":
            // ??
            return true;

        case "fontface":
            if (typeof typeof globalThis.document !== "undefined" && typeof globalThis.document.fonts !== "undefined") {
                globalThis.document.fonts.delete(fontList[asset.name]);
                delete fontList[asset.name];
                return true;
            }
            return false;

        case "tmx":
        case "tsx":
            if (!(asset.name in tmxList)) {
                return false;
            }

            delete tmxList[asset.name];
            return true;

        case "audio":
            return unload$1(asset.name);

        case "video":
            if (!(asset.name in videoList)) {
                return false;
            }

            delete videoList[asset.name];
            return true;

        default:
            throw new Error("unload : unknown or invalid resource type : " + asset.type);
    }
}

/**
 * unload all resources to free memory
 * @memberof loader
 * @example me.loader.unloadAll();
 */
function unloadAll() {
    let name;

    // unload all binary resources
    for (name in binList) {
        if (binList.hasOwnProperty(name)) {
            unload({
                "name" : name,
                "type" : "binary"
            });
        }
    }

    // unload all image resources
    for (name in imgList) {
        if (imgList.hasOwnProperty(name)) {
            unload({
                "name" : name,
                "type" : "image"
            });
        }
    }

    // unload all tmx resources
    for (name in tmxList) {
        if (tmxList.hasOwnProperty(name)) {
            unload({
                "name" : name,
                "type" : "tmx"
            });
        }
    }

    // unload all json resources
    for (name in jsonList) {
        if (jsonList.hasOwnProperty(name)) {
            unload({
                "name" : name,
                "type" : "json"
            });
        }
    }

    // unload all video resources
    for (name in videoList) {
        if (videoList.hasOwnProperty(name)) {
            unload({
                "name" : name,
                "type" : "json"
            });
        }
    }

    // unload all video resources
    for (name in fontList) {
        if (fontList.hasOwnProperty(name)) {
            unload({
                "name" : name,
                "type" : "font"
            });
        }
    }

    // unload all audio resources
    unloadAll$1();
}

/**
 * return the specified TMX/TSX object
 * @memberof loader
 * @param {string} elt - name of the tmx/tsx element ("map1");
 * @returns {object} requested element or null if not found
 */
function getTMX(elt) {
    // force as string
    elt = "" + elt;
    if (elt in tmxList) {
        return tmxList[elt];
    }
    return null;
}

/**
 * return the specified Binary object
 * @memberof loader
 * @param {string} elt - name of the binary object ("ymTrack");
 * @returns {object} requested element or null if not found
 */
function getBinary(elt) {
    // force as string
    elt = "" + elt;
    if (elt in binList) {
        return binList[elt];
    }
    return null;
}

/**
 * return the specified Image Object
 * @memberof loader
 * @param {string} image - name of the Image element ("tileset-platformer");
 * @returns {HTMLImageElement} requested element or null if not found
 */
function getImage(image) {
    // force as string and extract the base name
    image = getBasename("" + image);
    if (image in imgList) {
        // return the corresponding Image object
        return imgList[image];
    }
    return null;
}

/**
 * return the specified JSON Object
 * @memberof loader
 * @param {string} elt - name of the json file
 * @returns {JSON}
 */
function getJSON(elt) {
    // force as string
    elt = "" + elt;
    if (elt in jsonList) {
        return jsonList[elt];
    }
    return null;
}

/**
 * return the specified Video Object
 * @memberof loader
 * @param {string} elt - name of the video file
 * @returns {HTMLVideoElement}
 */
function getVideo(elt) {
    // force as string
    elt = "" + elt;
    if (elt in videoList) {
        return videoList[elt];
    }
    return null;
}

/**
 * return the specified FontFace Object
 * @memberof loader
 * @param {string} elt - name of the font file
 * @returns {FontFace}
 */
function getFont(elt) {
    // force as string
    elt = "" + elt;
    if (elt in fontList) {
        return fontList[elt];
    }
    return null;
}

export { baseURL, crossOrigin, getBinary, getFont, getImage, getJSON, getTMX, getVideo, load, nocache, onError, onProgress, onload, preload, reload, setBaseURL, setNocache, setOptions, setParser, unload, unloadAll, withCredentials };
