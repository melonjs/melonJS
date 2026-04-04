import { Color, colorPool } from "./../../math/color.ts";
import { isPowerOfTwo } from "./../../math/math.ts";
import {
	CANVAS_ONRESIZE,
	emit,
	GAME_RESET,
	ONCONTEXT_LOST,
	ONCONTEXT_RESTORED,
	on,
} from "../../system/event.ts";
import { Gradient } from "../gradient.js";
import Renderer from "./../renderer.js";
import { createAtlas, TextureAtlas } from "./../texture/atlas.js";
import TextureCache from "./../texture/cache.js";
import PrimitiveBatcher from "./batchers/primitive_batcher";
import QuadBatcher from "./batchers/quad_batcher";

/**
 * additional import for TypeScript
 * @import {Rect} from "./../../geometries/rectangle.ts";
 * @import {RoundRect} from "./../../geometries/roundrect.ts";
 * @import {Polygon} from "../../geometries/polygon.ts";
 * @import {Line} from "./../../geometries/line.ts";
 * @import {Ellipse} from "./../../geometries/ellipse.ts";
 * @import {Matrix2d} from "../../math/matrix2d.ts";
 * @import {Matrix3d} from "../../math/matrix3d.ts";
 * @import {Batcher} from "./batchers/batcher.js";
 */

// list of supported compressed texture formats
let supportedCompressedTextureFormats;

/**
 * a WebGL renderer object
 * @category Rendering
 */
export default class WebGLRenderer extends Renderer {
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
		 * sets or returns the thickness of lines for shape drawing
		 * @type {number}
		 * @default 1
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
		 * reusable scratch array for fillRect (2 triangles = 6 vertices)
		 * @ignore
		 */
		this._rectTriangles = Array.from({ length: 6 }, () => {
			return { x: 0, y: 0 };
		});

		// scratch array for fillPolygon to avoid mutating polygon points
		this._polyVerts = [];

		// current gradient state (null when using solid color)
		this._currentGradient = null;

		/**
		 * The current transformation matrix used for transformations on the overall scene
		 * (alias to renderState.currentTransform for backward compatibility)
		 * @type {Matrix2d}
		 */
		this.currentTransform = this.renderState.currentTransform;

		/**
		 * The current batcher used by the renderer
		 * @type {Batcher}
		 */
		this.currentBatcher = undefined;

		/**
		 * a reference to the current shader program used by the renderer
		 * @type {WebGLProgram}
		 */
		this.currentProgram = undefined;

		/**
		 * The list of active batchers
		 * @type {Map<Batcher>}
		 */
		this.batchers = new Map();

		// bind the vertex buffer
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

		// Create both quad and primitive batchers
		const CustomBatcher = this.settings.batcher || this.settings.compositor;
		this.addBatcher(new (CustomBatcher || QuadBatcher)(this), "quad", true);
		this.addBatcher(new (CustomBatcher || PrimitiveBatcher)(this), "primitive");

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
		const debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");
		if (debugInfo !== null) {
			this.GPUVendor = this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
			this.GPURenderer = this.gl.getParameter(
				debugInfo.UNMASKED_RENDERER_WEBGL,
			);
		}

		// an optional custom shader set by a renderable's preDraw
		this.customShader = undefined;

		// Create a texture cache
		this.cache = new TextureCache(this, this.maxTextures);

		// set the renderer type
		this.type = "WebGL" + this.WebGLVersion;

