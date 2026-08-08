import Camera3d from "../camera/camera3d.ts";
import { Matrix3d } from "../math/matrix3d.ts";
import { AABB3d } from "../physics/broadphase/aabb3d.ts";
import {
	instanceRecordLayout,
	readInstanceTransform,
	writeIdentityTransform,
	writeInstanceTransform,
} from "../video/gpu/instancerecord.ts";
import { getInstancedShadowQuad } from "./groundshadow.js";
import Mesh from "./mesh.js";

// scratch reused by getBounds3d(); never handed out
const _instanceMatrix = new Matrix3d();

// scratch for the flattened group matrix a shadow pass draws with —
// synchronous, single-use per draw, never held
const _SHADOW_MATRIX = new Matrix3d();
const _instanceBounds = new AABB3d();
// scratch for dirtyRange() — read synchronously and never retained
const _dirtySpan = [0, 0];

/**
 * A {@link Mesh} drawn many times from one copy of its geometry.
 *
 * Ordinary meshes pay for every repeat: a forest of five thousand trees is
 * five thousand geometries on the GPU, each re-uploaded when it changes. An
 * `InstancedMesh` uploads the geometry **once** and stamps out copies from a
 * small per-instance record, so cost scales with the number of instances
 * rather than with `instances × vertices`, and the whole thing draws in a
 * single call.
 *
 * Every `Mesh` setting works unchanged — `model` + `material` from an OBJ,
 * raw `vertices`/`uvs`/`indices`, `lit`, `cullBackFaces`, `rightHanded`,
 * `tint`, `textureRepeat`, the lot. What an instanced mesh adds is the
 * instance buffer:
 *
 * - a **transform** per instance, always present;
 * - a **colour** per instance, when `instanceColors` is declared, multiplied
 *   into the mesh tint;
 * - an opaque **`vec4`** per instance, when `instanceData` is declared. The
 *   built-in lit shading reads its `rgb` as emissive; a custom
 *   {@link Mesh#shader} may read it as a wind phase, an atlas offset, a
 *   random seed — whatever the shader wants.
 *
 * The mesh's own position, rotation and scale keep their ordinary meaning and
 * act as the **group** transform: moving an `InstancedMesh` moves every
 * instance with one uniform write and re-uploads nothing.
 *
 * Requires a GPU backend (`renderer.supportsInstancing`). Under the Canvas
 * renderer the instances are drawn one at a time through the ordinary CPU
 * mesh path — correct, but without any of the benefit.
 * @augments Mesh
 * @category Rendering
 * @example
 * const forest = new me.InstancedMesh(0, 0, {
 *     model: "tree",
 *     material: "tree",
 *     width: 64,
 *     lit: true,
 *     instanceCount: 5000,     // pre-allocate
 *     instanceColors: true,
 *     instanceData: true,
 * });
 *
 * const placement = new me.Matrix3d();   // one scratch — zero allocation
 * for (let i = 0; i < forest.instanceCount; i++) {
 *     placement.identity().translate(x, y, z).scale(s);
 *     forest.setInstance(i, placement);
 *     forest.setInstanceColor(i, autumnTint);
 *     forest.setInstanceData(i, windPhase, seed, 0, 0);
 * }
 *
 * // draw only the nearest 1200 — no re-upload, just a smaller draw
 * forest.visibleInstanceCount = 1200;
 * app.world.addChild(forest, 10);
 */
