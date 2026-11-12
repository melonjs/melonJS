import { describe, expect, it } from "vitest";

/**
 * NX.js compatibility: melonJS running with no DOM.
 *
 * nx.js (https://github.com/TooTallNate/nx.js) runs JavaScript on the
 * Nintendo Switch with the web APIs a game needs (Canvas 2D, WebGL 2, fetch,
 * createImageBitmap, Web Audio, gamepads, touch) and no DOM at all: no
 * `document`, no `<canvas>` elements, no CSS. The display is a global
 * `screen` canvas, given to the Application as `settings.canvas`.
 *
 * Each case starts a Web Worker (no DOM either) dressed up as nx.js by
 * helpers/nxjs-worker.js, runs a small game in it and reports back what
 * happened. One worker per renderer: as on nx.js, the one display canvas can
 * only ever hold one kind of context.
 *
 * What would fail without the no-DOM fallbacks, in order: `new Application`
 * (`document.body`), `init()` (`canvas.style`), the WebGL renderer (its
 * support probe makes a `<canvas>`), Tiled maps (tileset scratch canvases),
 * touch (listened for as mouse events), and an XML map failing with a bare
 * "DOMParser is not defined" rather than saying to use JSON.
 */
function runInNxWorker(renderer, mode = "game") {
	return new Promise((resolve, reject) => {
		const worker = new Worker(
			new URL("./helpers/nxjs-worker.js", import.meta.url),
			{ type: "module" },
		);
		const timeout = setTimeout(() => {
			worker.terminate();
			reject(new Error(`nx.js worker (${renderer}) did not report back`));
		}, 40000);
		worker.onmessage = ({ data }) => {
			clearTimeout(timeout);
			worker.terminate();
			resolve(data);
		};
		worker.onerror = (e) => {
			clearTimeout(timeout);
			worker.terminate();
			reject(new Error(`nx.js worker (${renderer}): ${e.message}`));
		};
		worker.postMessage({ renderer, mode });
	});
}

const ALL_STEPS = [
	"install nx.js globals",
	"import melonjs",
	"new Application",
	"app.init()",
	"device helpers without a DOM",
	"preload an image and a JSON Tiled map",
	"preload an XML Tiled map",
	"load the level and draw",
	"touch input",
	"audio",
];

describe("NX.js compatibility: no DOM and no OffscreenCanvas", () => {
	it("says it cannot create a canvas", async () => {
		const r = await runInNxWorker(undefined, "no-offscreen-canvas");
		expect(r.errors).toEqual([]);
		expect(r.createCanvasError).toMatch(/cannot create a canvas here/);
	});
});

describe("NX.js compatibility (no DOM)", () => {
	for (const renderer of ["CANVAS", "WEBGL", "AUTO"]) {
		describe(`renderer: video.${renderer}`, () => {
			let report;
			const getReport = async () => {
				report ??= await runInNxWorker(renderer);
				return report;
			};

			it("boots, loads and draws a Tiled map", async () => {
				const r = await getReport();
				expect(r.errors).toEqual([]);
				expect(r.steps).toEqual(ALL_STEPS);
				// AUTO picks WebGL where the runtime has it, as nx.js does
				expect(r.renderer).toBe(renderer === "CANVAS" ? "CANVAS" : "WEBGL");
				// the canvas is the display: nothing to mount it in
				expect(r.parentElement).toBe("undefined");
				expect(r.frames).toBeGreaterThanOrEqual(5);
				// background: #203040
				expect(r.bgPixel.slice(0, 3)).toEqual([0x20, 0x30, 0x40]);
				// the map's first two tiles over it: orange, then green
				expect(r.tilePixels[0]).toEqual([255, 128, 0, 255]);
				expect(r.tilePixels[1]).toEqual([0, 200, 0, 255]);
				// an image-collection tile cut from the strip (its green half)
				// through a scratch canvas, next to an orange one
				expect(r.croppedTilePixel).toEqual([0, 200, 0, 255]);
				expect(r.beforeCroppedTilePixel).toEqual([255, 128, 0, 255]);
				// text, drawn through a scratch canvas too
				expect(r.textPixels).toBeGreaterThan(50);
			});

			it("handles the display canvas as the only element", async () => {
				const r = await getReport();
				expect(r.elements).toEqual({
					screen: true,
					parentOfScreen: true,
					byName: "undefined",
				});
			});

			it("loads and plays a sound on an Audio without canPlayType", async () => {
				const r = await getReport();
				// nx.js cannot say which formats it decodes: the clip is
				// fetched and decoded anyway, and starts without a gesture
				expect(r.audio.decoded).toBeGreaterThanOrEqual(1);
				expect(r.audio.started).toBeGreaterThanOrEqual(1);
			});

			it("receives touch events dispatched on the display canvas", async () => {
				const r = await getReport();
				expect(r.touch).toEqual({ x: 150, y: 160 });
			});

			it("says to use JSON when an XML map cannot be parsed", async () => {
				const r = await getReport();
				expect(r.xmlMapError).toMatch(/needs DOMParser/);
				expect(r.xmlMapError).toMatch(/JSON \(\.tmj\/\.tsj\)/);
			});
		});
	}
});
