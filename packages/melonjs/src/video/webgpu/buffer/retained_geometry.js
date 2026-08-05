// Scratch for padding an odd-count uint16 index upload to the 4-byte
// multiple `queue.writeBuffer` requires. Grows to the largest mesh seen and
// is reused (uploads are version-change-rare and never re-enter).
let indexPadScratch = new Uint16Array(0);

/**
 * The WebGPU twin of the GL `RetainedGeometry`: one mesh's model-space
 * geometry resident on the GPU — a vertex buffer and an index buffer,
 * uploaded on geometry-version change and bound per draw (`setVertexBuffer`
 * / `setIndexBuffer`; there is no VAO to capture, binding is explicit and
 * cheap under this backend).
 *
 * The two queue-ordering laws shape the upload rules:
 * 1. `queue.writeBuffer` executes before EVERY draw recorded this frame —
 *    so a version bump on a mesh that has already drawn this frame
 *    (Sprite3d animation UVs, a second camera) must land in FRESH buffers,
 *    or the earlier draw would retroactively show the new geometry.
 * 2. destroying a buffer referenced by recorded draws fails the whole
 *    submit — replaced buffers retire through `renderer.retireBuffer` and
 *    die after the frame's submit.
 * @ignore
 */
export default class WebGPURetainedGeometry {
	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 */
	constructor(renderer) {
		this.renderer = renderer;
		/** @type {GPUBuffer|null} */
		this.vertexBuffer = null;
		/** @type {GPUBuffer|null} */
		this.indexBuffer = null;
		/** @type {"uint16"|"uint32"} */
		this.indexFormat = "uint16";
		this.indexCount = 0;
		// geometry version the buffers hold; -1 forces the first upload
		this.uploadedVersion = -1;
		// the last frame a draw was recorded against these buffers — the
		// in-place-vs-fresh upload decision (queue law 1)
		this.lastDrawnFrameId = -1;
		// allocated capacities, for the in-place reuse check
		this.vertexCapacity = 0;
		this.indexCapacity = 0;
	}

	/**
	 * Upload (or re-upload) the interleaved vertex data and indices.
	 * @param {Float32Array} vertexData - interleaved data scratch
	 * @param {number} floatCount - number of floats to upload
	 * @param {Uint16Array|Uint32Array} indices - the mesh's authored indices
	 * @param {number} version - the mesh's geometry version being uploaded
	 */
	upload(vertexData, floatCount, indices, version) {
		const renderer = this.renderer;
		const device = renderer.device;
		const vertexBytes = floatCount * Float32Array.BYTES_PER_ELEMENT;
		const wide = indices instanceof Uint32Array;
		// writeBuffer sizes must be 4-byte multiples — pad an odd uint16 run
		const indexBytes = (indices.byteLength + 3) & ~3;

		// in-place re-use is safe only when nothing recorded this frame
		// references the buffers and the new data fits the allocations
		const fresh =
			this.vertexBuffer === null ||
			this.lastDrawnFrameId === renderer.frameId ||
			vertexBytes > this.vertexCapacity ||
			indexBytes > this.indexCapacity;
		if (fresh) {
			this.releaseBuffers();
			this.vertexBuffer = device.createBuffer({
				label: "melonJS retained mesh vertices",
				size: vertexBytes,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});
			this.indexBuffer = device.createBuffer({
				label: "melonJS retained mesh indices",
				size: indexBytes,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			});
			this.vertexCapacity = vertexBytes;
			this.indexCapacity = indexBytes;
			this.lastDrawnFrameId = -1;
		}

		device.queue.writeBuffer(
			this.vertexBuffer,
			0,
			vertexData.buffer,
			vertexData.byteOffset,
			vertexBytes,
		);

		let indexSource = indices;
		if (indexBytes !== indices.byteLength) {
			// odd uint16 count: stage through the padded scratch
			if (indexPadScratch.length < indices.length + 1) {
				indexPadScratch = new Uint16Array(indices.length + 1);
			}
			indexPadScratch.set(indices);
			indexPadScratch[indices.length] = 0;
			indexSource = indexPadScratch;
		}
		device.queue.writeBuffer(
			this.indexBuffer,
			0,
			indexSource.buffer,
			indexSource.byteOffset,
			indexBytes,
		);

		this.indexFormat = wide ? "uint32" : "uint16";
		this.indexCount = indices.length;
		this.uploadedVersion = version;
	}

	/**
	 * retire both buffers (frame-safe) without resetting the version — the
	 * shared tail of re-allocation and destruction
	 * @ignore
	 */
	releaseBuffers() {
		if (this.vertexBuffer !== null) {
			this.renderer.retireBuffer(this.vertexBuffer);
			this.vertexBuffer = null;
		}
		if (this.indexBuffer !== null) {
			this.renderer.retireBuffer(this.indexBuffer);
			this.indexBuffer = null;
		}
		this.vertexCapacity = 0;
		this.indexCapacity = 0;
	}

	/**
	 * Release the GPU buffers. Idempotent — a destroyed geometry object
	 * simply re-uploads if ever used again.
	 */
	destroy() {
		this.releaseBuffers();
		this.uploadedVersion = -1;
		this.indexCount = 0;
		this.lastDrawnFrameId = -1;
	}
}