export default class InstancedMesh extends Mesh {
	/**
	 * @param {number} x - the x coordinate of the group origin
	 * @param {number} y - the y coordinate of the group origin
	 * @param {object} settings - every {@link Mesh} setting, plus those below
	 * @param {number} [settings.instanceCount=0] - number of instances to pre-allocate. Instances start at the group origin (identity transform) until placed; `addInstance` grows past this.
	 * @param {boolean} [settings.instanceColors=false] - give each instance its own colour (16 bytes per instance), multiplied into the mesh tint
	 * @param {boolean} [settings.instanceData=false] - give each instance an opaque `vec4` (16 bytes per instance). Read as emissive by the built-in lit shading, or as anything at all by a custom mesh shader.
	 */
	constructor(x, y, settings) {
		super(x, y, settings);

		/**
		 * How this mesh's per-instance records are laid out — record width and
		 * the offset of each opt-in slot. Consumed by the batchers to describe
		 * the instance vertex buffer.
		 * @type {object}
		 * @ignore
		 */
		this.instanceLayout = instanceRecordLayout(
			settings.instanceColors === true,
			settings.instanceData === true,
		);

		/**
		 * The packed instance records, `instanceLayout.floats` per instance.
		 * Editable in place for bulk updates — announce those with
		 * {@link InstancedMesh#needsInstanceUpdate} or
		 * {@link InstancedMesh#markInstancesDirty}, since writing here bypasses
		 * the setters that track the dirty range.
		 * @type {Float32Array}
		 */
		this.instanceBuffer = new Float32Array(0);

		/**
		 * bumped whenever the buffer is reallocated, so a renderer holding a
		 * GPU copy knows its capacity assumption is stale
		 * @type {number}
		 * @ignore
		 */
		this._instanceVersion = 0;

		// dirty span in floats, as [first, lastExclusive); empty when first
		// exceeds last
		// Monotonic revision of the record CONTENTS. The dirty span alone is
		// not enough once more than one GPU buffer holds a copy (the unlit and
		// lit batchers keep separate ones, and `lit` is a public field): the
		// first consumer to drain the span would leave the second stuck on
		// stale records forever. Each buffer records the revision it reached,
		// so a consumer that missed an edit re-uploads in full.
		/** @ignore */
		this._instanceRevision = 0;
		// the revision the CURRENT span started from — a consumer at exactly
		// this revision can take the cheap partial upload
		/** @ignore */
		this._spanFromRevision = 0;

		/** @ignore */
		this._dirtyFirst = Infinity;
		/** @ignore */
		this._dirtyLast = 0;

		/** @ignore */
		this._instanceCount = 0;
		/** @ignore */
		this._visibleInstanceCount = -1;
		// revision the cull box was last sized for
		/** @ignore */
		this._cullRevision = -1;

		if (settings.instanceCount > 0) {
			this.instanceCount = settings.instanceCount;
		}
	}

	/**
	 * How many instances this mesh holds.
	 *
	 * Growing pre-allocates the new records as identity transforms (an
	 * unplaced instance sits at the group origin rather than collapsing onto
	 * a zero matrix); shrinking keeps the allocation, so a count that
	 * oscillates does not thrash it.
	 * @type {number}
	 */
	get instanceCount() {
		return this._instanceCount;
	}

	set instanceCount(count) {
		// `| 0` alone wraps anything past 2^31 to a negative and NaN to 0, so
		// an accidental `1e10` would silently empty the mesh rather than fail
		const wanted = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
		const floats = this.instanceLayout.floats;
		if (wanted * floats > this.instanceBuffer.length) {
			// grow geometrically so building a large set one addInstance at a
			// time stays linear overall rather than quadratic
			const capacity = Math.max(wanted, this._instanceCount * 2, 8);
			const grown = new Float32Array(capacity * floats);
			grown.set(this.instanceBuffer);
			this.instanceBuffer = grown;
			this._instanceVersion++;
		}
		// initialize whatever is newly in range
		for (let i = this._instanceCount; i < wanted; i++) {
			writeIdentityTransform(this.instanceBuffer, i * floats);
			if (this.instanceLayout.hasColor) {
				const at = i * floats + this.instanceLayout.colorOffset;
				this.instanceBuffer[at] = 1;
				this.instanceBuffer[at + 1] = 1;
				this.instanceBuffer[at + 2] = 1;
				this.instanceBuffer[at + 3] = 1;
			}
			if (this.instanceLayout.hasData) {
				// a recycled slot still holds the dead instance's vec4, and the
				// built-in shading reads its rgb as emissive — so a brand-new
				// instance would inherit the old one's glow
				const at = i * floats + this.instanceLayout.dataOffset;
				this.instanceBuffer[at] = 0;
				this.instanceBuffer[at + 1] = 0;
				this.instanceBuffer[at + 2] = 0;
				this.instanceBuffer[at + 3] = 0;
			}
		}
		if (wanted > this._instanceCount) {
			this.markInstancesDirty(
				this._instanceCount,
				wanted - this._instanceCount,
			);
		}
		this._instanceCount = wanted;
	}

