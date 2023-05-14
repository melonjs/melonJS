/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import Color from '../../math/color.js';
import Matrix2d from '../../math/matrix2.js';
import QuadCompositor from './compositors/quad_compositor.js';
import PrimitiveCompositor from './compositors/primitive_compositor.js';
import Renderer from '../renderer.js';
import TextureCache from '../texture/cache.js';
import { TextureAtlas, createAtlas } from '../texture/atlas.js';
import { renderer } from '../video.js';
import { emit, on, ONCONTEXT_LOST, ONCONTEXT_RESTORED, GAME_RESET, CANVAS_ONRESIZE } from '../../system/event.js';
import pool from '../../system/pooling.js';
import { isPowerOfTwo } from '../../math/math.js';

/**
 * @classdesc
 * a WebGL renderer object
 * @augments Renderer
 */
 class WebGLRenderer extends Renderer {
    /**
     * @param {object} options - The renderer parameters
     * @param {number} options.width - The width of the canvas without scaling
     * @param {number} options.height - The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] - The html canvas to draw to on screen
     * @param {boolean} [options.antiAlias=false] - Whether to enable anti-aliasing
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] - If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @param {boolean} [options.transparent=false] - Whether to enable transparency on the canvas
     * @param {boolean} [options.premultipliedAlpha=true] - in WebGL, whether the renderer will assume that colors have premultiplied alpha when canvas transparency is enabled
     * @param {boolean} [options.subPixel=false] - Whether to enable subpixel renderering (performance hit when enabled)
     * @param {boolean} [options.preferWebGL1=false] - if true the renderer will only use WebGL 1
     * @param {boolean} [options.depthTest="sorting"] - ~Experimental~ the default method to sort object on the z axis in WebGL ("sorting", "z-buffer")
     * @param {string} [options.powerPreference="default"] - a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
     * @param {number} [options.zoomX=width] - The actual width of the canvas with scaling applied
     * @param {number} [options.zoomY=height] - The actual height of the canvas with scaling applied
     * @param {Compositor} [options.compositor] - A class that implements the compositor API for sprite rendering
     */
    constructor(options) {
        // parent contructor
        super(options);

        /**
         * The WebGL version used by this renderer (1 or 2)
         * @type {number}
         * @default 1
         * @readonly
         */
        this.WebGLVersion = 1;

        /**
         * The vendor string of the underlying graphics driver.
         * @type {string}
         * @default undefined
         * @readonly
         */
        this.GPUVendor = undefined;

        /**
         * The renderer string of the underlying graphics driver.
         * @type {string}
         * @default undefined
         * @readonly
         */
        this.GPURenderer = undefined;

        /**
         * The WebGL context
         * @name gl
         * @type {WebGLRenderingContext}
         */
        this.context = this.gl = this.getContextGL(this.getCanvas(), options.transparent, options.depthTest === "z-buffer");

        /**
         * the vertex buffer used by this WebGL Renderer
         * @type {WebGLBuffer}
         */
        this.vertexBuffer = this.gl.createBuffer();

        /**
         * Maximum number of texture unit supported under the current context
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
         * @type {Matrix2d}
         */
        this.currentTransform = new Matrix2d();

        /**
         * The current compositor used by the renderer
         * @type {WebGLCompositor}
         */
        this.currentCompositor = undefined;

        /**
         * a reference to the current shader program used by the renderer
         * @type {WebGLProgram}
         */
        this.currentProgram = undefined;

        /**
         * The list of active compositors
         * @type {Map<WebGLCompositor>}
         */
        this.compositors = new Map();

        // bind the vertex buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

        // Create both quad and primitive compositor
        this.addCompositor(new (this.settings.compositor || QuadCompositor)(this), "quad", true);
        this.addCompositor(new (this.settings.compositor || PrimitiveCompositor)(this), "primitive");

        // depth Test settings
        this.depthTest = options.depthTest;

        // default WebGL state(s)
        if (this.depthTest === "z-buffer") {
            this.gl.enable(this.gl.DEPTH_TEST);
            // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/depthFunc
            this.gl.depthFunc(this.gl.LEQUAL);
            this.gl.depthMask(true);
        } else {
            this.gl.disable(this.gl.DEPTH_TEST);
            this.gl.depthMask(false);
        }

        this.gl.disable(this.gl.SCISSOR_TEST);
        this.gl.enable(this.gl.BLEND);

        // set default mode
        this.setBlendMode(this.settings.blendMode);

        // get GPU vendor and renderer
        let debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo !== null) {
            this.GPUVendor = this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            this.GPURenderer = this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }

        // a private property that when set will make `setCompositor`
        // to use this specific shader instead of the default one
        this.customShader = undefined;

        // Create a texture cache
        this.cache = new TextureCache(this.maxTextures);

        // set the renderer type
        this.type =  "WebGL" + this.WebGLVersion;

        // to simulate context lost and restore in WebGL:
        // let ctx = me.video.renderer.context.getExtension('WEBGL_lose_context');
        // ctx.loseContext()
        this.getCanvas().addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            this.isContextValid = false;
            emit(ONCONTEXT_LOST, this);
        }, false );
        // ctx.restoreContext()
        this.getCanvas().addEventListener("webglcontextrestored", () => {
            this.reset();
            this.isContextValid = true;
            emit(ONCONTEXT_RESTORED, this);
        }, false );

        // reset the renderer on game reset
        on(GAME_RESET, () => {
            this.reset();
        });

        // register to the CANVAS resize channel
        on(CANVAS_ONRESIZE, (width, height) => {
            this.flush();
            this.setViewport(0, 0, width, height);
        });
    }

    /**
     * Reset context state
     */
    reset() {
        super.reset();

        // clear gl context
        this.clear();

        // initial viewport size
        this.setViewport();

        // rebind the vertex buffer if required (e.g in case of context loss)
        if (this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING) !== this.vertexBuffer) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        }

        this.currentCompositor = undefined;
        this.currentProgram = undefined;
        this.customShader = undefined;

        this.compositors.forEach((compositor) => {
            if (this.isContextValid === false) {
                // on context lost/restore
                compositor.init(this);
            } else {
                compositor.reset();
            }
        });

        this.setCompositor("quad");

        this.gl.disable(this.gl.SCISSOR_TEST);
    }

    /**
     * add a new compositor to this renderer
     * @param {Compositor} compositor - a compositor instance
     * @param {String} name - a name uniquely identifying this compositor
     * @param {Boolean} [activate=false] - true if the given compositor should be set as the active one
     */
    addCompositor(compositor, name = "default", activate = false) {
        // make sure there is no existing compositor with the same name
        if (typeof this.compositors.get(name) !== "undefined") {
            throw new Error("Invalid Compositor name");
        }

        // add the new compositor
        this.compositors.set(name, compositor);

        if (activate === true) {
            // set as active one
            this.setCompositor(name);
        }
    }

    /**
     * set the active compositor for this renderer
     * @param {String} name - a compositor name
     * @param {GLShader} [shader] - an optional shader program to be used, instead of the default one, when activating the compositor
     * @return {Compositor} an instance to the current active compositor
     */
    setCompositor(name = "default", shader = this.customShader) {
        let compositor = this.compositors.get(name);

        if (typeof compositor === "undefined") {
            throw new Error("Invalid Compositor");
        }

        if (this.currentCompositor !== compositor) {
            if (this.currentCompositor !== undefined) {
                // flush the current compositor
                this.currentCompositor.flush();
            }
            // set as the active one
            this.currentCompositor = compositor;
        }

        if (name === "quad" && typeof shader === "object") {
            this.currentCompositor.useShader(shader);
        } else {
            // (re)bind the compositor with the default shader (program & attributes)
            this.currentCompositor.bind();
        }

        return this.currentCompositor;
    }

    /**
     * Reset the gl transform to identity
     */
    resetTransform() {
        this.currentTransform.identity();
    }

    /**
     * Create a pattern with the specified repetition
     * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - Source image to be used as the pattern's image
     * @param {string} repeat - Define how the pattern should be repeated
     * @returns {TextureAtlas}
     * @see ImageLayer#repeat
     * @example
     * let tileable   = renderer.createPattern(image, "repeat");
     * let horizontal = renderer.createPattern(image, "repeat-x");
     * let vertical   = renderer.createPattern(image, "repeat-y");
     * let basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image, repeat) {

        this.setCompositor("quad");

        if (renderer.WebGLVersion === 1 && (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height))) {
            let src = typeof image.src !== "undefined" ? image.src : image;
            throw new Error(
                "[WebGL Renderer] " + src + " is not a POT texture " +
                "(" + image.width + "x" + image.height + ")"
            );
        }

        let texture = new TextureAtlas(createAtlas(image.width, image.height, "pattern", repeat), image);

        // FIXME: Remove old cache entry and texture when changing the repeat mode
        this.currentCompositor.uploadTexture(texture);

        return texture;
    }

    /**
     * Flush the compositor to the frame buffer
     */
    flush() {
        this.currentCompositor.flush();
    }

    /**
     * set/change the current projection matrix (WebGL only)
     * @param {Matrix3d} matrix
     */
    setProjection(matrix) {
        super.setProjection(matrix);
        this.currentCompositor.setProjection(matrix);
    }

    /**
     * Sets the WebGL viewport, which specifies the affine transformation of x and y from normalized device coordinates to window coordinates
     * @param {number} [x = 0] - x the horizontal coordinate for the lower left corner of the viewport origin
     * @param {number} [y = 0] - y the vertical coordinate for the lower left corner of the viewport origin
     * @param {number} [w = width of the canvas] - the width of viewport
     * @param {number} [h = height of the canvas] - the height of viewport
     */
    setViewport(x = 0, y = 0, w = this.getCanvas().width, h = this.getCanvas().height) {
        this.gl.viewport(x, y, w, h);
    }

    /**
     * Clear the frame buffer
     */
    clear() {
        let gl = this.gl;
        gl.clearColor(0, 0, 0, this.settings.transparent ? 0.0 : 1.0);
        if (this.depthTest === "z-buffer") {
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        } else {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        }
    }

    /**
     * Clears the gl context with the given color.
     * @param {Color|string} [color="#000000"] - CSS color.
     * @param {boolean} [opaque=false] - Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(color = "#000000", opaque = false) {
        let glArray;
        let gl = this.gl;

        if (color instanceof Color) {
            glArray = color.toArray();
        } else {
            let _color = pool.pull("me.Color");
            // reuse temporary the renderer default color object
            glArray = _color.parseCSS(color).toArray();
            pool.push(_color);
        }

        // clear gl context with the specified color
        gl.clearColor(glArray[0], glArray[1], glArray[2], (opaque === true) ? 1.0 : glArray[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @param {number} x - x axis of the coordinate for the rectangle starting point.
     * @param {number} y - y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     */
    clearRect(x, y, width, height) {
        this.save();
        this.clipRect(x, y, width, height);
        this.clearColor();
        this.restore();
    }

    /**
     * Draw an image to the gl context
     * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - An element to draw into the context.
     * @param {number} sx - The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sy - The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sw - The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {number} sh - The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} dx - The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dy - The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dw - The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {number} dh - The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
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

        this.setCompositor("quad");

        let texture = this.cache.get(image);
        let uvs = texture.getUVs(sx + "," + sy + "," + sw + "," + sh);
        this.currentCompositor.addQuad(texture, dx, dy, dw, dh, uvs[0], uvs[1], uvs[2], uvs[3], this.currentTint.toUint32(this.getGlobalAlpha()));
    }

    /**
     * Draw a pattern within the given rectangle.
     * @param {TextureAtlas} pattern - Pattern object
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @see WebGLRenderer#createPattern
     */
    drawPattern(pattern, x, y, width, height) {
        let uvs = pattern.getUVs("0,0," + width + "," + height);
        this.setCompositor("quad");
        this.currentCompositor.addQuad(pattern, x, y, width, height, uvs[0], uvs[1], uvs[2], uvs[3], this.currentTint.toUint32(this.getGlobalAlpha()));
    }

    /**
     * Returns the WebGL Context object of the given canvas element
     * @param {HTMLCanvasElement} canvas
     * @param {boolean} [transparent=false] - use true to enable transparency
     * @param {boolean} [depth=false] - use true to enable depth buffer testing
     * @returns {WebGLRenderingContext}
     */
    getContextGL(canvas, transparent = false, depth = false) {
        if (typeof canvas === "undefined" || canvas === null) {
            throw new Error(
                "You must pass a canvas element in order to create " +
                "a GL context"
            );
        }

        let attr = {
            alpha : transparent,
            antialias : this.settings.antiAlias,
            depth : depth,
            stencil: true,
            preserveDrawingBuffer : false,
            premultipliedAlpha: transparent ? this.settings.premultipliedAlpha : false,
            powerPreference: this.settings.powerPreference,
            failIfMajorPerformanceCaveat : this.settings.failIfMajorPerformanceCaveat
        };

        let gl;

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
     * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
     * @param {string} [mode="normal"] - blend mode : "normal", "multiply", "lighter", "additive", "screen"
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
     * restores the canvas context
     */
    restore() {
        // do nothing if there is no saved states
        if (this._matrixStack.length !== 0) {
            let color = this._colorStack.pop();
            let matrix = this._matrixStack.pop();

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
            this.currentScissor[2] = this.getCanvas().width;
            this.currentScissor[3] = this.getCanvas().height;
        }
    }

    /**
     * saves the canvas context
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
     * @param {number} angle - in radians
     */
    rotate(angle) {
        this.currentTransform.rotate(angle);
    }

    /**
     * scales the uniform matrix
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
     * @param {number} alpha - 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(alpha) {
        this.currentColor.alpha = alpha;
    }

    /**
     * Return the global alpha
     * @returns {number} global alpha value
     */
    getGlobalAlpha() {
        return this.currentColor.alpha;
    }

    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @param {Color|string} color - css color string.
     */
    setColor(color) {
        let alpha = this.currentColor.alpha;
        this.currentColor.copy(color);
        this.currentColor.alpha *= alpha;
    }

    /**
     * Set the line width
     * @param {number} width - Line width
     */
    setLineWidth(width) {
        this.getContext().lineWidth(width);
    }

    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius
     * @param {number} start - start angle in radians
     * @param {number} end - end angle in radians
     * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
     * @param {boolean} [fill=false]
     */
    strokeArc(x, y, radius, start, end, antiClockwise = false, fill = false) {
        this.setCompositor("primitive");
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
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius
     * @param {number} start - start angle in radians
     * @param {number} end - end angle in radians
     * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
     */
    fillArc(x, y, radius, start, end, antiClockwise = false) {
        this.strokeArc(x, y, radius, start, end, antiClockwise, true);
    }

    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @param {number} x - ellipse center point x-axis
     * @param {number} y - ellipse center point y-axis
     * @param {number} w - horizontal radius of the ellipse
     * @param {number} h - vertical radius of the ellipse
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeEllipse(x, y, w, h, fill = false) {
        this.setCompositor("primitive");
        this.path2D.beginPath();
        this.path2D.ellipse(x, y, w, h, 0, 0, 360);
        this.path2D.closePath();
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINE_STRIP, this.path2D.points);
        } else {
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @param {number} x - ellipse center point x-axis
     * @param {number} y - ellipse center point y-axis
     * @param {number} w - horizontal radius of the ellipse
     * @param {number} h - vertical radius of the ellipse
     */
    fillEllipse(x, y, w, h) {
        this.strokeEllipse(x, y, w, h, false);
    }

    /**
     * Stroke a line of the given two points
     * @param {number} startX - the start x coordinate
     * @param {number} startY - the start y coordinate
     * @param {number} endX - the end x coordinate
     * @param {number} endY - the end y coordinate
     */
    strokeLine(startX, startY, endX, endY) {
        this.setCompositor("primitive");
        this.path2D.beginPath();
        this.path2D.moveTo(startX, startY);
        this.path2D.lineTo(endX, endY);
        this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
    }


    /**
     * Fill a line of the given two points
     * @param {number} startX - the start x coordinate
     * @param {number} startY - the start y coordinate
     * @param {number} endX - the end x coordinate
     * @param {number} endY - the end y coordinate
     */
    fillLine(startX, startY, endX, endY) {
        this.strokeLine(startX, startY, endX, endY);
    }

    /**
     * Stroke a me.Polygon on the screen with a specified color
     * @param {Polygon} poly - the shape to draw
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokePolygon(poly, fill = false) {
        this.setCompositor("primitive");
        this.translate(poly.pos.x, poly.pos.y);
        this.path2D.beginPath();

        let points = poly.points;
        for (let i = 1; i < points.length; i++) {
            this.path2D.moveTo(points[i-1].x, points[i-1].y);
            this.path2D.lineTo(points[i].x, points[i].y);
        }
        this.path2D.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        this.path2D.closePath();
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
        } else {
            // draw all triangles
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
        this.translate(-poly.pos.x, -poly.pos.y);
    }

    /**
     * Fill a me.Polygon on the screen
     * @param {Polygon} poly - the shape to draw
     */
    fillPolygon(poly) {
        this.strokePolygon(poly, true);
    }

    /**
     * Draw a stroke rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRect(x, y, width, height, fill = false) {
        this.setCompositor("primitive");
        this.path2D.beginPath();
        this.path2D.rect(x, y, width, height);
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
        } else {
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Draw a filled rectangle at the specified coordinates
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
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRoundRect(x, y, width, height, radius, fill = false) {
        this.setCompositor("primitive");
        this.path2D.beginPath();
        this.path2D.roundRect(x, y, width, height, radius);
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINE_STRIP, this.path2D.points);
        } else {
            this.path2D.closePath();
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Draw a rounded filled rectangle at the specified coordinates
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
     * Stroke a Point at the specified coordinates
     * @param {number} x
     * @param {number} y
     */
    strokePoint(x, y) {
        this.strokeLine(x, y, x + 1, y + 1);
    }

    /**
     * Draw a a point at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillPoint(x, y) {
        this.strokePoint(x, y);
    }

    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @param {Matrix2d} mat2d - Matrix to transform by
     */
    setTransform(mat2d) {
        this.resetTransform();
        this.transform(mat2d);
    }

    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @param {Matrix2d} mat2d - Matrix to transform by
     */
    transform(mat2d) {
        let currentTransform = this.currentTransform;
        currentTransform.multiply(mat2d);
        if (this.settings.subPixel === false) {
            // snap position values to pixel grid
            let a = currentTransform.toArray();
            a[6] |= 0;
            a[7] |= 0;
        }
    }

    /**
     * Translates the uniform matrix by the given coordinates
     * @param {number} x
     * @param {number} y
     */
    translate(x, y) {
        let currentTransform = this.currentTransform;
        currentTransform.translate(x, y);
        if (this.settings.subPixel === false) {
            // snap position values to pixel grid
            let a = currentTransform.toArray();
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
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    clipRect(x, y, width, height) {
        let canvas = this.getCanvas();
        let gl = this.gl;
        // if requested box is different from the current canvas size
        if (x !== 0 || y !== 0 || width !== canvas.width || height !== canvas.height) {
            let currentScissor = this.currentScissor;
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
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - a shape defining the mask to be applied
     * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
     */
    setMask(mask, invert = false) {
        let gl = this.gl;

        // flush the compositor
        this.flush();

        if (this.maskLevel === 0) {
            // Enable and setup GL state to write to stencil buffer
            gl.enable(gl.STENCIL_TEST);
            gl.clear(gl.STENCIL_BUFFER_BIT);
        }

        this.maskLevel++;

        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.EQUAL, this.maskLevel, 1);
        gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);


        // fill the given mask shape
        this.fill(mask);

        // flush the compositor
        this.flush();

        gl.colorMask(true, true, true, true);

        // Use stencil buffer to affect next rendering object
        if (invert === true) {
            gl.stencilFunc(gl.EQUAL, this.maskLevel + 1, 1);
        } else {
            gl.stencilFunc(gl.NOTEQUAL, this.maskLevel + 1, 1);
        }
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    }

    /**
     * disable (remove) the rendering mask set through setMask.
     * @see WebGLRenderer#setMask
     */
    clearMask() {
        if (this.maskLevel > 0) {
            // flush the compositor
            this.flush();
            this.maskLevel = 0;
            this.gl.disable(this.gl.STENCIL_TEST);
        }
    }
}

export { WebGLRenderer as default };
