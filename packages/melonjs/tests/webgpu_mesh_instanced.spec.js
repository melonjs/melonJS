import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import { instanceRecordLayout } from "../src/video/gpu/instancerecord.ts";
import WebGPUInstanceBuffer from "../src/video/webgpu/buffer/instance_buffer.js";
import WebGPUPipelineCache from "../src/video/webgpu/pipeline/cache.js";
import meshWGSL from "../src/video/webgpu/shaders/mesh.wgsl";
import {
	buildInstancedMeshWGSL,
	LIT_INSTANCED,
	UNLIT_INSTANCED,
} from "../src/video/webgpu/shaders/mesh-instanced.js";
import meshLitWGSL from "../src/video/webgpu/shaders/mesh-lit.wgsl";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * WebGPU mesh instancing (#1508).
 *
 * The WebGPU half differs from the WebGL one in a way worth pinning: WGSL
 * has **no preprocessor**, and a module carries both entry points in one
 * file — so the instanced variant is a module *derived* from the ordinary
 * source rather than the same text compiled with different defines. These
 * tests hold that derivation honest, because a divergence between the two
 * would be invisible: the instanced mesh would simply shade differently
 * from its uninstanced twin, with nothing failing.
 */
describe("the derived instanced WGSL module", () => {
	const variantsOf = (source, variant) => {
		return [
			[false, false],
			[true, false],
			[false, true],
			[true, true],
		].map(([hasColor, hasData]) => {
			return {
				hasColor,
				hasData,
				text: buildInstancedMeshWGSL(source, {
					...variant,
					hasColor,
					hasData,
				}),
			};
		});
	};

	it("keeps the ordinary module's head and fragment stage verbatim", () => {
		// the whole reason for deriving rather than copying: the lit tier's
		// lighting loop and its std140 Light3dBlock — which must agree byte
		// for byte with the uniform packer — exist in exactly ONE place
		const bare = buildInstancedMeshWGSL(meshLitWGSL, {
			...LIT_INSTANCED,
			hasColor: false,
			hasData: false,
		});
		const fragment = meshLitWGSL.slice(meshLitWGSL.indexOf("@fragment"));
		expect(bare).toContain(fragment);
		// and the bindings/structs ahead of the vertex stage came across too
		expect(bare).toContain("struct Light3dData");
		expect(bare).toContain("uLights");
	});

	it("replaces ONLY the vertex stage", () => {
		const bare = buildInstancedMeshWGSL(meshWGSL, {
			...UNLIT_INSTANCED,
			hasColor: false,
			hasData: false,
		});
		// exactly one of each entry point survives
		expect(bare.match(/@vertex/g)).toHaveLength(1);
		expect(bare.match(/@fragment/g)).toHaveLength(1);
		expect(bare).toContain("fn vertex_main(");
		expect(bare).toContain("fn fragment_main(");
		// the ordinary placement line is gone, the instanced one is there
		expect(bare).toContain("uMesh.model * instance");
		expect(bare).toContain("let instance = mat4x4f(");
	});

	it("declares the instance rows at PINNED locations, per tier", () => {
		// pinned rather than sequential so a variant that omits the colour
		// slot does not renumber the data slot — which is what lets one
		// derivation serve every variant without renumbering the module
		for (const { text } of variantsOf(meshWGSL, UNLIT_INSTANCED)) {
			expect(text).toContain("@location(3) aInstanceRow0");
			expect(text).toContain("@location(4) aInstanceRow1");
			expect(text).toContain("@location(5) aInstanceRow2");
		}
		for (const { text } of variantsOf(meshLitWGSL, LIT_INSTANCED)) {
			// the lit tier's geometry runs to location 3 (the normal)
			expect(text).toContain("@location(4) aInstanceRow0");
			expect(text).toContain("@location(6) aInstanceRow2");
		}
	});

	it("declares an optional slot only when it is present, at a fixed location", () => {
		for (const { hasColor, hasData, text } of variantsOf(
			meshWGSL,
			UNLIT_INSTANCED,
		)) {
			const label = `colors=${hasColor} data=${hasData}`;
			expect(text.includes("aInstanceColor"), label).toBe(hasColor);
			expect(text.includes("aInstanceData"), label).toBe(hasData);
			if (hasColor) {
				expect(text, label).toContain("@location(6) aInstanceColor");
			}
			if (hasData) {
				// location 7 whether or not the colour slot is there
				expect(text, label).toContain("@location(7) aInstanceData");
			}
		}
	});

	it("folds the custom slot into the emissive term, and only then", () => {
		const [bare, , , withData] = variantsOf(meshLitWGSL, LIT_INSTANCED);
		expect(bare.text).toContain("uMesh.emissive.rgb");
		expect(bare.text).not.toContain("vInstanceData");
		// with the slot declared, the fragment adds it to the emissive it
		// already applies — the lighting maths itself is untouched
		expect(withData.text).toContain(
			"(uMesh.emissive.rgb + in.vInstanceData.rgb)",
		);
		expect(withData.text).toContain("vInstanceData : vec4f,");
		expect(withData.text).toContain("out.vInstanceData = aInstanceData;");
	});

	it("multiplies the instance colour into the tint, and only when declared", () => {
		const [bare, withColor] = variantsOf(meshWGSL, UNLIT_INSTANCED);
		expect(bare.text).toContain("let tinted = aColor * uMesh.tint;");
		expect(withColor.text).toContain(
			"let tinted = aColor * uMesh.tint * aInstanceColor;",
		);
	});

	it("composes the normal through both transforms on the lit tier", () => {
		const bare = buildInstancedMeshWGSL(meshLitWGSL, {
			...LIT_INSTANCED,
			hasColor: false,
			hasData: false,
		});
		// group × instance, the same order the position takes them
		expect(bare).toContain(
			"out.vNormal = mat3x3f(m[0].xyz, m[1].xyz, m[2].xyz) * mi * aNormal;",
		);
	});

	it("fails loudly if the fragment stage stops carrying the emissive term", () => {
		// the drift guard. If someone renames or restructures the emissive
		// term in mesh-lit.wgsl, the substitution would silently no-op and
		// per-instance emissive would just stop working — so it throws.
		const drifted = meshLitWGSL.replace(
			/uMesh\.emissive\.rgb/g,
			"uMesh.selfLit.rgb",
		);
		expect(() => {
			buildInstancedMeshWGSL(drifted, {
				...LIT_INSTANCED,
				hasColor: false,
				hasData: true,
			});
		}).toThrow(/emissive/);
	});

	it("rejects a source that is not a two-stage module", () => {
		expect(() => {
			buildInstancedMeshWGSL("fn helper() {}", {
				...UNLIT_INSTANCED,
				hasColor: false,
				hasData: false,
			});
		}).toThrow(/both stages/);
	});
});

describe("WebGPUInstanceBuffer (mock renderer)", () => {
	// 3 instances of a bare 48-byte record
	const RECORDS = 3;
	const FLOATS = 12;
	const STRIDE = 48;

	const makeData = () => {
		return new Float32Array(RECORDS * FLOATS).fill(1);
	};

	it("allocates on first use and writes the whole record set", () => {
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);

		expect(renderer.calls.createdBuffers).toHaveLength(1);
		const descriptor = renderer.calls.createdBuffers[0];
		expect(descriptor.size).toBeGreaterThanOrEqual(RECORDS * STRIDE);
		// VERTEX so it can be a second vertex buffer, COPY_DST so records
		// can be written into it — nothing else
		expect(descriptor.usage).toBe(
			GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		);
		expect(renderer.calls.writes).toHaveLength(1);
		expect(renderer.calls.writes[0].offset).toBe(0);
	});

	it("a clean buffer uploads nothing at all", () => {
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		renderer.calls.writes.length = 0;

		buffer.upload(data, 0, 0, RECORDS * STRIDE);
		expect(renderer.calls.writes).toHaveLength(0);
		expect(renderer.calls.createdBuffers).toHaveLength(1);
	});

	it("a dirty span writes ONLY that span, in place", () => {
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		renderer.calls.writes.length = 0;

		// instance 1 only
		buffer.upload(data, FLOATS, FLOATS, RECORDS * STRIDE);
		expect(renderer.calls.createdBuffers).toHaveLength(1); // no realloc
		expect(renderer.calls.writes).toHaveLength(1);
		expect(renderer.calls.writes[0].offset).toBe(STRIDE);
		expect(renderer.calls.writes[0].size).toBe(STRIDE);
	});

	it("reallocates and retires when the record set outgrows the allocation", () => {
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const small = makeData();
		buffer.upload(small, 0, small.length, RECORDS * STRIDE);
		const first = buffer.buffer;

		const large = new Float32Array(64 * FLOATS).fill(2);
		buffer.upload(large, 0, large.length, 64 * STRIDE);
		expect(renderer.calls.createdBuffers).toHaveLength(2);
		// the old buffer retires rather than being destroyed outright: a draw
		// recorded earlier this frame may still reference it, and destroying
		// such a buffer fails the whole submit
		expect(renderer.calls.retiredBuffers).toContain(first);
		expect(buffer.buffer).not.toBe(first);
	});

	it("an edit AFTER a draw this frame goes to a FRESH buffer (queue-ordering law)", () => {
		// The WebGPU-specific hazard with no GL equivalent.
		// `queue.writeBuffer` executes before EVERY draw recorded this frame,
		// so writing in place here would retroactively move the instances the
		// already-recorded draw is about to render.
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		const first = buffer.buffer;

		// a draw was recorded against it this frame
		buffer.lastDrawnFrameId = renderer.frameId;
		renderer.calls.writes.length = 0;

		buffer.upload(data, FLOATS, FLOATS, RECORDS * STRIDE);
		expect(buffer.buffer).not.toBe(first);
		expect(renderer.calls.retiredBuffers).toContain(first);
		// the fresh buffer gets the FULL record set, not just the dirty span —
		// it starts empty, so a partial write would leave the rest as zeros
		expect(renderer.calls.writes).toHaveLength(1);
		expect(renderer.calls.writes[0].offset).toBe(0);
		expect(renderer.calls.writes[0].size).toBe(data.byteLength);
		// and the stamp is cleared, so the next edit this frame writes in place
		expect(buffer.lastDrawnFrameId).toBe(-1);
	});

	it("an edit in a LATER frame writes in place — the guard is per frame, not sticky", () => {
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		buffer.lastDrawnFrameId = renderer.frameId;

		// next frame: the earlier draw has been submitted, so in-place is safe
		renderer.frameId += 1;
		renderer.calls.writes.length = 0;
		const before = buffer.buffer;
		buffer.upload(data, FLOATS, FLOATS, RECORDS * STRIDE);

		expect(buffer.buffer).toBe(before);
		expect(renderer.calls.createdBuffers).toHaveLength(1);
		expect(renderer.calls.writes[0].offset).toBe(STRIDE);
	});

	it("a clean pass after a draw does NOT reallocate", () => {
		// nothing changed, so there is nothing that could apply retroactively
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		buffer.lastDrawnFrameId = renderer.frameId;

		buffer.upload(data, 0, 0, RECORDS * STRIDE);
		expect(renderer.calls.createdBuffers).toHaveLength(1);
		expect(renderer.calls.retiredBuffers).toHaveLength(0);
	});

	it("every write is 4-byte aligned in offset AND size, for any span", () => {
		// writeBuffer rejects an unaligned offset or size outright. Records
		// are whole floats so this holds by construction — pinned because a
		// future packed slot (unorm8x4, say) could break it silently for
		// spans that happen not to be exercised by the other tests.
		for (const [hasColor, hasData] of [
			[false, false],
			[true, false],
			[false, true],
			[true, true],
		]) {
			const layout = instanceRecordLayout(hasColor, hasData);
			const renderer = createMockWebGPURenderer();
			const buffer = new WebGPUInstanceBuffer(renderer);
			const count = 5;
			const data = new Float32Array(count * layout.floats);
			buffer.upload(data, 0, data.length, count * layout.stride);
			renderer.calls.writes.length = 0;

			for (let first = 0; first < count; first++) {
				for (let span = 1; span + first <= count; span++) {
					buffer.upload(
						data,
						first * layout.floats,
						span * layout.floats,
						count * layout.stride,
					);
				}
			}
			for (const write of renderer.calls.writes) {
				const label = `colors=${hasColor} data=${hasData}`;
				expect(write.offset % 4, label).toBe(0);
				expect(write.size % 4, label).toBe(0);
			}
		}
	});

	it("a span reaching the LAST record stays inside the allocation", () => {
		// an off-by-one here writes past the end and the whole submit fails
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		renderer.calls.writes.length = 0;

		buffer.upload(data, (RECORDS - 1) * FLOATS, FLOATS, RECORDS * STRIDE);
		const write = renderer.calls.writes[0];
		expect(write.offset).toBe((RECORDS - 1) * STRIDE);
		expect(write.offset + write.size).toBe(RECORDS * STRIDE);
		expect(write.offset + write.size).toBeLessThanOrEqual(buffer.capacity);
	});

	it("exactly filling the allocation does NOT reallocate; one byte more does", () => {
		// the boundary condition of the `usedBytes > capacity` test
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		const capacity = buffer.capacity;
		const first = buffer.buffer;

		// exactly at capacity — reuse
		buffer.upload(data, 0, FLOATS, capacity);
		expect(buffer.buffer).toBe(first);
		expect(renderer.calls.createdBuffers).toHaveLength(1);

		// one byte over — reallocate
		buffer.upload(data, 0, FLOATS, capacity + 1);
		expect(buffer.buffer).not.toBe(first);
		expect(renderer.calls.createdBuffers).toHaveLength(2);
	});

	it("an empty record set never requests a zero-sized buffer", () => {
		// createBuffer({size: 0}) is a validation error
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		buffer.upload(new Float32Array(0), 0, 0, 0);
		expect(renderer.calls.createdBuffers[0].size).toBeGreaterThan(0);
	});

	it("a growth that ALSO happens after a draw reallocates exactly once", () => {
		// both realloc reasons at the same time must not retire twice or
		// leave a buffer unretired
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const small = makeData();
		buffer.upload(small, 0, small.length, RECORDS * STRIDE);
		const first = buffer.buffer;
		buffer.lastDrawnFrameId = renderer.frameId;

		const large = new Float32Array(32 * FLOATS);
		buffer.upload(large, 0, large.length, 32 * STRIDE);
		expect(renderer.calls.createdBuffers).toHaveLength(2);
		expect(renderer.calls.retiredBuffers).toEqual([first]);
	});

	it("carries the right BYTES, not just the right byte counts", () => {
		// the element-vs-byte trap: writeBuffer counts dataOffset/size in
		// ELEMENTS for a TypedArray and BYTES otherwise, so a mismatched
		// convention still produces plausible-looking calls while copying a
		// quarter of the data. Check the payload, not the arithmetic.
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		for (let i = 0; i < data.length; i++) {
			data[i] = i;
		}
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		expect(Array.from(renderer.calls.writes[0].floats)).toEqual(
			Array.from(data),
		);

		renderer.calls.writes.length = 0;
		// record 1 only: floats 12..23
		buffer.upload(data, FLOATS, FLOATS, RECORDS * STRIDE);
		expect(Array.from(renderer.calls.writes[0].floats)).toEqual(
			Array.from(data.subarray(FLOATS, 2 * FLOATS)),
		);
	});

	it("destroy retires the buffer and is safe twice", () => {
		const renderer = createMockWebGPURenderer();
		const buffer = new WebGPUInstanceBuffer(renderer);
		const data = makeData();
		buffer.upload(data, 0, data.length, RECORDS * STRIDE);
		const gpu = buffer.buffer;

		buffer.destroy();
		expect(renderer.calls.retiredBuffers).toContain(gpu);
		expect(buffer.buffer).toBe(null);
		expect(() => {
			buffer.destroy();
		}).not.toThrow();
		expect(renderer.calls.retiredBuffers).toHaveLength(1);
	});
});

