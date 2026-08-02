import {
	CLEAR_UNIFORM_SIZE,
	FRAME_UNIFORM_SIZE,
} from "../pipeline/bindgroups.js";

/**
 * Per-frame uniform ring — slot-granular bump allocation over persistent
 * uniform-buffer pages, with one cached dynamic-offset bind group per page
 * and per layout.
 *
 * This is the WebGPU realization of the "frame globals in one uniform
 * buffer, bound once" shape (#1555): projection and line width live in
 * group 0, and a *new slot* is pushed whenever either changes mid-frame
 * (floating containers swap the projection around their children), so every
 * recorded draw keeps the dynamic offset that was current when its vertices
 * were queued. The mid-frame `clearColor` pipeline shares the same pages
 * through its own layout/bind-group pair.
 * @ignore
 */
export default class WebGPUUniformRing {
	/**
	 * @param {GPUDevice} device - the device to allocate on
	 * @param {GPUBindGroupLayout} frameLayout - group-0 layout of the draw pipelines
	 * @param {GPUBindGroupLayout} clearLayout - group-0 layout of the clear pipeline
	 */
	constructor(device, frameLayout, clearLayout) {
		this.device = device;
		this.frameLayout = frameLayout;
		this.clearLayout = clearLayout;
		this.slotSize = Math.max(
			256,
			device.limits.minUniformBufferOffsetAlignment,
		);
		this.slotsPerPage = 64;
		this.pageSize = this.slotSize * this.slotsPerPage;
		/** @type {{buffer: GPUBuffer, frameGroup: GPUBindGroup, clearGroup: GPUBindGroup}[]} */
		this.pages = [];
		this.slot = 0;
		// scratch for uniform writes (80 bytes covers both layouts)
		this.scratch = new Float32Array(FRAME_UNIFORM_SIZE / 4);
	}

	/**
	 * rewind the ring — called once per frame
	 */
	reset() {
		this.slot = 0;
	}

	/** @ignore */
	#allocSlot() {
		const pageIndex = (this.slot / this.slotsPerPage) | 0;
		if (pageIndex >= this.pages.length) {
			const buffer = this.device.createBuffer({
				label: `melonJS uniform ring page ${this.pages.length}`,
				size: this.pageSize,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});
			this.pages.push({
				buffer,
				frameGroup: this.device.createBindGroup({
					label: "melonJS frame globals",
					layout: this.frameLayout,
					entries: [
						{
							binding: 0,
							resource: { buffer, size: FRAME_UNIFORM_SIZE },
						},
					],
				}),
				clearGroup: this.device.createBindGroup({
					label: "melonJS clear color",
					layout: this.clearLayout,
					entries: [
						{
							binding: 0,
							resource: { buffer, size: CLEAR_UNIFORM_SIZE },
						},
					],
				}),
			});
		}
		const page = this.pages[pageIndex];
		const dynamicOffset = (this.slot % this.slotsPerPage) * this.slotSize;
		this.slot++;
		return { page, dynamicOffset };
	}

	/**
	 * Write a frame-globals slot (projection matrix + line width).
	 * @param {import("../../math/matrix3d.ts").Matrix3d} projection - the projection matrix
	 * @param {number} lineWidth - current stroke line width
	 * @returns {{bindGroup: GPUBindGroup, dynamicOffset: number}} the binding for subsequent draws
	 */
	pushFrameGlobals(projection, lineWidth) {
		const { page, dynamicOffset } = this.#allocSlot();
		const scratch = this.scratch;
		scratch.set(projection.val, 0);
		scratch[16] = lineWidth;
		this.device.queue.writeBuffer(
			page.buffer,
			dynamicOffset,
			scratch.buffer,
			0,
			FRAME_UNIFORM_SIZE,
		);
		return { bindGroup: page.frameGroup, dynamicOffset };
	}

	/**
	 * Write a clear-color slot.
	 * @param {number} r - red (0..1)
	 * @param {number} g - green (0..1)
	 * @param {number} b - blue (0..1)
	 * @param {number} a - alpha (0..1)
	 * @returns {{bindGroup: GPUBindGroup, dynamicOffset: number}} the binding for the clear draw
	 */
	pushClearColor(r, g, b, a) {
		const { page, dynamicOffset } = this.#allocSlot();
		const scratch = this.scratch;
		scratch[0] = r;
		scratch[1] = g;
		scratch[2] = b;
		scratch[3] = a;
		this.device.queue.writeBuffer(
			page.buffer,
			dynamicOffset,
			scratch.buffer,
			0,
			CLEAR_UNIFORM_SIZE,
		);
		return { bindGroup: page.clearGroup, dynamicOffset };
	}

	/**
	 * release every page (device loss / renderer destroy)
	 */
	destroy() {
		for (const page of this.pages) {
			page.buffer.destroy();
		}
		this.pages.length = 0;
		this.slot = 0;
	}
}
