import { Color } from "./../../math/color.ts";
import {
	emit,
	GAME_RESET,
	ONCONTEXT_LOST,
	ONCONTEXT_RESTORED,
	on,
} from "../../system/event.ts";
import { Gradient } from "./../gradient.js";
import Renderer from "./../renderer.js";
import CanvasRenderTarget from "./../rendertarget/canvasrendertarget.js";
import TextureCache from "./../texture/cache.js";

/**
 * additional import for TypeScript
 * @import {Rect} from "./../../geometries/rectangle.ts";
 * @import {RoundRect} from "./../../geometries/roundrect.ts";
 * @import {Polygon} from "../../geometries/polygon.ts";
 * @import {Line} from "./../../geometries/line.ts";
 * @import {Ellipse} from "./../../geometries/ellipse.ts";
 * @import {Matrix2d} from "../../math/matrix2d.ts";
 */

/**
 * a canvas renderer object
 * @category Rendering
 */
export default class CanvasRenderer extends Renderer {
	/**
	 * @param {ApplicationSettings} [options] - optional parameters for the renderer
	 */
	constructor(options) {
		// parent constructor
		super(options);

		this.setBlendMode(this.settings.blendMode);

		// apply the default color to the 2d context
		this.setColor(this.currentColor);

		// create a texture cache
		this.cache = new TextureCache(this);

		if (this.settings.textureSeamFix !== false && !this.settings.antiAlias) {
			// enable the tile texture seam fix with the canvas renderer
			this.uvOffset = 1;
		}

		// set the renderer type
		this.type = "CANVAS";

		// context lost & restore event for canvas
		this.getCanvas().addEventListener(
			"contextlost",
			(e) => {
				e.preventDefault();
				this.isContextValid = false;
				emit(ONCONTEXT_LOST, this);
			},
			false,
		);
		// ctx.restoreContext()
		this.getCanvas().addEventListener(
			"contextrestored",
			() => {
				this.isContextValid = true;
				emit(ONCONTEXT_RESTORED, this);
			},
			false,
		);

		// reset the renderer on game reset
		on(GAME_RESET, () => {
			this.reset();
		});
	}

	/**
	 * Reset context state
	 */
	reset() {
		super.reset();
		this.clearColor(this.currentColor, this.settings.transparent !== true);
		// drop the per-light gradient cache; entries will lazily re-bake on
		// the next `drawLight()` call.
		this._lightCache = undefined;
	}

	/**
	 * Reset the canvas transform to identity
	 */
	resetTransform() {
		this.getContext().setTransform(1, 0, 0, 1, 0, 0);
	}

