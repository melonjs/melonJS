import "./helpers/webgpu-globals.js";
import { afterEach, describe, expect, it } from "vitest";
// `../src/index.js` first: importing the renderer module on its own hits the
// `Renderer` base-class cycle, the same reason the other WebGPU specs pull the
// barrel in before the class
import "../src/index.js";
import { shaderList } from "../src/loader/cache.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";

/**
 * `WebGPURenderer.prewarm()` — which shader assets it decides to build.
 *
 * Selection is the whole of this method, and it is where the interesting
 * mistake lives. An earlier revision memoized the returned promise, which is
 * right on WebGL (its warm set is the batchers' fixed variant list) and wrong
 * here: this set is `shaderList`, which GROWS with every preload. Per-stage
 * preloading is the pattern the feature is sold on, so memoizing meant a
 * level's own effects were never warmed — silently, because the lazy draw path
 * covers it and nothing errors.
 *
 * These run against a stub cache rather than a device: what is under test is
 * which realizations get built, not how one is built.
 */
describe("WebGPURenderer.prewarm()", () => {
	const registered = [];

	/**
	 * A renderer stub carrying only what `buildEffectGPU` reaches for.
	 * @param {number} epoch - the pipeline cache's device epoch
	 * @returns {object} the stub
	 */
	const rendererStub = (epoch = 1) => {
		return {
			device: { limits: { minUniformBufferOffsetAlignment: 256 } },
			pipelineCache: {
				epoch,
				frameLayout: {},
				materialLayout: {},
				emptyLayout: {},
				getEffectLayout: () => {
					return {};
				},
				registerShader: (code) => {
					registered.push(code);
					return `effect:${registered.length}`;
				},
			},
			prewarm: WebGPURenderer.prototype.prewarm,
		};
	};

	/**
	 * A shader asset shaped like one the loader compiled.
	 * @param {string} code - stands in for the generated WGSL
	 * @param {object} [over] - realization fields to override
	 * @returns {object} the fake effect
	 */
	const effect = (code, over = {}) => {
		return {
			wgslRealization: {
				valid: true,
				code,
				gpu: null,
				structSize: 0,
				textures: [],
				builtins: {},
				builtinBindings: {},
				...over,
			},
		};
	};

	afterEach(() => {
		for (const name of Object.keys(shaderList)) {
			delete shaderList[name];
		}
		registered.length = 0;
	});

	it("builds the GPU objects for a shader the loader holds", async () => {
		shaderList.ramp = effect("ramp-wgsl");
		const renderer = rendererStub();
		await renderer.prewarm();
		expect(shaderList.ramp.wgslRealization.gpu).not.toBe(null);
		expect(shaderList.ramp.wgslRealization.gpu.epoch).toBe(1);
		expect(registered).toEqual(["ramp-wgsl"]);
	});

	it("warms a shader that arrived in a LATER preload", async () => {
		// The regression. `preload()` calls `prewarm()` every time, and a game
		// that loads a level's effects with that level relies on the second
		// call doing real work. Memoizing the promise made it a no-op, and the
		// lazy path covered for it — so a level's own effects were built on the
		// frame that first drew them, exactly what the feature exists to avoid.
		shaderList.level1 = effect("level1-wgsl");
		const renderer = rendererStub();
		await renderer.prewarm();
		expect(registered).toEqual(["level1-wgsl"]);

		shaderList.level2 = effect("level2-wgsl");
		await renderer.prewarm();
		expect(registered).toEqual(["level1-wgsl", "level2-wgsl"]);
		expect(shaderList.level2.wgslRealization.gpu).not.toBe(null);
	});

	it("does not rebuild one it already built", async () => {
		shaderList.ramp = effect("ramp-wgsl");
		const renderer = rendererStub();
		await renderer.prewarm();
		const first = shaderList.ramp.wgslRealization.gpu;
		await renderer.prewarm();
		// same guard the draw path uses, so a re-run is close to free — which
		// is what makes dropping the memo affordable
		expect(shaderList.ramp.wgslRealization.gpu).toBe(first);
		expect(registered).toEqual(["ramp-wgsl"]);
	});

	it("rebuilds when the device epoch moved under it", async () => {
		shaderList.ramp = effect("ramp-wgsl");
		await rendererStub(1).prewarm();
		expect(shaderList.ramp.wgslRealization.gpu.epoch).toBe(1);
		// a device loss mints a new epoch; anything built against the old one
		// belongs to a device that no longer exists
		await rendererStub(2).prewarm();
		expect(shaderList.ramp.wgslRealization.gpu.epoch).toBe(2);
		expect(registered).toEqual(["ramp-wgsl", "ramp-wgsl"]);
	});

	it("skips assets with nothing for this backend", async () => {
		// a GLShader asset, or a body with only a GLSL half, has no WGSL
		// realization — not an error, just not this backend's business
		shaderList.glOnly = { wgslRealization: undefined };
		shaderList.invalid = effect("bad-wgsl", { valid: false });
		shaderList.good = effect("good-wgsl");
		await rendererStub().prewarm();
		expect(registered).toEqual(["good-wgsl"]);
		expect(shaderList.invalid.wgslRealization.gpu).toBe(null);
	});

	it("resolves on an empty loader", async () => {
		await expect(rendererStub().prewarm()).resolves.toBeUndefined();
		expect(registered).toEqual([]);
	});
});
