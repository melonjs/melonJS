// the lighting math modules are pure CPU code shared with the GL backend
// (published std140 layout, no GL calls)
import {
	BLOCK_BYTES,
	BLOCK_FLOATS,
	writeLight2dBlock,
} from "../../webgl/lighting/std140.ts";
import litQuadWGSL from "../shaders/quad-lit.wgsl";
import WebGPUQuadBatcher from "./quad_batcher.js";

/**
 * The WebGPU lit quad batcher — normal-mapped sprites shaded by the
 * Light2d std140 block, the port of the GL `LitQuadBatcher` under this
 * backend's single-texture-per-draw-segment model:
 *
 * - group 1 is a combined material (color texture + normal map, four
 *   entries); a change of either flushes the segment, so there is no
 *   per-vertex normal-texture id and no sampler ladder
 * - group 2 binds the std140 `Light2dBlock` with a dynamic offset — each
 *   `setLightUniforms` call snapshots the packed block into the effect
 *   uniform arena (queue writes execute before every recorded draw, so a
 *   shared buffer region per camera would be retroactively clobbered)
 * - normal maps live outside the TextureCache (same as GL): resident
 *   GPUTextures keyed by source object, re-uploaded when the source's
 *   duck-typed `version` stamp advances (NoiseTexture2d and friends)
 * @augments WebGPUQuadBatcher
 * @category Rendering
 */
export default class WebGPULitQuadBatcher extends WebGPUQuadBatcher {
	/**
	 * @override
	 */
	init(renderer, settings) {
		super.init(renderer, settings);
		const cache = renderer.pipelineCache;
		const device = renderer.device;

		this.litMaterialLayout = device.createBindGroupLayout({
			label: "melonJS lit material",
			entries: [
				{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
				{ binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
			],
		});
		this.lightsLayout = device.createBindGroupLayout({
			label: "melonJS light block",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: "uniform",
						hasDynamicOffset: true,
						minBindingSize: BLOCK_BYTES,
					},
				},
			],
		});
		// the lit family rides the frozen quad vertex layout
		this.shaderKey = cache.registerShader(litQuadWGSL, {
			bindGroupLayouts: [
				cache.frameLayout,
				this.litMaterialLayout,
				this.lightsLayout,
			],
			vertexLayoutKey: "quad",
			label: "melonJS lit quad shader",
		});

		// CPU staging for the std140 block (zero-filled tail keeps the full
		// BLOCK_BYTES write valid for minBindingSize)
		this.blockData = new Float32Array(BLOCK_FLOATS);
		// light-block bind group per arena page (pages persist across frames)
		this.lightBindGroups = new Map();
		// the current frame's snapshot binding: {bindGroup, dynamicOffset}
		this.lightBinding = null;

