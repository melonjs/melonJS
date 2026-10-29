/**
 * Effects place their pattern on the renderable they draw (#1407).
 *
 * An effect is handed `uv`, the coordinate it samples its texture at, which
 * runs 0..1 across the renderable only for a sprite with its own texture
 * drawn with that one effect. The built-in effects that place a pattern (a
 * sway's planted row, a wave's anchor, a shine's sweep, a vignette's or a
 * gradient's centre, a scanline's curve) placed it by `uv` all the same, so:
 *   - on a sprite cut from an atlas, the pattern sat on the atlas: a sway
 *     rocked the roots, a vignette or a shine missed the sprite altogether
 *   - with two or more effects, they run over a capture the size of the
 *     canvas, so the pattern sat on the canvas and slid as the camera moved
 *     (and `noise_uv` there was the canvas's too)
 *
 * They now read where they are on the renderable (effects/local_space.js).
 * Read in pixels on WebGL: what each case draws is compared with what the
 * same art draws as a sprite with its own texture and one effect, which was
 * always right and is unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	DissolveEffect,
	HologramEffect,
	Matrix3d,
	OutlineEffect,
	RadialGradientEffect,
	ScanlineEffect,
	ShaderEffect,
	ShineEffect,
	Sprite,
	SwayEffect,
	TextureAtlas,
	VignetteEffect,
	WaveEffect,
} from "../src/index.js";
import { LOCAL_MODE, ME_LAYOUT } from "../src/video/effects/local_space.js";
import { spliceEffect } from "../src/video/effects/mesh_splice.js";
import { parseWGSLBody } from "../src/video/effects/wgsl/parse.js";
import { buildWGSLModule } from "../src/video/effects/wgsl/scaffold.js";
import Renderer from "../src/video/renderer.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 128;
const ART = 32;
// the sprite is drawn at twice its size, centred: 32..96 on the screen
const SCALE = 2;
const CENTRE = 64;
const FROM = CENTRE - (ART * SCALE) / 2;
const SPAN = ART * SCALE;
// where the art sits in the atlas, among other frames
const ATLAS_W = 112;
const ATLAS_H = 96;
const AT_X = 48;
const AT_Y = 40;

/**
 * the art: stripes across, a darker band down, a marker in a corner, with a
 * clear margin left and right as swaying art has: a sample pushed past a
 * frame's edge reads clear from an atlas or a capture, but repeats the edge
 * from a texture of its own, which is not what is compared here
 */
const MARGIN = 6;
const paintArt = (ctx, ox, oy) => {
	const left = ox + MARGIN;
	const width = ART - MARGIN * 2;
	ctx.fillStyle = "#e0e0e0";
	ctx.fillRect(left, oy, width, ART);
	ctx.fillStyle = "#4a90d9";
	for (let x = 0; x < width; x += 6) {
		ctx.fillRect(left + x, oy, 3, ART);
	}
	ctx.fillStyle = "#30a050";
	ctx.fillRect(left, oy + 20, width, 6);
	ctx.fillStyle = "#ff3030";
	ctx.fillRect(left + 2, oy + 2, 5, 5);
};

// ShineEffect's body as it was before the local space, as a custom effect
const OLD_SHINE = `
	uniform vec4  uShineColor;
	uniform float uShineWidth;
	uniform float uShineSpeed;
	uniform float uShineIntensity;
	uniform float uShineAngle;
	uniform float uShineBands;
	uniform float uPulseDepth;
	uniform float uPulseSpeed;
	uniform float uTime;
	uniform float uUVYDir;
	vec4 apply(vec4 color, vec2 uv) {
		if (color.a == 0.0) return color;
		float pulse = (1.0 - uPulseDepth) + uPulseDepth * sin(uTime * uPulseSpeed);
		float y = uUVYDir < 0.0 ? 1.0 - uv.y : uv.y;
		float pos = uv.x * cos(uShineAngle) + y * sin(uShineAngle);
		float localX = fract(pos * uShineBands);
		float sweep = fract(uTime * uShineSpeed);
		float d = abs(localX - sweep);
		float dist = min(d, 1.0 - d);
		float glint = smoothstep(uShineWidth, 0.0, dist) * uShineIntensity;
		vec3 result = color.rgb * pulse + uShineColor.rgb * glint * color.a * uShineColor.a;
		return vec4(result, color.a);
	}`;

