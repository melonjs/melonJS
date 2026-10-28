/**
 * A sprite keeps its samples inside its own frame under the
 * `"linear-mipmap"` texture filter.
 *
 * A sprite cut from an atlas draws one frame of a bigger texture. Drawn
 * small, it reads a mipmap level whose texels span many of the art's pixels,
 * and a sample near the frame's edge reaches into the next frame: the next
 * frame's edge shows as a faint line along the sprite's. Every sprite vertex
 * carries the UV of its quad's opposite corner, and the sprite shaders keep
 * each sample half a texel of the level it reads inside the frame.
 *
 * Read in pixels on WebGL, from an atlas of four frames: the one drawn is
 * transparent around a green square, and its three neighbours are solid red,
 * blue and yellow. Anything with red or blue in it came from a neighbour.
 * Every bleed assertion is paired with a run of the same scene with the
 * clamp forced off, which must bleed, so a scene that cannot show the
 * defect cannot pass for one that fixed it.
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
import { Application, boot, Matrix3d, video } from "../src/index.js";
import VertexArrayBuffer from "../src/video/buffer/vertex.js";
import {
	FRAME_CLAMP,
	FRAME_UNBOUNDED,
	frameClampMode,
	isFramed,
} from "../src/video/gpu/frame.js";
import Renderer from "../src/video/renderer.js";
import GLShader from "../src/video/webgl/glshader.js";
import { FRAME_FRAGMENT_GLSL } from "../src/video/webgl/shaders/frameclamp.js";
import { buildMultiTextureFragment } from "../src/video/webgl/shaders/multitexture.js";
import { buildLitMultiTextureFragment } from "../src/video/webgl/shaders/multitexture-lit.js";
import WebGPULitQuadBatcher from "../src/video/webgpu/batchers/lit_quad_batcher.js";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import WebGPUUniformRing from "../src/video/webgpu/buffer/uniformring.js";
import { FRAME_UNIFORM_SIZE } from "../src/video/webgpu/pipeline/bindgroups.js";
import WebGPUTMXRenderer from "../src/video/webgpu/renderers/tmxlayer/orthogonal.js";
import quadWGSL from "../src/video/webgpu/shaders/quad.wgsl";
import quadLitWGSL from "../src/video/webgpu/shaders/quad-lit.wgsl";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

describe("the frame a sprite vertex carries", () => {
	describe("VertexArrayBuffer#pushSprite", () => {
		it("writes the frame after the slot, whatever the layout's width", () => {
			// the quad layout (9 floats), the WebGPU lit one (10: shininess),
			// and the WebGL lit one (11: normal map slot and shininess)
			for (const size of [9, 10, 11]) {
				const buffer = new VertexArrayBuffer(size, 4);
				buffer.pushSprite(1, 2, 3, 0.25, 0.5, 0xff00ff00, 4, 0.75, 0.125, 7, 8);
				const f = buffer.bufferF32;
				expect([f[0], f[1], f[2], f[3], f[4]]).toEqual([1, 2, 3, 0.25, 0.5]);
				expect(buffer.bufferU32[5]).toBe(0xff00ff00);
				expect(f[6]).toBe(4);
				// floats 7 and 8 in every layout, so an effect's program reads
				// the frame at the same location on any of them
				expect([f[7], f[8]]).toEqual([0.75, 0.125]);
				if (size > 9) {
					expect(f[9]).toBe(7);
				}
				if (size > 10) {
					expect(f[10]).toBe(8);
				}
				expect(buffer.vertexCount).toBe(1);
			}
		});

		it("does not write the extras into a layout that has none", () => {
			const buffer = new VertexArrayBuffer(9, 4);
			buffer.pushSprite(0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 99, 98);
			// offsets 7 and 8 are the frame, not the extras
			expect([buffer.bufferF32[7], buffer.bufferF32[8]]).toEqual([0.5, 0.5]);
		});
	});

	describe("VertexArrayBuffer#pushSpriteQuad", () => {
		const corners = [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 0, y: 1, z: 0 },
			{ x: 1, y: 1, z: 0 },
		];
		// [u, v, frameU, frameV] per vertex
		const read = (buffer) => {
			const f = buffer.bufferF32;
			const size = buffer.vertexSize;
			return [0, 1, 2, 3].map((v) => {
				const o = v * size;
				return [f[o + 3], f[o + 4], f[o + 7], f[o + 8]];
			});
		};

		it("gives each corner the UV of the corner opposite it", () => {
			const buffer = new VertexArrayBuffer(9, 4);
			buffer.pushSpriteQuad(...corners, 0.25, 0.5, 0.75, 1, 0, 0, true);
			expect(read(buffer)).toEqual([
				[0.25, 0.5, 0.75, 1],
				[0.75, 0.5, 0.25, 1],
				[0.25, 1, 0.75, 0.5],
				[0.75, 1, 0.25, 0.5],
			]);
		});

		it("still does when the UVs are flipped", () => {
			// a mirrored frame: u0 right of u1. The shader takes the min and
			// the max, so the opposite corner is all it needs
			const buffer = new VertexArrayBuffer(9, 4);
			buffer.pushSpriteQuad(...corners, 0.75, 1, 0.25, 0.5, 0, 0, true);
			expect(read(buffer)).toEqual([
				[0.75, 1, 0.25, 0.5],
				[0.25, 1, 0.75, 0.5],
				[0.75, 0.5, 0.25, 1],
				[0.25, 0.5, 0.75, 1],
			]);
		});

		it("marks every corner unbounded for a quad with no frame", () => {
			const buffer = new VertexArrayBuffer(9, 4);
			buffer.pushSpriteQuad(...corners, 0, 0, 3, 3, 0, 0, false);
			for (const [u, v, fu, fv] of read(buffer)) {
				// the quad's own UVs are untouched
				expect(u === 0 || u === 3).toBe(true);
				expect(v === 0 || v === 3).toBe(true);
				expect(fu).toBe(FRAME_UNBOUNDED);
				expect(fv).toBe(FRAME_UNBOUNDED);
			}
		});

		it("writes a lit layout's extras on all four corners", () => {
			const buffer = new VertexArrayBuffer(11, 4);
			buffer.pushSpriteQuad(...corners, 0, 0, 1, 1, 0, 2, true, 5, 32);
			for (let v = 0; v < 4; v++) {
				expect(buffer.bufferF32[v * 11 + 6]).toBe(2);
				expect(buffer.bufferF32[v * 11 + 9]).toBe(5);
				expect(buffer.bufferF32[v * 11 + 10]).toBe(32);
			}
		});
	});

	describe("which quads have a frame", () => {
		it("every texture but a repeating one", () => {
			expect(isFramed({})).toBe(true);
			expect(isFramed({ repeat: "no-repeat" })).toBe(true);
			for (const repeat of ["repeat", "repeat-x", "repeat-y"]) {
				expect(isFramed({ repeat })).toBe(false);
			}
		});

		it("are kept to it by the level read under linear-mipmap, by the full-size art while a tile layer draws", () => {
			const mode = (
				textureFilter,
				drawingTiles = false,
				resolved = "linear",
			) => {
				return frameClampMode({
					settings: { textureFilter },
					drawingTiles,
					getDefaultTextureFilter() {
						return resolved;
					},
				});
			};
			expect(mode("linear-mipmap")).toBe(FRAME_CLAMP.LEVELS);
			expect(mode("linear-mipmap", true)).toBe(FRAME_CLAMP.LEVELS);
			for (const filter of ["auto", "nearest", "linear", undefined]) {
				expect(mode(filter)).toBe(FRAME_CLAMP.OFF);
			}
			// a tile layer drawn tile by tile, sampled smoothly
			expect(mode("linear", true)).toBe(FRAME_CLAMP.TEXEL);
			expect(mode("auto", true, "linear")).toBe(FRAME_CLAMP.TEXEL);
			// sampled nearest, two texels never blend: nothing to keep to
			expect(mode("nearest", true, "nearest")).toBe(FRAME_CLAMP.OFF);
			expect(mode("auto", true, "nearest")).toBe(FRAME_CLAMP.OFF);
		});
	});
});

describe("the sprite shaders (GLSL)", () => {
	it.for([
		["unlit", buildMultiTextureFragment(4)],
		["lit", buildLitMultiTextureFragment(4)],
	])("%s: GLSL 3.00, every slot sampled inside the frame", ([, src]) => {
		expect(src.startsWith("#version 300 es")).toBe(true);
		for (let i = 0; i < 4; i++) {
			expect(src).toContain(`frameSample(uSampler${i}, vRegion, gx, gy)`);
		}
		// no slot samples around the clamp
		expect(src).not.toMatch(/texture\(uSampler\d/);
		expect(src).not.toContain("texture2D(");
	});

	it.for([
		["unlit", buildMultiTextureFragment(4)],
		["lit", buildLitMultiTextureFragment(4)],
	])("%s: takes the derivatives before the slot ladder", ([, src]) => {
		// inside the ladder control flow is not uniform, and a derivative
		// there is undefined
		const main = src.indexOf("void main");
		const derivative = src.indexOf("dFdx(vRegion)", main);
		const ladder = src.indexOf("if (vTextureId < 0.5)", main);
		expect(derivative).toBeGreaterThan(main);
		expect(derivative).toBeLessThan(ladder);
	});
	it.for([
		["unlit", buildMultiTextureFragment(4)],
		["lit", buildLitMultiTextureFragment(4)],
	])("%s: no derivative is taken inside the ladder", ([, src]) => {
		const ladder = src.slice(
			src.indexOf("if (vTextureId < 0.5)"),
			src.lastIndexOf("fragColor"),
		);
		expect(ladder).not.toMatch(/dFd[xy]/);
	});

	it("frameSample samples with the derivatives it is given", () => {
		// computing its own inside the ladder would be undefined, and the
		// clamped UV's would read a finer level along the frame's edge
		const fn = FRAME_FRAGMENT_GLSL.slice(
			FRAME_FRAGMENT_GLSL.indexOf("vec4 frameSample("),
		);
		expect(fn).not.toMatch(/dFd[xy]/);
		expect(fn).toContain("gx, gy);");
	});
});

describe("the sprite shaders (WGSL)", () => {
	// the text of a function, from its name to the closing brace at column 0
	const body = (src, name) => {
		const start = src.indexOf(`fn ${name}(`);
		return src.slice(start, src.indexOf("\n}", start));
	};

	it.for([
		["quad.wgsl", quadWGSL],
		["quad-lit.wgsl", quadLitWGSL],
	])("%s: the fragment stage never reads the frame globals", ([, src]) => {
		// the frame-globals group is bound to the VERTEX stage only: a
		// fragment read makes the pipeline invalid and blanks every sprite
		expect(body(src, "fragment_main")).not.toContain("uFrame.");
		expect(body(src, "frameUV")).not.toContain("uFrame.");
		// the vertex stage folds the mode into the frame instead
		expect(body(src, "vertex_main")).toContain("uFrame.frameClamp");
	});

	it.for([
		["quad.wgsl", quadWGSL],
		["quad-lit.wgsl", quadLitWGSL],
	])(
		"%s: the fragment learns whether the clamp follows the mipmap level",
		([, src]) => {
			// the frame globals are the vertex stage's: it hands the mode over
			expect(src).toMatch(/@interpolate\(flat\) vFrameLevels : f32/);
			expect(body(src, "vertex_main")).toContain(
				"out.vFrameLevels = select(0.0, 1.0, uFrame.frameClamp > 1.5);",
			);
			expect(body(src, "frameUV")).toMatch(/levels > 0\.5/);
		},
	);

	it.for([
		["quad.wgsl", quadWGSL],
		["quad-lit.wgsl", quadLitWGSL],
	])(
		"%s: the frame is the quad's corners, unbounded with no frame or the clamp off",
		([, src]) => {
			// no WGSL runs headless: these are the lines the WebGPU sprite fix
			// stands on, as written
			const vertex = body(src, "vertex_main").replace(/\s+/g, " ");
			expect(vertex).toContain(
				"out.vFrame = select( vec4f(min(aRegion, aFrame), max(aRegion, aFrame)), vec4f(-1.0e6, -1.0e6, 1.0e6, 1.0e6), aFrame.x < -5.0e5 || uFrame.frameClamp < 0.5, );",
			);
		},
	);

	it.for([
		["quad.wgsl", quadWGSL],
		["quad-lit.wgsl", quadLitWGSL],
	])(
		"%s: a sample is kept half a texel of the level read inside the frame",
		([, src]) => {
			const frameUV = body(src, "frameUV");
			expect(frameUV).toContain(
				"let inset = min(vec2f(0.5 * exp2(lod)) / size, (frame.zw - frame.xy) * 0.5);",
			);
			expect(frameUV).toMatch(
				/return clamp\(uv, frame\.xy \+ inset, frame\.zw - inset\);/,
			);
		},
	);

	it("quad.wgsl: every slot's sample goes through the frame", () => {
		const fragment = body(quadWGSL, "fragment_main");
		const samples = fragment.match(/textureSampleGrad\(/g) ?? [];
		const framed =
			fragment.match(/textureSampleGrad\(uTexture\d, uSampler\d, frameUV\(/g) ??
			[];
		expect(samples.length).toBe(8);
		expect(framed.length).toBe(8);
	});

	it("quad-lit.wgsl: the color and the normal map keep to the same frame", () => {
		const fragment = body(quadLitWGSL, "fragment_main");
		expect(fragment).toContain(
			"textureSampleGrad(uTexture, uSampler, uv, dx, dy)",
		);
		expect(fragment).toContain(
			"textureSampleGrad(uNormal, uNormalSampler, uv, dx, dy)",
		);
		expect(fragment).toMatch(/let uv = frameUV\(in\.vRegion/);
	});

	it("the frame clamp fits the frame-globals block as declared", () => {
		// projection (16 floats), lineWidth, frameClamp: past the block's
		// size, every pipeline built on it fails
		expect((16 + 2) * 4).toBeLessThanOrEqual(FRAME_UNIFORM_SIZE);
		for (const src of [quadWGSL, quadLitWGSL]) {
			const start = src.indexOf("struct FrameUniforms");
			const struct = src
				.slice(start, src.indexOf("};", start))
				.replace(/\/\/[^\n]*/g, "");
			expect(struct).toMatch(
				/projection : mat4x4<f32>,\s*lineWidth : f32,\s*frameClamp : f32,\s*$/,
			);
		}
	});
});

