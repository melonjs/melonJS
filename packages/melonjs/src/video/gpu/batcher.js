/**
 * additional import for TypeScript
 * @import Renderer from "../renderer.js";
 */

/**
 * Default maximum number of vertices per batch.
 * At 4096 vertices (1024 quads), the vertex buffer is ~80 KB (5 floats × 4 bytes × 4096),
 * which balances draw call reduction with safe buffer upload sizes on mobile tile-based GPUs.
 * Within the Uint16 index limit (65,535) — a deliberate capacity choice
 * (smaller index uploads), not an API constraint.
 * @ignore
 * @internal
 */
export const DEFAULT_MAX_VERTICES = 4096;

/**
 * Backend-neutral base class for renderer batchers.
 *
 * A batcher accumulates vertices into a CPU staging buffer and turns them
 * into GPU work in batches — one draw call for many shapes/sprites. This
 * class defines the lifecycle contract shared by every backend:
 *
 * - `init(renderer, settings)` — build (or rebuild after a context/device
 *   loss) the batcher's GPU-facing state; called by the constructor
 * - `bind()` / `unbind()` — the renderer switches the active batcher
 * - `flush()` — turn the pending vertices into GPU work
 * - `reset()` — drop transient state (game reset / context restore)
 * - `destroy()` — release every GPU resource the batcher owns
 *
 * Custom batchers extend the class matching the renderer they target —
 * {@link WebGLBatcher} for the WebGL renderer, `WebGPUBatcher` for the
 * WebGPU renderer — and are registered through `renderer.addBatcher()`,
 * which accepts any Batcher subclass.
 * @category Rendering
 */
export class Batcher {
	// no base constructor on purpose: the backend base classes call
	// `this.init(renderer, settings)` from their own constructor, AFTER
	// `super()` — a base-constructor call would run before the derived
	// class's private fields are installed and throw on first access

	/**
	 * Initialize (or re-initialize after a context/device loss) this batcher.
	 * Derived classes override this with their full `(renderer, settings)`
	 * signature and own the whole body; the base implementation only stores
	 * the renderer reference.
	 * @param {Renderer} renderer - the owning renderer
	 */
	init(renderer) {
		/**
		 * the renderer this batcher is bound to
		 * @type {Renderer}
		 */
		this.renderer = renderer;
	}

	/**
	 * called by the renderer when this batcher becomes the current one
	 */
	bind() {}

	/**
	 * called by the renderer when this batcher is being replaced by another
	 */
	unbind() {}

	/**
	 * turn the pending vertices into GPU work
	 */
	flush() {}

	/**
	 * reset the batcher's transient state (game reset / context restore)
	 */
	reset() {}

	/**
	 * release every GPU resource this batcher owns
	 */
	destroy() {}
}

export default Batcher;
