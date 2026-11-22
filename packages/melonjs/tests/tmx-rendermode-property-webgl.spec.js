import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { video } from "../src/index.js";
import {
	fill,
	makeApp,
	makeMap,
	makeTileset,
	show,
} from "./helpers/tile-layer-compare.js";

/**
 * A Tiled tile layer's `renderMode` custom property, where it changes
 * something: on WebGL, a layer of one tileset is drawn by the shader unless
 * it asks otherwise. The property was applied and then overwritten by the
 * default, so the layer was drawn by the shader whatever the map asked.
 */
describe("a Tiled layer's renderMode property on WebGL", () => {
	let app;

	beforeAll(async () => {
		app = await makeApp(video.WEBGL, "WebGL");
	});

	afterAll(() => {
		app?.destroy();
	});

	const requireWebGL = (ctx) => {
		if (!app) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	/** a map of one layer, in the world, with the given layer properties */
	const activeLayer = (properties) => {
		const scene = {
			orientation: "orthogonal",
			cols: 8,
			rows: 6,
			tw: 16,
			th: 16,
			tilesets: [makeTileset({ tw: 16, th: 16 })],
			layers: [
				{
					data: fill(8, 6, (x, y) => {
						return 1 + ((x + y) % 8);
					}),
					...(properties ? { properties } : {}),
				},
			],
		};
		return show(app, makeMap(scene))[0];
	};

	it("with no property, the layer is drawn by the shader", (ctx) => {
		requireWebGL(ctx);
		expect(activeLayer(undefined).renderMode).toBe("shader");
	});

	it("'perTile' keeps the layer off the shader", (ctx) => {
		requireWebGL(ctx);
		const layer = activeLayer([
			{ name: "renderMode", type: "string", value: "perTile" },
		]);
		expect(layer.renderMode).toBe("perTile");
		expect(layer.preRender).toBe(false);
	});

	it("'prerender' bakes the layer", (ctx) => {
		requireWebGL(ctx);
		const layer = activeLayer([
			{ name: "renderMode", type: "string", value: "prerender" },
		]);
		expect(layer.renderMode).toBe("prerender");
		expect(layer.preRender).toBe(true);
		expect(layer.canvasRenderer).toBeDefined();
	});

	it("'auto', spelled out, is the shader too", (ctx) => {
		requireWebGL(ctx);
		const layer = activeLayer([
			{ name: "renderMode", type: "string", value: "auto" },
		]);
		expect(layer.renderMode).toBe("shader");
	});
});
