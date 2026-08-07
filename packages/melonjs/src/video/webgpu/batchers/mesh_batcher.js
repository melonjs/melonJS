import { Matrix3d } from "../../../math/matrix3d.ts";
import { instanceAttributes } from "../../gpu/instancerecord.ts";
import {
	assignIndex,
	beginChunk,
	ensureRemapCapacity,
	remapIndex,
} from "../../gpu/meshchunk.ts";
import { buildMeshVertexData, retainedScratch } from "../../gpu/meshvertex.ts";
import WebGPUInstanceBuffer from "../buffer/instance_buffer.js";
import WebGPURetainedGeometry from "../buffer/retained_geometry.js";
import meshWGSL from "../shaders/mesh.wgsl";
import {
	buildInstancedMeshWGSL,
	UNLIT_INSTANCED,
} from "../shaders/mesh-instanced.js";
import WebGPUBatcher from "./webgpu_batcher.js";

/**
 * Byte size of the per-draw mesh uniform block:
 * mat4x4 model (64) + mat4x4 view (64) + vec4 tint (16) + vec4 params
 * (alphaCutoff, reserved ×3) (16) + vec4 emissive (16) → 176.
 * @ignore
 */
export const MESH_UNIFORM_SIZE = 176;

// Shared identity model matrix for draws whose vertices are already placed
// (the 2D-camera path pre-projects them on the CPU). Never mutated.
const IDENTITY_MATRIX = new Matrix3d();

// Scratch for assembling one MeshUniforms snapshot (44 floats = 176 bytes).
// Reused — setPlacementUniforms runs synchronously and never re-enters.
const UNIFORM_SCRATCH = new Float32Array(MESH_UNIFORM_SIZE / 4);

/**
 * The WebGPU mesh batcher — textured triangle meshes with the same
 * geometry contract as the WebGL `MeshBatcher` (36-byte unlit layout,
 * model-space retained geometry, uniform-driven placement) realized on
 * this backend's recording model:
 *
 * - mesh mode is PIPELINE state, not device state: every mesh flush looks
 *   its pipeline up with the mesh axes (depth write + LEQUAL, per-mesh
 *   cull/frontFace from `renderer.drawMesh`) and blend forced "none" —
 *   there is no `bind()`/`unbind()` state to own, and the depth clear is
 *   the pass's `depthLoadOp` (see `resolveDepthOps`), not a draw-time op
 * - placement/tint/cutoff/emissive ride ONE per-draw uniform snapshot
 *   (group 3, dynamic offset into the effect uniform arena) — the
 *   queue-write law: a shared region would be retroactively clobbered for
 *   draws already recorded this frame
 * - the accumulated path chunks through the shared versioned-remap dedup
 *   (`gpu/meshchunk.ts`) into the frame's vertex arena plus a per-frame
 *   INDEX arena (`renderer.indexArena`) — one `drawIndexed` per chunk
 * @augments WebGPUBatcher
 * @category Rendering
 */
