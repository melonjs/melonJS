/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
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
 * additional import for TypeScript
 * @import Rect from "./../../geometries/rectangle.js";
 * @import RoundRect from "./../../geometries/roundrect.js";
 * @import Polygon from "./../../geometries/poly.js";
 * @import Line from "./../../geometries/line.js";
 * @import Ellipse from "./../../geometries/ellipse.js";
 * @import Matrix3d from "./../../math/matrix3.js";
 * @import Compositor from "./compositors/compositor.js";
 */

// list of supported compressed texture formats
let supportedCompressedTextureFormats;

/**
 * @classdesc
 * a WebGL renderer object
 * @augments Renderer
 */
class WebGLRenderer extends Renderer {
    /**
     * @param {ApplicationSettings} [options] - optional parameters for the renderer
     */
    constructor(options) {
        // parent contructor
        super(Object.assign(options, { context: "webgl" }));

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
        this.gl = this.renderTarget.context;

        /**
         * sets or returns the thickness of lines for shape drawing (limited to strokeLine, strokePolygon and strokeRect)
         * @type {number}
         * @default 1
         * @see WebGLRenderer#strokeLine
         * @see WebGLRenderer#strokePolygon
         * @see WebGLRenderer#strokeRect
         */
        this.lineWidth = 1;

        /**
         * sets or returns the shape used to join two line segments where they meet.
         * Out of the three possible values for this property: "round", "bevel", and "miter", only "round" is supported for now in WebGL
         * @type {string}
         * @default "round"
         */
        this.lineJoin = "round";

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
         * @type {Compositor}
         */
        this.currentCompositor = undefined;

        /**
         * a reference to the current shader program used by the renderer
         * @type {WebGLProgram}
         */
        this.currentProgram = undefined;

        /**
         * The list of active compositors
         * @type {Map<Compositor>}
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
        }, false);
        // ctx.restoreContext()
        this.getCanvas().addEventListener("webglcontextrestored", () => {
            this.reset();
            this.isContextValid = true;
            emit(ONCONTEXT_RESTORED, this);
        }, false);

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
     * The WebGL version used by this renderer (1 or 2)
     * @type {number}
     * @default 1
     */
    get WebGLVersion() {
        return this.renderTarget.WebGLVersion;
    }

    /**
     * return the list of supported compressed texture formats
     * @return {Object}
     */
    getSupportedCompressedTextureFormats() {
        if (typeof supportedCompressedTextureFormats === "undefined") {
            const gl = this.gl;
            supportedCompressedTextureFormats =  {
                astc: gl.getExtension("WEBGL_compressed_texture_astc") || this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_astc"),
                bptc: gl.getExtension("EXT_texture_compression_bptc") || this._gl.getExtension("WEBKIT_EXT_texture_compression_bptc"),
                s3tc: gl.getExtension("WEBGL_compressed_texture_s3tc") || this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc"),
                s3tc_srgb: gl.getExtension("WEBGL_compressed_texture_s3tc_srgb") || this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc_srgb"),
                pvrtc: gl.getExtension("WEBGL_compressed_texture_pvrtc") || this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc"),
                etc1: gl.getExtension("WEBGL_compressed_texture_etc1") || this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_etc1"),
                etc2: gl.getExtension("WEBGL_compressed_texture_etc") || gl.getExtension("WEBKIT_WEBGL_compressed_texture_etc") || gl.getExtension("WEBGL_compressed_texture_es3_0")
            };
        }
        return supportedCompressedTextureFormats;
    }

    /**
     * return true if the given compressed texture format is supported
     * @param {Number} format
     * @returns
     */
    hasSupportedCompressedFormats(format) {
        const supportedFormats = this.getSupportedCompressedTextureFormats();
        for (var supportedFormat in supportedFormats) {
            for (var extension in supportedFormats[supportedFormat]) {
                if (format === supportedFormats[supportedFormat][extension]) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Reset context state
     */
    reset() {
        super.reset();

        // clear all stacks
        this._colorStack.forEach((color) => {
            pool.push(color);
        });
        this._matrixStack.forEach((matrix) => {
            pool.push(matrix);
        });
        this._colorStack.length = 0;
        this._matrixStack.length = 0;
        this._blendStack.length = 0;

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
     * @param {string} name - a name uniquely identifying this compositor
     * @param {boolean} [activate=false] - true if the given compositor should be set as the active one
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
     * @param {string} name - a compositor name
     * @param {GLShader} [shader] - an optional shader program to be used, instead of the default one, when activating the compositor
     * @returns {Compositor} an instance to the current active compositor
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
     * @returns {TextureAtlas} the patterned texture created
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
     * @param {Matrix3d} matrix - the new projection matrix
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
        this.lineWidth = 1;
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
        // force reuploading if the given image is a HTMLVideoElement
        let reupload = typeof image.videoWidth !== "undefined";
        let texture = this.cache.get(image);
        let uvs = texture.getUVs(sx + "," + sy + "," + sw + "," + sh);
        this.currentCompositor.addQuad(texture, dx, dy, dw, dh, uvs[0], uvs[1], uvs[2], uvs[3], this.currentTint.toUint32(this.getGlobalAlpha()), reupload);
    }

    /**
     * Draw a pattern within the given rectangle.
     * @param {TextureAtlas} pattern - Pattern object
     * @param {number} x - x position where to draw the pattern
     * @param {number} y - y position where to draw the pattern
     * @param {number} width - width of the pattern
     * @param {number} height - height of the pattern
     * @see WebGLRenderer#createPattern
     */
    drawPattern(pattern, x, y, width, height) {
        let uvs = pattern.getUVs("0,0," + width + "," + height);
        this.setCompositor("quad");
        this.currentCompositor.addQuad(pattern, x, y, width, height, uvs[0], uvs[1], uvs[2], uvs[3], this.currentTint.toUint32(this.getGlobalAlpha()));
    }


    /**
     * starts a new path by emptying the list of sub-paths. Call this method when you want to create a new path
     * @example
     * // First path
     * renderer.beginPath();
     * renderer.setColor("blue");
     * renderer.moveTo(20, 20);
     * renderer.lineTo(200, 20);
     * renderer.stroke();
     * // Second path
     * renderer.beginPath();
     * renderer.setColor("green");
     * renderer.moveTo(20, 20);
     * renderer.lineTo(120, 120);
     * renderer.stroke();
     */
    beginPath() {
        this.path2D.beginPath();
    }

    /**
     * begins a new sub-path at the point specified by the given (x, y) coordinates.
     * @param {number} x - The x axis of the point.
     * @param {number} y - The y axis of the point.
     */
    moveTo(x, y) {
        this.path2D.moveTo(x, y);
    }

    /**
     * adds a straight line to the current sub-path by connecting the sub-path's last point to the specified (x, y) coordinates.
     */
    lineTo(x, y) {
        this.path2D.lineTo(x, y);
    }

    /**
     * creates a rectangular path whose starting point is at (x, y) and whose size is specified by width and height.
     * @param {number} x - The x axis of the coordinate for the rectangle starting point.
     * @param {number} y - The y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     */
    rect(x, y, width, height) {
        this.path2D.rect(x, y, width, height);
    }

    /**
     * adds a rounded rectangle to the current path.
     * @param {number} x - The x axis of the coordinate for the rectangle starting point.
     * @param {number} y - The y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     * @param {number} radius - The corner radius.
     */
    roundRect(x, y, width, height, radii) {
        this.path2D.roundRect(x, y, width, height, radii);
    }

    /**
     * stroke the given shape or the current defined path
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [shape] - a shape object to stroke
     * @param {boolean} [fill=false] - fill the shape with the current color if true
     */
    stroke(shape, fill) {
        this.setCompositor("primitive");
        if (typeof shape === "undefined") {
            if (fill === true) {
                // draw all triangles
                this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
            } else {
                this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
            }
        } else {
            super.stroke(shape, fill);
        }
    }

    /**
     * fill the given shape or the current defined path
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [shape] - a shape object to fill
     */
    fill(shape) {
        this.stroke(shape, true);
    }

    /**
     * add a straight line from the current point to the start of the current sub-path. If the shape has already been closed or has only one point, this function does nothing
    */
    closePath() {
        this.path2D.closePath();
    }

    /**
     * Returns the WebGLContext instance for the renderer
     * return a reference to the system 2d Context
     * @returns {WebGLRenderingContext} the current WebGL context
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
     * @param {WebGLRenderingContext} [gl] - a WebGL context
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
     * restores the most recently saved renderer state by popping the top entry in the drawing state stack
     * @example
     * // Save the current state
     * renderer.save();
     *
     * // apply a transform and draw a rect
     * renderer.tranform(matrix);
     * renderer.fillRect(10, 10, 100, 100);
     *
     * // Restore to the state saved by the most recent call to save()
     * renderer.restore();
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
            const canvas = this.getCanvas();
            // turn off scissor test
            this.gl.disable(this.gl.SCISSOR_TEST);
            this.currentScissor[0] = 0;
            this.currentScissor[1] = 0;
            this.currentScissor[2] = canvas.width;
            this.currentScissor[3] = canvas.height;
        }
    }

    /**
     * saves the entire state of the renderer by pushing the current state onto a stack.
     * @example
     * // Save the current state
     * renderer.save();
     *
     * // apply a transform and draw a rect
     * renderer.tranform(matrix);
     * renderer.fillRect(10, 10, 100, 100);
     *
     * // Restore to the state saved by the most recent call to save()
     * renderer.restore();
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
     * adds a rotation to the transformation matrix.
     * @param {number} angle - the rotation angle, clockwise in radians
     * @example
     * // Rotated rectangle
     * renderer.rotate((45 * Math.PI) / 180);
     * renderer.setColor("red");
     * renderer.fillRect(10, 10, 100, 100);
     *
     * // Reset transformation matrix to the identity matrix
     * renderer.setTransform(1, 0, 0, 1, 0, 0);
     */
    rotate(angle) {
        this.currentTransform.rotate(angle);
    }

    /**
     * adds a scaling transformation to the renderer units horizontally and/or vertically
     * @param {number} x - Scaling factor in the horizontal direction. A negative value flips pixels across the vertical axis. A value of 1 results in no horizontal scaling.
     * @param {number} y - Scaling factor in the vertical direction. A negative value flips pixels across the horizontal axis. A value of 1 results in no vertical scaling
     */
    scale(x, y) {
        this.currentTransform.scale(x, y);
    }

    /**
     * not used by this renderer?
     * @param {boolean} [enable=false]
     * @ignore
     */
    setAntiAlias(enable = false) {
        super.setAntiAlias(enable);
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
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius - arc radius
     * @param {number} start - start angle in radians
     * @param {number} end - end angle in radians
     * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeArc(x, y, radius, start, end, antiClockwise = false, fill = false) {
        this.setCompositor("primitive");
        this.path2D.beginPath();
        this.path2D.arc(x, y, radius, start, end, antiClockwise);
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
        } else {
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius - arc radius
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
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
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
        this.strokeEllipse(x, y, w, h, true);
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
        if (this.lineWidth === 1) {
            this.path2D.beginPath();
            this.path2D.moveTo(startX, startY);
            this.path2D.lineTo(endX, endY);
            this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
        } else if (this.lineWidth > 1) {
            const halfWidth = this.lineWidth / 2;
            const angle = Math.atan2(endY - startY, endX - startX);
            const dx = Math.sin(angle) * halfWidth;
            const dy = Math.cos(angle) * halfWidth;
            const x1 = startX - dx;
            const y1 = startY + dy;
            const x2 = startX + dx;
            const y2 = startY - dy;
            const x3 = endX + dx;
            const y3 = endY - dy;
            const x4 = endX - dx;
            const y4 = endY + dy;

            this.path2D.beginPath();
            this.path2D.moveTo(x1, y1);
            this.path2D.lineTo(x2, y2);
            this.path2D.lineTo(x3, y3);
            this.path2D.lineTo(x4, y4);
            this.path2D.closePath();
            // draw all triangles
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
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
     * Stroke a Polygon on the screen with a specified color
     * @param {Polygon} poly - the shape to draw
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokePolygon(poly, fill = false) {
        const points = poly.points;
        const len = points.length;

        this.translate(poly.pos.x, poly.pos.y);

        if (fill === false && this.lineWidth > 1) {
            const radius = this.lineWidth / 2;
            for (let i = 0; i < len - 1; i++) {
                const curPoint = points[i];
                const nextPoint = points[i + 1];
                this.fillEllipse(nextPoint.x, nextPoint.y, radius, radius);
                this.strokeLine(curPoint.x, curPoint.y, nextPoint.x, nextPoint.y);
            }
            const lastPoint = points[len - 1];
            const firstPoint = points[0];
            if (!lastPoint.equals(firstPoint)) {
                this.fillEllipse(firstPoint.x, firstPoint.y, radius, radius);
                this.strokeLine(lastPoint.x, lastPoint.y, firstPoint.x, firstPoint.y);
            }
        } else {
            this.setCompositor("primitive");
            this.path2D.beginPath();
            for (let i = 0; i < len - 1; i++) {
                const curPoint = points[i];
                const nextPoint = points[i + 1];
                this.path2D.moveTo(curPoint.x, curPoint.y);
                this.path2D.lineTo(nextPoint.x, nextPoint.y);
            }
            this.path2D.closePath();
            if (fill === false) {
                this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
            } else {
                // draw all triangles
                this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
            }
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
     * @param {number} x - x axis of the coordinate for the rectangle starting point.
     * @param {number} y - y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRect(x, y, width, height, fill = false) {
        if (fill === false && this.lineWidth > 1) {
            const radius = this.lineWidth / 2;
            this.strokeLine(x, y, x + width, y);
            this.strokeLine(x + width, y, x + width, y + height);
            this.strokeLine(x + width, y + height, x, y + height);
            this.strokeLine(x, y + height, x, y);
            this.fillEllipse(x, y, radius, radius);
            this.fillEllipse(x + width, y, radius, radius);
            this.fillEllipse(x + width, y + height, radius, radius);
            this.fillEllipse(x, y + height, radius, radius);
        } else {
            this.setCompositor("primitive");
            this.path2D.beginPath();
            this.path2D.rect(x, y, width, height);
            if (fill === false) {
                this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
            } else {
                this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
            }
        }
    }

    /**
     * Draw a filled rectangle at the specified coordinates
     * @param {number} x - x axis of the coordinate for the rectangle starting point.
     * @param {number} y - y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     */
    fillRect(x, y, width, height) {
        this.strokeRect(x, y, width, height, true);
    }

    /**
     * Stroke a rounded rectangle at the specified coordinates
     * @param {number} x - x axis of the coordinate for the rounded rectangle starting point.
     * @param {number} y - y axis of the coordinate for the rounded rectangle starting point.
     * @param {number} width - The rounded rectangle's width.
     * @param {number} height - The rounded rectangle's height.
     * @param {number} radius - The rounded corner's radius.
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRoundRect(x, y, width, height, radius, fill = false) {
        this.setCompositor("primitive");
        this.path2D.beginPath();
        this.path2D.roundRect(x, y, width, height, radius);
        if (fill === false) {
            this.currentCompositor.drawVertices(this.gl.LINES, this.path2D.points);
        } else {
            this.currentCompositor.drawVertices(this.gl.TRIANGLES, this.path2D.triangulatePath());
        }
    }

    /**
     * Draw a rounded filled rectangle at the specified coordinates
     * @param {number} x - x axis of the coordinate for the rounded rectangle starting point.
     * @param {number} y - y axis of the coordinate for the rounded rectangle starting point.
     * @param {number} width - The rounded rectangle's width.
     * @param {number} height - The rounded rectangle's height.
     * @param {number} radius - The rounded corner's radius.
     */
    fillRoundRect(x, y, width, height, radius) {
        this.strokeRoundRect(x, y, width, height, radius, true);
    }

    /**
     * Stroke a Point at the specified coordinates
     * @param {number} x - x axis of the coordinate for the point.
     * @param {number} y - y axis of the coordinate for the point.
     */
    strokePoint(x, y) {
        this.strokeLine(x, y, x + 1, y + 1);
    }

    /**
     * Draw a a point at the specified coordinates
     * @param {number} x - x axis of the coordinate for the point.
     * @param {number} y - y axis of the coordinate for the point.
     */
    fillPoint(x, y) {
        this.strokePoint(x, y);
    }

    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @param {Matrix2d|number} a - a matrix2d to transform by, or a the a component to multiply the current matrix by
     * @param {number} b - the b component to multiply the current matrix by
     * @param {number} c - the c component to multiply the current matrix by
     * @param {number} d - the d component to multiply the current matrix by
     * @param {number} e - the e component to multiply the current matrix by
     * @param {number} f - the f component to multiply the current matrix by
     */
    setTransform(a, b, c, d, e, f) {
        this.resetTransform();
        this.transform(a, b, c, d, e, f);
    }

    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @see {@link WebGLRenderer.setTransform} which will reset the current transform matrix prior to performing the new transformation
     * @param {Matrix2d|number} a - a matrix2d to transform by, or a the a component to multiply the current matrix by
     * @param {number} b - the b component to multiply the current matrix by
     * @param {number} c - the c component to multiply the current matrix by
     * @param {number} d - the d component to multiply the current matrix by
     * @param {number} e - the e component to multiply the current matrix by
     * @param {number} f - the f component to multiply the current matrix by
     */
    transform(a, b, c, d, e, f) {
        if (typeof a === "object") {
            this.currentTransform.multiply(a);
        } else {
            // indivudual component
            this.currentTransform.transform(a, b, c, d, e, f);
        }
        if (this.settings.subPixel === false) {
            // snap position values to pixel grid
            let a = this.currentTransform.toArray();
            a[6] |= 0;
            a[7] |= 0;
        }
    }

    /**
     * adds a translation transformation to the current matrix.
     * @param {number} x - Distance to move in the horizontal direction. Positive values are to the right, and negative to the left.
     * @param {number} y - Distance to move in the vertical direction. Positive values are down, and negative are up.
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
     * @param {number} x - x axis of the coordinate for the upper-left corner of the rectangle to start clipping from.
     * @param {number} y - y axis of the coordinate for the upper-left corner of the rectangle to start clipping from.
     * @param {number} width - the width of the rectangle to start clipping from.
     * @param {number} height - the height of the rectangle to start clipping from.
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
                canvas.height - height - y - this.currentTransform.ty,
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
     * If the drawing or rendering area is larger than the mask, only the intersecting part of the renderable will be visible.
     * (Note Mask are not preserved through renderer context save and restore and need so be manually cleared)
     * @see CanvasRenderer#clearMask
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
