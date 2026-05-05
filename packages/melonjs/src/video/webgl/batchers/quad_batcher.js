import { Vector2d } from "../../../math/vector2d.ts";
import IndexBuffer from "../buffer/index.js";
import {
	buildMultiTextureFragment,
	MAX_LIGHTS,
} from "./../shaders/multitexture.js";
import quadMultiVertex from "./../shaders/quad-multi.vert";
import { MaterialBatcher } from "./material_batcher.js";

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 */

// a pool of reusable vectors
const V_ARRAY = [
	new Vector2d(),
	new Vector2d(),
	new Vector2d(),
	new Vector2d(),
];

/**
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @category Rendering
 */
export default class QuadBatcher extends MaterialBatcher {
	/**
	 * Initialize the compositor
	 * @ignore
	 */
	init(renderer) {
		/**
		 * The maximum number of color sampler slots used for multi-texture
		 * batching. Paired with an equally-sized pool of normal-map sampler
		 * slots starting at unit `maxBatchTextures` (so a sprite's color
		 * goes to unit `n` and its `normalMap` to unit `maxBatchTextures + n`).
		 * Halved relative to the renderer's hard limit so that even on
		 * WebGL1's 8-unit minimum spec the paired layout still fits.
		 * @type {number}
		 * @ignore
		 */
		this.maxBatchTextures = Math.min(
			Math.max(1, Math.floor(renderer.maxTextures / 2)),
			16,
		);

		super.init(renderer, {
			attributes: [
				{
					name: "aVertex",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aRegion",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 2 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					size: 4,
					type: renderer.gl.UNSIGNED_BYTE,
					normalized: true,
					offset: 4 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aTextureId",
					size: 1,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 5 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aNormalTextureId",
					size: 1,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: quadMultiVertex,
				fragment: buildMultiTextureFragment(this.maxBatchTextures),
			},
		});

		// bind all color sampler uniforms to their respective texture units
		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform("uSampler" + i, i);
		}
		// bind paired normal-map sampler uniforms to a parallel set of
		// units (offset by `maxBatchTextures`). When a sprite has
		// `normalMap` set, its color goes to unit `n` and its normal goes
		// to unit `maxBatchTextures + n`.
		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform(
				"uNormalSampler" + i,
				this.maxBatchTextures + i,
			);
		}

		/**
		 * normal-map texture per color slot — keyed by the same unit index as
		 * `boundTextures`. Used by `addQuad` to detect when a normal-map slot
		 * needs (re-)uploading, mirroring the color-texture cache.
		 * @type {Array<HTMLImageElement|HTMLCanvasElement|null>}
		 * @ignore
		 */
		this.boundNormalMaps = new Array(this.maxBatchTextures).fill(null);

		/**
		 * Map from a normal-map source image to its GL texture object.
		 * Lazily populated on first use; the GL texture is created once
		 * and re-bound on subsequent quads that reference the same
		 * `normalMap`. Cleared on context loss / batcher reset.
		 * @type {Map<HTMLImageElement|HTMLCanvasElement, WebGLTexture>}
		 * @ignore
		 */
		this.normalMapTextures = new Map();

		// initialize empty light state — Stage / Camera2d sets these via
		// `setLightUniforms` before each frame's draw.
		this._lightCount = 0;
		this._maxLights = MAX_LIGHTS;
		this.defaultShader.setUniform("uLightCount", 0);
		this.defaultShader.setUniform("uAmbient", [0, 0, 0]);

		/**
		 * whether multi-texture batching is currently active
		 * (disabled when a custom ShaderEffect is applied)
		 * @type {boolean}
		 * @ignore
		 */
		this.useMultiTexture = true;

