import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import TMXLayerGPURenderer from "../src/video/webgpu/renderers/tmxlayer/tmxlayer.js";
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
		tmx = new TMXLayerGPURenderer(renderer, "orthogonal");
	});

	it("registers the shader family once with the quad vertex layout", () => {
		expect(tmx.key).toMatch(/^effect:/);
		// a second instance (device-loss rebuild) reuses the module text
		const again = new TMXLayerGPURenderer(renderer, "orthogonal");
		expect(again.key).toBe(tmx.key);
	});

	it("draws its quad in the sprite vertex layout, with no frame to keep to", () => {
		// four vertices of the quad batcher's own stride (it grew from 28 to
		// 36 bytes when sprite vertices took a frame): a quad written or bound
		// at another size is not drawn on a real device
		const layer = makeLayer();
		tmx.draw(layer, RECT);
		const batcher = renderer.currentBatcher;
		const size = 4 * batcher.stride;
		expect(batcher.stride).toBe(36);
		expect(renderer.calls.vertexBufferBinds.at(-1).size).toBe(size);
		const quad = renderer.calls.writes.find((write) => {
			return write.size === size;
		});
		expect(quad).toBeDefined();
		const floats = batcher.stride / 4;
		const uvs = [];
		for (let v = 0; v < 4; v++) {
			const at = v * floats;
			uvs.push(`${quad.floats[at + 3]},${quad.floats[at + 4]}`);
			// the whole index texture is read: no frame
			expect(quad.floats[at + 7]).toBe(-1e6);
		}
		expect(uvs.sort()).toEqual(["0,0", "0,1", "1,0", "1,1"]);
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

/**
 * The isometric orientation on the same renderer (#1897): its own shader
 * module, one pass with the layer's one tileset whatever the map has, and
 * the two run lengths its shader walks in place of the orthogonal overflow.
 * What it draws is compared with the CPU renderer, pixel by pixel, on a real
 * device in `webgpu_tmxlayer_isometric.spec.js`.
 */
describe("WebGPU isometric TMX layer renderer (mock)", () => {
	let renderer;
	let tmx;

	const tileset = (firstgid, tilewidth, tileheight) => {
		return {
			isCollection: false,
			image: { width: 256, height: 256 },
			tilewidth,
			tileheight,
			margin: 0,
			spacing: 0,
			tileoffset: { x: 0, y: 0 },
			firstgid,
			lastgid: firstgid + 15,
			isAnimated: false,
			animations: new Map(),
			texture: { name: `iso-atlas-${firstgid}` },
		};
	};
	const floor = tileset(1, 64, 32);
	const walls = tileset(17, 64, 128);

	const layerOf = (shaderTileset) => {
		return {
			orientation: "isometric",
			cols: 8,
			rows: 8,
			tilewidth: 64,
			tileheight: 32,
			dataVersion: 1,
			layerData: new Uint16Array(8 * 8 * 2),
			getOpacity() {
				return 1;
			},
			getRenderer() {
				return { originX: 8 * 32 };
			},
			tint: null,
			tilesets: { tilesets: [floor, walls] },
			_shaderTileset: shaderTileset,
		};
	};

	const RECT = { pos: { x: 100, y: 40 }, width: 320, height: 240 };

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		renderer.setBatcher = () => {
			renderer.currentBatcher ??= new WebGPUQuadBatcher(renderer);
			return renderer.currentBatcher;
		};
		tmx = new TMXLayerGPURenderer(renderer, "isometric");
	});

	it("has a shader module of its own", () => {
		const orthogonal = new TMXLayerGPURenderer(renderer, "orthogonal");
		expect(tmx.key).toMatch(/^effect:/);
		expect(tmx.key).not.toBe(orthogonal.key);
	});

	it("draws one quad, with the layer's tileset alone", () => {
		tmx.draw(layerOf(walls), RECT);
		expect(renderer.calls.drawIndexed).toEqual([6]);
		// the tiles' size, and how many cells' images reach a pixel: as
		// many across as the image is wide in half grid widths, as many
		// down as it is tall in half grid heights
		const uniforms = tmx.uniformScratch;
		expect([uniforms[4], uniforms[5]]).toEqual([64, 128]);
		expect([uniforms[6], uniforms[7]]).toEqual([2, 8]);
	});

	it("draws nothing for a layer with no tile yet", () => {
		tmx.draw(layerOf(undefined), RECT);
		expect(renderer.calls.drawIndexed).toEqual([]);
	});

	it("draws nothing where the view shows none of the layer", () => {
		tmx.draw(layerOf(floor), {
			pos: { x: 5000, y: 5000 },
			width: 320,
			height: 240,
		});
		expect(renderer.calls.drawIndexed).toEqual([]);
	});
});

