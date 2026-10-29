/**
 * A renderable drawn through two or more post effects keeps its opacity
 * (#1791).
 *
 * With two effects or more (or one, on a renderable that sets
 * `postEffectNeedsCapture`), the renderable is drawn into a target of its
 * own, opaque, and the chain's last blit composites the result onto what is
 * behind it. That blit drew with an opaque tint, so the opacity the
 * renderable was drawn at never reached the screen: `setOpacity()`, a
 * parent's opacity, or a fading tween did nothing until the renderable was
 * removed. With one effect drawn straight on (no target of its own) it
 * always worked.
 *
 * Read in pixels on WebGL: a white sprite over black at opacity 0.2 is 51,
 * however many effects it goes through.
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
// what a channel of white at this opacity comes out as, over black
const at = (opacity) => {
	return Math.round(255 * opacity);
};

describe("opacity through a post-effect chain (WebGL)", () => {
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
		white = Renderer.createCanvas(32, 32);
		const ctx = white.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, 32, 32);
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

	/** a white square in the middle, through `effects` pass-throughs */
	const square = (effects) => {
		const sprite = new Sprite(SIZE / 2, SIZE / 2, { image: white });
		for (let i = 0; i < effects; i++) {
			sprite.addPostEffect(passThrough());
		}
		return sprite;
	};

	/** draw a renderable over `background`, as a container would, and read the middle */
	const middle = (renderable, background = "#000000") => {
		renderer.backgroundColor.parseCSS(background);
		renderer.clear();
		renderer.save();
		renderer.resetTransform();
		renderable.preDraw(renderer);
		renderable.draw(renderer);
		renderable.postDraw(renderer);
		renderer.restore();
		renderer.flush();
		const px = new Uint8Array(4);
		gl.finish();
		gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px[0];
	};

	it.for([0, 1, 2, 3])(
		"a sprite at opacity 0.2 through %i effect(s) is drawn at 0.2",
		(effects, ctx) => {
			requireWebGL(ctx);
			const sprite = square(effects);
			sprite.setOpacity(0.2);
			expect(Math.abs(middle(sprite) - at(0.2))).toBeLessThanOrEqual(2);
		},
	);

	it("a fully opaque sprite through two effects stays opaque", (ctx) => {
		requireWebGL(ctx);
		expect(middle(square(2))).toBe(255);
	});

	it("takes its parent's opacity too", (ctx) => {
		requireWebGL(ctx);
		const parent = new Container(0, 0, SIZE, SIZE);
		parent.setOpacity(0.5);
		const sprite = square(2);
		sprite.setOpacity(0.5);
		parent.addChild(sprite);
		// drawn as a container draws what an update found in view
		sprite.inViewport = true;
		// the container draws its children through its own preDraw
		expect(Math.abs(middle(parent) - at(0.25))).toBeLessThanOrEqual(2);
	});

	it("so does one effect drawn into a target of its own", (ctx) => {
		requireWebGL(ctx);
		// as a UIPanel, a ProgressBar or a Trail draws its single effect
		const sprite = square(1);
		sprite.postEffectNeedsCapture = true;
		sprite.setOpacity(0.2);
		expect(Math.abs(middle(sprite) - at(0.2))).toBeLessThanOrEqual(2);
	});

	it("a chain inside a chain lands at both opacities, once each", (ctx) => {
		requireWebGL(ctx);
		const parent = new Container(0, 0, SIZE, SIZE);
		parent.addPostEffect(passThrough());
		parent.addPostEffect(passThrough());
		parent.setOpacity(0.5);
		const sprite = square(2);
		sprite.setOpacity(0.5);
		parent.addChild(sprite);
		// drawn as a container draws what an update found in view
		sprite.inViewport = true;
		expect(Math.abs(middle(parent) - at(0.25))).toBeLessThanOrEqual(2);
	});

	it("keeps its blend mode as it fades", (ctx) => {
		requireWebGL(ctx);
		// added onto a grey of 64, at half opacity: 64 + 128
		const one = square(1);
		one.setOpacity(0.5);
		one.blendMode = "lighter";
		const two = square(2);
		two.setOpacity(0.5);
		two.blendMode = "lighter";
		const expected = middle(one, "#404040");
		expect(Math.abs(expected - (64 + at(0.5)))).toBeLessThanOrEqual(2);
		expect(Math.abs(middle(two, "#404040") - expected)).toBeLessThanOrEqual(2);
	});

	it("leaves a camera's chain whole", (ctx) => {
		requireWebGL(ctx);
		// a camera composites everything it drew, whatever alpha is current
		const camera = {
			_postEffectManaged: true,
			isDefault: true,
			postEffects: [passThrough(), passThrough()],
		};
		renderer.backgroundColor.parseCSS("#000000");
		renderer.clear();
		renderer.save();
		renderer.resetTransform();
		renderer.setGlobalAlpha(0.3);
		renderer.beginPostEffect(camera);
		renderer.setGlobalAlpha(1);
		renderer.drawImage(white, 0, 0, 32, 32, 0, 0, SIZE, SIZE);
		renderer.endPostEffect(camera);
		renderer.restore();
		renderer.flush();
		const px = new Uint8Array(4);
		gl.finish();
		gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		expect(px[0]).toBe(255);
	});
});