		// combined color+normal bind groups: colorView → (normalView → group)
		this.litMaterials = new Map();
		// resident normal-map textures: source → {texture, view, version, width, height}
		this.normalTextures = new Map();
	}

	/**
	 * Snapshot the packed light uniforms for the draws that follow — called
	 * by {@link WebGPURenderer#setLightUniforms} once per camera per frame.
	 * @param {object} packed - what packLights produced
	 */
	setLightUniforms(packed) {
		const renderer = this.renderer;
		const device = this.device;
		writeLight2dBlock(this.blockData, packed);
		const region = renderer.effectUniformArena.alloc(
			BLOCK_BYTES,
			device.limits.minUniformBufferOffsetAlignment,
		);
		device.queue.writeBuffer(
			region.buffer,
			region.offset,
			this.blockData.buffer,
			0,
			BLOCK_BYTES,
		);
		let bindGroup = this.lightBindGroups.get(region.buffer);
		if (typeof bindGroup === "undefined") {
			bindGroup = device.createBindGroup({
				label: "melonJS light block",
				layout: this.lightsLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: region.buffer, size: BLOCK_BYTES },
					},
				],
			});
			this.lightBindGroups.set(region.buffer, bindGroup);
		}
		this.lightBinding = {
			bindGroup,
			dynamicOffset: region.offset,
			// the arena region only holds these bytes until the next frame's
			// reset — the binding must never outlive the frame it was
			// snapshotted in
			frameId: renderer.frameId,
		};
	}

	/**
	 * Whether a light block was snapshotted during the given frame — the
	 * renderer's lit gate requires this: a previous-frame binding points
	 * into a reset arena region, so it would sample reused bytes.
	 * @param {number} frameId - the renderer's current frame stamp
	 * @returns {boolean} true when lit draws can bind a valid light block
	 */
	hasCurrentLightBinding(frameId) {
		return this.lightBinding !== null && this.lightBinding.frameId === frameId;
	}

	/**
	 * Resolve (and lazily upload) the resident texture for a normal-map
	 * source, re-uploading when its duck-typed `version` stamp advances.
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} source - the normal-map image
	 * @returns {object} {texture, view, version, width, height}
	 * @ignore
	 * @internal
	 */
	residentNormalMap(source) {
		const version = source.version ?? 0;
		const frameId = this.renderer.frameId;
		let entry = this.normalTextures.get(source);
		const width = source.width || source.videoWidth || 1;
		const height = source.height || source.videoHeight || 1;
		if (
			typeof entry === "undefined" ||
			entry.width !== width ||
			entry.height !== height ||
			// An in-place re-upload is retroactive: queue writes execute
			// before EVERY draw recorded this frame, so a version bump on a
			// map already sampled this frame must land in a fresh texture or
			// earlier draws would show the new pixels (same rule as the
			// texture store's color records)
			(entry.version !== version && entry.frameId === frameId)
		) {
			if (typeof entry !== "undefined") {
				this.renderer.retireTexture(entry.texture);
			}
			const texture = this.device.createTexture({
				label: "melonJS normal map",
				size: [width, height],
				format: "rgba8unorm",
				usage:
					GPUTextureUsage.TEXTURE_BINDING |
					GPUTextureUsage.COPY_DST |
					GPUTextureUsage.RENDER_ATTACHMENT,
			});
			entry = {
				texture,
				view: texture.createView(),
				version: undefined,
				width,
				height,
				frameId: -1,
			};
			this.normalTextures.set(source, entry);
		}
		if (entry.version !== version) {
			// normals are geometry, not color — never premultiply
			this.device.queue.copyExternalImageToTexture(
				{ source },
				{ texture: entry.texture, premultipliedAlpha: false },
				[width, height],
			);
			entry.version = version;
		}
		// stamp: draws recorded this frame sample this texture
		entry.frameId = frameId;
		return entry;
	}

	/**
	 * Add a lit textured quad — the base contract plus the normal map the
	 * segment shades with.
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
	 * @param {boolean} [reupload=false] - force the source pixels to re-upload
	 * @param {object} [normalMap] - the normal-map image paired with the texture
	 * @override
	 */
	addQuad(
		texture,
		x,
		y,
		w,
		h,
		u0,
		v0,
		u1,
		v1,
		tint,
		reupload = false,
		normalMap,
	) {
		const renderer = this.renderer;
		// resolve the combined color+normal material for this segment
		const record = renderer.textureStore.getResidentRecord(texture, {
			force: reupload,
		});
		const normal = this.residentNormalMap(normalMap);

		let byNormal = this.litMaterials.get(record.view);
		if (typeof byNormal === "undefined") {
			byNormal = new Map();
			this.litMaterials.set(record.view, byNormal);
		}
		let combined = byNormal.get(normal.view);
		if (typeof combined === "undefined") {
			const filter =
				typeof texture.filter === "string"
					? texture.filter
					: renderer.getDefaultTextureFilter();
			const wrap = texture.repeat ?? "no-repeat";
			const store = renderer.textureStore;
			combined = this.device.createBindGroup({
				label: "melonJS lit material",
				layout: this.litMaterialLayout,
				entries: [
					{ binding: 0, resource: record.view },
					{ binding: 1, resource: store.getSampler(filter, wrap) },
					{ binding: 2, resource: normal.view },
					{ binding: 3, resource: store.getSampler(filter, "no-repeat") },
				],
			});
			byNormal.set(normal.view, combined);
		}

		if (this.vertexData.isFull(4) || combined !== this.currentMaterial) {
			this.flush();
			this.currentMaterial = combined;
		}

		// transform + push the four corners exactly like the base batcher
		this.pushQuadVertices(x, y, w, h, u0, v0, u1, v1, tint);
	}

	/**
	 * Drop every combined color+normal bind group — each pairing embeds a
	 * sampler resolved from the default texture filter, so a filter change
	 * must rebuild them (the lit-tier counterpart of the texture store's
	 * invalidateBindGroups; the resident textures stay).
	 * @override
	 */
	clearMaterialCache() {
		super.clearMaterialCache();
		this.litMaterials.clear();
	}

	/**
	 * the lit material model is the combined color+normal bind group, not
	 * the base segment slots
	 * @override
	 * @ignore
	 * @internal
	 */
	hasPendingMaterial() {
		return this.currentMaterial !== null;
	}

	/**
	 * lit draws bind the combined material at 1 and the light block at 2
	 * @override
	 */
	recordDraw(pass, vertexCount) {
		pass.setBindGroup(1, this.currentMaterial);
		if (this.lightBinding !== null) {
			pass.setBindGroup(2, this.lightBinding.bindGroup, [
				this.lightBinding.dynamicOffset,
			]);
		}
		pass.setIndexBuffer(this.indexBuffer, "uint32");
		pass.drawIndexed((vertexCount / 4) * 6);
	}

	/**
	 * @override
	 */
	reset() {
		super.reset();
		for (const entry of this.normalTextures.values()) {
			this.renderer.retireTexture(entry.texture);
		}
		this.normalTextures.clear();
		this.litMaterials.clear();
		this.lightBindGroups.clear();
		this.lightBinding = null;
	}

	/**
	 * @override
	 */
	destroy() {
		this.reset();
		super.destroy();
	}
}
