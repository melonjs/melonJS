/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
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
        var wrapper = null;

        var deferResizeId = -1;

        var double_buffering = false;
        var auto_scale = false;
        var maintainAspectRatio = true;

        // max display size
        var maxWidth = Infinity;
        var maxHeight = Infinity;

        /*
         * PUBLIC STUFF
         */

        /**
         * Base class for Video exception handling.
         * @class
         * @ignore
         * @constructor
         * @name video.Error
         * @memberOf me
         * @param {String} msg Error message.
         */
        api.Error = me.Error.extend({
            init : function (msg) {
                this._super(me.Error, "init", [ msg ]);
                this.name = "me.video.Error";
            }
        });

        /**
         * init the "video" part<p>
         * return false if initialization failed (canvas not supported)
         * @name init
         * @memberOf me.video
         * @function
         * @param {String} wrapper the "div" element id to hold the canvas in the HTML file  (if null document.body will be used)
         * @param {RendererType} me.video.CANVAS. State which renderer you prefer to use. WebGL to be implemented
         * @param {Number} width game width
         * @param {Number} height game height
         * @param {Boolean} [double_buffering] enable/disable double buffering
         * @param {Number} [scale] enable scaling of the canvas ('auto' for automatic scaling)
         * @param {Boolean} [maintainAspectRatio] maintainAspectRatio when scaling the display
         * @return {Boolean}
         * @example
         * // init the video with a 480x320 canvas
         * if (!me.video.init('jsapp', 480, 320)) {
         *    alert("Sorry but your browser does not support html 5 canvas !");
         *    return;
         * }
         */
        api.init = function (wrapperid, rendererType, game_width, game_height, doublebuffering, scale, aspectRatio) {
            // ensure melonjs has been properly initialized
            if (!me.initialized) {
                throw new api.Error("me.video.init() called before engine initialization.");
            }
            // check given parameters
            double_buffering = doublebuffering || false;
            auto_scale  = (scale === "auto") || false;
            maintainAspectRatio = (typeof(aspectRatio) !== "undefined") ? aspectRatio : true;

            // normalize scale
            scale = (scale !== "auto") ? parseFloat(scale || 1.0) : 1.0;
            me.sys.scale = new me.Vector2d(scale, scale);

            // force double buffering if scaling is required
            if (auto_scale || (scale !== 1.0)) {
                double_buffering = true;
            }

            // default scaled size value
            var game_width_zoom = game_width * me.sys.scale.x;
            var game_height_zoom = game_height * me.sys.scale.y;

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
            canvas = api.createCanvas(game_width_zoom, game_height_zoom, true);
            
            // add our canvas
            if (wrapperid) {
                wrapper = document.getElementById(wrapperid);
            }
            // if wrapperid is not defined (null)
            if (!wrapper) {
                // add the canvas to document.body
                wrapper = document.body;
            }
            wrapper.appendChild(canvas);

            // stop here if not supported
            if (!canvas.getContext) {
                return false;
            }

            switch (rendererType) {
                case me.video.WEBGL:
                    this.renderer = me.WebGLRenderer.init(canvas.width, canvas.height, canvas);
                    break;
                default: // case me.video.CANVAS:. TODO: have default be AUTO detect
                    // get the 2D context
                    this.renderer = me.CanvasRenderer.init(canvas, double_buffering, game_width_zoom, game_height_zoom);
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

            // trigger an initial resize();
            me.video.onresize(null);

            me.game.init();

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

            if ((screencanvas === true) && (navigator.isCocoonJS) && (me.device.android2 !== true)) {
                // enable ScreenCanvas on cocoonJS
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
            return wrapper;
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

            if (auto_scale) {
                // get the parent container max size
                var parent = me.video.renderer.getScreenCanvas().parentNode;
                var _max_width = Math.min(maxWidth, parent.width || window.innerWidth);
                var _max_height = Math.min(maxHeight, parent.height || window.innerHeight);

                if (maintainAspectRatio) {
                    // make sure we maintain the original aspect ratio
                    var designRatio = me.video.renderer.getWidth() / me.video.renderer.getHeight();
                    var screenRatio = _max_width / _max_height;
                    if (screenRatio < designRatio) {
                        scaleX = scaleY = _max_width / me.video.renderer.getWidth();
                    }
                    else {
                        scaleX = scaleY = _max_height / me.video.renderer.getHeight();
                    }
                }
                else {
                    // scale the display canvas to fit with the parent container
                    scaleX = _max_width / me.video.renderer.getWidth();
                    scaleY = _max_height / me.video.renderer.getHeight();
                }

                // adjust scaling ratio based on the device pixel ratio
                scaleX *= me.device.getPixelRatio();
                scaleY *= me.device.getPixelRatio();

                // scale if required
                if (scaleX !== 1 || scaleY !== 1) {
                    if (deferResizeId >= 0) {
                        // cancel any previous pending resize
                        clearTimeout(deferResizeId);
                    }
                    deferResizeId = me.video.updateDisplaySize.defer(this, scaleX, scaleY);
                    return;
                }
            }
            // make sure we have the correct relative canvas position cached
            me.input._offset = me.video.getPos();
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
            this.renderer.resize(scaleX, scaleY);

            me.input._offset = me.video.getPos();
            // clear the timeout id
            deferResizeId = -1;
        };

        /**
         * enable/disable Alpha. Only applies to canvas renderer
         * @name setAlpha
         * @memberOf me.video
         * @function
         * @param {Boolean} enable
         */
        api.setAlpha = function (enable) {
            if (typeof this.renderer.setAlpha === "function") {
                this.renderer.setAlpha(enable);
            }
        };

        // return our api
        return api;
    })();

    me.video.CANVAS = 0;
    me.video.WEBGL = 1;

})();
