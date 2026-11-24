import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	TileLayer,
	Tileset,
	TilesetGroup,
	video,
	WebGLRenderer,
} from "../src/index.js";
import { grabFrame } from "./helpers/pixels.js";

/**
 * A tile layer drawn by the GPU keeps a texture of its cells with the
 * renderer. A level change frees them all, but a layer can also leave while
 * the game runs (a level of a world streamed out): its texture, and the layer
 * itself, were then kept until the next level change.
 */
const SIZE = 64;
const TILE = 8;

describe("the GPU texture of a tile layer that leaves the world", () => {
	let app;
	let renderer;
	let tileset;

	beforeAll(async () => {
		boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			antiAlias: false,
			backgroundColor: "#000000",
		});
		await app.init();
		renderer = app.renderer;
		const image = document.createElement("canvas");
		image.width = TILE * 4;
		image.height = TILE;
		const c = image.getContext("2d");
		for (let i = 0; i < 4; i++) {
			c.fillStyle = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"][i];
			c.fillRect(i * TILE, 0, TILE, TILE);
		}
		tileset = new Tileset({ image, tilewidth: TILE, tileheight: TILE });
	});

	afterAll(() => {
		app.destroy();
	});

	const makeLayer = () => {
		const layer = new TileLayer({
			name: "ground",
			cols: 8,
			rows: 8,
			tilewidth: TILE,
			tileheight: TILE,
			tilesets: new TilesetGroup([tileset]),
		});
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				layer.setCell(col, row, 1 + ((col + row) % 4));
			}
		}
		return layer;
	};

	const draw = async () => {
		app.world.update(16);
		app.isDirty = true;
		app.draw();
		return Array.from((await grabFrame(renderer)).data);
	};

	/** the layers the GPU tile renderers keep a texture for */
	const kept = () => {
		const layers = [];
		for (const gpu of renderer._tileLayerRenderers?.values() ?? []) {
			layers.push(...gpu.resources.keys());
		}
		return layers;
	};

	it("is freed when the layer is removed, and made again if it comes back", async (ctx) => {
		if (!(renderer instanceof WebGLRenderer)) {
			ctx.skip("WebGL is not available");
		}
		const layer = makeLayer();
		app.world.addChild(layer);
		const first = await draw();
		if (layer.renderMode !== "shader") {
			ctx.skip("the GPU tile path is not available");
		}
		expect(kept()).toEqual([layer]);
		// something was drawn
		expect(
			first.some((v, i) => {
				return i % 4 !== 3 && v !== 0;
			}),
		).toBe(true);

		const deleted = vi.spyOn(renderer.gl, "deleteTexture");
		app.world.removeChildNow(layer, true);
		expect(kept()).toEqual([]);
		expect(deleted).toHaveBeenCalledTimes(1);
		deleted.mockRestore();
		expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);

		// back in the world: the same picture, from a texture made anew
		app.world.addChild(layer);
		expect(await draw()).toEqual(first);
		expect(kept()).toEqual([layer]);
		expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
		app.world.removeChildNow(layer);
		expect(kept()).toEqual([]);
	});

	it("frees only that layer's: the others are still drawn", async (ctx) => {
		if (!(renderer instanceof WebGLRenderer)) {
			ctx.skip("WebGL is not available");
		}
		const stays = makeLayer();
		const leaves = makeLayer();
		leaves.pos.set(0, 0);
		app.world.addChild(stays, 1);
		app.world.addChild(leaves, 2);
		const both = await draw();
		if (stays.renderMode !== "shader") {
			ctx.skip("the GPU tile path is not available");
		}
		expect(kept()).toHaveLength(2);
		app.world.removeChildNow(leaves);
		expect(kept()).toEqual([stays]);
		// the same cells in both: the picture is the same with one
		expect(await draw()).toEqual(both);
		expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
		app.world.removeChildNow(stays);
		expect(kept()).toEqual([]);
	});
});
