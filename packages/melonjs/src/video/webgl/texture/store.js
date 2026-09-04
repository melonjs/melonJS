import { TextureStore } from "./../../gpu/texturestore.js";

/**
 * The WebGL realization of {@link TextureStore}.
 *
 * The shared base owns the policy — source → record, the reuse-or-upload
 * decision, generation and lifetime bookkeeping. This subclass owns the GL
 * calls, and nothing else. Mirrors the `Batcher` / `WebGLBatcher` /
 * `WebGPUBatcher` arrangement: one neutral base, one realization per backend.
 *
 * Two instances exist per renderer: the colour store, which every batcher
 * shares through `WebGLRenderer.textureStore`, and the lit batcher's
 * normal-map store — normal maps live outside the colour `TextureCache`, so
 * their handles are that batcher's to own, but the policy is identical.
 * @augments TextureStore
 * @ignore
 * @internal
 */
export class WebGLTextureStore extends TextureStore {
	/**
	 * @param {WebGL2RenderingContext} gl - the owning context
	 * @ignore
	 * @internal
	 */
	constructor(gl) {
		super();
		this.gl = gl;
	}

	/**
	 * @returns {WebGLTexture} a fresh texture object
	 * @ignore
	 * @internal
	 */
	onCreate() {
		return this.gl.createTexture();
	}

	/**
	 * Push the source's pixels.
	 *
	 * Delegated to a per-call closure rather than implemented here, because a
	 * GL upload needs the *batcher's* `createTexture2D`: it binds the target
	 * unit, tracks immutable-storage shape, and swaps the texture object when
	 * the shape changes. None of that is residency, and moving it into the
	 * store would drag the batcher's unit bookkeeping along with it.
	 * @param {WebGLTexture} handle - the existing texture object
	 * @param {object} source - the image/canvas being uploaded
	 * @param {object} record - the resident record
	 * @param {object} options - carries `upload(handle)`
	 * @returns {WebGLTexture} the handle actually used, which may be a
	 * replacement when immutable storage had to be respecified
	 * @ignore
	 * @internal
	 */
	onUpload(handle, source, record, options) {
		return options.upload(handle);
	}

	/**
	 * @param {WebGLTexture} handle - the texture object to release
	 * @ignore
	 * @internal
	 */
	onDestroy(handle) {
		this.gl.deleteTexture(handle);
	}
}
