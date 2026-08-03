import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	Renderable,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Regression coverage for renderables nested inside a *floating* Container
 * (the classic HUD shape: `container.floating = true` with plain BitmapText /
 * sprite children). The children draw through the quad batcher exactly like a
 * direct floating renderable does, so a nested child must produce the same
 * pixels as the same renderable added directly to the world — the floating
 * bracket in `Container.draw` (save / resetTransform / screenProjection swap /
 * restore) must not eat them.
 *
 * Pixels are asserted by reading the default framebuffer straight after
 * `app.draw()` — same-task readback, so `preserveDrawingBuffer` is not needed.
 */
const SIZE = 64;

// paints an opaque solid quad at `pos` THROUGH the quad batcher (drawImage of
// a solid canvas — the exact path BitmapText glyphs take), so the spec covers
// the batched-sprite pipeline without needing a font fixture
class SolidQuad extends Renderable {
	constructor(x, y, w, h, color) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		const source = document.createElement("canvas");
		source.width = w;
		source.height = h;
		const ctx2d = source.getContext("2d");
		ctx2d.fillStyle = color;
		ctx2d.fillRect(0, 0, w, h);
		this.image = source;
	}

	draw(renderer) {
		renderer.drawImage(
			this.image,
			0,
			0,
			this.width,
			this.height,
			this.pos.x,
			this.pos.y,
			this.width,
			this.height,
		);
	}
}

describe("floating Container children (WebGL)", () => {
	let app;
	let renderer;
	let gl;

	beforeAll(async () => {
		await boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			antiAlias: false,
		});
		await app.init();
		renderer = app.renderer;
		if (renderer instanceof WebGLRenderer) {
			gl = renderer.gl;
		}
	});

	afterEach(() => {
		// each test owns its scene graph — drop leftovers without waiting for
		// the deferred remove path
		if (app) {
			for (const child of app.world.getChildren().slice()) {
				app.world.removeChildNow(child);
			}
		}
	});

	const requireWebGL = (ctx) => {
		if (gl === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
	};

	// run one engine frame: update (computes inViewport for nested children)
	// then a forced draw
	const drawFrame = () => {
		app.world.update(16);
		app.repaint();
		app.draw();
	};

	// read one pixel of the default framebuffer at canvas coords (x, y)
	const readPixel = (x, y) => {
		const px = new Uint8Array(4);
		gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return Array.from(px);
	};

	it("control: a non-floating renderable in the world produces pixels", (ctx) => {
		requireWebGL(ctx);
		app.world.addChild(new SolidQuad(8, 8, 16, 16, "#ff0000"));
		drawFrame();
		expect(readPixel(16, 16)).toEqual([255, 0, 0, 255]);
	});

	it("control: a directly-floating renderable produces pixels", (ctx) => {
		requireWebGL(ctx);
		const quad = new SolidQuad(8, 8, 16, 16, "#00ff00");
		quad.floating = true;
		app.world.addChild(quad);
		drawFrame();
		expect(readPixel(16, 16)).toEqual([0, 255, 0, 255]);
	});

	it("a renderable nested in a floating container produces pixels", (ctx) => {
		requireWebGL(ctx);
		const hud = new Container();
		hud.floating = true;
		hud.addChild(new SolidQuad(8, 8, 16, 16, "#0000ff"));
		app.world.addChild(hud);
		drawFrame();
		expect(readPixel(16, 16)).toEqual([0, 0, 255, 255]);
	});

	it("a renderable nested in a floating container at depth Infinity produces pixels", (ctx) => {
		requireWebGL(ctx);
		// the classic HUD boilerplate — `depth = Infinity` to draw on top
		const hud = new Container();
		hud.floating = true;
		hud.depth = Number.POSITIVE_INFINITY;
		hud.addChild(new SolidQuad(8, 8, 16, 16, "#ffff00"));
		app.world.addChild(hud);
		drawFrame();
		expect(readPixel(16, 16)).toEqual([255, 255, 0, 255]);
	});

	it("an Infinity-sized floating container leaves the transform finite for later draws", (ctx) => {
		requireWebGL(ctx);
		// a HUD-and-world frame: the floating bracket plus the container's
		// own save/restore must leave the world sibling drawn after the HUD
		// untouched — both must land on screen
		const hud = new Container();
		hud.floating = true;
		hud.addChild(new SolidQuad(40, 40, 8, 8, "#00ffff"));
		app.world.addChild(hud, 1);
		app.world.addChild(new SolidQuad(8, 8, 16, 16, "#ff00ff"), 2);
		drawFrame();
		expect(readPixel(44, 44)).toEqual([0, 255, 255, 255]);
		expect(readPixel(16, 16)).toEqual([255, 0, 255, 255]);
	});
});
