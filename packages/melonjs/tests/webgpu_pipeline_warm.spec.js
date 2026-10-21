import "./helpers/webgpu-globals.js";
import { describe, expect, it } from "vitest";
import WebGPUPipelineCache from "../src/video/webgpu/pipeline/cache.js";

/**
 * A mock GPUDevice for the warm-up path: synchronous creation is recorded
 * like the other pipeline specs, asynchronous creation hands back a promise
 * the test settles by hand, and command encoding records the passes a
 * warm-up submits.
 * @param {object} [options] - `{async: false}` drops createRenderPipelineAsync
 * @returns {object} the device
 */
function createMockDevice(options = {}) {
	const device = {
		syncPipelines: [],
		asyncRequests: [],
		submits: [],
		textures: [],
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
			const pipeline = { descriptor, via: "sync" };
			device.syncPipelines.push(pipeline);
			return pipeline;
		},
		createTexture(descriptor) {
			const texture = {
				descriptor,
				destroyed: false,
				createView() {
					return { texture };
				},
				destroy() {
					texture.destroyed = true;
				},
			};
			device.textures.push(texture);
			return texture;
		},
		createCommandEncoder() {
			const passes = [];
			return {
				beginRenderPass(descriptor) {
					const pass = { descriptor, pipelines: [], ended: false };
					passes.push(pass);
					return {
						setPipeline(pipeline) {
							pass.pipelines.push(pipeline);
						},
						end() {
							pass.ended = true;
						},
					};
				},
				finish() {
					return { passes };
				},
			};
		},
		queue: {
			submit(buffers) {
				device.submits.push(...buffers);
			},
		},
	};
	if (options.async !== false) {
		device.createRenderPipelineAsync = (descriptor) => {
			return new Promise((resolve, reject) => {
				device.asyncRequests.push({
					descriptor,
					resolve: () => {
						resolve({ descriptor, via: "async" });
					},
					reject,
				});
			});
		};
	}
	return device;
}

function makeCache(options) {
	const device = createMockDevice(options);
	const cache = new WebGPUPipelineCache(device, "bgra8unorm");
	// the quad family's vertex layout, as the quad batcher registers it
	cache.registerVertexLayout("quad", 28, [
		{ format: "float32x3", offset: 0 },
		{ format: "float32x2", offset: 12 },
		{ format: "unorm8x4", offset: 20 },
		{ format: "float32", offset: 24 },
	]);
	return { device, cache };
}

/** let every queued promise callback run */
const settle = async () => {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
};

