/**
 * Runs a small melonJS game inside a dedicated Web Worker made to look like
 * nx.js, the JavaScript runtime for Nintendo Switch homebrew
 * (https://github.com/TooTallNate/nx.js). See nxjs-compatibility.spec.js.
 *
 * nx.js implements the web APIs a game draws, loads and plays sound with, but
 * no DOM. A worker is the closest thing Chromium has: no `document`, no
 * `<canvas>` elements, but `OffscreenCanvas`, WebGL 2, `fetch` and
 * `createImageBitmap`. On top of that, `installNxGlobals` reproduces what
 * nx.js does differently from a worker:
 *
 * - the display is a global `screen`: a 1280x720 canvas with no `style`, a
 *   few DOM-compat metrics (`offsetWidth`, `nodeType`...), and only the `2d`
 *   and `webgl2` contexts. The game is given it as `settings.canvas`;
 * - any other `OffscreenCanvas` is 2D only;
 * - no `XMLHttpRequest`, no `DOMParser`, no WebGPU;
 * - `window === globalThis`, `localStorage`, `navigator.getGamepads()`;
 * - touch is reported as `TouchEvent`s dispatched on `screen`, and there is
 *   no `PointerEvent` nor `ontouchstart`.
 *
 * Not reproduced: Web Audio (a worker has no `AudioContext`; nx.js has one
 * without `PannerNode`, `OscillatorNode` or `BiquadFilterNode`).
 *
 * The engine is imported only AFTER the globals are installed, as on nx.js,
 * where they exist before any game code runs.
 */

function installNxGlobals() {
	const g = globalThis;
	const WorkerNavigator = g.WorkerNavigator;
	g.window = g;

	// not in nx.js
	delete g.XMLHttpRequest;
	delete g.DOMParser;
	Object.defineProperty(WorkerNavigator.prototype, "gpu", {
		get: () => {
			return undefined;
		},
		configurable: true,
	});

	// nx.js `OffscreenCanvas` is 2D only; its `screen` also takes "webgl2"
	const getContext = OffscreenCanvas.prototype.getContext;
	OffscreenCanvas.prototype.getContext = function (id, attributes) {
		if (this === g.screen) {
			return id === "2d" || id === "webgl2"
				? getContext.call(this, id, attributes)
				: null;
		}
		if (id !== "2d") {
			throw new TypeError(
				`OffscreenCanvas.getContext: '${id}' is not a valid value`,
			);
		}
		return getContext.call(this, id, attributes);
	};

	// nx.js `screen`: the display, as a canvas with DOM-compat metrics
	const screen = new OffscreenCanvas(1280, 720);

	// nx.js refuses a canvas with no pixels: `new OffscreenCanvas(0, 0)`
	// throws there, where Chromium allows it
	const NativeOffscreenCanvas = g.OffscreenCanvas;
	g.OffscreenCanvas = class OffscreenCanvas extends NativeOffscreenCanvas {
		constructor(width, height) {
			if (!(width > 0) || !(height > 0)) {
				throw new RangeError(`Invalid canvas dimensions: ${width}x${height}`);
			}
			super(width, height);
		}
	};
	Object.defineProperties(screen, {
		className: { value: "", writable: true },
		nodeType: {
			get: () => {
				return 1;
			},
		},
		nodeName: {
			get: () => {
				return "CANVAS";
			},
		},
		offsetWidth: {
			get: () => {
				return screen.width;
			},
		},
		offsetHeight: {
			get: () => {
				return screen.height;
			},
		},
		offsetTop: {
			get: () => {
				return 0;
			},
		},
		offsetLeft: {
			get: () => {
				return 0;
			},
		},
		availWidth: {
			get: () => {
				return screen.width;
			},
		},
		availHeight: {
			get: () => {
				return screen.height;
			},
		},
	});
	screen.getAttribute = (name) => {
		return name === "width" || name === "height" ? String(screen[name]) : null;
	};
	screen.setAttribute = () => {};
	Object.defineProperty(g, "screen", {
		value: screen,
		configurable: true,
		writable: true,
	});

	// in nx.js, missing from a worker
	const store = new Map();
	g.localStorage = {
		getItem: (k) => {
			return store.has(k) ? store.get(k) : null;
		},
		setItem: (k, v) => {
			return store.set(k, String(v));
		},
		removeItem: (k) => {
			return store.delete(k);
		},
		clear: () => {
			return store.clear();
		},
		key: (i) => {
			return [...store.keys()][i] ?? null;
		},
		get length() {
			return store.size;
		},
	};
	Object.defineProperty(WorkerNavigator.prototype, "getGamepads", {
		value: () => {
			return [null, null, null, null];
		},
		configurable: true,
	});
	Object.defineProperty(WorkerNavigator.prototype, "maxTouchPoints", {
		get: () => {
			return 10;
		},
		configurable: true,
	});
	g.KeyboardEvent ??= class KeyboardEvent extends Event {
		constructor(type, init = {}) {
			super(type, init);
			Object.assign(this, init);
		}
	};
	g.TouchEvent ??= class TouchEvent extends Event {
		constructor(type, init = {}) {
			super(type, init);
			this.touches = init.touches ?? [];
			this.changedTouches = init.changedTouches ?? [];
		}
	};
}

