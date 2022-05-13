import Color from "./../../math/color.js";
import Matrix2d from "./../../math/matrix2.js";
import WebGLCompositor from "./webgl_compositor.js";
import Renderer from "./../renderer.js";
import TextureCache from "./../texture_cache.js";
import { TextureAtlas, createAtlas } from "./../texture.js";
import { createCanvas, renderer } from "./../video.js";
import * as event from "./../../system/event.js";
import pool from "./../../system/pooling.js";
import { isPowerOfTwo, nextPowerOfTwo } from "./../../math/math.js";


/**
 * @classdesc
 * a WebGL renderer object
 * @augments Renderer
 */
class WebGLRenderer extends Renderer {
    /**
     * @param {object} options The renderer parameters
     * @param {number} options.width The width of the canvas without scaling
     * @param {number} options.height The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
     * @param {boolean} [options.doubleBuffering=false] Whether to enable double buffering
     * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
     * @param {boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
     * @param {boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
     * @param {string} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
     * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
     * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
     * @param {WebGLCompositor} [options.compositor] A class that implements the compositor API
     */
    constructor(options) {

        // parent contructor
        super(options);

        /**
         * The WebGL version used by this renderer (1 or 2)
         * @name WebGLVersion
         * @memberof WebGLRenderer#
         * @type {number}
         * @default 1
         * @readonly
         */
        this.WebGLVersion = 1;

        /**
         * The vendor string of the underlying graphics driver.
         * @name GPUVendor
         * @memberof WebGLRenderer#
         * @type {string}
         * @default null
         * @readonly
         */
        this.GPUVendor = null;

        /**
         * The renderer string of the underlying graphics driver.
         * @name GPURenderer
         * @memberof WebGLRenderer#
         * @type {string}
         * @default null
         * @readonly
         */
        this.GPURenderer = null;

        /**
         * The WebGL context
         * @name gl
         * @memberof WebGLRenderer#
         * type {WebGLRenderingContext}
         */
        this.context = this.gl = this.getContextGL(this.getScreenCanvas(), options.transparent);

        /**
         * Maximum number of texture unit supported under the current context
         * @name maxTextures
         * @memberof WebGLRenderer#
         * @type {number}
         * @readonly
         */
        this.maxTextures = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);

        /**
         * @ignore
         */
        this._colorStack = [];

        /**
         * @ignore
         */
        this._matrixStack = [];

        /**
         * @ignore
         */
        this._scissorStack = [];

        /**
         * @ignore
         */
        this._blendStack = [];

        /**
         * The current transformation matrix used for transformations on the overall scene
         * @name currentTransform
         * @type {Matrix2d}
         * @memberof WebGLRenderer#
         */
        this.currentTransform = new Matrix2d();

        /**
         * The current compositor used by the renderer
         * @name currentCompositor
         * @type {WebGLCompositor}
         * @memberof WebGLRenderer#
         */
        this.currentCompositor = null;

        /**
         * The list of active compositors
         * @name compositors
         * @type {Map<WebGLCompositor>}
         * @memberof WebGLRenderer#
         */
        this.compositors = new Map();

        // Create a default compositor
        var compositor = new (this.settings.compositor || WebGLCompositor)(this);
        this.compositors.set("default", compositor);
        this.setCompositor(compositor);


        // default WebGL state(s)
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.disable(this.gl.SCISSOR_TEST);
        this.gl.enable(this.gl.BLEND);

        // set default mode
        this.setBlendMode(this.settings.blendMode);

