/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { getBasename } from '../utils/file.js';
import { emit, LOADER_COMPLETE, LOADER_PROGRESS } from '../system/event.js';
import { load as load$1, unload as unload$1, unloadAll as unloadAll$1 } from '../audio/audio.js';
import state from '../state/state.js';
import { tmxList, jsonList, imgList, binList } from './cache.js';
import { preloadFontFace, preloadTMX, preloadJavascript, preloadJSON, preloadImage, preloadBinary } from './parser.js';
import { baseURL } from './settings.js';
export { crossOrigin, nocache, setBaseURL, setNocache, withCredentials } from './settings.js';

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

// flag to check loading status
let resourceCount = 0;
let loadCount = 0;
let timerId = 0;

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
    // increment the loading counter
    loadCount++;

    // currrent progress
    let progress = loadCount / resourceCount;
    emit(LOADER_PROGRESS, progress, res);
}

/**
 * on error callback for image loading
 * @ignore
 */
function onLoadingError(res) {
    throw new Error("Failed loading resource " + res.src);
}

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
function load(asset, onload, onerror) {
    // transform the url if necessary
    if (typeof (baseURL[asset.type]) !== "undefined") {
        asset.src = baseURL[asset.type] + asset.src;
    }
    // check ressource type
    switch (asset.type) {
        case "binary":
            // reuse the preloadImage fn
            preloadBinary.call(this, asset, onload, onerror);
            return 1;

        case "image":
            // reuse the preloadImage fn
            preloadImage.call(this, asset, onload, onerror);
            return 1;

        case "json":
            preloadJSON.call(this, asset, onload, onerror);
            return 1;

        case "js":
            preloadJavascript.call(this, asset, onload, onerror);
            return 1;

        case "tmx":
        case "tsx":
            preloadTMX.call(this, asset, onload, onerror);
            return 1;

        case "audio":
            load$1(asset, !!asset.stream, onload, onerror);
            return 1;

        case "fontface":
            preloadFontFace.call(this, asset, onload, onerror);
            return 1;

        default:
            throw new Error("load : unknown or invalid resource type : " + asset.type);
    }
}

/**
 * unload the specified asset to free memory
 * @memberof loader
 * @param {loader.Asset} asset
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
            // ??
            return true;

        case "tmx":
        case "tsx":
            if (!(asset.name in tmxList)) {
                return false;
            }

            delete tmxList[asset.name];
            return true;

        case "audio":
            return unload$1(asset.name);

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

    // unload all in json resources
    for (name in jsonList) {
        if (jsonList.hasOwnProperty(name)) {
            unload({
                "name" : name,
                "type" : "json"
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
 * @param {string} elt - name of the json file to load
 * @returns {object}
 */
function getJSON(elt) {
    // force as string
    elt = "" + elt;
    if (elt in jsonList) {
        return jsonList[elt];
    }
    return null;
}

export { baseURL, getBinary, getImage, getJSON, getTMX, load, onProgress, onload, preload, unload, unloadAll };
