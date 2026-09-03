import { transformQuadCorners } from "../../../gpu/quadcorners.ts";
import tmxLayerWGSL from "../../shaders/tmxlayer.wgsl";

/**
 * additional imports for TypeScript
 * @import { default as TMXLayer } from "../../../../level/tiled/TMXLayer.js";
 * @import { default as WebGPURenderer } from "../../webgpu_renderer.js";
 */

/**
 * byte size of the TMXUniforms block (see tmxlayer.wgsl): ten vec2f (80)
 * interleaved with one vec4f at a 16-aligned offset, two f32 and the
 * trailing vec4f tint → 112 bytes
 * @ignore
 * @internal
 */
const TMX_UNIFORM_SIZE = 112;

/**
 * GPU-accelerated renderer for orthogonal TMX tile layers on the WebGPU
 * backend — the WGSL realization of the WebGL shader tile path: the
 * visible region draws as ONE quad per tileset, with the fragment shader
 * sampling a per-layer GID index texture and the tileset atlas.
 *
 * Structure mirrors the WebGL twin; the mechanisms are the backend's:
 * - the GID index / animation lookup are renderer-owned `rgba8unorm`
 *   textures written with `queue.writeTexture` (byte-exact `textureLoad`
 *   reads, no sampler needed) — re-uploaded only when `layer.dataVersion`
 *   moves or an animation frame advances
 * - the per-draw uniforms snapshot into the effect uniform arena with a
 *   dynamic offset (each tileset pass gets its own region, per the
 *   queue-write-before-draws ordering)
 * - the tileset atlas rides the standard texture-store material path
 * - pipelines flow through the registered `tmxlayer.wgsl` family, keyed
 *   on the frame's blend/stencil state like every other draw
 * @ignore
 * @internal
 */
export default class OrthogonalTMXLayerGPURenderer {
	/**
	 * @param {WebGPURenderer} renderer - the WebGPU renderer instance
	 */
	constructor(renderer) {
		this.renderer = renderer;
		const cache = renderer.pipelineCache;

		// group-3 shape: the uniform block + the two lookup textures
		this.tmxLayout = cache.getEffectLayout("tmx", [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
					hasDynamicOffset: true,
					minBindingSize: TMX_UNIFORM_SIZE,
				},
			},
			{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
			{ binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
		]);
		this.key = cache.registerShader(tmxLayerWGSL, {
			bindGroupLayouts: [
				cache.frameLayout,
				cache.materialLayout,
				cache.emptyLayout,
				this.tmxLayout,
			],
			vertexLayoutKey: "quad",
			label: "melonJS tmx layer shader",
		});
		// the pipeline cache this state was built against — a device loss
		// rebuilds the cache, and the renderer drops this instance with it
		this.epoch = cache.epoch;

		/**
		 * per-layer GID index texture: layer → {texture, view, version}
		 * @type {Map<TMXLayer, object>}
		 */
		this.resources = new Map();
		/**
		 * per-tileset animation lookup: tileset → {texture, view, data, tileCount}
		 * @type {Map<object, object>}
		 */
		this.animLookups = new Map();
		/**
		 * per-(layer, tileset) cached group-3 bind group, keyed on the
		 * uniform arena page it binds
		 * @type {Map<TMXLayer, Map<object, {bindGroup: GPUBindGroup, pageLabel: string, animView: object}>>}
		 */
		this.bindGroups = new Map();

		// CPU staging for the uniform block and the quad vertices
		this.uniformScratch = new Float32Array(TMX_UNIFORM_SIZE / 4);
		this.vertexScratch = new ArrayBuffer(4 * 28);
		this.vertexF32 = new Float32Array(this.vertexScratch);
		this.vertexU32 = new Uint32Array(this.vertexScratch);
	}

	/**
	 * Retire every lookup texture and empty the local maps — called from
	 * `WebGPURenderer.reset()` (GAME_RESET) so each level starts clean.
	 * @ignore
	 * @internal
	 */
	reset() {
		for (const resource of this.resources.values()) {
			this.renderer.retireTexture(resource.texture);
		}
		for (const entry of this.animLookups.values()) {
			this.renderer.retireTexture(entry.texture);
		}
		this.resources.clear();
		this.animLookups.clear();
		this.bindGroups.clear();
	}

	/**
	 * Get-or-create the per-layer GID index texture, re-uploading when the
	 * layer's data version moved (`setTile`/`clearTile` mutations).
	 * @param {TMXLayer} layer - the layer
	 * @returns {{texture: GPUTexture, view: GPUTextureView, version: number}}
	 * @ignore
	 * @internal
	 */
	getResource(layer) {
		const device = this.renderer.device;
		let resource = this.resources.get(layer);
		if (resource === undefined) {
			const texture = device.createTexture({
				label: "melonJS tmx index",
				size: [layer.cols, layer.rows],
				format: "rgba8unorm",
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
			});
			resource = { texture, view: texture.createView(), version: -1 };
			this.resources.set(layer, resource);
		}
		if (resource.version !== layer.dataVersion) {
			// reinterpret the layer's Uint16Array payload as RGBA bytes
			// (zero-copy view; little-endian = every browser)
			device.queue.writeTexture(
				{ texture: resource.texture },
				new Uint8Array(layer.layerData.buffer),
				{ bytesPerRow: layer.cols * 4, rowsPerImage: layer.rows },
				[layer.cols, layer.rows],
			);
			resource.version = layer.dataVersion;
		}
		return resource;
	}

