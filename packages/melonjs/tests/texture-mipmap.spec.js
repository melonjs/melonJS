/**
 * The `"linear-mipmap"` texture filter: what is drawn smaller than its
 * texture takes its colour from the mipmaps, and nothing else changes.
 *
 * Read in pixels on WebGL, with a checkerboard of single black and white
 * texels: drawn small, it averages to grey from the mipmaps, while a plain
 * linear sample picks out single texels and comes out patchy. Drawn at its
 * size or larger, the two filters must give the same pixels.
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
} from "vitest";
import { boot, Color } from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import { createAtlas, TextureAtlas } from "../src/video/texture/atlas.js";
import WebGPULitQuadBatcher from "../src/video/webgpu/batchers/lit_quad_batcher.js";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import WebGPUTMXRenderer from "../src/video/webgpu/renderers/tmxlayer/orthogonal.js";
import tmxlayerWGSL from "../src/video/webgpu/shaders/tmxlayer.wgsl";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

const SIZE = 64;

// a checkerboard of single texels, `size` square, at (x, y) of `ctx`
const checker = (ctx, x, y, size) => {
	for (let j = 0; j < size; j++) {
		for (let i = 0; i < size; i++) {
			ctx.fillStyle = (i + j) % 2 === 0 ? "#000000" : "#ffffff";
			ctx.fillRect(x + i, y + j, 1, 1);
		}
	}
};

describe("linear-mipmap texture filter (WebGL)", () => {
	let renderer;
	let initialFilter;
	let board;

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
		}
		board = Renderer.createCanvas(64, 64);
		checker(board.getContext("2d"), 0, 0, 64);
	});

	afterEach(() => {
		renderer?.setTextureFilter(initialFilter);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// the whole frame, top row first, as [r, g, b] per pixel
	const frame = () => {
		const gl = renderer.gl;
		const out = new Uint8Array(SIZE * SIZE * 4);
		gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
		return (x, y) => {
			const i = ((SIZE - 1 - y) * SIZE + x) * 4;
			return [out[i], out[i + 1], out[i + 2]];
		};
	};

	// the board drawn at (x, y), w x h, under `filter`
	const drawBoard = (filter, x, y, w, h) => {
		renderer.setTextureFilter(filter);
		renderer.clearColor("#000000ff");
		renderer.drawImage(board, 0, 0, 64, 64, x, y, w, h);
		renderer.flush();
		return frame();
	};

	// the pixels of a square, `from` to `to` on both axes
	const square = (at, from, to) => {
		const out = [];
		for (let y = from; y <= to; y++) {
			for (let x = from; x <= to; x++) {
				out.push(at(x, y));
			}
		}
		return out;
	};

	describe("a texture drawn smaller than its size", () => {
		// a third of its size, from a whole pixel (where the renderer puts
		// it): every pixel then samples a texel's centre, so a plain linear
		// sample is a single texel
		const SMALL = [2, 2, 64 / 3, 64 / 3];

		it("is smoothed by its mipmaps", (ctx) => {
			requireWebGL(ctx);
			const at = drawBoard("linear-mipmap", ...SMALL);
			for (const [r, g, b] of square(at, 4, 20)) {
				expect(Math.abs(r - 128)).toBeLessThan(32);
				expect(g).toBe(r);
				expect(b).toBe(r);
			}
		});

		it("is patchy under plain linear filtering", (ctx) => {
			// what the mipmaps fix: single texels picked out of the board
			requireWebGL(ctx);
			const at = drawBoard("linear", ...SMALL);
			const off = square(at, 4, 20).map(([r]) => {
				return Math.abs(r - 128);
			});
			expect(Math.max(...off)).toBeGreaterThan(64);
		});
	});

	describe("a texture drawn at its size or larger", () => {
		for (const [name, place] of [
			["at its size", [0, 0, 64, 64]],
			["at its size, between pixels", [3.4, 5.7, 64, 64]],
			["at twice its size", [-20.5, -9.25, 128, 128]],
		]) {
			it(`is drawn ${name} as plain linear filtering draws it`, (ctx) => {
				requireWebGL(ctx);
				const linear = drawBoard("linear", ...place);
				const mipmap = drawBoard("linear-mipmap", ...place);
				for (let y = 0; y < SIZE; y++) {
					for (let x = 0; x < SIZE; x++) {
						expect(mipmap(x, y)).toEqual(linear(x, y));
					}
				}
			});
		}
	});

	describe("which textures sample their mipmaps", () => {
		// a texture drawing `source`
		const as = (source) => {
			return {
				getTexture() {
					return source;
				},
			};
		};

		it("none, unless the filter is linear-mipmap", (ctx) => {
			requireWebGL(ctx);
			for (const filter of ["auto", "nearest", "linear"]) {
				renderer.setTextureFilter(filter);
				expect(renderer.wantsMipmaps(as(board))).toBe(false);
			}
			renderer.setTextureFilter("linear-mipmap");
			expect(renderer.wantsMipmaps(as(board))).toBe(true);
		});

		it("not a video, which would rebuild them every frame", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			const video = document.createElement("video");
			expect(renderer.wantsMipmaps(as(video))).toBe(false);
		});

		it("not a texture the engine renders into, whose levels are never filled", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			const resource = { width: 4, height: 4, upload() {} };
			expect(renderer.wantsMipmaps(as(resource))).toBe(false);
		});

		it("resolves linear-mipmap to linear for everything else", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear-mipmap");
			expect(renderer.getDefaultTextureFilter()).toBe("linear");
		});
	});

	describe("an orthogonal tile layer drawn by the GPU", () => {
		// the tileset: tile 1 a checkerboard, tile 2 solid blue beside it
		const TILE = 32;
		let tileset;

		beforeAll(() => {
			const image = Renderer.createCanvas(TILE * 2, TILE);
			const ctx = image.getContext("2d");
			checker(ctx, 0, 0, TILE);
			ctx.fillStyle = "#0000ff";
			ctx.fillRect(TILE, 0, TILE, TILE);
			tileset = {
				tilewidth: TILE,
				tileheight: TILE,
				margin: 0,
				spacing: 0,
				image,
				firstgid: 1,
				lastgid: 2,
				isCollection: false,
				isAnimated: false,
				animations: new Map(),
				texture: new TextureAtlas(
					createAtlas(image.width, image.height, "tileset", "no-repeat"),
					image,
				),
			};
		});

		// a map of tile 1 only, drawn at `scale` from (x, y). Seven cells a
		// side, not a power of two: the shader's derivatives then carry a
		// rounding error, as in a real map
		const drawLayer = (filter, scale, x, y, set = tileset, gid = 1) => {
			const cols = 7;
			const rows = 7;
			const layerData = new Uint16Array(cols * rows * 2);
			for (let i = 0; i < cols * rows; i++) {
				layerData[i * 2] = gid;
			}
			const layer = {
				cols,
				rows,
				tilewidth: TILE,
				tileheight: TILE,
				layerData,
				dataVersion: 0,
				tilesets: { tilesets: [set] },
				getOpacity() {
					return 1;
				},
			};
			renderer.setTextureFilter(filter);
			renderer.clearColor("#000000ff");
			renderer.save();
			renderer.translate(x, y);
			renderer.scale(scale, scale);
			renderer
				._getTMXGPURendererFor("orthogonal")
				.draw(layer, { pos: { x: 0, y: 0 }, width: 224, height: 224 });
			renderer.flush();
			renderer.restore();
			return frame();
		};

		it("is smoothed by its mipmaps, without the next tile bleeding in", (ctx) => {
			// 0.3 of the size, off the pixel grid: the tile edges, every 9.6
			// pixels, fall at every phase of the pixels and of the levels
			requireWebGL(ctx);
			const at = drawLayer("linear-mipmap", 0.3, 1.3, 1.7);
			for (const [r, g, b] of square(at, 3, 60)) {
				expect(Math.abs(r - 128)).toBeLessThan(32);
				expect(g).toBe(r);
				// blue from the neighbouring tile of the atlas
				expect(b - r).toBeLessThanOrEqual(2);
			}
		});

		it("is patchy under plain linear filtering", (ctx) => {
			requireWebGL(ctx);
			const at = drawLayer("linear", 0.3, 1.3, 1.7);
			const off = square(at, 3, 60).map(([r]) => {
				return Math.abs(r - 128);
			});
			expect(Math.max(...off)).toBeGreaterThan(64);
		});

		describe("faded or tinted", () => {
			// a white tile over blue: the pixel shows the layer's strength,
			// and how much of what is behind it shows through
			let white;
			beforeAll(() => {
				const image = Renderer.createCanvas(TILE, TILE);
				const ctx = image.getContext("2d");
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(0, 0, TILE, TILE);
				white = {
					...tileset,
					image,
					lastgid: 1,
					texture: new TextureAtlas(
						createAtlas(TILE, TILE, "white", "no-repeat"),
						image,
					),
				};
			});

			// `alpha` is the renderer's global alpha, which a layer's preDraw
			// sets to its opacity times the fade of everything it is drawn in
			const drawWhite = (alpha, tint, opacity = 1) => {
				const layerData = new Uint16Array(4 * 2);
				for (let i = 0; i < 4; i++) {
					layerData[i * 2] = 1;
				}
				renderer.setTextureFilter("nearest");
				renderer.clearColor("#0000ffff");
				renderer.save();
				renderer.setGlobalAlpha(alpha);
				try {
					renderer._getTMXGPURendererFor("orthogonal").draw(
						{
							cols: 2,
							rows: 2,
							tilewidth: TILE,
							tileheight: TILE,
							layerData,
							dataVersion: 0,
							tint,
							tilesets: { tilesets: [white] },
							getOpacity() {
								return opacity;
							},
						},
						{ pos: { x: 0, y: 0 }, width: 64, height: 64 },
					);
					renderer.flush();
				} finally {
					renderer.restore();
				}
				return frame()(20, 20);
			};

			const near = (actual, expected) => {
				for (let i = 0; i < 3; i++) {
					expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(2);
				}
			};

			it("is drawn as strong as its fade, what is behind it showing through", (ctx) => {
				requireWebGL(ctx);
				// half white over blue
				near(drawWhite(0.5, null), [128, 128, 255]);
			});

			it("takes its fade from the renderer, which holds its container's too", (ctx) => {
				// the layer's own opacity was already folded in by its preDraw:
				// it is not applied a second time, nor in place of the fade
				requireWebGL(ctx);
				near(drawWhite(0.5, null, 0.25), [128, 128, 255]);
				near(drawWhite(1, null, 0.25), [255, 255, 255]);
			});

			it("CONTROL: is drawn white at full strength", (ctx) => {
				requireWebGL(ctx);
				expect(drawWhite(1, null)).toEqual([255, 255, 255]);
			});

			it("takes its tint's color, not its alpha, as a sprite does", (ctx) => {
				requireWebGL(ctx);
				expect(drawWhite(1, new Color(255, 0, 0, 0.5))).toEqual([255, 0, 0]);
				near(drawWhite(0.5, new Color(255, 0, 0, 0.5)), [128, 0, 128]);
			});
		});

		it("keeps each tile to itself when drawn larger under plain linear filtering", (ctx) => {
			// 1.5 times its size: the first tile's right edge, at x 48, is
			// where the atlas goes on into the blue tile. Filtering within
			// half a texel of that edge took it in: a blue seam between two
			// tiles that both draw the checkerboard
			requireWebGL(ctx);
			const at = drawLayer("linear", 1.5, 0.4, 0.6);
			let bluest = 0;
			for (let y = 0; y < SIZE; y++) {
				for (let x = 0; x < SIZE; x++) {
					const [r, g, b] = at(x, y);
					expect(g).toBe(r);
					bluest = Math.max(bluest, b - r);
				}
			}
			expect(bluest).toBeLessThanOrEqual(2);
		});

		it("keeps a tile to itself on every side, the atlas around it on all four", (ctx) => {
			// a 3x3 tileset: the checkerboard in the middle (tile 5), blue
			// all around it, so each of its edges has a neighbour
			requireWebGL(ctx);
			const image = Renderer.createCanvas(TILE * 3, TILE * 3);
			const g = image.getContext("2d");
			g.fillStyle = "#0000ff";
			g.fillRect(0, 0, TILE * 3, TILE * 3);
			checker(g, TILE, TILE, TILE);
			const surrounded = {
				...tileset,
				image,
				lastgid: 9,
				texture: new TextureAtlas(
					createAtlas(image.width, image.height, "surrounded", "no-repeat"),
					image,
				),
			};
			const at = drawLayer("linear", 1.5, 0.4, 0.6, surrounded, 5);
			let bluest = 0;
			for (let y = 0; y < SIZE; y++) {
				for (let x = 0; x < SIZE; x++) {
					const [r, g2, b] = at(x, y);
					expect(g2).toBe(r);
					bluest = Math.max(bluest, b - r);
				}
			}
			expect(bluest).toBeLessThanOrEqual(2);
		});

		it("is drawn at its size as plain linear filtering draws it", (ctx) => {
			requireWebGL(ctx);
			const linear = drawLayer("linear", 1, 0.4, 0.6);
			const mipmap = drawLayer("linear-mipmap", 1, 0.4, 0.6);
			for (let y = 0; y < SIZE; y++) {
				for (let x = 0; x < SIZE; x++) {
					expect(mipmap(x, y)).toEqual(linear(x, y));
				}
			}
		});
	});
});

/**
 * The same choices on WebGPU, against the mock renderer (headless Chromium
 * has no WebGPU device): what each draw asks the texture store for. The
 * store builds a chain only for a draw that asks, and samples it only with
 * a mip sampler, so asking for both is the whole of the change there.
 */
