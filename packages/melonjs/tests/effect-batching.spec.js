/**
 * Sprites drawn through the same ShaderEffect share one draw.
 *
 * An effect sprite used to be a draw of its own: the renderer put the
 * default program back after every one, and the frame an effect keeps its
 * samples inside was a uniform written per sprite. The frame now comes with
 * the quad, the effect stays bound until a sprite without it, and a uniform
 * that takes a new value draws the quads queued under the old one first.
 * So sprites sharing an effect share a draw, and each still draws with the
 * values it was given.
 *
 * Measured on WebGL in draw calls and in pixels (every batched scene is
 * compared with the same scene drawn one sprite per draw), and on WebGPU
 * against the mock renderer.
 */
import "./helpers/webgpu-globals.js";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { boot, GlowEffect, OutlineEffect, ShaderEffect } from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

const SIZE = 96;
const FRAME = 16;

// a tint the sprite is multiplied by
const TINT_BODY = `
uniform vec3 uTint;
vec4 apply(vec4 color, vec2 uv) {
	return vec4(color.rgb * uTint, color.a);
}
`;

// the frame-local coordinate, as a colour
const NOISE_BODY = `
vec4 apply(vec4 color, vec2 uv) {
	return vec4(noise_uv, 0.0, 1.0) * color.a;
}
`;

