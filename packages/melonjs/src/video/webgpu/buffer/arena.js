/**
 * Per-frame GPU buffer arena — a bump allocator over a persistent list of
 * fixed-size `GPUBuffer` pages.
 *
 * Why an arena: melonJS flushes many times per frame (texture change, blend
 * change, scissor change, …). Under WebGL each flush re-uploads the shared
 * vertex buffer; under WebGPU all draw commands of a frame are recorded
 * first and execute at `queue.submit()` time, so every flush must write its
 * vertices into a region **no later flush overwrites** — `queue.writeBuffer`
 * data lands before the submitted commands run, and two flushes sharing one
 * region would have the second write clobber the first before either draw
 * executes.
 *
 * Why a page *list* rather than one growable buffer: draw commands already
 * recorded against earlier pages must stay valid; replacing a buffer
 * mid-frame would invalidate them. Pages persist across frames; `reset()`
 * just rewinds the bump pointer.
 * @ignore
 * @internal
 */
export default class WebGPUBufferArena {
	/**
	 * @param {GPUDevice} device - the device to allocate pages on
	 * @param {object} [options] - arena options
	 * @param {number} [options.pageSize=1048576] - byte size of each page
	 * @param {number} [options.usage] - GPUBufferUsage flags for the pages
	 * @param {string} [options.label] - debug label prefix for the pages
	 */
	constructor(device, options = {}) {
		this.device = device;
		this.pageSize = options.pageSize ?? 1 << 20;
		this.usage =
			options.usage ?? GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
		this.label = options.label ?? "melonJS arena";
		/** @type {GPUBuffer[]} */
		this.pages = [];
		this.pageIndex = 0;
		this.offset = 0;
	}

	/**
	 * rewind the arena — called once per frame, before any allocation
	 */
	reset() {
		this.pageIndex = 0;
		this.offset = 0;
	}

	/**
	 * Reserve `byteLength` bytes and return where they live. The region is
	 * valid until the next `reset()`.
	 * @param {number} byteLength - bytes to reserve (must fit in one page)
	 * @param {number} [alignment=4] - required offset alignment (a power of
	 *   two; effect uniform snapshots pass the device's
	 *   `minUniformBufferOffsetAlignment` so the region can serve as a
	 *   dynamic bind-group offset)
	 * @returns {{buffer: GPUBuffer, offset: number}} the reserved region
	 */
	alloc(byteLength, alignment = 4) {
		// writeBuffer offsets must be 4-byte aligned (callers may need more)
		const aligned = (byteLength + 3) & ~3;
		this.offset = (this.offset + alignment - 1) & ~(alignment - 1);
		if (aligned > this.pageSize) {
			throw new Error(
				`WebGPUBufferArena: allocation of ${byteLength} bytes exceeds the page size (${this.pageSize})`,
			);
		}
		if (this.offset + aligned > this.pageSize) {
			this.pageIndex++;
			this.offset = 0;
		}
		if (this.pageIndex >= this.pages.length) {
			this.pages.push(
				this.device.createBuffer({
					label: `${this.label} page ${this.pages.length}`,
					size: this.pageSize,
					usage: this.usage,
				}),
			);
		}
		const region = {
			buffer: this.pages[this.pageIndex],
			offset: this.offset,
		};
		this.offset += aligned;
		return region;
	}

	/**
	 * release every page (device loss / renderer destroy)
	 */
	destroy() {
		for (const page of this.pages) {
			page.destroy();
		}
		this.pages.length = 0;
		this.pageIndex = 0;
		this.offset = 0;
	}
}
