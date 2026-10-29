import { Color } from "../../../math/color.ts";
import { FRAME_UNBOUNDED, frameClampMode, isFramed } from "../../gpu/frame.js";
import { scaleQuad, transformQuadCorners } from "../../gpu/quadcorners.ts";
import IndexBuffer from "../buffer/index.js";
import { buildMultiTextureFragment } from "./../shaders/multitexture.js";
import quadMultiVertex from "./../shaders/quad-multi.vert";
import { resolveTopology } from "../utils/topology.js";
import { MaterialBatcher } from "./material_batcher.js";

/**
 * the blit's tint: white, at the opacity the blit composites at
 * @ignore
 */
const blitTint = new Color(255, 255, 255);

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 * @import GLShader from "../glshader.js";
 * @import ShaderEffect from "../../effects/shadereffect.js";
 */

/**
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @category Rendering
 */
export default class QuadBatcher extends MaterialBatcher {
	/**
	 * Initialize the compositor
	 * @ignore
	 * @internal
	 */
	init(renderer) {
		/**
		 * the maximum number of texture units used for multi-texture batching
		 * @type {number}
		 * @ignore
		 * @internal
		 */
		// the full pool the renderer resolved (#1585). The 16 that used to cap
		// this was the WebGL 2 spec FLOOR for MAX_TEXTURE_IMAGE_UNITS — safe
		// everywhere, and half of what current desktop and mobile hardware
		// actually reports. `renderer.maxTextures` is already clamped there,
		// including by the `maxTextures` application setting.
		this.maxBatchTextures = renderer.maxTextures;

		super.init(renderer, {
			attributes: [
				{
					// vec3: (x, y, z). z carries `renderable.depth` for
					// perspective projection (Camera3d). Stride = 36 bytes.
					name: "aVertex",
					format: "float32x3",
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aRegion",
					format: "float32x2",
					offset: 3 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					format: "unorm8x4",
					offset: 5 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aTextureId",
					format: "float32",
					offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					// the UV of the quad's opposite corner, which with the
					// vertex's own makes the frame the quad draws (see
					// shaders/frameclamp.js). After the attributes a custom
					// shader declares, so those keep their locations; the
					// lit layout keeps it here too, its extras after it
					name: "aFrame",
					format: "float32x2",
					offset: 7 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: quadMultiVertex,
				fragment: buildMultiTextureFragment(this.maxBatchTextures),
			},
		});

		this.bindColorSamplers();
		this.syncFrameClamp();

		/**
		 * whether multi-texture batching is currently active
		 * (disabled when a custom ShaderEffect is applied)
		 * @type {boolean}
		 * @ignore
		 * @internal
		 */
		this.useMultiTexture = true;

		this.createIndexBuffer();
	}

	/**
	 * (Re-)create the index buffer for quad batching (4 verts + 6 indices per quad).
	 * Called from `init` and `reset` (after context loss).
	 * @ignore
	 * @internal
	 */
	createIndexBuffer() {
		// The ELEMENT_ARRAY_BUFFER binding is vertex-state state, so the
		// buffer must be created and captured with THIS batcher's vertex
		// state current — `captureIndexBuffer` owns that protocol (and
		// restores whatever was bound, so rebuilding a non-current batcher
		// never disturbs the in-flight one).
		this.vertexState.captureIndexBuffer(undefined, () => {
			// free the previous GL buffer first (reset / context-restore
			// path) — recreating without deleting orphaned one ~12 KB
			// ELEMENT_ARRAY buffer per reset until GC collected the wrapper
			if (this.indexBuffer) {
				this.indexBuffer.destroy();
			}
			const maxQuads = this.vertexData.maxVertex / 4;
			// Uint32 indices — OES_element_index_uint is core in WebGL 2
			this.indexBuffer = new IndexBuffer(this.gl, maxQuads * 6, true);
			this.indexBuffer.fillQuadPattern(maxQuads);
			this.vertexState.descriptor.indexBuffer = this.indexBuffer;
		});
	}

	/**
	 * Bind the color sampler uniforms (`uSampler0..uSamplerN-1`) to their
	 * respective texture units. Called from `init` and `reset`.
	 * @ignore
	 * @internal
	 */
	bindColorSamplers() {
		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform("uSampler" + i, i);
		}
	}

