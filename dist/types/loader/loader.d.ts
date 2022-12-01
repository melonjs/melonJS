export default loader;
declare namespace loader {
    const nocache: string;
    const onload: any;
    const onProgress: any;
    const crossOrigin: string;
    const withCredentials: boolean;
    /**
     * just increment the number of already loaded resources
     * @ignore
     */
    function onResourceLoaded(res: any): void;
    /**
     * on error callback for image loading
     * @ignore
     */
    function onLoadingError(res: any): never;
    /**
     * enable the nocache mechanism
     * @ignore
     */
    function setNocache(enable: any): void;
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
    function setBaseURL(type: string, url?: string): void;
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
     * me.loader.preload(game.resources, this.loaded.bind(this));
     */
    function preload(res: {
        name: string;
        type: string;
        src: string;
        stream?: boolean;
    }[], onload?: Function, switchToLoadState?: boolean): void;
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
     * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, this.onload.bind(this), this.onerror.bind(this));
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
    function load(res: {
        name: string;
        type: string;
        src: string;
        stream?: boolean;
    }, onload?: Function, onerror?: Function): number;
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
    function unload(res: {
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
    function unloadAll(): void;
    /**
     * return the specified TMX/TSX object
     * @name getTMX
     * @memberof loader
     * @public
     * @param {string} elt - name of the tmx/tsx element ("map1");
     * @returns {object} requested element or null if not found
     */
    function getTMX(elt: string): any;
    /**
     * return the specified Binary object
     * @name getBinary
     * @memberof loader
     * @public
     * @param {string} elt - name of the binary object ("ymTrack");
     * @returns {object} requested element or null if not found
     */
    function getBinary(elt: string): any;
    /**
     * return the specified Image Object
     * @name getImage
     * @memberof loader
     * @public
     * @param {string} image - name of the Image element ("tileset-platformer");
     * @returns {HTMLImageElement} requested element or null if not found
     */
    function getImage(image: string): HTMLImageElement;
    /**
     * return the specified JSON Object
     * @name getJSON
     * @memberof loader
     * @public
     * @param {string} elt - name of the json file to load
     * @returns {object}
     */
    function getJSON(elt: string): any;
}
