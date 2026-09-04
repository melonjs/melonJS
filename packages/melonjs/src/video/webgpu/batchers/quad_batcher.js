import IndexBuffer from "../../buffer/index.js";
import { transformQuadCorners } from "../../gpu/quadcorners.ts";
import { TextureSlotTable } from "../../gpu/textureslots.js";
import { prepareEffectBinding } from "../effect_binding.js";
import { MAX_QUAD_TEXTURES } from "../pipeline/cache.js";
import WebGPUBatcher from "./webgpu_batcher.js";

/**
 * The WebGPU quad batcher — textured-quad accumulation with the same
 * frozen 28-byte vertex layout as the WebGL `QuadBatcher` and the same
 * static 6-indices-per-quad pattern.
 *
 * Texture batching is single-texture-per-draw-segment in this first
 * version: a texture (bind group) change flushes the pending quads — the
 * `aTextureId` attribute is written as 0 and kept in the layout so the
 * later multi-texture upgrade (`binding_array` / texture arrays) changes
 * only the group-1 layout and the fragment shader, never the vertex
 * stream. A WebGPU flush is one `writeBuffer` of the pending bytes plus
 * one `drawIndexed`, so the per-change cost is far below the GL
 * full-buffer re-upload this design avoids there.
 * @augments WebGPUBatcher
 * @category Rendering
 */