	/**
	 * How many instances are actually drawn, counted from the first.
	 *
	 * The cheap culling and level-of-detail knob: sort the instances by
	 * distance once, then draw fewer of them by moving this single number —
	 * no re-upload, no rebuild. Defaults to every instance (`-1`).
	 * @type {number}
	 * @example
	 * forest.visibleInstanceCount = playerIsIndoors ? 0 : 1200;
	 */
	get visibleInstanceCount() {
		return this._visibleInstanceCount < 0
			? this._instanceCount
			: Math.min(this._visibleInstanceCount, this._instanceCount);
	}

	set visibleInstanceCount(count) {
		// NaN would read as 0 and silently stop the mesh drawing
		if (!Number.isFinite(count)) {
			this._visibleInstanceCount = -1;
			return;
		}
		this._visibleInstanceCount = count < 0 ? -1 : Math.trunc(count);
	}

	/**
	 * Append an instance, growing the buffer as needed.
	 * @param {Matrix3d} [transform] - where this instance sits, relative to the group. Defaults to the group origin.
	 * @param {object} [options] - optional per-instance slots
	 * @param {Color} [options.color] - instance colour (requires `instanceColors`)
	 * @param {number[]} [options.data] - four numbers for the custom slot (requires `instanceData`)
	 * @returns {number} the new instance's index
	 */
	addInstance(transform, options) {
		const index = this._instanceCount;
		this.instanceCount = index + 1;
		if (transform !== undefined) {
			this.setInstance(index, transform);
		}
		if (options !== undefined) {
			if (options.color !== undefined) {
				this.setInstanceColor(index, options.color);
			}
			if (options.data !== undefined) {
				// a short array would leave components undefined, and
				// `Float32Array[i] = undefined` is NaN — which propagates
				// through the shader as black or discarded fragments
				const [x = 0, y = 0, z = 0, w = 0] = options.data;
				this.setInstanceData(index, x, y, z, w);
			}
		}
		return index;
	}

	/**
	 * Remove an instance by moving the last one into its place.
	 *
	 * Swapping is what keeps this O(1) instead of shifting every record after
	 * the hole — but it means **indices are not stable across a removal**: the
	 * instance that was last now answers to `index`. Callers holding indices
	 * must re-read them, or avoid removal in favour of
	 * {@link InstancedMesh#visibleInstanceCount}.
	 * @param {number} index - the instance to remove
	 */
	removeInstance(index) {
		const last = this._instanceCount - 1;
		if (index < 0 || index > last) {
			return;
		}
		const floats = this.instanceLayout.floats;
		if (index !== last) {
			this.instanceBuffer.copyWithin(
				index * floats,
				last * floats,
				(last + 1) * floats,
			);
			this.markInstancesDirty(index, 1);
		}
		this._instanceCount = last;
	}

	/**
	 * Place one instance.
	 * @param {number} index - the instance to place
	 * @param {Matrix3d} transform - where it sits, relative to the group
	 */
	setInstance(index, transform) {
		if (index < 0 || index >= this._instanceCount) {
			return;
		}
		writeInstanceTransform(
			this.instanceBuffer,
			index * this.instanceLayout.floats,
			transform,
		);
		this.markInstancesDirty(index, 1);
	}

