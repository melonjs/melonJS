import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	level,
	loader,
	state,
	TileLayer,
	Tileset,
	TilesetGroup,
	Vector2d,
	video,
} from "../src/index.js";
import { copyFrame } from "./helpers/pixels.js";

/**
 * A tile layer scrolls by its `ratio`, a vector the layer is drawn by. What
 * sets it must never leave it anything but two numbers: a custom property of
 * that name in a Tiled map (the one an image layer takes, which did nothing
 * on a tile layer before 20.18), a definition that gives one part, a call
 * that sets one part. A layer placed by something that is not a number is
 * drawn nowhere, and a loop over its cells would not end.
 */

const TILE = 16;
const SHEET = new URL(
	"./fixtures/spritefusion/spritesheet.png",
	import.meta.url,
).href;
// the first tile of the sheet
const GROUND = [0, 160, 0];

const tileLayer = (name, extra = {}) => {
	return {
		type: "tilelayer",
		name,
		visible: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 4,
		height: 2,
		data: [1, 1, 1, 1, 1, 1, 1, 1],
		...extra,
	};
};

const mapJSON = (layers) => {
	return {
		type: "map",
		version: "1.10",
		tiledversion: "1.11.0",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 4,
		height: 2,
		tilewidth: TILE,
		tileheight: TILE,
		nextobjectid: 1,
		tilesets: [
			{
				firstgid: 1,
				name: "tiles",
				image: "spritesheet.png",
				tilewidth: TILE,
				tileheight: TILE,
			},
		],
		layers,
	};
};

const property = (name, type, value) => {
	return { properties: [{ name, type, value }] };
};