		// to simulate context lost and restore in WebGL:
		// let ctx = me.video.renderer.context.getExtension('WEBGL_lose_context');
		// ctx.loseContext()
		this.getCanvas().addEventListener(
			"webglcontextlost",
			(e) => {
				e.preventDefault();
				this.isContextValid = false;
				emit(ONCONTEXT_LOST, this);
			},
			false,
		);
		// ctx.restoreContext()
		this.getCanvas().addEventListener(
			"webglcontextrestored",
			() => {
				this.reset();
				this.isContextValid = true;
				emit(ONCONTEXT_RESTORED, this);
			},
			false,
		);

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
			supportedCompressedTextureFormats = {
				astc:
					gl.getExtension("WEBGL_compressed_texture_astc") ||
					this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_astc"),
				bptc:
					gl.getExtension("EXT_texture_compression_bptc") ||
					this._gl.getExtension("WEBKIT_EXT_texture_compression_bptc"),
				s3tc:
					gl.getExtension("WEBGL_compressed_texture_s3tc") ||
					this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc"),
				s3tc_srgb:
					gl.getExtension("WEBGL_compressed_texture_s3tc_srgb") ||
					this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc_srgb"),
				pvrtc:
					gl.getExtension("WEBGL_compressed_texture_pvrtc") ||
					this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc"),
				etc1:
					gl.getExtension("WEBGL_compressed_texture_etc1") ||
					this._gl.getExtension("WEBKIT_WEBGL_compressed_texture_etc1"),
				etc2:
					gl.getExtension("WEBGL_compressed_texture_etc") ||
					gl.getExtension("WEBKIT_WEBGL_compressed_texture_etc") ||
					gl.getExtension("WEBGL_compressed_texture_es3_0"),
			};
			// ETC2 is a superset of ETC1 — if we have ETC2 but not ETC1,
			// synthesize ETC1 support so that PKM/KTX ETC1 textures work
			if (
				!supportedCompressedTextureFormats.etc1 &&
				supportedCompressedTextureFormats.etc2
			) {
				supportedCompressedTextureFormats.etc1 = {
					COMPRESSED_RGB_ETC1_WEBGL: 0x8d64,
				};
			}
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
		for (const supportedFormat in supportedFormats) {
			for (const extension in supportedFormats[supportedFormat]) {
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

		// clear gl context
		this.clear();

		// initial viewport size
		this.setViewport();

		// rebind the vertex buffer if required (e.g in case of context loss)
		if (
			this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING) !== this.vertexBuffer
		) {
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
		}

		this.currentBatcher = undefined;
		this.currentProgram = undefined;
		this.customShader = undefined;

		this.batchers.forEach((batcher) => {
			if (this.isContextValid === false) {
				// on context lost/restore
				batcher.init(this);
			} else {
				batcher.reset();
			}
		});

		this.setBatcher("quad");

		this.gl.disable(this.gl.SCISSOR_TEST);
	}

	/**
	 * add a new batcher to this renderer
	 * @param {Batcher} batcher - a batcher instance
	 * @param {string} name - a name uniquely identifying this batcher
	 * @param {boolean} [activate=false] - true if the given batcher should be set as the active one
	 */
	addBatcher(batcher, name = "default", activate = false) {
		if (typeof this.batchers.get(name) !== "undefined") {
			throw new Error("Invalid Batcher name");
		}

		this.batchers.set(name, batcher);

		if (activate === true) {
			this.setBatcher(name);
		}
	}

	/**
	 * set the active batcher for this renderer
	 * @param {string} name - a batcher name
	 * @param {GLShader} [shader] - an optional shader program to be used, instead of the default one, when activating the batcher
	 * @returns {Batcher} an instance to the current active batcher
	 */
	setBatcher(name = "default", shader) {
		const batcher = this.batchers.get(name);

		if (typeof batcher === "undefined") {
			throw new Error("Invalid Batcher");
		}

		// fast path: already on the right batcher with no custom shader
		if (this.currentBatcher === batcher && typeof shader !== "object") {
			return this.currentBatcher;
		}

		if (this.currentBatcher !== batcher) {
			if (this.currentBatcher !== undefined) {
				// flush the current batcher
				this.currentBatcher.flush();
			}
			// rebind the renderer's shared vertex buffer (custom batchers may have bound their own)
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
			this.currentBatcher = batcher;
			this.currentBatcher.bind();
		}

		if (typeof shader === "object") {
			this.currentBatcher.useShader(shader);
		}

		return this.currentBatcher;
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
		this.setBatcher("quad");

		if (
			this.WebGLVersion === 1 &&
			(!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height))
		) {
			const src = typeof image.src !== "undefined" ? image.src : image;
			throw new Error(
				"[WebGL Renderer] " +
					src +
					" is not a POT texture " +
					"(" +
					image.width +
					"x" +
					image.height +
					")",
			);
		}

		// clean up any previous pattern texture for this image
		// see https://github.com/melonjs/melonJS/issues/1278
		if (this.cache.has(image)) {
			this.currentBatcher.deleteTexture2D(this.cache.get(image));
		}

		const texture = new TextureAtlas(
			createAtlas(image.width, image.height, "pattern", repeat),
			image,
		);

		this.currentBatcher.uploadTexture(texture);