describe("sprites keep to their frame (WebGL, in pixels)", () => {
	const SIZE = 64;
	const FRAME = 32;
	let renderer;
	let quad;
	let atlas;
	let initialFilter;

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
			initialFilter = renderer.settings.textureFilter;
			quad = renderer.batchers.get("quad");
		}
		// red | blue over target | yellow; the target transparent around a
		// green square
		atlas = Renderer.createCanvas(FRAME * 2, FRAME * 2);
		const ctx = atlas.getContext("2d");
		ctx.fillStyle = "#ff0000";
		ctx.fillRect(0, 0, FRAME, FRAME);
		ctx.fillStyle = "#0000ff";
		ctx.fillRect(FRAME, 0, FRAME, FRAME);
		ctx.fillStyle = "#ffff00";
		ctx.fillRect(FRAME, FRAME, FRAME, FRAME);
		ctx.fillStyle = "#00ff00";
		ctx.fillRect(8, FRAME + 8, 16, 16);
	});

	afterEach(() => {
		renderer?.setTextureFilter(initialFilter);
		renderer?.resetTransform();
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// force the clamp on or off, past the filter that normally decides it
	const forceClamp = (on) => {
		for (const name of ["quad", "litQuad"]) {
			const batcher = renderer.batchers.get(name);
			batcher.flush();
			batcher.defaultShader.setUniform("uFrameClamp", on ? 1 : 0);
			renderer.currentProgram = batcher.defaultShader.program;
			// so the next setTextureFilter puts the right one back
			batcher._frameClamp = on ? 1 : 0;
		}
	};

	// the canvas, as the most red or blue any pixel has (bleed from the
	// neighbouring frames) and the most green (the frame's own art)
	const measure = () => {
		const gl = renderer.gl;
		const out = new Uint8Array(SIZE * SIZE * 4);
		gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
		let bleed = 0;
		let green = 0;
		for (let i = 0; i < out.length; i += 4) {
			bleed = Math.max(bleed, out[i], out[i + 2]);
			green = Math.max(green, out[i + 1]);
		}
		return { bleed, green };
	};

	// the target frame, drawn at `scale` from (x, y). `subPixel` is off, so
	// the renderer rounds (x, y) to a whole pixel first: the drawn-large
	// scenes draw at (0, 0), where they always drew (they used to pass
	// (-0.4, -0.6), which the old truncating snap also turned into (0, 0))
	const drawTarget = (scale, x, y) => {
		renderer.clearColor("#000000ff");
		renderer.save();
		renderer.translate(x, y);
		renderer.scale(scale, scale);
		renderer.drawImage(atlas, 0, FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME);
		renderer.restore();
	};

	// drawn small, off the pixel grid: the frame's edges fall at every phase
	// of the pixels and of the mipmap levels
	const SMALL = [
		[0.23, 1.3, 2.7],
		[0.31, 5.6, 3.2],
		[0.17, 9.4, 1.8],
		[0.42, 2.2, 7.9],
		[0.13, 20.6, 30.35],
	];

	describe("drawn small, under linear-mipmap", () => {
		it("takes nothing from the neighbouring frames", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			for (const [scale, x, y] of SMALL) {
				drawTarget(scale, x, y);
				renderer.flush();
				const { bleed, green } = measure();
				expect(bleed, `scale ${scale} at ${x},${y}`).toBeLessThanOrEqual(2);
				// and the frame's own art is still there
				expect(green, `scale ${scale} at ${x},${y}`).toBeGreaterThan(40);
			}
		});

		it("CONTROL: the same scenes bleed with the clamp forced off", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			forceClamp(false);
			let worst = 0;
			for (const [scale, x, y] of SMALL) {
				drawTarget(scale, x, y);
				renderer.flush();
				worst = Math.max(worst, measure().bleed);
			}
			expect(worst).toBeGreaterThan(8);
		});

		it("a mirrored frame (u0 right of u1) keeps to it too", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			const texture = renderer.cache.get(atlas);
			const draw = () => {
				renderer.clearColor("#000000ff");
				renderer.save();
				renderer.translate(1.3, 2.7);
				renderer.scale(0.23, 0.23);
				const batcher = renderer.setBatcher("quad");
				// the target frame's UVs, left and right swapped
				batcher.addQuad(
					texture,
					0,
					0,
					FRAME,
					FRAME,
					0.5,
					0.5,
					0,
					1,
					0xffffffff,
				);
				renderer.restore();
				renderer.flush();
				return measure();
			};
			expect(draw().bleed).toBeLessThanOrEqual(2);
			forceClamp(false);
			expect(draw().bleed).toBeGreaterThan(8);
		});

		it.for([
			["a frame", [0, 0.5, 0.5, 1]],
			["a mirrored frame", [0.5, 0.5, 0, 1]],
		])(
			"%s: inside, every pixel is the one it would be without the clamp",
			([, uvs], ctx) => {
				// the clamp only moves samples near the frame's edge; the art
				// itself must not shift. Drawn at 0.42 from (2.2, 7.9): the
				// quad spans 2.2..15.64 by 7.9..21.34, and the pixels at least
				// 1.5 px inside it are compared
				requireWebGL(ctx);
				renderer.setTextureFilter("linear-mipmap");
				const texture = renderer.cache.get(atlas);
				const draw = () => {
					renderer.clearColor("#000000ff");
					renderer.save();
					renderer.translate(2.2, 7.9);
					renderer.scale(0.42, 0.42);
					renderer
						.setBatcher("quad")
						.addQuad(texture, 0, 0, FRAME, FRAME, ...uvs, 0xffffffff);
					renderer.restore();
					renderer.flush();
					const gl = renderer.gl;
					const out = new Uint8Array(SIZE * SIZE * 4);
					gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
					return out;
				};
				const on = draw();
				forceClamp(false);
				const off = draw();
				let compared = 0;
				let green = 0;
				for (let y = 9; y <= 19; y++) {
					for (let x = 4; x <= 13; x++) {
						const i = ((SIZE - 1 - y) * SIZE + x) * 4;
						for (let c = 0; c < 3; c++) {
							expect(
								Math.abs(on[i + c] - off[i + c]),
								`${x},${y}`,
							).toBeLessThanOrEqual(1);
						}
						green = Math.max(green, on[i + 1]);
						compared++;
					}
				}
				expect(compared).toBe(110);
				// the comparison covers the art, not just empty frame
				expect(green).toBeGreaterThan(200);
			},
		);

		it("quads queued before a filter change draw under the clamp they were queued with", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			let worst = 0;
			for (const [scale, x, y] of SMALL) {
				drawTarget(scale, x, y);
				// queued, not drawn: the change must draw them first
				renderer.setTextureFilter("linear");
				renderer.flush();
				worst = Math.max(worst, measure().bleed);
				renderer.setTextureFilter("linear-mipmap");
			}
			expect(worst).toBeLessThanOrEqual(2);
		});
	});

	describe("a tile layer drawn tile by tile", () => {
		const clampMode = () => {
			return quad.defaultShader._uniformCache.uFrameClamp;
		};

		it("keeps its tiles to their own tile under smooth filtering", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear");
			renderer.beginTileLayer();
			expect(clampMode()).toBe(FRAME_CLAMP.TEXEL);
			drawTarget(3, 0, 0);
			renderer.endTileLayer();
			renderer.flush();
			expect(measure().bleed).toBeLessThanOrEqual(2);
			expect(clampMode()).toBe(FRAME_CLAMP.OFF);
		});

		it.each([
			["a tile layer draws, under linear filtering", "linear", true],
			["under linear-mipmap", "linear-mipmap", false],
		])(
			"keeps to the frame on all four sides while %s",
			(_when, filter, tiles, ctx) => {
				// the frame in the middle of a 3x3 atlas: green, red all around
				requireWebGL(ctx);
				const sheet = Renderer.createCanvas(FRAME * 3, FRAME * 3);
				const g = sheet.getContext("2d");
				g.fillStyle = "#ff0000";
				g.fillRect(0, 0, FRAME * 3, FRAME * 3);
				g.fillStyle = "#00ff00";
				g.fillRect(FRAME, FRAME, FRAME, FRAME);
				renderer.setTextureFilter(filter);
				if (tiles) {
					renderer.beginTileLayer();
				}
				renderer.clearColor("#000000ff");
				renderer.save();
				renderer.translate(-0.4, -0.6);
				renderer.scale(3, 3);
				renderer.drawImage(
					sheet,
					FRAME,
					FRAME,
					FRAME,
					FRAME,
					0,
					0,
					FRAME,
					FRAME,
				);
				renderer.restore();
				if (tiles) {
					renderer.endTileLayer();
				}
				renderer.flush();
				const { bleed, green } = measure();
				expect(green).toBe(255);
				expect(bleed).toBeLessThanOrEqual(2);
			},
		);

		// the frame in the middle of a 3x3 atlas, red all around, and a flat
		// normal map for the lit batcher
		const surrounded = () => {
			const sheet = Renderer.createCanvas(FRAME * 3, FRAME * 3);
			const g = sheet.getContext("2d");
			g.fillStyle = "#ff0000";
			g.fillRect(0, 0, FRAME * 3, FRAME * 3);
			g.fillStyle = "#00ff00";
			g.fillRect(FRAME, FRAME, FRAME, FRAME);
			return sheet;
		};
		const flat = Renderer.createCanvas(FRAME * 3, FRAME * 3);
		const n = flat.getContext("2d");
		n.fillStyle = "#8080ff";
		n.fillRect(0, 0, FRAME * 3, FRAME * 3);

		// the middle frame drawn at each SMALL scale and offset, lit or not:
		// the most red any pixel took, and the most green
		const drawSmall = (lit, clamp = true) => {
			const sheet = surrounded();
			renderer.setTextureFilter("linear-mipmap");
			if (!clamp) {
				forceClamp(false);
			}
			const litQuad = renderer.batchers.get("litQuad");
			// no light, a white ambient floor: the sprite's own colors
			const neutral = (ambient) => {
				litQuad.setLightUniforms({
					positions: new Float32Array(4),
					colors: new Float32Array(3),
					count: 0,
					ambient,
				});
			};
			const lights = renderer.activeLightCount;
			const normals = renderer.currentNormalMap;
			let bleed = 0;
			let green = 255;
			try {
				for (const [scale, x, y] of SMALL) {
					if (lit) {
						renderer.activeLightCount = 1;
						renderer.currentNormalMap = flat;
						neutral([1, 1, 1]);
					}
					renderer.clearColor("#000000ff");
					renderer.save();
					renderer.translate(x, y);
					renderer.scale(scale, scale);
					renderer.drawImage(
						sheet,
						FRAME,
						FRAME,
						FRAME,
						FRAME,
						0,
						0,
						FRAME,
						FRAME,
					);
					renderer.restore();
					if (lit) {
						expect(renderer.currentBatcher).toBe(litQuad);
					}
					renderer.flush();
					const measured = measure();
					bleed = Math.max(bleed, measured.bleed);
					green = Math.min(green, measured.green);
				}
			} finally {
				renderer.activeLightCount = lights;
				renderer.currentNormalMap = normals;
				neutral([0, 0, 0]);
			}
			return { bleed, green };
		};

		it.each([
			["unlit", false],
			["normal-mapped, through the lit batcher", true],
		])(
			"keeps a %s sprite drawn small to its frame on all four sides",
			(_kind, lit, ctx) => {
				requireWebGL(ctx);
				const { bleed, green } = drawSmall(lit);
				expect(green).toBeGreaterThan(40);
				expect(bleed).toBeLessThanOrEqual(2);
			},
		);

		it("CONTROL: the lit scenes bleed with the clamp forced off", (ctx) => {
			requireWebGL(ctx);
			expect(drawSmall(true, false).bleed).toBeGreaterThan(20);
		});

		it("CONTROL: a sprite drawn outside a tile layer still samples as it always did", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear");
			drawTarget(3, 0, 0);
			renderer.flush();
			expect(measure().bleed).toBeGreaterThan(8);
		});

		it("leaves nearest sampling and its draws alone", (ctx) => {
			// nearest never blends two texels: no clamp, so no draw is split
			requireWebGL(ctx);
			renderer.setTextureFilter("nearest");
			renderer.beginTileLayer();
			expect(clampMode()).toBe(FRAME_CLAMP.OFF);
			renderer.endTileLayer();
		});

		it("keeps the mipmap clamp under linear-mipmap", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			renderer.beginTileLayer();
			expect(clampMode()).toBe(FRAME_CLAMP.LEVELS);
			renderer.endTileLayer();
			expect(clampMode()).toBe(FRAME_CLAMP.LEVELS);
		});

		it("is what Renderer#drawTileLayer draws a tile-by-tile layer inside", (ctx) => {
			requireWebGL(ctx);
			const seen = [];
			const layer = {
				renderMode: "perTile",
				getRenderer() {
					return {
						drawTileLayer(r) {
							seen.push(r.drawingTiles);
						},
					};
				},
			};
			renderer.drawTileLayer(layer, {
				pos: { x: 0, y: 0 },
				width: 1,
				height: 1,
			});
			expect(seen).toEqual([true]);
			expect(renderer.drawingTiles).toBe(false);
			// and closes it even when a tile throws
			const failing = {
				renderMode: "perTile",
				getRenderer() {
					return {
						drawTileLayer() {
							throw new Error("tile");
						},
					};
				},
			};
			expect(() => {
				renderer.drawTileLayer(failing, {
					pos: { x: 0, y: 0 },
					width: 1,
					height: 1,
				});
			}).toThrow("tile");
			expect(renderer.drawingTiles).toBe(false);
		});
	});

	describe("drawn large", () => {
		it("under linear-mipmap, takes nothing from the next frame either", (ctx) => {
			// half a texel of level 0 along the edge, which plain bilinear
			// sampling blends with the next frame
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			drawTarget(3, 0, 0);
			renderer.flush();
			expect(measure().bleed).toBeLessThanOrEqual(2);
		});

		it("under plain linear, samples exactly as it always did", (ctx) => {
			// the clamp is off: half a texel of the frame above still blends
			// in along the top edge, as it did before
			requireWebGL(ctx);
			renderer.setTextureFilter("linear");
			drawTarget(3, 0, 0);
			renderer.flush();
			expect(measure().bleed).toBeGreaterThan(8);
		});
	});

	describe("the frame each quad carries", () => {
		// the opposite-corner UV of the four corners pushed by `draw`
		const framesOf = (draw) => {
			const frames = [];
			const push = quad.vertexData.pushSprite;
			quad.vertexData.pushSprite = function (...args) {
				frames.push([args[7], args[8]]);
				return push.apply(this, args);
			};
			try {
				draw();
			} finally {
				quad.vertexData.pushSprite = push;
				renderer.flush();
			}
			return frames;
		};

		it("a frame of an atlas: its own corners", (ctx) => {
			requireWebGL(ctx);
			const frames = framesOf(() => {
				renderer.drawImage(atlas, 0, FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME);
			});
			expect(frames).toEqual([
				[0.5, 1],
				[0, 1],
				[0.5, 0.5],
				[0, 0.5],
			]);
		});

		it("a repeating pattern: none, so it still wraps", (ctx) => {
			requireWebGL(ctx);
			const pattern = renderer.createPattern(atlas, "repeat");
			const frames = framesOf(() => {
				renderer.drawPattern(pattern, 0, 0, SIZE * 3, SIZE * 3);
			});
			expect(frames).toHaveLength(4);
			for (const frame of frames) {
				expect(frame).toEqual([FRAME_UNBOUNDED, FRAME_UNBOUNDED]);
			}
		});

		it("a repeating pattern draws the same with the clamp on or off", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			const pattern = renderer.createPattern(atlas, "repeat");
			const draw = () => {
				renderer.clearColor("#000000ff");
				renderer.save();
				renderer.translate(0.3, 0.7);
				renderer.scale(0.4, 0.4);
				renderer.drawPattern(pattern, 0, 0, SIZE * 3, SIZE * 3);
				renderer.restore();
				renderer.flush();
				const gl = renderer.gl;
				const out = new Uint8Array(SIZE * SIZE * 4);
				gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
				return out;
			};
			const on = draw();
			forceClamp(false);
			const off = draw();
			expect(Array.from(on)).toEqual(Array.from(off));
		});
	});

	describe("the layouts", () => {
		it("put the frame fifth: after what a custom shader declares, before the lit extras", (ctx) => {
			requireWebGL(ctx);
			const expected = {
				quad: ["aVertex", "aRegion", "aColor", "aTextureId", "aFrame"],
				litQuad: [
					"aVertex",
					"aRegion",
					"aColor",
					"aTextureId",
					"aFrame",
					"aNormalTextureId",
					"aShininess",
				],
			};
			for (const [name, attributes] of Object.entries(expected)) {
				const batcher = renderer.batchers.get(name);
				expect(
					batcher.attributes.map((a) => {
						return a.name;
					}),
				).toEqual(attributes);
				const frame = batcher.attributes[4];
				// two floats, after the 28 bytes of the first four
				expect(frame.offset).toBe(28);
				expect(frame.format).toBe("float32x2");
				expect(batcher.defaultShader.getAttribLocation("aFrame")).toBe(4);
			}
		});

		it("a custom shader declaring the first three attributes still draws", (ctx) => {
			// what a user GLShader written for the old layout declares
			requireWebGL(ctx);
			const shader = new GLShader(
				renderer.gl,
				[
					"attribute vec3 aVertex;",
					"attribute vec2 aRegion;",
					"attribute vec4 aColor;",
					"uniform mat4 uProjectionMatrix;",
					"varying vec2 vRegion;",
					"void main(void) {",
					"    gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);",
					"    vRegion = aRegion;",
					"}",
				].join("\n"),
				[
					"uniform sampler2D uSampler;",
					"varying vec2 vRegion;",
					"void main(void) {",
					"    float a = max(texture2D(uSampler, vRegion).a, 1.0);",
					"    gl_FragColor = vec4(0.0, 0.0, a, 1.0);",
					"}",
				].join("\n"),
			);
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				renderer.clearColor("#000000ff");
				renderer.customShader = shader;
				renderer.drawImage(atlas, 0, 0, FRAME, FRAME, 8, 8, 16, 16);
				renderer.customShader = undefined;
				renderer.flush();
				const mismatch = warn.mock.calls.some((args) => {
					return String(args[0]).includes("attribute location mismatch");
				});
				expect(mismatch).toBe(false);
			} finally {
				renderer.customShader = undefined;
				warn.mockRestore();
			}
			const gl = renderer.gl;
			const pixel = new Uint8Array(4);
			// (16, 16) from the top: inside the drawn square
			gl.readPixels(16, SIZE - 1 - 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			expect(Array.from(pixel.slice(0, 3))).toEqual([0, 0, 255]);
			shader.destroy();
		});

		it("the lit batcher leaves a repeating pattern unbounded", (ctx) => {
			requireWebGL(ctx);
			const lit = renderer.batchers.get("litQuad");
			const pattern = renderer.createPattern(atlas, "repeat");
			const normalMap = Renderer.createCanvas(FRAME * 2, FRAME * 2);
			const frames = [];
			const push = lit.vertexData.pushSprite;
			lit.vertexData.pushSprite = function (...args) {
				frames.push([args[7], args[8]]);
				return push.apply(this, args);
			};
			try {
				renderer.setBatcher("litQuad");
				lit.addQuad(
					pattern,
					0,
					0,
					8,
					8,
					0,
					0,
					3,
					3,
					0xffffffff,
					false,
					normalMap,
				);
			} finally {
				lit.vertexData.pushSprite = push;
				lit.vertexData.clear();
				renderer.setBatcher("quad");
			}
			expect(frames).toHaveLength(4);
			for (const frame of frames) {
				expect(frame).toEqual([FRAME_UNBOUNDED, FRAME_UNBOUNDED]);
			}
		});

		it("the lit batcher writes its frame after the normal map slot and shininess", (ctx) => {
			requireWebGL(ctx);
			const lit = renderer.batchers.get("litQuad");
			const normalMap = Renderer.createCanvas(FRAME * 2, FRAME * 2);
			const texture = renderer.cache.get(atlas);
			const calls = [];
			const push = lit.vertexData.pushSprite;
			lit.vertexData.pushSprite = function (...args) {
				calls.push(args);
				return push.apply(this, args);
			};
			try {
				renderer.currentShininess = 24;
				renderer.setBatcher("litQuad");
				lit.addQuad(
					texture,
					0,
					0,
					8,
					8,
					0,
					0.5,
					0.5,
					1,
					0xffffffff,
					false,
					normalMap,
				);
			} finally {
				lit.vertexData.pushSprite = push;
				renderer.currentShininess = 0;
				lit.vertexData.clear();
				renderer.setBatcher("quad");
			}
			expect(calls).toHaveLength(4);
			// [frameU, frameV, normal map slot, shininess] of the first corner
			const [, , , , , , , fu, fv, normal, shininess] = calls[0];
			expect([fu, fv]).toEqual([0.5, 1]);
			expect(normal).toBeGreaterThanOrEqual(0);
			expect(shininess).toBe(24);
		});
	});
});

