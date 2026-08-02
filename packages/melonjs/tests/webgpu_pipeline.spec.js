import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import {
	CLEAR_UNIFORM_SIZE,
	FRAME_UNIFORM_SIZE,
	GROUP_EFFECT,
	GROUP_FRAME,
	GROUP_LIGHTS,
	GROUP_MATERIAL,
} from "../src/video/webgpu/pipeline/bindgroups.js";
import WebGPUPipelineCache, {
	normalizeBlendMode,
} from "../src/video/webgpu/pipeline/cache.js";

/**
 * A mock GPUDevice capturing createRenderPipeline descriptors, so the
 * pipeline cache's key composition, blend table, stencil variants and
 * vertex-layout consumption are testable without a GPU.
 */
function createMockDevice() {
	const pipelines = [];
	return {
		pipelines,
		createBindGroupLayout(descriptor) {
			return { label: descriptor.label };
		},
		createShaderModule(descriptor) {
			return { label: descriptor.label };
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

/**
 * Device-free units of the WebGPU 2D pipeline — the pure CPU pieces
 * (key normalization, staging math) that must hold on every runner,
 * with or without a GPU. The device-dependent draw paths are covered by
 * webgpu_renderer.spec.js behind the availability skip, and visually by
 * the Hello WebGPU example.
 */
describe("WebGPU pipeline (device-free units)", () => {
	describe("blend-mode key normalization (GL-backend parity)", () => {
		it("collapses the additive aliases", () => {
			expect(normalizeBlendMode("add")).toBe("additive");
			expect(normalizeBlendMode("lighter")).toBe("additive");
			expect(normalizeBlendMode("additive")).toBe("additive");
		});

		it("passes the supported modes through", () => {
			for (const mode of [
				"normal",
				"multiply",
				"screen",
				"darken",
				"lighten",
				"none",
			]) {
				expect(normalizeBlendMode(mode)).toBe(mode);
			}
		});

		it("falls back to normal for unsupported CSS modes, like the GL backend", () => {
			expect(normalizeBlendMode("overlay")).toBe("normal");
			expect(normalizeBlendMode("color-dodge")).toBe("normal");
			expect(normalizeBlendMode("nonsense")).toBe("normal");
		});
	});

	describe("frozen vertex layouts (the #1492 declarative consumption)", () => {
		it("quad layout resolves to the 28-byte GL-parity stride", async () => {
			const { resolveVertexFormat } = await import(
				"../src/video/gpu/vertexformat.ts"
			);
			// aVertex float32x3 @0, aRegion float32x2 @12, aColor unorm8x4
			// @20, aTextureId float32 @24 → stride 28
			const layout = [
				["float32x3", 0],
				["float32x2", 12],
				["unorm8x4", 20],
				["float32", 24],
			];
			let stride = 0;
			for (const [format, offset] of layout) {
				const resolved = resolveVertexFormat(format);
				expect(offset).toBe(stride);
				stride = offset + resolved.bytes;
			}
			expect(stride).toBe(28);
		});

		it("primitive layout resolves to the 24-byte GL-parity stride", async () => {
			const { resolveVertexFormat } = await import(
				"../src/video/gpu/vertexformat.ts"
			);
			const layout = [
				["float32x3", 0],
				["float32x2", 12],
				["unorm8x4", 20],
			];
			let stride = 0;
			for (const [format, offset] of layout) {
				const resolved = resolveVertexFormat(format);
				expect(offset).toBe(stride);
				stride = offset + resolved.bytes;
			}
			expect(stride).toBe(24);
		});
	});

	describe("packed color byte order (unorm8x4 contract)", () => {
		it("Color.toUint32 little-endian bytes read back as B,G,R,A", async () => {
			const { Color } = await import("../src/math/color.ts");
			// R=0x11, G=0x22, B=0x33, alpha 1 → packed (A<<24)|(R<<16)|(G<<8)|B
			const packed = new Color(0x11, 0x22, 0x33).toUint32(1.0);
			const bytes = new Uint8Array(Uint32Array.of(packed).buffer);
			// unorm8x4 maps byte i → component i: the attribute arrives as
			// (B, G, R, A), which the shaders' `.bgr` swizzle re-orders —
			// the exact convention both the GLSL and WGSL sources rely on
			expect([...bytes]).toEqual([0x33, 0x22, 0x11, 0xff]);
		});
	});

	describe("frozen bind-group conventions", () => {
		it("group indices and uniform block sizes are pinned", () => {
			// shaders, ring and layouts all assume these — a change here is
			// a breaking reshape, never an incidental edit
			expect([GROUP_FRAME, GROUP_MATERIAL, GROUP_LIGHTS, GROUP_EFFECT]).toEqual(
				[0, 1, 2, 3],
			);
			// mat4x4 projection (64) + f32 lineWidth (4) + pad to 16 → 80
			expect(FRAME_UNIFORM_SIZE).toBe(80);
			// vec4f clear color
			expect(CLEAR_UNIFORM_SIZE).toBe(16);
		});
	});

	describe("WebGPUPipelineCache (mock device)", () => {
		function makeCache() {
			const device = createMockDevice();
			const cache = new WebGPUPipelineCache(device, "bgra8unorm");
			cache.registerVertexLayout("quad", 28, [
				{ format: "float32x3", offset: 0 },
				{ format: "float32x2", offset: 12 },
				{ format: "unorm8x4", offset: 20 },
				{ format: "float32", offset: 24 },
			]);
			return { device, cache };
		}

		it("the same state tuple returns the same pipeline object", () => {
			const { device, cache } = makeCache();
			const a = cache.get("quad", "triangle-list", "normal", true);
			const b = cache.get("quad", "triangle-list", "normal", true);
			expect(b).toBe(a);
			expect(device.pipelines).toHaveLength(1);

			// alias normalization folds into the same key
			expect(cache.get("quad", "triangle-list", "lighter", true)).toBe(
				cache.get("quad", "triangle-list", "additive", true),
			);
		});

		it("every key component produces a distinct pipeline", () => {
			const { device, cache } = makeCache();
			cache.get("quad", "triangle-list", "normal", true);
			cache.get("quad", "triangle-strip", "normal", true);
			cache.get("quad", "triangle-list", "screen", true);
			cache.get("quad", "triangle-list", "normal", false);
			cache.get("quad", "triangle-list", "normal", true, "write");
			expect(device.pipelines).toHaveLength(5);
		});

		it("the blend table matches the GL setBlendMode table", () => {
			const { cache } = makeCache();
			const blend = (mode, pma = true) => {
				return cache.get("quad", "triangle-list", mode, pma).descriptor.fragment
					.targets[0].blend;
			};

			// premultiplied source-over
			expect(blend("normal").color).toEqual({
				operation: "add",
				srcFactor: "one",
				dstFactor: "one-minus-src-alpha",
			});
			// straight-alpha source factor
			expect(blend("normal", false).color.srcFactor).toBe("src-alpha");
			expect(blend("additive").color.dstFactor).toBe("one");
			expect(blend("multiply").color.srcFactor).toBe("dst");
			expect(blend("screen").color).toEqual({
				operation: "add",
				srcFactor: "one",
				dstFactor: "one-minus-src",
			});
			// min/max equations for darken/lighten (WebGL 2 parity)
			expect(blend("darken").color.operation).toBe("min");
			expect(blend("lighten").color.operation).toBe("max");
			// "none" = replace: no blend state at all
			expect(blend("none")).toBeUndefined();
		});

		it("stencil variants: write masks color off and increments; test compares equal", () => {
			const { cache } = makeCache();
			const descriptorFor = (stencilMode) => {
				return cache.get("quad", "triangle-list", "normal", true, stencilMode)
					.descriptor;
			};

			const write = descriptorFor("write");
			expect(write.fragment.targets[0].writeMask).toBe(0);
			expect(write.depthStencil.stencilFront.passOp).toBe("increment-clamp");
			expect(write.depthStencil.stencilWriteMask).toBe(0xff);

			const test = descriptorFor("test");
			expect(test.fragment.targets[0].writeMask).toBe(0xf);
			expect(test.depthStencil.stencilFront.compare).toBe("equal");
			expect(test.depthStencil.stencilWriteMask).toBe(0);

			const none = descriptorFor("none");
			expect(none.depthStencil.stencilFront.compare).toBe("always");
			expect(none.depthStencil.stencilWriteMask).toBe(0);
		});

		it("registered vertex layouts land in the descriptor with declaration-order locations", () => {
			const { cache } = makeCache();
			const descriptor = cache.get(
				"quad",
				"triangle-list",
				"normal",
				true,
			).descriptor;
			const buffer = descriptor.vertex.buffers[0];
			expect(buffer.arrayStride).toBe(28);
			expect(
				buffer.attributes.map((a) => {
					return a.shaderLocation;
				}),
			).toEqual([0, 1, 2, 3]);
			expect(buffer.attributes[2]).toMatchObject({
				format: "unorm8x4",
				offset: 20,
			});
		});

		it("strip topologies declare a stripIndexFormat, lists do not", () => {
			const { cache } = makeCache();
			expect(
				cache.get("quad", "triangle-strip", "normal", true).descriptor.primitive
					.stripIndexFormat,
			).toBe("uint32");
			expect(
				cache.get("quad", "triangle-list", "normal", true).descriptor.primitive
					.stripIndexFormat,
			).toBeUndefined();
		});

		it("the clear pipeline never blends, whatever the requested mode", () => {
			const { cache } = makeCache();
			expect(
				cache.get("clear", "triangle-list", "additive", true).descriptor
					.fragment.targets[0].blend,
			).toBeUndefined();
		});
	});
});
