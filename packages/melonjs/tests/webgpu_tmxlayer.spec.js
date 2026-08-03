import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import OrthogonalTMXLayerGPURenderer from "../src/video/webgpu/renderers/tmxlayer/orthogonal.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The WebGPU orthogonal TMX tile path on the mock renderer: index-texture
 * version tracking, animation-lookup dirty semantics, per-tileset uniform
 * snapshots (dynamic offsets), and the recorded draw shape — one indexed
 * quad per tileset through the registered tmx shader family.
 */
describe("WebGPU orthogonal TMX layer renderer (mock)", () => {
	let renderer;
	let tmx;

	function makeLayer(options = {}) {
		const cols = options.cols ?? 8;
		const rows = options.rows ?? 4;
		return {
			cols,
			rows,
			tilewidth: 16,
			tileheight: 16,
			dataVersion: options.dataVersion ?? 1,
			layerData: new Uint16Array(cols * rows * 2),
			getOpacity() {
				return options.opacity ?? 1;
			},
			tint: null,
			tilesets: {
				tilesets: options.tilesets ?? [makeTileset()],
			},
		};
	}

	function makeTileset(options = {}) {
		return {
			isCollection: false,
			image: { width: 128, height: 64 },
			tilewidth: options.tilewidth ?? 16,
			tileheight: options.tileheight ?? 16,
			margin: 0,
			spacing: 0,
			firstgid: options.firstgid ?? 1,
			lastgid: options.lastgid ?? 32,
			isAnimated: options.animated === true,
			animations: options.animations ?? new Map(),
			texture: { name: `atlas-${options.firstgid ?? 1}` },
		};
	}

	const RECT = { pos: { x: 0, y: 0 }, width: 64, height: 32 };

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		renderer.setBatcher = () => {
			renderer.currentBatcher ??= new WebGPUQuadBatcher(renderer);
			return renderer.currentBatcher;
		};
		tmx = new OrthogonalTMXLayerGPURenderer(renderer);
	});

	it("registers the shader family once with the quad vertex layout", () => {
		expect(tmx.key).toMatch(/^effect:/);
		// a second instance (device-loss rebuild) reuses the module text
		const again = new OrthogonalTMXLayerGPURenderer(renderer);
		expect(again.key).toBe(tmx.key);
	});

	it("uploads the GID index once per data version", () => {
		const layer = makeLayer();
		tmx.draw(layer, RECT);
		const uploads = renderer.calls.textureWrites.length;
		expect(uploads).toBeGreaterThan(0);

		// same version → no re-upload
		tmx.draw(layer, RECT);
		expect(renderer.calls.textureWrites.length).toBe(uploads);

		// a setTile-style mutation bumps the version → one re-upload
		layer.dataVersion = 2;
		tmx.draw(layer, RECT);
		expect(renderer.calls.textureWrites.length).toBe(uploads + 1);
	});

	it("records one indexed quad per tileset with its own dynamic offset", () => {
		const layer = makeLayer({
			tilesets: [
				makeTileset({ firstgid: 1, lastgid: 16 }),
				makeTileset({ firstgid: 17, lastgid: 32 }),
			],
		});
		tmx.draw(layer, RECT);

		expect(renderer.calls.drawIndexed).toEqual([6, 6]);
		// two group-3 binds with DIFFERENT snapshot offsets (each tileset
		// pass owns its uniform bytes under queue-write ordering)
		const tmxBinds = renderer.calls.bindGroups.filter((bind) => {
			return bind.index === 3;
		});
		expect(tmxBinds).toHaveLength(2);
		expect(tmxBinds[0].dynamicOffsets[0]).not.toBe(
			tmxBinds[1].dynamicOffsets[0],
		);
		// each pass binds its tileset's atlas as the material
		const materials = renderer.calls.bindGroups.filter((bind) => {
			return bind.index === 1;
		});
		expect(materials).toHaveLength(2);
	});

	it("animation lookups upload only when a frame advanced", () => {
		const animations = new Map([[3, { cur: { tileid: 5 } }]]);
		const layer = makeLayer({
			tilesets: [makeTileset({ animated: true, animations })],
		});

		tmx.draw(layer, RECT);
		const uploads = renderer.calls.textureWrites.length;

		// same frame id → clean, no upload
		tmx.draw(layer, RECT);
		expect(renderer.calls.textureWrites.length).toBe(uploads);

		// the tileset advanced a frame → one lookup re-upload
		animations.get(3).cur.tileid = 6;
		tmx.draw(layer, RECT);
		expect(renderer.calls.textureWrites.length).toBe(uploads + 1);
	});

	it("a visible rect fully outside the layer draws nothing", () => {
		const layer = makeLayer();
		tmx.draw(layer, {
			pos: { x: 10000, y: 10000 },
			width: 64,
			height: 64,
		});
		expect(renderer.calls.drawIndexed).toEqual([]);
	});

	it("reset retires every lookup texture and clears the caches", () => {
		const retired = [];
		renderer.retireTexture = (texture) => {
			retired.push(texture);
		};
		const layer = makeLayer({
			tilesets: [
				makeTileset({
					animated: true,
					animations: new Map([[0, { cur: { tileid: 1 } }]]),
				}),
			],
		});
		tmx.draw(layer, RECT);
		tmx.reset();
		// index texture + anim lookup both retired
		expect(retired).toHaveLength(2);
		expect(tmx.resources.size).toBe(0);
		expect(tmx.animLookups.size).toBe(0);
	});
});
