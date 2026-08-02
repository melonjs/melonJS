import VertexArrayBuffer from "../../buffer/vertex.js";
import { Batcher, DEFAULT_MAX_VERTICES } from "../../gpu/batcher.js";
import { resolveVertexFormat } from "../../gpu/vertexformat.ts";

/**
 * The base WebGPU Batcher — realizes the backend-neutral {@link Batcher}
 * lifecycle (`init` / `bind` / `unbind` / `flush` / `reset` / `destroy`,
 * driven by `renderer.addBatcher` / `setBatcher`) on a
 * `GPURenderPassEncoder` instead of GL state. Custom WebGPU batchers
 * extend this class.
 *
 * A "flush" here is one `queue.writeBuffer` of the pending vertex bytes
 * into a fresh region of the renderer's per-frame buffer arena, plus one
 * draw recorded into the frame's open pass — nothing is submitted until
 * the frame ends. Attribute layouts are declared in the backend-neutral
 * vocabulary of `src/video/gpu/vertexformat.ts` and consumed declaratively
 * into the pipeline's `GPUVertexBufferLayout` (#1492) — no enum bridge.
 * @augments Batcher
 * @category Rendering
 */
export default class WebGPUBatcher extends Batcher {
	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 * @param {object} [settings] - batcher settings (see {@link WebGPUBatcher#init})
	 */
	constructor(renderer, settings) {
		super();
		this.init(renderer, settings);
	}

	/**
	 * Initialize (or re-initialize after device loss) this batcher.
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 * @param {object} [settings] - batcher settings
	 * @param {object[]} [settings.attributes] - neutral attribute descriptors
	 * @param {string} [settings.shaderKey] - pipeline-cache shader family
	 * @param {string} [settings.topology] - default portable topology
	 * @param {number} [settings.maxVertices] - staging capacity in vertices
	 */
	init(renderer, settings) {
		this.renderer = renderer;
		this.device = renderer.device;

		if (typeof settings !== "undefined") {
			this.shaderKey = settings.shaderKey;
			this.topology = settings.topology ?? "triangle-list";

			// resolve the neutral attribute descriptors: offsets are given,
			// the stride is the end of the last attribute (the layouts are
			// tightly packed, same convention as the WebGL batchers)
			this.attributes = settings.attributes.map((a) => {
				const format = resolveVertexFormat(a.format);
				return {
					name: a.name,
					format: a.format,
					offset: a.offset,
					bytes: format.bytes,
				};
			});
			const last = this.attributes[this.attributes.length - 1];
			this.stride = last.offset + last.bytes;
			this.vertexSize = this.stride / Float32Array.BYTES_PER_ELEMENT;

			this.vertexData = new VertexArrayBuffer(
				this.vertexSize,
				settings.maxVertices ?? DEFAULT_MAX_VERTICES,
			);

			// hand the layout to the pipeline cache — every pipeline of this
			// shader family shares it
			renderer.pipelineCache.registerVertexLayout(
				this.shaderKey,
				this.stride,
				this.attributes,
			);
		} else {
			// re-init after device loss: keep the frozen layout/staging,
			// re-register with the freshly-built pipeline cache. A FIRST
			// init without settings has no layout to re-register — fail
			// with the same message as the WebGL base instead of a
			// confusing TypeError inside the pipeline cache
			if (typeof this.shaderKey === "undefined") {
				throw new Error("attributes definition missing");
			}
			this.vertexData?.clear();
			renderer.pipelineCache.registerVertexLayout(
				this.shaderKey,
				this.stride,
				this.attributes,
			);
		}
	}

	/**
	 * make this batcher the active one — nothing per-batcher persists on
	 * the pass in the 2D tier; this is the seam where the mesh batcher
	 * will later select its depth-enabled pipeline family
	 */
	bind() {}

	/**
	 * called when another batcher takes over
	 */
	unbind() {}

	/**
	 * per-draw refresh hook (pass-scoped state that `bind()` cannot own
	 * because `setBatcher` early-returns when already current)
	 */
	updatePassState() {}

	/**
	 * record the pending vertices as one draw in the frame's open pass
	 * @param {string} [topology] - override the batcher's default topology
	 */
	flush(topology = this.topology) {
		const vertexData = this.vertexData;
		const vertexCount = vertexData.vertexCount;
		if (vertexCount === 0) {
			return;
		}
		const renderer = this.renderer;
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
			this.shaderKey,
			topology,
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
		pass.setVertexBuffer(0, region.buffer, region.offset, byteLength);

		this.recordDraw(pass, vertexCount);

		vertexData.clear();
	}

	/**
	 * record the actual draw call — non-indexed by default; the quad
	 * batcher overrides with its indexed 6-per-quad pattern
	 * @param {GPURenderPassEncoder} pass - the open pass
	 * @param {number} vertexCount - pending vertex count
	 */
	recordDraw(pass, vertexCount) {
		pass.draw(vertexCount);
	}

	/**
	 * drop any pending vertices (game reset)
	 */
	reset() {
		this.vertexData.clear();
	}

	/**
	 * release this batcher's GPU resources
	 */
	destroy() {
		this.vertexData?.clear();
	}
}
