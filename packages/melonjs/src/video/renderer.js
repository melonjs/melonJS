import Path2D from "./../geometries/path2d.js";
import { Color } from "./../math/color.ts";
import { Matrix3d } from "../math/matrix3d.ts";
import { Vector2d } from "../math/vector2d.ts";
import { CANVAS_ONRESIZE, emit } from "../system/event.ts";
import { Gradient } from "./gradient.js";
import RenderState from "./renderstate.js";
import CanvasRenderTarget from "./rendertarget/canvasrendertarget.js";

/**
 * @import RenderTargetPool from "./rendertarget/render_target_pool.js";
 */

/**
 * @import {Rect} from "./../geometries/rectangle.ts";
 * @import {RoundRect} from "./../geometries/roundrect.ts";
 * @import {Polygon} from "../geometries/polygon.ts";
 * @import {Line} from "./../geometries/line.ts";
 * @import {Ellipse} from "./../geometries/ellipse.ts";
 * @import {Bounds} from "./../physics/bounds.ts";
 */

/**
 * a base renderer object
 * @category Rendering
 */
export default class Renderer {
	/**
	 * @param {ApplicationSettings} [options] - optional parameters for the renderer
	 */
	constructor(options) {
		/**
		 * The renderer renderTarget
		 * @name renderTarget
		 * @type {CanvasRenderTarget}
		 */
		this.renderTarget = new CanvasRenderTarget(
			options.width,
			options.height,
			// support case when a global canvas is available, e.g. webapp adapter for wechat
			typeof globalThis.canvas !== "undefined"
				? Object.assign(options, { canvas: globalThis.canvas })
				: options,
		);

		/**
		 * The given constructor options
		 * @public
		 * @type {object}
		 */
		this.settings = options;

		/**
		 * the requested video size ratio
		 * @public
		 * @type {number}
		 */
		this.designRatio = this.settings.width / this.settings.height;

		/**
		 * the scaling ratio to be applied to the main canvas
		 * @type {Vector2d}
		 * @default <1,1>
		 */
		this.scaleRatio = new Vector2d(this.settings.scale, this.settings.scale);

		/**
		 * true if the current rendering context is valid
		 * @default true
		 * @type {boolean}
		 */
		this.isContextValid = true;

		/**
		 * The GPU renderer string (WebGL only, undefined for Canvas)
		 * @type {string|undefined}
		 */
		this.GPURenderer = undefined;

		/**
		 * an optional custom shader to use instead of the default one.
		 * Set by a renderable's preDraw when a shader is assigned.
		 * (WebGL only, ignored by Canvas renderer)
		 * @type {GLShader|ShaderEffect|undefined}
		 * @ignore
		 */
		this.customShader = undefined;

		/**
		 * The render target pool for post-effect processing (ping-pong FBOs).
		 * Initialized by GPU renderers (WebGL, WebGPU). Null on Canvas renderer.
		 * @type {RenderTargetPool|null}
		 * @ignore
		 */
		this._renderTargetPool = null;

		/**
		 * The Path2D instance used by the renderer to draw primitives
		 * @type {Path2D}
		 */
		this.path2D = new Path2D();

		/**
		 * The renderer type : Canvas, WebGL, etc...
		 * (override this property with a specific value when implementing a custom renderer)
		 * @type {string}
		 */
		this.type = "Generic";

		/**
		 * The background color used to clear the main framebuffer.
		 * Note: alpha value will be set based on the transparent property of the renderer settings.
		 * @default black
		 * @type {Color}
		 */
		this.backgroundColor = new Color(
			0,
			0,
			0,
			this.settings.transparent ? 0.0 : 1.0,
		);

		/**
		 * The renderer state container (color, tint, transform, scissor, blend mode)
		 * with a zero-allocation save/restore stack.
		 * @type {RenderState}
		 */
		this.renderState = new RenderState();

		// expose renderState properties directly (same references)
		this.currentColor = this.renderState.currentColor;
		this.currentTint = this.renderState.currentTint;
		this.currentScissor = this.renderState.currentScissor;

		/**
		 * @ignore
		 */
		this.maskLevel = 0;

		// the projectionMatrix (set through setProjection)
		this.projectionMatrix = new Matrix3d();

		// default uvOffset
		this.uvOffset = 0;
	}