	/**
	 * set/change the current projection matrix.
	 * In Canvas mode, this applies the ortho projection as a canvas 2D transform
	 * (translate + scale) to map world coordinates to screen coordinates.
	 * @param {Matrix3d} matrix - the new projection matrix
	 */
	setProjection(matrix) {
		super.setProjection(matrix);
		// convert the ortho projection matrix to a canvas 2D transform
		// ortho uses OpenGL convention (Y-up), canvas is Y-down, so negate Y scale
		const val = matrix.val;
		const w = this.getCanvas().width;
		const h = this.getCanvas().height;
		const sx = val[0] * w * 0.5;
		const sy = -val[5] * h * 0.5;
		const tx = (val[12] + 1) * w * 0.5;
		const ty = (1 - val[13]) * h * 0.5;
		this.getContext().setTransform(sx, 0, 0, sy, tx, ty);
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
	 * Canvas (browser-dependent) and WebGL2: <br>
	 * - "darken" : retains the darkest pixels of both layers <br>
	 * <img src="../images/darken-blendmode.png" width="180"/> <br>
	 * - "lighten" : retains the lightest pixels of both layers <br>
	 * <img src="../images/lighten-blendmode.png" width="180"/> <br>
	 * Canvas only, browser-dependent (falls back to "normal" if unsupported or in WebGL): <br>
	 * - "overlay" <br>
	 * <img src="../images/overlay-blendmode.png" width="180"/> <br>
	 * - "color-dodge" <br>
	 * <img src="../images/color-dodge-blendmode.png" width="180"/> <br>
	 * - "color-burn" <br>
	 * <img src="../images/color-burn-blendmode.png" width="180"/> <br>
	 * - "hard-light" <br>
	 * <img src="../images/hard-light-blendmode.png" width="180"/> <br>
	 * - "soft-light" <br>
	 * <img src="../images/soft-light-blendmode.png" width="180"/> <br>
	 * - "difference" <br>
	 * <img src="../images/difference-blendmode.png" width="180"/> <br>
	 * - "exclusion" <br>
	 * <img src="../images/exclusion-blendmode.png" width="180"/> <br>
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
	 * @param {string} [mode="normal"] - blend mode
	 * @returns {string} the blend mode actually applied (may differ if the requested mode is unsupported)
	 */
	setBlendMode(mode = "normal") {
		const context = this.getContext();
		this.currentBlendMode = mode;
		switch (mode) {
			case "lighter":
			case "additive":
			case "add":
				context.globalCompositeOperation = "lighter";
				break;

			case "multiply":
			case "screen":
			case "overlay":
			case "darken":
			case "lighten":
			case "color-dodge":
			case "color-burn":
			case "hard-light":
			case "soft-light":
			case "difference":
			case "exclusion":
				context.globalCompositeOperation = mode;
				// verify the browser accepted the mode
				if (context.globalCompositeOperation !== mode) {
					context.globalCompositeOperation = "source-over";
					this.currentBlendMode = "normal";
				}
				break;

			default: // normal
				context.globalCompositeOperation = "source-over";
				this.currentBlendMode = "normal";
				break;
		}
		return this.currentBlendMode;
	}

	/**
	 * prepare the framebuffer for drawing a new frame
	 */
	clear() {
		if (this.backgroundColor.alpha > 0) {
			this.clearColor(this.backgroundColor);
		}
	}

	/**
	 * Clears the main framebuffer with the given color
	 * @param {Color|string} [color="#000000"] - CSS color.
	 * @param {boolean} [opaque=false] - Allow transparency [default] or clear the surface completely [true]
	 */
	clearColor(color = "#000000", opaque = false) {
		const canvas = this.getCanvas();
		const context = this.getContext();

		this.save();
		this.resetTransform();
		context.globalAlpha = 1;
		context.globalCompositeOperation = opaque === true ? "copy" : "source-over";
		context.fillStyle = color instanceof Color ? color.toRGBA() : color;
		this.fillRect(0, 0, canvas.width, canvas.height);
		this.restore();
	}

	/**
	 * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
	 * @param {number} x - x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 */
	clearRect(x, y, width, height) {
		this.getContext().clearRect(x, y, width, height);
	}

	/**
	 * Create a pattern with the specified repetition
	 * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - Source image to be used as the pattern's image
	 * @param {string} repeat - Define how the pattern should be repeated
	 * @returns {CanvasPattern}
	 * @see ImageLayer#repeat
	 * @example
	 * let tileable   = renderer.createPattern(image, "repeat");
	 * let horizontal = renderer.createPattern(image, "repeat-x");
	 * let vertical   = renderer.createPattern(image, "repeat-y");
	 * let basic      = renderer.createPattern(image, "no-repeat");
	 */
	createPattern(image, repeat) {
		return this.getContext().createPattern(image, repeat);
	}

	/**
	 * Draw an image onto the main using the canvas api
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
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}
		const context = this.getContext();

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
			dx = ~~dx;
			dy = ~~dy;
		}

		// apply a tint if required
		let source = image;
		const tint = this.currentTint.toArray();
		if (tint[0] !== 1.0 || tint[1] !== 1.0 || tint[2] !== 1.0) {
			// get a tinted version of this image from the texture cache
			source = this.cache.tint(image, this.currentTint.toRGB());
		}
		context.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
	}

	/**
	 * @inheritdoc
	 *
	 * Renders the light by baking its radial gradient onto an offscreen
	 * `CanvasRenderTarget` and compositing it via `drawImage`. The bake
	 * is cached per-Light2d in a `WeakMap` and re-fired whenever the
	 * light's radii / color / intensity change. Cache entries are
	 * reclaimed automatically by GC when the Light2d itself is no
	 * longer referenced.
	 * @param {object} light - the Light2d instance to render
	 */
	drawLight(light) {
		if (this._lightCache === undefined) {
			this._lightCache = new WeakMap();
		}
		let entry = this._lightCache.get(light);
		const c = light.color;
		if (
			entry === undefined ||
			entry.radiusX !== light.radiusX ||
			entry.radiusY !== light.radiusY ||
			entry.r !== c.r ||
			entry.g !== c.g ||
			entry.b !== c.b ||
			entry.intensity !== light.intensity
		) {
			entry = this._bakeLight(light, entry);
			this._lightCache.set(light, entry);
		}
		this.drawImage(entry.target.canvas, light.pos.x, light.pos.y);
	}

	/**
	 * Bake (or re-bake) a `Light2d`'s radial gradient into an offscreen
	 * canvas. Reuses `prev.target` when dimensions match (just re-fills
	 * the gradient); allocates a new `CanvasRenderTarget` only when the
	 * radii change.
	 * @param {object} light - the Light2d instance
	 * @param {object} [prev] - the previous cache entry, if any
	 * @returns {object} the new cache entry `{ target, radiusX, radiusY, r, g, b, intensity }`
	 * @ignore
	 */
	_bakeLight(light, prev) {
		const w = light.radiusX * 2;
		const h = light.radiusY * 2;
		let target = prev?.target;
		if (target && (target.width !== w || target.height !== h)) {
			target.destroy(this);
			target = undefined;
		}
		if (target === undefined) {
			target = new CanvasRenderTarget(w, h, { offscreenCanvas: false });
		}

		const context = target.context;
		const x1 = w / 2;
		const y1 = h / 2;
		const radiusX = light.radiusX;
		const radiusY = light.radiusY;

		let scaleX;
		let scaleY;
		let invScaleX;
		let invScaleY;
		let gradient;

		target.clear();

		if (radiusX >= radiusY) {
			scaleX = 1;
			invScaleX = 1;
			scaleY = radiusY / radiusX;
			invScaleY = radiusX / radiusY;
			gradient = context.createRadialGradient(
				x1,
				y1 * invScaleY,
				0,
				x1,
				radiusY * invScaleY,
				radiusX,
			);
		} else {
			scaleY = 1;
			invScaleY = 1;
			scaleX = radiusX / radiusY;
			invScaleX = radiusY / radiusX;
			gradient = context.createRadialGradient(
				x1 * invScaleX,
				y1,
				0,
				x1 * invScaleX,
				y1,
				radiusY,
			);
		}

		gradient.addColorStop(0, light.color.toRGBA(light.intensity));
		gradient.addColorStop(1, light.color.toRGBA(0.0));

		context.fillStyle = gradient;
		context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
		context.fillRect(0, 0, w * invScaleX, h * invScaleY);

		const color = light.color;
		return {
			target,
			radiusX,
			radiusY,
			r: color.r,
			g: color.g,
			b: color.b,
			intensity: light.intensity,
		};
	}

	/**
	 * Draw a pattern within the given rectangle.
	 * @param {CanvasPattern} pattern - Pattern object
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 * @see CanvasRenderer#createPattern
	 */
	drawPattern(pattern, x, y, width, height) {
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}
		const context = this.getContext();
		const fillStyle = context.fillStyle;
		context.fillStyle = pattern;
		// translate so the pattern origin aligns with the draw position
		context.save();
		context.translate(x, y);
		context.fillRect(0, 0, width, height);
		context.restore();
		context.fillStyle = fillStyle;
	}

