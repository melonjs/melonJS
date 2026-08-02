import "./helpers/webgpu-globals.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emit, GPU_TEXTURE_CACHE_RESET } from "../src/system/event.ts";
import WebGPUTextureStore from "../src/video/webgpu/texture/store.js";

/**
 * Unit tests for the WebGPU texture store against a mock device — the
 * record lifecycle here carries the backend's subtlest invariants:
 *
 * - a TextureCache unit number is NOT a stable identity (units are
 *   recycled across stage switches), so records revalidate their SOURCE
 * - queue writes execute before every draw recorded in a frame, so a
 *   record already sampled this frame must get a FRESH texture on a
 *   content change (an in-place re-upload would apply retroactively)
 * - destroying a GPUTexture referenced by recorded draws invalidates the
 *   whole submit, so replaced textures retire until frame end
 */
describe("WebGPUTextureStore", () => {
	let renderer;
	let store;
	let createdTextures;
	let uploads;

	function makeSource(width, height) {
		return { width, height };
	}

	function makeAtlas(source, options = {}) {
		return {
			getTexture() {
				return source;
			},
			repeat: options.repeat ?? "no-repeat",
			premultipliedAlpha: options.premultipliedAlpha,
			filter: options.filter,
			__unit: options.unit ?? 0,
		};
	}

	beforeEach(() => {
		createdTextures = [];
		uploads = [];
		const device = {
			createTexture(descriptor) {
				const texture = {
					label: descriptor.label,
					size: descriptor.size,
					destroyed: false,
					destroy() {
						this.destroyed = true;
					},
					createView() {
						return { texture: this };
					},
				};
				createdTextures.push(texture);
				return texture;
			},
			createSampler(descriptor) {
				return { descriptor };
			},
			createBindGroup(descriptor) {
				return { descriptor };
			},
			queue: {
				copyExternalImageToTexture(src, dst, size) {
					uploads.push({
						source: src.source,
						texture: dst.texture,
						premultipliedAlpha: dst.premultipliedAlpha,
						size,
					});
				},
			},
		};
		renderer = {
			device,
			frameId: 1,
			commandEncoder: null,
			retiredTextures: [],
			cache: {
				getUnit(texture) {
					return texture.__unit;
				},
				peekAllUnits(texture) {
					return [texture.__unit];
				},
			},
			pipelineCache: { materialLayout: {} },
			getDefaultTextureFilter() {
				return "nearest";
			},
		};
		store = new WebGPUTextureStore(renderer);
	});

	afterEach(() => {
		// unsubscribe from GPU_TEXTURE_CACHE_RESET so stores from earlier
		// tests don't react to the event-emission test below
		store.destroy();
	});

	it("first use creates a texture at source size and uploads once", () => {
		const atlas = makeAtlas(makeSource(64, 32));
		const binding = store.getBinding(atlas);

		expect(createdTextures).toHaveLength(1);
		expect(createdTextures[0].size).toEqual([64, 32]);
		expect(uploads).toHaveLength(1);
		expect(uploads[0].size).toEqual([64, 32]);
		// UNPACK_PREMULTIPLY_ALPHA_WEBGL parity: premultiplied by default
		expect(uploads[0].premultipliedAlpha).toBe(true);

		// second lookup: resident — no new texture, no re-upload, same group
		const again = store.getBinding(atlas);
		expect(again).toBe(binding);
		expect(createdTextures).toHaveLength(1);
		expect(uploads).toHaveLength(1);
	});

	it("premultipliedAlpha: false on the atlas is honored on upload", () => {
		store.getBinding(
			makeAtlas(makeSource(8, 8), { premultipliedAlpha: false }),
		);
		expect(uploads[0].premultipliedAlpha).toBe(false);
	});

	it("video sources fall back to videoWidth/videoHeight", () => {
		const video = { width: 0, height: 0, videoWidth: 320, videoHeight: 240 };
		store.getBinding(makeAtlas(video));
		expect(createdTextures[0].size).toEqual([320, 240]);
	});

	it("a recycled unit serving a same-size NEW source re-uploads in place (next frame)", () => {
		const first = makeAtlas(makeSource(32, 32), { unit: 3 });
		store.getBinding(first);

		// stage switch: unit 3 recycled for a different same-size source
		renderer.frameId = 2;
		const second = makeAtlas(makeSource(32, 32), { unit: 3 });
		store.getBinding(second);

		// resident texture reused, but the new pixels were uploaded
		expect(createdTextures).toHaveLength(1);
		expect(uploads).toHaveLength(2);
		expect(uploads[1].source).toBe(second.getTexture());
	});

	it("a recycled unit with a DIFFERENT-size source gets a fresh texture", () => {
		const first = makeAtlas(makeSource(32, 32), { unit: 3 });
		store.getBinding(first);

		renderer.frameId = 2;
		const second = makeAtlas(makeSource(64, 64), { unit: 3 });
		store.getBinding(second);

		expect(createdTextures).toHaveLength(2);
		expect(createdTextures[1].size).toEqual([64, 64]);
	});

	it("a same-frame content change gets a FRESH texture, never an in-place clobber", () => {
		const source = makeSource(16, 16);
		const atlas = makeAtlas(source);
		store.getBinding(atlas);

		// same frame, same source object, content changed (Text/gradient
		// canvas mutated) — force re-upload
		store.getBinding(atlas, { force: true });

		// an in-place upload would retroactively change the earlier draws
		expect(createdTextures).toHaveLength(2);
		expect(uploads).toHaveLength(2);
		expect(uploads[1].texture).toBe(createdTextures[1]);
	});

	it("a forced re-upload on a LATER frame reuses the resident texture", () => {
		const atlas = makeAtlas(makeSource(16, 16));
		store.getBinding(atlas);

		renderer.frameId = 2;
		store.getBinding(atlas, { force: true });

		expect(createdTextures).toHaveLength(1);
		expect(uploads).toHaveLength(2);
	});

	it("replaced textures retire while a frame is recording, destroy otherwise", () => {
		const atlas = makeAtlas(makeSource(16, 16));
		store.getBinding(atlas);

		// no encoder → nothing recorded references the old texture
		store.getBinding(atlas, { force: true });
		expect(createdTextures[0].destroyed).toBe(true);
		expect(renderer.retiredTextures).toHaveLength(0);

		// encoder open → recorded draws may reference it: park, don't destroy
		renderer.commandEncoder = {};
		store.getBinding(atlas, { force: true });
		expect(createdTextures[1].destroyed).toBe(false);
		expect(renderer.retiredTextures).toEqual([createdTextures[1]]);
	});

	it("samplers map per-axis repeat modes and are cached per combination", () => {
		const repeatX = store.getSampler("nearest", "repeat-x");
		expect(repeatX.descriptor.addressModeU).toBe("repeat");
		expect(repeatX.descriptor.addressModeV).toBe("clamp-to-edge");

		const repeatY = store.getSampler("nearest", "repeat-y");
		expect(repeatY.descriptor.addressModeU).toBe("clamp-to-edge");
		expect(repeatY.descriptor.addressModeV).toBe("repeat");

		const repeat = store.getSampler("linear", "repeat");
		expect(repeat.descriptor.addressModeU).toBe("repeat");
		expect(repeat.descriptor.addressModeV).toBe("repeat");

		// cache hit: same combination returns the same sampler object
		expect(store.getSampler("nearest", "repeat-x")).toBe(repeatX);
	});

	it("invalidateBindGroups drops pairings but keeps textures resident", () => {
		const atlas = makeAtlas(makeSource(8, 8));
		const before = store.getBinding(atlas);

		store.invalidateBindGroups();
		const after = store.getBinding(atlas);

		expect(after).not.toBe(before);
		expect(createdTextures).toHaveLength(1);
		expect(uploads).toHaveLength(1);
	});

	it("destroyTexture sweeps every unit of the source", () => {
		const atlas = makeAtlas(makeSource(8, 8), { unit: 5 });
		store.getBinding(atlas);

		store.destroyTexture(atlas);
		expect(createdTextures[0].destroyed).toBe(true);

		// gone: next lookup re-creates
		store.getBinding(atlas);
		expect(createdTextures).toHaveLength(2);
	});

	it("GPU_TEXTURE_CACHE_RESET releases every record", () => {
		const atlas = makeAtlas(makeSource(8, 8));
		store.getBinding(atlas);

		emit(GPU_TEXTURE_CACHE_RESET);
		expect(createdTextures[0].destroyed).toBe(true);

		store.getBinding(atlas);
		expect(createdTextures).toHaveLength(2);
	});

	it("destroy unsubscribes from the cache-reset event", () => {
		store.destroy();
		// a later emit must not touch (or resurrect) anything
		expect(() => {
			emit(GPU_TEXTURE_CACHE_RESET);
		}).not.toThrow();
	});
});
