/**
 * Backend-neutral texture residency.
 *
 * There are two separate questions about a texture, and conflating them is
 * what makes a GPU renderer re-upload work it already has:
 *
 * - **which slot is it in, for this draw?** — transient, per-batch, bounded by
 *   the shader's sampler count. That is {@link TextureSlotTable}.
 * - **does it exist on the GPU, and is its content current?** — persistent,
 *   per-source, bounded by disposal. That is this class.
 *
 * The WebGL backend used to answer both with one field (`boundTextures[unit]`),
 * so dropping a slot assignment destroyed the texture handle and the next draw
 * rebuilt it from scratch — a full re-upload and mip regeneration per quad,
 * once past the batching limit.
 *
 * This class owns the source → record index, the reuse-or-upload decision, and
 * the lifetime bookkeeping. It touches no GL or WebGPU API: each backend
 * supplies `onCreate` / `onUpload` / `onDestroy`, exactly as the slot table
 * takes its binding through callbacks. That keeps the decision logic identical
 * on both backends and testable without a device.
 * @ignore
 */
export class TextureStore {
	/**
	 * @param {object} [options] - store configuration
	 * @param {Function} [options.onCreate] - `(source, options) => handle`, allocate
	 * the backing GPU texture for a source seen for the first time
	 * @param {Function} [options.onUpload] - `(handle, source, record, options) => handle`,
	 * push the source's current content. May return a *replacement* handle when
	 * the shape changed and the old one cannot be respecified (immutable
	 * storage); returning nothing keeps the existing handle.
	 * @param {Function} [options.onDestroy] - `(handle, source)`, release the
	 * GPU texture. Called exactly once per handle.
	 * @ignore
	 */
	constructor({ onCreate, onUpload, onDestroy } = {}) {
		/** @type {Map<object, {handle: *, version: number, generation: number}>} */
		this.records = new Map();
		this.onCreate = onCreate;
		this.onUpload = onUpload;
		this.onDestroy = onDestroy;
		// Bumped whenever the underlying context or device dies. A record from
		// an older generation is never handed back: a handle minted under a
		// dead context is not merely stale, binding it is undefined behaviour,
		// and the failure is silent. Comparing generations turns that into an
		// ordinary miss followed by a re-upload.
		this.generation = 0;
	}

	/**
	 * how many sources are currently resident
	 * @returns {number} the record count
	 * @ignore
	 */
	get size() {
		return this.records.size;
	}

	/**
	 * The live record for a source, uploading only when it is genuinely needed:
	 * the source has never been seen, its content changed, its handle predates
	 * the current context, or the caller forced it.
	 *
	 * A texture that merely moved to a different slot is NOT a reason to upload
	 * — that is the whole point of separating residency from slot assignment.
	 * @param {object} source - the image/canvas/resource backing the texture
	 * @param {object} [options] - resolution options
	 * @param {number} [options.version=0] - the source's content revision; a
	 * change from the recorded value forces a re-upload
	 * @param {boolean} [options.force=false] - re-upload regardless
	 * @returns {{handle: *, version: number, generation: number, uploaded: boolean}}
	 * the record, with `uploaded` reporting whether this call did GPU work
	 * @ignore
	 */
	getResidentRecord(source, options = {}) {
		const { version = 0, force = false } = options;
		let record = this.records.get(source);

		if (record === undefined) {
			record = {
				handle: this.onCreate?.(source, options),
				// deliberately unmatchable, so a freshly created record always
				// takes the upload path once — a record that exists but was
				// never filled is the failure this rules out
				version: -1,
				generation: this.generation,
			};
			this.records.set(source, record);
		}

		if (force || record.version !== version) {
			const replacement = this.onUpload?.(
				record.handle,
				source,
				record,
				options,
			);
			if (replacement !== undefined && replacement !== null) {
				// the backend could not respecify in place and swapped handles
				record.handle = replacement;
			}
			record.version = version;
			record.uploaded = true;
		} else {
			record.uploaded = false;
		}
		return record;
	}

	/**
	 * The record for a source without resolving one, for callers that must not
	 * trigger GPU work (bookkeeping, debug, invalidation checks).
	 * @param {object} source - the source to look up
	 * @returns {object|undefined} the record, or `undefined`
	 * @ignore
	 */
	peek(source) {
		return this.records.get(source);
	}

	/**
	 * Whether a record is still valid for the live context.
	 *
	 * `releaseAll` drops every record, so the store itself can never hand back
	 * a stale one — but a CALLER that cached a handle of its own (a batcher's
	 * per-unit array, say) has no such protection, and binding a handle minted
	 * under a dead context is undefined behaviour that fails silently. This is
	 * how such a caller checks, rather than assuming its own invalidation ran.
	 * @param {object} [record] - a record obtained earlier
	 * @returns {boolean} whether it belongs to the current context
	 * @ignore
	 */
	isCurrent(record) {
		return record !== undefined && record.generation === this.generation;
	}

	/**
	 * Mark a source's content stale, so the next resolve re-uploads it. Cheaper
	 * and safer than destroying it: the handle and its storage survive, only the
	 * contents are re-pushed.
	 * @param {object} source - the source whose content changed
	 * @ignore
	 */
	invalidate(source) {
		const record = this.records.get(source);
		if (record !== undefined) {
			record.version = -1;
		}
	}

	/**
	 * Release the GPU texture for one source. Driven by the source going away
	 * — never by a slot being reassigned, which is exactly the coupling this
	 * class exists to break.
	 * @param {object} source - the disposed source
	 * @returns {boolean} whether a record was held
	 * @ignore
	 */
	destroyTexture(source) {
		const record = this.records.get(source);
		if (record === undefined) {
			return false;
		}
		this.records.delete(source);
		if (record.generation === this.generation) {
			this.onDestroy?.(record.handle, source);
		}
		return true;
	}

	/**
	 * Drop every record and bump the generation. Called on context or device
	 * loss.
	 *
	 * This CLEARS the store in place — callers must never respond to a restore
	 * by constructing a replacement store. Doing so orphans every handle the
	 * old one was tracking, so the *second* loss leaks everything it had
	 * accumulated since the first. Both WebGL batchers re-run `init()` on
	 * restore, which is precisely how that mistake gets made here.
	 * @param {boolean} [destroy=false] - whether to release the handles first.
	 * Leave `false` for a lost context (the GPU objects are already gone);
	 * pass `true` for an orderly teardown.
	 * @ignore
	 */
	releaseAll(destroy = false) {
		if (destroy === true && this.onDestroy !== undefined) {
			for (const [source, record] of this.records) {
				if (record.generation === this.generation) {
					this.onDestroy(record.handle, source);
				}
			}
		}
		this.records.clear();
		this.generation++;
	}
}
