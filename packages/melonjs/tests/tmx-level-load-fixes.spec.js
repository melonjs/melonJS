import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	event,
	level,
	loader,
	TMXTileMap,
	video,
} from "../src/index.js";

/**
 * Two faults in loading a Tiled level.
 *
 * A tile layer's `renderMode` custom property is documented to choose how the
 * layer is drawn. The layer applied its properties and then set `renderMode`
 * to its default, so the property never had any effect.
 *
 * A level that sets the viewport's bounds follows the viewport's size with a
 * resize handler. The handler was a new function on every load, so the
 * "remove the previous one" before adding it removed nothing: one more stayed
 * registered for each level loaded, each setting its own level's bounds on
 * every resize, and each keeping its level alive.
 */
const map = (name, cols, layerProperties) => {
	return {
		type: "map",
		version: "1.10",
		tiledversion: "1.12.0",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: cols,
		height: 4,
		tilewidth: 16,
		tileheight: 16,
		nextobjectid: 1,
		tilesets: [],
		layers: [
			{
				id: 1,
				name,
				type: "tilelayer",
				visible: true,
				opacity: 1,
				x: 0,
				y: 0,
				width: cols,
				height: 4,
				data: new Array(cols * 4).fill(0),
				...(layerProperties ? { properties: layerProperties } : {}),
			},
		],
	};
};

describe("loading a Tiled level", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		await loader.preload(
			[
				{ name: "fix-level-a", type: "tmx", data: map("a", 40) },
				{ name: "fix-level-b", type: "tmx", data: map("b", 60) },
			],
			undefined,
			false,
		);
	});

	afterAll(() => {
		app?.destroy();
	});

	describe("a tile layer's renderMode property", () => {
		const layerOf = (properties) => {
			const tmx = new TMXTileMap("render-mode", map("layer", 4, properties));
			return tmx.getLayers()[0];
		};

		it("is 'auto' with no property", () => {
			expect(layerOf(undefined).renderMode).toBe("auto");
		});

		it.each(["perTile", "prerender", "shader"])(
			"takes '%s' from the property",
			(mode) => {
				const layer = layerOf([
					{ name: "renderMode", type: "string", value: mode },
				]);
				expect(layer.renderMode).toBe(mode);
			},
		);

		it("a forced 'perTile' is what the layer draws with once active", () => {
			const layer = layerOf([
				{ name: "renderMode", type: "string", value: "perTile" },
			]);
			app.world.addChild(layer);
			expect(layer.renderMode).toBe("perTile");
			expect(layer.preRender).toBe(false);
			app.world.removeChildNow(layer);
		});

		it("still lets the game set it after the layer is built", () => {
			const layer = layerOf(undefined);
			layer.renderMode = "prerender";
			expect(layer.renderMode).toBe("prerender");
		});
	});

	describe("the viewport following a level", () => {
		const load = (id) => {
			return level.load(id, { container: app.world, async: true });
		};
		/** resize, and return the bounds each handler still registered set */
		const boundsSetOnResize = () => {
			const setBounds = vi.spyOn(app.viewport, "setBounds");
			event.emit(event.VIEWPORT_ONRESIZE, 320, 240);
			const widths = setBounds.mock.calls.map((call) => {
				return call[2];
			});
			setBounds.mockRestore();
			return widths;
		};

		it("takes the bounds of the level loaded", async () => {
			await load("fix-level-a");
			expect(app.viewport.bounds.width).toBe(40 * 16);
			await load("fix-level-b");
			expect(app.viewport.bounds.width).toBe(60 * 16);
		});

		it("a resize sets the bounds once, for the level in place", async () => {
			await load("fix-level-a");
			await load("fix-level-b");
			await load("fix-level-a");
			await load("fix-level-b");
			// one handler, the last level's: not one per level ever loaded
			expect(boundsSetOnResize()).toEqual([60 * 16]);
		});

		it("the same level loaded again leaves one handler too", async () => {
			await load("fix-level-a");
			await load("fix-level-a");
			await load("fix-level-a");
			expect(boundsSetOnResize()).toEqual([40 * 16]);
		});

		it("a level destroyed is followed no longer", async () => {
			await load("fix-level-a");
			level.getCurrentLevel().destroy();
			expect(boundsSetOnResize()).toEqual([]);
		});

		it("a level added without the viewport's bounds registers nothing", async () => {
			await load("fix-level-a");
			level.getCurrentLevel().destroy();
			const tmx = new TMXTileMap("no-bounds", map("free", 8));
			tmx.addTo(app.world, true, false);
			expect(boundsSetOnResize()).toEqual([]);
			tmx.destroy();
		});
	});
});
