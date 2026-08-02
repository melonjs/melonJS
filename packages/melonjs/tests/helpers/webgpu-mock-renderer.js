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
		// pipeline-cache lookups (full key) and actual setPipeline count
		pipelineKeys: [],
		setPipeline: 0,
		// group-1 (material) bind groups as recorded by the quad batcher
		materialBinds: [],
		// every setBindGroup: {index, group, dynamicOffsets}
		bindGroups: [],
		pushFrameGlobals: 0,
		captureFrames: 0,
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
		setVertexBuffer() {},
		setIndexBuffer() {},
		draw(count) {
			calls.draws.push(count);
		},
		drawIndexed(count) {
			calls.drawIndexed.push(count);
		},
	};

	const pipelines = new Map();
	const materialBindings = new Map();

	const renderer = {
		calls,
		pass,
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
			},
			createBuffer(descriptor) {
				return {
					size: descriptor.size,
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
				}
				return key;
			},
			getEffectLayout(signature) {
				if (!this.effectLayouts.has(signature)) {
					this.effectLayouts.set(signature, { signature });
				}
				return this.effectLayouts.get(signature);
			},
			frameLayout: {},
			materialLayout: {},
			emptyLayout: {},
			get(shaderKey, topology, blendMode, premultipliedAlpha, stencilMode) {
				const key = `${shaderKey}|${topology}|${blendMode}|${premultipliedAlpha}|${stencilMode}`;
				calls.pipelineKeys.push(key);
				if (!pipelines.has(key)) {
					pipelines.set(key, { key });
				}
				return pipelines.get(key);
			},
		},
		vertexArena: {
			alloc() {
				return { buffer: {}, offset: 0 };
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
		textureStore: {
			// one stable bind-group token per atlas object
			getBinding(texture) {
				if (!materialBindings.has(texture)) {
					materialBindings.set(texture, { texture });
				}
				return materialBindings.get(texture);
			},
			getSampler(filter, repeat) {
				return { filter, repeat };
			},
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
