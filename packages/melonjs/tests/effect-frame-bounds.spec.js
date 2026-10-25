/**
 * Effects that sample away from the fragment they shade keep to the sprite's
 * own frame.
 *
 * A sprite drawn from an atlas or a tileset shows one frame of a bigger
 * texture, which goes on past the frame into the neighbouring ones. An effect
 * reading a few texels away read those neighbours along the frame's edge, and
 * drew them: a glow, an outline or a shadow from a frame that is not there,
 * a blur or a wave dragging the next frame in.
 *
 * Read in pixels on WebGL. The atlas holds three frames side by side: an
 * opaque blue one, the sprite's frame (transparent, with a red square in the
 * middle), and an opaque white one. The sprite's frame starts at texel 30, so
 * pixelate's 8-texel blocks straddle its left edge. What has to hold:
 *   - each of the eight effects leaves the sprite's frame edges as clear as
 *     the background, whatever lies next to the frame in the atlas
 *   - and still does its job on the sprite's own pixels
 *   - sprites sharing one effect each keep to their own frame
 *   - a pass over a whole texture (a camera effect) still samples to the
 *     texture's edge, as it always did
 */
import "./helpers/webgpu-globals.js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	BloomEffect,
	BlurEffect,
	boot,
	ChromaticAberrationEffect,
	DropShadowEffect,
	GlowEffect,
	OutlineEffect,
	PixelateEffect,
	Renderable,
	ShaderEffect,
	state,
	video,
	WaveEffect,
} from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

// the atlas: [0, 30) blue, [30, 62) the sprite's frame, [62, 94) white
const ATLAS_W = 94;
const ATLAS_H = 32;
const FRAME_X = 30;
const FRAME_W = 32;
const TEXTURE_SIZE = [ATLAS_W, ATLAS_H];
// the sprite's frame is drawn 1:1 with its top left here
const AT = 16;
// its first and last columns on the screen, half way down
const LEFT = [AT, AT + 16];
const RIGHT = [AT + FRAME_W - 1, AT + 16];
// the column just left of the red square (frame texels 12 to 19)
const BESIDE_SQUARE = [AT + 11, AT + 16];

const BLACK = [0, 0, 0];

