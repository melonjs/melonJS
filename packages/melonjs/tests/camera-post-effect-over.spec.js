/**
 * A camera with post effects, drawn after another camera, draws OVER it.
 *
 * A stage's cameras draw in order, each over the ones before it: a
 * background camera first, the game's camera over it. Without post effects
 * that already held. With one, the camera's pass started like a frame,
 * cleared to the background colour, and its result was copied over the
 * whole screen, wiping out everything the cameras before it drew. A camera
 * after the first now starts its pass transparent and blends it over the
 * frame, so a post effect no longer changes what a camera covers.
 *
 * Read in pixels on WebGL: a red background on one camera, a blue square on
 * a second, full-screen camera with a pass-through post effect.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Renderable,
	ShaderEffect,
	state,
	video,
} from "../src/index.js";

const SIZE = 100;
const BACKGROUND = 2;
const GAME = 4;

/** a filled square, top left at (x, y), on `layer` */
class Square extends Renderable {
	constructor(x, y, size, color, layer) {
		super(x, y, size, size);
		this.anchorPoint.set(0, 0);
		this.color = color;
		this.visibilityLayer = layer;
	}
	draw(renderer) {
		renderer.setColor(this.color);
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

describe("a camera's post effects, over another camera (WebGL)", () => {
	let app;
	let stage;
	let back;
	let front;

	beforeAll(async () => {
		boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: video.WEBGL,
			scale: "1.0",
			antiAlias: false,
			backgroundColor: "#000000",
			failIfMajorPerformanceCaveat: false,
		});
		await app.init();
		stage = state.current();
		// the stage's own camera draws first: the background
		back = stage.cameras.get("default");
		// then a second, full-screen one: the game
		front = new Camera2d(0, 0, SIZE, SIZE);
		front.name = "front";
		stage.cameras.set("front", front);
	});

	afterEach(() => {
		app.world.reset();
		back.cullMask = -1;
		front.cullMask = -1;
		for (const camera of [back, front]) {
			camera.clearPostEffects?.();
			camera.postEffects.length = 0;
		}
	});

	afterAll(() => {
		stage?.cameras.delete("front");
		return app?.destroy();
	});

	const requireWebGL = (ctx) => {
		if (app.renderer.gl === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	/** an effect drawing what it is given */
	const passThrough = () => {
		return new ShaderEffect(app.renderer, {
			glsl: "vec4 apply(vec4 color, vec2 uv) { return color; }",
			wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }",
		});
	};

	/** a red background for one camera, a blue square for the other */
	const drawScene = () => {
		const world = app.world;
		world.visibilityLayer = 1 | BACKGROUND | GAME;
		back.cullMask = BACKGROUND;
		front.cullMask = GAME;
		world.addChild(new Square(0, 0, SIZE, "#ff0000", BACKGROUND), 0);
		world.addChild(new Square(40, 40, 20, "#0000ff", GAME), 1);
		world.sortNow();
		world.update(0);
		app.repaint();
		app.draw();
	};

	const pixel = (x, y) => {
		const gl = app.renderer.gl;
		app.renderer.flush();
		const out = new Uint8Array(4);
		gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
		return Array.from(out.slice(0, 3)).join(",");
	};

	it("draws both cameras when neither has a post effect", (ctx) => {
		requireWebGL(ctx);
		drawScene();
		expect(pixel(5, 5)).toBe("255,0,0");
		expect(pixel(50, 50)).toBe("0,0,255");
	});

	it("keeps what the first camera drew when the second has a post effect", (ctx) => {
		requireWebGL(ctx);
		front.addPostEffect(passThrough());
		drawScene();
		// the background camera's red, not the background colour
		expect(pixel(5, 5)).toBe("255,0,0");
		// and the second camera's square over it
		expect(pixel(50, 50)).toBe("0,0,255");
	});

	it("keeps both when both cameras have post effects", (ctx) => {
		requireWebGL(ctx);
		back.addPostEffect(passThrough());
		front.addPostEffect(passThrough());
		drawScene();
		expect(pixel(5, 5)).toBe("255,0,0");
		expect(pixel(50, 50)).toBe("0,0,255");
	});

	/** an effect inverting what it is given (premultiplied) */
	const invert = () => {
		return new ShaderEffect(app.renderer, {
			glsl: "vec4 apply(vec4 color, vec2 uv) { return vec4(color.a - color.rgb, color.a); }",
			wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return vec4f(color.a - color.rgb, color.a); }",
		});
	};

	it("still starts the frame with the first camera's post-effect pass", (ctx) => {
		requireWebGL(ctx);
		// nothing on the first camera's layer: its pass is the background
		// colour, red, which the effect inverts to cyan. Started transparent
		// (as a later camera's is), it would invert to white instead
		app.renderer.backgroundColor.parseCSS("#ff0000");
		try {
			back.addPostEffect(invert());
			front.cullMask = 0;
			app.world.visibilityLayer = 1 | BACKGROUND | GAME;
			back.cullMask = 8;
			app.world.update(0);
			app.repaint();
			app.draw();
			expect(pixel(5, 5)).toBe("0,255,255");
		} finally {
			app.renderer.backgroundColor.parseCSS("#000000");
		}
	});
});
