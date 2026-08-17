/**
 * WebGL 2 sampler objects, deduplicated by their state.
 *
 * GL bakes wrap and filter into the texture *object*, which is why the same
 * image drawn at two repeat modes historically needed two texture units AND
 * two uploads (#1448). Sampler objects — core in GLES 3.0, and unconditionally
 * available since 20.0 dropped WebGL 1 — move that state out of the texture and
 * onto the unit, exactly as the WebGPU backend already separates `GPUTexture`
 * from `GPUSampler`.
 *
 * That separation is what lets texture residency be keyed by **source alone**:
 * one upload serves every variant, and the variant rides the sampler. Slot
 * assignment stays per `(source, variant)`, because a bound sampler applies to
 * a unit and a unit carries one at a time.
 *
 * Deliberately mirrors `WebGPUTextureStore.getSampler(filter, repeat, mipmaps)`
 * — same key, same dedup, so the two backends stay legible side by side.
 * @ignore
 */
export class GLSamplerCache {
	/**
	 * @param {WebGL2RenderingContext} gl - the owning context
	 * @ignore
	 */
	constructor(gl) {
		this.gl = gl;
		/** @type {Map<string, WebGLSampler>} */
		this.samplers = new Map();
		// `get` runs once per QUAD — hundreds of times a frame, almost always
		// with the arguments it was just called with. Building a string key and
		// running two regexes each time is pure waste in the hottest path, so
		// the last answer is memoized behind a three-value guard.
		this.lastFilter = -1;
		this.lastRepeat = null;
		this.lastMipmap = null;
		this.lastSampler = null;
		// which sampler each unit currently holds, so a redundant bind is
		// skipped rather than issued
		/** @type {Array<WebGLSampler|null>} */
		this.bound = [];
	}

	/**
	 * The sampler for a filter/wrap/mip combination, created once and reused.
	 *
	 * There are only a handful of live combinations in any scene — two filters
	 * times four repeat modes — so this Map stays tiny however many textures a
	 * game loads.
	 * @param {number} filter - `gl.NEAREST` or `gl.LINEAR`
	 * @param {string} [repeat="no-repeat"] - canvas-style repeat mode
	 * @param {boolean} [mipmap=false] - sample the mip chain (trilinear)
	 * @returns {WebGLSampler} the shared sampler
	 * @ignore
	 */
	get(filter, repeat = "no-repeat", mipmap = false) {
		if (
			filter === this.lastFilter &&
			repeat === this.lastRepeat &&
			mipmap === this.lastMipmap
		) {
			return this.lastSampler;
		}
		const gl = this.gl;
		// same per-axis mapping as `createTexture2D`
		const wrapS = /^repeat(-x)?$/.test(repeat) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
		const wrapT = /^repeat(-y)?$/.test(repeat) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
		// trilinear only over a linear-filtered chain — "nearest" opts out so
		// crisp pixel-art keeps hard minification, matching the mesh path's rule
		const mip = mipmap === true && filter === gl.LINEAR;
		const key = `${filter}|${wrapS}|${wrapT}|${mip ? "mip" : "flat"}`;

		let sampler = this.samplers.get(key);
		if (sampler === undefined) {
			sampler = gl.createSampler();
			gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, wrapS);
			gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, wrapT);
			gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, filter);
			gl.samplerParameteri(
				sampler,
				gl.TEXTURE_MIN_FILTER,
				mip ? gl.LINEAR_MIPMAP_LINEAR : filter,
			);
			this.samplers.set(key, sampler);
		}
		this.lastFilter = filter;
		this.lastRepeat = repeat;
		this.lastMipmap = mipmap;
		this.lastSampler = sampler;
		return sampler;
	}

	/**
	 * Bind a sampler to a texture unit, or unbind with `null`.
	 *
	 * A bound sampler overrides the texture object's own parameters entirely,
	 * which is what makes one texture usable at several variants at once.
	 * @param {number} unit - the texture unit
	 * @param {WebGLSampler|null} sampler - the sampler, or `null` to fall back
	 * to the texture's own state
	 * @ignore
	 */
	bind(unit, sampler) {
		if (this.bound[unit] === sampler) {
			return;
		}
		this.bound[unit] = sampler;
		this.gl.bindSampler(unit, sampler);
	}

	/**
	 * Delete every sampler. Called on context loss — the GL objects died with
	 * the context, so this only drops our side of the bookkeeping and lets the
	 * next `get` mint fresh ones.
	 * @param {boolean} [destroy=false] - whether to `deleteSampler` first
	 * (orderly teardown; skip it for a lost context)
	 * @ignore
	 */
	releaseAll(destroy = false) {
		if (destroy === true) {
			for (const sampler of this.samplers.values()) {
				this.gl.deleteSampler(sampler);
			}
		}
		this.samplers.clear();
		// every memo now points at a deleted or dead-context object
		this.lastFilter = -1;
		this.lastRepeat = null;
		this.lastMipmap = null;
		this.lastSampler = null;
		this.bound.length = 0;
	}
}