	/**
	 * @type {string}
	 */
	get currentBlendMode() {
		return this.renderState.currentBlendMode;
	}

	set currentBlendMode(value) {
		this.renderState.currentBlendMode = value;
	}

	/**
	 * return the height of the canvas which this renderer draws to
	 * @returns {number} height of the system Canvas
	 */
	get height() {
		return this.getCanvas().height;
	}

	set height(value) {
		this.resize(this.width, value);
	}

	/**
	 * return the width of the canvas which this renderer draws to
	 * @returns {number} width of the system Canvas
	 */
	get width() {
		return this.getCanvas().width;
	}

	set width(value) {
		this.resize(value, this.height);
	}

	/**
	 * prepare the framebuffer for drawing a new frame
	 */
	clear() {}

	/**
	 * render the main framebuffer on screen
	 */
	flush() {}

	/**
	 * Draw a textured triangle mesh.
	 * The mesh object must provide: `vertices` (Float32Array, x/y/z triplets),
	 * `uvs` (Float32Array, u/v pairs), `indices` (Uint16Array, triangle indices),
	 * `texture` (TextureAtlas), `vertexCount` (number), and optionally
	 * `cullBackFaces` (boolean, default true).
	 * WebGL uses hardware depth testing; Canvas uses painter's algorithm (back-to-front sort).
	 * @param {Mesh} mesh - a Mesh renderable or compatible object
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	drawMesh(mesh) {}

	/**
	 * Reset context state
	 */
	reset() {
		this.renderState.reset(this.width, this.height);
		this.resetTransform();
		this.setBlendMode(this.settings.blendMode);
		this.setColor("#000000");
		this.clearTint();
		this.cache.clear();
		this.clearMask();
	}

	/**
	 * return a reference to the current render target corresponding canvas which this renderer draws to
	 * @returns {HTMLCanvasElement}
	 */
	getCanvas() {
		return this.renderTarget.canvas;
	}

	/**
	 * return a reference to the current render target corresponding Context
	 * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
	 */
	getContext() {
		return this.renderTarget.context;
	}

	/**
	 * return the list of supported compressed texture formats.
	 * The base implementation returns null for all formats (no GPU compressed texture support).
	 * The WebGL renderer overrides this with actual extension availability.
	 * @returns {Object} an object with one key per extension family, each value is the WebGL extension object or null
	 */
	getSupportedCompressedTextureFormats() {
		return {
			astc: null,
			bptc: null,
			s3tc: null,
			s3tc_srgb: null,
			pvrtc: null,
			etc1: null,
			etc2: null,
		};
	}