export default class WebGPUQuadBatcher extends WebGPUBatcher {
	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 * @override
	 */
	init(renderer, settings) {
		super.init(
			renderer,
			settings ?? {
				shaderKey: "quad",
				topology: "triangle-list",
				attributes: [
					{
						// vec3: (x, y, z). z carries `renderable.depth` for
						// perspective projection (Camera3d). Stride = 28 bytes.
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
				],
			},
		);

		// the material bind group the pending vertices were queued under —
		// FAST-PATH state only: effect pipelines bind a single-source
		// material, while the normal path batches across texture slots
		this.currentMaterial = null;

		// the ShaderEffect the pending vertices were queued under — the
		// single-effect fast path (renderer.customShader): the sprite's own
		// quad draws through the effect's pipeline, composited live against
		// the backdrop (no offscreen target)
		this.currentEffect = null;

		// multi-texture segment state: up to MAX_QUAD_TEXTURES distinct
		// (texture view, sampler) pairs share one draw segment, selected
		// per quad by aTextureId — a flush is forced only by the NINTH
		// distinct texture (or the usual capacity/effect boundaries)
		// slot assignment is the shared backend-neutral policy (#1585) — the
		// same table the WebGL texture cache allocates units from, so the two
		// backends cannot drift on when a texture set overflows
		this.slotTable = new TextureSlotTable({
			capacity: MAX_QUAD_TEXTURES,
			// draw the pending quads with THEIR slots before any reassignment
			onOverflow: () => {
				this.flush();
			},
			onEvict: (slot) => {
				this.segmentEntries[slot] = undefined;
				// a remembered slot may be the one just freed, and it would
				// hand out an index now owned by a different texture
				if (this._memoSlot === slot) {
					this._memoView = null;
				}
			},
		});
		/** @type {{view: GPUTextureView, sampler: GPUSampler}[]} indexed by slot */
		this.segmentEntries = [];
		/**
		 * last (view, filter, wrap) resolved to a segment slot
		 * @ignore
		 * @internal
		 */
		this._memoView = null;
		/**
		 * @ignore
		 * @internal
		 */
		this._memoFilter = null;
		/**
		 * @ignore
		 * @internal
		 */
		this._memoWrap = null;
		/**
		 * @ignore
		 * @internal
		 */
		this._memoSlot = 0;
		// the composed group-1 bind group for the pending segment (lazy)
		this.segmentGroup = null;
		// composed bind groups cached by their slot-resource identity —
		// steady-state segments re-use instead of re-creating (the
		// litMaterials precedent; cleared on reset and filter changes)
		/** @type {Map<string, GPUBindGroup>} */
		this.composedGroups = new Map();
		// monotonic ids for views/samplers, for composition cache keys
		this.resourceIds = new WeakMap();
		this.nextResourceId = 1;

		// static index buffer: 6 indices per 4 vertices, filled once by the
		// renderer-agnostic CPU pattern and uploaded at creation
		const maxQuads = this.vertexData.maxVertex / 4;
		const cpuIndices = new IndexBuffer(maxQuads * 6, true);
		cpuIndices.fillQuadPattern(maxQuads);
		this.indexBuffer?.destroy();
		this.indexBuffer = this.device.createBuffer({
			label: "melonJS quad indices",
			size: cpuIndices.data.byteLength,
			usage: GPUBufferUsage.INDEX,
			mappedAtCreation: true,
		});
		new Uint32Array(this.indexBuffer.getMappedRange()).set(cpuIndices.data);
		this.indexBuffer.unmap();
	}

	/**
	 * Add a textured quad. Same contract as the WebGL `QuadBatcher.addQuad`
	 * — the CPU corner transform (view matrix + per-renderable depth) is
	 * identical, only the texture-binding mechanism differs.
	 * @param {object} texture - the texture atlas to draw with
	 * @param {number} x - destination x
	 * @param {number} y - destination y
	 * @param {number} w - destination width
	 * @param {number} h - destination height
	 * @param {number} u0 - texture UV (u0)
	 * @param {number} v0 - texture UV (v0)
	 * @param {number} u1 - texture UV (u1)
	 * @param {number} v1 - texture UV (v1)
	 * @param {number} tint - tint color in UINT32 (argb) format
	 * @param {boolean} [reupload=false] - force the source pixels to re-upload (video frames)
	 */
	addQuad(texture, x, y, w, h, u0, v0, u1, v1, tint, reupload = false) {
		const vertexData = this.vertexData;
		const renderer = this.renderer;

		if (vertexData.isFull(4)) {
			this.flush();
		}

		// single-effect fast path: adopt the active customShader, draining
		// vertices queued under the previous state first (they must flush
		// under THEIR pipeline, not the incoming one)
		const effect = renderer.customShader ?? null;
		if (effect !== this.currentEffect) {
			this.flush();
			this.currentEffect = effect;
		}

		if (effect !== null) {
			// `screen_texture`: refresh the shared capture with everything
			// drawn so far BEFORE this sprite's own quad, so the effect
			// samples the scene behind it (a pass break + encoder copy)
			if (effect._screenTextureUniforms?.length > 0) {
				renderer.captureFrame();
			}

			// the fast path stays single-texture: effect pipelines bind a
			// single-source material at group 1, and each quad flushes on
			// its own anyway
			const bindGroup = renderer.textureStore.getBinding(texture, {
				force: reupload,
			});
			if (bindGroup !== this.currentMaterial) {
				this.flush();
				this.currentMaterial = bindGroup;
			}

			// feed the effect's `noise_uv` builtin with this quad's frame
			// rect — min() normalizes flipped (swapped) UVs
			const source = texture.getTexture();
			effect._setNoiseUVRect?.(
				source.width || source.videoWidth || 1,
				source.height || source.videoHeight || 1,
				w,
				h,
				Math.min(u0, u1),
				Math.min(v0, v1),
			);

			this.pushQuadVertices(x, y, w, h, u0, v0, u1, v1, tint, 0);

			// per-quad draw under the fast path: each sprite needs its own
			// capture state, noise rect and uniform snapshot (draw-time
			// setUniform mutation included)
			this.flush();
			return;
		}

		// multi-texture batching: resolve the quad's texture to a segment
		// slot, flushing only when an over-capacity NINTH texture appears
		this.pushQuadVertices(
			x,
			y,
			w,
			h,
			u0,
			v0,
			u1,
			v1,
			tint,
			this.segmentSlotFor(texture, reupload),
		);
	}

	/**
	 * Resolve a texture to its slot in the pending segment, claiming a new
	 * slot (and flushing a full segment) when this (view, sampler) pair is
	 * new. The upload rules — same-frame content changes, recycled units,
	 * forced video re-uploads — all live in the store's resident-record
	 * path, exactly as before.
	 * @param {object} texture - the texture atlas to resolve
	 * @param {boolean} reupload - force the source pixels to re-upload
	 * @returns {number} the slot index written to aTextureId
	 * @ignore
	 * @internal
	 */
	segmentSlotFor(texture, reupload) {
		const renderer = this.renderer;
		const store = renderer.textureStore;

		// The residency check stays on every quad: it revalidates the record
		// against `texture.getTexture()` and re-uploads when the source has
		// changed underneath (a video frame, an animated canvas, a swapped
		// atlas). Memoizing past it would serve stale pixels.
		const record = store.getResidentRecord(texture, { force: reupload });
		const wrap = texture.repeat ?? "no-repeat";
		const filter =
			typeof texture.filter === "string"
				? texture.filter
				: renderer.getDefaultTextureFilter();

		// What IS memoized is the key construction and the table lookup below.
		// Consecutive quads in a batch almost always share a texture — a
		// sprite sheet, a font atlas, an emitter's particle image — so the
		// slot is the same for long runs, while building a template-literal
		// key and hashing it into the table is not free: at 20k quads that was
		// 20k string allocations and 20k string-keyed lookups per frame, and
		// measured as the whole gap against WebGL's quad submission.
		//
		// Keyed on the resolved VIEW rather than the texture object, so a
		// re-upload that produces a new view misses, plus filter and wrap —
		// the same three components the string key is built from.
		if (
			record.view === this._memoView &&
			filter === this._memoFilter &&
			wrap === this._memoWrap
		) {
			return this._memoSlot;
		}

		const slotKey = `${this.resourceId(record.view)}|${filter}|${wrap}`;
		// a hit returns the live slot; a miss claims one, flushing the pending
		// segment first when the table is full (the `onOverflow` above)
		let resolved = this.slotTable.peek(slotKey);
		if (resolved === undefined) {
			resolved = this.slotTable.slotFor(slotKey);
			this.segmentEntries[resolved] = {
				view: record.view,
				sampler: store.getSampler(filter, wrap),
			};
			this.segmentGroup = null;
		}

		this._memoView = record.view;
		this._memoFilter = filter;
		this._memoWrap = wrap;
		this._memoSlot = resolved;
		return resolved;
	}

	/**
	 * a stable id for a GPU resource object (bind-group composition keys)
	 * @ignore
	 * @internal
	 */
	resourceId(resource) {
		let id = this.resourceIds.get(resource);
		if (typeof id === "undefined") {
			id = this.nextResourceId++;
			this.resourceIds.set(resource, id);
		}
		return id;
	}

	/**
	 * The composed group-1 bind group for the pending segment: the claimed
	 * slots, with empty slots padded by slot 0 (every declared binding
	 * needs a resource; the padding is never selected). Cached by the slot
	 * resources' identity, so steady-state segments re-use one group.
	 * @returns {GPUBindGroup} the segment's material bind group
	 * @ignore
	 * @internal
	 */
	composeSegmentGroup() {
		if (this.segmentGroup !== null) {
			return this.segmentGroup;
		}
		const entries = this.segmentEntries;
		const first = entries[0];
		const groupEntries = [];
		let key = "";
		for (let slot = 0; slot < MAX_QUAD_TEXTURES; slot++) {
			const entry = entries[slot] ?? first;
			key += `${this.resourceId(entry.view)}.${this.resourceId(entry.sampler)}|`;
			groupEntries.push({ binding: slot, resource: entry.view });
			groupEntries.push({
				binding: MAX_QUAD_TEXTURES + slot,
				resource: entry.sampler,
			});
		}
		let group = this.composedGroups.get(key);
		if (typeof group === "undefined") {
			group = this.device.createBindGroup({
				label: "melonJS quad materials",
				layout: this.renderer.pipelineCache.multiMaterialLayout,
				entries: groupEntries,
			});
			this.composedGroups.set(key, group);
		}
		this.segmentGroup = group;
		return group;
	}

	/**
	 * start the next segment fresh (the pending one was just recorded)
	 * @ignore
	 * @internal
	 */
	resetSegment() {
		// the table clears each live slot's entry through `onEvict`; truncating
		// afterwards drops any stale tail a shrunk capacity left behind
		this.slotTable.reset();
		this.segmentEntries.length = 0;
		this.segmentGroup = null;
		// the memo needs no explicit clearing here: `reset()` evicts every
		// live slot, and the eviction callback above drops it
	}

	/**
	 * Drop every composed segment bind group — each embeds samplers
	 * resolved from the default texture filter, so a filter change must
	 * rebuild them (the multi-texture counterpart of the texture store's
	 * invalidateBindGroups).
	 */
	clearMaterialCache() {
		this.composedGroups.clear();
		this.resetSegment();
	}

	/**
	 * Transform and queue the four corners of a quad — shared by the base
	 * and lit addQuad paths. Stamps per-sprite depth onto z BEFORE
	 * `m.apply` so Camera3d's view matrix (3D R⁻¹ ∘ T(-pos)) fully rotates
	 * the vertex; for 2D-only matrices the z column is identity, so the
	 * output (x, y) is bit-identical and z passes through. textureId is the
	 * quad's segment slot (constant across its four corners); the lit and
	 * fast paths pass 0 (single-texture bind groups).
	 * @ignore
	 * @internal
	 */
	pushQuadVertices(x, y, w, h, u0, v0, u1, v1, tint, textureId = 0) {
		const vertexData = this.vertexData;
		const [vec0, vec1, vec2, vec3] = transformQuadCorners(
			this.renderer.currentTransform,
			x,
			y,
			w,
			h,
			this.renderer.currentDepth,
		);

		// 4 vertices per quad; the index buffer provides the 6 indices
		vertexData.push(vec0.x, vec0.y, vec0.z, u0, v0, tint, textureId);
		vertexData.push(vec1.x, vec1.y, vec1.z, u1, v0, tint, textureId);
		vertexData.push(vec2.x, vec2.y, vec2.z, u0, v1, tint, textureId);
		vertexData.push(vec3.x, vec3.y, vec3.z, u1, v1, tint, textureId);
	}

	/**
	 * Composite a render target through an effect's pipeline as one
	 * screen-space quad — the WebGPU counterpart of the GL blitTexture.
	 * The caller ({@link WebGPURenderer#blitEffect}) has already set the
	 * screen-space projection; this records the draw with the effect's
	 * shader family and group-3 binding (uniforms snapshot-uploaded per
	 * bind). An effect without a WGSL realization composites as a plain
	 * un-effected blit, so the scene content is never lost.
	 * @param {import("../../rendertarget/webgpurendertarget.js").default} source - the render target to sample
	 * @param {number} x - destination x
	 * @param {number} y - destination y
	 * @param {number} w - destination width
	 * @param {number} h - destination height
	 * @param {ShaderEffect} [effect] - the effect to composite with
	 * @param {boolean} [keepBlend=false] - keep the current blend mode (else replace)
	 * @ignore
	 * @internal
	 */
	blitTexture(source, x, y, w, h, effect, keepBlend = false) {
		// drain pending quads under their own material first
		this.flush();
		const renderer = this.renderer;

		// identity noise_uv rect for the fullscreen quad (GL parity), BEFORE
		// the uniform snapshot below
		effect?._setNoiseUVRect?.(w, h, w, h, 0, 0);
		const binding = effect ? prepareEffectBinding(renderer, effect) : null;

		const pass = renderer.ensurePass();
		const pipeline = renderer.pipelineCache.get(
			// no effect → the single-texture blit family (the quad family's
			// group 1 is the eight-slot segment layout)
			binding?.key ?? "blit",
			"triangle-list",
			keepBlend ? renderer.currentBlendMode : "none",
			renderer.premultipliedAlpha,
			renderer.stencilMode,
		);
		if (pipeline !== renderer.currentPipeline) {
			pass.setPipeline(pipeline);
			renderer.currentPipeline = pipeline;
		}
		const frame = renderer.currentFrameBinding;
		pass.setBindGroup(0, frame.bindGroup, [frame.dynamicOffset]);
		pass.setBindGroup(1, source.getMaterialBindGroup());
		if (binding?.hasEffectGroup) {
			// positional through group 3 — the reserved lights slot gets the
			// shared empty group
			pass.setBindGroup(2, renderer.pipelineCache.emptyBindGroup);
			pass.setBindGroup(3, binding.bindGroup, binding.dynamicOffsets);
		}

		// one quad, UNFLIPPED UVs (WebGPU texture row 0 is the top — the GL
		// blit flips V because GL FBOs are bottom-up), white tint
		const vertexData = this.vertexData;
		vertexData.push(x, y, 0, 0, 0, 0xffffffff, 0);
		vertexData.push(x + w, y, 0, 1, 0, 0xffffffff, 0);
		vertexData.push(x, y + h, 0, 0, 1, 0xffffffff, 0);
		vertexData.push(x + w, y + h, 0, 1, 1, 0xffffffff, 0);
		const byteLength = 4 * this.stride;
		const region = renderer.vertexArena.alloc(byteLength);
		this.device.queue.writeBuffer(
			region.buffer,
			region.offset,
			vertexData.toUint8(),
			0,
			byteLength,
		);
		pass.setVertexBuffer(0, region.buffer, region.offset, byteLength);
		pass.setIndexBuffer(this.indexBuffer, "uint32");
		pass.drawIndexed(6);
		vertexData.clear();
	}

	/**
	 * indexed draw: 6 indices per 4 queued vertices, region-relative. The
	 * fast path binds its single-source material; the normal path binds
	 * the composed segment (up to eight textures).
	 * @param {GPURenderPassEncoder} pass - the open pass
	 * @param {number} vertexCount - pending vertex count
	 * @override
	 */
	recordDraw(pass, vertexCount) {
		pass.setBindGroup(
			1,
			this.currentEffect !== null
				? this.currentMaterial
				: this.composeSegmentGroup(),
		);
		pass.setIndexBuffer(this.indexBuffer, "uint32");
		pass.drawIndexed((vertexCount / 4) * 6);
	}

	/**
	 * @override
	 */
	flush(topology) {
		const effect = this.currentEffect;
		if (effect !== null && this.vertexData.vertexCount > 0) {
			if (this.currentMaterial === null) {
				// defensive: fast-path vertices with no adopted material
				this.vertexData.clear();
				return;
			}
			// fast-path draw: same recording as the base flush, through the
			// effect's pipeline family with its group-3 binding. An effect
			// without a WGSL realization draws plain (graceful, GL-parity
			// with a disabled effect).
			const binding = prepareEffectBinding(this.renderer, effect);
			if (binding !== null) {
				this.flushWithEffect(binding);
				return;
			}
		}
		if (
			this.vertexData.vertexCount > 0 &&
			this.hasPendingMaterial() === false
		) {
			// defensive: pending vertices but no material was ever claimed
			// (out-of-contract pushes) — recording would bind nothing valid
			this.vertexData.clear();
			return;
		}
		super.flush(topology);
		this.resetSegment();
	}

	/**
	 * whether the pending vertices have a material to draw with — the lit
	 * subclass overrides (its material model is the combined color+normal
	 * group, not the segment slots)
	 * @ignore
	 * @internal
	 */
	hasPendingMaterial() {
		return this.slotTable.size > 0;
	}

	/**
	 * record the pending vertices through an effect's pipeline — blending
	 * KEPT (the sprite composites live against the backdrop, the defining
	 * semantic of the fast path vs the pooled blit)
	 * @param {object} binding - the prepared effect binding
	 * @ignore
	 * @internal
	 */
	flushWithEffect(binding) {
		const renderer = this.renderer;
		const vertexData = this.vertexData;
		const vertexCount = vertexData.vertexCount;
		const pass = renderer.ensurePass();
		const byteLength = vertexCount * this.stride;

		const region = renderer.vertexArena.alloc(byteLength);
		this.device.queue.writeBuffer(
			region.buffer,
			region.offset,
			vertexData.toUint8(),
			0,
			byteLength,
		);

		const pipeline = renderer.pipelineCache.get(
			binding.key,
			"triangle-list",
			renderer.currentBlendMode,
			renderer.premultipliedAlpha,
			renderer.stencilMode,
		);
		if (pipeline !== renderer.currentPipeline) {
			pass.setPipeline(pipeline);
			renderer.currentPipeline = pipeline;
		}
		const frame = renderer.currentFrameBinding;
		pass.setBindGroup(0, frame.bindGroup, [frame.dynamicOffset]);
		if (binding.hasEffectGroup) {
			pass.setBindGroup(2, renderer.pipelineCache.emptyBindGroup);
			pass.setBindGroup(3, binding.bindGroup, binding.dynamicOffsets);
		}
		pass.setVertexBuffer(0, region.buffer, region.offset, byteLength);
		this.recordDraw(pass, vertexCount);
		vertexData.clear();
	}

	/**
	 * @override
	 */
	reset() {
		super.reset();
		this.currentEffect = null;
		this.currentMaterial = null;
		this.resetSegment();
		this.composedGroups.clear();
	}

	/**
	 * @override
	 */
	destroy() {
		this.indexBuffer?.destroy();
		this.indexBuffer = null;
		this.currentMaterial = null;
		this.resetSegment();
		this.composedGroups.clear();
		super.destroy();
	}
}
