import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	Camera2d,
	ImageLayer,
	Renderable,
	ShakeEffect,
	TMXTileMap,
	Vector2d,
	video,
} from "../src/index.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";

/**
 * `Camera2d#offset` shifts the view without moving the camera: a look offset
 * the game sets (above the hero, ahead of him), and the built-in shake's
 * jitter on top of it. Everything that works out what the camera shows has
 * to count it, and a shake has to give the game's value back when it ends.
 */

// a camera looking at (100, 50), free to move anywhere
const makeCamera = (w = 200, h = 100) => {
	const camera = new Camera2d(0, 0, w, h);
	camera.reset(0, 0);
	camera.setBounds(-5000, -5000, 10000, 10000);
	camera.moveTo(100, 50);
	return camera;
};

// Math.random returning the given values in turn (then the last one): the
// shake jitter on an axis is (random - 0.5) * intensity
const randoms = (...values) => {
	let i = 0;
	return vi.spyOn(Math, "random").mockImplementation(() => {
		return values[Math.min(i++, values.length - 1)];
	});
};

describe("Camera2d offset", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("the built-in shake keeps the game's offset", () => {
		it("shakes around the offset, and gives it back when it ends", () => {
			const camera = makeCamera();
			camera.offset.set(0, -70);
			// x then y each frame: jitter (3, 3), then (4, -2)
			randoms(0.8, 0.8, 0.9, 0.3);
			camera.shake(10, 100);
			camera.update(16);
			expect(camera.offset.x).toBeCloseTo(3, 9);
			expect(camera.offset.y).toBeCloseTo(-67, 9);
			// the last jitter is replaced, not added to
			camera.update(16);
			expect(camera.offset.x).toBeCloseTo(4, 9);
			expect(camera.offset.y).toBeCloseTo(-72, 9);
			camera.update(200);
			// exactly: not the value with a jitter taken back off it
			expect(camera.offset.x).toBe(0);
			expect(camera.offset.y).toBe(-70);
			expect(camera.getCameraEffect(ShakeEffect)).toBeUndefined();
		});

		it("gives the offset back when the shake is taken off early", () => {
			const camera = makeCamera();
			camera.offset.set(25, -70);
			randoms(0.8);
			camera.shake(10, 500);
			camera.update(16);
			camera.removeCameraEffect(camera.getCameraEffect(ShakeEffect));
			expect(camera.offset.x).toBe(25);
			expect(camera.offset.y).toBe(-70);
		});

		it("keeps a value the game sets during the shake", () => {
			const camera = makeCamera();
			camera.offset.set(0, -70);
			randoms(0.8);
			camera.shake(10, 100);
			camera.update(16);
			// the hero turns around: look the other way
			camera.offset.set(-60, -70);
			camera.update(16);
			expect(camera.offset.x).toBeCloseTo(-57, 9);
			expect(camera.offset.y).toBeCloseTo(-67, 9);
			camera.offset.set(40, 10);
			camera.update(200);
			expect(camera.offset.x).toBe(40);
			expect(camera.offset.y).toBe(10);
		});

		it("keeps a value the game sets on the frame the shake ends", () => {
			const camera = makeCamera();
			randoms(0.8);
			camera.shake(10, 100);
			camera.update(16);
			camera.offset.set(40, 10);
			camera.update(200);
			expect(camera.offset.x).toBe(40);
			expect(camera.offset.y).toBe(10);
		});

		it("shakes only the axis it is given", () => {
			const camera = makeCamera();
			camera.offset.set(5, -70);
			randoms(0.8);
			camera.shake(10, 100, camera.AXIS.VERTICAL);
			camera.update(16);
			expect(camera.offset.x).toBe(5);
			expect(camera.offset.y).toBeCloseTo(-67, 9);
		});

		it("leaves no jitter behind when a forced shake replaces one", () => {
			const camera = makeCamera();
			camera.offset.set(0, -70);
			randoms(0.8);
			camera.shake(10, 500);
			camera.update(16);
			camera.shake(20, 100, camera.AXIS.BOTH, undefined, true);
			// the first one's jitter is gone, the second's not there yet
			expect(camera.offset.x).toBe(0);
			expect(camera.offset.y).toBe(-70);
			camera.update(16);
			expect(camera.offset.x).toBeCloseTo(6, 9);
			expect(camera.offset.y).toBeCloseTo(-64, 9);
			camera.update(200);
			expect(camera.offset.x).toBe(0);
			expect(camera.offset.y).toBe(-70);
		});

		it("adds up two shakes running at once, and gives the offset back", () => {
			const camera = makeCamera();
			camera.offset.set(0, -70);
			const long = new ShakeEffect(camera, { intensity: 10, duration: 100 });
			const short = new ShakeEffect(camera, { intensity: 20, duration: 40 });
			camera.addCameraEffect(long);
			camera.addCameraEffect(short);
			// long (3, 3), short (6, 6); then long (4, 4), short (-4, -4)
			randoms(0.8, 0.8, 0.8, 0.8, 0.9, 0.9, 0.3, 0.3);
			camera.update(16);
			expect(camera.offset.x).toBeCloseTo(9, 9);
			expect(camera.offset.y).toBeCloseTo(-61, 9);
			camera.update(16);
			expect(camera.offset.x).toBeCloseTo(0, 9);
			expect(camera.offset.y).toBeCloseTo(-70, 9);
			// the short one ends: the long one's jitter alone
			vi.restoreAllMocks();
			randoms(0.9);
			camera.update(16);
			expect(short.isComplete).toBe(true);
			expect(camera.offset.x).toBeCloseTo(4, 9);
			expect(camera.offset.y).toBeCloseTo(-66, 9);
			camera.update(200);
			expect(camera.offset.x).toBe(0);
			expect(camera.offset.y).toBe(-70);
		});

		it("shakes the camera when updated by hand, without being added to it", () => {
			const camera = makeCamera();
			camera.offset.set(0, -70);
			randoms(0.8);
			const shake = new ShakeEffect(camera, { intensity: 10, duration: 100 });
			shake.update(16);
			expect(camera.offset.x).toBeCloseTo(3, 9);
			expect(camera.offset.y).toBeCloseTo(-67, 9);
			shake.update(200);
			expect(camera.offset.x).toBe(0);
			expect(camera.offset.y).toBe(-70);
		});

		it("is cleared by reset(), even in the middle of a shake", () => {
			const camera = makeCamera();
			camera.offset.set(0, -70);
			randoms(0.8);
			camera.shake(10, 500);
			camera.update(16);
			camera.reset();
			expect(camera.offset.x).toBe(0);
			expect(camera.offset.y).toBe(0);
		});

		it("shakes a persistent shake around the cleared offset after a reset()", () => {
			const camera = makeCamera();
			camera.offset.set(0, -70);
			const shake = new ShakeEffect(camera, { intensity: 10, duration: 100 });
			shake.isPersistent = true;
			camera.addCameraEffect(shake);
			randoms(0.8);
			camera.update(16);
			camera.reset();
			expect(camera.getCameraEffect(ShakeEffect)).toBe(shake);
			camera.update(16);
			expect(camera.offset.x).toBeCloseTo(3, 9);
			expect(camera.offset.y).toBeCloseTo(3, 9);
			camera.update(200);
			expect(camera.offset.x).toBe(0);
			expect(camera.offset.y).toBe(0);
		});

		it("lets a camera effect of its own set the offset, as before", () => {
			const camera = makeCamera();
			class Sway {
				constructor(cam) {
					this.camera = cam;
					this.isComplete = false;
					this.isPersistent = false;
				}
				update() {
					this.camera.offset.set(7, -3);
				}
				draw() {}
				destroy() {}
			}
			camera.addCameraEffect(new Sway(camera));
			camera.update(16);
			expect(camera.offset.x).toBe(7);
			expect(camera.offset.y).toBe(-3);
		});
	});

	describe("what the camera shows counts the offset", () => {
		it("worldView is shifted by it", () => {
			const camera = makeCamera(200, 100);
			camera.offset.set(-30, 40);
			const view = camera.worldView;
			expect(view.left).toBe(70);
			expect(view.top).toBe(90);
			expect(view.right).toBe(270);
			expect(view.bottom).toBe(190);
		});

		it("culls against the view it shows, not the one the camera is at", () => {
			const camera = makeCamera(200, 100);
			camera.offset.set(0, -70);
			// in view only because of the offset: above the camera's own rect
			const above = new Renderable(150, -10, 10, 10);
			// below the shifted view, inside the camera's own rect
			const below = new Renderable(150, 130, 10, 10);
			expect(camera.isVisible(above, false)).toBe(true);
			expect(camera.isVisible(below, false)).toBe(false);
		});

		it("maps a point on screen to the world point drawn there", () => {
			const camera = makeCamera(200, 100);
			camera.offset.set(-30, 40);
			const world = camera.localToWorld(10, 20, new Vector2d());
			expect(world.x).toBeCloseTo(100 - 30 + 10, 9);
			expect(world.y).toBeCloseTo(50 + 40 + 20, 9);
			const local = camera.worldToLocal(world.x, world.y, new Vector2d());
			expect(local.x).toBeCloseTo(10, 9);
			expect(local.y).toBeCloseTo(20, 9);
		});

		it("maps the corners of the screen to the corners of worldView, zoomed, placed and rolled", () => {
			const camera = makeCamera(200, 100);
			camera.offset.set(-30, 40);
			camera.zoom = 0.5;
			camera.screenX = 300;
			camera.screenY = 40;
			const view = camera.worldView;
			const topLeft = camera.localToWorld(300, 40, new Vector2d());
			const bottomRight = camera.localToWorld(500, 140, new Vector2d());
			expect(topLeft.x).toBeCloseTo(view.left, 9);
			expect(topLeft.y).toBeCloseTo(view.top, 9);
			expect(bottomRight.x).toBeCloseTo(view.right, 9);
			expect(bottomRight.y).toBeCloseTo(view.bottom, 9);

			camera.roll = Math.PI / 7;
			const world = camera.localToWorld(420, 90, new Vector2d());
			const back = camera.worldToLocal(world.x, world.y, new Vector2d());
			// the roll matrix is single precision
			expect(back.x).toBeCloseTo(420, 4);
			expect(back.y).toBeCloseTo(90, 4);
		});
	});

	describe("a tile layer draws every tile of the shifted view", () => {
		const TILE = 32;
		const COLS = 8;
		const ROWS = 8;

		const makeLayer = () => {
			const canvas = document.createElement("canvas");
			canvas.width = TILE * 2;
			canvas.height = TILE;
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "#ff0000";
			ctx.fillRect(0, 0, TILE * 2, TILE);
			imgList["camera-offset-tiles"] = canvas;
			const map = new TMXTileMap("camera-offset", {
				width: COLS,
				height: ROWS,
				tilewidth: TILE,
				tileheight: TILE,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [
					{
						firstgid: 1,
						name: "camera-offset-tiles",
						tilewidth: TILE,
						tileheight: TILE,
						spacing: 0,
						margin: 0,
						tilecount: 2,
						columns: 2,
						image: "camera-offset-tiles.png",
					},
				],
				layers: [
					{
						type: "tilelayer",
						name: "ground",
						width: COLS,
						height: ROWS,
						data: new Array(COLS * ROWS).fill(1),
						visible: true,
						opacity: 1,
					},
				],
			});
			return map.getLayers()[0];
		};

		// a camera at (96, 96) looking 80 px up and left of it: the view is
		// (16, 16) to (144, 144), well inside the map
		const offsetCamera = () => {
			const camera = new Camera2d(0, 0, 128, 128);
			camera.reset(0, 0);
			camera.setBounds(0, 0, COLS * TILE, ROWS * TILE);
			camera.moveTo(96, 96);
			camera.offset.set(-80, -80);
			return camera;
		};

		// the layer drawn as the camera draws the world, on a canvas the size
		// of the camera: how many pixels nothing was drawn on
		const blankPixels = (layer, camera) => {
			const renderer = new CanvasRenderer({
				width: camera.width,
				height: camera.height,
				transparent: true,
			});
			try {
				renderer.translate(
					-(camera.pos.x + camera.offset.x),
					-(camera.pos.y + camera.offset.y),
				);
				layer.draw(renderer, camera);
				const data = renderer
					.getContext()
					.getImageData(0, 0, camera.width, camera.height).data;
				let blank = 0;
				for (let i = 3; i < data.length; i += 4) {
					if (data[i] === 0) {
						blank++;
					}
				}
				return blank;
			} finally {
				renderer.destroy();
			}
		};

		it("tile by tile", () => {
			expect(blankPixels(makeLayer(), offsetCamera())).toBe(0);
		});

		it("from its pre-rendered canvas", () => {
			const layer = makeLayer();
			layer.renderMode = "prerender";
			layer.onActivateEvent();
			expect(layer.canvasRenderer).toBeDefined();
			expect(blankPixels(layer, offsetCamera())).toBe(0);
		});

		it("hands the renderer the shifted view, and the camera itself when there is no offset", () => {
			const layer = makeLayer();
			const camera = offsetCamera();
			const renderer = {
				drawTileLayer: vi.fn(),
				cache: {},
			};
			layer.draw(renderer, camera);
			const view = renderer.drawTileLayer.mock.calls[0][1];
			expect(view).not.toBe(camera);
			expect(view.pos.x).toBe(16);
			expect(view.pos.y).toBe(16);
			expect(view.width).toBe(128);
			expect(view.height).toBe(128);
			// the camera itself did not move
			expect(camera.pos.x).toBe(96);
			expect(camera.pos.y).toBe(96);

			camera.offset.setZero();
			layer.draw(renderer, camera);
			expect(renderer.drawTileLayer.mock.calls[1][1]).toBe(camera);
		});
	});

	describe("a parallax image layer follows the shifted view", () => {
		// the translate draw() gives the layer, on a camera at (100, 50)
		const drawnAt = (ratio, offset) => {
			const image = document.createElement("canvas");
			image.width = 64;
			image.height = 64;
			const layer = new ImageLayer(0, 0, {
				image,
				name: "parallax",
				repeat: "no-repeat",
				ratio,
			});
			layer.width = 64;
			layer.height = 64;
			layer.anchorPoint.set(0, 0);
			const camera = makeCamera();
			camera.offset.set(offset.x, offset.y);
			const translate = vi.fn();
			layer.draw(
				{
					translate,
					scale: vi.fn(),
					setMask: vi.fn(),
					drawPattern: vi.fn(),
				},
				camera,
			);
			return translate.mock.calls[0];
		};

		it("moves with the world at a ratio of 1", () => {
			// the world is drawn translated by -(pos + offset)
			const [x, y] = drawnAt(1, { x: -30, y: 40 });
			expect(x).toBeCloseTo(-(100 - 30), 9);
			expect(y).toBeCloseTo(-(50 + 40), 9);
		});

		it("moves by half as much at a ratio of 0.5", () => {
			const [x, y] = drawnAt(0.5, { x: -30, y: 40 });
			expect(x).toBeCloseTo(-0.5 * (100 - 30), 9);
			expect(y).toBeCloseTo(-0.5 * (50 + 40), 9);
		});

		it("keeps the position it holds between draws where it is drawn", () => {
			const image = document.createElement("canvas");
			image.width = 64;
			image.height = 64;
			const layer = new ImageLayer(0, 0, {
				image,
				name: "parallax",
				repeat: "no-repeat",
				ratio: 0.5,
			});
			layer.anchorPoint.set(0, 0);
			const viewport = app.viewport;
			app.world.addChild(layer);
			try {
				viewport.moveTo(0, 0);
				viewport.offset.set(-30, 40);
				// what the camera moving calls
				layer.updateLayer();
				expect(layer.pos.x).toBeCloseTo(-0.5 * (viewport.pos.x - 30), 9);
				expect(layer.pos.y).toBeCloseTo(-0.5 * (viewport.pos.y + 40), 9);
			} finally {
				viewport.offset.setZero();
				app.world.removeChildNow(layer);
			}
		});
	});
});