describe("effect sprites share a draw (WebGL)", () => {
	let renderer;
	let atlas;
	let drawCalls;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// no WebGL here: the tests below mark themselves skipped
		}
		if (renderer) {
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
			const gl = renderer.gl;
			const drawElements = gl.drawElements.bind(gl);
			drawCalls = 0;
			gl.drawElements = (...args) => {
				drawCalls++;
				return drawElements(...args);
			};
		}
		// four frames: white, a red square on transparent, a green one, and
		// opaque blue. Frames 1 and 2 are drawn; their neighbours are opaque
		atlas = Renderer.createCanvas(FRAME * 4, FRAME);
		const ctx = atlas.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, FRAME, FRAME);
		ctx.fillStyle = "#ff0000";
		ctx.fillRect(FRAME + 4, 4, 8, 8);
		ctx.fillStyle = "#00ff00";
		ctx.fillRect(FRAME * 2 + 4, 4, 8, 8);
		ctx.fillStyle = "#0000ff";
		ctx.fillRect(FRAME * 3, 0, FRAME, FRAME);
	});

	afterEach(() => {
		if (renderer) {
			renderer.customShader = undefined;
			renderer.flush();
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	const snapshot = () => {
		const gl = renderer.gl;
		const out = new Uint8Array(SIZE * SIZE * 4);
		gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
		return out;
	};

	// where two snapshots differ by more than `tolerance`, as "x,y"
	const differences = (a, b, tolerance = 0) => {
		const out = [];
		for (let i = 0; i < a.length; i += 4) {
			for (let c = 0; c < 4; c++) {
				if (Math.abs(a[i + c] - b[i + c]) > tolerance) {
					const p = i / 4;
					out.push(`${p % SIZE},${SIZE - 1 - Math.floor(p / SIZE)}`);
					break;
				}
			}
		}
		return out;
	};

	/**
	 * Draw `sprites` ([frame, x, y, before?]) through `effect`, where
	 * `before(effect)` runs ahead of that sprite (a uniform change). With
	 * `alone`, each sprite is drawn before the next one is queued: the
	 * scene as it was before sprites shared a draw.
	 * @returns {{draws: number, pixels: Uint8Array}}
	 */
	const scene = (effect, sprites, alone = false, size = FRAME) => {
		renderer.clearColor("#000000ff");
		renderer.flush();
		const start = drawCalls;
		for (const [frame, x, y, before] of sprites) {
			before?.(effect);
			renderer.customShader = effect;
			renderer.drawImage(
				atlas,
				frame * FRAME,
				0,
				FRAME,
				FRAME,
				x,
				y,
				size,
				size,
			);
			renderer.customShader = undefined;
			if (alone) {
				renderer.flush();
			}
		}
		renderer.flush();
		return { draws: drawCalls - start, pixels: snapshot() };
	};

	const ROW = [
		[1, 4, 4],
		[2, 28, 4],
		[1, 52, 4],
		[2, 76, 4],
		[1, 4, 40],
		[2, 28, 40],
	];

	it("sprites sharing an effect draw in one call", (ctx) => {
		requireWebGL(ctx);
		const effect = new ShaderEffect(renderer, TINT_BODY);
		effect.setUniform("uTint", [1, 0.5, 1]);
		const together = scene(effect, ROW);
		const alone = scene(effect, ROW, true);
		effect.destroy();
		expect(together.draws).toBe(1);
		expect(alone.draws).toBe(ROW.length);
		expect(differences(together.pixels, alone.pixels)).toEqual([]);
	});

	it("setting a uniform to the value it has keeps the draw shared", (ctx) => {
		requireWebGL(ctx);
		const effect = new ShaderEffect(renderer, TINT_BODY);
		const same = (fx) => {
			fx.setUniform("uTint", new Float32Array([1, 0.5, 1]));
		};
		const { draws } = scene(
			effect,
			ROW.map(([f, x, y]) => {
				return [f, x, y, same];
			}),
		);
		effect.destroy();
		expect(draws).toBe(1);
	});

	it("a sprite given its own uniform value draws with it", (ctx) => {
		requireWebGL(ctx);
		// red, then dimmed, then full again: three runs of one value each
		const tint = (r) => {
			return (fx) => {
				fx.setUniform("uTint", [r, 1, 1]);
			};
		};
		const sprites = [
			[1, 4, 4, tint(1)],
			[1, 28, 4, tint(0.25)],
			[1, 52, 4],
			[1, 76, 4, tint(1)],
		];
		const effect = new ShaderEffect(renderer, TINT_BODY);
		const together = scene(effect, sprites);
		const alone = scene(effect, sprites, true);
		effect.destroy();
		expect(together.draws).toBe(3);
		expect(differences(together.pixels, alone.pixels)).toEqual([]);
		// and the values did land where they were set: (8,8) and (32,8)
		const red = (x, y) => {
			return together.pixels[((SIZE - 1 - y) * SIZE + x) * 4];
		};
		expect(red(8, 8)).toBeGreaterThan(240);
		expect(red(32, 8)).toBeLessThan(80);
		expect(red(56, 8)).toBeLessThan(80);
		expect(red(80, 8)).toBeGreaterThan(240);
	});

	it.for([
		[
			"an outline",
			() => {
				return new OutlineEffect(renderer, {
					color: [1, 1, 1],
					width: 2,
					textureSize: [FRAME * 4, FRAME],
				});
			},
		],
		[
			"a glow",
			() => {
				return new GlowEffect(renderer, {
					color: [1, 1, 0],
					width: 3,
					textureSize: [FRAME * 4, FRAME],
				});
			},
		],
	])(
		"%s on sprites from different frames: one draw, each kept to its own frame",
		([, make], ctx) => {
			// the frame comes with each quad, so sprites of different frames
			// share the draw, and none reads its neighbour's opaque edge
			requireWebGL(ctx);
			const effect = make();
			const together = scene(effect, ROW);
			const alone = scene(effect, ROW, true);
			effect.destroy();
			expect(together.draws).toBe(1);
			expect(differences(together.pixels, alone.pixels)).toEqual([]);
		},
	);

	it("the frame effect's program reads the frame where every sprite layout has it", (ctx) => {
		requireWebGL(ctx);
		const effect = new OutlineEffect(renderer, {
			textureSize: [FRAME * 4, FRAME],
		});
		expect(effect._shader.getAttribLocation("aTextureId")).toBe(3);
		expect(effect._shader.getAttribLocation("aFrame")).toBe(4);
		// and the frame is no longer a live uniform of the sprite program
		// (the declaration a mesh reads is still in the source, inactive)
		expect(effect._shader.uniforms.ME_frame ?? null).toBe(null);
		expect(effect._shader.uniforms.ME_frame_half).toBeDefined();
		effect.destroy();
	});

	it("a sprite without the effect, between two with it, draws without it", (ctx) => {
		requireWebGL(ctx);
		const effect = new ShaderEffect(renderer, TINT_BODY);
		effect.setUniform("uTint", [0, 0, 0]);
		renderer.clearColor("#000000ff");
		renderer.customShader = effect;
		renderer.drawImage(atlas, FRAME, 0, FRAME, FRAME, 4, 4, FRAME, FRAME);
		renderer.customShader = undefined;
		renderer.drawImage(atlas, FRAME, 0, FRAME, FRAME, 28, 4, FRAME, FRAME);
		renderer.customShader = effect;
		renderer.drawImage(atlas, FRAME, 0, FRAME, FRAME, 52, 4, FRAME, FRAME);
		renderer.customShader = undefined;
		renderer.flush();
		const pixels = snapshot();
		effect.destroy();
		const red = (x, y) => {
			return pixels[((SIZE - 1 - y) * SIZE + x) * 4];
		};
		// tinted black, plain red, tinted black
		expect(red(8, 8)).toBe(0);
		expect(red(32, 8)).toBeGreaterThan(240);
		expect(red(56, 8)).toBe(0);
	});

	describe("a texture set between two sprites", () => {
		// the effect draws the color of its mask texture
		const MASK_BODY = `
			uniform sampler2D uMask;
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(texture2D(uMask, vec2(0.5)).rgb, 1.0);
			}`;
		const solid = (color) => {
			const canvas = Renderer.createCanvas(4, 4);
			const ctx2d = canvas.getContext("2d");
			ctx2d.fillStyle = color;
			ctx2d.fillRect(0, 0, 4, 4);
			return canvas;
		};
		const at = (pixels, x, y) => {
			const i = ((SIZE - 1 - y) * SIZE + x) * 4;
			return [pixels[i], pixels[i + 1], pixels[i + 2]];
		};

		it("draws each sprite with its own", (ctx) => {
			requireWebGL(ctx);
			const effect = new ShaderEffect(renderer, MASK_BODY);
			const red = solid("#ff0000");
			const green = solid("#00ff00");
			const { pixels } = scene(effect, [
				[
					1,
					4,
					4,
					(fx) => {
						return fx.setTexture("uMask", red);
					},
				],
				[
					2,
					28,
					4,
					(fx) => {
						return fx.setTexture("uMask", green);
					},
				],
			]);
			expect(at(pixels, 12, 12)).toEqual([255, 0, 0]);
			expect(at(pixels, 36, 12)).toEqual([0, 255, 0]);
			effect.destroy();
		});

		it("leaves no deleted texture for a filter change to bind", (ctx) => {
			// the replaced texture, and those of a destroyed effect, are
			// deleted: binding one again is a GL error
			requireWebGL(ctx);
			const gl = renderer.gl;
			const effect = new ShaderEffect(renderer, MASK_BODY);
			scene(effect, [
				[
					1,
					4,
					4,
					(fx) => {
						return fx.setTexture("uMask", solid("#f00"));
					},
				],
			]);
			scene(effect, [
				[
					1,
					4,
					4,
					(fx) => {
						return fx.setTexture("uMask", solid("#0f0"));
					},
				],
			]);
			effect.destroy();
			while (gl.getError() !== gl.NO_ERROR) {
				// drop what earlier tests left
			}
			const filter = renderer.settings.textureFilter;
			renderer.setTextureFilter("linear");
			renderer.setTextureFilter(filter);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});

	it("noise_uv sprites drawn at different sizes each get their own rect", (ctx) => {
		// the rect is a per-sprite uniform: a new one draws the queued
		// sprites first, so each is drawn with its own
		requireWebGL(ctx);
		const sprites = [
			[1, 4, 4],
			[2, 28, 4],
		];
		const effect = new ShaderEffect(renderer, NOISE_BODY);
		const draw = (alone) => {
			renderer.clearColor("#000000ff");
			renderer.flush();
			const start = drawCalls;
			let size = FRAME;
			for (const [frame, x, y] of sprites) {
				renderer.customShader = effect;
				renderer.drawImage(
					atlas,
					frame * FRAME,
					0,
					FRAME,
					FRAME,
					x,
					y,
					size,
					size,
				);
				renderer.customShader = undefined;
				size += 8;
				if (alone) {
					renderer.flush();
				}
			}
			renderer.flush();
			return { draws: drawCalls - start, pixels: snapshot() };
		};
		const together = draw(false);
		const alone = draw(true);
		effect.destroy();
		expect(together.draws).toBe(2);
		expect(differences(together.pixels, alone.pixels)).toEqual([]);
	});

	it("noise_uv sprites with the same rect share the draw", (ctx) => {
		requireWebGL(ctx);
		const effect = new ShaderEffect(renderer, NOISE_BODY);
		const sprites = [
			[1, 4, 4],
			[1, 28, 4],
			[1, 52, 4],
		];
		const together = scene(effect, sprites);
		const alone = scene(effect, sprites, true);
		effect.destroy();
		expect(together.draws).toBe(1);
		expect(differences(together.pixels, alone.pixels)).toEqual([]);
	});
});

describe("effect sprites share a draw (WebGPU, mock renderer)", () => {
	let renderer;
	let batcher;
	const atlas = {
		getTexture() {
			return { width: 64, height: 16 };
		},
	};

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUQuadBatcher(renderer);
	});

	const quiet = (make) => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			return make();
		} finally {
			warn.mockRestore();
		}
	};

	it("a frame effect on sprites from different frames: one draw", () => {
		const effect = quiet(() => {
			return new OutlineEffect(
				{ shaderLanguage: "wgsl" },
				{ textureSize: [64, 16] },
			);
		});
		renderer.customShader = effect;
		for (let i = 0; i < 4; i++) {
			const u = (i % 4) * 0.25;
			batcher.addQuad(atlas, i * 20, 0, 16, 16, u, 0, u + 0.25, 1, 0xffffffff);
		}
		expect(renderer.calls.drawIndexed).toEqual([]);
		batcher.flush();
		expect(renderer.calls.drawIndexed).toEqual([24]);
	});

	it("a frame effect's module reads the frame from the quad", () => {
		const effect = quiet(() => {
			return new GlowEffect(
				{ shaderLanguage: "wgsl" },
				{ textureSize: [64, 16] },
			);
		});
		const code = effect.wgslRealization.code;
		expect(code).toContain("@location(4) aFrame : vec2f");
		expect(code).toContain("ME_frame_v = vec4f(");
		// the frame is the box of the vertex's corner and the opposite one
		expect(code).toContain(
			"vec4f(min(aRegion, aFrame), max(aRegion, aFrame)),",
		);
		// the body's reads now go to the quad's frame; the half texel stays
		expect(code).not.toMatch(/\bfx\.ME_frame\b/);
		expect(code).toMatch(/\bfx\.ME_frame_half\b/);
	});

	it("a new noise_uv rect draws the sprites queued under the old one", () => {
		const effect = quiet(() => {
			return new ShaderEffect(
				{ shaderLanguage: "wgsl" },
				{
					wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return vec4f(noise_uv, 0.0, 1.0) * color.a; }",
				},
			);
		});
		renderer.customShader = effect;
		batcher.addQuad(atlas, 0, 0, 16, 16, 0, 0, 0.25, 1, 0xffffffff);
		batcher.addQuad(atlas, 20, 0, 16, 16, 0, 0, 0.25, 1, 0xffffffff);
		// the same rect: still queued
		expect(renderer.calls.drawIndexed).toEqual([]);
		// another frame: the two queued draw first
		batcher.addQuad(atlas, 40, 0, 16, 16, 0.25, 0, 0.5, 1, 0xffffffff);
		expect(renderer.calls.drawIndexed).toEqual([12]);
	});

	it("a texture set between two sprites draws the sprites queued with the old one", () => {
		const effect = quiet(() => {
			return new ShaderEffect(
				{ shaderLanguage: "wgsl" },
				{
					wgsl: `
@group(3) @binding(1) var uMask : texture_2d<f32>;
@group(3) @binding(2) var uMaskSampler : sampler;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return textureSample(uMask, uMaskSampler, vec2f(0.5)) * color.a;
}`,
				},
			);
		});
		renderer.customShader = effect;
		effect.setTexture("uMask", { width: 4, height: 4 });
		batcher.addQuad(atlas, 0, 0, 16, 16, 0, 0, 0.25, 1, 0xffffffff);
		batcher.addQuad(atlas, 20, 0, 16, 16, 0, 0, 0.25, 1, 0xffffffff);
		expect(renderer.calls.drawIndexed).toEqual([]);
		effect.setTexture("uMask", { width: 4, height: 4 });
		expect(renderer.calls.drawIndexed).toEqual([12]);
	});

	it("a uniform array changed in place draws the sprites queued with the old value", () => {
		// callers reuse one array: the value it held is what is compared
		const effect = quiet(() => {
			return new ShaderEffect(
				{ shaderLanguage: "wgsl" },
				{
					wgsl: `
struct U { uRect : vec4f };
@group(3) @binding(0) var<uniform> fx : U;
fn apply(color : vec4f, uv : vec2f) -> vec4f { return fx.uRect * color.a; }`,
				},
			);
		});
		renderer.customShader = effect;
		const rect = [0, 0, 0.25, 1];
		effect.setUniform("uRect", rect);
		batcher.addQuad(atlas, 0, 0, 16, 16, 0, 0, 0.25, 1, 0xffffffff);
		rect[0] = 0.25;
		rect[2] = 0.5;
		effect.setUniform("uRect", rect);
		expect(renderer.calls.drawIndexed).toEqual([6]);
		batcher.addQuad(atlas, 20, 0, 16, 16, 0.25, 0, 0.5, 1, 0xffffffff);
		// the same array, unchanged: still queued
		effect.setUniform("uRect", rect);
		expect(renderer.calls.drawIndexed).toEqual([6]);
	});

	it("a screen_texture effect still draws each sprite on its own", () => {
		const effect = quiet(() => {
			return new ShaderEffect(
				{ shaderLanguage: "wgsl" },
				{
					wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return textureSample(screen_texture, screen_sampler, screen_uv) * color; }",
				},
			);
		});
		renderer.customShader = effect;
		batcher.addQuad(atlas, 0, 0, 16, 16, 0, 0, 0.25, 1, 0xffffffff);
		batcher.addQuad(atlas, 20, 0, 16, 16, 0, 0, 0.25, 1, 0xffffffff);
		expect(renderer.calls.drawIndexed).toEqual([6, 6]);
	});
});