	/**
	 * Read one instance's transform back.
	 * @param {number} index - the instance to read
	 * @param {Matrix3d} [out] - matrix to write into; a new one is allocated when omitted
	 * @returns {Matrix3d|undefined} the transform, or `undefined` for an out-of-range index
	 */
	getInstance(index, out = new Matrix3d()) {
		if (index < 0 || index >= this._instanceCount) {
			return undefined;
		}
		return readInstanceTransform(
			this.instanceBuffer,
			index * this.instanceLayout.floats,
			out,
		);
	}

	/**
	 * Set one instance's colour, multiplied into the mesh tint.
	 * @param {number} index - the instance to colour
	 * @param {Color} color - the instance colour
	 */
	setInstanceColor(index, color) {
		const layout = this.instanceLayout;
		if (!layout.hasColor || index < 0 || index >= this._instanceCount) {
			return;
		}
		const at = index * layout.floats + layout.colorOffset;
		this.instanceBuffer[at] = color.r / 255;
		this.instanceBuffer[at + 1] = color.g / 255;
		this.instanceBuffer[at + 2] = color.b / 255;
		this.instanceBuffer[at + 3] = color.alpha;
		this.markInstancesDirty(index, 1);
	}

	/**
	 * Set one instance's custom `vec4`.
	 * @param {number} index - the instance to write
	 * @param {number} x - first component (emissive red, under the built-in lit shading)
	 * @param {number} y - second component
	 * @param {number} z - third component
	 * @param {number} [w=0] - fourth component
	 */
	setInstanceData(index, x, y, z, w = 0) {
		const layout = this.instanceLayout;
		if (!layout.hasData || index < 0 || index >= this._instanceCount) {
			return;
		}
		const at = index * layout.floats + layout.dataOffset;
		this.instanceBuffer[at] = x;
		this.instanceBuffer[at + 1] = y;
		this.instanceBuffer[at + 2] = z;
		this.instanceBuffer[at + 3] = w;
		this.markInstancesDirty(index, 1);
	}

	/**
	 * Announce that a span of instances was edited directly through
	 * {@link InstancedMesh#instanceBuffer}, so the next draw re-uploads it.
	 * The per-instance setters do this themselves.
	 * @param {number} first - first instance changed
	 * @param {number} count - how many
	 */
	markInstancesDirty(first, count) {
		const floats = this.instanceLayout.floats;
		// clamp to what is actually allocated: an out-of-range span reaches
		// the upload as an out-of-bounds typed-array view and throws from
		// inside the draw loop
		const limit = this.instanceBuffer.length;
		const from = Math.min(Math.max(0, first | 0) * floats, limit);
		const to = Math.min(Math.max(0, (first | 0) + (count | 0)) * floats, limit);
		if (to <= from) {
			return;
		}
		if (this._dirtyLast <= this._dirtyFirst) {
			// the span was empty: remember what revision consumers must be at
			// to take the cheap partial path
			this._spanFromRevision = this._instanceRevision;
		}
		if (from < this._dirtyFirst) {
			this._dirtyFirst = from;
		}
		if (to > this._dirtyLast) {
			this._dirtyLast = to;
		}
		this._instanceRevision++;
	}

	/**
	 * Announce that the whole instance buffer was edited in place. The
	 * instancing counterpart of {@link Mesh#needsUpdate} — and, like it, a
	 * signal rather than a state, so it is write-only.
	 * @type {boolean}
	 * @example
	 * forest.instanceBuffer.set(myRecords);
	 * forest.needsInstanceUpdate = true;
	 */
	// eslint-disable-next-line accessor-pairs
	set needsInstanceUpdate(value) {
		if (value !== false) {
			this.markInstancesDirty(0, this._instanceCount);
		}
	}

