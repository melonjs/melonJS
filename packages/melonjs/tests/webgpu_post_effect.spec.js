import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShaderEffect } from "../src/index.js";
import { prepareEffectBinding } from "../src/video/webgpu/effect_binding.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The WebGPU effect draw path on the mock renderer: lazy GPU build, the
 * snapshot-per-bind uniform scheme (THE correctness invariant under the
 * queue-write-before-draws ordering), bind-group caching/invalidation,
 * and the blit's pipeline/bind-group recording.
 */
describe("WebGPU effect binding (mock renderer)", () => {
	const BODY = `
struct Fx { uStrength : f32, };
@group(3) @binding(0) var<uniform> fx : Fx;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return vec4f(color.rgb * fx.uStrength, color.a);
}
`;
	let renderer;

	function makeEffect(body = BODY) {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new ShaderEffect({ shaderLanguage: "wgsl" }, { wgsl: body });
		warn.mockRestore();
		return effect;
	}

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
	});

	it("builds device state lazily and registers one module per body text", () => {
		const effect = makeEffect();
		const binding = prepareEffectBinding(renderer, effect);
		expect(binding.key).toBe("effect:0");
		expect(binding.hasEffectGroup).toBe(true);

		// a clone shares the module (same text → same family key)
		const clone = effect.clone();
		expect(prepareEffectBinding(renderer, clone).key).toBe("effect:0");
	});

	it("each bind snapshots the mirror into a FRESH region (dynamic offsets differ)", () => {
		const effect = makeEffect();
		effect.setUniform("uStrength", 0.25);
		const first = prepareEffectBinding(renderer, effect);

		effect.setUniform("uStrength", 0.75);
		const second = prepareEffectBinding(renderer, effect);

		// two binds, two regions — the first draw keeps its own bytes even
		// though queue writes all land before any draw executes
		expect(second.dynamicOffsets[0]).toBeGreaterThan(first.dynamicOffsets[0]);
		expect(renderer.calls.writes[0].floats[0]).toBeCloseTo(0.25);
		expect(renderer.calls.writes[1].floats[0]).toBeCloseTo(0.75);
		// same page → the cached bind group is reused across binds
		expect(second.bindGroup).toBe(first.bindGroup);
	});

	it("snapshot offsets honor the device's uniform-offset alignment", () => {
		const effect = makeEffect();
		prepareEffectBinding(renderer, effect);
		const second = prepareEffectBinding(renderer, effect);
		expect(second.dynamicOffsets[0] % 256).toBe(0);
	});

	it("an effect with no group-3 declarations binds no effect group", () => {
		const effect = makeEffect(
			"fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }",
		);
		const binding = prepareEffectBinding(renderer, effect);
		expect(binding.hasEffectGroup).toBe(false);
		expect(binding.bindGroup).toBeNull();
		expect(renderer.calls.writes).toHaveLength(0);
	});

	it("a GLSL-only effect yields no binding (the blit falls back to a plain quad)", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new ShaderEffect(
			{ shaderLanguage: "wgsl" },
			"vec4 apply(vec4 c, vec2 uv) { return c; }",
		);
		warn.mockRestore();
		expect(prepareEffectBinding(renderer, effect)).toBeNull();
	});

	it("a device epoch bump rebuilds the GPU state lazily", () => {
		const effect = makeEffect();
		prepareEffectBinding(renderer, effect);
		const before = effect.wgslRealization.gpu;

		renderer.pipelineCache.epoch = 2;
		prepareEffectBinding(renderer, effect);
		expect(effect.wgslRealization.gpu).not.toBe(before);
		expect(effect.wgslRealization.gpu.epoch).toBe(2);
	});

	it("noise_uv effects get a second dynamic offset for the ME block", () => {
		const effect = makeEffect(`
struct Fx { uStrength : f32, };
@group(3) @binding(0) var<uniform> fx : Fx;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return vec4f(color.rgb * fx.uStrength * noise_uv.x, color.a);
}
`);
		effect._setNoiseUVRect(256, 128, 64, 32, 0, 0);
		const binding = prepareEffectBinding(renderer, effect);
		expect(binding.dynamicOffsets).toHaveLength(2);
		// ME slice starts at the next aligned boundary after the struct
		expect(binding.dynamicOffsets[1] - binding.dynamicOffsets[0]).toBe(256);
		// the ME write carries size_obj/size_img
		const meWrite = renderer.calls.writes[1];
		expect([...meWrite.floats.slice(0, 4)]).toEqual([64, 32, 256, 128]);
	});

	it("screen_texture binds the capture when present, the stub when not", () => {
		const effect = makeEffect(`
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return textureSample(screen_texture, screen_sampler, screen_uv);
}
`);
		const withoutCapture = prepareEffectBinding(renderer, effect);
		const stubEntry = withoutCapture.bindGroup.entries.find((entry) => {
			return entry.resource === renderer.stubView;
		});
		expect(stubEntry).toBeDefined();

		// a capture appears → the generation-keyed bind group rebuilds
		renderer.captureTexture = { view: { capture: true }, generation: 1 };
		const withCapture = prepareEffectBinding(renderer, effect);
		expect(withCapture.bindGroup).not.toBe(withoutCapture.bindGroup);
		const captureEntry = withCapture.bindGroup.entries.find((entry) => {
			return entry.resource === renderer.captureTexture.view;
		});
		expect(captureEntry).toBeDefined();
	});

	it("clamp-only and repeat-only screen-sampler shapes get DIFFERENT layouts", () => {
		const clampOnly = makeEffect(`
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return textureSample(screen_texture, screen_sampler, screen_uv);
}
`);
		const repeatOnly = makeEffect(`
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return textureSample(screen_texture, screen_sampler_repeat, screen_uv);
}
`);
		prepareEffectBinding(renderer, clampOnly);
		prepareEffectBinding(renderer, repeatOnly);
		// a shared cached layout between the two shapes breaks whichever
		// registers second (bind-group entries mismatch the layout)
		expect(clampOnly.wgslRealization.gpu.effectLayout).not.toBe(
			repeatOnly.wgslRealization.gpu.effectLayout,
		);
	});

	it("an async WGSL compilation failure disables the effect (never a permanent black screen)", async () => {
		const effect = makeEffect();
		// simulate the device reporting errors for this module
		const key = renderer.pipelineCache.registerShader(
			effect.wgslRealization.code,
		);
		renderer.pipelineCache.modules[key].getCompilationInfo = () => {
			return Promise.resolve({
				messages: [{ type: "error", message: "bad expr", lineNum: 3 }],
			});
		};
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		prepareEffectBinding(renderer, effect);
		await Promise.resolve();
		await Promise.resolve();
		expect(effect.enabled).toBe(false);
		expect(effect.wgslRealization.valid).toBe(false);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("compilation failed"),
		);
		warn.mockRestore();
	});

	it("a capture reallocation re-keys screen_texture bind groups (unique generations)", async () => {
		const { WebGPUFrameTexture } = await import(
			"../src/video/webgpu/texture/frametexture.js"
		);
		const stub = {
			preferredFormat: "bgra8unorm",
			retiredTextures: [],
			commandEncoder: null,
			retireTexture() {},
			device: {
				createTexture() {
					return {
						destroy() {},
						createView() {
							return {};
						},
					};
				},
			},
		};
		const first = new WebGPUFrameTexture(stub, 64, 64);
		const second = new WebGPUFrameTexture(stub, 128, 128);
		// each allocation must carry a distinct generation — a static value
		// left bind groups pointing at a destroyed capture after a resize
		expect(second.generation).not.toBe(first.generation);

		// and the binding actually rebuilds when the capture changes
		const effect = makeEffect(`
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return textureSample(screen_texture, screen_sampler, screen_uv);
}
`);
		renderer.captureTexture = first;
		const before = prepareEffectBinding(renderer, effect);
		renderer.captureTexture = second;
		const after = prepareEffectBinding(renderer, effect);
		expect(after.bindGroup).not.toBe(before.bindGroup);
	});

	it("setTexture sources upload once and re-key the bind group", () => {
		const effect = makeEffect(`
@group(3) @binding(1) var uNoise : texture_2d<f32>;
@group(3) @binding(2) var uNoiseSampler : sampler;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return color * textureSample(uNoise, uNoiseSampler, uv);
}
`);
		const image = { width: 8, height: 8 };
		effect.setTexture("uNoise", image, "repeat");
		const binding = prepareEffectBinding(renderer, effect);
		const samplerEntry = binding.bindGroup.entries.find((entry) => {
			return entry.binding === 2;
		});
		expect(samplerEntry.resource).toEqual({
			filter: "linear",
			repeat: "repeat",
			mipmaps: false,
		});
	});
});