	/**
	 * Get-or-update the per-tileset animation lookup (undefined for
	 * tilesets without animated tiles). Texel `localId` encodes the
	 * CURRENT frame's local id as (R = lo byte, G = hi byte).
	 * @param {object} tileset - the tileset
	 * @param {number} tileCount - atlas grid tile count
	 * @returns {object|undefined} the lookup entry
	 * @ignore
	 * @internal
	 */
	getOrUpdateAnimLookup(tileset, tileCount) {
		if (!tileset.isAnimated || tileset.animations.size === 0) {
			return undefined;
		}
		const device = this.renderer.device;
		let entry = this.animLookups.get(tileset);
		if (entry === undefined) {
			// identity mapping (localId → localId); animated entries get
			// overwritten below
			const data = new Uint8Array(tileCount * 4);
			for (let id = 0; id < tileCount; id++) {
				data[id * 4 + 0] = id & 0xff;
				data[id * 4 + 1] = (id >> 8) & 0xff;
			}
			const texture = device.createTexture({
				label: "melonJS tmx anim lookup",
				size: [tileCount, 1],
				format: "rgba8unorm",
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
			});
			entry = {
				texture,
				view: texture.createView(),
				data,
				tileCount,
				uploaded: false,
			};
			this.animLookups.set(tileset, entry);
		}
		// rewrite current-frame ids; upload only when a texel changed
		// (tileset.update advanced a frame). At most one upload per frame —
		// queue writes execute before every recorded draw, and animation
		// state only moves in the update phase, so the frame stays coherent.
		const data = entry.data;
		let dirty = !entry.uploaded;
		for (const [localId, anim] of tileset.animations) {
			const off = localId * 4;
			const cur = anim.cur.tileid;
			const lo = cur & 0xff;
			const hi = (cur >> 8) & 0xff;
			if (data[off] !== lo || data[off + 1] !== hi) {
				data[off] = lo;
				data[off + 1] = hi;
				dirty = true;
			}
		}
		if (dirty) {
			device.queue.writeTexture(
				{ texture: entry.texture },
				data,
				{ bytesPerRow: entry.tileCount * 4, rowsPerImage: 1 },
				[entry.tileCount, 1],
			);
			entry.uploaded = true;
		}
		return entry;
	}

