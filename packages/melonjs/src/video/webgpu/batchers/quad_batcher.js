import { Vector3d } from "../../../math/vector3d.ts";
import IndexBuffer from "../../buffer/index.js";
import { prepareEffectBinding } from "../effect_binding.js";
import WebGPUBatcher from "./webgpu_batcher.js";

// a pool of reusable vectors used by `addQuad` to transform the four quad
// corners — Vector3d so the per-sprite depth on `z` flows through
// `Matrix3d.apply` (same rationale as the WebGL QuadBatcher's pool;
// duplicated rather than imported so the WebGPU tier never pulls the
// GL batcher chain into its module graph)
const V_ARRAY = [
	new Vector3d(),
	new Vector3d(),
	new Vector3d(),
	new Vector3d(),
];

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

		// the material bind group the pending vertices were queued under
		this.currentMaterial = null;

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

		if (vertexData.isFull(4)) {
			this.flush();
		}

		// single-texture batching: adopt the quad's material, flushing the
		// vertices queued under the previous one
		const bindGroup = this.renderer.textureStore.getBinding(texture, {
			force: reupload,
		});
		if (bindGroup !== this.currentMaterial) {
			this.flush();
			this.currentMaterial = bindGroup;
		}

		// Transform vertices. Stamp per-sprite depth onto z BEFORE
		// `m.apply` so Camera3d's view matrix (3D R⁻¹ ∘ T(-pos)) fully
		// rotates the vertex. For 2D-only matrices the z column is
		// identity, so output (x, y) is bit-identical and z passes through.
		const m = this.renderer.currentTransform;
		const z = this.renderer.currentDepth;
		const vec0 = V_ARRAY[0].set(x, y, z);
		const vec1 = V_ARRAY[1].set(x + w, y, z);
		const vec2 = V_ARRAY[2].set(x, y + h, z);
		const vec3 = V_ARRAY[3].set(x + w, y + h, z);

		if (!m.isIdentity()) {
			m.apply(vec0);
			m.apply(vec1);
			m.apply(vec2);
			m.apply(vec3);
		}

		// 4 vertices per quad; the index buffer provides the 6 indices.
		// textureId is 0 under single-texture batching (layout kept for
		// the multi-texture upgrade).
		vertexData.push(vec0.x, vec0.y, vec0.z, u0, v0, tint, 0);
		vertexData.push(vec1.x, vec1.y, vec1.z, u1, v0, tint, 0);
		vertexData.push(vec2.x, vec2.y, vec2.z, u0, v1, tint, 0);
		vertexData.push(vec3.x, vec3.y, vec3.z, u1, v1, tint, 0);
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
			binding?.key ?? "quad",
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
	 * indexed draw: 6 indices per 4 queued vertices, region-relative
	 * @param {GPURenderPassEncoder} pass - the open pass
	 * @param {number} vertexCount - pending vertex count
	 * @override
	 */
	recordDraw(pass, vertexCount) {
		pass.setBindGroup(1, this.currentMaterial);
		pass.setIndexBuffer(this.indexBuffer, "uint32");
		pass.drawIndexed((vertexCount / 4) * 6);
	}

	/**
	 * @override
	 */
	flush(topology) {
		if (this.currentMaterial === null) {
			// nothing was ever queued under a material this frame
			this.vertexData.clear();
			return;
		}
		super.flush(topology);
	}

	/**
	 * @override
	 */
	destroy() {
		this.indexBuffer?.destroy();
		this.indexBuffer = null;
		this.currentMaterial = null;
		super.destroy();
	}
}
