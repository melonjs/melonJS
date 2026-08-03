import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import { WebGPURenderer } from "../src/index.js";
import WebGPUFrameTexture from "../src/video/webgpu/texture/frametexture.js";

/**
 * The WebGPU toFrameTexture contract — target resolution (shared slot /
 * caller-owned / refresh-in-place), region clamping with the bottom-left
 * → top-left origin conversion, in-place realloc semantics, and the
 * encoder-ordered copy — pinned through the real prototype over a
 * recording stub, mirroring what toframetexture.spec.js pins for WebGL.
 */
function createStub({ width = 800, height = 600 } = {}) {
	const copies = [];
	const retired = [];
	const stub = {
		copies,
		retired,
		preferredFormat: "bgra8unorm",
		device: {
			createTexture(descriptor) {
				return {
					descriptor,
					destroy() {},
					createView() {
						return { texture: this };
					},
				};
			},
			createCommandEncoder() {
				return {
					copyTextureToTexture(src, dst, size) {
						copies.push({ src, dst, size });
					},
				};
			},
		},
		commandEncoder: null,
		renderPass: {
			end() {},
		},
		currentBatcher: { flush() {} },
		currentRenderTarget: null,
		frameTexture: { label: "canvas texture" },
		context: {
			getCurrentTexture() {
				return { label: "canvas texture" };
			},
		},
		captureTexture: undefined,
		getTargetSize() {
			return [width, height];
		},
		retireTexture(texture) {
			retired.push(texture);
		},
	};
	return stub;
}

const toFrameTexture = WebGPURenderer.prototype.toFrameTexture;

describe("WebGPURenderer.toFrameTexture (contract)", () => {
	it("returns a GPU-resident capture sized to the frame", () => {
		const stub = createStub();
		const frame = toFrameTexture.call(stub);
		expect(frame).toBeInstanceOf(WebGPUFrameTexture);
		expect(frame.isGPUResident).toBe(true);
		expect(frame.width).toBe(800);
		expect(frame.height).toBe(600);
		expect(stub.copies).toHaveLength(1);
		expect(stub.copies[0].size).toEqual([800, 600]);
		expect(stub.copies[0].src.origin).toEqual([0, 0]);
	});

	it("parameterless calls reuse the shared slot in place (same object, same generation)", () => {
		const stub = createStub();
		const first = toFrameTexture.call(stub);
		const again = toFrameTexture.call(stub);
		expect(again).toBe(first);
		expect(again.generation).toBe(first.generation);
		expect(stub.retired).toHaveLength(0);
		expect(stub.copies).toHaveLength(2);
	});

	it("target: null mints an independent caller-owned capture", () => {
		const stub = createStub();
		const shared = toFrameTexture.call(stub);
		const owned = toFrameTexture.call(stub, { target: null });
		expect(owned).not.toBe(shared);
		expect(stub.captureTexture).toBe(shared);
	});

	it("a prior capture as target refreshes it in place", () => {
		const stub = createStub();
		const owned = toFrameTexture.call(stub, { target: null });
		const refreshed = toFrameTexture.call(stub, { target: owned });
		expect(refreshed).toBe(owned);
		expect(stub.captureTexture).toBeUndefined();
	});

	it("refreshing a destroyed caller-owned capture reallocates its backing", () => {
		const stub = createStub();
		const owned = toFrameTexture.call(stub, { target: null });
		const oldGeneration = owned.generation;
		owned.destroy();
		expect(owned.gpuTexture).toBeNull();

		// a released backing must realloc (same object identity, advanced
		// generation) — copying into a destroyed texture would reject the
		// whole frame at submit
		const refreshed = toFrameTexture.call(stub, { target: owned });
		expect(refreshed).toBe(owned);
		expect(refreshed.gpuTexture).not.toBeNull();
		expect(refreshed.view).not.toBeNull();
		expect(refreshed.generation).toBeGreaterThan(oldGeneration);
		// destroy() retired the old backing; the realloc had nothing to retire
		expect(stub.retired).toHaveLength(1);
		expect(stub.copies[1].dst.texture).toBe(refreshed.gpuTexture);
	});

	it("a size change reallocates in place: same object, advanced generation, old texture retired", () => {
		const stub = createStub();
		const frame = toFrameTexture.call(stub);
		const oldTexture = frame.gpuTexture;
		const oldGeneration = frame.generation;

		stub.getTargetSize = () => {
			return [400, 300];
		};
		const resized = toFrameTexture.call(stub);
		expect(resized).toBe(frame);
		expect(resized.width).toBe(400);
		expect(resized.generation).toBeGreaterThan(oldGeneration);
		expect(stub.retired).toEqual([oldTexture]);
	});

	it("rejects a non-capture target and a foreign renderer's capture", () => {
		const stub = createStub();
		expect(() => {
			return toFrameTexture.call(stub, { target: { isGPUResident: true } });
		}).toThrow(/must be a capture/);

		const other = createStub();
		const foreign = toFrameTexture.call(other);
		expect(() => {
			return toFrameTexture.call(stub, { target: foreign });
		}).toThrow(/different renderer/);
	});

	it("clamps out-of-range regions and converts the bottom-left origin to top-left", () => {
		const stub = createStub();
		// bottom-left region (10, 20, 100x50) in a 600-tall frame → the
		// copy's top-left origin y = 600 - 20 - 50 = 530
		toFrameTexture.call(stub, {
			target: null,
			region: { x: 10, y: 20, width: 100, height: 50 },
		});
		expect(stub.copies[0].src.origin).toEqual([10, 530]);
		expect(stub.copies[0].size).toEqual([100, 50]);

		// origin clamped into the frame first, size clamped to what remains
		toFrameTexture.call(stub, {
			target: null,
			region: { x: 10000, y: -50, width: 10000, height: 10000 },
		});
		const clamped = stub.copies[1];
		expect(clamped.src.origin[0]).toBe(799);
		expect(clamped.size[0]).toBe(1);
		expect(clamped.size[1]).toBe(600);

		// missing width/height = the rest of the frame from x/y
		toFrameTexture.call(stub, {
			target: null,
			region: { x: 100, y: 100 },
		});
		expect(stub.copies[2].size).toEqual([700, 500]);
	});

	it("captures the active render target when one is set", () => {
		const stub = createStub();
		stub.currentRenderTarget = { texture: { label: "offscreen" } };
		toFrameTexture.call(stub);
		expect(stub.copies[0].src.texture.label).toBe("offscreen");
	});

	it("captureFrame delegates to the shared-slot capture", () => {
		const stub = createStub();
		stub.toFrameTexture = toFrameTexture;
		const frame = WebGPURenderer.prototype.captureFrame.call(stub);
		expect(frame).toBeInstanceOf(WebGPUFrameTexture);
		expect(stub.captureTexture).toBe(frame);
	});

	it("returns null without a device", () => {
		const stub = createStub();
		stub.device = undefined;
		expect(toFrameTexture.call(stub)).toBeNull();
	});
});