	/**
	 * The dirty span, in floats, as `[first, lastExclusive)`. Empty when
	 * nothing changed since the last upload.
	 * @returns {number[]} the span
	 * @ignore
	 */
	dirtyRange() {
		// reuses one array: this is read once per instanced mesh per frame,
		// and the class is sold on allocating nothing in the steady state
		_dirtySpan[0] = this._dirtyLast > this._dirtyFirst ? this._dirtyFirst : 0;
		_dirtySpan[1] =
			this._dirtyLast > this._dirtyFirst
				? this._dirtyLast - this._dirtyFirst
				: 0;
		return _dirtySpan;
	}

	/**
	 * What one GPU buffer must upload to catch up, given the revision it last
	 * reached. Replaces a shared "clear the dirty flag" step, which the first
	 * consumer would drain out from under the second.
	 * @param {number} uploadedRevision - the revision that buffer holds
	 * @returns {object} `{first, count, full, revision}` — float span, or `full`
	 * @ignore
	 */
	instanceUpload(uploadedRevision) {
		const revision = this._instanceRevision;
		if (uploadedRevision === revision) {
			return { first: 0, count: 0, full: false, revision };
		}
		if (uploadedRevision === this._spanFromRevision) {
			const [first, count] = this.dirtyRange();
			return { first, count, full: false, revision };
		}
		// this buffer missed edits the span no longer describes
		return { first: 0, count: 0, full: true, revision };
	}

	/**
	 * Called by the batcher once the dirty span has been uploaded.
	 * @ignore
	 */
	clearInstanceDirty() {
		this._dirtyFirst = Infinity;
		this._dirtyLast = 0;
		this._spanFromRevision = this._instanceRevision;
	}

	/**
	 * The world-space bounding box of every instance, so the whole group
	 * frustum-culls as one object.
	 *
	 * Bounds the prototype geometry through each instance transform and then
	 * through the group placement — correct before the first draw, like the
	 * base implementation, and independent of what any draw left behind.
	 * @returns {AABB3d} the union of all instance bounds (reused instance)
	 */
	/**
	 * Resize the renderable's own 2D bounds box so it encloses every
	 * instance.
	 *
	 * This is what makes the group frustum-cull correctly. `Camera3d.isVisible`
	 * tests a sphere derived from `getBounds()` — the flat width/height box —
	 * **not** {@link InstancedMesh#getBounds3d}. Left at the prototype's size,
	 * a forest scattered over thousands of units presents a box a few tens of
	 * pixels across at the group origin: pan the camera just past that origin
	 * and every instance disappears at once, while still on screen.
	 * @ignore
	 */
	_refreshCullVolume() {
		if (this._instanceCount === 0) {
			return;
		}
		const bounds = super.getBounds();
		if (this._cullRevision !== this._instanceRevision) {
			this._cullRevision = this._instanceRevision;
			const box = this.getBounds3d();
			const origin = this._composeModelMatrix().val;
			let radius = 0;
			for (const x of [box.min.x, box.max.x]) {
				for (const y of [box.min.y, box.max.y]) {
					for (const z of [box.min.z, box.max.z]) {
						radius = Math.max(
							radius,
							Math.hypot(x - origin[12], y - origin[13], z - origin[14]),
						);
					}
				}
			}
			this._cullRadius = Math.max(radius, 1);
		}
		// Widen the box rather than resizing the renderable: `width`/`height`
		// are the mesh's own geometry scale and feed the model matrix, so
		// growing them would grow the mesh. Camera3d only reads the box's
		// width/height (its centre comes from getAbsolutePosition), so a
		// symmetric box of the right size is all that is needed.
		const r = this._cullRadius;
		bounds.setMinMax(-r, -r, r, r);
		return bounds;
	}

	/**
	 * The 2D bounds box, widened to enclose every instance.
	 *
	 * This is the box `Camera3d.isVisible` actually culls against — left at
	 * the prototype's size, a scatter spanning thousands of units would
	 * vanish wholesale the moment the group origin left the frustum.
	 * @returns {Bounds} the bounds
	 */
	getBounds() {
		return this._refreshCullVolume() ?? super.getBounds();
	}

