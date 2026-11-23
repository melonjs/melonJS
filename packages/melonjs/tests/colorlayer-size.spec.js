import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	ColorLayer,
	getPool,
	level,
	loader,
	state,
	video,
} from "../src/index.js";
import { copyFrame } from "./helpers/pixels.js";

/**
 * A `ColorLayer` fills the whole canvas by default. It is a renderable like
 * any other, though: given a size, it fills that rectangle and nothing else,
 * where it is, and moves with the world when it does not float: the
 * background of one level among several.
 */

const WIDTH = 64;
const HEIGHT = 48;
const RED = [255, 0, 0];
const BLUE = [0, 0, 255];
const GREEN = [0, 128, 0];
const BLACK = [0, 0, 0];

describe.each([
	["Canvas", video.CANVAS],
	["WebGL", video.WEBGL],
])("a ColorLayer with a size (%s)", (label, renderer) => {
	let app;

	/** a layer of a size, placed by its top left corner in the world */
	const sized = (name, color, z, { x = 0, y = 0, width, height }) => {
		const layer = new ColorLayer(name, color, z);
		layer.floating = false;
		layer.anchorPoint.set(0, 0);
		layer.pos.x = x;
		layer.pos.y = y;
		layer.resize(width, height);
		return layer;
	};

	/** let what was deferred happen: a container sorts its children then */
	const settle = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	/** draw a frame, and read the colour at a few places of it */
	const colours = async (...points) => {
		await settle();
		app.world.update(16);
		app.viewport.update(16);
		app.repaint();
		app.draw();
		const frame = copyFrame(app.renderer);
		return points.map(([x, y]) => {
			const at = (y * frame.width + x) * 4;
			return [frame.data[at], frame.data[at + 1], frame.data[at + 2]];
		});
	};

	beforeAll(async () => {
		boot();
		app = new Application(WIDTH, HEIGHT, {
			parent: "screen",
			renderer,
			consoleHeader: false,
			antiAlias: false,
		});
		await app.init();
		state.change(state.DEFAULT, true);
		// the stage is the one a previous application left: point this one
		// at its camera
		app.reset();
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	beforeEach(async () => {
		await settle();
		app.world.reset();
		app.viewport.setBounds(0, 0, 4096, 4096);
		app.viewport.moveTo(0, 0);
	});

	it("fills the whole canvas when it is given none, as it always has", async () => {
		const layer = new ColorLayer("background", "#ff0000");
		app.world.addChild(layer, 0);
		expect(layer.floating).toBe(true);
		expect([layer.width, layer.height]).toEqual([Infinity, Infinity]);
		expect(
			await colours(
				[0, 0],
				[WIDTH - 1, 0],
				[0, HEIGHT - 1],
				[WIDTH - 1, HEIGHT - 1],
			),
		).toEqual([RED, RED, RED, RED]);
		// and wherever the camera is
		app.viewport.moveTo(500, 300);
		expect(await colours([0, 0], [WIDTH - 1, HEIGHT - 1])).toEqual([RED, RED]);
	});

	it("fills its area and nothing else", async () => {
		const layer = sized("room", "#0000ff", 1, {
			x: 16,
			y: 8,
			width: 24,
			height: 16,
		});
		app.world.addChild(layer);
		expect(layer.floating).toBe(false);
		expect([layer.pos.x, layer.pos.y, layer.width, layer.height]).toEqual([
			16, 8, 24, 16,
		]);
		expect(
			await colours(
				// its four corners, inside
				[16, 8],
				[39, 8],
				[16, 23],
				[39, 23],
				// and one pixel outside each edge
				[15, 8],
				[40, 8],
				[16, 7],
				[16, 24],
				[0, 0],
			),
		).toEqual([BLUE, BLUE, BLUE, BLUE, BLACK, BLACK, BLACK, BLACK, BLACK]);
	});

	it("scrolls with the world, over a layer that fills the canvas", async () => {
		app.world.addChild(new ColorLayer("background", "#ff0000"), 0);
		app.world.addChild(
			sized("room", "#0000ff", 1, {
				x: 16,
				y: 8,
				width: 24,
				height: 16,
			}),
		);
		expect(await colours([20, 12], [4, 4])).toEqual([BLUE, RED]);
		app.viewport.moveTo(16, 8);
		// the room's corner is now the screen's
		expect(await colours([0, 0], [23, 15], [24, 15], [0, 16])).toEqual([
			BLUE,
			BLUE,
			RED,
			RED,
		]);
		// and out of view, it is not drawn at all
		app.viewport.moveTo(1000, 1000);
		expect(await colours([0, 0], [20, 12])).toEqual([RED, RED]);
	});

	it("gives each of several areas its own color, side by side", async () => {
		app.world.addChild(
			sized("left", "#ff0000", 1, {
				x: 0,
				y: 0,
				width: 32,
				height: HEIGHT,
			}),
		);
		app.world.addChild(
			sized("right", "#008000", 1, {
				x: 32,
				y: 0,
				width: 32,
				height: HEIGHT,
			}),
		);
		expect(await colours([0, 0], [31, 20], [32, 20], [63, 47])).toEqual([
			RED,
			RED,
			GREEN,
			GREEN,
		]);
	});

	it("is placed on the screen when it floats", async () => {
		const panel = sized("panel", "#008000", 5, {
			x: 4,
			y: 4,
			width: 8,
			height: 8,
		});
		panel.floating = true;
		app.world.addChild(panel);
		app.viewport.moveTo(700, 700);
		expect(await colours([4, 4], [11, 11], [12, 12], [3, 3])).toEqual([
			GREEN,
			GREEN,
			BLACK,
			BLACK,
		]);
	});

	it("fades with its opacity", async () => {
		app.world.addChild(new ColorLayer("background", "#000000"), 0);
		const layer = sized("half", "#ff0000", 1, {
			x: 0,
			y: 0,
			width: 16,
			height: 16,
		});
		layer.setOpacity(0.5);
		app.world.addChild(layer);
		const [[r, g, b]] = await colours([8, 8]);
		expect(r).toBeGreaterThan(110);
		expect(r).toBeLessThan(145);
		expect([g, b]).toEqual([0, 0]);
	});

	it("fills the canvas again once its size is taken back", async () => {
		const layer = sized("room", "#ff0000", 0, {
			x: 16,
			y: 8,
			width: 24,
			height: 16,
		});
		app.world.addChild(layer);
		expect(await colours([20, 12], [0, 0])).toEqual([RED, BLACK]);
		layer.resize(Infinity, Infinity);
		layer.floating = true;
		expect(await colours([20, 12], [0, 0], [WIDTH - 1, HEIGHT - 1])).toEqual([
			RED,
			RED,
			RED,
		]);
	});

	it("is placed by its anchor point, as any renderable", async () => {
		// centred on its position, with the anchor a renderable has by default
		const layer = new ColorLayer("centred", "#0000ff", 1);
		layer.floating = false;
		layer.pos.x = 32;
		layer.pos.y = 24;
		layer.resize(16, 8);
		app.world.addChild(layer);
		expect(
			await colours([24, 20], [39, 27], [23, 20], [40, 27], [32, 19], [32, 28]),
		).toEqual([BLUE, BLUE, BLACK, BLACK, BLACK, BLACK]);
	});

	it("starts again filling the canvas when it is taken from the pool", async () => {
		const pool = getPool("colorLayer");
		const first = pool.get("room", "#0000ff", 1);
		first.floating = false;
		first.anchorPoint.set(0, 0);
		first.pos.x = 16;
		first.pos.y = 8;
		first.resize(24, 16);
		pool.release(first);
		// the next one asked for fills the canvas: nothing of the size is left
		const second = pool.get("flash", "#ff0000", 3);
		expect(second.floating).toBe(true);
		expect([second.pos.x, second.pos.y, second.width, second.height]).toEqual([
			0,
			0,
			Infinity,
			Infinity,
		]);
		app.world.addChild(second);
		expect(await colours([0, 0], [WIDTH - 1, HEIGHT - 1])).toEqual([RED, RED]);
	});

	it("is built for an object of a level classed ColorLayer, over its rectangle", async () => {
		const name = `colorlayer-map-${label}`;
		await loader.preload(
			[
				{
					name,
					type: "tilemap",
					data: {
						type: "map",
						version: "1.10",
						orientation: "orthogonal",
						renderorder: "right-down",
						infinite: false,
						width: 4,
						height: 3,
						tilewidth: 16,
						tileheight: 16,
						nextobjectid: 3,
						tilesets: [],
						layers: [
							{
								type: "objectgroup",
								name: "areas",
								visible: true,
								opacity: 1,
								x: 0,
								y: 0,
								objects: [
									{
										id: 1,
										name: "pool",
										type: "ColorLayer",
										x: 16,
										y: 16,
										width: 32,
										height: 16,
										rotation: 0,
										visible: true,
										properties: [
											{ name: "color", type: "string", value: "#0000ff" },
										],
									},
								],
							},
						],
					},
				},
			],
			undefined,
			false,
		);
		await level.load(name, { container: app.world, async: true });
		const [pool] = app.world.getChildByName("pool");
		expect(pool).toBeInstanceOf(ColorLayer);
		expect([pool.pos.x, pool.pos.y, pool.width, pool.height]).toEqual([
			16, 16, 32, 16,
		]);
		expect(pool.floating).toBe(false);
		expect(
			await colours([16, 16], [47, 31], [15, 16], [48, 31], [16, 32]),
		).toEqual([BLUE, BLUE, BLACK, BLACK, BLACK]);
	});
});
