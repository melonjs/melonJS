import { game } from "../application/application.ts";
import { Polygon } from "../geometries/polygon.ts";
import { getImage, getMTL, getOBJ } from "./../loader/loader.js";
import { Matrix3d } from "../math/matrix3d.ts";
import { Vector2d } from "../math/vector2d.ts";
import {
	convexHull,
	normalizeVertices,
	projectVertices,
} from "../math/vertex.ts";
import { TextureAtlas } from "./../video/texture/atlas.js";
import Renderable from "./renderable.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 */

// reusable matrix for combining projection × model in draw()
const _combinedMatrix = new Matrix3d();

/**
 * A renderable object for displaying textured triangle meshes.
 * Supports loading from Wavefront OBJ models (via `loader.preload` with type "obj")
 * or from raw geometry data (vertices, uvs, indices).
 * Includes a built-in perspective projection and supports 3D transforms
 * through the standard Renderable API (`rotate`, `scale`, `translate`).
 * Works on both WebGL (hardware depth testing) and Canvas (painter's algorithm) renderers.
 * @category Game Objects
 */
export default class Mesh extends Renderable {
	/**
	 * @param {number} x - the x screen position of the mesh object
	 * @param {number} y - the y screen position of the mesh object
	 * @param {object} settings - Configuration parameters for the Mesh object
	 * @param {string} [settings.model] - name of a preloaded OBJ model (via loader.preload with type "obj")
	 * @param {Float32Array|number[]} [settings.vertices] - vertex positions as x,y,z triplets (alternative to settings.model)
	 * @param {Float32Array|number[]} [settings.uvs] - texture coordinates as u,v pairs (alternative to settings.model)
	 * @param {Uint16Array|number[]} [settings.indices] - triangle vertex indices (alternative to settings.model)
	 * @param {HTMLImageElement|TextureAtlas|string} [settings.texture] - the texture to apply (image name, HTMLImageElement, or TextureAtlas). If omitted and settings.material is provided, the texture is resolved from the MTL material's map_Kd.
	 * @param {string} [settings.material] - name of a preloaded MTL material (via loader.preload with type "mtl"). When provided, the diffuse texture (map_Kd), tint color (Kd), and opacity (d) are automatically applied.
	 * @param {number} settings.width - display width in pixels (the 3D model is normalized and scaled to fit this size)
	 * @param {number} settings.height - display height in pixels (the 3D model is normalized and scaled to fit this size)
	 * @param {boolean} [settings.cullBackFaces=true] - enable backface culling
	 * @example
	 * // create from OBJ + MTL (texture auto-resolved from material)
	 * let mesh = new me.Mesh(0, 0, {
	 *     model: "fox",
	 *     material: "fox",
	 *     width: 200,
	 *     height: 200,
	 * });
	 *
	 * // create from OBJ with explicit texture (no MTL needed)
	 * let mesh = new me.Mesh(0, 0, {
	 *     model: "cube",
	 *     texture: "cube_texture",
	 *     width: 200,
	 *     height: 200,
	 * });
	 *
	 * // 3D rotation using the standard rotate() API
	 * mesh.rotate(Math.PI / 4, new me.Vector3d(0, 1, 0)); // rotate around Y axis
	 *
	 * // 2D rotation (Z axis, same as Sprite)
	 * mesh.rotate(Math.PI / 4);
	 */
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);

		// load geometry from OBJ model or raw data
		if (typeof settings.model === "string") {
			const objData = getOBJ(settings.model);
			if (!objData) {
				throw new Error("Mesh: '" + settings.model + "' OBJ model not found!");
			}
			/**
			 * the original (untransformed) vertex positions as x,y,z triplets
			 * @type {Float32Array}
			 */
			this.originalVertices = objData.vertices;

			/**
			 * texture coordinates as u,v pairs
			 * @type {Float32Array}
			 */
			this.uvs = objData.uvs;

			/**
			 * triangle indices
			 * @type {Uint16Array}
			 */
			this.indices = objData.indices;

			/**
			 * number of vertices
			 * @type {number}
			 */
			this.vertexCount = objData.vertexCount;
		} else {
			this.originalVertices =
				settings.vertices instanceof Float32Array
					? settings.vertices
					: new Float32Array(settings.vertices);
			this.uvs =
				settings.uvs instanceof Float32Array
					? settings.uvs
					: new Float32Array(settings.uvs);
			this.indices =
				settings.indices instanceof Uint16Array
					? settings.indices
					: new Uint16Array(settings.indices);
			this.vertexCount = this.originalVertices.length / 3;
		}

		// working array for projected vertices (updated each frame in draw)
		/**
		 * the projected vertex positions, updated each draw call
		 * @type {Float32Array}
		 */
		this.vertices = new Float32Array(this.vertexCount * 3);

		/**
		 * whether to cull back-facing triangles
		 * @type {boolean}
		 * @default true
		 */
		this.cullBackFaces =
			settings.cullBackFaces !== undefined ? settings.cullBackFaces : true;

		// resolve material (MTL) — applies texture, tint, and opacity
		let textureSource = settings.texture;
		if (typeof settings.material === "string") {
			const materials = getMTL(settings.material);
			if (materials) {
				// use the first material's properties
				const mat = materials[Object.keys(materials)[0]];
				if (mat) {
					// auto-resolve texture from map_Kd if no explicit texture
					if (!textureSource && mat.map_Kd) {
						textureSource = mat.map_Kd;
					}
					// apply diffuse color as tint
					if (mat.Kd) {
						this.tint.setColor(
							Math.round(mat.Kd[0] * 255),
							Math.round(mat.Kd[1] * 255),
							Math.round(mat.Kd[2] * 255),
						);
					}
					// apply opacity
					if (mat.d < 1.0) {
						this.setOpacity(mat.d);
					}
				}
			}
		}

		// resolve texture
		if (textureSource instanceof TextureAtlas) {
			/**
			 * the texture atlas used by this mesh
			 * @type {TextureAtlas}
			 */
			this.texture = textureSource;
		} else {
			const image =
				typeof textureSource === "object"
					? textureSource
					: getImage(textureSource);
			if (!image) {
				throw new Error(
					"Mesh: '" + textureSource + "' image/texture not found!",
				);
			}
			this.texture = game.renderer.cache.get(image, {
				framewidth: image.width,
				frameheight: image.height,
			});
		}

		/**
		 * Projection matrix applied automatically before the model transform in draw().
		 * Defaults to a perspective projection (45° FOV, camera at z=-2.5) suitable for
		 * viewing unit-cube-sized geometry. Set to identity for orthographic (flat) projection.
		 * Most users don't need to modify this — the default works for standard OBJ models.
		 * @type {Matrix3d}
		 */
		this.projectionMatrix = new Matrix3d();
		this.projectionMatrix.perspective(Math.PI / 4, 1, 0.1, 10);
		this.projectionMatrix.translate(0, 0, -2.5);

		// normalize original vertices to fit within [-0.5, 0.5] range
		// so that width/height scaling works like Sprite
		normalizeVertices(this.originalVertices);

		this.anchorPoint.set(0.5, 0.5);

		// skip applying the 3D transform to the 2D renderer context in preDraw
		// the full 3D transform is applied to vertices in draw() instead
		this.autoTransform = false;

		// pre-allocate points array and polygon for toPolygon() (avoids per-call allocation)
		/** @ignore */
		this._hullPoints = Array.from({ length: this.vertexCount }, () => {
			return new Vector2d();
		});
		/** @ignore */
		this._hullPolygon = null;
	}

	/**
	 * Project all vertices through projectionMatrix × currentTransform
	 * and store the results in `this.vertices`.
	 * @param {number} [offsetX=0] - x offset added to each projected vertex
	 * @param {number} [offsetY=0] - y offset added to each projected vertex
	 * @param {number} [zScale=0] - scale factor for Z output (0 = skip Z, 1000 = depth buffer range)
	 * @ignore
	 */
	_projectVertices(offsetX = 0, offsetY = 0, zScale = 0) {
		_combinedMatrix.copy(this.projectionMatrix);
		_combinedMatrix.multiply(this.currentTransform);
		projectVertices(
			this.originalVertices,
			this.vertices,
			this.vertexCount,
			_combinedMatrix.val,
			this.width,
			this.height,
			offsetX,
			offsetY,
			zScale,
		);
	}

	/**
	 * Draw the mesh (automatically called by melonJS).
	 * Projects vertices through projectionMatrix × currentTransform and calls renderer.drawMesh().
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 */
	draw(renderer) {
		this._projectVertices(this.pos.x, this.pos.y, 1000);
		renderer.drawMesh(this);
	}

	/**
	 * Compute a 2D convex hull polygon from the current projected vertices.
	 * Useful for creating collision shapes.
	 * @returns {Polygon} a convex hull polygon in local coordinates
	 */
	toPolygon() {
		// update cached points from projected vertices
		for (let i = 0; i < this.vertexCount; i++) {
			this._hullPoints[i].set(this.vertices[i * 3], this.vertices[i * 3 + 1]);
		}

		// Graham scan convex hull (sorts in place, returns a subset)
		const hull = convexHull(this._hullPoints);

		if (this._hullPolygon === null) {
			this._hullPolygon = new Polygon(0, 0, hull);
		} else {
			this._hullPolygon.setVertices(hull);
		}

		return this._hullPolygon;
	}

	/**
	 * Render the mesh at its current state (transforms, projection, tint) to an offscreen canvas.
	 * The returned canvas can be used with `renderer.drawImage()`, as a `Sprite` image source,
	 * or converted to an ImageBitmap via `createImageBitmap()`.
	 * @returns {HTMLCanvasElement} an offscreen canvas containing the rendered mesh
	 * @example
	 * // snapshot the mesh and create a Sprite from it
	 * const canvas = mesh.toCanvas();
	 * const sprite = new me.Sprite(100, 100, { image: canvas });
	 *
	 * // or draw directly
	 * renderer.drawImage(mesh.toCanvas(), 100, 100);
	 */
	toCanvas() {
		const w = this.width;
		const h = this.height;

		// project vertices into local space (no pos offset, no Z)
		this._projectVertices(0, 0, false);

		// render to offscreen canvas using affine texture mapping
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");

		const image = this.texture.getTexture();
		const imgW = image.width;
		const imgH = image.height;
		const uvs = this.uvs;
		const indices = this.indices;
		const vertices = this.vertices;
		const cullBack = this.cullBackFaces === true;

		// build visible triangles sorted back-to-front
		const tris = [];
		for (let j = 0; j < indices.length; j += 3) {
			const i0 = indices[j];
			const i1 = indices[j + 1];
			const i2 = indices[j + 2];
			const x0 = vertices[i0 * 3];
			const y0 = vertices[i0 * 3 + 1];
			const x1 = vertices[i1 * 3];
			const y1 = vertices[i1 * 3 + 1];
			const x2 = vertices[i2 * 3];
			const y2 = vertices[i2 * 3 + 1];

			if (cullBack) {
				const cross = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
				if (cross > 0) {
					continue;
				}
			}

			tris.push(i0, i1, i2);
		}

		// draw each triangle
		for (let t = 0; t < tris.length; t += 3) {
			const i0 = tris[t];
			const i1 = tris[t + 1];
			const i2 = tris[t + 2];
			const x0 = vertices[i0 * 3];
			const y0 = vertices[i0 * 3 + 1];
			const x1 = vertices[i1 * 3];
			const y1 = vertices[i1 * 3 + 1];
			const x2 = vertices[i2 * 3];
			const y2 = vertices[i2 * 3 + 1];

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

			ctx.save();
			ctx.beginPath();
			ctx.moveTo(x0, y0);
			ctx.lineTo(x1, y1);
			ctx.lineTo(x2, y2);

			if (rawDet === 0) {
				// degenerate UV — fill with sampled solid color
				ctx.closePath();
				const tmpCanvas = document.createElement("canvas");
				tmpCanvas.width = 1;
				tmpCanvas.height = 1;
				const tmpCtx = tmpCanvas.getContext("2d");
				const sx = Math.min(Math.max(Math.round(u0), 0), imgW - 1);
				const sy = Math.min(Math.max(Math.round(v0), 0), imgH - 1);
				tmpCtx.drawImage(image, sx, sy, 1, 1, 0, 0, 1, 1);
				const pixel = tmpCtx.getImageData(0, 0, 1, 1).data;
				ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
				ctx.fill();
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

				ctx.clip();
				ctx.transform(a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0);
				ctx.drawImage(image, 0, 0);
			}
			ctx.restore();
		}

		return canvas;
	}

	/**
	 * Render the mesh at its current state to an ImageBitmap.
	 * Useful for creating textures or sprites from the rendered mesh.
	 * @returns {Promise<ImageBitmap>} a promise that resolves to an ImageBitmap of the rendered mesh
	 * @example
	 * const bitmap = await mesh.toImageBitmap();
	 * const sprite = new me.Sprite(100, 100, { image: bitmap });
	 */
	toImageBitmap() {
		return createImageBitmap(this.toCanvas());
	}
}
