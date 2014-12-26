/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {
    
    // a basic cache object
    var TextureCache = Object.extend({
        /**
         * @ignore
         */
        init : function () {
            this.cache = {};
        },
        
       /**
         * @ignore
         */
        get : function (atlas, texture) {
            if (typeof(this.cache[texture]) === "undefined") {
                this.cache[texture] = new me.video.renderer.Texture(atlas, texture);
            }
            return this.cache[texture];
        }
    });

    /**
     * a base renderer object
     * @class
     * @extends Object
     * @memberOf me
     * @constructor     
     * @param {Canvas} canvas - the html canvas tag to draw to on screen.
     * @param {Number} game_width - the width of the canvas without scaling
     * @param {Number} game_height - the height of the canvas without scaling
     * @param {Object} [options] The renderer parameters
     * @param {Boolean} [options.doubleBuffering] - whether to enable double buffering.
     * @param {Number} [options.zoomX] - The actual width of the canvas with scaling applied
     * @param {Number} [options.zoomY] - The actual height of the canvas with scaling applied
     */
    me.Renderer = Object.extend(
    /** @scope me.Renderer.prototype */
    {
        /**
         * @ignore
         */
        init : function (c, width, height, options) {
            options = options || {};

            // rendering options
            this.transparent = !!(options.transparent);
            this.doubleBuffering = !!(options.doubleBuffering);
            this.antiAlias = !!(options.antiAlias);
            
            this.gameWidthZoom = options.zoomX || width;
            this.gameHeightZoom = options.zoomY || height;
            
            this.dimensions = { width: width, height: height };
               
            // canvas object and context
            this.canvas = c;
            this.context = null;
            
            //global color and stack for save/restore
            this.colorStack = [];
            this.globalColor = new me.Color(255, 255, 255, 1.0);
            
            this.cache = new TextureCache();
            
            return this;
        },

        /**
         * @private
         */
        applyRGBFilter : function (object, effect, option) {
            //create a output canvas using the given canvas or image size
            var _context = this.getContext2d(me.video.createCanvas(object.width, object.height, false));
            // get the pixels array of the give parameter
            var imgpix = me.utils.getPixels(object);
            // pointer to the pixels data
            var pix = imgpix.data;

            // apply selected effect
            var i, n;
            switch (effect) {
                case "b&w":
                    for (i = 0, n = pix.length; i < n; i += 4) {
                        var grayscale = (3 * pix[i] + 4 * pix[i + 1] + pix[i + 2]) >>> 3;
                        pix[i] = grayscale; // red
                        pix[i + 1] = grayscale; // green
                        pix[i + 2] = grayscale; // blue
                    }
                    break;

                case "brightness":
                    // make sure it's between 0.0 and 1.0
                    var brightness = Math.abs(option).clamp(0.0, 1.0);
                    for (i = 0, n = pix.length; i < n; i += 4) {

                        pix[i] *= brightness; // red
                        pix[i + 1] *= brightness; // green
                        pix[i + 2] *= brightness; // blue
                    }
                    break;

                case "transparent":
                    var refColor = me.pool.pull("me.Color").parseCSS(option);
                    var pixel = me.pool.pull("me.Color");
                    for (i = 0, n = pix.length; i < n; i += 4) {
                        pixel.setColor(pix[i], pix[i + 1], pix[i + 2]);
                        if (pixel.equals(refColor)) {
                            pix[i + 3] = 0;
                        }
                    }
                    me.pool.push(refColor);
                    me.pool.push(pixel);

                    break;


                default:
                    return null;
            }

            // put our modified image back in the new filtered canvas
            _context.putImageData(imgpix, 0, 0);

            // return it
            return _context;
        },

        /**
         * @ignore
         */
        blitSurface : function () {},

        /**
         * @ignore
         */
        prepareSurface : function () {},

        /**
         * return a reference to the screen canvas
         * @name getScreenCanvas
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Canvas}
         */
        getScreenCanvas : function () {
            return this.canvas;
        },

        /**
         * return a reference to the screen canvas corresponding 2d Context<br>
         * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
         * @name getScreenContext
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Context2d}
         */
        getScreenContext : function () {
            return this.context;
        },

        /**
         * Returns the 2D Context object of the given Canvas
         * `getContext2d` will also enable/disable antialiasing features based on global settings.
         * @name getContext2d
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Canvas} [canvas=canvas instance of the renderer]
         * @param {Boolean} [opaque=false] Use true to disable transparency
         * @return {Context2d}
         */
        getContext2d : function (c, opaque) {
            if (typeof c === "undefined" || c === null) {
                throw new me.video.Error(
                    "You must pass a canvas element in order to create " +
                    "a 2d context"
                );
            }

            if (typeof c.getContext === "undefined") {
                throw new me.video.Error(
                    "Your browser does not support HTML5 canvas."
                );
            }

            var _context;
            if (navigator.isCocoonJS) {
                // cocoonJS specific extension
                _context = c.getContext("2d", {
                    "antialias" : this.antiAlias,
                    "alpha" : !opaque
                });
            }
            else {
                _context = c.getContext("2d", {
                    "alpha" : !opaque
                });
            }
            if (!_context.canvas) {
                _context.canvas = c;
            }
            this.setImageSmoothing(_context, this.antiAlias);
            return _context;
        },

        /**
         * returns the current color of the context
         * @name getColor
         * @memberOf me.CanvasRenderer
         * @function
         * @return {me.Color}
         */
        getColor : function () {
            return this.globalColor.clone();
        },

        /**
         * return the width of the system Canvas
         * @name getWidth
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Number}
         */
        getWidth : function () {
            return this.dimensions.width;
        },

        /**
         * return the height of the system Canvas
         * @name getHeight
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Number}
         */
        getHeight : function () {
            return this.dimensions.height;
        },

        /**
         * return the current global alpha
         * @name globalAlpha
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Number}
         */
        globalAlpha : function () {
            return this.globalColor.alpha;
        },

        /**
         * enable/disable image smoothing (scaling interpolation) for the specified 2d Context<br>
         * (!) this might not be supported by all browsers <br>
         * @name setImageSmoothing
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Context2d} context
         * @param {Boolean} [enable=false]
         */
        setImageSmoothing : function (context, enable) {
            me.agent.setPrefixed("imageSmoothingEnabled", enable === true, context);
        }

    });

})();
