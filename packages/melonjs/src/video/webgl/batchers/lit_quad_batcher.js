import { Vector2d } from "../../../math/vector2d.ts";
import IndexBuffer from "../buffer/index.js";
import {
	buildLitMultiTextureFragment,
	MAX_LIGHTS,
} from "./../shaders/multitexture-lit.js";
import quadMultiLitVertex from "./../shaders/quad-multi-lit.vert";
import QuadBatcher from "./quad_batcher.js";

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
 * Lit-aware variant of `QuadBatcher` for the SpriteIlluminator workflow.
 *
 * Adds a 5th vertex attribute (`aNormalTextureId`) so each quad knows
 * which paired normal-map sampler to read, and bundles the per-frame
 * light uniforms (`uLightPos`, `uLightColor`, `uLightHeight`, `uAmbient`)
 * that the lit fragment shader iterates.
 *
 * Texture-slot capacity is halved relative to `QuadBatcher` because each
 * sprite may need a paired (color, normal) sampler — color goes to unit
 * `n`, normal to unit `maxBatchTextures + n`. The `WebGLRenderer` only
 * dispatches sprites here when the scene actually needs lighting (active
 * `Light2d` AND the sprite has a `normalMap`); unlit sprites stay on
 * `QuadBatcher` and pay nothing.
 * @category Rendering
 */
export default class LitQuadBatcher extends QuadBatcher {
	/**
	 * @ignore
	 */
	init(renderer) {
		// halve the texture cap: each color slot is paired with a normal
		// slot at offset `+ maxBatchTextures` so the WebGL1 8-unit minimum
		// still affords at least 4 lit sprites per batch.
		const halved = Math.min(
			Math.max(1, Math.floor(renderer.maxTextures / 2)),
			16,
		);

		// We can't call super.init because QuadBatcher's vertex shader and
		// attribute layout differ. Reach past it to MaterialBatcher.init
		// directly — same pattern QuadBatcher itself uses.
		this.maxBatchTextures = halved;

		Object.getPrototypeOf(QuadBatcher.prototype).init.call(this, renderer, {
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
				vertex: quadMultiLitVertex,
				fragment: buildLitMultiTextureFragment(halved),
			},
		});

		// bind color samplers to units 0..N-1, paired normals to N..2N-1
		for (let i = 0; i < halved; i++) {
			this.defaultShader.setUniform("uSampler" + i, i);
			this.defaultShader.setUniform("uNormalSampler" + i, halved + i);
		}

		/**
		 * normal-map texture per color slot — keyed by the same unit index as
		 * `boundTextures`. Used by `addQuad` to detect when a normal-map slot
		 * needs (re-)uploading, mirroring the color-texture cache.
		 * @type {Array<HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|HTMLVideoElement|null>}
		 * @ignore
		 */
		this.boundNormalMaps = new Array(halved).fill(null);

		/**
		 * Map from a normal-map source image to its GL texture object.
		 * @type {Map<HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|HTMLVideoElement, WebGLTexture>}
		 * @ignore
		 */
		this.normalMapTextures = new Map();

		this._lightCount = 0;
		this._maxLights = MAX_LIGHTS;
		this.defaultShader.setUniform("uLightCount", 0);
		this.defaultShader.setUniform("uAmbient", [0, 0, 0]);

		this.useMultiTexture = true;