describe("effects keep to the sprite's frame (WebGL)", () => {
	const SIZE = 64;
	let renderer;
	let atlas;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// WebGL genuinely unavailable: the tests skip below
		}
		if (renderer) {
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		}
		atlas = Renderer.createCanvas(ATLAS_W, ATLAS_H);
		const ctx = atlas.getContext("2d");
		ctx.fillStyle = "#0000ff";
		ctx.fillRect(0, 0, FRAME_X, ATLAS_H);
		ctx.fillStyle = "#ff0000";
		ctx.fillRect(FRAME_X + 12, 12, 8, 8);
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(FRAME_X + FRAME_W, 0, ATLAS_W - FRAME_X - FRAME_W, ATLAS_H);
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

	/** draw these frames of the atlas through `effect`, over black */
	const draw = (effect, quads = [[FRAME_X, AT, AT]]) => {
		renderer.clearColor("#000000ff");
		renderer.save();
		renderer.customShader = effect;
		for (const [sx, dx, dy] of quads) {
			renderer.drawImage(
				atlas,
				sx,
				0,
				FRAME_W,
				ATLAS_H,
				dx,
				dy,
				FRAME_W,
				ATLAS_H,
			);
		}
		renderer.flush();
		renderer.customShader = undefined;
		renderer.restore();
	};

	const bright = (rgb) => {
		return Math.max(...rgb);
	};

	// one effect per row: what it is, and where it used to read a neighbour
	const EFFECTS = [
		{
			name: "OutlineEffect",
			make: () => {
				return new OutlineEffect(renderer, {
					color: [1, 1, 1],
					textureSize: TEXTURE_SIZE,
				});
			},
			edge: LEFT,
			own: BESIDE_SQUARE,
		},
		{
			name: "GlowEffect",
			make: () => {
				return new GlowEffect(renderer, {
					color: [1, 1, 1],
					width: 2,
					intensity: 2,
					textureSize: TEXTURE_SIZE,
				});
			},
			edge: LEFT,
			own: BESIDE_SQUARE,
		},
		{
			name: "BlurEffect",
			make: () => {
				return new BlurEffect(renderer, {
					strength: 2,
					textureSize: TEXTURE_SIZE,
				});
			},
			edge: RIGHT,
			own: BESIDE_SQUARE,
		},
		{
			name: "ChromaticAberrationEffect",
			make: () => {
				return new ChromaticAberrationEffect(renderer, {
					offset: 3,
					textureSize: TEXTURE_SIZE,
				});
			},
			// blue comes from three texels to the left
			edge: LEFT,
			// and red from three texels to the right: the square's red, seen
			// three texels before it starts
			own: [AT + 10, AT + 16],
		},
		{
			name: "DropShadowEffect",
			make: () => {
				return new DropShadowEffect(renderer, {
					color: [1, 1, 1],
					opacity: 1,
					textureSize: TEXTURE_SIZE,
				});
			},
			// the shadow of whatever is two texels up and left
			edge: LEFT,
			// the square's shadow, two texels down and right of it
			own: [AT + 21, AT + 21],
		},
		{
			name: "WaveEffect",
			make: () => {
				// no frequency and a quarter period in: every row shifts by
				// the full amplitude, three texels to the right
				const effect = new WaveEffect(renderer, {
					amplitude: 3 / ATLAS_W,
					frequency: 0,
					speed: 1,
				});
				effect.setTime(Math.PI / 2);
				return effect;
			},
			edge: RIGHT,
			// the square, shifted three texels left
			own: [AT + 9, AT + 16],
		},
		{
			name: "PixelateEffect",
			make: () => {
				return new PixelateEffect(renderer, {
					size: 8,
					textureSize: TEXTURE_SIZE,
				});
			},
			// the frame's first two columns share an 8-texel block centred
			// in the blue frame
			edge: LEFT,
			// a block centred inside the square (atlas texel 44, row 12)
			own: [AT + 14, AT + 12],
		},
		{
			name: "BloomEffect",
			make: () => {
				return new BloomEffect(renderer, {
					threshold: 0.5,
					intensity: 2,
					radius: 2,
					textureSize: TEXTURE_SIZE,
				});
			},
			// the white frame is over the threshold
			edge: RIGHT,
			own: [AT + 16, AT + 16],
		},
	];

	for (const { name, make, edge, own } of EFFECTS) {
		it(`${name} leaves the frame's edge clear of the next frame`, (ctx) => {
			requireWebGL(ctx);
			const effect = make();
			draw(effect);
			effect.destroy();
			expect(pixel(...edge), `${name} at ${edge}`).toEqual(BLACK);
		});

		it(`${name} still works on the sprite's own pixels`, (ctx) => {
			requireWebGL(ctx);
			const effect = make();
			draw(effect);
			effect.destroy();
			expect(bright(pixel(...own)), `${name} at ${own}`).toBeGreaterThan(40);
		});
	}

	it("reads past the frame as transparent, as a sprite drawn on its own", (ctx) => {
		requireWebGL(ctx);
		// the white frame, blurred: at its first column three of the nine
		// taps fall past its edge, and read nothing, rather than repeating
		// the edge (which a sprite blurred alone, offscreen, never does)
		const effect = new BlurEffect(renderer, {
			strength: 1,
			textureSize: TEXTURE_SIZE,
		});
		draw(effect, [[FRAME_X + FRAME_W, AT, AT]]);
		effect.destroy();
		const [r] = pixel(...LEFT);
		expect(Math.abs(r - 170), `${r}`).toBeLessThanOrEqual(6);
	});

	it("keeps sprites sharing one effect each to their own frame", (ctx) => {
		requireWebGL(ctx);
		// the sprite's frame, then the blue one, through the same glow: the
		// second must not take the first one's frame from it
		const effect = EFFECTS[1].make();
		draw(effect, [
			[FRAME_X, AT, AT],
			[0, 0, 0],
		]);
		effect.destroy();
		expect(bright(pixel(...BESIDE_SQUARE))).toBeGreaterThan(40);
	});

	// ---- past the texture's own edge, nothing changes ----------------------

	/** every pixel of the canvas */
	const snapshot = () => {
		const gl = renderer.gl;
		const out = new Uint8Array(SIZE * SIZE * 4);
		gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
		return out;
	};

	/**
	 * run `fn` with the effects sampling as they did before frames were kept
	 * to: every quad drawn with no frame (as a blit is), and no half texel
	 */
	const unbounded = (fn) => {
		const proto = ShaderEffect.prototype;
		const setFrameTexel = proto._setFrameTexel;
		const vertices = renderer.batchers.get("quad").vertexData;
		const pushSpriteQuad = vertices.pushSpriteQuad;
		// fail loudly rather than silently compare a frame with itself, should
		// either hook be renamed
		expect(typeof setFrameTexel).toBe("function");
		expect(typeof pushSpriteQuad).toBe("function");
		proto._setFrameTexel = function () {
			this._clearFrameRect();
		};
		vertices.pushSpriteQuad = function (...args) {
			args[10] = false;
			return pushSpriteQuad.apply(this, args);
		};
		try {
			return fn();
		} finally {
			proto._setFrameTexel = setFrameTexel;
			vertices.pushSpriteQuad = pushSpriteQuad;
		}
	};

	/** where two snapshots differ, as "x,y" */
	const differences = (a, b) => {
		const out = [];
		for (let i = 0; i < a.length; i += 4) {
			if (
				a[i] !== b[i] ||
				a[i + 1] !== b[i + 1] ||
				a[i + 2] !== b[i + 2] ||
				a[i + 3] !== b[i + 3]
			) {
				const p = i / 4;
				out.push(`${p % SIZE},${SIZE - 1 - Math.floor(p / SIZE)}`);
			}
		}
		return out;
	};

	for (const { name, make } of EFFECTS) {
		it(`${name} draws a standalone image as it always did`, (ctx) => {
			requireWebGL(ctx);
			// opaque to its very edge, in four colors: past it, a sample
			// reads what the texture's wrap mode gives, as it always has
			const image = Renderer.createCanvas(16, 16);
			const ictx = image.getContext("2d");
			for (const [color, x, y] of [
				["#ff0000", 0, 0],
				["#00ff00", 8, 0],
				["#0000ff", 0, 8],
				["#ffffff", 8, 8],
			]) {
				ictx.fillStyle = color;
				ictx.fillRect(x, y, 8, 8);
			}
			const frame = () => {
				const effect = make();
				renderer.clearColor("#000000ff");
				renderer.save();
				renderer.customShader = effect;
				renderer.drawImage(image, 0, 0, 16, 16, AT, AT, 16, 16);
				renderer.flush();
				renderer.customShader = undefined;
				renderer.restore();
				effect.destroy();
				return snapshot();
			};
			const now = frame();
			const before = unbounded(frame);
			expect(differences(now, before)).toEqual([]);
		});
	}

	it("draws the outer side of a frame on the atlas's edge as it always did", (ctx) => {
		requireWebGL(ctx);
		// the white frame ends where the atlas does: past its right edge
		// there is no other frame, and the blur clamps there as before
		const frame = () => {
			const effect = new BlurEffect(renderer, {
				strength: 2,
				textureSize: TEXTURE_SIZE,
			});
			draw(effect, [[FRAME_X + FRAME_W, AT, AT]]);
			effect.destroy();
			return pixel(...RIGHT);
		};
		const now = frame();
		expect(now).toEqual(unbounded(frame));
		expect(now).toEqual([255, 255, 255]);
	});
});