/** read one pixel of the display, as [r, g, b, a] */
async function readScreenPixel(x, y) {
	const blob = await globalThis.screen.convertToBlob({ type: "image/png" });
	const bitmap = await createImageBitmap(blob);
	const copy = new OffscreenCanvas(bitmap.width, bitmap.height);
	const ctx = copy.getContext("2d");
	ctx.drawImage(bitmap, 0, 0);
	return Array.from(ctx.getImageData(x, y, 1, 1).data);
}

self.onmessage = async ({ data: { renderer } }) => {
	const report = { steps: [], errors: [] };
	let step = "install nx.js globals";
	const done = (name) => {
		report.steps.push(name);
	};
	try {
		installNxGlobals();
		done(step);

		step = "import melonjs";
		const me = await import("../../src/index.js");
		done(step);

		step = "new Application";
		const app = new me.Application(1280, 720, {
			canvas: globalThis.screen,
			renderer: me.video[renderer],
			scale: "auto",
			consoleHeader: false,
			// the CI image rasterizes WebGL in software
			failIfMajorPerformanceCaveat: false,
		});
		done(step);

		step = "app.init()";
		await app.init();
		report.renderer =
			app.renderer instanceof me.WebGLRenderer ? "WEBGL" : "CANVAS";
		report.parentElement = typeof app.getParentElement();
		done(step);

		step = "preload an image and a JSON Tiled map";
		await me.loader.preload([
			// the map's tileset: a 32x64 strip, an orange tile over a green one
			{ name: "tiles", type: "image", src: "/data/nxjs/tiles.png" },
			{ name: "map", type: "tmx", src: "/data/nxjs/map.tmj" },
		]);
		done(step);

		step = "preload an XML Tiled map";
		try {
			await me.loader.preload([
				{ name: "xmlmap", type: "tmx", src: "/data/nxjs/map.tmx" },
			]);
			report.xmlMapError = null;
		} catch (e) {
			// the loader names the asset; its `cause` is the parser's error
			report.xmlMapError = e.cause?.message ?? e.message;
		}
		done(step);

		step = "load the level and draw";
		class Play extends me.Stage {
			onResetEvent(game) {
				// loading a level empties its container: the background after
				me.level.load("map", { container: game.world });
				game.world.addChild(new me.ColorLayer("bg", "#203040"), -1);
				// text is drawn through a scratch canvas: the engine has to
				// make one, which without a DOM can only be an OffscreenCanvas
				game.world.addChild(
					new me.Text(20, 20, {
						font: "sans-serif",
						size: 32,
						fillStyle: "#ffffff",
						text: "melonJS on nx.js",
					}),
					10,
				);
			}
		}
		me.state.set(me.state.PLAY, new Play());
		me.state.change(me.state.PLAY, true);
		let frames = 0;
		await new Promise((resolve) => {
			me.event.on(me.event.GAME_AFTER_DRAW, () => {
				frames++;
				if (frames === 5) {
					resolve();
				}
			});
		});
		if (app.renderer.gl) {
			app.renderer.gl.finish();
		}
		report.frames = frames;
		// the first two tiles of the map, and the background beside it. The
		// 128x64 map is smaller than the screen, so it is drawn centred, at
		// ((1280 - 128) / 2, (720 - 64) / 2) = (576, 328)
		report.tilePixels = [
			await readScreenPixel(576 + 16, 328 + 16),
			await readScreenPixel(576 + 48, 328 + 16),
		];
		report.bgPixel = await readScreenPixel(640, 600);
		done(step);

		step = "touch input";
		report.touch = null;
		// the viewport: always a candidate, whatever the world holds
		me.input.registerPointerEvent("pointerdown", app.viewport, (pointer) => {
			report.touch = { x: pointer.gameScreenX, y: pointer.gameScreenY };
		});
		// as nx.js reports a finger on the touchscreen
		const finger = {
			identifier: 0,
			clientX: 150,
			clientY: 160,
			pageX: 150,
			pageY: 160,
			screenX: 150,
			screenY: 160,
		};
		globalThis.screen.dispatchEvent(
			new TouchEvent("touchstart", {
				bubbles: true,
				cancelable: true,
				touches: [finger],
				changedTouches: [finger],
			}),
		);

		done(step);
	} catch (e) {
		report.errors.push(`${step}: ${e.stack ?? e}`);
	}
	postMessage(report);
};
