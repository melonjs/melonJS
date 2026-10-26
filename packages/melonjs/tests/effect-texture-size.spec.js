/**
 * The effects whose widths, offsets and sizes are in texels (glow, outline,
 * blur, drop shadow, chromatic aberration, pixelate, bloom) take the size of
 * the texture they draw, as their `uTextureSize`: the sprite's texture, the
 * render target a camera's pass reads, the mesh's texture. They assumed a
 * 256x256 texture (the screen for an outline or a bloom), so on any other
 * one a width came out thinner or thicker than asked.
 *
 * A size the game gives (the `textureSize` option, `setTextureSize()`,
 * `setUniform("uTextureSize")`) is kept, and a ShaderEffect of the game's own
 * that declares a `uTextureSize` is never given one.
 */
import "./helpers/webgpu-globals.js";
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
	BloomEffect,
	BlurEffect,
	boot,
	ChromaticAberrationEffect,
	Color,
	DropShadowEffect,
	GlowEffect,
	Mesh,
	OutlineEffect,
	PixelateEffect,
	Renderable,
	ShaderEffect,
	state,
	video,
} from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import WebGPUMeshBatcher from "../src/video/webgpu/batchers/mesh_batcher.js";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

const EFFECTS = [
	[
		"GlowEffect",
		(r, o) => {
			return new GlowEffect(r, o);
		},
	],
	[
		"OutlineEffect",
		(r, o) => {
			return new OutlineEffect(r, o);
		},
	],
	[
		"BlurEffect",
		(r, o) => {
			return new BlurEffect(r, o);
		},
	],
	[
		"DropShadowEffect",
		(r, o) => {
			return new DropShadowEffect(r, o);
		},
	],
	[
		"ChromaticAberrationEffect",
		(r, o) => {
			return new ChromaticAberrationEffect(r, o);
		},
	],
	[
		"PixelateEffect",
		(r, o) => {
			return new PixelateEffect(r, o);
		},
	],
	[
		"BloomEffect",
		(r, o) => {
			return new BloomEffect(r, o);
		},
	],
];

// an image `w` x `h`, transparent, with an opaque red square of `side`
// pixels at (x, y)
const image = (w, h, x = 0, y = 0, side = 0) => {
	const canvas = Renderer.createCanvas(w, h);
	if (side > 0) {
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#ff0000";
		ctx.fillRect(x, y, side, side);
	}
	return canvas;
};