describe("effects keep to the sprite's frame under linear filtering (WebGL)", () => {
	const SIZE = 64;
	let app;
	let atlas;

	beforeAll(async () => {
		boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: video.WEBGL,
			scale: "1.0",
			// linear texture filtering
			antiAlias: true,
			failIfMajorPerformanceCaveat: false,
		});
		await app.init();
		const renderer = app.renderer;
		renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
		renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		atlas = Renderer.createCanvas(ATLAS_W, ATLAS_H);
		const ctx = atlas.getContext("2d");
		ctx.fillStyle = "#0000ff";
		ctx.fillRect(0, 0, FRAME_X, ATLAS_H);
	});
	afterAll(() => {
		return app?.destroy();
	});

	it("never filters the next frame in at the frame's edge", () => {
		const renderer = app.renderer;
		// every row shifted a quarter of a texel left: the frame's first
		// column samples a quarter texel inside its edge, where filtering
		// would blend a quarter of the blue texel next to it in
		const effect = new WaveEffect(renderer, {
			amplitude: -0.25 / ATLAS_W,
			frequency: 0,
			speed: 1,
		});
		effect.setTime(Math.PI / 2);
		renderer.clearColor("#000000ff");
		renderer.save();
		renderer.customShader = effect;
		renderer.drawImage(
			atlas,
			FRAME_X,
			0,
			FRAME_W,
			ATLAS_H,
			AT,
			AT,
			FRAME_W,
			ATLAS_H,
		);
		renderer.flush();
		renderer.customShader = undefined;
		renderer.restore();
		effect.destroy();
		const gl = renderer.gl;
		const out = new Uint8Array(4);
		gl.readPixels(
			AT,
			SIZE - 1 - (AT + 16),
			1,
			1,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			out,
		);
		expect(Array.from(out.slice(0, 3))).toEqual(BLACK);
	});
});

describe("a camera effect still samples to the screen's edge (WebGL)", () => {
	let app;

	/** a white rectangle over the whole view */
	class White extends Renderable {
		constructor() {
			super(0, 0, 200, 200);
			this.anchorPoint.set(0, 0);
		}
		draw(renderer) {
			renderer.setColor("#ffffff");
			renderer.fillRect(0, 0, this.width, this.height);
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

	it("does not fade a blurred white screen at its edges", () => {
		const camera = state.current().cameras.get("default");
		const blur = new BlurEffect(app.renderer, {
			strength: 3,
			textureSize: [100, 100],
		});
		camera.addPostEffect(blur);
		try {
			app.world.addChild(new White(), 0);
			app.world.update(0);
			app.repaint();
			app.draw();
			const gl = app.renderer.gl;
			const out = new Uint8Array(4);
			for (const [x, y] of [
				[0, 0],
				[99, 99],
				[0, 99],
				[50, 0],
			]) {
				gl.readPixels(x, 99 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
				expect(out[0], `at ${x}, ${y}`).toBeGreaterThan(250);
			}
		} finally {
			camera.removePostEffect(blur);
		}
	});
});
