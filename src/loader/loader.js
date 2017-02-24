/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a small class to manage loading of stuff and manage resources
     * There is no constructor function for me.input.
     * @namespace me.loader
     * @memberOf me
     */
    me.loader = (function () {
        // hold public stuff in our singleton
        var api = {};

        // contains all the images loaded
        var imgList = {};
        // contains all the TMX loaded
        var tmxList = {};
        // contains all the binary files loaded
        var binList = {};
        // contains all the JSON files
        var jsonList = {};
        // baseURL
        var baseURL = {};

        // flag to check loading status
        var resourceCount = 0;
        var loadCount = 0;
        var timerId = 0;

        /**
         * check the loading status
         * @ignore
         */
        function checkLoadStatus(onload) {
            if (loadCount === resourceCount) {
                // wait 1/2s and execute callback (cheap workaround to ensure everything is loaded)
                if (onload || api.onload) {
                    // make sure we clear the timer
                    clearTimeout(timerId);
                    // trigger the onload callback
                    // we call either the supplied callback (which takes precedence) or the global one
                    var callback = onload || api.onload;
                    setTimeout(function () {
                        callback();
                        me.event.publish(me.event.LOADER_COMPLETE);
                    }, 300);
                }
                else {
                    console.error("no load callback defined");
                }
            }
            else {
                timerId = setTimeout(function() {
                    checkLoadStatus(onload);
                }, 100);
            }
        }

        /**
         * load Images
         * @example
         * preloadImages([
         *     { name : 'image1', src : 'images/image1.png'},
         *     { name : 'image2', src : 'images/image2.png'},
         *     { name : 'image3', src : 'images/image3.png'},
         *     { name : 'image4', src : 'images/image4.png'}
         * ]);
         * @ignore
         */
        function preloadImage(img, onload, onerror) {
            // create new Image object and add to list
            imgList[img.name] = new Image();
            imgList[img.name].onload = onload;
            imgList[img.name].onerror = onerror;
            if (typeof (api.crossOrigin) === "string") {
                imgList[img.name].crossOrigin = api.crossOrigin;
            }
            imgList[img.name].src = img.src + api.nocache;
        }

        /**
         * preload TMX files
         * @ignore
         */
        function preloadTMX(tmxData, onload, onerror) {
            function addToTMXList(data) {
                // set the TMX content
                tmxList[tmxData.name] = data;

                // add the tmx to the levelDirector
                if (tmxData.type === "tmx") {
                    me.levelDirector.addTMXLevel(tmxData.name);
                }
            }


            //if the data is in the tmxData object, don't get it via a XMLHTTPRequest
            if (tmxData.data) {
                addToTMXList(tmxData.data);
                onload();
                return;
            }

            var xmlhttp = new XMLHttpRequest();
            // check the data format ('tmx', 'json')
            var format = me.utils.getFileExtension(tmxData.src);

            if (xmlhttp.overrideMimeType) {
                if (format === "json") {
                    xmlhttp.overrideMimeType("application/json");
                }
                else {
                    xmlhttp.overrideMimeType("text/xml");
                }
            }

            xmlhttp.open("GET", tmxData.src + api.nocache, true);


            // set the callbacks
            xmlhttp.ontimeout = onerror;
            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState === 4) {
                    // status = 0 when file protocol is used, or cross-domain origin,
                    // (With Chrome use "--allow-file-access-from-files --disable-web-security")
                    if ((xmlhttp.status === 200) || ((xmlhttp.status === 0) && xmlhttp.responseText)) {
                        var result = null;

                        // parse response
                        switch (format) {
                            case "xml":
                            case "tmx":
                            case "tsx":
                                // ie9 does not fully implement the responseXML
                                if (me.device.ua.match(/msie/i) || !xmlhttp.responseXML) {
                                    if (window.DOMParser) {
                                        // manually create the XML DOM
                                        result = (new DOMParser()).parseFromString(xmlhttp.responseText, "text/xml");
                                    } else {
                                        throw new api.Error("XML file format loading not supported, use the JSON file format instead");
                                    }
                                }
                                else {
                                    result = xmlhttp.responseXML;
                                }
                                // converts to a JS object
                                var data = me.TMXUtils.parse(result);
                                switch (format) {
                                    case "tmx":
                                        result = data.map;
                                        break;

                                    case "tsx":
                                        result = data.tilesets[0];
                                        break;
                                }

                                break;

                            case "json":
                                result = JSON.parse(xmlhttp.responseText);
                                break;

                            default:
                                throw new api.Error("TMX file format " + format + "not supported !");
                        }

                        //set the TMX content
                        addToTMXList(result);

                        // fire the callback
                        onload();
                    }
                    else {
                        onerror();
                    }
                }
            };
            // send the request
            xmlhttp.send(null);
        }

        /**
         * preload TMX files
         * @ignore
         */
        function preloadJSON(data, onload, onerror) {
            var xmlhttp = new XMLHttpRequest();

            if (xmlhttp.overrideMimeType) {
                xmlhttp.overrideMimeType("application/json");
            }

            xmlhttp.open("GET", data.src + api.nocache, true);

            // set the callbacks
            xmlhttp.ontimeout = onerror;
            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState === 4) {
                    // status = 0 when file protocol is used, or cross-domain origin,
                    // (With Chrome use "--allow-file-access-from-files --disable-web-security")
                    if ((xmlhttp.status === 200) || ((xmlhttp.status === 0) && xmlhttp.responseText)) {
                        // get the Texture Packer Atlas content
                        jsonList[data.name] = JSON.parse(xmlhttp.responseText);
                        // fire the callback
                        onload();
                    }
                    else {
                        onerror();
                    }
                }
            };
            // send the request
            xmlhttp.send(null);
        }

        /**
         * preload Binary files
         * @ignore
         */
        function preloadBinary(data, onload, onerror) {
            var httpReq = new XMLHttpRequest();

            // load our file
            httpReq.open("GET", data.src + api.nocache, true);
            httpReq.responseType = "arraybuffer";
            httpReq.onerror = onerror;
            httpReq.onload = function () {
                var arrayBuffer = httpReq.response;
                if (arrayBuffer) {
                    var byteArray = new Uint8Array(arrayBuffer);
                    var buffer = [];
                    for (var i = 0; i < byteArray.byteLength; i++) {
                        buffer[i] = String.fromCharCode(byteArray[i]);
                    }
                    binList[data.name] = buffer.join("");
                    // callback
                    onload();
                }
            };
            httpReq.send();
        }

        /**
         * to enable/disable caching
         * @ignore
         */
        api.nocache = "";

        /*
         * PUBLIC STUFF
         */

        /**
         * onload callback
         * @public
         * @function
         * @name onload
         * @memberOf me.loader
         * @example
         * // set a callback when everything is loaded
         * me.loader.onload = this.loaded.bind(this);
         */
        api.onload = undefined;

        /**
         * onProgress callback<br>
         * each time a resource is loaded, the loader will fire the specified function,
         * giving the actual progress [0 ... 1], as argument, and an object describing the resource loaded
         * @public
         * @function
         * @name onProgress
         * @memberOf me.loader
         * @example
         * // set a callback for progress notification
         * me.loader.onProgress = this.updateProgress.bind(this);
         */
        api.onProgress = undefined;


        /**
         * crossOrigin attribute to configure the CORS requests for Image data element.<br>
         * By default (that is, when the attribute is not specified), CORS is not used at all. <br>
         * The "anonymous" keyword means that there will be no exchange of user credentials via cookies, <br>
         * client-side SSL certificates or HTTP authentication as described in the Terminology section of the CORS specification.<br>
         * @public
         * @type String
         * @name crossOrigin
         * @memberOf me.loader
         * @see https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes
         * @example
         *  // allow for cross-origin texture loading in WebGL
         * me.loader.crossOrigin = "anonymous";
         *
         * // set all ressources to be loaded
         * me.loader.preload(game.resources, this.loaded.bind(this));
         */
        api.crossOrigin = undefined;

        /**
         * Base class for Loader exception handling.
         * @name Error
         * @class
         * @memberOf me.loader
         * @constructor
         * @param {String} msg Error message.
         */
        api.Error = me.Error.extend({
            /**
             * @ignore
             */
            init : function (msg) {
                this._super(me.Error, "init", [ msg ]);
                this.name = "me.loader.Error";
            }
        });

        /**
         * just increment the number of already loaded resources
         * @ignore
         */
        api.onResourceLoaded = function (res) {
            // increment the loading counter
            loadCount++;

            // callback ?
            var progress = api.getLoadProgress();
            if (api.onProgress) {
                // pass the load progress in percent, as parameter
                api.onProgress(progress, res);
            }
            me.event.publish(me.event.LOADER_PROGRESS, [progress, res]);
        };

        /**
         * on error callback for image loading
         * @ignore
         */
        api.onLoadingError = function (res) {
            throw new api.Error("Failed loading resource " + res.src);
        };

        /**
         * enable the nocache mechanism
         * @ignore
         */
        api.setNocache = function (enable) {
            api.nocache = enable ? "?" + ~~(Math.random() * 10000000) : "";
        };

        /**
         * change the default baseURL for the given asset type.<br>
         * (this will prepend the asset URL and must finish with a '/')
         * @name setBaseURL
         * @memberOf me.loader
         * @public
         * @function
         * @param {String} type  "*", "audio", binary", "image", "json", "tmx", "tsx"
         * @param {String} [url="./"] default base URL
         * @example
         * // change the base URL relative address
         * me.loader.setBaseURL("audio", "data/audio/");
         * // change the base URL absolute address for all object types
         * me.loader.setBaseURL("*", "http://myurl.com/")
         */
        api.setBaseURL = function (type, url) {
            if (type !== "*") {
                baseURL[type] = url;
            } else {
                // "wildcards"
                baseURL["audio"] = url;
                baseURL["binary"] = url;
                baseURL["image"] = url;
                baseURL["json"] = url;
                baseURL["tmx"] = url;
                baseURL["tsx"] = url;
            }
        };


        /**
         * set all the specified game resources to be preloaded.
         * @name preload
         * @memberOf me.loader
         * @public
         * @function
         * @param {Object[]} resources
         * @param {String} resources.name internal name of the resource
         * @param {String} resources.type  "audio", binary", "image", "json", "tmx", "tsx"
         * @param {String} resources.src  path and/or file name of the resource (for audio assets only the path is required)
         * @param {Boolean} [resources.stream] set to true if you don't have to wait for the audio file to be fully downloaded
         * @param {function} [onload=me.loader.onload] function to be called when all resources are loaded
         * @param {boolean} [switchToLoadState=true] automatically switch to the loading screen
         * @example
         * game_resources = [
         *   // PNG tileset
         *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"},
         *   // PNG packed texture
         *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
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
         *   // binary file
         *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"},
         *   // JSON file (used for texturePacker)
         *   {name: "texture", type: "json", src: "data/gfx/texture.json"}
         * ];
         * ...
         * // set all resources to be loaded
         * me.loader.preload(game.resources, this.loaded.bind(this));
         */
        api.preload = function (res, onload, switchToLoadState) {
            // parse the resources
            for (var i = 0; i < res.length; i++) {
                resourceCount += api.load(
                    res[i],
                    api.onResourceLoaded.bind(api, res[i]),
                    api.onLoadingError.bind(api, res[i])
                );
            }
            // set the onload callback if defined
            if (typeof(onload) !== "undefined") {
                api.onload = onload;
            }

            if (switchToLoadState !== false) {
                // swith to the loading screen
                me.state.change(me.state.LOADING);
            }

            // check load status
            checkLoadStatus(onload);
        };

        /**
         * Load a single resource (to be used if you need to load additional resource during the game)
         * @name load
         * @memberOf me.loader
         * @public
         * @function
         * @param {Object} resource
         * @param {String} resource.name internal name of the resource
         * @param {String} resource.type  "audio", binary", "image", "json", "tmx", "tsx"
         * @param {String} resource.src  path and/or file name of the resource (for audio assets only the path is required)
         * @param {Boolean} [resource.stream] set to true if you don't have to wait for the audio file to be fully downloaded
         * @param {Function} onload function to be called when the resource is loaded
         * @param {Function} onerror function to be called in case of error
         * @example
         * // load an image asset
         * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, this.onload.bind(this), this.onerror.bind(this));
         *
         * // start loading music
         * me.loader.load({
         *     name   : "bgmusic",
         *     type   : "audio",
         *     src    : "data/audio/"
         * }, function () {
         *     me.audio.play("bgmusic");
         * });
         */
        api.load = function (res, onload, onerror) {
            // transform the url if necessary
            if (typeof (baseURL[res.type]) !== "undefined") {
                res.src = baseURL[res.type] + res.src;
            }
            // check ressource type
            switch (res.type) {
                case "binary":
                    // reuse the preloadImage fn
                    preloadBinary.call(this, res, onload, onerror);
                    return 1;

                case "image":
                    // reuse the preloadImage fn
                    preloadImage.call(this, res, onload, onerror);
                    return 1;

                case "json":
                    preloadJSON.call(this, res, onload, onerror);
                    return 1;

                case "tmx":
                case "tsx":
                    preloadTMX.call(this, res, onload, onerror);
                    return 1;

                case "audio":
                    me.audio.load(res, !!res.stream, onload, onerror);
                    return 1;

                default:
                    throw new api.Error("load : unknown or invalid resource type : " + res.type);
            }
        };

        /**
         * unload specified resource to free memory
         * @name unload
         * @memberOf me.loader
         * @public
         * @function
         * @param {Object} resource
         * @return {Boolean} true if unloaded
         * @example me.loader.unload({name: "avatar",  type:"image",  src: "data/avatar.png"});
         */
        api.unload = function (res) {
            switch (res.type) {
                case "binary":
                    if (!(res.name in binList)) {
                        return false;
                    }

                    delete binList[res.name];
                    return true;

                case "image":
                    if (!(res.name in imgList)) {
                        return false;
                    }
                    if (typeof(imgList[res.name].dispose) === "function") {
                        // cocoonJS implements a dispose function to free
                        // corresponding allocated texture in memory
                        imgList[res.name].dispose();
                    }
                    delete imgList[res.name];
                    return true;

                case "json":
                    if (!(res.name in jsonList)) {
                        return false;
                    }

                    delete jsonList[res.name];
                    return true;

                case "tmx":
                case "tsx":
                    if (!(res.name in tmxList)) {
                        return false;
                    }

                    delete tmxList[res.name];
                    return true;

                case "audio":
                    return me.audio.unload(res.name);

                default:
                    throw new api.Error("unload : unknown or invalid resource type : " + res.type);
            }
        };

        /**
         * unload all resources to free memory
         * @name unloadAll
         * @memberOf me.loader
         * @public
         * @function
         * @example me.loader.unloadAll();
         */
        api.unloadAll = function () {
            var name;

            // unload all binary resources
            for (name in binList) {
                if (binList.hasOwnProperty(name)) {
                    api.unload({
                        "name" : name,
                        "type" : "binary"
                    });
                }
            }

            // unload all image resources
            for (name in imgList) {
                if (imgList.hasOwnProperty(name)) {
                    api.unload({
                        "name" : name,
                        "type" : "image"
                    });
                }
            }

            // unload all tmx resources
            for (name in tmxList) {
                if (tmxList.hasOwnProperty(name)) {
                    api.unload({
                        "name" : name,
                        "type" : "tmx"
                    });
                }
            }

            // unload all in json resources
            for (name in jsonList) {
                if (jsonList.hasOwnProperty(name)) {
                    api.unload({
                        "name" : name,
                        "type" : "json"
                    });
                }
            }

            // unload all audio resources
            me.audio.unloadAll();
        };

        /**
         * return the specified TMX/TSX object
         * @name getTMX
         * @memberOf me.loader
         * @public
         * @function
         * @param {String} tmx name of the tmx/tsx element ("map1");
         * @return {XML|Object}
         */
        api.getTMX = function (elt) {
            // force as string
            elt = "" + elt;
            if (elt in tmxList) {
                return tmxList[elt];
            }
            else {
                //console.log ("warning %s resource not yet loaded!",name);
                return null;
            }
        };

        /**
         * return the specified Binary object
         * @name getBinary
         * @memberOf me.loader
         * @public
         * @function
         * @param {String} name of the binary object ("ymTrack");
         * @return {Object}
         */
        api.getBinary = function (elt) {
            // force as string
            elt = "" + elt;
            if (elt in binList) {
                return binList[elt];
            }
            else {
                //console.log ("warning %s resource not yet loaded!",name);
                return null;
            }

        };

        /**
         * return the specified Image Object
         * @name getImage
         * @memberOf me.loader
         * @public
         * @function
         * @param {String} Image name of the Image element ("tileset-platformer");
         * @return {Image}
         */
        api.getImage = function (elt) {
            // force as string
            elt = "" + elt;
            if (elt in imgList) {
                // return the corresponding Image object
                return imgList[elt];
            }
            else {
                //console.log ("warning %s resource not yet loaded!",name);
                return null;
            }

        };

        /**
         * return the specified JSON Object
         * @name getJSON
         * @memberOf me.loader
         * @public
         * @function
         * @param {String} Name for the json file to load
         * @return {Object}
         */
        api.getJSON = function (elt) {
            // force as string
            elt = "" + elt;
            if (elt in jsonList) {
                return jsonList[elt];
            }
            else {
                return null;
            }
        };

        /**
         * Return the loading progress in percent
         * @name getLoadProgress
         * @memberOf me.loader
         * @public
         * @function
         * @deprecated use callback instead
         * @return {Number}
         */
        api.getLoadProgress = function () {
            return loadCount / resourceCount;
        };

        // return our object
        return api;
    })();
})();