	/**
	 * return true if the given compressed texture format is supported
	 * @param {number} format - a WebGL compressed texture format constant
	 * @returns {boolean}
	 */
	hasSupportedCompressedFormats(format) {
		const supportedFormats = this.getSupportedCompressedTextureFormats();
		for (const supportedFormat in supportedFormats) {
			const entry = supportedFormats[supportedFormat];
			if (entry === null || typeof entry === "undefined") {
				continue;
			}
			for (const extension in entry) {
				if (format === entry[extension]) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Begin capturing rendering to an offscreen buffer for post-effect processing.
	 * Call endPostEffect() after rendering to blit the result to the screen.
	 * No-op on Canvas renderer.
	 * @param {Renderable} renderable - the renderable with postEffects to apply
	 * @returns {boolean} false (Canvas renderer does not support post-effect processing)
	 * @ignore
	 */
	beginPostEffect(renderable) {
		// on Canvas, only set customShader for single-effect fast path
		const effects = renderable.postEffects.filter((fx) => {
			return fx.enabled !== false;
		});
		if (effects.length === 1) {
			this.customShader = effects[0];
		}
		return false;
	}

	/**
	 * End post-effect capture and blit the offscreen buffer to the screen
	 * through the renderable's post-effects.
	 * No-op on Canvas renderer.
	 * @param {Renderable} renderable - the renderable with postEffects to apply
	 * @ignore
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	endPostEffect(renderable) {}

	/**
	 * Blit a texture to the screen through a shader effect.
	 * Draws a screen-aligned quad using the given texture as source
	 * and the given shader for post-processing (e.g. scanlines, desaturation).
	 * No-op on Canvas renderer.
	 * @param {WebGLTexture} source - the source texture to blit
	 * @param {number} x - destination x position
	 * @param {number} y - destination y position
	 * @param {number} width - destination width
	 * @param {number} height - destination height
	 * @param {ShaderEffect} shader - the shader effect to apply
	 * @param {boolean} [keepBlend=false] - if true, keep current blend mode (for sprite compositing)
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	blitEffect(source, x, y, width, height, shader, keepBlend) {}

	/**
	 * Sets the viewport for the renderer.
	 * Defines the affine transformation from normalized device coordinates to window coordinates.
	 * No-op on Canvas renderer.
	 * @param {number} [x=0] - x coordinate of the viewport origin
	 * @param {number} [y=0] - y coordinate of the viewport origin
	 * @param {number} [w] - width of the viewport (defaults to canvas width)
	 * @param {number} [h] - height of the viewport (defaults to canvas height)
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	setViewport(x = 0, y = 0, w, h) {}

	/**
	 * Clear the current render target to transparent black (color + stencil).
	 * Used to prepare FBOs for post-effect capture.
	 * No-op on Canvas renderer.
	 */
	clearRenderTarget() {}

	/**
	 * Enable the scissor test with the given rectangle.
	 * No-op on Canvas renderer.
	 * @param {number} x - x coordinate of the scissor rectangle
	 * @param {number} y - y coordinate of the scissor rectangle
	 * @param {number} width - width of the scissor rectangle
	 * @param {number} height - height of the scissor rectangle
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	enableScissor(x, y, width, height) {}

	/**
	 * Disable the scissor test, allowing rendering to the full viewport.
	 * No-op on Canvas renderer.
	 */
	disableScissor() {}

	/**
	 * Enable or disable alpha blending.
	 * No-op on Canvas renderer (Canvas always blends).
	 * @param {boolean} enable - true to enable blending, false to disable
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	setBlendEnabled(enable) {}

	/**
	 * returns the current blend mode for this renderer
	 * @returns {string} blend mode
	 */
	getBlendMode() {
		return this.currentBlendMode;
	}

	/**
	 * set the current blend mode.
	 * Subclasses (CanvasRenderer, WebGLRenderer) implement the actual GL/Canvas logic.
	 * @param {string} [mode="normal"] - blend mode
	 * @param {boolean} [premultipliedAlpha=true] - whether textures use premultiplied alpha (WebGL only)
	 */
	setBlendMode(mode = "normal") {
		this.currentBlendMode = mode;
	}

	/**
	 * Set the current fill & stroke style color.
	 * By default, or upon reset, the value is set to #000000.
	 * @param {Color|string|Gradient} color - css color value or a Gradient object
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	setColor(color) {
		// implemented by subclasses
	}

	/**
	 * get the current fill & stroke style color.
	 * @returns {Color} current global color
	 */
	getColor() {
		return this.currentColor;
	}

	/**
	 * Create a linear gradient that can be used with {@link Renderer#setColor}.
	 * @param {number} x0 - x-axis coordinate of the start point
	 * @param {number} y0 - y-axis coordinate of the start point
	 * @param {number} x1 - x-axis coordinate of the end point
	 * @param {number} y1 - y-axis coordinate of the end point
	 * @returns {Gradient} a Gradient object
	 */
	createLinearGradient(x0, y0, x1, y1) {
		return new Gradient("linear", [x0, y0, x1, y1]);
	}

	/**
	 * Create a radial gradient that can be used with {@link Renderer#setColor}.
	 * @param {number} x0 - x-axis coordinate of the start circle
	 * @param {number} y0 - y-axis coordinate of the start circle
	 * @param {number} r0 - radius of the start circle
	 * @param {number} x1 - x-axis coordinate of the end circle
	 * @param {number} y1 - y-axis coordinate of the end circle
	 * @param {number} r1 - radius of the end circle
	 * @returns {Gradient} a Gradient object
	 */
	createRadialGradient(x0, y0, r0, x1, y1, r1) {
		return new Gradient("radial", [x0, y0, r0, x1, y1, r1]);
	}

	/**
	 * Set the line dash pattern for stroke operations.
	 * @param {number[]} segments - an array of numbers specifying distances to alternately draw a line and a gap. An empty array clears the dash pattern (solid lines).
	 * @example
	 * // draw a dashed line
	 * renderer.setLineDash([10, 5]);
	 * renderer.strokeLine(0, 0, 100, 0);
	 * // clear the dash pattern
	 * renderer.setLineDash([]);
	 */
	setLineDash(segments) {
		// skip allocation if the pattern hasn't changed
		const current = this.renderState.lineDash;
		if (
			segments.length === current.length &&
			segments.every((v, i) => {
				return v === current[i];
			})
		) {
			return;
		}
		this.renderState.lineDash = segments.filter((v) => {
			return Number.isFinite(v) && v >= 0;
		});
	}

	/**
	 * Get the current line dash pattern.
	 * @returns {number[]} the current dash pattern
	 */
	getLineDash() {
		return this.renderState.lineDash;
	}

	/**
	 * return the current global alpha
	 * @returns {number}
	 */
	globalAlpha() {
		return this.currentColor.glArray[3];
	}

	/**
	 * check if the given rect or bounds overlaps with the renderer screen coordinates
	 * @param {Rect|Bounds} bounds
	 * @returns {boolean} true if overlaps
	 */
	overlaps(bounds) {
		return (
			bounds.left <= this.width &&
			bounds.right >= 0 &&
			bounds.top <= this.height &&
			bounds.bottom >= 0
		);
	}

	/**
	 * resizes the system canvas
	 * @param {number} width - new width of the canvas
	 * @param {number} height - new height of the canvas
	 */
	resize(width, height) {
		const canvas = this.getCanvas();
		if (width !== canvas.width || height !== canvas.height) {
			canvas.width = width;
			canvas.height = height;
			this.currentScissor[0] = 0;
			this.currentScissor[1] = 0;
			this.currentScissor[2] = width;
			this.currentScissor[3] = height;
			// publish the corresponding event
			emit(CANVAS_ONRESIZE, width, height);
		}
	}

	/**
	 * enable/disable image smoothing (scaling interpolation) for the current render target
	 * @param {boolean} [enable=false]
	 */
	setAntiAlias(enable = false) {
		if (this.settings.antiAlias !== enable) {
			this.settings.antiAlias = enable;
			this.renderTarget.setAntiAlias(enable);
		}
	}

	/**
	 * set/change the current projection matrix (WebGL only)
	 * @param {Matrix3d} matrix
	 */
	setProjection(matrix) {
		this.projectionMatrix.copy(matrix);
	}

	/**
	 * stroke the given shape
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} shape - a shape object to stroke
	 * @param {boolean} [fill=false] - fill the shape with the current color if true
	 */
	stroke(shape, fill) {
		switch (shape.type) {
			// RoundRect
			case "RoundRect":
				if (fill) {
					this.fillRoundRect(
						shape.left,
						shape.top,
						shape.width,
						shape.height,
						shape.radius,
					);
				} else {
					this.strokeRoundRect(
						shape.left,
						shape.top,
						shape.width,
						shape.height,
						shape.radius,
					);
				}
				break;

			// Rect or Bounds
			case "Rectangle":
			case "Bounds":
				if (fill) {
					this.fillRect(shape.left, shape.top, shape.width, shape.height);
				} else {
					this.strokeRect(shape.left, shape.top, shape.width, shape.height);
				}
				break;

			// Polygon or Line
			case "Polygon":
			case "Line":
				if (fill) {
					this.fillPolygon(shape);
				} else {
					this.strokePolygon(shape);
				}
				break;

			case "Ellipse":
				if (shape.angle !== 0) {
					this.save();
					this.translate(shape.pos.x, shape.pos.y);
					this.rotate(shape.angle);
					if (fill) {
						this.fillEllipse(0, 0, shape.radiusV.x, shape.radiusV.y);
					} else {
						this.strokeEllipse(0, 0, shape.radiusV.x, shape.radiusV.y);
					}
					this.restore();
				} else if (fill) {
					this.fillEllipse(
						shape.pos.x,
						shape.pos.y,
						shape.radiusV.x,
						shape.radiusV.y,
					);
				} else {
					this.strokeEllipse(
						shape.pos.x,
						shape.pos.y,
						shape.radiusV.x,
						shape.radiusV.y,
					);
				}
				break;

			// Point
			case "Point":
				this.strokePoint(shape.x, shape.y);
				break;

			default:
				throw new Error("Invalid geometry for fill/stroke");
		}
	}

	/**
	 * fill the given shape
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} shape - a shape object to fill
	 */
	fill(shape) {
		this.stroke(shape, true);
	}

	/**
	 * tint the given image or canvas using the given color
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} src - the source image to be tinted
	 * @param {Color|string} color - the color that will be used to tint the image
	 * @param {string} [mode="multiply"] - the composition mode used to tint the image
	 * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas or offscreencanvas (if supported) element representing the tinted image
	 */
	tint(src, color, mode = "multiply") {
		const attributes = {
			context: "2d",
			offscreenCanvas: true,
			transparent: true,
			antiAlias: this.settings.antiAlias,
		};
		const canvasTexture = new CanvasRenderTarget(
			src.width,
			src.height,
			attributes,
		);
		const context = canvasTexture.context;

		context.fillStyle = color instanceof Color ? color.toRGB() : color;
		context.fillRect(0, 0, src.width, src.height);

		context.globalCompositeOperation = mode;
		context.drawImage(src, 0, 0);
		context.globalCompositeOperation = "destination-atop";
		context.drawImage(src, 0, 0);

		return canvasTexture.canvas;
	}

	/**
	 * A mask limits rendering elements to the shape and position of the given mask object.
	 * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
	 * Mask are not preserved through renderer context save and restore.
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
	 * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
	 */
	setMask() {}

	/**
	 * disable (remove) the rendering mask set through setMask.
	 * @see Renderer#setMask
	 */
	clearMask() {}

	/**
	 * set a coloring tint for sprite based renderables
	 * @param {Color} tint - the tint color
	 * @param {number} [alpha] - an alpha value to be applied to the tint
	 */
	setTint(tint, alpha = tint.alpha) {
		// global tint color
		this.currentTint.copy(tint);
		this.currentTint.alpha *= alpha;
	}

	/**
	 * clear the rendering tint set through setTint.
	 * @see Renderer#setTint
	 */
	clearTint() {
		// reset to default
		this.currentTint.setFloat(1.0, 1.0, 1.0, 1.0);
	}

	/**
	 * creates a Blob object representing the last rendered frame
	 * @param {string} [type="image/png"] - A string indicating the image format
	 * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
	 * @returns {Promise} A Promise returning a Blob object representing the last rendered frame
	 * @example
	 * renderer.convertToBlob().then((blob) => console.log(blob));
	 */
	toBlob(type = "image/png", quality) {
		return this.renderTarget.toBlob(type, quality);
	}

	/**
	 * creates an ImageBitmap object of the last frame rendered
	 * (not supported by standard Canvas)
	 * @param {string} [type="image/png"] - A string indicating the image format
	 * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
	 * @returns {Promise} A Promise returning an ImageBitmap.
	 * @example
	 * renderer.transferToImageBitmap().then((image) => console.log(image));
	 */
	toImageBitmap(type = "image/png", quality) {
		return this.renderTarget.toImageBitmap(type, quality);
	}

	/**
	 * returns a data URL containing a representation of the last frame rendered
	 * @param {string} [type="image/png"] - A string indicating the image format
	 * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
	 * @returns {Promise} A Promise returning a string containing the requested data URL.
	 * @example
	 * renderer.toDataURL().then((dataURL) => console.log(dataURL));
	 */
	toDataURL(type = "image/png", quality) {
		return this.renderTarget.toDataURL(type, quality);
	}
}
