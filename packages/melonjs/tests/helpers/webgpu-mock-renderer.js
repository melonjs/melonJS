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
		pushFrameGlobals: 0,
	};

	const pass = {
		setPipeline() {
			calls.setPipeline++;
		},
		setBindGroup(index, group) {
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
			queue: {
				writeBuffer(buffer, offset, data, dataOffset, size) {
					// snapshot the bytes like the real queue does
					const copy = data.slice(dataOffset, dataOffset + size);
					calls.writes.push({
						offset,
						size,
						floats: new Float32Array(copy.buffer, 0, size >> 2),
						view: new DataView(copy.buffer),
					});
				},
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
		},
		pipelineCache: {
			registerVertexLayout() {},
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
		textureStore: {
			// one stable bind-group token per atlas object
			getBinding(texture) {
				if (!materialBindings.has(texture)) {
					materialBindings.set(texture, { texture });
				}
				return materialBindings.get(texture);
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