describe("WebGPU blitTexture (mock renderer)", () => {
	const BODY = `
struct Fx { uStrength : f32, };
@group(3) @binding(0) var<uniform> fx : Fx;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return vec4f(color.rgb * fx.uStrength, color.a);
}
`;

	it("records one effect-pipeline quad with groups 0-3 and unflipped UVs", async () => {
		const { default: WebGPUQuadBatcherClass } = await import(
			"../src/video/webgpu/batchers/quad_batcher.js"
		);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcherClass(renderer);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new ShaderEffect({ shaderLanguage: "wgsl" }, { wgsl: BODY });
		warn.mockRestore();
		const source = {
			getMaterialBindGroup() {
				return { rt: true };
			},
		};

		batcher.blitTexture(source, 0, 0, 320, 240, effect, false);

		// pipeline: the effect family with blending replaced
		expect(renderer.calls.pipelineKeys.at(-1)).toBe(
			"effect:0|triangle-list|none|true|none",
		);
		expect(renderer.calls.drawIndexed).toEqual([6]);
		// groups: 0 frame, 1 source material, 2 empty, 3 effect
		const indices = renderer.calls.bindGroups.map((b) => {
			return b.index;
		});
		expect(indices).toEqual([0, 1, 2, 3]);
		expect(renderer.calls.bindGroups[1].group).toEqual({ rt: true });
		expect(renderer.calls.bindGroups[2].group).toBe(
			renderer.pipelineCache.emptyBindGroup,
		);

		// the last write is the quad: 4×28 bytes, v=0 at the top (no flip)
		const quadWrite = renderer.calls.writes.at(-1);
		expect(quadWrite.size).toBe(112);
		// vertex 0 uv = (0,0); vertex 2 (x, y+h) uv = (0,1)
		expect([quadWrite.floats[3], quadWrite.floats[4]]).toEqual([0, 0]);
		expect([quadWrite.floats[17], quadWrite.floats[18]]).toEqual([0, 1]);
	});

	it("fast path: adopting customShader drains the pending batch, then draws per quad", async () => {
		const { default: WebGPUQuadBatcherClass } = await import(
			"../src/video/webgpu/batchers/quad_batcher.js"
		);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcherClass(renderer);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new ShaderEffect({ shaderLanguage: "wgsl" }, { wgsl: BODY });
		warn.mockRestore();
		const atlas = {
			getTexture() {
				return { width: 64, height: 32 };
			},
		};

		// two plain quads batch together...
		batcher.addQuad(atlas, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.addQuad(atlas, 8, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		expect(renderer.calls.drawIndexed).toEqual([]);

		// ...the effect sprite adopts: pending batch drains under the DEFAULT
		// pipeline, then the effect quad draws alone under the effect family
		renderer.customShader = effect;
		effect.setUniform("uStrength", 0.5);
		batcher.addQuad(atlas, 16, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		expect(renderer.calls.drawIndexed).toEqual([12, 6]);
		expect(renderer.calls.pipelineKeys[0]).toContain("quad|");
		// blending KEPT — live compositing is the fast path's semantic
		expect(renderer.calls.pipelineKeys[1]).toBe(
			"effect:0|triangle-list|normal|true|none",
		);

		// a second effect sprite is its own draw with its own snapshot
		effect.setUniform("uStrength", 0.9);
		batcher.addQuad(atlas, 24, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		expect(renderer.calls.drawIndexed).toEqual([12, 6, 6]);
		const snapshots = renderer.calls.writes.filter((write) => {
			return write.size === 16;
		});
		expect(
			snapshots.map((write) => {
				return write.floats[0];
			}),
		).toEqual([0.5, expect.closeTo(0.9)]);

		// clearing customShader returns to plain batching
		renderer.customShader = undefined;
		batcher.addQuad(atlas, 32, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.flush();
		expect(renderer.calls.pipelineKeys.at(-1)).toContain("quad|");
	});

	it("fast path: screen_texture effects capture the backdrop before each sprite", async () => {
		const { default: WebGPUQuadBatcherClass } = await import(
			"../src/video/webgpu/batchers/quad_batcher.js"
		);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcherClass(renderer);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new ShaderEffect(
			{ shaderLanguage: "wgsl" },
			{
				wgsl: `
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return textureSample(screen_texture, screen_sampler, screen_uv);
}
`,
			},
		);
		warn.mockRestore();
		const atlas = {
			getTexture() {
				return { width: 8, height: 8 };
			},
		};

		renderer.customShader = effect;
		batcher.addQuad(atlas, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.addQuad(atlas, 8, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		// one capture per sprite, each BEFORE its draw
		expect(renderer.calls.captureFrames).toBe(2);
		expect(renderer.calls.drawIndexed).toEqual([6, 6]);
	});

	it("fast path: noise_uv effects get the sprite's frame rect per draw", async () => {
		const { default: WebGPUQuadBatcherClass } = await import(
			"../src/video/webgpu/batchers/quad_batcher.js"
		);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcherClass(renderer);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new ShaderEffect(
			{ shaderLanguage: "wgsl" },
			{
				wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return vec4f(noise_uv, 0.0, color.a); }",
			},
		);
		warn.mockRestore();
		const atlas = {
			getTexture() {
				return { width: 256, height: 128 };
			},
		};

		renderer.customShader = effect;
		batcher.addQuad(atlas, 0, 0, 64, 32, 0.5, 0.25, 0.75, 0.5, 0xffffffff);
		// ME mirror carries [obj w, obj h, img w, img h, offset x, offset y]
		expect([...effect.wgslRealization.meMirror.slice(0, 6)]).toEqual([
			64, 32, 256, 128, 128, 32,
		]);
	});

	it("an effect without a WGSL realization composites as a plain blit", async () => {
		const { default: WebGPUQuadBatcherClass } = await import(
			"../src/video/webgpu/batchers/quad_batcher.js"
		);
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcherClass(renderer);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const glslOnly = new ShaderEffect(
			{ shaderLanguage: "wgsl" },
			"vec4 apply(vec4 c, vec2 uv) { return c; }",
		);
		warn.mockRestore();
		const source = {
			getMaterialBindGroup() {
				return { rt: true };
			},
		};

		batcher.blitTexture(source, 0, 0, 100, 100, glslOnly, true);
		// the single-texture blit family, current blend kept — scene
		// content is never lost
		expect(renderer.calls.pipelineKeys.at(-1)).toBe(
			"blit|triangle-list|normal|true|none",
		);
		expect(renderer.calls.drawIndexed).toEqual([6]);
	});
});
