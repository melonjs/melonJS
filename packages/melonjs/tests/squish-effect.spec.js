import "./helpers/webgpu-globals.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, ShaderEffect, Sprite, SquishEffect } from "../src/index.js";
import { scaleQuad } from "../src/video/gpu/quadcorners.ts";
import Renderer from "../src/video/renderer.js";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * SquishEffect bulges a sprite's middle out, or pinches it in, while its top
 * and bottom rows stay put. Bulging out widens the sprite PAST its own quad,
 * so, like a shader scaling `VERTEX` in its vertex function, the effect asks
 * the quad batchers to draw a wider quad (`_vertexScale`) and narrows the
 * texture back in its fragment. It must never sample outside its frame while
 * drawing in the room that leaves: past the frame is the next atlas frame.
 *
 * The pixel tests draw the RIGHT half of a sheet whose left half is blue, so
 * any sample taken past the frame shows up as blue.
 */
describe("SquishEffect", () => {
	describe("scaleQuad", () => {
		it("scales the width about the centre", () => {
			// 40 wide at x 10: 60 wide, still centred on x 30
			expect(Array.from(scaleQuad(10, 20, 40, 30, 1.5, 1))).toEqual([
				0, 20, 60, 30,
			]);
		});

		it("scales the height about the centre", () => {
			expect(Array.from(scaleQuad(0, 10, 8, 20, 1, 2))).toEqual([0, 0, 8, 40]);
		});

		it("leaves a quad alone at 1", () => {
			expect(Array.from(scaleQuad(3, 4, 5, 6, 1, 1))).toEqual([3, 4, 5, 6]);
		});
	});

	describe("the bulge", () => {
		// a renderer with no programmable pipeline: the effect stays an inert
		// stub, but its JS side still runs
		const stub = { shaderLanguage: null };
		const quiet = () => {
			return vi.spyOn(console, "warn").mockImplementation(() => {});
		};

		it("asks for a quad as wide as its widest row when it bulges out", () => {
			const warn = quiet();
			const squish = new SquishEffect(stub, { bulge: 0.5 });
			warn.mockRestore();
			// the middle row is 1.5x wide
			expect(squish._vertexScale).toEqual({ x: 1.5, y: 1 });
			squish.setBulge(1);
			expect(squish._vertexScale.x).toBe(2);
		});

		it("keeps its quad when it pinches in, which stays inside", () => {
			const warn = quiet();
			const squish = new SquishEffect(stub, { bulge: -0.5 });
			warn.mockRestore();
			expect(squish._vertexScale.x).toBe(1);
			squish.setBulge(0);
			expect(squish._vertexScale.x).toBe(1);
		});

		it("clamps to -1..1", () => {
			const warn = quiet();
			const squish = new SquishEffect(stub);
			warn.mockRestore();
			squish.setBulge(3);
			expect(squish._bulge).toBe(1);
			expect(squish._vertexScale.x).toBe(2);
			squish.setBulge(-3);
			expect(squish._bulge).toBe(-1);
		});

		it("clones as a SquishEffect with the same bulge", () => {
			const warn = quiet();
			const squish = new SquishEffect(stub, { bulge: 0.4 });
			const copy = squish.clone();
			warn.mockRestore();
			expect(copy).toBeInstanceOf(SquishEffect);
			expect(copy).not.toBe(squish);
			expect(copy._bulge).toBe(0.4);
			expect(copy._vertexScale.x).toBe(1.4);
		});
	});

	describe("on the WebGPU quad batcher (mock device)", () => {
		const atlas = {
			getTexture() {
				return { width: 64, height: 32 };
			},
		};
		const quadOf = (renderer) => {
			const f = renderer.calls.writes.at(-1).floats;
			// corners: (x,y) (x+w,y) (x,y+h) (x+w,y+h), stride 7 floats
			return {
				left: f[0],
				right: f[7],
				top: f[1],
				bottom: f[15],
				u0: f[3],
				u1: f[10],
			};
		};
		const make = (bulge) => {
			const renderer = createMockWebGPURenderer();
			const batcher = new WebGPUQuadBatcher(renderer);
			const squish = new SquishEffect({ shaderLanguage: "wgsl" }, { bulge });
			renderer.customShader = squish;
			return { renderer, batcher, squish };
		};

		it("compiles its WGSL body", () => {
			const { squish } = make(0);
			expect(squish.enabled).toBe(true);
			expect(squish.wgslRealization.valid).toBe(true);
		});

		it("draws a wider quad when it bulges out, its UVs inside the frame", () => {
			const { renderer, batcher } = make(0.5);
			// the right half of a 64x32 sheet, drawn 32x32 at (16, 0)
			batcher.addQuad(atlas, 16, 0, 32, 32, 0.5, 0, 1, 1, 0xffffffff);
			const quad = quadOf(renderer);
			// 1.5x as wide about the centre: x 8..56
			expect([quad.left, quad.right]).toEqual([8, 56]);
			expect([quad.top, quad.bottom]).toEqual([0, 32]);
			expect([quad.u0, quad.u1]).toEqual([0.5, 1]);
		});

		it("measures the bulge against the sprite's own frame, not the wider quad", () => {
			const { batcher, squish } = make(0.5);
			batcher.addQuad(atlas, 16, 0, 32, 32, 0.5, 0, 1, 1, 0xffffffff);
			// u0 0.5, v0 0, and 32 px of a 64x32 sheet: 0.5 by 1
			expect(Array.from(squish._frame)).toEqual([0.5, 0, 0.5, 1]);
		});

		it("leaves every other effect's quad alone", () => {
			const renderer = createMockWebGPURenderer();
			const batcher = new WebGPUQuadBatcher(renderer);
			renderer.customShader = new ShaderEffect(
				{ shaderLanguage: "wgsl" },
				{
					wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }",
				},
			);
			batcher.addQuad(atlas, 16, 0, 32, 32, 0.5, 0, 1, 1, 0xffffffff);
			const quad = quadOf(renderer);
			expect([quad.left, quad.right]).toEqual([16, 48]);
			expect([quad.u0, quad.u1]).toEqual([0.5, 1]);
		});

		it("draws the quad as it is when it pinches in", () => {
			const { renderer, batcher } = make(-0.5);
			batcher.addQuad(atlas, 16, 0, 32, 32, 0.5, 0, 1, 1, 0xffffffff);
			const quad = quadOf(renderer);
			expect([quad.left, quad.right]).toEqual([16, 48]);
			expect([quad.u0, quad.u1]).toEqual([0.5, 1]);
		});
	});

	describe("on WebGL, measured in pixels", () => {
		const SIZE = 64;
		const RED = [255, 0, 0];
		const BLUE = [0, 0, 255];
		let renderer;
		let sheet;

		beforeAll(async () => {
			await boot();
			try {
				renderer = await getWebGLRenderer(SIZE, SIZE);
			} catch {
				// WebGL genuinely unavailable — tests skip below
			}
			if (renderer) {
				renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
				renderer.currentBatcher.setProjection(renderer.projectionMatrix);
			}
			// 64x32: a blue frame on the left, the red frame drawn on the right
			sheet = Renderer.createCanvas(64, 32);
			const ctx = sheet.getContext("2d");
			ctx.fillStyle = "#0000ff";
			ctx.fillRect(0, 0, 32, 32);
			ctx.fillStyle = "#ff0000";
			ctx.fillRect(32, 0, 32, 32);
		});

		afterAll(() => {
			releaseWebGLRenderer();
		});

		const requireWebGL = (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
			}
		};

		const pixel = (x, y) => {
			const gl = renderer.gl;
			const out = new Uint8Array(4);
			gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
			return [out[0], out[1], out[2]];
		};

		/** the red frame, 32x32, centered: x 16..48, y 16..48 */
		const drawRed = (effect) => {
			renderer.clearColor("#000000ff");
			renderer.save();
			renderer.customShader = effect;
			renderer.drawImage(sheet, 32, 0, 32, 32, 16, 16, 32, 32);
			renderer.flush();
			renderer.customShader = undefined;
			renderer.restore();
		};

		// middle row y = 32; top row y = 16 (its pixel centre sits 1/32 below
		// the edge, where the bulge is down to a quarter)
		it("leaves the sprite as it is with no bulge", (ctx) => {
			requireWebGL(ctx);
			const squish = new SquishEffect(renderer);
			drawRed(squish);
			expect(pixel(17, 32)).toEqual(RED);
			expect(pixel(46, 32)).toEqual(RED);
			expect(pixel(14, 32)).toEqual([0, 0, 0]);
			expect(pixel(49, 32)).toEqual([0, 0, 0]);
			squish.destroy();
		});

		it("bulges the middle out past the sprite's own edges", (ctx) => {
			requireWebGL(ctx);
			const squish = new SquishEffect(renderer, { bulge: 1 });
			drawRed(squish);
			// twice the width across the middle: the whole canvas
			expect(pixel(2, 32)).toEqual(RED);
			expect(pixel(61, 32)).toEqual(RED);
			squish.destroy();
		});

		it("keeps the top row close to its width", (ctx) => {
			requireWebGL(ctx);
			const squish = new SquishEffect(renderer, { bulge: 1 });
			drawRed(squish);
			// 1.25x wide at the top row: x 12..52, so x 8 stays empty
			expect(pixel(14, 16)).toEqual(RED);
			expect(pixel(8, 16)).toEqual([0, 0, 0]);
			expect(pixel(56, 16)).toEqual([0, 0, 0]);
			squish.destroy();
		});

		it("never samples past the frame while drawing in the room", (ctx) => {
			requireWebGL(ctx);
			const squish = new SquishEffect(renderer, { bulge: 1 });
			drawRed(squish);
			// the left room samples u < 0.5, the blue frame, unless the
			// effect returns transparent there
			for (const x of [0, 4, 8, 11]) {
				expect(pixel(x, 16), `x ${x}`).not.toEqual(BLUE);
				expect(pixel(x, 16), `x ${x}`).toEqual([0, 0, 0]);
			}
			squish.destroy();
		});

		it("pinches the middle in", (ctx) => {
			requireWebGL(ctx);
			const squish = new SquishEffect(renderer, { bulge: -0.5 });
			drawRed(squish);
			// half the width across the middle: x 24..40
			expect(pixel(20, 32)).toEqual([0, 0, 0]);
			expect(pixel(44, 32)).toEqual([0, 0, 0]);
			expect(pixel(32, 32)).toEqual(RED);
			// the top row barely moves
			expect(pixel(18, 16)).toEqual(RED);
			squish.destroy();
		});

		it("squishes the lit path the same way", (ctx) => {
			requireWebGL(ctx);
			const squish = new SquishEffect(renderer, { bulge: 1 });
			const lights = renderer.activeLightCount;
			const normals = renderer.currentNormalMap;
			// a lit scene and a normal-mapped sprite: the lit quad batcher
			renderer.activeLightCount = 1;
			renderer.currentNormalMap = sheet;
			try {
				drawRed(squish);
				expect(renderer.currentBatcher).toBe(renderer.batchers.get("litQuad"));
			} finally {
				renderer.activeLightCount = lights;
				renderer.currentNormalMap = normals;
			}
			expect(pixel(2, 32)).toEqual(RED);
			expect(pixel(8, 16)).toEqual([0, 0, 0]);
			squish.destroy();
		});

		it("squishes a Sprite carrying it", (ctx) => {
			requireWebGL(ctx);
			// through preDraw / postDraw, as a game draws it: the effect
			// becomes the fast path's shader there, not by hand
			const red = Renderer.createCanvas(32, 32);
			const ctx2d = red.getContext("2d");
			ctx2d.fillStyle = "#ff0000";
			ctx2d.fillRect(0, 0, 32, 32);
			const sprite = new Sprite(32, 32, { image: red });
			sprite.addPostEffect(new SquishEffect(renderer, { bulge: 1 }));
			try {
				renderer.clearColor("#000000ff");
				renderer.save();
				sprite.preDraw(renderer);
				sprite.draw(renderer);
				sprite.postDraw(renderer);
				renderer.restore();
				renderer.flush();
				expect(pixel(2, 32)).toEqual(RED);
				expect(pixel(8, 16)).toEqual([0, 0, 0]);
			} finally {
				sprite.destroy();
			}
		});
	});
});