	/**
	 * Draw a textured triangle mesh.
	 * Uses per-triangle affine texture mapping with back-to-front depth sorting
	 * (painter's algorithm) and optional backface culling.
	 * Note: the painter's algorithm works well for convex shapes but may produce
	 * visual artifacts with concave or self-overlapping geometry (e.g. a torus),
	 * as Canvas 2D has no hardware depth buffer. Use the WebGL renderer for
	 * correct depth ordering on complex meshes.
	 * @param {Mesh} mesh - a Mesh renderable or compatible object
	 */
	drawMesh(mesh) {
		if (this.getGlobalAlpha() < 1 / 255) {
			return;
		}

		const vertices = mesh.vertices;
		const uvs = mesh.uvs;
		const indices = mesh.indices;

		// apply tint if set
		let image = mesh.texture.getTexture();
		const tint = this.currentTint.toArray();
		if (tint[0] !== 1.0 || tint[1] !== 1.0 || tint[2] !== 1.0) {
			image = this.cache.tint(image, this.currentTint.toRGB());
		}
		const imgW = image.width;
		const imgH = image.height;
		const cullBack = mesh.cullBackFaces === true;
		const triCount = indices.length / 3;

		// pre-allocate flat sort array (reuse across frames via closure)
		// each entry stores: [sortKey, originalIndex]
		if (!this._meshSortBuf || this._meshSortBuf.length < triCount * 2) {
			this._meshSortBuf = new Float64Array(triCount * 2);
		}
		const sortBuf = this._meshSortBuf;
		let visCount = 0;

		// build sort keys for visible triangles (no object allocation)
		for (let j = 0; j < indices.length; j += 3) {
			const i0 = indices[j];
			const i1 = indices[j + 1];
			const i2 = indices[j + 2];

			// backface culling
			if (cullBack) {
				const x0 = vertices[i0 * 3];
				const y0 = vertices[i0 * 3 + 1];
				const cross =
					(vertices[i1 * 3] - x0) * (vertices[i2 * 3 + 1] - y0) -
					(vertices[i2 * 3] - x0) * (vertices[i1 * 3 + 1] - y0);
				if (cross > 0) {
					continue;
				}
			}

			// store maxZ as sort key and triangle start index
			const z0 = vertices[i0 * 3 + 2];
			const z1 = vertices[i1 * 3 + 2];
			const z2 = vertices[i2 * 3 + 2];
			const idx = visCount * 2;
			sortBuf[idx] = z0 > z1 ? (z0 > z2 ? z0 : z2) : z1 > z2 ? z1 : z2;
			sortBuf[idx + 1] = j; // original index into indices array
			visCount++;
		}

		// sort back-to-front (largest Z = farthest = drawn first)
		for (let i = 1; i < visCount; i++) {
			const keyZ = sortBuf[i * 2];
			const keyJ = sortBuf[i * 2 + 1];
			let k = i - 1;
			while (k >= 0 && sortBuf[k * 2] < keyZ) {
				sortBuf[(k + 1) * 2] = sortBuf[k * 2];
				sortBuf[(k + 1) * 2 + 1] = sortBuf[k * 2 + 1];
				k--;
			}
			sortBuf[(k + 1) * 2] = keyZ;
			sortBuf[(k + 1) * 2 + 1] = keyJ;
		}

		// draw sorted triangles using raw context
		const context = this.getContext();

		for (let t = 0; t < visCount; t++) {
			const j = sortBuf[t * 2 + 1];
			const i0 = indices[j];
			const i1 = indices[j + 1];
			const i2 = indices[j + 2];

			const x0 = vertices[i0 * 3];
			const y0 = vertices[i0 * 3 + 1];
			const x1 = vertices[i1 * 3];
			const y1 = vertices[i1 * 3 + 1];
			const x2 = vertices[i2 * 3];
			const y2 = vertices[i2 * 3 + 1];

			// UV coordinates scaled to pixel space
			const u0 = uvs[i0 * 2] * imgW;
			const v0 = uvs[i0 * 2 + 1] * imgH;
			const u1 = uvs[i1 * 2] * imgW;
			const v1 = uvs[i1 * 2 + 1] * imgH;
			const u2 = uvs[i2 * 2] * imgW;
			const v2 = uvs[i2 * 2 + 1] * imgH;

			const du1 = u1 - u0;
			const dv1 = v1 - v0;
			const du2 = u2 - u0;
			const dv2 = v2 - v0;
			const rawDet = du1 * dv2 - du2 * dv1;

			// expand triangle by 0.5px to cover seams
			const cx = (x0 + x1 + x2) * 0.333333;
			const cy = (y0 + y1 + y2) * 0.333333;

			context.save();
			context.beginPath();
			context.moveTo(
				x0 + (x0 > cx ? 0.5 : x0 < cx ? -0.5 : 0),
				y0 + (y0 > cy ? 0.5 : y0 < cy ? -0.5 : 0),
			);
			context.lineTo(
				x1 + (x1 > cx ? 0.5 : x1 < cx ? -0.5 : 0),
				y1 + (y1 > cy ? 0.5 : y1 < cy ? -0.5 : 0),
			);
			context.lineTo(
				x2 + (x2 > cx ? 0.5 : x2 < cx ? -0.5 : 0),
				y2 + (y2 > cy ? 0.5 : y2 < cy ? -0.5 : 0),
			);

			if (rawDet === 0) {
				// degenerate UV triangle — sample a solid color from the texture
				// (common with color-palette models where all 3 UVs map to the same point)
				context.closePath();
				if (!this._meshColorCanvas) {
					this._meshColorCanvas = document.createElement("canvas");
					this._meshColorCanvas.width = 1;
					this._meshColorCanvas.height = 1;
					this._meshColorCtx = this._meshColorCanvas.getContext("2d");
				}
				const sx = Math.min(Math.max(Math.round(u0), 0), imgW - 1);
				const sy = Math.min(Math.max(Math.round(v0), 0), imgH - 1);
				this._meshColorCtx.drawImage(image, sx, sy, 1, 1, 0, 0, 1, 1);
				const pixel = this._meshColorCtx.getImageData(0, 0, 1, 1).data;
				context.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
				context.fill();
			} else {
				const dx1 = x1 - x0;
				const dy1 = y1 - y0;
				const dx2 = x2 - x0;
				const dy2 = y2 - y0;
				const det = 1 / rawDet;
				const a = (dv2 * dx1 - dv1 * dx2) * det;
				const b = (dv2 * dy1 - dv1 * dy2) * det;
				const c = (du1 * dx2 - du2 * dx1) * det;
				const d = (du1 * dy2 - du2 * dy1) * det;

				context.clip();
				context.transform(
					a,
					b,
					c,
					d,
					x0 - a * u0 - c * v0,
					y0 - b * u0 - d * v0,
				);
				context.drawImage(image, 0, 0);
			}
			context.restore();
		}
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
		this.getContext().beginPath();
	}