describe.each([
	["Canvas", video.CANVAS],
	["WebGL", video.WEBGL],
])("a tile layer's ratio, whatever sets it (%s)", (label, renderer) => {
	let app;
	let serial = 0;

	const load = async (layers) => {
		const name = `ratio-${label}-${serial++}`;
		await loader.preload(
			[{ name, type: "tmx", data: mapJSON(layers) }],
			undefined,
			false,
		);
		app.world.reset();
		await level.load(name, { container: app.world, async: true });
		return level.getCurrentLevel();
	};

	/** draw a frame, and the colour in the middle of the view's first cell */
	const firstCell = () => {
		app.world.update(16);
		app.viewport.update(16);
		app.repaint();
		app.draw();
		const frame = copyFrame(app.renderer);
		const at = ((TILE / 2) * frame.width + TILE / 2) * 4;
		return [frame.data[at], frame.data[at + 1], frame.data[at + 2]];
	};

	beforeAll(async () => {
		boot();
		app = new Application(4 * TILE, 2 * TILE, {
			parent: "screen",
			renderer,
			consoleHeader: false,
			antiAlias: false,
		});
		await app.init();
		state.change(state.DEFAULT, true);
		await loader.preload(
			[{ name: "spritesheet", type: "image", src: SHEET }],
			undefined,
			false,
		);
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	it("is set by a `ratio` property of a Tiled layer, a number", async () => {
		const map = await load([
			tileLayer("hills", property("ratio", "float", 0.5)),
		]);
		const [hills] = map.getLayers();
		expect(hills.ratio).toBeInstanceOf(Vector2d);
		expect([hills.ratio.x, hills.ratio.y]).toEqual([0.5, 0.5]);
		// and the layer is drawn: the camera is where the layer was placed
		expect(firstCell()).toEqual(GROUND);
	});

	it("is set by one written as text, as an image layer's is", async () => {
		const map = await load([
			tileLayer("hills", property("ratio", "string", "0.25")),
		]);
		const [hills] = map.getLayers();
		expect(hills.ratio).toBeInstanceOf(Vector2d);
		expect([hills.ratio.x, hills.ratio.y]).toEqual([0.25, 0.25]);
		expect(typeof hills.ratio.set).toBe("function");
		expect(firstCell()).toEqual(GROUND);
	});

	it("is set by an attribute, one part or both", async () => {
		const map = await load([
			tileLayer("both", { attributes: { ratio: { x: 0.5, y: 2 } } }),
			tileLayer("one", { attributes: { ratio: { x: 0.5 } } }),
		]);
		const [both, one] = map.getLayers();
		expect([both.ratio.x, both.ratio.y]).toEqual([0.5, 2]);
		expect([one.ratio.x, one.ratio.y]).toEqual([0.5, 1]);
		expect(firstCell()).toEqual(GROUND);
	});

	it("goes over the layer's Tiled factor, and under its group's", async () => {
		const map = await load([
			tileLayer("plain", {
				parallaxx: 0.5,
				parallaxy: 0.5,
				...property("ratio", "float", 0.8),
			}),
			{
				type: "group",
				name: "far",
				visible: true,
				opacity: 1,
				parallaxx: 0.5,
				parallaxy: 0.25,
				layers: [tileLayer("grouped", property("ratio", "float", 0.5))],
			},
		]);
		const [plain] = map.getLayers();
		expect([plain.ratio.x, plain.ratio.y]).toEqual([0.8, 0.8]);
		// the group's layer is in the world: the group's factor times its own
		const [grouped] = app.world.getChildByName("grouped");
		expect(grouped.ratio).toBeInstanceOf(Vector2d);
		expect([grouped.ratio.x, grouped.ratio.y]).toEqual([0.25, 0.125]);
		expect(firstCell()).toEqual(GROUND);
	});

	it("is left as it was by a property that is not a number, with a warning", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {
			// kept quiet
		});
		try {
			const map = await load([
				tileLayer(`text-${label}`, property("ratio", "string", "fast")),
				tileLayer(`flag-${label}`, property("ratio", "bool", true)),
				tileLayer(`list-${label}`, { attributes: { ratio: [0.5, 0.5] } }),
				tileLayer(`half-${label}`, {
					attributes: { ratio: { x: "a", y: 0.5 } },
				}),
				tileLayer(`origin-${label}`, { attributes: { parallaxOrigin: "top" } }),
				tileLayer(`anchor-${label}`, {
					attributes: { parallaxAnchor: Number.NaN },
				}),
			]);
			for (const layer of map.getLayers()) {
				expect(layer.ratio, layer.name).toBeInstanceOf(Vector2d);
				expect([layer.ratio.x, layer.ratio.y], layer.name).toEqual([1, 1]);
				expect(layer.parallaxOrigin, layer.name).toBeInstanceOf(Vector2d);
				expect(layer.parallaxAnchor, layer.name).toBeInstanceOf(Vector2d);
				expect(
					[layer.parallaxAnchor.x, layer.parallaxAnchor.y],
					layer.name,
				).toEqual([0, 0]);
			}
			expect(firstCell()).toEqual(GROUND);
			const said = warn.mock.calls.filter(([message]) => {
				return String(message).includes("property is not a number");
			});
			expect(said.length).toBeGreaterThanOrEqual(1);
		} finally {
			warn.mockRestore();
		}
	});

	it("takes the other scrolling settings from properties the same way", async () => {
		const map = await load([
			tileLayer("set", {
				attributes: {
					parallaxOrigin: { x: 32, y: 16 },
					parallaxAnchor: 0.5,
					parallaxScale: 2,
				},
			}),
		]);
		const [layer] = map.getLayers();
		expect([layer.parallaxOrigin.x, layer.parallaxOrigin.y]).toEqual([32, 16]);
		expect([layer.parallaxAnchor.x, layer.parallaxAnchor.y]).toEqual([
			0.5, 0.5,
		]);
		expect(layer.parallaxScale).toBe(2);
	});

	describe("on a layer built in code", () => {
		const build = (extra = {}) => {
			const tileset = new Tileset({
				name: "tiles",
				image: "spritesheet",
				tilewidth: TILE,
				tileheight: TILE,
			});
			const layer = new TileLayer({
				name: "built",
				cols: 4,
				rows: 2,
				tilewidth: TILE,
				tileheight: TILE,
				tilesets: new TilesetGroup([tileset]),
				...extra,
			});
			for (let col = 0; col < 4; col++) {
				layer.setCell(col, 0, tileset.firstgid);
				layer.setCell(col, 1, tileset.firstgid);
			}
			return layer;
		};

		const show = (layer) => {
			app.world.reset();
			app.world.addChild(layer);
			return firstCell();
		};

		it("keeps the part a definition leaves out", () => {
			const layer = build({ ratio: { x: 0.5 } });
			expect([layer.ratio.x, layer.ratio.y]).toEqual([0.5, 1]);
			const other = build({ ratio: { y: 0 }, parallaxAnchor: { x: 0.5 } });
			expect([other.ratio.x, other.ratio.y]).toEqual([1, 0]);
			expect([other.parallaxAnchor.x, other.parallaxAnchor.y]).toEqual([
				0.5, 0,
			]);
			expect(show(layer)).toEqual(GROUND);
		});

		it("refuses a definition that is not a number", () => {
			for (const ratio of [
				Number.NaN,
				Number.POSITIVE_INFINITY,
				{ x: 0.5, y: Number.NaN },
				{ x: "half", y: 1 },
				"0.5",
				[0.5, 0.5],
			]) {
				expect(() => {
					build({ ratio });
				}, JSON.stringify(ratio)).toThrow(/ratio must be a number/);
			}
			expect(() => {
				build({ parallaxOrigin: { x: Number.NaN, y: 0 } });
			}).toThrow(/parallaxOrigin must be a number/);
		});

		it("still draws when the vector is set with one part, or replaced", () => {
			// each of these placed the layer nowhere, and hung the Canvas draw
			const oneArgument = build();
			oneArgument.ratio.set(0.5);
			expect(show(oneArgument)).toEqual(GROUND);

			const replaced = build();
			replaced.ratio = 0.5;
			expect(() => {
				show(replaced);
			}).not.toThrow();

			const notANumber = build();
			notANumber.ratio.set(Number.NaN, Number.NaN);
			expect(show(notANumber)).toEqual(GROUND);

			// an origin that is not a number: nothing to draw, and no hang
			const lostOrigin = build({ ratio: 0.5 });
			lostOrigin.parallaxOrigin.set(Number.NaN, 0);
			expect(() => {
				show(lostOrigin);
			}).not.toThrow();
		});
	});
});
