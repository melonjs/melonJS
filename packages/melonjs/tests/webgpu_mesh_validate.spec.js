import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, GLShader, video } from "../src/index.js";
import meshWGSL from "../src/video/webgpu/shaders/mesh.wgsl";
import litMeshWGSL from "../src/video/webgpu/shaders/mesh-lit.wgsl";

/**
 * Device-gated validation of the mesh tier's WGSL modules and pipeline
 * permutations: the shaders must compile with ZERO errors on the real
 * device (`getCompilationInfo` — WGSL validation issues never throw), and
 * the mesh pipeline family must build across its depth/cull/frontFace ×
 * stencil axes without validation errors. CI runners without WebGPU skip
 * visibly; run locally against a real adapter.
 */
describe("mesh tier WGSL + pipelines validate on the device", () => {
	let app;
	let webgpuReady = false;

	beforeAll(async () => {
		try {
			app = new Application(64, 64, { renderer: video.WEBGPU });
			await app.init();
			webgpuReady = true;
		} catch {
			webgpuReady = false;
		}
	});

	afterAll(() => {
		if (webgpuReady) {
			app.destroy();
		}
	});

	it("exposes the adapter's vendor as GPUVendor (the GL twin)", (ctx) => {
		if (!webgpuReady) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		// real adapters report a vendor string; undefined only when the
		// browser redacts adapter info entirely
		const vendor = app.renderer.GPUVendor;
		expect(typeof vendor === "string" || typeof vendor === "undefined").toBe(
			true,
		);
	});

	it("the mesh WGSL modules compile clean", async (ctx) => {
		if (!webgpuReady) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		const failures = [];
		for (const [name, code] of Object.entries({
			mesh: meshWGSL,
			meshLit: litMeshWGSL,
		})) {
			const module = app.renderer.device.createShaderModule({ code });
			const info = await module.getCompilationInfo();
			for (const message of info.messages) {
				if (message.type === "error") {
					failures.push(
						`${name}: ${message.message} (line ${message.lineNum})`,
					);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	it("the mesh pipeline family builds across its state axes", (ctx) => {
		if (!webgpuReady) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		const renderer = app.renderer;
		const errors = [];
		renderer.device.addEventListener?.("uncapturederror", (event) => {
			errors.push(String(event.error?.message ?? event.error));
		});
		for (const family of ["mesh", "litMesh"]) {
			const batcher = renderer.batchers.get(family);
			for (const cullMode of ["none", "back"]) {
				for (const frontFace of ["ccw", "cw"]) {
					for (const stencilMode of ["none", "test"]) {
						const pipeline = renderer.pipelineCache.get(
							batcher.shaderKey,
							"triangle-list",
							"none",
							true,
							stencilMode,
							{ cullMode, frontFace },
						);
						expect(pipeline).toBeDefined();
					}
				}
			}
		}
		expect(errors).toEqual([]);
	});

	it("a custom WGSL mesh shader registers, validates and builds a pipeline on both hosts", async (ctx) => {
		if (!webgpuReady) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		const renderer = app.renderer;
		const errors = [];
		renderer.device.addEventListener?.("uncapturederror", (event) => {
			errors.push(String(event.error?.message ?? event.error));
		});
		// the documented module contract: vertex_main/fragment_main entry
		// points over the frozen mesh layout and the 4-group list, clip-z
		// remap included — quantized "toon" sampling as the custom logic
		const toon = new GLShader(undefined, {
			wgsl: `
			struct FrameUniforms { projection : mat4x4<f32>, lineWidth : f32 };
			struct MeshUniforms {
				model : mat4x4<f32>, view : mat4x4<f32>,
				tint : vec4f, params : vec4f, emissive : vec4f,
			};
			@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
			@group(1) @binding(0) var uTexture : texture_2d<f32>;
			@group(1) @binding(1) var uSampler : sampler;
			@group(3) @binding(0) var<uniform> uMesh : MeshUniforms;
			struct VSOut {
				@builtin(position) position : vec4f,
				@location(0) vRegion : vec2f,
			};
			@vertex
			fn vertex_main(@location(0) aVertex : vec3f,
			               @location(1) aRegion : vec2f,
			               @location(2) aColor : vec4f) -> VSOut {
				var out : VSOut;
				let clip = uFrame.projection * uMesh.view * uMesh.model
					* vec4f(aVertex, 1.0);
				out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
				out.vRegion = aRegion;
				return out;
			}
			@fragment
			fn fragment_main(in : VSOut) -> @location(0) vec4f {
				let color = textureSample(uTexture, uSampler, in.vRegion);
				return vec4f(floor(color.rgb * 4.0) / 4.0, color.a);
			}
		`,
		});
		for (const family of ["mesh", "litMesh"]) {
			const batcher = renderer.batchers.get(family);
			batcher.customShader = toon;
			const key = batcher.activeShaderKey();
			batcher.customShader = null;
			expect(key).not.toBe(batcher.shaderKey);
			const info =
				await renderer.pipelineCache.modules[key].getCompilationInfo();
			expect(
				info.messages.filter((message) => {
					return message.type === "error";
				}),
			).toEqual([]);
			const pipeline = renderer.pipelineCache.get(
				key,
				"triangle-list",
				"none",
				true,
				"none",
				{ cullMode: "back", frontFace: "ccw" },
			);
			expect(pipeline).toBeDefined();
		}
		// the async validation verdict stayed positive
		expect(toon.wgslValid).toBe(true);
		expect(errors).toEqual([]);
	});
});
