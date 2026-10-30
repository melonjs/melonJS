/**
 * A renderable drawn through a chain of effects lands inside the clip it is
 * drawn under: a camera's view on the screen (a minimap, a split screen),
 * or a clipping container.
 *
 * With two effects or more (or one, on a renderable that sets
 * `postEffectNeedsCapture`), the renderable is drawn into a capture the size
 * of the canvas, so its pass drops the clip, and the chain's last blit
 * composites the result onto what is behind it. That composite drew before
 * the clip was put back, so the whole capture landed: a minimap's chained
 * sprites spilled over the main view. With one effect drawn straight on it
 * was always clipped.
 *
 * Read in pixels on WebGL: a white sprite over black, clipped to the left
 * half of the screen, is black on the right half however it is drawn.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Container, ShaderEffect, Sprite } from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 64;

describe("a chain of effects composites inside its clip (WebGL)", () => {
	let renderer;
	let gl;
	let white;

	beforeAll(async () => {
		boot();
		renderer = await getWebGLRenderer(SIZE, SIZE);
		if (renderer instanceof WebGLRenderer) {
			gl = renderer.gl;
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		} else {
			renderer = undefined;
		}
		white = Renderer.createCanvas(SIZE, SIZE);
		const ctx = white.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, SIZE, SIZE);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	/** an effect drawing what it is given */
	const passThrough = () => {
		return new ShaderEffect(renderer, {
			glsl: "vec4 apply(vec4 color, vec2 uv) { return color; }",
			wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }",
		});
	};

	/** a white square over the whole screen, through `effects` pass-throughs */
	const square = (effects) => {
		const sprite = new Sprite(SIZE / 2, SIZE / 2, { image: white });
		for (let i = 0; i < effects; i++) {
			sprite.addPostEffect(passThrough());
		}
		return sprite;
	};

	/**
	 * draw a renderable over black, with `clip` applied first, and read a
	 * pixel in the left half and one in the right half
	 */
	const halves = (renderable, clip) => {
		renderer.backgroundColor.parseCSS("#000000");
		renderer.clear();
		renderer.save();
		renderer.resetTransform();
		clip?.();
		renderable.preDraw(renderer);
		renderable.draw(renderer);
		renderable.postDraw(renderer);
		renderer.restore();
		renderer.flush();
		const read = (x) => {
			const px = new Uint8Array(4);
			gl.readPixels(x, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return px[0];
		};
		gl.finish();
		return [read(SIZE / 4), read((SIZE * 3) / 4)];
	};

	// the left half of the screen, as a minimap camera clips to its view
	const leftHalf = () => {
		renderer.clipRect(0, 0, SIZE / 2, SIZE);
	};

	it.for([0, 1, 2, 3])(
		"a sprite through %i effect(s) stays inside the clip it is drawn under",
		(effects, ctx) => {
			requireWebGL(ctx);
			expect(halves(square(effects), leftHalf)).toEqual([255, 0]);
		},
	);

	it("so does one effect drawn into a target of its own", (ctx) => {
		requireWebGL(ctx);
		// as a UIPanel, a ProgressBar or a Trail draws its single effect
		const sprite = square(1);
		sprite.postEffectNeedsCapture = true;
		expect(halves(sprite, leftHalf)).toEqual([255, 0]);
	});

	it("inside a clipping container", (ctx) => {
		requireWebGL(ctx);
		const container = new Container(0, 0, SIZE / 2, SIZE);
		container.clipping = true;
		const sprite = square(2);
		container.addChild(sprite);
		// drawn as a container draws what an update found in view
		sprite.inViewport = true;
		expect(halves(container)).toEqual([255, 0]);
	});

	it("and the clip is back as it was once it is drawn", (ctx) => {
		requireWebGL(ctx);
		renderer.save();
		renderer.resetTransform();
		leftHalf();
		const sprite = square(2);
		sprite.preDraw(renderer);
		sprite.draw(renderer);
		sprite.postDraw(renderer);
		expect(renderer._scissorActive).toBe(true);
		expect(Array.from(renderer.currentScissor)).toEqual([0, 0, SIZE / 2, SIZE]);
		renderer.restore();
		expect(renderer._scissorActive).toBe(false);
	});

	it("unclipped, it covers the screen", (ctx) => {
		requireWebGL(ctx);
		expect(halves(square(2))).toEqual([255, 255]);
	});
});