	/**
	 * Draw an orthogonal TMX layer through the shader path.
	 * @param {TMXLayer} layer - the layer to draw
	 * @param {object} rect - the visible viewport rect (world coords)
	 */
	draw(layer, rect) {
		const renderer = this.renderer;
		const tileWidth = layer.tilewidth;
		const tileHeight = layer.tileheight;
		const cols = layer.cols;
		const rows = layer.rows;

		// visible region in tile-coord space
		const startTileX = Math.max(0, Math.floor(rect.pos.x / tileWidth));
		const startTileY = Math.max(0, Math.floor(rect.pos.y / tileHeight));
		const endTileX = Math.min(
			cols,
			Math.ceil((rect.pos.x + rect.width) / tileWidth),
		);
		const endTileY = Math.min(
			rows,
			Math.ceil((rect.pos.y + rect.height) / tileHeight),
		);
		if (endTileX <= startTileX || endTileY <= startTileY) {
			return;
		}

		const worldX = startTileX * tileWidth;
		const worldY = startTileY * tileHeight;
		const worldW = (endTileX - startTileX) * tileWidth;
		const worldH = (endTileY - startTileY) * tileHeight;

		// drain pending sprite vertices under their own pipeline, then use
		// the quad batcher's frozen machinery (staging layout, index buffer)
		const batcher = renderer.setBatcher("quad");
		batcher.flush();
		const pass = renderer.ensurePass();
		const device = renderer.device;

		const resource = this.getResource(layer);

		// the transformed quad, shared by every tileset pass (28-byte
		// stride: x,y,z, u,v, packed tint, textureId)
		const corners = transformQuadCorners(
			renderer.currentTransform,
			worldX,
			worldY,
			worldW,
			worldH,
			renderer.currentDepth,
		);
		const f32 = this.vertexF32;
		const u32 = this.vertexU32;
		const uvs = [0, 0, 1, 0, 0, 1, 1, 1];
		for (let i = 0; i < 4; i++) {
			const base = i * 7;
			f32[base] = corners[i].x;
			f32[base + 1] = corners[i].y;
			f32[base + 2] = corners[i].z;
			f32[base + 3] = uvs[i * 2];
			f32[base + 4] = uvs[i * 2 + 1];
			u32[base + 5] = 0xffffffff;
			f32[base + 6] = 0;
		}
		const vertexRegion = renderer.vertexArena.alloc(4 * 28);
		device.queue.writeBuffer(
			vertexRegion.buffer,
			vertexRegion.offset,
			this.vertexScratch,
			0,
			4 * 28,
		);

		// layer-level uniform values (identical for every tileset pass)
		const scratch = this.uniformScratch;
		scratch[0] = cols;
		scratch[1] = rows;
		scratch[2] = tileWidth;
		scratch[3] = tileHeight;
		scratch[18] = startTileX;
		scratch[19] = startTileY;
		scratch[20] = endTileX - startTileX;
		scratch[21] = endTileY - startTileY;
		scratch[22] = layer.getOpacity();
		const tint = layer.tint ? layer.tint.toArray() : null;
		scratch[24] = tint ? tint[0] : 1;
		scratch[25] = tint ? tint[1] : 1;
		scratch[26] = tint ? tint[2] : 1;
		scratch[27] = tint ? tint[3] : 1;

		const pipeline = renderer.pipelineCache.get(
			this.key,
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
		pass.setBindGroup(2, renderer.pipelineCache.emptyBindGroup);
		pass.setVertexBuffer(0, vertexRegion.buffer, vertexRegion.offset, 4 * 28);
		pass.setIndexBuffer(batcher.indexBuffer, "uint32");

		// one pass per tileset — the GID-range guard hides other tilesets
		const tilesets = layer.tilesets.tilesets;
		let layerGroups = this.bindGroups.get(layer);
		if (layerGroups === undefined) {
			layerGroups = new Map();
			this.bindGroups.set(layer, layerGroups);
		}
		for (let i = 0; i < tilesets.length; i++) {
			const tileset = tilesets[i];
			// eligibility should have excluded these — guard defensively
			if (tileset.isCollection || tileset.image === undefined) {
				continue;
			}

			const tsW = tileset.tilewidth;
			const tsH = tileset.tileheight;
			const margin = tileset.margin;
			const spacing = tileset.spacing;
			const atlasW = tileset.image.width;
			const atlasH = tileset.image.height;
			const atlasCols = Math.max(
				1,
				Math.floor((atlasW - margin * 2 + spacing) / (tsW + spacing)),
			);
			const atlasRows = Math.max(
				1,
				Math.floor((atlasH - margin * 2 + spacing) / (tsH + spacing)),
			);

			const animEntry = this.getOrUpdateAnimLookup(
				tileset,
				atlasCols * atlasRows,
			);
			// every declared binding needs a view — reuse the index texture
			// as the filler (never read: uAnimSize stays 0)
			const animView = animEntry ? animEntry.view : resource.view;

			// per-tileset uniform values + snapshot into the arena
			scratch[4] = tsW;
			scratch[5] = tsH;
			scratch[6] = Math.max(0, Math.ceil(tsW / tileWidth) - 1);
			scratch[7] = Math.max(0, Math.ceil(tsH / tileHeight) - 1);
			scratch[8] = atlasCols;
			scratch[9] = atlasRows;
			scratch[10] = 1 / atlasW;
			scratch[11] = 1 / atlasH;
			scratch[12] = margin;
			scratch[13] = margin;
			scratch[14] = spacing;
			scratch[15] = spacing;
			scratch[16] = tileset.firstgid;
			scratch[17] = tileset.lastgid;
			scratch[23] = animEntry ? animEntry.tileCount : 0;
			const region = renderer.effectUniformArena.alloc(
				TMX_UNIFORM_SIZE,
				device.limits?.minUniformBufferOffsetAlignment ?? 256,
			);
			device.queue.writeBuffer(
				region.buffer,
				region.offset,
				scratch.buffer,
				0,
				TMX_UNIFORM_SIZE,
			);

			// group-3 bind group, cached per (layer, tileset) while the
			// arena page and lookup views stay the same
			let cached = layerGroups.get(tileset);
			if (
				cached === undefined ||
				cached.pageLabel !== region.buffer.label ||
				cached.animView !== animView
			) {
				cached = {
					pageLabel: region.buffer.label,
					animView,
					bindGroup: device.createBindGroup({
						label: "melonJS tmx binding",
						layout: this.tmxLayout,
						entries: [
							{
								binding: 0,
								resource: {
									buffer: region.buffer,
									size: TMX_UNIFORM_SIZE,
								},
							},
							{ binding: 1, resource: resource.view },
							{ binding: 2, resource: animView },
						],
					}),
				};
				layerGroups.set(tileset, cached);
			}

			pass.setBindGroup(1, renderer.textureStore.getBinding(tileset.texture));
			pass.setBindGroup(3, cached.bindGroup, [region.offset]);
			pass.drawIndexed(6);
		}
	}
}