describe("effects measure in the texels of the texture they draw (WebGL)", () => {
	const SIZE = 160;
	let renderer;
	let drawCalls = 0;

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
			gl.drawElements = (...args) => {
				drawCalls++;
				return drawElements(...args);
			};
		}
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

	// the `uTextureSize` a GL program holds
	const programSize = (program) => {
		const gl = renderer.gl;
		return Array.from(
			gl.getUniform(program, gl.getUniformLocation(program, "uTextureSize")),
		);
	};

	// draw the whole of each image 1:1 through `effect`, over black
	const draw = (effect, items) => {
		renderer.clearColor("#000000ff");
		renderer.save();
		renderer.customShader = effect;
		for (const [img, x, y] of items) {
			renderer.drawImage(
				img,
				0,
				0,
				img.width,
				img.height,
				x,
				y,
				img.width,
				img.height,
			);
		}
		renderer.flush();
		renderer.customShader = undefined;
		renderer.restore();
	};

	const isWhite = (x, y) => {
		const gl = renderer.gl;
		const out = new Uint8Array(4);
		gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
		return out[0] > 200 && out[1] > 200 && out[2] > 200;
	};

	// how many white pixels in a row from (x, y), stepping by (dx, dy)
	const run = (x, y, dx, dy) => {
		let n = 0;
		while (n < 20 && isWhite(x + dx * n, y + dy * n)) {
			n++;
		}
		return n;
	};

	// a 96 x 48 texture with a 16 px square at (40, 16), and a 48 x 96 one
	// with it at (16, 40): neither 256 x 256
	const WIDE = () => {
		return image(96, 48, 40, 16, 16);
	};
	const TALL = () => {
		return image(48, 96, 16, 40, 16);
	};

	it.each(EFFECTS)(
		"%s takes the size of each texture it draws",
		(_name, make, ctx) => {
			requireWebGL(ctx);
			const effect = make(renderer);
			try {
				draw(effect, [[WIDE(), 0, 0]]);
				expect(programSize(effect._shader.program)).toEqual([96, 48]);
				draw(effect, [[TALL(), 0, 0]]);
				expect(programSize(effect._shader.program)).toEqual([48, 96]);
				// and keeps the record a mesh hosting it replays
				expect(Array.from(effect._uniformValues.get("uTextureSize"))).toEqual([
					48, 96,
				]);
			} finally {
				effect.destroy();
			}
		},
	);

	it("an outline is as many pixels wide as asked, on any texture", (ctx) => {
		requireWebGL(ctx);
		const outline = new OutlineEffect(renderer, { color: [1, 1, 1], width: 3 });
		try {
			draw(outline, [[WIDE(), 8, 8]]);
			// the square covers x 48 to 63 and y 24 to 39 on the screen
			expect(run(64, 32, 1, 0)).toBe(3);
			expect(run(47, 32, -1, 0)).toBe(3);
			expect(run(56, 40, 0, 1)).toBe(3);
			expect(run(56, 23, 0, -1)).toBe(3);
		} finally {
			outline.destroy();
		}
	});

	it("sprites from two textures, one after the other: each its own width", (ctx) => {
		requireWebGL(ctx);
		const outline = new OutlineEffect(renderer, { color: [1, 1, 1], width: 3 });
		try {
			draw(outline, [
				[WIDE(), 8, 8],
				[TALL(), 100, 40],
			]);
			// the wide one's square: x 48 to 63, y 24 to 39
			expect(run(64, 32, 1, 0)).toBe(3);
			expect(run(56, 40, 0, 1)).toBe(3);
			// the tall one's: x 116 to 131, y 80 to 95
			expect(run(132, 88, 1, 0)).toBe(3);
			expect(run(124, 96, 0, 1)).toBe(3);
		} finally {
			outline.destroy();
		}
	});

	it("sprites from one texture keep sharing a draw", (ctx) => {
		requireWebGL(ctx);
		const outline = new OutlineEffect(renderer, { color: [1, 1, 1], width: 3 });
		const wide = WIDE();
		try {
			// once, so the size is already the texture's
			draw(outline, [[wide, 0, 0]]);
			drawCalls = 0;
			draw(outline, [
				[wide, 0, 0],
				[wide, 0, 60],
				[wide, 60, 100],
			]);
			expect(drawCalls).toBe(1);
		} finally {
			outline.destroy();
		}
	});

	it("keeps a textureSize the game gives", (ctx) => {
		requireWebGL(ctx);
		const outline = new OutlineEffect(renderer, {
			color: [1, 1, 1],
			width: 3,
			textureSize: [256, 256],
		});
		try {
			draw(outline, [[WIDE(), 8, 8]]);
			expect(programSize(outline._shader.program)).toEqual([256, 256]);
			// 3 texels of a 256 wide texture are about one of this 96 wide one
			expect(run(64, 32, 1, 0)).toBe(1);
		} finally {
			outline.destroy();
		}
	});

	it("keeps a size set with setTextureSize() or setUniform()", (ctx) => {
		requireWebGL(ctx);
		const glow = new GlowEffect(renderer);
		const blur = new BlurEffect(renderer);
		try {
			draw(glow, [[WIDE(), 0, 0]]);
			expect(programSize(glow._shader.program)).toEqual([96, 48]);
			glow.setTextureSize(200, 100);
			draw(glow, [[TALL(), 0, 0]]);
			expect(programSize(glow._shader.program)).toEqual([200, 100]);

			blur.setUniform("uTextureSize", [50, 70]);
			draw(blur, [[TALL(), 0, 0]]);
			expect(programSize(blur._shader.program)).toEqual([50, 70]);
		} finally {
			glow.destroy();
			blur.destroy();
		}
	});

	it("never gives one to an effect of the game's own", (ctx) => {
		requireWebGL(ctx);
		const own = new ShaderEffect(
			renderer,
			`
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				return color * step(1.0, uTextureSize.x);
			}
			`,
		);
		try {
			own.setUniform("uTextureSize", [7, 9]);
			draw(own, [[WIDE(), 0, 0]]);
			expect(programSize(own._shader.program)).toEqual([7, 9]);
		} finally {
			own.destroy();
		}
	});

	it("a clone takes the size of what it draws, or keeps the one given", (ctx) => {
		requireWebGL(ctx);
		const glow = new GlowEffect(renderer);
		const fixed = new GlowEffect(renderer, { textureSize: [300, 30] });
		const copy = glow.clone();
		const fixedCopy = fixed.clone();
		try {
			draw(copy, [[WIDE(), 0, 0]]);
			expect(programSize(copy._shader.program)).toEqual([96, 48]);
			draw(fixedCopy, [[WIDE(), 0, 0]]);
			expect(programSize(fixedCopy._shader.program)).toEqual([300, 30]);
		} finally {
			for (const effect of [glow, fixed, copy, fixedCopy]) {
				effect.destroy();
			}
		}
	});

	it("on a mesh, takes the size of the mesh's texture", (ctx) => {
		requireWebGL(ctx);
		const outline = new OutlineEffect(renderer, { color: [1, 1, 1] });
		const mesh = new Mesh(0, 0, {
			vertices: [-8, -8, 0, 8, -8, 0, 8, 8, 0, -8, 8, 0],
			uvs: [0, 0, 1, 0, 1, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			width: 16,
			height: 16,
			texture: image(32, 16, 0, 0, 8),
		});
		try {
			renderer.customShader = outline;
			renderer.drawMesh(mesh);
			const spliced = renderer.currentBatcher.effectShaderFor(outline);
			expect(spliced).not.toBeNull();
			expect(programSize(spliced.program)).toEqual([32, 16]);
			renderer.customShader = undefined;
			// back on a sprite, the sprite's texture again
			draw(outline, [[WIDE(), 0, 0]]);
			expect(programSize(outline._shader.program)).toEqual([96, 48]);
		} finally {
			renderer.customShader = undefined;
			outline.destroy();
			mesh.destroy();
		}
	});
});

