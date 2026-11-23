import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	ColorLayer,
	Container,
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

	it("fills the canvas while one of its sides is endless", async () => {
		for (const [width, height] of [
			[16, Infinity],
			[Infinity, 16],
		]) {
			app.world.reset();
			const layer = new ColorLayer("band", "#ff0000", 0);
			layer.resize(width, height);
			app.world.addChild(layer, 0);
			expect(
				await colours([0, 0], [WIDTH - 1, HEIGHT - 1], [40, 30]),
				`${width} x ${height}`,
			).toEqual([RED, RED, RED]);
		}
	});

	describe("built as an object of a level", () => {
		it("fills the object's rectangle, in its color, at its place and draw order", async () => {
			const layer = new ColorLayer(16, 8, {
				name: "pool",
				color: "#0000ff",
				width: 24,
				height: 16,
				z: 7,
			});
			expect(layer.name).toBe("pool");
			expect(layer.pos.z).toBe(7);
			expect(layer.floating).toBe(false);
			expect([layer.anchorPoint.x, layer.anchorPoint.y]).toEqual([0, 0]);
			expect([layer.pos.x, layer.pos.y, layer.width, layer.height]).toEqual([
				16, 8, 24, 16,
			]);
			app.world.addChild(layer, 7);
			expect(await colours([16, 8], [39, 23], [15, 8], [40, 23])).toEqual([
				BLUE,
				BLUE,
				BLACK,
				BLACK,
			]);
		});

		it("takes a size written as text", () => {
			const layer = new ColorLayer(4, 6, {
				name: "text",
				color: "#0000ff",
				width: "24",
				height: "16",
			});
			expect(layer.floating).toBe(false);
			expect([layer.pos.x, layer.pos.y, layer.width, layer.height]).toEqual([
				4, 6, 24, 16,
			]);
			expect(layer.width).toBeTypeOf("number");
		});

		it("fills the canvas when the object has no size, or one that is not a size", async () => {
			for (const size of [
				{},
				{ width: 0, height: 0 },
				{ width: 0, height: 16 },
				{ width: 16, height: 0 },
				{ width: -4, height: 16 },
				{ width: "wide", height: 16 },
				{ width: Number.NaN, height: 16 },
				{ width: Infinity, height: 16 },
				{ width: null, height: null },
			]) {
				const layer = new ColorLayer(4, 6, {
					name: "point",
					color: "#ff0000",
					...size,
				});
				const about = JSON.stringify(size);
				expect(layer.floating, about).toBe(true);
				expect(
					[layer.pos.x, layer.pos.y, layer.width, layer.height],
					about,
				).toEqual([0, 0, Infinity, Infinity]);
			}
			app.world.reset();
			app.world.addChild(new ColorLayer(4, 6, { color: "#ff0000" }), 0);
			expect(await colours([0, 0], [WIDTH - 1, HEIGHT - 1])).toEqual([
				RED,
				RED,
			]);
		});

		it("is black when the object gives no color", async () => {
			app.world.addChild(new ColorLayer("under", "#ff0000"), 0);
			app.world.addChild(new ColorLayer(8, 8, { width: 8, height: 8 }), 1);
			expect(await colours([8, 8], [15, 15], [16, 16])).toEqual([
				BLACK,
				BLACK,
				RED,
			]);
		});

		it("is not taken for one when it is given a name, a color and a draw order", () => {
			const layer = new ColorLayer("3", "#ff0000", 5);
			expect(layer.name).toBe("3");
			expect(layer.pos.z).toBe(5);
			expect(layer.floating).toBe(true);
			expect([layer.pos.x, layer.pos.y]).toEqual([0, 0]);
		});
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

	/**
	 * Every pixel of the frame, against what a list of rectangles painted in
	 * turn over black gives: worked out here from the numbers alone.
	 * Rectangles are in screen pixels, `[x, y, width, height, color]`.
	 */
	const expectFrame = async (rects, about) => {
		await settle();
		app.world.update(16);
		app.viewport.update(16);
		app.repaint();
		app.draw();
		const frame = copyFrame(app.renderer);
		const wrong = [];
		for (let y = 0; y < HEIGHT; y++) {
			for (let x = 0; x < WIDTH; x++) {
				let want = BLACK;
				for (const [rx, ry, rw, rh, color] of rects) {
					if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
						want = color;
					}
				}
				const at = (y * frame.width + x) * 4;
				if (
					frame.data[at] !== want[0] ||
					frame.data[at + 1] !== want[1] ||
					frame.data[at + 2] !== want[2]
				) {
					wrong.push(`${x},${y}`);
				}
			}
		}
		expect(
			wrong.length,
			`${about}: ${wrong.length} pixels differ, first at ${wrong[0]}`,
		).toBe(0);
	};

	// places a rectangle can be: in the view, across each of its edges and
	// corners, just outside it, and far away on either side
	const PLACES = [
		[0, 0],
		[16, 8],
		[1, 1],
		[WIDTH - 1, HEIGHT - 1],
		[-10, -6],
		[-10, 20],
		[20, -6],
		[50, 40],
		[WIDTH, 0],
		[0, HEIGHT],
		[-1, -1],
		[-500, -500],
		[5000, 3000],
	];
	// and sizes it can have: a pixel, a line each way, a box, the view
	// exactly, one pixel more, and far more than the view
	const SIZES = [
		[1, 1],
		[1, HEIGHT],
		[WIDTH, 1],
		[24, 16],
		[3, 37],
		[WIDTH, HEIGHT],
		[WIDTH + 1, HEIGHT + 1],
		[500, 500],
		[4096, 4096],
	];

	describe("whatever its position and its size", () => {
		it("fills exactly its rectangle of the world", async () => {
			for (const [x, y] of PLACES) {
				for (const [width, height] of SIZES) {
					app.world.reset();
					app.world.addChild(
						sized("box", "#0000ff", 1, { x, y, width, height }),
					);
					await expectFrame(
						[[x, y, width, height, BLUE]],
						`at ${x},${y} of ${width} x ${height}`,
					);
				}
			}
		});

		it("fills exactly its rectangle wherever the camera is", async () => {
			const cameras = [
				[0, 0],
				[16, 8],
				[7, 31],
				[1000, 2000],
			];
			for (const [cx, cy] of cameras) {
				app.viewport.moveTo(cx, cy);
				for (const [x, y] of PLACES) {
					for (const [width, height] of [
						[1, 1],
						[24, 16],
						[WIDTH + 1, HEIGHT + 1],
					]) {
						app.world.reset();
						// placed from where the camera is, so each place is tried
						// against each edge of the view
						app.world.addChild(
							sized("box", "#0000ff", 1, {
								x: cx + x,
								y: cy + y,
								width,
								height,
							}),
						);
						await expectFrame(
							[[x, y, width, height, BLUE]],
							`camera ${cx},${cy}, at ${cx + x},${cy + y} of ${width} x ${height}`,
						);
					}
				}
			}
		});

		it("fills exactly its rectangle of the screen when it floats, wherever the camera is", async () => {
			for (const [cx, cy] of [
				[0, 0],
				[333, 777],
			]) {
				app.viewport.moveTo(cx, cy);
				for (const [x, y] of PLACES) {
					for (const [width, height] of [
						[1, 1],
						[24, 16],
						[500, 500],
					]) {
						app.world.reset();
						const panel = sized("panel", "#008000", 1, { x, y, width, height });
						panel.floating = true;
						app.world.addChild(panel);
						await expectFrame(
							[[x, y, width, height, GREEN]],
							`camera ${cx},${cy}, panel at ${x},${y} of ${width} x ${height}`,
						);
					}
				}
			}
		});

		it("is placed by its anchor point, whichever it is", async () => {
			for (const [ax, ay] of [
				[0, 0],
				[0.5, 0.5],
				[1, 1],
				[0.25, 0.75],
				[1, 0],
			]) {
				for (const [x, y] of [
					[32, 24],
					[0, 0],
					[WIDTH, HEIGHT],
					[-8, 60],
				]) {
					for (const [width, height] of [
						[16, 8],
						[4, 4],
						[80, 64],
					]) {
						app.world.reset();
						const layer = new ColorLayer("anchored", "#ff0000", 1);
						layer.floating = false;
						layer.anchorPoint.set(ax, ay);
						layer.pos.x = x;
						layer.pos.y = y;
						layer.resize(width, height);
						app.world.addChild(layer);
						await expectFrame(
							[[x - ax * width, y - ay * height, width, height, RED]],
							`anchor ${ax},${ay}, at ${x},${y} of ${width} x ${height}`,
						);
						// and it says it is where it is drawn
						const bounds = layer.getBounds();
						expect([
							bounds.left,
							bounds.top,
							bounds.width,
							bounds.height,
						]).toEqual([x - ax * width, y - ay * height, width, height]);
					}
				}
			}
		});

		it("follows its position and its size as they change", async () => {
			const layer = sized("moving", "#0000ff", 1, {
				x: 0,
				y: 0,
				width: 8,
				height: 8,
			});
			app.world.addChild(layer);
			for (const [x, y, width, height] of [
				[0, 0, 8, 8],
				[40, 30, 8, 8],
				[40, 30, 2, 12],
				[-4, -4, 30, 30],
				[63, 47, 1, 1],
				[200, 200, 8, 8],
				[10, 10, 50, 3],
			]) {
				layer.pos.x = x;
				layer.pos.y = y;
				layer.resize(width, height);
				await expectFrame(
					[[x, y, width, height, BLUE]],
					`moved to ${x},${y} of ${width} x ${height}`,
				);
			}
		});

		it("is drawn in its place among others, by its draw order", async () => {
			// a canvas-filling one under, three boxes that overlap over it,
			// added out of order
			const add = (layer) => {
				app.world.addChild(layer, layer.pos.z);
			};
			add(new ColorLayer("background", "#008000", 0));
			add(sized("low", "#ff0000", 1, { x: 4, y: 4, width: 30, height: 30 }));
			add(sized("high", "#0000ff", 3, { x: 20, y: 20, width: 30, height: 20 }));
			add(
				sized("middle", "#ff0000", 2, { x: 40, y: 0, width: 24, height: 30 }),
			);
			await expectFrame(
				[
					[0, 0, WIDTH, HEIGHT, GREEN],
					[4, 4, 30, 30, RED],
					[40, 0, 24, 30, RED],
					[20, 20, 30, 20, BLUE],
				],
				"four layers",
			);
		});

		it("is placed in its container, wherever that is", async () => {
			for (const [px, py] of [
				[0, 0],
				[20, 10],
				[-12, 30],
			]) {
				for (const [x, y] of [
					[0, 0],
					[4, 6],
					[-3, -3],
				]) {
					app.world.reset();
					const room = new Container(px, py, 200, 200);
					room.addChild(
						sized("floor", "#0000ff", 1, { x, y, width: 24, height: 16 }),
					);
					app.world.addChild(room);
					await expectFrame(
						[[px + x, py + y, 24, 16, BLUE]],
						`container at ${px},${py}, layer at ${x},${y}`,
					);
				}
			}
		});

		it("covers what its edges cross when they fall between pixels", async () => {
			// a pixel wholly inside is the color, one wholly outside is not;
			// the ones an edge crosses are each renderer's to round
			for (const [x, y, width, height] of [
				[10.5, 7.25, 20.5, 12.5],
				[0.3, 0.3, 5.4, 5.4],
				[-2.5, 40.75, 30, 30],
			]) {
				app.world.reset();
				app.world.addChild(
					sized("fine", "#0000ff", 1, { x, y, width, height }),
				);
				await settle();
				app.world.update(16);
				app.viewport.update(16);
				app.repaint();
				app.draw();
				const frame = copyFrame(app.renderer);
				for (let py = 0; py < HEIGHT; py++) {
					for (let px = 0; px < WIDTH; px++) {
						const inside =
							px >= x && px + 1 <= x + width && py >= y && py + 1 <= y + height;
						const outside =
							px + 1 <= x || px >= x + width || py + 1 <= y || py >= y + height;
						if (!inside && !outside) {
							continue;
						}
						const at = (py * frame.width + px) * 4;
						expect(
							[frame.data[at], frame.data[at + 1], frame.data[at + 2]],
							`${px},${py} of a box at ${x},${y} of ${width} x ${height}`,
						).toEqual(inside ? BLUE : BLACK);
					}
				}
			}
		});

		it("draws nothing for a size of nothing, and does not fail", async () => {
			for (const [width, height] of [
				[0, 0],
				[0, 16],
				[16, 0],
			]) {
				app.world.reset();
				app.world.addChild(
					sized("empty", "#0000ff", 1, { x: 8, y: 8, width, height }),
				);
				await expectFrame([], `a box of ${width} x ${height}`);
			}
		});
	});
});
