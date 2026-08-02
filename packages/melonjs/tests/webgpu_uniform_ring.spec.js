import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Matrix3d } from "../src/index.js";
import WebGPUUniformRing from "../src/video/webgpu/buffer/uniformring.js";
import {
	CLEAR_UNIFORM_SIZE,
	FRAME_UNIFORM_SIZE,
} from "../src/video/webgpu/pipeline/bindgroups.js";

/**
 * Unit tests for the dynamic-offset uniform ring: slot math, page-cached
 * bind groups, and the exact byte layout of the frame-globals slot
 * (projection matrix at float 0..15, lineWidth at float 16 — what the
 * WGSL frame uniform block expects).
 */
describe("WebGPUUniformRing", () => {
	let device;
	let writes;
	let buffersCreated;
	let bindGroupsCreated;

	function makeRing(alignment = 256) {
		device.limits = { minUniformBufferOffsetAlignment: alignment };
		return new WebGPUUniformRing(device, { frame: true }, { clear: true });
	}

	beforeEach(() => {
		writes = [];
		buffersCreated = 0;
		bindGroupsCreated = [];
		device = {
			createBuffer(descriptor) {
				buffersCreated++;
				return {
					size: descriptor.size,
					destroyed: false,
					destroy() {
						this.destroyed = true;
					},
				};
			},
			createBindGroup(descriptor) {
				const group = { layout: descriptor.layout };
				bindGroupsCreated.push(group);
				return group;
			},
			queue: {
				writeBuffer(buffer, offset, data, dataOffset, size) {
					// snapshot the bytes like the real queue does
					writes.push({
						buffer,
						offset,
						size,
						floats: Array.from(
							new Float32Array(data.slice(dataOffset, dataOffset + size)),
						),
					});
				},
			},
		};
	});

	it("slot size honors the device alignment floor of 256", () => {
		expect(makeRing(256).slotSize).toBe(256);
		expect(makeRing(512).slotSize).toBe(512);
	});

	it("pushFrameGlobals writes projection + lineWidth at the slot offset", () => {
		const ring = makeRing();
		const projection = new Matrix3d().translate(3, 5, 7);

		const first = ring.pushFrameGlobals(projection, 4);
		const second = ring.pushFrameGlobals(projection, 1);

		expect(first.dynamicOffset).toBe(0);
		expect(second.dynamicOffset).toBe(256);
		// both slots share the page's cached bind group
		expect(second.bindGroup).toBe(first.bindGroup);

		expect(writes[0].size).toBe(FRAME_UNIFORM_SIZE);
		expect(writes[0].floats.slice(0, 16)).toEqual(Array.from(projection.val));
		// f32 lineWidth sits right after the mat4x4
		expect(writes[0].floats[16]).toBe(4);
		expect(writes[1].floats[16]).toBe(1);
	});

	it("pushClearColor writes a vec4 through the clear layout's bind group", () => {
		const ring = makeRing();
		const frame = ring.pushFrameGlobals(new Matrix3d(), 1);
		const clear = ring.pushClearColor(0.1, 0.2, 0.3, 1);

		expect(clear.bindGroup).not.toBe(frame.bindGroup);
		expect(clear.dynamicOffset).toBe(256);
		expect(writes[1].size).toBe(CLEAR_UNIFORM_SIZE);
		expect(writes[1].floats.slice(0, 4)).toEqual([
			expect.closeTo(0.1),
			expect.closeTo(0.2),
			expect.closeTo(0.3),
			1,
		]);
	});

	it("the 65th slot rolls to a second page with fresh bind groups", () => {
		const ring = makeRing();
		const projection = new Matrix3d();

		let last;
		for (let i = 0; i < 65; i++) {
			last = ring.pushFrameGlobals(projection, 1);
		}

		// page 1, slot 0
		expect(last.dynamicOffset).toBe(0);
		expect(buffersCreated).toBe(2);
		// each page carries one frame + one clear bind group
		expect(bindGroupsCreated).toHaveLength(4);
		expect(last.bindGroup).toBe(bindGroupsCreated[2]);
	});

	it("reset rewinds to slot 0 and reuses the resident pages", () => {
		const ring = makeRing();
		ring.pushFrameGlobals(new Matrix3d(), 1);
		ring.reset();

		const slot = ring.pushFrameGlobals(new Matrix3d(), 1);
		expect(slot.dynamicOffset).toBe(0);
		expect(buffersCreated).toBe(1);
	});

	it("destroy releases the pages and rewinds", () => {
		const ring = makeRing();
		ring.pushFrameGlobals(new Matrix3d(), 1);
		const page = ring.pages[0];
		ring.destroy();

		expect(page.buffer.destroyed).toBe(true);
		expect(ring.pages).toHaveLength(0);
		expect(ring.slot).toBe(0);
	});
});