describe("a camera's effect measures in the screen's texels (WebGL)", () => {
	let app;

	/** a horizontal ramp over the whole view, one shade per pixel column */
	class Ramp extends Renderable {
		constructor() {
			super(0, 0, 100, 100);
			this.anchorPoint.set(0, 0);
		}
		draw(renderer) {
			for (let x = 0; x < 100; x++) {
				renderer.setColor(new Color(x * 2, x * 2, x * 2));
				renderer.fillRect(x, 0, 1, 100);
			}
		}
	}

	beforeAll(async () => {
		boot();
		app = new Application(100, 100, {
			parent: "screen",
			renderer: video.WEBGL,
			scale: "1.0",
			antiAlias: false,
			failIfMajorPerformanceCaveat: false,
		});
		await app.init();
	});
	afterEach(() => {
		app.world.reset();
	});
	afterAll(() => {
		return app?.destroy();
	});

	const frame = () => {
		app.world.update(0);
		app.repaint();
		app.draw();
	};

	const programSize = (effect) => {
		const gl = app.renderer.gl;
		const program = effect._shader.program;
		return Array.from(
			gl.getUniform(program, gl.getUniformLocation(program, "uTextureSize")),
		);
	};

	it("pixelates in blocks of screen pixels", () => {
		const camera = state.current().cameras.get("default");
		const pixelate = new PixelateEffect(app.renderer, { size: 10 });
		camera.addPostEffect(pixelate);
		try {
			app.world.addChild(new Ramp(), 0);
			frame();
			const canvas = app.renderer.getCanvas();
			expect(programSize(pixelate)).toEqual([canvas.width, canvas.height]);
			const gl = app.renderer.gl;
			const shade = (x) => {
				const out = new Uint8Array(4);
				gl.readPixels(x, 50, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
				return out[0];
			};
			// one block covers columns 10 to 19, the next starts at 20
			expect(shade(11)).toBe(shade(18));
			expect(shade(21)).not.toBe(shade(18));
		} finally {
			camera.removePostEffect(pixelate);
		}
	});
});

describe("effects measure in the texels of the texture they draw (WebGPU, mock renderer)", () => {
	const quiet = (make) => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			return make();
		} finally {
			warn.mockRestore();
		}
	};
	const sizeOf = (effect) => {
		return Array.from(effect.wgslRealization.values.get("uTextureSize"));
	};
	const texture = (width, height) => {
		return {
			getTexture() {
				return { width, height };
			},
		};
	};

	it.each(EFFECTS)(
		"%s takes the size of each texture it draws",
		(_name, make) => {
			const renderer = createMockWebGPURenderer();
			const batcher = new WebGPUQuadBatcher(renderer);
			const effect = quiet(() => {
				return make({ shaderLanguage: "wgsl" });
			});
			renderer.customShader = effect;
			batcher.addQuad(texture(96, 48), 0, 0, 16, 16, 0, 0, 1, 1, 0xffffffff);
			expect(sizeOf(effect)).toEqual([96, 48]);
			batcher.addQuad(texture(40, 120), 0, 0, 16, 16, 0, 0, 1, 1, 0xffffffff);
			expect(sizeOf(effect)).toEqual([40, 120]);
		},
	);

	it("the sprites queued under one size draw with it", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcher(renderer);
		const glow = quiet(() => {
			return new GlowEffect({ shaderLanguage: "wgsl" });
		});
		renderer.customShader = glow;
		const atlas = texture(96, 48);
		batcher.addQuad(atlas, 0, 0, 16, 16, 0, 0, 0.5, 1, 0xffffffff);
		batcher.addQuad(atlas, 20, 0, 16, 16, 0.5, 0, 1, 1, 0xffffffff);
		// one texture: still queued together
		expect(renderer.calls.drawIndexed).toEqual([]);
		batcher.addQuad(texture(40, 120), 40, 0, 16, 16, 0, 0, 1, 1, 0xffffffff);
		expect(renderer.calls.drawIndexed).toEqual([12]);
		// the two queued drew with their own size: `uTextureSize` follows the
		// colour (4 floats) and the two scalars, at float 6
		const write = renderer.calls.writes.find((w) => {
			return w.floats.length >= 8 && w.floats[6] === 96;
		});
		expect(write).toBeDefined();
		expect(write.floats[7]).toBe(48);
	});

	it("a pass over a render target takes its size", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcher(renderer);
		const bloom = quiet(() => {
			return new BloomEffect({ shaderLanguage: "wgsl" });
		});
		const source = {
			width: 300,
			height: 200,
			getMaterialBindGroup() {
				return { rt: true };
			},
		};
		batcher.blitTexture(source, 0, 0, 300, 200, bloom, false);
		expect(sizeOf(bloom)).toEqual([300, 200]);
		// a source with no size of its own: the size of the quad
		const bare = {
			getMaterialBindGroup() {
				return { rt: true };
			},
		};
		batcher.blitTexture(bare, 0, 0, 120, 90, bloom, false);
		expect(sizeOf(bloom)).toEqual([120, 90]);
	});

	it("keeps a textureSize the game gives", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUQuadBatcher(renderer);
		const outline = quiet(() => {
			return new OutlineEffect(
				{ shaderLanguage: "wgsl" },
				{ textureSize: [256, 256] },
			);
		});
		renderer.customShader = outline;
		batcher.addQuad(texture(96, 48), 0, 0, 16, 16, 0, 0, 1, 1, 0xffffffff);
		expect(sizeOf(outline)).toEqual([256, 256]);
	});

	it("on a mesh, takes the size of the mesh's texture", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const stub = {
			batchers: new Map([["mesh", batcher]]),
			currentBatcher: batcher,
			setBatcher(name) {
				return this.batchers.get(name);
			},
			currentTint: new Color(255, 255, 255, 1),
			getGlobalAlpha() {
				return 1;
			},
			customShader: undefined,
			meshDepthActive: false,
			meshEffectWarned: false,
			pendingDepthClear: false,
		};
		// the one of the seven a WGSL mesh can host: the others read the
		// sprite's vertex colour
		const bloom = quiet(() => {
			return new BloomEffect({ shaderLanguage: "wgsl" });
		});
		stub.customShader = bloom;
		WebGPURenderer.prototype.drawMesh.call(stub, {
			vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
			uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
			vertexCount: 4,
			texture: { id: "atlas", ...texture(32, 16) },
			textureRepeat: undefined,
			vertexColors: undefined,
			alphaCutoff: 0,
			emissive: undefined,
			lit: false,
			cullBackFaces: false,
			rightHanded: false,
		});
		// hosted, not refused
		expect(stub.meshEffectWarned).toBe(false);
		expect(sizeOf(bloom)).toEqual([32, 16]);
	});
});
