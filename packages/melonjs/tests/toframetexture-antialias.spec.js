import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	Renderable,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * A frame that captures an anti-aliased canvas (`renderer.toFrameTexture()`,
 * a `screen_texture` effect, an advanced blend mode) and then draws over it.
 *
 * The browser resolves a multisampled canvas each time it is read, and once
 * more when the frame is shown. Chromium loses a frame resolved in the middle
 * and drawn to afterwards: the page shows black instead, more often the
 * longer the frame took. Measured on its software renderer by recording the
 * page: the Aquarium example showed 114 black frames in 125 (9 in 125 in the
 * headless shell); plain WebGL doing the same, 6 screenshots in 40; with
 * anti-aliasing off, or nothing drawn after the capture, none.
 *
 * What the page shows cannot be read from inside it, so this checks the
 * remedy rather than the symptom: a frame that captured the canvas is closed
 * by one more read of it, a single pixel, which is what was measured to give
 * no black frame in 375.
 */
const SIZE = 32;

/** every copy off the framebuffer since the spies were last cleared: [width, height] */
const copies = (image, sub) => {
	return [
		...image.mock.calls.map((c) => {
			return [c[5], c[6]];
		}),
		...sub.mock.calls.map((c) => {
			return [c[6], c[7]];
		}),
	];
};

describe.each([
	{ antiAlias: true, name: "an anti-aliased canvas" },
	{ antiAlias: false, name: "a canvas that is not anti-aliased" },
])("capturing $name", ({ antiAlias }) => {
	let app;
	let renderer;
	let gl;
	let image;
	let sub;
	// the test browser has to grant the multisampling it is asked for
	let multisampled;

	beforeAll(async () => {
		boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			antiAlias,
		});
		await app.init();
		renderer = app.renderer;
		if (renderer instanceof WebGLRenderer) {
			gl = renderer.gl;
			multisampled = gl.getContextAttributes().antialias === true;
			image = vi.spyOn(gl, "copyTexImage2D");
			sub = vi.spyOn(gl, "copyTexSubImage2D");
		}
	});

	afterAll(() => {
		image?.mockRestore();
		sub?.mockRestore();
		app.destroy();
	});

	beforeEach(() => {
		image?.mockClear();
		sub?.mockClear();
	});

	it("gets the canvas it asked for", (ctx) => {
		if (gl === undefined) {
			ctx.skip("WebGL is not available");
		}
		if (antiAlias && !multisampled) {
			ctx.skip("the browser gave no multisampled canvas");
		}
		expect(multisampled).toBe(antiAlias);
		expect(renderer._canvasMultisampled).toBe(antiAlias);
	});

	it("a frame that captured nothing is closed with no read", (ctx) => {
		if (gl === undefined) {
			ctx.skip("WebGL is not available");
		}
		renderer.clear();
		renderer.flush();
		renderer.endFrame();
		expect(copies(image, sub)).toEqual([]);
	});

	it("a frame that captured the canvas is closed by a read of one pixel, when anti-aliased", (ctx) => {
		if (gl === undefined || multisampled !== antiAlias) {
			ctx.skip("WebGL, or the canvas asked for, is not available");
		}
		renderer.clear();
		const capture = renderer.toFrameTexture();
		expect(copies(image, sub)).toEqual([[SIZE, SIZE]]);
		image.mockClear();
		sub.mockClear();

		renderer.flush();
		renderer.endFrame();
		expect(copies(image, sub)).toEqual(antiAlias ? [[1, 1]] : []);
		expect(gl.getError()).toBe(gl.NO_ERROR);

		// the capture the game holds is not what the read went into
		expect(renderer.getSharedFrameTexture()).toBe(capture);
		expect(capture.width).toBe(SIZE);
		expect(capture.height).toBe(SIZE);

		// said once: closing the frame again reads nothing
		image.mockClear();
		sub.mockClear();
		renderer.endFrame();
		expect(copies(image, sub)).toEqual([]);
	});

	it("every such frame is closed, into the same one-pixel texture", (ctx) => {
		if (gl === undefined || multisampled !== antiAlias || !antiAlias) {
			ctx.skip("needs an anti-aliased WebGL canvas");
		}
		const created = vi.spyOn(gl, "createTexture");
		for (let frame = 0; frame < 3; frame++) {
			renderer.clear();
			renderer.toFrameTexture();
			renderer.flush();
			image.mockClear();
			sub.mockClear();
			renderer.endFrame();
			expect(copies(image, sub), `frame ${frame + 1}`).toEqual([[1, 1]]);
		}
		// allocated by the earlier test, and kept
		expect(created).not.toHaveBeenCalled();
		created.mockRestore();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("the application closes the frame a renderable captured in its draw", (ctx) => {
		if (gl === undefined || multisampled !== antiAlias) {
			ctx.skip("WebGL, or the canvas asked for, is not available");
		}
		class Capturing extends Renderable {
			constructor() {
				super(0, 0, SIZE, SIZE);
				this.anchorPoint.set(0, 0);
			}
			draw(target) {
				target.toFrameTexture();
			}
		}
		const capturing = new Capturing();
		app.world.addChild(capturing);
		// drawn without waiting for an update to find it in view
		capturing.inViewport = true;
		app.isDirty = true;
		app.draw();
		expect(copies(image, sub)).toEqual(
			antiAlias
				? [
						[SIZE, SIZE],
						[1, 1],
					]
				: [[SIZE, SIZE]],
		);
		app.world.removeChildNow(capturing);
	});

	it("a reset lets the one-pixel texture go, and the next frame makes another", (ctx) => {
		if (gl === undefined || multisampled !== antiAlias || !antiAlias) {
			ctx.skip("needs an anti-aliased WebGL canvas");
		}
		expect(renderer._canvasResolve).toBeDefined();
		renderer.reset();
		expect(renderer._canvasResolve).toBeUndefined();

		renderer.clear();
		renderer.toFrameTexture();
		renderer.flush();
		image.mockClear();
		sub.mockClear();
		renderer.endFrame();
		expect(copies(image, sub)).toEqual([[1, 1]]);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});
});
