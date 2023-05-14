/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
//  to enable/disable caching
let nocache = "";

// baseURL
let baseURL = {};


/**
 * crossOrigin attribute to configure the CORS requests for Image data element.
 * By default (that is, when the attribute is not specified), CORS is not used at all.
 * The "anonymous" keyword means that there will be no exchange of user credentials via cookies,
 * client-side SSL certificates or HTTP authentication as described in the Terminology section of the CORS specification.<br>
 * @type {string}
 * @name crossOrigin
 * @default undefined
 * @memberof loader
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes
 * @example
 *  // allow for cross-origin texture loading in WebGL
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
 * change the default baseURL for the given asset type.<br>
 * (this will prepend the asset URL and must finish with a '/')
 * @name setBaseURL
 * @memberof loader
 * @public
 * @param {string} type  - "*", "audio", binary", "image", "json", "js", "tmx", "tsx"
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

export { baseURL, crossOrigin, nocache, setBaseURL, setNocache, withCredentials };
