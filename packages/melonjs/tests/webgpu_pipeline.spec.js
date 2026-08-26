import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import { normalizeBlendMode } from "../src/video/blendmodes.js";
import {
	CLEAR_UNIFORM_SIZE,
	FRAME_UNIFORM_SIZE,
	GROUP_EFFECT,
	GROUP_FRAME,
	GROUP_LIGHTS,
	GROUP_MATERIAL,
} from "../src/video/webgpu/pipeline/bindgroups.js";
import WebGPUPipelineCache, {} from "../src/video/webgpu/pipeline/cache.js";

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
		createBindGroup(descriptor) {
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
			for (const mode of ["normal", "multiply", "screen", "none"]) {
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

		it("a single-buffer registration emits exactly one layout, with no stepMode (#1508 pin)", () => {
			// the multi-buffer generalization must leave every existing
			// pipeline descriptor byte-identical: one entry in `buffers`,
			// sequential shader locations, and NO `stepMode` key at all —
			// "vertex" is the WebGPU default, so emitting it explicitly would
			// change every descriptor the 2D tier is built from
			const { device, cache } = makeCache();
			cache.get("quad", "triangle-list", "normal", true);
			const { buffers } = device.pipelines[0].descriptor.vertex;
			expect(buffers).toHaveLength(1);
			expect("stepMode" in buffers[0]).toBe(false);
			expect(buffers[0]).toEqual({
				arrayStride: 28,
				attributes: [
					{ format: "float32x3", offset: 0, shaderLocation: 0 },
					{ format: "float32x2", offset: 12, shaderLocation: 1 },
					{ format: "unorm8x4", offset: 20, shaderLocation: 2 },
					{ format: "float32", offset: 24, shaderLocation: 3 },
				],
			});
		});

		it("a two-group registration puts the instance layout second, locations continuing across groups", () => {
			const device = createMockDevice();
			const cache = new WebGPUPipelineCache(device, "bgra8unorm");
			cache.registerVertexLayout("instancedMesh", [
				{
					stride: 36,
					attributes: [
						{ format: "float32x3", offset: 0 },
						{ format: "float32x2", offset: 12 },
						{ format: "float32x4", offset: 20 },
					],
				},
				{
					stride: 48,
					stepMode: "instance",
					attributes: [
						{ format: "float32x4", offset: 0 },
						{ format: "float32x4", offset: 16 },
						{ format: "float32x4", offset: 32 },
					],
				},
			]);
			cache.get("instancedMesh", "triangle-list", "none", true);
			const { buffers } = device.pipelines[0].descriptor.vertex;
			expect(buffers).toHaveLength(2);
			expect("stepMode" in buffers[0]).toBe(false);
			expect(buffers[1].stepMode).toBe("instance");
			expect(buffers[1].arrayStride).toBe(48);
			// WGSL locations are one namespace: the instance group continues
			// from where the geometry group stopped, it does not restart at 0
			expect(
				buffers[0].attributes.map((a) => {
					return a.shaderLocation;
				}),
			).toEqual([0, 1, 2]);
			expect(
				buffers[1].attributes.map((a) => {
					return a.shaderLocation;
				}),
			).toEqual([3, 4, 5]);
		});

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
			// darken/lighten moved to the shader path in 20.2 — fixed-function
			// min/max cannot express the source-over term, so they rasterize
			// under ordinary source-over like the other shader-composited modes
			expect(blend("darken").color).toEqual(blend("normal").color);
			expect(blend("lighten").color).toEqual(blend("normal").color);
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

		it("gradient-mask variants: tag replaces unconditionally, mark replaces behind the low-7-bit compare", () => {
			const { cache } = makeCache();
			const descriptorFor = (stencilMode) => {
				return cache.get("quad", "triangle-list", "normal", true, stencilMode)
					.descriptor;
			};

			// tag: stamp the shape's pixels with the dynamic reference on a
			// cleared stencil — replace (not increment) so shape overdraw
			// (fan/earcut geometry) can never double-count
			const tag = descriptorFor("tag");
			expect(tag.fragment.targets[0].writeMask).toBe(0);
			expect(tag.depthStencil.stencilFront.compare).toBe("always");
			expect(tag.depthStencil.stencilFront.passOp).toBe("replace");
			expect(tag.depthStencil.stencilWriteMask).toBe(0xff);

			// mark: only pixels whose low 7 bits equal the reference's get
			// the full reference written (mask levels never use the high
			// bit, so the marker cannot collide with one)
			const mark = descriptorFor("mark");
			expect(mark.fragment.targets[0].writeMask).toBe(0);
			expect(mark.depthStencil.stencilFront.compare).toBe("equal");
			expect(mark.depthStencil.stencilFront.passOp).toBe("replace");
			expect(mark.depthStencil.stencilReadMask).toBe(0x7f);
			expect(mark.depthStencil.stencilWriteMask).toBe(0xff);
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

		it("registerShader dedupes by module text: same body → same family + module", () => {
			const { cache } = makeCache();
			const codeA = "fn a() {}";
			const keyA = cache.registerShader(codeA);
			const keyAgain = cache.registerShader(codeA);
			const keyB = cache.registerShader("fn b() {}");
			expect(keyAgain).toBe(keyA);
			expect(keyB).not.toBe(keyA);
			expect(cache.modules[keyA]).toBeDefined();
		});

		it("…but a same-body module under a DIFFERENT vertex layout is its own family", () => {
			const { cache } = makeCache();
			// One module can legitimately serve several vertex layouts — the
			// instanced ground shadow (#1515) reads only the transform rows, so
			// one body covers every record shape while the instance buffer's
			// `arrayStride` still differs per shape. Keying on the body alone
			// handed the second caller the FIRST one's layout, i.e. the wrong
			// stride, with nothing failing.
			const body = "fn shared() {}";
			const a = cache.registerShader(body, { vertexLayoutKey: "rowsA" });
			const b = cache.registerShader(body, { vertexLayoutKey: "rowsB" });
			expect(b).not.toBe(a);
			expect(cache.vertexLayoutAliases.get(a)).toBe("rowsA");
			expect(cache.vertexLayoutAliases.get(b)).toBe("rowsB");
			// the compiled module itself is still shared — one body, one compile
			expect(cache.modules[a]).toBe(cache.modules[b]);
		});

		it("registered families ride an aliased vertex layout through get()", () => {
			const { cache } = makeCache();
			const key = cache.registerShader("fn c() {}", {
				vertexLayoutKey: "quad",
			});
			const descriptor = cache.get(
				key,
				"triangle-list",
				"normal",
				true,
			).descriptor;
			// the frozen 28-byte quad layout, without re-registering it
			expect(descriptor.vertex.buffers[0].arrayStride).toBe(28);
			// same family + same state tuple → cached pipeline
			expect(cache.get(key, "triangle-list", "normal", true)).toBe(
				cache.get(key, "triangle-list", "normal", true),
			);
		});

		it("effect layouts are cached by shape signature", () => {
			const { cache } = makeCache();
			const entries = [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform", hasDynamicOffset: true },
				},
			];
			const a = cache.getEffectLayout("u16", entries);
			const b = cache.getEffectLayout("u16", entries);
			const c = cache.getEffectLayout("u32", entries);
			expect(b).toBe(a);
			expect(c).not.toBe(a);
		});

		it("exposes the shared empty group (reserved group-2 slot) and an epoch", () => {
			const first = makeCache().cache;
			const second = makeCache().cache;
			expect(first.emptyLayout).toBeDefined();
			expect(first.emptyBindGroup).toBeDefined();
			// each construction (device loss) bumps the epoch — consumers
			// lazily rebuild device-scoped state on mismatch
			expect(second.epoch).toBeGreaterThan(first.epoch);
		});
	});

	describe("mesh pipeline axes (the 3D tier)", () => {
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

		it("meshState is a key axis: every cull/frontFace pair is its own pipeline, distinct from the 2D one", () => {
			const { device, cache } = makeCache();
			const flat = cache.get("quad", "triangle-list", "none", true);
			const meshOf = (cullMode, frontFace) => {
				return cache.get("quad", "triangle-list", "none", true, "none", {
					cullMode,
					frontFace,
				});
			};
			const backCcw = meshOf("back", "ccw");
			expect(backCcw).not.toBe(flat);
			expect(meshOf("back", "ccw")).toBe(backCcw);
			expect(meshOf("back", "cw")).not.toBe(backCcw);
			expect(meshOf("none", "ccw")).not.toBe(backCcw);
			expect(device.pipelines).toHaveLength(4);
		});

		it("mesh descriptors enable depth write + LEQUAL and carry the culling axes", () => {
			const { cache } = makeCache();
			const { descriptor } = cache.get(
				"quad",
				"triangle-list",
				"none",
				true,
				"none",
				{ cullMode: "back", frontFace: "cw" },
			);
			// GL mesh-mode parity: LEQUAL (not LESS) keeps coplanar
			// geometry from z-fighting itself out of existence
			expect(descriptor.depthStencil.depthWriteEnabled).toBe(true);
			expect(descriptor.depthStencil.depthCompare).toBe("less-equal");
			expect(descriptor.primitive.cullMode).toBe("back");
			expect(descriptor.primitive.frontFace).toBe("cw");
		});

		it("mesh state merges with the stencil axes — a mesh inside a mask honors both", () => {
			const { cache } = makeCache();
			const { descriptor } = cache.get(
				"quad",
				"triangle-list",
				"none",
				true,
				"test",
				{ cullMode: "none", frontFace: "ccw" },
			);
			expect(descriptor.depthStencil.depthWriteEnabled).toBe(true);
			expect(descriptor.depthStencil.depthCompare).toBe("less-equal");
			expect(descriptor.depthStencil.stencilFront.compare).toBe("equal");
			expect(descriptor.depthStencil.stencilWriteMask).toBe(0);
		});

		it("2D descriptors are unchanged with the mesh axes absent (regression pin)", () => {
			const { cache } = makeCache();
			const { descriptor } = cache.get("quad", "triangle-list", "normal", true);
			expect(descriptor.depthStencil.depthWriteEnabled).toBe(false);
			expect(descriptor.depthStencil.depthCompare).toBe("always");
			// the culling keys must be ABSENT, not merely defaulted — the
			// 2D descriptor stays byte-identical to a build with no mesh path
			expect("cullMode" in descriptor.primitive).toBe(false);
			expect("frontFace" in descriptor.primitive).toBe(false);
			expect(descriptor.primitive).toEqual({
				topology: "triangle-list",
				stripIndexFormat: undefined,
			});
		});
	});
});
