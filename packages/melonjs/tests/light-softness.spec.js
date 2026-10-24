/**
 * `Light2d#softness`: a soft edge for a light's hole in the stage's ambient
 * darkness.
 *
 * Read in pixels, over a white layer under a black ambient of full alpha, with
 * `illuminationOnly` lights (they cut the darkness and draw no glow): a pixel's
 * brightness is then 255 times what the lights cut there.
 *
 * What has to hold, on Canvas and WebGL:
 *   - with no soft light, the hard path runs exactly as before
 *   - the falloff: lit out to the core, then straight back to dark at the edge
 *   - hard and soft lights in one scene, overlapping lights multiplying
 *   - an off-centre light lands where it is (no flipped axis), an elliptical
 *     one along both radii, under a scrolled and a zoomed camera too
 *   - the whole view is darkened, zoomed out included
 *   - lights outside the view do not count against the 32 a pass cuts
 *   - nothing grows frame after frame
 *   - a bad softness is refused
 */
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
	Light2d,
	Renderable,
	state,
	video,
} from "../src/index.js";

/** a white rectangle over the whole test world, as the scene */
class White extends Renderable {
	constructor() {
		super(0, 0, 2000, 2000);
		this.anchorPoint.set(0, 0);
	}
	draw(renderer) {
		renderer.setColor("#ffffff");
		renderer.fillRect(0, 0, this.width, this.height);
	}
}