describe("sprites keep to their frame (WebGPU, mock renderer)", () => {
	let renderer;
	let batcher;

	const atlas = (fields = {}) => {
		return {
			...fields,
			getTexture() {
				return { width: 64, height: 64 };
			},
		};
	};

	// [frameU, frameV] of each of the batcher's pending vertices
	const framesOf = (target) => {
		const size = target.vertexSize;
		const f = target.vertexData.bufferF32;
		const out = [];
		for (let v = 0; v < target.vertexData.vertexCount; v++) {
			out.push([f[v * size + 7], f[v * size + 8]]);
		}
		return out;
	};

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUQuadBatcher(renderer);
	});

	it("the quad layout: 36 bytes, the frame fifth", () => {
		const frame = batcher.attributes[4];
		expect(frame.name).toBe("aFrame");
		expect(frame.format).toBe("float32x2");
		expect(frame.offset).toBe(28);
		expect(batcher.stride).toBe(36);
	});

	it("the lit layout: 40 bytes, the frame fifth, then the shininess", () => {
		const lit = new WebGPULitQuadBatcher(renderer);
		expect(
			lit.attributes.map((a) => {
				return a.name;
			}),
		).toEqual([
			"aVertex",
			"aRegion",
			"aColor",
			"aTextureId",
			"aFrame",
			"aShininess",
		]);
		expect(lit.attributes[4].offset).toBe(28);
		expect(lit.stride).toBe(40);
	});

	it("a frame of an atlas: each corner carries the opposite one", () => {
		batcher.addQuad(atlas(), 0, 0, 8, 8, 0, 0.5, 0.5, 1, 0xffffffff);
		expect(framesOf(batcher)).toEqual([
			[0.5, 1],
			[0, 1],
			[0.5, 0.5],
			[0, 0.5],
		]);
	});

	it("a repeating texture, batched or through an effect: no frame", () => {
		batcher.addQuad(
			atlas({ repeat: "repeat" }),
			0,
			0,
			8,
			8,
			0,
			0,
			3,
			3,
			0xffffffff,
		);
		for (const frame of framesOf(batcher)) {
			expect(frame).toEqual([FRAME_UNBOUNDED, FRAME_UNBOUNDED]);
		}
		// the effect path flushes per quad: read what it pushed
		const effectBatcher = new WebGPUQuadBatcher(renderer);
		renderer.customShader = {};
		const pushed = [];
		const push = effectBatcher.vertexData.pushSprite;
		effectBatcher.vertexData.pushSprite = function (...args) {
			pushed.push([args[7], args[8]]);
			return push.apply(this, args);
		};
		effectBatcher.addQuad(
			atlas({ repeat: "repeat-x" }),
			0,
			0,
			8,
			8,
			0,
			0,
			3,
			1,
			0xffffffff,
		);
		expect(pushed).toHaveLength(4);
		for (const frame of pushed) {
			expect(frame).toEqual([FRAME_UNBOUNDED, FRAME_UNBOUNDED]);
		}
	});

	it("the lit batcher leaves a repeating texture unbounded too", () => {
		const lit = new WebGPULitQuadBatcher(renderer);
		lit.addQuad(
			atlas({ repeat: "repeat" }),
			0,
			0,
			8,
			8,
			0,
			0,
			3,
			3,
			0xffffffff,
			false,
			{
				width: 4,
				height: 4,
			},
		);
		const f = lit.vertexData.bufferF32;
		for (let v = 0; v < 4; v++) {
			expect([f[v * 10 + 7], f[v * 10 + 8]]).toEqual([
				FRAME_UNBOUNDED,
				FRAME_UNBOUNDED,
			]);
		}
	});

	it("the lit batcher writes the frame, then the shininess", () => {
		const lit = new WebGPULitQuadBatcher(renderer);
		renderer.currentShininess = 16;
		lit.addQuad(atlas(), 0, 0, 8, 8, 0, 0.5, 0.5, 1, 0xffffffff, false, {
			width: 4,
			height: 4,
		});
		const f = lit.vertexData.bufferF32;
		expect([f[7], f[8]]).toEqual([0.5, 1]);
		expect(f[9]).toBe(16);
	});

	it("a tile layer stages its quad in the batcher's layout, with no frame", () => {
		renderer.setBatcher = () => {
			return batcher;
		};
		const tmx = new WebGPUTMXRenderer(renderer);
		tmx.draw(
			{
				cols: 4,
				rows: 4,
				tilewidth: 16,
				tileheight: 16,
				dataVersion: 1,
				layerData: new Uint16Array(32),
				tint: null,
				getOpacity() {
					return 1;
				},
				tilesets: {
					tilesets: [
						{
							isCollection: false,
							image: { width: 64, height: 64 },
							tilewidth: 16,
							tileheight: 16,
							margin: 0,
							spacing: 0,
							firstgid: 1,
							lastgid: 16,
							isAnimated: false,
							animations: new Map(),
							texture: atlas(),
						},
					],
				},
			},
			{ pos: { x: 0, y: 0 }, width: 64, height: 64 },
		);
		const vertexWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.vertexArena.page;
		});
		expect(vertexWrite.size).toBe(4 * batcher.stride);
		const size = batcher.vertexSize;
		for (let v = 0; v < 4; v++) {
			expect(vertexWrite.floats[v * size + 7]).toBe(FRAME_UNBOUNDED);
			expect(vertexWrite.floats[v * size + 8]).toBe(FRAME_UNBOUNDED);
		}
		// and its UVs where they were: the corners of the layer
		expect([vertexWrite.floats[3], vertexWrite.floats[4]]).toEqual([0, 0]);
		const last = 3 * size;
		expect([
			vertexWrite.floats[last + 3],
			vertexWrite.floats[last + 4],
		]).toEqual([1, 1]);
	});

	describe("the clamp mode in the frame globals", () => {
		const ring = () => {
			const writes = [];
			const device = {
				limits: { minUniformBufferOffsetAlignment: 256 },
				createBuffer(descriptor) {
					return { size: descriptor.size, destroy() {} };
				},
				createBindGroup(descriptor) {
					return { layout: descriptor.layout };
				},
				queue: {
					writeBuffer(buffer, offset, data, dataOffset, size) {
						writes.push(
							Array.from(
								new Float32Array(data.slice(dataOffset, dataOffset + size)),
							),
						);
					},
				},
			};
			return {
				writes,
				ring: new WebGPUUniformRing(device, { frame: true }, { clear: true }),
			};
		};

		it("rides right after the line width", () => {
			const { writes, ring: r } = ring();
			r.pushFrameGlobals(new Matrix3d(), 3, 1);
			expect(writes[0][16]).toBe(3);
			expect(writes[0][17]).toBe(1);
		});

		it("is 0 when not given, whatever the last slot held", () => {
			const { writes, ring: r } = ring();
			r.pushFrameGlobals(new Matrix3d(), 1, 1);
			r.pushFrameGlobals(new Matrix3d(), 1);
			expect(writes[1][17]).toBe(0);
		});

		it("a tile layer's clamp: a new slot when the mode changes, open pass or not", () => {
			const calls = [];
			const fake = {
				settings: { textureFilter: "linear" },
				drawingTiles: false,
				renderPass: {},
				uniformRing: {},
				getDefaultTextureFilter() {
					return this.settings.textureFilter === "nearest"
						? "nearest"
						: "linear";
				},
				currentBatcher: {
					flush() {
						calls.push("flush");
					},
				},
				pushFrameGlobals() {
					calls.push(["push", frameClampMode(this)]);
				},
			};
			const set = WebGPURenderer.prototype.setDrawingTiles;
			set.call(fake, true);
			set.call(fake, false);
			// the queued quads drawn first, then a slot with the new mode
			expect(calls).toEqual([
				"flush",
				["push", FRAME_CLAMP.TEXEL],
				"flush",
				["push", FRAME_CLAMP.OFF],
			]);
			// nearest: the mode does not change, nothing is drawn or pushed
			calls.length = 0;
			fake.settings.textureFilter = "nearest";
			set.call(fake, true);
			set.call(fake, false);
			expect(calls).toEqual([]);
			// no pass open, as after a post effect, a mask or a flush in the
			// middle of a frame: the next draws still need the new slot
			fake.settings.textureFilter = "linear";
			fake.renderPass = null;
			set.call(fake, true);
			expect(calls).toEqual(["flush", ["push", FRAME_CLAMP.TEXEL]]);
			// before the renderer has a uniform ring: nothing to push into
			calls.length = 0;
			fake.uniformRing = null;
			set.call(fake, false);
			expect(calls).toEqual([]);
			expect(fake.drawingTiles).toBe(false);
		});

		it("follows a filter change, open pass or not", () => {
			// the renderer's own setTextureFilter, on a stand-in for the rest
			const pushes = [];
			const fake = {
				settings: { textureFilter: "linear" },
				currentBatcher: { flush() {} },
				textureStore: { invalidateBindGroups() {} },
				batchers: new Map(),
				renderPass: {},
				uniformRing: {},
				pushFrameGlobals() {
					pushes.push(frameClampMode(this));
				},
			};
			WebGPURenderer.prototype.setTextureFilter.call(fake, "linear-mipmap");
			expect(pushes).toEqual([FRAME_CLAMP.LEVELS]);
			// no pass open, mid-frame or not: the next draws read the new slot
			fake.renderPass = null;
			WebGPURenderer.prototype.setTextureFilter.call(fake, "linear");
			expect(pushes).toEqual([FRAME_CLAMP.LEVELS, FRAME_CLAMP.OFF]);
			// before the renderer has a uniform ring: nothing to push into
			fake.uniformRing = null;
			WebGPURenderer.prototype.setTextureFilter.call(fake, "linear-mipmap");
			expect(pushes).toEqual([FRAME_CLAMP.LEVELS, FRAME_CLAMP.OFF]);
		});
	});
});

describe("a game created under linear-mipmap", () => {
	let app;

	afterAll(() => {
		app?.destroy();
	});

	it("keeps its sprites to their frames from its first frame", async (ctx) => {
		// the clamp mode is set when the batchers are made, not only when
		// the filter changes later
		await boot();
		try {
			app = new Application(32, 32, {
				renderer: video.WEBGL,
				textureFilter: "linear-mipmap",
			});
			await app.init();
		} catch {
			ctx.skip("WebGL renderer not available in this environment");
		}
		if (app.renderer.type !== "WebGL2") {
			ctx.skip("WebGL renderer not available in this environment");
		}
		for (const name of ["quad", "litQuad"]) {
			const batcher = app.renderer.batchers.get(name);
			expect(batcher.defaultShader._uniformCache.uFrameClamp).toBe(
				FRAME_CLAMP.LEVELS,
			);
		}
	});
});