		return texture;
	}

	/**
	 * Flush the batcher to the frame buffer
	 */
	flush() {
		this.currentBatcher.flush();
	}

	/**
	 * set/change the current projection matrix (WebGL only)
	 * @param {Matrix3d} matrix - the new projection matrix
	 */
	setProjection(matrix) {
		// flush pending draws before switching projection
		this.flush();
		super.setProjection(matrix);
		this.currentBatcher.setProjection(matrix);
	}

	/**
	 * Sets the WebGL viewport, which specifies the affine transformation of x and y from normalized device coordinates to window coordinates
	 * @param {number} [x = 0] - x the horizontal coordinate for the lower left corner of the viewport origin
	 * @param {number} [y = 0] - y the vertical coordinate for the lower left corner of the viewport origin
	 * @param {number} [w = width of the canvas] - the width of viewport
	 * @param {number} [h = height of the canvas] - the height of viewport
	 */
	setViewport(
		x = 0,
		y = 0,
		w = this.getCanvas().width,
		h = this.getCanvas().height,
	) {
		this.gl.viewport(x, y, w, h);
	}

	/**
	 * Clear the frame buffer
	 */
	clear() {
		const gl = this.gl;
		const clearColor = this.backgroundColor.toArray();
		gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
		this.lineWidth = 1;
		if (this.depthTest === "z-buffer") {
			gl.clear(
				gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT,
			);
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
		const gl = this.gl;

		if (color instanceof Color) {
			glArray = color.toArray();
		} else {
			const _color = colorPool.get();
			// reuse temporary the renderer default color object
			glArray = _color.parseCSS(color).toArray();
			colorPool.release(_color);
		}

		// clear gl context with the specified color
		gl.clearColor(
			glArray[0],
			glArray[1],
			glArray[2],
			opaque === true ? 1.0 : glArray[3],
		);
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
	 * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame|CompressedImage} image - An element to draw into the context.
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
		} else if (typeof dx === "undefined") {
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

		this.setBatcher("quad");

		const shader = this.customShader;
		if (typeof shader === "object") {
			this.currentBatcher.useShader(shader);
		}

		// force reuploading if the given image is a HTMLVideoElement or a
		// force re-upload for video elements
		const reupload = typeof image.videoWidth !== "undefined";
		const texture = this.cache.get(image);
		const uvs = texture.getUVs(sx, sy, sw, sh);
		this.currentBatcher.addQuad(
			texture,
			dx,
			dy,
			dw,
			dh,
			uvs[0],
			uvs[1],
			uvs[2],
			uvs[3],
			this.currentTint.toUint32(this.getGlobalAlpha()),
			reupload,
		);

		if (typeof shader === "object") {
			this.currentBatcher.useShader(this.currentBatcher.defaultShader);
		}
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
		const uvs = pattern.getUVs("0,0," + width + "," + height);
		this.setBatcher("quad");
		this.currentBatcher.addQuad(
			pattern,
			x,
			y,
			width,
			height,
			uvs[0],
			uvs[1],
			uvs[2],
			uvs[3],
			this.currentTint.toUint32(this.getGlobalAlpha()),
		);
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
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} [shape] - a shape object to stroke
	 * @param {boolean} [fill=false] - fill the shape with the current color if true
	 */
	stroke(shape, fill) {
		if (typeof shape === "undefined") {
			this.setBatcher("primitive");
			if (fill === true) {
				// draw all triangles
				this.currentBatcher.drawVertices(
					this.gl.TRIANGLES,
					this.path2D.triangulatePath(),
				);
			} else {
				const dash = this.renderState.lineDash;
				if (dash.length > 0) {
					const pts = this.path2D.points;
					const dashed = [];
					for (let i = 0; i < pts.length - 1; i += 2) {
						dashed.push(
							...this.#dashSegments(
								pts[i].x,
								pts[i].y,
								pts[i + 1].x,
								pts[i + 1].y,
								dash,
							),
						);
					}
					if (dashed.length > 0) {
						this.currentBatcher.drawVertices(this.gl.LINES, dashed);
					}
				} else {
					this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
				}
			}
		} else {
			// dispatches to strokeRect/strokePolygon/etc. which each call setBatcher
			super.stroke(shape, fill);
		}
	}

	/**
	 * fill the given shape or the current defined path
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} [shape] - a shape object to fill
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
	 * set the current blend mode for this renderer. <br>
	 * All renderers support: <br>
	 * - "normal" : draws new content on top of the existing content <br>
	 * <img src="../images/normal-blendmode.png" width="180"/> <br>
	 * - "add", "additive", or "lighter" : color values are added together <br>
	 * <img src="../images/add-blendmode.png" width="180"/> <br>
	 * - "multiply" : pixels are multiplied, resulting in a darker picture <br>
	 * <img src="../images/multiply-blendmode.png" width="180"/> <br>
	 * - "screen" : pixels are inverted, multiplied, and inverted again (opposite of multiply) <br>
	 * <img src="../images/screen-blendmode.png" width="180"/> <br>
	 * WebGL2 additionally supports: <br>
	 * - "darken" : retains the darkest pixels of both layers <br>
	 * <img src="../images/darken-blendmode.png" width="180"/> <br>
	 * - "lighten" : retains the lightest pixels of both layers <br>
	 * <img src="../images/lighten-blendmode.png" width="180"/> <br>
	 * Other CSS blend modes ("overlay", "color-dodge", "color-burn", "hard-light", "soft-light",
	 * "difference", "exclusion") may be supported by the Canvas renderer (browser-dependent)
	 * and will always fall back to "normal" in WebGL. <br>
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
	 * @param {string} [mode="normal"] - blend mode
	 * @param {boolean} [premultipliedAlpha=true] - whether textures use premultiplied alpha (affects source blend factor)
	 * @returns {string} the blend mode actually applied (may differ if the requested mode is unsupported)
	 */
	setBlendMode(mode = "normal", premultipliedAlpha = true) {
		if (
			this.currentBlendMode !== mode ||
			this.currentPremultipliedAlpha !== premultipliedAlpha
		) {
			const gl = this.gl;
			this.flush();
			gl.enable(gl.BLEND);
			this.currentBlendMode = mode;
			this.currentPremultipliedAlpha = premultipliedAlpha;

			// source factor depends on whether textures use premultiplied alpha
			const srcAlpha = premultipliedAlpha ? gl.ONE : gl.SRC_ALPHA;

			switch (mode) {
				case "screen":
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
					break;

				case "lighter":
				case "additive":
				case "add":
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(srcAlpha, gl.ONE);
					break;

				case "multiply":
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
					break;

				case "darken":
					if (this.WebGLVersion > 1) {
						gl.blendEquation(gl.MIN);
						gl.blendFunc(gl.ONE, gl.ONE);
					} else {
						gl.blendEquation(gl.FUNC_ADD);
						gl.blendFunc(srcAlpha, gl.ONE_MINUS_SRC_ALPHA);
						this.currentBlendMode = "normal";
					}
					break;

				case "lighten":
					if (this.WebGLVersion > 1) {
						gl.blendEquation(gl.MAX);
						gl.blendFunc(gl.ONE, gl.ONE);
					} else {
						gl.blendEquation(gl.FUNC_ADD);
						gl.blendFunc(srcAlpha, gl.ONE_MINUS_SRC_ALPHA);
						this.currentBlendMode = "normal";
					}
					break;

				default:
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(srcAlpha, gl.ONE_MINUS_SRC_ALPHA);
					this.currentBlendMode = "normal";
					break;
			}
		}
		return this.currentBlendMode;
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
		const canvas = this.getCanvas();
		const result = this.renderState.restore(canvas.width, canvas.height);
		if (result !== null) {
			this.setBlendMode(result.blendMode);
			if (result.scissorActive) {
				const gl = this.gl;
				const s = this.currentScissor;
				gl.enable(gl.SCISSOR_TEST);
				gl.scissor(
					s[0] + this.currentTransform.tx,
					canvas.height - s[3] - s[1] - this.currentTransform.ty,
					s[2],
					s[3],
				);
			} else {
				this.gl.disable(this.gl.SCISSOR_TEST);
			}
		}
		// sync gradient from renderState
		this._currentGradient = this.renderState.currentGradient;
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
		this.renderState.save(this.gl.isEnabled(this.gl.SCISSOR_TEST));
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
	 * enable/disable image smoothing (scaling interpolation)
	 * @param {boolean} [enable=false]
	 */
	setAntiAlias(enable = false) {
		if (this.settings.antiAlias !== enable) {
			super.setAntiAlias(enable);
			// update the GL texture filtering on all bound textures
			// see https://github.com/melonjs/melonJS/issues/1279
			const gl = this.gl;
			const filter = enable ? gl.LINEAR : gl.NEAREST;
			this.batchers.forEach((batcher) => {
				if (batcher.boundTextures) {
					for (let i = 0; i < batcher.boundTextures.length; i++) {
						if (typeof batcher.boundTextures[i] !== "undefined") {
							gl.activeTexture(gl.TEXTURE0 + i);
							gl.bindTexture(gl.TEXTURE_2D, batcher.boundTextures[i]);
							gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
							gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
						}
					}
					// reset so next bindTexture2D re-selects the correct unit
					batcher.currentTextureUnit = -1;
				}
			});
		}
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
	 * @param {Color|string|Gradient} color - css color string or a Gradient object.
	 */
	setColor(color) {
		if (color instanceof Gradient) {
			this.renderState.currentGradient = color;
			this._currentGradient = color;
		} else {
			this.renderState.currentGradient = null;
			this._currentGradient = null;
			const alpha = this.currentColor.alpha;
			this.currentColor.copy(color);
			this.currentColor.alpha *= alpha;
		}
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
		if (fill === true) {
			this.fillArc(x, y, radius, start, end, antiClockwise);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.arc(x, y, radius, start, end, antiClockwise);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
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
		if (this._currentGradient) {
			this.#gradientMask(
				() => {
					this.fillArc(x, y, radius, start, end, antiClockwise);
				},
				x - radius,
				y - radius,
				radius * 2,
				radius * 2,
			);
			return;
		}
		this.setBatcher("primitive");
		let diff = Math.abs(end - start);
		if (antiClockwise) {
			diff = Math.PI * 2 - diff;
		}
		const segments = Math.max(
			4,
			Math.round((diff * radius) / this.path2D.arcResolution),
		);
		const startAngle = antiClockwise ? end : start;
		this.currentBatcher.drawVertices(
			this.gl.TRIANGLES,
			this.#generateTriangleFan(
				x,
				y,
				radius,
				radius,
				startAngle,
				startAngle + diff,
				segments,
			),
		);
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
		if (fill === true) {
			this.fillEllipse(x, y, w, h);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.ellipse(x, y, w, h, 0, 0, 360);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
	}

	/**
	 * Fill an ellipse at the specified coordinates with given radius
	 * @param {number} x - ellipse center point x-axis
	 * @param {number} y - ellipse center point y-axis
	 * @param {number} w - horizontal radius of the ellipse
	 * @param {number} h - vertical radius of the ellipse
	 */
	fillEllipse(x, y, w, h) {
		if (this._currentGradient) {
			this.#gradientMask(
				() => {
					this.fillEllipse(x, y, w, h);
				},
				x - w,
				y - h,
				w * 2,
				h * 2,
			);
			return;
		}
		this.setBatcher("primitive");
		const segments = Math.max(
			8,
			Math.round((Math.PI * (w + h)) / this.path2D.arcResolution),
		);
		this.currentBatcher.drawVertices(
			this.gl.TRIANGLES,
			this.#generateTriangleFan(x, y, w, h, 0, Math.PI * 2, segments),
		);
	}

	/**
	 * Stroke a line of the given two points
	 * @param {number} startX - the start x coordinate
	 * @param {number} startY - the start y coordinate
	 * @param {number} endX - the end x coordinate
	 * @param {number} endY - the end y coordinate
	 */
	strokeLine(startX, startY, endX, endY) {
		this.setBatcher("primitive");
		const dash = this.renderState.lineDash;
		if (dash.length > 0) {
			const segments = this.#dashSegments(startX, startY, endX, endY, dash);
			if (segments.length > 0) {
				this.currentBatcher.drawVertices(this.gl.LINES, segments);
			}
		} else {
			this.path2D.beginPath();
			this.path2D.moveTo(startX, startY);
			this.path2D.lineTo(endX, endY);
			this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
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
		if (fill === true) {
			this.fillPolygon(poly);
			return;
		}
		const points = poly.points;
		const len = points.length;

		this.translate(poly.pos.x, poly.pos.y);

		this.setBatcher("primitive");
		this.path2D.beginPath();
		for (let i = 0; i < len - 1; i++) {
			const curPoint = points[i];
			const nextPoint = points[i + 1];
			this.path2D.moveTo(curPoint.x, curPoint.y);
			this.path2D.lineTo(nextPoint.x, nextPoint.y);
		}
		this.path2D.closePath();
		const dash = this.renderState.lineDash;
		if (dash.length > 0) {
			const pts = this.path2D.points;
			const dashed = [];
			for (let i = 0; i < pts.length - 1; i += 2) {
				dashed.push(
					...this.#dashSegments(
						pts[i].x,
						pts[i].y,
						pts[i + 1].x,
						pts[i + 1].y,
						dash,
					),
				);
			}
			if (dashed.length > 0) {
				this.currentBatcher.drawVertices(this.gl.LINES, dashed);
			}
		} else {
			this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
		}
		// add round joins at vertices for thick lines
		if (this.lineWidth > 1) {
			const radius = this.lineWidth / 2;
			const joinPoints = [];
			for (let i = 1; i < len; i++) {
				joinPoints.push(points[i]);
			}
			const lastPoint = points[len - 1];
			const firstPoint = points[0];
			if (!lastPoint.equals(firstPoint)) {
				joinPoints.push(firstPoint);
			}
			this.#drawJoinCircles(joinPoints, radius);
		}

		this.translate(-poly.pos.x, -poly.pos.y);
	}

	/**
	 * Fill a me.Polygon on the screen
	 * @param {Polygon} poly - the shape to draw
	 */
	fillPolygon(poly) {
		if (this._currentGradient) {
			const bounds = poly.getBounds();
			// translate to polygon's local space so gradient coords match
			this.translate(poly.pos.x, poly.pos.y);
			this.#gradientMask(
				() => {
					// draw polygon vertices directly (already translated)
					this.setBatcher("primitive");
					const indices = poly.getIndices();
					const points = poly.points;
					const verts = this._polyVerts;
					const len = indices.length;
					while (verts.length < len) {
						verts.push({ x: 0, y: 0 });
					}
					for (let i = 0; i < len; i++) {
						const src = points[indices[i]];
						verts[i].x = src.x;
						verts[i].y = src.y;
					}
					this.currentBatcher.drawVertices(this.gl.TRIANGLES, verts, len);
				},
				// use local bounds (subtract pos since getBounds includes it)
				bounds.x - poly.pos.x,
				bounds.y - poly.pos.y,
				bounds.width,
				bounds.height,
			);
			this.translate(-poly.pos.x, -poly.pos.y);
			return;
		}
		this.setBatcher("primitive");
		this.translate(poly.pos.x, poly.pos.y);
		const indices = poly.getIndices();
		const points = poly.points;
		const verts = this._polyVerts;
		const len = indices.length;

		// grow the scratch array if needed
		while (verts.length < len) {
			verts.push({ x: 0, y: 0 });
		}

		// copy point coordinates so drawVertices won't mutate the polygon
		for (let i = 0; i < len; i++) {
			const src = points[indices[i]];
			verts[i].x = src.x;
			verts[i].y = src.y;
		}

		this.currentBatcher.drawVertices(this.gl.TRIANGLES, verts, len);
		this.translate(-poly.pos.x, -poly.pos.y);
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
		if (fill === true) {
			this.fillRect(x, y, width, height);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.rect(x, y, width, height);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
		// add round joins at corners for thick lines
		if (this.lineWidth > 1) {
			const radius = this.lineWidth / 2;
			this.#drawJoinCircles(
				[
					{ x, y },
					{ x: x + width, y },
					{ x: x + width, y: y + height },
					{ x, y: y + height },
				],
				radius,
			);
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
		if (this._currentGradient) {
			const canvas = this._currentGradient.toCanvas(this, x, y, width, height);
			this.drawImage(canvas, 0, 0, width, height, x, y, width, height);
			return;
		}
		this.setBatcher("primitive");
		// 2 triangles directly — avoids path2D + earcut overhead
		const right = x + width;
		const bottom = y + height;
		const pts = this._rectTriangles;
		pts[0].x = x;
		pts[0].y = y;
		pts[1].x = right;
		pts[1].y = y;
		pts[2].x = x;
		pts[2].y = bottom;
		pts[3].x = right;
		pts[3].y = y;
		pts[4].x = right;
		pts[4].y = bottom;
		pts[5].x = x;
		pts[5].y = bottom;
		this.currentBatcher.drawVertices(this.gl.TRIANGLES, pts);
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
		if (fill === true) {
			this.fillRoundRect(x, y, width, height, radius);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.roundRect(x, y, width, height, radius);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
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
		if (this._currentGradient) {
			this.#gradientMask(
				() => {
					this.fillRoundRect(x, y, width, height, radius);
				},
				x,
				y,
				width,
				height,
			);
			return;
		}
		this.setBatcher("primitive");
		const r = Math.min(radius, width / 2, height / 2);
		const verts = [];

		// inner cross: 3 rects (6 triangles = 18 vertices)
		// horizontal bar (full width, inner height)
		verts.push(
			{ x, y: y + r },
			{ x: x + width, y: y + r },
			{ x, y: y + height - r },
			{ x: x + width, y: y + r },
			{ x: x + width, y: y + height - r },
			{ x, y: y + height - r },
		);
		// top bar (inner width, radius height)
		verts.push(
			{ x: x + r, y },
			{ x: x + width - r, y },
			{ x: x + r, y: y + r },
			{ x: x + width - r, y },
			{ x: x + width - r, y: y + r },
			{ x: x + r, y: y + r },
		);
		// bottom bar (inner width, radius height)
		verts.push(
			{ x: x + r, y: y + height - r },
			{ x: x + width - r, y: y + height - r },
			{ x: x + r, y: y + height },
			{ x: x + width - r, y: y + height - r },
			{ x: x + width - r, y: y + height },
			{ x: x + r, y: y + height },
		);

		// 4 corner arcs as triangle fans
		const cornerSegments = Math.max(
			4,
			Math.round((Math.PI * r) / 2 / this.path2D.arcResolution),
		);
		const PI = Math.PI;
		verts.push(
			...this.#generateTriangleFan(
				x + r,
				y + r,
				r,
				r,
				PI,
				PI * 1.5,
				cornerSegments,
			),
		); // top-left
		verts.push(
			...this.#generateTriangleFan(
				x + width - r,
				y + r,
				r,
				r,
				PI * 1.5,
				PI * 2,
				cornerSegments,
			),
		); // top-right
		verts.push(
			...this.#generateTriangleFan(
				x + width - r,
				y + height - r,
				r,
				r,
				0,
				PI * 0.5,
				cornerSegments,
			),
		); // bottom-right
		verts.push(
			...this.#generateTriangleFan(
				x + r,
				y + height - r,
				r,
				r,
				PI * 0.5,
				PI,
				cornerSegments,
			),
		); // bottom-left

		this.currentBatcher.drawVertices(this.gl.TRIANGLES, verts);
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
	 * Draw a point at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the point.
	 * @param {number} y - y axis of the coordinate for the point.
	 */
	fillPoint(x, y) {
		this.strokePoint(x, y);
	}

	/**
	 * Generate triangle fan geometry for round joins at the given points
	 * and draw them in a single drawVertices call.
	 * @param {Array<{x: number, y: number}>} centers - join center points
	 * @param {number} radius - join circle radius
	 * @ignore
	 */
	#drawJoinCircles(centers, radius) {
		const segments = 8;
		const angleStep = (Math.PI * 2) / segments;
		const verts = [];

		for (let c = 0; c < centers.length; c++) {
			const cx = centers[c].x;
			const cy = centers[c].y;
			for (let i = 0; i < segments; i++) {
				const a1 = i * angleStep;
				const a2 = a1 + angleStep;
				verts.push(
					{ x: cx, y: cy },
					{ x: cx + Math.cos(a1) * radius, y: cy + Math.sin(a1) * radius },
					{ x: cx + Math.cos(a2) * radius, y: cy + Math.sin(a2) * radius },
				);
			}
		}

		this.currentBatcher.drawVertices(this.gl.TRIANGLES, verts);
	}

	/**
	 * Split a line segment into dashed sub-segments.
	 * @param {number} x0 - start x
	 * @param {number} y0 - start y
	 * @param {number} x1 - end x
	 * @param {number} y1 - end y
	 * @param {number[]} pattern - dash pattern [on, off, on, off, ...]
	 * @returns {Array<{x: number, y: number}>} pairs of start/end points for visible segments
	 * @ignore
	 */
	#dashSegments(x0, y0, x1, y1, pattern) {
		const dx = x1 - x0;
		const dy = y1 - y0;
		const lineLen = Math.sqrt(dx * dx + dy * dy);
		if (lineLen === 0 || pattern.length === 0) {
			return [
				{ x: x0, y: y0 },
				{ x: x1, y: y1 },
			];
		}

		const nx = dx / lineLen;
		const ny = dy / lineLen;
		// bail out if pattern has no positive values (would loop forever)
		if (
			!pattern.some((v) => {
				return v > 0;
			})
		) {
			return [
				{ x: x0, y: y0 },
				{ x: x1, y: y1 },
			];
		}

		const segments = [];
		let dist = 0;
		let patIdx = 0;
		let drawing = true; // start with "on"

		while (dist < lineLen) {
			const dashLen = pattern[patIdx % pattern.length];
			if (dashLen <= 0) {
				patIdx++;
				drawing = !drawing;
				continue;
			}
			const segEnd = Math.min(dist + dashLen, lineLen);

			if (drawing) {
				segments.push(
					{ x: x0 + nx * dist, y: y0 + ny * dist },
					{ x: x0 + nx * segEnd, y: y0 + ny * segEnd },
				);
			}

			dist = segEnd;
			drawing = !drawing;
			patIdx++;
		}

		return segments;
	}

	/**
	 * Draw a gradient-filled shape by masking with the shape and filling the bounding rect.
	 * Temporarily disables the gradient to prevent recursion in the fill methods.
	 * @param {Function} drawShape - draws the shape into the stencil buffer
	 * @param {number} x - bounding rect x
	 * @param {number} y - bounding rect y
	 * @param {number} w - bounding rect width
	 * @param {number} h - bounding rect height
	 * @ignore
	 */
	#gradientMask(drawShape, x, y, w, h) {
		const gl = this.gl;
		const grad = this._currentGradient;
		const hasMask = this.maskLevel > 0;
		const stencilRef = hasMask ? this.maskLevel + 1 : 1;
		this._currentGradient = null;

		this.flush();

		gl.enable(gl.STENCIL_TEST);
		gl.colorMask(false, false, false, false);

		if (hasMask) {
			// nest within existing mask level
			gl.stencilFunc(gl.EQUAL, this.maskLevel, 0xff);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
		} else {
			gl.clear(gl.STENCIL_BUFFER_BIT);
			gl.stencilFunc(gl.ALWAYS, 1, 0xff);
			gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);
		}

		drawShape();
		this.flush();

		// use stencil to clip gradient
		gl.colorMask(true, true, true, true);
		gl.stencilFunc(gl.EQUAL, stencilRef, 0xff);
		gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

		this._currentGradient = grad;
		this.fillRect(x, y, w, h);
		this.flush();

		if (hasMask) {
			// restore the parent mask level by decrementing stencil
			this._currentGradient = null;
			gl.colorMask(false, false, false, false);
			gl.stencilFunc(gl.EQUAL, stencilRef, 0xff);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);
			drawShape();
			this.flush();
			gl.colorMask(true, true, true, true);
			// restore parent mask stencil test
			gl.stencilFunc(gl.NOTEQUAL, this.maskLevel + 1, 1);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
			this._currentGradient = grad;
		} else {
			gl.disable(gl.STENCIL_TEST);
		}
	}

	/**
	 * Generate triangle fan vertices for an elliptical arc.
	 * @param {number} cx - center x
	 * @param {number} cy - center y
	 * @param {number} rx - horizontal radius
	 * @param {number} ry - vertical radius
	 * @param {number} startAngle - start angle in radians
	 * @param {number} endAngle - end angle in radians
	 * @param {number} segments - number of segments
	 * @returns {Array<{x: number, y: number}>} triangle vertices
	 * @ignore
	 */
	#generateTriangleFan(cx, cy, rx, ry, startAngle, endAngle, segments) {
		const angleStep = (endAngle - startAngle) / segments;
		const verts = [];
		for (let i = 0; i < segments; i++) {
			const a1 = startAngle + i * angleStep;
			const a2 = a1 + angleStep;
			verts.push(
				{ x: cx, y: cy },
				{ x: cx + Math.cos(a1) * rx, y: cy + Math.sin(a1) * ry },
				{ x: cx + Math.cos(a2) * rx, y: cy + Math.sin(a2) * ry },
			);
		}
		return verts;
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
			const a = this.currentTransform.toArray();
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
		const currentTransform = this.currentTransform;
		currentTransform.translate(x, y);
		if (this.settings.subPixel === false) {
			// snap position values to pixel grid
			const a = currentTransform.toArray();
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
		const canvas = this.getCanvas();
		const gl = this.gl;
		// if requested box is different from the current canvas size
		if (
			x !== 0 ||
			y !== 0 ||
			width !== canvas.width ||
			height !== canvas.height
		) {
			const currentScissor = this.currentScissor;
			if (gl.isEnabled(gl.SCISSOR_TEST)) {
				// if same as the current scissor box do nothing
				if (
					currentScissor[0] === x &&
					currentScissor[1] === y &&
					currentScissor[2] === width &&
					currentScissor[3] === height
				) {
					return;
				}
			}
			// flush the batcher
			this.flush();
			// turn on scissor test
			gl.enable(this.gl.SCISSOR_TEST);
			// set the scissor rectangle (note : coordinates are left/bottom)
			gl.scissor(
				// scissor does not account for currentTransform, so manually adjust
				x + this.currentTransform.tx,
				canvas.height - height - y - this.currentTransform.ty,
				width,
				height,
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
		const gl = this.gl;

		// flush the batcher
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

		// flush the batcher
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
			// flush the batcher
			this.flush();
			this.maskLevel = 0;
			this.gl.disable(this.gl.STENCIL_TEST);
		}
	}
}
