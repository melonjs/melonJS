/**
 * Floating renderables (a HUD, a `ColorLayer`) under a zoomed main camera.
 *
 * Floating elements that are not `visibleInAllCameras` are drawn by the
 * stage's main camera only, a minimap or a split-screen view leaving them
 * to it. Zooming the main camera made it look like one of those: every
 * floating element, the background color and the HUD included, was gone.
 *
 * Read in pixels, on Canvas and WebGL. What has to hold:
 *   - a zoomed main camera, in or out, draws its `ColorLayer` over the whole
 *     view, and a floating element where it is on the screen, unzoomed
 *   - the world under it is still zoomed
 *   - a minimap still leaves the HUD to the main camera, zoomed out at the
 *     screen's origin included (zoom is all that tells it apart there), and
 *     still draws what is `visibleInAllCameras`
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	ColorLayer,
	Renderable,
	state,
	video,
} from "../src/index.js";

/** a filled square, top left at (x, y) */
class Square extends Renderable {
	constructor(x, y, size, color) {
		super(x, y, size, size);
		this.anchorPoint.set(0, 0);
		this.color = color;
	}
	draw(renderer) {
		renderer.setColor(this.color);
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

/** the same, in screen space */
const hud = (x, y, size, color) => {
	const square = new Square(x, y, size, color);
	square.floating = true;
	return square;
};

const RED = "255,0,0";
const GREEN = "0,255,0";
const BLUE = "0,0,255";
const BLACK = "0,0,0";

for (const backend of [video.CANVAS, video.WEBGL]) {
	describe(`floating renderables under a zoomed camera (${backend})`, () => {
		let app, renderer, stage, camera;

		beforeAll(async () => {
			boot();
			app = new Application(100, 100, {
				parent: "screen",
				renderer: backend,
				scale: "1.0",
				antiAlias: false,
				failIfMajorPerformanceCaveat: false,
			});
			await app.init();
			renderer = app.renderer;
			stage = state.current();
			camera = stage.cameras.get("default");
		});
		afterEach(() => {
			stage.cameras.delete("minimap");
			app.world.reset();
			camera.zoom = 1;
			camera.setBounds(0, 0, 100, 100);
			camera.moveTo(0, 0);
		});
		afterAll(() => {
			return app?.destroy();
		});

		/** draw these, each at the depth of its place in the list */
		const scene = (...renderables) => {
			renderables.forEach((renderable, depth) => {
				app.world.addChild(renderable, depth);
			});
			app.world.sortNow();
			app.world.update(0);
			app.repaint();
			app.draw();
		};

		/** the color of the pixel at (x, y), as "r,g,b" */
		const at = (x, y) => {
			if (backend === video.CANVAS) {
				const data = renderer.getContext().getImageData(x, y, 1, 1).data;
				return Array.from(data.slice(0, 3)).join();
			}
			const bytes = new Uint8Array(4);
			renderer.gl.readPixels(
				x,
				99 - y,
				1,
				1,
				renderer.gl.RGBA,
				renderer.gl.UNSIGNED_BYTE,
				bytes,
			);
			return Array.from(bytes.slice(0, 3)).join();
		};

		const zoomTo = (zoom) => {
			camera.zoom = zoom;
			camera.setBounds(0, 0, 1000, 1000);
			camera.moveTo(0, 0);
		};

		/** a second camera, `size` pixels across at (screenX, screenY) */
		const minimap = (screenX, screenY, size, zoom) => {
			const view = new Camera2d(0, 0, size, size);
			view.name = "minimap";
			view.autoResize = false;
			view.screenX = screenX;
			view.screenY = screenY;
			view.zoom = zoom;
			view.setBounds(0, 0, 1000, 1000);
			stage.cameras.set("minimap", view);
			return view;
		};

		// ---- the main camera, zoomed ------------------------------------------

		for (const zoom of [0.5, 2]) {
			it(`fills the whole view with a ColorLayer at zoom ${zoom}`, () => {
				zoomTo(zoom);
				scene(new ColorLayer("background", "#ff0000"));
				expect(at(1, 1)).toBe(RED);
				expect(at(50, 50)).toBe(RED);
				expect(at(98, 98)).toBe(RED);
			});

			it(`draws a floating element where it is on the screen at zoom ${zoom}`, () => {
				zoomTo(zoom);
				scene(
					new ColorLayer("background", "#ff0000"),
					hud(10, 10, 20, "#00ff00"),
				);
				// 20 pixels across at (10, 10), not scaled by the zoom
				expect(at(11, 11)).toBe(GREEN);
				expect(at(28, 28)).toBe(GREEN);
				expect(at(8, 8)).toBe(RED);
				expect(at(32, 32)).toBe(RED);
			});
		}

		it("still zooms the world under them", () => {
			zoomTo(2);
			scene(
				new ColorLayer("background", "#ff0000"),
				new Square(10, 10, 10, "#0000ff"),
				hud(70, 70, 10, "#00ff00"),
			);
			// 10 world units at (10, 10), twice the size on the screen
			expect(at(21, 21)).toBe(BLUE);
			expect(at(38, 38)).toBe(BLUE);
			expect(at(18, 18)).toBe(RED);
			expect(at(42, 42)).toBe(RED);
			expect(at(75, 75)).toBe(GREEN);
		});

		// ---- a minimap ------------------------------------------------------------

		/** a floating square that notes the name of each camera drawing it */
		const recorded = () => {
			const square = hud(10, 10, 20, "#00ff00");
			const drawn = [];
			const draw = square.draw.bind(square);
			square.draw = (r, viewport) => {
				drawn.push(viewport.name);
				draw(r, viewport);
			};
			return { square, drawn };
		};

		it("still leaves the HUD to the main camera on a zoomed-out minimap at the screen's origin", () => {
			// placed where the main camera is: its zoom is all that tells it apart
			minimap(0, 0, 40, 0.25);
			const { square, drawn } = recorded();
			scene(square);
			expect(drawn).toEqual(["default"]);
		});

		it("still leaves the HUD to the main camera on a minimap in a corner", () => {
			minimap(60, 0, 40, 0.25);
			const { square, drawn } = recorded();
			scene(square);
			expect(drawn).toEqual(["default"]);
		});

		it("draws what is visibleInAllCameras on a minimap too", () => {
			minimap(60, 0, 40, 0.25);
			const { square, drawn } = recorded();
			square.visibleInAllCameras = true;
			scene(square);
			expect(drawn.sort()).toEqual(["default", "minimap"]);
		});

		it("leaves the HUD to the main camera when both are zoomed", () => {
			zoomTo(2);
			minimap(60, 0, 40, 0.25);
			const { square, drawn } = recorded();
			scene(new ColorLayer("background", "#000000"), square);
			expect(drawn).toEqual(["default"]);
			expect(at(15, 15)).toBe(GREEN);
			expect(at(50, 50)).toBe(BLACK);
		});
	});
}