		// create the index buffer for quad batching (4 verts + 6 indices per quad)
		const maxQuads = this.vertexData.maxVertex / 4;
		this.indexBuffer = new IndexBuffer(
			this.gl,
			maxQuads * 6,
			this.renderer.WebGLVersion > 1,
		);
		this.indexBuffer.fillQuadPattern(maxQuads);
	}

	/**
	 * Select the shader to use for compositing.
	 * Multi-texture batching is automatically enabled when the default
	 * shader is active, and disabled for custom ShaderEffect shaders.
	 * @see GLShader
	 * @see ShaderEffect
	 * @param {GLShader|ShaderEffect} shader - a reference to a GLShader or ShaderEffect instance
	 */
	useShader(shader) {
		super.useShader(shader);
		this.useMultiTexture = shader === this.defaultShader;
	}

	/**
	 * Reset compositor internal state
	 * @ignore
	 */
	reset() {
		super.reset();

		// re-create index buffer after context loss
		const maxQuads = this.vertexData.maxVertex / 4;
		this.indexBuffer = new IndexBuffer(
			this.gl,
			maxQuads * 6,
			this.renderer.WebGLVersion > 1,
		);
		this.indexBuffer.fillQuadPattern(maxQuads);

		// re-bind sampler uniforms after context restore
		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform("uSampler" + i, i);
			this.defaultShader.setUniform(
				"uNormalSampler" + i,
				this.maxBatchTextures + i,
			);
		}
		this.boundNormalMaps.fill(null);
		this.normalMapTextures.clear();
		this._lightCount = 0;
		this.defaultShader.setUniform("uLightCount", 0);
		this.defaultShader.setUniform("uAmbient", [0, 0, 0]);
		this.useMultiTexture = true;
	}

	/**
	 * Upload per-frame Light2d uniforms used by the lit fragment path of
	 * the batcher's shader. Called once per camera per frame (before the
	 * world tree walk). Lights past `MAX_LIGHTS` are silently ignored.
	 *
	 * Coordinates must be supplied in the same space as the renderer's
	 * pre-projection vertex coords (i.e. camera-local / FBO-local),
	 * matching `Stage.drawLighting`'s convention. The caller is
	 * responsible for translating world-space `Light2d.pos` by
	 * `(-translateX, -translateY)`.
	 * @param {object} uniforms
	 * @param {Float32Array} uniforms.positions - flat array of `[x, y, radius, intensity]` per light, length = 4 * count
	 * @param {Float32Array} uniforms.colors - flat array of `[r, g, b]` per light, length = 3 * count
	 * @param {number} uniforms.count - number of lights to render (clamped to MAX_LIGHTS)
	 * @param {number[]} uniforms.ambient - `[r, g, b]` ambient floor (0..1 each)
	 */
	setLightUniforms(uniforms) {
		const shader = this.defaultShader;
		const count = Math.min(uniforms.count | 0, this._maxLights);
		this._lightCount = count;
		shader.setUniform("uLightCount", count);
		if (count > 0) {
			// `uLightPos`, `uLightColor`, `uLightHeight` are GLSL arrays;
			// the renderer's uniform parser stores them under the
			// unbracketed name. Passing the full Float32Array uploads all
			// `count` elements starting at index 0 via the appropriate
			// `gl.uniform*v` call.
			shader.setUniform("uLightPos", uniforms.positions);
			shader.setUniform("uLightColor", uniforms.colors);
			if (uniforms.heights) {
				shader.setUniform("uLightHeight", uniforms.heights);
			}
		}
		if (uniforms.ambient) {
			shader.setUniform("uAmbient", uniforms.ambient);
		}
	}

	/**
	 * Flush batched texture data to the GPU using indexed drawing.
	 * @param {number} [mode=gl.TRIANGLES] - the GL drawing mode
	 */
	flush(mode = this.mode) {
		const vertex = this.vertexData;
		const vertexCount = vertex.vertexCount;

		if (vertexCount > 0) {
			const gl = this.gl;
			const vertexSize = vertex.vertexSize;

			// ensure the index buffer is bound
			this.indexBuffer.bind();

			if (this.renderer.WebGLVersion > 1) {
				gl.bufferData(
					gl.ARRAY_BUFFER,
					vertex.toFloat32(),
					gl.STREAM_DRAW,
					0,
					vertexCount * vertexSize,
				);
			} else {
				gl.bufferData(
					gl.ARRAY_BUFFER,
					vertex.toFloat32(0, vertexCount * vertexSize),
					gl.STREAM_DRAW,
				);
			}

			// 4 vertices per quad -> vertexCount/4 quads -> *6 indices per quad
			const indexCount = (vertexCount / 4) * 6;
			gl.drawElements(mode, indexCount, this.indexBuffer.type, 0);

			vertex.clear();
		}
	}

	/**
	 * Draw a screen-aligned quad with the given raw WebGL texture through the given shader.
	 * Binds the texture to unit 0, pushes 4 vertices (Y-flipped UVs), flushes,
	 * then unbinds the texture.
	 * @param {WebGLTexture} source - the raw GL texture to blit
	 * @param {number} x - destination x
	 * @param {number} y - destination y
	 * @param {number} width - destination width
	 * @param {number} height - destination height
	 * @param {GLShader|ShaderEffect} shader - the shader effect to apply
	 */
	blitTexture(source, x, y, width, height, shader) {
		const gl = this.gl;

		this.useShader(shader);

		// bind the source texture to unit 0
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source);
		shader.setUniform("uSampler", 0);

		// push a screen-aligned quad with Y-flipped UVs.
		// `aNormalTextureId = -1` flags the unlit path (the FBO blit
		// shouldn't run lighting math even if the renderer has lights set).
		const tint = 0xffffffff;
		this.vertexData.push(x, y, 0, 1, tint, 0, -1);
		this.vertexData.push(x + width, y, 1, 1, tint, 0, -1);
		this.vertexData.push(x, y + height, 0, 0, tint, 0, -1);
		this.vertexData.push(x + width, y + height, 1, 0, tint, 0, -1);

		this.flush();

		// unbind the texture to prevent feedback loop on next frame
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
		delete this.boundTextures[0];

		// restore the default shader (also re-enables multi-texture batching)
		this.useShader(this.defaultShader);
	}

	/**
	 * Upload (first time) or rebind (subsequent times) a normal-map image
	 * to the given texture unit. Normal-map textures don't go through the
	 * `TextureCache` (they don't share atlas semantics with color
	 * textures); they're cached per-image in `normalMapTextures`.
	 *
	 * Normal maps store linear-encoded surface normals (RGB → XYZ via
	 * `2.0 * rgb - 1.0` in the shader), so premultiplied alpha is
	 * disabled here — multiplying through alpha would corrupt the
	 * encoding for any non-opaque texel.
	 * @param {HTMLImageElement|HTMLCanvasElement} image - normal-map source
	 * @param {number} unit - GL texture unit (already offset by `maxBatchTextures`)
	 * @ignore
	 */
	_uploadOrBindNormalMap(image, unit) {
		const gl = this.gl;
		let glTex = this.normalMapTextures.get(image);
		if (typeof glTex !== "undefined") {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, glTex);
			return;
		}
		// first-time upload
		glTex = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, glTex);
		const filter = this.renderer.settings.antiAlias ? gl.LINEAR : gl.NEAREST;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		this.normalMapTextures.set(image, glTex);
	}

	/**
	 * Add a textured quad
	 * @param {TextureAtlas} texture - Source texture atlas
	 * @param {number} x - Destination x-coordinate
	 * @param {number} y - Destination y-coordinate
	 * @param {number} w - Destination width
	 * @param {number} h - Destination height
	 * @param {number} u0 - Texture UV (u0) value.
	 * @param {number} v0 - Texture UV (v0) value.
	 * @param {number} u1 - Texture UV (u1) value.
	 * @param {number} v1 - Texture UV (v1) value.
	 * @param {number} tint - tint color to be applied to the texture in UINT32 (argb) format
	 * @param {boolean} [reupload=false] - Force the texture to be reuploaded even if already bound
	 * @param {HTMLImageElement|HTMLCanvasElement|null} [normalMap=null] - optional paired normal-map image (SpriteIlluminator workflow). When present, the quad goes through the shader's lit path with `Stage._activeLights` applied per pixel.
	 */
	addQuad(
		texture,
		x,
		y,
		w,
		h,
		u0,
		v0,
		u1,
		v1,
		tint,
		reupload = false,
		normalMap = null,
	) {
		const vertexData = this.vertexData;

		if (vertexData.isFull(4)) {
			this.flush();
		}

		let unit;

		if (this.useMultiTexture) {
			// multi-texture path: embed the texture unit in the vertex data
			// and avoid flushing on texture changes
			unit = this.uploadTexture(texture, w, h, reupload, false);
			// shader only supports maxBatchTextures samplers — flush and
			// reset if the cache assigned a unit beyond the shader's range
			if (unit >= this.maxBatchTextures) {
				this.flush();
				this.renderer.cache.resetUnitAssignments();
				unit = this.uploadTexture(texture, w, h, reupload, false);
			}
		} else {
			// single-texture fallback (custom ShaderEffect active):
			// use regular upload which flushes on texture change, and set uSampler
			unit = this.uploadTexture(texture, w, h, reupload);
			if (unit !== this.currentSamplerUnit) {
				this.currentShader.setUniform("uSampler", unit);
				this.currentSamplerUnit = unit;
			}
		}

		// Bind the paired normal map (when present) to the parallel
		// sampler unit. The shader's lit path reads from `uNormalSampler<n>`
		// where n = aNormalTextureId.
		let normalTextureId = -1;
		if (normalMap !== null && this.useMultiTexture) {
			const normalUnit = this.maxBatchTextures + unit;
			const prev = this.boundNormalMaps[unit];
			if (prev !== normalMap) {
				// If this slot already had a different normal-map bound, the
				// vertices already in the batch are sampling that one — flush
				// before rebinding so they draw with their original normal.
				// (Only happens when two lit sprites in the same batch share
				// a color texture but have different normal maps; rare with
				// the canonical SpriteIlluminator workflow but worth getting
				// right.)
				if (prev !== null) {
					this.flush();
				}
				this._uploadOrBindNormalMap(normalMap, normalUnit);
				this.boundNormalMaps[unit] = normalMap;
			}
			normalTextureId = unit;
		}

		// Transform vertices
		const m = this.viewMatrix;
		const vec0 = V_ARRAY[0].set(x, y);
		const vec1 = V_ARRAY[1].set(x + w, y);
		const vec2 = V_ARRAY[2].set(x, y + h);
		const vec3 = V_ARRAY[3].set(x + w, y + h);

		if (!m.isIdentity()) {
			m.apply(vec0);
			m.apply(vec1);
			m.apply(vec2);
			m.apply(vec3);
		}

		// 4 vertices per quad; the index buffer provides the 6 indices
		// textureId is the unit index for multi-texture, or 0 for single-texture fallback
		const textureId = this.useMultiTexture ? unit : 0;
		vertexData.push(vec0.x, vec0.y, u0, v0, tint, textureId, normalTextureId);
		vertexData.push(vec1.x, vec1.y, u1, v0, tint, textureId, normalTextureId);
		vertexData.push(vec2.x, vec2.y, u0, v1, tint, textureId, normalTextureId);
		vertexData.push(vec3.x, vec3.y, u1, v1, tint, textureId, normalTextureId);
	}
}
