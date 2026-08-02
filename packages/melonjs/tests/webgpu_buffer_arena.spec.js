import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUBufferArena from "../src/video/webgpu/buffer/arena.js";

/**
 * Unit tests for the per-frame buffer arena — the region-isolation
 * primitive the whole recording model rests on: every internal flush must
 * land in bytes no later flush overwrites, because `queue.writeBuffer`
 * data executes before ANY draw recorded in the frame.
 */
describe("WebGPUBufferArena", () => {
	let device;
	let created;

	beforeEach(() => {
		created = [];
		device = {
			createBuffer(descriptor) {
				const buffer = {
					label: descriptor.label,
					size: descriptor.size,
					destroyed: false,
					destroy() {
						this.destroyed = true;
					},
				};
				created.push(buffer);
				return buffer;
			},
		};
	});

	it("allocations are 4-byte aligned and monotonic within a page", () => {
		const arena = new WebGPUBufferArena(device, { pageSize: 256 });
		const a = arena.alloc(3);
		const b = arena.alloc(10);
		const c = arena.alloc(4);

		expect(a.offset).toBe(0);
		// 3 rounds up to 4
		expect(b.offset).toBe(4);
		// 10 rounds up to 12
		expect(c.offset).toBe(16);
		expect(a.buffer).toBe(b.buffer);
		expect(created).toHaveLength(1);
	});

	it("regions never overlap: each alloc owns its byte range until reset", () => {
		const arena = new WebGPUBufferArena(device, { pageSize: 64 });
		const regions = [arena.alloc(24), arena.alloc(24), arena.alloc(24)];
		// the third does not fit page 0 (24+24+24 > 64) → new page, offset 0
		expect(regions[0].offset).toBe(0);
		expect(regions[1].offset).toBe(24);
		expect(regions[2].buffer).not.toBe(regions[0].buffer);
		expect(regions[2].offset).toBe(0);
		expect(created).toHaveLength(2);
	});

	it("an allocation larger than the page size throws", () => {
		const arena = new WebGPUBufferArena(device, { pageSize: 64 });
		expect(() => {
			arena.alloc(65);
		}).toThrow(/exceeds the page size/);
	});

	it("reset rewinds the bump pointer but keeps the pages resident", () => {
		const arena = new WebGPUBufferArena(device, { pageSize: 64 });
		arena.alloc(64);
		arena.alloc(64);
		expect(created).toHaveLength(2);

		arena.reset();
		const region = arena.alloc(64);
		// same page objects reused — no new GPU allocation
		expect(region.buffer).toBe(created[0]);
		expect(region.offset).toBe(0);
		expect(created).toHaveLength(2);
	});

	it("destroy releases every page and empties the list", () => {
		const arena = new WebGPUBufferArena(device, { pageSize: 64 });
		arena.alloc(64);
		arena.alloc(64);
		arena.destroy();

		expect(
			created.every((buffer) => {
				return buffer.destroyed;
			}),
		).toBe(true);
		expect(arena.pages).toHaveLength(0);

		// usable again after destroy: pages are re-created lazily
		const region = arena.alloc(16);
		expect(region.offset).toBe(0);
		expect(created).toHaveLength(3);
	});
});