	getBounds3d() {
		if (this._bounds3d === undefined) {
			/** @ignore */
			this._bounds3d = new AABB3d();
		}
		const count = this._instanceCount;
		if (count === 0) {
			return super.getBounds3d();
		}
		const group = this._composeModelMatrix();
		const floats = this.instanceLayout.floats;
		for (let i = 0; i < count; i++) {
			readInstanceTransform(this.instanceBuffer, i * floats, _instanceMatrix);
			// group × instance — the order the shader applies them in
			const placed = _instanceBounds.fromVertices(
				this.originalVertices,
				this.vertexCount,
				multiplyInto(group, _instanceMatrix).val,
			);
			// the first fold clears, so the union starts from this instance
			// rather than from whatever the previous frame left behind
			this._bounds3d.addAABB(placed, i === 0);
		}
		return this._bounds3d;
	}

	/**
	 * Draw the instanced mesh. Under a GPU backend this is one instanced
	 * draw call; the Canvas renderer has no instancing, so each instance is
	 * drawn through the ordinary mesh path instead.
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the camera rendering this frame
	 */
	draw(renderer, viewport) {
		if (this._instanceCount === 0 || this.visibleInstanceCount === 0) {
			return;
		}
		this._refreshCullVolume();
		// The instanced GPU path is a world-space (Camera3d) path, exactly as
		// the retained mesh path is: it hands the renderer a model matrix and
		// lets the shader place the geometry. Under a 2D camera the base class
		// pre-projects vertices on the CPU instead, so taking the instanced
		// path there would apply a different projection AND leak the anchor
		// transform into the shared view matrix. Fall back per instance.
		const useWorldSpace =
			viewport !== undefined
				? viewport instanceof Camera3d
				: this._useWorldSpace === true;
		if (renderer.supportsInstancing !== true || !useWorldSpace) {
			this._drawInstancesIndividually(renderer, viewport);
			return;
		}
		if (this._worldSpace !== true) {
			this._setupWorldSpace(false);
		}
		this.indices = this._indicesOriginal;
		renderer.drawMesh(this, this._composeModelMatrix());
		if (this._castsGroundShadow(renderer) === true) {
			this._drawInstancedGroundShadow(renderer);
		}
	}

	/**
	 * Fallback for renderers without instancing (Canvas): walk the instances
	 * and draw the prototype once per instance, composing the group and
	 * instance transforms by hand. Correct, and as slow as the uninstanced
	 * scene it replaces — the point is that a scene authored for instancing
	 * still renders everywhere.
	 * @param {CanvasRenderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the camera rendering this frame
	 * @ignore
	 */
	_drawInstancesIndividually(renderer, viewport) {
		const count = this.visibleInstanceCount;
		const floats = this.instanceLayout.floats;
		const savedX = this.pos.x;
		const savedY = this.pos.y;
		const savedZ = this.pos.z;
		try {
			for (let i = 0; i < count; i++) {
				readInstanceTransform(this.instanceBuffer, i * floats, _instanceMatrix);
				// Where the instance lands is the TRANSLATION OF `group ×
				// instance`, not the raw record: the record is in model space,
				// and the group matrix carries the mesh scale and the Y/Z axis
				// bridge. Adding the raw value collapses the scatter toward the
				// origin and mirrors it in Y.
				const placed = multiplyInto(
					this._composeModelMatrix(),
					_instanceMatrix,
				).val;
				this.pos.set(placed[12], placed[13], placed[14]);
				super.draw(renderer, viewport);
			}
		} finally {
			// a throw mid-loop would otherwise strand the renderable at
			// whichever instance was being drawn
			this.pos.set(savedX, savedY, savedZ);
		}
	}