		const maxQuads = this.vertexData.maxVertex / 4;
		this.indexBuffer = new IndexBuffer(
			this.gl,
			maxQuads * 6,
			this.renderer.WebGLVersion > 1,
		);
		this.indexBuffer.fillQuadPattern(maxQuads);
	}

	/**
	 * @ignore
	 */
	reset() {
		// MaterialBatcher.reset (skip QuadBatcher to avoid its index-buffer
		// rebuild that uses stale maxBatchTextures math)
		Object.getPrototypeOf(QuadBatcher.prototype).reset.call(this);

		const maxQuads = this.vertexData.maxVertex / 4;
		this.indexBuffer = new IndexBuffer(
			this.gl,
			maxQuads * 6,
			this.renderer.WebGLVersion > 1,
		);
		this.indexBuffer.fillQuadPattern(maxQuads);

		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform("uSampler" + i, i);
			this.defaultShader.setUniform(
				"uNormalSampler" + i,
				this.maxBatchTextures + i,
			);
		}
		this.boundNormalMaps.fill(null);
		const gl = this.gl;
		this.normalMapTextures.forEach((tex) => {
			gl.deleteTexture(tex);
		});
		this.normalMapTextures.clear();
		this._lightCount = 0;
		this.defaultShader.setUniform("uLightCount", 0);
		this.defaultShader.setUniform("uAmbient", [0, 0, 0]);
		this.useMultiTexture = true;
	}

	/**
	 * Upload per-frame Light2d uniforms used by the lit fragment path.
	 * Called once per camera per frame (before the world tree walk).
	 * Lights past `MAX_LIGHTS` are silently ignored.
	 *
	 * Coordinates must be supplied in the same space as the renderer's
	 * pre-projection vertex coords (i.e. camera-local / FBO-local),
	 * matching `Stage.drawLighting`'s convention.
	 * @param {object} uniforms
	 * @param {Float32Array} uniforms.positions - flat array of `[x, y, radius, intensity]` per light, length = 4 * count
	 * @param {Float32Array} uniforms.colors - flat array of `[r, g, b]` per light, length = 3 * count
	 * @param {Float32Array} [uniforms.heights] - flat array of per-light height, length = MAX_LIGHTS
	 * @param {number} uniforms.count - number of lights to render (clamped to MAX_LIGHTS)
	 * @param {number[]} [uniforms.ambient] - `[r, g, b]` ambient floor (0..1 each)
	 */
	setLightUniforms(uniforms) {
		const shader = this.defaultShader;
		const count = Math.min(uniforms.count | 0, this._maxLights);
		this._lightCount = count;
		shader.setUniform("uLightCount", count);
		if (count > 0) {
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
	 * Upload (first time) or rebind (subsequent times) a normal-map image
	 * to the given texture unit. Normal-map textures don't go through the
	 * `TextureCache`; they're cached per-image in `normalMapTextures`.
	 *
	 * `premultipliedAlpha = false` — normal maps store linear-encoded
	 * surface normals; multiplying through alpha would corrupt the
	 * encoding for any non-opaque texel.
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|HTMLVideoElement} image - normal-map source
	 * @param {number} unit - GL texture unit (already offset by `maxBatchTextures`)
	 * @ignore
	 */
	_uploadOrBindNormalMap(image, unit) {
		const gl = this.gl;
		const cached = this.normalMapTextures.get(image);
		if (typeof cached !== "undefined") {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, cached);
			return;
		}
		this.createTexture2D(
			unit,
			image,
			this.renderer.settings.antiAlias ? gl.LINEAR : gl.NEAREST,
			"no-repeat",
			image.width,
			image.height,
			false,
			undefined,
			undefined,
			false,
		);
		this.normalMapTextures.set(image, this.boundTextures[unit]);
	}

	/**
	 * Add a textured quad with optional paired normal map.
	 * @param {TextureAtlas} texture - Source texture atlas
	 * @param {number} x - Destination x-coordinate
	 * @param {number} y - Destination y-coordinate
	 * @param {number} w - Destination width
	 * @param {number} h - Destination height
	 * @param {number} u0 - Texture UV (u0) value
	 * @param {number} v0 - Texture UV (v0) value
	 * @param {number} u1 - Texture UV (u1) value
	 * @param {number} v1 - Texture UV (v1) value
	 * @param {number} tint - tint color (UINT32 argb)
	 * @param {boolean} [reupload=false] - Force the texture to be reuploaded
	 * @param {HTMLImageElement|HTMLCanvasElement|null} [normalMap=null] - paired normal-map (SpriteIlluminator workflow)
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
			unit = this.uploadTexture(texture, w, h, reupload, false);
			if (unit >= this.maxBatchTextures) {
				this.flush();
				this.renderer.cache.resetUnitAssignments();
				this.boundNormalMaps.fill(null);
				unit = this.uploadTexture(texture, w, h, reupload, false);
			}
		} else {
			unit = this.uploadTexture(texture, w, h, reupload);
			if (unit !== this.currentSamplerUnit) {
				this.currentShader.setUniform("uSampler", unit);
				this.currentSamplerUnit = unit;
			}
		}

		let normalTextureId = -1;
		if (normalMap !== null && this.useMultiTexture) {
			const normalUnit = this.maxBatchTextures + unit;
			const prev = this.boundNormalMaps[unit];
			if (prev !== normalMap) {
				// flush any pending vertices that referenced the previous
				// normal map at this slot before rebinding
				if (prev !== null) {
					this.flush();
				}
				this._uploadOrBindNormalMap(normalMap, normalUnit);
				this.boundNormalMaps[unit] = normalMap;
			}
			normalTextureId = unit;
		}

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

		const textureId = this.useMultiTexture ? unit : 0;
		vertexData.push(vec0.x, vec0.y, u0, v0, tint, textureId, normalTextureId);
		vertexData.push(vec1.x, vec1.y, u1, v0, tint, textureId, normalTextureId);
		vertexData.push(vec2.x, vec2.y, u0, v1, tint, textureId, normalTextureId);
		vertexData.push(vec3.x, vec3.y, u1, v1, tint, textureId, normalTextureId);
	}

	/**
	 * Override blitTexture so the FBO blit pushes -1 as the unlit
	 * sentinel (the vertex layout includes aNormalTextureId).
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

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source);
		shader.setUniform("uSampler", 0);

		const tint = 0xffffffff;
		this.vertexData.push(x, y, 0, 1, tint, 0, -1);
		this.vertexData.push(x + width, y, 1, 1, tint, 0, -1);
		this.vertexData.push(x, y + height, 0, 0, tint, 0, -1);
		this.vertexData.push(x + width, y + height, 1, 0, tint, 0, -1);

		this.flush();

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
		delete this.boundTextures[0];

		this.useShader(this.defaultShader);
	}
}