for (const backend of [video.CANVAS, video.WEBGL]) {
	describe(`Light2d softness (${backend})`, () => {
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
			// the stage's own camera: `app.viewport` is only set by a reset
			camera = stage.cameras.get("default");
		});
		afterEach(() => {
			vi.restoreAllMocks();
			stage.ambientLight.setColor(0, 0, 0, 0);
			app.world.reset();
			camera.zoom = 1;
			camera.setBounds(0, 0, 100, 100);
			camera.moveTo(0, 0);
		});
		afterAll(() => {
			return app?.destroy();
		});

		/** a white scene, black darkness over it, and these lights */
		const scene = (...lights) => {
			app.world.addChild(new White(), 0);
			stage.ambientLight.setColor(0, 0, 0, 1);
			for (const light of lights) {
				app.world.addChild(light, 1);
			}
			app.world.update(0);
			app.repaint();
			app.draw();
		};

		/** a light that cuts the darkness and draws no glow */
		const cutter = (x, y, rx, ry, softness) => {
			const light = new Light2d(x, y, rx, ry, "#ffffff", 1);
			light.illuminationOnly = true;
			light.softness = softness;
			return light;
		};

		/** brightness of the pixel at (x, y), 0..255 */
		const at = (x, y) => {
			if (backend === video.CANVAS) {
				return renderer.getContext().getImageData(x, y, 1, 1).data[0];
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
			return bytes[0];
		};

		/**
		 * the brightness a light of `radius` (and `radiusY`) and `softness`, centered
		 * at (cx, cy) on screen, gives the pixel at (x, y): its cut, read at
		 * the pixel's center
		 */
		const falloff = (x, y, cx, cy, radius, softness, radiusY = radius) => {
			const d = Math.hypot((x + 0.5 - cx) / radius, (y + 0.5 - cy) / radiusY);
			const cut =
				softness > 0
					? Math.min(1, Math.max(0, (1 - d) / softness))
					: d <= 1
						? 1
						: 0;
			return Math.round(255 * cut);
		};

		// within a couple of levels: gradients are rasterized per pixel
		const near = (value, expected, tolerance = 4) => {
			expect(
				Math.abs(value - expected),
				`${value} vs ${expected}`,
			).toBeLessThanOrEqual(tolerance);
		};

		// ---- the hard path ----------------------------------------------------

		it("keeps the hard path when no light is soft", () => {
			const soft = vi.spyOn(renderer, "drawAmbientLight");
			scene(cutter(50, 50, 30, 30, 0));
			expect(soft).not.toHaveBeenCalled();
			expect(at(50, 50)).toBe(255); // inside: no darkness
			expect(at(50, 25)).toBe(255);
			expect(at(5, 5)).toBe(0); // outside: all of it
		});

		// ---- the falloff --------------------------------------------------------

		it("thins the darkness straight from the center with a softness of 1", () => {
			const soft = vi.spyOn(renderer, "drawAmbientLight");
			scene(cutter(50, 50, 40, 40, 1));
			expect(soft).toHaveBeenCalled();
			near(at(50, 50), falloff(50, 50, 50, 50, 40, 1));
			near(at(70, 50), falloff(70, 50, 50, 50, 40, 1)); // about half cut
			near(at(80, 50), falloff(80, 50, 50, 50, 40, 1)); // about a quarter
			expect(at(95, 50)).toBe(0); // past the radius
		});

		it("keeps a lit core of 1 - softness, then fades to the edge", () => {
			scene(cutter(50, 50, 40, 40, 0.5));
			near(at(50, 50), 255);
			near(at(66, 50), 255); // 0.4 of the radius: still the core
			near(at(80, 50), falloff(80, 50, 50, 50, 40, 0.5)); // about half way back
			expect(at(95, 50)).toBe(0);
		});

		it("mixes a hard and a soft light in one scene", () => {
			scene(cutter(25, 50, 20, 20, 0), cutter(75, 50, 20, 20, 1));
			// the hard one is crisp
			expect(at(25, 50)).toBe(255);
			expect(at(40, 50)).toBe(255);
			expect(at(25, 75)).toBe(0);
			// the soft one fades
			near(at(85, 50), falloff(85, 50, 75, 50, 20, 1));
		});

		it("multiplies what overlapping lights leave of the darkness", () => {
			// at (50, 50) each light is at half its radius and cuts half:
			// a quarter of the darkness is left
			scene(cutter(30, 50, 40, 40, 1), cutter(70, 50, 40, 40, 1));
			near(at(50, 50), 191);
		});

		// ---- where the hole lands -----------------------------------------------

		it("lands an off-centre light where it is, not mirrored", () => {
			scene(cutter(20, 75, 15, 15, 0.5));
			near(at(20, 75), 255);
			expect(at(20, 25)).toBe(0); // its mirror on the vertical axis
			expect(at(80, 75)).toBe(0); // and on the horizontal one
		});

		it("follows an elliptical light along both of its radii", () => {
			scene(cutter(50, 50, 40, 20, 1));
			near(at(70, 50), falloff(70, 50, 50, 50, 40, 1, 20)); // half the horizontal radius
			near(at(50, 60), falloff(50, 60, 50, 50, 40, 1, 20)); // half the vertical radius
			near(at(50, 70), 0); // its vertical radius
		});

		it("follows the light under a scrolled camera", () => {
			camera.setBounds(0, 0, 1000, 1000);
			camera.moveTo(200, 100);
			scene(cutter(250, 150, 30, 30, 1)); // at (50, 50) on screen
			near(at(50, 50), falloff(50, 50, 50, 50, 30, 1));
			near(at(65, 50), falloff(65, 50, 50, 50, 30, 1));
			expect(at(5, 5)).toBe(0);
		});

		it("darkens the whole view of a zoomed-out camera, the hole where the light is", () => {
			camera.zoom = 0.5; // 200 x 200 of the world on 100 x 100 pixels
			camera.setBounds(0, 0, 1000, 1000);
			scene(cutter(100, 100, 40, 40, 0.5)); // at (50, 50) on screen, 20 px across
			near(at(50, 50), 255);
			near(at(65, 50), falloff(65, 50, 50, 50, 20, 0.5)); // 0.75 of the radius, on screen
			expect(at(75, 50)).toBe(0);
			// the far corner of the view is dark too
			expect(at(97, 97)).toBe(0);
		});

		it("cuts a hard hole where the light is under a scrolled camera", () => {
			// the hard path, whose inverted mask on Canvas took its outer edge
			// from the world, not the screen
			camera.setBounds(0, 0, 1000, 1000);
			camera.moveTo(200, 100);
			scene(cutter(250, 150, 30, 30, 0)); // at (50, 50) on screen
			expect(at(50, 50)).toBe(255);
			expect(at(70, 50)).toBe(255);
			expect(at(5, 5)).toBe(0);
			expect(at(95, 95)).toBe(0);
		});

		it("cuts a hard hole where the light is under a zoomed camera too", () => {
			// the hard path, which a zoomed camera on Canvas used to cut where
			// the light would be unzoomed
			camera.zoom = 0.5;
			camera.setBounds(0, 0, 1000, 1000);
			scene(cutter(100, 100, 40, 40, 0));
			expect(at(50, 50)).toBe(255);
			expect(at(65, 50)).toBe(255);
			expect(at(95, 95)).toBe(0);
		});

		// the renderer drops the fraction of the world translate (no
		// `subPixel`), which moved the darkness up to a world unit in from
		// the view's top left edge, leaving them lit: any smoothed follow does
		// it. Zoomed in, that unit is two pixels
		for (const softness of [0, 1]) {
			for (const zoom of [1, 2]) {
				it(`darkens the edges of a camera at a fractional position (softness ${softness}, zoom ${zoom})`, () => {
					camera.zoom = zoom;
					camera.setBounds(0, 0, 4000, 4000);
					scene(cutter(1025, 1040, 10, 10, softness)); // clear of the edges read
					for (const fraction of [0.25, 0.5, 0.75, 0.9]) {
						camera.pos.set(1000 + fraction, 1000 + fraction, camera.pos.z);
						app.repaint();
						app.draw();
						const edges = [at(0, 30), at(30, 0), at(99, 30), at(30, 99)];
						expect(edges, `at ${fraction}`).toEqual([0, 0, 0, 0]);
					}
				});
			}
		}

		it("cuts each camera's darkness for its own view, a second camera included", () => {
			// a 40 x 40 camera in the top right corner, looking far away
			const second = new Camera2d(0, 0, 40, 40);
			second.name = "second";
			second.autoResize = false;
			second.screenX = 60;
			second.screenY = 0;
			second.setBounds(0, 0, 2000, 2000);
			second.moveTo(480, 480);
			stage.cameras.set("second", second);
			try {
				scene(
					cutter(30, 70, 25, 25, 0.5), // seen by the main view
					cutter(500, 500, 15, 15, 0.5), // seen by the second, in its middle
				);
				// the main view's hole, where its light is
				expect(at(30, 70)).toBe(255);
				expect(at(30, 20)).toBe(0);
				// the second camera's hole, in the middle of its corner
				expect(at(80, 20)).toBe(255);
				expect(at(62, 37)).toBe(0);
			} finally {
				stage.cameras.delete("second");
			}
		});

		// ---- many lights -----------------------------------------------------------

		it("does not count lights outside the view against the 32 a pass cuts", () => {
			const lights = [];
			for (let i = 0; i < 40; i++) {
				lights.push(cutter(2000 + i * 50, 2000, 20, 20, 1)); // far off
			}
			lights.push(cutter(50, 50, 20, 20, 0.5)); // the 41st, in view
			scene(...lights);
			near(at(50, 50), 255);
		});

		// ---- frame after frame -------------------------------------------------------

		it("reuses what it draws with, frame after frame", () => {
			scene(cutter(50, 50, 30, 30, 1));
			const reused =
				backend === video.CANVAS
					? renderer._ambientCanvas
					: renderer._ambientShader;
			expect(reused).toBeDefined();
			for (let i = 0; i < 10; i++) {
				app.repaint();
				app.draw();
			}
			expect(
				backend === video.CANVAS
					? renderer._ambientCanvas
					: renderer._ambientShader,
			).toBe(reused);
		});

		// ---- bad values ---------------------------------------------------------------

		it("refuses a softness outside 0..1, leaving it as it was", () => {
			const light = new Light2d(0, 0, 10);
			light.softness = 0.25;
			for (const bad of [-0.1, 1.1, NaN, Infinity, "0.5", null, undefined]) {
				expect(() => {
					light.softness = bad;
				}, String(bad)).toThrow(TypeError);
				expect(light.softness).toBe(0.25);
			}
			light.softness = 0;
			light.softness = 1;
			expect(light.softness).toBe(1);
		});
	});
}