	/**
	 * Point the default shader's frame clamp at the renderer's texture
	 * filter: on under `"linear-mipmap"`, where a sprite drawn small reads a
	 * mipmap level wide enough to reach into the next frame of its atlas,
	 * off otherwise (see `shaders/frameclamp.js`). Called at init and when
	 * the filter changes; the quads already queued draw under the mode they
	 * were queued with.
	 * @ignore
	 * @internal
	 */
	syncFrameClamp() {
		const shader = this.defaultShader;
		const mode = frameClampMode(this.renderer);
		// keyed to the shader too: a rebuilt default shader starts unset
		if (this._frameClampShader === shader && this._frameClamp === mode) {
			return;
		}
		this.flush();
		// binds the default program: keep the renderer's record of the bound
		// program true, so the next draw re-binds whichever shader it needs
		shader.setUniform("uFrameClamp", mode);
		this.renderer.currentProgram = shader.program;
		/**
		 * the frame clamp mode last written to `_frameClampShader`
		 * @ignore
		 * @internal
		 */
		this._frameClamp = mode;
		/**
		 * @ignore
		 * @internal
		 */
		this._frameClampShader = shader;
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
	 * @internal
	 */
	reset() {
		super.reset();
		this.createIndexBuffer();
		this.bindColorSamplers();
		this.useMultiTexture = true;
	}

	/**
	 * Flush batched texture data to the GPU using indexed drawing.
	 * @param {number} [mode=gl.TRIANGLES] - the GL drawing mode
	 */
	flush(mode = this.mode) {
		// this override has its own drawElements and does not chain to
		// super.flush, so it must normalize independently
		if (typeof mode === "string") {
			mode = resolveTopology(this.gl, mode);
		}
		const vertex = this.vertexData;
		const vertexCount = vertex.vertexCount;

		if (vertexCount > 0) {
			const gl = this.gl;
			const vertexSize = vertex.vertexSize;

			this.syncProgram();

			// (index buffer binding is captured in the vertex state — no
			// per-flush rebind)

			// Byte-view upload — keeps packed-color bytes intact across
			// drivers that canonicalize NaN-pattern Float32 values on
			// upload (see `VertexArrayBuffer.bufferU8`).
			const byteLength =
				vertexCount * vertexSize * Float32Array.BYTES_PER_ELEMENT;
			gl.bufferData(
				gl.ARRAY_BUFFER,
				vertex.toUint8(),
				gl.STREAM_DRAW,
				0,
				byteLength,
			);

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
	 * @param {number} [alpha=1] - the opacity to composite at (0.0 to 1.0)
	 */
	blitTexture(source, x, y, width, height, shader, alpha = 1) {
		const gl = this.gl;

		this.useShader(shader);

		// bind the source texture to unit 0 — keep the batcher's internal
		// texture-unit bookkeeping in sync with the actual GL state, or
		// later `bindTexture2D` calls may early-out on a stale
		// `currentTextureUnit` and bind to the wrong unit.
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source);
		this.currentTextureUnit = 0;
		this.boundTextures[0] = source;
		shader.setUniform("uSampler", 0);

		// `noise_uv` builtin: a blit is a full-frame quad — identity rect
		shader._setNoiseUVRect?.(width, height, width, height, 0, 0);
		// and the whole texture is the frame: sampling stays unbounded. The
		// texture is the pass's render target, the size of the quad
		shader._clearFrameRect?.(width, height);

		// the blit samples a bottom-up capture FBO (the Y-flipped UVs
		// below): uv.y grows UPWARD inside apply(), so directional bodies
		// (DropShadow) flip their y arithmetic to keep "down" down
		shader._setUVYDir?.(-1);
		// a pass of a renderable's chain: where the renderable is, for the
		// effects that place a pattern on it (local_space.js)
		shader._setLocalSpace?.(this.renderer._chainSpace);

		// (re)bind any extra textures a ShaderEffect declared via setTexture,
		// to their reserved high units — after the source claims unit 0
		shader._prepareTextures?.(this);

		// push a screen-aligned quad with Y-flipped UVs, transformed by
		// the current renderer transform. `WebGLRenderer.blitEffect` (the
		// only caller today) resets `currentTransform` to identity before
		// calling so FBO blits land in screen space; the matrix path is
		// kept for any future world-space caller that wants its preDraw
		// translate/scale honored.
		// blits are always at z = 0 (screen-space) — the shared corner
		// pool is Vector3d, so the explicit z stops leftover depth from a
		// prior addQuad leaking into the transform
		const [vec0, vec1, vec2, vec3] = transformQuadCorners(
			this.viewMatrix,
			x,
			y,
			width,
			height,
			0,
		);

		// blits stay at z = 0 (screen-space, ortho); pre-PR behavior
		// preserved unchanged. A blit draws the whole target: no frame
		const tint = blitTint.toUint32(alpha);
		const open = FRAME_UNBOUNDED;
		const vertexData = this.vertexData;
		vertexData.pushSprite(vec0.x, vec0.y, 0, 0, 1, tint, 0, open, open);
		vertexData.pushSprite(vec1.x, vec1.y, 0, 1, 1, tint, 0, open, open);
		vertexData.pushSprite(vec2.x, vec2.y, 0, 0, 0, tint, 0, open, open);
		vertexData.pushSprite(vec3.x, vec3.y, 0, 1, 0, tint, 0, open, open);

		this.flush();
		// and back to the space `uv` always was, for whatever draws next
		shader._setLocalSpace?.(null);

		// unbind the texture to prevent feedback loop on next frame, and drop
		// EVERY batcher's unit-0 slot — unit 0's GL binding is now null, and a
		// non-current batcher trusting its stale record would skip the re-bind
		// and sample an unbound texture (opaque black)
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
		this.currentTextureUnit = -1;
		this.renderer.invalidateTextureUnit(0);

		// restore the default shader (also re-enables multi-texture batching)
		this.useShader(this.defaultShader);
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
	 */
	addQuad(texture, x, y, w, h, u0, v0, u1, v1, tint, reupload = false) {
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
			// Desync guard, not the normal path — see LitQuadBatcher.addQuad.
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
			// feed the effect's `noise_uv` builtin (frame-local UVs) with this
			// quad's frame rect — min() normalizes flipped (swapped) UVs
			if (typeof this.currentShader._setNoiseUVRect === "function") {
				const source = texture.getTexture();
				const sourceWidth = source.width || source.videoWidth || 1;
				const sourceHeight = source.height || source.videoHeight || 1;
				this.currentShader._setNoiseUVRect(
					sourceWidth,
					sourceHeight,
					w,
					h,
					Math.min(u0, u1),
					Math.min(v0, v1),
				);
				// and keep its samples inside that frame (on an atlas, the
				// texture goes on into the neighbouring frames): the frame
				// comes with the quad, the half texel with the texture
				this.currentShader._setFrameTexel?.(sourceWidth, sourceHeight);
			}
			// direct atlas sampling: uv.y grows downward (directional bodies
			// compensate on the pooled path, where captures are bottom-up)
			this.currentShader._setUVYDir?.(1);
			// the effect's vertex stage, AFTER the frame rect above, which
			// must stay the sprite's own
			const scale = this.currentShader._vertexScale;
			if (scale !== undefined && (scale.x !== 1 || scale.y !== 1)) {
				const q = scaleQuad(x, y, w, h, scale.x, scale.y);
				x = q[0];
				y = q[1];
				w = q[2];
				h = q[3];
			}
		}

		// Transform vertices. Stamp per-sprite depth onto z BEFORE
		// `m.apply` so Camera3d's view matrix (3D R⁻¹ ∘ T(-pos)) fully
		// rotates the vertex. For 2D-only matrices the z column is
		// identity, so output (x, y) is bit-identical to the legacy
		// Vector2d path and z passes through unchanged.
		const [vec0, vec1, vec2, vec3] = transformQuadCorners(
			this.viewMatrix,
			x,
			y,
			w,
			h,
			this.renderer.currentDepth,
		);

		// 4 vertices per quad; the index buffer provides the 6 indices.
		// textureId is the unit index for multi-texture, or 0 for
		// single-texture fallback. A repeating texture (a pattern) samples
		// past its UVs on purpose, so it has no frame to keep to
		const textureId = this.useMultiTexture ? unit : 0;
		vertexData.pushSpriteQuad(
			vec0,
			vec1,
			vec2,
			vec3,
			u0,
			v0,
			u1,
			v1,
			tint,
			textureId,
			isFramed(texture),
		);
	}
}
