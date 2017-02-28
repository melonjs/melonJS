/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * video functions
     * There is no constructor function for me.video
     * @namespace me.video
     * @memberOf me
     */
    me.video = (function () {
        // hold public stuff in our apig
        var api = {};

        // internal variables
        var canvas = null;

        var deferResizeId = 0;

        var designRatio = 1;
        var designWidth = 0;
        var designHeight = 0;

        // max display size
        var maxWidth = Infinity;
        var maxHeight = Infinity;

        // default video settings
        var settings = {
            wrapper : undefined,
            renderer : 0, // canvas
            doubleBuffering : false,
            autoScale : false,
            scale : 1.0,
            scaleMethod : "fit",
            transparent : false,
            antiAlias : false,
            subPixel : false,
            verbose : false
        };


        /**
         * Auto-detect the best renderer to use
         * @ignore
         */
        function autoDetectRenderer(c, width, height, options) {
            try {
                return new me.WebGLRenderer(c, width, height, options);
            }
            catch (e) {
                return new me.CanvasRenderer(c, width, height, options);
            }
        }

        /*
         * PUBLIC STUFF
         */

        /**
         * Base class for Video exception handling.
         * @name Error
         * @class
         * @constructor
         * @memberOf me.video
         * @param {String} msg Error message.
         */
        api.Error = me.Error.extend({
            /**
             * @ignore
             */
            init : function (msg) {
                this._super(me.Error, "init", [ msg ]);
                this.name = "me.video.Error";
            }
        });

        /**
         * Select the HTML5 Canvas renderer
         * @public
         * @name CANVAS
         * @memberOf me.video
         * @enum {Number}
         */
        api.CANVAS = 0;

        /**
         * Select the WebGL renderer
         * @public
         * @name WEBGL
         * @memberOf me.video
         * @enum {Number}
         */
        api.WEBGL = 1;

        /**
         * Auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
         * @public
         * @name AUTO
         * @memberOf me.video
         * @enum {Number}
         */
        api.AUTO = 2;

        /**
         * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer). <br>
         * melonJS support various scaling mode : <br>
         *  - <i>`fit`</i> : Letterboxed; content is scaled to design aspect ratio <br>
         *  - <i>`fill-max`</i> : Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio <br>
         *  - <i>`flex-height`</i> : Canvas height is resized to fit; content is scaled to design aspect ratio <br>
         *  - <i>`flex-width`</i> : Canvas width is resized to fit; content is scaled to design aspect ratio <br>
         *  - <i>`stretch`</i> : Canvas is resized to fit; content is scaled to screen aspect ratio
         * @name init
         * @memberOf me.video
         * @function
         * @param {Number} width the width of the canvas viewport
         * @param {Number} height the height of the canvas viewport
         * @param {Object} [options] The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
         * @param {String} [options.wrapper=document.body] the "div" element name to hold the canvas in the HTML file
         * @param {Number} [options.renderer=me.video.CANVAS] renderer to use.
         * @param {Boolean} [options.doubleBuffering=false] enable/disable double buffering
         * @param {Number|String} [options.scale=1.0] enable scaling of the canvas ('auto' for automatic scaling)
         * @param {String} [options.scaleMethod="fit"] ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch') screen scaling modes
         * @param {Boolean} [options.useParentDOMSize=false] on browser devices, limit the canvas width and height to its parent container dimensions as returned by getBoundingClientRect(),
         *                                                   as opposed to the browser window dimensions
         * @param {Boolean} [options.transparent=false] whether to allow transparent pixels in the front buffer (screen)
         * @param {Boolean} [options.antiAlias=false] whether to enable or not video scaling interpolation
         * @return {Boolean} false if initialization failed (canvas not supported)
         * @see me.CanvasRenderer
         * @see me.WebGLRenderer
         * @example
         * // init the video with a 640x480 canvas
         * me.video.init(640, 480, {
         *     wrapper : "screen",
         *     renderer : me.video.CANVAS,
         *     scale : "auto",
         *     scaleMethod : "fit",
         *     doubleBuffering : true
         * });
         */
        api.init = function (game_width, game_height, options) {
            // ensure melonjs has been properly initialized
            if (!me.initialized) {
                throw new api.Error("me.video.init() called before engine initialization.");
            }

            // revert to default options if not defined
            settings = Object.assign(settings, options || {});

            // sanitize potential given parameters
            settings.doubleBuffering = !!(settings.doubleBuffering);
            settings.useParentDOMSize = !!(settings.useParentDOMSize);
            settings.autoScale = (settings.scale === "auto") || false;
            if (settings.scaleMethod.search(/^(fill-(min|max)|fit|flex(-(width|height))?|stretch)$/) !== 0) {
                settings.scaleMethod = "fit";
            }
            settings.transparent = !!(settings.transparent);

            // override renderer settings if &webgl is defined in the URL
            if (me.game.HASH.webgl === true) {
                settings.renderer = api.WEBGL;
            }

            // normalize scale
            settings.scale = (settings.autoScale) ? 1.0 : (+settings.scale || 1.0);
            me.sys.scale = new me.Vector2d(settings.scale, settings.scale);

            // force double buffering if scaling is required
            if (settings.autoScale || (settings.scale !== 1.0)) {
                settings.doubleBuffering = true;
            }

            // hold the requested video size ratio
            designRatio = game_width / game_height;
            designWidth = game_width;
            designHeight = game_height;

            // default scaled size value
            var game_width_zoom = game_width * me.sys.scale.x;
            var game_height_zoom = game_height * me.sys.scale.y;
            settings.zoomX = game_width_zoom;
            settings.zoomY = game_height_zoom;

            //add a channel for the onresize/onorientationchange event
            window.addEventListener(
                "resize",
                throttle(
                    100,
                    false,
                    function (event) {
                        me.event.publish(me.event.WINDOW_ONRESIZE, [ event ]);
                    }
                ),
                false
            );
            window.addEventListener(
                "orientationchange",
                function (event) {
                    me.event.publish(me.event.WINDOW_ONORIENTATION_CHANGE, [ event ]);
                },
                false
            );

            // register to the channel
            me.event.subscribe(
                me.event.WINDOW_ONRESIZE,
                me.video.onresize.bind(me.video)
            );
            me.event.subscribe(
                me.event.WINDOW_ONORIENTATION_CHANGE,
                me.video.onresize.bind(me.video)
            );

            // create the main screen canvas
            if (me.device.ejecta === true) {
                // a main canvas is already automatically created by Ejecta
                canvas = document.getElementById("canvas");
            } else {
                canvas = api.createCanvas(game_width_zoom, game_height_zoom, true);
            }

            // add our canvas
            if (options.wrapper) {
                settings.wrapper = document.getElementById(options.wrapper);
            }
            // if wrapperid is not defined (null)
            if (!settings.wrapper) {
                // add the canvas to document.body
                settings.wrapper = document.body;
            }
            settings.wrapper.appendChild(canvas);

            // stop here if not supported
            if (!canvas.getContext) {
                return false;
            }

            /**
             * A reference to the current video renderer
             * @public
             * @memberOf me.video
             * @name renderer
             * @type {me.Renderer|me.CanvasRenderer|me.WebGLRenderer}
             */
            switch (settings.renderer) {
                case api.WEBGL:
                    this.renderer = new me.WebGLRenderer(canvas, game_width, game_height, settings);
                    break;
                case api.AUTO:
                    this.renderer = autoDetectRenderer(canvas, game_width, game_height, settings);
                    break;
                default:
                    this.renderer = new me.CanvasRenderer(canvas, game_width, game_height, settings);
                    break;
            }

            // adjust CSS style for High-DPI devices
            var ratio = me.device.getPixelRatio();
            if (ratio > 1) {
                canvas.style.width = (canvas.width / ratio) + "px";
                canvas.style.height = (canvas.height / ratio) + "px";
            }


            // set max the canvas max size if CSS values are defined
            if (window.getComputedStyle) {
                var style = window.getComputedStyle(canvas, null);
                me.video.setMaxSize(parseInt(style.maxWidth, 10), parseInt(style.maxHeight, 10));
            }

            me.game.init();

            // trigger an initial resize();
            me.video.onresize();

            return true;
        };

        /**
         * return the relative (to the page) position of the specified Canvas
         * @name getPos
         * @memberOf me.video
         * @function
         * @param {Canvas} [canvas] system one if none specified
         * @return {me.Vector2d}
         */
        api.getPos = function (c) {
            c = c || this.renderer.getScreenCanvas();
            return (
                c.getBoundingClientRect ?
                c.getBoundingClientRect() : { left : 0, top : 0 }
            );
        };

        /**
         * set the max canvas display size (when scaling)
         * @name setMaxSize
         * @memberOf me.video
         * @function
         * @param {Number} width width
         * @param {Number} height height
         */
        api.setMaxSize = function (w, h) {
            // max display size
            maxWidth = w || Infinity;
            maxHeight = h || Infinity;
            // trigger a resize
            // defer it to ensure everything is properly intialized
            this.onresize.defer(this);

        };

        /**
         * Create and return a new Canvas
         * @name createCanvas
         * @memberOf me.video
         * @function
         * @param {Number} width width
         * @param {Number} height height
         * @param {Boolean} [screencanvas=false] set to true if this canvas renders directly to the screen
         * @return {Canvas}
         */
        api.createCanvas = function (width, height, screencanvas) {
            if (width === 0 || height === 0)  {
                throw new api.Error("width or height was zero, Canvas could not be initialized !");
            }

            var _canvas = document.createElement("canvas");

            if ((screencanvas === true) && (me.device.cocoon) && (me.device.android2 !== true)) {
                // http://docs.cocoon.io/article/screencanvas/
                _canvas.screencanvas = true;
            }

            _canvas.width = width || canvas.width;
            _canvas.height = height || canvas.height;

            return _canvas;
        };

        /**
         * return a reference to the wrapper
         * @name getWrapper
         * @memberOf me.video
         * @function
         * @return {Document}
         */
        api.getWrapper = function () {
            return settings.wrapper;
        };

        /**
         * callback for window resize event
         * @ignore
         */
        api.onresize = function () {
            // default (no scaling)
            var scaleX = 1, scaleY = 1;

            // check for orientation information
            if (typeof window.orientation !== "undefined") {
                me.device.orientation = window.orientation;
            }
            else {
                // is this actually not the best option since default "portrait"
                // orientation might vary between for example an ipad and and android tab
                me.device.orientation = (
                    window.outerWidth > window.outerHeight ?
                    90 : 0
                );
            }

            if (settings.autoScale) {
                var parentNodeWidth;
                var parentNodeHeight;
                var parentNode = me.video.renderer.getScreenCanvas().parentNode;
                if (typeof (parentNode) !== "undefined") {
                    if (settings.useParentDOMSize && typeof parentNode.getBoundingClientRect === "function") {
                        var rect = parentNode.getBoundingClientRect();
                        parentNodeWidth = rect.width || (rect.right - rect.left);
                        parentNodeHeight = rect.height || (rect.bottom - rect.top);
                    } else {
                        // for cased where DOM is not implemented and so parentNode (e.g. Ejecta)
                        parentNodeWidth = parentNode.width;
                        parentNodeHeight = parentNode.height;
                    }
                }
                var _max_width = Math.min(maxWidth, parentNodeWidth || window.innerWidth);
                var _max_height = Math.min(maxHeight, parentNodeHeight || window.innerHeight);
                var screenRatio = _max_width / _max_height;
                var sWidth = Infinity;
                var sHeight = Infinity;

                if (
                    (settings.scaleMethod === "fill-min" && screenRatio > designRatio) ||
                    (settings.scaleMethod === "fill-max" && screenRatio < designRatio) ||
                    (settings.scaleMethod === "flex-width")
                ) {
                    // resize the display canvas to fill the parent container
                    sWidth = Math.min(maxWidth, designHeight * screenRatio);
                    scaleX = scaleY = _max_width / sWidth;
                    sWidth = ~~(sWidth + 0.5);
                    this.renderer.resize(sWidth, designHeight);
                    me.game.viewport.resize(sWidth, designHeight);
                    /*
                     * XXX: Workaround for not updating container child-bounds
                     * automatically (it's expensive!)
                     */
                    me.game.world.updateChildBounds();
                }
                else if (
                    (settings.scaleMethod === "fill-min" && screenRatio < designRatio) ||
                    (settings.scaleMethod === "fill-max" && screenRatio > designRatio) ||
                    (settings.scaleMethod === "flex-height")
                ) {
                    // resize the display canvas to fill the parent container
                    sHeight = Math.min(maxHeight, designWidth * (_max_height / _max_width));
                    scaleX = scaleY = _max_height / sHeight;
                    sHeight = ~~(sHeight + 0.5);
                    this.renderer.resize(designWidth, sHeight);
                    me.game.viewport.resize(designWidth, sHeight);
                    /*
                     * XXX: Workaround for not updating container child-bounds
                     * automatically (it's expensive!)
                     */
                    me.game.world.updateChildBounds();
                }
                else if (settings.scaleMethod === "flex") {
                    // resize the display canvas to fill the parent container
                    this.renderer.resize(_max_width, _max_height);
                    me.game.viewport.resize(_max_width, _max_height);
                    /*
                     * XXX: Workaround for not updating container child-bounds
                     * automatically (it's expensive!)
                     */
                    me.game.world.updateChildBounds();
                }
                else if (settings.scaleMethod === "stretch") {
                    // scale the display canvas to fit with the parent container
                    scaleX = _max_width / designWidth;
                    scaleY = _max_height / designHeight;
                }
                else {
                    // scale the display canvas to fit the parent container
                    // make sure we maintain the original aspect ratio
                    if (screenRatio < designRatio) {
                        scaleX = scaleY = _max_width / designWidth;
                    }
                    else {
                        scaleX = scaleY = _max_height / designHeight;
                    }
                }

                // adjust scaling ratio based on the device pixel ratio
                scaleX *= me.device.getPixelRatio();
                scaleY *= me.device.getPixelRatio();

                if (deferResizeId) {
                    // cancel any previous pending resize
                    clearTimeout(deferResizeId);
                }
                deferResizeId = me.video.updateDisplaySize.defer(this, scaleX, scaleY);
            }
        };

        /**
         * Modify the "displayed" canvas size
         * @name updateDisplaySize
         * @memberOf me.video
         * @function
         * @param {Number} scaleX X scaling multiplier
         * @param {Number} scaleY Y scaling multiplier
         */
        api.updateDisplaySize = function (scaleX, scaleY) {
            // update the global scale variable
            me.sys.scale.set(scaleX, scaleY);

            // renderer resize logic
            this.renderer.scaleCanvas(scaleX, scaleY);
            me.game.repaint();

            // make sure we have the correct relative canvas position cached
            me.input._offset = me.video.getPos();

            // clear the timeout id
            deferResizeId = 0;
        };

        // return our api
        return api;
    })();

})();
