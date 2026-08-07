/**
 * The WebGPU twin of the GL `WebGLInstanceBuffer`: one `InstancedMesh`'s
 * per-instance records resident on the GPU, bound as a second vertex buffer
 * whose layout steps once per instance.
 *
 * The same two queue-ordering laws that shape `WebGPURetainedGeometry`
 * apply, and matter more here because instance records change far more often
 * than geometry does:
 *
 * 1. `queue.writeBuffer` executes before **every** draw recorded this frame.
 *    So editing an instance on a mesh that has already drawn this frame — a
 *    second camera, a mid-frame animation step — must land in a FRESH
 *    buffer, or the earlier draw would retroactively show the new placement.
 * 2. Destroying a buffer referenced by recorded draws fails the whole
 *    submit, so a replaced buffer retires through `renderer.retireBuffer`
 *    and dies after the frame's submit.
 *
 * Within a frame that has not yet drawn, an edit is a partial
 * `writeBuffer` covering only the dirty span — moving one tree in a forest
 * of five thousand writes 48 bytes.
 * @ignore
 */
export default class WebGPUInstanceBuffer {
	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 */
	constructor(renderer) {
		this.renderer = renderer;
		/** @type {GPUBuffer|null} */
		this.buffer = null;
		/** allocated capacity in bytes @type {number} */
		this.capacity = 0;
		/** the frame a draw was last recorded against this buffer @type {number} */
		this.lastDrawnFrameId = -1;
	}

	/**
	 * Push the dirty span of `data` to the GPU, reallocating when the record
	 * set outgrew the allocation or when this buffer has already been drawn
	 * from this frame.
	 * @param {Float32Array} data - the CPU-side instance records
	 * @param {number} firstFloat - first dirty float offset (inclusive)
	 * @param {number} floatCount - number of dirty floats, 0 when clean
	 * @param {number} usedBytes - bytes of `data` actually in use
	 */
	upload(data, firstFloat, floatCount, usedBytes) {
		const renderer = this.renderer;
		const device = renderer.device;
		// writeBuffer offsets and sizes must both be 4-byte multiples; a
		// record is a whole number of floats, so spans are aligned already
		const bytes = Float32Array.BYTES_PER_ELEMENT;
		const drawnThisFrame = this.lastDrawnFrameId === renderer.frameId;
		const outgrew = usedBytes > this.capacity;

		if (this.buffer === null || outgrew || (drawnThisFrame && floatCount > 0)) {
			if (this.buffer !== null) {
				// a draw recorded earlier this frame still references it
				renderer.retireBuffer(this.buffer);
			}
			// allocate to the CPU array's full length so growth up to that
			// capacity stays a partial write. A zero-length buffer is invalid,
			// so never request less than one record's worth.
			this.capacity = Math.max(data.byteLength, usedBytes);
			this.buffer = device.createBuffer({
				label: "melonJS instance records",
				size: Math.max(this.capacity, 4),
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});
			this.lastDrawnFrameId = -1;
			// a fresh buffer starts empty, so the WHOLE record set goes in —
			// writing only the dirty span would leave the rest zeroed, which
			// reads as every other instance collapsed onto the origin
			this.write(0, 0, data.byteLength, data);
			return;
		}

		if (floatCount === 0) {
			return;
		}
		this.write(
			firstFloat * bytes,
			firstFloat * bytes,
			floatCount * bytes,
			data,
		);
	}

	/**
	 * One `queue.writeBuffer`, in BYTES throughout.
	 *
	 * `writeBuffer`'s `dataOffset` and `size` are counted in *elements* when
	 * `data` is a TypedArray and in *bytes* otherwise — an ambiguity that
	 * silently changes meaning if the staging array's type ever changes. The
	 * engine's other GPU uploads all pass a `Uint8Array` view with byte
	 * counts, so this does too: one convention, no element/byte confusion.
	 * @param {number} bufferOffset - destination byte offset
	 * @param {number} byteOffset - source byte offset into `data`
	 * @param {number} byteLength - bytes to copy
	 * @param {Float32Array} data - the CPU-side instance records
	 * @ignore
	 */
	write(bufferOffset, byteOffset, byteLength, data) {
		this.renderer.device.queue.writeBuffer(
			this.buffer,
			bufferOffset,
			new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
			byteOffset,
			byteLength,
		);
	}

	/**
	 * Release the GPU buffer (retired when a frame is recording).
	 */
	destroy() {
		if (this.buffer !== null) {
			this.renderer.retireBuffer(this.buffer);
			this.buffer = null;
		}
		this.capacity = 0;
		this.lastDrawnFrameId = -1;
	}
}