describe("effects place their pattern on the renderable (WebGL)", () => {
	let renderer;
	let gl;
	let own;
	let atlas;

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
		own = Renderer.createCanvas(ART, ART);
		paintArt(own.getContext("2d"), 0, 0);
		const sheet = Renderer.createCanvas(ATLAS_W, ATLAS_H);
		const ctx = sheet.getContext("2d");
		ctx.fillStyle = "#c06090";
		ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
		// the art's frame, clear around the art as its own texture is
		ctx.clearRect(AT_X, AT_Y, ART, ART);
		paintArt(ctx, AT_X, AT_Y);
		const frame = (filename, x, y) => {
			return {
				filename,
				frame: { x, y, w: ART, h: ART },
				rotated: false,
				trimmed: false,
				spriteSourceSize: { x: 0, y: 0, w: ART, h: ART },
				sourceSize: { w: ART, h: ART },
				pivot: { x: 0.5, y: 0.5 },
			};
		};
		atlas = new TextureAtlas(
			{
				frames: [frame("other", 0, 0), frame("art", AT_X, AT_Y)],
				meta: {
					app: "texturepacker",
					image: "sheet.png",
					size: { w: ATLAS_W, h: ATLAS_H },
					scale: "1",
				},
			},
			sheet,
		);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	/** the sprite: the art with its own texture, or cut from the atlas */
	const sprite = ({
		fromAtlas = false,
		angle = 0,
		flip = false,
		scale = SCALE,
	} = {}) => {
		const s = fromAtlas
			? atlas.createSpriteFromName("art")
			: new Sprite(0, 0, { image: own });
		s.pos.x = CENTRE;
		s.pos.y = CENTRE;
		s.scale(scale);
		if (angle !== 0) {
			s.rotate(angle);
		}
		if (flip) {
			s.flipX(true);
		}
		return s;
	};

	/** the screen around the sprite, as RGB */
	const read = () => {
		const out = new Uint8Array(SPAN * SPAN * 4);
		gl.finish();
		gl.readPixels(
			FROM,
			SIZE - FROM - SPAN,
			SPAN,
			SPAN,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			out,
		);
		return out;
	};

	/**
	 * The screen around the sprite, after a draw: drawn, as a share of its
	 * pixels lit, so two pictures never match for both being empty.
	 */
	const drawnPixels = () => {
		const pixels = read();
		let lit = 0;
		for (let i = 0; i < pixels.length; i += 4) {
			if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) {
				lit++;
			}
		}
		expect(lit / (pixels.length / 4)).toBeGreaterThan(0.15);
		return pixels;
	};

	/** draw a renderable on its own, as a container would */
	const paint = (renderable) => {
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();
		renderer.save();
		renderer.resetTransform();
		renderable.preDraw(renderer);
		renderable.draw(renderer);
		renderable.postDraw(renderer);
		renderer.restore();
		renderer.flush();
		return drawnPixels();
	};

	/** draw a sprite through these effects */
	const drawn = (options, ...effects) => {
		const s = sprite(options);
		for (const fx of effects) {
			s.addPostEffect(fx);
		}
		return paint(s);
	};

	/** a second effect that draws what it is given */
	const passThrough = () => {
		return new ShaderEffect(renderer, {
			glsl: "vec4 apply(vec4 color, vec2 uv) { return color; }",
			wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }",
		});
	};

	/**
	 * How far apart two pictures are: the share of pixels that differ by
	 * more than `tolerance` in a channel. The paths sample differently (the
	 * texture, or a capture of it already drawn), so rounding and an edge
	 * texel are allowed for, a misplaced pattern is not.
	 */
	const differing = (a, b, tolerance = 12) => {
		let count = 0;
		for (let i = 0; i < a.length; i += 4) {
			if (
				Math.abs(a[i] - b[i]) > tolerance ||
				Math.abs(a[i + 1] - b[i + 1]) > tolerance ||
				Math.abs(a[i + 2] - b[i + 2]) > tolerance
			) {
				count++;
			}
		}
		return count / (a.length / 4);
	};

	// one fresh effect per draw: each draw is a different renderable
	const EFFECTS = {
		Sway: () => {
			return new SwayEffect(renderer, { strength: 0.15, speed: 1 }).setTime(1);
		},
		Wave: () => {
			const fx = new WaveEffect(renderer, {
				amplitude: 0.08,
				frequency: 6,
				speed: 1,
				anchor: 1,
			});
			fx.setTime(1);
			return fx;
		},
		Shine: () => {
			const fx = new ShineEffect(renderer, {
				speed: 1,
				width: 0.15,
				intensity: 1,
				angle: 0.5,
			});
			fx.setTime(0.4);
			return fx;
		},
		Vignette: () => {
			return new VignetteEffect(renderer, { strength: 0.8, size: 12 });
		},
		RadialGradient: () => {
			return new RadialGradientEffect(renderer, { intensity: 1 });
		},
		"Scanline curve": () => {
			return new ScanlineEffect(renderer, {
				opacity: 0,
				curvature: 0.4,
				vignetteStrength: 0.5,
			});
		},
	};
	// patterns measured in the texture: the same on the same art, wherever
	// the sprite is drawn from, but not between an atlas and a texture of
	// its own (by design: their grain is the texture's)
	const TEXTURE_PATTERNS = {
		Dissolve: () => {
			return new DissolveEffect(renderer, { progress: 0.4 });
		},
		Hologram: () => {
			const fx = new HologramEffect(renderer);
			fx.setTime(0.3);
			return fx;
		},
		"Scanline lines": () => {
			return new ScanlineEffect(renderer, { opacity: 0.6 });
		},
	};

	// a wave measures its amplitude and frequency across its texture, and a
	// shine its sweep, bands and width (they stay as they were): only a
	// wave's planted row is the sprite's own
	const ACROSS_SPRITE = Object.keys(EFFECTS).filter((name) => {
		return name !== "Wave" && name !== "Shine";
	});

	describe("one effect on a sprite cut from an atlas", () => {
		it.for(ACROSS_SPRITE)(
			"%s draws as on a sprite with its own texture",
			(name, ctx) => {
				requireWebGL(ctx);
				const make = EFFECTS[name];
				const reference = drawn({}, make());
				const fromAtlas = drawn({ fromAtlas: true }, make());
				expect(differing(reference, fromAtlas)).toBeLessThan(0.01);
			},
		);

		it.for(ACROSS_SPRITE)(
			"%s draws as on its own texture when flipped",
			(name, ctx) => {
				requireWebGL(ctx);
				const make = EFFECTS[name];
				const reference = drawn({ flip: true }, make());
				const fromAtlas = drawn({ fromAtlas: true, flip: true }, make());
				expect(differing(reference, fromAtlas)).toBeLessThan(0.01);
			},
		);
	});

	describe("a wave's anchor", () => {
		/** the rows from `y0` (screen) to the sprite's bottom, as drawn */
		const rows = (pixels, y0) => {
			// readPixels is bottom-up: the sprite's last rows come first
			return pixels.slice(0, (SPAN - y0) * SPAN * 4);
		};

		it.for([false, true])(
			"keeps the sprite's own bottom row planted (from an atlas: %s)",
			(fromAtlas, ctx) => {
				requireWebGL(ctx);
				const still = drawn({ fromAtlas });
				const waved = drawn({ fromAtlas }, EFFECTS.Wave());
				// its last row of art (two on the screen) does not move: the
				// wave fades out toward it, so the rows above move a little
				const planted = SPAN - SCALE;
				expect(differing(rows(still, planted), rows(waved, planted))).toBe(0);
				// while the top does
				expect(differing(still, waved)).toBeGreaterThan(0.05);
			},
		);
	});

	describe("a shine", () => {
		/** the previous body, set as the built-in one is */
		const oldShine = () => {
			const fx = new ShaderEffect(renderer, OLD_SHINE);
			fx.setUniform("uShineColor", [1, 1, 1, 1]);
			fx.setUniform("uShineWidth", 0.15);
			fx.setUniform("uShineSpeed", 1);
			fx.setUniform("uShineIntensity", 1);
			fx.setUniform("uShineAngle", 0.5);
			fx.setUniform("uShineBands", 3);
			fx.setUniform("uPulseDepth", 0);
			fx.setUniform("uPulseSpeed", 3);
			fx.setUniform("uUVYDir", 1);
			fx.setTime(0.4);
			return fx;
		};
		const shine = () => {
			const fx = new ShineEffect(renderer, {
				speed: 1,
				width: 0.15,
				intensity: 1,
				angle: 0.5,
				bands: 3,
			});
			fx.setTime(0.4);
			return fx;
		};

		it.for([false, true])(
			"keeps its sweep across its texture, as it always did (from an atlas: %s)",
			(fromAtlas, ctx) => {
				requireWebGL(ctx);
				const now = drawn({ fromAtlas }, shine());
				const before = drawn({ fromAtlas }, oldShine());
				expect(differing(now, before, 2)).toBeLessThan(0.002);
			},
		);
	});

	describe("two effects", () => {
		const ALL = { ...EFFECTS, ...TEXTURE_PATTERNS };

		it.for(Object.keys(ALL))("%s draws as it does alone", (name, ctx) => {
			requireWebGL(ctx);
			const make = ALL[name];
			const alone = drawn({}, make());
			const chained = drawn({}, make(), passThrough());
			expect(differing(alone, chained)).toBeLessThan(0.01);
		});

		it.for(Object.keys(ALL))(
			"%s draws as it does alone, on a sprite cut from an atlas",
			(name, ctx) => {
				requireWebGL(ctx);
				const make = ALL[name];
				const alone = drawn({ fromAtlas: true }, make());
				const chained = drawn({ fromAtlas: true }, make(), passThrough());
				expect(differing(alone, chained)).toBeLessThan(0.01);
			},
		);

		it.for(["Sway", "Shine", "Vignette", "RadialGradient"])(
			"%s turns with a rotated sprite as it does alone",
			(name, ctx) => {
				requireWebGL(ctx);
				const make = EFFECTS[name];
				const alone = drawn({ angle: 0.6 }, make());
				const chained = drawn({ angle: 0.6 }, make(), passThrough());
				// a rotated sprite's edge is filtered once more through the
				// capture: a thin ring, not a misplaced pattern
				expect(differing(alone, chained)).toBeLessThan(0.04);
			},
		);

		it("where the second is an outline, the first still draws as alone", (ctx) => {
			requireWebGL(ctx);
			const alone = drawn({}, EFFECTS.Vignette());
			const outlined = drawn(
				{},
				EFFECTS.Vignette(),
				new OutlineEffect(renderer, { color: [1, 0, 1], width: 1 }),
			);
			// the outline adds its ring around the art; inside, the same
			expect(differing(alone, outlined)).toBeLessThan(0.15);
		});

		it("noise_uv runs across the sprite, as it does with one effect", (ctx) => {
			requireWebGL(ctx);
			const asColour = () => {
				return new ShaderEffect(renderer, {
					glsl: "vec4 apply(vec4 color, vec2 uv) { return vec4(noise_uv, 0.0, 1.0) * color.a; }",
					wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return vec4f(noise_uv, 0.0, 1.0) * color.a; }",
				});
			};
			const alone = drawn({}, asColour());
			const chained = drawn({}, asColour(), passThrough());
			expect(differing(alone, chained)).toBeLessThan(0.01);
			// and it is the sprite's: 0..1 across it, left to right in red and
			// top to bottom in green (sampled inside the art, past its margin)
			const at = (pixels, x, y) => {
				const i = ((SPAN - 1 - y) * SPAN + x) * 4;
				return [pixels[i], pixels[i + 1]];
			};
			const expected = (screen) => {
				return (255 * (screen + 0.5)) / SPAN;
			};
			for (const [x, y] of [
				[MARGIN * SCALE + 2, 2],
				[SPAN - MARGIN * SCALE - 3, SPAN - 3],
				[SPAN / 2, SPAN / 2],
			]) {
				const [r, g] = at(chained, x, y);
				expect(Math.abs(r - expected(x))).toBeLessThan(8);
				expect(Math.abs(g - expected(y))).toBeLessThan(8);
			}
		});
	});

	// a zoomed camera (or one drawn away from the screen's corner) scales
	// the world through its projection, not the renderable's transform: a
	// chain's passes run in the target's pixels, so they go through it too
	describe("two effects, under a camera's zoom", () => {
		/** draw with a camera zoomed in twice on the middle of the screen */
		const zoomed = (draw) => {
			const saved = renderer.projectionMatrix.clone();
			const half = SIZE / 4;
			renderer.setProjection(
				new Matrix3d().ortho(
					CENTRE - half,
					CENTRE + half,
					CENTRE + half,
					CENTRE - half,
					-1000,
					1000,
				),
			);
			try {
				return draw();
			} finally {
				renderer.setProjection(saved);
			}
		};
		const ALL = { ...EFFECTS, ...TEXTURE_PATTERNS };

		it.for(Object.keys(ALL))("%s draws as it does alone", (name, ctx) => {
			requireWebGL(ctx);
			const make = ALL[name];
			// at its own size, zoomed to the same span on the screen
			const alone = zoomed(() => {
				return drawn({ scale: 1 }, make());
			});
			const chained = zoomed(() => {
				return drawn({ scale: 1 }, make(), passThrough());
			});
			expect(differing(alone, chained)).toBeLessThan(0.01);
		});
	});

	describe("unchanged where nothing was wrong", () => {
		it.for(Object.keys({ ...EFFECTS, ...TEXTURE_PATTERNS }))(
			"%s on a sprite with its own texture draws as the effect always drew",
			(name, ctx) => {
				requireWebGL(ctx);
				const make = { ...EFFECTS, ...TEXTURE_PATTERNS }[name];
				const throughSprite = drawn({}, make());
				// the same art straight through the renderer, with no
				// renderable to place it on: the effect's `uv`, as always
				const fx = make();
				renderer.backgroundColor.setColor(0, 0, 0, 255);
				renderer.clear();
				renderer.save();
				renderer.resetTransform();
				renderer.customShader = fx;
				renderer.drawImage(own, 0, 0, ART, ART, FROM, FROM, SPAN, SPAN);
				renderer.customShader = undefined;
				renderer.restore();
				renderer.flush();
				const asAlways = drawnPixels();
				expect(differing(throughSprite, asAlways, 2)).toBeLessThan(0.002);
			},
		);
	});

	describe("a camera's effects", () => {
		/** a full screen of crossed stripes through a camera's chain */
		const throughCamera = (effect) => {
			const art = Renderer.createCanvas(SIZE, SIZE);
			const actx = art.getContext("2d");
			actx.fillStyle = "#909090";
			actx.fillRect(0, 0, SIZE, SIZE);
			actx.fillStyle = "#2050c0";
			for (let i = 0; i < SIZE; i += 10) {
				actx.fillRect(i, 0, 4, SIZE);
				actx.fillRect(0, i + 3, SIZE, 3);
			}
			actx.fillStyle = "#ff3030";
			actx.fillRect(10, 10, 20, 20);
			const camera = {
				_postEffectManaged: true,
				isDefault: true,
				postEffects: [effect],
			};
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			renderer.save();
			renderer.resetTransform();
			renderer.beginPostEffect(camera);
			renderer.drawImage(art, 0, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
			renderer.endPostEffect(camera);
			renderer.restore();
			renderer.flush();
			const out = new Uint8Array(SIZE * SIZE * 4);
			gl.finish();
			gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
			// drawn: most of the screen is lit
			let lit = 0;
			for (let i = 0; i < out.length; i += 4) {
				if (out[i] + out[i + 1] + out[i + 2] > 30) {
					lit++;
				}
			}
			expect(lit / (SIZE * SIZE)).toBeGreaterThan(0.5);
			return out;
		};

		// the bodies as they were before the local space, as custom effects
		const OLD_SCANLINE = `
			uniform float uScanlineOpacity;
			uniform float uCurvature;
			uniform float uVignetteStrength;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 coords = uv;
				if (uCurvature > 0.0) {
					vec2 centered = uv * 2.0 - 1.0;
					centered *= 1.0 + uCurvature * dot(centered, centered);
					coords = centered * 0.5 + 0.5;
					if (coords.x < 0.0 || coords.x > 1.0 || coords.y < 0.0 || coords.y > 1.0) {
						discard;
					}
					color = texture2D(uSampler, coords) * vColor;
				}
				float line = sin(coords.y * 800.0) * 0.5 + 0.5;
				color.rgb *= 1.0 - line * uScanlineOpacity;
				if (uVignetteStrength > 0.0) {
					vec2 vig = coords * (1.0 - coords);
					float vigFactor = vig.x * vig.y * 15.0;
					color.rgb *= clamp(pow(vigFactor, uVignetteStrength), 0.0, 1.0);
				}
				return color;
			}`;

		it("draw a curved scanline exactly as before", (ctx) => {
			requireWebGL(ctx);
			const now = throughCamera(
				new ScanlineEffect(renderer, {
					opacity: 0.5,
					curvature: 0.3,
					vignetteStrength: 0.4,
				}),
			);
			const old = new ShaderEffect(renderer, OLD_SCANLINE);
			old.setUniform("uScanlineOpacity", 0.5);
			old.setUniform("uCurvature", 0.3);
			old.setUniform("uVignetteStrength", 0.4);
			const before = throughCamera(old);
			expect(differing(now, before, 2)).toBeLessThan(0.002);
		});

		it("draw a slanted shine exactly as before", (ctx) => {
			requireWebGL(ctx);
			const shine = new ShineEffect(renderer, {
				speed: 1,
				width: 0.1,
				intensity: 1,
				angle: 1.0,
			});
			shine.setTime(0.3);
			const now = throughCamera(shine);
			const old = new ShaderEffect(renderer, OLD_SHINE);
			old.setUniform("uShineColor", [1, 1, 1, 1]);
			old.setUniform("uShineWidth", 0.1);
			old.setUniform("uShineSpeed", 1);
			old.setUniform("uShineIntensity", 1);
			old.setUniform("uShineAngle", 1.0);
			old.setUniform("uShineBands", 1);
			old.setUniform("uPulseDepth", 0);
			old.setUniform("uPulseSpeed", 3);
			old.setUniform("uUVYDir", 1);
			old.setTime(0.3);
			const before = throughCamera(old);
			expect(differing(now, before, 2)).toBeLessThan(0.002);
		});

		it("still sweep top to bottom over WebGL's bottom-up capture", (ctx) => {
			requireWebGL(ctx);
			// a white screen through a camera's chain: a vertical shine a
			// quarter of the way through its sweep, then a pass-through
			const white = Renderer.createCanvas(SIZE, SIZE);
			const wctx = white.getContext("2d");
			wctx.fillStyle = "#808080";
			wctx.fillRect(0, 0, SIZE, SIZE);
			const shine = new ShineEffect(renderer, {
				speed: 1,
				width: 0.05,
				intensity: 1,
				angle: Math.PI / 2,
			});
			shine.setTime(0.25);
			const camera = {
				_postEffectManaged: true,
				isDefault: true,
				postEffects: [shine, passThrough()],
			};
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			renderer.save();
			renderer.resetTransform();
			renderer.beginPostEffect(camera);
			renderer.drawImage(white, 0, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
			renderer.endPostEffect(camera);
			renderer.restore();
			renderer.flush();
			// the brightest row, from the top of the screen
			const column = new Uint8Array(SIZE * 4);
			gl.finish();
			gl.readPixels(SIZE / 2, 0, 1, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, column);
			let brightest = 0;
			let row = -1;
			for (let i = 0; i < SIZE; i++) {
				if (column[i * 4] > brightest) {
					brightest = column[i * 4];
					// readPixels runs bottom-up
					row = SIZE - 1 - i;
				}
			}
			expect(brightest).toBeGreaterThan(200);
			expect(Math.abs(row - SIZE / 4)).toBeLessThan(4);
		});
	});

	describe("the space", () => {
		it("maps the corners of a renderable to 0..1, whatever its transform", (ctx) => {
			requireWebGL(ctx);
			const s = sprite({ angle: 0.7, flip: true });
			renderer.save();
			renderer.resetTransform();
			renderer.translate(13, -7);
			renderer.scale(1.5, 1.5);
			// what preDraw applies before telling the effects
			s.addPostEffect(EFFECTS.Vignette());
			s.preDraw(renderer);
			const space = s._effectSpace;
			// where the corners of the art land, by the transform drawn with
			const m = renderer.currentTransform.val;
			const toTarget = (x, y) => {
				return [m[0] * x + m[4] * y + m[12], m[1] * x + m[5] * y + m[13]];
			};
			const local = ([x, y]) => {
				return [
					space.localX[0] * x + space.localX[1] * y + space.localX[2],
					space.localY[0] * x + space.localY[1] * y + space.localY[2],
				];
			};
			const corners = [
				[s.pos.x, s.pos.y, 0, 0],
				[s.pos.x + ART, s.pos.y, 1, 0],
				[s.pos.x, s.pos.y + ART, 0, 1],
				[s.pos.x + ART, s.pos.y + ART, 1, 1],
			];
			for (const [x, y, u, v] of corners) {
				const [lu, lv] = local(toTarget(x, y));
				expect(lu).toBeCloseTo(u, 5);
				expect(lv).toBeCloseTo(v, 5);
			}
			s.postDraw(renderer);
			renderer.restore();
		});

		it("in a chain, maps them from the target's pixels, through a camera's zoom", (ctx) => {
			requireWebGL(ctx);
			const s = sprite({ angle: 0.7, flip: true });
			const saved = renderer.projectionMatrix.clone();
			// zoomed in twice, the view's corner at (20, 10)
			renderer.setProjection(
				new Matrix3d().ortho(20, 20 + SIZE / 2, 10 + SIZE / 2, 10, -1000, 1000),
			);
			renderer.save();
			renderer.resetTransform();
			try {
				s.addPostEffect(EFFECTS.Vignette());
				s.addPostEffect(passThrough());
				s.preDraw(renderer);
				const space = s._effectSpace;
				expect(space.mode).toBe(LOCAL_MODE.chain);
				// where the corners of the art land on the target, in pixels
				const m = renderer.currentTransform.val;
				const toTarget = (x, y) => {
					const wx = m[0] * x + m[4] * y + m[12];
					const wy = m[1] * x + m[5] * y + m[13];
					return [(wx - 20) * 2, (wy - 10) * 2];
				};
				const local = ([x, y]) => {
					return [
						space.localX[0] * x + space.localX[1] * y + space.localX[2],
						space.localY[0] * x + space.localY[1] * y + space.localY[2],
					];
				};
				const corners = [
					[s.pos.x, s.pos.y, 0, 0],
					[s.pos.x + ART, s.pos.y, 1, 0],
					[s.pos.x, s.pos.y + ART, 0, 1],
					[s.pos.x + ART, s.pos.y + ART, 1, 1],
				];
				for (const [x, y, u, v] of corners) {
					const [lu, lv] = local(toTarget(x, y));
					expect(lu).toBeCloseTo(u, 5);
					expect(lv).toBeCloseTo(v, 5);
				}
				// and its pixels are twice its size there, scaled and zoomed
				const scale = renderer._effectScales.get(s);
				expect(scale[0]).toBeCloseTo(SCALE * 2, 5);
				expect(scale[1]).toBeCloseTo(SCALE * 2, 5);
				s.postDraw(renderer);
			} finally {
				renderer.restore();
				renderer.setProjection(saved);
			}
		});

		it("leaves a renderable it cannot place in the space uv always was", (ctx) => {
			requireWebGL(ctx);
			// no finite size: nothing to be 0..1 across
			const s = sprite();
			s.width = Infinity;
			expect(renderer._effectSpaceOf(s, LOCAL_MODE.chain)).toBe(null);
			// a perspective view (Camera3d)
			const s2 = sprite();
			const saved = renderer.projectionMatrix.val[11];
			renderer.projectionMatrix.val[11] = -1;
			expect(renderer._effectSpaceOf(s2, LOCAL_MODE.chain)).toBe(null);
			renderer.projectionMatrix.val[11] = saved;
			// drawn with its one effect, a renderable that is not a sprite
			const notASprite = { width: 10, height: 10, pos: { x: 0, y: 0 } };
			expect(renderer._effectSpaceOf(notASprite, LOCAL_MODE.sprite)).toBe(null);
		});

		it("puts a renderable's one effect back once it is drawn", (ctx) => {
			requireWebGL(ctx);
			const fx = EFFECTS.Vignette();
			drawn({}, fx);
			expect(fx._shader._uniformCache.ME_mode).toBe(LOCAL_MODE.uv);
		});

		it("gives a camera's chain no renderable space, nor its pixel size", () => {
			const bare = Object.create(Renderer.prototype);
			bare._effectSpaces = new WeakMap();
			bare._effectScales = new WeakMap();
			bare._chainSpace = { mode: LOCAL_MODE.chain };
			bare._chainScale = [2, 2];
			const camera = { _postEffectManaged: true };
			bare._effectSpaces.set(camera, { mode: LOCAL_MODE.chain });
			bare._effectScales.set(camera, [2, 2]);
			bare._beginChainSpace(camera);
			expect(bare._chainSpace).toBe(null);
			expect(bare._chainScale).toBe(null);
		});

		it("hands a chain the size of its renderable's pixels, until it is done", () => {
			const bare = Object.create(Renderer.prototype);
			bare._effectSpaces = new WeakMap();
			bare._effectScales = new WeakMap();
			const sprite = {};
			const scale = [3, 0.5];
			bare._effectScales.set(sprite, scale);
			bare._beginChainSpace(sprite);
			expect(bare._chainScale).toBe(scale);
			// taken once: a later chain of the same renderable is measured anew
			expect(bare._effectScales.has(sprite)).toBe(false);
			bare._clearChainSpace();
			expect(bare._chainScale).toBe(null);
		});
	});

	describe("on WebGPU (the block the WGSL bodies read)", () => {
		it("assembles the local space for a built-in body", () => {
			const body = `
struct U { uStrength : f32, };
@group(3) @binding(0) var<uniform> fx : U;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let vig = ME_local * (1.0 - ME_local);
	return vec4f(color.rgb * vig.x * vig.y * fx.uStrength, color.a);
}`;
			const parsed = parseWGSLBody(body);
			expect(parsed.ok).toBe(true);
			expect(parsed.builtins.local).toBe(true);
			const { code, bindings } = buildWGSLModule(body, parsed);
			expect(bindings.me).toBeGreaterThan(0);
			expect(code).toContain("struct MEBuiltins");
			expect(code).toContain("fn ME_localToUV");
			expect(code).toContain("out.vLocal");
			expect(code).toContain("ME_local = in.vLocal;");
		});

		it("writes the space into the block's mirror, and only a change", () => {
			const fx = Object.create(ShaderEffect.prototype);
			const changes = [];
			fx._hasLocalSpace = true;
			fx.wgslRealization = {
				meMirror: new Float32Array(ME_LAYOUT.length),
				onUniformChange: () => {
					changes.push("flush");
				},
			};
			const space = {
				mode: LOCAL_MODE.chain,
				localX: [0.5, 0, -1],
				localY: [0, 0.25, -2],
				toUV: [1, 0, 0, -1],
				art: [0.1, 0.2, 0.3, 0.4],
			};
			fx._setLocalSpace(space);
			const me = fx.wgslRealization.meMirror;
			expect(me[ME_LAYOUT.mode]).toBe(LOCAL_MODE.chain);
			expect([...me.slice(ME_LAYOUT.localX, ME_LAYOUT.localX + 3)]).toEqual([
				0.5, 0, -1,
			]);
			expect([...me.slice(ME_LAYOUT.localY, ME_LAYOUT.localY + 3)]).toEqual([
				0, 0.25, -2,
			]);
			expect([...me.slice(ME_LAYOUT.toUV, ME_LAYOUT.toUV + 4)]).toEqual([
				1, 0, 0, -1,
			]);
			expect(me[ME_LAYOUT.art + 2]).toBeCloseTo(0.3, 6);
			expect(changes).toEqual(["flush"]);
			// the same again draws nothing first
			fx._setLocalSpace(space);
			expect(changes).toEqual(["flush"]);
			// and back to `uv`
			fx._setLocalSpace(null);
			expect(me[ME_LAYOUT.mode]).toBe(LOCAL_MODE.uv);
			expect(changes).toEqual(["flush", "flush"]);
		});
	});

	describe("on a mesh", () => {
		it("gives a body reading the local space `uv`, as a mesh always did", () => {
			const glsl = spliceEffect(
				"vec4 ME_effect(vec4 c, vec2 uv) { return c; }\nvoid main() {}",
				"vec4 apply(vec4 color, vec2 uv) { return color * ME_local.x; }",
			);
			expect(glsl).toContain("vec2 ME_local;");
			expect(glsl).toContain(
				"ME_local = uv; ME_art = uv; return apply(c, uv);",
			);
			const wgsl = spliceEffect(
				"fn ME_effect(c : vec4f, uv : vec2f) -> vec4f { return c; }",
				"fn apply(color : vec4f, uv : vec2f) -> vec4f { return color * ME_local.x; }",
			);
			expect(wgsl).toContain("var<private> ME_local : vec2f;");
			expect(wgsl).toContain(
				"ME_local = uv; ME_art = uv; return apply(c, uv);",
			);
			// a body that does not read it is spliced as it always was
			const plain = spliceEffect(
				"vec4 ME_effect(vec4 c, vec2 uv) { return c; }",
				"vec4 apply(vec4 color, vec2 uv) { return color; }",
			);
			expect(plain).not.toContain("ME_local");
		});
	});
});