	/**
	 * begins a new sub-path at the point specified by the given (x, y) coordinates.
	 * @param {number} x - The x axis of the point.
	 * @param {number} y - The y axis of the point.
	 */
	moveTo(x, y) {
		this.getContext().moveTo(x, y);
	}

	/**
	 * adds a straight line to the current sub-path by connecting the sub-path's last point to the specified (x, y) coordinates.
	 */
	lineTo(x, y) {
		this.getContext().lineTo(x, y);
	}

	/**
	 * Adds a quadratic Bezier curve to the current sub-path.
	 * @param {number} cpx - The x-axis coordinate of the control point.
	 * @param {number} cpy - The y-axis coordinate of the control point.
	 * @param {number} x - The x-axis coordinate of the end point.
	 * @param {number} y - The y-axis coordinate of the end point.
	 */
	quadraticCurveTo(cpx, cpy, x, y) {
		this.getContext().quadraticCurveTo(cpx, cpy, x, y);
	}

	/**
	 * Adds a cubic Bezier curve to the current sub-path.
	 * @param {number} cp1x - The x-axis coordinate of the first control point.
	 * @param {number} cp1y - The y-axis coordinate of the first control point.
	 * @param {number} cp2x - The x-axis coordinate of the second control point.
	 * @param {number} cp2y - The y-axis coordinate of the second control point.
	 * @param {number} x - The x-axis coordinate of the end point.
	 * @param {number} y - The y-axis coordinate of the end point.
	 */
	bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
		this.getContext().bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
	}

	/**
	 * Adds a circular arc to the current sub-path, using the given control points and radius.
	 * @param {number} x1 - The x-axis coordinate of the first control point.
	 * @param {number} y1 - The y-axis coordinate of the first control point.
	 * @param {number} x2 - The x-axis coordinate of the second control point.
	 * @param {number} y2 - The y-axis coordinate of the second control point.
	 * @param {number} radius - The arc's radius. Must be non-negative.
	 */
	arcTo(x1, y1, x2, y2, radius) {
		this.getContext().arcTo(x1, y1, x2, y2, radius);
	}

	/**
	 * creates a rectangular path whose starting point is at (x, y) and whose size is specified by width and height.
	 * @param {number} x - The x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - The y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 */
	rect(x, y, width, height) {
		this.getContext().rect(x, y, width, height);
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
		this.getContext().roundRect(x, y, width, height, radii);
	}

	/**
	 * stroke the given shape or the current defined path
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} [shape] - a shape object to stroke
	 * @param {boolean} [fill=false] - fill the shape with the current color if true
	 */
	stroke(shape, fill) {
		if (typeof shape === "undefined") {
			if (this.path2D.points.length > 0) {
				// replay path2D interpolated points onto the native context
				const context = this.getContext();
				const points = this.path2D.points;
				context.beginPath();
				context.moveTo(points[0].x, points[0].y);
				for (let i = 1; i < points.length; i++) {
					context.lineTo(points[i].x, points[i].y);
				}
				if (fill === true) {
					context.fill();
				} else {
					context.stroke();
				}
				this.path2D.beginPath();
			} else if (fill === true) {
				this.getContext().fill();
			} else {
				this.getContext().stroke();
			}
		} else {
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
		this.getContext().closePath();
	}

	/**
	 * Stroke an arc at the specified coordinates with given radius, start and end points
	 * @param {number} x - arc center point x-axis
	 * @param {number} y - arc center point y-axis
	 * @param {number} radius
	 * @param {number} start - start angle in radians
	 * @param {number} end - end angle in radians
	 * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeArc(x, y, radius, start, end, antiClockwise, fill = false) {
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}
		const context = this.getContext();

		context.translate(x, y);
		context.beginPath();
		context.arc(0, 0, radius, start, end, antiClockwise || false);
		context[fill === true ? "fill" : "stroke"]();
		context.translate(-x, -y);
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
	fillArc(x, y, radius, start, end, antiClockwise) {
		this.strokeArc(x, y, radius, start, end, antiClockwise || false, true);
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
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}
		const context = this.getContext();
		context.beginPath();
		context.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
		context[fill === true ? "fill" : "stroke"]();
		context.closePath();
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
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}

		const context = this.getContext();

		context.beginPath();
		context.moveTo(startX, startY);
		context.lineTo(endX, endY);
		context.stroke();
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
	 * Set the line dash pattern.
	 * @param {number[]} segments - dash pattern
	 */
	setLineDash(segments) {
		super.setLineDash(segments);
		this.getContext().setLineDash(this.renderState.lineDash);
	}

	/**
	 * Get the current line dash pattern.
	 * @returns {number[]} dash pattern
	 */
	getLineDash() {
		return this.getContext().getLineDash();
	}

	/**
	 * Stroke the given me.Polygon on the screen
	 * @param {Polygon} poly - the shape to draw
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokePolygon(poly, fill = false) {
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}
		const context = this.getContext();
		const points = poly.points;
		const pointsLength = points.length;
		const firstPoint = points[0];

		this.translate(poly.pos.x, poly.pos.y);

		context.beginPath();
		context.moveTo(firstPoint.x, firstPoint.y);
		for (let i = 1; i < pointsLength; i++) {
			const point = points[i];
			context.lineTo(point.x, point.y);
		}
		context.lineTo(firstPoint.x, firstPoint.y);
		context[fill === true ? "fill" : "stroke"]();
		context.closePath();

		this.translate(-poly.pos.x, -poly.pos.y);
	}

	/**
	 * Fill the given me.Polygon on the screen
	 * @param {Polygon} poly - the shape to draw
	 */
	fillPolygon(poly) {
		this.strokePolygon(poly, true);
	}

	/**
	 * Stroke a rectangle at the specified coordinates
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeRect(x, y, width, height, fill = false) {
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}
		const context = this.getContext();

		context[fill === true ? "fillRect" : "strokeRect"](x, y, width, height);
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
		if (this.getGlobalAlpha() < 1 / 255) {
			// Fast path: don't draw fully transparent
			return;
		}
		const context = this.getContext();

		context.beginPath();
		context.roundRect(x, y, width, height, radius);
		context[fill === true ? "fill" : "stroke"]();
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
	 * Draw a point at the specified coordinates
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 */
	fillPoint(x, y) {
		this.strokePoint(x, y);
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
		const context = this.getContext();
		// restore the native context state (transform, globalAlpha, fillStyle, clip, etc.)
		context.restore();
		// restore JS-side state that the native context doesn't track (tint, blend mode)
		const result = this.renderState.restore(canvas.width, canvas.height);
		if (result !== null) {
			this.setBlendMode(result.blendMode);
		}
		// sync customShader from renderState (mirrors WebGLRenderer.restore)
		this.customShader = this.renderState.currentShader;
		// re-sync from the native context (which is authoritative for Canvas)
		// fillStyle may be a CanvasGradient/CanvasPattern — only sync if it's a color string
		if (typeof context.fillStyle === "string") {
			this.currentColor.copy(context.fillStyle);
		}
		this.currentColor.glArray[3] = context.globalAlpha;
		// reset scissor cache so the next clipRect() won't skip
		this.currentScissor[0] = 0;
		this.currentScissor[1] = 0;
		this.currentScissor[2] = canvas.width;
		this.currentScissor[3] = canvas.height;
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
		this.getContext().save();
		this.renderState.currentShader = this.customShader;
		this.renderState.save();
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
		this.getContext().rotate(angle);
	}

	/**
	 * adds a scaling transformation to the renderer units horizontally and/or vertically
	 * @param {number} x - Scaling factor in the horizontal direction. A negative value flips pixels across the vertical axis. A value of 1 results in no horizontal scaling.
	 * @param {number} y - Scaling factor in the vertical direction. A negative value flips pixels across the horizontal axis. A value of 1 results in no vertical scaling
	 */
	scale(x, y) {
		this.getContext().scale(x, y);
	}

	/**
	 * Set the current fill & stroke style color.
	 * By default, or upon reset, the value is set to #000000.
	 * @param {Color|string|Gradient} color - css color value or a Gradient object
	 */
	setColor(color) {
		const context = this.getContext();

		if (color instanceof Gradient) {
			this.renderState.currentGradient = color;
			context.strokeStyle = context.fillStyle = color.toCanvasGradient(context);
		} else {
			this.renderState.currentGradient = null;
			this.currentColor.copy(color);
			context.strokeStyle = context.fillStyle = this.currentColor.toRGBA();
		}
	}

	/**
	 * Set the global alpha
	 * @param {number} alpha - 0.0 to 1.0 values accepted.
	 */
	setGlobalAlpha(alpha) {
		this.getContext().globalAlpha = this.currentColor.glArray[3] = alpha;
	}

	/**
	 * Return the global alpha
	 * @returns {number} global alpha value
	 */
	getGlobalAlpha() {
		return this.getContext().globalAlpha;
	}

	/**
	 * sets or returns the thickness of lines for shape drawing
	 * @type {number}
	 * @default 1
	 */
	get lineWidth() {
		return this.getContext().lineWidth;
	}

	/**
	 * @ignore
	 */
	set lineWidth(value) {
		this.getContext().lineWidth = value;
	}

	/**
	 * sets or returns the shape used to join two line segments where they meet.
	 * There are three possible values for this property: "round", "bevel", and "miter"
	 * @type {string}
	 * @default "miter"
	 */
	get lineJoin() {
		return this.getContext().lineJoin;
	}

	/**
	 * @ignore
	 */
	set lineJoin(value) {
		const context = this.getContext();
		context.lineJoin = value;
	}

	/**
	 * Reset (overrides) the renderer transformation matrix to the
	 * identity one, and then apply the given transformation matrix.
	 * @param {Matrix2d|Matrix3d|number} a - a matrix to transform by, or the a component to multiply the current matrix by
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
	 * @see {@link CanvasRenderer.setTransform} which will reset the current transform matrix prior to performing the new transformation
	 * @param {Matrix2d|Matrix3d|number} a - a matrix to transform by, or the a component to multiply the current matrix by
	 * @param {number} b - the b component to multiply the current matrix by
	 * @param {number} c - the c component to multiply the current matrix by
	 * @param {number} d - the d component to multiply the current matrix by
	 * @param {number} e - the e component to multiply the current matrix by
	 * @param {number} f - the f component to multiply the current matrix by
	 */
	transform(a, b, c, d, e, f) {
		if (typeof a === "object") {
			const m = a.val;
			if (m.length === 16) {
				// Matrix3d (column-major 4x4)
				b = m[1];
				c = m[4];
				d = m[5];
				e = m[12];
				f = m[13];
				a = m[0];
			} else {
				// Matrix2d (3x3)
				b = m[1];
				c = m[3];
				d = m[4];
				e = m[6];
				f = m[7];
				a = m[0];
			}
		}
		// else individual components

		if (this.settings.subPixel === false) {
			e |= 0;
			f |= 0;
		}

		this.getContext().transform(a, b, c, d, e, f);
	}

	/**
	 * adds a translation transformation to the current matrix.
	 * @param {number} x - Distance to move in the horizontal direction. Positive values are to the right, and negative to the left.
	 * @param {number} y - Distance to move in the vertical direction. Positive values are down, and negative are up.
	 */
	translate(x, y) {
		if (this.settings.subPixel === false) {
			this.getContext().translate(~~x, ~~y);
		} else {
			this.getContext().translate(x, y);
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
		const canvas = this.getCanvas();
		// if requested box is different from the current canvas size;
		if (
			x !== 0 ||
			y !== 0 ||
			width !== canvas.width ||
			height !== canvas.height
		) {
			const currentScissor = this.currentScissor;
			// if different from the current scissor box
			if (
				currentScissor[0] !== x ||
				currentScissor[1] !== y ||
				currentScissor[2] !== width ||
				currentScissor[3] !== height
			) {
				const context = this.getContext();
				context.beginPath();
				context.rect(x, y, width, height);
				context.clip();
				// save the new currentScissor box
				currentScissor[0] = x;
				currentScissor[1] = y;
				currentScissor[2] = width;
				currentScissor[3] = height;
			}
		}
	}

	/**
	 * A mask limits rendering elements to the shape and position of the given mask object.
	 * If the drawing or rendering area is larger than the mask, only the intersecting part of the renderable will be visible.
	 * (Note Mask are not preserved through renderer context save and restore and need so be manually cleared)
	 * @see CanvasRenderer#clearMask
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
	 * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
	 */
	setMask(mask, invert = false) {
		const context = this.getContext();

		if (this.maskLevel === 0) {
			// only save context on the first mask
			context.save();
			if (typeof mask !== "undefined") {
				context.beginPath();
			}
			// else use the current path
			this._maskInvertOuterAdded = false;
		}

		if (typeof mask !== "undefined") {
			switch (mask.type) {
				// RoundRect
				case "RoundRect":
					context.roundRect(
						mask.left,
						mask.top,
						mask.width,
						mask.height,
						mask.radius,
					);
					break;

				// Rect or Bounds
				case "Rectangle":
				case "Bounds":
					context.rect(mask.left, mask.top, mask.width, mask.height);
					break;

				// Polygon or Line
				case "Polygon":
					{
						// polygon
						const _x = mask.pos.x;
						const _y = mask.pos.y;
						context.moveTo(_x + mask.points[0].x, _y + mask.points[0].y);
						for (let i = 1; i < mask.points.length; i++) {
							const point = mask.points[i];
							context.lineTo(_x + point.x, _y + point.y);
						}
					}
					break;

				case "Ellipse":
					{
						const _x = mask.pos.x;
						const _y = mask.pos.y;
						const hw = mask.radiusV.x;
						const hh = mask.radiusV.y;
						const lx = _x - hw;
						const rx = _x + hw;
						const ty = _y - hh;
						const by = _y + hh;

						const xmagic = hw * 0.551784;
						const ymagic = hh * 0.551784;
						const xmin = _x - xmagic;
						const xmax = _x + xmagic;
						const ymin = _y - ymagic;
						const ymax = _y + ymagic;

						context.moveTo(_x, ty);
						context.bezierCurveTo(xmax, ty, rx, ymin, rx, _y);
						context.bezierCurveTo(rx, ymax, xmax, by, _x, by);
						context.bezierCurveTo(xmin, by, lx, ymax, lx, _y);
						context.bezierCurveTo(lx, ymin, xmin, ty, _x, ty);
					}
					break;

				default:
					throw new Error("Invalid geometry for setMask");
			}
		}

		this.maskLevel++;

		if (invert === true) {
			// draw a full-canvas rect as the outer path, then close the
			// inner shape(s) — clipping with "evenodd" makes the shape a hole.
			// The outer rect is added only once per mask sequence so chained
			// invert masks accumulate their cutouts correctly (each new
			// shape adds another hole to the same evenodd path) instead of
			// duplicate full-canvas rects cancelling under evenodd parity.
			if (this._maskInvertOuterAdded !== true) {
				context.rect(0, 0, this.getCanvas().width, this.getCanvas().height);
				this._maskInvertOuterAdded = true;
			}
			context.clip("evenodd");
		} else {
			context.clip();
		}
	}

	/**
	 * disable (remove) the rendering mask set through setMask.
	 * @see CanvasRenderer#setMask
	 */
	clearMask() {
		if (this.maskLevel > 0) {
			this.maskLevel = 0;
			this.getContext().restore();
		}
	}
}
