/**
 * Whether a GL object handle is safe to delete.
 *
 * Deleting counts as *using* an object, so deleting one whose context has
 * gone raises `INVALID_OPERATION`. The `is*` queries answer that exactly —
 * they report false for a handle that died with a previous context, and
 * asking is itself error-free — which is why teardown used to probe with
 * one.
 *
 * They are also SYNCHRONOUS: each blocks until the driver answers. Teardown
 * runs per object, so a scene dropping a batch of retained meshes pays a
 * round trip for every buffer and vertex array in it. Measured on a 3D
 * example, those probes were the single largest cost in the frames that
 * stuttered, ahead of shader compilation.
 *
 * The probe only ever has something to say about a context that has been
 * lost at least once: any other context still owns every handle made against
 * it. So it is skipped until that happens, and {@link markContextLost} is
 * what turns it back on. A game that never loses its context never pays for
 * the question.
 */

/** contexts that have been lost at least once, so a handle may be dead */
const lostOnce = new WeakSet();

/**
 * Record that a context has been lost, so handles made before it are probed
 * before deletion from here on.
 * @param {WebGL2RenderingContext} gl - the context that was lost
 */
export function markContextLost(gl) {
	if (gl) {
		lostOnce.add(gl);
	}
}

/**
 * Whether `handle` can be deleted without raising `INVALID_OPERATION`.
 * @param {WebGL2RenderingContext} gl - the owning context
 * @param {Function} probe - the matching `is*` query, e.g. `gl.isBuffer`
 * @param {object} handle - the GL object
 * @returns {boolean} true when deletion is safe
 */
export function deletable(gl, probe, handle) {
	if (gl.isContextLost() === true) {
		// nothing survived, and deleting now would raise
		return false;
	}
	if (lostOnce.has(gl) === false) {
		// this context has never dropped anything, so the handle is live
		return true;
	}
	return probe.call(gl, handle) === true;
}