        // get GPU vendor and renderer
        var debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo !== null) {
            this.GPUVendor = this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            this.GPURenderer = this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }

        // Create a texture cache
        this.cache = new TextureCache(this.maxTextures);

        // to simulate context lost and restore in WebGL:
        // var ctx = me.video.renderer.context.getExtension('WEBGL_lose_context');
        // ctx.loseContext()
        this.getScreenCanvas().addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            this.isContextValid = false;
            event.emit(event.ONCONTEXT_LOST, this);
        }, false );
        // ctx.restoreContext()
        this.getScreenCanvas().addEventListener("webglcontextrestored", () => {
            this.reset();
            this.isContextValid = true;
            event.emit(event.ONCONTEXT_RESTORED, this);
        }, false );
    }

    /**
     * Reset context state
     * @name reset
     * @memberof WebGLRenderer.prototype
     * @function
     */
    reset() {
        super.reset();

        this.compositors.forEach((compositor) => {
            if (this.isContextValid === false) {
                // on context lost/restore
                compositor.init(this);
            } else {
                compositor.reset();
            }
        });

        this.gl.disable(this.gl.SCISSOR_TEST);
        if (typeof this.fontContext2D !== "undefined" ) {
            this.createFontTexture(this.cache);
        }

    }

    /**
     * set the active compositor for this renderer
     * @name setCompositor
     * @function
     * @param {WebGLCompositor|string} compositor a compositor name or instance
     * @memberof WebGLRenderer.prototype
     * @function
     */
    setCompositor(compositor = "default") {

        if (typeof compositor === "string") {
            compositor = this.compositors.get(compositor);
        }

        if (typeof compositor === "undefined") {
            throw new Error("Invalid WebGL Compositor");
        }

        if (this.currentCompositor !== compositor) {
            if (this.currentCompositor !== null) {
                // flush the current compositor
                this.currentCompositor.flush();
            }
            // set given one as current
            this.currentCompositor = compositor;
        }
    }

    /**
     * Reset the gl transform to identity
     * @name resetTransform
     * @memberof WebGLRenderer.prototype
     * @function
     */
    resetTransform() {
        this.currentTransform.identity();
    }

    /**
     * @ignore
     */
    createFontTexture(cache) {
        if (typeof this.fontTexture === "undefined") {
            var canvas = this.backBufferCanvas;
            var width = canvas.width;
            var height = canvas.height;

            if (this.WebGLVersion === 1) {
                if (!isPowerOfTwo(width)) {
                    width = nextPowerOfTwo(canvas.width);
                }
                if (!isPowerOfTwo(height)) {
                    height = nextPowerOfTwo(canvas.height);
                }
            }

            var image = createCanvas(width, height, true);

            /**
             * @ignore
             */
            this.fontContext2D = this.getContext2d(image);

            /**
             * @ignore
             */
            this.fontTexture = new TextureAtlas(createAtlas(canvas.width, canvas.height, "fontTexture"), image, cache);
            this.currentCompositor.uploadTexture(this.fontTexture, 0, 0, 0);

        } else {
           // fontTexture was already created, just add it back into the cache
           cache.set(this.fontContext2D.canvas, this.fontTexture);
       }
    }

    /**
     * Create a pattern with the specified repetition
     * @name createPattern
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Image} image Source image
     * @param {string} repeat Define how the pattern should be repeated
     * @returns {TextureAtlas}
     * @see ImageLayer#repeat
     * @example
     * var tileable   = renderer.createPattern(image, "repeat");
     * var horizontal = renderer.createPattern(image, "repeat-x");
     * var vertical   = renderer.createPattern(image, "repeat-y");
     * var basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image, repeat) {

        if (renderer.WebGLVersion === 1 && (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height))) {
            var src = typeof image.src !== "undefined" ? image.src : image;
            throw new Error(
                "[WebGL Renderer] " + src + " is not a POT texture " +
                "(" + image.width + "x" + image.height + ")"
            );
        }

        var texture = new TextureAtlas(createAtlas(image.width, image.height, "pattern", repeat), image);

        // FIXME: Remove old cache entry and texture when changing the repeat mode
        this.currentCompositor.uploadTexture(texture);

        return texture;
    }

    /**
     * Flush the compositor to the frame buffer
     * @name flush
     * @memberof WebGLRenderer.prototype
     * @function
     */
    flush() {
        this.currentCompositor.flush();
    }

    /**
     * set/change the current projection matrix (WebGL only)
     * @name setProjection
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Matrix3d} matrix
     */
    setProjection(matrix) {
        super.setProjection(matrix);
        this.currentCompositor.setProjection(matrix);
    }

    /**
     * Clears the gl context with the given color.
     * @name clearColor
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Color|string} [color="#000000"] CSS color.
     * @param {boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(color = "#000000", opaque = false) {
        var glArray;

        if (color instanceof Color) {
            glArray = color.toArray();
        } else {
            var _color = pool.pull("me.Color");
            // reuse temporary the renderer default color object
            glArray = _color.parseCSS(color).toArray();
            pool.push(_color);
        }
        // clear gl context with the specified color
        this.currentCompositor.clearColor(glArray[0], glArray[1], glArray[2], (opaque === true) ? 1.0 : glArray[3]);
        this.currentCompositor.clear();

        // restore default clear Color black
        this.currentCompositor.clearColor(0.0, 0.0, 0.0, 0.0);

    }

    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @name clearRect
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x x axis of the coordinate for the rectangle starting point.
     * @param {number} y y axis of the coordinate for the rectangle starting point.
     * @param {number} width The rectangle's width.
     * @param {number} height The rectangle's height.
     */
    clearRect(x, y, width, height) {
        this.save();
        this.clipRect(x, y, width, height);
        this.clearColor();
        this.restore();
    }

    /**
     * @ignore
     */
    drawFont(bounds) {
        var fontContext = this.getFontContext();

        // Force-upload the new texture
        this.currentCompositor.uploadTexture(this.fontTexture, 0, 0, 0, true);

        // Add the new quad
        var uvs = this.fontTexture.getUVs(bounds.left + "," + bounds.top + "," + bounds.width + "," + bounds.height);
        this.currentCompositor.addQuad(
            this.fontTexture,
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            uvs[0],
            uvs[1],
            uvs[2],
            uvs[3],
            this.currentTint.toUint32()
        );

        // Clear font context2D
        fontContext.clearRect(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height
        );
    }

    /**
     * Draw an image to the gl context
     * @name drawImage
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
     * @param {number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {number} sh The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dw The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {number} dh The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (typeof sw === "undefined") {
            sw = dw = image.width;
            sh = dh = image.height;
            dx = sx;
            dy = sy;
            sx = 0;
            sy = 0;
        }
        else if (typeof dx === "undefined") {
            dx = sx;
            dy = sy;
            dw = sw;
            dh = sh;
            sw = image.width;
            sh = image.height;
            sx = 0;
            sy = 0;
        }

        if (this.settings.subPixel === false) {
            // clamp to pixel grid
            dx |= 0;
            dy |= 0;
        }

        var texture = this.cache.get(image);
        var uvs = texture.getUVs(sx + "," + sy + "," + sw + "," + sh);
        this.currentCompositor.addQuad(texture, dx, dy, dw, dh, uvs[0], uvs[1], uvs[2], uvs[3], this.currentTint.toUint32());
    }

    /**
     * Draw a pattern within the given rectangle.
     * @name drawPattern
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {TextureAtlas} pattern Pattern object
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @see WebGLRenderer#createPattern
     */
    drawPattern(pattern, x, y, width, height) {
        var uvs = pattern.getUVs("0,0," + width + "," + height);
        this.currentCompositor.addQuad(pattern, x, y, width, height, uvs[0], uvs[1], uvs[2], uvs[3], this.currentTint.toUint32());
    }


    /**
     * return a reference to the screen canvas corresponding WebGL Context
     * @name getScreenContext
     * @memberof WebGLRenderer.prototype
     * @function
     * @returns {WebGLRenderingContext}
     */
    getScreenContext() {
        return this.gl;
    }

    /**
     * Returns the WebGL Context object of the given Canvas
     * @name getContextGL
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {HTMLCanvasElement} canvas
     * @param {boolean} [transparent=true] use false to disable transparency
     * @returns {WebGLRenderingContext}
     */
    getContextGL(canvas, transparent) {
        if (typeof canvas === "undefined" || canvas === null) {
            throw new Error(
                "You must pass a canvas element in order to create " +
                "a GL context"
            );
        }

        if (typeof transparent !== "boolean") {
            transparent = true;
        }

        var attr = {
            alpha : transparent,
            antialias : this.settings.antiAlias,
            depth : false,
            stencil: true,
            preserveDrawingBuffer : false,
            premultipliedAlpha: transparent,
            powerPreference: this.settings.powerPreference,
            failIfMajorPerformanceCaveat : this.settings.failIfMajorPerformanceCaveat
        };

        var gl;

        // attempt to create a WebGL2 context if requested
        if (this.settings.preferWebGL1 === false) {
            gl = canvas.getContext("webgl2", attr);
            if (gl) {
                this.WebGLVersion = 2;
            }
        }

        // fallback to WebGL1
        if (!gl) {
            this.WebGLVersion = 1;
            gl = canvas.getContext("webgl", attr) || canvas.getContext("experimental-webgl", attr);
        }

        if (!gl) {
            throw new Error(
                "A WebGL context could not be created."
            );
        }

        return gl;
    }

    /**
     * Returns the WebGLContext instance for the renderer
     * return a reference to the system 2d Context
     * @name getContext
     * @memberof WebGLRenderer.prototype
     * @function
     * @returns {WebGLRenderingContext}
     */
    getContext() {
        return this.gl;
    }

    /**
     * set a blend mode for the given context. <br>
     * Supported blend mode between Canvas and WebGL remderer : <br>
     * - "normal" : this is the default mode and draws new content on top of the existing content <br>
     * <img src="images/normal-blendmode.png" width="510"/> <br>
     * - "multiply" : the pixels of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result. <br>
     * <img src="images/multiply-blendmode.png" width="510"/> <br>
     * - "additive or lighter" : where both content overlap the color is determined by adding color values. <br>
     * <img src="images/lighter-blendmode.png" width="510"/> <br>
     * - "screen" : The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply) <br>
     * <img src="images/screen-blendmode.png" width="510"/> <br>
     * @name setBlendMode
     * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {string} [mode="normal"] blend mode : "normal", "multiply", "lighter", "additive", "screen"
     * @param {WebGLRenderingContext} [gl]
     */
    setBlendMode(mode = "normal", gl = this.gl) {

        if (this.currentBlendMode !== mode) {
            this.flush();
            gl.enable(gl.BLEND);
            this.currentBlendMode = mode;

            switch (mode) {
                case "screen" :
                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
                    break;

                case "lighter" :
                case "additive" :
                    gl.blendFunc(gl.ONE, gl.ONE);
                    break;

                case "multiply" :
                    gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
                    break;

                default :
                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    this.currentBlendMode = "normal";
                    break;
            }
        }
    }

    /**
     * return a reference to the font 2d Context
     * @ignore
     */
    getFontContext() {
        if (typeof this.fontContext2D === "undefined" ) {
            // warn the end user about performance impact
            console.warn("[WebGL Renderer] WARNING : Using Standard me.Text with WebGL will severly impact performances !");
            // create the font texture if not done yet
            this.createFontTexture(this.cache);
        }
        return this.fontContext2D;
    }

    /**
     * restores the canvas context
     * @name restore
     * @memberof WebGLRenderer.prototype
     * @function
     */
    restore() {
        // do nothing if there is no saved states
        if (this._matrixStack.length !== 0) {
            var color = this._colorStack.pop();
            var matrix = this._matrixStack.pop();

            // restore the previous context
            this.currentColor.copy(color);
            this.currentTransform.copy(matrix);

            this.setBlendMode(this._blendStack.pop());

            // recycle objects
            pool.push(color);
            pool.push(matrix);
        }

        if (this._scissorStack.length !== 0) {
            // FIXME : prevent `scissor` object realloc and GC
            this.currentScissor.set(this._scissorStack.pop());
        } else {
            // turn off scissor test
            this.gl.disable(this.gl.SCISSOR_TEST);
            this.currentScissor[0] = 0;
            this.currentScissor[1] = 0;
            this.currentScissor[2] = this.backBufferCanvas.width;
            this.currentScissor[3] = this.backBufferCanvas.height;
        }
    }

    /**
     * saves the canvas context
     * @name save
     * @memberof WebGLRenderer.prototype
     * @function
     */
    save() {
        this._colorStack.push(this.currentColor.clone());
        this._matrixStack.push(this.currentTransform.clone());

        if (this.gl.isEnabled(this.gl.SCISSOR_TEST)) {
            // FIXME avoid slice and object realloc
            this._scissorStack.push(this.currentScissor.slice());
        }

        this._blendStack.push(this.getBlendMode());
    }

    /**
     * rotates the uniform matrix
     * @name rotate
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} angle in radians
     */
    rotate(angle) {
        this.currentTransform.rotate(angle);
    }

    /**
     * scales the uniform matrix
     * @name scale
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    scale(x, y) {
        this.currentTransform.scale(x, y);
    }

    /**
     * not used by this renderer?
     * @ignore
     */
    setAntiAlias(context, enable) {
        super.setAntiAlias(context, enable);
        // TODO: perhaps handle GLNEAREST or other options with texture binding
    }

    /**
     * Set the global alpha
     * @name setGlobalAlpha
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} alpha 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(alpha) {
        this.currentColor.alpha = alpha;
    }

    /**
     * Return the global alpha
     * @name getGlobalAlpha
     * @memberof WebGLRenderer.prototype
     * @function
     * @returns {number} global alpha value
     */
    getGlobalAlpha() {
        return this.currentColor.alpha;
    }

    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @name setColor
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Color|string} color css color string.
     */
    setColor(color) {
        var alpha = this.currentColor.alpha;
        this.currentColor.copy(color);
        this.currentColor.alpha *= alpha;
    }

    /**
     * Set the line width
     * @name setLineWidth
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} width Line width
     */
    setLineWidth(width) {
        this.getScreenContext().lineWidth(width);
    }

    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @name strokeArc
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     * @param {boolean} [fill=false]
     */
    strokeArc(x, y, radius, start, end, antiClockwise = false, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        this.path2D.beginPath();
        this.path2D.arc(x, y, radius, start, end, antiClockwise);
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINE_STRIP, this.path2D.points);
        } else {
            this.path2D.closePath();
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @name fillArc
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     */
    fillArc(x, y, radius, start, end, antiClockwise = false) {
        this.strokeArc(x, y, radius, start, end, antiClockwise, true);
    }

    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @name strokeEllipse
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeEllipse(x, y, w, h, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        this.path2D.beginPath();
        this.path2D.ellipse(x, y, w, h, 0, 0, 360);
        this.path2D.closePath();
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINE_LOOP, this.path2D.points);
        } else {
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @name fillEllipse
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     */
    fillEllipse(x, y, w, h) {
        this.strokeEllipse(x, y, w, h, false);
    }

    /**
     * Stroke a line of the given two points
     * @name strokeLine
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    strokeLine(startX, startY, endX, endY) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        this.path2D.beginPath();
        this.path2D.moveTo(startX, startY);
        this.path2D.lineTo(endX, endY);
        this.currentCompositor.drawVertices(this.gl.LINE_STRIP, this.path2D.points);
    }


    /**
     * Fill a line of the given two points
     * @name fillLine
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    fillLine(startX, startY, endX, endY) {
        this.strokeLine(startX, startY, endX, endY);
    }

    /**
     * Stroke a me.Polygon on the screen with a specified color
     * @name strokePolygon
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Polygon} poly the shape to draw
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokePolygon(poly, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        this.translate(poly.pos.x, poly.pos.y);
        this.path2D.beginPath();
        this.path2D.moveTo(poly.points[0].x, poly.points[0].y);
        var point;
        for (var i = 1; i < poly.points.length; i++) {
            point = poly.points[i];
            this.path2D.lineTo(point.x, point.y);
        }
        this.path2D.lineTo(poly.points[0].x, poly.points[0].y);
        this.path2D.closePath();
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINE_LOOP, this.path2D.points);
        } else {
            // draw all triangles
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
        this.translate(-poly.pos.x, -poly.pos.y);
    }

    /**
     * Fill a me.Polygon on the screen
     * @name fillPolygon
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Polygon} poly the shape to draw
     */
    fillPolygon(poly) {
        this.strokePolygon(poly, true);
    }

    /**
     * Draw a stroke rectangle at the specified coordinates
     * @name strokeRect
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeRect(x, y, width, height, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        this.path2D.beginPath();
        this.path2D.rect(x, y, width, height);
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINE_LOOP, this.path2D.points);
        } else {
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Draw a filled rectangle at the specified coordinates
     * @name fillRect
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRect(x, y, width, height) {
        this.strokeRect(x, y, width, height, true);
    }

    /**
     * Stroke a rounded rectangle at the specified coordinates
     * @name strokeRoundRect
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeRoundRect(x, y, width, height, radius, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        this.path2D.beginPath();
        this.path2D.roundRect(x, y, width, height, radius);
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINE_LOOP, this.path2D.points);
        } else {
            this.path2D.closePath();
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Draw a rounded filled rectangle at the specified coordinates
     * @name fillRoundRect
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     */
    fillRoundRect(x, y, width, height, radius) {
        this.strokeRoundRect(x, y, width, height, radius, true);
    }

    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @name setTransform
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Matrix2d} mat2d Matrix to transform by
     */
    setTransform(mat2d) {
        this.resetTransform();
        this.transform(mat2d);
    }

    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @name transform
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Matrix2d} mat2d Matrix to transform by
     */
    transform(mat2d) {
        var currentTransform = this.currentTransform;
        currentTransform.multiply(mat2d);
        if (this.settings.subPixel === false) {
            // snap position values to pixel grid
            var a = currentTransform.toArray();
            a[6] |= 0;
            a[7] |= 0;
        }
    }

    /**
     * Translates the uniform matrix by the given coordinates
     * @name translate
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    translate(x, y) {
        var currentTransform = this.currentTransform;
        currentTransform.translate(x, y);
        if (this.settings.subPixel === false) {
            // snap position values to pixel grid
            var a = currentTransform.toArray();
            a[6] |= 0;
            a[7] |= 0;
        }
    }

    /**
     * clip the given region from the original canvas. Once a region is clipped,
     * all future drawing will be limited to the clipped region.
     * You can however save the current region using the save(),
     * and restore it (with the restore() method) any time in the future.
     * (<u>this is an experimental feature !</u>)
     * @name clipRect
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    clipRect(x, y, width, height) {
        var canvas = this.backBufferCanvas;
        var gl = this.gl;
        // if requested box is different from the current canvas size
        if (x !== 0 || y !== 0 || width !== canvas.width || height !== canvas.height) {
            var currentScissor = this.currentScissor;
            if (gl.isEnabled(gl.SCISSOR_TEST)) {
                // if same as the current scissor box do nothing
                if (currentScissor[0] === x && currentScissor[1] === y &&
                    currentScissor[2] === width && currentScissor[3] === height) {
                        return;
                }
            }
            // flush the compositor
            this.flush();
            // turn on scissor test
            gl.enable(this.gl.SCISSOR_TEST);
            // set the scissor rectangle (note : coordinates are left/bottom)
            gl.scissor(
                // scissor does not account for currentTransform, so manually adjust
                x + this.currentTransform.tx,
                canvas.height -height -y -this.currentTransform.ty,
                width,
                height
            );
            // save the new currentScissor box
            currentScissor[0] = x;
            currentScissor[1] = y;
            currentScissor[2] = width;
            currentScissor[3] = height;
        } else {
            // turn off scissor test
            gl.disable(gl.SCISSOR_TEST);
        }
    }

    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @name setMask
     * @memberof WebGLRenderer.prototype
     * @function
     * @param {Rect|Polygon|Line|Ellipse} [mask] the shape defining the mask to be applied
     */
    setMask(mask) {
        var gl = this.gl;

        // flush the compositor
        this.flush();

        // Enable and setup GL state to write to stencil buffer
        gl.enable(gl.STENCIL_TEST);
        gl.clear(gl.STENCIL_BUFFER_BIT);
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.NOTEQUAL, 1, 1);
        gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);

        this.fill(mask);

        // flush the compositor
        this.flush();

        // Use stencil buffer to affect next rendering object
        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.EQUAL, 1, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    }

    /**
     * disable (remove) the rendering mask set through setMask.
     * @name clearMask
     * @see WebGLRenderer#setMask
     * @memberof WebGLRenderer.prototype
     * @function
     */
    clearMask() {
        // flush the compositor
        this.flush();
        this.gl.disable(this.gl.STENCIL_TEST);
    }
};

export default WebGLRenderer;
