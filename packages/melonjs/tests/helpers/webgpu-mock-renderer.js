import { Color, Matrix3d } from "../../src/index.js";

/**
 * A mock WebGPU renderer for unit-testing batchers without a GPU device:
 * every GPU-facing surface a batcher touches (queue writes, pipeline
 * lookups, the open pass, the frame-globals slot) records into `calls`
 * so tests can assert the exact work a draw produced.
 */
export function createMockWebGPURenderer() {
	const calls = {
		// one entry per queue.writeBuffer: byte size + decoded views
		writes: [],
		// draw / drawIndexed vertex counts, in recording order
		draws: [],
		drawIndexed: [],
		// the same drawIndexed calls with every argument, for the paths that
		// record a sub-range (per-material texture splits, #1573)
		drawIndexedArgs: [],
		// pipeline-cache lookups (full key) and actual setPipeline count
		pipelineKeys: [],
		setPipeline: 0,
		// group-1 (material) bind groups as recorded by the quad batcher
		materialBinds: [],
		// every setBindGroup: {index, group, dynamicOffsets}
		bindGroups: [],
		pushFrameGlobals: 0,
		captureFrames: 0,
		// one entry per queue.writeTexture
		textureWrites: [],
		// one entry per textureStore.getBinding: {texture, options}
		textureBindings: [],
		// one entry per device.createBuffer: the descriptor
		createdBuffers: [],
		// buffers handed to renderer.retireBuffer, in order
		retiredBuffers: [],
		// pass.setVertexBuffer / setIndexBuffer arguments, in order
		vertexBufferBinds: [],
		indexBufferBinds: [],
	};

	const pass = {
		setPipeline() {
			calls.setPipeline++;
		},
		setBindGroup(index, group, dynamicOffsets) {
			calls.bindGroups.push({ index, group, dynamicOffsets });
			if (index === 1) {
				calls.materialBinds.push(group);
			}
		},
		setVertexBuffer(slot, buffer, offset, size) {
			calls.vertexBufferBinds.push({ slot, buffer, offset, size });
		},
		setIndexBuffer(buffer, format, offset, size) {
			calls.indexBufferBinds.push({ buffer, format, offset, size });
		},
		draw(count) {
			calls.draws.push(count);
		},
		drawIndexed(count, instanceCount, firstIndex) {
			calls.drawIndexed.push(count);
			calls.drawIndexedArgs.push({ count, instanceCount, firstIndex });
		},
	};

	const pipelines = new Map();
	const materialBindings = new Map();

	const renderer = {
		calls,
		pass,
		// frame stamp consumed by the same-frame re-upload rules and the
		// light-binding staleness gate; tests advance it to cross frames
		frameId: 1,
		device: {
			limits: { minUniformBufferOffsetAlignment: 256 },
			queue: {
				writeBuffer(buffer, offset, data, dataOffset, size) {
					// snapshot the bytes like the real queue does (data may be
					// a TypedArray view or a raw ArrayBuffer, per the real
					// overloads)
					const bytes =
						data instanceof ArrayBuffer
							? new Uint8Array(data)
							: new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
					const copy = bytes.slice(dataOffset, dataOffset + size);
					calls.writes.push({
						buffer,
						offset,
						size,
						floats: new Float32Array(copy.buffer, 0, size >> 2),
						view: new DataView(copy.buffer),
					});
				},
				copyExternalImageToTexture() {},
				writeTexture(destination, data, layout, size) {
					calls.textureWrites.push({
						texture: destination.texture,
						bytes: data.length,
						size,
					});
				},
			},
			createBuffer(descriptor) {
				calls.createdBuffers.push(descriptor);
				return {
					size: descriptor.size,
					label: descriptor.label,
					destroy() {},
					getMappedRange() {
						return new ArrayBuffer(descriptor.size);
					},
					unmap() {},
				};
			},
			createBindGroup(descriptor) {
				return { layout: descriptor.layout, entries: descriptor.entries };
			},
			createBindGroupLayout(descriptor) {
				return { label: descriptor.label, entries: descriptor.entries };
			},
			createTexture(descriptor) {
				return {
					size: descriptor.size,
					destroy() {},
					createView() {
						return { texture: this };
					},
				};
			},
		},
		pipelineCache: {
			epoch: 1,
			emptyBindGroup: { empty: true },
			registeredModules: new Map(),
			effectLayouts: new Map(),
			registerVertexLayout() {},
			registerShader(code) {
				let key = this.registeredModules.get(code);
				if (typeof key === "undefined") {
					key = `effect:${this.registeredModules.size}`;
					this.registeredModules.set(code, key);
					this.modules[key] = { code };
				}
				return key;
			},
			modules: {},
			getEffectLayout(signature) {
				if (!this.effectLayouts.has(signature)) {
					this.effectLayouts.set(signature, { signature });
				}
				return this.effectLayouts.get(signature);
			},
			frameLayout: {},
			materialLayout: {},
			multiMaterialLayout: {},
			emptyLayout: {},
			get(
				shaderKey,
				topology,
				blendMode,
				premultipliedAlpha,
				stencilMode,
				meshState,
			) {
				// the mesh-axes suffix appends ONLY when the axis is present —
				// existing 2D key assertions stay byte-identical
				let key = `${shaderKey}|${topology}|${blendMode}|${premultipliedAlpha}|${stencilMode}`;
				if (meshState) {
					key += `|mesh:${meshState.cullMode}:${meshState.frontFace}`;
				}
				calls.pipelineKeys.push(key);
				if (!pipelines.has(key)) {
					pipelines.set(key, { key });
				}
				return pipelines.get(key);
			},
		},
		vertexArena: {
			page: { label: "vertex page 0" },
			alloc() {
				return { buffer: this.page, offset: 0 };
			},
		},
		// per-frame index regions for the accumulated mesh path — bump
		// allocator so consecutive flushes get distinct offsets
		indexArena: {
			offset: 0,
			page: { label: "index page 0" },
			alloc(byteLength) {
				const region = { buffer: this.page, offset: this.offset };
				this.offset += (byteLength + 3) & ~3;
				return region;
			},
			reset() {
				this.offset = 0;
			},
		},
		// bump allocator over labeled fake pages, alignment-honoring — the
		// effect-uniform snapshot path exercises this
		effectUniformArena: {
			offset: 0,
			page: { label: "effect page 0" },
			alloc(byteLength, alignment = 4) {
				this.offset = (this.offset + alignment - 1) & ~(alignment - 1);
				const region = { buffer: this.page, offset: this.offset };
				this.offset += (byteLength + 3) & ~3;
				return region;
			},
			reset() {
				this.offset = 0;
			},
		},
		captureTexture: undefined,
		customShader: undefined,
		captureFrame() {
			calls.captureFrames++;
			this.captureTexture = {
				view: { capture: calls.captureFrames },
				generation: calls.captureFrames,
			};
			return this.captureTexture;
		},
		stubView: { stub: true },
		getStubTextureView() {
			return this.stubView;
		},
		retireTexture() {},
		retireBuffer(buffer) {
			calls.retiredBuffers.push(buffer);
		},
		textureStore: {
			// one stable bind-group token per atlas object
			getBinding(texture, options) {
				calls.textureBindings.push({ texture, options });
				if (!materialBindings.has(texture)) {
					materialBindings.set(texture, { texture });
				}
				return materialBindings.get(texture);
			},
			// one stable record per atlas object (the lit batcher composes
			// combined bind groups from the raw view)
			records: new Map(),
			getResidentRecord(texture) {
				if (!this.records.has(texture)) {
					this.records.set(texture, {
						view: { texture },
						width: 64,
						height: 64,
					});
				}
				return this.records.get(texture);
			},
			samplers: new Map(),
			getSampler(filter, repeat, mipmaps = false) {
				// cached per combo like the real store — composition caches
				// key on sampler identity
				const key = `${filter}|${repeat}|${mipmaps}`;
				if (!this.samplers.has(key)) {
					this.samplers.set(key, { filter, repeat, mipmaps });
				}
				return this.samplers.get(key);
			},
		},
		getDefaultTextureFilter() {
			return "linear";
		},
		ensurePass() {
			return pass;
		},
		currentPipeline: null,
		currentFrameBinding: { bindGroup: {}, dynamicOffset: 0 },
		currentBlendMode: "normal",
		premultipliedAlpha: true,
		stencilMode: "none",
		currentTransform: new Matrix3d(),
		currentDepth: 0,
		currentColor: new Color(255, 255, 255, 1),
		getGlobalAlpha() {
			return 1;
		},
		lineWidth: 1,
		currentFrameLineWidth: 1,
		pushFrameGlobals() {
			calls.pushFrameGlobals++;
			this.currentFrameLineWidth = this.lineWidth;
		},
	};

	return renderer;
}