describe("the instanced vertex layout (mock device)", () => {
	function createMockDevice() {
		const pipelines = [];
		return {
			pipelines,
			createBindGroupLayout(d) {
				return { label: d.label };
			},
			createBindGroup(d) {
				return { label: d.label };
			},
			createShaderModule(d) {
				return { label: d.label };
			},
			createPipelineLayout() {
				return {};
			},
			createRenderPipeline(descriptor) {
				const pipeline = { descriptor };
				pipelines.push(pipeline);
				return pipeline;
			},
		};
	}

	const registerInstanced = (cache, hasColor, hasData, baseLocation = 3) => {
		const layout = instanceRecordLayout(hasColor, hasData);
		const bytes = Float32Array.BYTES_PER_ELEMENT;
		cache.registerVertexLayout("instanced", [
			{
				stride: 36,
				attributes: [
					{ format: "float32x3", offset: 0 },
					{ format: "float32x2", offset: 12 },
					{ format: "float32x4", offset: 20 },
				],
			},
			{
				stride: layout.stride,
				stepMode: "instance",
				attributes: [
					{ format: "float32x4", offset: 0, shaderLocation: baseLocation },
					{ format: "float32x4", offset: 16, shaderLocation: baseLocation + 1 },
					{ format: "float32x4", offset: 32, shaderLocation: baseLocation + 2 },
					...(hasColor
						? [
								{
									format: "float32x4",
									offset: layout.colorOffset * bytes,
									shaderLocation: baseLocation + 3,
								},
							]
						: []),
					...(hasData
						? [
								{
									format: "float32x4",
									offset: layout.dataOffset * bytes,
									shaderLocation: baseLocation + 4,
								},
							]
						: []),
				],
			},
		]);
		return layout;
	};

	it("puts the records in a second buffer that steps per instance", () => {
		const device = createMockDevice();
		const cache = new WebGPUPipelineCache(device, "bgra8unorm");
		registerInstanced(cache, false, false);
		cache.get("instanced", "triangle-list", "none", true);

		const { buffers } = device.pipelines[0].descriptor.vertex;
		expect(buffers).toHaveLength(2);
		// the geometry group must stay per-vertex — WebGPU's default, and
		// emitting "vertex" explicitly would change every 2D descriptor
		expect("stepMode" in buffers[0]).toBe(false);
		expect(buffers[1].stepMode).toBe("instance");
		expect(buffers[1].arrayStride).toBe(48);
	});

	it("keeps the data slot's location fixed whether or not colour is present", () => {
		// the property the derived module depends on
		const withBoth = createMockDevice();
		const cacheBoth = new WebGPUPipelineCache(withBoth, "bgra8unorm");
		registerInstanced(cacheBoth, true, true);
		cacheBoth.get("instanced", "triangle-list", "none", true);

		const dataOnly = createMockDevice();
		const cacheData = new WebGPUPipelineCache(dataOnly, "bgra8unorm");
		registerInstanced(cacheData, false, true);
		cacheData.get("instanced", "triangle-list", "none", true);

		const locationOf = (device) => {
			const attrs = device.pipelines[0].descriptor.vertex.buffers[1].attributes;
			return attrs[attrs.length - 1].shaderLocation;
		};
		// last attribute is the data slot in both cases, at the same location
		expect(locationOf(withBoth)).toBe(7);
		expect(locationOf(dataOnly)).toBe(7);
		// but at different byte offsets, since the colour slot moved it
		const both = withBoth.pipelines[0].descriptor.vertex.buffers[1];
		const data = dataOnly.pipelines[0].descriptor.vertex.buffers[1];
		expect(both.attributes[both.attributes.length - 1].offset).toBe(64);
		expect(data.attributes[data.attributes.length - 1].offset).toBe(48);
		expect(both.arrayStride).toBe(80);
		expect(data.arrayStride).toBe(64);
	});
});