	/**
	 * Release the instance records along with the mesh.
	 * @ignore
	 */
	/**
	 * Draw a ground shadow for every visible instance — one call for the whole
	 * set, over the instance buffer the mesh itself just drew from (#1515).
	 *
	 * The group matrix is passed with its Y basis column zeroed and its
	 * translation Y set to the ground, so whatever Y the shadow vertex stage
	 * produces is flattened onto the floor. That is what lets the ground
	 * height reach the shader without a new uniform.
	 *
	 * One ground height serves the whole set — flat terrain. Per-instance
	 * ground height would have to ride the `instanceData` slot, which the
	 * built-in shading already reads as emissive.
	 * @param {WebGLRenderer} renderer - the active renderer
	 * @ignore
	 */
	_drawInstancedGroundShadow(renderer) {
		if (typeof renderer.drawInstancedShadow !== "function") {
			return;
		}
		// Sized from the PROTOTYPE's own footprint, with the same contact
		// spread and minor-axis floor the per-object tier applies — otherwise
		// the identical asset draws a different shadow instanced than it does
		// standalone. The instanced vertex stage multiplies these by each
		// record's horizontal scale.
		this._measureShadowFootprint();
		const spread = 1.2;
		let hx = this._shadowHalfX * spread;
		let hz = this._shadowHalfZ * spread;
		const major = hx > hz ? hx : hz;
		const least = major * 0.5;
		if (major > 1e-6) {
			hx = hx < least ? least : hx;
			hz = hz < least ? least : hz;
		}
		const quad = getInstancedShadowQuad(
			this,
			Mesh,
			hx,
			hz,
			this._geometryVersion ?? 0,
		);
		const group = this._modelMatrix.val;
		const out = _SHADOW_MATRIX.val;
		for (let i = 0; i < 16; i++) {
			out[i] = group[i];
		}
		// Zero the Y ROW — `out[1]`, `out[5]`, `out[9]`, the Y components of all
		// three basis columns — not the Y column. Clearing the column alone
		// kills only the instance's own height; the X and Z columns keep their
		// Y components, so a group rotated about X or Z would tilt the blobs
		// onto a slanted plane and sink half of them below the floor. Zeroing
		// the row makes every output Y the translation, whatever the rotation.
		out[1] = 0;
		out[5] = 0;
		out[9] = 0;
		// ...and put that plane at the ground. Render space is Y-DOWN, so the
		// floor is a GREATER Y than the objects standing on it.
		// lifted a hair off the floor, for the reason spelled out at
		// `SHADOW_LIFT` in mesh.js: a coplanar blob is order-dependent. Y is
		// DOWN, so off the floor is a smaller y.
		const ground =
			this.shadowGroundY !== undefined
				? this.shadowGroundY
				: this.getBounds3d().bottom;
		out[13] = ground - this.meshScale * 0.01;

		const tint = renderer.currentTint;
		const savedR = tint.r;
		const savedG = tint.g;
		const savedB = tint.b;
		// the colour's OWN alpha, which `setColor(r, g, b)` resets to 1
		const savedTintAlpha = tint.alpha;
		const savedAlpha = renderer.getGlobalAlpha();
		tint.setColor(0, 0, 0);
		renderer.setGlobalAlpha(this.shadowOpacity * savedAlpha);
		try {
			renderer.drawInstancedShadow(this, _SHADOW_MATRIX, quad);
		} finally {
			tint.setColor(savedR, savedG, savedB, savedTintAlpha);
			renderer.setGlobalAlpha(savedAlpha);
		}
	}

	destroy() {
		this.instanceBuffer = new Float32Array(0);
		this._instanceCount = 0;
		super.destroy();
	}
}

const _composed = new Matrix3d();

/**
 * `group × instance` into a scratch matrix, without disturbing either.
 * @param {Matrix3d} group - the group transform
 * @param {Matrix3d} instance - the instance transform (written into)
 * @returns {Matrix3d} `instance`, now holding the product
 * @ignore
 */
function multiplyInto(group, instance) {
	_composed.copy(group);
	_composed.multiply(instance);
	instance.copy(_composed);
	return instance;
}