describe("WebGPUPipelineCache warm-up", () => {
	describe("one key for the draw and the warm-up", () => {
		it("a warmed pipeline is the one the draw gets, under that target", async () => {
			const { device, cache } = makeCache();
			const warming = cache.warm(
				"quad",
				"triangle-list",
				"additive",
				true,
				"none",
				undefined,
				"rgba16float",
				4,
			);
			await settle();
			device.asyncRequests[0].resolve();
			await warming;

			// the draw: the renderer has retargeted to a half-float, 4x pass
			cache.format = "rgba16float";
			cache.sampleCount = 4;
			const pipeline = cache.get("quad", "triangle-list", "additive", true);
			expect(pipeline.via).toBe("async");
			expect(device.syncPipelines).toHaveLength(0);
		});

		it("builds for the target it was given, not the one bound last", async () => {
			// a warm-up runs outside any pass, where the cache's own format is
			// whatever the last frame left. Keying off that would file the
			// pipeline under the wrong name, and the draw would compile its own
			const { device, cache } = makeCache();
			cache.format = "bgra8unorm";
			cache.sampleCount = 1;
			void cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"rgba16float",
				4,
			);
			await settle();
			const { descriptor } = device.asyncRequests[0];
			expect(descriptor.fragment.targets[0].format).toBe("rgba16float");
			expect(descriptor.multisample.count).toBe(4);
			expect(descriptor.label).toContain("rgba16float|4");
		});

		it("keyFor is the key get() files a pipeline under", () => {
			const { cache } = makeCache();
			cache.format = "rgba8unorm";
			cache.sampleCount = 4;
			const mesh = { cullMode: "back", frontFace: "cw", depthWrite: false };
			const key = cache.keyFor(
				"quad",
				"triangle-list",
				"additive",
				true,
				"none",
				mesh,
			);
			const pipeline = cache.get(
				"quad",
				"triangle-list",
				"additive",
				true,
				"none",
				mesh,
			);
			expect(cache.pipelines.get(key)).toBe(pipeline);
			// and the explicit target defaults to the current one
			expect(
				cache.keyFor(
					"quad",
					"triangle-list",
					"additive",
					true,
					"none",
					mesh,
					"rgba8unorm",
					4,
				),
			).toBe(key);
		});

		it("does not split a blend-less pipeline on the premultiplied flag", () => {
			// with blending off the flag selects nothing in the descriptor, and
			// it is runtime state (whatever drew last leaves it), so keying on
			// it built the same pipeline twice and left a warm-up guessing
			const { device, cache } = makeCache();
			const a = cache.get("quad", "triangle-list", "none", true);
			const b = cache.get("quad", "triangle-list", "none", false);
			expect(b).toBe(a);
			expect(device.syncPipelines).toHaveLength(1);
			// where it does select something, it still splits
			cache.get("quad", "triangle-list", "normal", true);
			cache.get("quad", "triangle-list", "normal", false);
			expect(device.syncPipelines).toHaveLength(3);
		});
	});

	describe("the mid-frame compile counter", () => {
		it("counts a pipeline built inside a frame, with its key", () => {
			const { cache } = makeCache();
			cache.inFrame = true;
			cache.get("quad", "triangle-list", "normal", true);
			expect(cache.inFrameMisses).toBe(1);
			expect(cache.inFrameMissKeys).toEqual([
				cache.keyFor("quad", "triangle-list", "normal", true),
			]);
			// a second lookup of the same pipeline is not a compile
			cache.get("quad", "triangle-list", "normal", true);
			expect(cache.inFrameMisses).toBe(1);
		});

		it("does not count one built between frames", () => {
			const { cache } = makeCache();
			cache.inFrame = false;
			cache.get("quad", "triangle-list", "normal", true);
			expect(cache.inFrameMisses).toBe(0);
		});

		it("does not count a draw that finds its pipeline warmed", async () => {
			const { device, cache } = makeCache();
			const warming = cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"bgra8unorm",
				1,
			);
			await settle();
			device.asyncRequests[0].resolve();
			await warming;
			cache.inFrame = true;
			cache.get("quad", "triangle-list", "normal", true);
			expect(cache.inFrameMisses).toBe(0);
		});

		it("keeps only the newest keys", () => {
			const { cache } = makeCache();
			cache.inFrame = true;
			for (let i = 0; i < 70; i++) {
				cache.get(`quad${i}`, "triangle-list", "normal", true);
			}
			expect(cache.inFrameMisses).toBe(70);
			expect(cache.inFrameMissKeys).toHaveLength(64);
			expect(cache.inFrameMissKeys.at(-1)).toContain("quad69|");
		});
	});

	describe("compiling off the frame", () => {
		it("compiles once for two requests of the same pipeline", async () => {
			const { device, cache } = makeCache();
			const args = [
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"bgra8unorm",
				1,
			];
			const first = cache.warm(...args);
			const second = cache.warm(...args);
			await settle();
			expect(second).toBe(first);
			expect(device.asyncRequests).toHaveLength(1);
			device.asyncRequests[0].resolve();
			await first;
			// and a third, once it is cached, compiles nothing
			await cache.warm(...args);
			expect(device.asyncRequests).toHaveLength(1);
		});

		it("never has more than 16 compiles in flight", async () => {
			const { device, cache } = makeCache();
			const all = [];
			for (let i = 0; i < 20; i++) {
				all.push(
					cache.warm(
						"quad",
						"triangle-list",
						"normal",
						true,
						"none",
						undefined,
						`format${i}`,
						1,
					),
				);
			}
			await settle();
			expect(device.asyncRequests).toHaveLength(16);
			// one finishing lets exactly one more start
			device.asyncRequests[0].resolve();
			await settle();
			expect(device.asyncRequests).toHaveLength(17);
			for (const request of device.asyncRequests.slice(1)) {
				request.resolve();
			}
			await settle();
			for (const request of device.asyncRequests.slice(17)) {
				request.resolve();
			}
			await Promise.all(all);
			expect(cache.pipelines.size).toBe(20);
		});

		it("settles without a pipeline when the compile fails", async () => {
			const { device, cache } = makeCache();
			const warming = cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"bgra8unorm",
				1,
			);
			await settle();
			device.asyncRequests[0].reject(new Error("validation"));
			await expect(warming).resolves.toBeUndefined();
			expect(cache.pending.size).toBe(0);
			// the draw builds it itself and reports, as it did before
			cache.get("quad", "triangle-list", "normal", true);
			expect(device.syncPipelines).toHaveLength(1);
		});

		it("keeps the copy a draw built while the warm-up was compiling", async () => {
			// the draws already recorded hold that one, so swapping the cached
			// object for the warm-up's would give two pipelines one name
			const { device, cache } = makeCache();
			const warming = cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"bgra8unorm",
				1,
			);
			// compiling by the time the draw comes: one queued but not yet
			// started is skipped instead, see the case above
			await settle();
			expect(device.asyncRequests).toHaveLength(1);
			const drawn = cache.get("quad", "triangle-list", "normal", true);
			device.asyncRequests[0].resolve();
			await warming;
			expect(cache.get("quad", "triangle-list", "normal", true)).toBe(drawn);
		});

		it("does not compile a queued warm-up a draw has already built", async () => {
			// sixteen compiling, so the next one waits in the queue
			const { device, cache } = makeCache();
			for (let i = 0; i < 16; i++) {
				cache.warm(
					"quad",
					"triangle-list",
					"normal",
					true,
					"none",
					undefined,
					`format${i}`,
					1,
				);
			}
			const queued = cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"bgra8unorm",
				1,
			);
			await settle();
			expect(device.asyncRequests).toHaveLength(16);
			// the frame cannot wait for it, and builds its own
			const drawn = cache.get("quad", "triangle-list", "normal", true);
			expect(device.syncPipelines).toHaveLength(1);
			// a slot frees up and the queued job's turn comes
			device.asyncRequests[0].resolve();
			await settle();
			expect(device.asyncRequests).toHaveLength(16);
			await expect(queued).resolves.toBeUndefined();
			expect(cache.pending.size).toBe(15);
			expect(cache.get("quad", "triangle-list", "normal", true)).toBe(drawn);
		});

		it("falls back to synchronous creation where async is missing", async () => {
			const { device, cache } = makeCache({ async: false });
			await cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"bgra8unorm",
				1,
			);
			expect(device.syncPipelines).toHaveLength(1);
			expect(cache.get("quad", "triangle-list", "normal", true)).toBe(
				device.syncPipelines[0],
			);
		});

		it("drops what was compiling for a cleared cache", async () => {
			const { device, cache } = makeCache();
			const inFlight = cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"bgra8unorm",
				1,
			);
			await settle();
			cache.clear();
			device.asyncRequests[0].resolve();
			await inFlight;
			expect(cache.pipelines.size).toBe(0);
		});

		it("settles the queued warm-ups of a cleared cache", async () => {
			// anything awaiting them must not wait forever
			const { cache } = makeCache();
			const queued = [];
			for (let i = 0; i < 18; i++) {
				queued.push(
					cache.warm(
						"quad",
						"triangle-list",
						"normal",
						true,
						"none",
						undefined,
						`format${i}`,
						1,
					),
				);
			}
			await settle();
			cache.clear();
			await expect(Promise.all(queued.slice(16))).resolves.toBeDefined();
		});
	});

	describe("collecting what one caller asked for", () => {
		const warmFor = (cache, format) => {
			return cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				format,
				1,
			);
		};

		it("hands back what it started and what was already compiling", async () => {
			// what a state change waits on before drawing its stage: every
			// pipeline that stage needs and does not have yet, including one
			// someone else had already started
			const { cache } = makeCache();
			const already = warmFor(cache, "rgba8unorm");
			const asked = cache.collect(() => {
				warmFor(cache, "bgra8unorm");
				warmFor(cache, "rgba8unorm");
			});
			expect(asked).toHaveLength(2);
			expect(asked[0]).toBe(
				cache.pending.get(
					cache.keyFor(
						"quad",
						"triangle-list",
						"normal",
						true,
						"none",
						undefined,
						"bgra8unorm",
						1,
					),
				),
			);
			expect(asked[1]).toBe(already);
		});

		it("leaves out what it did not ask for, and what is built", async () => {
			// the loading screen's warm-ups must not wait behind everything
			// `prewarm` happens to be compiling
			const { device, cache } = makeCache();
			const built = warmFor(cache, "bgra8unorm");
			await settle();
			device.asyncRequests[0].resolve();
			await built;
			void warmFor(cache, "rgba16float");
			const asked = cache.collect(() => {
				warmFor(cache, "bgra8unorm");
			});
			expect(asked).toHaveLength(0);
			// and stops collecting once it returns
			void warmFor(cache, "rgba8unorm");
			expect(asked).toHaveLength(0);
		});
	});

	describe("binding a warmed pipeline once", () => {
		it("sets every warmed pipeline in a 1x1 pass of its own target", async () => {
			// some implementations accept async creation and still compile at
			// the first setPipeline; this makes that first use happen now
			const { device, cache } = makeCache();
			const a = cache.warm(
				"quad",
				"triangle-list",
				"normal",
				true,
				"none",
				undefined,
				"rgba16float",
				4,
			);
			const b = cache.warm(
				"quad",
				"triangle-list",
				"additive",
				true,
				"none",
				undefined,
				"rgba16float",
				4,
			);
			await settle();
			device.asyncRequests[0].resolve();
			device.asyncRequests[1].resolve();
			await Promise.all([a, b]);
			await settle();

			// one submit, one pass for the target shape, both pipelines set
			expect(device.submits).toHaveLength(1);
			const [pass] = device.submits[0].passes;
			expect(pass.ended).toBe(true);
			expect(pass.pipelines).toEqual([
				cache.pipelines.get(
					cache.keyFor(
						"quad",
						"triangle-list",
						"normal",
						true,
						"none",
						undefined,
						"rgba16float",
						4,
					),
				),
				cache.pipelines.get(
					cache.keyFor(
						"quad",
						"triangle-list",
						"additive",
						true,
						"none",
						undefined,
						"rgba16float",
						4,
					),
				),
			]);
			// against attachments a pipeline of that shape validates with
			const color = pass.descriptor.colorAttachments[0].view.texture;
			const depth = pass.descriptor.depthStencilAttachment.view.texture;
			expect(color.descriptor).toMatchObject({
				format: "rgba16float",
				sampleCount: 4,
				size: [1, 1],
			});
			expect(depth.descriptor).toMatchObject({
				format: "depth24plus-stencil8",
				sampleCount: 4,
			});
		});

		it("reuses one scratch target per shape", async () => {
			const { device, cache } = makeCache();
			for (const blend of ["normal", "additive"]) {
				const warming = cache.warm(
					"quad",
					"triangle-list",
					blend,
					true,
					"none",
					undefined,
					"bgra8unorm",
					1,
				);
				await settle();
				device.asyncRequests.at(-1).resolve();
				await warming;
				await settle();
			}
			expect(device.submits).toHaveLength(2);
			// a colour and a depth texture, made once and reused
			expect(device.textures).toHaveLength(2);
		});
	});
});