describe("linear-mipmap texture filter (WebGPU, mock renderer)", () => {
	let renderer;
	let batcher;

	// a texture drawing `source`, with any other fields given
	const atlas = (fields = {}, source = { width: 64, height: 64 }) => {
		return {
			...fields,
			getTexture() {
				return source;
			},
		};
	};

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUQuadBatcher(renderer);
	});

	// what a batched sprite drawn from `texture` asked for, and was given
	const sprite = (filter, texture) => {
		renderer.settings.textureFilter = filter;
		const slot = batcher.segmentSlotFor(texture, false);
		return {
			chain: renderer.textureStore.residentOptions.at(-1).options.mipmaps,
			sampler: batcher.segmentEntries[slot].sampler,
		};
	};

	it("a sprite asks for the chain and samples it", () => {
		const { chain, sampler } = sprite("linear-mipmap", atlas());
		expect(chain).toBe(true);
		expect(sampler.mipmaps).toBe(true);
	});

	it("a sprite keeps to level 0 under plain linear filtering", () => {
		const { chain, sampler } = sprite("linear", atlas());
		expect(chain).toBe(false);
		expect(sampler.mipmaps).toBe(false);
	});

	it("a nearest sprite keeps to level 0", () => {
		const { chain, sampler } = sprite(
			"linear-mipmap",
			atlas({ filter: "nearest" }),
		);
		expect(chain).toBe(false);
		expect(sampler.mipmaps).toBe(false);
	});

	it("a video keeps to level 0", () => {
		const { chain, sampler } = sprite(
			"linear-mipmap",
			atlas({}, { width: 64, height: 64, videoWidth: 64, videoHeight: 64 }),
		);
		expect(chain).toBe(false);
		expect(sampler.mipmaps).toBe(false);
	});

	it("a sprite drawn through an effect asks for the chain", () => {
		renderer.settings.textureFilter = "linear-mipmap";
		renderer.customShader = {};
		batcher.addQuad(atlas(), 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		expect(renderer.calls.textureBindings.at(-1).options.mipmaps).toBe(true);
	});

	it("a lit sprite samples the chain for its color, not its normal map", () => {
		renderer.settings.textureFilter = "linear-mipmap";
		const lit = new WebGPULitQuadBatcher(renderer);
		lit.addQuad(atlas(), 0, 0, 32, 32, 0, 0, 1, 1, 0xffffffff, false, {
			width: 4,
			height: 4,
		});
		const [, colorSampler, , normalSampler] = lit.currentMaterial.entries;
		expect(colorSampler.resource.mipmaps).toBe(true);
		expect(normalSampler.resource.mipmaps).toBe(false);
	});

	describe("a tile layer", () => {
		const layer = (texture) => {
			return {
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
							texture,
						},
					],
				},
			};
		};

		// the tileset binding's options and the shader's mipmap flag
		const tiles = (filter) => {
			renderer.settings.textureFilter = filter;
			renderer.setBatcher = () => {
				return batcher;
			};
			const tmx = new WebGPUTMXRenderer(renderer);
			tmx.draw(layer(atlas()), {
				pos: { x: 0, y: 0 },
				width: 64,
				height: 64,
			});
			// the per-tileset uniforms: the last 128-byte write
			const uniforms = renderer.calls.writes.findLast((write) => {
				return write.size === 128;
			});
			return {
				chain: renderer.calls.textureBindings.at(-1).options?.mipmaps,
				flag: uniforms.floats[28],
			};
		};

		it("asks for the chain and sets the shader's mipmap flag", () => {
			expect(tiles("linear-mipmap")).toEqual({ chain: true, flag: 1 });
		});

		it("does neither under plain linear filtering", () => {
			expect(tiles("linear")).toEqual({ chain: false, flag: 0 });
		});

		it("fades its premultiplied texels, color and alpha alike, and tints them", () => {
			// the WGSL twin of the WebGL pixel tests above
			const code = tmxlayerWGSL.replace(/\/\/.*$/gm, "");
			expect(code).toContain(
				"return texel * tmx.uOpacity * vec4f(tmx.uTint.rgb, 1.0);",
			);
			expect(code.match(/layerColor\(result\.color\)/g)).toHaveLength(2);
			expect(code).not.toMatch(/result\.color\.a \* tmx\.uOpacity/);
		});

		it("keeps each sample half a texel inside its tile, mipmaps or not", () => {
			// the level read, 0 without mipmaps: the WGSL twin of what the
			// WebGL pixel test above measures
			const code = tmxlayerWGSL.replace(/\/\/.*$/gm, "");
			expect(code).toContain(
				"let inset = min(vec2f(0.5 * exp2(lod * tmx.uMipmaps)), tmx.uTileSize * 0.5);",
			);
			expect(code).toContain(
				"texelPx = clamp(texelPx, tileOriginPx + inset, tileOriginPx + tmx.uTileSize - inset);",
			);
		});
	});
});
