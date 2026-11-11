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
 * - touch is reported as `TouchEvent`s dispatched on `screen`, whose touches
 *   carry `clientX/Y` and `screenX/Y` but no `pageX/Y`; there is no
 *   `PointerEvent` nor `ontouchstart`;
 * - `screen.orientation` is a getter that throws "Method not implemented";
 * - an `OffscreenCanvas` of 0x0 is refused;
 * - Web Audio: a worker has none, so a small stand-in plays nx.js's part: an
 *   `AudioContext` that is running from the start, has gain, stereo panner
 *   and buffer source nodes, and throws "Method not implemented" for the
 *   panner, oscillator and filter nodes; an `Audio` with no `canPlayType`.
 *   It records what the engine did with it, it does not make sound.
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
	Object.defineProperty(screen, "orientation", {
		get() {
			throw new Error("Method not implemented.");
		},
	});

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

	installNxAudio(g);
}

/** what the stand-in Web Audio saw the engine do */
const audioLog = { decoded: 0, started: 0 };

function installNxAudio(g) {
	const notImplemented = () => {
		throw new Error("Method not implemented.");
	};
	const param = (value) => {
		return {
			value,
			setValueAtTime() {},
			linearRampToValueAtTime() {},
			exponentialRampToValueAtTime() {},
			setTargetAtTime() {},
			cancelScheduledValues() {},
		};
	};
	class Node extends EventTarget {
		connect(target) {
			return target;
		}
		disconnect() {}
	}
	class AudioContext extends EventTarget {
		state = "running";
		sampleRate = 48000;
		destination = new Node();
		listener = {
			positionX: param(0),
			positionY: param(0),
			positionZ: param(0),
			forwardX: param(0),
			forwardY: param(0),
			forwardZ: param(-1),
			upX: param(0),
			upY: param(1),
			upZ: param(0),
		};
		get currentTime() {
			return performance.now() / 1000;
		}
		resume() {
			return Promise.resolve();
		}
		suspend() {
			return Promise.resolve();
		}
		close() {
			return Promise.resolve();
		}
		createGain() {
			return Object.assign(new Node(), { gain: param(1) });
		}
		createStereoPanner() {
			return Object.assign(new Node(), { pan: param(0) });
		}
		createBuffer(numberOfChannels, length, sampleRate) {
			return {
				numberOfChannels,
				length,
				sampleRate,
				duration: length / sampleRate,
				getChannelData: () => {
					return new Float32Array(length);
				},
			};
		}
		createBufferSource() {
			const source = Object.assign(new Node(), {
				buffer: null,
				loop: false,
				loopStart: 0,
				loopEnd: 0,
				playbackRate: param(1),
				onended: null,
				start() {
					audioLog.started++;
				},
				stop() {
					if (typeof source.onended === "function") {
						source.onended();
					}
				},
			});
			return source;
		}
		decodeAudioData(data) {
			audioLog.decoded++;
			return Promise.resolve(this.createBuffer(2, 48000, 48000));
		}
		createPanner = notImplemented;
		createOscillator = notImplemented;
		createBiquadFilter = notImplemented;
	}
	g.AudioContext = AudioContext;
	// nx.js's `Audio` has no `canPlayType`
	g.Audio = class Audio extends EventTarget {};
}

/** count the pixels of a rectangle of the display brighter than `min` */
async function countBrightPixels(x, y, w, h, min = 200) {
	const blob = await globalThis.screen.convertToBlob({ type: "image/png" });
	const bitmap = await createImageBitmap(blob);
	const copy = new OffscreenCanvas(bitmap.width, bitmap.height);
	const ctx = copy.getContext("2d");
	ctx.drawImage(bitmap, 0, 0);
	const data = ctx.getImageData(x, y, w, h).data;
	let count = 0;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i] > min && data[i + 1] > min && data[i + 2] > min) {
			count++;
		}
	}
	return count;
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

/**
 * A runtime with no DOM and no OffscreenCanvas either: the engine cannot make
 * a canvas there, and says so.
 */
async function runWithoutOffscreenCanvas() {
	const report = { errors: [] };
	try {
		delete globalThis.OffscreenCanvas;
		globalThis.window = globalThis;
		const me = await import("../../src/index.js");
		try {
			me.Renderer.createCanvas(4, 4);
			report.createCanvasError = null;
		} catch (e) {
			report.createCanvasError = e.message;
		}
	} catch (e) {
		report.errors.push(String(e.stack ?? e));
	}
	return report;
}

self.onmessage = async ({ data: { renderer, mode } }) => {
	if (mode === "no-offscreen-canvas") {
		postMessage(await runWithoutOffscreenCanvas());
		return;
	}
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

		step = "device helpers without a DOM";
		// a mobile web view calls this at boot; without a DOM it does nothing
		me.device.enableSwipe(false);
		me.device.enableSwipe(true);
		report.elements = {
			// nx.js's screen reports `nodeType` 1, as an element does
			screen: me.device.getElement(globalThis.screen) === globalThis.screen,
			parentOfScreen:
				me.device.getParentElement(globalThis.screen) === globalThis.screen,
			byName: typeof me.device.getElement("screen"),
		};
		done(step);

		step = "preload an image and a JSON Tiled map";
		await me.loader.preload([
			// the map's tilesets: a 32x64 strip, an orange tile over a green
			// one, and an image collection whose one tile is the strip's green
			// half, cut out through a scratch canvas
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
				const text = new me.Text(20, 20, {
					font: "sans-serif",
					size: 32,
					fillStyle: "#ffffff",
					text: "melonJS on nx.js",
				});
				// in screen coordinates: the centred level offsets the world
				text.floating = true;
				game.world.addChild(text, 10);
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
		// the image-collection tile, last cell of the second row; the cell
		// before it is orange
		report.croppedTilePixel = await readScreenPixel(576 + 112, 328 + 48);
		report.beforeCroppedTilePixel = await readScreenPixel(576 + 80, 328 + 48);
		report.bgPixel = await readScreenPixel(640, 600);
		// the white text, over the dark background
		report.textPixels = await countBrightPixels(20, 20, 300, 40);
		done(step);

		step = "touch input";
		report.touch = null;
		// the viewport: always a candidate, whatever the world holds
		me.input.registerPointerEvent("pointerdown", app.viewport, (pointer) => {
			report.touch = { x: pointer.gameScreenX, y: pointer.gameScreenY };
		});
		// as nx.js reports a finger on the touchscreen: client and screen
		// coordinates, no page ones
		const finger = {
			identifier: 0,
			clientX: 150,
			clientY: 160,
			screenX: 150,
			screenY: 160,
			radiusX: 10,
			radiusY: 10,
			rotationAngle: 0,
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

		step = "audio";
		me.audio.init("ogg");
		await me.loader.preload([
			{ name: "silence", type: "audio", src: "/data/sfx/" },
		]);
		me.audio.play("silence");
		report.audio = { ...audioLog };
		done(step);
	} catch (e) {
		report.errors.push(`${step}: ${e.stack ?? e}`);
	}
	postMessage(report);
};