export default class WebGPUMeshBatcher extends WebGPUBatcher {
	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 * @override
	 */
	init(renderer, settings) {
		super.init(renderer, settings ?? this.defaultSettings());
		const cache = renderer.pipelineCache;

		// group-3 layout for the per-draw uniform snapshot, cached by shape
		// signature (shared with the lit subclass and across device losses
		// via the pipeline cache's own lifecycle)
		this.meshLayout = cache.getEffectLayout(this.uniformSignature(), [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
					hasDynamicOffset: true,
					minBindingSize: MESH_UNIFORM_SIZE,
				},
			},
		]);

		// register the family: it rides this batcher's own vertex layout
		// (the key the base init just registered the layout under), with
		// the subclass-controlled module text and group-layout list. A
		// re-init against a SURVIVING cache (reset with a valid device)
		// short-circuits on the module text — registerShader would dedupe
		// anyway, but evaluating bindGroupLayoutList first would orphan a
		// fresh lit lightsLayout per re-init
		const vertexLayoutKey = this.shaderKey;
		const source = this.shaderSource();
		const registered = cache.registeredModules.get(source);
		if (typeof registered !== "undefined") {
			this.shaderKey = registered;
		} else {
			this.shaderKey = cache.registerShader(source, {
				bindGroupLayouts: this.bindGroupLayoutList(cache),
				vertexLayoutKey,
				label: `melonJS ${vertexLayoutKey} shader`,
			});
		}
		// the host identity for custom modules: a hosted custom shader is
		// registered against this batcher's vertex layout and group list
		this.vertexLayoutKey = vertexLayoutKey;
		// the custom shader hosted for the NEXT draw (a WGSL-carrying
		// GLShader routed by `renderer.drawMesh`, cleared after each mesh),
		// or null
		this.customShader = null;

		// CPU index staging for the accumulated path (uint32 — matches the
		// backend's index convention and keeps writeBuffer 4-byte aligned)
		this.indexData = new Uint32Array(this.vertexData.maxVertex * 6);
		this.indexCount = 0;

		// the material bind group the pending vertices were queued under
		this.currentMaterial = null;
		// per-draw uniform snapshot binding: {bindGroup, dynamicOffset}
		this.uniformBinding = null;
		// uniform bind group per arena page (pages persist across frames)
		this.uniformBindGroups = new Map();
		// the mesh pass axes for the NEXT flush — mutated in place by
		// `renderer.drawMesh` per mesh (read synchronously at pipeline lookup)
		this.meshState = { cullMode: "back", frontFace: "ccw" };

		// Retained geometry per mesh (model-space buffers uploaded once). A
		// re-init means a new device or a fresh batcher life, so anything
		// held is stale — release it rather than leak it.
		if (this.retained !== undefined) {
			this.releaseAllRetained();
		}
		this.retained = new Map();

		// Per-mesh instance record buffers, and the pipeline-cache family key
		// per declared slot combination. Same lifetime rule as `retained`: a
		// re-init means a new device, so drop what is held.
		if (this.instanced !== undefined) {
			this.releaseAllInstanced();
		}
		this.instanced = new Map();
		this.instancedKeys = new Map();
	}

	/**
	 * The instanced variant options for this tier (unlit by default) — where
	 * its instance attributes start and how its vertex stage places them.
	 * @ignore
	 */
	instancedVariant() {
		return UNLIT_INSTANCED;
	}

	/**
	 * The pipeline-cache family for a given record layout, registered on
	 * first use.
	 *
	 * WGSL has no preprocessor, so the variant is a module DERIVED from this
	 * tier's ordinary source (see `buildInstancedMeshWGSL`) rather than the
	 * same text compiled with different defines. Its vertex layout is two
	 * groups: this batcher's geometry layout, plus the instance records
	 * stepping once per instance.
	 * @param {object} layout - the instance record layout
	 * @returns {string} the family key
	 * @ignore
	 */
	instancedFamilyFor(layout) {
		const key = (layout.hasColor ? 1 : 0) | (layout.hasData ? 2 : 0);
		let familyKey = this.instancedKeys.get(key);
		if (familyKey !== undefined) {
			return familyKey;
		}
		const cache = this.renderer.pipelineCache;
		const variant = this.instancedVariant();
		const source = buildInstancedMeshWGSL(this.shaderSource(), {
			...variant,
			hasColor: layout.hasColor,
			hasData: layout.hasData,
		});
		const layoutKey = `${this.vertexLayoutKey}Instanced${key}`;
		cache.registerVertexLayout(layoutKey, [
			{
				stride: this.stride,
				attributes: this.attributes,
			},
			{
				stride: layout.stride,
				stepMode: "instance",
				attributes: instanceAttributes(layout, variant.baseLocation),
			},
		]);
		familyKey = cache.registerShader(source, {
			bindGroupLayouts: this.bindGroupLayoutList(cache),
			vertexLayoutKey: layoutKey,
			label: `melonJS ${layoutKey} shader`,
		});
		this.instancedKeys.set(key, familyKey);
		return familyKey;
	}

	/**
	 * Get (creating on first use) the GPU instance buffer for one mesh, with
	 * its dirty span already uploaded.
	 * @param {InstancedMesh} mesh - the mesh being drawn
	 * @returns {WebGPUInstanceBuffer} the up-to-date buffer
	 * @ignore
	 */
	instanceBufferFor(mesh) {
		let buffer = this.instanced.get(mesh);
		if (buffer === undefined) {
			buffer = new WebGPUInstanceBuffer(this.renderer);
			this.instanced.set(mesh, buffer);
		}
		const plan = mesh.instanceUpload(buffer.uploadedRevision ?? -1);
		if (plan.full) {
			// this buffer missed edits the span no longer describes
			buffer.capacity = 0;
		}
		buffer.upload(
			mesh.instanceBuffer,
			plan.first,
			plan.count,
			mesh.instanceCount * mesh.instanceLayout.stride,
		);
		buffer.uploadedRevision = plan.revision;
		mesh.clearInstanceDirty();
		return buffer;
	}

	/**
	 * Draw every visible instance of a mesh in one recorded call.
	 * @param {InstancedMesh} mesh - the mesh to draw
	 * @param {Matrix3d} modelMatrix - where the group sits in the world
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @ignore
	 */
	drawInstancedMesh(mesh, modelMatrix, tint) {
		const count = mesh.visibleInstanceCount;
		if (count === 0) {
			return;
		}
		// anything queued must land first, or this draw would reorder ahead
		this.flush();

		this.updatePassState();
		this.applyMeshMaterial(mesh);
		this.setPlacementUniforms(modelMatrix, tint, mesh);

		const renderer = this.renderer;
		// A custom mesh shader is not hosted on the instanced path: the
		// instanced families own their vertex layout (geometry group +
		// per-instance group at pinned locations), which a custom module does
		// not declare. Same limitation as the WebGL backend, warned the same
		// way, so the two agree rather than one silently ignoring it.
		if (this.customShader != null && this.instancedShaderWarned !== true) {
			this.instancedShaderWarned = true;
			console.warn(
				"melonJS: a custom shader cannot be hosted on an InstancedMesh — the mesh draws with the built-in instanced shading",
			);
		}
		const pass = renderer.ensurePass();
		const geometry = this.retainedGeometryFor(mesh);
		const instances = this.instanceBufferFor(mesh);

		const pipeline = renderer.pipelineCache.get(
			this.instancedFamilyFor(mesh.instanceLayout),
			"triangle-list",
			"none",
			renderer.premultipliedAlpha,
			renderer.stencilMode,
			this.meshState,
		);
		if (pipeline !== renderer.currentPipeline) {
			pass.setPipeline(pipeline);
			renderer.currentPipeline = pipeline;
		}
		const frame = renderer.currentFrameBinding;
		pass.setBindGroup(0, frame.bindGroup, [frame.dynamicOffset]);
		pass.setBindGroup(1, this.currentMaterial);
		this.bindLights(pass);
		pass.setBindGroup(3, this.uniformBinding.bindGroup, [
			this.uniformBinding.dynamicOffset,
		]);
		pass.setVertexBuffer(0, geometry.vertexBuffer);
		pass.setVertexBuffer(1, instances.buffer);
		pass.setIndexBuffer(geometry.indexBuffer, geometry.indexFormat);
		pass.drawIndexed(geometry.indexCount, count);

		// stamp both halves: an edit later this frame must go to fresh buffers
		geometry.lastDrawnFrameId = renderer.frameId;
		instances.lastDrawnFrameId = renderer.frameId;
	}

	/**
	 * Release the instance buffer held for one mesh, if any.
	 * @param {object} mesh - the mesh whose instance records should be freed
	 * @ignore
	 */
	releaseInstanced(mesh) {
		const buffer = this.instanced?.get(mesh);
		if (buffer !== undefined) {
			buffer.destroy();
			this.instanced.delete(mesh);
		}
	}

	/**
	 * Release every instance buffer this batcher holds.
	 * @ignore
	 */
	releaseAllInstanced() {
		this.instanced?.forEach((buffer) => {
			buffer.destroy();
		});
		this.instanced?.clear();
	}

	/**
	 * the first-init settings — the lit subclass overrides the key and
	 * appends its normal attribute
	 * @ignore
	 */
	defaultSettings() {
		return {
			shaderKey: "mesh",
			topology: "triangle-list",
			attributes: this.attributeLayout(),
		};
	}

	/**
	 * the WGSL module text of this family
	 * @ignore
	 */
	shaderSource() {
		return meshWGSL;
	}

	/**
	 * The vertex attribute layout — identical to the WebGL mesh batcher's:
	 * `aVertex` (3) + `aRegion` (2) + `aColor` (4 floats, deliberately not
	 * unorm8x4 — the layout is shared with GL, where float colors dodge
	 * NaN-pattern canonicalization on Metal-backed drivers) = 9 floats.
	 * @ignore
	 */
	attributeLayout() {
		return [
			{
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
				format: "float32x4",
				offset: 5 * Float32Array.BYTES_PER_ELEMENT,
			},
		];
	}

	/**
	 * the shape signature keying the group-3 layout in the pipeline cache
	 * @ignore
	 */
	uniformSignature() {
		return `mesh:u${MESH_UNIFORM_SIZE}`;
	}

	/**
	 * The shader family for the next recorded draw: the built-in family,
	 * or the hosted custom module when `renderer.drawMesh` routed a
	 * WGSL-carrying {@link GLShader} here — registered lazily against
	 * THIS host's vertex layout and group list, so one instance serves
	 * the unlit and lit hosts as distinct families. An invalid module
	 * (failed async validation) falls back to the built-in family: the
	 * mesh keeps drawing, default-shaded — the ShaderEffect
	 * warn-and-degrade contract.
	 * @returns {string} the pipeline-cache family key
	 * @ignore
	 */
	activeShaderKey() {
		const custom = this.customShader;
		if (custom === null) {
			return this.shaderKey;
		}
		// registerWGSL owns the epoch/validity bookkeeping (a fresh device
		// re-validates an invalidated module) and returns null while invalid
		const cache = this.renderer.pipelineCache;
		const key = custom.registerWGSL(
			cache,
			this.vertexLayoutKey,
			this.bindGroupLayoutList(cache),
			this.vertexLayoutKey,
		);
		return key ?? this.shaderKey;
	}

	/**
	 * the positional bind-group-layout list for this family — the lit
	 * subclass swaps the group-2 filler for its light-block layout
	 * @ignore
	 */
	bindGroupLayoutList(cache) {
		return [
			cache.frameLayout,
			cache.materialLayout,
			cache.emptyLayout,
			this.meshLayout,
		];
	}

	/**
	 * Resolve the group-1 material for a mesh: its texture through the
	 * texture store, honouring the mesh's own `textureRepeat` wrap override
	 * (#1503 — sampler state per use, never a mutation of the shared
	 * per-image atlas). A material change with vertices pending flushes
	 * them under the previous binding.
	 * @param {object} mesh - the mesh whose material should be applied
	 * @ignore
	 */
	applyMeshMaterial(mesh) {
		const renderer = this.renderer;
		const filter =
			typeof mesh.texture.filter === "string"
				? mesh.texture.filter
				: renderer.getDefaultTextureFilter();
		const material = renderer.textureStore.getBinding(mesh.texture, {
			repeat: mesh.textureRepeat,
			// mesh textures sample a generated mip chain — trilinear
			// minification keeps distant geometry from shimmering, while
			// "nearest" opts out (crisp pixel-art models) and 2D consumers
			// of the same image stay lod-clamped to level 0
			mipmaps: filter === "linear",
		});
		if (material !== this.currentMaterial) {
			this.flush();
			this.currentMaterial = material;
		}
	}

	/**
	 * Snapshot the per-draw uniforms — placement (`model`, `view`), tint,
	 * and the mesh's material scalars (alpha cutoff, emissive) — into a
	 * fresh dynamic-offset region of the effect uniform arena. The draws
	 * recorded after this bind against exactly these bytes.
	 * @param {Matrix3d} modelMatrix - the mesh's own placement, or identity
	 *   when its vertices are already positioned
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @param {object} mesh - the mesh (alphaCutoff / emissive source)
	 * @ignore
	 */
	setPlacementUniforms(modelMatrix, tint, mesh) {
		const renderer = this.renderer;
		const device = this.device;
		const scratch = UNIFORM_SCRATCH;
		scratch.set(modelMatrix.val, 0);
		scratch.set(renderer.currentTransform.val, 16);
		scratch[32] = ((tint >>> 16) & 0xff) / 255;
		scratch[33] = ((tint >>> 8) & 0xff) / 255;
		scratch[34] = (tint & 0xff) / 255;
		scratch[35] = ((tint >>> 24) & 0xff) / 255;
		scratch[36] = mesh.alphaCutoff || 0;
		scratch[37] = 0;
		scratch[38] = 0;
		scratch[39] = 0;
		const em = mesh.emissive;
		scratch[40] = em ? em[0] : 0;
		scratch[41] = em ? em[1] : 0;
		scratch[42] = em ? em[2] : 0;
		scratch[43] = 0;

		const region = renderer.effectUniformArena.alloc(
			MESH_UNIFORM_SIZE,
			device.limits.minUniformBufferOffsetAlignment,
		);
		device.queue.writeBuffer(
			region.buffer,
			region.offset,
			scratch.buffer,
			0,
			MESH_UNIFORM_SIZE,
		);
		let bindGroup = this.uniformBindGroups.get(region.buffer);
		if (typeof bindGroup === "undefined") {
			bindGroup = device.createBindGroup({
				label: "melonJS mesh uniforms",
				layout: this.meshLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: region.buffer, size: MESH_UNIFORM_SIZE },
					},
				],
			});
			this.uniformBindGroups.set(region.buffer, bindGroup);
		}
		this.uniformBinding = { bindGroup, dynamicOffset: region.offset };
	}

	/**
	 * Write one vertex into the staging buffer. The base (unlit) layout is
	 * `x, y, z, u, v, color` — subclasses override to append per-vertex
	 * data matching their attribute layout.
	 * @ignore
	 */
	pushVertex(vertexData, x, y, z, u, v, color, _mesh, _i3) {
		vertexData.pushMesh(x, y, z, u, v, color);
	}

	/**
	 * Add a textured mesh to the batch (the accumulated path: vertices
	 * already CPU-projected, identity model matrix). Chunks triangles
	 * across flushes through the shared versioned-remap dedup, exactly
	 * like the WebGL batcher. Multi-material vertex colors ride `aColor`;
	 * the runtime tint stays a uniform.
	 * @param {object} mesh - a Mesh with vertices, uvs, indices, texture
	 * @param {number} tint - tint color in UINT32 (argb) format
	 */
	addMesh(mesh, tint) {
		const vertices = mesh.vertices;
		const uvs = mesh.uvs;
		const indices = mesh.indices;
		const vertexColors = mesh.vertexColors;

		this.updatePassState();
		this.applyMeshMaterial(mesh);
		this.setPlacementUniforms(IDENTITY_MATRIX, tint, mesh);

		const maxVerts = this.vertexData.maxVertex;
		const maxIndices = this.indexData.length;

		ensureRemapCapacity(mesh.vertexCount);

		let triIdx = 0;
		while (triIdx < indices.length) {
			const vertexData = this.vertexData;
			const availVerts = maxVerts - vertexData.vertexCount;
			const availIndices = maxIndices - this.indexCount;
			// each triangle needs at most 3 new vertices and 3 indices
			const maxTris = Math.min(
				Math.floor(availVerts / 3),
				Math.floor(availIndices / 3),
			);

			if (maxTris === 0) {
				this.flush();
				continue;
			}

			const endIdx = Math.min(triIdx + maxTris * 3, indices.length);

			const baseOffset = vertexData.vertexCount;
			const chunkIndices = beginChunk();
			let localCount = 0;

			for (let j = triIdx; j < endIdx; j++) {
				const origIdx = indices[j];
				let localIdx = remapIndex(origIdx);
				if (localIdx === -1) {
					localIdx = localCount++;
					assignIndex(origIdx, localIdx);

					const i3 = origIdx * 3;
					const i2 = origIdx * 2;
					const vertColor = vertexColors ? vertexColors[origIdx] : 0xffffffff;
					this.pushVertex(
						vertexData,
						vertices[i3],
						vertices[i3 + 1],
						vertices[i3 + 2],
						uvs[i2],
						uvs[i2 + 1],
						vertColor,
						mesh,
						i3,
					);
				}
				chunkIndices.push(baseOffset + localIdx);
			}

			// append the chunk's absolute indices to the staging array
			let o = this.indexCount;
			for (let i = 0; i < chunkIndices.length; i++) {
				this.indexData[o++] = chunkIndices[i];
			}
			this.indexCount = o;
			triIdx = endIdx;
		}
	}

	/**
	 * Record the pending mesh vertices as one indexed draw: vertex bytes
	 * into the vertex arena, index bytes into the index arena, pipeline
	 * from the mesh family with the depth/cull axes and blend forced
	 * "none" (the GL mesh mode disables BLEND).
	 * @override
	 */
	flush() {
		const vertexData = this.vertexData;
		const vertexCount = vertexData.vertexCount;
		const indexCount = this.indexCount;
		if (vertexCount === 0 || indexCount === 0) {
			return;
		}
		const renderer = this.renderer;
		const device = this.device;
		const pass = renderer.ensurePass();

		const byteLength = vertexCount * this.stride;
		const vertexRegion = renderer.vertexArena.alloc(byteLength);
		device.queue.writeBuffer(
			vertexRegion.buffer,
			vertexRegion.offset,
			vertexData.toUint8(),
			0,
			byteLength,
		);

		const indexBytes = indexCount * 4;
		const indexRegion = renderer.indexArena.alloc(indexBytes);
		device.queue.writeBuffer(
			indexRegion.buffer,
			indexRegion.offset,
			this.indexData.buffer,
			0,
			indexBytes,
		);

		const pipeline = renderer.pipelineCache.get(
			this.activeShaderKey(),
			"triangle-list",
			// mesh mode never blends — occlusion comes from the depth test
			"none",
			renderer.premultipliedAlpha,
			renderer.stencilMode,
			this.meshState,
		);
		if (pipeline !== renderer.currentPipeline) {
			pass.setPipeline(pipeline);
			renderer.currentPipeline = pipeline;
		}
		const frame = renderer.currentFrameBinding;
		pass.setBindGroup(0, frame.bindGroup, [frame.dynamicOffset]);
		pass.setBindGroup(1, this.currentMaterial);
		this.bindLights(pass);
		pass.setBindGroup(3, this.uniformBinding.bindGroup, [
			this.uniformBinding.dynamicOffset,
		]);
		pass.setVertexBuffer(
			0,
			vertexRegion.buffer,
			vertexRegion.offset,
			byteLength,
		);
		pass.setIndexBuffer(
			indexRegion.buffer,
			"uint32",
			indexRegion.offset,
			indexBytes,
		);
		pass.drawIndexed(indexCount);

		vertexData.clear();
		this.indexCount = 0;
	}

	/**
	 * bind group 2 — the unlit family interposes the shared empty group;
	 * the lit subclass overrides with its light block
	 * @ignore
	 */
	bindLights(pass) {
		pass.setBindGroup(2, this.renderer.pipelineCache.emptyBindGroup);
	}

	/**
	 * Write one mesh's model-space geometry into `out` in this batcher's
	 * vertex layout, returning how many floats were written — the shared
	 * neutral builder (`gpu/meshvertex.ts`), one copy for both backends.
	 * @param {object} mesh - the mesh to read geometry from
	 * @param {Float32Array} out - destination scratch
	 * @returns {number} number of floats written
	 * @ignore
	 */
	buildRetainedVertexData(mesh, out) {
		return buildMeshVertexData(mesh, out, this.vertexSize);
	}

	/**
	 * Get this mesh's retained geometry, building or refreshing it when
	 * the mesh's geometry version has moved on.
	 * @param {object} mesh - the mesh whose geometry is wanted
	 * @returns {WebGPURetainedGeometry} up-to-date geometry for the mesh
	 * @ignore
	 */
	retainedGeometryFor(mesh) {
		let geometry = this.retained.get(mesh);
		if (geometry === undefined) {
			geometry = new WebGPURetainedGeometry(this.renderer);
			this.retained.set(mesh, geometry);
		}
		const version = mesh._geometryVersion ?? 0;
		if (geometry.uploadedVersion !== version) {
			const scratch = retainedScratch(mesh.vertexCount * this.vertexSize);
			const floats = this.buildRetainedVertexData(mesh, scratch);
			geometry.upload(scratch, floats, mesh._indicesOriginal, version);
		}
		return geometry;
	}

	/**
	 * Draw a mesh from its retained geometry: bind the persistent buffers
	 * and record one indexed draw, with placement supplied entirely by the
	 * per-draw uniform snapshot. Unlike {@link WebGPUMeshBatcher#addMesh}
	 * this accumulates nothing and never chunks — the whole mesh is one
	 * draw regardless of size.
	 * @param {object} mesh - the mesh to draw
	 * @param {Matrix3d} modelMatrix - where the mesh sits in the world
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @ignore
	 */
	drawRetainedMesh(mesh, modelMatrix, tint) {
		// anything queued must land first, or this draw would reorder
		// ahead of it
		this.flush();

		this.updatePassState();
		this.applyMeshMaterial(mesh);
		this.setPlacementUniforms(modelMatrix, tint, mesh);

		const renderer = this.renderer;
		const pass = renderer.ensurePass();
		const geometry = this.retainedGeometryFor(mesh);

		const pipeline = renderer.pipelineCache.get(
			this.activeShaderKey(),
			"triangle-list",
			"none",
			renderer.premultipliedAlpha,
			renderer.stencilMode,
			this.meshState,
		);
		if (pipeline !== renderer.currentPipeline) {
			pass.setPipeline(pipeline);
			renderer.currentPipeline = pipeline;
		}
		const frame = renderer.currentFrameBinding;
		pass.setBindGroup(0, frame.bindGroup, [frame.dynamicOffset]);
		pass.setBindGroup(1, this.currentMaterial);
		this.bindLights(pass);
		pass.setBindGroup(3, this.uniformBinding.bindGroup, [
			this.uniformBinding.dynamicOffset,
		]);
		pass.setVertexBuffer(0, geometry.vertexBuffer);
		pass.setIndexBuffer(geometry.indexBuffer, geometry.indexFormat);
		pass.drawIndexed(geometry.indexCount);

		// stamp: a version bump later this frame must go to fresh buffers
		geometry.lastDrawnFrameId = renderer.frameId;
	}

	/**
	 * Release the retained geometry held for one mesh, if any.
	 * @param {object} mesh - the mesh whose geometry should be freed
	 * @ignore
	 */
	releaseRetained(mesh) {
		this.releaseInstanced(mesh);
		const geometry = this.retained.get(mesh);
		if (geometry !== undefined) {
			geometry.destroy();
			this.retained.delete(mesh);
		}
	}

	/**
	 * Release every retained geometry this batcher holds.
	 * @ignore
	 */
	releaseAllRetained() {
		this.releaseAllInstanced();
		this.retained.forEach((geometry) => {
			geometry.destroy();
		});
		this.retained.clear();
	}

	/**
	 * @override
	 */
	reset() {
		super.reset();
		this.indexCount = 0;
		this.currentMaterial = null;
		this.customShader = null;
		this.uniformBinding = null;
		this.uniformBindGroups.clear();
		this.releaseAllRetained();
	}

	/**
	 * @override
	 */
	destroy() {
		this.reset();
		super.destroy();
	}
}
