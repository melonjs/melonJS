/**
 * A texture data source that knows how to upload itself to a WebGL
 * texture. Subclasses provide the actual upload logic for their kind
 * of source (raw buffer, image, compressed data, etc.).
 *
 * Resources flow through the same `TextureCache` / batcher machinery
 * as image-backed `TextureAtlas` instances: they expose the minimal
 * shape (`sources`, `activeAtlas`, `getTexture()`, plus `width` /
 * `height` / `premultipliedAlpha` / `repeat` / `filter`) the cache
 * uses for unit allocation and the batcher uses for `boundTextures`
 * bookkeeping. The cache therefore owns every `gl.bindTexture` call,
 * which keeps the JS-side binding state in lockstep with the actual
 * GL state across all texture kinds — image atlases included.
 *
 * Subclasses MUST implement `upload(gl, target)`. The framework calls
 * it once per texture on first use (and again on forced re-upload via
 * `batcher.uploadTexture(resource, w, h, true)`).
 *
 * @category Rendering
 */
export class TextureResource {
	/**
	 * @param {object} options
	 * @param {number} options.width   - pixel width of the texture
	 * @param {number} options.height  - pixel height of the texture
	 * @param {boolean} [options.premultipliedAlpha=false]
	 * @param {string}  [options.repeat="no-repeat"] - "no-repeat" | "repeat" | "repeat-x" | "repeat-y"
	 * @param {number}  [options.filter] - `gl.NEAREST` or `gl.LINEAR`; when
	 *   omitted the batcher falls back to the renderer's `antiAlias` setting
	 */
	constructor({
		width,
		height,
		premultipliedAlpha = false,
		repeat = "no-repeat",
		filter,
	} = {}) {
		/** @type {number} */
		this.width = width;
		/** @type {number} */
		this.height = height;
		/** @type {boolean} */
		this.premultipliedAlpha = premultipliedAlpha;
		/** @type {string} */
		this.repeat = repeat;
		/** @type {number|undefined} */
		this.filter = filter;

		// minimal `TextureAtlas`-shaped surface for the cache + batcher
		this.sources = new Map([["default", this]]);
		this.activeAtlas = "default";
	}

	/**
	 * Returns the upload "source" the batcher hands to `createTexture2D`.
	 * For a resource this is the resource itself — `createTexture2D`
	 * dispatches to `resource.upload(gl, target)`.
	 * @ignore
	 */
	getTexture() {
		return this;
	}

	/**
	 * Issue the `gl.texImage2D` (or equivalent) call that uploads this
	 * resource's data into the currently-bound `TEXTURE_2D` slot.
	 * Subclasses MUST override.
	 * @abstract
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
	 * @param {number} target - `gl.TEXTURE_2D` (or future cube-map targets)
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	upload(gl, target) {
		throw new Error("TextureResource subclasses must implement upload()");
	}
}

/**
 * A texture sourced from a raw byte buffer. Used for synthesized
 * textures (TMX layer GID index, font atlases, color LUTs, signed-
 * distance fields, palette tables, etc.) — any case where the texture
 * data isn't an image file.
 *
 * The buffer is uploaded as-is; the resource's `premultipliedAlpha`
 * flag is applied at upload time so a raw-data texture (typical:
 * `premultipliedAlpha = false`) doesn't get its RGB wiped by the
 * driver when the alpha channel is zero.
 *
 * @category Rendering
 */
export class BufferTextureResource extends TextureResource {
	/**
	 * @param {ArrayBufferView} data - the pixel data; size must be
	 *   `width * height * 4` bytes for the default RGBA / UNSIGNED_BYTE
	 *   format
	 * @param {object} options
	 * @param {number}  options.width
	 * @param {number}  options.height
	 * @param {boolean} [options.premultipliedAlpha=false]
	 * @param {string}  [options.repeat="no-repeat"]
	 * @param {number}  [options.filter]
	 * @param {"rgba8"|"rgba8ui"} [options.format="rgba8"] - storage format.
	 *   `"rgba8"` (default): normalized RGBA, sampled via `sampler2D` /
	 *   `texture()`. `"rgba8ui"`: unsigned-integer RGBA, sampled via
	 *   `usampler2D` / `texelFetch()` — requires WebGL2. Use the integer
	 *   form for raw-data lookups (GID tables, palette indices, etc.) to
	 *   skip the float-decode round trip and gain exact integer reads.
	 */
	constructor(data, options) {
		super(options);
		/** @type {ArrayBufferView} */
		this.data = data;
		/** @type {string} */
		this.format = options.format || "rgba8";
	}

	/** @ignore */
	upload(gl, target) {
		if (this.format === "rgba8ui") {
			// `RGBA8UI` / `RGBA_INTEGER` are WebGL 2-only enums. On a
			// WebGL 1 context they're `undefined`, which would otherwise
			// silently invoke `texImage2D` with bogus values and corrupt
			// the texture — surface a clear error so callers know to
			// either drop down to `rgba8` or guard their construction.
			if (typeof gl.RGBA8UI === "undefined") {
				throw new Error(
					'BufferTextureResource: format "rgba8ui" requires a WebGL 2 context',
				);
			}
			gl.texImage2D(
				target,
				0,
				gl.RGBA8UI,
				this.width,
				this.height,
				0,
				gl.RGBA_INTEGER,
				gl.UNSIGNED_BYTE,
				this.data,
			);
		} else {
			gl.texImage2D(
				target,
				0,
				gl.RGBA,
				this.width,
				this.height,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				this.data,
			);
		}
	}
}