/**
 * Staggered and hexagonal maps on the same renderer: one shader module for
 * both, with the map's column width, row height, stagger axis and index in
 * what was the uniform block's padding.
 */
describe("WebGPU staggered and hexagonal TMX layer renderer (mock)", () => {
	let renderer;

	const tileset = {
		isCollection: false,
		image: { width: 256, height: 256 },
		tilewidth: 28,
		tileheight: 48,
		margin: 0,
		spacing: 0,
		tileoffset: { x: 0, y: 0 },
		firstgid: 1,
		lastgid: 16,
		isAnimated: false,
		animations: new Map(),
		texture: { name: "hex-atlas" },
	};

	const layerOf = (orientation, map) => {
		return {
			orientation,
			cols: 8,
			rows: 8,
			tilewidth: 28,
			tileheight: 24,
			dataVersion: 1,
			layerData: new Uint16Array(8 * 8 * 2),
			getOpacity() {
				return 1;
			},
			getRenderer() {
				return map;
			},
			tint: null,
			tilesets: { tilesets: [tileset] },
			_shaderTileset: tileset,
		};
	};

	const RECT = { pos: { x: 10, y: 20 }, width: 320, height: 240 };

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		renderer.setBatcher = () => {
			renderer.currentBatcher ??= new WebGPUQuadBatcher(renderer);
			return renderer.currentBatcher;
		};
	});

	it("one shader module for both, apart from the other orientations'", () => {
		const staggered = new TMXLayerGPURenderer(renderer, "staggered");
		const hexagonal = new TMXLayerGPURenderer(renderer, "hexagonal");
		const isometric = new TMXLayerGPURenderer(renderer, "isometric");
		expect(hexagonal.key).toBe(staggered.key);
		expect(staggered.key).not.toBe(isometric.key);
	});

	it("hands the shader the map's lines: their spacing, axis and index", () => {
		const tmx = new TMXLayerGPURenderer(renderer, "hexagonal");
		// a hexagon side of 12 along x: columns 20 apart, rows of 12
		tmx.draw(
			layerOf("hexagonal", {
				columnwidth: 20,
				rowheight: 12,
				staggerX: true,
				staggerEven: true,
			}),
			RECT,
		);
		expect(renderer.calls.drawIndexed).toEqual([6]);
		const uniforms = tmx.uniformScratch;
		// axis x (1) and an even index (2)
		expect(uniforms[29]).toBe(3);
		expect([uniforms[30], uniforms[31]]).toEqual([20, 12]);
		// 28 pixels wide in spacings of 40, 48 tall in rows of 12
		expect([uniforms[6], uniforms[7]]).toEqual([1, 4]);

		const other = new TMXLayerGPURenderer(renderer, "staggered");
		other.draw(
			layerOf("staggered", {
				columnwidth: 14,
				rowheight: 12,
				staggerX: false,
				staggerEven: false,
			}),
			RECT,
		);
		expect(other.uniformScratch[29]).toBe(0);
		expect([other.uniformScratch[30], other.uniformScratch[31]]).toEqual([
			14, 12,
		]);
	});

	it("leaves them at 0 for the other orientations", () => {
		const tmx = new TMXLayerGPURenderer(renderer, "isometric");
		const layer = layerOf("isometric", { originX: 8 * 14 });
		tmx.draw(layer, RECT);
		expect(renderer.calls.drawIndexed).toEqual([6]);
		expect([...tmx.uniformScratch.slice(29, 32)]).toEqual([0, 0, 0]);
	});
});
